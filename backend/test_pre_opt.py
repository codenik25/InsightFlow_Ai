import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

def test_pre_optimization_recommendations():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # Upload and clean
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_pre_opt.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]
    c_res = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    proc_id = c_res.json()["output_dataset_id"]

    # Generate recommendations WITHOUT ML or Optimization first (using just EDA insights if any, or it might fail if ML is required)
    # Actually, DecisionService.generate_recommendations allows recommendations from Insights alone.
    rec_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations")
    print(f"Pre-Optimization Recommendation Status: {rec_res.status_code}")
    if rec_res.status_code == 200 or rec_res.status_code == 201:
        print("Pre-Optimization Recommendations Success!")
        print(rec_res.json())
    else:
        print("Failed:", rec_res.text)

if __name__ == "__main__":
    test_pre_optimization_recommendations()
