import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

DATASET_CANONICAL_CSV = """id,department,staff_count,average_bill,occupancy_rate,total_revenue
1,General Medicine,50,4000.0,0.80,200000.0
2,General Medicine,52,4200.0,0.82,218400.0
3,Surgery,48,4100.0,0.78,196800.0
4,Surgery,54,4300.0,0.84,232200.0
5,Emergency,45,3900.0,0.76,175500.0
6,Emergency,55,4400.0,0.85,242000.0
7,Pediatrics,46,3950.0,0.77,181700.0
8,Pediatrics,53,4250.0,0.83,225250.0
9,Cardiology,47,4050.0,0.79,190350.0
10,Cardiology,56,4450.0,0.86,249200.0
"""

DATASET_ISOLATION_CSV = """id,region,headcount,marketing_spend,revenue
1,North,10,5000,50000
2,North,12,5200,52000
3,South,8,4800,48000
4,South,14,5400,54000
5,East,9,4900,49000
6,East,15,5500,55000
7,West,11,5100,51000
8,West,13,5300,53000
9,North,10,5000,50000
10,South,12,5200,52000
"""


def _prepare_processed_dataset(csv_str: str, filename: str) -> str:
    """Helper to upload and clean raw dataset into processed dataset."""
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": (filename, io.BytesIO(csv_str.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    return c_res.json()["output_dataset_id"]


def test_what_if_scenario_agrees_with_optimization_baseline():
    """Verify What If Scenario baseline and feature contribution baseline match Optimization baseline."""
    proc_id = _prepare_processed_dataset(DATASET_CANONICAL_CSV, "canonical_ds.csv")

    # ML Analysis
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert ml_res.status_code == 200
    ml_id = ml_res.json()["id"]

    # Run Optimization
    opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize"},
    )
    assert opt_res.status_code == 200
    opt_data = opt_res.json()
    opt_baseline_pred = opt_data["baseline_prediction"]
    opt_baseline_inputs = opt_data["baseline_inputs"]

    # Run What If Scenario
    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={
            "name": "Test Baseline Alignment",
            "ml_analysis_id": ml_id,
            "feature_changes": {"average_bill": 4946.015},
        },
    )
    assert scen_res.status_code == 200
    scen_data = scen_res.json()

    # 1. Base value check
    assert abs(scen_data["base_value"] - opt_baseline_pred) < 1e-3

    # 2. Feature contribution baseline check
    contribs = scen_data["feature_contributions"]
    assert "average_bill" in contribs
    assert abs(float(contribs["average_bill"]["baseline_value"]) - float(opt_baseline_inputs["average_bill"])) < 1e-3

    # 3. Math consistency check
    expected_delta = round(scen_data["predicted_outcome"] - scen_data["base_value"], 4)
    assert abs(scen_data["predicted_delta"] - expected_delta) < 1e-3


def test_what_if_scenario_multiple_features_and_categorical():
    """Verify numeric and categorical feature changes work together correctly."""
    proc_id = _prepare_processed_dataset(DATASET_CANONICAL_CSV, "canonical_ds_multi.csv")

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    ml_id = ml_res.json()["id"]

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={
            "name": "Multi Feature & Categorical Shift",
            "ml_analysis_id": ml_id,
            "feature_changes": {"average_bill": 4500.0, "department": "Surgery"},
        },
    )
    assert scen_res.status_code == 200
    scen_data = scen_res.json()

    contribs = scen_data["feature_contributions"]
    assert contribs["department"]["scenario_value"] == "Surgery"
    assert contribs["department"]["changed"] is True or contribs["department"]["scenario_value"] != contribs["department"]["baseline_value"]
    assert contribs["average_bill"]["scenario_value"] == 4500.0
    assert contribs["average_bill"]["changed"] is True


def test_what_if_scenario_invalid_feature_name_returns_400():
    """Verify unknown feature names trigger HTTP 400 Bad Request."""
    proc_id = _prepare_processed_dataset(DATASET_CANONICAL_CSV, "canonical_ds_invalid.csv")

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    ml_id = ml_res.json()["id"]

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={
            "name": "Invalid Feature Scenario",
            "ml_analysis_id": ml_id,
            "feature_changes": {"non_existent_column_xyz": 123.45},
        },
    )
    assert scen_res.status_code == 400
    assert "Unknown feature" in scen_res.json()["detail"]


def test_what_if_scenario_arbitrary_schema_and_isolation():
    """Verify arbitrary schemas work cleanly and two datasets remain isolated."""
    proc_id_a = _prepare_processed_dataset(DATASET_CANONICAL_CSV, "ds_schema_a.csv")
    proc_id_b = _prepare_processed_dataset(DATASET_ISOLATION_CSV, "ds_schema_b.csv")

    # Dataset A ML & Scenario
    ml_a = client.post(f"/api/v1/datasets/{proc_id_a}/ml/analyze", json={"task_type": "regression", "target_column": "total_revenue"}).json()["id"]
    scen_a = client.post(
        f"/api/v1/datasets/{proc_id_a}/decision/scenarios",
        json={"name": "A Scenario", "ml_analysis_id": ml_a, "feature_changes": {"staff_count": 60}},
    ).json()

    # Dataset B ML & Scenario
    ml_b = client.post(f"/api/v1/datasets/{proc_id_b}/ml/analyze", json={"task_type": "regression", "target_column": "revenue"}).json()["id"]
    scen_b = client.post(
        f"/api/v1/datasets/{proc_id_b}/decision/scenarios",
        json={"name": "B Scenario", "ml_analysis_id": ml_b, "feature_changes": {"headcount": 20}},
    ).json()

    assert scen_a["dataset_id"] == proc_id_a
    assert scen_b["dataset_id"] == proc_id_b
    assert scen_a["id"] != scen_b["id"]
    assert "staff_count" in scen_a["feature_contributions"]
    assert "headcount" in scen_b["feature_contributions"]
    assert "headcount" not in scen_a["feature_contributions"]
    assert "staff_count" not in scen_b["feature_contributions"]
