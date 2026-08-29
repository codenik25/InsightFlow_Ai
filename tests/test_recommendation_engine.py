import io
import pytest
from app.core.database import SessionLocal
from app.services.decision_service import DecisionService
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def setup_recommendation_dataset():
    """Helper fixture to upload dataset with distinct feature importances, train ML model, and return ids."""
    csv_content = """operating_cost,patient_visits,average_bill,staff_count,total_revenue
100000,500,1500,20,750000
110000,520,1550,21,806000
105000,510,1480,19,754800
120000,530,1600,22,848000
95000,490,1450,18,710500
125000,540,1620,23,874800
108000,515,1510,20,777650
112000,525,1530,21,803250
102000,505,1490,19,752450
118000,535,1580,22,845300
    """
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_rec_hospital.csv", io.BytesIO(csv_content.strip().encode("utf-8")), "text/csv")},
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


def test_recommendation_surfaces_highest_importance_feature(setup_recommendation_dataset):
    """Prove that recommendation engine ranks features by model importance rather than column index."""
    proc_id, analysis_id = setup_recommendation_dataset
    db = SessionLocal()
    try:
        exp_res = client.get(f"/api/v1/datasets/{proc_id}/ml/{analysis_id}/explain")
        assert exp_res.status_code == 200
        exp_data = exp_res.json()
        importances = exp_data["feature_importances"]
        sorted_exp_features = [k for k, v in sorted(importances.items(), key=lambda item: item[1], reverse=True)]

        recs = DecisionService.generate_recommendations(db=db, dataset_id=proc_id)
        feat_rec = next((r for r in recs if "Target Feature Allocation" in r.title), None)
        assert feat_rec is not None

        top_exp_feature = sorted_exp_features[0]
        assert top_exp_feature in feat_rec.expected_impact
        assert top_exp_feature in feat_rec.action_items[0]
    finally:
        db.close()


def test_recommendation_consistency_with_ml_explainability(setup_recommendation_dataset):
    """Verify that recommendation top features match the top 3 features from ML explainability."""
    proc_id, analysis_id = setup_recommendation_dataset
    db = SessionLocal()
    try:
        exp_res = client.get(f"/api/v1/datasets/{proc_id}/ml/{analysis_id}/explain")
        assert exp_res.status_code == 200
        top_3_exp = [k for k, v in sorted(exp_res.json()["feature_importances"].items(), key=lambda x: x[1], reverse=True)][:3]

        recs = DecisionService.generate_recommendations(db=db, dataset_id=proc_id)
        feat_rec = next((r for r in recs if "Target Feature Allocation" in r.title), None)
        assert feat_rec is not None

        for feat in top_3_exp:
            assert feat in feat_rec.expected_impact
    finally:
        db.close()


def test_negative_scenario_recommendation_phrasing(setup_recommendation_dataset):
    """Verify that a scenario producing a negative predicted outcome is phrased as risk mitigation/review."""
    proc_id, analysis_id = setup_recommendation_dataset
    db = SessionLocal()
    try:
        scenario_payload = {
            "name": "Adverse Revenue Simulation",
            "description": "Simulation resulting in lower prediction",
            "ml_analysis_id": analysis_id,
            "feature_changes": {
                "operating_cost": 90000,
                "patient_visits": 480,
            },
        }
        sc_res = client.post(f"/api/v1/datasets/{proc_id}/decision/scenarios", json=scenario_payload)
        assert sc_res.status_code == 200
        scenario_id = sc_res.json()["id"]

        recs = DecisionService.generate_recommendations(db=db, dataset_id=proc_id, scenario_id=scenario_id)
        sc_rec = recs[0]
        if sc_res.json()["predicted_delta"] < 0:
            assert sc_rec.recommendation_type == "risk_mitigation"
            assert "Investigate Adverse Impact" in sc_rec.title
            assert "not recommended without mitigating adjustments" in sc_rec.expected_impact
            assert "Re-evaluate scenario parameters" in sc_rec.action_items[0]
        else:
            assert sc_rec.recommendation_type in ["optimization", "action"]
    finally:
        db.close()


def test_no_generic_column_references(setup_recommendation_dataset):
    """Verify recommendation action items never contain generic 'source column 'all'' strings."""
    proc_id, analysis_id = setup_recommendation_dataset
    db = SessionLocal()
    try:
        recs = DecisionService.generate_recommendations(db=db, dataset_id=proc_id)
        for r in recs:
            for action in r.action_items:
                assert "source column 'all'" not in action
    finally:
        db.close()
