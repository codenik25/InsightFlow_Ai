from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class EvidenceNode(BaseModel):
    """Normalized evidence graph node representing a traceable entity in InsightFlow."""
    id: str = Field(..., description="Unique entity ID (or composite version identifier)")
    type: str = Field(..., description="Entity type: DATASET_VERSION, ANALYSIS_RUN, INSIGHT, PREDICTION, OPTIMIZATION, RECOMMENDATION, DECISION, GUARDRAIL")
    label: str = Field(..., description="Human-readable title or label")
    status: Optional[str] = Field(None, description="Status/outcome if applicable (e.g. COMPLETED, FEASIBLE, APPROVED)")
    dataset_version: Optional[int] = Field(None, description="Dataset version if applicable")
    run_id: Optional[str] = Field(None, description="AnalysisRun ID if applicable")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary entity metadata")


class EvidenceEdgeSchema(BaseModel):
    """Normalized evidence graph edge connecting two verified analytical entities."""
    id: Optional[str] = Field(None, description="Unique edge ID")
    source: str = Field(..., description="Source node ID")
    source_type: str = Field(..., description="Source node type")
    target: str = Field(..., description="Target node ID")
    target_type: str = Field(..., description="Target node type")
    relationship_type: str = Field(..., description="Relationship type: DERIVED_FROM, PRODUCED, BASED_ON, SUPPORTED, GENERATED_FROM, OPTIMIZED_FROM, EVALUATED_BY, RESULTED_IN, REVIEWED_BY")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Relationship metadata")


class EvidenceGraphResponse(BaseModel):
    """Structured graph response for project, dataset, or node queries."""
    project_id: str
    dataset_id: Optional[str] = None
    root_node_id: Optional[str] = None
    root: Optional[EvidenceNode] = None
    nodes: List[EvidenceNode] = Field(default_factory=list)
    edges: List[EvidenceEdgeSchema] = Field(default_factory=list)
    counters: Optional[Dict[str, int]] = Field(default_factory=dict)


class EvidenceChainResponse(BaseModel):
    """Multi-hop backward provenance chain for a decision or recommendation."""
    decision_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    project_id: str
    dataset_lineage: Optional[str] = None
    nodes: List[EvidenceNode] = Field(default_factory=list)
    edges: List[EvidenceEdgeSchema] = Field(default_factory=list)
    summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
