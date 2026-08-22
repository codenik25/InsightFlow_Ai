import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_eda_api_routes():
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Jaipur,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Jaipur,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
"""

    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_eda_api.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_dataset_id = upload_res.json()["dataset_id"]

    # 1. Uncleaned raw dataset must return 400 Bad Request for EDA
    uncleaned_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/eda")
    assert uncleaned_res.status_code == 400
    assert "requires a processed dataset" in uncleaned_res.json()["detail"]

    # 2. Apply cleaning plan to generate processed child dataset
    plan_payload = {
        "dataset_id": raw_dataset_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    apply_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    proc_dataset_id = apply_res.json()["output_dataset_id"]

    # 3. POST eda using raw_dataset_id -> resolves to proc_dataset_id
    response = client.post(f"/api/v1/datasets/{raw_dataset_id}/eda")
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"] == proc_dataset_id
    assert len(data["column_roles"]) == 8

    # 4. GET eda
    response = client.get(f"/api/v1/datasets/{raw_dataset_id}/eda")
    assert response.status_code == 200
    assert response.json()["dataset_id"] == proc_dataset_id

    # 5. GET kpis
    response = client.get(f"/api/v1/datasets/{raw_dataset_id}/kpis")
    assert response.status_code == 200
    assert len(response.json()) > 0

    # 6. GET trends
    response = client.get(f"/api/v1/datasets/{raw_dataset_id}/trends")
    assert response.status_code == 200

    # 7. GET relationships
    response = client.get(f"/api/v1/datasets/{raw_dataset_id}/relationships")
    assert response.status_code == 200
