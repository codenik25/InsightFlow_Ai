from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.outcome import (
    DecisionOutcomeCreate,
    DecisionOutcomeResponse,
    DecisionMemoryResponse,
    DecisionPerformanceSummary,
    DecisionOutcomeCreatePhase6,
    DecisionOutcomeFromVersionRequest,
    DecisionOutcomeResponsePhase6,
    DecisionOutcomesListResponse,
)
from app.services.outcome_service import DecisionOutcomeService

router = APIRouter()
phase6_router = APIRouter()


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


# =====================================================================
# Phase 6 — Decision Outcome & Learning Loop Endpoints
# =====================================================================


@phase6_router.get(
    "/decisions/{decision_id}/outcomes",
    response_model=DecisionOutcomesListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get outcome comparison and history for a decision",
)
def get_decision_outcomes(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
):
    """Retrieve decision outcome evaluation and historical recordings. Synthesizes a factual PENDING state if no outcomes recorded."""
    return DecisionOutcomeService.get_decision_outcomes(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )


@phase6_router.post(
    "/decisions/{decision_id}/outcomes",
    response_model=DecisionOutcomeResponsePhase6,
    status_code=status.HTTP_201_CREATED,
    summary="Record observed decision outcome",
)
def record_decision_outcome_phase6(
    decision_id: str,
    payload: DecisionOutcomeCreatePhase6,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
):
    """Record an empirical observed outcome for an approved/evaluated decision, evaluate variance, and link evidence graph."""
    return DecisionOutcomeService.record_decision_outcome(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@phase6_router.post(
    "/decisions/{decision_id}/outcomes/from-version",
    response_model=DecisionOutcomeResponsePhase6,
    status_code=status.HTTP_201_CREATED,
    summary="Record decision outcome derived from a subsequent dataset version",
)
def record_decision_outcome_from_version(
    decision_id: str,
    payload: DecisionOutcomeFromVersionRequest,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
):
    """Derive an empirical observed outcome directly from a subsequent dataset version in the dataset lineage."""
    return DecisionOutcomeService.record_outcome_from_version(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@phase6_router.get(
    "/outcomes/{outcome_id}",
    response_model=DecisionOutcomeResponsePhase6,
    status_code=status.HTTP_200_OK,
    summary="Get single decision outcome record by ID",
)
def get_decision_outcome_by_id(
    outcome_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
):
    """Retrieve a single recorded outcome record with evaluated variance and learning signal."""
    return DecisionOutcomeService.get_outcome_record_by_id(
        db=db,
        outcome_id=outcome_id,
        project_id=project_id,
    )



@phase6_router.get(
    "/projects/{project_id}/outcomes",
    response_model=List[DecisionOutcomeResponsePhase6],
    status_code=status.HTTP_200_OK,
    summary="List all recorded decision outcomes for a project",
)
def get_project_decision_outcomes(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve all outcome evaluations for decisions within a project."""
    return DecisionOutcomeService.get_project_outcomes(
        db=db,
        project_id=project_id,
    )

