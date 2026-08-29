from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.anomaly import (
    AnomalyAnalyzeRequest,
    AnomalyAnalysisResponse,
)
from app.services.anomaly_service import AnomalyService

router = APIRouter()


@router.post(
    "/datasets/{dataset_id}/anomaly/analyze",
    response_model=AnomalyAnalysisResponse,
    summary="Run Isolation Forest anomaly intelligence pipeline",
)
def run_anomaly_analysis(
    dataset_id: str,
    body: Optional[AnomalyAnalyzeRequest] = None,
    db: Session = Depends(get_db),
):
    feature_cols = body.feature_columns if body else None
    contam = body.contamination if body else None
    return AnomalyService.analyze_anomalies(
        db=db,
        dataset_id=dataset_id,
        feature_columns=feature_cols,
        contamination=contam,
    )


@router.get(
    "/datasets/{dataset_id}/anomaly",
    response_model=List[AnomalyAnalysisResponse],
    summary="List stored anomaly analyses for a dataset",
)
def get_anomalies_for_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    results = AnomalyService.get_anomalies_for_dataset(db=db, dataset_id=dataset_id)
    if not results:
        # Auto-run analysis if none found
        return [AnomalyService.analyze_anomalies(db=db, dataset_id=dataset_id)]
    return results


@router.get(
    "/datasets/{dataset_id}/anomaly/{anomaly_id}",
    response_model=AnomalyAnalysisResponse,
    summary="Retrieve single anomaly analysis by ID",
)
def get_anomaly_by_id(
    dataset_id: str,
    anomaly_id: str,
    db: Session = Depends(get_db),
):
    return AnomalyService.get_anomaly_by_id(db=db, dataset_id=dataset_id, anomaly_id=anomaly_id)
