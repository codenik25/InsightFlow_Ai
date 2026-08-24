from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.outcome import (
    DecisionOutcomeCreate,
    DecisionOutcomeResponse,
    DecisionMemoryResponse,
    DecisionPerformanceSummary,
)
from app.services.outcome_service import DecisionOutcomeService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/outcomes",
    response_model=DecisionOutcomeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record and evaluate a real-world decision outcome",
)
def record_decision_outcome(
    dataset_id: str,
    payload: DecisionOutcomeCreate,
    db: Session = Depends(get_db),
):
    """Record observed real-world result, deterministically evaluate projection error and target achievement percentage."""
    return DecisionOutcomeService.record_outcome(
        db=db,
        dataset_id=dataset_id,
        payload=payload,
    )


@router.get(
    "/{dataset_id}/decision/outcomes",
    response_model=List[DecisionOutcomeResponse],
    status_code=status.HTTP_200_OK,
    summary="List recorded decision outcomes for a dataset",
)
def list_decision_outcomes(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve all recorded decision outcome entries for a dataset."""
    return DecisionOutcomeService.get_outcomes_for_dataset(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/{dataset_id}/decision/outcomes/{outcome_id}",
    response_model=DecisionOutcomeResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve single recorded decision outcome",
)
def get_decision_outcome(
    dataset_id: str,
    outcome_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve single outcome evaluation by ID."""
    return DecisionOutcomeService.get_outcome_by_id(
        db=db,
        dataset_id=dataset_id,
        outcome_id=outcome_id,
    )


@router.get(
    "/{dataset_id}/decision/memory",
    response_model=DecisionMemoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve historical Decision Memory for a dataset",
)
def get_decision_memory(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve historical decision memory linking recommendations with measured real-world outcomes."""
    return DecisionOutcomeService.get_decision_memory(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/{dataset_id}/decision/performance",
    response_model=DecisionPerformanceSummary,
    status_code=status.HTTP_200_OK,
    summary="Retrieve aggregate Decision Performance Summary for a dataset",
)
def get_decision_performance_summary(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve aggregate decision achievement rate, average error, and outcome counts."""
    return DecisionOutcomeService.get_decision_performance_summary(
        db=db,
        dataset_id=dataset_id,
    )
