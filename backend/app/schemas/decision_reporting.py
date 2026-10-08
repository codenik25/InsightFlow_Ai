import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReportMetadata(BaseModel):
    """Factual metadata describing report origin, scope, and query timestamp."""
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scope: str = Field(..., description="INDIVIDUAL_DECISION or PROJECT")
    project_id: str
    generated_at: datetime = Field(default_factory=utc_now)
    data_as_of: datetime = Field(default_factory=utc_now)


class AuditTimelineEvent(BaseModel):
    """Single chronological factual event in an individual decision lifecycle."""
    timestamp: datetime
    event_type: str
    actor: Optional[str] = None
    source_id: str
    description: str


class IndividualDecisionReportResponse(BaseModel):
    """Complete, end-to-end multi-hop provenance and audit report for an individual decision."""
    metadata: ReportMetadata
    decision_identity: Dict[str, Any] = Field(default_factory=dict)
    decision_summary: Dict[str, Any] = Field(default_factory=dict)
    dataset_and_lineage: Dict[str, Any] = Field(default_factory=dict)
    analytical_evidence: Dict[str, Any] = Field(default_factory=dict)
    governance_audit: Dict[str, Any] = Field(default_factory=dict)
    execution_audit: Dict[str, Any] = Field(default_factory=dict)
    outcome_audit: Dict[str, Any] = Field(default_factory=dict)
    performance_summary: Dict[str, Any] = Field(default_factory=dict)
    learning_summary: Dict[str, Any] = Field(default_factory=dict)
    audit_timeline: List[AuditTimelineEvent] = Field(default_factory=list)
    source_references: Dict[str, Any] = Field(default_factory=dict)


class ProjectDecisionReportResponse(BaseModel):
    """Factual, project-wide portfolio and operational audit report."""
    metadata: ReportMetadata
    project_summary: Dict[str, Any] = Field(default_factory=dict)
    portfolio_distributions: Dict[str, Any] = Field(default_factory=dict)
    operations_and_capacity: Dict[str, Any] = Field(default_factory=dict)
    portfolio_concentration: Dict[str, Any] = Field(default_factory=dict)
    shared_dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    recurring_deviations: List[Dict[str, Any]] = Field(default_factory=list)
    learning_signals_summary: Dict[str, Any] = Field(default_factory=dict)
    decision_inventory: List[Dict[str, Any]] = Field(default_factory=list)
