import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.dataset import Dataset
from app.models.analysis_run import AnalysisRun
from app.models.insight import DatasetInsight
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_execution import DecisionExecution, DecisionExecutionEvent
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_governance import DecisionGovernanceEvent

from app.schemas.decision_reporting import (
    ReportMetadata,
    AuditTimelineEvent,
    IndividualDecisionReportResponse,
    ProjectDecisionReportResponse,
)
from app.services.evidence_service import EvidenceService
from app.services.decision_portfolio_service import DecisionPortfolioService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionReportService:
    """
    Read-only Enterprise Decision Reporting & Audit Engine (Phase 13).
    Produces complete, multi-hop traceable reports and unified chronological audit
    timelines from persisted analytical and operational records.
    Strictly non-autonomous: zero mutations, zero synthetic scores, zero causal claims.
    """

    @classmethod
    def get_decision_report(
        cls,
        db: Session,
        decision_id: str,
        project_id: Optional[str] = None,
    ) -> IndividualDecisionReportResponse:
        """
        Generate comprehensive, traceable individual decision audit report:
        Dataset -> Analysis -> Insights -> Prediction -> Optimization -> Recommendation
        -> Decision -> Evidence -> Outcome -> Performance -> Learning Signal -> Governance -> Execution.
        """
        # 1. Resolve decision from Approval, Execution, Recommendation, or Outcome
        approval = db.scalar(
            select(DecisionApproval).where(
                or_(
                    DecisionApproval.decision_id == decision_id,
                    DecisionApproval.id == decision_id,
                    DecisionApproval.recommendation_id == decision_id,
                )
            )
        )

        execution = db.scalar(
            select(DecisionExecution).where(
                or_(
                    DecisionExecution.decision_id == decision_id,
                    DecisionExecution.id == decision_id,
                    DecisionExecution.recommendation_id == decision_id,
                )
            )
        )

        outcomes = db.scalars(
            select(DecisionOutcome)
            .where(
                or_(
                    DecisionOutcome.decision_id == decision_id,
                    DecisionOutcome.recommendation_id == decision_id,
                )
            )
            .order_by(DecisionOutcome.recorded_at.desc(), DecisionOutcome.created_at.desc())
        ).all()

        rec_id = (
            (approval.recommendation_id if approval else None)
            or (execution.recommendation_id if execution else None)
            or (outcomes[0].recommendation_id if outcomes else None)
            or decision_id
        )

        rec = db.scalar(
            select(DecisionRecommendationEvaluation).where(
                or_(
                    DecisionRecommendationEvaluation.id == rec_id,
                    DecisionRecommendationEvaluation.id == decision_id,
                )
            )
        )
        if not rec:
            rec = db.scalar(
                select(DecisionRecommendation).where(
                    or_(
                        DecisionRecommendation.id == rec_id,
                        DecisionRecommendation.id == decision_id,
                    )
                )
            )

        if not approval and not execution and not outcomes and not rec:
            return None

        # 2. Resolve Dataset and Project context
        dataset_id = (
            (approval.dataset_id if approval else None)
            or (execution.dataset_id if execution else None)
            or (outcomes[0].dataset_id if outcomes else None)
            or (rec.dataset_id if rec else None)
        )

        dataset = None
        if dataset_id:
            dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id))

        resolved_project_id = (
            (dataset.project_id if dataset else None)
            or (execution.project_id if execution else None)
            or (outcomes[0].project_id if outcomes else None)
            or ""
        )

        # Project Isolation Check
        if project_id and resolved_project_id and project_id != resolved_project_id:
            return None

        # 3. Decision Identity
        current_gov_status = "DRAFT"
        if approval:
            raw_stat = (approval.status or "DRAFT").upper()
            current_gov_status = "PENDING_APPROVAL" if raw_stat == "WAITING_FOR_APPROVAL" else raw_stat
        elif execution:
            current_gov_status = "APPROVED"

        current_exec_status = (execution.status or "NOT_REQUESTED").upper() if execution else "NOT_REQUESTED"
        latest_outcome = outcomes[0] if outcomes else None
        current_out_status = (latest_outcome.outcome_status or "PENDING").upper() if latest_outcome else "PENDING"

        created_ts = (
            (approval.created_at if approval else None)
            or (execution.created_at if execution else None)
            or (latest_outcome.created_at if latest_outcome else None)
            or (getattr(rec, "created_at", None) if rec else None)
            or utc_now()
        )

        # 4. Explicit Prediction / ML Model Information
        ml_id = (
            (latest_outcome.ml_analysis_id if latest_outcome else None)
            or (getattr(rec, "ml_analysis_id", None) if rec else None)
        )
        prediction_data: Optional[Dict[str, Any]] = None
        ml_model = None
        if ml_id:
            ml_model = db.scalar(select(MLAnalysis).where(MLAnalysis.id == ml_id))
            if ml_model:
                prediction_data = {
                    "ml_analysis_id": ml_model.id,
                    "model_name": ml_model.model_name,
                    "task_type": ml_model.task_type,
                    "target_column": ml_model.target_column,
                    "status": ml_model.status,
                    "metrics": ml_model.metrics or {},
                }

        # Explicit Scenario / Optimization Information
        sc_id = (
            (latest_outcome.scenario_id if latest_outcome else None)
            or (getattr(rec, "scenario_id", None) if rec else None)
        )
        scenario_data: Optional[Dict[str, Any]] = None
        sc = None
        if sc_id:
            sc = db.scalar(select(Scenario).where(Scenario.id == str(sc_id)))
            if sc:
                scenario_data = {
                    "scenario_id": sc.id,
                    "name": sc.name,
                    "target_column": sc.target_column,
                    "feature_changes": sc.feature_changes or {},
                    "predicted_delta": sc.predicted_delta,
                    "confidence_score": sc.confidence_score,
                }

        # 5. Decision Summary
        target_metric = (
            (getattr(rec, "target_metric", None) or getattr(rec, "metric_name", None))
            or ((getattr(rec, "evidence_traceability", None) or {}).get("target_metric") if rec else None)
            or (latest_outcome.expected_metric if latest_outcome else None)
            or (latest_outcome.actual_metric if latest_outcome else None)
            or "NOT AVAILABLE"
        )
        action_type = (
            getattr(rec, "action_type", None)
            or getattr(rec, "recommendation_type", None)
            or getattr(rec, "action", None)
            or "NOT AVAILABLE"
        )
        recommended_action = (
            getattr(rec, "recommended_action", None)
            or getattr(rec, "title", None)
            or getattr(rec, "expected_impact", None)
            or getattr(rec, "rationale", None)
            or "NOT AVAILABLE"
        )
        projected_impact = (
            getattr(rec, "projected_impact", None)
            or getattr(rec, "projected_value", None)
            or ((getattr(rec, "evidence_traceability", None) or {}).get("projected_value") if rec else None)
            or (latest_outcome.expected_value if latest_outcome else None)
        )
        rationale = (
            getattr(rec, "rationale", None)
            or getattr(rec, "expected_impact", None)
            or getattr(rec, "reason", None)
            or (approval.reason if approval else None)
            or "NOT AVAILABLE"
        )

        decision_identity = {
            "decision_id": decision_id,
            "recommendation_id": rec_id,
            "project_id": resolved_project_id,
            "dataset_id": dataset.id if dataset else (dataset_id or "NOT AVAILABLE"),
            "dataset_name": dataset.name if dataset else "NOT AVAILABLE",
            "title": getattr(rec, "title", None) or getattr(approval, "reason", None) or f"Decision {decision_id}",
            "governance_status": current_gov_status,
            "execution_status": current_exec_status,
            "outcome_status": current_out_status,
            "status": current_gov_status,
            "target_metric": target_metric,
            "projected_value": projected_impact,
            "created_at": created_ts.isoformat() if created_ts else None,
        }

        decision_summary = {
            "target_metric": target_metric,
            "action_type": action_type,
            "recommended_action": recommended_action,
            "projected_impact": projected_impact,
            "rationale": rationale,
        }

        # 6. Dataset & Lineage
        run = None
        if dataset:
            run = db.scalar(
                select(AnalysisRun)
                .where(AnalysisRun.dataset_id == dataset.id)
                .order_by(AnalysisRun.created_at.desc())
            )

        dataset_and_lineage = {
            "dataset_id": dataset.id if dataset else "NOT AVAILABLE",
            "dataset_name": dataset.name if dataset else "NOT AVAILABLE",
            "version": getattr(dataset, "version", 1) if dataset else 1,
            "row_count": getattr(dataset, "row_count", None) if dataset else None,
            "column_count": getattr(dataset, "column_count", None) if dataset else None,
            "analysis_run_id": run.id if run else "NOT AVAILABLE",
            "run_status": run.status if run else "NOT AVAILABLE",
            "ml_analysis_id": ml_model.id if ml_model else "NOT AVAILABLE",
            "best_model": ml_model.model_name if ml_model else "NOT AVAILABLE",
            "task_type": ml_model.task_type if ml_model else "NOT AVAILABLE",
            "scenario_id": sc.id if sc else "NOT AVAILABLE",
            "scenario_name": sc.name if sc else "NOT AVAILABLE",
        }

        # 7. Analytical Evidence (Evidence Graph, Explicit Prediction & Scenario)
        evidence_chain_data: Dict[str, Any] = {"nodes": [], "edges": [], "summary": {}}
        try:
            chain_resp = EvidenceService.get_decision_evidence_chain(db=db, decision_id=decision_id)
            evidence_chain_data = {
                "nodes": [n.model_dump() for n in chain_resp.nodes],
                "edges": [e.model_dump() for e in chain_resp.edges],
                "summary": chain_resp.summary or {},
            }
        except Exception:
            pass

        # Relevant Insights
        insights: List[DatasetInsight] = []
        if dataset:
            insights = db.scalars(
                select(DatasetInsight)
                .where(DatasetInsight.dataset_id == dataset.id)
                .limit(5)
            ).all()

        insights_data = [
            {
                "insight_id": ins.id,
                "title": ins.title or ins.insight_type,
                "category": ins.category or "GENERAL",
                "importance": getattr(ins, "importance", None) or "MEDIUM",
            }
            for ins in insights
        ]

        analytical_evidence = {
            "insights_count": len(insights_data),
            "relevant_insights": insights_data if insights_data else "NOT AVAILABLE",
            "prediction_model": prediction_data if prediction_data else "NOT AVAILABLE",
            "scenario_context": scenario_data if scenario_data else "NOT AVAILABLE",
            "evidence_chain": evidence_chain_data,
        }

        # 7. Governance Audit
        gov_events = db.scalars(
            select(DecisionGovernanceEvent)
            .where(
                or_(
                    DecisionGovernanceEvent.decision_id == decision_id,
                    DecisionGovernanceEvent.recommendation_id == rec_id,
                    DecisionGovernanceEvent.approval_id == (approval.id if approval else ""),
                )
            )
            .order_by(DecisionGovernanceEvent.created_at.asc())
        ).all()

        gov_events_data = [
            {
                "event_id": ge.id,
                "from_status": ge.from_status,
                "to_status": ge.to_status,
                "action": ge.action,
                "actor": ge.actor,
                "review_notes": ge.review_notes,
                "timestamp": ge.created_at.isoformat() if ge.created_at else None,
            }
            for ge in gov_events
        ]

        governance_audit = {
            "current_status": current_gov_status,
            "current_stage": current_gov_status,
            "approval_id": approval.id if approval else "NOT AVAILABLE",
            "actor_id": approval.actor_id if approval else "NOT AVAILABLE",
            "approved_by": approval.actor_id if approval else "NOT AVAILABLE",
            "approved_at": approval.decided_at.isoformat() if (approval and approval.decided_at) else "NOT AVAILABLE",
            "decided_at": approval.decided_at.isoformat() if (approval and approval.decided_at) else "NOT AVAILABLE",
            "reason": approval.reason if approval else "NOT AVAILABLE",
            "rejection_reason": approval.reason if (approval and approval.status == "REJECTED") else "NOT AVAILABLE",
            "total_approvals": 1 if (approval and approval.status == "APPROVED") else 0,
            "total_events": len(gov_events_data),
            "history_events": gov_events_data if gov_events_data else [],
            "event_history": gov_events_data if gov_events_data else [],
        }

        # 8. Execution Audit
        exec_events_data: List[Dict[str, Any]] = []
        if execution and hasattr(execution, "events") and execution.events:
            exec_events_data = [
                {
                    "event_id": ee.id,
                    "event_type": ee.event_type,
                    "from_status": ee.from_status,
                    "to_status": ee.to_status,
                    "actor": ee.actor,
                    "message": ee.message,
                    "timestamp": ee.created_at.isoformat() if ee.created_at else None,
                }
                for ee in execution.events
            ]

        dur_sec = None
        if execution and execution.started_at and execution.completed_at and execution.completed_at >= execution.started_at:
            dur_sec = round((execution.completed_at - execution.started_at).total_seconds(), 2)

        execution_audit = {
            "execution_id": execution.id if execution else "NOT AVAILABLE",
            "status": current_exec_status,
            "operator": (execution.executed_by or execution.confirmed_by) if execution else "NOT AVAILABLE",
            "requested_by": execution.requested_by if (execution and execution.requested_by) else "NOT AVAILABLE",
            "confirmed_by": execution.confirmed_by if (execution and execution.confirmed_by) else "NOT AVAILABLE",
            "execution_reference": execution.execution_reference if (execution and execution.execution_reference) else "NOT AVAILABLE",
            "started_at": execution.started_at.isoformat() if (execution and execution.started_at) else "NOT AVAILABLE",
            "completed_at": execution.completed_at.isoformat() if (execution and execution.completed_at) else "NOT AVAILABLE",
            "duration_seconds": dur_sec if dur_sec is not None else "NOT AVAILABLE",
            "failure_reason": execution.failure_reason if (execution and execution.failure_reason) else "NOT AVAILABLE",
            "events": exec_events_data if exec_events_data else [],
            "total_events": len(exec_events_data),
        }

        # 9. Outcome Audit
        outcome_audit: Dict[str, Any] = {}
        if latest_outcome and latest_outcome.outcome_status != "PENDING":
            is_mat = DecisionPortfolioService.is_material_deviation(latest_outcome)
            rel_pct = (
                round(latest_outcome.relative_delta * 100.0, 2)
                if latest_outcome.relative_delta is not None
                else None
            )
            outcome_audit = {
                "outcome_id": latest_outcome.id,
                "expected_metric": latest_outcome.expected_metric,
                "expected_value": latest_outcome.expected_value,
                "actual_metric": latest_outcome.actual_metric,
                "actual_value": latest_outcome.actual_value,
                "absolute_delta": latest_outcome.absolute_delta,
                "relative_delta": latest_outcome.relative_delta,
                "deviation_percentage": rel_pct,
                "material_difference": is_mat,
                "outcome_status": latest_outcome.outcome_status,
                "recorded_at": latest_outcome.recorded_at.isoformat() if latest_outcome.recorded_at else None,
                "notes": latest_outcome.notes or "NOT AVAILABLE",
            }
        else:
            outcome_audit = {
                "status": "OUTCOME DATA NOT AVAILABLE",
                "expected_value": None,
                "actual_value": None,
                "deviation_percentage": None,
                "material_difference": False,
                "notes": "No empirical outcome has been observed or recorded for this decision yet.",
            }

        # 10. Performance Summary
        performance_summary: Dict[str, Any] = {}
        if latest_outcome and latest_outcome.outcome_status != "PENDING":
            is_mat = DecisionPortfolioService.is_material_deviation(latest_outcome)
            metric_nm = latest_outcome.actual_metric or latest_outcome.expected_metric or "NOT AVAILABLE"
            performance_summary = {
                "metric_name": metric_nm,
                "material_deviation": is_mat,
                "outcome_status": latest_outcome.outcome_status,
                "relative_delta_percentage": (
                    round(latest_outcome.relative_delta * 100.0, 2)
                    if latest_outcome.relative_delta is not None
                    else None
                ),
                "threshold_used": latest_outcome.threshold_used if latest_outcome.threshold_used is not None else 0.05,
                "total_outcomes_for_metric": 1,
            }
        else:
            performance_summary = {
                "status": "PERFORMANCE DATA NOT AVAILABLE",
                "metric_name": "NOT AVAILABLE",
                "total_outcomes_for_metric": 0,
                "notes": "Performance evaluation requires empirical outcome observations.",
            }


        # 11. Learning Summary (Phase 8 learning signals)
        signals = db.scalars(
            select(DecisionLearningSignal).where(
                DecisionLearningSignal.project_id == resolved_project_id
            )
        ).all()

        associated_signals = []
        for s in signals:
            src_decs = s.source_decision_ids or []
            if isinstance(src_decs, list) and (decision_id in src_decs or rec_id in src_decs):
                associated_signals.append(
                    {
                        "signal_id": s.id,
                        "signal_type": s.signal_type,
                        "severity": s.severity,
                        "status": s.status,
                        "title": s.title,
                        "description": s.description,
                        "created_at": s.created_at.isoformat() if s.created_at else None,
                        "is_active": DecisionPortfolioService.is_signal_active(s),
                    }
                )

        learning_summary = {
            "associated_signals_count": len(associated_signals),
            "total_signals": len(associated_signals),
            "total_active_signals": sum(1 for s in associated_signals if s.get("is_active")),
            "active_signals_count": sum(1 for s in associated_signals if s.get("is_active")),
            "signals": associated_signals,
        }

        # 12. Chronological Audit Timeline
        timeline_events: List[AuditTimelineEvent] = []

        # Event: Decision / Recommendation Created
        if created_ts:
            ev_type = "RECOMMENDATION_CREATED" if rec else "DECISION_CREATED"
            timeline_events.append(
                AuditTimelineEvent(
                    timestamp=created_ts,
                    event_type=ev_type,
                    actor=approval.actor_id if approval else None,
                    source_id=decision_id,
                    description=f"{'Recommendation' if rec else 'Decision'} created and registered in InsightFlow governance repository.",
                )
            )

        # Governance Events
        for ge in gov_events:
            if ge.created_at:
                timeline_events.append(
                    AuditTimelineEvent(
                        timestamp=ge.created_at,
                        event_type="GOVERNANCE_TRANSITION",
                        actor=ge.actor,
                        source_id=ge.id,
                        description=f"Governance transition from {ge.from_status} to {ge.to_status} ({ge.action}).",
                    )
                )

        # Formal Approval / Rejection Decided Event
        if approval and approval.decided_at:
            timeline_events.append(
                AuditTimelineEvent(
                    timestamp=approval.decided_at,
                    event_type=f"GOVERNANCE_{approval.status.upper()}",
                    actor=approval.actor_id,
                    source_id=approval.id,
                    description=f"Formal decision governance recorded as {approval.status}.",
                )
            )

        # Execution Lifecycle Events
        if execution and hasattr(execution, "events") and execution.events:
            for ee in execution.events:
                if ee.created_at:
                    timeline_events.append(
                        AuditTimelineEvent(
                            timestamp=ee.created_at,
                            event_type=f"EXECUTION_{ee.event_type.upper()}",
                            actor=ee.actor,
                            source_id=ee.id,
                            description=ee.message or f"Execution state transition to {ee.to_status}.",
                        )
                    )

        # Specific Execution Timestamps (started, completed)
        if execution and execution.started_at:
            # Add if not duplicate timestamp in events
            timeline_events.append(
                AuditTimelineEvent(
                    timestamp=execution.started_at,
                    event_type="EXECUTION_STARTED",
                    actor=execution.executed_by or execution.confirmed_by,
                    source_id=execution.id,
                    description="Operational execution initiated.",
                )
            )

        if execution and execution.completed_at:
            is_fail = execution.status == "EXECUTION_FAILED"
            timeline_events.append(
                AuditTimelineEvent(
                    timestamp=execution.completed_at,
                    event_type="EXECUTION_FAILED" if is_fail else "EXECUTION_COMPLETED",
                    actor=execution.executed_by or execution.confirmed_by,
                    source_id=execution.id,
                    description=(
                        f"Execution failed: {execution.failure_reason}"
                        if is_fail
                        else "Operational execution completed successfully."
                    ),
                )
            )

        # Empirical Outcomes
        for out in outcomes:
            out_ts = out.recorded_at or out.created_at
            if out_ts and out.outcome_status != "PENDING":
                timeline_events.append(
                    AuditTimelineEvent(
                        timestamp=out_ts,
                        event_type="OUTCOME_RECORDED",
                        actor=None,
                        source_id=out.id,
                        description=f"Empirical outcome verified: {out.actual_metric} = {out.actual_value} (Status: {out.outcome_status}).",
                    )
                )

        # Learning Signals
        for s in associated_signals:
            if s.get("created_at"):
                s_ts = datetime.fromisoformat(s["created_at"])
                timeline_events.append(
                    AuditTimelineEvent(
                        timestamp=s_ts,
                        event_type="LEARNING_SIGNAL_DETECTED",
                        actor=None,
                        source_id=s["signal_id"],
                        description=f"Phase 8 learning signal [{s['severity']}] '{s['signal_type']}' triggered.",
                    )
                )

        # Sort strictly chronological
        timeline_events.sort(key=lambda x: x.timestamp)

        # 13. Source References (Only factual IDs that actually exist)
        source_refs: Dict[str, Any] = {
            "decision_id": decision_id,
        }
        if dataset:
            source_refs["dataset_id"] = dataset.id
            source_refs["dataset_version"] = getattr(dataset, "version", 1)
        if run:
            source_refs["analysis_run_id"] = run.id
        if rec_id and rec:
            source_refs["recommendation_id"] = rec_id
        if ml_id and prediction_data:
            source_refs["prediction_id"] = ml_id
            source_refs["ml_analysis_id"] = ml_id
        if sc_id and scenario_data:
            source_refs["optimization_id"] = str(sc_id)
            source_refs["scenario_id"] = str(sc_id)
        if approval:
            source_refs["approval_id"] = approval.id
        if execution:
            source_refs["execution_id"] = execution.id
        if latest_outcome:
            source_refs["outcome_id"] = latest_outcome.id
        if associated_signals:
            source_refs["learning_signal_ids"] = [s["signal_id"] for s in associated_signals]

        return IndividualDecisionReportResponse(
            metadata=ReportMetadata(
                scope="INDIVIDUAL_DECISION",
                project_id=resolved_project_id,
                generated_at=utc_now(),
                data_as_of=utc_now(),
            ),
            decision_identity=decision_identity,
            decision_summary=decision_summary,
            dataset_and_lineage=dataset_and_lineage,
            analytical_evidence=analytical_evidence,
            governance_audit=governance_audit,
            execution_audit=execution_audit,
            outcome_audit=outcome_audit,
            performance_summary=performance_summary,
            learning_summary=learning_summary,
            audit_timeline=timeline_events,
            source_references=source_refs,
        )

    @classmethod
    def get_project_report(
        cls,
        db: Session,
        project_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> ProjectDecisionReportResponse:
        """
        Generate project-level factual portfolio, operations, and governance audit report.
        Reuses Phase 11 and Phase 12 intelligence directly with zero duplicate queries.
        """
        # Verify project exists
        project = db.scalar(select(Project).where(Project.id == project_id))
        if not project:
            return None

        # Leverage Phase 11 / Phase 12 portfolio overview
        overview = DecisionPortfolioService.get_portfolio_overview(
            db=db,
            project_id=project_id,
            date_from=date_from,
            date_to=date_to,
        )

        project_summary = {
            "project_id": project.id,
            "project_name": project.name,
            "total_decisions": overview.total_decisions_count,
            "date_range": {
                "from": date_from.isoformat() if date_from else None,
                "to": date_to.isoformat() if date_to else None,
            },
            "kpis": overview.kpis.model_dump(),
        }

        portfolio_distributions = {
            "governance": [g.model_dump() for g in overview.governance_distribution],
            "execution": [e.model_dump() for e in overview.execution_distribution],
            "outcome": [o.model_dump() for o in overview.outcome_distribution],
        }

        operations_and_capacity = {}
        portfolio_concentration = {}
        shared_dependencies = []

        if overview.capacity:
            cap = overview.capacity
            operations_and_capacity = {
                "operations_summary": cap.operations.model_dump(),
                "bottlenecks": [b.model_dump() for b in cap.bottlenecks],
                "capacity_indicators": cap.capacity_indicators.model_dump(),
                "exposure_indicators": cap.exposure_indicators.model_dump(),
            }
            portfolio_concentration = {
                dim: [item.model_dump() for item in items]
                for dim, items in cap.concentration.items()
            }
            shared_dependencies = [d.model_dump() for d in cap.dependencies]

        recurring_deviations = [rd.model_dump() for rd in overview.recurring_deviations]
        learning_signals_summary = overview.learning_signals_summary.model_dump()
        decision_inventory = [d.model_dump() for d in overview.decisions]

        return ProjectDecisionReportResponse(
            metadata=ReportMetadata(
                scope="PROJECT",
                project_id=project.id,
                generated_at=utc_now(),
                data_as_of=utc_now(),
            ),
            project_summary=project_summary,
            portfolio_distributions=portfolio_distributions,
            operations_and_capacity=operations_and_capacity,
            portfolio_concentration=portfolio_concentration,
            shared_dependencies=shared_dependencies,
            recurring_deviations=recurring_deviations,
            learning_signals_summary=learning_signals_summary,
            decision_inventory=decision_inventory,
        )
