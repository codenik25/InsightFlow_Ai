import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_anomaly_dataset():
    csv_content = """units_sold,unit_price,total_revenue
10,100,1000
12,100,1200
11,100,1100
10,100,1000
15,100,1500
1000,9999,9999000
10,100,1000
11,100,1100
12,100,1200
"""
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_anomaly.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_id = upload_res.json()["dataset_id"]
    client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    return raw_id


def test_anomaly_analysis_execution():
    """Verify Isolation Forest anomaly detection API execution, score bounds, severity, and attribution."""
    dataset_id = create_anomaly_dataset()
    res = client.post(f"/api/v1/datasets/{dataset_id}/anomaly/analyze")
    assert res.status_code == 200
    data = res.json()

    assert data["anomaly_id"] is not None
    assert data["total_observations"] > 0
    assert data["anomaly_count"] >= 1
    assert len(data["anomalies"]) > 0

    for item in data["anomalies"]:
        assert 0.0 <= item["anomaly_score"] <= 1.0
        assert item["status"] in ["ANOMALOUS", "NORMAL"]
        assert item["severity"] in ["LOW", "MEDIUM", "HIGH"]
        assert item["explanation"] != ""


def test_anomaly_get_and_list():
    """Verify listing and retrieving anomaly results by dataset and ID."""
    dataset_id = create_anomaly_dataset()
    analyze_res = client.post(f"/api/v1/datasets/{dataset_id}/anomaly/analyze")
    anomaly_id = analyze_res.json()["anomaly_id"]

    list_res = client.get(f"/api/v1/datasets/{dataset_id}/anomaly")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    get_res = client.get(f"/api/v1/datasets/{dataset_id}/anomaly/{anomaly_id}")
    assert get_res.status_code == 200
    assert get_res.json()["anomaly_id"] == anomaly_id


def test_anomaly_edge_cases_and_validation():
    """Verify non-numeric feature handling, contamination parameter validation, and cross-dataset isolation."""
    dataset_id = create_anomaly_dataset()

    # 1. Non-numeric feature filtering (returns 400 Bad Request if no valid numeric feature left)
    res_non_num = client.post(
        f"/api/v1/datasets/{dataset_id}/anomaly/analyze",
        json={"feature_columns": ["non_existent_column"]}
    )
    assert res_non_num.status_code == 400
    assert "no valid numeric feature columns" in res_non_num.json()["detail"]

    # 2. Invalid contamination parameter (returns 400 Bad Request)
    res_invalid_contam = client.post(
        f"/api/v1/datasets/{dataset_id}/anomaly/analyze",
        json={"contamination": 0.95}
    )
    assert res_invalid_contam.status_code == 400
    assert "Contamination parameter" in res_invalid_contam.json()["detail"]

    # 3. Cross-dataset isolation (returns 404 for invalid anomaly_id or dataset mismatch)
    res_bad_get = client.get(f"/api/v1/datasets/{dataset_id}/anomaly/invalid-anomaly-id")
    assert res_bad_get.status_code == 404

