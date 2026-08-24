from typing import Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_brief import DecisionBriefResponse, DecisionBriefRequest
from app.services.decision_brief_service import DecisionBriefService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/brief",
    response_model=DecisionBriefResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate, validate, and persist AI Decision Brief",
)
def generate_decision_brief(
    dataset_id: str,
    payload: Optional[DecisionBriefRequest] = None,
    db: Session = Depends(get_db),
):
    """Generate, validate against evidence/numeric/non-causal rules, fall back if necessary, and persist AI Decision Brief."""
    rec_id = payload.recommendation_id if payload else None
    p_override = payload.provider_override if payload else None
    return DecisionBriefService.generate_decision_brief(
        db=db,
        dataset_id=dataset_id,
        recommendation_id=rec_id,
        provider_override=p_override,
    )


@router.get(
    "/{dataset_id}/decision/brief",
    response_model=DecisionBriefResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve latest persisted AI Decision Brief",
)
def get_latest_decision_brief(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve latest persisted AI Decision Brief for a dataset without invoking LLM or regenerating."""
    return DecisionBriefService.get_latest_brief(
        db=db,
        dataset_id=dataset_id,
    )
