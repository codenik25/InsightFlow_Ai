from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    NOT_READY = "NOT_READY"
    READY = "READY"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    EXECUTING = "EXECUTING"
    EXECUTED = "EXECUTED"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    NOT_EXECUTED = "NOT_EXECUTED"
    OUTCOME_MONITORING = "OUTCOME_MONITORING"
    CLOSED = "CLOSED"


class ExecutionReadinessCheck(BaseModel):
    check_key: str = Field(..., description="Unique key for check")
    name: str = Field(..., description="Human-readable check title")
    passed: bool = Field(..., description="Whether check passed")
    details: str = Field(..., description="Factual description of validation details")
    is_blocking: bool = Field(default=True, description="Whether failure blocks execution")


class ExecutionEventResponse(BaseModel):
    id: str
    execution_id: str
    decision_id: str
    project_id: str
    event_type: str
    from_status: str
    to_status: str
    actor: str
    rationale: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ExecutionRequestPayload(BaseModel):
    requested_by: str = Field(..., min_length=1, description="Operator or user requesting execution")
    rationale: str = Field(..., min_length=1, description="Rationale for initiating execution")
    execution_parameters: Optional[Dict[str, Any]] = Field(default=None, description="Optional execution parameters")


class ExecutionConfirmPayload(BaseModel):
    confirmed_by: str = Field(..., min_length=1, description="Operator or reviewer confirming execution")
    rationale: str = Field(..., min_length=1, description="Operational rationale for execution confirmation")
    execution_reference: Optional[str] = Field(default=None, description="Optional external or system tracking reference")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional execution metadata")


class ExecutionFailPayload(BaseModel):
    failed_by: str = Field(..., min_length=1, description="Operator reporting failure")
    failure_reason: str = Field(..., min_length=1, description="Factual reason why execution failed")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional failure metadata")


class ExecutionNotExecutedPayload(BaseModel):
    actor: str = Field(..., min_length=1, description="Operator marking not executed")
    reason: str = Field(..., min_length=1, description="Factual justification (e.g. window expired, declined)")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional metadata")


class DecisionExecutionResponse(BaseModel):
    execution_id: Optional[str] = None
    decision_id: str
    project_id: str
    dataset_id: str
    recommendation_id: Optional[str] = None

    status: str
    governance_status: str
    is_approved: bool

    approved_by: Optional[str] = None
    requested_by: Optional[str] = None
    confirmed_by: Optional[str] = None
    executed_by: Optional[str] = None

    requested_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    execution_reference: Optional[str] = None
    execution_result: Optional[Dict[str, Any]] = None
    failure_reason: Optional[str] = None

    readiness_checks: List[ExecutionReadinessCheck] = Field(default_factory=list)
    can_request_execution: bool = False
    can_confirm_execution: bool = False
    can_mark_failed: bool = False
    can_mark_not_executed: bool = False
    valid_next_actions: List[str] = Field(default_factory=list)

    outcome_link: Optional[Dict[str, Any]] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DecisionExecutionHistoryResponse(BaseModel):
    execution_id: Optional[str] = None
    decision_id: str
    project_id: str
    total_events: int
    events: List[ExecutionEventResponse] = Field(default_factory=list)
