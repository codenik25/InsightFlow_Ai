import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_optimization import DecisionOptimization
from app.models.ml_analysis import MLAnalysis
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_governance import DecisionGovernanceEvent
from app.models.decision_execution import DecisionExecution, DecisionExecutionEvent
from app.models.evidence_edge import EvidenceEdge
from app.schemas.decision_execution import (
    ExecutionRequestPayload,
    ExecutionConfirmPayload,
    ExecutionFailPayload,
    ExecutionNotExecutedPayload,
)
from app.services.decision_execution_service import DecisionExecutionService
from app.services.evidence_service import EvidenceService

client = TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def execution_fixture(db: Session):
    """Set up workspace, project, dataset, recommendation, guardrail, and approval."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    db.add(proj)
    db.flush()

    ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="execution_test.csv",
        version=1,
        is_processed=True,
        status="PROCESSED",
    )
    db.add(ds)
    db.flush()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        target_column="fuel_cost",
        task_type="regression",
        model_name="RandomForestRegressor",
        status="COMPLETED",
    )
    db.add(ml)
    db.flush()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        objective="minimize",
        target_column="fuel_cost",
        baseline_prediction=50000.0,
        constraints={},
        status="completed",
    )
    db.add(opt)
    db.flush()

    rec_id = str(uuid.uuid4())
    rec_eval = DecisionRecommendationEvaluation(
        id=rec_id,
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="cost_reduction",
        title="Automate Fuel Replenishment",
        target_metric="fuel_cost",
        baseline_value=50000.0,
        projected_value=45000.0,
        absolute_delta=-5000.0,
        percentage_delta=-0.10,
        changed_features={},
        rationale="Optimize fuel route scheduling",
        tradeoffs="Minor route detour",
        confidence="HIGH",
        evidence={"target_metric": "fuel_cost", "projected_value": 45000.0},
    )
    db.add(rec_eval)
    db.flush()

    rec = DecisionRecommendation(
        id=rec_id,
        dataset_id=ds.id,
        title="Automate Fuel Replenishment",
        recommendation_type="cost_reduction",
        impact_level="high",
        expected_impact="Reduce fuel waste by 18%",
        action_items=[],
        evidence_traceability={"target_metric": "fuel_cost", "projected_value": 45000.0},
    )
    db.add(rec)
    db.flush()

    # Guardrail evaluation
    guardrail = DecisionGuardrailEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_id=rec.id,
        feasibility_status="FEASIBLE",
        risk_level="LOW",
        decision_status="READY_TO_CONSIDER",
        explanation="All guardrail safety checks passed successfully.",
        guardrail_results=[],
        passed_rules=["budget_limit", "latency_sla"],
        warnings=[],
        violated_rules=[],
    )
    db.add(guardrail)
    db.flush()

    # Approved governance approval record
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=rec.id,
        recommendation_id=rec.id,
        status="APPROVED",
        actor_type="USER",
        actor_id="lead-governor-01",
        reason="Approved after thorough risk review.",
        decided_at=datetime.now(timezone.utc),
        approval_metadata={"governance_status": "APPROVED"},
    )
    db.add(appr)
    db.flush()

    # Traceable Evidence Edge
    edge = EvidenceEdge(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        source_type="RECOMMENDATION",
        source_id=rec.id,
        target_type="DECISION",
        target_id=rec.id,
        relationship_type="SUPPORTED_BY",
        metadata={"created_at": datetime.now(timezone.utc).isoformat()},
    )
    db.add(edge)
    db.commit()

    return {
        "workspace": ws,
        "project": proj,
        "dataset": ds,
        "recommendation": rec,
        "guardrail": guardrail,
        "approval": appr,
    }


def test_execution_state_retrieval(db: Session, execution_fixture):
    """Test 1: GET /execution returns factual readiness and initial READY state."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={proj.id}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["decision_id"] == rec.id
    assert data["project_id"] == proj.id
    assert data["is_approved"] is True
    assert data["status"] == "READY"
    assert data["can_request_execution"] is True
    assert data["can_confirm_execution"] is True
    assert len(data["readiness_checks"]) >= 4
    for check in data["readiness_checks"]:
        assert check["passed"] is True


def test_unapproved_decision_cannot_execute(db: Session, execution_fixture):
    """Test 2: Unapproved decision (e.g. DRAFT or REJECTED) returns NOT_READY and blocks execution."""
    appr = execution_fixture["approval"]
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    appr.approval_metadata = {"governance_status": "UNDER_REVIEW"}
    appr.status = "UNDER_REVIEW"
    db.commit()

    # State should be NOT_READY
    resp = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={proj.id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "NOT_READY"
    assert resp.json()["can_request_execution"] is False

    # POST request should fail with 400
    resp_req = client.post(
        f"/api/v1/decisions/{rec.id}/execution/request?project_id={proj.id}",
        json={"requested_by": "operator-01", "rationale": "Trying to run early"},
    )
    assert resp_req.status_code == 400
    assert "Decision must be APPROVED" in resp_req.json()["detail"]


def test_approved_decision_request_execution_flow(db: Session, execution_fixture):
    """Test 3: Approved decision transitions READY -> PENDING_CONFIRMATION upon execution request."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.post(
        f"/api/v1/decisions/{rec.id}/execution/request?project_id={proj.id}",
        json={"requested_by": "ops-lead-01", "rationale": "Scheduled operational window opened."},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "PENDING_CONFIRMATION"
    assert data["requested_by"] == "ops-lead-01"
    assert data["can_confirm_execution"] is True


def test_missing_operator_or_rationale_rejected(db: Session, execution_fixture):
    """Test 5 & 6: Missing operator or rationale on confirmation/request is rejected with HTTP 400/422."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    # Missing operator on confirm
    resp1 = client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "", "rationale": "Some justification"},
    )
    assert resp1.status_code in (400, 422)

    # Missing rationale on confirm
    resp2 = client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "operator-01", "rationale": ""},
    )
    assert resp2.status_code in (400, 422)


def test_valid_human_confirmation_lifecycle(db: Session, execution_fixture):
    """Test 4 & 7: Human confirmation records EXECUTED state, result, and updates governance."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={
            "confirmed_by": "senior-engineer-42",
            "rationale": "Applied route rebalancing in live operations dispatcher.",
            "execution_reference": "DISP-9921",
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "EXECUTED"
    assert data["confirmed_by"] == "senior-engineer-42"
    assert data["executed_by"] == "senior-engineer-42"
    assert data["execution_reference"] == "DISP-9921"
    assert data["execution_result"] is not None
    assert data["execution_result"]["message"] == "Decision execution confirmed by operator."


def test_duplicate_confirmation_idempotent(db: Session, execution_fixture):
    """Test 8: Repeated confirmation is idempotent without duplicate records or events."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    # First confirmation
    client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "operator-01", "rationale": "Initial confirmation"},
    )

    # Second confirmation
    resp2 = client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "operator-01", "rationale": "Duplicate confirmation attempt"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "EXECUTED"

    db.expire_all()
    # Verify exactly 1 execution record exists
    exec_records = db.scalars(
        select(DecisionExecution).where(
            DecisionExecution.decision_id == rec.id,
            DecisionExecution.project_id == proj.id,
        )
    ).all()
    assert len(exec_records) == 1


def test_execution_history_append_only(db: Session, execution_fixture):
    """Test 9: Execution event history is append-only and immutable."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    client.post(
        f"/api/v1/decisions/{rec.id}/execution/request?project_id={proj.id}",
        json={"requested_by": "ops-lead", "rationale": "Requesting operational run"},
    )
    client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "ops-lead", "rationale": "Confirmed run"},
    )

    resp = client.get(f"/api/v1/decisions/{rec.id}/execution/history?project_id={proj.id}")
    assert resp.status_code == 200
    hist = resp.json()

    assert hist["total_events"] >= 2
    event_types = [e["event_type"] for e in hist["events"]]
    assert "EXECUTION_REQUESTED" in event_types
    assert "EXECUTION_CONFIRMED" in event_types


def test_execution_failure_handling(db: Session, execution_fixture):
    """Test 10: Execution failure records failure reason without automatic retries."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.post(
        f"/api/v1/decisions/{rec.id}/execution/fail?project_id={proj.id}",
        json={"failed_by": "ops-lead", "failure_reason": "External dispatch queue unreachable"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "EXECUTION_FAILED"
    assert data["failure_reason"] == "External dispatch queue unreachable"

    # Confirm history captures failure event
    hist_resp = client.get(f"/api/v1/decisions/{rec.id}/execution/history?project_id={proj.id}")
    events = hist_resp.json()["events"]
    assert any(e["event_type"] == "EXECUTION_FAILED" for e in events)


def test_not_executed_lifecycle(db: Session, execution_fixture):
    """Test 11: Approved decision explicitly marked NOT_EXECUTED records justification."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.post(
        f"/api/v1/decisions/{rec.id}/execution/not-executed?project_id={proj.id}",
        json={"actor": "portfolio-owner", "reason": "Operational maintenance window expired"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "NOT_EXECUTED"
    assert data["failure_reason"] == "Operational maintenance window expired"


def test_invalid_state_transition_rejected(db: Session, execution_fixture):
    """Test 12: Invalid transitions (e.g. from terminal or invalid state) are rejected."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    # First confirm execution to reach EXECUTED
    client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "operator-01", "rationale": "Confirmed"},
    )

    # Attempting to request execution from EXECUTED should fail
    resp = client.post(
        f"/api/v1/decisions/{rec.id}/execution/request?project_id={proj.id}",
        json={"requested_by": "operator-02", "rationale": "Trying to re-request"},
    )
    assert resp.status_code == 400


def test_project_and_decision_isolation(db: Session, execution_fixture):
    """Test 13 & 14: Project isolation and decision isolation enforced strictly."""
    rec = execution_fixture["recommendation"]
    ws = execution_fixture["workspace"]

    # Create alien project in same workspace
    alien_proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Alien Project")
    db.add(alien_proj)
    db.commit()

    # Querying decision with wrong project_id returns 404
    resp = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={alien_proj.id}")
    assert resp.status_code == 404

    # Confirming decision under wrong project_id returns 404
    resp_confirm = client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={alien_proj.id}",
        json={"confirmed_by": "attacker", "rationale": "Cross-project intrusion"},
    )
    assert resp_confirm.status_code == 404


def test_action_gate_compatibility_and_readiness(db: Session, execution_fixture):
    """Test 15: Action gate evaluation is integrated into readiness checks."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={proj.id}")
    assert resp.status_code == 200
    checks = {c["check_key"]: c for c in resp.json()["readiness_checks"]}

    assert "ACTION_GATE_CLEARED" in checks
    assert checks["ACTION_GATE_CLEARED"]["passed"] is True


def test_evidence_graph_integration_on_execution(db: Session, execution_fixture):
    """Test 17: Evidence graph node and EXECUTED_AS edge recorded on confirmation."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "ops-lead", "rationale": "Live route execution"},
    )

    edges = db.scalars(
        select(EvidenceEdge).where(
            EvidenceEdge.project_id == proj.id,
            EvidenceEdge.relationship_type == "EXECUTED_AS",
        )
    ).all()
    assert len(edges) >= 1
    assert any(e.target_type == "EXECUTION" for e in edges)


def test_outcome_linkage_integration(db: Session, execution_fixture):
    """Test 18: Closed-loop outcome monitoring linkage returns Phase 6 data."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]
    ds = execution_fixture["dataset"]

    # Record actual outcome in Phase 6
    outcome = DecisionOutcome(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=rec.id,
        recommendation_id=rec.id,
        expected_metric="fuel_cost",
        expected_value=45000.0,
        actual_metric="fuel_cost",
        actual_value=38000.0,
        absolute_delta=-7000.0,
        relative_delta=-0.1555,
        outcome_status="ACHIEVED",
    )
    db.add(outcome)
    db.commit()

    resp = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={proj.id}")
    assert resp.status_code == 200
    outcome_link = resp.json()["outcome_link"]

    assert outcome_link is not None
    assert outcome_link["expected_metric"] == "fuel_cost"
    assert outcome_link["current_status"] in ("ACHIEVED", "SUCCESS", "PENDING")


def test_no_fabricated_external_execution_side_effects(db: Session, execution_fixture):
    """Test 19: Execution record represents an explicit confirmation without fabricated external claims."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    resp = client.post(
        f"/api/v1/decisions/{rec.id}/execution/confirm?project_id={proj.id}",
        json={"confirmed_by": "operator-01", "rationale": "Manual confirmation"},
    )
    assert resp.status_code == 200
    exec_result = resp.json()["execution_result"]

    assert exec_result["status"] == "EXECUTED"
    assert exec_result["is_simulated"] is True
    assert "confirmed by operator" in exec_result["message"].lower()


def test_no_automatic_execution_or_retry(db: Session, execution_fixture):
    """Test 20 & 21: Decisions remain in initial state without autonomous execution or automatic retry."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    # Initial state remains READY, never auto-executes
    resp = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={proj.id}")
    assert resp.json()["status"] == "READY"

    # Mark failed
    client.post(
        f"/api/v1/decisions/{rec.id}/execution/fail?project_id={proj.id}",
        json={"failed_by": "ops-lead", "failure_reason": "Network disconnect"},
    )

    # State remains EXECUTION_FAILED without background retries
    resp2 = client.get(f"/api/v1/decisions/{rec.id}/execution?project_id={proj.id}")
    assert resp2.json()["status"] == "EXECUTION_FAILED"


def test_locked_phases_behavior_unchanged(db: Session, execution_fixture):
    """Test 22-26: Earlier phases (5, 6, 7, 8, 9) remain functional and unaffected."""
    rec = execution_fixture["recommendation"]
    proj = execution_fixture["project"]

    # Phase 9 Governance API
    gov_resp = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert gov_resp.status_code == 200
    assert gov_resp.json()["status"] == "APPROVED"

    # Phase 8 Learning Signals API
    sig_resp = client.get(f"/api/v1/projects/{proj.id}/learning-signals")
    assert sig_resp.status_code == 200

    # Phase 7 Performance API
    perf_resp = client.get(f"/api/v1/projects/{proj.id}/decision-performance")
    assert perf_resp.status_code == 200

    # Phase 6 Outcomes API
    out_resp = client.get(f"/api/v1/decisions/{rec.id}/outcomes?project_id={proj.id}")
    assert out_resp.status_code == 200

    # Phase 5 Evidence API
    ev_resp = client.get(f"/api/v1/decisions/{rec.id}/evidence")
    assert ev_resp.status_code == 200
