from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_performance import (
    DecisionPerformanceResponse,
    MetricPerformanceItem,
    TrendPeriodItem,
    ModelPerformanceItem,
    ScenarioPerformanceItem,
)
from app.services.decision_performance_service import DecisionPerformanceService

router = APIRouter()


@router.get(
    "/projects/{project_id}/decision-performance",
    response_model=DecisionPerformanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated decision performance intelligence for a project",
)
def get_decision_performance_overview(
    project_id: str,
    min_observations: int = Query(3, ge=1, description="Minimum sample count required before flagging deviations"),
    period: str = Query("week", pattern="^(day|week|month)$", description="Trend bucket period: day, week, or month"),
    threshold: float = Query(0.05, gt=0.0, description="Material difference threshold fraction (e.g. 0.05 for 5%)"),
    db: Session = Depends(get_db),
):
    """Aggregate factual historical decision outcomes across decisions, recommendations, predictions, scenarios, and time."""
    return DecisionPerformanceService.get_performance_overview(
        db=db,
        project_id=project_id,
        min_observations=min_observations,
        period=period,
        threshold=threshold,
    )


@router.get(
    "/projects/{project_id}/decision-performance/by-metric",
    response_model=List[MetricPerformanceItem],
    status_code=status.HTTP_200_OK,
    summary="Get outcome performance breakdown grouped by metric",
)
def get_performance_by_metric(
    project_id: str,
    min_observations: int = Query(3, ge=1),
    threshold: float = Query(0.05, gt=0.0),
    db: Session = Depends(get_db),
):
    """Retrieve decision outcome variance, match rates, and material deviations grouped by metric name."""
    return DecisionPerformanceService.get_metric_performance(
        db=db,
        project_id=project_id,
        min_observations=min_observations,
        threshold=threshold,
    )


@router.get(
    "/projects/{project_id}/decision-performance/trends",
    response_model=List[TrendPeriodItem],
    status_code=status.HTTP_200_OK,
    summary="Get chronological decision performance trends",
)
def get_performance_trends(
    project_id: str,
    period: str = Query("week", pattern="^(day|week|month)$"),
    min_observations: int = Query(3, ge=1),
    db: Session = Depends(get_db),
):
    """Retrieve chronological outcome performance aggregated by day, week, or month."""
    return DecisionPerformanceService.get_trend_performance(
        db=db,
        project_id=project_id,
        period=period,
        min_observations=min_observations,
    )


@router.get(
    "/projects/{project_id}/decision-performance/by-model",
    response_model=List[ModelPerformanceItem],
    status_code=status.HTTP_200_OK,
    summary="Get model-level performance for explicitly linked outcomes",
)
def get_performance_by_model(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Calculate MAE/MRE strictly for decision outcomes explicitly linked to an ML Analysis."""
    return DecisionPerformanceService.get_model_performance(
        db=db,
        project_id=project_id,
    )


@router.get(
    "/projects/{project_id}/decision-performance/by-scenario",
    response_model=List[ScenarioPerformanceItem],
    status_code=status.HTTP_200_OK,
    summary="Get outcome performance aggregated by scenario",
)
def get_performance_by_scenario(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Aggregate decision outcome variance across persisted scenario references."""
    return DecisionPerformanceService.get_scenario_performance(
        db=db,
        project_id=project_id,
    )
