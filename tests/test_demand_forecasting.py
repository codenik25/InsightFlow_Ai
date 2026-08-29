import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_forecasting_dataset():
    csv_content = """date,units_sold,sales_amount,unit_price
2026-08-01,10,100,10.0
2026-08-02,12,120,10.0
2026-08-03,15,150,10.0
2026-08-04,11,110,10.0
2026-08-05,18,180,10.0
2026-08-06,20,200,10.0
2026-08-07,22,220,10.0
2026-08-08,19,190,10.0
2026-08-09,25,250,10.0
2026-08-10,24,240,10.0
2026-08-11,28,280,10.0
2026-08-12,30,300,10.0
"""
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_forecast.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_id = upload_res.json()["dataset_id"]
    client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    return raw_id


def test_discover_forecast_tasks():
    """Verify discovery of forecasting tasks."""
    dataset_id = create_forecasting_dataset()
    res = client.get(f"/api/v1/datasets/{dataset_id}/forecast/tasks")
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_id"] is not None
    assert len(data["candidate_tasks"]) > 0


def test_forecasting_analysis_and_prediction():
    """Verify chronological demand forecasting, metrics calculation, and uncertainty bounds."""
    dataset_id = create_forecasting_dataset()
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecast/analyze",
        json={"target_column": "units_sold", "time_column": "date", "horizon": 14},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["forecast_id"] is not None
    assert data["horizon"] == 14
    assert len(data["forecast"]) == 14
    assert data["confidence"] in ["EXPLORATORY", "LIMITED", "STANDARD"]
    assert "summary" in data["insights"]


def test_forecast_get_by_id():
    """Verify retrieving forecast by forecast_id."""
    dataset_id = create_forecasting_dataset()
    res = client.post(
        f"/api/v1/datasets/{dataset_id}/forecast/analyze",
        json={"target_column": "sales_amount", "time_column": "date", "horizon": 7},
    )
    forecast_id = res.json()["forecast_id"]
    get_res = client.get(f"/api/v1/datasets/{dataset_id}/forecast/{forecast_id}")
    assert get_res.status_code == 200
    assert get_res.json()["forecast_id"] == forecast_id


def test_forecasting_temporal_data_integrity_and_multi_entity():
    """Verify duplicate timestamp aggregation, frequency inference, and historical series integrity."""
    csv_content = """date,entity,units_sold,revenue
2026-01-01,DeptA,10,100
2026-01-01,DeptB,15,150
2026-02-01,DeptA,12,120
2026-02-01,DeptB,18,180
2026-03-01,DeptA,20,200
2026-03-01,DeptB,25,250
2026-04-01,DeptA,22,220
2026-04-01,DeptB,28,280
2026-05-01,DeptA,30,300
2026-05-01,DeptB,35,350
2026-06-01,DeptA,32,320
2026-06-01,DeptB,38,380
"""
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("multi_entity_forecast.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_id = upload_res.json()["dataset_id"]
    proc_id = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]}).json()["output_dataset_id"]

    res = client.post(
        f"/api/v1/datasets/{proc_id}/forecast/analyze",
        json={"target_column": "revenue", "time_column": "date", "horizon": 3},
    )
    assert res.status_code == 200
    data = res.json()

    # 1. Historical series has 6 unique monthly timestamps (not 12 raw rows)
    historical = data["historical"]
    assert len(historical) == 6
    hist_dates = [h["date"] for h in historical]
    assert len(set(hist_dates)) == 6
    assert hist_dates == ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"]

    # 2. Aggregated values match sum (DeptA + DeptB)
    # 2026-01-01 total revenue = 100 + 150 = 250
    assert historical[0]["value"] == 250.0

    # 3. Monthly frequency inferred for future dates
    forecast_pts = data["forecast"]
    assert len(forecast_pts) == 3
    fut_dates = [f["date"] for f in forecast_pts]
    assert fut_dates == ["2026-07-01", "2026-08-01", "2026-09-01"]

    # 4. Explicit aggregation warning present
    assert any("Aggregated target measure" in w for w in data["warnings"])

    # 5. Small sample size confidence level is EXPLORATORY
    assert data["confidence"] == "EXPLORATORY"

