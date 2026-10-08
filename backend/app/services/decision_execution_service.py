import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.project import Project
from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_action import DecisionActionLog
from app.models.decision_governance import DecisionGovernanceEvent
from app.models.decision_execution import DecisionExecution, DecisionExecutionEvent
from app.models.evidence_edge import EvidenceEdge
from app.schemas.decision_execution import (
    DecisionExecutionResponse,
    DecisionExecutionHistoryResponse,
    ExecutionReadinessCheck,
    ExecutionEventResponse,
    ExecutionRequestPayload,
    ExecutionConfirmPayload,
    ExecutionFailPayload,
    ExecutionNotExecutedPayload,
    ExecutionStatus,
)
from app.services.action_gate_service import ActionGateService
from app.services.evidence_service import EvidenceService
from app.services.outcome_service import DecisionOutcomeService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionExecutionService:
    """
    Deterministic Control Plane & Execution Lifecycle Engine (Phase 10).
    Enforces auditable, human-in-the-loop controlled execution of approved decisions,
    idempotent confirmation, append-only history, and closed-loop outcome monitoring.
    """

    @classmethod
    def resolve_decision_context(
        cls,
        db: Session,
        decision_id: str,
        expected_project_id: Optional[str] = None,
    ) -> Tuple[Optional[DecisionApproval], Any, Dataset, Project]:
        """
        Resolve decision entities (Approval, Recommendation, Dataset, Project) with
        strict decision isolation and project isolation validation.
        """
        if not decision_id or not decision_id.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision ID cannot be empty or null.",
            )

        # 1. Try finding Approval directly
        approval = db.scalars(
            select(DecisionApproval).where(
                or_(
                    DecisionApproval.decision_id == decision_id,
                    DecisionApproval.recommendation_id == decision_id,
                    DecisionApproval.id == decision_id,
                )
            )
        ).first()

        recommendation = None
        dataset = None
        project = None

        if approval:
            dataset = db.scalars(select(Dataset).where(Dataset.id == approval.dataset_id)).first()
            if approval.recommendation_id:
                recommendation = db.scalars(
                    select(DecisionRecommendation).where(
                        DecisionRecommendation.id == approval.recommendation_id,
                        DecisionRecommendation.dataset_id == approval.dataset_id,
                    )
                ).first()
                if not recommendation:
                    recommendation = db.scalars(
                        select(DecisionRecommendationEvaluation).where(
                            DecisionRecommendationEvaluation.id == approval.recommendation_id,
                            DecisionRecommendationEvaluation.dataset_id == approval.dataset_id,
                        )
                    ).first()
        else:
            # Look up Recommendation directly
            recommendation = db.scalars(
                select(DecisionRecommendation).where(DecisionRecommendation.id == decision_id)
            ).first()
            if not recommendation:
                recommendation = db.scalars(
                    select(DecisionRecommendationEvaluation).where(
                        DecisionRecommendationEvaluation.id == decision_id
                    )
                ).first()

            if recommendation:
                dataset = db.scalars(select(Dataset).where(Dataset.id == recommendation.dataset_id)).first()
                approval = db.scalars(
                    select(DecisionApproval).where(
                        DecisionApproval.dataset_id == recommendation.dataset_id,
                        DecisionApproval.recommendation_id == recommendation.id,
                    )
                ).first()

        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision or associated dataset for '{decision_id}' not found.",
            )

        project = db.scalars(select(Project).where(Project.id == dataset.project_id)).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project for dataset '{dataset.id}' not found.",
            )

        # Strict Multi-Tenant Project Isolation Check
        if expected_project_id and project.id != expected_project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{decision_id}' does not belong to project '{expected_project_id}'.",
            )

        return approval, recommendation, dataset, project

    @classmethod
    def evaluate_execution_readiness(
        cls,
        db: Session,
        decision_id: str,
        approval: Optional[DecisionApproval],
        recommendation: Any,
        dataset: Dataset,
        project: Project,
        execution: Optional[DecisionExecution] = None,
    ) -> List[ExecutionReadinessCheck]:
        """
        Evaluate 5 factual execution readiness checks without arbitrary scoring.
        """
        checks: List[ExecutionReadinessCheck] = []

        # 1. Governance Approval Status Check
        gov_status = approval.status if approval else "DRAFT"
        is_approved = (gov_status == "APPROVED")
        checks.append(
            ExecutionReadinessCheck(
                check_key="GOVERNANCE_APPROVED",
                name="Governance Approval",
                passed=is_approved,
                details=f"Decision governance status is '{gov_status}' (APPROVED required to authorize execution).",
                is_blocking=True,
            )
        )

        # 2. Action Gate Cleared Check
        rec_id = getattr(recommendation, "id", None) or (approval.recommendation_id if approval else decision_id)
        try:
            gate_res = ActionGateService.check_action_gate(
                db=db,
                dataset_id=dataset.id,
                decision_id=rec_id or decision_id,
            )
            # If already executed according to gate, but this execution is in progress/complete, treat as cleared
            gate_cleared = bool(gate_res.allowed) or bool(execution and execution.status in ("EXECUTED", "OUTCOME_MONITORING"))
            gate_details = gate_res.message if not gate_cleared else "Action Gate verification passed. All guardrails and safety criteria satisfied."
        except Exception as e:
            gate_cleared = False
            gate_details = f"Action Gate verification failed: {str(e)}"

        checks.append(
            ExecutionReadinessCheck(
                check_key="ACTION_GATE_CLEARED",
                name="Action Gate & Safety Guardrails",
                passed=gate_cleared,
                details=gate_details,
                is_blocking=True,
            )
        )

        # 3. Evidence Attached Check
        evidence_count = db.scalars(
            select(EvidenceEdge).where(
                EvidenceEdge.project_id == project.id,
                or_(
                    EvidenceEdge.source_id == decision_id,
                    EvidenceEdge.target_id == decision_id,
                    EvidenceEdge.source_id == rec_id if rec_id else False,
                    EvidenceEdge.target_id == rec_id if rec_id else False,
                )
            )
        ).all()
        has_evidence = len(evidence_count) > 0
        checks.append(
            ExecutionReadinessCheck(
                check_key="EVIDENCE_ATTACHED",
                name="Traceable Evidence Chain",
                passed=has_evidence,
                details=f"{len(evidence_count)} evidence graph edges attached to this decision in the project." if has_evidence else "No supporting evidence chain links found in Evidence Graph.",
                is_blocking=True,
            )
        )

        # 4. Blocking Governance Conditions Check
        conditions = getattr(approval, "conditions", None) or {} if approval else {}
        has_blocking = False
        blocking_msg = "No blocking governance conditions."
        if isinstance(conditions, dict) and conditions.get("blocking"):
            has_blocking = True
            blocking_msg = f"Blocking conditions active: {conditions['blocking']}"
        elif isinstance(conditions, list):
            blocking_items = [c for c in conditions if isinstance(c, dict) and c.get("is_blocking")]
            if blocking_items:
                has_blocking = True
                blocking_msg = f"{len(blocking_items)} unresolved blocking condition(s) assigned during review."

        checks.append(
            ExecutionReadinessCheck(
                check_key="NO_BLOCKING_CONDITIONS",
                name="Unresolved Governance Conditions",
                passed=not has_blocking,
                details=blocking_msg,
                is_blocking=True,
            )
        )

        # 5. Operator Identity Present Check
        operator_present = bool(
            (execution and (execution.confirmed_by or execution.requested_by)) or
            (approval and approval.actor_id)
        )
        checks.append(
            ExecutionReadinessCheck(
                check_key="OPERATOR_ASSIGNED",
                name="Human Operator Attribution",
                passed=operator_present,
                details=f"Human operator identified: {execution.confirmed_by or execution.requested_by if execution else approval.actor_id}" if operator_present else "Human operator confirmation required before execution.",
                is_blocking=True,
            )
        )

        return checks

    @classmethod
    def get_or_init_execution(
        cls,
        db: Session,
        decision_id: str,
        project_id: Optional[str] = None,
    ) -> DecisionExecutionResponse:
        """
        Retrieve current execution record or compute readiness and factual NOT_READY/READY state.
        """
        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        # Look up existing execution record
        execution = db.scalars(
            select(DecisionExecution).where(
                DecisionExecution.decision_id == decision_id,
                DecisionExecution.project_id == project.id,
            )
        ).first()

        readiness_checks = cls.evaluate_execution_readiness(
            db=db,
            decision_id=decision_id,
            approval=approval,
            recommendation=rec,
            dataset=dataset,
            project=project,
            execution=execution,
        )

        all_blocking_passed = all(c.passed for c in readiness_checks if c.is_blocking)
        gov_status = approval.status if approval else "DRAFT"
        is_approved = (gov_status == "APPROVED")

        # Determine current status
        if execution:
            current_status = execution.status
        else:
            current_status = ExecutionStatus.READY.value if (is_approved and all_blocking_passed) else ExecutionStatus.NOT_READY.value

        # Calculate valid next actions
        can_request = (current_status == ExecutionStatus.READY.value and is_approved)
        can_confirm = (current_status in (ExecutionStatus.READY.value, ExecutionStatus.PENDING_CONFIRMATION.value) and is_approved)
        can_fail = (current_status in (ExecutionStatus.READY.value, ExecutionStatus.PENDING_CONFIRMATION.value, ExecutionStatus.CONFIRMED.value, ExecutionStatus.EXECUTING.value))
        can_not_exec = (current_status in (ExecutionStatus.READY.value, ExecutionStatus.PENDING_CONFIRMATION.value))

        valid_actions: List[str] = []
        if can_request:
            valid_actions.append("REQUEST_EXECUTION")
        if can_confirm:
            valid_actions.append("CONFIRM_EXECUTION")
        if can_fail:
            valid_actions.append("MARK_FAILED")
        if can_not_exec:
            valid_actions.append("MARK_NOT_EXECUTED")
        if current_status == ExecutionStatus.EXECUTED.value:
            valid_actions.append("MONITOR_OUTCOMES")
            valid_actions.append("CLOSE")

        # Closed-loop Outcome Linkage (Phase 6)
        outcome_link = None
        try:
            outcomes_data = DecisionOutcomeService.get_decision_outcomes(
                db=db,
                decision_id=decision_id,
                project_id=project.id,
            )
            latest = outcomes_data.latest_outcome or outcomes_data.primary_outcome
            outcome_link = {
                "total_outcomes": outcomes_data.total_outcomes,
                "current_status": outcomes_data.current_status,
                "expected_metric": outcomes_data.expected_metric,
                "expected_value": outcomes_data.expected_value,
                "actual_metric": latest.actual_metric if latest else None,
                "actual_value": latest.actual_value if latest else None,
                "absolute_delta": latest.absolute_delta if latest else None,
                "relative_delta": latest.relative_delta if latest else None,
                "learning_signal": outcomes_data.learning_signal,
            }
        except Exception:
            pass

        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else None)

        return DecisionExecutionResponse(
            execution_id=execution.id if execution else None,
            decision_id=decision_id,
            project_id=project.id,
            dataset_id=dataset.id,
            recommendation_id=rec_id,
            status=current_status,
            governance_status=gov_status,
            is_approved=is_approved,
            approved_by=approval.actor_id if approval else None,
            requested_by=execution.requested_by if execution else None,
            confirmed_by=execution.confirmed_by if execution else None,
            executed_by=execution.executed_by if execution else None,
            requested_at=execution.requested_at if execution else None,
            confirmed_at=execution.confirmed_at if execution else None,
            completed_at=execution.completed_at if execution else None,
            execution_reference=execution.execution_reference if execution else None,
            execution_result=execution.execution_result if execution else None,
            failure_reason=execution.failure_reason if execution else None,
            readiness_checks=readiness_checks,
            can_request_execution=can_request,
            can_confirm_execution=can_confirm,
            can_mark_failed=can_fail,
            can_mark_not_executed=can_not_exec,
            valid_next_actions=valid_actions,
            outcome_link=outcome_link,
            created_at=execution.created_at if execution else None,
            updated_at=execution.updated_at if execution else None,
        )

    @classmethod
    def request_execution(
        cls,
        db: Session,
        decision_id: str,
        payload: ExecutionRequestPayload,
        project_id: Optional[str] = None,
    ) -> DecisionExecutionResponse:
        """
        Request execution for an approved decision, transitioning state to PENDING_CONFIRMATION.
        """
        if not payload.requested_by or not payload.requested_by.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operator identity 'requested_by' is required to request execution.",
            )
        if not payload.rationale or not payload.rationale.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Execution rationale is required.",
            )

        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        gov_status = approval.status if approval else "DRAFT"
        if gov_status != "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot request execution for unapproved decision (current governance status: '{gov_status}'). Decision must be APPROVED.",
            )

        now = utc_now()
        execution = db.scalars(
            select(DecisionExecution).where(
                DecisionExecution.decision_id == decision_id,
                DecisionExecution.project_id == project.id,
            )
        ).first()

        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else None)

        if not execution:
            execution = DecisionExecution(
                project_id=project.id,
                dataset_id=dataset.id,
                decision_id=decision_id,
                recommendation_id=rec_id,
                approval_id=approval.id if approval else None,
                status=ExecutionStatus.PENDING_CONFIRMATION.value,
                requested_by=payload.requested_by.strip(),
                requested_at=now,
                execution_metadata={"parameters": payload.execution_parameters or {}},
            )
            db.add(execution)
            db.flush()
        else:
            if execution.status in (ExecutionStatus.EXECUTED.value, ExecutionStatus.OUTCOME_MONITORING.value, ExecutionStatus.CLOSED.value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot request execution from current state '{execution.status}'.",
                )
            execution.status = ExecutionStatus.PENDING_CONFIRMATION.value
            execution.requested_by = payload.requested_by.strip()
            execution.requested_at = now
            if payload.execution_parameters:
                meta = execution.execution_metadata or {}
                meta["parameters"] = payload.execution_parameters
                execution.execution_metadata = meta

        # Append-Only Event
        event = DecisionExecutionEvent(
            execution_id=execution.id,
            decision_id=decision_id,
            project_id=project.id,
            event_type="EXECUTION_REQUESTED",
            from_status=ExecutionStatus.READY.value,
            to_status=ExecutionStatus.PENDING_CONFIRMATION.value,
            actor=payload.requested_by.strip(),
            rationale=payload.rationale.strip(),
            event_metadata={"parameters": payload.execution_parameters or {}},
        )
        db.add(event)
        db.commit()
        db.refresh(execution)

        return cls.get_or_init_execution(db, decision_id, project_id=project.id)

    @classmethod
    def confirm_execution(
        cls,
        db: Session,
        decision_id: str,
        payload: ExecutionConfirmPayload,
        project_id: Optional[str] = None,
    ) -> DecisionExecutionResponse:
        """
        Explicit human confirmation of execution. Idempotent.
        Transitions state to EXECUTED, writes append-only event, and links Evidence Graph.
        """
        if not payload.confirmed_by or not payload.confirmed_by.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operator identity 'confirmed_by' is required for execution confirmation.",
            )
        if not payload.rationale or not payload.rationale.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation rationale is required.",
            )

        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else None)

        # Find existing execution
        execution = db.scalars(
            select(DecisionExecution).where(
                DecisionExecution.decision_id == decision_id,
                DecisionExecution.project_id == project.id,
            )
        ).first()

        # Idempotency Check: if already EXECUTED or OUTCOME_MONITORING, return existing state safely
        if execution and execution.status in (ExecutionStatus.EXECUTED.value, ExecutionStatus.OUTCOME_MONITORING.value):
            return cls.get_or_init_execution(db, decision_id, project_id=project.id)

        gov_status = approval.status if approval else "DRAFT"
        if gov_status != "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot confirm execution for unapproved decision (current governance status: '{gov_status}'). Decision must be APPROVED.",
            )

        now = utc_now()
        from_status = execution.status if execution else ExecutionStatus.READY.value

        if not execution:
            execution = DecisionExecution(
                project_id=project.id,
                dataset_id=dataset.id,
                decision_id=decision_id,
                recommendation_id=rec_id,
                approval_id=approval.id if approval else None,
                status=ExecutionStatus.EXECUTED.value,
                requested_by=payload.confirmed_by.strip(),
                confirmed_by=payload.confirmed_by.strip(),
                executed_by=payload.confirmed_by.strip(),
                requested_at=now,
                confirmed_at=now,
                started_at=now,
                completed_at=now,
                execution_reference=payload.execution_reference,
                execution_result={
                    "status": "EXECUTED",
                    "confirmation_notes": payload.rationale.strip(),
                    "is_simulated": True,
                    "message": "Decision execution confirmed by operator.",
                },
                execution_metadata=payload.metadata or {},
            )
            db.add(execution)
            db.flush()
        else:
            if execution.status in (ExecutionStatus.EXECUTION_FAILED.value, ExecutionStatus.NOT_EXECUTED.value, ExecutionStatus.CLOSED.value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot confirm execution from state '{execution.status}'.",
                )
            execution.status = ExecutionStatus.EXECUTED.value
            execution.confirmed_by = payload.confirmed_by.strip()
            execution.executed_by = payload.confirmed_by.strip()
            execution.confirmed_at = now
            execution.started_at = execution.started_at or now
            execution.completed_at = now
            if payload.execution_reference:
                execution.execution_reference = payload.execution_reference
            execution.execution_result = {
                "status": "EXECUTED",
                "confirmation_notes": payload.rationale.strip(),
                "is_simulated": True,
                "message": "Decision execution confirmed by operator.",
            }
            if payload.metadata:
                meta = execution.execution_metadata or {}
                meta.update(payload.metadata)
                execution.execution_metadata = meta

        # Append-Only Events: CONFIRMED and COMPLETED
        event_confirmed = DecisionExecutionEvent(
            execution_id=execution.id,
            decision_id=decision_id,
            project_id=project.id,
            event_type="EXECUTION_CONFIRMED",
            from_status=from_status,
            to_status=ExecutionStatus.CONFIRMED.value,
            actor=payload.confirmed_by.strip(),
            rationale=payload.rationale.strip(),
            event_metadata=payload.metadata or {},
        )
        event_completed = DecisionExecutionEvent(
            execution_id=execution.id,
            decision_id=decision_id,
            project_id=project.id,
            event_type="EXECUTION_COMPLETED",
            from_status=ExecutionStatus.CONFIRMED.value,
            to_status=ExecutionStatus.EXECUTED.value,
            actor=payload.confirmed_by.strip(),
            rationale="Execution record successfully recorded and confirmed.",
            event_metadata=payload.metadata or {},
        )
        db.add(event_confirmed)
        db.add(event_completed)

        # Action Gate log recording (preserves Action Gate Rule 7 check)
        try:
            existing_act = db.scalars(
                select(DecisionActionLog).where(
                    DecisionActionLog.dataset_id == dataset.id,
                    DecisionActionLog.recommendation_id == (rec_id or decision_id),
                    DecisionActionLog.action_state == "EXECUTED",
                )
            ).first()
            if not existing_act:
                act_log = DecisionActionLog(
                    dataset_id=dataset.id,
                    decision_id=decision_id,
                    recommendation_id=rec_id or decision_id,
                    approval_id=approval.id if approval else None,
                    action_state="EXECUTED",
                    is_simulated=True,
                    reason_code="EXECUTION_SUCCESSFUL",
                    message="Decision execution confirmed and recorded via Phase 10 Control Plane.",
                    execution_details={
                        "execution_id": execution.id,
                        "operator": payload.confirmed_by.strip(),
                        "simulation_notes": "Internal state transitioned to EXECUTED. Controlled record confirmed.",
                    },
                    executed_at=now,
                )
                db.add(act_log)
        except Exception:
            pass

        # Link to Evidence Graph (Phase 5)
        try:
            edges_to_record = [
                {
                    "project_id": project.id,
                    "source_type": "DECISION",
                    "source_id": decision_id,
                    "target_type": "EXECUTION",
                    "target_id": execution.id,
                    "relationship_type": "EXECUTED_AS",
                    "metadata": {
                        "status": "EXECUTED",
                        "operator": payload.confirmed_by.strip(),
                        "timestamp": now.isoformat(),
                    },
                }
            ]
            if approval:
                edges_to_record.append({
                    "project_id": project.id,
                    "source_type": "GOVERNANCE_REVIEW",
                    "source_id": approval.id,
                    "target_type": "EXECUTION",
                    "target_id": execution.id,
                    "relationship_type": "EXECUTED_AS",
                    "metadata": {
                        "status": "EXECUTED",
                        "operator": payload.confirmed_by.strip(),
                        "timestamp": now.isoformat(),
                    },
                })
            EvidenceService.record_edges_batch(db=db, edges_data=edges_to_record)
        except Exception:
            pass

        db.commit()
        db.refresh(execution)

        return cls.get_or_init_execution(db, decision_id, project_id=project.id)

    @classmethod
    def mark_failed(
        cls,
        db: Session,
        decision_id: str,
        payload: ExecutionFailPayload,
        project_id: Optional[str] = None,
    ) -> DecisionExecutionResponse:
        """
        Record execution failure. No autonomous retry or model retraining.
        """
        if not payload.failed_by or not payload.failed_by.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operator identity 'failed_by' is required to report failure.",
            )
        if not payload.failure_reason or not payload.failure_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failure reason is required.",
            )

        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        now = utc_now()
        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else None)

        execution = db.scalars(
            select(DecisionExecution).where(
                DecisionExecution.decision_id == decision_id,
                DecisionExecution.project_id == project.id,
            )
        ).first()

        from_status = execution.status if execution else ExecutionStatus.READY.value

        if not execution:
            execution = DecisionExecution(
                project_id=project.id,
                dataset_id=dataset.id,
                decision_id=decision_id,
                recommendation_id=rec_id,
                approval_id=approval.id if approval else None,
                status=ExecutionStatus.EXECUTION_FAILED.value,
                requested_by=payload.failed_by.strip(),
                executed_by=payload.failed_by.strip(),
                failure_reason=payload.failure_reason.strip(),
                execution_metadata=payload.metadata or {},
            )
            db.add(execution)
            db.flush()
        else:
            if execution.status in (ExecutionStatus.EXECUTED.value, ExecutionStatus.CLOSED.value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark execution failed from state '{execution.status}'.",
                )
            execution.status = ExecutionStatus.EXECUTION_FAILED.value
            execution.failure_reason = payload.failure_reason.strip()
            if payload.metadata:
                meta = execution.execution_metadata or {}
                meta.update(payload.metadata)
                execution.execution_metadata = meta

        # Append-Only Event
        event = DecisionExecutionEvent(
            execution_id=execution.id,
            decision_id=decision_id,
            project_id=project.id,
            event_type="EXECUTION_FAILED",
            from_status=from_status,
            to_status=ExecutionStatus.EXECUTION_FAILED.value,
            actor=payload.failed_by.strip(),
            rationale=payload.failure_reason.strip(),
            event_metadata=payload.metadata or {},
        )
        db.add(event)
        db.commit()
        db.refresh(execution)

        return cls.get_or_init_execution(db, decision_id, project_id=project.id)

    @classmethod
    def mark_not_executed(
        cls,
        db: Session,
        decision_id: str,
        payload: ExecutionNotExecutedPayload,
        project_id: Optional[str] = None,
    ) -> DecisionExecutionResponse:
        """
        Record decision explicitly not executed (e.g. window expired, declined).
        """
        if not payload.actor or not payload.actor.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Actor identity is required.",
            )
        if not payload.reason or not payload.reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reason for not executing is required.",
            )

        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        now = utc_now()
        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else None)

        execution = db.scalars(
            select(DecisionExecution).where(
                DecisionExecution.decision_id == decision_id,
                DecisionExecution.project_id == project.id,
            )
        ).first()

        from_status = execution.status if execution else ExecutionStatus.READY.value

        if not execution:
            execution = DecisionExecution(
                project_id=project.id,
                dataset_id=dataset.id,
                decision_id=decision_id,
                recommendation_id=rec_id,
                approval_id=approval.id if approval else None,
                status=ExecutionStatus.NOT_EXECUTED.value,
                requested_by=payload.actor.strip(),
                failure_reason=payload.reason.strip(),
                execution_metadata=payload.metadata or {},
            )
            db.add(execution)
            db.flush()
        else:
            if execution.status in (ExecutionStatus.EXECUTED.value, ExecutionStatus.CLOSED.value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark decision as NOT_EXECUTED from current state '{execution.status}'.",
                )
            execution.status = ExecutionStatus.NOT_EXECUTED.value
            execution.failure_reason = payload.reason.strip()
            if payload.metadata:
                meta = execution.execution_metadata or {}
                meta.update(payload.metadata)
                execution.execution_metadata = meta

        # Append-Only Event
        event = DecisionExecutionEvent(
            execution_id=execution.id,
            decision_id=decision_id,
            project_id=project.id,
            event_type="EXECUTION_NOT_EXECUTED",
            from_status=from_status,
            to_status=ExecutionStatus.NOT_EXECUTED.value,
            actor=payload.actor.strip(),
            rationale=payload.reason.strip(),
            event_metadata=payload.metadata or {},
        )
        db.add(event)
        db.commit()
        db.refresh(execution)

        return cls.get_or_init_execution(db, decision_id, project_id=project.id)

    @classmethod
    def get_execution_history(
        cls,
        db: Session,
        decision_id: str,
        project_id: Optional[str] = None,
    ) -> DecisionExecutionHistoryResponse:
        """
        Retrieve append-only chronological history of execution events.
        """
        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        execution = db.scalars(
            select(DecisionExecution).where(
                DecisionExecution.decision_id == decision_id,
                DecisionExecution.project_id == project.id,
            )
        ).first()

        events = db.scalars(
            select(DecisionExecutionEvent).where(
                DecisionExecutionEvent.decision_id == decision_id,
                DecisionExecutionEvent.project_id == project.id,
            ).order_by(DecisionExecutionEvent.created_at.asc())
        ).all()

        history_items = [
            ExecutionEventResponse(
                id=e.id,
                execution_id=e.execution_id,
                decision_id=e.decision_id,
                project_id=e.project_id,
                event_type=e.event_type,
                from_status=e.from_status,
                to_status=e.to_status,
                actor=e.actor,
                rationale=e.rationale,
                metadata=e.event_metadata or {},
                created_at=e.created_at,
            )
            for e in events
        ]

        return DecisionExecutionHistoryResponse(
            execution_id=execution.id if execution else None,
            decision_id=decision_id,
            project_id=project.id,
            total_events=len(history_items),
            events=history_items,
        )
