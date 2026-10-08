"""Phase 14: Decision Knowledge & Operating Memory Service.

Provides factual, searchable query-time operating memory linking human-entered
lessons and notes with system-derived factual observations from existing decision
intelligence records.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.decision_knowledge import DecisionKnowledgeEntry
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.schemas.decision_knowledge import (
    KnowledgeEntryCreate,
    KnowledgeEntryUpdate,
    KnowledgeEntryResponse,
    ProjectKnowledgeListResponse,
    ALLOWED_CATEGORIES,
)
from app.services.decision_portfolio_service import DecisionPortfolioService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionKnowledgeService:
    """Service managing project decision knowledge and operating memory."""

    @classmethod
    def get_project_knowledge(
        cls,
        db: Session,
        project_id: str,
        category: Optional[str] = None,
        source_type: Optional[str] = None,
        decision_id: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        search_query: Optional[str] = None,
        entry_type: Optional[str] = None,
        include_system_derived: bool = True,
    ) -> Optional[ProjectKnowledgeListResponse]:
        """Fetch all knowledge entries for a project with search and filtering."""
        # 1. Enforce project existence and boundary
        proj = db.scalar(select(Project).where(Project.id == project_id))
        if not proj:
            return None

        # 2. Query persisted human entries
        query = select(DecisionKnowledgeEntry).where(
            DecisionKnowledgeEntry.project_id == project_id,
            DecisionKnowledgeEntry.is_archived.is_(False),
        )

        if category:
            query = query.where(DecisionKnowledgeEntry.category == category.upper().strip())
        if source_type:
            query = query.where(DecisionKnowledgeEntry.source_type == source_type.upper().strip())
        if decision_id:
            query = query.where(DecisionKnowledgeEntry.decision_id == decision_id)
        if entry_type:
            query = query.where(DecisionKnowledgeEntry.entry_type == entry_type.upper().strip())
        if date_from:
            query = query.where(DecisionKnowledgeEntry.created_at >= date_from)
        if date_to:
            query = query.where(DecisionKnowledgeEntry.created_at <= date_to)
        if search_query and search_query.strip():
            sq = f"%{search_query.strip()}%"
            query = query.where(
                or_(
                    DecisionKnowledgeEntry.title.ilike(sq),
                    DecisionKnowledgeEntry.content.ilike(sq),
                    DecisionKnowledgeEntry.category.ilike(sq),
                )
            )

        persisted_entries = db.scalars(query.order_by(DecisionKnowledgeEntry.created_at.desc())).all()
        results: List[KnowledgeEntryResponse] = [
            KnowledgeEntryResponse.model_validate(e) for e in persisted_entries
        ]

        # 3. Synthesize system-derived observations at query time if requested
        if include_system_derived and (not entry_type or entry_type.upper().strip() in ("SYSTEM_DERIVED", "ALL")):
            derived_entries = cls._generate_system_derived_entries(
                db=db,
                project_id=project_id,
                category=category,
                source_type=source_type,
                decision_id=decision_id,
                date_from=date_from,
                date_to=date_to,
                search_query=search_query,
            )
            results.extend(derived_entries)

        # 4. Sort all entries chronologically descending
        results.sort(key=lambda x: x.created_at, reverse=True)

        # 5. Compute breakdowns
        cat_counts: Dict[str, int] = {c: 0 for c in ALLOWED_CATEGORIES}
        human_count = 0
        system_count = 0

        for r in results:
            if r.category in cat_counts:
                cat_counts[r.category] += 1
            if r.entry_type == "HUMAN_RECORDED":
                human_count += 1
            elif r.entry_type == "SYSTEM_DERIVED":
                system_count += 1

        return ProjectKnowledgeListResponse(
            project_id=project_id,
            total_entries=len(results),
            human_recorded_count=human_count,
            system_derived_count=system_count,
            total_human_recorded=human_count,
            total_system_derived=system_count,
            categories_breakdown=cat_counts,
            entries=results,
        )

    @classmethod
    def _generate_system_derived_entries(
        cls,
        db: Session,
        project_id: str,
        category: Optional[str] = None,
        source_type: Optional[str] = None,
        decision_id: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        search_query: Optional[str] = None,
    ) -> List[KnowledgeEntryResponse]:
        """Dynamically build factual, non-hallucinated system knowledge from existing audit records."""
        derived: List[KnowledgeEntryResponse] = []
        target_cat = category.upper().strip() if category else None
        target_src = source_type.upper().strip() if source_type else None
        sq = search_query.lower().strip() if search_query and search_query.strip() else None

        # A. From Observed Outcomes
        outcomes_q = select(DecisionOutcome).where(
            DecisionOutcome.project_id == project_id,
            DecisionOutcome.outcome_status != "PENDING",
        )
        if decision_id:
            outcomes_q = outcomes_q.where(DecisionOutcome.decision_id == decision_id)
        if date_from:
            outcomes_q = outcomes_q.where(DecisionOutcome.created_at >= date_from)
        if date_to:
            outcomes_q = outcomes_q.where(DecisionOutcome.created_at <= date_to)

        outcomes = db.scalars(outcomes_q).all()
        for o in outcomes:
            metric_nm = o.actual_metric or o.expected_metric or "Target Metric"
            is_mat = DecisionPortfolioService.is_material_deviation(o)
            cat = "OUTCOME_LESSON" if is_mat else "OBSERVATION"
            if target_cat and target_cat != cat:
                continue
            if target_src and target_src != "OUTCOME":
                continue

            rel_str = f"{round(o.relative_delta * 100.0, 2)}%" if o.relative_delta is not None else "N/A"
            title = f"{'Material deviation observed' if is_mat else 'Outcome matched'} on {metric_nm}"
            content = (
                f"Observed value ({o.actual_value}) differed from expected value ({o.expected_value}) by {rel_str}."
                if is_mat
                else f"Observed value ({o.actual_value}) matched expected projection ({o.expected_value})."
            )

            if sq and not (sq in title.lower() or sq in content.lower() or sq in cat.lower()):
                continue

            created = o.recorded_at or o.created_at or utc_now()
            derived.append(
                KnowledgeEntryResponse(
                    id=f"sys-out-{o.id}",
                    project_id=project_id,
                    decision_id=o.decision_id,
                    dataset_id=o.dataset_id,
                    title=title,
                    content=content,
                    category=cat,
                    source_type="OUTCOME",
                    source_id=o.id,
                    entry_type="SYSTEM_DERIVED",
                    created_by="InsightFlow Decision Engine",
                    is_archived=False,
                    created_at=created,
                    updated_at=created,
                )
            )

        # B. From Learning Signals
        signals_q = select(DecisionLearningSignal).where(
            DecisionLearningSignal.project_id == project_id,
        )
        if date_from:
            signals_q = signals_q.where(DecisionLearningSignal.created_at >= date_from)
        if date_to:
            signals_q = signals_q.where(DecisionLearningSignal.created_at <= date_to)

        signals = db.scalars(signals_q).all()
        for s in signals:
            src_decs = s.source_decision_ids or []
            if decision_id and decision_id not in src_decs:
                continue

            cat = "DECISION_LESSON"
            if target_cat and target_cat != cat:
                continue
            if target_src and target_src != "LEARNING_SIGNAL":
                continue

            title = s.title or f"Learning Signal: {s.signal_type}"
            content = s.description or f"Active signal flagged with severity {s.severity}."

            if sq and not (sq in title.lower() or sq in content.lower() or sq in cat.lower()):
                continue

            created = s.created_at or utc_now()
            target_dec = src_decs[0] if (isinstance(src_decs, list) and len(src_decs) > 0) else None

            derived.append(
                KnowledgeEntryResponse(
                    id=f"sys-sig-{s.id}",
                    project_id=project_id,
                    decision_id=target_dec,
                    dataset_id=None,
                    title=title,
                    content=content,
                    category=cat,
                    source_type="LEARNING_SIGNAL",
                    source_id=s.id,
                    entry_type="SYSTEM_DERIVED",
                    created_by="InsightFlow Decision Engine",
                    is_archived=False,
                    created_at=created,
                    updated_at=created,
                )
            )

        return derived

    @classmethod
    def create_human_knowledge(
        cls,
        db: Session,
        project_id: str,
        payload: KnowledgeEntryCreate,
    ) -> Optional[DecisionKnowledgeEntry]:
        """Create and persist a human-recorded knowledge entry."""
        # 1. Verify project exists
        proj = db.scalar(select(Project).where(Project.id == project_id))
        if not proj:
            return None

        # 2. Instantiate and persist entry
        entry = DecisionKnowledgeEntry(
            project_id=project_id,
            decision_id=payload.decision_id,
            dataset_id=payload.dataset_id,
            title=payload.title,
            content=payload.content,
            category=payload.category,
            source_type=payload.source_type.upper().strip(),
            source_id=payload.source_id,
            entry_type="HUMAN_RECORDED",
            created_by=payload.created_by or "User",
            is_archived=False,
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @classmethod
    def get_knowledge_entry(
        cls,
        db: Session,
        knowledge_id: str,
    ) -> Optional[KnowledgeEntryResponse]:
        """Retrieve a single knowledge entry (either persisted human or synthesized system-derived)."""
        if knowledge_id.startswith("sys-out-"):
            out_id = knowledge_id[8:]
            outcome = db.scalar(select(DecisionOutcome).where(DecisionOutcome.id == out_id))
            if not outcome:
                return None
            is_mat = DecisionPortfolioService.is_material_deviation(outcome)
            cat = "OUTCOME_LESSON" if is_mat else "OBSERVATION"
            metric_nm = outcome.actual_metric or outcome.expected_metric or "Target Metric"
            rel_str = f"{round(outcome.relative_delta * 100.0, 2)}%" if outcome.relative_delta is not None else "significant deviation"
            title = (
                f"Outcome Variance: {metric_nm} ({rel_str})"
                if is_mat
                else f"Outcome Observation: {metric_nm}"
            )
            content = (
                f"Observed value ({outcome.actual_value}) differed from expected value ({outcome.expected_value}) by {rel_str}."
                if is_mat
                else f"Observed value ({outcome.actual_value}) matched expected projection ({outcome.expected_value})."
            )
            created = outcome.recorded_at or outcome.created_at or utc_now()
            return KnowledgeEntryResponse(
                id=knowledge_id,
                project_id=outcome.project_id or "",
                decision_id=outcome.decision_id,
                dataset_id=outcome.dataset_id,
                title=title,
                content=content,
                category=cat,
                source_type="OUTCOME",
                source_id=outcome.id,
                entry_type="SYSTEM_DERIVED",
                created_by="InsightFlow Decision Engine",
                is_archived=False,
                created_at=created,
                updated_at=created,
            )

        if knowledge_id.startswith("sys-sig-"):
            sig_id = knowledge_id[8:]
            signal = db.scalar(select(DecisionLearningSignal).where(DecisionLearningSignal.id == sig_id))
            if not signal:
                return None
            src_decs = signal.source_decision_ids or []
            target_dec = src_decs[0] if (isinstance(src_decs, list) and len(src_decs) > 0) else None
            created = signal.created_at or utc_now()
            return KnowledgeEntryResponse(
                id=knowledge_id,
                project_id=signal.project_id or "",
                decision_id=target_dec,
                dataset_id=None,
                title=signal.title or f"Learning Signal: {signal.signal_type}",
                content=signal.description or f"Active signal flagged with severity {signal.severity}.",
                category="DECISION_LESSON",
                source_type="LEARNING_SIGNAL",
                source_id=signal.id,
                entry_type="SYSTEM_DERIVED",
                created_by="InsightFlow Decision Engine",
                is_archived=False,
                created_at=created,
                updated_at=created,
            )

        persisted = db.scalar(
            select(DecisionKnowledgeEntry).where(DecisionKnowledgeEntry.id == knowledge_id)
        )
        if not persisted:
            return None
        return KnowledgeEntryResponse.model_validate(persisted)

    @classmethod
    def update_human_knowledge(
        cls,
        db: Session,
        knowledge_id: str,
        payload: KnowledgeEntryUpdate,
    ) -> Optional[DecisionKnowledgeEntry]:
        """Update an existing human-recorded knowledge entry. Rejects system-derived records."""
        if knowledge_id.startswith("sys-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System-derived knowledge entries are derived from immutable audit records and cannot be directly modified.",
            )

        entry = db.scalar(
            select(DecisionKnowledgeEntry).where(DecisionKnowledgeEntry.id == knowledge_id)
        )
        if not entry:
            return None

        if entry.entry_type == "SYSTEM_DERIVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System-derived knowledge entries are derived from immutable audit records and cannot be directly modified.",
            )

        if payload.title is not None:
            entry.title = payload.title
        if payload.content is not None:
            entry.content = payload.content
        if payload.category is not None:
            entry.category = payload.category
        if payload.is_archived is not None:
            entry.is_archived = payload.is_archived

        entry.updated_at = utc_now()
        db.commit()
        db.refresh(entry)
        return entry

    @classmethod
    def archive_human_knowledge(
        cls,
        db: Session,
        knowledge_id: str,
    ) -> Optional[DecisionKnowledgeEntry]:
        """Soft-archive a human-recorded knowledge entry. Rejects system-derived records."""
        if knowledge_id.startswith("sys-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System-derived knowledge entries are derived from immutable audit records and cannot be deleted.",
            )

        entry = db.scalar(
            select(DecisionKnowledgeEntry).where(DecisionKnowledgeEntry.id == knowledge_id)
        )
        if not entry:
            return None

        if entry.entry_type == "SYSTEM_DERIVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System-derived knowledge entries are derived from immutable audit records and cannot be deleted.",
            )

        entry.is_archived = True
        entry.updated_at = utc_now()
        db.commit()
        db.refresh(entry)
        return entry

