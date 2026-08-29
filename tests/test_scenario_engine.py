import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def setup_processed_dataset_with_ml():
    """Helper fixture to upload dataset, clean it, run ML regression analysis, and return dataset_id and analysis_id."""
    csv_content = """patient_visits,staff_count,occupancy_rate,average_bill,total_revenue
500,20,0.85,1500,750000
520,21,0.88,1550,806000
510,19,0.82,1480,754800
530,22,0.90,1600,848000
490,18,0.80,1450,710500
540,23,0.92,1620,874800
515,20,0.86,1510,777650
525,21,0.87,1530,803250
505,19,0.84,1490,752450
535,22,0.89,1580,845300
    """
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_hospital.csv", io.BytesIO(csv_content.strip().encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_id = upload_res.json()["dataset_id"]

    clean_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    assert clean_res.status_code == 200
    proc_id = clean_res.json()["output_dataset_id"]

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert ml_res.status_code == 200
    analysis_id = ml_res.json()["id"]

    return proc_id, analysis_id


def test_scenario_feature_changes_application(setup_processed_dataset_with_ml):
    """Prove that requested feature changes are actually applied and recompute prediction & delta."""
    proc_id, analysis_id = setup_processed_dataset_with_ml

    payload = {
        "name": "Hospital Capacity Simulation",
        "description": "Simulating patient visits and staff count increase",
        "ml_analysis_id": analysis_id,
        "feature_changes": {
            "patient_visits": 650,
            "staff_count": 25,
        },
    }

    res = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["name"] == "Hospital Capacity Simulation"
    assert data["feature_changes"] == {"patient_visits": 650.0, "staff_count": 25.0}

    # Verify feature contributions indicate changed=True for requested features
    contributions = data["feature_contributions"]
    assert "patient_visits" in contributions
    assert contributions["patient_visits"]["changed"] is True
    assert contributions["patient_visits"]["scenario_value"] == 650.0

    assert "staff_count" in contributions
    assert contributions["staff_count"]["changed"] is True
    assert contributions["staff_count"]["scenario_value"] == 25.0

    # Unchanged feature should have changed=False
    assert contributions["occupancy_rate"]["changed"] is False

    # Verify predicted_delta is non-zero
    assert data["predicted_delta"] != 0.0
    assert data["predicted_outcome"] != data["base_value"]


def test_scenario_nested_wrapper_structure(setup_processed_dataset_with_ml):
    """Prove that nested wrapper payloads are unwrapped correctly and features are applied."""
    proc_id, analysis_id = setup_processed_dataset_with_ml

    nested_payload = {
        "feature_changes": {
            "name": "Nested Hospital Scenario",
            "description": "Nested wrapper simulation",
            "feature_changes": {
                "patient_visits": 650,
                "staff_count": 25,
            },
        }
    }

    res = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=nested_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["name"] == "Nested Hospital Scenario"
    assert data["feature_changes"] == {"patient_visits": 650.0, "staff_count": 25.0}

    contributions = data["feature_contributions"]
    assert contributions["patient_visits"]["changed"] is True
    assert contributions["patient_visits"]["scenario_value"] == 650.0
    assert contributions["staff_count"]["changed"] is True
    assert contributions["staff_count"]["scenario_value"] == 25.0
    assert data["predicted_delta"] != 0.0


def test_scenario_comparison_matching_persisted_results(setup_processed_dataset_with_ml):
    """Prove that comparison endpoint matches created scenario predictions, deltas, and changed features."""
    proc_id, analysis_id = setup_processed_dataset_with_ml

    nested_payload = {
        "feature_changes": {
            "name": "Comparison Test Scenario",
            "description": "Nested comparison simulation",
            "feature_changes": {
                "patient_visits": 650,
                "staff_count": 25,
            },
        }
    }

    create_res = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=nested_payload)
    assert create_res.status_code == 200
    sc_data = create_res.json()
    scenario_id = sc_data["id"]

    # Call Scenario Comparison Endpoint
    comp_res = client.get(f"/api/v1/datasets/{proc_id}/decision/scenarios/{scenario_id}/compare")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()

    assert comp_data["scenario_name"] == "Comparison Test Scenario"
    assert comp_data["scenario_prediction"] == sc_data["predicted_outcome"]
    assert comp_data["baseline_prediction"] == sc_data["base_value"]
    assert comp_data["predicted_delta"] == sc_data["predicted_delta"]
    assert comp_data["predicted_delta_percentage"] == sc_data["predicted_delta_percentage"]

    # Verify scenario changes & contributions match creation output exactly
    assert comp_data["scenario_changes"] == {"patient_visits": 650.0, "staff_count": 25.0}
    
    comp_contribs = comp_data["feature_contributions"]
    assert comp_contribs["patient_visits"]["changed"] is True
    assert comp_contribs["patient_visits"]["scenario_value"] == 650.0
    assert comp_contribs["staff_count"]["changed"] is True
    assert comp_contribs["staff_count"]["scenario_value"] == 25.0
    assert comp_contribs["occupancy_rate"]["changed"] is False


def test_scenario_unknown_features_validation(setup_processed_dataset_with_ml):
    """Verify that specifying unknown feature names raises HTTP 400 Bad Request."""
    proc_id, analysis_id = setup_processed_dataset_with_ml

    payload = {
        "name": "Invalid Feature Scenario",
        "feature_changes": {
            "patient_visits": 650,
            "non_existent_column": 100,
        },
    }

    res = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=payload)
    assert res.status_code == 400
    assert "Unknown feature" in res.json()["detail"]


def test_scenario_invalid_numeric_values(setup_processed_dataset_with_ml):
    """Verify that specifying invalid numeric values raises HTTP 400 Bad Request."""
    proc_id, analysis_id = setup_processed_dataset_with_ml

    # Test string non-numeric
    payload1 = {
        "name": "Invalid String Number Scenario",
        "feature_changes": {
            "patient_visits": "invalid_number",
        },
    }
    res1 = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=payload1)
    assert res1.status_code == 400
    assert "Invalid numeric value" in res1.json()["detail"]

    # Test boolean
    payload2 = {
        "name": "Invalid Bool Scenario",
        "feature_changes": {
            "patient_visits": True,
        },
    }
    res2 = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=payload2)
    assert res2.status_code == 400
    assert "Expected number, got boolean" in res2.json()["detail"]


def test_scenario_empty_feature_changes(setup_processed_dataset_with_ml):
    """Verify that empty feature_changes raises HTTP 400 Bad Request."""
    proc_id, analysis_id = setup_processed_dataset_with_ml

    payload = {
        "name": "Empty Scenario",
        "feature_changes": {},
    }

    res = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=payload)
    assert res.status_code == 400
    assert "cannot be empty" in res.json()["detail"]
