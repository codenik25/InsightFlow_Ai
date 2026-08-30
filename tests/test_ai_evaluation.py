import pytest
from app.models.dataset import Dataset
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_brief import DecisionBrief
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.services.ai_evaluation_service import AIEvaluationService
from app.schemas.ai_evaluation import AIEvaluationRequest


def setup_eval_dataset(db_session):
    ds = Dataset(
        name="test_eval.csv",
        file_path="/tmp/test_eval.csv",
        status="PROCESSED",
        is_processed=True,
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)

    rec = DecisionRecommendation(
        dataset_id=ds.id,
        title="Increase Conversion Rate",
        recommendation_type="optimization",
        impact_level="high",
        expected_impact="Target 20% growth",
        action_items=[],
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    brief = DecisionBrief(
        dataset_id=ds.id,
        recommendation_id=rec.id,
        provider_name="deterministic_fallback",
        model_name="rule_template_v1",
        generation_mode="deterministic_fallback",
        validation_status="validated",
        executive_summary="Recommendation to increase conversion rate with projected output 20.",
        sections=[{"title": "Overview", "content": "Projected output 20.", "bullet_points": []}],
        key_findings=["Conversion rate can reach 20."],
        risk_breakdown={"level": "low"},
        claim_evidence_map=[{"claim": "Output increase by 20", "evidence_refs": [{"id": rec.id}]}],
    )
    db_session.add(brief)
    db_session.commit()
    db_session.refresh(brief)

    return ds, rec, brief


def test_valid_brief_evaluation(db_session):
    ds, rec, brief = setup_eval_dataset(db_session)
    res = AIEvaluationService.evaluate_ai_decision_brief(
        db_session,
        ds.id,
        AIEvaluationRequest(brief_id=brief.id, recommendation_id=rec.id),
    )
    assert res.overall_status in ["PASS", "NEEDS_REVIEW"]
    assert res.overall_score >= 0.7
    assert "evidence_grounding" in res.dimension_scores
    assert "numerical_accuracy" in res.dimension_scores


def test_invalid_recommendation_reference_evaluation(db_session):
    ds, rec, brief = setup_eval_dataset(db_session)
    res = AIEvaluationService.evaluate_ai_decision_brief(
        db_session,
        ds.id,
        AIEvaluationRequest(brief_id=brief.id, recommendation_id="non_existent_rec"),
    )
    assert res.overall_status == "FAIL"
    assert res.dimension_scores["recommendation_validity"].status == "FAIL"
    assert any(v.dimension == "recommendation_validity" for v in res.violations)


def test_guardrail_contradiction_eval(db_session):
    ds, rec, brief = setup_eval_dataset(db_session)

    # Add infeasible guardrail
    g_eval = DecisionGuardrailEvaluation(
        dataset_id=ds.id,
        recommendation_id=rec.id,
        feasibility_status="INFEASIBLE",
        decision_status="NOT_RECOMMENDED",
        guardrail_results=[],
        passed_rules=[],
        warnings=[],
        violated_rules=[],
        explanation="Infeasible guardrail",
    )
    db_session.add(g_eval)

    # Modify brief text to falsely claim approval
    brief.executive_summary = "This decision is approved and safe to proceed."
    db_session.commit()

    res = AIEvaluationService.evaluate_ai_decision_brief(
        db_session,
        ds.id,
        AIEvaluationRequest(brief_id=brief.id, recommendation_id=rec.id),
    )
    assert res.dimension_scores["guardrail_compliance"].status == "FAIL"
    assert any(v.rule == "GUARDRAIL_CONTRADICTION" for v in res.violations)


def test_ai_evaluation_api_endpoints(client, db_session):
    ds, rec, brief = setup_eval_dataset(db_session)

    # POST evaluation API
    post_res = client.post(
        f"/api/v1/datasets/{ds.id}/decision/evaluations",
        json={"brief_id": brief.id, "recommendation_id": rec.id},
    )
    assert post_res.status_code == 201
    eval_data = post_res.json()
    eval_id = eval_data["id"]
    assert eval_data["evaluation_version"] == "v1"

    # GET single evaluation API
    get_res = client.get(f"/api/v1/datasets/{ds.id}/decision/evaluations/{eval_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == eval_id

    # LIST evaluations API
    list_res = client.get(f"/api/v1/datasets/{ds.id}/decision/evaluations")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
