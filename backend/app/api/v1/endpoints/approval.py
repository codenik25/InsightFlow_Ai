from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.approval import (
    ApprovalRequestPayload,
    ApprovalDecisionPayload,
    ApprovalResponse,
    ActionGateCheckResponse,
    ActionExecuteRequest,
    ActionExecuteResponse,
)
from app.services.action_gate_service import ActionGateService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/{decision_id}/approve",
    response_model=ApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Explicitly approve a decision recommendation",
)
def approve_decision(
    dataset_id: str,
    decision_id: str,
    payload: Optional[ApprovalDecisionPayload] = None,
    db: Session = Depends(get_db),
):
    """Grant explicit human approval for a decision recommendation."""
    return ActionGateService.approve_decision(
        db=db,
        dataset_id=dataset_id,
        decision_id=decision_id,
        payload=payload,
    )


@router.post(
    "/{dataset_id}/decision/{decision_id}/reject",
    response_model=ApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Explicitly reject a decision recommendation",
)
def reject_decision(
    dataset_id: str,
    decision_id: str,
    payload: Optional[ApprovalDecisionPayload] = None,
    db: Session = Depends(get_db),
):
    """Explicitly reject a decision recommendation."""
    return ActionGateService.reject_decision(
        db=db,
        dataset_id=dataset_id,
        decision_id=decision_id,
        payload=payload,
    )


@router.get(
    "/{dataset_id}/decision/{decision_id}/approval",
    response_model=ApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve current approval status for a decision",
)
def get_approval_status(
    dataset_id: str,
    decision_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve current human approval status."""
    return ActionGateService.get_approval_status(
        db=db,
        dataset_id=dataset_id,
        decision_id=decision_id,
    )


@router.post(
    "/{dataset_id}/decision/{decision_id}/action/gate",
    response_model=ActionGateCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate deterministic Action Gate prerequisites",
)
def check_action_gate(
    dataset_id: str,
    decision_id: str,
    db: Session = Depends(get_db),
):
    """Evaluate 9-point deterministic action gate checks to verify if decision action is allowed."""
    return ActionGateService.check_action_gate(
        db=db,
        dataset_id=dataset_id,
        decision_id=decision_id,
    )


@router.post(
    "/{dataset_id}/decision/{decision_id}/action/execute",
    response_model=ActionExecuteResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute simulated decision action through Action Gate",
)
def execute_decision_action(
    dataset_id: str,
    decision_id: str,
    payload: Optional[ActionExecuteRequest] = None,
    db: Session = Depends(get_db),
):
    """Attempt simulated action execution after validating against Action Gate."""
    return ActionGateService.execute_action(
        db=db,
        dataset_id=dataset_id,
        decision_id=decision_id,
        payload=payload,
    )
