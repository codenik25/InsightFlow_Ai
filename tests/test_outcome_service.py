import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.outcome_service import DecisionOutcomeService

client = TestClient(app, raise_server_exceptions=False)


def test_outcome_service_evaluations_and_memory():
    # 1. Test Objective-Aware Calculation Logic directly
    max_eval = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=96.0, objective="maximize")
    assert max_eval.absolute_error == 4.0
    assert max_eval.percentage_error == 4.0
    assert max_eval.achievement_percentage == 96.0
    assert max_eval.outcome_status == "ACHIEVED"

    partial_eval = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=80.0, objective="maximize")
    assert partial_eval.achievement_percentage == 80.0
    assert partial_eval.outcome_status == "PARTIALLY_ACHIEVED"

    not_achieved_eval = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=50.0, objective="maximize")
    assert not_achieved_eval.achievement_percentage == 50.0
    assert not_achieved_eval.outcome_status == "NOT_ACHIEVED"

    # Minimization objective test (lower is favorable)
    min_eval = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=90.0, objective="minimize")
    assert min_eval.achievement_percentage > 100.0
    assert min_eval.outcome_status == "ACHIEVED"

    # Zero expected value safety test
    zero_eval = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=0.0, actual_value=10.0, objective="maximize")
    assert zero_eval.percentage_error == 0.0

    # 2. Pipeline Outcome Recording Test
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""
    u_res = client.post("/api/v1/datasets/upload", files={"file": ("test_outcome_svc.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")})
    raw_id = u_res.json()["dataset_id"]
    proc_id = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]}).json()["output_dataset_id"]

    client.post(f"/api/v1/datasets/{proc_id}/insights/generate")
    ml_id = client.post(f"/api/v1/datasets/{proc_id}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_id = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json={"analysis_id": ml_id, "objective": "maximize"}).json()["optimization_id"]
    recs = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize/recommendations", json={"optimization_id": opt_id, "max_recommendations": 3}).json()["recommendations"]
    client.post(f"/api/v1/datasets/{proc_id}/decision/guardrails")

    rec_id = recs[0]["id"]
    exp_val = recs[0]["projected_value"]

    # Record Outcome 1
    post_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/outcomes",
        json={
            "recommendation_id": rec_id,
            "actual_metric": "target_revenue",
            "actual_value": exp_val * 0.96,
            "notes": "Observed revenue period 1"
        }
    )
    assert post_res.status_code == 201
    out1 = post_res.json()
    assert out1["outcome_status"] == "ACHIEVED"
    assert out1["achievement_percentage"] == 96.0

    # Duplicate Outcome Submission Protection Test
    dup_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/outcomes",
        json={
            "recommendation_id": rec_id,
            "actual_metric": "target_revenue",
            "actual_value": exp_val * 0.96,
            "notes": "Duplicate outcome submission"
        }
    )
    assert dup_res.status_code == 400
    assert "Duplicate outcome record" in dup_res.json()["detail"]

    # Decision Memory Retrieval
    mem_res = client.get(f"/api/v1/datasets/{proc_id}/decision/memory")
    assert mem_res.status_code == 200
    mem_data = mem_res.json()
    assert mem_data["total_records"] == 1
    assert mem_data["history"][0]["outcome_status"] == "ACHIEVED"

    # Decision Performance Summary
    perf_res = client.get(f"/api/v1/datasets/{proc_id}/decision/performance")
    assert perf_res.status_code == 200
    perf_data = perf_res.json()
    assert perf_data["total_decisions"] == 1
    assert perf_data["achieved_count"] == 1
    assert perf_data["achievement_rate"] == 100.0
    assert "limited" in perf_data["limited_history_warning"]
