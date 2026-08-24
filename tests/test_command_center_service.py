import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_command_center_service_aggregation():
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
        files={"file": ("test_cc_service.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
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

    # 6. Guardrail Evaluation
    g_res = client.post(f"/api/v1/datasets/{proc_id}/decision/guardrails")
    assert g_res.status_code == 201

    # 7. Command Center Retrieval
    cc_res = client.get(f"/api/v1/datasets/{proc_id}/decision/command-center")
    assert cc_res.status_code == 200
    cc_data = cc_res.json()

    assert cc_data["dataset_id"] == proc_id
    assert cc_data["processed_dataset_id"] == proc_id
    assert cc_data["snapshot"] is not None
    assert cc_data["snapshot"]["decision_status"] == "HUMAN_REVIEW_REQUIRED"
    assert cc_data["snapshot"]["sample_size"] == 5
    assert "Recommendations are exploratory" in cc_data["snapshot"]["small_dataset_warning"]

    assert cc_data["primary_recommendation"] is not None
    assert cc_data["primary_recommendation"]["priority"] == 1
    assert cc_data["evidence_chain"] is not None
    assert len(cc_data["evidence_chain"]["nodes"]) >= 5
    assert len(cc_data["comparison"]) > 0
    assert len(cc_data["next_actions"]) >= 4
