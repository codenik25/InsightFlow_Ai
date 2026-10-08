import statistics
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.dataset import Dataset
from app.models.decision_approval import DecisionApproval
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_outcome import DecisionOutcome
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario

from app.schemas.decision_performance import (
    PerformanceSummary,
    MetricPerformanceItem,
    TrendPeriodItem,
    LearningSignalsAggregation,
    RepeatedDeviationFinding,
    ModelPerformanceItem,
    ScenarioPerformanceItem,
    DecisionPerformanceResponse,
)


class DecisionPerformanceService:
    """Analytical service aggregating historical decision outcomes across decisions, metrics, time, and models."""

    @classmethod
    def get_performance_overview(
        cls,
        db: Session,
        project_id: str,
        min_observations: int = 3,
        period: str = "week",
        threshold: float = 0.05,
    ) -> DecisionPerformanceResponse:
        """Comprehensive project-level decision performance intelligence."""
        # 1. Project verification & isolation
        project = db.scalar(select(Project).where(Project.id == project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # 2. Gather all decisions tracked in this project
        project_dataset_ids = db.scalars(
            select(Dataset.id).where(Dataset.project_id == project_id)
        ).all()

        approval_dec_ids: Set[str] = set()
        if project_dataset_ids:
            approvals = db.scalars(
                select(DecisionApproval).where(DecisionApproval.dataset_id.in_(project_dataset_ids))
            ).all()
            for app in approvals:
                dec_id = app.decision_id or app.id or app.recommendation_id
                if dec_id:
                    approval_dec_ids.add(str(dec_id))

        # Query all outcomes belonging to this project
        outcomes = db.scalars(
            select(DecisionOutcome)
            .where(DecisionOutcome.project_id == project_id)
            .order_by(DecisionOutcome.recorded_at.asc(), DecisionOutcome.created_at.asc())
        ).all()

        outcome_dec_ids: Set[str] = set()
        for o in outcomes:
            dec_id = o.decision_id or o.recommendation_id
            if dec_id:
                outcome_dec_ids.add(str(dec_id))

        # Total distinct decisions in project
        all_decision_ids = approval_dec_ids.union(outcome_dec_ids)
        total_decisions = len(all_decision_ids)

        # Separate observed vs pending outcomes
        observed_outcomes: List[DecisionOutcome] = []
        pending_outcomes_list: List[DecisionOutcome] = []

        decisions_with_observed: Set[str] = set()

        for o in outcomes:
            if o.outcome_status == "PENDING" or o.actual_value is None:
                pending_outcomes_list.append(o)
            else:
                observed_outcomes.append(o)
                dec_id = o.decision_id or o.recommendation_id
                if dec_id:
                    decisions_with_observed.add(str(dec_id))

        decisions_with_outcomes_count = len(decisions_with_observed)
        pending_count = max(0, total_decisions - decisions_with_outcomes_count)
        if total_decisions == 0 and pending_outcomes_list:
            pending_count = len(pending_outcomes_list)

        # Matched, differed, materially differed
        matched_count = sum(1 for o in observed_outcomes if o.outcome_status == "MATCHED")
        differed_count = sum(1 for o in observed_outcomes if o.outcome_status == "DIFFERED")
        material_diff_count = sum(1 for o in observed_outcomes if o.outcome_status == "MATERIALLY_DIFFERED")

        # Coverage rate
        coverage_rate = (
            round(decisions_with_outcomes_count / total_decisions, 4)
            if total_decisions > 0
            else 0.0
        )

        # Match rate and Material difference rate
        observed_count = len(observed_outcomes)
        match_rate = (
            round(matched_count / observed_count, 4)
            if observed_count > 0
            else 0.0
        )
        material_diff_rate = (
            round(material_diff_count / observed_count, 4)
            if observed_count > 0
            else 0.0
        )

        # Average and median deltas
        abs_deltas = [
            abs(o.absolute_delta) if o.absolute_delta is not None else abs(o.actual_value - o.expected_value)
            for o in observed_outcomes
            if (o.absolute_delta is not None or (o.actual_value is not None and o.expected_value is not None))
        ]
        rel_deltas = [
            o.relative_delta
            for o in observed_outcomes
            if o.relative_delta is not None
        ]

        avg_abs_delta = round(statistics.mean(abs_deltas), 4) if abs_deltas else None
        avg_rel_delta = round(statistics.mean(rel_deltas), 4) if rel_deltas else None
        median_rel_delta = round(statistics.median(rel_deltas), 4) if rel_deltas else None

        summary = PerformanceSummary(
            total_decisions=total_decisions,
            decisions_with_decision_records=total_decisions,
            decisions_with_outcomes=decisions_with_outcomes_count,
            decisions_with_actual_outcomes=decisions_with_outcomes_count,
            pending_outcomes=pending_count,
            matched_outcomes=matched_count,
            differed_outcomes=differed_count,
            materially_differed_outcomes=material_diff_count,
            outcome_coverage_rate=coverage_rate,
            match_rate=match_rate,
            material_difference_rate=material_diff_rate,
            average_absolute_delta=avg_abs_delta,
            average_relative_delta=avg_rel_delta,
            median_relative_delta=median_rel_delta,
        )

        # 3. Overall Project Status
        if total_decisions == 0:
            overall_status = "NO_DECISION_DATA"
        elif observed_count == 0:
            overall_status = "NO_OBSERVED_OUTCOMES"
        elif observed_count < min_observations:
            overall_status = "INSUFFICIENT_OBSERVATIONS"
        else:
            overall_status = "OBSERVED"

        # 4. Aggregations
        metrics = cls.get_metric_performance(
            db=db,
            project_id=project_id,
            min_observations=min_observations,
            threshold=threshold,
            prefetched_outcomes=outcomes,
        )

        trends = cls.get_trend_performance(
            db=db,
            project_id=project_id,
            period=period,
            min_observations=min_observations,
            prefetched_outcomes=observed_outcomes,
        )

        signals = cls.get_learning_signals(
            prefetched_outcomes=outcomes,
        )

        observations = cls.get_repeated_deviations(
            metrics=metrics,
            min_observations=min_observations,
            threshold=threshold,
            prefetched_outcomes=observed_outcomes,
        )

        models = cls.get_model_performance(
            db=db,
            project_id=project_id,
            prefetched_outcomes=observed_outcomes,
        )

        scenarios = cls.get_scenario_performance(
            db=db,
            project_id=project_id,
            prefetched_outcomes=observed_outcomes,
        )

        return DecisionPerformanceResponse(
            project_id=project_id,
            project_name=project.name,
            status=overall_status,
            summary=summary,
            metrics=metrics,
            trends=trends,
            signals=signals,
            observations=observations,
            models=models,
            scenarios=scenarios,
            min_observations_used=min_observations,
            threshold_used=threshold,
        )

    @classmethod
    def get_metric_performance(
        cls,
        db: Session,
        project_id: str,
        min_observations: int = 3,
        threshold: float = 0.05,
        prefetched_outcomes: Optional[List[DecisionOutcome]] = None,
    ) -> List[MetricPerformanceItem]:
        """Aggregate outcome performance grouped by metric name."""
        if prefetched_outcomes is None:
            prefetched_outcomes = db.scalars(
                select(DecisionOutcome)
                .where(DecisionOutcome.project_id == project_id)
            ).all()

        # Group by metric
        grouped: Dict[str, List[DecisionOutcome]] = defaultdict(list)
        for o in prefetched_outcomes:
            metric_name = o.actual_metric or o.expected_metric or "unknown_metric"
            grouped[metric_name].append(o)

        items: List[MetricPerformanceItem] = []
        for metric_name, m_outcomes in sorted(grouped.items(), key=lambda x: x[0]):
            dec_ids: Set[str] = set()
            observed: List[DecisionOutcome] = []
            pending: List[DecisionOutcome] = []

            for o in m_outcomes:
                did = o.decision_id or o.recommendation_id or o.id
                dec_ids.add(str(did))
                if o.outcome_status == "PENDING" or o.actual_value is None:
                    pending.append(o)
                else:
                    observed.append(o)

            obs_count = len(observed)
            matched_count = sum(1 for o in observed if o.outcome_status == "MATCHED")
            differed_count = sum(1 for o in observed if o.outcome_status == "DIFFERED")
            material_dev_count = sum(1 for o in observed if o.outcome_status == "MATERIALLY_DIFFERED")

            match_rate = round(matched_count / obs_count, 4) if obs_count > 0 else 0.0
            mat_rate = round(material_dev_count / obs_count, 4) if obs_count > 0 else 0.0

            rel_deltas = [o.relative_delta for o in observed if o.relative_delta is not None]
            abs_deltas = [
                abs(o.absolute_delta) if o.absolute_delta is not None else abs(o.actual_value - o.expected_value)
                for o in observed
                if (o.absolute_delta is not None or (o.actual_value is not None and o.expected_value is not None))
            ]

            mean_rel = round(statistics.mean(rel_deltas), 4) if rel_deltas else None
            median_rel = round(statistics.median(rel_deltas), 4) if rel_deltas else None
            mean_abs = round(statistics.mean(abs_deltas), 4) if abs_deltas else None
            min_rel = round(min(rel_deltas), 4) if rel_deltas else None
            max_rel = round(max(rel_deltas), 4) if rel_deltas else None

            # Factual status determination
            if obs_count == 0:
                metric_status = "NO_OUTCOMES"
            elif obs_count < min_observations:
                metric_status = "LIMITED_OBSERVATIONS"
            elif material_dev_count >= 2 and mat_rate >= 0.4:
                metric_status = "REPEATED_DEVIATION"
            elif material_dev_count > 0:
                metric_status = "MATERIAL_DEVIATION"
            elif mean_rel is not None and abs(mean_rel) <= threshold:
                metric_status = "STABLE_RANGE"
            else:
                metric_status = "OBSERVED"

            source_ids = [str(o.id) for o in observed]

            items.append(
                MetricPerformanceItem(
                    metric_name=metric_name,
                    total_decisions=len(dec_ids),
                    observed_outcomes=obs_count,
                    pending_outcomes=len(pending),
                    matched_outcomes=matched_count,
                    differed_outcomes=differed_count,
                    material_deviations=material_dev_count,
                    mean_relative_delta=mean_rel,
                    median_relative_delta=median_rel,
                    mean_absolute_delta=mean_abs,
                    min_relative_delta=min_rel,
                    max_relative_delta=max_rel,
                    match_rate=match_rate,
                    material_difference_rate=mat_rate,
                    status=metric_status,
                    source_outcome_ids=source_ids,
                )
            )

        return items

    @classmethod
    def get_trend_performance(
        cls,
        db: Session,
        project_id: str,
        period: str = "week",
        min_observations: int = 3,
        prefetched_outcomes: Optional[List[DecisionOutcome]] = None,
    ) -> List[TrendPeriodItem]:
        """Aggregate chronological outcome performance by day, week, or month."""
        if prefetched_outcomes is None:
            prefetched_outcomes = db.scalars(
                select(DecisionOutcome)
                .where(
                    DecisionOutcome.project_id == project_id,
                    DecisionOutcome.outcome_status != "PENDING",
                    DecisionOutcome.actual_value.is_not(None),
                )
                .order_by(DecisionOutcome.recorded_at.asc(), DecisionOutcome.created_at.asc())
            ).all()

        if not prefetched_outcomes:
            return []

        buckets: Dict[str, List[DecisionOutcome]] = defaultdict(list)

        for o in prefetched_outcomes:
            ts = o.recorded_at or o.created_at or datetime.now(timezone.utc)
            if period == "day":
                key = ts.strftime("%Y-%m-%d")
            elif period == "month":
                key = ts.strftime("%Y-%m")
            else:  # week
                year, week, _ = ts.isocalendar()
                key = f"{year}-W{week:02d}"
            buckets[key].append(o)

        trends: List[TrendPeriodItem] = []
        for period_key in sorted(buckets.keys()):
            p_outcomes = buckets[period_key]
            obs_count = len(p_outcomes)
            rel_deltas = [o.relative_delta for o in p_outcomes if o.relative_delta is not None]
            avg_rel = round(statistics.mean(rel_deltas), 4) if rel_deltas else None
            mat_devs = sum(1 for o in p_outcomes if o.outcome_status == "MATERIALLY_DIFFERED")
            matched = sum(1 for o in p_outcomes if o.outcome_status == "MATCHED")
            differed = sum(1 for o in p_outcomes if o.outcome_status == "DIFFERED")

            trend_status = "INSUFFICIENT_OBSERVATIONS" if obs_count < min_observations else "OBSERVED"

            trends.append(
                TrendPeriodItem(
                    period_start=period_key,
                    period_label=period_key,
                    observed_outcomes=obs_count,
                    average_relative_delta=avg_rel,
                    material_deviations=mat_devs,
                    matched_outcomes=matched,
                    differed_outcomes=differed,
                    status=trend_status,
                )
            )

        return trends

    @classmethod
    def get_learning_signals(
        cls,
        prefetched_outcomes: List[DecisionOutcome],
    ) -> LearningSignalsAggregation:
        """Aggregate Phase 6 learning signals."""
        signals = LearningSignalsAggregation()
        for o in prefetched_outcomes:
            sig = (o.learning_signal or "UNAVAILABLE").upper()
            if sig == "PREDICTION_ACCURACY":
                signals.prediction_accuracy += 1
            elif sig == "OUTCOME_DEVIATION":
                signals.outcome_deviation += 1
            elif sig == "SCENARIO_DEVIATION":
                signals.scenario_deviation += 1
            elif sig == "ASSUMPTION_CHANGE":
                signals.assumption_change += 1
            elif sig == "DATA_DRIFT_RELEVANT":
                signals.data_drift_relevant += 1
            else:
                signals.unavailable += 1
            signals.total_signals += 1
        return signals

    @classmethod
    def get_repeated_deviations(
        cls,
        metrics: List[MetricPerformanceItem],
        min_observations: int = 3,
        threshold: float = 0.05,
        prefetched_outcomes: Optional[List[DecisionOutcome]] = None,
    ) -> List[RepeatedDeviationFinding]:
        """Detect recurring factual material deviations with minimum sample guard."""
        findings: List[RepeatedDeviationFinding] = []

        for m in metrics:
            # Explicit minimum sample requirement
            if m.observed_outcomes < min_observations:
                continue

            # Recurring pattern condition: at least 2 deviations and deviation rate >= 40%
            if m.material_deviations >= 2 and m.material_difference_rate >= 0.4:
                # Resolve timestamps and deviating outcome IDs
                time_start = None
                time_end = None
                deviating_ids: List[str] = []

                if prefetched_outcomes:
                    dev_outcomes = [
                        o for o in prefetched_outcomes
                        if (o.actual_metric or o.expected_metric) == m.metric_name
                        and o.outcome_status == "MATERIALLY_DIFFERED"
                    ]
                    deviating_ids = [str(o.id) for o in dev_outcomes]
                    dates = [
                        o.recorded_at or o.created_at
                        for o in dev_outcomes
                        if (o.recorded_at or o.created_at) is not None
                    ]
                    if dates:
                        time_start = min(dates).isoformat()
                        time_end = max(dates).isoformat()

                findings.append(
                    RepeatedDeviationFinding(
                        finding_type="REPEATED_OUTCOME_DEVIATION",
                        metric_name=m.metric_name,
                        statement=f"{m.metric_name} shows repeated material deviation across observed decision outcomes.",
                        sample_count=m.total_decisions,
                        observed_count=m.observed_outcomes,
                        material_deviation_count=m.material_deviations,
                        deviation_rate=m.material_difference_rate,
                        threshold_used=threshold,
                        time_range={"start": time_start, "end": time_end},
                        source_outcome_ids=deviating_ids or m.source_outcome_ids,
                    )
                )

        return findings

    @classmethod
    def get_model_performance(
        cls,
        db: Session,
        project_id: str,
        prefetched_outcomes: Optional[List[DecisionOutcome]] = None,
    ) -> List[ModelPerformanceItem]:
        """Calculate model-level metrics ONLY where outcomes explicitly link to an MLAnalysis."""
        if prefetched_outcomes is None:
            prefetched_outcomes = db.scalars(
                select(DecisionOutcome)
                .where(
                    DecisionOutcome.project_id == project_id,
                    DecisionOutcome.ml_analysis_id.is_not(None),
                    DecisionOutcome.outcome_status != "PENDING",
                    DecisionOutcome.actual_value.is_not(None),
                )
            ).all()
        else:
            prefetched_outcomes = [
                o for o in prefetched_outcomes
                if o.ml_analysis_id is not None
                and o.outcome_status != "PENDING"
                and o.actual_value is not None
            ]

        if not prefetched_outcomes:
            return []

        grouped: Dict[str, List[DecisionOutcome]] = defaultdict(list)
        for o in prefetched_outcomes:
            grouped[str(o.ml_analysis_id)].append(o)

        models: List[ModelPerformanceItem] = []
        for ml_id, m_outcomes in grouped.items():
            ml = db.scalar(select(MLAnalysis).where(MLAnalysis.id == ml_id))
            if not ml:
                continue

            obs_count = len(m_outcomes)
            mat_devs = sum(1 for o in m_outcomes if o.outcome_status == "MATERIALLY_DIFFERED")

            abs_errors = [
                abs(o.actual_value - o.expected_value)
                for o in m_outcomes
                if o.actual_value is not None and o.expected_value is not None
            ]
            rel_errors = [
                abs(o.actual_value - o.expected_value) / abs(o.expected_value)
                for o in m_outcomes
                if o.actual_value is not None and o.expected_value is not None and abs(o.expected_value) > 1e-9
            ]

            mae = round(statistics.mean(abs_errors), 4) if abs_errors else None
            mre = round(statistics.mean(rel_errors), 4) if rel_errors else None

            models.append(
                ModelPerformanceItem(
                    ml_analysis_id=ml.id,
                    model_name=ml.model_name or "Predictive Model",
                    target_column=ml.target_column or "target",
                    task_type=ml.task_type,
                    observed_outcomes=obs_count,
                    mean_absolute_error=mae,
                    mean_relative_error=mre,
                    material_deviations=mat_devs,
                    source_outcome_ids=[str(o.id) for o in m_outcomes],
                )
            )

        return models

    @classmethod
    def get_scenario_performance(
        cls,
        db: Session,
        project_id: str,
        prefetched_outcomes: Optional[List[DecisionOutcome]] = None,
    ) -> List[ScenarioPerformanceItem]:
        """Aggregate outcome performance across explicit scenario references."""
        if prefetched_outcomes is None:
            prefetched_outcomes = db.scalars(
                select(DecisionOutcome)
                .where(
                    DecisionOutcome.project_id == project_id,
                    DecisionOutcome.scenario_id.is_not(None),
                    DecisionOutcome.outcome_status != "PENDING",
                    DecisionOutcome.actual_value.is_not(None),
                )
            ).all()
        else:
            prefetched_outcomes = [
                o for o in prefetched_outcomes
                if o.scenario_id is not None
                and o.outcome_status != "PENDING"
                and o.actual_value is not None
            ]

        if not prefetched_outcomes:
            return []

        grouped: Dict[str, List[DecisionOutcome]] = defaultdict(list)
        for o in prefetched_outcomes:
            grouped[str(o.scenario_id)].append(o)

        scenarios: List[ScenarioPerformanceItem] = []
        for scen_id, s_outcomes in grouped.items():
            scen = db.scalar(select(Scenario).where(Scenario.id == scen_id))
            scen_name = scen.name if scen else f"Scenario {scen_id[:8]}"
            target_metric = scen.target_column if scen else (s_outcomes[0].expected_metric if s_outcomes else "target")

            obs_count = len(s_outcomes)
            mat_devs = sum(1 for o in s_outcomes if o.outcome_status == "MATERIALLY_DIFFERED")
            matched = sum(1 for o in s_outcomes if o.outcome_status == "MATCHED")

            rel_deltas = [o.relative_delta for o in s_outcomes if o.relative_delta is not None]
            mean_rel = round(statistics.mean(rel_deltas), 4) if rel_deltas else None

            scenarios.append(
                ScenarioPerformanceItem(
                    scenario_id=scen_id,
                    scenario_name=scen_name,
                    target_metric=target_metric,
                    total_decisions=obs_count,
                    observed_outcomes=obs_count,
                    mean_relative_delta=mean_rel,
                    material_deviations=mat_devs,
                    matched_outcomes=matched,
                    source_outcome_ids=[str(o.id) for o in s_outcomes],
                )
            )

        return scenarios
