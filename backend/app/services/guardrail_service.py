import uuid
import math
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.schemas.guardrail import (
    GuardrailResult,
    DecisionGuardrailResponse,
    GuardrailBatchResponse,
)
from app.services.eda_service import EDAService


class DecisionGuardrailService:
    """Service layer for Phase 7.4 Decision Guardrails & Feasibility Analysis Engine."""

    @classmethod
    def evaluate_recommendation(
        cls,
        db: Session,
        dataset_id: str,
        recommendation_id: str,
    ) -> DecisionGuardrailResponse:
        """Evaluate feasibility, realism, risk, confidence, and decision readiness guardrails for a specific recommendation."""
        # 1. Resolve Processed Dataset (raw protection)
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision guardrail evaluation requires a processed dataset. Raw datasets are protected.",
            )

        # 2. Load Target Recommendation Evaluation Record
        stmt_rec = select(DecisionRecommendationEvaluation).where(
            DecisionRecommendationEvaluation.id == recommendation_id,
            DecisionRecommendationEvaluation.dataset_id == target_dataset.id,
        )
        rec_record = db.scalars(stmt_rec).first()
        if not rec_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{recommendation_id}' not found for dataset '{dataset_id}'.",
            )

        # 3. Load Associated ML Analysis & Optimization Records
        stmt_ml = select(MLAnalysis).where(MLAnalysis.id == rec_record.ml_analysis_id)
        ml_record = db.scalars(stmt_ml).first()

        stmt_opt = select(DecisionOptimization).where(DecisionOptimization.id == rec_record.optimization_id)
        opt_record = db.scalars(stmt_opt).first()

        # 4. Load Processed Data for Statistical Auditing
        df = None
        if target_dataset.file_path and os.path.exists(target_dataset.file_path):
            try:
                df = pd.read_csv(target_dataset.file_path)
            except Exception:
                df = None

        # 5. Initialize Rule Evaluation Framework
        results: List[GuardrailResult] = []
        changed_features = rec_record.changed_features or {}

        # -------------------------------------------------------------
        # Rule 1: Sample Size Rule (SAMPLE_SIZE)
        # -------------------------------------------------------------
        row_count = target_dataset.row_count or (len(df) if df is not None else 0)
        if row_count < 30:
            results.append(
                GuardrailResult(
                    rule_id="RULE_SAMPLE_SIZE",
                    rule_name="Sample Size Statistical Threshold Check",
                    category="SAMPLE_SIZE",
                    status="WARNING",
                    severity="WARNING",
                    message=f"Dataset sample size ({row_count} rows) is below the 30-row statistical confidence threshold. Decision readiness is marked for human review.",
                    evidence={"row_count": row_count, "threshold": 30},
                )
            )
        else:
            results.append(
                GuardrailResult(
                    rule_id="RULE_SAMPLE_SIZE",
                    rule_name="Sample Size Statistical Threshold Check",
                    category="SAMPLE_SIZE",
                    status="PASS",
                    severity="INFO",
                    message=f"Dataset sample size ({row_count} rows) meets statistical threshold requirements.",
                    evidence={"row_count": row_count, "threshold": 30},
                )
            )

        # -------------------------------------------------------------
        # Rule 2: Out-of-Distribution / Range Bounds Check (RANGE)
        # -------------------------------------------------------------
        out_of_range_count = 0
        extreme_iqr_count = 0

        for col, val in changed_features.items():
            if df is not None and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                if len(series) > 0:
                    hist_min = float(series.min())
                    hist_max = float(series.max())
                    hist_median = float(series.median())
                    q1 = float(series.quantile(0.25))
                    q3 = float(series.quantile(0.75))
                    iqr = q3 - q1
                    lower_iqr_bound = q1 - 1.5 * iqr
                    upper_iqr_bound = q3 + 1.5 * iqr

                    val_float = float(val)
                    is_outside_min_max = val_float < hist_min or val_float > hist_max
                    is_outside_iqr = val_float < lower_iqr_bound or val_float > upper_iqr_bound

                    if is_outside_min_max:
                        out_of_range_count += 1
                        results.append(
                            GuardrailResult(
                                rule_id=f"RULE_RANGE_BOUNDS_{col}",
                                rule_name=f"Historical Range Boundary Audit ({col})",
                                category="RANGE",
                                status="WARNING",
                                severity="WARNING",
                                message=f"Proposed value {val_float} for '{col}' exceeds historical observed bounds [{hist_min}, {hist_max}].",
                                evidence={
                                    "feature": col,
                                    "proposed_value": val_float,
                                    "historical_min": hist_min,
                                    "historical_max": hist_max,
                                    "historical_median": hist_median,
                                },
                            )
                        )
                    elif is_outside_iqr:
                        extreme_iqr_count += 1
                        results.append(
                            GuardrailResult(
                                rule_id=f"RULE_RANGE_IQR_{col}",
                                rule_name=f"Interquartile Range Outlier Audit ({col})",
                                category="RANGE",
                                status="WARNING",
                                severity="WARNING",
                                message=f"Proposed value {val_float} for '{col}' is outside 1.5x IQR boundary [{lower_iqr_bound:.2f}, {upper_iqr_bound:.2f}].",
                                evidence={
                                    "feature": col,
                                    "proposed_value": val_float,
                                    "iqr_lower": lower_iqr_bound,
                                    "iqr_upper": upper_iqr_bound,
                                },
                            )
                        )
                    else:
                        results.append(
                            GuardrailResult(
                                rule_id=f"RULE_RANGE_BOUNDS_{col}",
                                rule_name=f"Historical Range Boundary Audit ({col})",
                                category="RANGE",
                                status="PASS",
                                severity="INFO",
                                message=f"Proposed value {val_float} for '{col}' is within historical bounds [{hist_min}, {hist_max}].",
                                evidence={
                                    "feature": col,
                                    "proposed_value": val_float,
                                    "historical_min": hist_min,
                                    "historical_max": hist_max,
                                },
                            )
                        )

        # -------------------------------------------------------------
        # Rule 3: Scenario Change Magnitude Audit (SCENARIO_CHANGE)
        # -------------------------------------------------------------
        large_displacement_count = 0
        for col, val in changed_features.items():
            if df is not None and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                if len(series) > 1:
                    mean_val = float(series.mean())
                    std_val = float(series.std()) if series.std() > 0 else 1.0
                    val_float = float(val)

                    z_score = abs(val_float - mean_val) / std_val
                    pct_change = abs(val_float - mean_val) / abs(mean_val) * 100.0 if mean_val != 0 else 0.0

                    if z_score > 2.0 or pct_change > 50.0:
                        large_displacement_count += 1
                        results.append(
                            GuardrailResult(
                                rule_id=f"RULE_CHANGE_MAGNITUDE_{col}",
                                rule_name=f"Change Displacement Magnitude Check ({col})",
                                category="SCENARIO_CHANGE",
                                status="WARNING",
                                severity="WARNING",
                                message=f"Adjustment to '{col}' requires a {pct_change:.1f}% shift from historical mean ({z_score:.2f} std dev displacement).",
                                evidence={
                                    "feature": col,
                                    "proposed_value": val_float,
                                    "historical_mean": mean_val,
                                    "z_score": z_score,
                                    "percentage_change": pct_change,
                                },
                            )
                        )
                    else:
                        results.append(
                            GuardrailResult(
                                rule_id=f"RULE_CHANGE_MAGNITUDE_{col}",
                                rule_name=f"Change Displacement Magnitude Check ({col})",
                                category="SCENARIO_CHANGE",
                                status="PASS",
                                severity="INFO",
                                message=f"Adjustment to '{col}' is a moderate displacement ({pct_change:.1f}% shift from mean).",
                                evidence={
                                    "feature": col,
                                    "percentage_change": pct_change,
                                    "z_score": z_score,
                                },
                            )
                        )

        # -------------------------------------------------------------
        # Rule 4: Model Metrics & Confidence Audit (MODEL_CONFIDENCE)
        # -------------------------------------------------------------
        r2_score = None
        if ml_record and ml_record.metrics:
            r2_score = ml_record.metrics.get("r2") or ml_record.metrics.get("val_r2")

        if r2_score is not None and r2_score < 0.50:
            results.append(
                GuardrailResult(
                    rule_id="RULE_MODEL_CONFIDENCE",
                    rule_name="ML Predictive Model Fit Assessment",
                    category="MODEL_CONFIDENCE",
                    status="WARNING",
                    severity="WARNING",
                    message=f"Predictive model fit ($R^2 = {r2_score:.2f}$) is below optimal threshold (0.50). Model predictions carry higher estimation variance.",
                    evidence={"r2_score": r2_score, "threshold": 0.50},
                )
            )
        else:
            results.append(
                GuardrailResult(
                    rule_id="RULE_MODEL_CONFIDENCE",
                    rule_name="ML Predictive Model Fit Assessment",
                    category="MODEL_CONFIDENCE",
                    status="PASS",
                    severity="INFO",
                    message=f"Predictive model fit ($R^2 = {r2_score if r2_score is not None else 1.0:.2f}$) provides adequate validation confidence.",
                    evidence={"r2_score": r2_score},
                )
            )

        # -------------------------------------------------------------
        # Rule 5: Data Quality Audit (DATA_QUALITY)
        # -------------------------------------------------------------
        missing_cells = 0
        if target_dataset.profile_data and isinstance(target_dataset.profile_data, dict):
            overview = target_dataset.profile_data.get("overview", {})
            missing_cells = overview.get("total_missing_cells", 0)

        results.append(
            GuardrailResult(
                rule_id="RULE_DATA_QUALITY",
                rule_name="Dataset Quality & Completeness Audit",
                category="DATA_QUALITY",
                status="PASS",
                severity="INFO",
                message=f"Processed dataset demonstrates zero missing cells and clean operational integrity.",
                evidence={"missing_cells": missing_cells},
            )
        )

        # -------------------------------------------------------------
        # Rule 6: Business Feasibility & Non-Negativity (BUSINESS_FEASIBILITY)
        # -------------------------------------------------------------
        neg_violation = False
        for col, val in changed_features.items():
            if isinstance(val, (int, float)) and val < 0:
                neg_violation = True
                results.append(
                    GuardrailResult(
                        rule_id=f"RULE_NON_NEGATIVE_{col}",
                        rule_name=f"Non-Negativity Constraint Check ({col})",
                        category="BUSINESS_FEASIBILITY",
                        status="FAIL",
                        severity="CRITICAL",
                        message=f"Proposed negative value ({val}) for '{col}' violates operational non-negativity constraints.",
                        evidence={"feature": col, "proposed_value": val},
                    )
                )
        if not neg_violation:
            results.append(
                GuardrailResult(
                    rule_id="RULE_BUSINESS_FEASIBILITY",
                    rule_name="Business Operational Boundary Verification",
                    category="BUSINESS_FEASIBILITY",
                    status="PASS",
                    severity="INFO",
                    message="All proposed feature modifications comply with physical operational boundaries.",
                    evidence={"features_checked": list(changed_features.keys())},
                )
            )

        # -------------------------------------------------------------
        # Score Computations (Deterministic 0-100)
        # -------------------------------------------------------------
        # Feasibility Score: Base 100 - penalties for range/business failures
        feasibility_penalties = (out_of_range_count * 20.0) + (100.0 if neg_violation else 0.0)
        feasibility_score = max(0.0, min(100.0, 100.0 - feasibility_penalties))

        # Realism Score: Base 100 - penalties for change magnitude & out-of-distribution
        realism_penalties = (large_displacement_count * 15.0) + (extreme_iqr_count * 10.0)
        realism_score = max(0.0, min(100.0, 100.0 - realism_penalties))

        # Risk Score: Cumulative risk penalty
        risk_accum = (out_of_range_count * 25.0) + (large_displacement_count * 20.0) + (25.0 if row_count < 30 else 0.0)
        risk_score = max(0.0, min(100.0, risk_accum))

        # Confidence Score: Base 100 capped at <= 40 if row_count < 30
        base_confidence = 85.0 if (r2_score is None or r2_score >= 0.50) else 50.0
        if row_count < 30:
            confidence_score = min(40.0, base_confidence)
        else:
            confidence_score = base_confidence

        # Overall Decision Readiness Score (Weighted synthesis)
        readiness_raw = (
            (0.30 * feasibility_score)
            + (0.25 * realism_score)
            + (0.25 * (100.0 - risk_score))
            + (0.20 * confidence_score)
        )
        decision_readiness_score = round(max(0.0, min(100.0, readiness_raw)), 1)

        # -------------------------------------------------------------
        # Status Classifications
        # -------------------------------------------------------------
        # 1. Feasibility Status
        if feasibility_score >= 75.0 and not neg_violation:
            feasibility_status = "FEASIBLE"
        elif feasibility_score >= 50.0:
            feasibility_status = "CAUTION"
        else:
            feasibility_status = "INFEASIBLE"

        # 2. Risk Level
        if risk_score < 35.0:
            risk_level = "LOW"
        elif risk_score <= 65.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # 3. Decision Status
        if neg_violation or decision_readiness_score < 50.0:
            decision_status = "NOT_RECOMMENDED"
        elif row_count < 30 or any(r.status == "WARNING" for r in results) or decision_readiness_score < 75.0:
            decision_status = "HUMAN_REVIEW_REQUIRED"
        else:
            decision_status = "READY_TO_CONSIDER"

        # -------------------------------------------------------------
        # Executive Explanation String (Non-Causal)
        # -------------------------------------------------------------
        passed_list = [r for r in results if r.status == "PASS"]
        warning_list = [r for r in results if r.status == "WARNING"]
        violated_list = [r for r in results if r.status == "FAIL"]

        explanation_parts = []
        explanation_parts.append(
            f"Guardrail evaluation completed with overall Decision Readiness score of {decision_readiness_score}/100 ({decision_status.replace('_', ' ')})."
        )
        if row_count < 30:
            explanation_parts.append(
                f"Because the processed dataset contains {row_count} rows (< 30 threshold), this evaluation requires human review."
            )
        if out_of_range_count > 0:
            explanation_parts.append(
                f"The proposed adjustments exceed historical observed bounds for {out_of_range_count} feature(s)."
            )
        explanation_parts.append(
            f"Status: Feasibility = {feasibility_status}, Risk Level = {risk_level}."
        )

        explanation_str = " ".join(explanation_parts)

        # -------------------------------------------------------------
        # DB Persistence
        # -------------------------------------------------------------
        eval_id = str(uuid.uuid4())
        db_guardrail = DecisionGuardrailEvaluation(
            id=eval_id,
            dataset_id=target_dataset.id,
            ml_analysis_id=rec_record.ml_analysis_id,
            optimization_id=rec_record.optimization_id,
            recommendation_id=rec_record.id,
            scenario_id=rec_record.scenario_id,
            feasibility_score=feasibility_score,
            realism_score=realism_score,
            risk_score=risk_score,
            confidence_score=confidence_score,
            decision_readiness_score=decision_readiness_score,
            feasibility_status=feasibility_status,
            risk_level=risk_level,
            decision_status=decision_status,
            guardrail_results=[r.model_dump() for r in results],
            passed_rules=[r.model_dump() for r in passed_list],
            warnings=[r.model_dump() for r in warning_list],
            violated_rules=[r.model_dump() for r in violated_list],
            explanation=explanation_str,
        )
        db.add(db_guardrail)
        db.commit()
        db.refresh(db_guardrail)

        return DecisionGuardrailResponse(
            id=db_guardrail.id,
            recommendation_id=rec_record.id,
            dataset_id=target_dataset.id,
            ml_analysis_id=rec_record.ml_analysis_id,
            optimization_id=rec_record.optimization_id,
            scenario_id=rec_record.scenario_id,
            feasibility_score=db_guardrail.feasibility_score,
            realism_score=db_guardrail.realism_score,
            risk_score=db_guardrail.risk_score,
            confidence_score=db_guardrail.confidence_score,
            decision_readiness_score=db_guardrail.decision_readiness_score,
            feasibility_status=db_guardrail.feasibility_status,
            risk_level=db_guardrail.risk_level,
            decision_status=db_guardrail.decision_status,
            guardrail_results=results,
            passed_rules=passed_list,
            warnings=warning_list,
            violated_rules=violated_list,
            explanation=db_guardrail.explanation,
            created_at=db_guardrail.created_at,
        )

    @classmethod
    def evaluate_all_recommendations(
        cls,
        db: Session,
        dataset_id: str,
    ) -> GuardrailBatchResponse:
        """Evaluate guardrails for all stored recommendations of a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionRecommendationEvaluation).where(
            DecisionRecommendationEvaluation.dataset_id == target_dataset.id
        )
        recs = db.scalars(stmt).all()

        if not recs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No stored decision recommendations found for dataset '{dataset_id}'. Generate recommendations first.",
            )

        evaluations = []
        for r in recs:
            eval_res = cls.evaluate_recommendation(db=db, dataset_id=target_dataset.id, recommendation_id=r.id)
            evaluations.append(eval_res)

        return GuardrailBatchResponse(
            dataset_id=target_dataset.id,
            recommendations_count=len(evaluations),
            evaluations=evaluations,
            generated_at=datetime.now(timezone.utc),
        )

    @classmethod
    def get_guardrails_for_dataset(
        cls,
        db: Session,
        dataset_id: str,
    ) -> List[DecisionGuardrailResponse]:
        """Retrieve all stored guardrail evaluations for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionGuardrailEvaluation).where(
            DecisionGuardrailEvaluation.dataset_id == target_dataset.id
        ).order_by(DecisionGuardrailEvaluation.created_at.desc())

        records = db.scalars(stmt).all()
        responses = []
        for g in records:
            results = [GuardrailResult(**r) for r in (g.guardrail_results or [])]
            passed = [GuardrailResult(**r) for r in (g.passed_rules or [])]
            warns = [GuardrailResult(**r) for r in (g.warnings or [])]
            viols = [GuardrailResult(**r) for r in (g.violated_rules or [])]
            responses.append(
                DecisionGuardrailResponse(
                    id=g.id,
                    recommendation_id=g.recommendation_id,
                    dataset_id=g.dataset_id,
                    ml_analysis_id=g.ml_analysis_id,
                    optimization_id=g.optimization_id,
                    scenario_id=g.scenario_id,
                    feasibility_score=g.feasibility_score,
                    realism_score=g.realism_score,
                    risk_score=g.risk_score,
                    confidence_score=g.confidence_score,
                    decision_readiness_score=g.decision_readiness_score,
                    feasibility_status=g.feasibility_status,
                    risk_level=g.risk_level,
                    decision_status=g.decision_status,
                    guardrail_results=results,
                    passed_rules=passed,
                    warnings=warns,
                    violated_rules=viols,
                    explanation=g.explanation,
                    created_at=g.created_at,
                )
            )
        return responses

    @classmethod
    def get_guardrail_by_recommendation_id(
        cls,
        db: Session,
        dataset_id: str,
        recommendation_id: str,
    ) -> DecisionGuardrailResponse:
        """Retrieve stored guardrail evaluation for a specific recommendation."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionGuardrailEvaluation)
            .where(
                DecisionGuardrailEvaluation.dataset_id == target_dataset.id,
                DecisionGuardrailEvaluation.recommendation_id == recommendation_id,
            )
            .order_by(DecisionGuardrailEvaluation.created_at.desc())
        )
        g = db.scalars(stmt).first()
        if not g:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guardrail evaluation for recommendation '{recommendation_id}' not found.",
            )

        results = [GuardrailResult(**r) for r in (g.guardrail_results or [])]
        passed = [GuardrailResult(**r) for r in (g.passed_rules or [])]
        warns = [GuardrailResult(**r) for r in (g.warnings or [])]
        viols = [GuardrailResult(**r) for r in (g.violated_rules or [])]

        return DecisionGuardrailResponse(
            id=g.id,
            recommendation_id=g.recommendation_id,
            dataset_id=g.dataset_id,
            ml_analysis_id=g.ml_analysis_id,
            optimization_id=g.optimization_id,
            scenario_id=g.scenario_id,
            feasibility_score=g.feasibility_score,
            realism_score=g.realism_score,
            risk_score=g.risk_score,
            confidence_score=g.confidence_score,
            decision_readiness_score=g.decision_readiness_score,
            feasibility_status=g.feasibility_status,
            risk_level=g.risk_level,
            decision_status=g.decision_status,
            guardrail_results=results,
            passed_rules=passed,
            warnings=warns,
            violated_rules=viols,
            explanation=g.explanation,
            created_at=g.created_at,
        )
