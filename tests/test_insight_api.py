import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_insight_api_workflow():
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Delhi,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Jaipur,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
"""

    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_insights_api.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_id = upload_res.json()["dataset_id"]

    # 1. GET insights on uncleaned dataset returns 400 Bad Request
    uncleaned_res = client.get(f"/api/v1/datasets/{raw_id}/insights")
    assert uncleaned_res.status_code == 400
    assert "requires a processed dataset" in uncleaned_res.json()["detail"]

    # 2. Apply cleaning plan
    plan_payload = {
        "dataset_id": raw_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    apply_res = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    proc_id = apply_res.json()["output_dataset_id"]

    # 3. GET insights returns 200 OK and analyzes proc_id
    get_res = client.get(f"/api/v1/datasets/{raw_id}/insights")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["dataset_id"] == proc_id
    assert "summary" in data
    assert len(data["insights"]) > 0

    # 4. POST insights/generate returns 200 OK
    post_res = client.post(f"/api/v1/datasets/{raw_id}/insights/generate")
    assert post_res.status_code == 200
    assert post_res.json()["dataset_id"] == proc_id
