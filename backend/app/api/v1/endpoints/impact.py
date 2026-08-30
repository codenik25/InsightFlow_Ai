from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.impact import (
    ImpactMeasurementCreate,
    ImpactMeasurementResponse,
    ImpactSummaryResponse,
)
from app.services.impact_service import DecisionImpactService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/impact",
    response_model=ImpactMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record and evaluate an Impact / Value Measurement",
)
def record_decision_impact(
    dataset_id: str,
    payload: ImpactMeasurementCreate,
    db: Session = Depends(get_db),
):
    """Record objective-aware impact measurement and calculate business value creation."""
    return DecisionImpactService.create_impact_measurement(
        db=db,
        dataset_id=dataset_id,
        payload=payload,
    )


@router.get(
    "/{dataset_id}/decision/impact",
    response_model=ImpactSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="List Impact / Value Measurements and summary for a dataset",
)
def list_decision_impacts(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve all recorded impact measurements and aggregate value created for a dataset."""
    return DecisionImpactService.get_impact_summary(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/{dataset_id}/decision/impact/{impact_id}",
    response_model=ImpactMeasurementResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve single Impact / Value Measurement record",
)
def get_decision_impact(
    dataset_id: str,
    impact_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve single impact measurement record by ID."""
    return DecisionImpactService.get_impact_by_id(
        db=db,
        dataset_id=dataset_id,
        impact_id=impact_id,
    )
