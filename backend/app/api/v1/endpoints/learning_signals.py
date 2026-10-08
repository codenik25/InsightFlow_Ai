from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.learning_signal import (
    DecisionLearningSignalResponse,
    DecisionLearningSignalUpdate,
    DecisionLearningSignalsListResponse,
)
from app.services.learning_signal_service import LearningSignalService

router = APIRouter()


@router.get(
    "/projects/{project_id}/learning-signals",
    response_model=DecisionLearningSignalsListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Decision Learning & Improvement Signals for a project",
)
def list_learning_signals(
    project_id: str,
    min_observations: int = Query(3, ge=1, description="Minimum observations required before flagging repeated deviations"),
    threshold: float = Query(0.05, gt=0.0, description="Material difference threshold fraction (e.g. 0.05 for 5%)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED, DISMISSED)"),
    severity_filter: Optional[str] = Query(None, alias="severity", description="Filter by severity (INFO, REVIEW, HIGH)"),
    db: Session = Depends(get_db),
):
    """
    Synchronizes and retrieves structured Decision Learning & Improvement Signals for a project.
    Derived deterministically from Phase 7 performance intelligence and Phase 6 outcomes.
    """
    signals = LearningSignalService.sync_and_get_signals(
        db=db,
        project_id=project_id,
        min_observations=min_observations,
        threshold=threshold,
    )

    if status_filter:
        signals = [s for s in signals if s.status.upper() == status_filter.strip().upper()]

    if severity_filter:
        signals = [s for s in signals if s.severity.upper() == severity_filter.strip().upper()]

    return LearningSignalService.build_list_response(project_id=project_id, signals=signals)


@router.get(
    "/projects/{project_id}/learning-signals/{signal_id}",
    response_model=DecisionLearningSignalResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single Decision Learning Signal detail and source evidence",
)
def get_learning_signal(
    project_id: str,
    signal_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve an individual decision learning signal with complete traceable evidence references."""
    signal = LearningSignalService.get_signal_by_id(
        db=db,
        project_id=project_id,
        signal_id=signal_id,
    )
    if hasattr(DecisionLearningSignalResponse, "model_validate"):
        return DecisionLearningSignalResponse.model_validate(signal)
    return DecisionLearningSignalResponse.from_orm(signal)


@router.patch(
    "/projects/{project_id}/learning-signals/{signal_id}",
    response_model=DecisionLearningSignalResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Decision Learning Signal lifecycle status (Human Review)",
)
def update_learning_signal_status(
    project_id: str,
    signal_id: str,
    payload: DecisionLearningSignalUpdate,
    db: Session = Depends(get_db),
):
    """
    Human analyst workflow endpoint: transitions lifecycle status (ACKNOWLEDGED, INVESTIGATING, RESOLVED, DISMISSED)
    with review notes and audit timestamps. Does not permit modification of computed evidence or thresholds.
    """
    signal = LearningSignalService.update_signal_status(
        db=db,
        project_id=project_id,
        signal_id=signal_id,
        payload=payload,
    )
    if hasattr(DecisionLearningSignalResponse, "model_validate"):
        return DecisionLearningSignalResponse.model_validate(signal)
    return DecisionLearningSignalResponse.from_orm(signal)
