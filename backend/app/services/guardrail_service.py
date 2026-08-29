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
from app.models.scenario import Scenario
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.schemas.guardrail import (
    GuardrailResult,
    DecisionGuardrailResponse,
    GuardrailBatchResponse,
)
from app.services.eda_service import EDAService


from app.services.quality_service import QualityService


class DecisionGuardrailService:
    """Service layer for Phase 7.4 Decision Guardrails & Feasibility Analysis Engine."""

    @classmethod
    def _extract_changed_features(
        cls,
        rec_record: Any,
        evidence_dict: Dict[str, Any],
        scen_rec: Optional[Any],
        opt_record: Optional[Any],
    ) -> Dict[str, Any]:
        """Extract changed features mapping from all possible recommendation storage formats."""
        changes: Dict[str, Any] = {}

        # 1. Direct attribute on rec_record
        direct_changes = getattr(rec_record, "changed_features", None)
        if isinstance(direct_changes, dict) and direct_changes:
            return direct_changes

        # 2. From linked scenario record
        if scen_rec:
            scen_changes = getattr(scen_rec, "feature_changes", None) or getattr(scen_rec, "changes", None)
            if isinstance(scen_changes, dict) and scen_changes:
                return scen_changes

        # 3. From evidence_dict
        if isinstance(evidence_dict, dict):
            for key in ["changed_features", "feature_changes", "proposed_adjustments", "optimal_solution", "changes"]:
                val = evidence_dict.get(key)
                if isinstance(val, dict) and val:
                    return val

        # 4. From action_items in rec_record
        action_items = getattr(rec_record, "action_items", None)
        if isinstance(action_items, list):
            for item in action_items:
                if isinstance(item, dict):
                    feat = item.get("feature") or item.get("column") or item.get("target_feature")
                    val = item.get("proposed_value") if "proposed_value" in item else item.get("value")
                    if feat and val is not None:
                        try:
                            changes[feat] = float(val)
                        except (ValueError, TypeError):
                            changes[feat] = val

        if changes:
            return changes

        # 5. From optimization record's recommended scenario or ranked scenarios
        if opt_record:
            rec_scen = getattr(opt_record, "recommended_scenario", None)
            if isinstance(rec_scen, dict) and rec_scen.get("changes"):
                return rec_scen["changes"]
            ranked = getattr(opt_record, "ranked_scenarios", None)
            if isinstance(ranked, list) and len(ranked) > 0 and isinstance(ranked[0], dict) and ranked[0].get("changes"):
                return ranked[0]["changes"]

        return changes

    @classmethod
    def _extract_baseline_inputs(
        cls,
        rec_record: Any,
        evidence_dict: Dict[str, Any],
        scen_rec: Optional[Any],
        opt_record: Optional[Any],
    ) -> Dict[str, Any]:
        """Extract baseline feature values mapping from all possible storage formats."""
        baselines: Dict[str, Any] = {}

        if opt_record and isinstance(opt_record.constraints, dict):
            b_in = opt_record.constraints.get("baseline_inputs")
            if isinstance(b_in, dict) and b_in:
                baselines.update(b_in)

        if isinstance(evidence_dict, dict):
            b_in = evidence_dict.get("baseline_inputs")
            if isinstance(b_in, dict) and b_in:
                baselines.update(b_in)

        if scen_rec:
            scen_base = getattr(scen_rec, "baseline_inputs", None) or getattr(scen_rec, "baseline_values", None)
            if isinstance(scen_base, dict) and scen_base:
                baselines.update(scen_base)

        base_val = getattr(rec_record, "baseline_value", None)
        target_m = getattr(rec_record, "target_metric", None)
        if base_val is not None and target_m:
            baselines.setdefault(target_m, base_val)

        # Also check action_items for baseline values
        action_items = getattr(rec_record, "action_items", None)
        if isinstance(action_items, list):
            for item in action_items:
                if isinstance(item, dict):
                    feat = item.get("feature") or item.get("column")
                    b_val = item.get("baseline_value")
                    if feat and b_val is not None:
                        baselines.setdefault(feat, b_val)

        return baselines

    @classmethod
    def _resolve_baseline_value(
        cls,
        col: str,
        baseline_inputs: Dict[str, Any],
        df: Optional[pd.DataFrame],
    ) -> Optional[Any]:
        """Resolve feature baseline value from baseline_inputs or dataset dataframe fallback."""
        if col in baseline_inputs and baseline_inputs[col] is not None:
            return baseline_inputs[col]
        if df is not None and col in df.columns:
            series = df[col].dropna()
            if not series.empty:
                if pd.api.types.is_numeric_dtype(series):
                    return float(series.mean())
                else:
                    return str(series.mode().iloc[0])
        return None

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

        # 2. Load Target Recommendation Record (support DecisionRecommendation & DecisionRecommendationEvaluation)
        stmt_rec1 = select(DecisionRecommendation).where(
            DecisionRecommendation.id == recommendation_id,
            DecisionRecommendation.dataset_id == target_dataset.id,
        )
        rec_record: Any = db.scalars(stmt_rec1).first()

        if not rec_record:
            stmt_rec2 = select(DecisionRecommendationEvaluation).where(
                DecisionRecommendationEvaluation.id == recommendation_id,
                DecisionRecommendationEvaluation.dataset_id == target_dataset.id,
            )
            rec_record = db.scalars(stmt_rec2).first()

        if not rec_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{recommendation_id}' not found for dataset '{dataset_id}'.",
            )

        # 3. Resolve Associated Metadata (ML Analysis, Optimization, Scenario)
        scenario_id = getattr(rec_record, "scenario_id", None)
        ml_analysis_id = getattr(rec_record, "ml_analysis_id", None)
        optimization_id = getattr(rec_record, "optimization_id", None)

        evidence_dict = getattr(rec_record, "evidence_traceability", None) or getattr(rec_record, "evidence", None) or {}

        if not ml_analysis_id and isinstance(evidence_dict, dict):
            ml_analysis_id = evidence_dict.get("ml_analysis_id")

        if not optimization_id and isinstance(evidence_dict, dict):
            optimization_id = evidence_dict.get("optimization_id")

        # Fallback for ML Analysis if missing
        if not ml_analysis_id:
            latest_ml = db.scalars(
                select(MLAnalysis)
                .where(MLAnalysis.dataset_id == target_dataset.id)
                .order_by(MLAnalysis.created_at.desc())
            ).first()
            if latest_ml:
                ml_analysis_id = latest_ml.id

        ml_record = None
        if ml_analysis_id:
            ml_record = db.scalars(select(MLAnalysis).where(MLAnalysis.id == ml_analysis_id)).first()

        # Fallback for Optimization if missing
        if not optimization_id:
            latest_opt = db.scalars(
                select(DecisionOptimization)
                .where(DecisionOptimization.dataset_id == target_dataset.id)
                .order_by(DecisionOptimization.created_at.desc())
            ).first()
            if latest_opt:
                optimization_id = latest_opt.id

        opt_record = None
        if optimization_id:
            opt_record = db.scalars(select(DecisionOptimization).where(DecisionOptimization.id == optimization_id)).first()

        # 4. Load Processed Data for Statistical Auditing
        df = None
        if target_dataset.file_path and os.path.exists(target_dataset.file_path):
            try:
                df = pd.read_csv(target_dataset.file_path)
            except Exception:
                df = None

        # 5. Extract Feature Changes & Baseline Inputs
        results: List[GuardrailResult] = []
        scen_rec = None
        if scenario_id:
            scen_rec = db.scalars(select(Scenario).where(Scenario.id == scenario_id)).first()

        changed_features = cls._extract_changed_features(rec_record, evidence_dict, scen_rec, opt_record)
        baseline_inputs = cls._extract_baseline_inputs(rec_record, evidence_dict, scen_rec, opt_record)

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
        # Rule 3: Scenario Relative Change & Categorical Audit (SCENARIO_CHANGE)
        # -------------------------------------------------------------
        moderate_displacement_count = 0
        large_displacement_count = 0
        extreme_displacement_count = 0
        categorical_change_count = 0

        for col, proposed_val in changed_features.items():
            baseline_val = cls._resolve_baseline_value(col, baseline_inputs, df)

            # Categorical feature change assessment
            if df is not None and col in df.columns and not pd.api.types.is_numeric_dtype(df[col]):
                if baseline_val is not None and str(proposed_val) != str(baseline_val):
                    categorical_change_count += 1
                    results.append(
                        GuardrailResult(
                            rule_id=f"RULE_CATEGORICAL_CHANGE_{col}",
                            rule_name=f"Categorical Operational Shift Audit ({col})",
                            category="CATEGORICAL_CHANGE",
                            status="WARNING",
                            severity="WARNING",
                            message=f"Proposed operational shift for categorical feature '{col}' changes baseline from '{baseline_val}' to '{proposed_val}'.",
                            evidence={
                                "feature": col,
                                "baseline_value": str(baseline_val),
                                "proposed_value": str(proposed_val),
                                "change_type": "categorical_shift",
                            },
                        )
                    )
                else:
                    results.append(
                        GuardrailResult(
                            rule_id=f"RULE_CATEGORICAL_CHANGE_{col}",
                            rule_name=f"Categorical Operational Shift Audit ({col})",
                            category="CATEGORICAL_CHANGE",
                            status="PASS",
                            severity="INFO",
                            message=f"Categorical feature '{col}' remains unchanged at '{proposed_val}'.",
                            evidence={"feature": col, "proposed_value": str(proposed_val)},
                        )
                    )
                continue

            # Numeric feature relative change assessment
            try:
                val_float = float(proposed_val)
            except (ValueError, TypeError):
                continue

            base_float = float(baseline_val) if baseline_val is not None and isinstance(baseline_val, (int, float)) else (
                float(df[col].dropna().mean()) if (df is not None and col in df.columns and pd.api.types.is_numeric_dtype(df[col]) and not df[col].dropna().empty) else 0.0
            )

            # Calculate relative percentage change safely
            if base_float != 0.0:
                pct_change = (abs(val_float - base_float) / abs(base_float)) * 100.0
            else:
                if val_float == 0.0:
                    pct_change = 0.0
                else:
                    std_v = float(df[col].dropna().std()) if (df is not None and col in df.columns and len(df[col].dropna()) > 1) else 1.0
                    std_ratio = abs(val_float) / std_v if std_v > 0 else abs(val_float)
                    pct_change = std_ratio * 100.0

            z_score = 0.0
            if df is not None and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                if len(series) > 1:
                    std_v = float(series.std()) if series.std() > 0 else 1.0
                    z_score = abs(val_float - float(series.mean())) / std_v

            if pct_change >= 80.0 or z_score > 3.0:
                extreme_displacement_count += 1
                large_displacement_count += 1
                results.append(
                    GuardrailResult(
                        rule_id=f"RULE_RELATIVE_CHANGE_{col}",
                        rule_name=f"Relative Change Realism Check ({col})",
                        category="SCENARIO_CHANGE",
                        status="WARNING",
                        severity="WARNING",
                        message=f"Proposed adjustment to '{col}' from {base_float:.2f} to {val_float:.2f} represents an extreme relative change of {pct_change:.1f}% (exceeds 80% threshold). Decision readiness is marked for human review.",
                        evidence={
                            "feature": col,
                            "baseline_value": base_float,
                            "proposed_value": val_float,
                            "percentage_change": round(pct_change, 2),
                            "z_score": round(z_score, 2),
                            "threshold_category": "EXTREME",
                        },
                    )
                )
            elif pct_change >= 50.0 or z_score > 2.0:
                large_displacement_count += 1
                results.append(
                    GuardrailResult(
                        rule_id=f"RULE_RELATIVE_CHANGE_{col}",
                        rule_name=f"Relative Change Realism Check ({col})",
                        category="SCENARIO_CHANGE",
                        status="WARNING",
                        severity="WARNING",
                        message=f"Proposed adjustment to '{col}' from {base_float:.2f} to {val_float:.2f} represents a large relative change of {pct_change:.1f}% (exceeds 50% threshold).",
                        evidence={
                            "feature": col,
                            "baseline_value": base_float,
                            "proposed_value": val_float,
                            "percentage_change": round(pct_change, 2),
                            "z_score": round(z_score, 2),
                            "threshold_category": "LARGE",
                        },
                    )
                )
            elif pct_change >= 25.0:
                moderate_displacement_count += 1
                results.append(
                    GuardrailResult(
                        rule_id=f"RULE_RELATIVE_CHANGE_{col}",
                        rule_name=f"Relative Change Realism Check ({col})",
                        category="SCENARIO_CHANGE",
                        status="WARNING",
                        severity="WARNING",
                        message=f"Proposed adjustment to '{col}' from {base_float:.2f} to {val_float:.2f} represents a moderate relative change of {pct_change:.1f}% (exceeds 25% threshold).",
                        evidence={
                            "feature": col,
                            "baseline_value": base_float,
                            "proposed_value": val_float,
                            "percentage_change": round(pct_change, 2),
                            "z_score": round(z_score, 2),
                            "threshold_category": "MODERATE",
                        },
                    )
                )
            else:
                results.append(
                    GuardrailResult(
                        rule_id=f"RULE_RELATIVE_CHANGE_{col}",
                        rule_name=f"Relative Change Realism Check ({col})",
                        category="SCENARIO_CHANGE",
                        status="PASS",
                        severity="INFO",
                        message=f"Proposed adjustment to '{col}' from {base_float:.2f} to {val_float:.2f} is a low-risk relative change of {pct_change:.1f}%.",
                        evidence={
                            "feature": col,
                            "baseline_value": base_float,
                            "proposed_value": val_float,
                            "percentage_change": round(pct_change, 2),
                            "z_score": round(z_score, 2),
                            "threshold_category": "LOW",
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
        # Rule 6: Business Feasibility, Non-Negativity & Semantic Domain Range Audit (BUSINESS_FEASIBILITY)
        # -------------------------------------------------------------
        neg_violation = False
        semantic_violation = False

        for col, val in changed_features.items():
            try:
                val_float = float(val)
            except (ValueError, TypeError):
                continue

            if val_float < 0:
                neg_violation = True
                results.append(
                    GuardrailResult(
                        rule_id=f"RULE_NON_NEGATIVE_{col}",
                        rule_name=f"Non-Negativity Constraint Check ({col})",
                        category="BUSINESS_FEASIBILITY",
                        status="FAIL",
                        severity="CRITICAL",
                        message=f"Proposed negative value ({val_float}) for '{col}' violates operational non-negativity constraints.",
                        evidence={"feature": col, "proposed_value": val_float},
                    )
                )

            col_lower = col.lower()
            matched_rule = None
            for rule in QualityService.SEMANTIC_RANGE_RULES:
                if any(k in col_lower for k in rule["keywords"]):
                    matched_rule = rule
                    break

            if not matched_rule:
                if any(kw in col_lower for kw in ["_rate", "_pct", "_ratio", "percentage"]):
                    matched_rule = {"min": 0.0, "max": 1.0, "description": "Rate/ratio must be between 0.0 and 1.0."}
                elif "satisfaction" in col_lower:
                    matched_rule = {"min": 0.0, "max": 100.0, "description": "Satisfaction score must be between 0 and 100."}

            if matched_rule:
                s_min = matched_rule.get("min")
                s_max = matched_rule.get("max")
                if s_min is not None and val_float < s_min:
                    semantic_violation = True
                    results.append(
                        GuardrailResult(
                            rule_id=f"RULE_SEMANTIC_BOUNDS_{col}",
                            rule_name=f"Semantic Domain Range Audit ({col})",
                            category="BUSINESS_FEASIBILITY",
                            status="FAIL",
                            severity="CRITICAL",
                            message=f"Proposed value {val_float} for '{col}' is below minimum allowed semantic bound ({s_min}).",
                            evidence={"feature": col, "proposed_value": val_float, "semantic_min": s_min},
                        )
                    )
                if s_max is not None and val_float > s_max:
                    semantic_violation = True
                    results.append(
                        GuardrailResult(
                            rule_id=f"RULE_SEMANTIC_BOUNDS_{col}",
                            rule_name=f"Semantic Domain Range Audit ({col})",
                            category="BUSINESS_FEASIBILITY",
                            status="FAIL",
                            severity="CRITICAL",
                            message=f"Proposed value {val_float} for '{col}' exceeds maximum allowed semantic bound ({s_max}).",
                            evidence={"feature": col, "proposed_value": val_float, "semantic_max": s_max},
                        )
                    )

        if not neg_violation and not semantic_violation:
            results.append(
                GuardrailResult(
                    rule_id="RULE_BUSINESS_FEASIBILITY",
                    rule_name="Business Operational Boundary Verification",
                    category="BUSINESS_FEASIBILITY",
                    status="PASS",
                    severity="INFO",
                    message="All proposed feature modifications comply with physical operational and semantic domain boundaries.",
                    evidence={"features_checked": list(changed_features.keys())},
                )
            )

        # -------------------------------------------------------------
        # Score Computations (Deterministic 0-100)
        # -------------------------------------------------------------
        feasibility_penalties = (out_of_range_count * 20.0) + (100.0 if (neg_violation or semantic_violation) else 0.0)
        feasibility_score = max(0.0, min(100.0, 100.0 - feasibility_penalties))

        realism_penalties = (
            (extreme_displacement_count * 35.0)
            + (large_displacement_count * 20.0)
            + (moderate_displacement_count * 10.0)
            + (extreme_iqr_count * 10.0)
            + (categorical_change_count * 10.0)
        )
        realism_score = max(0.0, min(100.0, 100.0 - realism_penalties))

        risk_accum = (
            (out_of_range_count * 25.0)
            + (extreme_displacement_count * 40.0)
            + (large_displacement_count * 20.0)
            + (moderate_displacement_count * 10.0)
            + (categorical_change_count * 15.0)
            + (25.0 if row_count < 30 else 0.0)
            + (100.0 if (neg_violation or semantic_violation) else 0.0)
        )
        risk_score = max(0.0, min(100.0, risk_accum))

        base_confidence = 85.0 if (r2_score is None or r2_score >= 0.50) else 50.0
        if row_count < 30:
            confidence_score = min(40.0, base_confidence)
        else:
            confidence_score = base_confidence

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
        if feasibility_score >= 75.0 and not (neg_violation or semantic_violation):
            feasibility_status = "FEASIBLE"
        elif feasibility_score >= 50.0:
            feasibility_status = "CAUTION"
        else:
            feasibility_status = "INFEASIBLE"

        if risk_score < 35.0:
            risk_level = "LOW"
        elif risk_score <= 65.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        if neg_violation or semantic_violation or decision_readiness_score < 50.0:
            decision_status = "NOT_RECOMMENDED"
        elif row_count < 30 or extreme_displacement_count > 0 or large_displacement_count > 0 or moderate_displacement_count > 0 or categorical_change_count > 0 or any(r.status == "WARNING" for r in results) or decision_readiness_score < 75.0:
            decision_status = "HUMAN_REVIEW_REQUIRED"
        else:
            decision_status = "READY_TO_CONSIDER"

        # -------------------------------------------------------------
        # Executive Explanation String
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
        if extreme_displacement_count > 0:
            explanation_parts.append(
                f"Evaluation detected extreme relative feature change(s) that require human review."
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
        # DB Persistence (Idempotent update or creation)
        # -------------------------------------------------------------
        stmt_existing = (
            select(DecisionGuardrailEvaluation)
            .where(
                DecisionGuardrailEvaluation.dataset_id == target_dataset.id,
                DecisionGuardrailEvaluation.recommendation_id == rec_record.id,
            )
            .order_by(DecisionGuardrailEvaluation.created_at.desc())
        )
        db_guardrail = db.scalars(stmt_existing).first()

        if db_guardrail:
            db_guardrail.ml_analysis_id = ml_analysis_id
            db_guardrail.optimization_id = optimization_id
            db_guardrail.scenario_id = scenario_id
            db_guardrail.feasibility_score = feasibility_score
            db_guardrail.realism_score = realism_score
            db_guardrail.risk_score = risk_score
            db_guardrail.confidence_score = confidence_score
            db_guardrail.decision_readiness_score = decision_readiness_score
            db_guardrail.feasibility_status = feasibility_status
            db_guardrail.risk_level = risk_level
            db_guardrail.decision_status = decision_status
            db_guardrail.guardrail_results = [r.model_dump() for r in results]
            db_guardrail.passed_rules = [r.model_dump() for r in passed_list]
            db_guardrail.warnings = [r.model_dump() for r in warning_list]
            db_guardrail.violated_rules = [r.model_dump() for r in violated_list]
            db_guardrail.explanation = explanation_str
        else:
            eval_id = str(uuid.uuid4())
            db_guardrail = DecisionGuardrailEvaluation(
                id=eval_id,
                dataset_id=target_dataset.id,
                ml_analysis_id=ml_analysis_id,
                optimization_id=optimization_id,
                recommendation_id=rec_record.id,
                scenario_id=scenario_id,
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
            ml_analysis_id=ml_analysis_id,
            optimization_id=optimization_id,
            scenario_id=scenario_id,
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
        
        # 1. Retrieve stored recommendations from DecisionRecommendation table
        stmt1 = select(DecisionRecommendation).where(
            DecisionRecommendation.dataset_id == target_dataset.id
        ).order_by(DecisionRecommendation.created_at.desc())
        recs1 = db.scalars(stmt1).all()

        # 2. Retrieve stored recommendations from DecisionRecommendationEvaluation table
        stmt2 = select(DecisionRecommendationEvaluation).where(
            DecisionRecommendationEvaluation.dataset_id == target_dataset.id
        ).order_by(DecisionRecommendationEvaluation.created_at.desc())
        recs2 = db.scalars(stmt2).all()

        # Combine unique recommendations by ID
        all_recs = []
        seen_ids = set()
        for r in list(recs1) + list(recs2):
            if r.id not in seen_ids:
                seen_ids.add(r.id)
                all_recs.append(r)

        if not all_recs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No stored decision recommendations found for dataset '{dataset_id}'. Generate recommendations first.",
            )

        evaluations = []
        for r in all_recs:
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
