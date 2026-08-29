import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.brief_validator import DecisionBriefValidator, BriefValidationError

client = TestClient(app, raise_server_exceptions=False)


def test_decision_brief_service_and_validation():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
"""

    # 1. Pipeline Execution
    u_res = client.post("/api/v1/datasets/upload", files={"file": ("test_brief_service.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")})
    raw_id = u_res.json()["dataset_id"]
    c_res = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]})
    proc_id = c_res.json()["output_dataset_id"]

    client.post(f"/api/v1/datasets/{proc_id}/insights/generate")
    ml_id = client.post(f"/api/v1/datasets/{proc_id}/ml/analyze", json={"task_type": "regression", "target_column": "target_revenue"}).json()["id"]
    opt_id = client.post(f"/api/v1/datasets/{proc_id}/decision/optimize", json={"analysis_id": ml_id, "objective": "maximize"}).json()["optimization_id"]
    client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations", json={"optimization_id": opt_id, "max_recommendations": 3})
    client.post(f"/api/v1/datasets/{proc_id}/decision/guardrails")

    # 2. Brief Generation
    brief_res = client.post(f"/api/v1/datasets/{proc_id}/decision/brief")
    assert brief_res.status_code == 201
    brief_data = brief_res.json()

    assert brief_data["dataset_id"] == proc_id
    assert brief_data["generation_mode"] in ["deterministic_fallback", "ai"]
    assert brief_data["validation_status"] == "validated"
    assert len(brief_data["executive_summary"]) > 20
    assert len(brief_data["sections"]) >= 3
    assert len(brief_data["claim_evidence_map"]) > 0

    # 3. Validation Pipeline Tests
    cc_data = client.get(f"/api/v1/datasets/{proc_id}/decision/command-center").json()
    primary_rec_id = cc_data["primary_recommendation"]["recommendation_id"]

    # Valid Brief Payload Test
    is_valid, msg = DecisionBriefValidator.validate_brief_payload(brief_data, cc_data, primary_rec_id)
    assert is_valid is True

    # Fabricated Evidence Reference Test
    invalid_brief = dict(brief_data)
    invalid_brief["claim_evidence_map"] = [{
        "claim": "Fake claim",
        "evidence_refs": [{"type": "SCENARIO", "id": "fabricated-id-12345"}]
    }]
    is_valid_fake, fake_msg = DecisionBriefValidator.validate_brief_payload(invalid_brief, cc_data, primary_rec_id)
    assert is_valid_fake is False
    assert "fabricated" in fake_msg

    # Fabricated Number Test
    invalid_num_brief = dict(brief_data)
    invalid_num_brief["executive_summary"] = "The model projects a 999999.99% increase."
    is_valid_num, num_msg = DecisionBriefValidator.validate_brief_payload(invalid_num_brief, cc_data, primary_rec_id)
    assert is_valid_num is False
    assert "Numerical claim" in num_msg

    # Prohibited Causal Language Test
    invalid_causal_brief = dict(brief_data)
    invalid_causal_brief["executive_summary"] = "This adjustment causes a guaranteed increase."
    is_valid_causal, causal_msg = DecisionBriefValidator.validate_brief_payload(invalid_causal_brief, cc_data, primary_rec_id)
    assert is_valid_causal is False
    assert "Prohibited causal term" in causal_msg


def test_decision_brief_numerical_propagation_and_missing_values():
    from app.services.llm_provider import DeterministicFallbackProvider

    # Test Case 1: Real Numerical Propagation
    mock_payload = {
        "dataset_name": "hospital_dataset.csv",
        "snapshot": {"decision_readiness_score": 97.0, "decision_status": "READY_TO_CONSIDER", "sample_size": 1200},
        "primary_recommendation": {
            "title": "Optimize Hospital Revenue",
            "target_metric": "total_revenue",
            "baseline_value": 2122261.71,
            "projected_value": 2121243.33,
            "absolute_delta": -1018.38,
            "percentage_delta": -0.05,
            "priority": 1,
            "recommendation_type": "PERFORMANCE"
        },
        "risk_summary": {"risk_level": "LOW", "warnings": [], "failed_rules": [], "passed_rules": []},
        "evidence_chain": {"optimization_id": "opt-123", "scenario_id": "scen-456", "guardrail_id": "g-789"}
    }

    provider = DeterministicFallbackProvider()
    brief1 = provider.generate_brief(mock_payload)
    exec_summary1 = brief1["executive_summary"]

    assert "0.05% decrease" in exec_summary1
    assert "2,122,261.71" in exec_summary1
    assert "2,121,243.33" in exec_summary1
    assert "0.0% change" not in exec_summary1

    # Test Case 2: Genuinely Missing Values (not silently converted to zero)
    mock_missing_payload = {
        "dataset_name": "sparse_dataset.csv",
        "snapshot": {"decision_readiness_score": 50.0, "decision_status": "HUMAN_REVIEW_REQUIRED", "sample_size": 15},
        "primary_recommendation": {
            "title": "Exploratory Recommendation",
            "target_metric": "custom_metric",
            "baseline_value": None,
            "projected_value": None,
            "absolute_delta": None,
            "percentage_delta": None,
            "priority": 1,
            "recommendation_type": "EXPLORATORY"
        },
        "risk_summary": {"risk_level": "HIGH", "warnings": ["Small dataset warning"], "failed_rules": [], "passed_rules": []},
        "evidence_chain": {}
    }

    brief2 = provider.generate_brief(mock_missing_payload)
    exec_summary2 = brief2["executive_summary"]

    assert "pending" in exec_summary2.lower()
    assert "0.0% change" not in exec_summary2
    assert "projected value: 0.0" not in exec_summary2

