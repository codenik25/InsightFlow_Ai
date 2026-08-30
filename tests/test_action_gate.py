import pytest
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.services.action_gate_service import ActionGateService
from app.schemas.approval import ActionExecuteRequest


def setup_gate_environment(db_session, guardrail_status="FEASIBLE", decision_status="READY_TO_CONSIDER"):
    ds = Dataset(
        name="test_gate.csv",
        file_path="/tmp/test_gate.csv",
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)

    rec = DecisionRecommendation(
        dataset_id=ds.id,
        title="Optimize Batch Size",
        recommendation_type="optimization",
        impact_level="medium",
        expected_impact="Improve speed",
        action_items=[],
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    g_eval = DecisionGuardrailEvaluation(
        dataset_id=ds.id,
        recommendation_id=rec.id,
        feasibility_score=90.0,
        realism_score=90.0,
        risk_score=10.0,
        confidence_score=90.0,
        decision_readiness_score=90.0,
        feasibility_status=guardrail_status,
        risk_level="LOW",
        decision_status=decision_status,
        guardrail_results=[],
        passed_rules=[],
        warnings=[],
        violated_rules=[],
        explanation="Guardrail safety check complete",
    )
    db_session.add(g_eval)
    db_session.commit()
    db_session.refresh(g_eval)

    return ds, rec, g_eval


def test_action_gate_missing_approval(db_session):
    ds, rec, g_eval = setup_gate_environment(db_session)
    gate = ActionGateService.check_action_gate(db_session, ds.id, rec.id)
    assert gate.allowed is False
    assert gate.reason_code == "APPROVAL_MISSING"
    assert gate.decision_state == "BLOCKED"


def test_action_gate_failed_guardrail(db_session):
    ds, rec, g_eval = setup_gate_environment(db_session, guardrail_status="INFEASIBLE", decision_status="NOT_RECOMMENDED")
    # Grant approval first
    ActionGateService.approve_decision(db_session, ds.id, rec.id)

    gate = ActionGateService.check_action_gate(db_session, ds.id, rec.id)
    assert gate.allowed is False
    assert gate.reason_code == "GUARDRAIL_FAILED"
    assert gate.decision_state == "BLOCKED"


def test_action_gate_approved_and_passed_guardrails(db_session):
    ds, rec, g_eval = setup_gate_environment(db_session)
    # Grant approval
    ActionGateService.approve_decision(db_session, ds.id, rec.id)

    gate = ActionGateService.check_action_gate(db_session, ds.id, rec.id)
    assert gate.allowed is True
    assert gate.reason_code == "ALLOWED"
    assert gate.decision_state == "READY_FOR_ACTION"


def test_simulated_action_execution_flow(db_session):
    ds, rec, g_eval = setup_gate_environment(db_session)

    # 1. Attempt execution before approval -> Blocked
    exec1 = ActionGateService.execute_action(db_session, ds.id, rec.id)
    assert exec1.action_state == "BLOCKED"
    assert exec1.is_simulated is True

    # 2. Grant approval
    ActionGateService.approve_decision(db_session, ds.id, rec.id)

    # 3. Attempt execution after approval -> EXECUTED
    exec2 = ActionGateService.execute_action(
        db_session,
        ds.id,
        rec.id,
        ActionExecuteRequest(actor_id="executor_bot"),
    )
    assert exec2.action_state == "EXECUTED"
    assert exec2.is_simulated is True
    assert exec2.executed_at is not None

    # 4. Attempt duplicate replayed execution -> Blocked
    exec3 = ActionGateService.execute_action(db_session, ds.id, rec.id)
    assert exec3.action_state == "BLOCKED"
    assert exec3.reason_code == "ALREADY_EXECUTED"


def test_action_gate_api_endpoints(client, db_session):
    ds, rec, g_eval = setup_gate_environment(db_session)

    # Check Gate endpoint (unapproved)
    gate_res = client.post(f"/api/v1/datasets/{ds.id}/decision/{rec.id}/action/gate")
    assert gate_res.status_code == 200
    assert gate_res.json()["allowed"] is False

    # Approve via API
    client.post(f"/api/v1/datasets/{ds.id}/decision/{rec.id}/approve")

    # Execute Action API
    exec_res = client.post(
        f"/api/v1/datasets/{ds.id}/decision/{rec.id}/action/execute",
        json={"actor_id": "api_user", "simulation_mode": True},
    )
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["action_state"] == "EXECUTED"
    assert exec_data["is_simulated"] is True
