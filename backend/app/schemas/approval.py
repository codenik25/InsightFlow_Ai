from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ApprovalRequestPayload(BaseModel):
    """Payload to create or request human approval for a decision recommendation."""
    recommendation_id: str = Field(..., description="Target recommendation ID")
    actor_type: str = Field("USER", description="Actor type: USER, SYSTEM, API")
    actor_id: Optional[str] = Field(None, description="Actor ID requesting approval")
    reason: Optional[str] = Field(None, description="Context or reasoning for approval request")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadata dictionary")


class ApprovalDecisionPayload(BaseModel):
    """Payload when approving or rejecting a decision."""
    actor_type: str = Field("USER", description="Actor type performing decision")
    actor_id: Optional[str] = Field(None, description="Actor ID approving or rejecting")
    reason: Optional[str] = Field(None, description="Reason for approval or rejection")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadata dictionary")


class ApprovalResponse(BaseModel):
    """Response representation for Human Approval status."""
    id: str = Field(..., description="Approval record ID")
    dataset_id: str = Field(..., description="Dataset ID")
    decision_id: Optional[str] = Field(None, description="Decision ID")
    recommendation_id: str = Field(..., description="Recommendation ID")
    status: str = Field(..., description="Approval status: WAITING_FOR_APPROVAL, APPROVED, REJECTED, BLOCKED")
    requested_at: datetime = Field(..., description="Request timestamp")
    decided_at: Optional[datetime] = Field(None, description="Decision timestamp")
    actor_type: str = Field(..., description="Actor type")
    actor_id: Optional[str] = Field(None, description="Actor ID")
    reason: Optional[str] = Field(None, description="Reason text")
    approval_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Approval metadata")


class ActionGateCheckResponse(BaseModel):
    """Response returned by the deterministic Action Gate evaluation."""
    decision_id: str = Field(..., description="Decision ID")
    recommendation_id: str = Field(..., description="Recommendation ID")
    allowed: bool = Field(..., description="True if action is allowed to proceed, False if blocked")
    decision_state: str = Field(..., description="Current decision state machine status")
    reason_code: str = Field(..., description="Machine-readable reason code")
    message: str = Field(..., description="Human-readable decision message")
    checks_passed: List[str] = Field(default_factory=list, description="Passed prerequisite checks")
    checks_failed: List[str] = Field(default_factory=list, description="Failed prerequisite checks")


class ActionExecuteRequest(BaseModel):
    """Payload for executing a decision action through the Action Gate."""
    actor_type: str = Field("USER", description="Actor type attempting execution")
    actor_id: Optional[str] = Field(None, description="Actor ID attempting execution")
    simulation_mode: bool = Field(True, description="Always True for simulated internal execution")
    execution_parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional parameters")


class ActionExecuteResponse(BaseModel):
    """Response returned upon action execution attempt."""
    action_log_id: str = Field(..., description="Action log record ID")
    dataset_id: str = Field(..., description="Dataset ID")
    decision_id: Optional[str] = Field(None, description="Decision ID")
    recommendation_id: str = Field(..., description="Recommendation ID")
    action_state: str = Field(..., description="Action state: EXECUTED, BLOCKED, FAILED")
    is_simulated: bool = Field(..., description="Indicates whether execution was simulated")
    reason_code: str = Field(..., description="Machine-readable outcome code")
    message: str = Field(..., description="Human-readable outcome message")
    execution_details: Dict[str, Any] = Field(default_factory=dict, description="Execution parameters and results")
    executed_at: Optional[datetime] = Field(None, description="Execution timestamp")
