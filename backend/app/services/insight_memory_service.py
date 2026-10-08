import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logging import logger
from app.models.dataset import Dataset
from app.models.project import Project
from app.models.insight import DatasetInsight
from app.models.analysis_run import AnalysisRun
from app.models.insight_memory import InsightMemory
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_recommendation import DecisionRecommendation as DecisionRecommendationModel
from app.schemas.insight import Insight
from app.schemas.insight_memory import (
    InsightMemoryBase,
    InsightMemoryCounters,
    InsightTimelineCell,
    InsightTimelineItem,
    DownstreamReviewItem,
    InsightImpactItem,
    InsightMemoryListResponse,
    InsightImpactComparisonResponse,
)
from app.services.dataset_comparison_service import DatasetComparisonService
from app.services.eda_service import EDAService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InsightMemoryService:
    """
    Deterministic AI Insight Memory & Impact Tracking Service.
    Maintains persistent identity of analytical patterns across runs and dataset versions.
    """

    @classmethod
    def extract_affected_columns(cls, ins: Any) -> List[str]:
        """Extract lexicographically sorted, lowercased affected column names."""
        cols: Set[str] = set()
        
        def _get(field, default=None):
            if isinstance(ins, dict):
                return ins.get(field, default)
            return getattr(ins, field, default)

        # 0. Check affected_columns directly
        direct_cols = _get("affected_columns")
        if isinstance(direct_cols, list):
            for c in direct_cols:
                if c:
                    cols.add(str(c).strip().lower())

        # 1. Check metrics_involved
        metrics = _get("metrics_involved")
        if isinstance(metrics, list):
            for m in metrics:
                if m:
                    cols.add(str(m).strip().lower())

        # 2. Check source_column and dimension
        src = _get("source_column")
        if src:
            cols.add(str(src).strip().lower())
        dim = _get("dimension")
        if dim:
            cols.add(str(dim).strip().lower())

        # 3. Check evidence dictionary details
        ev = _get("evidence")
        if isinstance(ev, dict):
            m_ev = ev.get("metric")
            if m_ev and isinstance(m_ev, str):
                for part in m_ev.replace("&", ",").replace("vs", ",").split(","):
                    p_clean = part.strip().lower()
                    if p_clean:
                        cols.add(p_clean)
        elif ev is not None:
            m_ev = getattr(ev, "metric", None)
            if m_ev and isinstance(m_ev, str):
                for part in m_ev.replace("&", ",").replace("vs", ",").split(","):
                    p_clean = part.strip().lower()
                    if p_clean:
                        cols.add(p_clean)

        return sorted(list(cols))

    @classmethod
    def generate_fingerprint(
        cls,
        ins: Any = None,
        *,
        category: Optional[str] = None,
        title: Optional[str] = None,
        affected_columns: Optional[List[str]] = None,
        affected_entity: Optional[str] = None,
        severity: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Generate a deterministic, stable fingerprint identifying the analytical pattern.
        Based strictly on category, affected columns, entity, and sub-pattern.
        Supports passing an insight object or individual attributes.
        """
        if ins is not None:
            cat = (getattr(ins, "category", "") or (ins.get("category") if isinstance(ins, dict) else "") or category or "GENERAL").strip().upper()
            cols = cls.extract_affected_columns(ins) if affected_columns is None else [str(c).strip().lower() for c in affected_columns]
            title_lower = (getattr(ins, "title", "") or (ins.get("title") if isinstance(ins, dict) else "") or title or "").lower()
            entity = (getattr(ins, "affected_entity", "") or (ins.get("affected_entity") if isinstance(ins, dict) else "") or affected_entity or "").strip().lower()
            sev = (getattr(ins, "severity", "") or (ins.get("severity") if isinstance(ins, dict) else "") or severity or "").upper()
        else:
            cat = (category or "GENERAL").strip().upper()
            cols = sorted(list({str(c).strip().lower() for c in (affected_columns or [])}))
            title_lower = (title or "").lower()
            entity = (affected_entity or "").strip().lower()
            sev = (severity or "").upper()

        cols_str = ",".join(sorted(list(set(cols))))

        if cat == "CORRELATION":
            sub_pattern = "pearson_correlation"
        elif cat == "PERFORMANCE":
            if "highest" in title_lower or sev == "POSITIVE":
                sub_pattern = "performance_top"
            elif "lowest" in title_lower or sev == "WARNING":
                sub_pattern = "performance_bottom"
            else:
                sub_pattern = "performance_entity"
        elif cat == "TREND":
            if "increasing" in title_lower:
                sub_pattern = "trend_increasing"
            elif "decreasing" in title_lower:
                sub_pattern = "trend_decreasing"
            else:
                sub_pattern = "trend_trajectory"
        elif cat == "DATA_QUALITY":
            sub_pattern = "data_quality_issue"
        elif cat == "OPPORTUNITY":
            sub_pattern = "opportunity_finding"
        else:
            sub_pattern = "analytical_pattern"

        canonical = f"{cat}:{cols_str}:{entity}:{sub_pattern}"
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]

    @classmethod
    def calculate_status(
        cls,
        baseline: Optional[float],
        latest: Optional[float],
        current_version: int = 1,
        first_seen_version: int = 1,
    ) -> str:
        """
        Calculate analytical status transition between versions.
        Threshold |delta| <= 0.01 indicates stability (PERSISTED).
        """
        if current_version == first_seen_version and (baseline == latest or baseline is None):
            return "NEW"
        if baseline is None or latest is None:
            return "PERSISTED"
        delta = round(latest - baseline, 4)
        if abs(delta) <= 0.01:
            return "PERSISTED"
        elif delta > 0.01:
            return "STRENGTHENED"
        else:
            return "WEAKENED"

    @classmethod
    def compute_strength(cls, ins: Any) -> float:
        """
        Extract numerical magnitude / association strength of an insight.
        Returns a rounded float (4 decimal places).
        """
        def _get(field, default=None):
            if isinstance(ins, dict):
                return ins.get(field, default)
            return getattr(ins, field, default)

        cat = (_get("category") or _get("type") or "").upper()
        ev = _get("evidence")

        # 0. Confidence
        conf = _get("confidence")
        if conf is not None:
            try:
                c_val = float(conf)
                if c_val > 1.0:
                    c_val = c_val / 100.0
                return round(c_val, 4)
            except (ValueError, TypeError):
                pass

        # 1. Pearson correlation coefficient magnitude |r|
        if cat == "CORRELATION":
            corr = None
            if isinstance(ev, dict):
                corr = ev.get("correlation")
            elif ev is not None:
                corr = getattr(ev, "correlation", None)
            
            if corr is None:
                corr = _get("metric_value")

            if corr is not None:
                try:
                    return round(abs(float(corr)), 4)
                except (ValueError, TypeError):
                    pass

        # 2. Contribution percent
        contrib = None
        if isinstance(ev, dict):
            contrib = ev.get("contribution_percent")
        elif ev is not None:
            contrib = getattr(ev, "contribution_percent", None)

        if contrib is not None:
            try:
                c_val = float(contrib)
                if c_val > 1.0:
                    c_val = c_val / 100.0
                return round(c_val, 4)
            except (ValueError, TypeError):
                pass

        # 3. Percentage change
        pct = _get("percentage_change")
        if pct is not None:
            try:
                p_val = float(pct)
                if abs(p_val) > 1.0:
                    p_val = p_val / 100.0
                return round(abs(p_val), 4)
            except (ValueError, TypeError):
                pass

        # 4. Metric value normalized
        mv = _get("metric_value")
        if mv is not None:
            try:
                return round(abs(float(mv)), 4)
            except (ValueError, TypeError):
                pass

        # 5. Priority score as baseline ratio
        ps = _get("priority_score", 50.0)
        try:
            return round(float(ps) / 100.0, 4)
        except (ValueError, TypeError):
            return 0.50

    @classmethod
    def record_run_insights(
        cls,
        db: Session,
        project_id: Optional[str],
        dataset: Dataset,
        run: AnalysisRun,
        insights: List[Any],
    ) -> List[InsightMemory]:
        """
        Record and synchronize insight memory entries upon completion of an INSIGHTS analysis run.
        Updates state transitions: NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED.
        """
        if not project_id:
            project_id = dataset.project_id
        if not project_id:
            return []

        lineage_name = DatasetComparisonService.get_logical_lineage_name(db, dataset)

        # 1. Fetch existing memories for this (project_id, dataset_lineage)
        stmt = select(InsightMemory).where(
            InsightMemory.project_id == project_id,
            InsightMemory.dataset_lineage == lineage_name,
        )
        existing_memories = {m.insight_fingerprint: m for m in db.scalars(stmt).all()}

        active_fps: Set[str] = set()
        recorded: List[InsightMemory] = []

        for ins in insights:
            def _get(field, default=None):
                if isinstance(ins, dict):
                    return ins.get(field, default)
                return getattr(ins, field, default)

            fp = cls.generate_fingerprint(ins)
            active_fps.add(fp)
            curr_strength = cls.compute_strength(ins)
            cols = cls.extract_affected_columns(ins)
            ins_id = _get("id")
            ins_title = _get("title") or "Discovered Pattern"
            ins_cat = (_get("category") or _get("type") or "GENERAL").upper()

            if fp not in existing_memories:
                # NEW insight detected
                mem = InsightMemory(
                    project_id=project_id,
                    dataset_lineage=lineage_name,
                    insight_fingerprint=fp,
                    category=ins_cat,
                    title=ins_title,
                    affected_columns=cols,
                    latest_insight_id=ins_id,
                    first_seen_run_id=run.id,
                    latest_run_id=run.id,
                    first_seen_version=run.dataset_version,
                    latest_seen_version=run.dataset_version,
                    status="NEW",
                    strength_baseline=curr_strength,
                    strength_latest=curr_strength,
                    delta_magnitude=0.0,
                    impact_summary=f"Newly observed pattern in version {run.dataset_version}.",
                    last_seen_at=run.completed_at or utc_now(),
                )
                db.add(mem)
                existing_memories[fp] = mem
                recorded.append(mem)
            else:
                # Existing insight: evaluate state transition
                mem = existing_memories[fp]
                base_str = mem.strength_baseline if mem.strength_baseline is not None else curr_strength
                delta = round(curr_strength - base_str, 4)

                if abs(delta) <= 0.01:
                    new_status = "PERSISTED"
                    summary = f"Association strength remained stable at {curr_strength:.2f}."
                elif delta > 0.01:
                    new_status = "STRENGTHENED"
                    summary = f"Association strength increased from {base_str:.2f} to {curr_strength:.2f}."
                else:
                    new_status = "WEAKENED"
                    summary = f"Association strength decreased from {base_str:.2f} to {curr_strength:.2f}."

                mem.category = ins_cat
                mem.title = ins_title
                mem.affected_columns = cols
                mem.latest_insight_id = ins_id
                mem.latest_run_id = run.id
                mem.latest_seen_version = run.dataset_version
                mem.status = new_status
                mem.strength_latest = curr_strength
                mem.delta_magnitude = round(abs(delta), 4)
                mem.impact_summary = summary
                mem.last_seen_at = run.completed_at or utc_now()
                mem.updated_at = utc_now()
                recorded.append(mem)

        # 2. Check for DISAPPEARED insights
        # Any insight previously recorded for this lineage that did NOT appear in this new run version
        for fp, mem in existing_memories.items():
            if fp not in active_fps:
                if run.dataset_version >= mem.latest_seen_version:
                    mem.status = "DISAPPEARED"
                    mem.impact_summary = f"No longer observed in version {run.dataset_version} analysis run."
                    mem.updated_at = utc_now()
                    recorded.append(mem)

        db.commit()
        return recorded

    @classmethod
    def list_project_memory(
        cls,
        db: Session,
        project_id: str,
        status_filter: Optional[str] = None,
        category: Optional[str] = None,
        lineage: Optional[str] = None,
        dataset_version: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> InsightMemoryListResponse:
        """
        List insight memories scoped to a project with filtering and status breakdown counters.
        """
        project = db.scalar(select(Project).where(Project.id == project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        query = select(InsightMemory).where(InsightMemory.project_id == project_id)

        if lineage:
            query = query.where(func.lower(InsightMemory.dataset_lineage) == func.lower(lineage))
        if status_filter:
            query = query.where(InsightMemory.status == status_filter.upper())
        if category:
            query = query.where(InsightMemory.category == category.upper())
        if dataset_version is not None:
            query = query.where(
                and_(
                    InsightMemory.first_seen_version <= dataset_version,
                    InsightMemory.latest_seen_version >= dataset_version,
                )
            )

        query = query.order_by(InsightMemory.updated_at.desc())

        all_records = list(db.scalars(query).all())
        paginated = all_records[offset : offset + limit]

        # Calculate exact counters
        counters = InsightMemoryCounters(
            total=len(all_records),
            new_count=sum(1 for m in all_records if m.status == "NEW"),
            persisted_count=sum(1 for m in all_records if m.status == "PERSISTED"),
            strengthened_count=sum(1 for m in all_records if m.status == "STRENGTHENED"),
            weakened_count=sum(1 for m in all_records if m.status == "WEAKENED"),
            disappeared_count=sum(1 for m in all_records if m.status == "DISAPPEARED"),
        )

        # Discover distinct versions for this project / lineage
        version_stmt = select(Dataset.version).where(
            Dataset.project_id == project_id,
            Dataset.is_processed == False,
        )
        if lineage:
            version_stmt = version_stmt.where(func.lower(Dataset.name) == func.lower(lineage))
        distinct_versions = sorted(list({v for v in db.scalars(version_stmt).all() if v is not None}))
        if not distinct_versions:
            distinct_versions = [1]

        # Build timeline matrix
        timeline: List[InsightTimelineItem] = []
        for m in paginated:
            cells: List[InsightTimelineCell] = []
            for v in distinct_versions:
                if v < m.first_seen_version:
                    cells.append(
                        InsightTimelineCell(
                            version=v,
                            observed=False,
                            status="NOT_OBSERVED",
                            strength=None,
                        )
                    )
                elif v > m.latest_seen_version and m.status == "DISAPPEARED":
                    cells.append(
                        InsightTimelineCell(
                            version=v,
                            observed=False,
                            status="DISAPPEARED",
                            strength=None,
                        )
                    )
                else:
                    cells.append(
                        InsightTimelineCell(
                            version=v,
                            observed=True,
                            status=m.status if v == m.latest_seen_version else "PERSISTED",
                            strength=m.strength_latest if v == m.latest_seen_version else m.strength_baseline,
                            run_id=m.latest_run_id if v == m.latest_seen_version else m.first_seen_run_id,
                        )
                    )
            timeline.append(
                InsightTimelineItem(
                    fingerprint=m.insight_fingerprint,
                    title=m.title,
                    category=m.category,
                    current_status=m.status,
                    first_seen_version=m.first_seen_version,
                    latest_seen_version=m.latest_seen_version,
                    cells=cells,
                )
            )

        items = [
            InsightMemoryBase(
                id=m.id,
                project_id=m.project_id,
                dataset_lineage=m.dataset_lineage,
                insight_fingerprint=m.insight_fingerprint,
                category=m.category,
                title=m.title,
                affected_columns=m.affected_columns or [],
                latest_insight_id=m.latest_insight_id,
                first_seen_run_id=m.first_seen_run_id,
                latest_run_id=m.latest_run_id,
                first_seen_version=m.first_seen_version,
                latest_seen_version=m.latest_seen_version,
                status=m.status,
                strength_baseline=m.strength_baseline,
                strength_latest=m.strength_latest,
                delta_magnitude=m.delta_magnitude or 0.0,
                impact_summary=m.impact_summary,
                last_seen_at=m.last_seen_at.isoformat(),
                created_at=m.created_at.isoformat(),
                updated_at=m.updated_at.isoformat(),
            )
            for m in paginated
        ]

        return InsightMemoryListResponse(
            project_id=project_id,
            dataset_lineage=lineage,
            versions=distinct_versions,
            counters=counters,
            items=items,
            timeline=timeline,
        )

    @classmethod
    def list_dataset_memory(
        cls,
        db: Session,
        dataset_id: str,
        status_filter: Optional[str] = None,
        category: Optional[str] = None,
    ) -> InsightMemoryListResponse:
        """
        List insight memories scoped to a specific dataset's lineage.
        """
        dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        if not dataset.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dataset '{dataset_id}' does not belong to a project.",
            )

        lineage = DatasetComparisonService.get_logical_lineage_name(db, dataset)
        return cls.list_project_memory(
            db=db,
            project_id=dataset.project_id,
            status_filter=status_filter,
            category=category,
            lineage=lineage,
        )

    @classmethod
    def compare_insight_impact(
        cls,
        db: Session,
        base_id: str,
        comp_id: str,
    ) -> InsightImpactComparisonResponse:
        """
        Compare analytical insights between two dataset versions within the same logical lineage.
        Identifies NEW, PERSISTED, STRENGTHENED, WEAKENED, and DISAPPEARED insights and flags
        downstream recommendations needing human review.
        """
        base_ds = db.scalar(select(Dataset).where(Dataset.id == base_id))
        if not base_ds:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Base dataset '{base_id}' not found.",
            )

        comp_ds = db.scalar(select(Dataset).where(Dataset.id == comp_id))
        if not comp_ds:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comparison dataset '{comp_id}' not found.",
            )

        # 1. Project Boundary Validation
        if base_ds.project_id != comp_ds.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cross-project comparison is prohibited.",
            )

        # 2. Lineage Boundary Validation
        base_lineage = DatasetComparisonService.get_logical_lineage_name(db, base_ds)
        comp_lineage = DatasetComparisonService.get_logical_lineage_name(db, comp_ds)
        if base_lineage.strip().lower() != comp_lineage.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cross-lineage insight comparison is prohibited between '{base_lineage}' and '{comp_lineage}'.",
            )

        # 3. Retrieve Insights for Base & Comparison
        base_insights = cls._get_insights_for_dataset(db, base_ds)
        comp_insights = cls._get_insights_for_dataset(db, comp_ds)

        base_map: Dict[str, Tuple[Any, float]] = {
            cls.generate_fingerprint(i): (i, cls.compute_strength(i)) for i in base_insights
        }
        comp_map: Dict[str, Tuple[Any, float]] = {
            cls.generate_fingerprint(i): (i, cls.compute_strength(i)) for i in comp_insights
        }

        impacts: List[InsightImpactItem] = []
        all_fps = list(dict.fromkeys(list(base_map.keys()) + list(comp_map.keys())))

        changed_or_disappeared_ids: Set[str] = set()

        def _field(obj, key, default=None):
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)

        for fp in all_fps:
            in_base = fp in base_map
            in_comp = fp in comp_map

            if in_comp and not in_base:
                ins, c_str = comp_map[fp]
                impacts.append(
                    InsightImpactItem(
                        fingerprint=fp,
                        title=_field(ins, "title", "New Insight"),
                        category=(_field(ins, "category") or _field(ins, "type") or "GENERAL").upper(),
                        status="NEW",
                        baseline_strength=None,
                        comparison_strength=c_str,
                        delta_magnitude=None,
                        explanation="Newly observed pattern in comparison version.",
                    )
                )
            elif in_base and not in_comp:
                ins, b_str = base_map[fp]
                ins_id = _field(ins, "id")
                if ins_id:
                    changed_or_disappeared_ids.add(str(ins_id))
                changed_or_disappeared_ids.add(fp)
                impacts.append(
                    InsightImpactItem(
                        fingerprint=fp,
                        title=_field(ins, "title", "Disappeared Insight"),
                        category=(_field(ins, "category") or _field(ins, "type") or "GENERAL").upper(),
                        status="DISAPPEARED",
                        baseline_strength=b_str,
                        comparison_strength=None,
                        delta_magnitude=None,
                        explanation="No longer observed in comparison version.",
                    )
                )
            else:
                b_ins, b_str = base_map[fp]
                c_ins, c_str = comp_map[fp]
                delta = round(c_str - b_str, 4)
                mag = round(abs(delta), 4)

                if abs(delta) <= 0.01:
                    st = "PERSISTED"
                    expl = f"Association strength remained stable at {c_str:.2f}."
                elif delta > 0.01:
                    st = "STRENGTHENED"
                    expl = f"Association strength increased from {b_str:.2f} to {c_str:.2f}."
                    if mag >= 0.10:
                        b_id = _field(b_ins, "id")
                        if b_id:
                            changed_or_disappeared_ids.add(str(b_id))
                        changed_or_disappeared_ids.add(fp)
                else:
                    st = "WEAKENED"
                    expl = f"Association strength decreased from {b_str:.2f} to {c_str:.2f}."
                    b_id = _field(b_ins, "id")
                    if b_id:
                        changed_or_disappeared_ids.add(str(b_id))
                    changed_or_disappeared_ids.add(fp)

                title_val = _field(c_ins, "title") or _field(b_ins, "title") or "Insight"
                cat_val = (_field(c_ins, "category") or _field(c_ins, "type") or "GENERAL").upper()

                impacts.append(
                    InsightImpactItem(
                        fingerprint=fp,
                        title=title_val,
                        category=cat_val,
                        status=st,
                        baseline_strength=b_str,
                        comparison_strength=c_str,
                        delta_magnitude=mag,
                        explanation=expl,
                    )
                )

        # 4. Calculate Summary Counters
        counters = InsightMemoryCounters(
            total=len(impacts),
            new_count=sum(1 for i in impacts if i.status == "NEW"),
            persisted_count=sum(1 for i in impacts if i.status == "PERSISTED"),
            strengthened_count=sum(1 for i in impacts if i.status == "STRENGTHENED"),
            weakened_count=sum(1 for i in impacts if i.status == "WEAKENED"),
            disappeared_count=sum(1 for i in impacts if i.status == "DISAPPEARED"),
        )

        # 5. Downstream Decision & Recommendation Review Alerts
        dataset_ids_to_check = [base_ds.id, comp_ds.id]
        if base_ds.parent_id:
            dataset_ids_to_check.append(base_ds.parent_id)
        if comp_ds.parent_id:
            dataset_ids_to_check.append(comp_ds.parent_id)

        downstream_reviews = cls.find_downstream_reviews(
            db=db,
            dataset_ids=dataset_ids_to_check,
            changed_or_disappeared_ids=changed_or_disappeared_ids,
            impacts=impacts,
        )

        return InsightImpactComparisonResponse(
            project_id=base_ds.project_id or "",
            dataset_lineage=base_lineage,
            base_dataset_id=base_ds.id,
            base_version=base_ds.version or 1,
            comparison_dataset_id=comp_ds.id,
            comparison_version=comp_ds.version or 1,
            counters=counters,
            impacts=impacts,
            downstream_reviews=downstream_reviews,
        )

    @classmethod
    def find_downstream_reviews(
        cls,
        db: Session,
        dataset_ids: List[str],
        changed_or_disappeared_ids: Set[str],
        impacts: Optional[List[InsightImpactItem]] = None,
    ) -> List[DownstreamReviewItem]:
        """
        Identify downstream recommendations whose baseline insight evidence has weakened or disappeared.
        Returns non-invalidating human review advisories.
        """
        rec_stmt = select(DecisionRecommendationEvaluation).where(
            DecisionRecommendationEvaluation.dataset_id.in_(dataset_ids)
        )
        stored_recs = list(db.scalars(rec_stmt).all())
        reviews: List[DownstreamReviewItem] = []

        for r in stored_recs:
            ev = r.evidence or {}
            linked_ids = [str(i) for i in ev.get("insight_ids", [])]
            for changed_id in changed_or_disappeared_ids:
                if str(changed_id) in linked_ids:
                    impact_st = "CHANGED"
                    impact_title = "Underlying Insight"
                    if impacts:
                        matching_impact = next(
                            (imp for imp in impacts if str(changed_id) == imp.fingerprint),
                            None
                        )
                        if matching_impact:
                            impact_st = matching_impact.status
                            impact_title = matching_impact.title

                    reviews.append(
                        DownstreamReviewItem(
                            recommendation_id=r.id,
                            title=r.title,
                            target_metric=r.target_metric,
                            linked_insight_id=str(changed_id),
                            linked_insight_title=impact_title,
                            linked_insight_status=impact_st,
                            review_required=True,
                            reason=(
                                f"Recommendation was informed by insight '{impact_title}', "
                                f"which has {impact_st.lower()} in the comparison version. Human review is advised."
                            ),
                        )
                    )
        return reviews

    @classmethod
    def _get_insights_for_dataset(cls, db: Session, ds: Dataset) -> List[Any]:
        """
        Helper to fetch insights for a dataset:
        1. From latest INSIGHTS AnalysisRun snapshot if available
        2. From DatasetInsight table records
        """
        # 1. Check AnalysisRun
        stmt = (
            select(AnalysisRun)
            .where(
                or_(
                    AnalysisRun.dataset_id == ds.id,
                    AnalysisRun.processed_dataset_id == ds.id,
                ),
                AnalysisRun.run_type == "INSIGHTS",
                AnalysisRun.status == "COMPLETED",
            )
            .order_by(AnalysisRun.created_at.desc())
        )
        run = db.scalars(stmt).first()
        if run and run.output_artifacts and "insights" in run.output_artifacts:
            raw_list = run.output_artifacts["insights"]
            if isinstance(raw_list, list) and len(raw_list) > 0:
                insights_out = []
                for item in raw_list:
                    if isinstance(item, dict):
                        try:
                            insights_out.append(Insight(**item))
                        except Exception:
                            insights_out.append(item)
                    else:
                        insights_out.append(item)
                return insights_out

        # 2. Query DatasetInsight
        ids_to_check = [ds.id]
        if ds.parent_id:
            ids_to_check.append(ds.parent_id)
        proc_child = db.scalar(select(Dataset).where(Dataset.parent_id == ds.id, Dataset.is_processed == True))
        if proc_child:
            ids_to_check.append(proc_child.id)

        ins_stmt = select(DatasetInsight).where(DatasetInsight.dataset_id.in_(ids_to_check)).order_by(DatasetInsight.priority_score.desc())
        return list(db.scalars(ins_stmt).all())

    @classmethod
    def get_run_insights(cls, db: Session, run_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve reproducible insight artifacts generated during a specific Analysis Run.
        """
        run = db.scalar(select(AnalysisRun).where(AnalysisRun.id == run_id))
        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Analysis run '{run_id}' not found.",
            )

        if run.output_artifacts and "insights" in run.output_artifacts:
            return run.output_artifacts["insights"]

        # Fallback to DatasetInsight
        records = cls._get_insights_for_dataset(db, run.dataset)
        return [
            {
                "id": getattr(r, "id", None),
                "category": getattr(r, "category", None),
                "severity": getattr(r, "severity", None),
                "title": getattr(r, "title", None),
                "observation": getattr(r, "observation", None),
                "fingerprint": cls.generate_fingerprint(r),
                "strength": cls.compute_strength(r),
            }
            for r in records
        ]
