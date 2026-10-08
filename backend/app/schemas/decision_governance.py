from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class GovernanceReadinessCheck(BaseModel):
    """Factual readiness check item evaluated against actual persisted entities."""
    check_id: str = Field(..., description="EVIDENCE_AVAILABLE | OUTCOME_AVAILABLE | PERFORMANCE_AVAILABLE | LEARNING_SIGNALS_REVIEWED | GUARDRAILS_AVAILABLE | REVIEWER_ASSIGNED")
    name: str
    status: str = Field(..., description="READY | INCOMPLETE | NOT_APPLICABLE")
    details: str


class GovernanceEscalationAssessment(BaseModel):
    """Deterministic, factual escalation indicator (never based on subjective AI scores)."""
    escalation_recommended: bool
    reasons: List[str] = Field(default_factory=list)


class GovernanceIssue(BaseModel):
    """Active governance condition or issue linking back to underlying evidence."""
    severity: str = Field(..., description="HIGH | WARNING | INFO")
    issue_type: str
    description: str
    entity_ref: Optional[Dict[str, Any]] = None


class GovernanceEventResponse(BaseModel):
    """Append-only audit record of an individual governance state transition."""
    id: str
    decision_id: str
    from_status: str
    to_status: str
    action: str
    actor: str
    review_notes: Optional[str] = None
    created_at: datetime
    evidence_snapshot: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class DecisionGovernanceResponse(BaseModel):
    """Complete Decision Governance & Control Plane view for an executive decision."""
    decision_id: str
    project_id: str
    dataset_id: str
    status: str = Field(
        ...,
        description="DRAFT | UNDER_REVIEW | PENDING_APPROVAL | APPROVED | REJECTED | ESCALATED | ON_HOLD | EXECUTED | CLOSED",
    )
    reviewer: Optional[str] = None
    review_notes: Optional[str] = None
    last_updated: Optional[datetime] = None
    created_at: Optional[datetime] = None

    allowed_actions: List[str] = Field(default_factory=list)
    readiness_checks: List[GovernanceReadinessCheck] = Field(default_factory=list)
    escalation: GovernanceEscalationAssessment
    active_issues: List[GovernanceIssue] = Field(default_factory=list)
    evidence_summary: Dict[str, Any] = Field(default_factory=dict)
    history: List[GovernanceEventResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class GovernanceTransitionRequest(BaseModel):
    """Payload for human governance lifecycle actions (strict human-in-the-loop)."""
    action: Optional[str] = Field(None, description="START_REVIEW | SUBMIT_FOR_APPROVAL | APPROVE | REJECT | ESCALATE | PUT_ON_HOLD | RETURN_TO_REVIEW | EXECUTE | CLOSE")
    target_status: Optional[str] = Field(None, description="Explicit target status if action not specified")
    reviewer: str = Field(..., description="Explicit human reviewer identifier (name, email, or role)")
    review_notes: Optional[str] = Field(None, description="Human review rationale or notes (required for APPROVE, REJECT, ESCALATE, ON_HOLD)")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
