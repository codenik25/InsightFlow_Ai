import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_outcome_api_security_lineage_and_endpoints():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # Dataset A (raw without child)
    u_a = client.post("/api/v1/datasets/upload", files={"file": ("raw_out_a.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")})
    raw_a = u_a.json()["dataset_id"]

    # Test 1: Raw dataset returns 400 Bad Request
    raw_res = client.post(
        f"/api/v1/datasets/{raw_a}/decision/outcomes",
        json={"recommendation_id": "any-id", "actual_metric": "target_revenue", "actual_value": 100.0}
    )
    assert raw_res.status_code == 400
    assert "requires a processed dataset" in raw_res.json()["detail"]

    # Clean Dataset A
    proc_a = client.post(f"/api/v1/datasets/{raw_a}/clean/apply", json={"dataset_id": raw_a, "operations": [{"type": "remove_duplicates"}]}).json()["output_dataset_id"]

    # Run Pipeline on A
    client.post(f"/api/v1/datasets/{proc_a}/insights/generate")
    ml_a = client.post(f"/api/v1/datasets/{proc_a}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize", json={"analysis_id": ml_a, "objective": "maximize"}).json()["optimization_id"]
    recs_a = client.post(f"/api/v1/datasets/{proc_a}/decision/recommendations", json={"optimization_id": opt_a, "max_recommendations": 3}).json()["recommendations"]
    rec_a_id = recs_a[0]["id"]

    # Test 2: POST /outcomes returns 201 Created
    post_res = client.post(
        f"/api/v1/datasets/{proc_a}/decision/outcomes",
        json={"recommendation_id": rec_a_id, "actual_metric": "target_revenue", "actual_value": 1000.0}
    )
    assert post_res.status_code == 201
    out_id = post_res.json()["id"]

    # Test 3: GET /outcomes returns 200 OK
    get_list_res = client.get(f"/api/v1/datasets/{proc_a}/decision/outcomes")
    assert get_list_res.status_code == 200
    assert len(get_list_res.json()) == 1

    # Test 4: GET /outcomes/{id} returns 200 OK
    get_single_res = client.get(f"/api/v1/datasets/{proc_a}/decision/outcomes/{out_id}")
    assert get_single_res.status_code == 200
    assert get_single_res.json()["id"] == out_id

    # Test 5: GET /memory & /performance return 200 OK
    assert client.get(f"/api/v1/datasets/{proc_a}/decision/memory").status_code == 200
    assert client.get(f"/api/v1/datasets/{proc_a}/decision/performance").status_code == 200

    # Test 6: Invalid IDs return 404
    assert client.get("/api/v1/datasets/invalid-ds-id/decision/outcomes").status_code == 404
    assert client.get(f"/api/v1/datasets/{proc_a}/decision/outcomes/invalid-out-id").status_code == 404

    # Test 7: Cross-dataset recommendation protection (returns 404)
    u_b = client.post("/api/v1/datasets/upload", files={"file": ("raw_out_b.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")})
    raw_b = u_b.json()["dataset_id"]
    proc_b = client.post(f"/api/v1/datasets/{raw_b}/clean/apply", json={"dataset_id": raw_b, "operations": [{"type": "remove_duplicates"}]}).json()["output_dataset_id"]

    cross_res = client.post(
        f"/api/v1/datasets/{proc_b}/decision/outcomes",
        json={"recommendation_id": rec_a_id, "actual_metric": "target_revenue", "actual_value": 1000.0}
    )
    assert cross_res.status_code == 404
