import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ml_task_service import HAS_XGBOOST

client = TestClient(app)


def create_test_dataset():
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,East,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,West,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,East,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,South,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,West,10,1200,12000
1006,2026-08-06,Laptop C,Electronics,East,2,70000,140000
1007,2026-08-07,Monitor B,Electronics,South,4,18000,72000
1008,2026-08-08,Keyboard B,Accessories,East,6,3000,18000
1009,2026-08-09,Mouse B,Accessories,West,12,1500,18000
1010,2026-08-10,Desk A,Furniture,East,1,25000,25000
1011,2026-08-11,Chair A,Furniture,South,4,8000,32000
1012,2026-08-12,Desk B,Furniture,West,2,30000,60000
"""
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_xgboost.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_id = upload_res.json()["dataset_id"]
    client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    return raw_id


def test_xgboost_availability():
    """Verify XGBoost module detection flag."""
    assert HAS_XGBOOST is True


def test_xgboost_regression_candidate():
    """Verify XGBoost Regressor candidate inclusion in model benchmarking."""
    dataset_id = create_test_dataset()
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert res.status_code == 200
    data = res.json()
    cand_names = [c["model_name"] for c in data["candidate_models"]]
    assert "Dummy Regressor (Mean)" in cand_names
    assert "Linear Regression" in cand_names
    assert "Random Forest Regressor" in cand_names
    if HAS_XGBOOST:
        assert "XGBoost Regressor" in cand_names


def test_xgboost_classification_candidate():
    """Verify XGBoost Classifier candidate inclusion in classification benchmarking."""
    dataset_id = create_test_dataset()
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/ml/analyze",
        json={"task_type": "classification", "target_column": "category"},
    )
    assert res.status_code == 200
    data = res.json()
    cand_names = [c["model_name"] for c in data["candidate_models"]]
    assert "Dummy Classifier (Most Frequent)" in cand_names
    assert "Logistic Regression" in cand_names
    assert "Random Forest Classifier" in cand_names
    if HAS_XGBOOST:
        assert "XGBoost Classifier" in cand_names
