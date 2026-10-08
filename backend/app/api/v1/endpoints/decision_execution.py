from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_execution import (
    DecisionExecutionResponse,
    DecisionExecutionHistoryResponse,
    ExecutionRequestPayload,
    ExecutionConfirmPayload,
    ExecutionFailPayload,
    ExecutionNotExecutedPayload,
)
from app.services.decision_execution_service import DecisionExecutionService

router = APIRouter()


@router.get(
    "/decisions/{decision_id}/execution",
    response_model=DecisionExecutionResponse,
    summary="Get Decision Execution Status and Readiness",
    description="Retrieve the current execution record, eligibility, readiness checks, and outcome linkage.",
)
def get_decision_execution(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional Project ID for strict tenancy isolation"),
    db: Session = Depends(get_db),
):
    return DecisionExecutionService.get_or_init_execution(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )


@router.post(
    "/decisions/{decision_id}/execution/request",
    response_model=DecisionExecutionResponse,
    summary="Request Decision Execution",
    description="Submit an execution request for an approved decision, transitioning state to PENDING_CONFIRMATION.",
)
def request_decision_execution(
    decision_id: str,
    payload: ExecutionRequestPayload,
    project_id: Optional[str] = Query(None, description="Optional Project ID for strict tenancy isolation"),
    db: Session = Depends(get_db),
):
    return DecisionExecutionService.request_execution(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@router.post(
    "/decisions/{decision_id}/execution/confirm",
    response_model=DecisionExecutionResponse,
    summary="Confirm Decision Execution (Human-in-the-Loop)",
    description="Idempotently confirm decision execution with operator identity and operational rationale.",
)
def confirm_decision_execution(
    decision_id: str,
    payload: ExecutionConfirmPayload,
    project_id: Optional[str] = Query(None, description="Optional Project ID for strict tenancy isolation"),
    db: Session = Depends(get_db),
):
    return DecisionExecutionService.confirm_execution(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@router.post(
    "/decisions/{decision_id}/execution/fail",
    response_model=DecisionExecutionResponse,
    summary="Mark Decision Execution as Failed",
    description="Record an execution failure without autonomous retry or model retraining.",
)
def fail_decision_execution(
    decision_id: str,
    payload: ExecutionFailPayload,
    project_id: Optional[str] = Query(None, description="Optional Project ID for strict tenancy isolation"),
    db: Session = Depends(get_db),
):
    return DecisionExecutionService.mark_failed(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@router.post(
    "/decisions/{decision_id}/execution/not-executed",
    response_model=DecisionExecutionResponse,
    summary="Mark Decision as Not Executed",
    description="Record an approved decision that was deliberately not executed (e.g. operational window expired).",
)
def mark_decision_not_executed(
    decision_id: str,
    payload: ExecutionNotExecutedPayload,
    project_id: Optional[str] = Query(None, description="Optional Project ID for strict tenancy isolation"),
    db: Session = Depends(get_db),
):
    return DecisionExecutionService.mark_not_executed(
        db=db,
        decision_id=decision_id,
        payload=payload,
        project_id=project_id,
    )


@router.get(
    "/decisions/{decision_id}/execution/history",
    response_model=DecisionExecutionHistoryResponse,
    summary="Get Decision Execution History",
    description="Retrieve the chronological, append-only audit trail of execution events.",
)
def get_decision_execution_history(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional Project ID for strict tenancy isolation"),
    db: Session = Depends(get_db),
):
    return DecisionExecutionService.get_execution_history(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )
