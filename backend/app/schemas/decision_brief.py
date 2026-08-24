from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ClaimEvidenceRef(BaseModel):
    """Specific evidence reference type and ID for an AI claim."""
    type: str = Field(..., description="Evidence type: RECOMMENDATION, OPTIMIZATION, SCENARIO, ML_ANALYSIS, INSIGHT, GUARDRAIL")
    id: str = Field(..., description="Evidence node or record ID")


class ClaimEvidenceItem(BaseModel):
    """Mapping of individual generated claims to underlying structured evidence."""
    claim: str = Field(..., description="Generated executive text claim")
    evidence_refs: List[ClaimEvidenceRef] = Field(default_factory=list, description="List of evidence references")


class DecisionBriefSection(BaseModel):
    """Individual section in an AI Decision Brief."""
    section_id: str = Field(..., description="Section identifier (e.g. EXECUTIVE_SUMMARY, STRATEGIC_CONTEXT, MODEL_PROJECTIONS, RISK_AUDIT)")
    title: str = Field(..., description="Human-readable section header")
    content: str = Field(..., description="Main text paragraph content")
    bullet_points: List[str] = Field(default_factory=list, description="Supporting key takeaways or bullets")


class DecisionBriefRequest(BaseModel):
    """Request payload for generating an AI Decision Brief."""
    recommendation_id: Optional[str] = Field(None, description="Optional specific recommendation ID to explain")
    provider_override: Optional[str] = Field(None, description="Optional LLM provider name override")


class DecisionBriefResponse(BaseModel):
    """Unified response schema for an AI Decision Brief."""
    id: str = Field(..., description="Unique decision brief ID")
    dataset_id: str = Field(..., description="Target dataset ID")
    recommendation_id: str = Field(..., description="Target recommendation ID being explained")
    provider_name: str = Field(..., description="LLM Provider name used")
    model_name: str = Field(..., description="Model version or rule template name")
    generation_mode: str = Field(..., description="Generation mode: 'ai' or 'deterministic_fallback'")
    validation_status: str = Field(..., description="Validation status: 'validated' or 'fallback'")
    fallback_reason: Optional[str] = Field(None, description="Reason if deterministic fallback was triggered")

    executive_summary: str = Field(..., description="High-level non-causal executive summary")
    sections: List[DecisionBriefSection] = Field(default_factory=list, description="Structured narrative sections list")
    key_findings: List[str] = Field(default_factory=list, description="Key executive takeaway findings")
    risk_breakdown: Dict[str, Any] = Field(default_factory=dict, description="Risk profile & guardrail audit breakdown")
    claim_evidence_map: List[ClaimEvidenceItem] = Field(default_factory=list, description="Claim-level evidence provenance list")
    created_at: datetime = Field(..., description="Creation timestamp")
