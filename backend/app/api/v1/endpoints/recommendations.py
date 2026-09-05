from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.recommendation import (
    RecommendationRequest,
    DecisionRecommendation,
    RecommendationResponse,
)
from app.services.recommendation_service import RecommendationService
from app.services.decision_service import DecisionService

router = APIRouter()


@router.post(
    "/{dataset_id}/decision/optimize/recommendations",
    summary="Generate evidence-backed executive decision recommendations from optimizations",
)
def generate_executive_recommendations(
    dataset_id: str,
    response: Response,
    payload: Optional[RecommendationRequest] = None,
    scenario_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Any:
    """Transform optimization scenarios into evidence-backed, trade-off analyzed executive recommendations."""
    if scenario_id is not None:
        response.status_code = status.HTTP_200_OK
        return DecisionService.generate_recommendations(db=db, dataset_id=dataset_id, scenario_id=scenario_id)

    response.status_code = status.HTTP_201_CREATED
    if payload is None:
        payload = RecommendationRequest()

    return RecommendationService.generate_recommendations(
        db=db,
        dataset_id=dataset_id,
        payload=payload,
    )


@router.get(
    "/{dataset_id}/decision/optimize/recommendations",
    summary="List stored optimization-based decision recommendations for a dataset",
)
def list_executive_recommendations(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """Retrieve stored optimization-based decision recommendations for a dataset."""
    recs = RecommendationService.get_recommendations_for_dataset(
        db=db,
        dataset_id=dataset_id,
    )
    if recs:
        return recs
    # Fallback to Phase 7.0 decision service recommendations if Phase 7.3 not generated yet
    return DecisionService.get_recommendations_for_dataset(db=db, dataset_id=dataset_id)


@router.get(
    "/{dataset_id}/decision/optimize/recommendations/{recommendation_id}",
    response_model=DecisionRecommendation,
    summary="Get a specific optimization-based decision recommendation by ID",
)
def get_executive_recommendation(
    dataset_id: str,
    recommendation_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve a specific decision recommendation by ID."""
    return RecommendationService.get_recommendation_by_id(
        db=db,
        dataset_id=dataset_id,
        recommendation_id=recommendation_id,
    )
