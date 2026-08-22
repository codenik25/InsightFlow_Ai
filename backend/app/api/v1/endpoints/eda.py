from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.eda import EDAResponse, TrendMetric, RelationshipMetric
from app.schemas.kpi import KPIMetric
from app.services.eda_service import EDAService

router = APIRouter()


@router.post("/{dataset_id}/eda", response_model=EDAResponse)
def generate_dataset_eda(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> EDAResponse:
    """Generate or recalculate automated EDA analysis & KPIs for a dataset."""
    return EDAService.generate_eda(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/eda", response_model=EDAResponse)
def get_dataset_eda(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> EDAResponse:
    """Retrieve stored EDA analysis result for a dataset."""
    return EDAService.get_eda(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/kpis", response_model=List[KPIMetric])
def get_dataset_kpis(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[KPIMetric]:
    """Retrieve auto-discovered Key Performance Indicators (KPIs) for a dataset."""
    eda = EDAService.get_eda(db=db, dataset_id=dataset_id)
    return eda.discovered_kpis


@router.get("/{dataset_id}/trends", response_model=List[TrendMetric])
def get_dataset_trends(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[TrendMetric]:
    """Retrieve time-based trends for a dataset when datetime columns are present."""
    eda = EDAService.get_eda(db=db, dataset_id=dataset_id)
    return eda.trends


@router.get("/{dataset_id}/relationships", response_model=List[RelationshipMetric])
def get_dataset_relationships(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[RelationshipMetric]:
    """Retrieve Pearson correlation relationships between numeric measure columns."""
    eda = EDAService.get_eda(db=db, dataset_id=dataset_id)
    return eda.relationships
