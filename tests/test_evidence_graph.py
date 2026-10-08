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
from app.models.insight import DatasetInsight
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.evidence_edge import EvidenceEdge
from app.services.evidence_service import EvidenceService

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_project(db_session: Session):
    ws = Workspace(id=str(uuid.uuid4()), name=f"WS_{uuid.uuid4().hex[:6]}")
    db_session.add(ws)
    db_session.flush()

    proj = Project(id=str(uuid.uuid4()), workspace_id=ws.id, name=f"Proj_{uuid.uuid4().hex[:6]}")
    db_session.add(proj)
    db_session.commit()

    yield ws, proj

    # Cleanup
    db_session.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj.id).delete()
    db_session.query(Project).filter(Project.id == proj.id).delete()
    db_session.query(Workspace).filter(Workspace.id == ws.id).delete()
    db_session.commit()


def test_evidence_edge_idempotency_unique_constraint(db_session: Session, sample_project):
    ws, proj = sample_project

    edge1 = EvidenceService.record_edge(
        db=db_session,
        project_id=proj.id,
        source_type="DATASET_VERSION",
        source_id="ds-001",
        target_type="ANALYSIS_RUN",
        target_id="run-001",
        relationship_type="PRODUCED",
        metadata={"step": 1},
    )
    assert edge1 is not None
    assert edge1.id is not None

    # Duplicate call with updated metadata
    edge2 = EvidenceService.record_edge(
        db=db_session,
        project_id=proj.id,
        source_type="DATASET_VERSION",
        source_id="ds-001",
        target_type="ANALYSIS_RUN",
        target_id="run-001",
        relationship_type="PRODUCED",
        metadata={"step": 2, "updated": True},
    )
    assert edge2.id == edge1.id
    assert edge2.metadata_json.get("step") == 2

    # Verify in DB only 1 record exists
    count = db_session.query(EvidenceEdge).filter(
        EvidenceEdge.project_id == proj.id,
        EvidenceEdge.source_id == "ds-001",
        EvidenceEdge.target_id == "run-001",
    ).count()
    assert count == 1


def test_dataset_version_to_analysis_run_edge(db_session: Session, sample_project):
    ws, proj = sample_project

    raw_ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="Hospital_Data.csv",
        version=1,
        is_processed=False,
        status="ready",
    )
    db_session.add(raw_ds)
    db_session.commit()

    run = AnalysisRun(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=raw_ds.id,
        dataset_version=1,
        run_type="EDA",
        status="COMPLETED",
        configuration={},
        input_artifacts={},
        output_artifacts={},
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        duration_ms=50,
    )
    db_session.add(run)
    db_session.commit()

    # Index evidence
    count = EvidenceService.index_entity_evidence(db_session, raw_ds.id)
    assert count >= 1

    graph = EvidenceService.get_dataset_evidence_graph(db_session, raw_ds.id)
    assert graph.root_node_id == raw_ds.id
    assert any(n.id == run.id and n.type == "ANALYSIS_RUN" for n in graph.nodes)
    assert any(e.source == raw_ds.id and e.target == run.id and e.relationship_type == "PRODUCED" for e in graph.edges)


def test_analysis_run_to_insight_edge(db_session: Session, sample_project):
    ws, proj = sample_project

    raw_ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="Hospital_Data.csv",
        version=1,
        is_processed=False,
        status="ready",
    )
    db_session.add(raw_ds)
    db_session.commit()

    ins_id = f"ins-{uuid.uuid4().hex[:8]}"
    run = AnalysisRun(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=raw_ds.id,
        dataset_version=1,
        run_type="INSIGHTS",
        status="COMPLETED",
        configuration={},
        input_artifacts={},
        output_artifacts={
            "insights": [
                {
                    "id": ins_id,
                    "title": "High Readmission in Geriatrics",
                    "category": "CORRELATION",
                }
            ]
        },
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        duration_ms=60,
    )
    db_session.add(run)
    db_session.commit()

    EvidenceService.index_entity_evidence(db_session, raw_ds.id)
    run_graph = EvidenceService.get_run_evidence_graph(db_session, run.id)

    assert any(n.id == ins_id and n.type == "INSIGHT" for n in run_graph.nodes)
    assert any(e.source == run.id and e.target == ins_id and e.relationship_type == "PRODUCED" for e in run_graph.edges)


def test_prediction_to_optimization_edge(db_session: Session, sample_project):
    ws, proj = sample_project

    raw_ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="Hospital_Data.csv",
        version=1,
        is_processed=False,
        status="ready",
    )
    db_session.add(raw_ds)
    db_session.commit()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        task_type="regression",
        target_column="length_of_stay",
        feature_columns=["age", "comorbidities"],
        model_name="RandomForestRegressor",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        ml_analysis_id=ml.id,
        objective="minimize",
        target_column="length_of_stay",
        baseline_prediction=6.5,
        recommended_prediction=4.8,
        expected_change=-1.7,
        status="completed",
    )
    db_session.add(opt)
    db_session.commit()

    EvidenceService.index_entity_evidence(db_session, raw_ds.id)
    graph = EvidenceService.get_dataset_evidence_graph(db_session, raw_ds.id)

    assert any(n.id == ml.id and n.type == "PREDICTION" for n in graph.nodes)
    assert any(n.id == opt.id and n.type == "OPTIMIZATION" for n in graph.nodes)
    assert any(e.source == ml.id and e.target == opt.id and e.relationship_type == "OPTIMIZED_FROM" for e in graph.edges)


def test_optimization_to_recommendation_and_decision_chain(db_session: Session, sample_project):
    ws, proj = sample_project

    raw_ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="Hospital_Data.csv",
        version=1,
        is_processed=False,
        status="ready",
    )
    db_session.add(raw_ds)
    db_session.commit()

    # 1. ML Analysis
    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        task_type="regression",
        target_column="readmission_rate",
        feature_columns=["nurse_ratio", "discharge_followup"],
        model_name="GradientBoostingRegressor",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    # 2. Optimization
    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        ml_analysis_id=ml.id,
        objective="minimize",
        target_column="readmission_rate",
        baseline_prediction=18.0,
        recommended_prediction=12.5,
        status="completed",
    )
    db_session.add(opt)
    db_session.commit()

    # 3. Recommendation Evaluation
    ins_id = f"ins-{uuid.uuid4().hex[:6]}"
    rec = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="OPTIMIZATION",
        title="Increase Nurse-to-Patient Ratio in Geriatrics",
        target_metric="readmission_rate",
        baseline_value=18.0,
        projected_value=12.5,
        absolute_delta=-5.5,
        percentage_delta=-30.5,
        rationale="Increasing nurse staffing reduces unmonitored post-op complications.",
        tradeoffs="Higher hourly staffing cost vs lower readmission penalty.",
        confidence="STRONG",
        evidence={"insight_ids": [ins_id]},
    )
    db_session.add(rec)
    db_session.commit()

    # 4. Decision Approval
    dec_id = f"dec-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
        actor_type="EXECUTIVE",
        reason="Budget reallocation approved for Q4.",
    )
    db_session.add(appr)
    db_session.commit()

    # 5. Guardrail Evaluation
    gr = DecisionGuardrailEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_id=rec.id,
        decision_status="READY_TO_CONSIDER",
        risk_level="LOW",
        guardrail_results=[],
        passed_rules=["budget_feasibility", "regulatory_compliance"],
        warnings=[],
        violated_rules=[],
        explanation="Staffing ratio satisfies statutory minimums.",
    )
    db_session.add(gr)
    db_session.commit()

    # Verify decision backward provenance chain
    chain = EvidenceService.get_decision_evidence_chain(db_session, dec_id)
    assert chain.decision_id == dec_id
    assert chain.recommendation_id == rec.id
    assert chain.summary["has_optimization"] is True
    assert chain.summary["has_guardrail"] is True

    node_types = [n.type for n in chain.nodes]
    assert "RECOMMENDATION" in node_types
    assert "OPTIMIZATION" in node_types
    assert "PREDICTION" in node_types
    assert "DECISION" in node_types
    assert "GUARDRAIL" in node_types


def test_missing_edge_honesty_no_fabricated_links(db_session: Session, sample_project):
    """
    When an ML prediction exists directly on a dataset without an insight,
    or a recommendation exists without an optimization,
    the evidence chain must honestly omit those missing stages rather than inventing them.
    """
    ws, proj = sample_project

    raw_ds = Dataset(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        name="Direct_Data.csv",
        version=1,
        is_processed=False,
        status="ready",
    )
    db_session.add(raw_ds)
    db_session.commit()

    # ML Analysis created without any insight
    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        task_type="regression",
        target_column="costs",
        feature_columns=["hours"],
        model_name="LinearRegression",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    # Recommendation based directly on ML, NO optimization performed, NO insights linked
    rec = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        ml_analysis_id=ml.id,
        insight_id=None,
        title="Direct Action without Optimization",
        recommendation_type="DIRECT",
        impact_level="medium",
        expected_impact="Direct model deployment without scenario optimization.",
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-direct-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=raw_ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    chain = EvidenceService.get_decision_evidence_chain(db_session, dec_id)
    node_types = [n.type for n in chain.nodes]

    # Verify honest absence: NO fabricated INSIGHT or OPTIMIZATION nodes!
    assert "INSIGHT" not in node_types
    assert "OPTIMIZATION" not in node_types
    assert chain.summary["has_insight_support"] is False
    assert chain.summary["has_optimization"] is False


def test_cross_project_isolation(db_session: Session, sample_project):
    ws1, proj1 = sample_project

    # Create Project 2
    proj2 = Project(id=str(uuid.uuid4()), workspace_id=ws1.id, name="Project_B")
    db_session.add(proj2)
    db_session.commit()

    ds1 = Dataset(id=str(uuid.uuid4()), project_id=proj1.id, name="Data_A.csv", version=1, is_processed=False, status="ready")
    ds2 = Dataset(id=str(uuid.uuid4()), project_id=proj2.id, name="Data_B.csv", version=1, is_processed=False, status="ready")
    db_session.add_all([ds1, ds2])
    db_session.commit()

    # Create edges in proj1 and proj2
    EvidenceService.record_edge(db_session, proj1.id, "DATASET_VERSION", ds1.id, "ANALYSIS_RUN", "run-A", "PRODUCED")
    EvidenceService.record_edge(db_session, proj2.id, "DATASET_VERSION", ds2.id, "ANALYSIS_RUN", "run-B", "PRODUCED")

    # Query Project 1
    g1 = EvidenceService.get_project_evidence_graph(db_session, proj1.id)
    assert any(e.source == ds1.id for e in g1.edges)
    assert not any(e.source == ds2.id for e in g1.edges)
    assert not any(n.id == "run-B" for n in g1.nodes)

    # Cleanup proj2
    db_session.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj2.id).delete()
    db_session.delete(ds2)
    db_session.delete(proj2)
    db_session.commit()


def test_cross_lineage_isolation(db_session: Session, sample_project):
    ws, proj = sample_project

    ds_hospital = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Hospital_Data.csv", version=1, is_processed=False, status="ready")
    ds_patient = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Patient_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add_all([ds_hospital, ds_patient])
    db_session.commit()

    EvidenceService.record_edge(db_session, proj.id, "DATASET_VERSION", ds_hospital.id, "ANALYSIS_RUN", "run-hosp", "PRODUCED")
    EvidenceService.record_edge(db_session, proj.id, "DATASET_VERSION", ds_patient.id, "ANALYSIS_RUN", "run-pat", "PRODUCED")

    g_hosp = EvidenceService.get_dataset_evidence_graph(db_session, ds_hospital.id)
    assert any(n.id == ds_hospital.id for n in g_hosp.nodes)
    assert any(n.id == "run-hosp" for n in g_hosp.nodes)
    # Patient Data must NOT leak into Hospital Data graph
    assert not any(n.id == ds_patient.id for n in g_hosp.nodes)
    assert not any(n.id == "run-pat" for n in g_hosp.nodes)


def test_project_evidence_endpoint(sample_project):
    ws, proj = sample_project
    resp = client.get(f"/api/v1/projects/{proj.id}/evidence")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == proj.id
    assert "nodes" in data
    assert "edges" in data
    assert "counters" in data


def test_dataset_evidence_endpoint(db_session: Session, sample_project):
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="API_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    resp = client.get(f"/api/v1/datasets/{ds.id}/evidence")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == proj.id
    assert data["dataset_id"] == ds.id
    assert len(data["nodes"]) >= 1
    assert data["nodes"][0]["id"] == ds.id


def test_run_evidence_endpoint(db_session: Session, sample_project):
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Run_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    run = AnalysisRun(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=ds.id,
        dataset_version=1,
        run_type="EDA",
        status="COMPLETED",
        configuration={},
        input_artifacts={},
        output_artifacts={},
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        duration_ms=40,
    )
    db_session.add(run)
    db_session.commit()

    resp = client.get(f"/api/v1/runs/{run.id}/evidence")
    assert resp.status_code == 200
    data = resp.json()
    assert data["root_node_id"] == run.id
    assert any(n["id"] == run.id for n in data["nodes"])


def test_node_evidence_endpoint(db_session: Session, sample_project):
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Node_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    resp = client.get(f"/api/v1/evidence/DATASET_VERSION/{ds.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["root_node_id"] == ds.id


def test_decision_evidence_endpoint(db_session: Session, sample_project):
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Decision_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        task_type="regression",
        target_column="waiting_time",
        feature_columns=["nurses"],
        model_name="RandomForestRegressor",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        objective="minimize",
        target_column="waiting_time",
        baseline_prediction=45.0,
        recommended_prediction=30.0,
        status="completed",
    )
    db_session.add(opt)
    db_session.commit()

    rec = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="OPTIMIZATION",
        title="Reduce Waiting Times in ER",
        target_metric="waiting_time",
        rationale="Optimized nurse allocation.",
        tradeoffs="None",
        confidence="STRONG",
        evidence={},
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-ep-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    resp = client.get(f"/api/v1/decisions/{dec_id}/evidence")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision_id"] == dec_id
    assert data["recommendation_id"] == rec.id
    assert len(data["nodes"]) >= 2
    assert "summary" in data


def test_raw_to_processed_dataset_derivation_edge(db_session: Session, sample_project):
    ws, proj = sample_project
    raw_ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Raw.csv", version=1, is_processed=False, status="ready")
    db_session.add(raw_ds)
    db_session.commit()

    proc_ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="cleaned_Raw.csv", version=1, is_processed=True, parent_id=raw_ds.id, status="processed")
    db_session.add(proc_ds)
    db_session.commit()

    EvidenceService.index_entity_evidence(db_session, proc_ds.id)
    graph = EvidenceService.get_dataset_evidence_graph(db_session, raw_ds.id)

    assert any(e.source == raw_ds.id and e.target == proc_ds.id and e.relationship_type == "DERIVED_FROM" for e in graph.edges)


def test_dangling_ids_rejected_and_no_inferred_run_edges(db_session: Session, sample_project):
    """Audit test: confirm dangling IDs are rejected and unlinked insights do NOT infer a run solely from dataset_id."""
    ws, proj = sample_project

    # 1. Reject empty/null/whitespace IDs
    with pytest.raises(ValueError, match="source_id cannot be empty"):
        EvidenceService.record_edge(
            db=db_session,
            project_id=proj.id,
            source_type="DATASET_VERSION",
            source_id="",
            target_type="ANALYSIS_RUN",
            target_id="run-123",
            relationship_type="PRODUCED",
        )

    with pytest.raises(ValueError, match="target_id cannot be empty"):
        EvidenceService.record_edge(
            db=db_session,
            project_id=proj.id,
            source_type="DATASET_VERSION",
            source_id="ds-123",
            target_type="ANALYSIS_RUN",
            target_id="   ",
            relationship_type="PRODUCED",
        )

    # 2. Confirm no inferred ANALYSIS_RUN -> INSIGHT edge when run did NOT output the insight
    raw_ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Audit_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(raw_ds)
    db_session.commit()

    # Run on raw_ds that produced DIFFERENT insight "ins-aaa"
    run = AnalysisRun(
        id=str(uuid.uuid4()),
        project_id=proj.id,
        dataset_id=raw_ds.id,
        dataset_version=1,
        run_type="INSIGHTS",
        status="COMPLETED",
        output_artifacts={"insights": [{"id": "ins-aaa", "title": "Insight AAA"}]},
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(run)

    # Standalone table insight "ins-bbb" on raw_ds (NOT in run's output_artifacts)
    table_ins = DatasetInsight(
        id=f"ins-bbb-{uuid.uuid4().hex[:6]}",
        dataset_id=raw_ds.id,
        category="KPI",
        severity="INFO",
        title="Insight BBB - Standalone",
        observation="Standalone KPI metric",
        evidence={},
    )
    db_session.add(table_ins)
    db_session.commit()

    EvidenceService.index_entity_evidence(db_session, raw_ds.id)
    graph = EvidenceService.get_dataset_evidence_graph(db_session, raw_ds.id)

    # ins-aaa was produced by run
    assert any(e.source == run.id and e.target == "ins-aaa" for e in graph.edges)

    # ins-bbb was NOT in run's output_artifacts, so it must NOT be linked from run.id!
    assert not any(e.source == run.id and e.target == table_ins.id for e in graph.edges)

    # ins-bbb MUST honestly be linked from raw_ds.id (DATASET_VERSION)
    assert any(e.source == raw_ds.id and e.target == table_ins.id for e in graph.edges)


# =====================================================================
# Phase 5 Performance & Regression Tests
# =====================================================================

def test_regression_decision_evidence_endpoint_returns_normally(db_session: Session, sample_project):
    """Test 1: Decision evidence endpoint returns normally (200 OK) with complete schema."""
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Regression_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        task_type="regression",
        target_column="cost",
        feature_columns=["hours"],
        model_name="Ridge",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        objective="minimize",
        target_column="cost",
        baseline_prediction=100.0,
        recommended_prediction=75.0,
        status="completed",
    )
    db_session.add(opt)
    db_session.commit()

    rec = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="OPTIMIZATION",
        title="Reduce Operational Cost",
        target_metric="cost",
        rationale="Optimize hours allocation.",
        tradeoffs="None",
        confidence="STRONG",
        evidence={},
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-reg-1-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    resp = client.get(f"/api/v1/decisions/{dec_id}/evidence")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision_id"] == dec_id
    assert data["recommendation_id"] == rec.id
    assert len(data["nodes"]) >= 3
    assert len(data["edges"]) >= 2
    assert "summary" in data
    assert data["summary"]["total_nodes"] == len(data["nodes"])
    assert data["summary"]["total_edges"] == len(data["edges"])


def test_regression_decision_evidence_does_not_index_unrelated_project_data(db_session: Session, sample_project):
    """Test 2: Targeted decision indexing does NOT touch or index unrelated datasets/lineages in the project."""
    ws, proj = sample_project

    # Dataset A (Targeted)
    ds_a = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Target_A.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds_a)
    # Dataset B (Unrelated)
    ds_b = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Unrelated_B.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds_b)
    db_session.commit()

    # Lineage A
    ml_a = MLAnalysis(id=str(uuid.uuid4()), dataset_id=ds_a.id, task_type="regression", target_column="y_a", model_name="RidgeA", status="completed")
    db_session.add(ml_a)
    db_session.commit()

    opt_a = DecisionOptimization(id=str(uuid.uuid4()), dataset_id=ds_a.id, ml_analysis_id=ml_a.id, objective="minimize", target_column="y_a", status="completed")
    db_session.add(opt_a)
    db_session.commit()

    rec_a = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds_a.id,
        ml_analysis_id=ml_a.id,
        optimization_id=opt_a.id,
        recommendation_type="OPTIMIZATION",
        title="Rec A",
        target_metric="y_a",
        rationale="Optimize y_a",
        tradeoffs="None",
    )
    db_session.add(rec_a)
    db_session.commit()

    dec_id_a = f"dec-target-a-{uuid.uuid4().hex[:6]}"
    appr_a = DecisionApproval(id=str(uuid.uuid4()), dataset_id=ds_a.id, decision_id=dec_id_a, recommendation_id=rec_a.id, status="APPROVED")
    db_session.add(appr_a)

    # Lineage B (Unrelated - Should NOT be touched or indexed)
    ml_b = MLAnalysis(id=str(uuid.uuid4()), dataset_id=ds_b.id, task_type="regression", target_column="y_b", model_name="RidgeB", status="completed")
    db_session.add(ml_b)
    db_session.commit()

    opt_b = DecisionOptimization(id=str(uuid.uuid4()), dataset_id=ds_b.id, ml_analysis_id=ml_b.id, objective="minimize", target_column="y_b", status="completed")
    db_session.add(opt_b)
    db_session.commit()

    rec_b = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds_b.id,
        ml_analysis_id=ml_b.id,
        optimization_id=opt_b.id,
        recommendation_type="OPTIMIZATION",
        title="Rec B",
        target_metric="y_b",
        rationale="Optimize y_b",
        tradeoffs="None",
    )
    db_session.add(rec_b)
    db_session.commit()

    # Before indexing: 0 edges in project
    assert db_session.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj.id).count() == 0

    # Call get_decision_evidence_chain strictly for Decision A
    chain = EvidenceService.get_decision_evidence_chain(db_session, dec_id_a)
    assert chain is not None
    assert chain.decision_id == dec_id_a

    # Verify: Edges for Lineage A exist
    edges_a = db_session.query(EvidenceEdge).filter(
        EvidenceEdge.project_id == proj.id,
        EvidenceEdge.source_id.in_([dec_id_a, rec_a.id, opt_a.id, ml_a.id, ds_a.id]),
    ).all()
    assert len(edges_a) > 0

    # Verify: ZERO edges were indexed for Unrelated Lineage B
    edges_b = db_session.query(EvidenceEdge).filter(
        EvidenceEdge.project_id == proj.id,
        EvidenceEdge.source_id.in_([rec_b.id, opt_b.id, ml_b.id, ds_b.id]),
    ).all()
    assert len(edges_b) == 0, f"Expected 0 edges for unrelated Lineage B, found {len(edges_b)}"


def test_regression_missing_evidence_returns_empty_edge_state(db_session: Session, sample_project):
    """Test 3: Missing evidence returns incomplete chain state without fabricating upstream relationships."""
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Orphan_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    # DecisionApproval with an orphan recommendation ID that has no upstream optimizations/models
    orphan_dec_id = f"dec-orphan-{uuid.uuid4().hex[:6]}"
    missing_rec_id = f"rec-missing-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=orphan_dec_id,
        recommendation_id=missing_rec_id,
        status="PENDING",
    )
    db_session.add(appr)
    db_session.commit()

    chain = EvidenceService.get_decision_evidence_chain(db_session, orphan_dec_id)
    assert chain is not None
    assert chain.decision_id == orphan_dec_id
    assert chain.recommendation_id == missing_rec_id

    # The missing recommendation has NO upstream edges generated
    upstream_edges = [e for e in chain.edges if e.target == missing_rec_id]
    assert len(upstream_edges) == 0

    # Summary honestly reflects incomplete lineage
    assert chain.summary["has_optimization"] is False
    assert chain.summary["has_insight_support"] is False
    assert chain.summary["is_complete_chain"] is False


def test_regression_existing_evidence_chain_remains_identical(db_session: Session, sample_project):
    """Test 4: Full multi-hop evidence chain matches exact semantic specifications."""
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="E2E_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    ml = MLAnalysis(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        task_type="regression",
        target_column="target",
        feature_columns=["f1"],
        model_name="RandomForest",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    opt = DecisionOptimization(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        objective="maximize",
        target_column="target",
        baseline_prediction=50.0,
        recommended_prediction=80.0,
        status="completed",
    )
    db_session.add(opt)
    db_session.commit()

    rec = DecisionRecommendationEvaluation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        ml_analysis_id=ml.id,
        optimization_id=opt.id,
        recommendation_type="OPTIMIZATION",
        title="Maximize Target Metric",
        target_metric="target",
        rationale="Model optimization achieved 80.0.",
        tradeoffs="None",
        confidence="STRONG",
        evidence={},
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-e2e-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    chain = EvidenceService.get_decision_evidence_chain(db_session, dec_id)
    edge_types = {(e.source, e.target, e.relationship_type) for e in chain.edges}

    # Verify every required relationship is preserved:
    assert (rec.id, dec_id, "RESULTED_IN") in edge_types
    assert (opt.id, rec.id, "GENERATED_FROM") in edge_types
    assert (ml.id, opt.id, "OPTIMIZED_FROM") in edge_types
    assert (ds.id, ml.id, "PRODUCED") in edge_types


def test_regression_cross_project_isolation(db_session: Session, sample_project):
    """Test 5: Cross-project access remains strictly isolated."""
    ws1, proj1 = sample_project

    # Create a second workspace and project
    ws2 = Workspace(id=str(uuid.uuid4()), name="WS_Isolated")
    db_session.add(ws2)
    db_session.flush()
    proj2 = Project(id=str(uuid.uuid4()), workspace_id=ws2.id, name="Proj_Isolated")
    db_session.add(proj2)
    db_session.commit()

    try:
        ds1 = Dataset(id=str(uuid.uuid4()), project_id=proj1.id, name="Proj1_Data.csv", version=1, is_processed=False, status="ready")
        ds2 = Dataset(id=str(uuid.uuid4()), project_id=proj2.id, name="Proj2_Data.csv", version=1, is_processed=False, status="ready")
        db_session.add_all([ds1, ds2])
        db_session.commit()

        # Edge in project 2
        EvidenceService.record_edge(
            db=db_session,
            project_id=proj2.id,
            source_type="DATASET_VERSION",
            source_id=ds2.id,
            target_type="DATASET_VERSION",
            target_id="downstream-ds2",
            relationship_type="DERIVED_FROM",
        )

        # Query project 1 evidence graph
        g1 = EvidenceService.get_project_evidence_graph(db_session, proj1.id)
        assert not any(e.source == ds2.id or e.target == "downstream-ds2" for e in g1.edges)
        assert not any(n.id == ds2.id for n in g1.nodes)
    finally:
        db_session.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj2.id).delete()
        db_session.query(Dataset).filter(Dataset.id == ds2.id).delete()
        db_session.query(Project).filter(Project.id == proj2.id).delete()
        db_session.query(Workspace).filter(Workspace.id == ws2.id).delete()
        db_session.commit()


def test_regression_cross_lineage_isolation(db_session: Session, sample_project):
    """Test 6: Pre-existing edges from unlinked entities are never pulled into targeted decision chain."""
    ws, proj = sample_project

    ds_target = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Target_Lineage.csv", version=1, is_processed=False, status="ready")
    ds_other = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Other_Lineage.csv", version=1, is_processed=False, status="ready")
    db_session.add_all([ds_target, ds_other])
    db_session.commit()

    # Pre-index an edge for ds_other
    EvidenceService.record_edge(
        db=db_session,
        project_id=proj.id,
        source_type="DATASET_VERSION",
        source_id=ds_other.id,
        target_type="ANALYSIS_RUN",
        target_id="run-other-unrelated",
        relationship_type="PRODUCED",
    )

    rec = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds_target.id,
        title="Target Recommendation",
        recommendation_type="optimization",
        expected_impact="High impact",
        evidence_traceability={},
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-isolated-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds_target.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    chain = EvidenceService.get_decision_evidence_chain(db_session, dec_id)
    node_ids = {n.id for n in chain.nodes}

    # ds_other and run-other-unrelated must NEVER be present in chain
    assert ds_other.id not in node_ids
    assert "run-other-unrelated" not in node_ids
    assert not any(e.source == ds_other.id or e.target == "run-other-unrelated" for e in chain.edges)


def test_regression_deduplication_bypasses_redundant_indexing(db_session: Session, sample_project):
    """Test 7: Once edges exist, get_decision_evidence_chain skips redundant indexing entirely."""
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Warm_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    rec = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        title="Warm Rec",
        recommendation_type="optimization",
        expected_impact="Warm impact",
        evidence_traceability={},
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-warm-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    # First call: triggers targeted indexing
    chain1 = EvidenceService.get_decision_evidence_chain(db_session, dec_id)
    edge_count1 = db_session.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj.id).count()
    assert edge_count1 >= 1

    # Second call: edges are already present; targeted indexing is bypassed
    chain2 = EvidenceService.get_decision_evidence_chain(db_session, dec_id)
    edge_count2 = db_session.query(EvidenceEdge).filter(EvidenceEdge.project_id == proj.id).count()
    assert edge_count1 == edge_count2
    assert len(chain1.edges) == len(chain2.edges)


def test_regression_api_error_handling_nonexistent_decision():
    """Test 8: API returns clean 404 for non-existent decision."""
    fake_id = f"dec-nonexistent-{uuid.uuid4().hex}"
    resp = client.get(f"/api/v1/decisions/{fake_id}/evidence")
    assert resp.status_code == 404
    detail = resp.json().get("detail", "")
    assert fake_id in detail and "not found" in detail.lower()


def test_regression_successful_response_contract_completeness(db_session: Session, sample_project):
    """Test 9: Successful API response contract satisfies all required frontend fields."""
    ws, proj = sample_project
    ds = Dataset(id=str(uuid.uuid4()), project_id=proj.id, name="Contract_Data.csv", version=1, is_processed=False, status="ready")
    db_session.add(ds)
    db_session.commit()

    rec = DecisionRecommendation(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        title="Contract Rec",
        recommendation_type="optimization",
        expected_impact="Contract impact",
        evidence_traceability={},
    )
    db_session.add(rec)
    db_session.commit()

    dec_id = f"dec-contract-{uuid.uuid4().hex[:6]}"
    appr = DecisionApproval(
        id=str(uuid.uuid4()),
        dataset_id=ds.id,
        decision_id=dec_id,
        recommendation_id=rec.id,
        status="APPROVED",
    )
    db_session.add(appr)
    db_session.commit()

    resp = client.get(f"/api/v1/decisions/{dec_id}/evidence")
    assert resp.status_code == 200
    data = resp.json()

    # Verify all expected keys to ensure frontend never hangs on missing attributes
    assert "decision_id" in data and data["decision_id"] == dec_id
    assert "recommendation_id" in data and data["recommendation_id"] == rec.id
    assert "nodes" in data and isinstance(data["nodes"], list)
    assert "edges" in data and isinstance(data["edges"], list)
    assert "summary" in data and isinstance(data["summary"], dict)

    for node in data["nodes"]:
        assert "id" in node
        assert "type" in node
        assert "label" in node
        assert "status" in node
        assert "metadata" in node

    for edge in data["edges"]:
        assert "id" in edge
        assert "source" in edge
        assert "target" in edge
        assert "relationship_type" in edge


