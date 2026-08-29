import io
import sys
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

GENERIC_DATASET_CSV = """account_id,marketing_budget,headcount,conversion_rate,satisfaction_score,region,revenue
ACC01,10000,50,0.20,80,North,50000
ACC02,12000,55,0.22,82,South,55000
ACC03,9000,45,0.18,78,East,45000
ACC04,11000,52,0.21,81,West,52000
ACC05,10500,48,0.19,79,North,48000
ACC06,13000,60,0.25,85,South,60000
ACC07,9500,46,0.17,77,East,46000
ACC08,11500,53,0.23,83,West,53000
ACC09,10200,49,0.20,80,North,49000
ACC10,12500,58,0.24,84,South,58000
ACC11,8800,44,0.16,76,East,44000
ACC12,11200,51,0.21,81,West,51000
ACC13,10800,50,0.20,80,North,50000
ACC14,12200,56,0.23,83,South,56000
ACC15,9200,47,0.18,78,East,47000
ACC16,11800,54,0.22,82,West,54000
ACC17,10400,49,0.19,79,North,49000
ACC18,12800,59,0.24,84,South,59000
ACC19,9600,46,0.17,77,East,46000
ACC20,11600,53,0.22,82,West,53000
ACC21,10100,48,0.19,79,North,48000
ACC22,12100,55,0.23,83,South,55000
ACC23,9100,45,0.18,78,East,45000
ACC24,11300,52,0.21,81,West,52000
ACC25,10700,50,0.20,80,North,50000
ACC26,12700,58,0.24,84,South,57000
ACC27,9300,46,0.17,77,East,46000
ACC28,11700,54,0.22,82,West,53000
ACC29,10300,49,0.19,79,North,48000
ACC30,12300,56,0.23,83,South,56000
ACC31,9700,47,0.18,78,East,46000
"""


def _setup_generic_dataset():
    """Helper to upload and clean generic dataset and generate recommendations."""
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("generic_g.csv", io.BytesIO(GENERIC_DATASET_CSV.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    proc_id = c_res.json()["output_dataset_id"]

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "revenue"},
    )
    ml_id = ml_res.json()["id"]

    opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize"},
    )
    opt_id = opt_res.json()["optimization_id"]

    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        json={"optimization_id": opt_id, "max_recommendations": 3},
    )
    recs = rec_res.json()["recommendations"]
    return proc_id, ml_id, recs[0]["id"]


def test_guardrail_small_numeric_change_low_risk():
    """Requirement 1: A small numeric change (e.g. 5%) remains low risk and READY_TO_CONSIDER."""
    proc_id, ml_id, _ = _setup_generic_dataset()

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Small Change Scenario", "ml_analysis_id": ml_id, "feature_changes": {"marketing_budget": 11025.0}},
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        params={"scenario_id": scen_id, "ml_analysis_id": ml_id},
    )
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    assert g_data["realism_score"] == 100.0
    assert g_data["risk_score"] == 0.0
    assert g_data["decision_status"] == "READY_TO_CONSIDER"


def test_guardrail_moderate_numeric_change():
    """Requirement 2: A moderate numeric change (e.g. 35%) triggers a warning and HUMAN_REVIEW_REQUIRED."""
    proc_id, ml_id, _ = _setup_generic_dataset()

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Moderate Change Scenario", "ml_analysis_id": ml_id, "feature_changes": {"marketing_budget": 14580.0}},
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        params={"scenario_id": scen_id, "ml_analysis_id": ml_id},
    )
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    assert g_data["realism_score"] < 100.0
    assert g_data["decision_status"] == "HUMAN_REVIEW_REQUIRED"
    rel_results = [r for r in g_data["guardrail_results"] if "RULE_RELATIVE_CHANGE_marketing_budget" in r["rule_id"]]
    assert len(rel_results) > 0
    assert rel_results[0]["status"] == "WARNING"


def test_guardrail_extreme_numeric_change_90_percent():
    """Requirement 3: An extreme numeric change (~90% increase) significantly reduces realism score and marks HUMAN_REVIEW_REQUIRED."""
    proc_id, ml_id, _ = _setup_generic_dataset()

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Extreme Change Scenario", "ml_analysis_id": ml_id, "feature_changes": {"marketing_budget": 20520.0}},
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        params={"scenario_id": scen_id, "ml_analysis_id": ml_id},
    )
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    assert g_data["realism_score"] <= 65.0
    assert g_data["risk_score"] >= 40.0
    assert g_data["decision_status"] == "HUMAN_REVIEW_REQUIRED"

    rel_results = [r for r in g_data["guardrail_results"] if "RULE_RELATIVE_CHANGE_marketing_budget" in r["rule_id"]]
    assert len(rel_results) > 0
    ev = rel_results[0]["evidence"]
    assert ev["feature"] == "marketing_budget"
    assert ev["percentage_change"] >= 80.0
    assert "extreme relative change" in rel_results[0]["message"].lower()


def test_guardrail_categorical_feature_change():
    """Requirement 4: A categorical feature change is evaluated separately under categorical change rule."""
    proc_id, ml_id, _ = _setup_generic_dataset()

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Categorical Shift Scenario", "ml_analysis_id": ml_id, "feature_changes": {"region": "West"}},
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        params={"scenario_id": scen_id, "ml_analysis_id": ml_id},
    )
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    cat_results = [r for r in g_data["guardrail_results"] if r["category"] == "CATEGORICAL_CHANGE"]
    assert len(cat_results) > 0
    assert cat_results[0]["evidence"]["change_type"] == "categorical_shift"


def test_guardrail_zero_baseline_handling():
    """Requirement 5: Handles zero baselines safely without division by zero errors."""
    csv_rows = ["cost_center,net_adjustment,headcount,revenue"]
    for i in range(31):
        adj = float(i % 5 - 2)  # values -2.0, -1.0, 0.0, 1.0, 2.0 -> mean is 0.0
        csv_rows.append(f"C{i+1:02d},{adj},{50+i},{50000+i*100}")
    csv_data = "\n".join(csv_rows)

    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("zero_base.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]
    c_res = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    proc_id = c_res.json()["output_dataset_id"]

    ml_res = client.post(f"/api/v1/datasets/{proc_id}/ml/analyze", json={"task_type": "regression", "target_column": "revenue"})
    ml_id = ml_res.json()["id"]

    # net_adjustment mean is 0.0, proposed value is 0.5 (within bounds [-2.0, 2.0])
    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Zero Base Shift", "ml_analysis_id": ml_id, "feature_changes": {"net_adjustment": 0.5}},
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations", params={"scenario_id": scen_id, "ml_analysis_id": ml_id})
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    assert g_res.json()["decision_status"] in ["READY_TO_CONSIDER", "HUMAN_REVIEW_REQUIRED"]


def test_guardrail_multiple_changed_numeric_features():
    """Requirement 6: Multiple changed numeric features are evaluated independently and aggregated."""
    proc_id, ml_id, _ = _setup_generic_dataset()

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={
            "name": "Multi Feature Shift",
            "ml_analysis_id": ml_id,
            "feature_changes": {"marketing_budget": 15000.0, "headcount": 70.0},
        },
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations", params={"scenario_id": scen_id, "ml_analysis_id": ml_id})
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    rel_results = [r for r in g_data["guardrail_results"] if "RULE_RELATIVE_CHANGE" in r["rule_id"]]
    assert len(rel_results) >= 2


def test_guardrail_semantic_invalid_values():
    """Requirement 7: Semantic invalid values (e.g. ratio > 1.0) trigger CRITICAL FAIL and NOT_RECOMMENDED."""
    proc_id, ml_id, _ = _setup_generic_dataset()

    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Semantic Outlier", "ml_analysis_id": ml_id, "feature_changes": {"conversion_rate": 1.35}},
    )
    scen_id = scen_res.json()["id"]

    rec_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations", params={"scenario_id": scen_id, "ml_analysis_id": ml_id})
    rec_id = rec_res.json()[0]["id"]

    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    assert g_data["feasibility_status"] == "INFEASIBLE"
    assert g_data["decision_status"] == "NOT_RECOMMENDED"

    fail_results = [r for r in g_data["guardrail_results"] if r["status"] == "FAIL"]
    assert len(fail_results) > 0
    assert "exceeds maximum allowed semantic bound" in fail_results[0]["message"]
