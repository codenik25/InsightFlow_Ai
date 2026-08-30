from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.decision_audit import DecisionAuditEvent
from app.schemas.audit import (
    AuditEventCreate,
    AuditEventResponse,
    DecisionAuditTrailResponse,
)
from app.services.eda_service import EDAService


class DecisionAuditService:
    """Service layer for append-only Decision Audit Trail events."""

    @classmethod
    def record_event(
        cls,
        db: Session,
        dataset_id: str,
        payload: AuditEventCreate,
    ) -> AuditEventResponse:
        """Record an append-only audit trail event."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        evidence_refs = payload.evidence_references or {}
        if not isinstance(evidence_refs, dict):
            evidence_refs = {"raw": evidence_refs}

        # Add dataset_id to evidence_references if not present
        if "dataset_id" not in evidence_refs:
            evidence_refs["dataset_id"] = target_dataset.id

        audit_event = DecisionAuditEvent(
            dataset_id=target_dataset.id,
            decision_id=payload.decision_id or payload.recommendation_id,
            recommendation_id=payload.recommendation_id,
            event_type=payload.event_type.upper(),
            event_status=payload.event_status.upper() if payload.event_status else "SUCCESS",
            actor_type=payload.actor_type.upper() if payload.actor_type else "SYSTEM",
            actor_id=payload.actor_id,
            source_service=payload.source_service or "decision_service",
            evidence_references=evidence_refs,
            previous_state=payload.previous_state,
            new_state=payload.new_state,
            metadata_json=payload.metadata or {},
        )

        db.add(audit_event)
        db.commit()
        db.refresh(audit_event)

        return cls._map_to_response(audit_event)

    @classmethod
    def get_audit_trail(
        cls,
        db: Session,
        dataset_id: str,
        decision_id: Optional[str] = None,
    ) -> DecisionAuditTrailResponse:
        """Retrieve chronological append-only audit events for a dataset or specific decision."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        stmt = select(DecisionAuditEvent).where(DecisionAuditEvent.dataset_id == target_dataset.id)
        if decision_id:
            stmt = stmt.where(
                (DecisionAuditEvent.decision_id == decision_id) | (DecisionAuditEvent.recommendation_id == decision_id)
            )

        stmt = stmt.order_by(DecisionAuditEvent.timestamp.asc(), DecisionAuditEvent.created_at.asc())
        records = db.scalars(stmt).all()

        mapped_events = [cls._map_to_response(r) for r in records]
        return DecisionAuditTrailResponse(
            dataset_id=target_dataset.id,
            decision_id=decision_id,
            total_events=len(mapped_events),
            chronological_chain=mapped_events,
        )

    @classmethod
    def get_event_by_id(cls, db: Session, dataset_id: str, event_id: str) -> AuditEventResponse:
        """Retrieve a single audit event by ID with dataset isolation."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        stmt = select(DecisionAuditEvent).where(
            DecisionAuditEvent.id == event_id,
            DecisionAuditEvent.dataset_id == target_dataset.id,
        )
        record = db.scalars(stmt).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audit event '{event_id}' not found for dataset '{dataset_id}'.",
            )
        return cls._map_to_response(record)

    @classmethod
    def _map_to_response(cls, record: DecisionAuditEvent) -> AuditEventResponse:
        return AuditEventResponse(
            id=record.id,
            dataset_id=record.dataset_id,
            decision_id=record.decision_id,
            recommendation_id=record.recommendation_id,
            event_type=record.event_type,
            event_status=record.event_status,
            actor_type=record.actor_type,
            actor_id=record.actor_id,
            source_service=record.source_service,
            evidence_references=record.evidence_references or {},
            previous_state=record.previous_state,
            new_state=record.new_state,
            metadata_json=record.metadata_json or {},
            timestamp=record.timestamp,
            created_at=record.created_at,
        )
