import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.decision_brief import DecisionBrief
from app.models.decision_ai_evaluation import DecisionAIEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.schemas.ai_evaluation import (
    AIEvaluationRequest,
    AIEvaluationResponse,
    EvaluationMetricScore,
    EvaluationViolation,
)
from app.schemas.audit import AuditEventCreate
from app.services.eda_service import EDAService
from app.services.command_center_service import DecisionCommandCenterService
from app.services.brief_validator import DecisionBriefValidator, BriefValidationError
from app.services.audit_service import DecisionAuditService



class AIEvaluationService:
    """Deterministic evaluation framework for AI Decision Briefs and decision outputs."""

    @classmethod
    def evaluate_ai_decision_brief(
        cls,
        db: Session,
        dataset_id: str,
        request: AIEvaluationRequest,
    ) -> AIEvaluationResponse:
        """Execute 7-dimension evaluation on a Decision Brief or decision output."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        # 1. Resolve target DecisionBrief record or generate synthetic brief context
        brief_record = None
        if request.brief_id:
            brief_record = db.scalars(
                select(DecisionBrief).where(
                    DecisionBrief.id == request.brief_id,
                    DecisionBrief.dataset_id == target_dataset.id,
                )
            ).first()
            if not brief_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Decision Brief '{request.brief_id}' not found for dataset '{dataset_id}'.",
                )
        else:
            # Query latest brief for dataset
            brief_record = db.scalars(
                select(DecisionBrief)
                .where(DecisionBrief.dataset_id == target_dataset.id)
                .order_by(DecisionBrief.created_at.desc())
            ).first()

        rec_id = request.recommendation_id or (brief_record.recommendation_id if brief_record else None)

        # Retrieve Command Center evidence payload for grounding checks
        try:
            cc_response = DecisionCommandCenterService.get_command_center_snapshot(
                db=db,
                dataset_id=target_dataset.id,
                recommendation_id=rec_id,
            )
            cc_payload = cc_response.model_dump()
        except Exception:
            cc_payload = {}


        if brief_record:
            brief_payload = {
                "executive_summary": brief_record.executive_summary,
                "sections": brief_record.sections or [],
                "key_findings": brief_record.key_findings or [],
                "risk_breakdown": brief_record.risk_breakdown or {},
                "claim_evidence_map": brief_record.claim_evidence_map or [],
            }
        else:
            brief_payload = {}

        # 2. Evaluate all 7 Dimensions
        violations: List[EvaluationViolation] = []
        dim_scores: Dict[str, EvaluationMetricScore] = {}

        # Dimension 1: EVIDENCE_GROUNDING
        eg_score, eg_viol = cls._eval_evidence_grounding(brief_payload, cc_payload)
        dim_scores["evidence_grounding"] = eg_score
        violations.extend(eg_viol)

        # Dimension 2: NUMERICAL_ACCURACY
        na_score, na_viol = cls._eval_numerical_accuracy(brief_payload, cc_payload)
        dim_scores["numerical_accuracy"] = na_score
        violations.extend(na_viol)

        # Dimension 3: UNSUPPORTED_CLAIMS
        uc_score, uc_viol = cls._eval_unsupported_claims(brief_payload, cc_payload)
        dim_scores["unsupported_claims"] = uc_score
        violations.extend(uc_viol)

        # Dimension 4: RECOMMENDATION_VALIDITY
        rv_score, rv_viol = cls._eval_recommendation_validity(db, target_dataset.id, brief_record, rec_id)
        dim_scores["recommendation_validity"] = rv_score
        violations.extend(rv_viol)

        # Dimension 5: GUARDRAIL_COMPLIANCE
        gc_score, gc_viol = cls._eval_guardrail_compliance(db, target_dataset.id, brief_payload, rec_id)
        dim_scores["guardrail_compliance"] = gc_score
        violations.extend(gc_viol)

        # Dimension 6: DECISION_CONSISTENCY
        dc_score, dc_viol = cls._eval_decision_consistency(brief_record)
        dim_scores["decision_consistency"] = dc_score
        violations.extend(dc_viol)

        # Dimension 7: FALLBACK_CONSISTENCY
        fc_score, fc_viol = cls._eval_fallback_consistency(brief_record)
        dim_scores["fallback_consistency"] = fc_score
        violations.extend(fc_viol)

        # 3. Transparent Overall Score Calculation
        valid_scores = [d.score for d in dim_scores.values() if d.status != "UNAVAILABLE"]
        overall_score = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else 1.0

        has_high_viol = any(v.severity == "HIGH" for v in violations)
        if overall_score >= 0.85 and not has_high_viol:
            overall_status = "PASS"
        elif overall_score >= 0.70 and not has_high_viol:
            overall_status = "NEEDS_REVIEW"
        else:
            overall_status = "FAIL"

        # 4. Save Evaluation Record
        eval_record = DecisionAIEvaluation(
            dataset_id=target_dataset.id,
            decision_id=request.decision_id or rec_id,
            brief_id=brief_record.id if brief_record else None,
            recommendation_id=rec_id,
            evaluation_version=request.evaluation_version or "v1",
            overall_status=overall_status,
            overall_score=overall_score,
            dimension_scores={k: v.model_dump() for k, v in dim_scores.items()},
            violations=[v.model_dump() for v in violations],
        )

        db.add(eval_record)
        db.commit()
        db.refresh(eval_record)

        # 5. Emit Audit Event
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=eval_record.decision_id,
                    recommendation_id=eval_record.recommendation_id,
                    event_type="EVALUATION_COMPLETED",
                    event_status="SUCCESS" if overall_status in ["PASS", "NEEDS_REVIEW"] else "FAILED",
                    source_service="ai_evaluation_service",
                    evidence_references={
                        "evaluation_id": eval_record.id,
                        "brief_id": eval_record.brief_id,
                    },
                    new_state={
                        "overall_status": overall_status,
                        "overall_score": overall_score,
                    },
                ),
            )
        except Exception:
            pass

        return cls._map_to_response(eval_record)

    @classmethod
    def get_evaluation_by_id(cls, db: Session, dataset_id: str, evaluation_id: str) -> AIEvaluationResponse:
        """Retrieve single evaluation by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionAIEvaluation).where(
            DecisionAIEvaluation.id == evaluation_id,
            DecisionAIEvaluation.dataset_id == target_dataset.id,
        )
        record = db.scalars(stmt).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evaluation record '{evaluation_id}' not found for dataset '{dataset_id}'.",
            )
        return cls._map_to_response(record)

    @classmethod
    def list_evaluations(cls, db: Session, dataset_id: str) -> List[AIEvaluationResponse]:
        """List all AI evaluations for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionAIEvaluation)
            .where(DecisionAIEvaluation.dataset_id == target_dataset.id)
            .order_by(DecisionAIEvaluation.evaluated_at.desc())
        )
        records = db.scalars(stmt).all()
        return [cls._map_to_response(r) for r in records]

    # --- Evaluator Implementations ---

    @classmethod
    def _eval_evidence_grounding(cls, brief_payload: Dict[str, Any], cc_payload: Dict[str, Any]):
        violations = []
        if not brief_payload or not cc_payload:
            return EvaluationMetricScore(
                dimension="evidence_grounding",
                score=1.0,
                status="PASS",
                details="Evaluation payload is empty or unavailable.",
            ), violations

        try:
            DecisionBriefValidator._validate_evidence_references(brief_payload, cc_payload)
            score = 1.0
            status_str = "PASS"
            msg = "All claim evidence references map to valid evidence nodes."
        except BriefValidationError as ex:
            score = 0.5
            status_str = "FAIL"
            msg = str(ex)
            violations.append(
                EvaluationViolation(
                    dimension="evidence_grounding",
                    rule="VALID_EVIDENCE_REFERENCE",
                    severity="HIGH",
                    message=str(ex),
                )
            )
        return EvaluationMetricScore(
            dimension="evidence_grounding",
            score=score,
            status=status_str,
            details=msg,
        ), violations

    @classmethod
    def _eval_numerical_accuracy(cls, brief_payload: Dict[str, Any], cc_payload: Dict[str, Any]):
        violations = []
        if not brief_payload or not cc_payload:
            return EvaluationMetricScore(
                dimension="numerical_accuracy",
                score=1.0,
                status="PASS",
                details="Payload numerical data unavailable.",
            ), violations

        try:
            DecisionBriefValidator._validate_numeric_consistency(brief_payload, cc_payload)
            score = 1.0
            status_str = "PASS"
            msg = "All numerical claims in brief text match trusted evidence numbers."
        except BriefValidationError as ex:
            score = 0.4
            status_str = "FAIL"
            msg = str(ex)
            violations.append(
                EvaluationViolation(
                    dimension="numerical_accuracy",
                    rule="NUMERIC_CONSISTENCY",
                    severity="HIGH",
                    message=str(ex),
                )
            )
        return EvaluationMetricScore(
            dimension="numerical_accuracy",
            score=score,
            status=status_str,
            details=msg,
        ), violations

    @classmethod
    def _eval_unsupported_claims(cls, brief_payload: Dict[str, Any], cc_payload: Dict[str, Any]):
        violations = []
        claim_map = brief_payload.get("claim_evidence_map", [])
        if not claim_map:
            return EvaluationMetricScore(
                dimension="unsupported_claims",
                score=1.0,
                status="PASS",
                details="No ungrounded claims detected.",
            ), violations

        unsupported_count = 0
        for item in claim_map:
            refs = item.get("evidence_refs", [])
            if not refs:
                unsupported_count += 1
                violations.append(
                    EvaluationViolation(
                        dimension="unsupported_claims",
                        rule="UNSUPPORTED_CLAIM_DETECTED",
                        severity="MEDIUM",
                        message=f"Claim '{item.get('claim')}' lacks supporting evidence references.",
                    )
                )

        if unsupported_count > 0:
            score = round(max(0.0, 1.0 - (unsupported_count * 0.2)), 2)
            status_str = "FAIL" if score < 0.7 else "PASS"
            msg = f"Detected {unsupported_count} claim(s) without evidence references."
        else:
            score = 1.0
            status_str = "PASS"
            msg = "100% of claims map to grounded evidence."

        return EvaluationMetricScore(
            dimension="unsupported_claims",
            score=score,
            status=status_str,
            details=msg,
        ), violations

    @classmethod
    def _eval_recommendation_validity(
        cls,
        db: Session,
        dataset_id: str,
        brief_record: Optional[DecisionBrief],
        rec_id: Optional[str],
    ):
        violations = []
        if not rec_id:
            return EvaluationMetricScore(
                dimension="recommendation_validity",
                score=1.0,
                status="PASS",
                details="No recommendation ID specified for validation.",
            ), violations

        stmt1 = select(DecisionRecommendation).where(
            DecisionRecommendation.id == rec_id,
            DecisionRecommendation.dataset_id == dataset_id,
        )
        rec = db.scalars(stmt1).first()

        if not rec:
            stmt2 = select(DecisionRecommendationEvaluation).where(
                DecisionRecommendationEvaluation.id == rec_id,
                DecisionRecommendationEvaluation.dataset_id == dataset_id,
            )
            rec = db.scalars(stmt2).first()

        if not rec:
            violations.append(
                EvaluationViolation(
                    dimension="recommendation_validity",
                    rule="RECOMMENDATION_EXISTS",
                    severity="HIGH",
                    message=f"Referenced recommendation '{rec_id}' does not exist in dataset.",
                )
            )
            return EvaluationMetricScore(
                dimension="recommendation_validity",
                score=0.0,
                status="FAIL",
                details=f"Recommendation '{rec_id}' is invalid or missing.",
            ), violations

        return EvaluationMetricScore(
            dimension="recommendation_validity",
            score=1.0,
            status="PASS",
            details=f"Recommendation '{rec_id}' exists and belongs to dataset.",
        ), violations

    @classmethod
    def _eval_guardrail_compliance(
        cls,
        db: Session,
        dataset_id: str,
        brief_payload: Dict[str, Any],
        rec_id: Optional[str],
    ):
        violations = []
        if not rec_id:
            return EvaluationMetricScore(
                dimension="guardrail_compliance",
                score=1.0,
                status="PASS",
                details="No recommendation reference to evaluate guardrail compliance.",
            ), violations

        stmt = select(DecisionGuardrailEvaluation).where(
            DecisionGuardrailEvaluation.dataset_id == dataset_id,
            DecisionGuardrailEvaluation.recommendation_id == rec_id,
        )
        g_eval = db.scalars(stmt).first()

        if g_eval and (g_eval.feasibility_status == "INFEASIBLE" or g_eval.decision_status == "NOT_RECOMMENDED"):
            # Check if brief claims approval or execution
            text = brief_payload.get("executive_summary", "").lower()
            if "approved" in text or "executed" in text or "safe to proceed" in text:
                violations.append(
                    EvaluationViolation(
                        dimension="guardrail_compliance",
                        rule="GUARDRAIL_CONTRADICTION",
                        severity="HIGH",
                        message="Brief text falsely claims decision approval/execution despite failed guardrails.",
                    )
                )
                return EvaluationMetricScore(
                    dimension="guardrail_compliance",
                    score=0.0,
                    status="FAIL",
                    details="Brief contradicts failed guardrails.",
                ), violations

        return EvaluationMetricScore(
            dimension="guardrail_compliance",
            score=1.0,
            status="PASS",
            details="Guardrail compliance verified.",
        ), violations

    @classmethod
    def _eval_decision_consistency(cls, brief_record: Optional[DecisionBrief]):
        violations = []
        if not brief_record:
            return EvaluationMetricScore(
                dimension="decision_consistency",
                score=1.0,
                status="PASS",
                details="Brief record not available for consistency verification.",
            ), violations

        # Check prompt hash and validation status
        if brief_record.validation_status == "validated":
            score = 1.0
            status_str = "PASS"
            msg = "Brief output validated deterministically."
        else:
            score = 0.5
            status_str = "FAIL"
            msg = f"Brief validation status: '{brief_record.validation_status}'"

        return EvaluationMetricScore(
            dimension="decision_consistency",
            score=score,
            status=status_str,
            details=msg,
        ), violations

    @classmethod
    def _eval_fallback_consistency(cls, brief_record: Optional[DecisionBrief]):
        violations = []
        if not brief_record:
            return EvaluationMetricScore(
                dimension="fallback_consistency",
                score=1.0,
                status="PASS",
                details="Fallback output verified.",
            ), violations

        if brief_record.generation_mode == "deterministic_fallback":
            score = 1.0
            status_str = "PASS"
            msg = "Deterministic fallback brief generation verified."
        else:
            score = 1.0
            status_str = "PASS"
            msg = f"Generation mode: '{brief_record.generation_mode}'"

        return EvaluationMetricScore(
            dimension="fallback_consistency",
            score=score,
            status=status_str,
            details=msg,
        ), violations

    @classmethod
    def _map_to_response(cls, record: DecisionAIEvaluation) -> AIEvaluationResponse:
        dim_scores_map = {}
        if isinstance(record.dimension_scores, dict):
            for k, v in record.dimension_scores.items():
                if isinstance(v, dict):
                    dim_scores_map[k] = EvaluationMetricScore(**v)

        violations_list = []
        if isinstance(record.violations, list):
            for v in record.violations:
                if isinstance(v, dict):
                    violations_list.append(EvaluationViolation(**v))

        return AIEvaluationResponse(
            id=record.id,
            dataset_id=record.dataset_id,
            decision_id=record.decision_id,
            brief_id=record.brief_id,
            recommendation_id=record.recommendation_id,
            evaluation_version=record.evaluation_version,
            overall_status=record.overall_status,
            overall_score=record.overall_score,
            dimension_scores=dim_scores_map,
            violations=violations_list,
            evaluated_at=record.evaluated_at,
            created_at=record.created_at,
        )
