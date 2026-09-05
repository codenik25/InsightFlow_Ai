import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.llm_provider import LLMProviderFactory, DeterministicFallbackProvider, ConfiguredLLMProvider
from app.services.outcome_service import DecisionOutcomeService

client = TestClient(app)

DATASET_CSV_A = """id,department,staff_count,average_bill,occupancy_rate,total_revenue
1,General Medicine,50,4000.0,0.80,200000.0
2,General Medicine,52,4200.0,0.82,218400.0
3,Surgery,48,4100.0,0.78,196800.0
4,Surgery,54,4300.0,0.84,232200.0
5,Emergency,45,3900.0,0.76,175500.0
"""

DATASET_CSV_B = """id,region,headcount,marketing_spend,revenue
1,North,10,5000,50000
2,North,12,5200,52000
3,South,8,4800,48000
4,South,14,5400,54000
5,East,9,4900,49000
"""


def _upload_and_clean(csv_text: str, name: str) -> str:
    u = client.post("/api/v1/datasets/upload", files={"file": (name, io.BytesIO(csv_text.encode("utf-8")), "text/csv")})
    raw_id = u.json()["dataset_id"]
    c = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    return c.json()["output_dataset_id"]


def test_llm_provider_factory_and_fallback():
    """Verify LLMProviderFactory selects configured or fallback provider gracefully."""
    p_fallback = LLMProviderFactory.get_provider(provider_override="deterministic_fallback")
    assert isinstance(p_fallback, DeterministicFallbackProvider)

    p_mock = LLMProviderFactory.get_provider(provider_override="mock_ai")
    assert isinstance(p_mock, ConfiguredLLMProvider)

    # Test error handling fallback in ConfiguredLLMProvider
    p_invalid = ConfiguredLLMProvider(api_key="invalid_key", provider_name="invalid_http_provider")
    with pytest.raises(RuntimeError) as exc_info:
        p_invalid.generate_brief({"dataset_name": "Test"})
    assert "Configured LLM provider execution failed" in str(exc_info.value)


def test_outcome_service_deterministic_calculations():
    """Verify objective-aware outcome evaluation metrics calculation."""
    # Maximize objective: expected 100, actual 110 -> 110% achievement, ACHIEVED
    res_max = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=110.0, objective="maximize")
    assert res_max.achievement_percentage == 110.0
    assert res_max.outcome_status == "ACHIEVED"

    # Maximize objective: expected 100, actual 50 -> 50% achievement, NOT_ACHIEVED
    res_max_fail = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=50.0, objective="maximize")
    assert res_max_fail.achievement_percentage == 50.0
    assert res_max_fail.outcome_status == "NOT_ACHIEVED"

    # Minimize objective: expected 100, actual 90 -> lower cost is better -> 110% achievement, ACHIEVED
    res_min = DecisionOutcomeService.evaluate_outcome_metrics(expected_value=100.0, actual_value=90.0, objective="minimize")
    assert res_min.achievement_percentage == 110.0
    assert res_min.outcome_status == "ACHIEVED"


def test_decision_memory_and_dataset_isolation():
    """Verify complete decision outcome recording, memory aggregation, and dataset isolation."""
    proc_a = _upload_and_clean(DATASET_CSV_A, "ds_mem_a.csv")
    proc_b = _upload_and_clean(DATASET_CSV_B, "ds_mem_b.csv")

    # Pipeline A
    ml_a = client.post(f"/api/v1/datasets/{proc_a}/ml/analyze", json={"task_type": "regression", "target_column": "total_revenue"}).json()["id"]
    opt_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize", json={"analysis_id": ml_a, "objective": "maximize"}).json()["optimization_id"]
    recs_a = client.post(f"/api/v1/datasets/{proc_a}/decision/optimize/recommendations", json={"optimization_id": opt_a}).json()["recommendations"]
    rec_a_id = recs_a[0]["id"]

    # Record Outcome on Dataset A
    out_a_res = client.post(
        f"/api/v1/datasets/{proc_a}/decision/outcomes",
        json={"recommendation_id": rec_a_id, "actual_metric": "total_revenue", "actual_value": 220000.0, "notes": "Q3 actual revenue"},
    )
    assert out_a_res.status_code == 201
    out_a_data = out_a_res.json()
    assert out_a_data["dataset_id"] == proc_a
    assert out_a_data["outcome_status"] in ["ACHIEVED", "PARTIALLY_ACHIEVED"]

    # Query Memory for Dataset A
    mem_a = client.get(f"/api/v1/datasets/{proc_a}/decision/memory").json()
    assert mem_a["total_records"] >= 1
    assert mem_a["history"][0]["outcome_id"] == out_a_data["id"]

    # Query Performance Summary for Dataset A
    perf_a = client.get(f"/api/v1/datasets/{proc_a}/decision/performance").json()
    assert perf_a["total_decisions"] >= 1
    assert perf_a["achievement_rate"] > 0

    # Dataset Isolation Check: Query Memory and Performance for Dataset B (should be empty)
    mem_b = client.get(f"/api/v1/datasets/{proc_b}/decision/memory").json()
    assert mem_b["total_records"] == 0

    perf_b = client.get(f"/api/v1/datasets/{proc_b}/decision/performance").json()
    assert perf_b["total_decisions"] == 0
