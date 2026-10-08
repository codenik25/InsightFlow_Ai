import uuid
from datetime import datetime, timezone
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logging import logger
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.analysis_run import AnalysisRun
from app.models.insight import DatasetInsight
from app.models.insight_memory import InsightMemory
from app.models.ml_analysis import MLAnalysis
from app.models.decision_optimization import DecisionOptimization
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.evidence_edge import EvidenceEdge
from app.schemas.evidence import (
    EvidenceNode,
    EvidenceEdgeSchema,
    EvidenceGraphResponse,
    EvidenceChainResponse,
)
from app.services.dataset_service import DatasetService
from app.services.dataset_comparison_service import DatasetComparisonService
from app.services.eda_service import EDAService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EvidenceService:
    """
    Persistent Decision Evidence Graph & Multi-Hop Traceability Engine.
    Provides verifiable, non-fabricated provenance chains linking datasets,
    runs, insights, predictions, optimizations, recommendations, decisions, and guardrails.
    """

    NODE_TYPES = {
        "DATASET_VERSION",
        "ANALYSIS_RUN",
        "INSIGHT",
        "PREDICTION",
        "OPTIMIZATION",
        "RECOMMENDATION",
        "DECISION",
        "GUARDRAIL",
        "OUTCOME",
        "LEARNING_SIGNAL",
        "GOVERNANCE_REVIEW",
        "EXECUTION",
    }

    RELATIONSHIP_TYPES = {
        "DERIVED_FROM",
        "PRODUCED",
        "BASED_ON",
        "SUPPORTED",
        "GENERATED_FROM",
        "OPTIMIZED_FROM",
        "EVALUATED_BY",
        "RESULTED_IN",
        "REVIEWED_BY",
        "EVALUATED_AGAINST",
        "MEASURED_FROM",
        "SUPPORTED_BY",
        "EXECUTED_AS",
        "MONITORED_BY",
    }

    @classmethod
    def record_edges_batch(
        cls,
        db: Session,
        edges_data: List[Dict[str, Any]],
    ) -> List[EvidenceEdge]:
        """
        Idempotently create or update a batch of evidence edges in a single database transaction.
        Deduplicates in-memory and against existing persisted edges.
        """
        if not edges_data:
            return []

        # Validate and normalize
        validated_items = []
        for item in edges_data:
            src_id = str(item.get("source_id", "")).strip()
            tgt_id = str(item.get("target_id", "")).strip()
            if not src_id:
                raise ValueError(f"source_id cannot be empty or null: '{item.get('source_id')}'")
            if not tgt_id:
                raise ValueError(f"target_id cannot be empty or null: '{item.get('target_id')}'")

            validated_items.append({
                "project_id": item["project_id"],
                "source_type": item["source_type"].strip().upper(),
                "source_id": src_id,
                "target_type": item["target_type"].strip().upper(),
                "target_id": tgt_id,
                "relationship_type": item["relationship_type"].strip().upper(),
                "metadata": item.get("metadata") or {},
            })

        # Deduplicate incoming batch by unique key
        unique_incoming: Dict[Tuple[str, str, str, str, str, str], Dict[str, Any]] = {}
        for item in validated_items:
            key = (
                item["project_id"],
                item["source_type"],
                item["source_id"],
                item["target_type"],
                item["target_id"],
                item["relationship_type"],
            )
            if key in unique_incoming:
                unique_incoming[key]["metadata"].update(item["metadata"])
            else:
                unique_incoming[key] = item

        project_ids = {k[0] for k in unique_incoming.keys()}
        target_ids = {k[4] for k in unique_incoming.keys()}
        source_ids = {k[2] for k in unique_incoming.keys()}

        # Fetch existing edges matching these projects and targets/sources
        existing_edges = db.scalars(
            select(EvidenceEdge).where(
                EvidenceEdge.project_id.in_(list(project_ids)),
                or_(
                    EvidenceEdge.target_id.in_(list(target_ids)),
                    EvidenceEdge.source_id.in_(list(source_ids)),
                )
            )
        ).all()

        existing_map: Dict[Tuple[str, str, str, str, str, str], EvidenceEdge] = {}
        for edge in existing_edges:
            key = (
                edge.project_id,
                edge.source_type,
                edge.source_id,
                edge.target_type,
                edge.target_id,
                edge.relationship_type,
            )
            existing_map[key] = edge

        results: List[EvidenceEdge] = []
        new_edges: List[EvidenceEdge] = []
        for key, item in unique_incoming.items():
            if key in existing_map:
                existing = existing_map[key]
                if item["metadata"]:
                    merged = dict(existing.metadata_json or {})
                    merged.update(item["metadata"])
                    existing.metadata_json = merged
                results.append(existing)
            else:
                new_edge = EvidenceEdge(
                    id=str(uuid.uuid4()),
                    project_id=item["project_id"],
                    source_type=item["source_type"],
                    source_id=item["source_id"],
                    target_type=item["target_type"],
                    target_id=item["target_id"],
                    relationship_type=item["relationship_type"],
                    metadata_json=item["metadata"],
                    created_at=utc_now(),
                )
                db.add(new_edge)
                new_edges.append(new_edge)
                existing_map[key] = new_edge
                results.append(new_edge)

        try:
            db.commit()
        except Exception:

            db.rollback()
            # If concurrent race condition occurred, re-query
            for key, item in unique_incoming.items():
                stmt = select(EvidenceEdge).where(
                    EvidenceEdge.project_id == item["project_id"],
                    EvidenceEdge.source_type == item["source_type"],
                    EvidenceEdge.source_id == item["source_id"],
                    EvidenceEdge.target_type == item["target_type"],
                    EvidenceEdge.target_id == item["target_id"],
                    EvidenceEdge.relationship_type == item["relationship_type"],
                )
                re_queried = db.scalars(stmt).first()
                if re_queried and re_queried not in results:
                    results.append(re_queried)

        return results

    @classmethod
    def record_edge(
        cls,
        db: Session,
        project_id: str,
        source_type: str,
        source_id: str,
        target_type: str,
        target_id: str,
        relationship_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> EvidenceEdge:
        """
        Idempotently create an evidence edge. If the edge already exists,
        returns the existing edge without throwing a duplicate key error.
        """
        batch = cls.record_edges_batch(
            db=db,
            edges_data=[
                {
                    "project_id": project_id,
                    "source_type": source_type,
                    "source_id": source_id,
                    "target_type": target_type,
                    "target_id": target_id,
                    "relationship_type": relationship_type,
                    "metadata": metadata or {},
                }
            ],
        )
        return batch[0]

    @classmethod
    def index_entity_evidence(cls, db: Session, dataset_id: str) -> int:
        """
        Index genuine domain relationships into EvidenceEdge for a dataset and its lineage.
        Scans AnalysisRuns, Insights, MLAnalyses, Optimizations, Recommendations,
        Decisions, and Guardrails without fabricating any missing links.
        Returns the number of edges registered.
        """
        dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id))
        if not dataset:
            return 0

        project_id = dataset.project_id
        if not project_id and dataset.parent_id:
            parent = db.scalar(select(Dataset).where(Dataset.id == dataset.parent_id))
            if parent:
                project_id = parent.project_id

        if not project_id:
            return 0

        all_dataset_ids = {dataset.id}
        if dataset.parent_id:
            all_dataset_ids.add(dataset.parent_id)
        children = db.scalars(select(Dataset).where(Dataset.parent_id == dataset.id)).all()
        for c in children:
            all_dataset_ids.add(c.id)

        edges_to_record: List[Dict[str, Any]] = []

        # 1. Dataset Version Root & Processed Derivation (Batch-queried)
        datasets = db.scalars(select(Dataset).where(Dataset.id.in_(all_dataset_ids))).all()
        for ds in datasets:
            if ds and ds.is_processed and ds.parent_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "DATASET_VERSION",
                    "source_id": ds.parent_id,
                    "target_type": "DATASET_VERSION",
                    "target_id": ds.id,
                    "relationship_type": "DERIVED_FROM",
                    "metadata": {"dataset_name": ds.name, "version": ds.version},
                })

        # 2. Analysis Runs -> Dataset Version
        runs = db.scalars(
            select(AnalysisRun).where(
                or_(
                    AnalysisRun.dataset_id.in_(all_dataset_ids),
                    AnalysisRun.processed_dataset_id.in_(all_dataset_ids),
                )
            )
        ).all()

        for run in runs:
            source_ds_id = run.processed_dataset_id or run.dataset_id
            if source_ds_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "DATASET_VERSION",
                    "source_id": source_ds_id,
                    "target_type": "ANALYSIS_RUN",
                    "target_id": run.id,
                    "relationship_type": "PRODUCED",
                    "metadata": {"run_type": run.run_type, "status": run.status, "version": run.dataset_version},
                })

            # If INSIGHTS run, link to explicitly produced insights in output_artifacts
            if run.run_type == "INSIGHTS" and run.output_artifacts and "insights" in run.output_artifacts:
                ins_list = run.output_artifacts.get("insights", [])
                if isinstance(ins_list, list):
                    for ins in ins_list:
                        ins_id = ins.get("id") if isinstance(ins, dict) else getattr(ins, "id", None)
                        if ins_id:
                            edges_to_record.append({
                                "project_id": project_id,
                                "source_type": "ANALYSIS_RUN",
                                "source_id": run.id,
                                "target_type": "INSIGHT",
                                "target_id": str(ins_id),
                                "relationship_type": "PRODUCED",
                                "metadata": {"title": ins.get("title") if isinstance(ins, dict) else getattr(ins, "title", "Insight")},
                            })

            # If PREDICTION run, link to explicitly produced ML analysis in output_artifacts
            if run.run_type == "PREDICTION" and run.output_artifacts and "analysis_id" in run.output_artifacts:
                aid = run.output_artifacts.get("analysis_id")
                if aid:
                    edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "ANALYSIS_RUN",
                        "source_id": run.id,
                        "target_type": "PREDICTION",
                        "target_id": str(aid),
                        "relationship_type": "PRODUCED",
                        "metadata": {"task_type": run.configuration.get("task_type") if run.configuration else None},
                    })

        # 3. Dataset Insights (from table): Link to AnalysisRun ONLY if explicitly confirmed, else DatasetVersion
        table_insights = db.scalars(
            select(DatasetInsight).where(DatasetInsight.dataset_id.in_(all_dataset_ids))
        ).all()
        # Batch-fetch InsightMemory for all table_insights to eliminate N+1 roundtrips
        ti_ids = [ti.id for ti in table_insights]
        mem_by_ti_id: Dict[str, InsightMemory] = {}
        if ti_ids:
            memories = db.scalars(
                select(InsightMemory).where(InsightMemory.latest_insight_id.in_(ti_ids))
            ).all()
            for mem in memories:
                if mem.latest_insight_id:
                    mem_by_ti_id[mem.latest_insight_id] = mem

        for ti in table_insights:
            # Check if an AnalysisRun explicitly claims ti.id in output_artifacts
            matching_run = None
            for r in runs:
                if r.run_type == "INSIGHTS" and r.output_artifacts and "insights" in r.output_artifacts:
                    ins_items = r.output_artifacts.get("insights", [])
                    if isinstance(ins_items, list):
                        for item in ins_items:
                            iid = item.get("id") if isinstance(item, dict) else getattr(item, "id", None)
                            if iid and str(iid) == str(ti.id):
                                matching_run = r
                                break
                if matching_run:
                    break

            # If not in output_artifacts, check if InsightMemory recorded this run
            if not matching_run:
                mem = mem_by_ti_id.get(ti.id)
                if mem and (mem.latest_run_id or mem.first_seen_run_id):
                    rid = mem.latest_run_id or mem.first_seen_run_id
                    matching_run = next((r for r in runs if r.id == rid), None)

            # Never infer a run from dataset_id alone: if unconfirmed, source is strictly DATASET_VERSION
            src_id = matching_run.id if matching_run else ti.dataset_id
            src_type = "ANALYSIS_RUN" if matching_run else "DATASET_VERSION"
            edges_to_record.append({
                "project_id": project_id,
                "source_type": src_type,
                "source_id": src_id,
                "target_type": "INSIGHT",
                "target_id": ti.id,
                "relationship_type": "PRODUCED",
                "metadata": {"title": ti.title, "category": ti.category},
            })

        # 4. ML Analyses (Predictions): Link to AnalysisRun ONLY if explicitly confirmed, else DatasetVersion
        ml_analyses = db.scalars(
            select(MLAnalysis).where(MLAnalysis.dataset_id.in_(all_dataset_ids))
        ).all()
        for ml in ml_analyses:
            matching_run = None
            for r in runs:
                if r.run_type == "PREDICTION" and r.output_artifacts:
                    aid = r.output_artifacts.get("analysis_id")
                    if aid and str(aid) == str(ml.id):
                        matching_run = r
                        break

            # Never infer a run from dataset_id alone: if unconfirmed, source is strictly DATASET_VERSION
            src_id = matching_run.id if matching_run else ml.dataset_id
            src_type = "ANALYSIS_RUN" if matching_run else "DATASET_VERSION"
            edges_to_record.append({
                "project_id": project_id,
                "source_type": src_type,
                "source_id": src_id,
                "target_type": "PREDICTION",
                "target_id": ml.id,
                "relationship_type": "PRODUCED",
                "metadata": {"model_name": ml.model_name, "task_type": ml.task_type, "target": ml.target_column},
            })

        # 5. Decision Optimizations
        opts = db.scalars(
            select(DecisionOptimization).where(DecisionOptimization.dataset_id.in_(all_dataset_ids))
        ).all()
        for opt in opts:
            if opt.ml_analysis_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "PREDICTION",
                    "source_id": opt.ml_analysis_id,
                    "target_type": "OPTIMIZATION",
                    "target_id": opt.id,
                    "relationship_type": "OPTIMIZED_FROM",
                    "metadata": {"objective": opt.objective, "target": opt.target_column},
                })

        # 6. Decision Recommendations
        recs = db.scalars(
            select(DecisionRecommendation).where(DecisionRecommendation.dataset_id.in_(all_dataset_ids))
        ).all()
        for rec in recs:
            if rec.scenario_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "OPTIMIZATION" if rec.ml_analysis_id else "PREDICTION",
                    "source_id": rec.scenario_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec.id,
                    "relationship_type": "GENERATED_FROM",
                    "metadata": {"title": rec.title, "type": rec.recommendation_type},
                })
            elif rec.ml_analysis_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "PREDICTION",
                    "source_id": rec.ml_analysis_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec.id,
                    "relationship_type": "BASED_ON",
                    "metadata": {"title": rec.title, "type": rec.recommendation_type},
                })
            if rec.insight_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "INSIGHT",
                    "source_id": rec.insight_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec.id,
                    "relationship_type": "SUPPORTED",
                    "metadata": {"title": rec.title},
                })

        # 6b. Decision Recommendation Evaluations (Phase 7.3)
        rec_evals = db.scalars(
            select(DecisionRecommendationEvaluation).where(
                DecisionRecommendationEvaluation.dataset_id.in_(all_dataset_ids)
            )
        ).all()
        for rev in rec_evals:
            if rev.optimization_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "OPTIMIZATION",
                    "source_id": rev.optimization_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rev.id,
                    "relationship_type": "GENERATED_FROM",
                    "metadata": {"title": rev.title, "target_metric": rev.target_metric},
                })
            if rev.ml_analysis_id and not rev.optimization_id:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "PREDICTION",
                    "source_id": rev.ml_analysis_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rev.id,
                    "relationship_type": "BASED_ON",
                    "metadata": {"title": rev.title},
                })
            # Check if evidence contains insight references
            if rev.evidence and isinstance(rev.evidence, dict):
                ins_ids = rev.evidence.get("insight_ids", [])
                if isinstance(ins_ids, list):
                    for iid in ins_ids:
                        edges_to_record.append({
                            "project_id": project_id,
                            "source_type": "INSIGHT",
                            "source_id": str(iid),
                            "target_type": "RECOMMENDATION",
                            "target_id": rev.id,
                            "relationship_type": "SUPPORTED",
                            "metadata": {"title": rev.title},
                        })

        # 7. Approvals & Decisions
        approvals = db.scalars(
            select(DecisionApproval).where(DecisionApproval.dataset_id.in_(all_dataset_ids))
        ).all()
        for app in approvals:
            dec_id = app.decision_id or app.id
            edges_to_record.append({
                "project_id": project_id,
                "source_type": "RECOMMENDATION",
                "source_id": app.recommendation_id,
                "target_type": "DECISION",
                "target_id": dec_id,
                "relationship_type": "RESULTED_IN",
                "metadata": {"approval_status": app.status, "approval_id": app.id},
            })

        # 8. Guardrails
        guardrails = db.scalars(
            select(DecisionGuardrailEvaluation).where(
                DecisionGuardrailEvaluation.dataset_id.in_(all_dataset_ids)
            )
        ).all()
        for g in guardrails:
            edges_to_record.append({
                "project_id": project_id,
                "source_type": "RECOMMENDATION",
                "source_id": g.recommendation_id,
                "target_type": "GUARDRAIL",
                "target_id": g.id,
                "relationship_type": "EVALUATED_BY",
                "metadata": {"status": g.decision_status, "risk_level": g.risk_level},
            })

        recorded = cls.record_edges_batch(db=db, edges_data=edges_to_record)
        return len(recorded)


    @classmethod
    def index_targeted_decision_evidence(
        cls,
        db: Session,
        decision_id: str,
        approval: Optional[DecisionApproval],
        rec: Optional[DecisionRecommendationEvaluation],
        rec_legacy: Optional[DecisionRecommendation],
        dataset_id: str,
    ) -> int:
        """
        Index evidence ONLY for the targeted decision and its direct multi-hop chain:
        Decision -> Recommendation -> Optimization -> Prediction -> explicit Insights -> Runs -> Dataset Version.
        Plus Decision/Recommendation -> Guardrail.
        Does NOT scan unrelated project entities or historical records.
        """
        dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id))
        if not dataset:
            return 0

        project_id = dataset.project_id
        if not project_id and dataset.parent_id:
            parent = db.scalar(select(Dataset).where(Dataset.id == dataset.parent_id))
            if parent:
                project_id = parent.project_id

        if not project_id:
            return 0

        edges_to_record: List[Dict[str, Any]] = []

        rec_id = rec.id if rec else (rec_legacy.id if rec_legacy else (approval.recommendation_id if approval else None))

        # 1. Decision -> Recommendation
        if approval and approval.recommendation_id:
            dec_key = approval.decision_id or approval.id
            edges_to_record.append({
                "project_id": project_id,
                "source_type": "RECOMMENDATION",
                "source_id": approval.recommendation_id,
                "target_type": "DECISION",
                "target_id": dec_key,
                "relationship_type": "RESULTED_IN",
                "metadata": {"approval_status": approval.status, "approval_id": approval.id},
            })
            if decision_id not in (dec_key, approval.id, approval.decision_id):
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "RECOMMENDATION",
                    "source_id": approval.recommendation_id,
                    "target_type": "DECISION",
                    "target_id": decision_id,
                    "relationship_type": "RESULTED_IN",
                    "metadata": {"approval_status": approval.status, "approval_id": approval.id},
                })

        # 2. Guardrails (for this decision/recommendation only)
        gr_rec_ids = [rec_id] if rec_id else []
        if gr_rec_ids:
            guardrails = db.scalars(
                select(DecisionGuardrailEvaluation).where(
                    DecisionGuardrailEvaluation.recommendation_id.in_(gr_rec_ids)
                )
            ).all()
            for g in guardrails:
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "RECOMMENDATION",
                    "source_id": g.recommendation_id,
                    "target_type": "GUARDRAIL",
                    "target_id": g.id,
                    "relationship_type": "EVALUATED_BY",
                    "metadata": {"status": g.decision_status, "risk_level": g.risk_level},
                })

        # 3. Recommendation -> Optimization / Prediction / Insight
        opt_id = None
        ml_id = None
        explicit_insight_ids: Set[str] = set()

        if rec:
            if rec.optimization_id:
                opt_id = rec.optimization_id
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "OPTIMIZATION",
                    "source_id": rec.optimization_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec.id,
                    "relationship_type": "GENERATED_FROM",
                    "metadata": {"title": rec.title, "target_metric": rec.target_metric},
                })
            if rec.ml_analysis_id and not rec.optimization_id:
                ml_id = rec.ml_analysis_id
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "PREDICTION",
                    "source_id": rec.ml_analysis_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec.id,
                    "relationship_type": "BASED_ON",
                    "metadata": {"title": rec.title},
                })
            if rec.evidence and isinstance(rec.evidence, dict):
                ins_ids = rec.evidence.get("insight_ids", [])
                if isinstance(ins_ids, list):
                    for iid in ins_ids:
                        if iid:
                            explicit_insight_ids.add(str(iid))
                            edges_to_record.append({
                                "project_id": project_id,
                                "source_type": "INSIGHT",
                                "source_id": str(iid),
                                "target_type": "RECOMMENDATION",
                                "target_id": rec.id,
                                "relationship_type": "SUPPORTED",
                                "metadata": {"title": rec.title},
                            })
        elif rec_legacy:
            if rec_legacy.scenario_id:
                opt_id = rec_legacy.scenario_id
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "OPTIMIZATION" if rec_legacy.ml_analysis_id else "PREDICTION",
                    "source_id": rec_legacy.scenario_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec_legacy.id,
                    "relationship_type": "GENERATED_FROM",
                    "metadata": {"title": rec_legacy.title, "type": rec_legacy.recommendation_type},
                })
            elif rec_legacy.ml_analysis_id:
                ml_id = rec_legacy.ml_analysis_id
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "PREDICTION",
                    "source_id": rec_legacy.ml_analysis_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec_legacy.id,
                    "relationship_type": "BASED_ON",
                    "metadata": {"title": rec_legacy.title, "type": rec_legacy.recommendation_type},
                })
            if rec_legacy.insight_id:
                explicit_insight_ids.add(str(rec_legacy.insight_id))
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "INSIGHT",
                    "source_id": rec_legacy.insight_id,
                    "target_type": "RECOMMENDATION",
                    "target_id": rec_legacy.id,
                    "relationship_type": "SUPPORTED",
                    "metadata": {"title": rec_legacy.title},
                })

        # 4. Optimization -> Prediction
        if opt_id:
            opt = db.scalar(select(DecisionOptimization).where(DecisionOptimization.id == opt_id))
            if opt and opt.ml_analysis_id:
                ml_id = opt.ml_analysis_id
                edges_to_record.append({
                    "project_id": project_id,
                    "source_type": "PREDICTION",
                    "source_id": opt.ml_analysis_id,
                    "target_type": "OPTIMIZATION",
                    "target_id": opt.id,
                    "relationship_type": "OPTIMIZED_FROM",
                    "metadata": {"objective": opt.objective, "target": opt.target_column},
                })

        lineage_ds_ids = {dataset.id}
        if dataset.parent_id:
            lineage_ds_ids.add(dataset.parent_id)

        linked_run_ids: Set[str] = set()

        # 5. Prediction -> Analysis Run or Dataset Version
        if ml_id:
            ml = db.scalar(select(MLAnalysis).where(MLAnalysis.id == ml_id))
            if ml:
                runs = db.scalars(
                    select(AnalysisRun).where(
                        AnalysisRun.run_type == "PREDICTION",
                        or_(
                            AnalysisRun.dataset_id.in_(lineage_ds_ids),
                            AnalysisRun.processed_dataset_id.in_(lineage_ds_ids),
                        ),
                    )
                ).all()
                matching_run = None
                for r in runs:
                    if r.output_artifacts and str(r.output_artifacts.get("analysis_id")) == str(ml.id):
                        matching_run = r
                        break
                if matching_run:
                    linked_run_ids.add(matching_run.id)
                    edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "ANALYSIS_RUN",
                        "source_id": matching_run.id,
                        "target_type": "PREDICTION",
                        "target_id": ml.id,
                        "relationship_type": "PRODUCED",
                        "metadata": {"model_name": ml.model_name, "task_type": ml.task_type, "target": ml.target_column},
                    })
                else:
                    edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "DATASET_VERSION",
                        "source_id": ml.dataset_id,
                        "target_type": "PREDICTION",
                        "target_id": ml.id,
                        "relationship_type": "PRODUCED",
                        "metadata": {"model_name": ml.model_name, "task_type": ml.task_type, "target": ml.target_column},
                    })

        # 6. Explicit Insights -> Analysis Run or Dataset Version
        if explicit_insight_ids:
            insights = db.scalars(
                select(DatasetInsight).where(DatasetInsight.id.in_(list(explicit_insight_ids)))
            ).all()
            ins_runs = db.scalars(
                select(AnalysisRun).where(
                    AnalysisRun.run_type == "INSIGHTS",
                    or_(
                        AnalysisRun.dataset_id.in_(lineage_ds_ids),
                        AnalysisRun.processed_dataset_id.in_(lineage_ds_ids),
                    ),
                )
            ).all()

            for ti in insights:
                matching_run = None
                for r in ins_runs:
                    if r.output_artifacts and "insights" in r.output_artifacts:
                        for item in r.output_artifacts.get("insights", []):
                            iid = item.get("id") if isinstance(item, dict) else getattr(item, "id", None)
                            if iid and str(iid) == str(ti.id):
                                matching_run = r
                                break
                    if matching_run:
                        break

                if not matching_run:
                    mem = db.scalar(
                        select(InsightMemory).where(InsightMemory.latest_insight_id == ti.id)
                    )
                    if mem and (mem.latest_run_id or mem.first_seen_run_id):
                        rid = mem.latest_run_id or mem.first_seen_run_id
                        matching_run = next((r for r in ins_runs if r.id == rid), None)

                if matching_run:
                    linked_run_ids.add(matching_run.id)
                    edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "ANALYSIS_RUN",
                        "source_id": matching_run.id,
                        "target_type": "INSIGHT",
                        "target_id": ti.id,
                        "relationship_type": "PRODUCED",
                        "metadata": {"title": ti.title, "category": ti.category},
                    })
                else:
                    edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "DATASET_VERSION",
                        "source_id": ti.dataset_id,
                        "target_type": "INSIGHT",
                        "target_id": ti.id,
                        "relationship_type": "PRODUCED",
                        "metadata": {"title": ti.title, "category": ti.category},
                    })

        # 7. Runs -> Dataset Version
        if linked_run_ids:
            runs_to_link = db.scalars(
                select(AnalysisRun).where(AnalysisRun.id.in_(list(linked_run_ids)))
            ).all()
            for r in runs_to_link:
                source_ds = r.processed_dataset_id or r.dataset_id
                if source_ds:
                    edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "DATASET_VERSION",
                        "source_id": source_ds,
                        "target_type": "ANALYSIS_RUN",
                        "target_id": r.id,
                        "relationship_type": "PRODUCED",
                        "metadata": {"run_type": r.run_type, "status": r.status, "version": r.dataset_version},
                    })

        # 8. Dataset Version Derivation
        if dataset.is_processed and dataset.parent_id:
            edges_to_record.append({
                "project_id": project_id,
                "source_type": "DATASET_VERSION",
                "source_id": dataset.parent_id,
                "target_type": "DATASET_VERSION",
                "target_id": dataset.id,
                "relationship_type": "DERIVED_FROM",
                "metadata": {"dataset_name": dataset.name, "version": dataset.version},
            })

        cls.record_edges_batch(db=db, edges_data=edges_to_record)
        return len(edges_to_record)

    @classmethod
    def hydrate_nodes_batch(
        cls,
        db: Session,
        nodes_by_type: Dict[str, Set[str]],
    ) -> Dict[str, EvidenceNode]:
        """
        Batch hydrate entity nodes across types using WHERE id IN (...) queries.
        Returns map of {node_id: EvidenceNode}.
        """
        results: Dict[str, EvidenceNode] = {}
        if not nodes_by_type:
            return results

        # 1. DATASET_VERSION
        ds_ids = nodes_by_type.get("DATASET_VERSION", set())
        if ds_ids:
            datasets = db.scalars(select(Dataset).where(Dataset.id.in_(list(ds_ids)))).all()
            for ds in datasets:
                results[ds.id] = EvidenceNode(
                    id=ds.id,
                    type="DATASET_VERSION",
                    label=f"{ds.name} (v{ds.version})",
                    status=ds.status,
                    dataset_version=ds.version,
                    metadata={"is_processed": ds.is_processed, "row_count": ds.row_count, "parent_id": ds.parent_id},
                )

        # 2. ANALYSIS_RUN
        run_ids = nodes_by_type.get("ANALYSIS_RUN", set())
        if run_ids:
            runs = db.scalars(select(AnalysisRun).where(AnalysisRun.id.in_(list(run_ids)))).all()
            for r in runs:
                results[r.id] = EvidenceNode(
                    id=r.id,
                    type="ANALYSIS_RUN",
                    label=f"{r.run_type} Run ({r.id[:8]})",
                    status=r.status,
                    dataset_version=r.dataset_version,
                    run_id=r.id,
                    metadata={"duration_ms": r.duration_ms, "started_at": r.started_at.isoformat() if r.started_at else None},
                )

        # 3. INSIGHT
        ins_ids = nodes_by_type.get("INSIGHT", set())
        if ins_ids:
            insights = db.scalars(select(DatasetInsight).where(DatasetInsight.id.in_(list(ins_ids)))).all()
            found_ins_ids = set()
            for ins in insights:
                found_ins_ids.add(ins.id)
                results[ins.id] = EvidenceNode(
                    id=ins.id,
                    type="INSIGHT",
                    label=ins.title,
                    status=ins.severity,
                    metadata={"category": ins.category, "priority_score": ins.priority_score, "confidence": ins.confidence},
                )
            missing_ins = ins_ids - found_ins_ids
            if missing_ins:
                memories = db.scalars(select(InsightMemory).where(InsightMemory.insight_fingerprint.in_(list(missing_ins)))).all()
                for mem in memories:
                    results[mem.insight_fingerprint] = EvidenceNode(
                        id=mem.insight_fingerprint,
                        type="INSIGHT",
                        label=mem.title,
                        status=mem.status,
                        dataset_version=mem.latest_seen_version,
                        run_id=mem.latest_run_id,
                        metadata={"category": mem.category, "delta_magnitude": mem.delta_magnitude},
                    )

        # 4. PREDICTION
        pred_ids = nodes_by_type.get("PREDICTION", set())
        if pred_ids:
            mls = db.scalars(select(MLAnalysis).where(MLAnalysis.id.in_(list(pred_ids)))).all()
            for ml in mls:
                results[ml.id] = EvidenceNode(
                    id=ml.id,
                    type="PREDICTION",
                    label=f"{ml.model_name} Prediction ({ml.task_type})",
                    status=ml.status,
                    metadata={"target_column": ml.target_column, "model_version": ml.model_version},
                )

        # 5. OPTIMIZATION
        opt_ids = nodes_by_type.get("OPTIMIZATION", set())
        if opt_ids:
            opts = db.scalars(select(DecisionOptimization).where(DecisionOptimization.id.in_(list(opt_ids)))).all()
            for opt in opts:
                results[opt.id] = EvidenceNode(
                    id=opt.id,
                    type="OPTIMIZATION",
                    label=f"{opt.objective.capitalize()} {opt.target_column} Optimization",
                    status=opt.status,
                    metadata={"scenario_count": opt.scenario_count, "baseline": opt.baseline_prediction, "recommended": opt.recommended_prediction},
                )

        # 6. RECOMMENDATION
        rec_ids = nodes_by_type.get("RECOMMENDATION", set())
        if rec_ids:
            rec_evals = db.scalars(select(DecisionRecommendationEvaluation).where(DecisionRecommendationEvaluation.id.in_(list(rec_ids)))).all()
            found_rec_ids = set()
            for rev in rec_evals:
                found_rec_ids.add(rev.id)
                results[rev.id] = EvidenceNode(
                    id=rev.id,
                    type="RECOMMENDATION",
                    label=rev.title,
                    status=rev.confidence,
                    metadata={"target_metric": rev.target_metric, "delta": rev.percentage_delta},
                )
            missing_recs = rec_ids - found_rec_ids
            if missing_recs:
                recs = db.scalars(select(DecisionRecommendation).where(DecisionRecommendation.id.in_(list(missing_recs)))).all()
                for rec in recs:
                    results[rec.id] = EvidenceNode(
                        id=rec.id,
                        type="RECOMMENDATION",
                        label=rec.title,
                        status=rec.impact_level,
                        metadata={"type": rec.recommendation_type},
                    )

        # 7. DECISION
        dec_ids = nodes_by_type.get("DECISION", set())
        if dec_ids:
            approvals = db.scalars(select(DecisionApproval).where(
                or_(DecisionApproval.decision_id.in_(list(dec_ids)), DecisionApproval.id.in_(list(dec_ids)))
            )).all()
            for app in approvals:
                key = app.decision_id if app.decision_id in dec_ids else app.id
                results[key] = EvidenceNode(
                    id=key,
                    type="DECISION",
                    label=f"Decision ({app.status})",
                    status=app.status,
                    metadata={"actor_type": app.actor_type, "reason": app.reason},
                )

        # 8. GUARDRAIL
        gr_ids = nodes_by_type.get("GUARDRAIL", set())
        if gr_ids:
            guardrails = db.scalars(select(DecisionGuardrailEvaluation).where(DecisionGuardrailEvaluation.id.in_(list(gr_ids)))).all()
            for g in guardrails:
                results[g.id] = EvidenceNode(
                    id=g.id,
                    type="GUARDRAIL",
                    label=f"Guardrail: {g.decision_status}",
                    status=g.decision_status,
                    metadata={"feasibility_score": g.feasibility_score, "risk_level": g.risk_level},
                )

        # 9. OUTCOME (Phase 6)
        outcome_ids = nodes_by_type.get("OUTCOME", set())
        if outcome_ids:
            from app.models.decision_outcome import DecisionOutcome
            outcomes = db.scalars(select(DecisionOutcome).where(DecisionOutcome.id.in_(list(outcome_ids)))).all()
            for o in outcomes:
                results[o.id] = EvidenceNode(
                    id=o.id,
                    type="OUTCOME",
                    label=f"Outcome: {o.outcome_status} ({o.actual_metric or o.expected_metric})",
                    status=o.outcome_status,
                    dataset_version=o.source_dataset_version,
                    run_id=o.source_analysis_run_id,
                    metadata={
                        "expected_value": o.expected_value,
                        "actual_value": o.actual_value,
                        "absolute_delta": o.absolute_delta,
                        "relative_delta": o.relative_delta,
                        "threshold_used": o.threshold_used,
                        "learning_signal": o.learning_signal,
                    },
                )

        # Fallback for any requested nodes not found in database
        for nt, id_set in nodes_by_type.items():
            for nid in id_set:
                if nid not in results:
                    fallback_label = f"Executive Decision #{nid[:8]}" if nt == "DECISION" else f"{nt}: {nid[:8]}"
                    fallback_status = "APPROVED" if nt == "DECISION" else None
                    results[nid] = EvidenceNode(
                        id=nid,
                        type=nt,
                        label=fallback_label,
                        status=fallback_status,
                        metadata={},
                    )

        return results

    @classmethod
    def hydrate_node(cls, db: Session, node_type: str, node_id: str) -> EvidenceNode:
        """
        Hydrate entity metadata to form an informative EvidenceNode.
        """
        nt = node_type.strip().upper()
        res = cls.hydrate_nodes_batch(db, {nt: {node_id}})
        return res[node_id]


    @classmethod
    def get_project_evidence_graph(
        cls,
        db: Session,
        project_id: str,
        node_type: Optional[str] = None,
        limit: int = 200,
    ) -> EvidenceGraphResponse:
        """
        Retrieve project-level evidence graph with project boundary validation.
        """
        proj = db.scalar(select(Project).where(Project.id == project_id))
        if not proj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Index any unindexed entities across recent project datasets only if no edges exist yet
        has_edges = db.scalar(
            select(EvidenceEdge.id).where(EvidenceEdge.project_id == project_id).limit(1)
        ) is not None
        if not has_edges:
            recent_datasets = db.scalars(
                select(Dataset.id)
                .where(Dataset.project_id == project_id)
                .order_by(Dataset.created_at.desc())
                .limit(5)
            ).all()
            for ds_id in recent_datasets:
                cls.index_entity_evidence(db=db, dataset_id=ds_id)

        stmt = select(EvidenceEdge).where(EvidenceEdge.project_id == project_id)
        if node_type:
            nt_clean = node_type.strip().upper()
            stmt = stmt.where(or_(EvidenceEdge.source_type == nt_clean, EvidenceEdge.target_type == nt_clean))
        stmt = stmt.order_by(EvidenceEdge.created_at.desc()).limit(limit)

        edges_db = db.scalars(stmt).all()

        nodes_by_type: Dict[str, Set[str]] = {nt: set() for nt in cls.NODE_TYPES}
        edges_out: List[EvidenceEdgeSchema] = []

        for e in edges_db:
            edges_out.append(
                EvidenceEdgeSchema(
                    id=e.id,
                    source=e.source_id,
                    source_type=e.source_type,
                    target=e.target_id,
                    target_type=e.target_type,
                    relationship_type=e.relationship_type,
                    metadata=e.metadata_json or {},
                )
            )
            nodes_by_type.setdefault(e.source_type, set()).add(e.source_id)
            nodes_by_type.setdefault(e.target_type, set()).add(e.target_id)

        nodes_map = cls.hydrate_nodes_batch(db, nodes_by_type)
        counters: Dict[str, int] = {nt: 0 for nt in cls.NODE_TYPES}
        for n in nodes_map.values():
            counters[n.type] = counters.get(n.type, 0) + 1

        return EvidenceGraphResponse(
            project_id=project_id,
            dataset_id=None,
            root_node_id=None,
            root=None,
            nodes=list(nodes_map.values()),
            edges=edges_out,
            counters=counters,
        )

    @classmethod
    def get_dataset_evidence_graph(
        cls,
        db: Session,
        dataset_id: str,
    ) -> EvidenceGraphResponse:
        """
        Retrieve dataset-lineage-scoped evidence graph starting from root DATASET_VERSION.
        """
        dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset with ID '{dataset_id}' not found.",
            )
        if not dataset.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dataset '{dataset_id}' does not belong to a project.",
            )

        root_id = dataset.parent_id if (dataset.is_processed and dataset.parent_id) else dataset.id
        root_ds = DatasetService.get_dataset_by_id(db=db, dataset_id=root_id) or dataset
        project_id = root_ds.project_id or dataset.project_id

        # Resolve all lineage dataset IDs
        lineage_ds_ids: Set[str] = {root_id}
        children_ids = db.scalars(select(Dataset.id).where(Dataset.parent_id == root_id)).all()
        for cid in children_ids:
            lineage_ds_ids.add(cid)

        # Retrieve already-persisted evidence graph; only run targeted indexer if no edges exist yet
        has_existing_edges = db.scalar(
            select(EvidenceEdge.id).where(
                EvidenceEdge.project_id == project_id,
                or_(
                    EvidenceEdge.source_id.in_(list(lineage_ds_ids)),
                    EvidenceEdge.target_id.in_(list(lineage_ds_ids)),
                ),
            ).limit(1)
        ) is not None

        if not has_existing_edges:
            cls.index_entity_evidence(db=db, dataset_id=root_id)

        # Batch-fetch all project edges to eliminate per-node BFS WAN roundtrips
        project_edges = db.scalars(
            select(EvidenceEdge).where(EvidenceEdge.project_id == project_id)
        ).all()
        edges_by_source: Dict[str, List[EvidenceEdge]] = defaultdict(list)
        for pe in project_edges:
            edges_by_source[pe.source_id].append(pe)

        # Traverse downstream graph starting from lineage dataset IDs
        visited_nodes: Set[str] = set(lineage_ds_ids)
        edges_out: List[EvidenceEdgeSchema] = []
        nodes_by_type: Dict[str, Set[str]] = {nt: set() for nt in cls.NODE_TYPES}
        nodes_by_type["DATASET_VERSION"].update(lineage_ds_ids)

        # Queue for multi-hop BFS
        queue: List[str] = list(lineage_ds_ids)
        visited_edge_ids: Set[str] = set()

        while queue:
            curr_id = queue.pop(0)
            outgoing = edges_by_source.get(curr_id, [])

            for edge in outgoing:
                if edge.id in visited_edge_ids:
                    continue
                visited_edge_ids.add(edge.id)

                edges_out.append(
                    EvidenceEdgeSchema(
                        id=edge.id,
                        source=edge.source_id,
                        source_type=edge.source_type,
                        target=edge.target_id,
                        target_type=edge.target_type,
                        relationship_type=edge.relationship_type,
                        metadata=edge.metadata_json or {},
                    )
                )
                nodes_by_type.setdefault(edge.source_type, set()).add(edge.source_id)
                nodes_by_type.setdefault(edge.target_type, set()).add(edge.target_id)

                if edge.target_id not in visited_nodes:
                    visited_nodes.add(edge.target_id)
                    queue.append(edge.target_id)

        nodes_map = cls.hydrate_nodes_batch(db, nodes_by_type)
        root_node = nodes_map.get(root_id) or cls.hydrate_node(db, "DATASET_VERSION", root_id)

        counters: Dict[str, int] = {nt: 0 for nt in cls.NODE_TYPES}
        for n in nodes_map.values():
            counters[n.type] = counters.get(n.type, 0) + 1

        return EvidenceGraphResponse(
            project_id=project_id,
            dataset_id=dataset.id,
            root_node_id=root_id,
            root=root_node,
            nodes=list(nodes_map.values()),
            edges=edges_out,
            counters=counters,
        )

    @classmethod
    def get_run_evidence_graph(
        cls,
        db: Session,
        run_id: str,
    ) -> EvidenceGraphResponse:
        """
        Retrieve evidence graph centered on a specific ANALYSIS_RUN.
        """
        run = db.scalar(select(AnalysisRun).where(AnalysisRun.id == run_id))
        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"AnalysisRun '{run_id}' not found.",
            )

        project_id = run.project_id
        ds_id = run.dataset_id or run.processed_dataset_id
        if ds_id:
            cls.index_entity_evidence(db=db, dataset_id=ds_id)

        # Incoming edges (e.g. from DATASET_VERSION)
        incoming = db.scalars(
            select(EvidenceEdge).where(
                EvidenceEdge.project_id == project_id,
                EvidenceEdge.target_id == run.id,
            )
        ).all()

        # Outgoing edges (e.g. to INSIGHT or PREDICTION)
        outgoing = db.scalars(
            select(EvidenceEdge).where(
                EvidenceEdge.project_id == project_id,
                EvidenceEdge.source_id == run.id,
            )
        ).all()

        edges_out: List[EvidenceEdgeSchema] = []
        nodes_by_type: Dict[str, Set[str]] = {nt: set() for nt in cls.NODE_TYPES}
        nodes_by_type["ANALYSIS_RUN"].add(run.id)

        for e in list(incoming) + list(outgoing):
            edges_out.append(
                EvidenceEdgeSchema(
                    id=e.id,
                    source=e.source_id,
                    source_type=e.source_type,
                    target=e.target_id,
                    target_type=e.target_type,
                    relationship_type=e.relationship_type,
                    metadata=e.metadata_json or {},
                )
            )
            nodes_by_type.setdefault(e.source_type, set()).add(e.source_id)
            nodes_by_type.setdefault(e.target_type, set()).add(e.target_id)

        nodes_map = cls.hydrate_nodes_batch(db, nodes_by_type)
        run_node = nodes_map.get(run.id) or cls.hydrate_node(db, "ANALYSIS_RUN", run.id)

        counters: Dict[str, int] = {nt: 0 for nt in cls.NODE_TYPES}
        for n in nodes_map.values():
            counters[n.type] = counters.get(n.type, 0) + 1

        return EvidenceGraphResponse(
            project_id=project_id,
            dataset_id=ds_id,
            root_node_id=run.id,
            root=run_node,
            nodes=list(nodes_map.values()),
            edges=edges_out,
            counters=counters,
        )

    @classmethod
    def get_node_evidence(
        cls,
        db: Session,
        node_type: str,
        node_id: str,
    ) -> EvidenceGraphResponse:
        """
        Retrieve immediate 1-hop upstream and downstream evidence for a specific node.
        """
        nt_clean = node_type.strip().upper()
        if nt_clean not in cls.NODE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid node_type '{node_type}'. Supported: {sorted(list(cls.NODE_TYPES))}",
            )

        edges = db.scalars(
            select(EvidenceEdge).where(
                or_(
                    and_(EvidenceEdge.source_type == nt_clean, EvidenceEdge.source_id == node_id),
                    and_(EvidenceEdge.target_type == nt_clean, EvidenceEdge.target_id == node_id),
                )
            )
        ).all()

        if not edges:
            # Fallback hydration to check if node exists
            node = cls.hydrate_node(db, nt_clean, node_id)
            return EvidenceGraphResponse(
                project_id="",
                root_node_id=node_id,
                root=node,
                nodes=[node],
                edges=[],
                counters={nt: 1 if nt == nt_clean else 0 for nt in cls.NODE_TYPES},
            )

        project_id = edges[0].project_id
        edges_out: List[EvidenceEdgeSchema] = []
        nodes_by_type: Dict[str, Set[str]] = {nt: set() for nt in cls.NODE_TYPES}
        nodes_by_type[nt_clean].add(node_id)

        for e in edges:
            edges_out.append(
                EvidenceEdgeSchema(
                    id=e.id,
                    source=e.source_id,
                    source_type=e.source_type,
                    target=e.target_id,
                    target_type=e.target_type,
                    relationship_type=e.relationship_type,
                    metadata=e.metadata_json or {},
                )
            )
            nodes_by_type.setdefault(e.source_type, set()).add(e.source_id)
            nodes_by_type.setdefault(e.target_type, set()).add(e.target_id)

        nodes_map = cls.hydrate_nodes_batch(db, nodes_by_type)
        root_node = nodes_map.get(node_id) or cls.hydrate_node(db, nt_clean, node_id)

        counters: Dict[str, int] = {nt: 0 for nt in cls.NODE_TYPES}
        for n in nodes_map.values():
            counters[n.type] = counters.get(n.type, 0) + 1

        return EvidenceGraphResponse(
            project_id=project_id,
            root_node_id=node_id,
            root=root_node,
            nodes=list(nodes_map.values()),
            edges=edges_out,
            counters=counters,
        )


    @classmethod
    def get_decision_evidence_chain(
        cls,
        db: Session,
        decision_id: str,
    ) -> EvidenceChainResponse:
        """
        Construct complete upstream multi-hop evidence chain for an executive decision:
        Decision -> Recommendation -> Optimization -> Prediction -> Insight -> Analysis Run -> Dataset Version.
        Honors missing steps without fabricating links.
        """
        # 1. Resolve decision and recommendation
        approval = db.scalar(
            select(DecisionApproval).where(
                or_(
                    DecisionApproval.decision_id == decision_id,
                    DecisionApproval.id == decision_id,
                    DecisionApproval.recommendation_id == decision_id,
                )
            )
        )

        rec_id = approval.recommendation_id if approval else decision_id
        dataset_id = approval.dataset_id if approval else None

        # Look up Recommendation
        rec = db.scalar(
            select(DecisionRecommendationEvaluation).where(DecisionRecommendationEvaluation.id == rec_id)
        )
        if not rec:
            rec_legacy = db.scalar(select(DecisionRecommendation).where(DecisionRecommendation.id == rec_id))
        else:
            rec_legacy = None

        if not dataset_id:
            if rec:
                dataset_id = rec.dataset_id
            elif rec_legacy:
                dataset_id = rec_legacy.dataset_id

        if not dataset_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision or Recommendation '{decision_id}' not found.",
            )

        dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id))
        project_id = dataset.project_id if dataset else ""
        lineage_name = DatasetComparisonService.get_logical_lineage_name(db, dataset) if dataset else ""

        # Retrieve already-persisted evidence graph; only run targeted indexer if no edges exist yet
        has_existing_edges = db.scalar(
            select(EvidenceEdge.id).where(
                EvidenceEdge.project_id == project_id,
                or_(
                    EvidenceEdge.target_id == decision_id,
                    EvidenceEdge.source_id == decision_id,
                    EvidenceEdge.target_id == rec_id,
                    EvidenceEdge.source_id == rec_id,
                ),
            ).limit(1)
        ) is not None

        if not has_existing_edges:
            cls.index_targeted_decision_evidence(
                db=db,
                decision_id=decision_id,
                approval=approval,
                rec=rec,
                rec_legacy=rec_legacy,
                dataset_id=dataset_id,
            )


        # Multi-hop upstream traversal using bounded batch queries
        visited_edge_ids: Set[str] = set()
        edges_out: List[EvidenceEdgeSchema] = []
        nodes_by_type: Dict[str, Set[str]] = {nt: set() for nt in cls.NODE_TYPES}

        # Seed decision and recommendation
        nodes_by_type["DECISION"].add(decision_id)
        if rec_id and rec_id != decision_id:
            nodes_by_type["RECOMMENDATION"].add(rec_id)

        current_targets: Set[str] = {decision_id}
        if rec_id and rec_id != decision_id:
            current_targets.add(rec_id)

        depth = 0
        while current_targets and depth < 10:
            depth += 1
            incoming = db.scalars(
                select(EvidenceEdge).where(
                    EvidenceEdge.project_id == project_id,
                    EvidenceEdge.target_id.in_(list(current_targets)),
                )
            ).all()

            next_targets: Set[str] = set()
            for edge in incoming:
                if edge.id in visited_edge_ids:
                    continue
                visited_edge_ids.add(edge.id)
                edges_out.append(
                    EvidenceEdgeSchema(
                        id=edge.id,
                        source=edge.source_id,
                        source_type=edge.source_type,
                        target=edge.target_id,
                        target_type=edge.target_type,
                        relationship_type=edge.relationship_type,
                        metadata=edge.metadata_json or {},
                    )
                )
                nodes_by_type.setdefault(edge.source_type, set()).add(edge.source_id)
                nodes_by_type.setdefault(edge.target_type, set()).add(edge.target_id)
                next_targets.add(edge.source_id)

            current_targets = next_targets

        # Downstream outcome traversal (Phase 6 DECISION -> OUTCOME -> DATASET_VERSION)
        downstream = db.scalars(
            select(EvidenceEdge).where(
                EvidenceEdge.project_id == project_id,
                EvidenceEdge.source_id == decision_id,
                EvidenceEdge.target_type == "OUTCOME",
            )
        ).all()
        observed_outcome_ids: Set[str] = set()
        for edge in downstream:
            if edge.id not in visited_edge_ids:
                visited_edge_ids.add(edge.id)
                edges_out.append(
                    EvidenceEdgeSchema(
                        id=edge.id,
                        source=edge.source_id,
                        source_type=edge.source_type,
                        target=edge.target_id,
                        target_type=edge.target_type,
                        relationship_type=edge.relationship_type,
                        metadata=edge.metadata_json or {},
                    )
                )
                nodes_by_type["OUTCOME"].add(edge.target_id)
                observed_outcome_ids.add(edge.target_id)

        if observed_outcome_ids:
            outcome_measured = db.scalars(
                select(EvidenceEdge).where(
                    EvidenceEdge.project_id == project_id,
                    EvidenceEdge.source_id.in_(list(observed_outcome_ids)),
                )
            ).all()
            for edge in outcome_measured:
                if edge.id not in visited_edge_ids:
                    visited_edge_ids.add(edge.id)
                    edges_out.append(
                        EvidenceEdgeSchema(
                            id=edge.id,
                            source=edge.source_id,
                            source_type=edge.source_type,
                            target=edge.target_id,
                            target_type=edge.target_type,
                            relationship_type=edge.relationship_type,
                            metadata=edge.metadata_json or {},
                        )
                    )
                    if edge.target_type in nodes_by_type:
                        nodes_by_type[edge.target_type].add(edge.target_id)

        # Guardrails downstream traversal in batch
        guardrail_sources = [decision_id]
        if rec_id and rec_id != decision_id:
            guardrail_sources.append(rec_id)

        outgoing_guardrails = db.scalars(
            select(EvidenceEdge).where(
                EvidenceEdge.project_id == project_id,
                EvidenceEdge.source_id.in_(guardrail_sources),
                EvidenceEdge.target_type == "GUARDRAIL",
            )
        ).all()

        for edge in outgoing_guardrails:
            if edge.id in visited_edge_ids:
                continue
            visited_edge_ids.add(edge.id)
            edges_out.append(
                EvidenceEdgeSchema(
                    id=edge.id,
                    source=edge.source_id,
                    source_type=edge.source_type,
                    target=edge.target_id,
                    target_type=edge.target_type,
                    relationship_type=edge.relationship_type,
                    metadata=edge.metadata_json or {},
                )
            )
            nodes_by_type.setdefault(edge.source_type, set()).add(edge.source_id)
            nodes_by_type.setdefault(edge.target_type, set()).add(edge.target_id)

        # Batch hydrate all nodes
        hydrated_map = cls.hydrate_nodes_batch(db, nodes_by_type)

        # Sort nodes according to chain order
        chain_order = {
            "DATASET_VERSION": 1,
            "ANALYSIS_RUN": 2,
            "INSIGHT": 3,
            "PREDICTION": 4,
            "OPTIMIZATION": 5,
            "RECOMMENDATION": 6,
            "DECISION": 7,
            "GUARDRAIL": 8,
        }
        sorted_nodes = sorted(list(hydrated_map.values()), key=lambda n: chain_order.get(n.type, 99))

        summary = {
            "total_nodes": len(sorted_nodes),
            "total_edges": len(edges_out),
            "has_insight_support": any(n.type == "INSIGHT" for n in sorted_nodes),
            "has_optimization": any(n.type == "OPTIMIZATION" for n in sorted_nodes),
            "has_guardrail": any(n.type == "GUARDRAIL" for n in sorted_nodes),
            "is_complete_chain": any(n.type == "DATASET_VERSION" for n in sorted_nodes) and any(n.type == "DECISION" for n in sorted_nodes),
        }

        return EvidenceChainResponse(
            decision_id=decision_id,
            recommendation_id=rec_id,
            project_id=project_id,
            dataset_lineage=lineage_name,
            nodes=sorted_nodes,
            edges=edges_out,
            summary=summary,
        )
