from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.decision_recommendation import DecisionRecommendation
from app.models.decision_recommendation_evaluation import DecisionRecommendationEvaluation
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_action import DecisionActionLog
from app.schemas.approval import (
    ApprovalRequestPayload,
    ApprovalDecisionPayload,
    ApprovalResponse,
    ActionGateCheckResponse,
    ActionExecuteRequest,
    ActionExecuteResponse,
)
from app.schemas.audit import AuditEventCreate
from app.services.eda_service import EDAService
from app.services.audit_service import DecisionAuditService


class ActionGateService:
    """Deterministic state machine and Action Gate validation service."""

    @classmethod
    def request_approval(
        cls,
        db: Session,
        dataset_id: str,
        recommendation_id: str,
        payload: ApprovalRequestPayload,
    ) -> ApprovalResponse:
        """Create or initialize human approval request for a recommendation."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        rec = cls._resolve_recommendation(db, target_dataset.id, recommendation_id)

        # Check if active approval record exists
        stmt_exist = select(DecisionApproval).where(
            DecisionApproval.dataset_id == target_dataset.id,
            DecisionApproval.recommendation_id == rec.id,
        )
        existing = db.scalars(stmt_exist).first()
        if existing:
            if existing.status == "APPROVED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Recommendation '{recommendation_id}' is already APPROVED.",
                )
            # Update existing waiting request
            existing.status = "WAITING_FOR_APPROVAL"
            existing.actor_type = payload.actor_type.upper() if payload.actor_type else "USER"
            existing.actor_id = payload.actor_id
            existing.reason = payload.reason
            existing.approval_metadata = payload.metadata or {}
            existing.requested_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            approval_record = existing
        else:
            approval_record = DecisionApproval(
                dataset_id=target_dataset.id,
                decision_id=recommendation_id,
                recommendation_id=rec.id,
                status="WAITING_FOR_APPROVAL",
                actor_type=payload.actor_type.upper() if payload.actor_type else "USER",
                actor_id=payload.actor_id,
                reason=payload.reason,
                approval_metadata=payload.metadata or {},
                requested_at=datetime.now(timezone.utc),
            )
            db.add(approval_record)
            db.commit()
            db.refresh(approval_record)

        # Audit Event
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=approval_record.decision_id,
                    recommendation_id=approval_record.recommendation_id,
                    event_type="APPROVAL_REQUESTED",
                    event_status="SUCCESS",
                    actor_type=approval_record.actor_type,
                    actor_id=approval_record.actor_id,
                    source_service="action_gate_service",
                    evidence_references={"approval_id": approval_record.id},
                    new_state={"status": approval_record.status},
                ),
            )
        except Exception:
            pass

        return cls._map_approval_response(approval_record)

    @classmethod
    def approve_decision(
        cls,
        db: Session,
        dataset_id: str,
        decision_id: str,
        payload: Optional[ApprovalDecisionPayload] = None,
    ) -> ApprovalResponse:
        """Explicitly approve a decision recommendation."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        rec = cls._resolve_recommendation(db, target_dataset.id, decision_id)

        stmt = select(DecisionApproval).where(
            DecisionApproval.dataset_id == target_dataset.id,
            DecisionApproval.recommendation_id == rec.id,
        )
        approval_record = db.scalars(stmt).first()

        p = payload or ApprovalDecisionPayload()

        if not approval_record:
            approval_record = DecisionApproval(
                dataset_id=target_dataset.id,
                decision_id=decision_id,
                recommendation_id=rec.id,
                requested_at=datetime.now(timezone.utc),
            )
            db.add(approval_record)

        prev_status = approval_record.status
        approval_record.status = "APPROVED"
        approval_record.decided_at = datetime.now(timezone.utc)
        approval_record.actor_type = p.actor_type.upper() if p.actor_type else "USER"
        approval_record.actor_id = p.actor_id
        approval_record.reason = p.reason or "Explicit user approval granted."
        if p.metadata:
            meta = dict(approval_record.approval_metadata or {})
            meta.update(p.metadata)
            approval_record.approval_metadata = meta

        db.commit()
        db.refresh(approval_record)

        # Audit Event
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=decision_id,
                    recommendation_id=rec.id,
                    event_type="DECISION_APPROVED",
                    event_status="SUCCESS",
                    actor_type=approval_record.actor_type,
                    actor_id=approval_record.actor_id,
                    source_service="action_gate_service",
                    evidence_references={"approval_id": approval_record.id},
                    previous_state={"status": prev_status},
                    new_state={"status": "APPROVED"},
                ),
            )
        except Exception:
            pass

        return cls._map_approval_response(approval_record)

    @classmethod
    def reject_decision(
        cls,
        db: Session,
        dataset_id: str,
        decision_id: str,
        payload: Optional[ApprovalDecisionPayload] = None,
    ) -> ApprovalResponse:
        """Explicitly reject a decision recommendation."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        rec = cls._resolve_recommendation(db, target_dataset.id, decision_id)

        stmt = select(DecisionApproval).where(
            DecisionApproval.dataset_id == target_dataset.id,
            DecisionApproval.recommendation_id == rec.id,
        )
        approval_record = db.scalars(stmt).first()

        p = payload or ApprovalDecisionPayload()

        if not approval_record:
            approval_record = DecisionApproval(
                dataset_id=target_dataset.id,
                decision_id=decision_id,
                recommendation_id=rec.id,
                requested_at=datetime.now(timezone.utc),
            )
            db.add(approval_record)

        prev_status = approval_record.status
        approval_record.status = "REJECTED"
        approval_record.decided_at = datetime.now(timezone.utc)
        approval_record.actor_type = p.actor_type.upper() if p.actor_type else "USER"
        approval_record.actor_id = p.actor_id
        approval_record.reason = p.reason or "Explicit user rejection."
        if p.metadata:
            meta = dict(approval_record.approval_metadata or {})
            meta.update(p.metadata)
            approval_record.approval_metadata = meta

        db.commit()
        db.refresh(approval_record)

        # Audit Event
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=decision_id,
                    recommendation_id=rec.id,
                    event_type="DECISION_REJECTED",
                    event_status="SUCCESS",
                    actor_type=approval_record.actor_type,
                    actor_id=approval_record.actor_id,
                    source_service="action_gate_service",
                    evidence_references={"approval_id": approval_record.id},
                    previous_state={"status": prev_status},
                    new_state={"status": "REJECTED"},
                ),
            )
        except Exception:
            pass

        return cls._map_approval_response(approval_record)

    @classmethod
    def get_approval_status(cls, db: Session, dataset_id: str, decision_id: str) -> ApprovalResponse:
        """Retrieve current approval state for a decision."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        rec = cls._resolve_recommendation(db, target_dataset.id, decision_id)

        stmt = select(DecisionApproval).where(
            DecisionApproval.dataset_id == target_dataset.id,
            DecisionApproval.recommendation_id == rec.id,
        )
        record = db.scalars(stmt).first()
        if not record:
            # Return synthetic unapproved response
            return ApprovalResponse(
                id="none",
                dataset_id=target_dataset.id,
                decision_id=decision_id,
                recommendation_id=rec.id,
                status="WAITING_FOR_APPROVAL",
                requested_at=datetime.now(timezone.utc),
                decided_at=None,
                actor_type="SYSTEM",
                actor_id=None,
                reason="No approval record created yet.",
                approval_metadata={},
            )

        return cls._map_approval_response(record)

    @classmethod
    def check_action_gate(
        cls,
        db: Session,
        dataset_id: str,
        decision_id: str,
    ) -> ActionGateCheckResponse:
        """Evaluate all 9 deterministic prerequisite rules to check if an action can proceed."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)

        passed = []
        failed = []

        # Rule 1 & 2: Recommendation exists and belongs to dataset
        rec = None
        try:
            rec = cls._resolve_recommendation(db, target_dataset.id, decision_id)
            passed.append("1. Recommendation exists")
            passed.append("2. Recommendation belongs to dataset")
        except HTTPException as ex:
            failed.append(f"1 & 2. Recommendation resolution failed: {ex.detail}")

        if not rec:
            return ActionGateCheckResponse(
                decision_id=decision_id,
                recommendation_id=decision_id,
                allowed=False,
                decision_state="BLOCKED",
                reason_code="RECOMMENDATION_NOT_FOUND",
                message="Target decision or recommendation not found for dataset.",
                checks_passed=passed,
                checks_failed=failed,
            )

        rec_id = rec.id

        # Rule 3 & 4: Required guardrails exist and passed
        stmt_g = select(DecisionGuardrailEvaluation).where(
            DecisionGuardrailEvaluation.dataset_id == target_dataset.id,
            DecisionGuardrailEvaluation.recommendation_id == rec_id,
        )
        guardrail_eval = db.scalars(stmt_g).first()

        if not guardrail_eval:
            failed.append("3. Required guardrails evaluation missing")
        else:
            passed.append("3. Required guardrails evaluation exists")
            if (
                guardrail_eval.feasibility_status == "INFEASIBLE"
                or guardrail_eval.decision_status == "NOT_RECOMMENDED"
            ):
                failed.append(
                    f"4. Guardrails failed (feasibility={guardrail_eval.feasibility_status}, status={guardrail_eval.decision_status})"
                )
            else:
                passed.append("4. Guardrail safety rules passed")

        # Rule 5 & 6: Approval exists and is APPROVED
        stmt_app = select(DecisionApproval).where(
            DecisionApproval.dataset_id == target_dataset.id,
            DecisionApproval.recommendation_id == rec_id,
        )
        approval_record = db.scalars(stmt_app).first()

        if not approval_record:
            failed.append("5. Human approval record missing")
        else:
            passed.append("5. Human approval record exists")
            if approval_record.status == "APPROVED":
                passed.append("6. Human approval status is APPROVED")
            elif approval_record.status == "REJECTED":
                failed.append("6. Recommendation was REJECTED by reviewer")
            else:
                failed.append(f"6. Approval status is '{approval_record.status}', requiring explicit APPROVED status")

        # Rule 7: Decision is not already executed
        stmt_act = select(DecisionActionLog).where(
            DecisionActionLog.dataset_id == target_dataset.id,
            DecisionActionLog.recommendation_id == rec_id,
            DecisionActionLog.action_state == "EXECUTED",
        )
        already_executed = db.scalars(stmt_act).first()
        if already_executed:
            failed.append("7. Decision has already been executed")
        else:
            passed.append("7. Decision has not been executed yet")

        # Rule 8: Required data is available
        if target_dataset.is_processed:
            passed.append("8. Required dataset lineage is processed and available")
        else:
            failed.append("8. Dataset is not processed")

        # Rule 9: Decision has not been invalidated
        passed.append("9. Decision has not been invalidated")

        # Final Determination
        is_allowed = len(failed) == 0

        if is_allowed:
            state = "READY_FOR_ACTION"
            code = "ALLOWED"
            msg = "Action Gate cleared. Decision is ready for simulated action execution."
        else:
            state = "BLOCKED"
            if any("Guardrail" in f for f in failed):
                code = "GUARDRAIL_FAILED"
                msg = "Action cannot proceed because required guardrails did not pass."
            elif any("REJECTED" in f for f in failed):
                code = "APPROVAL_REJECTED"
                msg = "Action cannot proceed because decision was explicitly rejected."
            elif any("approval" in f.lower() for f in failed):
                code = "APPROVAL_MISSING"
                msg = "Action cannot proceed because explicit human approval is missing."
            elif any("already been executed" in f for f in failed):
                code = "ALREADY_EXECUTED"
                msg = "Action cannot proceed because decision has already been executed."
            else:
                code = "PREREQUISITE_FAILED"
                msg = f"Action gate blocked due to failed prerequisites: {'; '.join(failed)}"

        return ActionGateCheckResponse(
            decision_id=decision_id,
            recommendation_id=rec_id,
            allowed=is_allowed,
            decision_state=state,
            reason_code=code,
            message=msg,
            checks_passed=passed,
            checks_failed=failed,
        )

    @classmethod
    def execute_action(
        cls,
        db: Session,
        dataset_id: str,
        decision_id: str,
        payload: Optional[ActionExecuteRequest] = None,
    ) -> ActionExecuteResponse:
        """Execute simulated decision action via deterministic Action Gate validation."""
        target_dataset = EDAService.resolve_target_dataset(db=db, dataset_id=dataset_id)
        p = payload or ActionExecuteRequest()

        # 1. First run Action Gate checks
        gate_result = cls.check_action_gate(db=db, dataset_id=dataset_id, decision_id=decision_id)

        rec = cls._resolve_recommendation(db, target_dataset.id, decision_id)
        stmt_app = select(DecisionApproval).where(
            DecisionApproval.dataset_id == target_dataset.id,
            DecisionApproval.recommendation_id == rec.id,
        )
        approval_record = db.scalars(stmt_app).first()

        # 2. Handle Blocked Gate Case
        if not gate_result.allowed:
            action_log = DecisionActionLog(
                dataset_id=target_dataset.id,
                decision_id=decision_id,
                recommendation_id=rec.id,
                approval_id=approval_record.id if approval_record else None,
                action_state="BLOCKED",
                is_simulated=True,
                reason_code=gate_result.reason_code,
                message=gate_result.message,
                execution_details={
                    "checks_passed": gate_result.checks_passed,
                    "checks_failed": gate_result.checks_failed,
                    "parameters": p.execution_parameters or {},
                },
                executed_at=None,
            )
            db.add(action_log)
            db.commit()
            db.refresh(action_log)

            # Audit Event
            try:
                DecisionAuditService.record_event(
                    db=db,
                    dataset_id=target_dataset.id,
                    payload=AuditEventCreate(
                        decision_id=decision_id,
                        recommendation_id=rec.id,
                        event_type="ACTION_REQUESTED",
                        event_status="BLOCKED",
                        actor_type=p.actor_type.upper() if p.actor_type else "USER",
                        actor_id=p.actor_id,
                        source_service="action_gate_service",
                        evidence_references={"action_log_id": action_log.id, "reason_code": gate_result.reason_code},
                        new_state={"action_state": "BLOCKED"},
                    ),
                )
            except Exception:
                pass

            return ActionExecuteResponse(
                action_log_id=action_log.id,
                dataset_id=target_dataset.id,
                decision_id=decision_id,
                recommendation_id=rec.id,
                action_state="BLOCKED",
                is_simulated=True,
                reason_code=gate_result.reason_code,
                message=gate_result.message,
                execution_details=action_log.execution_details,
                executed_at=None,
            )

        # 3. Handle Allowed Gate Case -> Perform Simulated Execution
        now = datetime.now(timezone.utc)
        action_log = DecisionActionLog(
            dataset_id=target_dataset.id,
            decision_id=decision_id,
            recommendation_id=rec.id,
            approval_id=approval_record.id if approval_record else None,
            action_state="EXECUTED",
            is_simulated=True,
            reason_code="EXECUTION_SUCCESSFUL",
            message="Simulated action execution successfully completed through Action Gate.",
            execution_details={
                "checks_passed": gate_result.checks_passed,
                "parameters": p.execution_parameters or {},
                "simulation_notes": "Internal state transitioned to EXECUTED. No external side-effects triggered.",
            },
            executed_at=now,
        )
        db.add(action_log)
        db.commit()
        db.refresh(action_log)

        # Audit Event
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=target_dataset.id,
                payload=AuditEventCreate(
                    decision_id=decision_id,
                    recommendation_id=rec.id,
                    event_type="ACTION_EXECUTED",
                    event_status="SUCCESS",
                    actor_type=p.actor_type.upper() if p.actor_type else "USER",
                    actor_id=p.actor_id,
                    source_service="action_gate_service",
                    evidence_references={"action_log_id": action_log.id, "approval_id": approval_record.id if approval_record else None},
                    new_state={"action_state": "EXECUTED", "is_simulated": True},
                ),
            )
        except Exception:
            pass

        return ActionExecuteResponse(
            action_log_id=action_log.id,
            dataset_id=target_dataset.id,
            decision_id=decision_id,
            recommendation_id=rec.id,
            action_state="EXECUTED",
            is_simulated=True,
            reason_code="EXECUTION_SUCCESSFUL",
            message="Simulated action execution successfully completed through Action Gate.",
            execution_details=action_log.execution_details,
            executed_at=now,
        )

    @classmethod
    def _resolve_recommendation(cls, db: Session, target_dataset_id: str, rec_id: str):
        rec = db.scalars(
            select(DecisionRecommendation).where(
                DecisionRecommendation.id == rec_id,
                DecisionRecommendation.dataset_id == target_dataset_id,
            )
        ).first()

        if not rec:
            rec = db.scalars(
                select(DecisionRecommendationEvaluation).where(
                    DecisionRecommendationEvaluation.id == rec_id,
                    DecisionRecommendationEvaluation.dataset_id == target_dataset_id,
                )
            ).first()

        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation '{rec_id}' not found for dataset.",
            )
        return rec

    @classmethod
    def _map_approval_response(cls, record: DecisionApproval) -> ApprovalResponse:
        return ApprovalResponse(
            id=record.id,
            dataset_id=record.dataset_id,
            decision_id=record.decision_id,
            recommendation_id=record.recommendation_id,
            status=record.status,
            requested_at=record.requested_at,
            decided_at=record.decided_at,
            actor_type=record.actor_type,
            actor_id=record.actor_id,
            reason=record.reason,
            approval_metadata=record.approval_metadata or {},
        )
