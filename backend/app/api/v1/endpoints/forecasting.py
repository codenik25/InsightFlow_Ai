from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.forecast import (
    ForecastTaskDiscoveryResponse,
    ForecastAnalyzeRequest,
    ForecastPredictRequest,
    ForecastAnalysisResponse,
)
from app.services.forecasting_service import ForecastingService

router = APIRouter()


@router.get(
    "/datasets/{dataset_id}/forecast/tasks",
    response_model=ForecastTaskDiscoveryResponse,
    summary="Discover viable time-series demand forecasting tasks",
)
def discover_forecast_tasks(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    return ForecastingService.discover_forecast_tasks(db=db, dataset_id=dataset_id)


@router.post(
    "/datasets/{dataset_id}/forecast/analyze",
    response_model=ForecastAnalysisResponse,
    summary="Train demand forecasting model and generate forecast horizon",
)
def run_forecast_analysis(
    dataset_id: str,
    body: Optional[ForecastAnalyzeRequest] = None,
    db: Session = Depends(get_db),
):
    target_col = body.target_column if body else None
    time_col = body.time_column if body else None
    horizon = body.horizon if body and body.horizon else 30

    return ForecastingService.analyze_and_forecast(
        db=db,
        dataset_id=dataset_id,
        target_column=target_col,
        time_column=time_col,
        horizon=horizon,
    )


@router.post(
    "/datasets/{dataset_id}/forecast/predict",
    response_model=ForecastAnalysisResponse,
    summary="Generate future forecast horizon for existing or default configuration",
)
def run_forecast_predict(
    dataset_id: str,
    body: Optional[ForecastPredictRequest] = None,
    db: Session = Depends(get_db),
):
    horizon = body.horizon if body else 30
    return ForecastingService.analyze_and_forecast(
        db=db,
        dataset_id=dataset_id,
        horizon=horizon,
    )


@router.get(
    "/datasets/{dataset_id}/forecast/{forecast_id}",
    response_model=ForecastAnalysisResponse,
    summary="Retrieve saved forecast analysis by ID",
)
def get_forecast_by_id(
    dataset_id: str,
    forecast_id: str,
    db: Session = Depends(get_db),
):
    return ForecastingService.get_forecast_by_id(db=db, dataset_id=dataset_id, forecast_id=forecast_id)
