from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.guardrail import DecisionGuardrailResponse, GuardrailBatchResponse
from app.services.guardrail_service import DecisionGuardrailService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/recommendations/{recommendation_id}/guardrails",
    response_model=DecisionGuardrailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Evaluate decision safety and feasibility guardrails for a recommendation",
)
def evaluate_recommendation_guardrails(
    dataset_id: str,
    recommendation_id: str,
    db: Session = Depends(get_db),
):
    """Evaluate feasibility, realism, risk, confidence, and readiness guardrails for a specific decision recommendation."""
    return DecisionGuardrailService.evaluate_recommendation(
        db=db,
        dataset_id=dataset_id,
        recommendation_id=recommendation_id,
    )


@router.post(
    "/{dataset_id}/decision/guardrails",
    response_model=GuardrailBatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Evaluate decision guardrails for all recommendations of a dataset",
)
def evaluate_all_dataset_guardrails(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Evaluate decision guardrails across all stored recommendations for a dataset."""
    return DecisionGuardrailService.evaluate_all_recommendations(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/{dataset_id}/decision/guardrails",
    response_model=List[DecisionGuardrailResponse],
    summary="List stored decision guardrail evaluations for a dataset",
)
def list_dataset_guardrails(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve stored decision guardrail evaluations for a dataset."""
    return DecisionGuardrailService.get_guardrails_for_dataset(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/{dataset_id}/decision/recommendations/{recommendation_id}/guardrails",
    response_model=DecisionGuardrailResponse,
    summary="Get stored decision guardrail evaluation for a specific recommendation",
)
def get_recommendation_guardrails(
    dataset_id: str,
    recommendation_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve stored decision guardrail evaluation for a specific recommendation."""
    return DecisionGuardrailService.get_guardrail_by_recommendation_id(
        db=db,
        dataset_id=dataset_id,
        recommendation_id=recommendation_id,
    )
