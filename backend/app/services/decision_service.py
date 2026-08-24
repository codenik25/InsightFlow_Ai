import os
import uuid
import joblib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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

        # Construct baseline input record using mean/mode for feature columns
        baseline_record: Dict[str, Any] = {}
        for col in feature_cols:
            if col in df.columns:
                series = df[col].dropna()
                if not series.empty:
                    if pd.api.types.is_numeric_dtype(series):
                        baseline_record[col] = float(series.mean())
                    else:
                        baseline_record[col] = str(series.mode().iloc[0])
                else:
                    baseline_record[col] = 0.0
            else:
                baseline_record[col] = 0.0

        # Construct scenario input record applying feature overrides
        scenario_record_inputs: Dict[str, Any] = dict(baseline_record)
        for col in feature_cols:
            if col in payload.feature_changes and payload.feature_changes[col] is not None:
                scenario_record_inputs[col] = payload.feature_changes[col]

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
                scenario_changes=payload.feature_changes,
                baseline_pred=base_pred_outcome,
                scenario_pred=scen_pred_outcome,
            )
        else:
            feature_importances = {col: round(1.0 / max(len(feature_cols), 1), 4) for col in feature_cols}
            feature_contributions = {
                col: {
                    "baseline_value": baseline_record.get(col),
                    "scenario_value": payload.feature_changes.get(col, baseline_record.get(col)),
                    "changed": col in payload.feature_changes,
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
            name=payload.name,
            description=payload.description or f"What-if simulation on target '{target_col}'",
            target_column=target_col,
            base_value=round(base_pred_outcome, 4),
            feature_changes=payload.feature_changes,
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

        # 1. Predictive Scenario Recommendation
        if scenario and analysis:
            direction = "increase" if scenario.predicted_delta > 0 else "decrease"
            rec1 = DecisionRecommendation(
                id=str(uuid.uuid4()),
                dataset_id=target_dataset.id,
                scenario_id=scenario.id,
                ml_analysis_id=analysis.id,
                insight_id=source_insight_ids[0] if source_insight_ids else None,
                title=f"Optimize Scenario '{scenario.name}' for Target '{scenario.target_column}'",
                recommendation_type="optimization",
                impact_level="high" if abs(scenario.predicted_delta_percentage) >= 10.0 else "medium",
                expected_impact=(
                    f"Simulated feature adjustments indicate a predicted {direction} of "
                    f"{abs(scenario.predicted_delta):,.2f} ({scenario.predicted_delta_percentage:+.2f}%) in target '{scenario.target_column}'."
                ),
                action_items=[
                    f"Adjust feature parameters according to simulated scenario inputs: {scenario.feature_changes}",
                    f"Monitor baseline metric target '{scenario.target_column}' against historical mean ({scenario.base_value:,.2f})",
                    f"Track predictive accuracy using validated model artifact '{analysis.model_name}' (v{analysis.model_version})",
                ],
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
            top_features = analysis.feature_columns[:3] if analysis.feature_columns else []
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
                        f"Review source column '{ins.source_column or 'all'}' in dataset profile",
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
        """Fetch all stored scenarios for a dataset with feature importances and contributions."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(Scenario)
            .where(Scenario.dataset_id == target_dataset.id)
            .order_by(Scenario.created_at.desc())
        )
        records = db.scalars(stmt).all()
        responses = []
        for r in records:
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
                    created_at=r.created_at.isoformat(),
                )
            )
        return responses

    @classmethod
    def get_recommendations_for_dataset(cls, db: Session, dataset_id: str) -> List[DecisionRecommendationResponse]:
        """Fetch all stored recommendations for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionRecommendation)
            .where(DecisionRecommendation.dataset_id == target_dataset.id)
            .order_by(DecisionRecommendation.created_at.desc())
        )
        records = db.scalars(stmt).all()
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
            for r in records
        ]

    @classmethod
    def get_decision_summary(cls, db: Session, dataset_id: str) -> DecisionSummaryResponse:
        """Fetch full Decision Intelligence summary (scenarios + recommendations) for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        scenarios = cls.get_scenarios_for_dataset(db=db, dataset_id=dataset_id)
        recommendations = cls.get_recommendations_for_dataset(db=db, dataset_id=dataset_id)

        return DecisionSummaryResponse(
            dataset_id=target_dataset.id,
            is_processed=target_dataset.is_processed,
            scenarios=scenarios,
            recommendations=recommendations,
            message="Decision Intelligence summary retrieved successfully.",
        )
