from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AuditEventCreate(BaseModel):
    """Payload for emitting a Decision Audit Event."""
    decision_id: Optional[str] = Field(None, description="Decision ID")
    recommendation_id: Optional[str] = Field(None, description="Recommendation ID")
    event_type: str = Field(..., description="Audit Event Type (e.g. DECISION_CREATED, GUARDRAIL_EVALUATED)")
    event_status: str = Field("SUCCESS", description="Event status: SUCCESS, FAILED, PENDING, BLOCKED")
    actor_type: str = Field("SYSTEM", description="Actor type: SYSTEM, USER, AI, API")
    actor_id: Optional[str] = Field(None, description="Actor identifier")
    source_service: str = Field("decision_service", description="Source component emitting event")
    evidence_references: Optional[Dict[str, Any]] = Field(default_factory=dict, description="References to datasets, metrics, insights, recommendations")
    previous_state: Optional[Dict[str, Any]] = Field(None, description="Previous state snapshot")
    new_state: Optional[Dict[str, Any]] = Field(None, description="New state snapshot")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Event metadata")


class AuditEventResponse(BaseModel):
    """Response representation for an individual Audit Event."""
    id: str = Field(..., description="Audit event ID")
    dataset_id: str = Field(..., description="Dataset ID")
    decision_id: Optional[str] = Field(None, description="Decision ID")
    recommendation_id: Optional[str] = Field(None, description="Recommendation ID")
    event_type: str = Field(..., description="Event type")
    event_status: str = Field(..., description="Event status")
    actor_type: str = Field(..., description="Actor type")
    actor_id: Optional[str] = Field(None, description="Actor ID")
    source_service: str = Field(..., description="Source service")
    evidence_references: Dict[str, Any] = Field(default_factory=dict, description="Evidence references")
    previous_state: Optional[Dict[str, Any]] = Field(None, description="Previous state")
    new_state: Optional[Dict[str, Any]] = Field(None, description="New state")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadata")
    timestamp: datetime = Field(..., description="Event timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")


class DecisionAuditTrailResponse(BaseModel):
    """Response representing full reconstructed audit trail for a decision or dataset."""
    dataset_id: str = Field(..., description="Dataset ID")
    decision_id: Optional[str] = Field(None, description="Decision ID if filtered")
    total_events: int = Field(..., description="Total chronological events")
    chronological_chain: List[AuditEventResponse] = Field(default_factory=list, description="Ordered audit events")
