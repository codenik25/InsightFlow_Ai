import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_decision_intelligence_workflow():
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
        files={"file": ("test_decision.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_dataset_id = upload_res.json()["dataset_id"]

    # 2. Raw dataset protection: Decision APIs return 400 Bad Request
    raw_scenario_res = client.post(
        f"/api/v1/datasets/{raw_dataset_id}/decision/scenarios",
        json={"name": "Raw Test", "feature_changes": {"units_sold": 5}},
    )
    assert raw_scenario_res.status_code == 400
    assert "requires a processed dataset" in raw_scenario_res.json()["detail"]

    # 3. Clean dataset to produce processed dataset
    plan_payload = {
        "dataset_id": raw_dataset_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    apply_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    proc_dataset_id = apply_res.json()["output_dataset_id"]

    # 4. Run ML Analysis
    analyze_res = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert analyze_res.status_code == 200
    analysis_id = analyze_res.json()["id"]

    # 5. Evaluate What-If Scenario
    scenario_payload = {
        "name": "Volume & Pricing Delta Simulation",
        "description": "Simulating increase in units sold and unit price",
        "ml_analysis_id": analysis_id,
        "feature_changes": {
            "units_sold": 10,
            "unit_price": 3000
        }
    }
    sc_res = client.post(f"/api/v1/datasets/{proc_dataset_id}/decision/scenarios", json=scenario_payload)
    assert sc_res.status_code == 200
    sc_data = sc_res.json()
    assert sc_data["dataset_id"] == proc_dataset_id
    assert sc_data["ml_analysis_id"] == analysis_id
    assert sc_data["name"] == "Volume & Pricing Delta Simulation"
    assert "predicted_outcome" in sc_data
    assert "predicted_delta" in sc_data
    assert "confidence_score" in sc_data
    scenario_id = sc_data["id"]

    # 6. List Scenarios
    list_sc_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/scenarios")
    assert list_sc_res.status_code == 200
    assert len(list_sc_res.json()) >= 1

    # 7. Generate Recommendations
    rec_res = client.post(f"/api/v1/datasets/{proc_dataset_id}/decision/recommendations?scenario_id={scenario_id}")
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert len(recs) >= 1
    assert "evidence_traceability" in recs[0]
    assert recs[0]["evidence_traceability"]["dataset_id"] == proc_dataset_id

    # 8. List Recommendations
    list_rec_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/recommendations")
    assert list_rec_res.status_code == 200
    assert len(list_rec_res.json()) >= 1

    # 9. GET Decision Summary
    summary_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision")
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert summary_data["dataset_id"] == proc_dataset_id
    assert len(summary_data["scenarios"]) >= 1
    assert len(summary_data["recommendations"]) >= 1
