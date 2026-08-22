from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.insight import InsightResponse
from app.services.insight_service import InsightService

router = APIRouter()


@router.get("/{dataset_id}/insights", response_model=InsightResponse)
def get_dataset_insights(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> InsightResponse:
    """Retrieve evidence-backed business insights for a dataset (resolved to processed dataset)."""
    return InsightService.get_insights(db=db, dataset_id=dataset_id)


@router.post("/{dataset_id}/insights/generate", response_model=InsightResponse)
def generate_dataset_insights(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> InsightResponse:
    """Generate or recalculate evidence-backed business insights for a dataset."""
    return InsightService.generate_insights(db=db, dataset_id=dataset_id)
