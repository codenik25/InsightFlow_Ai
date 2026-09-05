import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_recommendation_api_security_and_edge_cases():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # Upload and clean dataset A
    u_res_a = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_rec_api_a.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_a = u_res_a.json()["dataset_id"]
    c_res_a = client.post(f"/api/v1/datasets/{raw_a}/clean/apply", json={"dataset_id": raw_a, "operations": [{"type": "remove_duplicates"}]})
    proc_a = c_res_a.json()["output_dataset_id"]

    # Upload and clean dataset B
    u_res_b = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_rec_api_b.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_b = u_res_b.json()["dataset_id"]
    c_res_b = client.post(f"/api/v1/datasets/{raw_b}/clean/apply", json={"dataset_id": raw_b, "operations": [{"type": "remove_duplicates"}]})
    proc_b = c_res_b.json()["output_dataset_id"]

    # Run ML and Optimization on Dataset A
    ml_a = client.post(f"/api/v1/datasets/{proc_a}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize", json={"analysis_id": ml_a, "objective": "maximize"}).json()["optimization_id"]

    # Test 1: Cross-dataset optimization usage (passing Dataset A's opt_id to Dataset B returns 404)
    cross_res = client.post(
        f"/api/v1/datasets/{proc_b}/decision/optimize/recommendations",
        json={"optimization_id": opt_a, "max_recommendations": 3},
    )
    assert cross_res.status_code == 404

    # Test 2: Invalid dataset ID (returns 404)
    invalid_ds_res = client.post(
        "/api/v1/datasets/invalid-dataset-id-123/decision/optimize/recommendations",
        json={"optimization_id": opt_a, "max_recommendations": 3},
    )
    assert invalid_ds_res.status_code == 404

    # Test 3: Invalid max_recommendations (<= 0 or > 10 returns 400 or 422)
    zero_max_res = client.post(
        f"/api/v1/datasets/{proc_a}/decision/optimize/recommendations",
        json={"optimization_id": opt_a, "max_recommendations": 0},
    )
    assert zero_max_res.status_code in [400, 422]

    huge_max_res = client.post(
        f"/api/v1/datasets/{proc_a}/decision/optimize/recommendations",
        json={"optimization_id": opt_a, "max_recommendations": 100},
    )
    assert huge_max_res.status_code in [400, 422]

    # Test 4: Valid recommendation creation on Dataset A
    valid_res = client.post(
        f"/api/v1/datasets/{proc_a}/decision/optimize/recommendations",
        json={"optimization_id": opt_a, "max_recommendations": 3},
    )
    assert valid_res.status_code == 201
    rec_id = valid_res.json()["recommendations"][0]["id"]

    # Test 5: GET recommendation by invalid ID (returns 404)
    bad_rec_get = client.get(f"/api/v1/datasets/{proc_a}/decision/optimize/recommendations/invalid-rec-id")
    assert bad_rec_get.status_code == 404

    # Test 6: Cross-dataset recommendation retrieval (Dataset B requesting Dataset A's recommendation returns 404)
    cross_rec_get = client.get(f"/api/v1/datasets/{proc_b}/decision/optimize/recommendations/{rec_id}")
    assert cross_rec_get.status_code == 404
