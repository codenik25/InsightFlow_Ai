"""Phase 13: Enterprise Decision Reporting & Audit API Endpoints.

Read-only, factual enterprise decision report generation for individual decisions
and project-level portfolios.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_reporting import (
    IndividualDecisionReportResponse,
    ProjectDecisionReportResponse,
)
from app.services.decision_report_service import DecisionReportService

router = APIRouter()


@router.get(
    "/decisions/{decision_id}/report",
    response_model=IndividualDecisionReportResponse,
    summary="Get Individual Enterprise Decision Report",
    description="Factual, read-only decision audit report linking provenance, evidence, governance, execution, outcomes, and learnings.",
)
def get_individual_decision_report(
    decision_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> IndividualDecisionReportResponse:
    """Generate an individual decision audit report."""
    report = DecisionReportService.get_decision_report(
        db=db,
        decision_id=decision_id,
        project_id=project_id,
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision '{decision_id}' not found",
        )
    return report


@router.get(
    "/projects/{project_id}/decision-report",
    response_model=ProjectDecisionReportResponse,
    summary="Get Project-Level Enterprise Decision Report",
    description="Comprehensive enterprise report aggregating decisions, governance posture, execution progress, outcomes, and learnings for a project.",
)
def get_project_decision_report(
    project_id: str,
    date_from: Optional[datetime] = Query(None, description="Optional start datetime filter"),
    date_to: Optional[datetime] = Query(None, description="Optional end datetime filter"),
    db: Session = Depends(get_db),
) -> ProjectDecisionReportResponse:
    """Generate a project-level decision audit report."""
    report = DecisionReportService.get_project_report(
        db=db,
        project_id=project_id,
        date_from=date_from,
        date_to=date_to,
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )
    return report
