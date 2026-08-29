import io
import pytest
import numpy as np
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

HARDCORE_CSV = """patient_id,date,department,category,units_sold,unit_price,total_revenue,notes,status
101,2026-01-01,Cardiology,Inpatient,2,"$5,000","$10,000",patient admitted with mild chest pain,completed
102,2026-01-02,Neurology,Outpatient,1,"$12,500","$12,500",scheduled MRI scan follow-up,completed
103,2026-01-03,Orthopedics,Inpatient,3,"$3,200","$9,600",knee replacement consultation,pending
104,2026-01-04,Cardiology,Outpatient,1,"$1,500","$1,500",ECG routine checkup,completed
105,2026-01-05,Oncology,Inpatient,4,"$25,000","$100,000",chemotherapy session 1,completed
106,2026-01-06,Neurology,Outpatient,2,"$4,500","$9,000",N/A,completed
107,2026-01-07,Cardiology,Inpatient,1,N/A,invalid_val,patient requested extra blankets,cancelled
108,2026-01-08,Orthopedics,Outpatient,5,"$800","$4,000",physical therapy session,completed
109,2026-01-09,Oncology,Inpatient,2,"$20,000","$40,000",lab test bloodwork,completed
110,2026-01-10,Cardiology,Inpatient,3,"$5,000","$15,000",patient discharged home,completed
111,2026-01-11,Neurology,Outpatient,1,"$15,000","$15,000",EEG diagnostic scan,completed
112,2026-01-12,Orthopedics,Inpatient,2,"$6,000","$12,000",hip surgery follow-up,completed
113,2026-01-13,Cardiology,Outpatient,4,"$1,200","$4,800",blood pressure monitoring,completed
114,2026-01-14,Oncology,Outpatient,1,"$30,000","$30,000",consultation with specialist,completed
115,2026-01-15,Neurology,Inpatient,3,"$8,000","$24,000",patient recovering well,completed
101,2026-01-01,Cardiology,Inpatient,2,"$5,000","$10,000",patient admitted with mild chest pain,completed
"""


def test_hardcore_dataset_ml_analysis_pipeline():
    """Verify regression analysis on synthetic hardcore dataset with malformed numeric values, date handling, and free-text notes."""
    # 1. Upload hardcore dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hardcore_dataset.csv", io.BytesIO(HARDCORE_CSV.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_dataset_id = upload_res.json()["dataset_id"]

    # 2. Process dataset (cleaning operation)
    apply_res = client.post(
        f"/api/v1/datasets/{raw_dataset_id}/clean/apply",
        json={"dataset_id": raw_dataset_id, "operations": [{"type": "remove_duplicates"}]}
    )
    assert apply_res.status_code == 200
    proc_dataset_id = apply_res.json()["output_dataset_id"]

    # 3. Post regression analysis on hardcore dataset (with malformed revenue, notes, date)
    payload = {
        "task_type": "regression",
        "target_column": "total_revenue",
        "datetime_column": "date"
    }
    analyze_res = client.post(f"/api/v1/datasets/{proc_dataset_id}/ml/analyze", json=payload)
    assert analyze_res.status_code == 200, f"Analysis failed: {analyze_res.text}"
    
    data = analyze_res.json()
    
    # Assertions
    assert "id" in data
    analysis_id = data["id"]
    assert data["dataset_id"] == proc_dataset_id
    assert data["task_type"] == "regression"
    assert data["target_column"] == "total_revenue"
    assert data["status"] == "completed"

    # Verify notes is excluded from features
    feature_cols = data["feature_columns"]
    assert "notes" not in feature_cols, f"'notes' free-text column should be excluded from features, got {feature_cols}"
    assert "patient_id" not in feature_cols, f"'patient_id' identifier column should be excluded from features"
    
    # Verify notes feature summary status is excluded
    feature_summary = data["feature_summary"]
    notes_summary = [f for f in feature_summary if f["name"] == "notes"]
    assert len(notes_summary) == 1
    assert notes_summary[0]["status"] == "excluded"
    assert notes_summary[0]["role"] == "text"

    # Verify metrics are finite and meaningful
    metrics = data["metrics"]
    assert "rmse" in metrics and metrics["rmse"] is not None
    assert "mae" in metrics and metrics["mae"] is not None
    assert np.isfinite(metrics["rmse"])
    assert np.isfinite(metrics["mae"])

    # Verify artifact and DB persistence
    get_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/ml/{analysis_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == analysis_id


def test_invalid_task_configurations_controlled_4xx():
    """Verify that invalid task parameters return controlled 4xx error responses rather than 500 errors."""
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("mini.csv", io.BytesIO(HARDCORE_CSV.encode("utf-8")), "text/csv")},
    )
    raw_id = upload_res.json()["dataset_id"]
    apply_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]}
    )
    proc_id = apply_res.json()["output_dataset_id"]

    # 1. Non-existent target column -> 400 Bad Request
    res1 = client.post(f"/api/v1/datasets/{proc_id}/ml/analyze", json={"task_type": "regression", "target_column": "non_existent_col"})
    assert res1.status_code == 400
    assert "Target column 'non_existent_col' does not exist" in res1.json()["detail"]

    # 2. Non-existent datetime column -> 400 Bad Request
    res2 = client.post(f"/api/v1/datasets/{proc_id}/ml/analyze", json={"task_type": "regression", "target_column": "total_revenue", "datetime_column": "fake_date"})
    assert res2.status_code == 400
    assert "Datetime column 'fake_date' does not exist" in res2.json()["detail"]

    # 3. Invalid task type -> 400 Bad Request
    res3 = client.post(f"/api/v1/datasets/{proc_id}/ml/analyze", json={"task_type": "invalid_magic_task", "target_column": "total_revenue"})
    assert res3.status_code == 400
    assert "Unsupported task_type 'invalid_magic_task'" in res3.json()["detail"]
