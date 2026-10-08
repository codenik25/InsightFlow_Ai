import uuid
from datetime import datetime, timezone, timedelta
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
from app.models.decision_approval import DecisionApproval
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_execution import DecisionExecution
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.services.decision_portfolio_service import DecisionPortfolioService

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
def portfolio_setup(db: Session):
    """Setup project, datasets, decisions, approvals, executions, outcomes, and signals."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    db.add(proj)
    db.flush()

    ds1 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="patient_flow_v1.csv",
        version=1,
        row_count=100,
        column_count=5,
    )
    ds2 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="staffing_v1.csv",
        version=1,
        row_count=80,
        column_count=4,
    )
    db.add_all([ds1, ds2])
    db.flush()

    # Create ML analysis for explicit linkage test
    ml1 = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        task_type="regression",
        model_name="RandomForestRegressor",
        status="completed",
        target_column="operating_cost",
    )
    db.add(ml1)
    db.flush()

    # Create Scenario for shared scenario test
    sc1 = Scenario(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        name="Bed Expansion 20%",
        target_column="operating_cost",
        feature_changes={"expansion": 0.20},
    )
    db.add(sc1)
    db.flush()

    # Decision 1: Operating Cost, Approved, Executed, Outcome Matched
    d1_id = f"DEC_{uuid.uuid4().hex[:8]}"
    app1 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d1_id,
        recommendation_id=d1_id,
        status="APPROVED",
        actor_id="Dr. Stone",
        created_at=utc_now() - timedelta(days=10),
        decided_at=utc_now() - timedelta(days=9),
    )
    exc1 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds1.id,
        decision_id=d1_id,
        recommendation_id=d1_id,
        approval_id=app1.id,
        status="EXECUTED",
        confirmed_by="Nurse Jackie",
        execution_reference="TICKET-101",
        created_at=utc_now() - timedelta(days=8),
        completed_at=utc_now() - timedelta(days=7),
    )
    out1 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds1.id,
        decision_id=d1_id,
        recommendation_id=d1_id,
        expected_metric="operating_cost",
        expected_value=1000.0,
        actual_metric="operating_cost",
        actual_value=1020.0,
        absolute_delta=20.0,
        relative_delta=0.02,
        outcome_status="MATCHED",
        scenario_id=sc1.id,
        ml_analysis_id=ml1.id,
        recorded_at=utc_now() - timedelta(days=6),
    )
    db.add_all([app1, exc1, out1])

    # Decision 2: Operating Cost, Approved, Executed, Outcome Materially Differed
    d2_id = f"DEC_{uuid.uuid4().hex[:8]}"
    app2 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d2_id,
        recommendation_id=d2_id,
        status="APPROVED",
        actor_id="Dr. Stone",
        created_at=utc_now() - timedelta(days=8),
        decided_at=utc_now() - timedelta(days=7),
    )
    exc2 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds1.id,
        decision_id=d2_id,
        recommendation_id=d2_id,
        approval_id=app2.id,
        status="EXECUTED",
        confirmed_by="Nurse Jackie",
        execution_reference="TICKET-102",
        created_at=utc_now() - timedelta(days=6),
        completed_at=utc_now() - timedelta(days=5),
    )
    out2 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds1.id,
        decision_id=d2_id,
        recommendation_id=d2_id,
        expected_metric="operating_cost",
        expected_value=1000.0,
        actual_metric="operating_cost",
        actual_value=1300.0,
        absolute_delta=300.0,
        relative_delta=0.30,
        outcome_status="MATERIALLY_DIFFERED",
        scenario_id=sc1.id,
        ml_analysis_id=ml1.id,
        recorded_at=utc_now() - timedelta(days=4),
    )
    db.add_all([app2, exc2, out2])

    # Decision 3: Operating Cost, Approved, Outcome Materially Differed (3rd observation!)
    d3_id = f"DEC_{uuid.uuid4().hex[:8]}"
    app3 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds1.id,
        decision_id=d3_id,
        recommendation_id=d3_id,
        status="APPROVED",
        actor_id="Dr. Stone",
        created_at=utc_now() - timedelta(days=5),
        decided_at=utc_now() - timedelta(days=4),
    )
    exc3 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds1.id,
        decision_id=d3_id,
        recommendation_id=d3_id,
        approval_id=app3.id,
        status="OUTCOME_MONITORING",
        confirmed_by="Nurse Jackie",
        created_at=utc_now() - timedelta(days=3),
    )
    out3 = DecisionOutcome(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds1.id,
        decision_id=d3_id,
        recommendation_id=d3_id,
        expected_metric="operating_cost",
        expected_value=1000.0,
        actual_metric="operating_cost",
        actual_value=1250.0,
        absolute_delta=250.0,
        relative_delta=0.25,
        outcome_status="MATERIALLY_DIFFERED",
        scenario_id=sc1.id,
        ml_analysis_id=ml1.id,
        recorded_at=utc_now() - timedelta(days=2),
    )
    db.add_all([app3, exc3, out3])

    # Decision 4: Readmission Rate, Under Review, No Execution
    d4_id = f"DEC_{uuid.uuid4().hex[:8]}"
    app4 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds2.id,
        decision_id=d4_id,
        recommendation_id=d4_id,
        status="UNDER_REVIEW",
        actor_id="Dr. House",
        created_at=utc_now() - timedelta(days=2),
    )
    db.add(app4)

    # Decision 5: Readmission Rate, Execution Failed
    d5_id = f"DEC_{uuid.uuid4().hex[:8]}"
    app5 = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds2.id,
        decision_id=d5_id,
        recommendation_id=d5_id,
        status="APPROVED",
        created_at=utc_now() - timedelta(days=2),
        decided_at=utc_now() - timedelta(days=1),
    )
    exc5 = DecisionExecution(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds2.id,
        decision_id=d5_id,
        recommendation_id=d5_id,
        status="EXECUTION_FAILED",
        failure_reason="Network timeout connecting to external EHR dispatch service",
        created_at=utc_now() - timedelta(days=1),
        completed_at=utc_now() - timedelta(hours=12),
    )
    db.add_all([app5, exc5])

    # Phase 8 Learning Signals
    sig1 = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        signal_type="PREDICTION_DEVIATION",
        metric_name="operating_cost",
        source_decision_ids=[d1_id, d2_id, d3_id],
        source_outcome_ids=[out2.id, out3.id],
        severity="HIGH",
        status="NEW",
        title="Operating Cost Repeated Deviation",
        description="Repeated material deviation observed.",
        fingerprint=uuid.uuid4().hex,
        created_at=utc_now() - timedelta(days=1),
    )
    sig2 = DecisionLearningSignal(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        signal_type="OUTCOME_COVERAGE_GAP",
        metric_name="readmission_rate",
        source_decision_ids=[d4_id],
        severity="REVIEW",
        status="RESOLVED",  # Resolved, should be excluded from active count!
        title="Coverage gap resolved",
        description="Coverage gap was resolved.",
        fingerprint=uuid.uuid4().hex,
        created_at=utc_now() - timedelta(days=2),
    )
    db.add_all([sig1, sig2])
    db.commit()

    return {
        "workspace": ws,
        "project": proj,
        "dataset1": ds1,
        "dataset2": ds2,
        "ml1": ml1,
        "sc1": sc1,
        "d1_id": d1_id,
        "d2_id": d2_id,
        "d3_id": d3_id,
        "d4_id": d4_id,
        "d5_id": d5_id,
        "out1": out1,
        "out2": out2,
        "out3": out3,
        "sig1": sig1,
        "sig2": sig2,
    }


# ============================================================================
# 36 Comprehensive Phase 11 Tests
# ============================================================================

def test_01_empty_portfolio(db: Session):
    """Empty portfolio returns zeros and empty collections."""
    ws = Workspace(id=str(uuid.uuid4()), name="Empty WS")
    db.add(ws)
    db.flush()
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Empty Proj")
    db.add(proj)
    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id)
    assert res.project_id == proj.id
    assert res.total_decisions_count == 0
    assert res.kpis.total_decisions == 0
    assert res.kpis.approved == 0
    assert res.kpis.executed == 0
    assert res.decisions == []
    assert res.metrics_patterns == []
    assert res.recurring_deviations == []


def test_02_portfolio_overview(db: Session, portfolio_setup):
    """Portfolio overview contains accurate total decision count and metadata."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    assert res.project_id == proj_id
    assert res.total_decisions_count == 5
    assert len(res.decisions) == 5
    assert res.last_updated is not None


def test_03_governance_distribution(db: Session, portfolio_setup):
    """Governance distribution counts match persisted records."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    gov_map = {item.status: item.count for item in res.governance_distribution}

    # d1, d2, d3, d5 are APPROVED; d4 is UNDER_REVIEW
    assert gov_map["APPROVED"] == 4
    assert gov_map["UNDER_REVIEW"] == 1
    assert gov_map["REJECTED"] == 0
    assert gov_map["ESCALATED"] == 0


def test_04_execution_distribution(db: Session, portfolio_setup):
    """Execution distribution matches persisted execution statuses."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    exc_map = {item.status: item.count for item in res.execution_distribution}

    # d1, d2 are EXECUTED; d3 is OUTCOME_MONITORING; d5 is EXECUTION_FAILED; d4 has no execution
    assert exc_map["EXECUTED"] == 2
    assert exc_map["OUTCOME_MONITORING"] == 1
    assert exc_map["EXECUTION_FAILED"] == 1


def test_05_outcome_distribution(db: Session, portfolio_setup):
    """Outcome distribution reuses Phase 6 empirical outcome states."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    out_map = {item.status: item.count for item in res.outcome_distribution}

    # d1 is MATCHED; d2, d3 are MATERIALLY_DIFFERED; d4, d5 are PENDING
    assert out_map["MATCHED"] == 1
    assert out_map["MATERIALLY_DIFFERED"] == 2
    assert out_map["PENDING"] == 2


def test_06_active_learning_signal_aggregation(db: Session, portfolio_setup):
    """Active learning signals (NEW, ACKNOWLEDGED, INVESTIGATING) are aggregated."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    sig_summary = res.learning_signals_summary

    assert sig_summary.total_active_signals == 1
    assert sig_summary.high_count == 1
    assert "PREDICTION_DEVIATION" in sig_summary.by_type
    assert sig_summary.by_type["PREDICTION_DEVIATION"] == 1


def test_07_resolved_signals_excluded_from_active_count(db: Session, portfolio_setup):
    """Resolved and dismissed learning signals are strictly excluded from active counts."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    sig_summary = res.learning_signals_summary

    # sig2 is RESOLVED, so it should not appear in active count
    assert sig_summary.total_active_signals == 1
    assert "OUTCOME_COVERAGE_GAP" not in sig_summary.by_type


def test_07b_all_phase_8_signal_statuses(db: Session):
    """
    Verify exact Phase 8 signal status semantics:
    Active: NEW, ACKNOWLEDGED, INVESTIGATING
    Inactive: RESOLVED, DISMISSED
    """
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="signals_test.csv")
    db.add_all([ws, proj, ds])
    db.flush()

    d_id = f"DEC_{uuid.uuid4().hex[:8]}"
    app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=d_id, recommendation_id=d_id, status="APPROVED")
    db.add(app)
    db.flush()

    statuses = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "DISMISSED"]
    signals = []
    for st in statuses:
        s = DecisionLearningSignal(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            signal_type=f"SIG_{st}",
            metric_name="metric_a",
            source_decision_ids=[d_id],
            status=st,
            severity="REVIEW",
            title=f"Signal {st}",
            description=f"Description {st}",
            fingerprint=uuid.uuid4().hex,
        )
        signals.append(s)
        # Verify helper directly
        if st in ("NEW", "ACKNOWLEDGED", "INVESTIGATING"):
            assert DecisionPortfolioService.is_signal_active(s) is True
        else:
            assert DecisionPortfolioService.is_signal_active(s) is False

    db.add_all(signals)
    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id)
    sig_sum = res.learning_signals_summary

    # Exactly 3 active signals (NEW, ACKNOWLEDGED, INVESTIGATING); RESOLVED & DISMISSED excluded
    assert sig_sum.total_active_signals == 3
    assert "SIG_NEW" in sig_sum.by_type
    assert "SIG_ACKNOWLEDGED" in sig_sum.by_type
    assert "SIG_INVESTIGATING" in sig_sum.by_type
    assert "SIG_RESOLVED" not in sig_sum.by_type
    assert "SIG_DISMISSED" not in sig_sum.by_type


def test_08_metric_cross_decision_aggregation(db: Session, portfolio_setup):
    """Metrics appearing across multiple decisions are aggregated descriptively."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    op_cost = next((m for m in res.metrics_patterns if m.metric_name == "operating_cost"), None)

    assert op_cost is not None
    assert op_cost.decisions_count == 3
    assert op_cost.observed_outcomes_count == 3
    assert op_cost.material_deviations_count == 2
    assert len(op_cost.decision_ids) == 3


def test_09_recurring_deviation_detection(db: Session, portfolio_setup):
    """Recurring deviation detected when observed >= 3 and material deviations >= 50% (here 2/3 = 66.7%)."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, min_observations=3)

    assert len(res.recurring_deviations) == 1
    rec = res.recurring_deviations[0]
    assert rec.metric_name == "operating_cost"
    assert rec.observed_outcomes_count == 3
    assert rec.material_deviations_count == 2
    assert "Repeated material deviation observed" in rec.description


def test_09b_three_outcomes_one_material_not_recurring(db: Session):
    """3 observed outcomes with 1 material deviation -> 1/3 (33.3%) < 50% threshold -> not recurring."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="test_3_1.csv")
    db.add_all([ws, proj, ds])
    db.flush()

    # 3 decisions for metric 'turnaround_time'
    # 2 MATCHED, 1 MATERIALLY_DIFFERED
    for i in range(3):
        did = f"DEC_31_{i}_{uuid.uuid4().hex[:6]}"
        app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=did, recommendation_id=did, status="APPROVED")
        is_material = (i == 2)
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=did,
            recommendation_id=did,
            expected_metric="turnaround_time",
            expected_value=100.0,
            actual_metric="turnaround_time",
            actual_value=125.0 if is_material else 100.5,
            absolute_delta=25.0 if is_material else 0.5,
            relative_delta=0.25 if is_material else 0.005,
            outcome_status="MATERIALLY_DIFFERED" if is_material else "MATCHED",
        )
        db.add_all([app, out])
    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id, min_observations=3)
    rec_turnaround = [r for r in res.recurring_deviations if r.metric_name == "turnaround_time"]
    # 1 of 3 = 33.3% < 50% -> NOT recurring
    assert len(rec_turnaround) == 0


def test_09c_three_outcomes_two_material_recurring(db: Session):
    """3 observed outcomes with 2 material deviations -> 2/3 (66.7%) >= 50% threshold -> recurring."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="test_3_2.csv")
    db.add_all([ws, proj, ds])
    db.flush()

    for i in range(3):
        did = f"DEC_32_{i}_{uuid.uuid4().hex[:6]}"
        app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=did, recommendation_id=did, status="APPROVED")
        is_material = (i >= 1)  # 2 of 3
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=did,
            recommendation_id=did,
            expected_metric="wait_time",
            expected_value=60.0,
            actual_metric="wait_time",
            actual_value=90.0 if is_material else 60.2,
            absolute_delta=30.0 if is_material else 0.2,
            relative_delta=0.50 if is_material else 0.003,
            outcome_status="MATERIALLY_DIFFERED" if is_material else "MATCHED",
        )
        db.add_all([app, out])
    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id, min_observations=3)
    rec_wait = [r for r in res.recurring_deviations if r.metric_name == "wait_time"]
    assert len(rec_wait) == 1
    assert rec_wait[0].material_deviations_count == 2
    assert rec_wait[0].observed_outcomes_count == 3


def test_09d_non_material_differed_not_counted_as_material_deviation(db: Session):
    """
    Non-material DIFFERED outcomes (within Phase 7 material threshold)
    must NOT incorrectly become material deviations.
    """
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="test_differed.csv")
    db.add_all([ws, proj, ds])
    db.flush()

    # 3 outcomes:
    # - outcome 1: MATERIALLY_DIFFERED (delta: +20%, threshold: 5%)
    # - outcome 2: DIFFERED (non-material, delta: +3%, within 5% threshold)
    # - outcome 3: DIFFERED (non-material, delta: +2%, within 5% threshold)
    outcomes_data = [
        ("MATERIALLY_DIFFERED", 0.20, 20.0),
        ("DIFFERED", 0.03, 3.0),
        ("DIFFERED", 0.02, 2.0),
    ]
    for idx, (stat, rel, ab) in enumerate(outcomes_data):
        did = f"DEC_DIFF_{idx}_{uuid.uuid4().hex[:6]}"
        app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=did, recommendation_id=did, status="APPROVED")
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=did,
            recommendation_id=did,
            expected_metric="supply_expense",
            expected_value=100.0,
            actual_metric="supply_expense",
            actual_value=100.0 + ab,
            absolute_delta=ab,
            relative_delta=rel,
            threshold_used=0.05,
            outcome_status=stat,
        )
        db.add_all([app, out])
    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id, min_observations=3)
    metric_item = next((m for m in res.metrics_patterns if m.metric_name == "supply_expense"), None)
    assert metric_item is not None
    assert metric_item.observed_outcomes_count == 3
    # Exactly 1 material deviation, the two DIFFERED are non-material!
    assert metric_item.material_deviations_count == 1

    # Because material deviations is 1/3 (33.3% < 50%), this is NOT a recurring deviation
    rec_diff = [r for r in res.recurring_deviations if r.metric_name == "supply_expense"]
    assert len(rec_diff) == 0


def test_09e_exact_threshold_boundary_four_outcomes(db: Session):
    """
    Exact boundary check:
    - 2 of 4 material deviations -> 2/4 = 50.0% >= 50% -> recurring
    - 1 of 4 material deviations -> 1/4 = 25.0% < 50% -> not recurring
    """
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="test_boundary.csv")
    db.add_all([ws, proj, ds])
    db.flush()

    # Metric A: 2 of 4 material
    for i in range(4):
        did = f"DEC_BND_A_{i}_{uuid.uuid4().hex[:6]}"
        app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=did, recommendation_id=did, status="APPROVED")
        is_mat = (i < 2)  # 2 material, 2 matched
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=did,
            recommendation_id=did,
            expected_metric="metric_boundary_50",
            expected_value=50.0,
            actual_metric="metric_boundary_50",
            actual_value=80.0 if is_mat else 50.1,
            absolute_delta=30.0 if is_mat else 0.1,
            relative_delta=0.60 if is_mat else 0.002,
            outcome_status="MATERIALLY_DIFFERED" if is_mat else "MATCHED",
        )
        db.add_all([app, out])

    # Metric B: 1 of 4 material
    for i in range(4):
        did = f"DEC_BND_B_{i}_{uuid.uuid4().hex[:6]}"
        app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=did, recommendation_id=did, status="APPROVED")
        is_mat = (i == 0)  # 1 material, 3 matched
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=did,
            recommendation_id=did,
            expected_metric="metric_boundary_25",
            expected_value=50.0,
            actual_metric="metric_boundary_25",
            actual_value=80.0 if is_mat else 50.1,
            absolute_delta=30.0 if is_mat else 0.1,
            relative_delta=0.60 if is_mat else 0.002,
            outcome_status="MATERIALLY_DIFFERED" if is_mat else "MATCHED",
        )
        db.add_all([app, out])

    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id, min_observations=3)
    rec_50 = [r for r in res.recurring_deviations if r.metric_name == "metric_boundary_50"]
    rec_25 = [r for r in res.recurring_deviations if r.metric_name == "metric_boundary_25"]

    # 2 of 4 = 50% -> recurring
    assert len(rec_50) == 1
    assert rec_50[0].material_deviations_count == 2
    assert rec_50[0].observed_outcomes_count == 4

    # 1 of 4 = 25% -> NOT recurring
    assert len(rec_25) == 0


def test_10_minimum_observation_protection(db: Session, portfolio_setup):
    """Recurring deviation is suppressed if observations < min_observations."""
    proj_id = portfolio_setup["project"].id
    # Setting min_observations=4 suppresses finding for 3 observations
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, min_observations=4)
    assert len(res.recurring_deviations) == 0


def test_10b_fewer_than_three_observations_never_recurring(db: Session):
    """Fewer than 3 observations is NEVER recurring, even if 100% of outcomes materially deviated."""
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="test_few_obs.csv")
    db.add_all([ws, proj, ds])
    db.flush()

    # 2 observations, both materially differed (100% rate, but N = 2 < 3)
    for i in range(2):
        did = f"DEC_FEW_{i}_{uuid.uuid4().hex[:6]}"
        app = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds.id, decision_id=did, recommendation_id=did, status="APPROVED")
        out = DecisionOutcome(
            id=str(uuid.uuid4()),
            project_id=proj.id,
            dataset_id=ds.id,
            decision_id=did,
            recommendation_id=did,
            expected_metric="experimental_kpi",
            expected_value=10.0,
            actual_metric="experimental_kpi",
            actual_value=25.0,
            absolute_delta=15.0,
            relative_delta=1.5,
            outcome_status="MATERIALLY_DIFFERED",
        )
        db.add_all([app, out])
    db.commit()

    # Default min_observations = 3
    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id, min_observations=3)
    rec_exp = [r for r in res.recurring_deviations if r.metric_name == "experimental_kpi"]
    assert len(rec_exp) == 0


def test_11_decision_trend_aggregation(db: Session, portfolio_setup):
    """Chronological trend groups events by period without date fabrication."""
    proj_id = portfolio_setup["project"].id
    trends_res = DecisionPortfolioService.get_decision_trends(db, proj_id, period="week")

    assert trends_res.project_id == proj_id
    assert trends_res.period == "week"
    assert len(trends_res.trends) > 0
    total_created = sum(t.decisions_created for t in trends_res.trends)
    assert total_created >= 4


def test_12_explicit_dependency_detection(db: Session, portfolio_setup):
    """Explicit shared relationships are detected and grouped."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    assert len(res.dependencies) > 0


def test_13_shared_dataset_detection(db: Session, portfolio_setup):
    """Decisions sharing the same dataset version produce a DATASET_VERSION dependency."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    ds_deps = [d for d in res.dependencies if d.entity_type == "DATASET_VERSION"]

    assert len(ds_deps) > 0
    # ds1 is shared by d1, d2, d3
    ds1_dep = next((d for d in ds_deps if portfolio_setup["dataset1"].id in d.entity_id), None)
    assert ds1_dep is not None
    assert ds1_dep.decision_count == 3


def test_14_shared_scenario_detection(db: Session, portfolio_setup):
    """Decisions sharing the same scenario produce a SCENARIO dependency."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    sc_deps = [d for d in res.dependencies if d.entity_type == "SCENARIO"]

    assert len(sc_deps) > 0
    assert sc_deps[0].decision_count == 3


def test_15_shared_model_detection_only_with_explicit_linkage(db: Session, portfolio_setup):
    """Shared ML model dependency is strictly produced ONLY when explicit MLAnalysis is linked."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    ml_deps = [d for d in res.dependencies if d.entity_type == "ML_MODEL"]

    assert len(ml_deps) > 0
    assert ml_deps[0].entity_id == portfolio_setup["ml1"].id
    assert ml_deps[0].decision_count == 3


def test_16_source_decision_traceability(db: Session, portfolio_setup):
    """Findings include traceable lists of source decision IDs."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    rec = res.recurring_deviations[0]

    assert len(rec.decision_ids) == 3
    assert portfolio_setup["d1_id"] in rec.decision_ids
    assert portfolio_setup["d2_id"] in rec.decision_ids
    assert portfolio_setup["d3_id"] in rec.decision_ids


def test_17_source_outcome_traceability(db: Session, portfolio_setup):
    """Findings include traceable lists of source outcome IDs."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    rec = res.recurring_deviations[0]

    assert len(rec.source_outcome_ids) == 2
    assert portfolio_setup["out2"].id in rec.source_outcome_ids
    assert portfolio_setup["out3"].id in rec.source_outcome_ids


def test_18_project_isolation(db: Session, portfolio_setup):
    """Project A decisions never appear in Project B portfolio."""
    # Create distinct Project B
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=portfolio_setup["workspace"].id, name="Project B")
    db.add(proj_b)
    db.commit()

    res_b = DecisionPortfolioService.get_portfolio_overview(db, proj_b.id)
    assert res_b.total_decisions_count == 0
    assert res_b.decisions == []
    assert res_b.metrics_patterns == []


def test_19_dataset_lineage_isolation(db: Session, portfolio_setup):
    """Dataset versions preserve distinct identity without merging unrelated datasets."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    ds_deps = [d for d in res.dependencies if d.entity_type == "DATASET_VERSION"]

    # ds1 and ds2 should not be merged into one dependency
    entity_ids = [d.entity_id for d in ds_deps]
    assert len(set(entity_ids)) == len(entity_ids)


def test_20_date_filtering(db: Session, portfolio_setup):
    """Filtering by date_from and date_to restricts returned decisions."""
    proj_id = portfolio_setup["project"].id
    cutoff = utc_now() - timedelta(days=3)
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, date_from=cutoff)

    for row in res.decisions:
        assert row.created_at >= cutoff


def test_21_governance_filtering(db: Session, portfolio_setup):
    """Filtering by governance_status restricts returned decisions."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, governance_status_filter="UNDER_REVIEW")

    assert len(res.decisions) == 1
    assert res.decisions[0].governance_status == "UNDER_REVIEW"
    assert res.decisions[0].decision_id == portfolio_setup["d4_id"]


def test_22_execution_filtering(db: Session, portfolio_setup):
    """Filtering by execution_status restricts returned decisions."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, execution_status_filter="EXECUTION_FAILED")

    assert len(res.decisions) == 1
    assert res.decisions[0].execution_status == "EXECUTION_FAILED"
    assert res.decisions[0].decision_id == portfolio_setup["d5_id"]


def test_23_outcome_filtering(db: Session, portfolio_setup):
    """Filtering by outcome_status restricts returned decisions."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, outcome_status_filter="MATCHED")

    assert len(res.decisions) == 1
    assert res.decisions[0].outcome_status == "MATCHED"
    assert res.decisions[0].decision_id == portfolio_setup["d1_id"]


def test_24_metric_filtering(db: Session, portfolio_setup):
    """Filtering by metric restricts returned decisions."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, metric_filter="operating_cost")

    assert len(res.decisions) == 3
    for d in res.decisions:
        assert d.metric == "operating_cost"


def test_25_signal_type_filtering(db: Session, portfolio_setup):
    """Filtering by signal_type restricts returned decisions to those with active signals of that type."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id, signal_type_filter="PREDICTION_DEVIATION")

    assert len(res.decisions) == 3
    returned_ids = {d.decision_id for d in res.decisions}
    assert portfolio_setup["d1_id"] in returned_ids
    assert portfolio_setup["d2_id"] in returned_ids
    assert portfolio_setup["d3_id"] in returned_ids


def test_26_no_fabricated_dependencies(db: Session):
    """Decisions without shared entities produce zero false dependencies."""
    ws = Workspace(id=str(uuid.uuid4()), name="Solo WS")
    db.add(ws)
    db.flush()
    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Solo Proj")
    db.add(proj)
    db.flush()

    # Two separate datasets and decisions with no shared attributes
    dsA = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="A.csv", version=1)
    dsB = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="B.csv", version=1)
    db.add_all([dsA, dsB])
    db.flush()

    appA = DecisionApproval(id=str(uuid.uuid4()), dataset_id=dsA.id, decision_id="DEC_A", recommendation_id="DEC_A")
    appB = DecisionApproval(id=str(uuid.uuid4()), dataset_id=dsB.id, decision_id="DEC_B", recommendation_id="DEC_B")
    db.add_all([appA, appB])
    db.commit()

    res = DecisionPortfolioService.get_portfolio_overview(db, proj.id)
    assert len(res.dependencies) == 0


def test_27_no_fabricated_portfolio_scores(db: Session, portfolio_setup):
    """Verify response contains no synthetic scores (quality score, health score, impact score)."""
    proj_id = portfolio_setup["project"].id
    res = DecisionPortfolioService.get_portfolio_overview(db, proj_id)
    res_dict = res.model_dump()

    # Disallowed synthetic scoring keys
    forbidden_keys = [
        "portfolio_score",
        "decision_quality_score",
        "business_impact_score",
        "health_score",
        "overall_score",
    ]
    for k in forbidden_keys:
        assert k not in res_dict
        assert k not in res_dict["kpis"]


def test_28_no_mutation_of_decisions(db: Session, portfolio_setup):
    """Portfolio read-only operations never mutate decision records."""
    proj_id = portfolio_setup["project"].id
    dec_count_before = db.query(DecisionApproval).count()

    DecisionPortfolioService.get_portfolio_overview(db, proj_id)

    dec_count_after = db.query(DecisionApproval).count()
    assert dec_count_before == dec_count_after


def test_29_no_mutation_of_governance(db: Session, portfolio_setup):
    """Portfolio service call does not mutate approval records."""
    app_before = db.scalar(select(DecisionApproval).where(DecisionApproval.decision_id == portfolio_setup["d4_id"]))
    status_before = app_before.status

    DecisionPortfolioService.get_portfolio_overview(db, portfolio_setup["project"].id)

    db.refresh(app_before)
    assert app_before.status == status_before


def test_30_no_mutation_of_executions(db: Session, portfolio_setup):
    """Portfolio service call does not mutate execution records."""
    exc_before = db.scalar(select(DecisionExecution).where(DecisionExecution.decision_id == portfolio_setup["d5_id"]))
    status_before = exc_before.status

    DecisionPortfolioService.get_portfolio_overview(db, portfolio_setup["project"].id)

    db.refresh(exc_before)
    assert exc_before.status == status_before


def test_31_phase_10_behavior_unchanged(db: Session, portfolio_setup):
    """Phase 10 execution API continues to function normally."""
    d1_id = portfolio_setup["d1_id"]
    response = client.get(f"/api/v1/decisions/{d1_id}/execution")
    assert response.status_code == 200
    data = response.json()
    assert data["is_approved"] is True
    assert data["status"] == "EXECUTED"


def test_32_phase_9_behavior_unchanged(db: Session, portfolio_setup):
    """Phase 9 governance API continues to function normally."""
    d1_id = portfolio_setup["d1_id"]
    response = client.get(f"/api/v1/decisions/{d1_id}/governance")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"


def test_33_phase_8_behavior_unchanged(db: Session, portfolio_setup):
    """Phase 8 learning signals API continues to function normally."""
    proj_id = portfolio_setup["project"].id
    response = client.get(f"/api/v1/projects/{proj_id}/learning-signals")
    assert response.status_code == 200


def test_34_phase_7_behavior_unchanged(db: Session, portfolio_setup):
    """Phase 7 performance intelligence API continues to function normally."""
    proj_id = portfolio_setup["project"].id
    response = client.get(f"/api/v1/projects/{proj_id}/decision-performance")
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == proj_id


def test_35_phase_6_behavior_unchanged(db: Session, portfolio_setup):
    """Phase 6 outcome tracking API continues to function normally."""
    d1_id = portfolio_setup["d1_id"]
    response = client.get(f"/api/v1/decisions/{d1_id}/outcomes")
    assert response.status_code == 200
    data = response.json()
    assert data["current_status"] == "MATCHED"


def test_36_phase_5_behavior_unchanged(db: Session, portfolio_setup):
    """Phase 5 decision evidence graph API continues to function normally."""
    d1_id = portfolio_setup["d1_id"]
    response = client.get(f"/api/v1/decisions/{d1_id}/evidence")
    assert response.status_code == 200
