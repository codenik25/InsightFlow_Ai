"""Phase 14: Decision Knowledge & Operating Memory API Endpoints.

Provides endpoints for searching, querying, creating, updating, and archiving
knowledge entries and historical operating memory.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_knowledge import (
    KnowledgeEntryCreate,
    KnowledgeEntryUpdate,
    KnowledgeEntryResponse,
    ProjectKnowledgeListResponse,
)
from app.services.decision_knowledge_service import DecisionKnowledgeService

router = APIRouter()


import re


def _parse_query_datetime(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    val = val.strip()
    val = re.sub(r' (\d\d:\d\d)$', r'+\1', val)
    try:
        return datetime.fromisoformat(val)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid datetime format: {val}",
        )


@router.get(
    "/projects/{project_id}/knowledge",
    response_model=ProjectKnowledgeListResponse,
    summary="Get Project Decision Knowledge & Operating Memory",
    description="Retrieve searchable, categorized operating memory and historical lessons for a project.",
)
def get_project_knowledge(
    project_id: str,
    category: Optional[str] = Query(None, description="Filter by category (e.g. DECISION_LESSON, OUTCOME_LESSON, OBSERVATION)"),
    source_type: Optional[str] = Query(None, description="Filter by source type (DECISION, OUTCOME, LEARNING_SIGNAL, MANUAL, etc.)"),
    decision_id: Optional[str] = Query(None, description="Filter by specific decision ID"),
    date_from: Optional[str] = Query(None, description="Filter entries created on or after this timestamp"),
    date_to: Optional[str] = Query(None, description="Filter entries created on or before this timestamp"),
    search: Optional[str] = Query(None, description="Case-insensitive text search across title, content, and category"),
    entry_type: Optional[str] = Query(None, description="Filter by HUMAN_RECORDED or SYSTEM_DERIVED"),
    include_system_derived: bool = Query(True, description="Whether to dynamically synthesize system-derived entries"),
    db: Session = Depends(get_db),
) -> ProjectKnowledgeListResponse:
    """List and search knowledge entries for a project."""
    parsed_date_from = _parse_query_datetime(date_from)
    parsed_date_to = _parse_query_datetime(date_to)

    res = DecisionKnowledgeService.get_project_knowledge(
        db=db,
        project_id=project_id,
        category=category,
        source_type=source_type,
        decision_id=decision_id,
        date_from=parsed_date_from,
        date_to=parsed_date_to,
        search_query=search,
        entry_type=entry_type,
        include_system_derived=include_system_derived,
    )
    if res is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )
    return res


@router.post(
    "/projects/{project_id}/knowledge",
    response_model=KnowledgeEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Human Knowledge Entry",
    description="Record a human-authored lesson, observation, note, assumption, or constraint for a project.",
)
def create_human_knowledge(
    project_id: str,
    payload: KnowledgeEntryCreate,
    db: Session = Depends(get_db),
) -> KnowledgeEntryResponse:
    """Create a new human-recorded operating memory entry."""
    entry = DecisionKnowledgeService.create_human_knowledge(
        db=db,
        project_id=project_id,
        payload=payload,
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )
    return KnowledgeEntryResponse.model_validate(entry)


@router.get(
    "/knowledge/{knowledge_id}",
    response_model=KnowledgeEntryResponse,
    summary="Get Knowledge Entry by ID",
    description="Retrieve a single knowledge entry by ID (persisted human or synthesized system-derived).",
)
def get_knowledge_entry(
    knowledge_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> KnowledgeEntryResponse:
    """Retrieve an individual knowledge entry."""
    entry = DecisionKnowledgeService.get_knowledge_entry(
        db=db,
        knowledge_id=knowledge_id,
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found",
        )
    if project_id and getattr(entry, "project_id", None) and entry.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found in project '{project_id}'",
        )
    return entry


@router.patch(
    "/knowledge/{knowledge_id}",
    response_model=KnowledgeEntryResponse,
    summary="Update Human Knowledge Entry",
    description="Update a human-recorded knowledge entry. Rejects system-derived immutable records.",
)
def update_human_knowledge(
    knowledge_id: str,
    payload: KnowledgeEntryUpdate,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> KnowledgeEntryResponse:
    """Update fields on an existing human-recorded knowledge entry."""
    existing = DecisionKnowledgeService.get_knowledge_entry(db=db, knowledge_id=knowledge_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found",
        )
    if project_id and getattr(existing, "project_id", None) and existing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found in project '{project_id}'",
        )

    entry = DecisionKnowledgeService.update_human_knowledge(
        db=db,
        knowledge_id=knowledge_id,
        payload=payload,
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found",
        )
    return KnowledgeEntryResponse.model_validate(entry)


@router.delete(
    "/knowledge/{knowledge_id}",
    summary="Archive Human Knowledge Entry",
    description="Soft-archive a human-recorded knowledge entry. Rejects system-derived immutable records.",
)
def archive_human_knowledge(
    knowledge_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> dict:
    """Soft-archive a human knowledge entry."""
    existing = DecisionKnowledgeService.get_knowledge_entry(db=db, knowledge_id=knowledge_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found",
        )
    if project_id and getattr(existing, "project_id", None) and existing.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found in project '{project_id}'",
        )

    entry = DecisionKnowledgeService.archive_human_knowledge(
        db=db,
        knowledge_id=knowledge_id,
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge entry '{knowledge_id}' not found",
        )
    return {
        "message": "Knowledge entry archived successfully",
        "id": knowledge_id,
        "is_archived": True,
    }

