import io
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
from app.models.analysis_run import AnalysisRun
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_outcome import DecisionOutcome
from app.models.evidence_edge import EvidenceEdge
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
def sample_setup(db: Session):
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db.add(ws)
    db.flush()

    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    db.add(proj)
    db.flush()

    # Raw dataset (v1)
    ds_raw = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="sales_raw.csv",
        version=1,
        is_processed=False,
        status="PROCESSED",
    )
    db.add(ds_raw)
    db.flush()

    # Processed child dataset (v1)
    ds_proc = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        parent_id=ds_raw.id,
        name="sales_clean.csv",
        version=1,
        is_processed=True,
        status="PROCESSED",
    )
    db.add(ds_proc)
    db.flush()

    # ML Analysis & Optimization Context
    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds_proc.id,
        target_column="target_revenue",
        task_type="regression",
        model_name="RandomForestRegressor",
        status="COMPLETED",
    )
    db.add(ml)
    db.flush()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds_proc.id,
        ml_analysis_id=ml.id,
        target_column="target_revenue",
        objective="maximize",
        baseline_prediction=500.0,
        recommended_prediction=600.0,
    )
    db.add(opt)
    db.flush()

    # Recommendation / Decision Evaluation
    rec_eval = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds_proc.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="optimization",
        priority=1,
        title="Increase Marketing Budget in APAC",
        target_metric="target_revenue",
        baseline_value=500.0,
        projected_value=600.0,
        absolute_delta=100.0,
        percentage_delta=20.0,
        rationale="Expands market reach",
        tradeoffs="Higher spend",
    )
    db.add(rec_eval)
    db.flush()

    # Approved decision record
    approval = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds_proc.id,
        recommendation_id=rec_eval.id,
        status="APPROVED",
        actor_id="exec_vp",
        reason="Approved Q3 plan",
        decided_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    db.commit()

    yield {
        "workspace": ws,
        "project": proj,
        "raw_dataset": ds_raw,
        "proc_dataset": ds_proc,
        "recommendation": rec_eval,
        "approval": approval,
        "optimization": opt,
        "ml_analysis": ml,
    }

    # Cleanup
    db.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj.id).delete()
    db.query(DecisionOutcome).filter(DecisionOutcome.project_id == proj.id).delete()
    db.query(DecisionApproval).filter(DecisionApproval.dataset_id == ds_proc.id).delete()
    db.query(DecisionRecommendationEvaluation).filter(DecisionRecommendationEvaluation.dataset_id == ds_proc.id).delete()
    db.query(DecisionOptimization).filter(DecisionOptimization.dataset_id == ds_proc.id).delete()
    db.query(MLAnalysis).filter(MLAnalysis.dataset_id == ds_proc.id).delete()
    db.query(Dataset).filter(Dataset.project_id == proj.id).delete()
    db.query(Project).filter(Project.id == proj.id).delete()
    db.query(Workspace).filter(Workspace.id == ws.id).delete()
    db.commit()


# ============================================================================
# 1. Decision without outcome returns status PENDING
# ============================================================================
def test_01_decision_without_outcome_returns_pending(sample_setup):
    rec_id = sample_setup["recommendation"].id
    res = client.get(f"/api/v1/decisions/{rec_id}/outcomes")
    assert res.status_code == 200
    data = res.json()
    assert data["current_status"] == "PENDING"
    assert data["outcomes_count"] == 0
    assert data["latest_outcome"] is None


# ============================================================================
# 2. Missing actual outcome returns learning signal UNAVAILABLE
# ============================================================================
def test_02_missing_actual_outcome_returns_signal_unavailable(sample_setup):
    rec_id = sample_setup["recommendation"].id
    res = client.get(f"/api/v1/decisions/{rec_id}/outcomes")
    assert res.status_code == 200
    data = res.json()
    assert data["learning_signal"] == "UNAVAILABLE"
    assert "No actual" in data["learning_summary"]


# ============================================================================
# 3. Record valid actual outcome
# ============================================================================
def test_03_record_valid_actual_outcome(sample_setup):
    rec_id = sample_setup["recommendation"].id
    payload = {
        "actual_metric": "target_revenue",
        "actual_value": 605.0,
        "notes": "Measured 30 days post-intervention",
    }
    res = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["decision_id"] == rec_id
    assert out["actual_value"] == 605.0
    assert out["expected_value"] == 600.0
    assert out["absolute_delta"] == 5.0
    assert out["outcome_status"] in ["MATCHED", "DIFFERED"]
    assert out["notes"] == "Measured 30 days post-intervention"


# ============================================================================
# 4. Outcome status: MATCHED (actual == expected or within threshold)
# ============================================================================
def test_04_outcome_status_matched(sample_setup):
    rec_id = sample_setup["recommendation"].id
    # Exact match: expected is 600.0, actual is 600.0
    payload = {
        "actual_metric": "target_revenue",
        "actual_value": 600.0,
    }
    res = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["outcome_status"] == "MATCHED"
    assert out["learning_signal"] == "PREDICTION_ACCURACY"
    assert out["absolute_delta"] == 0.0
    assert out["relative_delta"] == 0.0


# ============================================================================
# 5. Outcome status: DIFFERED (difference within threshold)
# ============================================================================
def test_05_outcome_status_differed():
    eval_res = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=100.0,
        actual_value=102.0,  # 2% difference, threshold is 5%
        threshold=0.05,
        metric_name="revenue",
    )
    assert eval_res["outcome_status"] == "DIFFERED"
    assert eval_res["learning_signal"] == "OUTCOME_DEVIATION"
    assert eval_res["absolute_delta"] == 2.0
    assert eval_res["relative_delta"] == 0.02


# ============================================================================
# 6. Outcome status: MATERIALLY_DIFFERED (difference exceeds threshold)
# ============================================================================
def test_06_outcome_status_materially_differed(sample_setup):
    rec_id = sample_setup["recommendation"].id
    # Expected is 600.0. Actual is 750.0 (+25% diff, well exceeds 5% threshold)
    payload = {
        "actual_metric": "target_revenue",
        "actual_value": 750.0,
        "material_difference_threshold": 0.05,
    }
    res = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["outcome_status"] == "MATERIALLY_DIFFERED"
    assert out["learning_signal"] == "OUTCOME_DEVIATION"
    assert out["absolute_delta"] == 150.0
    assert out["relative_delta"] == 0.25


# ============================================================================
# 7. Configurable material difference threshold (e.g. 0.10 vs 0.05)
# ============================================================================
def test_07_configurable_material_difference_threshold(sample_setup):
    rec_id = sample_setup["recommendation"].id
    payload = {
        "actual_metric": "target_revenue",
        "actual_value": 640.0,  # (640 - 600) / 600 = +6.67%
        "material_difference_threshold": 0.10,  # 10% threshold
    }
    res = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["threshold_used"] == 0.10
    # 6.67% is within 10% threshold -> DIFFERED, not MATERIALLY_DIFFERED
    assert out["outcome_status"] == "DIFFERED"


# ============================================================================
# 8. Custom threshold correctly determines MATERIALLY_DIFFERED vs DIFFERED
# ============================================================================
def test_08_custom_threshold_determines_material_vs_matched():
    # 8% deviation:
    # Under 5% threshold -> MATERIALLY_DIFFERED
    eval_strict = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=100.0,
        actual_value=108.0,
        threshold=0.05,
    )
    assert eval_strict["outcome_status"] == "MATERIALLY_DIFFERED"

    # Under 10% threshold -> DIFFERED
    eval_lenient = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=100.0,
        actual_value=108.0,
        threshold=0.10,
    )
    assert eval_lenient["outcome_status"] == "DIFFERED"


# ============================================================================
# 9. Safe division when expected_value == 0 (no ZeroDivisionError)
# ============================================================================
def test_09_safe_division_when_expected_value_zero():
    # Should evaluate smoothly without throwing exception
    eval_zero = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=0.0,
        actual_value=50.0,
        threshold=0.05,
    )
    assert eval_zero is not None
    assert eval_zero["absolute_delta"] == 50.0


# ============================================================================
# 10. Expected value == 0, actual != 0 -> MATERIALLY_DIFFERED
# ============================================================================
def test_10_expected_value_zero_actual_nonzero_materially_differed():
    eval_res = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=0.0,
        actual_value=-25.0,
        threshold=0.05,
    )
    assert eval_res["outcome_status"] == "MATERIALLY_DIFFERED"
    assert eval_res["learning_signal"] == "OUTCOME_DEVIATION"


# ============================================================================
# 11. Expected value == 0, actual == 0 -> MATCHED, relative_delta == 0
# ============================================================================
def test_11_expected_value_zero_actual_zero_matched():
    eval_res = DecisionOutcomeService.evaluate_decision_outcome_math(
        expected_value=0.0,
        actual_value=0.0,
        threshold=0.05,
    )
    assert eval_res["outcome_status"] == "MATCHED"
    assert eval_res["learning_signal"] == "PREDICTION_ACCURACY"
    assert eval_res["absolute_delta"] == 0.0
    assert eval_res["relative_delta"] == 0.0


# ============================================================================
# 12. Outcome recorded with reference to subsequent dataset version in lineage
# ============================================================================
def test_12_outcome_recorded_with_subsequent_dataset_version_reference(db: Session, sample_setup):
    proj = sample_setup["project"]
    raw_ds = sample_setup["raw_dataset"]
    rec = sample_setup["recommendation"]

    # Create subsequent dataset version (v2) in same project/lineage
    ds_v2 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        parent_id=raw_ds.id,
        name="sales_q4_actuals.csv",
        version=2,
        is_processed=True,
        status="PROCESSED",
        profile_data={"statistics": {"target_revenue": {"mean": 612.0}}},
    )
    db.add(ds_v2)
    db.commit()

    payload = {
        "source_dataset_id": ds_v2.id,
        "metric_name": "target_revenue",
        "material_difference_threshold": 0.05,
        "notes": "Derived from Q4 actual ledger v2",
    }
    res = client.post(f"/api/v1/decisions/{rec.id}/outcomes/from-version", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["actual_value"] == 612.0
    assert out["source_dataset_id"] == ds_v2.id
    assert out["source_dataset_version"] == 2
    assert out["source_dataset_name"] == "sales_q4_actuals.csv"


# ============================================================================
# 13. Outcome rejected if dataset version does not belong to same lineage
# ============================================================================
def test_13_outcome_rejected_if_dataset_version_not_in_same_lineage(db: Session, sample_setup):
    ws = sample_setup["workspace"]
    rec = sample_setup["recommendation"]

    # Foreign project and dataset
    foreign_proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Foreign_Project")
    db.add(foreign_proj)
    db.flush()

    foreign_ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=foreign_proj.id,
        name="foreign_data.csv",
        version=1,
        is_processed=True,
        status="PROCESSED",
    )
    db.add(foreign_ds)
    db.commit()

    payload = {
        "source_dataset_id": foreign_ds.id,
        "metric_name": "target_revenue",
    }
    res = client.post(f"/api/v1/decisions/{rec.id}/outcomes/from-version", json=payload)
    assert res.status_code == 400
    assert "different project" in res.json()["detail"].lower()


# ============================================================================
# 14. Outcome rejected if target metric does not exist in target dataset
# ============================================================================
def test_14_outcome_rejected_if_target_metric_not_in_dataset(db: Session, sample_setup):
    proj = sample_setup["project"]
    raw_ds = sample_setup["raw_dataset"]
    rec = sample_setup["recommendation"]

    ds_v2 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        parent_id=raw_ds.id,
        name="sales_v2.csv",
        version=2,
        is_processed=True,
        status="PROCESSED",
        profile_data={"statistics": {"other_column": {"mean": 10.0}}},
    )
    db.add(ds_v2)
    db.commit()

    payload = {
        "source_dataset_id": ds_v2.id,
        "metric_name": "non_existent_metric",
    }
    res = client.post(f"/api/v1/decisions/{rec.id}/outcomes/from-version", json=payload)
    assert res.status_code == 400
    assert "must exist" in res.json()["detail"].lower()


# ============================================================================
# 15. Outcome recorded with reference to specific AnalysisRun
# ============================================================================
def test_15_outcome_recorded_with_specific_analysis_run_reference(db: Session, sample_setup):
    proj = sample_setup["project"]
    ds_proc = sample_setup["proc_dataset"]
    rec = sample_setup["recommendation"]

    run = AnalysisRun(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds_proc.id,
        dataset_version=1,
        run_type="POST_DECISION_MONITORING",
        status="COMPLETED",
        configuration={},
        input_artifacts={},
        output_artifacts={"target_revenue": 608.0},
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()

    payload = {
        "actual_metric": "target_revenue",
        "actual_value": 608.0,
        "source_analysis_run_id": run.id,
    }
    res = client.post(f"/api/v1/decisions/{rec.id}/outcomes", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["source_analysis_run_id"] == run.id


# ============================================================================
# 16. Outcome history: multiple outcomes recorded for same decision (append-only)
# ============================================================================
def test_16_outcome_history_multiple_outcomes_append_only(sample_setup):
    rec_id = sample_setup["recommendation"].id

    client.post(f"/api/v1/decisions/{rec_id}/outcomes", json={"actual_value": 590.0, "notes": "Week 1"})
    client.post(f"/api/v1/decisions/{rec_id}/outcomes", json={"actual_value": 615.0, "notes": "Week 2"})

    res = client.get(f"/api/v1/decisions/{rec_id}/outcomes")
    assert res.status_code == 200
    data = res.json()
    assert data["outcomes_count"] >= 2
    assert len(data["history"]) >= 2


# ============================================================================
# 17. Outcome history preserves chronological order
# ============================================================================
def test_17_outcome_history_preserves_chronological_order(sample_setup):
    rec_id = sample_setup["recommendation"].id

    res1 = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json={"actual_value": 580.0, "notes": "Observation 1"}).json()
    res2 = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json={"actual_value": 620.0, "notes": "Observation 2"}).json()

    res = client.get(f"/api/v1/decisions/{rec_id}/outcomes")
    history = res.json()["history"]

    # History is sorted newest first
    assert history[0]["id"] == res2["id"]
    assert history[1]["id"] == res1["id"]


# ============================================================================
# 18. Historical outcome records are immutable (not overwritten)
# ============================================================================
def test_18_historical_outcome_records_are_immutable(sample_setup):
    rec_id = sample_setup["recommendation"].id

    # Record first outcome
    first = client.post(
        f"/api/v1/decisions/{rec_id}/outcomes",
        json={"actual_value": 550.0, "notes": "Initial snapshot"}
    ).json()

    # Record second outcome with different value
    second = client.post(
        f"/api/v1/decisions/{rec_id}/outcomes",
        json={"actual_value": 630.0, "notes": "Revised evaluation"}
    ).json()

    # Verify first outcome record retains original unmodified values
    get_first = client.get(f"/api/v1/outcomes/{first['id']}").json()
    assert get_first["actual_value"] == 550.0
    assert get_first["notes"] == "Initial snapshot"
    assert get_first["id"] != second["id"]


# ============================================================================
# 19. Multiple metrics: record outcome for different metric than primary
# ============================================================================
def test_19_multiple_metrics_record_outcome_for_different_metric(sample_setup):
    rec_id = sample_setup["recommendation"].id

    # Primary metric was 'target_revenue'. Record secondary metric 'churn_rate'.
    payload = {
        "actual_metric": "churn_rate",
        "actual_value": 0.04,
        "notes": "Secondary KPI measurement",
    }
    res = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json=payload)
    assert res.status_code == 201
    out = res.json()
    assert out["actual_metric"] == "churn_rate"


# ============================================================================
# 20. Project isolation: outcomes from Project A not visible in Project B
# ============================================================================
def test_20_project_isolation_outcomes_not_visible_across_projects(db: Session, sample_setup):
    ws = sample_setup["workspace"]
    proj_a = sample_setup["project"]
    rec_a = sample_setup["recommendation"]

    # Record outcome in Project A
    client.post(f"/api/v1/decisions/{rec_a.id}/outcomes", json={"actual_value": 605.0})

    # Create Project B
    proj_b = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name="Project_B")
    db.add(proj_b)
    db.commit()

    # Query outcomes for Project B
    res_b = client.get(f"/api/v1/projects/{proj_b.id}/outcomes")
    assert res_b.status_code == 200
    outcomes_b = res_b.json()
    assert len(outcomes_b) == 0

    # Query outcomes for Project A
    res_a = client.get(f"/api/v1/projects/{proj_a.id}/outcomes")
    assert res_a.status_code == 200
    outcomes_a = res_a.json()
    assert len(outcomes_a) >= 1


# ============================================================================
# 21. Evidence graph reflects decision outcome: DECISION -> OUTCOME edge exists
# ============================================================================
def test_21_evidence_graph_decision_to_outcome_edge_exists(db: Session, sample_setup):
    rec_id = sample_setup["recommendation"].id
    proj_id = sample_setup["project"].id

    res = client.post(f"/api/v1/decisions/{rec_id}/outcomes", json={"actual_value": 610.0})
    assert res.status_code == 201
    outcome_id = res.json()["id"]

    # Verify edge exists in evidence_edges table
    edge = db.scalar(
        select(EvidenceEdge).where(
            EvidenceEdge.project_id == proj_id,
            EvidenceEdge.source_id == rec_id,
            EvidenceEdge.target_id == outcome_id,
            EvidenceEdge.relationship_type == "EVALUATED_AGAINST",
        )
    )
    assert edge is not None
    assert edge.source_type == "DECISION"
    assert edge.target_type == "OUTCOME"


# ============================================================================
# 22. Evidence graph reflects outcome source: OUTCOME -> DATASET_VERSION edge exists
# ============================================================================
def test_22_evidence_graph_outcome_to_dataset_version_edge_exists(db: Session, sample_setup):
    proj = sample_setup["project"]
    raw_ds = sample_setup["raw_dataset"]
    rec = sample_setup["recommendation"]

    ds_v3 = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        parent_id=raw_ds.id,
        name="sales_v3.csv",
        version=3,
        is_processed=True,
        status="PROCESSED",
        profile_data={"statistics": {"target_revenue": {"mean": 595.0}}},
    )
    db.add(ds_v3)
    db.commit()

    res = client.post(
        f"/api/v1/decisions/{rec.id}/outcomes/from-version",
        json={"source_dataset_id": ds_v3.id, "metric_name": "target_revenue"}
    )
    assert res.status_code == 201
    outcome_id = res.json()["id"]

    # Verify edge OUTCOME -> DATASET_VERSION
    edge = db.scalar(
        select(EvidenceEdge).where(
            EvidenceEdge.project_id == proj.id,
            EvidenceEdge.source_id == outcome_id,
            EvidenceEdge.target_id == ds_v3.id,
            EvidenceEdge.relationship_type == "MEASURED_FROM",
        )
    )
    assert edge is not None
    assert edge.source_type == "OUTCOME"
    assert edge.target_type == "DATASET_VERSION"
