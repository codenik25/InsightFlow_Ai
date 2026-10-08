"""Phase 13: Enterprise Decision Reporting & Audit Tests.

23 targeted tests verifying factual, read-only multi-hop enterprise reporting
for individual decisions and project-level portfolios.
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_approval import DecisionApproval
from app.models.decision_governance import DecisionGovernanceEvent
from app.models.decision_execution import DecisionExecution
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.services.decision_report_service import DecisionReportService

client = TestClient(app)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def reporting_setup(db: Session):
    """Setup a complete multi-hop scenario: Project A with full decision chain and Project B for isolation."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    # Projects
    proj_a = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"ProjA_{uuid.uuid4().hex[:6]}")
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"ProjB_{uuid.uuid4().hex[:6]}")
    db.add_all([proj_a, proj_b])
    db.flush()

    # Datasets
    ds_a = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        name="admissions_v1.csv",
        version=1,
        row_count=250,
        column_count=8,
    )
    ds_b = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj_b.id,
        name="project_b_data.csv",
        version=1,
        row_count=100,
        column_count=5,
    )
    db.add_all([ds_a, ds_b])
    db.flush()

    # ML Analysis & Scenario for Project A
    ml_a = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        task_type="regression",
        model_name="RandomForestRegressor",
        target_column="length_of_stay",
        metrics={"R2": 0.88},
        status="completed",
    )
    sc_a = Scenario(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        ml_analysis_id=ml_a.id,
        name="ICU Discharge Optimization",
        target_column="bed_occupancy",
        base_value=12.0,
        predicted_outcome=15.5,
    )
    db.add_all([ml_a, sc_a])
    db.flush()

    # Recommendation 1 in Proj A: Full multi-hop chain
    rec_1 = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        scenario_id=sc_a.id,
        ml_analysis_id=ml_a.id,
        title="Transition step-down beds earlier by 2 hours",
        recommendation_type="RESOURCE_ALLOCATION",
        impact_level="high",
        expected_impact="Bed turnover improvement: 15.5",
        action_items=["Transition step-down beds earlier by 2 hours"],
        evidence_traceability={"target_metric": "bed_turnover", "projected_value": 15.5},
        created_at=utc_now() - timedelta(days=5),
    )
    # Recommendation 2 in Proj A: Partial chain (draft, no ML, no execution, no outcome)
    rec_2 = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        scenario_id=None,
        ml_analysis_id=None,
        title="Rebalance night nurse shifts",
        recommendation_type="STAFF_REBALANCE",
        impact_level="medium",
        expected_impact="Prevent weekend staffing deficits",
        action_items=["Rebalance night nurse shifts"],
        evidence_traceability={},
        created_at=utc_now() - timedelta(days=2),
    )
    # Recommendation in Proj B: For isolation testing
    rec_b = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_b.id,
        scenario_id=None,
        ml_analysis_id=None,
        title="Project B isolated action",
        recommendation_type="ISOLATION_CHECK",
        impact_level="low",
        expected_impact="Testing cross-project boundary",
        action_items=["Project B action"],
        evidence_traceability={},
        created_at=utc_now() - timedelta(days=1),
    )
    db.add_all([rec_1, rec_2, rec_b])
    db.flush()

    # Governance Approval & Events for Rec 1
    appr_1 = DecisionApproval(
        id=str(uuid.uuid4()),
        decision_id=rec_1.id,
        recommendation_id=rec_1.id,
        dataset_id=ds_a.id,
        status="APPROVED",
        actor_id="Dr. Sarah Connor",
        reason="Approved based on scenario simulations",
        decided_at=utc_now() - timedelta(days=4),
        created_at=utc_now() - timedelta(days=5),
    )
    db.add(appr_1)
    db.flush()

    gov_event_1 = DecisionGovernanceEvent(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds_a.id,
        decision_id=rec_1.id,
        recommendation_id=rec_1.id,
        approval_id=appr_1.id,
        from_status="DRAFT",
        to_status="SUBMITTED",
        action="SUBMIT_FOR_REVIEW",
        actor="Alice Analyst",
        review_notes="Initial submission for clinical director review",
        created_at=utc_now() - timedelta(days=4, hours=2),
    )
    gov_event_2 = DecisionGovernanceEvent(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds_a.id,
        decision_id=rec_1.id,
        recommendation_id=rec_1.id,
        approval_id=appr_1.id,
        from_status="SUBMITTED",
        to_status="APPROVED",
        action="APPROVE",
        actor="Dr. Sarah Connor",
        review_notes="Approved based on scenario simulations",
        created_at=utc_now() - timedelta(days=4),
    )
    db.add_all([gov_event_1, gov_event_2])

    # Execution Record for Rec 1
    exec_1 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        dataset_id=ds_a.id,
        decision_id=rec_1.id,
        recommendation_id=rec_1.id,
        approval_id=appr_1.id,
        status="EXECUTED",
        requested_by="Alice Analyst",
        confirmed_by="Bob Ops",
        executed_by="Bob Ops",
        execution_reference="EXEC-BED-2026-001",
        requested_at=utc_now() - timedelta(days=3),
        confirmed_at=utc_now() - timedelta(days=2),
        completed_at=utc_now() - timedelta(days=2),
        created_at=utc_now() - timedelta(days=3),
    )
    db.add(exec_1)
    db.flush()

    # Outcome Record for Rec 1
    out_1 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        decision_id=rec_1.id,
        recommendation_id=rec_1.id,
        dataset_id=ds_a.id,
        scenario_id=sc_a.id,
        ml_analysis_id=ml_a.id,
        expected_metric="bed_turnover",
        expected_value=15.5,
        actual_metric="bed_turnover",
        actual_value=15.1,
        absolute_delta=0.4,
        relative_delta=0.0258,
        outcome_status="RECORDED",
        evaluated_at=utc_now() - timedelta(days=1),
        recorded_at=utc_now() - timedelta(days=1),
        created_at=utc_now() - timedelta(days=1),
    )
    db.add(out_1)
    db.flush()

    # Learning Signal associated with Rec 1
    sig_1 = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj_a.id,
        signal_type="CALIBRATION_DRIFT",
        severity="LOW",
        status="ACTIVE",
        metric_name="bed_turnover",
        source_decision_ids=[rec_1.id],
        title="Minor turnover drift",
        description="Bed turnover was slightly under 15.5 projection but within tolerance",
        fingerprint=str(uuid.uuid4()),
        created_at=utc_now() - timedelta(hours=12),
    )
    db.add(sig_1)
    db.commit()

    return {
        "proj_a_id": proj_a.id,
        "proj_b_id": proj_b.id,
        "rec_1_id": rec_1.id,
        "rec_2_id": rec_2.id,
        "rec_b_id": rec_b.id,
        "ds_a_id": ds_a.id,
        "sc_a_id": sc_a.id,
        "ml_a_id": ml_a.id,
        "out_1_id": out_1.id,
        "sig_1_id": sig_1.id,
    }


# =====================================================================
# 23 REQUIRED AUDIT & REPORTING TESTS
# =====================================================================

def test_individual_decision_report_full_chain(db: Session, reporting_setup: dict):
    """1. Full multi-hop chain is correctly assembled into report."""
    rec_id = reporting_setup["rec_1_id"]
    proj_id = reporting_setup["proj_a_id"]

    report = DecisionReportService.get_decision_report(db, rec_id, proj_id)
    assert report is not None
    assert report.decision_identity["decision_id"] == rec_id
    assert report.decision_identity["target_metric"] == "bed_turnover"
    assert report.dataset_and_lineage["dataset_id"] == reporting_setup["ds_a_id"]
    assert report.dataset_and_lineage["best_model"] == "RandomForestRegressor"
    assert report.governance_audit["current_stage"] == "APPROVED"
    assert report.governance_audit["approved_by"] == "Dr. Sarah Connor"
    assert report.execution_audit["status"] == "EXECUTED"
    assert report.execution_audit["confirmed_by"] == "Bob Ops"
    assert report.outcome_audit["actual_value"] == 15.1
    assert report.learning_summary["total_active_signals"] >= 1


def test_individual_decision_report_partial_chain(db: Session, reporting_setup: dict):
    """2. Missing stages return 'NOT AVAILABLE' or empty dicts without crashing."""
    rec_id = reporting_setup["rec_2_id"]
    proj_id = reporting_setup["proj_a_id"]

    report = DecisionReportService.get_decision_report(db, rec_id, proj_id)
    assert report is not None
    assert report.decision_identity["decision_id"] == rec_id
    # No scenario or ML analysis attached to rec_2
    assert report.dataset_and_lineage["scenario_id"] == "NOT AVAILABLE"
    assert report.execution_audit["status"] == "NOT_REQUESTED"
    assert report.outcome_audit["expected_value"] is None
    assert report.outcome_audit["actual_value"] is None


def test_individual_decision_report_metadata(db: Session, reporting_setup: dict):
    """3. Metadata block contains valid report_id, generated_at, data_as_of, scope."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    meta = report.metadata
    assert meta.scope == "INDIVIDUAL_DECISION"
    assert meta.project_id == reporting_setup["proj_a_id"]
    assert meta.report_id is not None
    assert meta.generated_at is not None
    assert meta.data_as_of is not None


def test_individual_decision_report_timeline(db: Session, reporting_setup: dict):
    """4. Timeline contains chronological events with actors and event types."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    events = report.audit_timeline
    assert len(events) >= 3  # recommendation created, governance submitted/approved, executed, outcome

    types = [e.event_type for e in events]
    assert "RECOMMENDATION_CREATED" in types
    assert any("GOVERNANCE" in t for t in types)


def test_individual_decision_report_nonexistent(db: Session):
    """5. Nonexistent decision returns None / 404."""
    fake_id = "nonexistent-decision-999"
    report = DecisionReportService.get_decision_report(db, fake_id)
    assert report is None

    response = client.get(f"/api/v1/decisions/{fake_id}/report")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_individual_decision_report_read_only(db: Session, reporting_setup: dict):
    """6. Report generation is strictly read-only and does not mutate database."""
    rec_id = reporting_setup["rec_1_id"]

    # Count records before
    count_recs_before = db.query(DecisionRecommendation).count()
    count_gov_before = db.query(DecisionGovernanceEvent).count()
    count_exec_before = db.query(DecisionExecution).count()

    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None

    count_recs_after = db.query(DecisionRecommendation).count()
    count_gov_after = db.query(DecisionGovernanceEvent).count()
    count_exec_after = db.query(DecisionExecution).count()

    assert count_recs_before == count_recs_after
    assert count_gov_before == count_gov_after
    assert count_exec_before == count_exec_after


def test_project_decision_report_structure(db: Session, reporting_setup: dict):
    """7. All required top-level keys are present in project report."""
    proj_id = reporting_setup["proj_a_id"]
    report = DecisionReportService.get_project_report(db, proj_id)
    assert report is not None

    data = report.model_dump()
    required_keys = [
        "metadata",
        "project_summary",
        "portfolio_distributions",
        "operations_and_capacity",
        "portfolio_concentration",
        "shared_dependencies",
        "recurring_deviations",
        "learning_signals_summary",
        "decision_inventory",
    ]
    for k in required_keys:
        assert k in data, f"Missing key: {k}"


def test_project_decision_report_date_filtering(db: Session, reporting_setup: dict):
    """8. date_from and date_to filter decisions and audit data appropriately."""
    proj_id = reporting_setup["proj_a_id"]

    # Filter for future dates (should return 0 decisions in inventory)
    future_from = utc_now() + timedelta(days=10)
    future_to = utc_now() + timedelta(days=20)
    rep_future = DecisionReportService.get_project_report(db, proj_id, date_from=future_from, date_to=future_to)
    assert rep_future is not None
    assert len(rep_future.decision_inventory) == 0

    # Filter covering the past 10 days (should include all Project A decisions)
    past_from = utc_now() - timedelta(days=10)
    past_to = utc_now() + timedelta(days=1)
    rep_past = DecisionReportService.get_project_report(db, proj_id, date_from=past_from, date_to=past_to)
    assert rep_past is not None
    assert len(rep_past.decision_inventory) >= 2


def test_project_decision_report_empty_project(db: Session):
    """9. Empty project with zero decisions returns structured report with zeros."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()
    empty_proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="EmptyProject")
    db.add(empty_proj)
    db.commit()

    report = DecisionReportService.get_project_report(db, empty_proj.id)
    assert report is not None
    assert report.project_summary["total_decisions"] == 0
    assert len(report.decision_inventory) == 0
    assert len(report.shared_dependencies) == 0
    assert len(report.recurring_deviations) == 0


def test_project_decision_report_isolation(db: Session, reporting_setup: dict):
    """10. Decisions from project B must not leak into project A report."""
    proj_a_id = reporting_setup["proj_a_id"]
    proj_b_id = reporting_setup["proj_b_id"]
    rec_b_id = reporting_setup["rec_b_id"]

    report_a = DecisionReportService.get_project_report(db, proj_a_id)
    assert report_a is not None

    inv_a_ids = [d["decision_id"] for d in report_a.decision_inventory]
    assert rec_b_id not in inv_a_ids

    # Also test individual endpoint cross-project isolation
    report_isolated = DecisionReportService.get_decision_report(db, rec_b_id, project_id=proj_a_id)
    assert report_isolated is None  # Should reject because rec_b belongs to proj_b


def test_project_decision_report_metadata(db: Session, reporting_setup: dict):
    """11. Project report metadata has scope 'PROJECT' and correct timestamps."""
    proj_id = reporting_setup["proj_a_id"]
    report = DecisionReportService.get_project_report(db, proj_id)
    assert report is not None
    assert report.metadata.scope == "PROJECT"
    assert report.metadata.project_id == proj_id


def test_audit_timeline_chronological_order(db: Session, reporting_setup: dict):
    """12. Audit timeline events are sorted strictly chronologically ascending."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    events = report.audit_timeline

    for i in range(len(events) - 1):
        assert events[i].timestamp <= events[i + 1].timestamp


def test_audit_timeline_no_fabricated_events(db: Session, reporting_setup: dict):
    """13. Timeline includes only persisted events with real source IDs."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    for event in report.audit_timeline:
        assert event.source_id is not None
        assert len(event.source_id) > 0
        assert event.description is not None


def test_evidence_provenance_linkage(db: Session, reporting_setup: dict):
    """14. Report links recommendation back to dataset, ML analysis, and scenario."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    lineage = report.dataset_and_lineage
    assert lineage["dataset_id"] == reporting_setup["ds_a_id"]
    assert lineage["scenario_id"] == reporting_setup["sc_a_id"]
    assert lineage["ml_analysis_id"] == reporting_setup["ml_a_id"]


def test_governance_audit_section(db: Session, reporting_setup: dict):
    """15. Governance section contains stage, approvals, approved_by, approved_at."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    gov = report.governance_audit
    assert gov["current_stage"] == "APPROVED"
    assert gov["approved_by"] == "Dr. Sarah Connor"
    assert gov["approved_at"] is not None
    assert gov["total_approvals"] >= 1


def test_execution_audit_section(db: Session, reporting_setup: dict):
    """16. Execution section contains status, requested_by, confirmed_by, reference."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    ex = report.execution_audit
    assert ex["status"] == "EXECUTED"
    assert ex["requested_by"] == "Alice Analyst"
    assert ex["confirmed_by"] == "Bob Ops"
    assert ex["execution_reference"] == "EXEC-BED-2026-001"


def test_outcome_audit_section(db: Session, reporting_setup: dict):
    """17. Outcome section contains expected, actual, deviation %, material difference."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    out = report.outcome_audit
    assert out["expected_value"] == 15.5
    assert out["actual_value"] == 15.1
    assert out["deviation_percentage"] is not None
    assert out["material_difference"] is False


def test_learning_signals_section(db: Session, reporting_setup: dict):
    """18. Learning signals section contains active signals and severities."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    learning = report.learning_summary
    assert learning["total_active_signals"] >= 1
    sig = learning["signals"][0]
    assert sig["signal_type"] == "CALIBRATION_DRIFT"
    assert sig["severity"] == "LOW"


def test_not_available_for_missing_fields(db: Session, reporting_setup: dict):
    """19. Missing fields return 'NOT AVAILABLE' explicitly instead of misleading nulls."""
    rec_id = reporting_setup["rec_2_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    assert report.dataset_and_lineage["scenario_id"] == "NOT AVAILABLE"
    assert report.dataset_and_lineage["task_type"] == "NOT AVAILABLE"
    assert report.execution_audit["execution_reference"] == "NOT AVAILABLE"


def test_report_source_references(db: Session, reporting_setup: dict):
    """20. Source references mapping contains valid entity types and IDs."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    refs = report.source_references
    assert refs.get("decision_id") == rec_id
    assert refs.get("dataset_id") == reporting_setup["ds_a_id"]
    assert refs.get("ml_analysis_id") == reporting_setup["ml_a_id"]
    assert refs.get("scenario_id") == reporting_setup["sc_a_id"]
    assert refs.get("outcome_id") == reporting_setup["out_1_id"]


def test_decision_report_api_endpoints(reporting_setup: dict):
    """21. Both individual and project API endpoints return 200 with schema-compliant payloads."""
    rec_id = reporting_setup["rec_1_id"]
    proj_id = reporting_setup["proj_a_id"]

    # 1. Individual report endpoint
    resp_ind = client.get(f"/api/v1/decisions/{rec_id}/report")
    assert resp_ind.status_code == 200
    data_ind = resp_ind.json()
    assert data_ind["metadata"]["scope"] == "INDIVIDUAL_DECISION"
    assert data_ind["decision_identity"]["decision_id"] == rec_id

    # 2. Project report endpoint
    resp_proj = client.get(f"/api/v1/projects/{proj_id}/decision-report")
    assert resp_proj.status_code == 200
    data_proj = resp_proj.json()
    assert data_proj["metadata"]["scope"] == "PROJECT"
    assert len(data_proj["decision_inventory"]) >= 2


def test_no_synthetic_scores_in_report(db: Session, reporting_setup: dict):
    """22. Verify no synthetic scores (Decision Quality Score, Portfolio Health Score) exist."""
    rec_id = reporting_setup["rec_1_id"]
    proj_id = reporting_setup["proj_a_id"]

    report_ind = DecisionReportService.get_decision_report(db, rec_id)
    report_proj = DecisionReportService.get_project_report(db, proj_id)

    forbidden_terms = [
        "decision_quality_score",
        "portfolio_health_score",
        "business_value_score",
        "synthetic_risk_score",
    ]

    ind_dump = str(report_ind.model_dump()).lower()
    proj_dump = str(report_proj.model_dump()).lower()

    for term in forbidden_terms:
        assert term not in ind_dump, f"Found forbidden synthetic score '{term}' in individual report"
        assert term not in proj_dump, f"Found forbidden synthetic score '{term}' in project report"


def test_performance_summary_in_individual_report(db: Session, reporting_setup: dict):
    """23. Individual report includes decision performance context."""
    rec_id = reporting_setup["rec_1_id"]
    report = DecisionReportService.get_decision_report(db, rec_id)
    assert report is not None
    perf = report.performance_summary
    assert "metric_name" in perf
    assert perf["metric_name"] == "bed_turnover"
    assert perf["total_outcomes_for_metric"] >= 1
