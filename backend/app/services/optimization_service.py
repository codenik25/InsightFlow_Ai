import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.schemas.optimization import (
    ControllableFeatureInfo,
    OptimizationOptionResponse,
    OptimizationRequest,
    OptimizationResponse,
    OptimizationScenario,
)
from app.services.dataset_service import DatasetService
from app.services.eda_service import EDAService
from app.services.type_detector import TypeDetector
from app.services.decision_service import DecisionService
from app.services.ml_task_service import MLTaskService


class OptimizationService:
    """Service for Decision Optimization foundation, controllable feature discovery, and scenario generation."""

    @classmethod
    def discover_controllable_features(
        cls,
        db: Session,
        dataset_id: str,
        analysis_id: Optional[str] = None,
    ) -> OptimizationOptionResponse:
        """Identify controllable features available for optimization and explain exclusion rationale."""
        # 1. Resolve Processed Dataset (rejection of raw datasets without processed child)
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision Optimization requires a processed dataset. Raw datasets are protected.",
            )

        # 2. Validate ML Analysis Ownership & Lineage
        if analysis_id:
            stmt = select(MLAnalysis).where(
                MLAnalysis.id == analysis_id,
                MLAnalysis.dataset_id == target_dataset.id,
            )
            analysis = db.scalars(stmt).first()
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"ML Analysis '{analysis_id}' not found for dataset '{dataset_id}'.",
                )
        else:
            stmt = (
                select(MLAnalysis)
                .where(MLAnalysis.dataset_id == target_dataset.id)
                .order_by(MLAnalysis.created_at.desc())
            )
            analysis = db.scalars(stmt).first()
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No ML analysis found for this dataset. Please run ML analysis first.",
                )

        # 3. Load Processed Dataset Dataframe
        df = DatasetService.load_dataset_dataframe(target_dataset)
        total_rows = len(df)

        # 4. Fetch Model Feature Importances from Phase 7.1
        try:
            explanation = DecisionService.explain_ml_model(db=db, dataset_id=target_dataset.id, analysis_id=analysis.id)
            feature_importances = explanation.feature_importances or {}
        except Exception:
            feature_importances = {}

        # 5. Small Dataset Warning Check (Informational for small samples)
        warnings: List[str] = []
        if total_rows < 30:
            warnings.append(
                f"Optimization results are exploratory because the processed dataset contains only {total_rows} rows."
            )

        controllable_features: List[ControllableFeatureInfo] = []
        feature_cols = analysis.feature_columns or []
        target_col = analysis.target_column or "target"

        for col in feature_cols:
            col_name = str(col)
            if col_name not in df.columns:
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type="unknown",
                        role="missing",
                        importance=round(feature_importances.get(col_name, 0.0), 4),
                        allowed=False,
                        exclusion_reason=f"Feature '{col_name}' missing from dataset columns.",
                        optimization_supported=False,
                    )
                )
                continue

            series = df[col_name]
            clean_s = series.dropna()
            non_null_count = len(clean_s)
            missing_ratio = (total_rows - non_null_count) / total_rows if total_rows > 0 else 1.0
            inferred_type = TypeDetector.detect_column_type(series, col_name)
            col_name_lower = col_name.lower()
            imp_val = round(float(feature_importances.get(col_name, 0.0)), 4)

            # Rule 1: Target Column Exclusion
            if col_name == target_col:
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type=inferred_type,
                        role="target",
                        importance=imp_val,
                        allowed=False,
                        exclusion_reason="Target column cannot be directly optimized.",
                        optimization_supported=False,
                    )
                )
                continue

            # Rule 2: Identifier Column Exclusion
            is_id_name = TypeDetector.is_identifier_candidate_name(col_name)
            uniqueness_ratio = clean_s.nunique() / non_null_count if non_null_count > 0 else 0.0
            if is_id_name or inferred_type == "identifier" or (uniqueness_ratio >= 0.80 and not pd.api.types.is_numeric_dtype(series)):
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type="identifier",
                        role="identifier",
                        importance=imp_val,
                        allowed=False,
                        exclusion_reason="Identifier column is not suitable for optimization.",
                        optimization_supported=False,
                    )
                )
                continue

            # Rule 3: Temporal / Date Column Exclusion
            if inferred_type == "datetime" or any(kw in col_name_lower for kw in ["date", "time", "timestamp", "created", "updated", "dt"]):
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type="datetime",
                        role="temporal",
                        importance=imp_val,
                        allowed=False,
                        exclusion_reason="Temporal column is not supported as a controllable optimization variable.",
                        optimization_supported=False,
                    )
                )
                continue

            # Rule 4: Zero Variance Exclusion
            if clean_s.nunique() <= 1:
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type=inferred_type,
                        role="constant",
                        importance=imp_val,
                        allowed=False,
                        exclusion_reason="Feature has no variation in the processed dataset.",
                        optimization_supported=False,
                    )
                )
                continue

            # Rule 5: High Missingness Exclusion (> 30%)
            if missing_ratio > 0.30:
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type=inferred_type,
                        role="measure" if pd.api.types.is_numeric_dtype(series) else "dimension",
                        importance=imp_val,
                        allowed=False,
                        exclusion_reason=f"Feature exceeds missingness safety threshold ({round(missing_ratio * 100, 1)}% missing).",
                        optimization_supported=False,
                    )
                )
                continue

            # Rule 6: High-Cardinality Categorical Column Exclusion (> 10 unique distinct values)
            if inferred_type in ["categorical", "text"] and clean_s.nunique() > 10:
                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type=inferred_type,
                        role="dimension",
                        importance=imp_val,
                        allowed=False,
                        exclusion_reason=f"High cardinality categorical column ({clean_s.nunique()} distinct values) is not optimization-supported.",
                        optimization_supported=False,
                    )
                )
                continue

            # Rule 7: Valid Controllable Feature
            if pd.api.types.is_numeric_dtype(series):
                c_val = round(float(clean_s.mean()), 4) if not clean_s.empty else 0.0
                min_v = round(float(clean_s.min()), 4) if not clean_s.empty else 0.0
                max_v = round(float(clean_s.max()), 4) if not clean_s.empty else 0.0

                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type="numeric",
                        role="measure",
                        current_value=c_val,
                        min_value=min_v,
                        max_value=max_v,
                        importance=imp_val,
                        allowed=True,
                        exclusion_reason=None,
                        optimization_supported=True,
                    )
                )
            else:
                c_val = str(clean_s.mode().iloc[0]) if not clean_s.empty else "unknown"
                cats = sorted([str(v) for v in clean_s.unique()])

                controllable_features.append(
                    ControllableFeatureInfo(
                        column=col_name,
                        data_type="categorical",
                        role="dimension",
                        current_value=c_val,
                        categories=cats,
                        importance=imp_val,
                        allowed=True,
                        exclusion_reason=None,
                        optimization_supported=True,
                    )
                )

        return OptimizationOptionResponse(
            dataset_id=target_dataset.id,
            analysis_id=analysis.id,
            target_column=target_col,
            objective_options=["maximize", "minimize"],
            controllable_features=controllable_features,
            warnings=warnings,
        )

    @classmethod
    def run_optimization(
        cls,
        db: Session,
        dataset_id: str,
        payload: OptimizationRequest,
    ) -> OptimizationResponse:
        """Deterministically generate candidate what-if scenarios, evaluate via ML artifact, and rank by objective."""
        # 1. Resolve Processed Dataset (raw datasets protection)
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision Optimization requires a processed dataset. Raw datasets are protected.",
            )

        # 2. Validate ML Analysis Ownership & Dataset Lineage
        if payload.analysis_id:
            stmt = select(MLAnalysis).where(
                MLAnalysis.id == payload.analysis_id,
                MLAnalysis.dataset_id == target_dataset.id,
            )
            analysis = db.scalars(stmt).first()
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"ML Analysis '{payload.analysis_id}' not found for dataset '{dataset_id}'.",
                )
        else:
            stmt = (
                select(MLAnalysis)
                .where(MLAnalysis.dataset_id == target_dataset.id)
                .order_by(MLAnalysis.created_at.desc())
            )
            analysis = db.scalars(stmt).first()
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No ML analysis found for this dataset. Please run ML analysis first.",
                )

        # 3. Load Dataframe & Discover Controllable Features
        df = DatasetService.load_dataset_dataframe(target_dataset)
        total_rows = len(df)
        opt_options = cls.discover_controllable_features(db=db, dataset_id=target_dataset.id, analysis_id=analysis.id)
        controllable_map = {f.column: f for f in opt_options.controllable_features if f.allowed}

        feature_cols = analysis.feature_columns or []
        target_col = analysis.target_column or "target"

        # 4. Construct & Validate Baseline Inputs
        if payload.baseline_inputs:
            baseline_record = payload.baseline_inputs.copy()
        else:
            baseline_record = {}
            for col in feature_cols:
                series = df[col].dropna()
                if pd.api.types.is_numeric_dtype(series):
                    baseline_record[col] = round(float(series.mean()), 4) if not series.empty else 0.0
                else:
                    baseline_record[col] = str(series.mode().iloc[0]) if not series.empty else "unknown"

        # 5. Validate User Feature Constraints Against Historical Bounds
        if payload.feature_constraints:
            for feat, constraint in payload.feature_constraints.items():
                if feat not in controllable_map:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Feature '{feat}' is not a controllable optimization feature.",
                    )
                series = df[feat].dropna()
                if pd.api.types.is_numeric_dtype(series):
                    obs_min = float(series.min())
                    obs_max = float(series.max())
                    if constraint.min is not None and constraint.min < obs_min:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Constraint for {feat} exceeds the observed dataset range.",
                        )
                    if constraint.max is not None and constraint.max > obs_max:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Constraint for {feat} exceeds the observed dataset range.",
                        )

        # 6. Generate Deterministic Candidate Feature Values
        candidate_values: Dict[str, List[Any]] = {}
        for feat, feat_info in controllable_map.items():
            series = df[feat].dropna()
            user_constraint = payload.feature_constraints.get(feat) if payload.feature_constraints else None

            if pd.api.types.is_numeric_dtype(series):
                obs_min = float(series.min())
                obs_max = float(series.max())
                low = max(obs_min, user_constraint.min) if (user_constraint and user_constraint.min is not None) else obs_min
                high = min(obs_max, user_constraint.max) if (user_constraint and user_constraint.max is not None) else obs_max

                p25 = float(series.quantile(0.25))
                p50 = float(series.quantile(0.50))
                p75 = float(series.quantile(0.75))

                raw_vals = [low, p25, p50, p75, high]
                valid_vals = sorted(list(set([round(v, 4) for v in raw_vals if low <= v <= high])))
                candidate_values[feat] = valid_vals
            else:
                candidate_values[feat] = sorted([str(v) for v in series.unique()])

        # 7. Generate Deterministic Scenario Combinations
        raw_scenarios: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []  # (changes, inputs)

        # Single-feature perturbations (1-at-a-time)
        for feat in sorted(controllable_map.keys()):
            current_val = baseline_record.get(feat)
            for val in candidate_values.get(feat, []):
                if val == current_val:
                    continue
                scen_inputs = baseline_record.copy()
                scen_inputs[feat] = val
                changes = {feat: val}
                raw_scenarios.append((changes, scen_inputs))

        # Two-feature perturbations (2-at-a-time) if needed
        controllable_sorted_by_importance = sorted(
            controllable_map.keys(),
            key=lambda k: controllable_map[k].importance,
            reverse=True,
        )
        if len(controllable_sorted_by_importance) >= 2:
            f1, f2 = controllable_sorted_by_importance[0], controllable_sorted_by_importance[1]
            for v1 in candidate_values.get(f1, []):
                if v1 == baseline_record.get(f1):
                    continue
                for v2 in candidate_values.get(f2, []):
                    if v2 == baseline_record.get(f2):
                        continue
                    scen_inputs = baseline_record.copy()
                    scen_inputs[f1] = v1
                    scen_inputs[f2] = v2
                    changes = {f1: v1, f2: v2}
                    raw_scenarios.append((changes, scen_inputs))

        # Deduplicate & cap at max_scenarios
        seen_keys = set()
        unique_scenarios: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
        for changes, scen_inputs in raw_scenarios:
            key = json_sort_key(changes)
            if key not in seen_keys:
                seen_keys.add(key)
                unique_scenarios.append((changes, scen_inputs))

        unique_scenarios = unique_scenarios[: payload.max_scenarios]

        # 8. Run Predictions via Stored ML Artifact
        baseline_pred_resp = MLTaskService.predict(db=db, dataset_id=target_dataset.id, analysis_id=analysis.id, inputs=[baseline_record])
        baseline_pred = float(baseline_pred_resp.predictions[0])

        evaluated_scenarios: List[Dict[str, Any]] = []

        for idx, (changes, scen_inputs) in enumerate(unique_scenarios):
            pred_resp = MLTaskService.predict(db=db, dataset_id=target_dataset.id, analysis_id=analysis.id, inputs=[scen_inputs])
            predicted_target = float(pred_resp.predictions[0])
            abs_delta = round(predicted_target - baseline_pred, 4)

            if abs(baseline_pred) > 1e-9:
                pct_delta = round((abs_delta / abs(baseline_pred)) * 100.0, 2)
            else:
                pct_delta = 0.0

            # Deterministic Non-Causal Explanation Text
            change_strings = []
            for k in sorted(changes.keys()):
                old_v = baseline_record.get(k)
                new_v = changes[k]
                change_strings.append(f"{k} from {old_v} to {new_v}")

            change_desc = " and ".join(change_strings)
            improvement_word = "improvement" if (payload.objective == "maximize" and abs_delta > 0) or (payload.objective == "minimize" and abs_delta < 0) else "change"
            explanation_text = (
                f"Change {change_desc}. The model predicts {target_col} of {predicted_target:,.2f}, "
                f"representing a projected {improvement_word} of {abs_delta:+,.2f} ({pct_delta:+,.2f}%) versus the baseline."
            )

            scen_id = f"scen_{idx + 1}_{hash_dict(changes)}"
            evaluated_scenarios.append({
                "scenario_id": scen_id,
                "changes": changes,
                "inputs": scen_inputs,
                "predicted_target": predicted_target,
                "baseline_prediction": baseline_pred,
                "absolute_delta": abs_delta,
                "percentage_delta": pct_delta,
                "feasibility": "Feasible",
                "explanation": explanation_text,
            })

        # 9. Rank Scenarios Deterministically by Objective
        if payload.objective == "maximize":
            evaluated_scenarios.sort(key=lambda s: (-s["predicted_target"], -s["absolute_delta"], s["scenario_id"]))
        else:
            evaluated_scenarios.sort(key=lambda s: (s["predicted_target"], s["absolute_delta"], s["scenario_id"]))

        final_scenarios: List[OptimizationScenario] = []
        for r_idx, s_data in enumerate(evaluated_scenarios, start=1):
            final_scenarios.append(
                OptimizationScenario(
                    rank=r_idx,
                    scenario_id=s_data["scenario_id"],
                    changes=s_data["changes"],
                    inputs=s_data["inputs"],
                    predicted_target=s_data["predicted_target"],
                    baseline_prediction=s_data["baseline_prediction"],
                    absolute_delta=s_data["absolute_delta"],
                    percentage_delta=s_data["percentage_delta"],
                    feasibility=s_data["feasibility"],
                    explanation=s_data["explanation"],
                )
            )

        best_scenario = final_scenarios[0] if final_scenarios else None
        warning_msg = f"Optimization results are exploratory because the processed dataset contains only {total_rows} rows." if total_rows < 30 else None
        opt_id = str(uuid.uuid4())
        created_iso = datetime.now(timezone.utc).isoformat()

        # 10. Persist DB Record
        stored_constraints = payload.model_dump()
        stored_constraints["baseline_inputs"] = baseline_record

        db_opt = DecisionOptimization(
            id=opt_id,
            dataset_id=target_dataset.id,
            ml_analysis_id=analysis.id,
            objective=payload.objective,
            target_column=target_col,
            baseline_prediction=baseline_pred,
            recommended_prediction=best_scenario.predicted_target if best_scenario else baseline_pred,
            expected_change=best_scenario.absolute_delta if best_scenario else 0.0,
            expected_change_percent=best_scenario.percentage_delta if best_scenario else 0.0,
            optimization_score=1.0,
            constraints=stored_constraints,
            recommended_scenario=best_scenario.model_dump() if best_scenario else None,
            ranked_scenarios=[s.model_dump() for s in final_scenarios],
            scenario_count=len(final_scenarios),
            status="completed",
            selection_reason=best_scenario.explanation if best_scenario else "Baseline evaluation only",
        )
        db.add(db_opt)
        db.commit()

        # 11. Return OptimizationResponse
        return OptimizationResponse(
            optimization_id=opt_id,
            dataset_id=target_dataset.id,
            ml_analysis_id=analysis.id,
            target_column=target_col,
            objective=payload.objective,
            baseline_inputs=baseline_record,
            baseline_prediction=baseline_pred,
            scenarios=final_scenarios,
            best_scenario=best_scenario,
            warning=warning_msg,
            generated_at=created_iso,
        )

    @classmethod
    def get_optimizations_for_dataset(cls, db: Session, dataset_id: str) -> List[OptimizationResponse]:
        """Retrieve stored optimization runs for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionOptimization)
            .where(DecisionOptimization.dataset_id == target_dataset.id)
            .order_by(DecisionOptimization.created_at.desc())
        )
        records = db.scalars(stmt).all()
        results = []
        for r in records:
            scenarios = [OptimizationScenario(**s) for s in (r.ranked_scenarios or [])]
            best = OptimizationScenario(**r.recommended_scenario) if r.recommended_scenario else None
            b_inputs = r.constraints.get("baseline_inputs") if (r.constraints and isinstance(r.constraints, dict)) else {}
            if not isinstance(b_inputs, dict):
                b_inputs = {}
            results.append(
                OptimizationResponse(
                    optimization_id=r.id,
                    dataset_id=r.dataset_id,
                    ml_analysis_id=r.ml_analysis_id,
                    target_column=r.target_column,
                    objective=r.objective,
                    baseline_inputs=b_inputs,
                    baseline_prediction=r.baseline_prediction,
                    scenarios=scenarios,
                    best_scenario=best,
                    warning=f"Optimization results are exploratory because dataset contains {r.scenario_count} scenarios.",
                    generated_at=r.created_at.isoformat() if r.created_at else "",
                )
            )
        return results

    @classmethod
    def get_optimization_by_id(cls, db: Session, dataset_id: str, optimization_id: str) -> OptimizationResponse:
        """Retrieve a specific optimization run by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionOptimization).where(
            DecisionOptimization.id == optimization_id,
            DecisionOptimization.dataset_id == target_dataset.id,
        )
        r = db.scalars(stmt).first()
        if not r:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Optimization '{optimization_id}' not found for dataset '{dataset_id}'.",
            )
        scenarios = [OptimizationScenario(**s) for s in (r.ranked_scenarios or [])]
        best = OptimizationScenario(**r.recommended_scenario) if r.recommended_scenario else None
        b_inputs = r.constraints.get("baseline_inputs") if (r.constraints and isinstance(r.constraints, dict)) else {}
        if not isinstance(b_inputs, dict):
            b_inputs = {}
        return OptimizationResponse(
            optimization_id=r.id,
            dataset_id=r.dataset_id,
            ml_analysis_id=r.ml_analysis_id,
            target_column=r.target_column,
            objective=r.objective,
            baseline_inputs=b_inputs,
            baseline_prediction=r.baseline_prediction,
            scenarios=scenarios,
            best_scenario=best,
            warning=None,
            generated_at=r.created_at.isoformat() if r.created_at else "",
        )


def json_sort_key(d: Dict[str, Any]) -> str:
    """Helper to convert dict to deterministic JSON string key."""
    import json
    return json.dumps(d, sort_keys=True)


def hash_dict(d: Dict[str, Any]) -> str:
    """Helper to generate short deterministic hash of dict."""
    import hashlib
    s = json_sort_key(d)
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:8]
