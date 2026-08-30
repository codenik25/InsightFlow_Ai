import pytest
from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_brief import DecisionBrief

from app.services.action_gate_service import ActionGateService
from app.services.outcome_service import DecisionOutcomeService
from app.services.impact_service import DecisionImpactService
from app.services.audit_service import DecisionAuditService
from app.services.ai_evaluation_service import AIEvaluationService
from app.schemas.outcome import DecisionOutcomeCreate
from app.schemas.impact import ImpactMeasurementCreate
from app.schemas.ai_evaluation import AIEvaluationRequest


def setup_phase8_dataset(db_session):
    ds = Dataset(
        name="test_integration.csv",
        file_path="/tmp/test_integration.csv",
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)

    ml_an = MLAnalysis(
        dataset_id=ds.id,
        task_type="regression",
        target_column="throughput",
        feature_columns=["input_units"],
        model_name="RandomForest",
        metrics={"r2": 0.95},
    )

    db_session.add(ml_an)
    db_session.commit()
    db_session.refresh(ml_an)

    opt = DecisionOptimization(
        dataset_id=ds.id,
        ml_analysis_id=ml_an.id,
        objective="maximize",
        target_column="throughput",
        baseline_prediction=400.0,
        recommended_prediction=500.0,
    )

    db_session.add(opt)
    db_session.commit()
    db_session.refresh(opt)

    rec = DecisionRecommendation(
        dataset_id=ds.id,
        ml_analysis_id=ml_an.id,
        title="Optimize Supply Allocation",
        recommendation_type="optimization",
        impact_level="high",
        expected_impact="Increase throughput to 500 units",
        action_items=[],
        evidence_traceability={"optimization_id": opt.id, "ml_analysis_id": ml_an.id},
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)


    g_eval = DecisionGuardrailEvaluation(
        dataset_id=ds.id,
        recommendation_id=rec.id,
        feasibility_score=95.0,
        realism_score=95.0,
        risk_score=5.0,
        confidence_score=95.0,
        decision_readiness_score=95.0,
        feasibility_status="FEASIBLE",
        risk_level="LOW",
        decision_status="READY_TO_CONSIDER",
        guardrail_results=[],
        passed_rules=[],
        warnings=[],
        violated_rules=[],
        explanation="High feasibility and low risk",
    )
    db_session.add(g_eval)
    db_session.commit()
    db_session.refresh(g_eval)

    return ds, rec, g_eval


def test_e2e_recommendation_to_impact_and_audit_flow(db_session):
    """Verifies complete chain:

    Recommendation -> Guardrail -> Approval -> Action Gate -> Simulated Action -> Outcome -> Impact -> Audit
    """
    ds, rec, g_eval = setup_phase8_dataset(db_session)

    # 1. Recommendation & Guardrail exist
    assert rec.id is not None
    assert g_eval.feasibility_status == "FEASIBLE"

    # 2. Grant Human Approval
    app_res = ActionGateService.approve_decision(db_session, ds.id, rec.id)
    assert app_res.status == "APPROVED"

    # 3. Action Gate Check
    gate_check = ActionGateService.check_action_gate(db_session, ds.id, rec.id)
    assert gate_check.allowed is True
    assert gate_check.decision_state == "READY_FOR_ACTION"

    # 4. Execute Simulated Action
    act_res = ActionGateService.execute_action(db_session, ds.id, rec.id)
    assert act_res.action_state == "EXECUTED"
    assert act_res.is_simulated is True

    # 5. Record Outcome
    out_res = DecisionOutcomeService.record_outcome(
        db_session,
        ds.id,
        DecisionOutcomeCreate(
            recommendation_id=rec.id,
            actual_metric="throughput",
            actual_value=510.0,
            notes="Realized 510 units output",
        ),
    )
    assert out_res.actual_value == 510.0

    # 6. Measure Impact & Business Value Created
    imp_res = DecisionImpactService.create_impact_measurement(
        db_session,
        ds.id,
        ImpactMeasurementCreate(
            recommendation_id=rec.id,
            outcome_id=out_res.id,
            metric_name="throughput",
            objective="maximize",
            baseline_value=400.0,
            expected_value=500.0,
            actual_value=510.0,
            monetary_conversion_rate=5.0,
        ),
    )
    assert imp_res.expected_change == 100.0
    assert imp_res.actual_change == 110.0
    assert imp_res.achievement_percentage == 110.0
    assert imp_res.status == "ACHIEVED"
    assert imp_res.value_created == 550.0  # 110 * 5

    # 7. Verify Append-Only Audit Trail
    audit_trail = DecisionAuditService.get_audit_trail(db_session, ds.id, decision_id=rec.id)
    assert audit_trail.total_events >= 4
    event_types = [e.event_type for e in audit_trail.chronological_chain]
    assert "DECISION_APPROVED" in event_types
    assert "ACTION_EXECUTED" in event_types
    assert "IMPACT_MEASURED" in event_types


def test_e2e_brief_to_ai_eval_and_audit_flow(db_session):
    """Verifies complete chain:

    Decision Brief -> Evidence Validation -> AI Evaluation -> Evaluation Result -> Audit
    """
    ds, rec, g_eval = setup_phase8_dataset(db_session)

    # 1. Create Decision Brief
    brief = DecisionBrief(
        dataset_id=ds.id,
        recommendation_id=rec.id,
        provider_name="deterministic_fallback",
        model_name="rule_template_v1",
        generation_mode="deterministic_fallback",
        validation_status="validated",
        executive_summary="Recommendation to optimize supply allocation with target throughput 500.",
        sections=[{"title": "Overview", "content": "Throughput target 500.", "bullet_points": []}],
        key_findings=["Target throughput 500."],
        risk_breakdown={"level": "low"},
        claim_evidence_map=[{"claim": "Throughput 500", "evidence_refs": [{"id": rec.id}]}],
    )
    db_session.add(brief)
    db_session.commit()
    db_session.refresh(brief)

    # 2. Run AI Evaluation
    eval_res = AIEvaluationService.evaluate_ai_decision_brief(
        db_session,
        ds.id,
        AIEvaluationRequest(brief_id=brief.id, recommendation_id=rec.id),
    )

    # 3. Verify Evaluation Results
    assert eval_res.id is not None
    assert eval_res.overall_status in ["PASS", "NEEDS_REVIEW"]
    assert eval_res.overall_score >= 0.7
    assert len(eval_res.dimension_scores) == 7

    # 4. Verify Audit Event
    audit_trail = DecisionAuditService.get_audit_trail(db_session, ds.id, decision_id=rec.id)
    event_types = [e.event_type for e in audit_trail.chronological_chain]
    assert "EVALUATION_COMPLETED" in event_types
