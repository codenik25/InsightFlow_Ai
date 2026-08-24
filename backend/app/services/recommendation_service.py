import uuid
import pandas as pd
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.insight import DatasetInsight
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.schemas.recommendation import (
    RecommendationRequest,
    RecommendationEvidence,
    DecisionRecommendation,
    RecommendationResponse,
)
from app.services.eda_service import EDAService


class RecommendationService:
    """Service layer for evidence-backed executive decision recommendation generation and evaluation."""

    @classmethod
    def generate_recommendations(
        cls,
        db: Session,
        dataset_id: str,
        payload: RecommendationRequest,
    ) -> RecommendationResponse:
        """Generate evidence-backed executive decision recommendations from stored optimization scenarios."""
        # 1. Validate max_recommendations input
        if payload.max_recommendations <= 0 or payload.max_recommendations > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_recommendations must be between 1 and 10.",
            )

        # 2. Resolve Processed Dataset (raw dataset protection)
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision recommendations require a processed dataset. Raw datasets are protected.",
            )

        # 3. Load Stored Optimization Record
        if payload.optimization_id:
            stmt_opt = select(DecisionOptimization).where(
                DecisionOptimization.id == payload.optimization_id,
                DecisionOptimization.dataset_id == target_dataset.id,
            )
            opt_record = db.scalars(stmt_opt).first()
            if not opt_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Optimization '{payload.optimization_id}' not found for dataset '{dataset_id}'.",
                )
        else:
            stmt_opt = (
                select(DecisionOptimization)
                .where(DecisionOptimization.dataset_id == target_dataset.id)
                .order_by(DecisionOptimization.created_at.desc())
            )
            opt_record = db.scalars(stmt_opt).first()
            if not opt_record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No decision optimization found for dataset '{dataset_id}'. Please run optimization first.",
                )

        # 4. Load Stored ML Analysis Record
        stmt_ml = select(MLAnalysis).where(MLAnalysis.id == opt_record.ml_analysis_id)
        ml_record = db.scalars(stmt_ml).first()

        # 5. Retrieve Phase 4 Insights for Evidence Linkage
        stmt_ins = select(DatasetInsight).where(DatasetInsight.dataset_id == target_dataset.id)
        phase4_insights = db.scalars(stmt_ins).all()

        # 6. Extract Ranked Scenarios from Phase 7.2B
        raw_scenarios = opt_record.ranked_scenarios or []
        if not raw_scenarios and opt_record.recommended_scenario:
            raw_scenarios = [opt_record.recommended_scenario]

        # 7. Filter & Select Top Candidates
        candidates = []
        seen_changes = set()
        for sc in raw_scenarios:
            changes = sc.get("changes", {})
            if not changes:
                continue
            # Skip near-zero delta baseline scenarios if non-zero candidates exist
            if abs(sc.get("absolute_delta", 0.0)) < 1e-6:
                continue
            sc_key = str(sorted(changes.items()))
            if sc_key in seen_changes:
                continue
            seen_changes.add(sc_key)
            candidates.append(sc)

        # Fallback if all scenarios had zero delta
        if not candidates and raw_scenarios:
            seen_changes.clear()
            for sc in raw_scenarios:
                changes = sc.get("changes", {})
                if not changes:
                    continue
                sc_key = str(sorted(changes.items()))
                if sc_key not in seen_changes:
                    seen_changes.add(sc_key)
                    candidates.append(sc)

        candidates = candidates[: payload.max_recommendations]

        # 8. Determine Dataset Size & Confidence Base
        total_rows = target_dataset.row_count or 0
        is_small_dataset = total_rows < 30

        # Model Quality Context
        ml_metrics = ml_record.metrics if (ml_record and isinstance(ml_record.metrics, dict)) else {}
        r2_score = ml_metrics.get("r2")

        if is_small_dataset:
            overall_confidence = "EXPLORATORY"
            warning_msg = f"Recommendations are exploratory because the processed dataset contains only {total_rows} rows."
        elif r2_score is not None and r2_score < 0.50:
            overall_confidence = "EXPLORATORY"
            warning_msg = f"Recommendations are exploratory because the predictive model R² score ({round(r2_score, 2)}) indicates moderate predictive uncertainty."
        else:
            overall_confidence = "MODERATE"
            warning_msg = None

        # 9. Construct Deterministic Recommendations
        recommendations_list: List[DecisionRecommendation] = []
        db_evaluations: List[DecisionRecommendationEvaluation] = []
        created_iso = datetime.now(timezone.utc).isoformat()

        for idx, sc in enumerate(candidates):
            rec_id = str(uuid.uuid4())
            priority = idx + 1
            scenario_id = sc.get("scenario_id", f"scen_{priority}")
            changes = sc.get("changes", {})
            pred_target = float(sc.get("predicted_target", 0.0))
            base_pred = float(sc.get("baseline_prediction", 0.0))
            abs_delta = float(sc.get("absolute_delta", 0.0))
            pct_delta = float(sc.get("percentage_delta", 0.0))

            # Recommendation Type Rule
            changed_cols = list(changes.keys())
            if len(changed_cols) == 1:
                col = changed_cols[0]
                val = changes[col]
                if isinstance(val, (int, float)):
                    rec_type = "PERFORMANCE" if abs_delta > 0 else "EFFICIENCY"
                else:
                    rec_type = "DIVERSIFICATION"
            else:
                rec_type = "GROWTH" if abs_delta > 0 else "RISK_MITIGATION"

            # Actionable Title
            change_phrases = []
            for col, val in changes.items():
                change_phrases.append(f"{col} to {val}")
            title = f"Prioritize scenario adjusting {', '.join(change_phrases)}"

            # Deterministic Trade-offs String
            if len(changed_cols) == 1:
                col = changed_cols[0]
                val = changes[col]
                tradeoffs = f"Requires adjusting {col} to {val} while maintaining existing operational parameters for all other features."
            else:
                tradeoffs = f"Requires simultaneous operational adjustments across {', '.join(changed_cols)}."

            # Evidence Linkage (matching Phase 4 Insights)
            linked_insight_ids = []
            for ins in phase4_insights:
                src_col = ins.source_column or ""
                dim_col = ins.dimension or ""
                title_str = ins.title or ""
                if src_col in changed_cols or dim_col in changed_cols or any(col.lower() in title_str.lower() for col in changed_cols):
                    linked_insight_ids.append(ins.id)

            evidence_obj = RecommendationEvidence(
                dataset_id=target_dataset.id,
                ml_analysis_id=opt_record.ml_analysis_id,
                optimization_id=opt_record.id,
                scenario_id=scenario_id,
                insight_ids=list(dict.fromkeys(linked_insight_ids)),
            )

            # Deterministic Rationale String
            sign_str = "+" if abs_delta > 0 else ""
            rationale_lines = [
                f"The model projects {opt_record.target_column} of {pred_target:,.2f} under this scenario, compared with the baseline prediction of {base_pred:,.2f}, representing a projected improvement of {sign_str}{abs_delta:,.2f} ({sign_str}{pct_delta:.2f}%).",
                f"This scenario ranks #{priority} among feasible optimization scenarios.",
            ]
            if is_small_dataset:
                rationale_lines.append(f"Because the processed dataset contains only {total_rows} rows, this recommendation is exploratory.")
            elif r2_score is not None:
                rationale_lines.append(f"Model validation metrics report R² = {round(r2_score, 4)}.")

            rationale = " ".join(rationale_lines)

            rec_obj = DecisionRecommendation(
                id=rec_id,
                title=title,
                recommendation_type=rec_type,
                priority=priority,
                target_metric=opt_record.target_column,
                baseline_value=base_pred,
                projected_value=pred_target,
                absolute_delta=abs_delta,
                percentage_delta=pct_delta,
                changed_features=changes,
                rationale=rationale,
                tradeoffs=tradeoffs,
                confidence=overall_confidence,
                evidence=evidence_obj,
            )
            recommendations_list.append(rec_obj)

            # DB Record
            db_eval = DecisionRecommendationEvaluation(
                id=rec_id,
                dataset_id=target_dataset.id,
                ml_analysis_id=opt_record.ml_analysis_id,
                optimization_id=opt_record.id,
                scenario_id=scenario_id,
                recommendation_type=rec_type,
                priority=priority,
                title=title,
                target_metric=opt_record.target_column,
                baseline_value=base_pred,
                projected_value=pred_target,
                absolute_delta=abs_delta,
                percentage_delta=pct_delta,
                changed_features=changes,
                rationale=rationale,
                tradeoffs=tradeoffs,
                confidence=overall_confidence,
                evidence=evidence_obj.model_dump(),
            )
            db_evaluations.append(db_eval)

        # 10. Persist DB Records
        for db_e in db_evaluations:
            db.add(db_e)
        db.commit()

        # 11. Return RecommendationResponse
        return RecommendationResponse(
            dataset_id=target_dataset.id,
            optimization_id=opt_record.id,
            recommendations=recommendations_list,
            overall_confidence=overall_confidence,
            warning=warning_msg,
            generated_at=created_iso,
        )

    @classmethod
    def get_recommendations_for_dataset(cls, db: Session, dataset_id: str) -> List[DecisionRecommendation]:
        """Retrieve stored decision recommendations for a dataset."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = (
            select(DecisionRecommendationEvaluation)
            .where(DecisionRecommendationEvaluation.dataset_id == target_dataset.id)
            .order_by(DecisionRecommendationEvaluation.priority.asc(), DecisionRecommendationEvaluation.created_at.desc())
        )
        records = db.scalars(stmt).all()
        results = []
        for r in records:
            ev_data = r.evidence if isinstance(r.evidence, dict) else {}
            evidence_obj = RecommendationEvidence(
                dataset_id=ev_data.get("dataset_id", r.dataset_id),
                ml_analysis_id=ev_data.get("ml_analysis_id", r.ml_analysis_id),
                optimization_id=ev_data.get("optimization_id", r.optimization_id),
                scenario_id=ev_data.get("scenario_id", r.scenario_id),
                insight_ids=ev_data.get("insight_ids", []),
            )
            results.append(
                DecisionRecommendation(
                    id=r.id,
                    title=r.title,
                    recommendation_type=r.recommendation_type,
                    priority=r.priority,
                    target_metric=r.target_metric,
                    baseline_value=r.baseline_value,
                    projected_value=r.projected_value,
                    absolute_delta=r.absolute_delta,
                    percentage_delta=r.percentage_delta,
                    changed_features=r.changed_features or {},
                    rationale=r.rationale,
                    tradeoffs=r.tradeoffs,
                    confidence=r.confidence,
                    evidence=evidence_obj,
                )
            )
        return results

    @classmethod
    def get_recommendation_by_id(cls, db: Session, dataset_id: str, recommendation_id: str) -> DecisionRecommendation:
        """Retrieve a specific decision recommendation by ID."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionRecommendationEvaluation).where(
            DecisionRecommendationEvaluation.id == recommendation_id,
            DecisionRecommendationEvaluation.dataset_id == target_dataset.id,
        )
        r = db.scalars(stmt).first()
        if not r:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{recommendation_id}' not found for dataset '{dataset_id}'.",
            )
        ev_data = r.evidence if isinstance(r.evidence, dict) else {}
        evidence_obj = RecommendationEvidence(
            dataset_id=ev_data.get("dataset_id", r.dataset_id),
            ml_analysis_id=ev_data.get("ml_analysis_id", r.ml_analysis_id),
            optimization_id=ev_data.get("optimization_id", r.optimization_id),
            scenario_id=ev_data.get("scenario_id", r.scenario_id),
            insight_ids=ev_data.get("insight_ids", []),
        )
        return DecisionRecommendation(
            id=r.id,
            title=r.title,
            recommendation_type=r.recommendation_type,
            priority=r.priority,
            target_metric=r.target_metric,
            baseline_value=r.baseline_value,
            projected_value=r.projected_value,
            absolute_delta=r.absolute_delta,
            percentage_delta=r.percentage_delta,
            changed_features=r.changed_features or {},
            rationale=r.rationale,
            tradeoffs=r.tradeoffs,
            confidence=r.confidence,
            evidence=evidence_obj,
        )
