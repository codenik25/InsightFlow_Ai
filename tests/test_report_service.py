import io
import pytest
from fastapi import UploadFile, HTTPException

from app.services.dataset_service import DatasetService
from app.services.cleaning_service import CleaningService
from app.services.eda_service import EDAService
from app.services.insight_service import InsightService
from app.services.report_service import ReportService
from app.schemas.cleaning import CleaningPlan, CleaningOperation


def test_executive_report_generation(db_session):
    """Tests end-to-end report generation, KPI integrity, highlights classification, deduplication, and export functions."""
    dirty_csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Delhi,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Delhi,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
1006,2026-08-06,Laptop A,Electronics,Delhi,1,55000,55000
1007,2026-08-07,Laptop C,Electronics,Mumbai,2,72000,144000
1008,2026-08-08,Monitor B,Electronics,Delhi,4,18000,72000
1009,2026-08-09,Keyboard B,Accessories,Delhi,6,3000,18000
1010,2026-08-10,Mouse B,Accessories,Mumbai,8,1500,12000
1011,2026-08-11,Laptop B,Electronics,Delhi,2,65000,130000
1012,2026-08-12,Monitor A,Electronics,Delhi,2,15000,30000
1013,2026-08-13,Laptop C,Electronics,Mumbai,1,72000,72000
1014,2026-08-14,Keyboard A,Accessories,Mumbai,4,2500,10000
1015,2026-08-15,Mouse A,Accessories,Delhi,12,1200,14400
1015,2026-08-15,Mouse A,Accessories,Delhi,12,1200,14400
1016,2026-08-16,Laptop D,Electronics,Delhi,,58000,
1017,2026-08-17,Laptop E,Electronics,,2,60000,120000
1018,2026-08-18,Monitor C,Electronics,Delhi,3,,45000
"""
    file_obj = UploadFile(
        filename="test_phase1_dirty.csv",
        file=io.BytesIO(dirty_csv_content.encode("utf-8")),
    )

    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_id = profile.dataset_id
    raw_dataset = DatasetService.get_dataset_by_id(db_session, raw_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    # 1. Unprocessed raw dataset MUST raise 400 Bad Request
    with pytest.raises(HTTPException) as exc_info:
        ReportService.generate_executive_report(db_session, raw_id)
    assert exc_info.value.status_code == 400
    assert "requires a processed dataset" in exc_info.value.detail

    # 2. Apply cleaning plan to create processed child dataset
    plan = CleaningPlan(
        dataset_id=raw_id,
        operations=[
            CleaningOperation(type="remove_duplicates"),
            CleaningOperation(type="fill_missing", column="region", strategy="mode"),
            CleaningOperation(type="fill_missing", column="unit_price", strategy="median"),
            CleaningOperation(type="fill_missing", column="units_sold", strategy="median"),
            CleaningOperation(type="fill_missing", column="total_revenue", strategy="median"),
        ]
    )
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)
    proc_id = apply_res.output_dataset_id

    # 3. Generating report on raw_id automatically resolves to proc_id
    report = ReportService.generate_executive_report(db_session, raw_id)
    assert report.dataset_id == proc_id
    assert report.raw_dataset_id == raw_id
    assert report.source_dataset_name == "test_phase1_dirty.csv"

    # 4. Verify quality score & row count
    assert report.quality_score == 100.0
    assert report.total_rows == 18
    assert report.total_columns == 8

    # 5. Verify distinct executive KPI selection & metric integrity
    kpi_names = [k.name for k in report.key_kpis]
    assert "Total Revenue" in kpi_names
    assert "Total Units Sold" in kpi_names
    assert "Average Unit Price" in kpi_names
    assert "Total Unit Price" not in kpi_names

    price_kpi = next(k for k in report.key_kpis if k.name == "Average Unit Price")
    assert price_kpi.aggregation == "mean"
    assert price_kpi.nature == "price_rate"

    rev_kpi = next(k for k in report.key_kpis if k.name == "Total Revenue")
    assert rev_kpi.aggregation == "sum"
    assert rev_kpi.nature == "amount_value"

    # 6. Verify metric label duplication prevention in executive narrative
    narrative = report.executive_narrative
    assert "total Total" not in narrative
    assert "average Average" not in narrative
    assert "total Total Revenue" not in narrative
    assert "average Average Unit Price" not in narrative

    # 7. Verify strategic action deduplication & natural phrasing
    assert len(report.strategic_actions) <= 3
    action_titles = [act.title for act in report.strategic_actions]
    assert len(action_titles) == len(set(action_titles))

    # Verify every strategic action references a valid source_insight_id
    for act in report.strategic_actions:
        assert act.source_insight_id is not None
        assert len(act.source_insight_id) > 0
        assert "Electronics's" not in act.recommendation
        assert "Accessories's" not in act.recommendation

    # Verify 3 distinct strategic concerns are captured: Data Quality, Diversification, Performance
    assert any("Protect Data Quality" in t for t in action_titles)
    assert any("Diversify" in t for t in action_titles)
    assert any("Optimize" in t for t in action_titles)

    # 8. Verify Phase 4 insight count integrity
    persisted_insights = InsightService.get_insights(db_session, proc_id).insights
    assert report.total_insights_analyzed == len(persisted_insights)

    # 9. Verify Markdown Export & possessive sanitization
    md_text = ReportService.export_report_markdown(report)
    assert "# Executive Summary Report" in md_text
    assert "## Dataset Overview" in md_text
    assert "## Executive KPIs" in md_text
    assert "## Executive Summary" in md_text
    assert "## Key Achievements" in md_text
    assert "## Critical Risks" in md_text
    assert "## Strategic Actions" in md_text
    assert "Electronics's" not in md_text
    assert "Accessories's" not in md_text
