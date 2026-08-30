import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.decision_impact import DecisionImpactMeasurement
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.schemas.impact import (
    ImpactMeasurementCreate,
    ImpactMeasurementResponse,
    ImpactSummaryResponse,
)
from app.schemas.audit import AuditEventCreate
from app.services.eda_service import EDAService
from app.services.audit_service import DecisionAuditService


class DecisionImpactService:
    """Service layer for industry-agnostic Impact & Value Measurement."""

    @classmethod
    def create_impact_measurement(
        cls,
        db: Session,
        dataset_id: str,
        payload: ImpactMeasurementCreate,
    ) -> ImpactMeasurementResponse:
        """Calculate objective-aware impact & value creation and persist measurement."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        # 1. Verify recommendation exists for dataset
        rec = db.scalars(
            select(DecisionRecommendation).where(
                DecisionRecommendation.id == payload.recommendation_id,
                DecisionRecommendation.dataset_id == target_dataset.id,
            )
        ).first()

        if not rec:
            rec = db.scalars(
                select(DecisionRecommendationEvaluation).where(
                    DecisionRecommendationEvaluation.id == payload.recommendation_id,
                    DecisionRecommendationEvaluation.dataset_id == target_dataset.id,
                )
            ).first()

        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{payload.recommendation_id}' not found for dataset '{dataset_id}'.",
            )

        # 2. Resolve baseline, expected, actual values if not explicitly provided
        baseline_val = payload.baseline_value
        expected_val = payload.expected_value
        actual_val = payload.actual_value
        outcome_id = payload.outcome_id

        if outcome_id:
            outcome = db.scalars(
                select(DecisionOutcome).where(
                    DecisionOutcome.id == outcome_id,
                    DecisionOutcome.dataset_id == target_dataset.id,
                )
            ).first()
            if outcome:
                if actual_val is None:
                    actual_val = outcome.actual_value
                if expected_val is None:
                    expected_val = outcome.expected_value
        else:
            # Try to lookup outcome for recommendation
            outcome = db.scalars(
                select(DecisionOutcome).where(
                    DecisionOutcome.recommendation_id == rec.id,
                    DecisionOutcome.dataset_id == target_dataset.id,
                )
            ).first()
            if outcome:
                outcome_id = outcome.id
                if actual_val is None:
                    actual_val = outcome.actual_value
                if expected_val is None:
                    expected_val = outcome.expected_value

        if expected_val is None:
            expected_val = getattr(rec, "projected_value", None)

        if baseline_val is None:
            baseline_val = getattr(rec, "baseline_value", 0.0) or 0.0

        # Validate finite numeric values if present
        cls._validate_finite(baseline_val, "baseline_value")
        cls._validate_finite(expected_val, "expected_value")
        cls._validate_finite(actual_val, "actual_value")
        cls._validate_finite(payload.monetary_conversion_rate, "monetary_conversion_rate")

        # 3. Perform objective-aware impact calculations
        obj = (payload.objective or "maximize").lower()
        if obj not in ["maximize", "minimize"]:
            obj = "maximize"

        calc = cls.calculate_impact_metrics(
            baseline_value=baseline_val,
            expected_value=expected_val,
            actual_value=actual_val,
            objective=obj,
            monetary_conversion_rate=payload.monetary_conversion_rate,
            value_unit=payload.value_unit,
        )

        # 4. Save impact record
        impact_record = DecisionImpactMeasurement(
            dataset_id=target_dataset.id,
            decision_id=payload.decision_id or rec.id,
            recommendation_id=rec.id,
            outcome_id=outcome_id,
            metric_name=payload.metric_name,
            objective=obj,
            baseline_value=baseline_val,
            expected_value=expected_val,
            actual_value=actual_val,
            expected_change=calc["expected_change"],
            actual_change=calc["actual_change"],
            variance=calc["variance"],
            achievement_percentage=calc["achievement_percentage"],
            status=calc["status"],
            value_created=calc["value_created"],
            value_unit=calc["value_unit"],
            monetary_conversion_rate=payload.monetary_conversion_rate,
            metadata_json=payload.metadata or {},
        )

        db.add(impact_record)
        db.commit()
        db.refresh(impact_record)

        # 5. Emit Audit Event
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=impact_record.decision_id,
                    recommendation_id=impact_record.recommendation_id,
                    event_type="IMPACT_MEASURED",
                    event_status="SUCCESS",
                    source_service="impact_service",
                    evidence_references={
                        "impact_id": impact_record.id,
                        "recommendation_id": impact_record.recommendation_id,
                        "outcome_id": impact_record.outcome_id,
                        "metric_name": impact_record.metric_name,
                    },
                    new_state={
                        "achievement_percentage": impact_record.achievement_percentage,
                        "status": impact_record.status,
                        "value_created": impact_record.value_created,
                    },
                ),
            )
        except Exception:
            pass  # Audit failures should never block business logic

        return cls._map_to_response(impact_record)

    @classmethod
    def calculate_impact_metrics(
        cls,
        baseline_value: Optional[float],
        expected_value: Optional[float],
        actual_value: Optional[float],
        objective: str = "maximize",
        monetary_conversion_rate: Optional[float] = None,
        value_unit: Optional[str] = "metric_units",
    ) -> Dict[str, Any]:
        """Pure deterministic formula calculation for impact and value creation."""
        b = float(baseline_value) if baseline_value is not None else 0.0
        obj = (objective or "maximize").lower()

        if expected_value is None or actual_value is None:
            return {
                "expected_change": 0.0,
                "actual_change": 0.0,
                "variance": 0.0,
                "achievement_percentage": 0.0,
                "status": "UNMEASURABLE",
                "value_created": None,
                "value_unit": value_unit,
            }

        exp = float(expected_value)
        act = float(actual_value)

        if obj == "minimize":
            exp_change = round(b - exp, 4)
            act_change = round(b - act, 4)
        else:
            exp_change = round(exp - b, 4)
            act_change = round(act - b, 4)

        variance = round(act_change - exp_change, 4)

        # Calculate Achievement Percentage
        if abs(exp_change) < 1e-9:
            if act_change >= 0.0:
                achievement = 100.0
            else:
                achievement = 0.0
        else:
            achievement = round((act_change / exp_change) * 100.0, 2)

        # Determine Status
        if achievement >= 95.0:
            status_str = "ACHIEVED"
        elif achievement >= 70.0:
            status_str = "PARTIALLY_ACHIEVED"
        else:
            status_str = "NOT_ACHIEVED"

        # Calculate Value Created
        if monetary_conversion_rate is not None:
            rate = float(monetary_conversion_rate)
            value_created = round(act_change * rate, 4)
        else:
            value_created = None

        return {
            "expected_change": exp_change,
            "actual_change": act_change,
            "variance": variance,
            "achievement_percentage": achievement,
            "status": status_str,
            "value_created": value_created,
            "value_unit": value_unit,
        }

    @classmethod
    def get_impact_by_id(cls, db: Session, dataset_id: str, impact_id: str) -> ImpactMeasurementResponse:
        """Retrieve single impact measurement by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionImpactMeasurement).where(
            DecisionImpactMeasurement.id == impact_id,
            DecisionImpactMeasurement.dataset_id == target_dataset.id,
        )
        record = db.scalars(stmt).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Impact measurement '{impact_id}' not found for dataset '{dataset_id}'.",
            )
        return cls._map_to_response(record)

    @classmethod
    def get_impact_summary(cls, db: Session, dataset_id: str) -> ImpactSummaryResponse:
        """Retrieve all impact measurements and aggregate value created for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionImpactMeasurement)
            .where(DecisionImpactMeasurement.dataset_id == target_dataset.id)
            .order_by(DecisionImpactMeasurement.measured_at.desc())
        )
        records = db.scalars(stmt).all()

        achieved = sum(1 for r in records if r.status == "ACHIEVED")
        partially = sum(1 for r in records if r.status == "PARTIALLY_ACHIEVED")
        not_achieved = sum(1 for r in records if r.status == "NOT_ACHIEVED")
        unmeasurable = sum(1 for r in records if r.status == "UNMEASURABLE")

        val_list = [r.value_created for r in records if r.value_created is not None]
        total_val = round(sum(val_list), 4) if val_list else None

        mapped = [cls._map_to_response(r) for r in records]
        return ImpactSummaryResponse(
            dataset_id=target_dataset.id,
            total_measurements=len(records),
            achieved_count=achieved,
            partially_achieved_count=partially,
            not_achieved_count=not_achieved,
            unmeasurable_count=unmeasurable,
            total_value_created=total_val,
            measurements=mapped,
        )

    @classmethod
    def _validate_finite(cls, val: Optional[float], name: str):
        if val is not None:
            try:
                f_val = float(val)
                if math.isnan(f_val) or math.isinf(f_val):
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Field '{name}' must be a finite numerical value.",
                )

    @classmethod
    def _map_to_response(cls, record: DecisionImpactMeasurement) -> ImpactMeasurementResponse:
        return ImpactMeasurementResponse(
            id=record.id,
            dataset_id=record.dataset_id,
            decision_id=record.decision_id,
            recommendation_id=record.recommendation_id,
            outcome_id=record.outcome_id,
            metric_name=record.metric_name,
            objective=record.objective,
            baseline_value=record.baseline_value,
            expected_value=record.expected_value,
            actual_value=record.actual_value,
            expected_change=record.expected_change,
            actual_change=record.actual_change,
            variance=record.variance,
            achievement_percentage=record.achievement_percentage,
            status=record.status,
            value_created=record.value_created,
            value_unit=record.value_unit,
            monetary_conversion_rate=record.monetary_conversion_rate,
            measured_at=record.measured_at,
            metadata_json=record.metadata_json or {},
        )
