import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_optimization_engine_end_to_end_and_safety():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,constant_col,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,CONST,500
102,2026-08-02,CUST02,Electronics,200,3,CONST,600
103,2026-08-03,CUST03,Accessories,50,10,CONST,500
104,2026-08-04,CUST04,Accessories,150,2,CONST,300
105,2026-08-05,CUST05,Electronics,300,4,CONST,1200
106,2026-08-06,CUST06,Accessories,120,6,CONST,720
107,2026-08-07,CUST07,Electronics,250,1,CONST,250
108,2026-08-08,CUST08,Accessories,80,8,CONST,640
"""

    # 1. Upload Raw Dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_engine.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_id = upload_res.json()["dataset_id"]

    # Test 16: Raw dataset protection (POST optimize on raw dataset returns 400)
    raw_opt_res = client.post(
        f"/api/v1/datasets/{raw_id}/decision/optimize",
        json={"objective": "maximize", "max_scenarios": 5},
    )
    assert raw_opt_res.status_code == 400
    assert "requires a processed dataset" in raw_opt_res.json()["detail"]

    # 2. Clean Dataset
    clean_plan = {
        "dataset_id": raw_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    c_res = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json=clean_plan)
    assert c_res.status_code == 200
    proc_id = c_res.json()["output_dataset_id"]

    # 3. Run ML Analysis
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_revenue"},
    )
    assert ml_res.status_code == 200
    ml_id = ml_res.json()["id"]

    # Test 17: Cross-dataset ML analysis protection (returns 404)
    cross_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": "invalid-ml-id-12345", "objective": "maximize"},
    )
    assert cross_res.status_code == 404

    # Test 1: Maximize Objective Optimization
    max_payload = {
        "analysis_id": ml_id,
        "objective": "maximize",
        "max_scenarios": 5,
    }
    opt_max_res = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json=max_payload)
    assert opt_max_res.status_code == 200
    opt_max_data = opt_max_res.json()

    assert opt_max_data["dataset_id"] == proc_id
    assert opt_max_data["ml_analysis_id"] == ml_id
    assert opt_max_data["target_column"] == "target_revenue"
    assert opt_max_data["objective"] == "maximize"
    assert opt_max_data["baseline_prediction"] is not None
    assert len(opt_max_data["scenarios"]) > 0

    # Test 18: Small dataset warning included
    assert opt_max_data["warning"] is not None
    assert "contains only 8 rows" in opt_max_data["warning"]

    # Test 7 & 10: Best scenario = Rank 1, max scenario limit respected
    best_max = opt_max_data["best_scenario"]
    assert best_max["rank"] == 1
    assert len(opt_max_data["scenarios"]) <= 5

    # Check ranking order (descending predicted target)
    scenarios_max = opt_max_data["scenarios"]
    for i in range(len(scenarios_max) - 1):
        assert scenarios_max[i]["predicted_target"] >= scenarios_max[i + 1]["predicted_target"]

    # Test 2: Minimize Objective Optimization
    min_payload = {
        "analysis_id": ml_id,
        "objective": "minimize",
        "max_scenarios": 5,
    }
    opt_min_res = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json=min_payload)
    assert opt_min_res.status_code == 200
    opt_min_data = opt_min_res.json()

    scenarios_min = opt_min_data["scenarios"]
    for i in range(len(scenarios_min) - 1):
        assert scenarios_min[i]["predicted_target"] <= scenarios_min[i + 1]["predicted_target"]

    # Test 3: Deterministic Scenario Ordering & Predictions
    opt_max_res2 = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json=max_payload)
    assert opt_max_res2.status_code == 200
    assert opt_max_data["scenarios"] == opt_max_res2.json()["scenarios"]

    # Test 12: Out-of-range constraint rejection (returns 400)
    invalid_constraint_payload = {
        "analysis_id": ml_id,
        "objective": "maximize",
        "feature_constraints": {
            "unit_price": {"min": 10.0, "max": 10000.0}  # 10000 exceeds observed max of 300
        }
    }
    bad_const_res = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json=invalid_constraint_payload)
    assert bad_const_res.status_code == 400
    assert "exceeds the observed dataset range" in bad_const_res.json()["detail"]

    # Test 14: Unknown feature in baseline inputs (returns 400)
    bad_inputs_payload = {
        "analysis_id": ml_id,
        "baseline_inputs": {"unknown_column_xyz": 123}
    }
    bad_inp_res = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json=bad_inputs_payload)
    assert bad_inp_res.status_code == 400

    # Test 20: Persisted optimization result retrieval (GET /optimizations and GET /optimizations/{id})
    list_opt_res = client.get(f"/api/v1/datasets/{proc_id}/decision/optimizations")
    assert list_opt_res.status_code == 200
    assert len(list_opt_res.json()) >= 2

    opt_id = opt_max_data["optimization_id"]
    get_opt_res = client.get(f"/api/v1/datasets/{proc_id}/decision/optimizations/{opt_id}")
    assert get_opt_res.status_code == 200
    assert get_opt_res.json()["optimization_id"] == opt_id
