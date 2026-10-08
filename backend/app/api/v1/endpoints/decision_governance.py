from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_governance import (
    DecisionGovernanceResponse,
    GovernanceEventResponse,
    GovernanceTransitionRequest,
)
from app.services.decision_governance_service import DecisionGovernanceService

router = APIRouter()


# -----------------------------------------------------------------------------
# Decision-Scoped Endpoints: /api/v1/decisions/{decision_id}/governance
# -----------------------------------------------------------------------------

@router.get(
    "/decisions/{decision_id}/governance",
    response_model=DecisionGovernanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve complete Decision Governance & Control Plane view",
    tags=["Decision Governance & Control Plane"],
)
def get_decision_governance(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID to enforce strict project boundary"),
    db: Session = Depends(get_db),
):
    """
    Retrieve factual governance state, allowed actions, readiness checks,
    deterministic escalation assessment, and append-only transition history.
    """
    return DecisionGovernanceService.get_governance_state(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )


@router.post(
    "/decisions/{decision_id}/governance/transition",
    response_model=DecisionGovernanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Perform explicit human-in-the-loop governance transition",
    tags=["Decision Governance & Control Plane"],
)
def transition_decision_governance(
    decision_id: str,
    payload: GovernanceTransitionRequest,
    project_id: Optional[str] = Query(None, description="Optional project ID to enforce strict project boundary"),
    db: Session = Depends(get_db),
):
    """
    Execute an explicit, human-authorized lifecycle transition (e.g. APPROVE, REJECT, ESCALATE, PUT_ON_HOLD).
    Validates state machine transitions, captures non-empty reviewer identity, records review notes,
    and appends to the immutable audit history.
    """
    return DecisionGovernanceService.transition_governance_state(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@router.get(
    "/decisions/{decision_id}/governance/history",
    response_model=List[GovernanceEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve chronological append-only governance transition history",
    tags=["Decision Governance & Control Plane"],
)
def get_decision_governance_history(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID to enforce strict project boundary"),
    db: Session = Depends(get_db),
):
    """Retrieve chronological append-only history of all human governance actions."""
    return DecisionGovernanceService.get_governance_history(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )


# -----------------------------------------------------------------------------
# Project-Scoped Route Aliases: /api/v1/projects/{project_id}/decisions/...
# -----------------------------------------------------------------------------

@router.get(
    "/projects/{project_id}/decisions/{decision_id}/governance",
    response_model=DecisionGovernanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve complete Decision Governance view for project",
    tags=["Decision Governance & Control Plane"],
)
def get_project_decision_governance(
    project_id: str,
    decision_id: str,
    db: Session = Depends(get_db),
):
    return DecisionGovernanceService.get_governance_state(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )


@router.post(
    "/projects/{project_id}/decisions/{decision_id}/governance/transition",
    response_model=DecisionGovernanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Perform explicit human governance transition for project",
    tags=["Decision Governance & Control Plane"],
)
def transition_project_decision_governance(
    project_id: str,
    decision_id: str,
    payload: GovernanceTransitionRequest,
    db: Session = Depends(get_db),
):
    return DecisionGovernanceService.transition_governance_state(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@router.get(
    "/projects/{project_id}/decisions/{decision_id}/governance/history",
    response_model=List[GovernanceEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve chronological governance history for project",
    tags=["Decision Governance & Control Plane"],
)
def get_project_decision_governance_history(
    project_id: str,
    decision_id: str,
    db: Session = Depends(get_db),
):
    return DecisionGovernanceService.get_governance_history(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )
