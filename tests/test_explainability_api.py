import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_prediction_explainability_and_whatif_comparison():
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

    # 1. Upload raw dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_explain.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_dataset_id = upload_res.json()["dataset_id"]

    # 2. Clean dataset
    plan_payload = {
        "dataset_id": raw_dataset_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    apply_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    proc_dataset_id = apply_res.json()["output_dataset_id"]

    # 3. Run ML Analysis
    analyze_res = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert analyze_res.status_code == 200
    analysis_id = analyze_res.json()["id"]

    # 4. Explain ML Model
    exp_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/ml/{analysis_id}/explain")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["analysis_id"] == analysis_id
    assert "feature_importances" in exp_data
    assert len(exp_data["feature_importances"]) > 0

    # 5. Evaluate What-If Scenario with Feature Explainability & Delta Attribution
    sc_payload = {
        "name": "Volume Increase Simulation",
        "description": "Testing marginal impact of units_sold delta",
        "ml_analysis_id": analysis_id,
        "feature_changes": {
            "units_sold": 15
        }
    }
    sc_res = client.post(f"/api/v1/datasets/{proc_dataset_id}/decision/scenarios", json=sc_payload)
    assert sc_res.status_code == 200
    sc_data = sc_res.json()
    assert "feature_importances" in sc_data
    assert "feature_contributions" in sc_data
    assert "units_sold" in sc_data["feature_contributions"]
    assert sc_data["feature_contributions"]["units_sold"]["changed"] is True
    scenario_id = sc_data["id"]

    # 6. Compare What-If Scenario
    cmp_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/scenarios/{scenario_id}/compare")
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["dataset_id"] == proc_dataset_id
    assert cmp_data["scenario_name"] == "Volume Increase Simulation"
    assert "feature_contributions" in cmp_data
