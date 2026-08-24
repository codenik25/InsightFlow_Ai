from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
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

        # 2. Retrieve & Verify Recommendation Record
        stmt_rec = select(DecisionRecommendationEvaluation).where(
            DecisionRecommendationEvaluation.id == payload.recommendation_id,
            DecisionRecommendationEvaluation.dataset_id == target_dataset.id,
        )
        rec = db.scalars(stmt_rec).first()
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{payload.recommendation_id}' not found for dataset '{dataset_id}'.",
            )

        # 3. Retrieve & Verify Optimization Record
        stmt_opt = select(DecisionOptimization).where(
            DecisionOptimization.id == rec.optimization_id,
            DecisionOptimization.dataset_id == target_dataset.id,
        )
        opt = db.scalars(stmt_opt).first()
        if not opt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Optimization artifact '{rec.optimization_id}' not found for dataset '{dataset_id}'.",
            )

        # 4. Duplicate Outcome Submission Protection
        stmt_dup = select(DecisionOutcome).where(
            DecisionOutcome.dataset_id == target_dataset.id,
            DecisionOutcome.recommendation_id == rec.id,
            DecisionOutcome.actual_metric == payload.actual_metric,
            DecisionOutcome.actual_value == payload.actual_value,
        )
        if db.scalars(stmt_dup).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate outcome record already exists for recommendation '{rec.id}' with metric '{payload.actual_metric}' and value {payload.actual_value}.",
            )

        # 5. Expected Target Prediction Resolution
        expected_metric = rec.target_metric
        expected_value = rec.projected_value
        objective = opt.objective or "maximize"
        actual_value = float(payload.actual_value)

        # 6. Objective-Aware Comparative Evaluation
        eval_result = cls.evaluate_outcome_metrics(
            expected_value=expected_value,
            actual_value=actual_value,
            objective=objective,
        )

        # 7. Persist Outcome Record
        outcome_record = DecisionOutcome(
            dataset_id=target_dataset.id,
            recommendation_id=rec.id,
            optimization_id=opt.id,
            scenario_id=rec.scenario_id,
            ml_analysis_id=rec.ml_analysis_id,
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
                # For minimization, lower actual outcome is favorable
                if act <= 0 and exp <= 0:
                    achievement = round((exp / act) * 100.0, 2) if act != 0 else 100.0
                else:
                    achievement = round((1.0 + (exp - act) / abs(exp)) * 100.0, 2)
            else:
                # For maximization, higher actual outcome is favorable
                achievement = round((act / exp) * 100.0, 2)

        # Classification Status
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

        # Query guardrail statuses for recommendations
        stmt_g = select(DecisionGuardrailEvaluation).where(DecisionGuardrailEvaluation.dataset_id == target_dataset.id)
        guardrail_records = db.scalars(stmt_g).all()
        g_map = {g.recommendation_id: g for g in guardrail_records}

        memory_items: List[DecisionMemoryItem] = []
        for o in outcomes:
            rec = o.recommendation
            g_eval = g_map.get(o.recommendation_id)
            d_status = g_eval.decision_status if g_eval else "HUMAN_REVIEW_REQUIRED"

            memory_items.append(
                DecisionMemoryItem(
                    outcome_id=o.id,
                    recommendation_id=o.recommendation_id,
                    recommendation_title=rec.title if rec else "Recommendation",
                    recommendation_type=rec.recommendation_type if rec else "PERFORMANCE",
                    target_metric=o.expected_metric,
                    expected_value=o.expected_value,
                    actual_value=o.actual_value,
                    achievement_percentage=o.achievement_percentage,
                    outcome_status=o.outcome_status,
                    decision_status=d_status,
                    confidence=rec.confidence if rec else "MODERATE",
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
