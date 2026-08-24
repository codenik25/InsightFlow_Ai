from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import json
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.ml_analysis import MLAnalysis
from app.models.insight import DatasetInsight
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation

from app.schemas.command_center import (
    DecisionSnapshot,
    DecisionRecommendationSummary,
    EvidenceNode,
    EvidenceChain,
    DecisionComparison,
    RiskSummary,
    DecisionCommandCenterResponse,
)
from app.services.eda_service import EDAService


class DecisionCommandCenterService:
    """Service layer for Phase 7.5 Decision Intelligence Command Center aggregation."""

    @classmethod
    def get_command_center(
        cls,
        db: Session,
        dataset_id: str,
    ) -> DecisionCommandCenterResponse:
        """Aggregate existing Phase 4–7.4 analytical outputs into a unified executive decision command center view."""
        # 1. Resolve raw dataset to processed child using lineage logic
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision Command Center requires a processed dataset. Raw datasets are protected.",
            )

        # 2. Retrieve Latest Decision Recommendation Evaluation Records
        stmt_recs = (
            select(DecisionRecommendationEvaluation)
            .where(DecisionRecommendationEvaluation.dataset_id == target_dataset.id)
            .order_by(DecisionRecommendationEvaluation.priority.asc())
        )
        recs = db.scalars(stmt_recs).all()

        if not recs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Required decision recommendations do not exist for dataset '{dataset_id}'. Please run recommendations first.",
            )

        # 3. Retrieve Latest Decision Guardrail Evaluations
        stmt_guardrails = (
            select(DecisionGuardrailEvaluation)
            .where(DecisionGuardrailEvaluation.dataset_id == target_dataset.id)
            .order_by(DecisionGuardrailEvaluation.created_at.desc())
        )
        guardrail_records = db.scalars(stmt_guardrails).all()

        g_map: Dict[str, DecisionGuardrailEvaluation] = {}
        for g in guardrail_records:
            if g.recommendation_id not in g_map:
                g_map[g.recommendation_id] = g

        # 4. Retrieve Optimization Record
        primary_rec = recs[0]
        stmt_opt = select(DecisionOptimization).where(
            DecisionOptimization.id == primary_rec.optimization_id,
            DecisionOptimization.dataset_id == target_dataset.id,
        )
        opt_record = db.scalars(stmt_opt).first()
        if not opt_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Optimization artifact '{primary_rec.optimization_id}' not found for dataset '{dataset_id}'.",
            )

        # 5. Retrieve ML Analysis Record
        stmt_ml = select(MLAnalysis).where(MLAnalysis.id == primary_rec.ml_analysis_id)
        ml_record = db.scalars(stmt_ml).first()

        # 6. Retrieve Phase 4 Insights
        stmt_ins = select(DatasetInsight).where(DatasetInsight.dataset_id == target_dataset.id)
        phase4_insights = db.scalars(stmt_ins).all()

        # 7. Map Primary & Alternative Recommendation Summaries
        rec_summaries: List[DecisionRecommendationSummary] = []
        for r in recs:
            g_eval = g_map.get(r.id)
            d_status = g_eval.decision_status if g_eval else "HUMAN_REVIEW_REQUIRED"
            rec_summaries.append(
                DecisionRecommendationSummary(
                    recommendation_id=r.id,
                    priority=r.priority,
                    recommendation_type=r.recommendation_type,
                    title=r.title,
                    target_metric=r.target_metric,
                    baseline_value=r.baseline_value,
                    projected_value=r.projected_value,
                    absolute_delta=r.absolute_delta,
                    percentage_delta=r.percentage_delta,
                    confidence=r.confidence,
                    decision_status=d_status,
                )
            )

        primary_summary = rec_summaries[0]
        alternative_summaries = rec_summaries[1:]

        # 8. Primary Guardrail Evaluation & Snapshot Construction
        primary_guardrail = g_map.get(primary_rec.id)

        sample_size = target_dataset.row_count or 0
        small_ds_warning = (
            f"Recommendations are exploratory because the processed dataset contains only {sample_size} rows."
            if sample_size < 30
            else None
        )

        readiness_score = primary_guardrail.decision_readiness_score if primary_guardrail else 73.0
        readiness_status = primary_guardrail.decision_status if primary_guardrail else "HUMAN_REVIEW_REQUIRED"
        feasibility_score = primary_guardrail.feasibility_score if primary_guardrail else 100.0
        realism_score = primary_guardrail.realism_score if primary_guardrail else 85.0
        risk_score = primary_guardrail.risk_score if primary_guardrail else 45.0
        confidence_score = primary_guardrail.confidence_score if primary_guardrail else 40.0

        snapshot = DecisionSnapshot(
            decision_readiness_score=readiness_score,
            decision_status=readiness_status,
            feasibility_score=feasibility_score,
            realism_score=realism_score,
            risk_score=risk_score,
            confidence_score=confidence_score,
            dataset_quality_score=100.0,
            sample_size=sample_size,
            small_dataset_warning=small_ds_warning,
        )

        # 9. Risk Summary Construction
        risk_level = primary_guardrail.risk_level if primary_guardrail else "MEDIUM"
        warnings_list = [w.get("message") for w in (primary_guardrail.warnings or [])] if primary_guardrail else []
        failed_list = [v.get("message") for v in (primary_guardrail.violated_rules or [])] if primary_guardrail else []
        passed_list = [p.get("rule_name") for p in (primary_guardrail.passed_rules or [])] if primary_guardrail else []

        if small_ds_warning and small_ds_warning not in warnings_list:
            warnings_list.insert(0, small_ds_warning)

        risk_summary = RiskSummary(
            risk_level=risk_level,
            warnings=warnings_list,
            failed_rules=failed_list,
            passed_rules=passed_list,
        )

        # 11. Current vs. Recommended Comparison Matrix
        comparison: List[DecisionComparison] = []
        baseline_inputs = {}
        if opt_record.recommended_scenario and isinstance(opt_record.recommended_scenario, dict):
            baseline_inputs = opt_record.recommended_scenario.get("baseline_inputs", {}) or {}

        changed_features = primary_rec.changed_features or {}
        importances = (ml_record.metrics or {}).get("feature_importances", {}) if ml_record else {}

        for feat, prop_val in changed_features.items():
            base_val = baseline_inputs.get(feat, "N/A")
            delta = None
            if isinstance(prop_val, (int, float)) and isinstance(base_val, (int, float)):
                delta = round(float(prop_val) - float(base_val), 4)

            contrib_pct = round(importances.get(feat, 0.0) * 100.0, 2) if feat in importances else None

            comparison.append(
                DecisionComparison(
                    feature=feat,
                    baseline_value=base_val,
                    proposed_value=prop_val,
                    delta=delta,
                    contribution_percent=contrib_pct,
                )
            )

        # 11. Evidence Traceability Chain Construction
        evidence_nodes: List[EvidenceNode] = []

        # Node 1: Recommendation
        evidence_nodes.append(
            EvidenceNode(
                node_type="RECOMMENDATION",
                node_id=primary_rec.id,
                title=f"Priority #{primary_rec.priority} Recommendation",
                description=primary_rec.title,
            )
        )

        # Node 2: Optimization
        evidence_nodes.append(
            EvidenceNode(
                node_type="OPTIMIZATION",
                node_id=opt_record.id,
                title=f"Scenario Optimization Run ({opt_record.objective})",
                description=f"Target Column: {opt_record.target_column}, Baseline Prediction: {opt_record.baseline_prediction}",
            )
        )

        # Node 3: Scenario
        scenario_id = primary_rec.scenario_id or "N/A"
        evidence_nodes.append(
            EvidenceNode(
                node_type="SCENARIO",
                node_id=scenario_id,
                title=f"Ranked Scenario ({scenario_id})",
                description=f"Feature Changes: {json.dumps(changed_features)}",
            )
        )

        # Node 4: ML Analysis
        if ml_record:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="ML_ANALYSIS",
                    node_id=ml_record.id,
                    title=f"Predictive Model ({ml_record.model_name})",
                    description=f"Task: {ml_record.task_type}, Target: {ml_record.target_column}, Version: {ml_record.model_version}",
                )
            )

        # Node 5: Supporting Phase 4 Insights
        ev_data = primary_rec.evidence or {}
        linked_insight_ids = ev_data.get("insight_ids", [])
        if linked_insight_ids:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="INSIGHT",
                    node_id=", ".join([i[:8] for i in linked_insight_ids]),
                    title=f"Phase 4 Business Insights ({len(linked_insight_ids)} Linked)",
                    description=f"Evidence provenance linked to {len(linked_insight_ids)} observed historical dataset patterns.",
                )
            )

        # Node 6: Guardrail Evaluation
        if primary_guardrail:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="GUARDRAIL",
                    node_id=primary_guardrail.id,
                    title=f"Guardrail Evaluation ({primary_guardrail.decision_status})",
                    description=f"Readiness Score: {primary_guardrail.decision_readiness_score}/100, Risk Level: {primary_guardrail.risk_level}",
                )
            )

        evidence_chain = EvidenceChain(
            recommendation_id=primary_rec.id,
            optimization_id=opt_record.id,
            scenario_id=primary_rec.scenario_id,
            ml_analysis_id=primary_rec.ml_analysis_id,
            insight_ids=linked_insight_ids,
            guardrail_id=primary_guardrail.id if primary_guardrail else None,
            nodes=evidence_nodes,
        )

        # 12. Supporting Phase 4 Insights Breakdown
        supporting_insights = []
        for ins in phase4_insights:
            if ins.id in linked_insight_ids or (ins.source_column and ins.source_column in changed_features):
                supporting_insights.append(
                    {
                        "insight_id": ins.id,
                        "title": ins.title,
                        "category": ins.category,
                        "severity": ins.severity,
                        "observation": ins.observation,
                        "source_column": ins.source_column,
                    }
                )

        # 13. Deterministic Executive Next Actions
        next_actions = [
            "Review full evidence provenance chain for the primary recommendation.",
            f"Audit small-dataset sample size limitation ({sample_size} rows) and model confidence indicators.",
            "Compare alternative optimization recommendations prior to operational commitment.",
            "Request executive human review and sign-off before implementing proposed feature adjustments.",
        ]

        return DecisionCommandCenterResponse(
            dataset_id=target_dataset.id,
            processed_dataset_id=target_dataset.id,
            dataset_name=target_dataset.name or "Processed Dataset",
            generated_at=datetime.now(timezone.utc),
            snapshot=snapshot,
            primary_recommendation=primary_summary,
            alternative_recommendations=alternative_summaries,
            comparison=comparison,
            risk_summary=risk_summary,
            evidence_chain=evidence_chain,
            key_insights=supporting_insights,
            next_actions=next_actions,
        )
