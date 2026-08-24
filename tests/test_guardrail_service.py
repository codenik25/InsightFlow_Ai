import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_guardrail_service_and_rules():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # 1. Ingestion
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_guardrails.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    # 2. Cleaning
    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    proc_id = c_res.json()["output_dataset_id"]

    # 3. Insights
    client.post(f"/api/v1/datasets/{proc_id}/insights/generate")

    # 4. ML & Optimization
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_revenue"},
    )
    ml_id = ml_res.json()["id"]

    opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize"},
    )
    opt_id = opt_res.json()["optimization_id"]

    # 5. Recommendation Generation
    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        json={"optimization_id": opt_id, "max_recommendations": 3},
    )
    assert rec_res.status_code == 201
    recs = rec_res.json()["recommendations"]
    assert len(recs) > 0
    rec_id = recs[0]["id"]

    # 6. Evaluate Single Recommendation Guardrail
    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations/{rec_id}/guardrails")
    assert g_res.status_code == 201
    g_data = g_res.json()

    assert g_data["recommendation_id"] == rec_id
    assert g_data["dataset_id"] == proc_id
    assert g_data["feasibility_status"] in ["FEASIBLE", "CAUTION", "INFEASIBLE"]
    assert g_data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert g_data["decision_status"] in ["READY_TO_CONSIDER", "HUMAN_REVIEW_REQUIRED", "NOT_RECOMMENDED"]
    assert len(g_data["guardrail_results"]) > 0
    assert g_data["explanation"] is not None

    # Small dataset sample size check (< 30 rows)
    assert g_data["confidence_score"] <= 40.0
    assert g_data["decision_status"] == "HUMAN_REVIEW_REQUIRED"

    # 7. Evaluate Batch Dataset Guardrails
    batch_res = client.post(f"/api/v1/datasets/{proc_id}/decision/guardrails")
    assert batch_res.status_code == 201
    batch_data = batch_res.json()
    assert batch_data["dataset_id"] == proc_id
    assert batch_data["recommendations_count"] > 0
    assert len(batch_data["evaluations"]) == len(recs)
