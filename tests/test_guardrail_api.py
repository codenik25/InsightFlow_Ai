import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_guardrail_api_security_and_edge_cases():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # Upload & Clean Dataset A
    u_a = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_g_api_a.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_a = u_a.json()["dataset_id"]
    c_a = client.post(f"/api/v1/datasets/{raw_a}/clean/apply", json={"dataset_id": raw_a, "operations": [{"type": "remove_duplicates"}]})
    proc_a = c_a.json()["output_dataset_id"]

    # Upload & Clean Dataset B
    u_b = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_g_api_b.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_b = u_b.json()["dataset_id"]
    c_b = client.post(f"/api/v1/datasets/{raw_b}/clean/apply", json={"dataset_id": raw_b, "operations": [{"type": "remove_duplicates"}]})
    proc_b = c_b.json()["output_dataset_id"]

    # Generate ML, Optimization, and Recommendations on Dataset A
    ml_a = client.post(f"/api/v1/datasets/{proc_a}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize", json={"analysis_id": ml_a, "objective": "maximize"}).json()["optimization_id"]
    rec_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize/recommendations", json={"optimization_id": opt_a, "max_recommendations": 3}).json()["recommendations"][0]["id"]

    # Test 1: Valid Evaluation
    eval_res = client.post(f"/api/v1/datasets/{proc_a}/decision/recommendations/{rec_a}/guardrails")
    assert eval_res.status_code == 201

    # Test 2: GET guardrails list for Dataset A
    list_res = client.get(f"/api/v1/datasets/{proc_a}/decision/guardrails")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Test 3: GET guardrail by recommendation ID for Dataset A
    get_rec_g = client.get(f"/api/v1/datasets/{proc_a}/decision/recommendations/{rec_a}/guardrails")
    assert get_rec_g.status_code == 200
    assert get_rec_g.json()["recommendation_id"] == rec_a

    # Test 4: Cross-dataset recommendation guardrail request (Dataset B requesting Dataset A's recommendation returns 404)
    cross_res = client.post(f"/api/v1/datasets/{proc_b}/decision/recommendations/{rec_a}/guardrails")
    assert cross_res.status_code == 404

    # Test 5: Invalid recommendation ID (returns 404)
    bad_rec_res = client.post(f"/api/v1/datasets/{proc_a}/decision/recommendations/invalid-rec-id/guardrails")
    assert bad_rec_res.status_code == 404

    # Test 6: Invalid dataset ID (returns 404)
    bad_ds_res = client.post("/api/v1/datasets/invalid-ds-id/decision/recommendations/some-rec/guardrails")
    assert bad_ds_res.status_code == 404


def test_decision_service_recommendation_guardrail_integration():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # Upload & Clean Dataset C
    u_c = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_g_api_c.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_c = u_c.json()["dataset_id"]
    c_c = client.post(f"/api/v1/datasets/{raw_c}/clean/apply", json={"dataset_id": raw_c, "operations": [{"type": "remove_duplicates"}]})
    proc_c = c_c.json()["output_dataset_id"]

    # Upload & Clean Dataset Empty (for 404 test)
    u_empty = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_g_api_empty.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_empty = u_empty.json()["dataset_id"]
    c_empty = client.post(f"/api/v1/datasets/{raw_empty}/clean/apply", json={"dataset_id": raw_empty, "operations": [{"type": "remove_duplicates"}]})
    proc_empty = c_empty.json()["output_dataset_id"]

    # Generate ML analysis & scenario on Dataset C
    ml_c = client.post(f"/api/v1/datasets/{proc_c}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_c = client.post(f"/api/v1/datasets/{proc_c}/decision/optimize", json={"analysis_id": ml_c, "objective": "maximize"}).json()["optimization_id"]
    scen_c = client.post(f"/api/v1/datasets/{proc_c}/decision/scenarios", json={"name": "Test Scenario", "ml_analysis_id": ml_c, "feature_changes": {"unit_price": 120}}).json()["id"]

    # Generate recommendations via DecisionService & RecommendationService
    recs_no_scen = client.post(f"/api/v1/datasets/{proc_c}/decision/optimize/recommendations", json={"optimization_id": opt_c}).json()["recommendations"]
    assert len(recs_no_scen) > 0
    rec_null_scen_id = recs_no_scen[0]["id"]

    # Generate recommendations via DecisionService (with scenario)
    recs_with_scen = client.post(f"/api/v1/datasets/{proc_c}/decision/recommendations", params={"scenario_id": scen_c, "ml_analysis_id": ml_c}).json()
    assert len(recs_with_scen) > 0
    rec_scen_id = recs_with_scen[0]["id"]
    assert recs_with_scen[0]["scenario_id"] == scen_c

    # 1 & 4. POST /decision/guardrails finds stored DecisionRecommendation records & evaluates multiple recommendations
    batch_res = client.post(f"/api/v1/datasets/{proc_c}/decision/guardrails")
    assert batch_res.status_code == 201
    batch_data = batch_res.json()
    assert batch_data["dataset_id"] == proc_c
    assert batch_data["recommendations_count"] >= 2

    # 2. Guardrails work when recommendations have scenario_id = None
    null_scen_g = client.post(f"/api/v1/datasets/{proc_c}/decision/recommendations/{rec_null_scen_id}/guardrails")
    assert null_scen_g.status_code == 201
    assert null_scen_g.json()["recommendation_id"] == rec_null_scen_id

    # 3. Guardrails work when recommendations have valid scenario_id
    valid_scen_g = client.post(f"/api/v1/datasets/{proc_c}/decision/recommendations/{rec_scen_id}/guardrails")
    assert valid_scen_g.status_code == 201
    assert valid_scen_g.json()["recommendation_id"] == rec_scen_id
    assert valid_scen_g.json()["scenario_id"] == scen_c

    # 5. Empty dataset correctly returns no-recommendations response (404)
    empty_res = client.post(f"/api/v1/datasets/{proc_empty}/decision/guardrails")
    assert empty_res.status_code == 404
    assert "No stored decision recommendations found" in empty_res.json()["detail"]

    # 6. Recommendations from another dataset are not evaluated
    cross_res = client.post(f"/api/v1/datasets/{proc_empty}/decision/recommendations/{rec_scen_id}/guardrails")
    assert cross_res.status_code == 404

    # 7. Guardrail evaluations are persisted
    list_res = client.get(f"/api/v1/datasets/{proc_c}/decision/guardrails")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 2

    # 8. Re-running the endpoint behaves consistently (idempotency)
    batch_rerun = client.post(f"/api/v1/datasets/{proc_c}/decision/guardrails")
    assert batch_rerun.status_code == 201
    assert batch_rerun.json()["recommendations_count"] == batch_data["recommendations_count"]

