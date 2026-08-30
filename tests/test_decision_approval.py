import pytest
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.services.action_gate_service import ActionGateService
from app.schemas.approval import ApprovalRequestPayload, ApprovalDecisionPayload


def setup_approval_dataset(db_session):
    ds = Dataset(
        name="test_approval.csv",
        file_path="/tmp/test_approval.csv",
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)

    rec = DecisionRecommendation(
        dataset_id=ds.id,
        title="Reduce Operational Latency",
        recommendation_type="optimization",
        impact_level="high",
        expected_impact="Cut latency by 20%",
        action_items=[],
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)
    return ds, rec


def test_request_and_approve_decision(db_session):
    ds, rec = setup_approval_dataset(db_session)

    # 1. Request approval
    req_res = ActionGateService.request_approval(
        db_session,
        ds.id,
        rec.id,
        ApprovalRequestPayload(recommendation_id=rec.id, actor_id="manager_1"),
    )
    assert req_res.status == "WAITING_FOR_APPROVAL"
    assert req_res.actor_id == "manager_1"

    # 2. Grant approval
    app_res = ActionGateService.approve_decision(
        db_session,
        ds.id,
        rec.id,
        ApprovalDecisionPayload(actor_id="exec_1", reason="Approved for execution"),
    )
    assert app_res.status == "APPROVED"
    assert app_res.actor_id == "exec_1"
    assert app_res.reason == "Approved for execution"
    assert app_res.decided_at is not None

    # 3. Retrieve status
    get_res = ActionGateService.get_approval_status(db_session, ds.id, rec.id)
    assert get_res.status == "APPROVED"


def test_reject_decision(db_session):
    ds, rec = setup_approval_dataset(db_session)

    rej_res = ActionGateService.reject_decision(
        db_session,
        ds.id,
        rec.id,
        ApprovalDecisionPayload(actor_id="risk_officer", reason="Risk too high"),
    )
    assert rej_res.status == "REJECTED"
    assert rej_res.reason == "Risk too high"


def test_approval_api_endpoints(client, db_session):
    ds, rec = setup_approval_dataset(db_session)

    # Approve API
    app_res = client.post(
        f"/api/v1/datasets/{ds.id}/decision/{rec.id}/approve",
        json={"actor_id": "user_api", "reason": "Approved via API"},
    )
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "APPROVED"

    # Get status API
    get_res = client.get(f"/api/v1/datasets/{ds.id}/decision/{rec.id}/approval")
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "APPROVED"

    # Reject API
    rej_res = client.post(
        f"/api/v1/datasets/{ds.id}/decision/{rec.id}/reject",
        json={"actor_id": "user_api", "reason": "Reverted rejection"},
    )
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"
