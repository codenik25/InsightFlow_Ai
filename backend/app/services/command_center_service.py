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
from app.models.scenario import Scenario
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
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
    def _resolve_recommendation_metrics(cls, db: Session, r: Any, scen_record: Any, opt_record: Any, evidence_dict: Dict[str, Any]):
        base_val = getattr(r, "baseline_value", None)
        proj_val = getattr(r, "projected_value", None)
        abs_delta = getattr(r, "absolute_delta", None)
        pct_delta = getattr(r, "percentage_delta", None)

        r_scen_id = getattr(r, "scenario_id", None)
        r_scen = None
        if r_scen_id:
            r_scen = db.scalars(select(Scenario).where(Scenario.id == r_scen_id)).first()
        if not r_scen:
            r_scen = scen_record

        if r_scen:
            if base_val is None:
                base_val = getattr(r_scen, "base_value", None)
            if proj_val is None:
                proj_val = getattr(r_scen, "predicted_outcome", None)
            if abs_delta is None:
                abs_delta = getattr(r_scen, "predicted_delta", None)
            if pct_delta is None:
                pct_delta = getattr(r_scen, "predicted_delta_percentage", None)

        if isinstance(evidence_dict, dict):
            if base_val is None:
                base_val = evidence_dict.get("baseline_prediction") or evidence_dict.get("baseline_value")
            if proj_val is None:
                proj_val = evidence_dict.get("predicted_outcome") or evidence_dict.get("projected_value")
            if abs_delta is None:
                abs_delta = evidence_dict.get("predicted_delta") or evidence_dict.get("absolute_delta")
            if pct_delta is None:
                pct_delta = evidence_dict.get("predicted_delta_percentage") or evidence_dict.get("percentage_delta")

        if opt_record:
            if base_val is None:
                base_val = getattr(opt_record, "baseline_prediction", None)
            if proj_val is None:
                proj_val = getattr(opt_record, "recommended_prediction", None)
            if abs_delta is None:
                abs_delta = getattr(opt_record, "expected_change", None)
            if pct_delta is None:
                pct_delta = getattr(opt_record, "expected_change_percent", None)

        if base_val is not None and proj_val is not None:
            try:
                b_num = float(base_val)
                p_num = float(proj_val)
                if abs_delta is None:
                    abs_delta = round(p_num - b_num, 4)
                if pct_delta is None and b_num != 0:
                    pct_delta = round(((p_num - b_num) / abs(b_num)) * 100.0, 4)
            except (ValueError, TypeError):
                pass

        return base_val, proj_val, abs_delta, pct_delta

    @classmethod
    def get_command_center(
        cls,
        db: Session,
        dataset_id: str,
        target_recommendation_id: Optional[str] = None,
    ) -> DecisionCommandCenterResponse:
        """Aggregate existing Phase 4–7.4 analytical outputs into a unified executive decision command center view."""
        # 1. Resolve raw dataset to processed child using lineage logic
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not target_dataset.is_processed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision Command Center requires a processed dataset. Raw datasets are protected.",
            )

        # 2. Retrieve Decision Recommendation Records across both tables
        stmt1 = (
            select(DecisionRecommendation)
            .where(DecisionRecommendation.dataset_id == target_dataset.id)
            .order_by(DecisionRecommendation.created_at.desc())
        )
        recs1 = db.scalars(stmt1).all()

        stmt2 = (
            select(DecisionRecommendationEvaluation)
            .where(DecisionRecommendationEvaluation.dataset_id == target_dataset.id)
            .order_by(DecisionRecommendationEvaluation.priority.asc(), DecisionRecommendationEvaluation.created_at.desc())
        )
        recs2 = db.scalars(stmt2).all()

        all_recs = []
        seen_ids = set()
        for r in list(recs1) + list(recs2):
            if r.id not in seen_ids:
                seen_ids.add(r.id)
                all_recs.append(r)

        if not all_recs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Required decision recommendations do not exist for dataset '{dataset_id}'. Please run recommendations first.",
            )

        # Handle targeted recommendation ID if supplied
        if target_recommendation_id:
            target_matches = [r for r in all_recs if r.id == target_recommendation_id]
            if not target_matches:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Recommendation '{target_recommendation_id}' not found for dataset '{dataset_id}'.",
                )
            primary_rec = target_matches[0]
            alt_recs = [r for r in all_recs if r.id != target_recommendation_id]
            recs = [primary_rec] + alt_recs
        else:
            recs = all_recs
            primary_rec = recs[0]

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

        # 4. Resolve Optimization & ML Analysis & Scenario metadata for primary_rec
        evidence_dict = getattr(primary_rec, "evidence_traceability", None) or getattr(primary_rec, "evidence", None) or {}
        opt_id = getattr(primary_rec, "optimization_id", None) or (evidence_dict.get("optimization_id") if isinstance(evidence_dict, dict) else None)
        ml_id = getattr(primary_rec, "ml_analysis_id", None) or (evidence_dict.get("ml_analysis_id") if isinstance(evidence_dict, dict) else None)
        scenario_id = getattr(primary_rec, "scenario_id", None)

        if not opt_id:
            latest_opt = db.scalars(
                select(DecisionOptimization)
                .where(DecisionOptimization.dataset_id == target_dataset.id)
                .order_by(DecisionOptimization.created_at.desc())
            ).first()
            if latest_opt:
                opt_id = latest_opt.id

        opt_record = None
        if opt_id:
            opt_record = db.scalars(select(DecisionOptimization).where(DecisionOptimization.id == opt_id)).first()

        if not ml_id:
            latest_ml = db.scalars(
                select(MLAnalysis)
                .where(MLAnalysis.dataset_id == target_dataset.id)
                .order_by(MLAnalysis.created_at.desc())
            ).first()
            if latest_ml:
                ml_id = latest_ml.id

        ml_record = None
        if ml_id:
            ml_record = db.scalars(select(MLAnalysis).where(MLAnalysis.id == ml_id)).first()

        scen_record = None
        if scenario_id:
            scen_record = db.scalars(select(Scenario).where(Scenario.id == scenario_id)).first()

        # 5. Retrieve Phase 4 Insights
        stmt_ins = select(DatasetInsight).where(DatasetInsight.dataset_id == target_dataset.id)
        phase4_insights = db.scalars(stmt_ins).all()

        # 6. Map Primary & Alternative Recommendation Summaries
        rec_summaries: List[DecisionRecommendationSummary] = []
        for idx, r in enumerate(recs):
            g_eval = g_map.get(r.id)
            d_status = g_eval.decision_status if g_eval else "HUMAN_REVIEW_REQUIRED"
            p_val = getattr(r, "priority", idx + 1)
            rec_type = getattr(r, "recommendation_type", "optimization")
            title = r.title
            target_metric = getattr(r, "target_metric", None) or (ml_record.target_column if ml_record else "target")
            conf = getattr(r, "confidence", "MODERATE")

            r_ev = getattr(r, "evidence_traceability", None) or getattr(r, "evidence", None) or {}

            base_val, proj_val, abs_delta, pct_delta = cls._resolve_recommendation_metrics(
                db=db,
                r=r,
                scen_record=scen_record,
                opt_record=opt_record,
                evidence_dict=r_ev,
            )

            rec_summaries.append(
                DecisionRecommendationSummary(
                    recommendation_id=r.id,
                    priority=p_val,
                    recommendation_type=rec_type,
                    title=title,
                    target_metric=target_metric,
                    baseline_value=round(float(base_val), 2) if base_val is not None else None,
                    projected_value=round(float(proj_val), 2) if proj_val is not None else None,
                    absolute_delta=round(float(abs_delta), 2) if abs_delta is not None else None,
                    percentage_delta=round(float(pct_delta), 2) if pct_delta is not None else None,
                    confidence=conf,
                    decision_status=d_status,
                )
            )

        primary_summary = rec_summaries[0]
        alternative_summaries = rec_summaries[1:]

        # Changed features resolution
        changed_features = getattr(primary_rec, "changed_features", None)
        if changed_features is None and scen_record and scen_record.feature_changes:
            changed_features = scen_record.feature_changes
        if not changed_features and isinstance(evidence_dict, dict):
            changed_features = evidence_dict.get("changed_features", {})
        if not changed_features:
            changed_features = {}

        # 7. Primary Guardrail Evaluation & Snapshot Construction
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

        # 8. Risk Summary Construction
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

        # 9. Current vs. Recommended Comparison Matrix
        comparison: List[DecisionComparison] = []
        baseline_inputs = {}
        if opt_record and opt_record.recommended_scenario and isinstance(opt_record.recommended_scenario, dict):
            baseline_inputs = opt_record.recommended_scenario.get("baseline_inputs", {}) or {}

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

        # 10. Evidence Traceability Chain Construction
        evidence_nodes: List[EvidenceNode] = []

        evidence_nodes.append(
            EvidenceNode(
                node_type="RECOMMENDATION",
                node_id=primary_rec.id,
                title=f"Primary Recommendation",
                description=primary_rec.title,
            )
        )

        if opt_record:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="OPTIMIZATION",
                    node_id=opt_record.id,
                    title=f"Scenario Optimization Run ({opt_record.objective})",
                    description=f"Target Column: {opt_record.target_column}, Baseline Prediction: {opt_record.baseline_prediction}",
                )
            )

        if scenario_id:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="SCENARIO",
                    node_id=scenario_id,
                    title=f"Ranked Scenario ({scenario_id})",
                    description=f"Feature Changes: {json.dumps(changed_features)}",
                )
            )

        if ml_record:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="ML_ANALYSIS",
                    node_id=ml_record.id,
                    title=f"Predictive Model ({ml_record.model_name})",
                    description=f"Task: {ml_record.task_type}, Target: {ml_record.target_column}, Version: {ml_record.model_version}",
                )
            )

        linked_insight_ids = evidence_dict.get("insight_ids", []) or evidence_dict.get("source_insight_ids", []) if isinstance(evidence_dict, dict) else []
        if linked_insight_ids:
            evidence_nodes.append(
                EvidenceNode(
                    node_type="INSIGHT",
                    node_id=", ".join([str(i)[:8] for i in linked_insight_ids]),
                    title=f"Phase 4 Business Insights ({len(linked_insight_ids)} Linked)",
                    description=f"Evidence provenance linked to {len(linked_insight_ids)} observed historical dataset patterns.",
                )
            )

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
            optimization_id=opt_id or "N/A",
            scenario_id=scenario_id,
            ml_analysis_id=ml_id,
            insight_ids=[str(i) for i in linked_insight_ids],
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
