from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.audit import (
    AuditEventCreate,
    AuditEventResponse,
    DecisionAuditTrailResponse,
)
from app.services.audit_service import DecisionAuditService

router = APIRouter()


@router.get(
    "/{dataset_id}/decision/audit",
    response_model=DecisionAuditTrailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve full chronological Decision Audit Trail for a dataset",
)
def get_decision_audit_trail(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve full append-only audit trail for a dataset."""
    return DecisionAuditService.get_audit_trail(
        db=db,
        dataset_id=dataset_id,
        decision_id=None,
    )


@router.get(
    "/{dataset_id}/decision/audit/{decision_id}",
    response_model=DecisionAuditTrailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve decision-filtered Audit Trail",
)
def get_decision_audit_trail_for_decision(
    dataset_id: str,
    decision_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve chronological audit trail filtered for a specific decision or recommendation."""
    return DecisionAuditService.get_audit_trail(
        db=db,
        dataset_id=dataset_id,
        decision_id=decision_id,
    )
