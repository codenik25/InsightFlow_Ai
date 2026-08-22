import json
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.report import ExecutiveReport
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/{dataset_id}/reports/executive", response_model=ExecutiveReport)
def get_executive_report(dataset_id: str, db: Session = Depends(get_db)):
    """Generates or retrieves the deterministic Executive Report for a dataset."""
    return ReportService.generate_executive_report(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/reports/export")
def export_report_markdown(dataset_id: str, db: Session = Depends(get_db)):
    """Exports the Executive Report as a downloadable GitHub-Flavored Markdown file."""
    report = ReportService.generate_executive_report(db=db, dataset_id=dataset_id)
    md_content = ReportService.export_report_markdown(report)
    filename = f"{report.dataset_name.replace('.csv', '')}_executive_report.md"
    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{dataset_id}/reports/export/json")
def export_report_json(dataset_id: str, db: Session = Depends(get_db)):
    """Exports the Executive Report as a downloadable JSON file."""
    report = ReportService.generate_executive_report(db=db, dataset_id=dataset_id)
    json_content = report.model_dump_json(indent=2)
    filename = f"{report.dataset_name.replace('.csv', '')}_executive_report.json"
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
