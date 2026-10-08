from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict
from sqlalchemy import select, or_
from sqlalchemy.orm import Session, defer
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.dataset import Dataset
from app.models.decision_approval import DecisionApproval
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_execution import DecisionExecution, DecisionExecutionEvent
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_governance import DecisionGovernanceEvent
from app.models.scenario import Scenario
from app.models.ml_analysis import MLAnalysis

from app.schemas.decision_portfolio import (
    PortfolioSummaryKPIs,
    GovernanceDistributionItem,
    ExecutionDistributionItem,
    OutcomeDistributionItem,
    CrossDecisionMetricItem,
    PortfolioRecurringDeviation,
    PortfolioSignalSummary,
    ExecutionFailureFinding,
    PortfolioTrendPeriod,
    DecisionDependencyItem,
    DecisionClusterItem,
    PortfolioDecisionRow,
    DecisionPortfolioOverviewResponse,
    DecisionPortfolioTrendsResponse,
    DecisionPortfolioMetricsResponse,
    DecisionPortfolioSignalsResponse,
    DecisionPortfolioDependenciesResponse,
    PortfolioConcentrationItem,
    PortfolioDependencyExposure,
    PortfolioOperationsSummary,
    PortfolioBottleneckItem,
    PortfolioCapacityIndicators,
    PortfolioExposureIndicators,
    PortfolioCapacityResponse,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionPortfolioService:
    """
    Read-only, analytical portfolio layer (Phase 11).
    Aggregates and cross-correlates decisions, governance states, execution records,
    empirical outcomes, learning signals, and explicit dependencies across a project.
    Strictly non-autonomous: zero mutations, zero synthetic scores, zero causal claims.
    """

    # Phase 8 exact persisted statuses
    PHASE8_ACTIVE_SIGNAL_STATUSES = {"NEW", "ACKNOWLEDGED", "INVESTIGATING", "ACTIVE"}
    PHASE8_INACTIVE_SIGNAL_STATUSES = {"RESOLVED", "DISMISSED"}

    @classmethod
    def is_signal_active(cls, signal: DecisionLearningSignal) -> bool:
        """
        Phase 8 signal status semantics:
        Active: NEW, ACKNOWLEDGED, INVESTIGATING
        Inactive: RESOLVED, DISMISSED
        """
        stat = (signal.status or "NEW").upper()
        return stat in cls.PHASE8_ACTIVE_SIGNAL_STATUSES

    @staticmethod
    def is_material_deviation(outcome: DecisionOutcome) -> bool:
        """
        Phase 7 material-deviation condition:
        Reuses established Phase 7 / Phase 6 definitions:
        - MATERIALLY_DIFFERED: outcome exceeds material threshold (material deviation).
        - DIFFERED: outcome differs but remains within material threshold (non-material; NOT a material deviation).
        - MATCHED / PENDING: not material deviation.
        """
        status_str = (outcome.outcome_status or "").upper()
        if status_str == "MATERIALLY_DIFFERED":
            return True
        if status_str in ("MATCHED", "PENDING", "DIFFERED"):
            return False
        if outcome.relative_delta is not None:
            thresh = outcome.threshold_used if outcome.threshold_used is not None else 0.05
            return abs(outcome.relative_delta) > thresh
        return False

    @classmethod
    def get_portfolio_overview(
        cls,
        db: Session,
        project_id: str,
        governance_status_filter: Optional[str] = None,
        execution_status_filter: Optional[str] = None,
        outcome_status_filter: Optional[str] = None,
        metric_filter: Optional[str] = None,
        signal_type_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_observations: int = 3,
    ) -> DecisionPortfolioOverviewResponse:
        """
        Master read-only aggregator for the project decision portfolio.
        Executes scoped batch queries and synthesizes factual KPIs, distributions,
        cross-decision patterns, explicit dependencies, and the decision inventory.
        """
        # 1. Verify project existence & isolation
        project = db.scalar(select(Project).where(Project.id == project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # 2. Batch fetch datasets in project (defer massive profile_data column)
        datasets = db.scalars(
            select(Dataset)
            .options(defer(Dataset.profile_data))
            .where(Dataset.project_id == project_id)
        ).all()
        dataset_map = {d.id: d for d in datasets}
        dataset_ids = list(dataset_map.keys())

        # 3. Batch fetch decisions / approvals
        approvals: List[DecisionApproval] = []
        if dataset_ids:
            approvals = db.scalars(
                select(DecisionApproval).where(DecisionApproval.dataset_id.in_(dataset_ids))
            ).all()

        # 4. Batch fetch executions
        executions = db.scalars(
            select(DecisionExecution).where(DecisionExecution.project_id == project_id)
        ).all()

        # 5. Batch fetch outcomes
        outcomes = db.scalars(
            select(DecisionOutcome)
            .where(DecisionOutcome.project_id == project_id)
            .order_by(DecisionOutcome.recorded_at.asc(), DecisionOutcome.created_at.asc())
        ).all()

        # 6. Batch fetch learning signals
        signals = db.scalars(
            select(DecisionLearningSignal).where(DecisionLearningSignal.project_id == project_id)
        ).all()

        # 7. Batch fetch recommendations for metric & scenario fallback
        recommendations: List[Any] = []
        if dataset_ids:
            recs1 = db.scalars(
                select(DecisionRecommendation).where(DecisionRecommendation.dataset_id.in_(dataset_ids))
            ).all()
            recs2 = db.scalars(
                select(DecisionRecommendationEvaluation).where(DecisionRecommendationEvaluation.dataset_id.in_(dataset_ids))
            ).all()
            recommendations.extend(recs1)
            recommendations.extend(recs2)
        rec_map = {r.id: r for r in recommendations}

        # 8. Build canonical decision collection
        # Map: decision_id -> dict with metadata
        decision_dict: Dict[str, Dict[str, Any]] = {}

        for app in approvals:
            dec_id = app.decision_id or app.recommendation_id or app.id
            if not dec_id:
                continue
            dec_id_str = str(dec_id)
            if dec_id_str not in decision_dict:
                decision_dict[dec_id_str] = {
                    "decision_id": dec_id_str,
                    "recommendation_id": app.recommendation_id,
                    "dataset_id": app.dataset_id,
                    "created_at": app.created_at or app.requested_at,
                    "updated_at": app.updated_at,
                    "approval": app,
                    "execution": None,
                    "outcomes": [],
                    "signals": [],
                    "metric": None,
                    "scenario_id": None,
                    "ml_analysis_id": None,
                }
            else:
                decision_dict[dec_id_str]["approval"] = app
                if not decision_dict[dec_id_str]["dataset_id"] and app.dataset_id:
                    decision_dict[dec_id_str]["dataset_id"] = app.dataset_id

        for exc in executions:
            dec_id_str = str(exc.decision_id)
            if dec_id_str not in decision_dict:
                decision_dict[dec_id_str] = {
                    "decision_id": dec_id_str,
                    "recommendation_id": exc.recommendation_id,
                    "dataset_id": exc.dataset_id,
                    "created_at": exc.created_at or exc.requested_at,
                    "updated_at": exc.updated_at,
                    "approval": None,
                    "execution": exc,
                    "outcomes": [],
                    "signals": [],
                    "metric": None,
                    "scenario_id": None,
                    "ml_analysis_id": None,
                }
            else:
                decision_dict[dec_id_str]["execution"] = exc
                if exc.recommendation_id and not decision_dict[dec_id_str]["recommendation_id"]:
                    decision_dict[dec_id_str]["recommendation_id"] = exc.recommendation_id

        for out in outcomes:
            dec_id = out.decision_id or out.recommendation_id
            if not dec_id:
                continue
            dec_id_str = str(dec_id)
            if dec_id_str not in decision_dict:
                decision_dict[dec_id_str] = {
                    "decision_id": dec_id_str,
                    "recommendation_id": out.recommendation_id,
                    "dataset_id": out.dataset_id,
                    "created_at": out.created_at or out.recorded_at,
                    "updated_at": out.updated_at,
                    "approval": None,
                    "execution": None,
                    "outcomes": [out],
                    "signals": [],
                    "metric": out.expected_metric or out.actual_metric,
                    "scenario_id": out.scenario_id,
                    "ml_analysis_id": out.ml_analysis_id,
                }
            else:
                decision_dict[dec_id_str]["outcomes"].append(out)
                if not decision_dict[dec_id_str]["metric"]:
                    decision_dict[dec_id_str]["metric"] = out.expected_metric or out.actual_metric
                if not decision_dict[dec_id_str]["scenario_id"]:
                    decision_dict[dec_id_str]["scenario_id"] = out.scenario_id
                if not decision_dict[dec_id_str]["ml_analysis_id"]:
                    decision_dict[dec_id_str]["ml_analysis_id"] = out.ml_analysis_id

        # Also populate from recommendations if not already in dictionary
        for rec in recommendations:
            rec_id_str = str(rec.id)
            if rec_id_str not in decision_dict:
                metric_name = getattr(rec, "target_metric", None) or getattr(rec, "metric_name", None)
                decision_dict[rec_id_str] = {
                    "decision_id": rec_id_str,
                    "recommendation_id": rec_id_str,
                    "dataset_id": rec.dataset_id,
                    "created_at": getattr(rec, "created_at", None),
                    "updated_at": getattr(rec, "updated_at", None),
                    "approval": None,
                    "execution": None,
                    "outcomes": [],
                    "signals": [],
                    "metric": metric_name,
                    "scenario_id": getattr(rec, "scenario_id", None),
                    "ml_analysis_id": getattr(rec, "ml_analysis_id", None),
                }
            else:
                if not decision_dict[rec_id_str]["metric"]:
                    decision_dict[rec_id_str]["metric"] = getattr(rec, "target_metric", None) or getattr(rec, "metric_name", None)
                if not decision_dict[rec_id_str]["scenario_id"]:
                    decision_dict[rec_id_str]["scenario_id"] = getattr(rec, "scenario_id", None)
                if not decision_dict[rec_id_str]["ml_analysis_id"]:
                    decision_dict[rec_id_str]["ml_analysis_id"] = getattr(rec, "ml_analysis_id", None)

        # 9. Link learning signals to decisions (Phase 8 active status semantics)
        unresolved_signals = [s for s in signals if cls.is_signal_active(s)]

        signal_counts_by_dec: Dict[str, int] = defaultdict(int)
        for s in unresolved_signals:
            source_decs = s.source_decision_ids or []
            if isinstance(source_decs, list):
                for dec_id in source_decs:
                    dec_id_str = str(dec_id)
                    signal_counts_by_dec[dec_id_str] += 1
                    if dec_id_str in decision_dict:
                        decision_dict[dec_id_str]["signals"].append(s)

        # 10. Compute canonical statuses for each decision
        portfolio_rows: List[PortfolioDecisionRow] = []

        for dec_id_str, data in decision_dict.items():
            # Governance Status
            gov_status = "DRAFT"
            app = data["approval"]
            if app:
                raw_stat = (app.status or "DRAFT").upper()
                if raw_stat == "WAITING_FOR_APPROVAL":
                    gov_status = "PENDING_APPROVAL"
                else:
                    gov_status = raw_stat
            elif data["execution"]:
                # If execution exists and was confirmed/executed, governance was approved
                gov_status = "APPROVED"

            # Execution Status
            exc_status = None
            exc = data["execution"]
            if exc:
                exc_status = (exc.status or "READY").upper()

            # Outcome Status
            out_status = "PENDING"
            if data["outcomes"]:
                # Latest outcome status
                latest_outcome = sorted(
                    data["outcomes"],
                    key=lambda x: x.recorded_at or x.created_at or datetime.min.replace(tzinfo=timezone.utc)
                )[-1]
                out_status = (latest_outcome.outcome_status or "PENDING").upper()

            ds = dataset_map.get(data["dataset_id"])
            ds_name = ds.name if ds else None

            row = PortfolioDecisionRow(
                decision_id=dec_id_str,
                recommendation_id=data["recommendation_id"],
                dataset_id=data["dataset_id"] or "",
                dataset_name=ds_name,
                metric=data["metric"],
                governance_status=gov_status,
                execution_status=exc_status,
                outcome_status=out_status,
                active_signals_count=signal_counts_by_dec.get(dec_id_str, 0),
                created_at=data["created_at"],
                updated_at=data["updated_at"],
            )
            portfolio_rows.append(row)

        # Sort rows by created_at desc
        portfolio_rows.sort(
            key=lambda r: r.created_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True
        )

        total_decisions = len(portfolio_rows)

        # 11. Calculate Governance Distribution
        gov_counts: Dict[str, int] = defaultdict(int)
        for r in portfolio_rows:
            gov_counts[r.governance_status] += 1

        all_gov_states = [
            "DRAFT", "UNDER_REVIEW", "PENDING_APPROVAL", "APPROVED",
            "REJECTED", "ESCALATED", "ON_HOLD", "EXECUTED", "CLOSED"
        ]
        gov_dist: List[GovernanceDistributionItem] = []
        for st in all_gov_states:
            cnt = gov_counts.get(st, 0)
            pct = round((cnt / total_decisions * 100.0), 2) if total_decisions > 0 else 0.0
            gov_dist.append(GovernanceDistributionItem(status=st, count=cnt, percentage=pct))

        # 12. Calculate Execution Distribution
        exc_counts: Dict[str, int] = defaultdict(int)
        for r in portfolio_rows:
            if r.execution_status:
                exc_counts[r.execution_status] += 1

        all_exc_states = [
            "READY", "PENDING_CONFIRMATION", "CONFIRMED", "EXECUTING",
            "EXECUTED", "EXECUTION_FAILED", "NOT_EXECUTED", "OUTCOME_MONITORING", "CLOSED"
        ]
        exc_dist: List[ExecutionDistributionItem] = []
        for st in all_exc_states:
            cnt = exc_counts.get(st, 0)
            pct = round((cnt / total_decisions * 100.0), 2) if total_decisions > 0 else 0.0
            exc_dist.append(ExecutionDistributionItem(status=st, count=cnt, percentage=pct))

        # 13. Calculate Outcome Distribution
        out_counts: Dict[str, int] = defaultdict(int)
        for r in portfolio_rows:
            out_counts[r.outcome_status] += 1

        all_out_states = ["PENDING", "OBSERVED", "MATCHED", "DIFFERED", "MATERIALLY_DIFFERED"]
        out_dist: List[OutcomeDistributionItem] = []
        for st in all_out_states:
            cnt = out_counts.get(st, 0)
            pct = round((cnt / total_decisions * 100.0), 2) if total_decisions > 0 else 0.0
            out_dist.append(OutcomeDistributionItem(status=st, count=cnt, percentage=pct))

        # 14. Compute Concise KPIs
        decisions_with_observed = sum(1 for r in portfolio_rows if r.outcome_status != "PENDING")
        decisions_with_pending = sum(1 for r in portfolio_rows if r.outcome_status == "PENDING")
        decisions_with_signals = sum(1 for r in portfolio_rows if r.active_signals_count > 0)
        decisions_with_failures = sum(1 for r in portfolio_rows if r.execution_status == "EXECUTION_FAILED")

        kpis = PortfolioSummaryKPIs(
            total_decisions=total_decisions,
            decisions_under_review=gov_counts.get("DRAFT", 0) + gov_counts.get("UNDER_REVIEW", 0),
            pending_approval=gov_counts.get("PENDING_APPROVAL", 0),
            approved=gov_counts.get("APPROVED", 0),
            rejected=gov_counts.get("REJECTED", 0),
            escalated=gov_counts.get("ESCALATED", 0),
            on_hold=gov_counts.get("ON_HOLD", 0),
            executed=exc_counts.get("EXECUTED", 0) + gov_counts.get("EXECUTED", 0),
            not_executed=exc_counts.get("NOT_EXECUTED", 0),
            closed=gov_counts.get("CLOSED", 0) + exc_counts.get("CLOSED", 0),
            outcome_monitoring=exc_counts.get("OUTCOME_MONITORING", 0),
            decisions_with_observed_outcomes=decisions_with_observed,
            decisions_with_pending_outcomes=decisions_with_pending,
            decisions_with_active_learning_signals=decisions_with_signals,
            decisions_with_execution_failures=decisions_with_failures,
        )

        # 15. Cross-Decision Metric Intelligence
        # Map: metric_name -> { decisions: set(), outcomes: list() }
        metric_agg: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"decisions": set(), "outcomes": []})
        for r in portfolio_rows:
            m = r.metric
            if m:
                metric_agg[m]["decisions"].add(r.decision_id)

        for out in outcomes:
            m = out.expected_metric or out.actual_metric
            if m:
                metric_agg[m]["outcomes"].append(out)
                dec_id = out.decision_id or out.recommendation_id
                if dec_id:
                    metric_agg[m]["decisions"].add(str(dec_id))

        metrics_patterns: List[CrossDecisionMetricItem] = []
        recurring_deviations: List[PortfolioRecurringDeviation] = []

        for m_name, agg in sorted(metric_agg.items(), key=lambda x: len(x[1]["decisions"]), reverse=True):
            m_decs = sorted(list(agg["decisions"]))
            m_outcomes = agg["outcomes"]
            observed_outcomes_list = [o for o in m_outcomes if o.outcome_status != "PENDING" and o.actual_value is not None]
            material_dev_list = [o for o in observed_outcomes_list if cls.is_material_deviation(o)]

            item = CrossDecisionMetricItem(
                metric_name=m_name,
                decisions_count=len(m_decs),
                observed_outcomes_count=len(observed_outcomes_list),
                material_deviations_count=len(material_dev_list),
                decision_ids=m_decs,
            )
            metrics_patterns.append(item)

            # Check for recurring deviation pattern using Phase 7 material deviation semantics:
            # Requires minimum observations (>= 3) and >= 50% material deviation rate among observed outcomes
            obs_count = len(observed_outcomes_list)
            mat_count = len(material_dev_list)
            if obs_count >= min_observations and obs_count > 0 and (mat_count / obs_count) >= 0.50:
                source_out_ids = [str(o.id) for o in material_dev_list]
                source_sig_ids = [str(s.id) for s in unresolved_signals if s.metric_name == m_name]
                recurring_deviations.append(
                    PortfolioRecurringDeviation(
                        metric_name=m_name,
                        decision_ids=m_decs,
                        observed_outcomes_count=obs_count,
                        material_deviations_count=mat_count,
                        description=f"Repeated material deviation observed across {len(m_decs)} decisions for metric '{m_name}' ({mat_count}/{obs_count} observed outcomes materially deviated).",
                        source_outcome_ids=source_out_ids,
                        source_signal_ids=source_sig_ids,
                    )
                )

        # 16. Learning Signal Portfolio Summary
        sig_by_type: Dict[str, int] = defaultdict(int)
        high_cnt = 0
        review_cnt = 0
        info_cnt = 0
        unresolved_decisions_set: Set[str] = set()

        for s in unresolved_signals:
            sig_by_type[s.signal_type] += 1
            sev = (s.severity or "REVIEW").upper()
            if sev == "HIGH":
                high_cnt += 1
            elif sev == "INFO":
                info_cnt += 1
            else:
                review_cnt += 1

            if s.source_decision_ids and isinstance(s.source_decision_ids, list):
                for d in s.source_decision_ids:
                    unresolved_decisions_set.add(str(d))

        signal_summary = PortfolioSignalSummary(
            total_active_signals=len(unresolved_signals),
            high_count=high_cnt,
            review_count=review_cnt,
            info_count=info_cnt,
            by_type=dict(sig_by_type),
            unresolved_signal_decisions=sorted(list(unresolved_decisions_set)),
        )

        # 17. Execution Failure Patterns
        execution_failures: List[ExecutionFailureFinding] = []
        failure_reasons_seen: Dict[str, List[str]] = defaultdict(list)

        for exc in executions:
            if exc.status == "EXECUTION_FAILED":
                reason = exc.failure_reason or "Unknown execution error."
                sim_key = reason[:40].strip().lower()
                failure_reasons_seen[sim_key].append(exc.decision_id)

                execution_failures.append(
                    ExecutionFailureFinding(
                        decision_id=exc.decision_id,
                        execution_id=exc.id,
                        failure_reason=reason,
                        occurred_at=exc.completed_at or exc.updated_at,
                        similarity_group=None,
                    )
                )

        for fail in execution_failures:
            sim_key = (fail.failure_reason or "")[:40].strip().lower()
            if len(failure_reasons_seen.get(sim_key, [])) > 1:
                fail.similarity_group = "Similar recorded failure descriptions were observed across multiple executions."

        # 18. Decision Dependencies & Clusters (Explicit Shared Entities)
        # Shared dataset version, shared scenario, shared ml model, shared metric
        shared_ds_versions: Dict[str, List[str]] = defaultdict(list)
        shared_scenarios: Dict[str, List[str]] = defaultdict(list)
        shared_models: Dict[str, List[str]] = defaultdict(list)

        for dec_id_str, data in decision_dict.items():
            ds_id = data["dataset_id"]
            if ds_id:
                ds = dataset_map.get(ds_id)
                ds_ver = getattr(ds, "version", 1) if ds else 1
                key = f"{ds_id} (v{ds_ver})"
                shared_ds_versions[key].append(dec_id_str)

            sc_id = data["scenario_id"]
            if sc_id:
                shared_scenarios[str(sc_id)].append(dec_id_str)

            ml_id = data["ml_analysis_id"]
            if ml_id:  # Only when explicitly linked!
                shared_models[str(ml_id)].append(dec_id_str)

        dependencies: List[DecisionDependencyItem] = []
        clusters: List[DecisionClusterItem] = []

        # Shared Dataset Dependencies
        for ds_key, dec_list in shared_ds_versions.items():
            if len(dec_list) >= 2:
                dependencies.append(
                    DecisionDependencyItem(
                        entity_type="DATASET_VERSION",
                        entity_id=ds_key,
                        entity_label=f"Dataset Version {ds_key}",
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                    )
                )
                clusters.append(
                    DecisionClusterItem(
                        cluster_name=f"Dataset Version: {ds_key}",
                        shared_attribute_type="DATASET_VERSION",
                        shared_attribute_value=ds_key,
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                        evidence_summary={"shared_entity": ds_key, "decision_count": len(dec_list)},
                    )
                )

        # Shared Scenario Dependencies
        for sc_id, dec_list in shared_scenarios.items():
            if len(dec_list) >= 2:
                dependencies.append(
                    DecisionDependencyItem(
                        entity_type="SCENARIO",
                        entity_id=sc_id,
                        entity_label=f"Scenario {sc_id}",
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                    )
                )
                clusters.append(
                    DecisionClusterItem(
                        cluster_name=f"Scenario: {sc_id}",
                        shared_attribute_type="SCENARIO",
                        shared_attribute_value=sc_id,
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                        evidence_summary={"shared_entity": sc_id, "decision_count": len(dec_list)},
                    )
                )

        # Shared ML Model Dependencies (Strictly explicit ML linkage only)
        for ml_id, dec_list in shared_models.items():
            if len(dec_list) >= 2:
                dependencies.append(
                    DecisionDependencyItem(
                        entity_type="ML_MODEL",
                        entity_id=ml_id,
                        entity_label=f"Predictive Model {ml_id}",
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                    )
                )
                clusters.append(
                    DecisionClusterItem(
                        cluster_name=f"ML Model: {ml_id}",
                        shared_attribute_type="ML_MODEL",
                        shared_attribute_value=ml_id,
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                        evidence_summary={"shared_entity": ml_id, "decision_count": len(dec_list)},
                    )
                )

        # Shared Metric Clusters
        for m_item in metrics_patterns:
            if m_item.decisions_count >= 2:
                clusters.append(
                    DecisionClusterItem(
                        cluster_name=f"Metric: {m_item.metric_name}",
                        shared_attribute_type="METRIC",
                        shared_attribute_value=m_item.metric_name,
                        decision_count=m_item.decisions_count,
                        decision_ids=m_item.decision_ids,
                        evidence_summary={
                            "metric": m_item.metric_name,
                            "decisions": m_item.decisions_count,
                            "observed_outcomes": m_item.observed_outcomes_count,
                            "material_deviations": m_item.material_deviations_count,
                        },
                    )
                )

        # 19. Apply Filters to Decision Rows if specified
        filtered_rows = portfolio_rows

        if governance_status_filter:
            filtered_rows = [r for r in filtered_rows if r.governance_status.upper() == governance_status_filter.upper()]

        if execution_status_filter:
            filtered_rows = [r for r in filtered_rows if (r.execution_status or "").upper() == execution_status_filter.upper()]

        if outcome_status_filter:
            filtered_rows = [r for r in filtered_rows if r.outcome_status.upper() == outcome_status_filter.upper()]

        if metric_filter:
            filtered_rows = [r for r in filtered_rows if (r.metric or "").lower() == metric_filter.lower()]

        if signal_type_filter:
            # Filter rows that have an active signal matching this type
            matching_decs_for_signal = set()
            for s in unresolved_signals:
                if s.signal_type.upper() == signal_type_filter.upper():
                    if s.source_decision_ids and isinstance(s.source_decision_ids, list):
                        for d in s.source_decision_ids:
                            matching_decs_for_signal.add(str(d))
            filtered_rows = [r for r in filtered_rows if r.decision_id in matching_decs_for_signal]

        if date_from:
            filtered_rows = [
                r for r in filtered_rows
                if r.created_at and r.created_at >= (date_from if date_from.tzinfo else date_from.replace(tzinfo=timezone.utc))
            ]

        if date_to:
            filtered_rows = [
                r for r in filtered_rows
                if r.created_at and r.created_at <= (date_to if date_to.tzinfo else date_to.replace(tzinfo=timezone.utc))
            ]

        # 20. Phase 12: Calculate Capacity, Bottlenecks, Concentration, and Exposures
        capacity_response = cls._compute_capacity_analytics(
            project_id=project_id,
            portfolio_rows=portfolio_rows,
            executions=executions,
            decision_dict=decision_dict,
            unresolved_signals=unresolved_signals,
            shared_ds_versions=shared_ds_versions,
            shared_scenarios=shared_scenarios,
            shared_models=shared_models,
            metrics_patterns=metrics_patterns,
        )

        return DecisionPortfolioOverviewResponse(
            project_id=project_id,
            project_name=project.name,
            last_updated=utc_now(),
            kpis=kpis,
            governance_distribution=gov_dist,
            execution_distribution=exc_dist,
            outcome_distribution=out_dist,
            metrics_patterns=metrics_patterns,
            recurring_deviations=recurring_deviations,
            learning_signals_summary=signal_summary,
            execution_failures=execution_failures,
            dependencies=dependencies,
            clusters=clusters,
            decisions=filtered_rows,
            total_decisions_count=total_decisions,
            portfolio_operations=capacity_response.operations,
            capacity=capacity_response,
        )

    @classmethod
    def get_portfolio_capacity(
        cls,
        db: Session,
        project_id: str,
    ) -> PortfolioCapacityResponse:
        """
        Phase 12: Retrieve portfolio risk, capacity & dependency intelligence.
        Descriptive, read-only analytics answering where the decision portfolio
        is concentrated, dependent, constrained, or operationally exposed.
        """
        overview = cls.get_portfolio_overview(db=db, project_id=project_id)
        if overview.capacity is not None:
            return overview.capacity

        return cls._compute_capacity_analytics(
            project_id=project_id,
            portfolio_rows=[],
            executions=[],
            decision_dict={},
            unresolved_signals=[],
            shared_ds_versions={},
            shared_scenarios={},
            shared_models={},
            metrics_patterns=[],
        )

    @classmethod
    def _compute_capacity_analytics(
        cls,
        project_id: str,
        portfolio_rows: List[PortfolioDecisionRow],
        executions: List[DecisionExecution],
        decision_dict: Dict[str, Dict[str, Any]],
        unresolved_signals: List[DecisionLearningSignal],
        shared_ds_versions: Dict[str, List[str]],
        shared_scenarios: Dict[str, List[str]],
        shared_models: Dict[str, List[str]],
        metrics_patterns: List[CrossDecisionMetricItem],
    ) -> PortfolioCapacityResponse:
        """
        Phase 12: Calculate project-level operational capacity, bottlenecks,
        concentration, and dependency exposures using strictly persisted records.
        """
        # 1. Operations Summary
        pending_app = sum(1 for r in portfolio_rows if r.governance_status == "PENDING_APPROVAL")
        pending_conf = sum(1 for e in executions if (e.status or "").upper() == "PENDING_CONFIRMATION")
        currently_exec = sum(1 for e in executions if (e.status or "").upper() == "EXECUTING")
        outcome_mon = sum(1 for e in executions if (e.status or "").upper() == "OUTCOME_MONITORING")
        exec_fail = sum(1 for e in executions if (e.status or "").upper() == "EXECUTION_FAILED")
        pending_out = sum(1 for r in portfolio_rows if r.outcome_status == "PENDING")
        active_sigs = len(unresolved_signals)

        ops_summary = PortfolioOperationsSummary(
            pending_approval=pending_app,
            pending_confirmation=pending_conf,
            executing=currently_exec,
            outcome_monitoring=outcome_mon,
            execution_failed=exec_fail,
            pending_outcomes=pending_out,
            active_learning_signals=active_sigs,
        )

        # 2. Operational Bottleneck Indicators
        bottlenecks = [
            PortfolioBottleneckItem(
                indicator="Pending Approval",
                count=pending_app,
                description="Decisions awaiting human governance review and approval.",
            ),
            PortfolioBottleneckItem(
                indicator="Awaiting Execution Confirmation",
                count=pending_conf,
                description="Approved decisions awaiting operational confirmation to begin execution.",
            ),
            PortfolioBottleneckItem(
                indicator="Currently Executing",
                count=currently_exec,
                description="Decisions currently in active operational execution.",
            ),
            PortfolioBottleneckItem(
                indicator="Outcome Monitoring",
                count=outcome_mon,
                description="Executed decisions actively tracking real-world empirical outcomes.",
            ),
            PortfolioBottleneckItem(
                indicator="Pending Outcome",
                count=pending_out,
                description="Decisions awaiting observed real-world metric measurements.",
            ),
            PortfolioBottleneckItem(
                indicator="Execution Failed",
                count=exec_fail,
                description="Decisions whose operational execution resulted in a failure record.",
            ),
            PortfolioBottleneckItem(
                indicator="Active Learning Investigation",
                count=active_sigs,
                description="Active Phase 8 learning signals currently under investigation.",
            ),
        ]

        # 3. Capacity Indicators (Workload indicators from persisted execution records)
        completed_execs = sum(1 for e in executions if (e.status or "").upper() == "EXECUTED")
        durations: List[float] = []
        for e in executions:
            if e.started_at and e.completed_at and e.completed_at >= e.started_at:
                durations.append((e.completed_at - e.started_at).total_seconds())

        avg_dur = round(sum(durations) / len(durations), 2) if durations else None

        capacity_indicators = PortfolioCapacityIndicators(
            pending_confirmations=pending_conf,
            currently_executing=currently_exec,
            execution_failures=exec_fail,
            outcome_monitoring=outcome_mon,
            executions_completed=completed_execs,
            avg_execution_duration_seconds=avg_dur,
        )

        # 4. Exposure Indicators (Aggregate existing unresolved signals and outcomes)
        decs_with_signals = sum(1 for r in portfolio_rows if r.active_signals_count > 0)
        decs_awaiting_outcomes = sum(1 for r in portfolio_rows if r.outcome_status == "PENDING")
        decs_with_mat_dev = sum(
            1 for r in portfolio_rows
            if any(cls.is_material_deviation(o) for o in decision_dict.get(r.decision_id, {}).get("outcomes", []))
        )
        decs_with_fail = sum(1 for r in portfolio_rows if r.execution_status == "EXECUTION_FAILED")

        exposure_indicators = PortfolioExposureIndicators(
            decisions_with_active_learning_signals=decs_with_signals,
            decisions_awaiting_outcomes=decs_awaiting_outcomes,
            decisions_with_material_deviations=decs_with_mat_dev,
            decisions_with_execution_failures=decs_with_fail,
        )

        # 5. Descriptive Concentration Analysis
        metric_counts: Dict[str, int] = defaultdict(int)
        for r in portfolio_rows:
            if r.metric:
                metric_counts[r.metric] += 1
        by_metric = [
            PortfolioConcentrationItem(key=m, label=f"Metric: {m}", decision_count=cnt)
            for m, cnt in sorted(metric_counts.items(), key=lambda x: (-x[1], x[0]))
        ]

        dataset_counts: Dict[Tuple[str, str], int] = defaultdict(int)
        for r in portfolio_rows:
            ds_id = r.dataset_id
            ds_name = r.dataset_name or ds_id
            if ds_id:
                dataset_counts[(ds_id, ds_name)] += 1
        by_dataset = [
            PortfolioConcentrationItem(key=ds_id, label=ds_name, decision_count=cnt)
            for (ds_id, ds_name), cnt in sorted(dataset_counts.items(), key=lambda x: (-x[1], x[0][1]))
        ]

        scenario_decs: Dict[str, Set[str]] = defaultdict(set)
        for dec_id_str, d_info in decision_dict.items():
            sc_id = d_info.get("scenario_id")
            if sc_id:
                scenario_decs[str(sc_id)].add(dec_id_str)
        by_scenario = [
            PortfolioConcentrationItem(key=sc_id, label=f"Scenario {sc_id}", decision_count=len(decs))
            for sc_id, decs in sorted(scenario_decs.items(), key=lambda x: (-len(x[1]), x[0]))
        ]

        model_decs: Dict[str, Set[str]] = defaultdict(set)
        for dec_id_str, d_info in decision_dict.items():
            ml_id = d_info.get("ml_analysis_id")
            if ml_id:  # Strictly explicit linkage only!
                model_decs[str(ml_id)].add(dec_id_str)
        by_model = [
            PortfolioConcentrationItem(key=ml_id, label=f"Model {ml_id}", decision_count=len(decs))
            for ml_id, decs in sorted(model_decs.items(), key=lambda x: (-len(x[1]), x[0]))
        ]

        status_counts: Dict[str, int] = defaultdict(int)
        for r in portfolio_rows:
            status_counts[r.governance_status] += 1
        by_status = [
            PortfolioConcentrationItem(key=st, label=st, decision_count=cnt)
            for st, cnt in sorted(status_counts.items(), key=lambda x: (-x[1], x[0]))
        ]

        concentration = {
            "by_metric": by_metric,
            "by_dataset": by_dataset,
            "by_scenario": by_scenario,
            "by_model": by_model,
            "by_status": by_status,
        }

        # 6. Dependency Concentration & Neutral Factual Advisories
        dependency_exposures: List[PortfolioDependencyExposure] = []

        for sc_id, dec_list in sorted(shared_scenarios.items()):
            if len(dec_list) >= 2:
                dependency_exposures.append(
                    PortfolioDependencyExposure(
                        dependency_type="SCENARIO",
                        dependency_id=sc_id,
                        label=f"Scenario {sc_id}",
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                        advisory=f"{len(dec_list)} decisions share Scenario {sc_id}.",
                    )
                )

        for ds_key, dec_list in sorted(shared_ds_versions.items()):
            if len(dec_list) >= 2:
                dependency_exposures.append(
                    PortfolioDependencyExposure(
                        dependency_type="DATASET_VERSION",
                        dependency_id=ds_key,
                        label=f"Dataset {ds_key}",
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                        advisory=f"{len(dec_list)} decisions reference Dataset {ds_key}.",
                    )
                )

        for ml_id, dec_list in sorted(shared_models.items()):
            if len(dec_list) >= 2:
                dependency_exposures.append(
                    PortfolioDependencyExposure(
                        dependency_type="ML_MODEL",
                        dependency_id=ml_id,
                        label=f"Predictive Model {ml_id}",
                        decision_count=len(dec_list),
                        decision_ids=sorted(dec_list),
                        advisory=f"{len(dec_list)} decisions share Predictive Model {ml_id}.",
                    )
                )

        for m_item in metrics_patterns:
            if m_item.decisions_count >= 2:
                dependency_exposures.append(
                    PortfolioDependencyExposure(
                        dependency_type="METRIC",
                        dependency_id=m_item.metric_name,
                        label=f"Metric: {m_item.metric_name}",
                        decision_count=m_item.decisions_count,
                        decision_ids=sorted(m_item.decision_ids),
                        advisory=f"{m_item.decisions_count} decisions target Metric '{m_item.metric_name}'.",
                    )
                )

        return PortfolioCapacityResponse(
            project_id=project_id,
            operations=ops_summary,
            bottlenecks=bottlenecks,
            capacity_indicators=capacity_indicators,
            exposure_indicators=exposure_indicators,
            concentration=concentration,
            dependencies=dependency_exposures,
        )


    @classmethod
    def get_decision_trends(
        cls,
        db: Session,
        project_id: str,
        period: str = "week",
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> DecisionPortfolioTrendsResponse:
        """
        Chronological trend aggregator without date fabrication.
        Groups decision lifecycle events by Day, Week, or Month.
        """
        project = db.scalar(select(Project).where(Project.id == project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        period = period.lower()
        if period not in ("day", "week", "month"):
            period = "week"

        # Fetch records (defer profile_data for performance)
        datasets = db.scalars(
            select(Dataset)
            .options(defer(Dataset.profile_data))
            .where(Dataset.project_id == project_id)
        ).all()
        dataset_ids = [d.id for d in datasets]

        approvals: List[DecisionApproval] = []
        if dataset_ids:
            approvals = db.scalars(
                select(DecisionApproval).where(DecisionApproval.dataset_id.in_(dataset_ids))
            ).all()

        executions = db.scalars(
            select(DecisionExecution).where(DecisionExecution.project_id == project_id)
        ).all()

        outcomes = db.scalars(
            select(DecisionOutcome).where(DecisionOutcome.project_id == project_id)
        ).all()

        signals = db.scalars(
            select(DecisionLearningSignal).where(DecisionLearningSignal.project_id == project_id)
        ).all()

        events: List[Tuple[datetime, str]] = []

        # Decisions created
        seen_decs = set()
        for app in approvals:
            dec_id = app.decision_id or app.recommendation_id or app.id
            if dec_id and dec_id not in seen_decs:
                seen_decs.add(dec_id)
                ts = app.created_at or app.requested_at
                if ts:
                    events.append((ts, "DECISION_CREATED"))
            if app.decided_at and (app.status or "").upper() == "APPROVED":
                events.append((app.decided_at, "APPROVAL"))

        for exc in executions:
            if exc.decision_id and exc.decision_id not in seen_decs:
                seen_decs.add(exc.decision_id)
                ts = exc.created_at or exc.requested_at
                if ts:
                    events.append((ts, "DECISION_CREATED"))
            if exc.completed_at or exc.confirmed_at:
                if exc.status == "EXECUTED":
                    events.append((exc.completed_at or exc.confirmed_at, "EXECUTION"))
                elif exc.status == "EXECUTION_FAILED":
                    events.append((exc.completed_at or exc.updated_at, "FAILURE"))

        for out in outcomes:
            if out.outcome_status != "PENDING" and out.actual_value is not None:
                ts = out.recorded_at or out.created_at
                if ts:
                    events.append((ts, "OUTCOME"))

        for s in signals:
            ts = s.created_at
            if ts:
                events.append((ts, "SIGNAL"))

        # Bucketing helper
        def get_bucket_key(dt: datetime) -> Tuple[str, str]:
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
            if period == "day":
                return dt.strftime("%Y-%m-%d"), dt.strftime("%b %d, %Y")
            elif period == "month":
                return dt.strftime("%Y-%m-01"), dt.strftime("%b %Y")
            else:  # week
                cal = dt.isocalendar()
                return f"{cal[0]}-W{cal[1]:02d}", f"W{cal[1]:02d} {cal[0]}"

        trend_dict: Dict[str, Dict[str, Any]] = {}

        for dt, ev_type in events:
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
            if date_from and dt < (date_from if date_from.tzinfo else date_from.replace(tzinfo=timezone.utc)):
                continue
            if date_to and dt > (date_to if date_to.tzinfo else date_to.replace(tzinfo=timezone.utc)):
                continue

            b_key, b_label = get_bucket_key(dt)
            if b_key not in trend_dict:
                trend_dict[b_key] = {
                    "period_start": b_key,
                    "period_label": b_label,
                    "decisions_created": 0,
                    "approvals_count": 0,
                    "executions_count": 0,
                    "observed_outcomes_count": 0,
                    "learning_signals_count": 0,
                    "execution_failures_count": 0,
                }

            if ev_type == "DECISION_CREATED":
                trend_dict[b_key]["decisions_created"] += 1
            elif ev_type == "APPROVAL":
                trend_dict[b_key]["approvals_count"] += 1
            elif ev_type == "EXECUTION":
                trend_dict[b_key]["executions_count"] += 1
            elif ev_type == "OUTCOME":
                trend_dict[b_key]["observed_outcomes_count"] += 1
            elif ev_type == "SIGNAL":
                trend_dict[b_key]["learning_signals_count"] += 1
            elif ev_type == "FAILURE":
                trend_dict[b_key]["execution_failures_count"] += 1

        sorted_trends = [
            PortfolioTrendPeriod(**v) for k, v in sorted(trend_dict.items(), key=lambda x: x[0])
        ]

        return DecisionPortfolioTrendsResponse(
            project_id=project_id,
            period=period,
            trends=sorted_trends,
        )

    @classmethod
    def get_metric_patterns(
        cls,
        db: Session,
        project_id: str,
        min_observations: int = 3,
    ) -> DecisionPortfolioMetricsResponse:
        """Standalone cross-decision metric intelligence."""
        overview = cls.get_portfolio_overview(db, project_id, min_observations=min_observations)
        return DecisionPortfolioMetricsResponse(
            project_id=project_id,
            metrics=overview.metrics_patterns,
            recurring_deviations=overview.recurring_deviations,
        )

    @classmethod
    def get_learning_signal_summary(
        cls,
        db: Session,
        project_id: str,
    ) -> DecisionPortfolioSignalsResponse:
        """Standalone learning signal portfolio summary."""
        overview = cls.get_portfolio_overview(db, project_id)
        return DecisionPortfolioSignalsResponse(
            project_id=project_id,
            summary=overview.learning_signals_summary,
        )

    @classmethod
    def get_dependencies_and_clusters(
        cls,
        db: Session,
        project_id: str,
    ) -> DecisionPortfolioDependenciesResponse:
        """Standalone explicit decision dependencies and clusters."""
        overview = cls.get_portfolio_overview(db, project_id)
        return DecisionPortfolioDependenciesResponse(
            project_id=project_id,
            dependencies=overview.dependencies,
            clusters=overview.clusters,
        )
