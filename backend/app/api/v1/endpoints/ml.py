from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.ml import (
    MLTaskDiscoveryResponse,
    MLAnalysisRequest,
    MLAnalysisResponse,
    PredictionRequest,
    PredictionResponse,
)
from app.services.eda_service import EDAService
from app.services.dataset_service import DatasetService
from app.services.ml_task_service import MLTaskService

router = APIRouter()


@router.get("/{dataset_id}/ml/tasks", response_model=MLTaskDiscoveryResponse)
def get_ml_task_candidates(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> MLTaskDiscoveryResponse:
    """
    Discover candidate ML tasks for a resolved processed dataset.
    Requires dataset cleaning to be completed first (returns 400 if unprocessed raw dataset).
    """
    target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
    df = DatasetService.load_dataset_dataframe(target_dataset)
    response = MLTaskService.discover_tasks(df)
    response.dataset_id = target_dataset.id
    return response


@router.post("/{dataset_id}/ml/analyze", response_model=MLAnalysisResponse)
def run_ml_analysis(
    dataset_id: str,
    payload: Optional[MLAnalysisRequest] = None,
    db: Session = Depends(get_db),
) -> MLAnalysisResponse:
    """
    Execute ML task analysis, feature selection, baseline model evaluation, artifact persistence, and model selection.
    """
    task_type = payload.task_type if payload else None
    target_column = payload.target_column if payload else None

    return MLTaskService.run_analysis(
        db=db, dataset_id=dataset_id, task_type=task_type, target_column=target_column
    )


@router.get("/{dataset_id}/ml", response_model=List[MLAnalysisResponse])
def list_ml_analyses(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[MLAnalysisResponse]:
    """Retrieve all previous ML analyses for a dataset."""
    return MLTaskService.get_analyses_for_dataset(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/ml/{analysis_id}", response_model=MLAnalysisResponse)
def get_ml_analysis_details(
    dataset_id: str,
    analysis_id: str,
    db: Session = Depends(get_db),
) -> MLAnalysisResponse:
    """Retrieve detailed model analysis results by analysis_id."""
    return MLTaskService.get_analysis_by_id(db=db, dataset_id=dataset_id, analysis_id=analysis_id)


@router.post("/{dataset_id}/ml/{analysis_id}/predict", response_model=PredictionResponse)
def run_ml_prediction(
    dataset_id: str,
    analysis_id: str,
    payload: PredictionRequest,
    db: Session = Depends(get_db),
) -> PredictionResponse:
    """
    Run prediction on user-supplied feature input records using stored trained model artifact.
    Does NOT refit the model during inference.
    """
    if not payload.inputs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prediction inputs cannot be empty.",
        )

    return MLTaskService.predict(
        db=db, dataset_id=dataset_id, analysis_id=analysis_id, inputs=payload.inputs
    )
