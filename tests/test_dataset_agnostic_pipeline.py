import io
import pytest
import pandas as pd
from fastapi import UploadFile, HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.type_detector import TypeDetector
from app.services.dataset_service import DatasetService
from app.services.cleaning_service import CleaningService
from app.services.eda_service import EDAService
from app.services.insight_service import InsightService
from app.services.report_service import ReportService
from app.services.forecasting_service import ForecastingService
from app.services.quality_service import QualityService
from app.services.metric_discovery_service import MetricDiscoveryService
from app.schemas.cleaning import CleaningPlan, CleaningOperation

client = TestClient(app)


def test_type_detector_free_text_and_null_like_normalization():
    """Verify free-text keyword detection, narrative string length detection, and null-like string helpers."""
    # 1. Null-like string detection
    assert TypeDetector.is_null_like("Unknown") is True
    assert TypeDetector.is_null_like("N/A") is True
    assert TypeDetector.is_null_like("na") is True
    assert TypeDetector.is_null_like("None") is True
    assert TypeDetector.is_null_like("missing") is True
    assert TypeDetector.is_null_like("blank") is True
    assert TypeDetector.is_null_like("Delhi") is False

    # 2. Free-text detection by keyword & length
    series_notes = pd.Series(["Long narrative description of item #1", "Customer expressed concern regarding shipping delay", "Custom special request notes"])
    assert TypeDetector.detect_column_type(series_notes, "notes") == "text"
    assert TypeDetector.detect_column_type(series_notes, "comments") == "text"

    # 3. Categorical detection
    series_region = pd.Series(["Delhi", "Mumbai", "Jaipur", "Delhi", "Mumbai"])
    assert TypeDetector.detect_column_type(series_region, "region") == "categorical"


def test_dataset_agnostic_pipeline_arbitrary_schema(db_session):
    """Verify pipeline execution on synthetic dataset with arbitrary column names, free-text, and null-like values."""
    csv_content = """alpha_id,beta_category,gamma_volume,delta_rate,epsilon_notes
101,Electronics,100,0.85,Detailed narrative log for transaction 101 regarding shipment verification.
102,Accessories,150,0.90,Detailed narrative log for transaction 102 regarding customer inquiry.
103,Electronics,120,0.88,Detailed narrative log for transaction 103 regarding inventory tracking.
104,Unknown,200,0.92,Detailed narrative log for transaction 104 regarding quality check.
105,N/A,180,0.80,Detailed narrative log for transaction 105 regarding return processing.
106,Accessories,140,0.91,Detailed narrative log for transaction 106 regarding warranty claims.
107,Electronics,110,0.87,Detailed narrative log for transaction 107 regarding regional supply.
108,missing,130,0.89,Detailed narrative log for transaction 108 regarding audit notes.
"""
    file_obj = UploadFile(
        filename="arbitrary_schema_dataset.csv",
        file=io.BytesIO(csv_content.encode("utf-8")),
    )

    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_id = profile.dataset_id
    raw_dataset = DatasetService.get_dataset_by_id(db_session, raw_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    # Apply cleaning plan
    plan = CleaningPlan(
        dataset_id=raw_id,
        operations=[CleaningOperation(type="remove_duplicates")]
    )
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)
    proc_id = apply_res.output_dataset_id

    # 1. Verify Column Roles
    proc_dataset = DatasetService.get_dataset_by_id(db_session, proc_id)
    proc_df = DatasetService.load_dataset_dataframe(proc_dataset)
    roles = MetricDiscoveryService.discover_column_roles(proc_df)
    role_map = {r.column: r.role for r in roles}

    assert role_map["alpha_id"] == "identifier"
    assert role_map["beta_category"] == "categorical_dimension"
    assert role_map["gamma_volume"] == "measure"
    assert role_map["delta_rate"] == "measure"
    assert role_map["epsilon_notes"] == "text"

    # 2. Verify EDA Generation & Free-Text / Null-Like Category Filtering
    eda = EDAService.generate_eda(db_session, proc_id)
    assert eda is not None

    # Check category breakdowns exclude free-text column 'epsilon_notes'
    breakdown_dims = [b.dimension for b in eda.category_breakdowns]
    assert "epsilon_notes" not in breakdown_dims

    # Check category breakdowns exclude null-like categories ('Unknown', 'N/A', 'missing')
    for b in eda.category_breakdowns:
        for g in b.grouped_data:
            assert g.category_value not in ["Unknown", "N/A", "missing", "None", "null"]

    # 3. Verify Insight Generation
    insights_res = InsightService.generate_insights(db_session, proc_id)
    assert len(insights_res.insights) > 0

    for ins in insights_res.insights:
        if ins.affected_entity:
            assert ins.affected_entity not in ["Unknown", "N/A", "missing", "None", "null"]

    # 4. Verify Executive Report Generation
    report = ReportService.generate_executive_report(db_session, proc_id)
    assert report.total_rows == 8
    assert report.total_columns == 5


def test_dataset_agnostic_pipeline_missing_date_column(db_session):
    """Verify forecasting and EDA behavior when dataset lacks a temporal date column."""
    no_date_csv = """item_code,department_name,total_sales,cost_per_item
SKU101,Sales,5000,25.5
SKU102,Marketing,3000,15.0
SKU103,Sales,6000,30.0
SKU104,Engineering,8000,45.0
SKU105,Marketing,4000,20.0
"""
    file_obj = UploadFile(
        filename="no_date_dataset.csv",
        file=io.BytesIO(no_date_csv.encode("utf-8")),
    )

    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_id = profile.dataset_id
    raw_dataset = DatasetService.get_dataset_by_id(db_session, raw_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(
        dataset_id=raw_id,
        operations=[CleaningOperation(type="remove_duplicates")]
    )
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)
    proc_id = apply_res.output_dataset_id

    # 1. Forecasting Discovery on missing date dataset returns 0 candidate tasks with explicit message
    disc = ForecastingService.discover_forecast_tasks(db_session, proc_id)
    assert len(disc.candidate_tasks) == 0
    assert "No suitable time-series forecasting configuration" in disc.message

    # 2. Forecasting analysis handles missing date gracefully with HTTP 400 Bad Request
    with pytest.raises(HTTPException) as exc_info:
        ForecastingService.analyze_and_forecast(db_session, proc_id)
    assert exc_info.value.status_code == 400
    assert "not suitable for time-series demand forecasting" in exc_info.value.detail

    # 3. EDA & Insights execute cleanly without throwing exceptions
    eda = EDAService.generate_eda(db_session, proc_id)
    assert len(eda.trends) == 0  # 0 trend metrics

    insights = InsightService.generate_insights(db_session, proc_id)
    assert len(insights.insights) > 0
