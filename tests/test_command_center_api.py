import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_command_center_api_safety_and_edge_cases():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # Upload Dataset A (raw without child)
    u_a = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("raw_cc_a.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_a = u_a.json()["dataset_id"]

    # Test 1: Raw dataset without processed child returns 400 Bad Request
    raw_res = client.get(f"/api/v1/datasets/{raw_a}/decision/command-center")
    assert raw_res.status_code == 400
    assert "requires a processed dataset" in raw_res.json()["detail"]

    # Clean Dataset A to produce processed child
    c_a = client.post(f"/api/v1/datasets/{raw_a}/clean/apply", json={"dataset_id": raw_a, "operations": [{"type": "remove_duplicates"}]})
    proc_a = c_a.json()["output_dataset_id"]

    # Test 2: Raw dataset WITH processed child auto-resolves correctly
    # (Before decision artifacts exist, returns 404)
    raw_with_child_res = client.get(f"/api/v1/datasets/{raw_a}/decision/command-center")
    assert raw_with_child_res.status_code == 404

    # Run analytical pipeline on Dataset A
    client.post(f"/api/v1/datasets/{proc_a}/insights/generate")
    ml_a = client.post(f"/api/v1/datasets/{proc_a}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize", json={"analysis_id": ml_a, "objective": "maximize"}).json()["optimization_id"]
    client.post(f"/api/v1/datasets/{proc_a}/decision/recommendations", json={"optimization_id": opt_a, "max_recommendations": 3})
    client.post(f"/api/v1/datasets/{proc_a}/decision/guardrails")

    # Test 3: Raw dataset WITH processed child auto-resolves to 200 OK
    raw_with_child_success = client.get(f"/api/v1/datasets/{raw_a}/decision/command-center")
    assert raw_with_child_success.status_code == 200
    assert raw_with_child_success.json()["processed_dataset_id"] == proc_a

    # Test 4: Processed dataset returns 200 OK
    proc_success = client.get(f"/api/v1/datasets/{proc_a}/decision/command-center")
    assert proc_success.status_code == 200

    # Test 5: Invalid dataset ID returns 404 Not Found
    invalid_ds_res = client.get("/api/v1/datasets/invalid-ds-id/decision/command-center")
    assert invalid_ds_res.status_code == 404

    # Test 6: Determinism test (repeated GET returns identical JSON payload)
    cc_res1 = client.get(f"/api/v1/datasets/{proc_a}/decision/command-center").json()
    cc_res2 = client.get(f"/api/v1/datasets/{proc_a}/decision/command-center").json()
    clean_cc1 = {k: v for k, v in cc_res1.items() if k != "generated_at"}
    clean_cc2 = {k: v for k, v in cc_res2.items() if k != "generated_at"}
    assert clean_cc1 == clean_cc2
