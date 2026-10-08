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
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.models.scenario import Scenario
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_governance import DecisionGovernanceEvent
from app.models.evidence_edge import EvidenceEdge
from app.services.decision_governance_service import DecisionGovernanceService
from app.schemas.decision_governance import GovernanceTransitionRequest
from app.services.learning_signal_service import LearningSignalService
from app.services.decision_performance_service import DecisionPerformanceService
from app.services.outcome_service import DecisionOutcomeService
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
def base_fixture(db: Session):
    """Set up workspace, project, dataset, recommendation, and approval."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    db.add(proj)
    db.flush()

    ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="governance_test.csv",
        version=1,
        is_processed=True,
        status="PROCESSED",
    )
    db.add(ds)
    db.flush()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        target_column="delivery_cost",
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
        target_column="delivery_cost",
        baseline_prediction=4000.0,
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
        recommendation_type="route_optimization",
        title="Optimize Supply Route Costs",
        target_metric="delivery_cost",
        baseline_value=4000.0,
        projected_value=3200.0,
        absolute_delta=-800.0,
        percentage_delta=-0.20,
        changed_features={},
        rationale="Cut operating cost by 20%",
        tradeoffs="None",
        confidence="HIGH",
        evidence={"target_metric": "delivery_cost", "projected_value": 3200.0},
    )
    db.add(rec_eval)
    db.flush()

    rec = DecisionRecommendation(
        id=rec_id,
        dataset_id=ds.id,
        title="Optimize Supply Route Costs",
        recommendation_type="route_optimization",
        impact_level="high",
        expected_impact="Cut operating cost by 20%",
        action_items=[],
        evidence_traceability={"target_metric": "delivery_cost", "projected_value": 3200.0},
    )
    db.add(rec)
    db.flush()

    db.commit()
    return ws, proj, ds, rec


# -----------------------------------------------------------------------------
# 1. Governance retrieval
# -----------------------------------------------------------------------------
def test_governance_retrieval(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["decision_id"] == rec.id
    assert data["project_id"] == proj.id
    assert data["dataset_id"] == ds.id
    assert "status" in data
    assert "allowed_actions" in data
    assert "readiness_checks" in data
    assert "escalation" in data
    assert "active_issues" in data
    assert "history" in data


# -----------------------------------------------------------------------------
# 2. No decision returns correct error (404)
# -----------------------------------------------------------------------------
def test_no_decision_returns_correct_error(db: Session, base_fixture):
    _, proj, _, _ = base_fixture
    res = client.get(f"/api/v1/decisions/non-existent-decision-id/governance?project_id={proj.id}")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 3. Initial governance state (DRAFT)
# -----------------------------------------------------------------------------
def test_initial_governance_state(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DRAFT"
    assert "START_REVIEW" in data["allowed_actions"]


# -----------------------------------------------------------------------------
# 4. Start review (DRAFT -> UNDER_REVIEW)
# -----------------------------------------------------------------------------
def test_start_review(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    payload = {
        "action": "START_REVIEW",
        "reviewer": "analyst@insightflow.ai",
        "review_notes": "Commencing initial operational review.",
    }
    res = client.post(f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "UNDER_REVIEW"
    assert data["reviewer"] == "analyst@insightflow.ai"
    assert "SUBMIT_FOR_APPROVAL" in data["allowed_actions"]
    assert "ESCALATE" in data["allowed_actions"]
    assert "PUT_ON_HOLD" in data["allowed_actions"]


# -----------------------------------------------------------------------------
# 5. Valid approval transition (UNDER_REVIEW -> PENDING_APPROVAL -> APPROVED)
# -----------------------------------------------------------------------------
def test_valid_approval_transition(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    # 1. DRAFT -> UNDER_REVIEW
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "analyst@insightflow.ai", "review_notes": "Starting review"},
    )
    # 2. UNDER_REVIEW -> PENDING_APPROVAL
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "SUBMIT_FOR_APPROVAL", "reviewer": "analyst@insightflow.ai", "review_notes": "Ready for executive signoff"},
    )
    # 3. PENDING_APPROVAL -> APPROVED
    res = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "APPROVE", "reviewer": "executive.director@insightflow.ai", "review_notes": "Approved following cross-functional alignment."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "APPROVED"
    assert data["reviewer"] == "executive.director@insightflow.ai"
    assert "EXECUTE" in data["allowed_actions"]


# -----------------------------------------------------------------------------
# 6. Valid rejection transition (PENDING_APPROVAL -> REJECTED)
# -----------------------------------------------------------------------------
def test_valid_rejection_transition(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "analyst@insightflow.ai", "review_notes": "Starting review"},
    )
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "SUBMIT_FOR_APPROVAL", "reviewer": "analyst@insightflow.ai", "review_notes": "Submitted"},
    )
    res = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "REJECT", "reviewer": "risk.officer@insightflow.ai", "review_notes": "Rejected due to unmitigated downside volatility."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert data["reviewer"] == "risk.officer@insightflow.ai"
    assert "RETURN_TO_REVIEW" in data["allowed_actions"]


# -----------------------------------------------------------------------------
# 7. Valid escalation transition (UNDER_REVIEW -> ESCALATED)
# -----------------------------------------------------------------------------
def test_valid_escalation_transition(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "analyst@insightflow.ai", "review_notes": "Starting review"},
    )
    res = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "ESCALATE", "reviewer": "analyst@insightflow.ai", "review_notes": "Escalating due to conflicting stakeholder constraints."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ESCALATED"
    assert "RETURN_TO_REVIEW" in data["allowed_actions"]


# -----------------------------------------------------------------------------
# 8. Valid hold transition (UNDER_REVIEW -> ON_HOLD)
# -----------------------------------------------------------------------------
def test_valid_hold_transition(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "analyst@insightflow.ai", "review_notes": "Starting review"},
    )
    res = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "PUT_ON_HOLD", "reviewer": "analyst@insightflow.ai", "review_notes": "Paused pending quarterly budget freeze lift."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ON_HOLD"
    assert "RETURN_TO_REVIEW" in data["allowed_actions"]


# -----------------------------------------------------------------------------
# 9. Invalid transition rejected (HTTP 400)
# -----------------------------------------------------------------------------
def test_invalid_transition_rejected(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    # Direct jump from DRAFT to APPROVED without review is forbidden
    res = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "APPROVE", "reviewer": "fast.actor@insightflow.ai", "review_notes": "Skipping review"},
    )
    assert res.status_code == 400
    assert "not valid" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 10. Reviewer captured
# -----------------------------------------------------------------------------
def test_reviewer_captured(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "lead.compliance@insightflow.ai", "review_notes": "Starting review"},
    )
    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.json()["reviewer"] == "lead.compliance@insightflow.ai"

    # Verify directly in database
    appr = db.scalar(select(DecisionApproval).where(DecisionApproval.decision_id == rec.id))
    assert appr is not None
    assert appr.actor_id == "lead.compliance@insightflow.ai"


# -----------------------------------------------------------------------------
# 11. Review notes captured (and required for critical actions)
# -----------------------------------------------------------------------------
def test_review_notes_captured(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "auditor@insightflow.ai", "review_notes": "Audit in progress"},
    )
    # Attempt APPROVE without review notes must fail
    res_err = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "APPROVE", "reviewer": "auditor@insightflow.ai", "review_notes": "   "},
    )
    assert res_err.status_code == 400
    assert "review notes" in res_err.json()["detail"].lower()

    # Provide explicit notes
    res_ok = client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "APPROVE", "reviewer": "auditor@insightflow.ai", "review_notes": "Compliance criteria met across all operational vectors."},
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["review_notes"] == "Compliance criteria met across all operational vectors."


# -----------------------------------------------------------------------------
# 12. History append-only
# -----------------------------------------------------------------------------
def test_history_append_only(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "step1@insightflow.ai", "review_notes": "Step 1 note"},
    )
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "PUT_ON_HOLD", "reviewer": "step2@insightflow.ai", "review_notes": "Step 2 note"},
    )
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "RETURN_TO_REVIEW", "reviewer": "step3@insightflow.ai", "review_notes": "Step 3 note"},
    )

    h_res = client.get(f"/api/v1/decisions/{rec.id}/governance/history?project_id={proj.id}")
    assert h_res.status_code == 200
    history = h_res.json()
    assert len(history) == 3
    assert history[0]["action"] == "START_REVIEW"
    assert history[0]["from_status"] == "DRAFT"
    assert history[0]["to_status"] == "UNDER_REVIEW"
    assert history[1]["action"] == "PUT_ON_HOLD"
    assert history[2]["action"] == "RETURN_TO_REVIEW"


# -----------------------------------------------------------------------------
# 13. Historical event not mutated
# -----------------------------------------------------------------------------
def test_historical_event_not_mutated(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "initial.reviewer@insightflow.ai", "review_notes": "Original note"},
    )
    h_before = client.get(f"/api/v1/decisions/{rec.id}/governance/history?project_id={proj.id}").json()
    original_event_id = h_before[0]["id"]
    original_note = h_before[0]["review_notes"]

    # Perform second transition
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "PUT_ON_HOLD", "reviewer": "second.reviewer@insightflow.ai", "review_notes": "Second note"},
    )

    h_after = client.get(f"/api/v1/decisions/{rec.id}/governance/history?project_id={proj.id}").json()
    assert len(h_after) == 2
    assert h_after[0]["id"] == original_event_id
    assert h_after[0]["review_notes"] == original_note
    assert h_after[0]["actor"] == "initial.reviewer@insightflow.ai"


# -----------------------------------------------------------------------------
# 14. Active learning signal visible
# -----------------------------------------------------------------------------
def test_active_learning_signal_visible(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    sig = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        signal_type="PREDICTION_DEVIATION",
        metric_name="delivery_cost",
        source_decision_ids=[rec.id],
        severity="HIGH",
        status="NEW",
        title="Unresolved Prediction Variance",
        description="High deviation observed repeatedly",
        fingerprint=uuid.uuid4().hex,
    )
    db.add(sig)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["escalation"]["escalation_recommended"] is True
    assert any("HIGH learning signal" in r for r in data["escalation"]["reasons"])
    assert any(i["issue_type"] == "ACTIVE_HIGH_LEARNING_SIGNAL" for i in data["active_issues"])


# -----------------------------------------------------------------------------
# 15. Resolved signal not treated as active
# -----------------------------------------------------------------------------
def test_resolved_signal_not_treated_as_active(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    sig = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        signal_type="PREDICTION_DEVIATION",
        metric_name="delivery_cost",
        source_decision_ids=[rec.id],
        severity="HIGH",
        status="RESOLVED",
        title="Resolved Prediction Variance",
        description="Addressed during pipeline re-calibration",
        review_notes="Model parameters re-tuned",
        fingerprint=uuid.uuid4().hex,
    )
    db.add(sig)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    # Resolved signals do NOT trigger escalation
    assert data["escalation"]["escalation_recommended"] is False
    assert len(data["active_issues"]) == 0


# -----------------------------------------------------------------------------
# 16. Guardrail evidence visible
# -----------------------------------------------------------------------------
def test_guardrail_evidence_visible(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    ml = db.scalars(select(MLAnalysis).where(MLAnalysis.dataset_id == ds.id)).first()
    opt = db.scalars(select(DecisionOptimization).where(DecisionOptimization.dataset_id == ds.id)).first()
    guard = DecisionGuardrailEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_id=rec.id,
        decision_status="NOT_RECOMMENDED",
        feasibility_status="INFEASIBLE",
        risk_level="HIGH",
        risk_score=0.88,
        guardrail_results=[],
        passed_rules=[],
        warnings=[],
        violated_rules=["Operational boundary breach"],
        explanation="Guardrail infeasible",
    )
    db.add(guard)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["escalation"]["escalation_recommended"] is True
    assert any("Guardrail" in r for r in data["escalation"]["reasons"])
    assert any(i["issue_type"] == "GUARDRAIL_VIOLATION" for i in data["active_issues"])


# -----------------------------------------------------------------------------
# 17. Outcome evidence visible
# -----------------------------------------------------------------------------
def test_outcome_evidence_visible(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    out = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds.id,
        decision_id=rec.id,
        recommendation_id=rec.id,
        actual_metric="delivery_cost",
        actual_value=3150.0,
        expected_metric="delivery_cost",
        expected_value=3200.0,
        absolute_delta=50.0,
        relative_delta=0.0156,
        outcome_status="MATCHED",
        learning_signal="PREDICTION_ACCURACY",
    )
    db.add(out)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["evidence_summary"]["observed_outcomes_count"] == 1
    check = next(c for c in data["readiness_checks"] if c["check_id"] == "OUTCOME_AVAILABLE")
    assert check["status"] == "READY"


# -----------------------------------------------------------------------------
# 18. Performance evidence visible
# -----------------------------------------------------------------------------
def test_performance_evidence_visible(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    # Add 3 outcomes to meet longitudinal baseline
    for i in range(3):
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=rec.id,
            recommendation_id=rec.id,
            actual_metric="delivery_cost",
            actual_value=3200.0 + (i * 10),
            expected_metric="delivery_cost",
            expected_value=3200.0,
            absolute_delta=float(i * 10),
            relative_delta=float(i * 0.003),
            outcome_status="MATCHED",
        )
        db.add(out)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    check = next(c for c in data["readiness_checks"] if c["check_id"] == "PERFORMANCE_AVAILABLE")
    assert check["status"] == "READY"


# -----------------------------------------------------------------------------
# 19. Missing evidence represented correctly
# -----------------------------------------------------------------------------
def test_missing_evidence_represented_correctly(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    # Mark dataset as not processed
    ds.is_processed = False
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.status_code == 200
    data = res.json()
    check = next(c for c in data["readiness_checks"] if c["check_id"] == "EVIDENCE_AVAILABLE")
    assert check["status"] == "INCOMPLETE"
    assert "not processed" in check["details"].lower()


# -----------------------------------------------------------------------------
# 20. Project isolation
# -----------------------------------------------------------------------------
def test_project_isolation(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    # Create another project
    other_proj = Project(id=str(uuid.uuid4()), workspace_id=proj.workspace_id, name="Other_Proj")
    db.add(other_proj)
    db.commit()

    # Attempt to read Decision belonging to Project 1 using Project 2 context
    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={other_proj.id}")
    assert res.status_code == 404
    assert "does not belong" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 21. Decision isolation
# -----------------------------------------------------------------------------
def test_decision_isolation(db: Session, base_fixture):
    _, proj, ds, rec1 = base_fixture
    # Create second recommendation
    rec2 = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        title="Second Recommendation",
        recommendation_type="inventory_optimization",
        impact_level="low",
        expected_impact="Reduce inventory overhead",
        action_items=[],
    )
    db.add(rec2)
    db.commit()

    # Transition rec1 to UNDER_REVIEW
    client.post(
        f"/api/v1/decisions/{rec1.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "user1@insightflow.ai", "review_notes": "Reviewing rec 1"},
    )

    # Verify rec2 remains in DRAFT
    res2 = client.get(f"/api/v1/decisions/{rec2.id}/governance?project_id={proj.id}")
    assert res2.json()["status"] == "DRAFT"
    assert res2.json()["reviewer"] is None


# -----------------------------------------------------------------------------
# 22. Evidence graph linkage
# -----------------------------------------------------------------------------
def test_evidence_graph_linkage(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "graph.reviewer@insightflow.ai", "review_notes": "Link check"},
    )
    # Verify edge exists in evidence_edges
    edge = db.scalar(
        select(EvidenceEdge).where(
            EvidenceEdge.source_type == "GOVERNANCE_REVIEW",
            EvidenceEdge.target_id == rec.id,
        )
    )
    assert edge is not None
    assert edge.relationship_type == "REVIEWED_BY"


# -----------------------------------------------------------------------------
# 23. No automatic approval
# -----------------------------------------------------------------------------
def test_no_automatic_approval(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    ml = db.scalars(select(MLAnalysis).where(MLAnalysis.dataset_id == ds.id)).first()
    opt = db.scalars(select(DecisionOptimization).where(DecisionOptimization.dataset_id == ds.id)).first()
    # Even with 100% passing guardrails and high confidence, state remains DRAFT
    guard = DecisionGuardrailEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_id=rec.id,
        decision_status="READY_TO_CONSIDER",
        feasibility_status="FEASIBLE",
        risk_level="LOW",
        risk_score=0.05,
        guardrail_results=[],
        passed_rules=["Constraint A passed"],
        warnings=[],
        violated_rules=[],
        explanation="Feasible and ready",
    )
    db.add(guard)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.json()["status"] == "DRAFT"
    assert res.json()["status"] != "APPROVED"


# -----------------------------------------------------------------------------
# 24. No automatic rejection
# -----------------------------------------------------------------------------
def test_no_automatic_rejection(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    ml = db.scalars(select(MLAnalysis).where(MLAnalysis.dataset_id == ds.id)).first()
    opt = db.scalars(select(DecisionOptimization).where(DecisionOptimization.dataset_id == ds.id)).first()
    # Infeasible guardrail does NOT automatically reject
    guard = DecisionGuardrailEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_id=rec.id,
        decision_status="NOT_RECOMMENDED",
        feasibility_status="INFEASIBLE",
        risk_level="HIGH",
        risk_score=0.95,
        guardrail_results=[],
        passed_rules=[],
        warnings=[],
        violated_rules=["Operational boundary breach"],
        explanation="Guardrail infeasible",
    )
    db.add(guard)
    db.commit()

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.json()["status"] == "DRAFT"
    assert res.json()["status"] != "REJECTED"


# -----------------------------------------------------------------------------
# 25. No automatic execution
# -----------------------------------------------------------------------------
def test_no_automatic_execution(db: Session, base_fixture):
    _, proj, _, rec = base_fixture
    # Move to APPROVED
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "START_REVIEW", "reviewer": "user@insightflow.ai", "review_notes": "review"},
    )
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "SUBMIT_FOR_APPROVAL", "reviewer": "user@insightflow.ai", "review_notes": "submitting"},
    )
    client.post(
        f"/api/v1/decisions/{rec.id}/governance/transition?project_id={proj.id}",
        json={"action": "APPROVE", "reviewer": "exec@insightflow.ai", "review_notes": "approved"},
    )

    res = client.get(f"/api/v1/decisions/{rec.id}/governance?project_id={proj.id}")
    assert res.json()["status"] == "APPROVED"
    assert res.json()["status"] != "EXECUTED"


# -----------------------------------------------------------------------------
# 26. Existing Phase 8 behavior unchanged
# -----------------------------------------------------------------------------
def test_existing_phase8_behavior_unchanged(db: Session, base_fixture):
    _, proj, _, _ = base_fixture
    signals = LearningSignalService.sync_and_get_signals(db=db, project_id=proj.id)
    assert isinstance(signals, list)


# -----------------------------------------------------------------------------
# 27. Existing Phase 7 behavior unchanged
# -----------------------------------------------------------------------------
def test_existing_phase7_behavior_unchanged(db: Session, base_fixture):
    _, proj, _, _ = base_fixture
    perf = DecisionPerformanceService.get_performance_overview(db=db, project_id=proj.id)
    assert perf is not None
    assert perf.project_id == proj.id


# -----------------------------------------------------------------------------
# 28. Existing Phase 6 behavior unchanged
# -----------------------------------------------------------------------------
def test_existing_phase6_behavior_unchanged(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    # Phase 6 outcome recording endpoint
    res = client.post(
        f"/api/v1/decisions/{rec.id}/outcomes",
        json={
            "actual_metric": "delivery_cost",
            "actual_value": 3180.0,
            "notes": "Testing phase 6 outcome backward compatibility",
        },
    )
    assert res.status_code in [200, 201]


# -----------------------------------------------------------------------------
# 29. Existing Phase 5 behavior unchanged
# -----------------------------------------------------------------------------
def test_existing_phase5_behavior_unchanged(db: Session, base_fixture):
    _, proj, ds, rec = base_fixture
    res = client.get(f"/api/v1/datasets/{ds.id}/evidence")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
