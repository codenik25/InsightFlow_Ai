from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ai_evaluation import (
    AIEvaluationRequest,
    AIEvaluationResponse,
)
from app.services.ai_evaluation_service import AIEvaluationService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/evaluations",
    response_model=AIEvaluationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Execute AI Evaluation Framework on a Decision Brief",
)
def evaluate_ai_decision(
    dataset_id: str,
    payload: Optional[AIEvaluationRequest] = None,
    db: Session = Depends(get_db),
):
    """Execute 7-dimension evaluation on a Decision Brief or AI decision output."""
    req = payload or AIEvaluationRequest()
    return AIEvaluationService.evaluate_ai_decision_brief(
        db=db,
        dataset_id=dataset_id,
        request=req,
    )


@router.get(
    "/{dataset_id}/decision/evaluations",
    response_model=List[AIEvaluationResponse],
    status_code=status.HTTP_200_OK,
    summary="List all AI Evaluation records for a dataset",
)
def list_ai_evaluations(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve all recorded AI evaluations for a dataset."""
    return AIEvaluationService.list_evaluations(
        db=db,
        dataset_id=dataset_id,
    )


@router.get(
    "/{dataset_id}/decision/evaluations/{evaluation_id}",
    response_model=AIEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve single AI Evaluation record",
)
def get_ai_evaluation(
    dataset_id: str,
    evaluation_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve single AI evaluation record by ID."""
    return AIEvaluationService.get_evaluation_by_id(
        db=db,
        dataset_id=dataset_id,
        evaluation_id=evaluation_id,
    )
