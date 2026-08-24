from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.command_center import DecisionCommandCenterResponse
from app.services.command_center_service import DecisionCommandCenterService

router = APIRouter()


@router.get(
    "/{dataset_id}/decision/command-center",
    response_model=DecisionCommandCenterResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve unified Decision Intelligence Command Center aggregation",
)
def get_decision_command_center(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve unified executive decision command center view aggregating Phase 4–7.4 analytical outputs."""
    return DecisionCommandCenterService.get_command_center(
        db=db,
        dataset_id=dataset_id,
    )
