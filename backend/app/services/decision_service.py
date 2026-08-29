import os
import uuid
import joblib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.insight import DatasetInsight
from app.models.scenario import Scenario
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_optimization import DecisionOptimization
from app.schemas.decision import (
    ScenarioCreateRequest,
    ScenarioResponse,
    DecisionRecommendationResponse,
    DecisionSummaryResponse,
    MLExplanationResponse,
    ScenarioComparisonResponse,
)
from app.services.dataset_service import DatasetService
from app.services.eda_service import EDAService
from app.services.ml_task_service import MLTaskService
from app.services.ml_explainability_service import MLExplainabilityService


class DecisionService:
    """Orchestrator for Decision Intelligence foundation, scenario simulation, and prediction explainability."""

    @classmethod
    def construct_canonical_baseline_record(
        cls,
        df: pd.DataFrame,
        feature_cols: List[str],
        user_baseline: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Construct a canonical baseline feature record for Decision Intelligence simulation & optimization.
        Uses valid numeric observations (filtered via QualityService.SEMANTIC_RANGE_RULES) and dataset mode for categorical features.
        """
        user_baseline = user_baseline or {}
        baseline_record: Dict[str, Any] = {}

        from app.services.optimization_service import OptimizationService

        for col in feature_cols:
            col_name = str(col)
            if col_name in user_baseline and user_baseline[col_name] is not None:
                val = user_baseline[col_name]
                if isinstance(val, (int, float)):
                    baseline_record[col_name] = round(float(val), 4) if isinstance(val, float) else val
                else:
                    baseline_record[col_name] = val
                continue

            if col_name not in df.columns:
                baseline_record[col_name] = 0.0
                continue

            series = df[col_name]
            valid_s = OptimizationService._get_valid_numeric_series(series, col_name)
            if not valid_s.empty:
                baseline_record[col_name] = round(float(valid_s.mean()), 4)
            elif pd.api.types.is_numeric_dtype(series):
                clean_s = series.dropna()
                clean_s = clean_s[np.isfinite(clean_s)]
                if not clean_s.empty:
                    baseline_record[col_name] = round(float(clean_s.mean()), 4)
                else:
                    baseline_record[col_name] = 0.0
            else:
                clean_s = series.dropna()
                if not clean_s.empty:
                    baseline_record[col_name] = str(clean_s.mode().iloc[0])
                else:
                    baseline_record[col_name] = "Unknown"

        return baseline_record

    @classmethod
    def _normalize_and_validate_feature_changes(
        cls,
        payload: ScenarioCreateRequest,
        feature_cols: List[str],
        df: pd.DataFrame,
        analysis_id: str,
    ) -> Tuple[Dict[str, Any], str, Optional[str]]:
        """
        Unwrap nested feature_changes payloads, extract name/description fallbacks,
        validate feature names against trained model columns, validate numeric values,
        and return (normalized_feature_changes, resolved_name, resolved_description).
        """
        raw_changes = payload.feature_changes
        if not isinstance(raw_changes, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="feature_changes must be a dictionary.",
            )

        resolved_name = payload.name
        resolved_desc = payload.description

        # Handle nested wrapper structure (e.g., {"feature_changes": {"description": "...", "feature_changes": {...}, "name": "..."}})
        current = dict(raw_changes)
        while isinstance(current, dict):
            if "name" in current and not resolved_name and isinstance(current["name"], str):
                resolved_name = current["name"]
            if "description" in current and not resolved_desc and isinstance(current["description"], str):
                resolved_desc = current["description"]

            if "feature_changes" in current and isinstance(current["feature_changes"], dict):
                current = current["feature_changes"]
            else:
                break

        normalized_changes = current
        # Remove metadata wrapper keys if present in final dictionary
        normalized_changes.pop("name", None)
        normalized_changes.pop("description", None)

        if not resolved_name:
            resolved_name = "What-If Simulation Scenario"

        if not normalized_changes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="feature_changes dictionary cannot be empty. Please specify feature overrides.",
            )

        allowed_set = set(feature_cols)
        unknown_cols = [k for k in normalized_changes.keys() if k not in allowed_set]
        if unknown_cols:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown feature(s) for ML analysis '{analysis_id}': {sorted(unknown_cols)}. Allowed feature columns: {sorted(feature_cols)}",
            )

        validated_changes: Dict[str, Any] = {}
        for col, val in normalized_changes.items():
            if val is None or isinstance(val, (dict, list, set, tuple)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid value for feature '{col}'. Null values or nested structures are not permitted.",
                )

            # Check numeric validation if column is numeric in dataframe
            if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                if isinstance(val, bool):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid value for numeric feature '{col}'. Expected number, got boolean.",
                    )
                if not isinstance(val, (int, float)):
                    if isinstance(val, str):
                        try:
                            fval = float(val)
                            if not np.isfinite(fval):
                                raise ValueError
                            val = fval
                        except (ValueError, TypeError):
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Invalid numeric value for feature '{col}': '{val}'. Must be a valid finite number.",
                            )
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid numeric value for feature '{col}'. Expected a number.",
                        )
                else:
                    fval = float(val)
                    if not np.isfinite(fval):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid numeric value for feature '{col}': '{val}'. Must be a valid finite number.",
                        )
                    val = fval

            validated_changes[col] = val

        return validated_changes, resolved_name, resolved_desc

    @classmethod
    def evaluate_scenario(
        cls,
        db: Session,
        dataset_id: str,
        payload: ScenarioCreateRequest,
    ) -> ScenarioResponse:
        """Evaluate a what-if scenario simulation using stored ML model artifacts and compute feature explainability."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision Intelligence requires a processed dataset. Raw datasets are protected.",
            )

        df = DatasetService.load_dataset_dataframe(target_dataset)

        # Select target ML analysis
        if payload.ml_analysis_id:
            stmt = select(MLAnalysis).where(
                MLAnalysis.id == payload.ml_analysis_id,
                MLAnalysis.dataset_id == target_dataset.id,
            )
            analysis = db.scalars(stmt).first()
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"ML Analysis '{payload.ml_analysis_id}' not found for dataset '{dataset_id}'.",
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

        target_col = analysis.target_column or "target"
        feature_cols = analysis.feature_columns or []

        # Normalize and validate feature_changes payload
        norm_changes, resolved_name, resolved_desc = cls._normalize_and_validate_feature_changes(
            payload=payload,
            feature_cols=feature_cols,
            df=df,
            analysis_id=analysis.id,
        )

        # Load persisted model pipeline artifact for explainability inspection
        artifact_filename = os.path.basename(analysis.model_artifact_path or "")
        artifact_full_path = str(settings.models_dir_path / artifact_filename) if artifact_filename else ""
        
        model_pipeline = None
        if os.path.exists(artifact_full_path):
            try:
                model_pipeline = joblib.load(artifact_full_path)
            except Exception:
                model_pipeline = None

        # Calculate baseline target value from processed dataset
        if target_col in df.columns and pd.api.types.is_numeric_dtype(df[target_col]):
            base_val = float(df[target_col].dropna().mean())
        else:
            base_val = 0.0

        # Construct canonical baseline input record for feature columns
        baseline_record = cls.construct_canonical_baseline_record(
            df=df,
            feature_cols=feature_cols,
            user_baseline=None,
        )

        # Construct scenario input record applying feature overrides
        scenario_record_inputs: Dict[str, Any] = dict(baseline_record)
        for col in feature_cols:
            if col in norm_changes and norm_changes[col] is not None:
                scenario_record_inputs[col] = norm_changes[col]

        # Run prediction on baseline inputs
        base_pred_resp = MLTaskService.predict(
            db=db,
            dataset_id=target_dataset.id,
            analysis_id=analysis.id,
            inputs=[baseline_record],
        )
        base_pred_outcome = float(base_pred_resp.predictions[0]) if base_pred_resp.predictions else base_val

        # Run prediction on scenario inputs
        scen_pred_resp = MLTaskService.predict(
            db=db,
            dataset_id=target_dataset.id,
            analysis_id=analysis.id,
            inputs=[scenario_record_inputs],
        )
        scen_pred_outcome = float(scen_pred_resp.predictions[0]) if scen_pred_resp.predictions else base_val

        predicted_delta = float(scen_pred_outcome - base_pred_outcome)
        predicted_delta_pct = (
            float((predicted_delta / base_pred_outcome) * 100.0) if abs(base_pred_outcome) > 1e-6 else 0.0
        )

        # Extract feature importances and scenario contributions
        if model_pipeline is not None:
            feature_importances = MLExplainabilityService.get_model_feature_importances(
                model_pipeline=model_pipeline, feature_columns=feature_cols
            )
            feature_contributions = MLExplainabilityService.explain_scenario_delta(
                model_pipeline=model_pipeline,
                feature_columns=feature_cols,
                baseline_record=baseline_record,
                scenario_changes=norm_changes,
                baseline_pred=base_pred_outcome,
                scenario_pred=scen_pred_outcome,
            )
        else:
            feature_importances = {col: round(1.0 / max(len(feature_cols), 1), 4) for col in feature_cols}
            feature_contributions = {
                col: {
                    "baseline_value": baseline_record.get(col),
                    "scenario_value": norm_changes.get(col, baseline_record.get(col)),
                    "changed": col in norm_changes and (
                        abs(float(norm_changes[col]) - float(baseline_record.get(col, 0))) > 1e-6
                        if isinstance(norm_changes[col], (int, float)) and isinstance(baseline_record.get(col), (int, float))
                        else str(norm_changes[col]) != str(baseline_record.get(col))
                    ),
                    "marginal_delta": 0.0,
                    "contribution_percentage": 0.0,
                }
                for col in feature_cols
            }

        # Compute confidence score based on model metrics
        metrics = analysis.metrics or {}
        r2 = metrics.get("r2")
        acc = metrics.get("accuracy")
        if r2 is not None and isinstance(r2, (int, float)):
            conf_score = max(0.5, min(0.98, round(float(r2), 2)))
        elif acc is not None and isinstance(acc, (int, float)):
            conf_score = max(0.5, min(0.98, round(float(acc), 2)))
        else:
            conf_score = 0.85

        scenario_id = str(uuid.uuid4())
        traceability = {
            "dataset_id": target_dataset.id,
            "ml_analysis_id": analysis.id,
            "target_column": target_col,
            "model_name": analysis.model_name,
            "model_version": analysis.model_version,
            "baseline_record": baseline_record,
            "feature_importances": feature_importances,
            "feature_contributions": feature_contributions,
        }

        scenario_db_record = Scenario(
            id=scenario_id,
            dataset_id=target_dataset.id,
            ml_analysis_id=analysis.id,
            name=resolved_name,
            description=resolved_desc or f"What-if simulation on target '{target_col}'",
            target_column=target_col,
            base_value=round(base_pred_outcome, 4),
            feature_changes=norm_changes,
            predicted_outcome=round(scen_pred_outcome, 4),
            predicted_delta=round(predicted_delta, 4),
            predicted_delta_percentage=round(predicted_delta_pct, 2),
            confidence_score=conf_score,
            metadata_json=traceability,
        )

        db.add(scenario_db_record)
        db.commit()

        return ScenarioResponse(
            id=scenario_db_record.id,
            dataset_id=scenario_db_record.dataset_id,
            ml_analysis_id=scenario_db_record.ml_analysis_id,
            name=scenario_db_record.name,
            description=scenario_db_record.description,
            target_column=scenario_db_record.target_column,
            base_value=scenario_db_record.base_value,
            feature_changes=scenario_db_record.feature_changes,
            predicted_outcome=scenario_db_record.predicted_outcome,
            predicted_delta=scenario_db_record.predicted_delta,
            predicted_delta_percentage=scenario_db_record.predicted_delta_percentage,
            confidence_score=scenario_db_record.confidence_score,
            feature_importances=feature_importances,
            feature_contributions=feature_contributions,
            metadata_json=scenario_db_record.metadata_json or {},
            created_at=scenario_db_record.created_at.isoformat(),
        )

    @classmethod
    def explain_ml_model(
        cls,
        db: Session,
        dataset_id: str,
        analysis_id: str
    ) -> MLExplanationResponse:
        """Retrieve model feature importances and structural explanation for a trained ML analysis."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
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

        feature_cols = analysis.feature_columns or []
        artifact_filename = os.path.basename(analysis.model_artifact_path or "")
        artifact_full_path = str(settings.models_dir_path / artifact_filename) if artifact_filename else ""

        if not os.path.exists(artifact_full_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model artifact file for analysis '{analysis_id}' not found.",
            )

        model_pipeline = joblib.load(artifact_full_path)
        feature_importances = MLExplainabilityService.get_model_feature_importances(
            model_pipeline=model_pipeline, feature_columns=feature_cols
        )

        top_feature = max(feature_importances.items(), key=lambda x: x[1])[0] if feature_importances else "N/A"

        summary = (
            f"Feature importances extracted deterministically from trained model artifact '{analysis.model_name}' "
            f"(v{analysis.model_version}). Most influential feature: '{top_feature}'."
        )

        return MLExplanationResponse(
            analysis_id=analysis.id,
            dataset_id=target_dataset.id,
            model_name=analysis.model_name,
            model_version=analysis.model_version,
            task_type=analysis.task_type,
            target_column=analysis.target_column or "target",
            feature_columns=feature_cols,
            feature_importances=feature_importances,
            explanation_summary=summary,
        )

    @classmethod
    def _ensure_scenario_normalized_and_evaluated(
        cls,
        db: Session,
        scenario: Scenario,
        dataset_id: str,
    ) -> Scenario:
        """
        Ensure a stored Scenario has normalized feature_changes and valid predictions/contributions.
        If the scenario contains un-nested wrapper structures or un-evaluated outputs, recompute & persist.
        """
        raw_changes = scenario.feature_changes or {}
        needs_healing = False

        # Check if feature_changes has nested structure
        if isinstance(raw_changes, dict) and "feature_changes" in raw_changes and isinstance(raw_changes["feature_changes"], dict):
            needs_healing = True

        meta = scenario.metadata_json or {}
        f_contribs = meta.get("feature_contributions", {})

        # Check if any feature in raw_changes is missing or set to changed=False when value differs
        if not needs_healing and isinstance(raw_changes, dict):
            for k, v in raw_changes.items():
                if k in f_contribs:
                    c_info = f_contribs[k]
                    if c_info.get("scenario_value") != v or (c_info.get("baseline_value") != v and not c_info.get("changed")):
                        needs_healing = True
                        break

        if not needs_healing:
            return scenario

        # Fetch ML analysis
        analysis = None
        if scenario.ml_analysis_id:
            stmt = select(MLAnalysis).where(
                MLAnalysis.id == scenario.ml_analysis_id,
                MLAnalysis.dataset_id == dataset_id,
            )
            analysis = db.scalars(stmt).first()

        if not analysis:
            stmt = (
                select(MLAnalysis)
                .where(MLAnalysis.dataset_id == dataset_id)
                .order_by(MLAnalysis.created_at.desc())
            )
            analysis = db.scalars(stmt).first()

        if not analysis:
            return scenario

        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        df = DatasetService.load_dataset_dataframe(target_dataset)
        feature_cols = analysis.feature_columns or []

        # Create dummy request payload to use existing _normalize_and_validate_feature_changes
        dummy_req = ScenarioCreateRequest(
            name=scenario.name,
            description=scenario.description,
            ml_analysis_id=analysis.id,
            feature_changes=raw_changes,
        )

        try:
            norm_changes, resolved_name, resolved_desc = cls._normalize_and_validate_feature_changes(
                payload=dummy_req,
                feature_cols=feature_cols,
                df=df,
                analysis_id=analysis.id,
            )
        except Exception:
            return scenario

        # Re-run prediction & contributions
        artifact_filename = os.path.basename(analysis.model_artifact_path or "")
        artifact_full_path = str(settings.models_dir_path / artifact_filename) if artifact_filename else ""
        
        model_pipeline = None
        if os.path.exists(artifact_full_path):
            try:
                model_pipeline = joblib.load(artifact_full_path)
            except Exception:
                model_pipeline = None

        target_col = analysis.target_column or "target"
        if target_col in df.columns and pd.api.types.is_numeric_dtype(df[target_col]):
            base_val = float(df[target_col].dropna().mean())
        else:
            base_val = 0.0

        baseline_record = cls.construct_canonical_baseline_record(
            df=df,
            feature_cols=feature_cols,
            user_baseline=None,
        )

        scenario_record_inputs: Dict[str, Any] = dict(baseline_record)
        for col in feature_cols:
            if col in norm_changes and norm_changes[col] is not None:
                scenario_record_inputs[col] = norm_changes[col]

        base_pred_resp = MLTaskService.predict(
            db=db, dataset_id=target_dataset.id, analysis_id=analysis.id, inputs=[baseline_record]
        )
        base_pred_outcome = float(base_pred_resp.predictions[0]) if base_pred_resp.predictions else base_val

        scen_pred_resp = MLTaskService.predict(
            db=db, dataset_id=target_dataset.id, analysis_id=analysis.id, inputs=[scenario_record_inputs]
        )
        scen_pred_outcome = float(scen_pred_resp.predictions[0]) if scen_pred_resp.predictions else base_val

        predicted_delta = float(scen_pred_outcome - base_pred_outcome)
        predicted_delta_pct = (
            float((predicted_delta / base_pred_outcome) * 100.0) if abs(base_pred_outcome) > 1e-6 else 0.0
        )

        if model_pipeline is not None:
            feature_importances = MLExplainabilityService.get_model_feature_importances(
                model_pipeline=model_pipeline, feature_columns=feature_cols
            )
            feature_contributions = MLExplainabilityService.explain_scenario_delta(
                model_pipeline=model_pipeline,
                feature_columns=feature_cols,
                baseline_record=baseline_record,
                scenario_changes=norm_changes,
                baseline_pred=base_pred_outcome,
                scenario_pred=scen_pred_outcome,
            )
        else:
            feature_importances = {col: round(1.0 / max(len(feature_cols), 1), 4) for col in feature_cols}
            feature_contributions = {
                col: {
                    "baseline_value": baseline_record.get(col),
                    "scenario_value": norm_changes.get(col, baseline_record.get(col)),
                    "changed": col in norm_changes and (
                        abs(float(norm_changes[col]) - float(baseline_record.get(col, 0))) > 1e-6
                        if isinstance(norm_changes[col], (int, float)) and isinstance(baseline_record.get(col), (int, float))
                        else str(norm_changes[col]) != str(baseline_record.get(col))
                    ),
                    "marginal_delta": 0.0,
                    "contribution_percentage": 0.0,
                }
                for col in feature_cols
            }

        traceability = {
            "dataset_id": target_dataset.id,
            "ml_analysis_id": analysis.id,
            "target_column": target_col,
            "model_name": analysis.model_name,
            "model_version": analysis.model_version,
            "baseline_record": baseline_record,
            "feature_importances": feature_importances,
            "feature_contributions": feature_contributions,
        }

        scenario.name = resolved_name
        scenario.description = resolved_desc or scenario.description
        scenario.feature_changes = norm_changes
        scenario.base_value = round(base_pred_outcome, 4)
        scenario.predicted_outcome = round(scen_pred_outcome, 4)
        scenario.predicted_delta = round(predicted_delta, 4)
        scenario.predicted_delta_percentage = round(predicted_delta_pct, 2)
        scenario.metadata_json = traceability

        db.add(scenario)
        db.commit()

        return scenario

    @classmethod
    def compare_scenario(
        cls,
        db: Session,
        dataset_id: str,
        scenario_id: str
    ) -> ScenarioComparisonResponse:
        """Return side-by-side comparison between baseline and what-if simulation scenario."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(Scenario).where(
            Scenario.id == scenario_id,
            Scenario.dataset_id == target_dataset.id,
        )
        scenario = db.scalars(stmt).first()
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario '{scenario_id}' not found for dataset '{dataset_id}'.",
            )

        scenario = cls._ensure_scenario_normalized_and_evaluated(db=db, scenario=scenario, dataset_id=target_dataset.id)

        meta = scenario.metadata_json or {}
        baseline_rec = meta.get("baseline_record", {})
        f_importances = meta.get("feature_importances", {})
        f_contributions = meta.get("feature_contributions", {})

        return ScenarioComparisonResponse(
            dataset_id=target_dataset.id,
            ml_analysis_id=scenario.ml_analysis_id or "",
            target_column=scenario.target_column,
            baseline_record=baseline_rec,
            baseline_prediction=scenario.base_value,
            scenario_name=scenario.name,
            scenario_changes=scenario.feature_changes or {},
            scenario_prediction=scenario.predicted_outcome,
            predicted_delta=scenario.predicted_delta,
            predicted_delta_percentage=scenario.predicted_delta_percentage,
            feature_importances=f_importances,
            feature_contributions=f_contributions,
        )

    @classmethod
    def generate_recommendations(
        cls,
        db: Session,
        dataset_id: str,
        scenario_id: Optional[str] = None,
        ml_analysis_id: Optional[str] = None,
    ) -> List[DecisionRecommendationResponse]:
        """Generate evidence-backed recommendations by combining predictions and Phase 4 insights."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision Intelligence requires a processed dataset. Raw datasets are protected.",
            )

        # Fetch active scenario if provided
        scenario = None
        if scenario_id:
            scenario = db.scalars(
                select(Scenario).where(
                    Scenario.id == scenario_id, Scenario.dataset_id == target_dataset.id
                )
            ).first()

        # Fetch active ML analysis
        if ml_analysis_id:
            analysis = db.scalars(
                select(MLAnalysis).where(
                    MLAnalysis.id == ml_analysis_id, MLAnalysis.dataset_id == target_dataset.id
                )
            ).first()
        elif scenario and scenario.ml_analysis_id:
            analysis = db.scalars(
                select(MLAnalysis).where(MLAnalysis.id == scenario.ml_analysis_id)
            ).first()
        else:
            analysis = db.scalars(
                select(MLAnalysis)
                .where(MLAnalysis.dataset_id == target_dataset.id)
                .order_by(MLAnalysis.created_at.desc())
            ).first()

        # Fetch Phase 4 insights
        insights = db.scalars(
            select(DatasetInsight)
            .where(DatasetInsight.dataset_id == target_dataset.id)
            .order_by(DatasetInsight.priority_score.desc())
        ).all()

        recommendations: List[DecisionRecommendation] = []
        source_insight_ids = [ins.id for ins in insights[:3]]

        # Extract model feature importances from trained model artifact
        feature_importances: Dict[str, float] = {}
        if analysis:
            artifact_filename = os.path.basename(analysis.model_artifact_path or "")
            artifact_full_path = str(settings.models_dir_path / artifact_filename) if artifact_filename else ""
            if not os.path.exists(artifact_full_path) and analysis.model_artifact_path and os.path.exists(analysis.model_artifact_path):
                artifact_full_path = analysis.model_artifact_path

            if os.path.exists(artifact_full_path):
                try:
                    model_pipeline = joblib.load(artifact_full_path)
                    feature_importances = MLExplainabilityService.get_model_feature_importances(
                        model_pipeline=model_pipeline,
                        feature_columns=analysis.feature_columns or [],
                    )
                except Exception:
                    feature_importances = {}

            if not feature_importances:
                try:
                    exp_resp = cls.explain_ml_model(db=db, dataset_id=target_dataset.id, analysis_id=analysis.id)
                    feature_importances = exp_resp.feature_importances or {}
                except Exception:
                    feature_importances = {}

        if feature_importances:
            sorted_feats = sorted(feature_importances.items(), key=lambda x: x[1], reverse=True)
            top_features = [f[0] for f in sorted_feats[:3]]
        else:
            top_features = analysis.feature_columns[:3] if (analysis and analysis.feature_columns) else []

        # 1. Predictive Scenario Recommendation
        if scenario and analysis:
            if scenario.predicted_delta > 0:
                rec1_type = "optimization"
                rec1_title = f"Optimize Scenario '{scenario.name}' for Target '{scenario.target_column}'"
                rec1_impact = (
                    f"Simulated feature adjustments indicate a predicted increase of "
                    f"{abs(scenario.predicted_delta):,.2f} ({scenario.predicted_delta_percentage:+.2f}%) in target '{scenario.target_column}'."
                )
                rec1_actions = [
                    f"Adjust feature parameters according to simulated scenario inputs: {scenario.feature_changes}",
                    f"Monitor baseline metric target '{scenario.target_column}' against historical mean ({scenario.base_value:,.2f})",
                    f"Track predictive accuracy using validated model artifact '{analysis.model_name}' (v{analysis.model_version})",
                ]
            elif scenario.predicted_delta < 0:
                rec1_type = "risk_mitigation"
                rec1_title = f"Investigate Adverse Impact in Scenario '{scenario.name}' for Target '{scenario.target_column}'"
                rec1_impact = (
                    f"Simulated feature adjustments indicate a predicted decrease of "
                    f"{abs(scenario.predicted_delta):,.2f} ({scenario.predicted_delta_percentage:+.2f}%) in target '{scenario.target_column}'. "
                    "Direct implementation of this scenario is not recommended without mitigating adjustments."
                )
                rec1_actions = [
                    f"Re-evaluate scenario parameters to mitigate projected target decrease: {scenario.feature_changes}",
                    f"Explore alternative feature adjustments or optimization bounds to avoid negative impact on '{scenario.target_column}'",
                    f"Monitor baseline metric target '{scenario.target_column}' against historical mean ({scenario.base_value:,.2f})",
                ]
            else:
                rec1_type = "action"
                rec1_title = f"Evaluate Neutral Scenario '{scenario.name}' for Target '{scenario.target_column}'"
                rec1_impact = f"Simulated feature adjustments indicate no net change in target '{scenario.target_column}'."
                rec1_actions = [
                    f"Review scenario parameters: {scenario.feature_changes}",
                    "Conduct sensitivity testing on key predictor features",
                    f"Monitor baseline metric target '{scenario.target_column}'",
                ]

            rec1 = DecisionRecommendation(
                id=str(uuid.uuid4()),
                dataset_id=target_dataset.id,
                scenario_id=scenario.id,
                ml_analysis_id=analysis.id,
                insight_id=source_insight_ids[0] if source_insight_ids else None,
                title=rec1_title,
                recommendation_type=rec1_type,
                impact_level="high" if abs(scenario.predicted_delta_percentage) >= 10.0 else "medium",
                expected_impact=rec1_impact,
                action_items=rec1_actions,
                evidence_traceability={
                    "dataset_id": target_dataset.id,
                    "ml_analysis_id": analysis.id,
                    "scenario_id": scenario.id,
                    "model_name": analysis.model_name,
                    "source_insight_ids": source_insight_ids,
                },
            )
            recommendations.append(rec1)

        # 2. Model Baseline & Feature Optimization Recommendation
        if analysis:
            rec2 = DecisionRecommendation(
                id=str(uuid.uuid4()),
                dataset_id=target_dataset.id,
                scenario_id=scenario.id if scenario else None,
                ml_analysis_id=analysis.id,
                insight_id=source_insight_ids[1] if len(source_insight_ids) > 1 else None,
                title=f"Target Feature Allocation for '{analysis.target_column or 'Predictive Task'}'",
                recommendation_type="action",
                impact_level="high",
                expected_impact=(
                    f"ML model '{analysis.model_name}' identified key predictor features: {top_features}. "
                    "Focusing operational tuning on these variables yields maximum predictive leverage."
                ),
                action_items=[
                    f"Prioritize key predictor features: {', '.join(top_features)}",
                    "Conduct regular what-if scenario simulations to evaluate operational sensitivity bounds",
                    "Maintain raw dataset immutability while updating processed feature inputs",
                ],
                evidence_traceability={
                    "dataset_id": target_dataset.id,
                    "ml_analysis_id": analysis.id,
                    "model_name": analysis.model_name,
                    "selection_reason": analysis.selection_reason,
                    "source_insight_ids": source_insight_ids,
                },
            )
            recommendations.append(rec2)

        # 3. Diagnostic Business Insight Recommendation (from Phase 4 insights)
        for ins in insights:
            if ins.recommendation:
                source_col_text = f"source column '{ins.source_column}'" if (ins.source_column and str(ins.source_column).lower() != "all") else "all operational fields"
                rec_ins = DecisionRecommendation(
                    id=str(uuid.uuid4()),
                    dataset_id=target_dataset.id,
                    scenario_id=scenario.id if scenario else None,
                    ml_analysis_id=analysis.id if analysis else None,
                    insight_id=ins.id,
                    title=f"Insight-Driven Recommendation: {ins.title}",
                    recommendation_type="risk_mitigation" if ins.severity in ["WARNING", "CRITICAL"] else "action",
                    impact_level="high" if ins.severity == "CRITICAL" else "medium",
                    expected_impact=ins.observation or ins.title,
                    action_items=[
                        ins.recommendation,
                        f"Review dataset profile metrics across {source_col_text}",
                        "Combine diagnostic findings with scenario simulation bounds",
                    ],
                    evidence_traceability={
                        "dataset_id": target_dataset.id,
                        "insight_id": ins.id,
                        "insight_category": ins.category,
                        "insight_severity": ins.severity,
                        "source_insight_ids": [ins.id],
                    },
                )
                recommendations.append(rec_ins)
                if len(recommendations) >= 5:
                    break

        # Persist generated recommendations in PostgreSQL
        for r in recommendations:
            db.add(r)
        db.commit()

        return [
            DecisionRecommendationResponse(
                id=r.id,
                dataset_id=r.dataset_id,
                scenario_id=r.scenario_id,
                ml_analysis_id=r.ml_analysis_id,
                insight_id=r.insight_id,
                title=r.title,
                recommendation_type=r.recommendation_type,
                impact_level=r.impact_level,
                expected_impact=r.expected_impact,
                action_items=r.action_items or [],
                evidence_traceability=r.evidence_traceability or {},
                created_at=r.created_at.isoformat(),
            )
            for r in recommendations
        ]

    @classmethod
    def get_scenarios_for_dataset(cls, db: Session, dataset_id: str) -> List[ScenarioResponse]:
        """Fetch all stored scenarios for a dataset from both Scenario table and DecisionOptimization table."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        dataset_ids = list(dict.fromkeys([target_dataset.id, dataset_id] + ([target_dataset.parent_id] if target_dataset.parent_id else [])))

        # 1. Retrieve explicit what-if Scenario records
        stmt_scen = (
            select(Scenario)
            .where(Scenario.dataset_id.in_(dataset_ids))
            .order_by(Scenario.created_at.desc())
        )
        records = db.scalars(stmt_scen).all()

        responses: List[ScenarioResponse] = []
        seen_ids = set()

        for r in records:
            if r.id in seen_ids:
                continue
            seen_ids.add(r.id)
            meta = r.metadata_json or {}
            responses.append(
                ScenarioResponse(
                    id=r.id,
                    dataset_id=r.dataset_id,
                    ml_analysis_id=r.ml_analysis_id,
                    name=r.name,
                    description=r.description,
                    target_column=r.target_column,
                    base_value=r.base_value,
                    feature_changes=r.feature_changes or {},
                    predicted_outcome=r.predicted_outcome,
                    predicted_delta=r.predicted_delta,
                    predicted_delta_percentage=r.predicted_delta_percentage,
                    confidence_score=r.confidence_score,
                    feature_importances=meta.get("feature_importances", {}),
                    feature_contributions=meta.get("feature_contributions", {}),
                    metadata_json=meta,
                    created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
                )
            )

        # 2. Retrieve scenarios generated during DecisionOptimization runs
        stmt_opt = (
            select(DecisionOptimization)
            .where(DecisionOptimization.dataset_id.in_(dataset_ids))
            .order_by(DecisionOptimization.created_at.desc())
        )
        opts = db.scalars(stmt_opt).all()

        for opt in opts:
            raw_scenarios = opt.ranked_scenarios or []
            if not raw_scenarios and opt.recommended_scenario:
                raw_scenarios = [opt.recommended_scenario]

            for s_idx, sc in enumerate(raw_scenarios, start=1):
                sc_id = sc.get("scenario_id") or f"{opt.id}_scen_{s_idx}"
                if sc_id in seen_ids:
                    continue
                seen_ids.add(sc_id)

                changes = sc.get("changes", {})
                change_str = ", ".join([f"{k}={v}" for k, v in changes.items()]) if changes else "baseline bounds"
                sc_name = f"Optimization Scenario #{s_idx} ({change_str})"
                sc_desc = sc.get("explanation") or f"Optimization scenario for target '{opt.target_column}'"
                b_pred = float(sc.get("baseline_prediction", opt.baseline_prediction or 0.0))
                p_target = float(sc.get("predicted_target", opt.recommended_prediction or 0.0))
                abs_d = float(sc.get("absolute_delta", opt.expected_change or 0.0))
                pct_d = float(sc.get("percentage_delta", opt.expected_change_percent or 0.0))
                b_inputs = opt.constraints.get("baseline_inputs") if (opt.constraints and isinstance(opt.constraints, dict)) else {}

                responses.append(
                    ScenarioResponse(
                        id=sc_id,
                        dataset_id=opt.dataset_id,
                        ml_analysis_id=opt.ml_analysis_id,
                        name=sc_name,
                        description=sc_desc,
                        target_column=opt.target_column,
                        base_value=b_pred,
                        feature_changes=changes,
                        predicted_outcome=p_target,
                        predicted_delta=abs_d,
                        predicted_delta_percentage=pct_d,
                        confidence_score=opt.optimization_score or 0.85,
                        feature_importances={},
                        feature_contributions={},
                        metadata_json={"optimization_id": opt.id, "baseline_inputs": b_inputs},
                        created_at=opt.created_at.isoformat() if opt.created_at else datetime.now(timezone.utc).isoformat(),
                    )
                )

        return responses

    @classmethod
    def get_recommendations_for_dataset(cls, db: Session, dataset_id: str) -> List[DecisionRecommendationResponse]:
        """Fetch all stored recommendations for a dataset from both persistence tables."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        dataset_ids = list(dict.fromkeys([target_dataset.id, dataset_id] + ([target_dataset.parent_id] if target_dataset.parent_id else [])))

        # 1. Query DecisionRecommendation table
        stmt_rec = (
            select(DecisionRecommendation)
            .where(DecisionRecommendation.dataset_id.in_(dataset_ids))
            .order_by(DecisionRecommendation.created_at.desc())
        )
        rec_records = db.scalars(stmt_rec).all()

        # 2. Query DecisionRecommendationEvaluation table
        stmt_eval = (
            select(DecisionRecommendationEvaluation)
            .where(DecisionRecommendationEvaluation.dataset_id.in_(dataset_ids))
            .order_by(DecisionRecommendationEvaluation.created_at.desc())
        )
        eval_records = db.scalars(stmt_eval).all()

        responses: List[DecisionRecommendationResponse] = []
        seen_ids = set()

        for r in rec_records:
            if r.id in seen_ids:
                continue
            seen_ids.add(r.id)
            responses.append(
                DecisionRecommendationResponse(
                    id=r.id,
                    dataset_id=r.dataset_id,
                    scenario_id=r.scenario_id,
                    ml_analysis_id=r.ml_analysis_id,
                    insight_id=r.insight_id,
                    title=r.title,
                    recommendation_type=r.recommendation_type,
                    impact_level=r.impact_level,
                    expected_impact=r.expected_impact,
                    action_items=r.action_items or [],
                    evidence_traceability=r.evidence_traceability or {},
                    created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
                )
            )

        for r in eval_records:
            if r.id in seen_ids:
                continue
            seen_ids.add(r.id)
            ev_data = r.evidence if isinstance(r.evidence, dict) else {}
            pct_d = getattr(r, "percentage_delta", 0.0) or 0.0
            abs_d = getattr(r, "absolute_delta", 0.0) or 0.0
            target_m = getattr(r, "target_metric", "Metric") or "Metric"
            impact_lvl = "high" if abs(pct_d) >= 10.0 else ("medium" if abs(pct_d) >= 5.0 else "low")
            actions = []
            if getattr(r, "tradeoffs", None):
                actions.append(r.tradeoffs)
            if getattr(r, "changed_features", None):
                actions.append(f"Adjust feature parameters: {r.changed_features}")
            if not actions:
                actions = [getattr(r, "rationale", r.title)]

            responses.append(
                DecisionRecommendationResponse(
                    id=r.id,
                    dataset_id=r.dataset_id,
                    scenario_id=r.scenario_id,
                    ml_analysis_id=r.ml_analysis_id,
                    insight_id=ev_data.get("insight_ids", [None])[0] if (isinstance(ev_data, dict) and ev_data.get("insight_ids")) else None,
                    title=r.title,
                    recommendation_type=r.recommendation_type.lower(),
                    impact_level=impact_lvl,
                    expected_impact=getattr(r, "rationale", None) or f"Projected change of {abs_d:,.2f} ({pct_d:+.2f}%) in {target_m}.",
                    action_items=actions,
                    evidence_traceability=ev_data,
                    created_at=r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
                )
            )

        return responses

    @classmethod
    def get_decision_summary(cls, db: Session, dataset_id: str) -> DecisionSummaryResponse:
        """Fetch full Decision Intelligence summary (scenarios + recommendations) for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        scenarios = cls.get_scenarios_for_dataset(db=db, dataset_id=target_dataset.id)
        recommendations = cls.get_recommendations_for_dataset(db=db, dataset_id=target_dataset.id)

        return DecisionSummaryResponse(
            dataset_id=target_dataset.id,
            is_processed=target_dataset.is_processed,
            scenarios=scenarios,
            recommendations=recommendations,
            message="Decision Intelligence summary retrieved successfully.",
        )
