import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_outcome import DecisionOutcome

from app.schemas.outcome import (
    DecisionOutcomeCreate,
    OutcomeEvaluation,
    DecisionOutcomeResponse,
    DecisionMemoryItem,
    DecisionMemoryResponse,
    DecisionPerformanceSummary,
)
from app.services.eda_service import EDAService


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
