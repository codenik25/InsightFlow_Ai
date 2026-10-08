import math
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.project import Project
from app.models.analysis_run import AnalysisRun
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_outcome import DecisionOutcome
from app.models.insight_memory import InsightMemory

from app.schemas.outcome import (
    DecisionOutcomeCreate,
    OutcomeEvaluation,
    DecisionOutcomeResponse,
    DecisionMemoryItem,
    DecisionMemoryResponse,
    DecisionPerformanceSummary,
    DecisionOutcomeCreatePhase6,
    DecisionOutcomeFromVersionRequest,
    DecisionOutcomeResponsePhase6,
    DecisionOutcomesListResponse,
)
from app.services.eda_service import EDAService
from app.services.dataset_comparison_service import DatasetComparisonService
from app.services.evidence_service import EvidenceService


class DecisionOutcomeService:
    """Service layer for recording, evaluating, and managing closed-loop Decision Outcomes and Memory."""

    @classmethod
    def record_outcome(
        cls,
        db: Session,
        dataset_id: str,
        payload: DecisionOutcomeCreate,
    ) -> DecisionOutcomeResponse:
        """Record a real-world observed outcome, evaluate error/achievement deterministically, and persist."""
        # 1. Resolve raw dataset to processed child using lineage logic
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recording decision outcomes requires a processed dataset. Raw datasets are protected.",
            )

        # 2. Retrieve & Verify Recommendation Record across both tables
        stmt_rec1 = select(DecisionRecommendation).where(
            DecisionRecommendation.id == payload.recommendation_id,
            DecisionRecommendation.dataset_id == target_dataset.id,
        )
        rec = db.scalars(stmt_rec1).first()

        if not rec:
            stmt_rec2 = select(DecisionRecommendationEvaluation).where(
                DecisionRecommendationEvaluation.id == payload.recommendation_id,
                DecisionRecommendationEvaluation.dataset_id == target_dataset.id,
            )
            rec = db.scalars(stmt_rec2).first()

        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{payload.recommendation_id}' not found for dataset '{dataset_id}'.",
            )

        # 3. Resolve associated metadata
        scenario_id = getattr(rec, "scenario_id", None)
        ml_id = getattr(rec, "ml_analysis_id", None)
        opt_id = getattr(rec, "optimization_id", None)
        evidence_dict = getattr(rec, "evidence_traceability", None) or getattr(rec, "evidence", None) or {}

        if not opt_id and isinstance(evidence_dict, dict):
            opt_id = evidence_dict.get("optimization_id")

        if not ml_id and isinstance(evidence_dict, dict):
            ml_id = evidence_dict.get("ml_analysis_id")

        if not opt_id:
            latest_opt = db.scalars(
                select(DecisionOptimization)
                .where(DecisionOptimization.dataset_id == target_dataset.id)
                .order_by(DecisionOptimization.created_at.desc())
            ).first()
            if latest_opt:
                opt_id = latest_opt.id

        opt = db.scalars(select(DecisionOptimization).where(DecisionOptimization.id == opt_id)).first() if opt_id else None
        scen_record = db.scalars(select(Scenario).where(Scenario.id == scenario_id)).first() if scenario_id else None
        ml_record = db.scalars(select(MLAnalysis).where(MLAnalysis.id == ml_id)).first() if ml_id else None

        # 4. Validate finite numeric actual_value
        try:
            actual_value = float(payload.actual_value)
            if math.isnan(actual_value) or math.isinf(actual_value):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"actual_value '{payload.actual_value}' must be a finite numerical value.",
            )

        # 5. Duplicate Outcome Submission Protection
        stmt_dup = select(DecisionOutcome).where(
            DecisionOutcome.dataset_id == target_dataset.id,
            DecisionOutcome.recommendation_id == rec.id,
            DecisionOutcome.actual_metric == payload.actual_metric,
            DecisionOutcome.actual_value == actual_value,
        )
        if db.scalars(stmt_dup).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate outcome record already exists for recommendation '{rec.id}' with metric '{payload.actual_metric}' and value {payload.actual_value}.",
            )

        # 6. Expected Target Metric & Prediction Resolution
        expected_metric = getattr(rec, "target_metric", None)
        if not expected_metric and scen_record:
            expected_metric = getattr(scen_record, "target_column", None)
        if not expected_metric and opt:
            expected_metric = getattr(opt, "target_column", None)
        if not expected_metric and ml_record:
            expected_metric = getattr(ml_record, "target_column", None)
        if not expected_metric:
            expected_metric = payload.actual_metric or "target"

        expected_value = getattr(rec, "projected_value", None)
        if expected_value is None and scen_record:
            expected_value = getattr(scen_record, "predicted_outcome", None)
        if expected_value is None and isinstance(evidence_dict, dict):
            expected_value = evidence_dict.get("predicted_outcome") or evidence_dict.get("projected_value")
        if expected_value is None and opt:
            expected_value = getattr(opt, "recommended_prediction", None) or getattr(opt, "baseline_prediction", None)
        if expected_value is None and scen_record:
            expected_value = getattr(scen_record, "base_value", None)

        if expected_value is None:
            expected_value = actual_value

        objective = (opt.objective if opt else "maximize") or "maximize"

        # 7. Objective-Aware Comparative Evaluation
        eval_result = cls.evaluate_outcome_metrics(
            expected_value=expected_value,
            actual_value=actual_value,
            objective=objective,
        )

        # 8. Persist Outcome Record
        outcome_record = DecisionOutcome(
            dataset_id=target_dataset.id,
            recommendation_id=rec.id,
            optimization_id=opt.id if opt else None,
            scenario_id=scenario_id,
            ml_analysis_id=ml_id,
            expected_metric=expected_metric,
            expected_value=expected_value,
            actual_metric=payload.actual_metric,
            actual_value=actual_value,
            absolute_error=eval_result.absolute_error,
            percentage_error=eval_result.percentage_error,
            achievement_percentage=eval_result.achievement_percentage,
            objective=objective,
            outcome_status=eval_result.outcome_status,
            notes=payload.notes,
        )

        db.add(outcome_record)
        db.commit()
        db.refresh(outcome_record)

        # Emit Audit Event
        try:
            from app.services.audit_service import DecisionAuditService
            from app.schemas.audit import AuditEventCreate
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=outcome_record.recommendation_id,
                    recommendation_id=outcome_record.recommendation_id,
                    event_type="OUTCOME_RECORDED",
                    event_status="SUCCESS",
                    source_service="outcome_service",
                    evidence_references={
                        "outcome_id": outcome_record.id,
                        "recommendation_id": outcome_record.recommendation_id,
                        "actual_metric": outcome_record.actual_metric,
                    },
                    new_state={
                        "actual_value": outcome_record.actual_value,
                        "outcome_status": outcome_record.outcome_status,
                        "achievement_percentage": outcome_record.achievement_percentage,
                    },
                ),
            )
        except Exception:
            pass

        return cls._map_to_response(outcome_record)


    @classmethod
    def evaluate_outcome_metrics(
        cls,
        expected_value: float,
        actual_value: float,
        objective: str = "maximize",
    ) -> OutcomeEvaluation:
        """Deterministically calculate absolute error, percentage error, achievement %, and classification status."""
        exp = float(expected_value)
        act = float(actual_value)
        abs_err = round(abs(act - exp), 4)

        if abs(exp) < 1e-9:
            pct_err = 0.0
            achievement = 100.0 if abs(act) < 1e-9 else (100.0 if act > 0 else 0.0)
        else:
            pct_err = round((abs_err / abs(exp)) * 100.0, 2)
            if objective == "minimize":
                if act <= 0 and exp <= 0:
                    achievement = round((exp / act) * 100.0, 2) if act != 0 else 100.0
                else:
                    achievement = round((1.0 + (exp - act) / abs(exp)) * 100.0, 2)
            else:
                achievement = round((act / exp) * 100.0, 2)

        if achievement >= 95.0:
            status_cls = "ACHIEVED"
        elif achievement >= 70.0:
            status_cls = "PARTIALLY_ACHIEVED"
        else:
            status_cls = "NOT_ACHIEVED"

        return OutcomeEvaluation(
            expected_value=exp,
            actual_value=act,
            absolute_error=abs_err,
            percentage_error=pct_err,
            achievement_percentage=achievement,
            objective=objective,
            outcome_status=status_cls,
        )

    @classmethod
    def get_outcome_by_id(cls, db: Session, dataset_id: str, outcome_id: str) -> DecisionOutcomeResponse:
        """Retrieve single outcome record by ID and dataset lineage."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionOutcome).where(
            DecisionOutcome.id == outcome_id,
            DecisionOutcome.dataset_id == target_dataset.id,
        )
        record = db.scalars(stmt).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision outcome '{outcome_id}' not found for dataset '{dataset_id}'.",
            )
        return cls._map_to_response(record)

    @classmethod
    def get_outcomes_for_dataset(cls, db: Session, dataset_id: str) -> List[DecisionOutcomeResponse]:
        """Retrieve all recorded outcome records for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionOutcome)
            .where(DecisionOutcome.dataset_id == target_dataset.id)
            .order_by(DecisionOutcome.recorded_at.desc())
        )
        records = db.scalars(stmt).all()
        return [cls._map_to_response(r) for r in records]

    @classmethod
    def get_decision_memory(cls, db: Session, dataset_id: str) -> DecisionMemoryResponse:
        """Aggregate historical Decision Memory entries for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt_outcomes = (
            select(DecisionOutcome)
            .where(DecisionOutcome.dataset_id == target_dataset.id)
            .order_by(DecisionOutcome.recorded_at.desc())
        )
        outcomes = db.scalars(stmt_outcomes).all()

        stmt_g = select(DecisionGuardrailEvaluation).where(DecisionGuardrailEvaluation.dataset_id == target_dataset.id)
        guardrail_records = db.scalars(stmt_g).all()
        g_map = {g.recommendation_id: g for g in guardrail_records}

        memory_items: List[DecisionMemoryItem] = []
        for o in outcomes:
            rec = db.scalars(select(DecisionRecommendation).where(DecisionRecommendation.id == o.recommendation_id)).first()
            if not rec:
                rec = db.scalars(select(DecisionRecommendationEvaluation).where(DecisionRecommendationEvaluation.id == o.recommendation_id)).first()

            g_eval = g_map.get(o.recommendation_id)
            d_status = g_eval.decision_status if g_eval else "HUMAN_REVIEW_REQUIRED"

            rec_title = rec.title if rec else "Recommendation"
            rec_type = getattr(rec, "recommendation_type", "PERFORMANCE") if rec else "PERFORMANCE"
            conf = getattr(rec, "confidence", "MODERATE") if rec else "MODERATE"

            memory_items.append(
                DecisionMemoryItem(
                    outcome_id=o.id,
                    recommendation_id=o.recommendation_id,
                    recommendation_title=rec_title,
                    recommendation_type=rec_type,
                    target_metric=o.expected_metric,
                    expected_value=o.expected_value,
                    actual_value=o.actual_value,
                    achievement_percentage=o.achievement_percentage,
                    outcome_status=o.outcome_status,
                    decision_status=d_status,
                    confidence=conf,
                    recorded_at=o.recorded_at,
                )
            )

        return DecisionMemoryResponse(
            dataset_id=target_dataset.id,
            total_records=len(memory_items),
            history=memory_items,
        )

    @classmethod
    def get_decision_performance_summary(cls, db: Session, dataset_id: str) -> DecisionPerformanceSummary:
        """Calculate aggregate statistical performance summary across historical decisions."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionOutcome).where(DecisionOutcome.dataset_id == target_dataset.id)
        records = db.scalars(stmt).all()

        total = len(records)
        if total == 0:
            return DecisionPerformanceSummary(
                dataset_id=target_dataset.id,
                total_decisions=0,
                achieved_count=0,
                partially_achieved_count=0,
                not_achieved_count=0,
                achievement_rate=0.0,
                average_percentage_error=0.0,
                average_achievement_percentage=0.0,
                limited_history_warning="Decision history is limited (0 outcomes recorded); performance statistics are exploratory.",
            )

        achieved = sum(1 for r in records if r.outcome_status == "ACHIEVED")
        partially = sum(1 for r in records if r.outcome_status == "PARTIALLY_ACHIEVED")
        not_achieved = sum(1 for r in records if r.outcome_status == "NOT_ACHIEVED")

        achievement_rate = round(((achieved + partially) / total) * 100.0, 2)
        avg_err = round(sum(r.percentage_error for r in records) / total, 2)
        avg_ach = round(sum(r.achievement_percentage for r in records) / total, 2)

        warning = (
            f"Decision history is limited ({total} outcomes recorded); performance statistics are exploratory."
            if total < 5
            else None
        )

        return DecisionPerformanceSummary(
            dataset_id=target_dataset.id,
            total_decisions=total,
            achieved_count=achieved,
            partially_achieved_count=partially,
            not_achieved_count=not_achieved,
            achievement_rate=achievement_rate,
            average_percentage_error=avg_err,
            average_achievement_percentage=avg_ach,
            limited_history_warning=warning,
        )

    @classmethod
    def _map_to_response(cls, record: DecisionOutcome) -> DecisionOutcomeResponse:
        return DecisionOutcomeResponse(
            id=record.id,
            dataset_id=record.dataset_id,
            recommendation_id=record.recommendation_id,
            optimization_id=record.optimization_id,
            scenario_id=record.scenario_id,
            ml_analysis_id=record.ml_analysis_id,
            expected_metric=record.expected_metric,
            expected_value=record.expected_value,
            actual_metric=record.actual_metric,
            actual_value=record.actual_value,
            absolute_error=record.absolute_error,
            percentage_error=record.percentage_error,
            achievement_percentage=record.achievement_percentage,
            objective=record.objective,
            outcome_status=record.outcome_status,
            notes=record.notes,
            recorded_at=record.recorded_at,
            evaluated_at=record.evaluated_at,
        )

    # =====================================================================
    # Phase 6: Decision Outcome & Learning Loop
    # =====================================================================

    @classmethod
    def evaluate_decision_outcome_math(
        cls,
        expected_value: float,
        actual_value: Optional[float],
        threshold: float = 0.05,
        metric_name: str = "metric",
    ) -> Dict[str, Any]:
        """
        Factual, objective comparison between expected prediction and actual observation.
        Does not use subjective labels (e.g. good/bad/failed).
        Exposes threshold_used and factual learning signal.
        """
        if actual_value is None:
            return {
                "outcome_status": "PENDING",
                "absolute_delta": None,
                "relative_delta": None,
                "threshold_used": threshold,
                "learning_signal": "UNAVAILABLE",
                "learning_summary": f"No actual result has been recorded yet for {metric_name}.",
            }

        act = float(actual_value)
        exp = float(expected_value)
        abs_delta = round(act - exp, 4)

        if abs(exp) < 1e-9:
            # Handle expected_value = 0 safely
            rel_delta = 0.0 if abs(act) < 1e-9 else None
        else:
            rel_delta = round((act - exp) / abs(exp), 4)

        if rel_delta is None:
            status_str = "MATERIALLY_DIFFERED"
            signal_str = "OUTCOME_DEVIATION"
            summary_str = f"Actual {metric_name} ({act:g}) observed when expected baseline was 0, representing material deviation (delta: {abs_delta:+g})."
        else:
            abs_rel = abs(rel_delta)
            pct_formatted = f"{rel_delta * 100:+.2f}%"
            if abs_rel <= 0.01:
                status_str = "MATCHED"
                signal_str = "PREDICTION_ACCURACY"
                summary_str = f"Actual {metric_name} ({act:g}) matched expected prediction ({exp:g}) within 1.0% tolerance (delta: {abs_delta:+g}, {pct_formatted})."
            elif abs_rel <= threshold:
                status_str = "DIFFERED"
                signal_str = "OUTCOME_DEVIATION"
                summary_str = f"Actual {metric_name} ({act:g}) differed from expected prediction ({exp:g}) by {pct_formatted}, within the {threshold * 100:.1f}% material threshold (delta: {abs_delta:+g})."
            else:
                status_str = "MATERIALLY_DIFFERED"
                signal_str = "OUTCOME_DEVIATION"
                summary_str = f"Actual {metric_name} ({act:g}) materially differed from expected prediction ({exp:g}) by {pct_formatted}, exceeding the {threshold * 100:.1f}% material threshold (delta: {abs_delta:+g})."

        return {
            "outcome_status": status_str,
            "absolute_delta": abs_delta,
            "relative_delta": rel_delta,
            "threshold_used": threshold,
            "learning_signal": signal_str,
            "learning_summary": summary_str,
        }

    @classmethod
    def _resolve_decision_entities(cls, db: Session, decision_id: str) -> Dict[str, Any]:
        """Resolve DecisionApproval, DecisionRecommendation, Dataset, and expected metrics."""
        approval = db.scalar(
            select(DecisionApproval).where(
                or_(
                    DecisionApproval.decision_id == decision_id,
                    DecisionApproval.id == decision_id,
                    DecisionApproval.recommendation_id == decision_id,
                )
            )
        )

        dataset_id = approval.dataset_id if approval else None
        rec_id = approval.recommendation_id if approval else decision_id

        rec = None
        if rec_id:
            rec = db.scalar(select(DecisionRecommendationEvaluation).where(DecisionRecommendationEvaluation.id == rec_id))
            if not rec:
                rec = db.scalar(select(DecisionRecommendation).where(DecisionRecommendation.id == rec_id))

        if not approval and not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision or Recommendation '{decision_id}' not found.",
            )

        if not dataset_id and rec:
            dataset_id = rec.dataset_id

        dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id)) if dataset_id else None
        project_id = dataset.project_id if dataset else None

        # Resolve expected metric & expected value
        expected_metric = getattr(rec, "target_metric", None)
        expected_val = getattr(rec, "projected_value", None)
        opt_id = getattr(rec, "optimization_id", None)
        scenario_id = getattr(rec, "scenario_id", None)
        ml_id = getattr(rec, "ml_analysis_id", None)

        if not opt_id and rec and getattr(rec, "evidence_traceability", None) and isinstance(rec.evidence_traceability, dict):
            opt_id = rec.evidence_traceability.get("optimization_id")

        if opt_id:
            opt = db.scalar(select(DecisionOptimization).where(DecisionOptimization.id == opt_id))
            if opt:
                if not expected_metric:
                    expected_metric = opt.target_column
                if expected_val is None:
                    expected_val = opt.recommended_prediction or opt.baseline_prediction

        if scenario_id:
            scen = db.scalar(select(Scenario).where(Scenario.id == scenario_id))
            if scen:
                if not expected_metric:
                    expected_metric = scen.target_column
                if expected_val is None:
                    expected_val = scen.predicted_outcome or scen.base_value

        if not expected_metric and ml_id:
            ml = db.scalar(select(MLAnalysis).where(MLAnalysis.id == ml_id))
            if ml:
                expected_metric = ml.target_column

        expected_metric = expected_metric or "target"
        expected_val = expected_val if expected_val is not None else 0.0

        return {
            "decision_id": decision_id,
            "approval": approval,
            "rec": rec,
            "rec_id": rec_id,
            "dataset": dataset,
            "dataset_id": dataset_id,
            "project_id": project_id,
            "opt_id": opt_id,
            "scenario_id": scenario_id,
            "ml_id": ml_id,
            "expected_metric": expected_metric,
            "expected_value": float(expected_val),
        }

    @classmethod
    def get_decision_outcomes(
        cls,
        db: Session,
        decision_id: str,
        project_id: Optional[str] = None,
    ) -> DecisionOutcomesListResponse:
        """Retrieve outcomes for a decision or return factual PENDING state."""
        ctx = cls._resolve_decision_entities(db=db, decision_id=decision_id)
        dec_project_id = ctx["project_id"]
        dataset = ctx["dataset"]

        if project_id and dec_project_id and project_id != dec_project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{decision_id}' not found in project '{project_id}'.",
            )

        match_criteria = [
            DecisionOutcome.decision_id == decision_id,
            DecisionOutcome.recommendation_id == decision_id,
        ]
        if ctx.get("rec_id"):
            match_criteria.append(DecisionOutcome.recommendation_id == ctx["rec_id"])
        if ctx.get("approval") and ctx["approval"].id:
            match_criteria.append(DecisionOutcome.decision_id == ctx["approval"].id)

        records = db.scalars(
            select(DecisionOutcome)
            .where(or_(*match_criteria))
            .order_by(DecisionOutcome.created_at.desc())
        ).all()

        history_items = []
        for r in records:
            eval_res = cls.evaluate_decision_outcome_math(
                expected_value=r.expected_value,
                actual_value=r.actual_value,
                threshold=r.threshold_used if r.threshold_used is not None else 0.05,
                metric_name=r.actual_metric or r.expected_metric,
            )
            history_items.append(cls._map_to_phase6_response(r, eval_res["learning_summary"]))

        primary = history_items[0] if history_items else None

        if not primary:
            # Factual PENDING state
            eval_res = cls.evaluate_decision_outcome_math(
                expected_value=ctx["expected_value"],
                actual_value=None,
                threshold=0.05,
                metric_name=ctx["expected_metric"],
            )
            pending_item = DecisionOutcomeResponsePhase6(
                id=f"pending-{decision_id}",
                project_id=dec_project_id,
                decision_id=decision_id,
                recommendation_id=ctx.get("rec_id"),
                dataset_id=dataset.id if dataset else "",
                expected_metric=ctx["expected_metric"],
                expected_value=ctx["expected_value"],
                actual_metric=None,
                actual_value=None,
                absolute_delta=None,
                relative_delta=None,
                threshold_used=0.05,
                outcome_status="PENDING",
                learning_signal="UNAVAILABLE",
                learning_summary=eval_res["learning_summary"],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            primary = pending_item

        latest = history_items[0] if history_items else None
        current_status = latest.outcome_status if latest else "PENDING"
        learning_signal = latest.learning_signal if latest else "UNAVAILABLE"
        learning_summary = latest.learning_summary if latest else primary.learning_summary
        threshold_used = latest.threshold_used if latest else 0.05

        return DecisionOutcomesListResponse(
            decision_id=decision_id,
            project_id=dec_project_id,
            dataset_id=dataset.id if dataset else "",
            expected_metric=ctx["expected_metric"],
            expected_value=ctx["expected_value"],
            threshold_used=threshold_used,
            current_status=current_status,
            learning_signal=learning_signal,
            learning_summary=learning_summary,
            total_outcomes=len(history_items),
            outcomes_count=len(history_items),
            primary_outcome=primary,
            latest_outcome=latest,
            history=history_items,
        )

    @classmethod
    def record_decision_outcome(
        cls,
        db: Session,
        decision_id: str,
        payload: DecisionOutcomeCreatePhase6,
        project_id: Optional[str] = None,
    ) -> DecisionOutcomeResponsePhase6:
        """Record an explicit observed outcome for a decision with strict validation."""
        # 1. Resolve decision context
        ctx = cls._resolve_decision_entities(db=db, decision_id=decision_id)
        dec_project_id = ctx["project_id"]
        dataset = ctx["dataset"]

        # 2. Project isolation validation
        if project_id and dec_project_id and project_id != dec_project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{decision_id}' does not belong to project '{project_id}'.",
            )

        # 3. Numeric validation
        actual_val = payload.actual_value
        if actual_val is not None:
            try:
                actual_val = float(actual_val)
                if math.isnan(actual_val) or math.isinf(actual_val):
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"actual_value '{payload.actual_value}' must be a finite numerical value.",
                )

        # 4. Source dataset lineage validation (if provided)
        source_ds_id = payload.source_dataset_id
        source_version = payload.source_dataset_version
        source_run_id = payload.source_analysis_run_id

        if source_ds_id:
            src_ds = db.scalar(select(Dataset).where(Dataset.id == source_ds_id))
            if not src_ds:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Source dataset '{source_ds_id}' not found.",
                )
            if dec_project_id and src_ds.project_id != dec_project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Source dataset '{source_ds_id}' belongs to a different project.",
                )
            # Verify lineage
            target_lineage = DatasetComparisonService.get_logical_lineage_name(db, src_ds)
            dec_lineage = DatasetComparisonService.get_logical_lineage_name(db, dataset) if dataset else ""
            if target_lineage != dec_lineage:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Source dataset '{source_ds_id}' (lineage '{target_lineage}') does not belong to the valid lineage of this decision ('{dec_lineage}').",
                )
            source_version = source_version or src_ds.version

        # 5. Evaluate outcome math
        metric_name = payload.actual_metric or ctx["expected_metric"]
        threshold = payload.material_difference_threshold if payload.material_difference_threshold is not None else 0.05
        eval_res = cls.evaluate_decision_outcome_math(
            expected_value=ctx["expected_value"],
            actual_value=actual_val,
            threshold=threshold,
            metric_name=metric_name,
        )

        # 6. Check for duplicate exact outcome to protect append-only integrity
        if actual_val is not None:
            dup = db.scalar(
                select(DecisionOutcome).where(
                    DecisionOutcome.decision_id == decision_id,
                    DecisionOutcome.actual_metric == metric_name,
                    DecisionOutcome.actual_value == actual_val,
                    DecisionOutcome.source_dataset_id == source_ds_id,
                )
            )
            if dup:
                return cls._map_to_phase6_response(dup, eval_res["learning_summary"])

        # 7. Persist outcome
        outcome = DecisionOutcome(
            project_id=dec_project_id,
            decision_id=decision_id,
            dataset_id=dataset.id if dataset else ctx.get("dataset_id"),
            recommendation_id=ctx.get("rec_id") or decision_id,
            optimization_id=ctx.get("opt_id"),
            scenario_id=ctx.get("scenario_id"),
            ml_analysis_id=ctx.get("ml_id"),
            expected_metric=ctx["expected_metric"],
            expected_value=ctx["expected_value"],
            actual_metric=metric_name if actual_val is not None else None,
            actual_value=actual_val,
            absolute_delta=eval_res["absolute_delta"],
            relative_delta=eval_res["relative_delta"],
            threshold_used=threshold,
            outcome_status=eval_res["outcome_status"],
            learning_signal=eval_res["learning_signal"],
            source_dataset_id=source_ds_id,
            source_dataset_version=source_version,
            source_analysis_run_id=source_run_id,
            notes=payload.notes,
        )
        db.add(outcome)
        db.commit()
        db.refresh(outcome)

        # 8. Phase 5 Evidence Graph Integration (DECISION -> OUTCOME, OUTCOME -> DATASET_VERSION)
        if dec_project_id:
            try:
                EvidenceService.record_edge(
                    db=db,
                    project_id=dec_project_id,
                    source_type="DECISION",
                    source_id=decision_id,
                    target_type="OUTCOME",
                    target_id=outcome.id,
                    relationship_type="EVALUATED_AGAINST",
                    metadata={
                        "status": outcome.outcome_status,
                        "relative_delta": outcome.relative_delta,
                        "learning_signal": outcome.learning_signal,
                    },
                )
                if source_ds_id:
                    EvidenceService.record_edge(
                        db=db,
                        project_id=dec_project_id,
                        source_type="OUTCOME",
                        source_id=outcome.id,
                        target_type="DATASET_VERSION",
                        target_id=source_ds_id,
                        relationship_type="MEASURED_FROM",
                        metadata={"source_version": source_version},
                    )
            except Exception:
                pass

        return cls._map_to_phase6_response(outcome, eval_res["learning_summary"])

    @classmethod
    def record_outcome_from_version(
        cls,
        db: Session,
        decision_id: str,
        payload: DecisionOutcomeFromVersionRequest,
        project_id: Optional[str] = None,
    ) -> DecisionOutcomeResponsePhase6:
        """Safely derive actual outcome from a subsequent dataset version in the lineage."""
        ctx = cls._resolve_decision_entities(db=db, decision_id=decision_id)
        dec_project_id = ctx["project_id"]
        dataset = ctx["dataset"]

        target_id = payload.target_dataset_id or payload.source_dataset_id
        if not target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_dataset_id or source_dataset_id is required.",
            )

        target_ds = db.scalar(select(Dataset).where(Dataset.id == target_id))
        if not target_ds:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target dataset '{target_id}' not found.",
            )
        if dec_project_id and target_ds.project_id != dec_project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target dataset '{target_id}' belongs to a different project.",
            )

        # Validate lineage
        target_lineage = DatasetComparisonService.get_logical_lineage_name(db, target_ds)
        dec_lineage = DatasetComparisonService.get_logical_lineage_name(db, dataset) if dataset else ""
        if target_lineage != dec_lineage:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target dataset '{target_ds.id}' is from lineage '{target_lineage}', does not match decision lineage '{dec_lineage}'.",
            )

        if dataset and target_ds.version < dataset.version:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target dataset version ({target_ds.version}) must be >= decision dataset version ({dataset.version}).",
            )

        metric_col = payload.metric_column or payload.metric_name or ctx["expected_metric"]
        actual_val = None

        # Extract actual value from dataset file or profile
        if target_ds.file_path and os.path.exists(target_ds.file_path):
            try:
                import pandas as pd
                df = pd.read_csv(target_ds.file_path) if target_ds.file_path.endswith(".csv") else pd.read_parquet(target_ds.file_path)
                if metric_col in df.columns and pd.api.types.is_numeric_dtype(df[metric_col]):
                    method = payload.aggregation_method or "mean"
                    if method == "sum":
                        actual_val = float(df[metric_col].sum())
                    elif method == "latest":
                        actual_val = float(df[metric_col].iloc[-1])
                    else:
                        actual_val = float(df[metric_col].mean())
            except Exception:
                pass

        if actual_val is None and target_ds.profile_data and isinstance(target_ds.profile_data, dict):
            prof = target_ds.profile_data
            col_info = prof.get("columns", {}).get(metric_col, {})
            if isinstance(col_info, dict) and "mean" in col_info:
                actual_val = float(col_info["mean"])
            elif "statistics" in prof and metric_col in prof["statistics"]:
                stat_info = prof["statistics"][metric_col]
                if isinstance(stat_info, dict) and "mean" in stat_info:
                    actual_val = float(stat_info["mean"])
                elif isinstance(stat_info, (int, float)):
                    actual_val = float(stat_info)
            elif metric_col in prof and isinstance(prof[metric_col], (int, float)):
                actual_val = float(prof[metric_col])

        if actual_val is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Metric '{metric_col}' could not be computed from target dataset '{target_ds.id}'. Column must exist and be numeric.",
            )

        create_payload = DecisionOutcomeCreatePhase6(
            actual_metric=metric_col,
            actual_value=actual_val,
            source_dataset_id=target_ds.id,
            source_dataset_version=target_ds.version,
            material_difference_threshold=payload.material_difference_threshold,
            notes=payload.notes or f"Derived automatically from dataset {target_ds.name} (v{target_ds.version}) using {payload.aggregation_method or 'mean'} of '{metric_col}'.",
        )
        return cls.record_decision_outcome(
            db=db,
            decision_id=decision_id,
            payload=create_payload,
            project_id=project_id,
        )

    @classmethod
    def get_outcome_record_by_id(
        cls,
        db: Session,
        outcome_id: str,
        project_id: Optional[str] = None,
    ) -> DecisionOutcomeResponsePhase6:
        """Retrieve single outcome record by ID with optional project isolation check."""
        outcome = db.scalar(select(DecisionOutcome).where(DecisionOutcome.id == outcome_id))
        if not outcome:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision outcome '{outcome_id}' not found.",
            )
        if project_id and outcome.project_id and outcome.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision outcome '{outcome_id}' not found in project '{project_id}'.",
            )

        eval_res = cls.evaluate_decision_outcome_math(
            expected_value=outcome.expected_value,
            actual_value=outcome.actual_value,
            threshold=outcome.threshold_used if outcome.threshold_used is not None else 0.05,
            metric_name=outcome.actual_metric or outcome.expected_metric,
        )
        return cls._map_to_phase6_response(outcome, eval_res["learning_summary"])

    @classmethod
    def get_project_outcomes(
        cls,
        db: Session,
        project_id: str,
    ) -> List[DecisionOutcomeResponsePhase6]:
        """Retrieve all recorded outcomes for a project with strict project isolation."""
        proj = db.scalar(select(Project).where(Project.id == project_id))
        if not proj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        records = db.scalars(
            select(DecisionOutcome)
            .where(DecisionOutcome.project_id == project_id)
            .order_by(DecisionOutcome.created_at.desc())
        ).all()

        results = []
        for r in records:
            eval_res = cls.evaluate_decision_outcome_math(
                expected_value=r.expected_value,
                actual_value=r.actual_value,
                threshold=r.threshold_used if r.threshold_used is not None else 0.05,
                metric_name=r.actual_metric or r.expected_metric,
            )
            results.append(cls._map_to_phase6_response(r, eval_res["learning_summary"]))
        return results

    @classmethod
    def _map_to_phase6_response(
        cls,
        record: DecisionOutcome,
        learning_summary: str,
    ) -> DecisionOutcomeResponsePhase6:
        source_name = record.source_dataset.name if record.source_dataset else None
        return DecisionOutcomeResponsePhase6(
            id=record.id,
            project_id=record.project_id,
            decision_id=record.decision_id or record.recommendation_id,
            recommendation_id=record.recommendation_id,
            dataset_id=record.dataset_id,
            expected_metric=record.expected_metric,
            expected_value=record.expected_value,
            actual_metric=record.actual_metric,
            actual_value=record.actual_value,
            absolute_delta=record.absolute_delta,
            relative_delta=record.relative_delta,
            threshold_used=record.threshold_used if record.threshold_used is not None else 0.05,
            outcome_status=record.outcome_status,
            learning_signal=record.learning_signal or "UNAVAILABLE",
            learning_summary=learning_summary,
            source_dataset_id=record.source_dataset_id,
            source_dataset_version=record.source_dataset_version,
            source_dataset_name=source_name,
            source_analysis_run_id=record.source_analysis_run_id,
            notes=record.notes,
            recorded_at=record.recorded_at,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )
