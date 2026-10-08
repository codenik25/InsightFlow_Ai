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
from app.models.decision_guardrail import DecisionGuardrailEvaluation
from app.models.decision_approval import DecisionApproval
from app.models.decision_audit import DecisionAuditEvent
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.decision_governance import DecisionGovernanceEvent
from app.schemas.decision_governance import (
    DecisionGovernanceResponse,
    GovernanceReadinessCheck,
    GovernanceEscalationAssessment,
    GovernanceIssue,
    GovernanceEventResponse,
    GovernanceTransitionRequest,
)
from app.schemas.audit import AuditEventCreate
from app.services.audit_service import DecisionAuditService
from app.services.evidence_service import EvidenceService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionGovernanceService:
    """
    Deterministic Control Plane & Governance Engine for Executive Decisions (Phase 9).
    Enforces auditable, human-in-the-loop lifecycle transitions, append-only history,
    factual readiness checks, and deterministic escalation assessment without arbitrary scoring.
    """

    VALID_STATES = {
        "DRAFT",
        "UNDER_REVIEW",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "ESCALATED",
        "ON_HOLD",
        "EXECUTED",
        "CLOSED",
    }

    # Deterministic State Machine Transitions: CURRENT_STATE -> {ACTION: TARGET_STATE}
    STATE_MACHINE: Dict[str, Dict[str, str]] = {
        "DRAFT": {
            "START_REVIEW": "UNDER_REVIEW",
        },
        "UNDER_REVIEW": {
            "SUBMIT_FOR_APPROVAL": "PENDING_APPROVAL",
            "APPROVE": "APPROVED",
            "REJECT": "REJECTED",
            "ESCALATE": "ESCALATED",
            "PUT_ON_HOLD": "ON_HOLD",
        },
        "PENDING_APPROVAL": {
            "APPROVE": "APPROVED",
            "REJECT": "REJECTED",
            "ESCALATE": "ESCALATED",
            "PUT_ON_HOLD": "ON_HOLD",
            "RETURN_TO_REVIEW": "UNDER_REVIEW",
        },
        "WAITING_FOR_APPROVAL": {  # Legacy Phase 5 compatibility
            "APPROVE": "APPROVED",
            "REJECT": "REJECTED",
            "ESCALATE": "ESCALATED",
            "PUT_ON_HOLD": "ON_HOLD",
            "START_REVIEW": "UNDER_REVIEW",
            "RETURN_TO_REVIEW": "UNDER_REVIEW",
            "SUBMIT_FOR_APPROVAL": "PENDING_APPROVAL",
        },
        "ESCALATED": {
            "RETURN_TO_REVIEW": "UNDER_REVIEW",
            "START_REVIEW": "UNDER_REVIEW",
            "PUT_ON_HOLD": "ON_HOLD",
            "REJECT": "REJECTED",
        },
        "ON_HOLD": {
            "RETURN_TO_REVIEW": "UNDER_REVIEW",
            "START_REVIEW": "UNDER_REVIEW",
            "REJECT": "REJECTED",
        },
        "APPROVED": {
            "EXECUTE": "EXECUTED",
            "CLOSE": "CLOSED",
            "PUT_ON_HOLD": "ON_HOLD",
        },
        "EXECUTED": {
            "CLOSE": "CLOSED",
        },
        "REJECTED": {
            "RETURN_TO_REVIEW": "UNDER_REVIEW",
            "CLOSE": "CLOSED",
        },
        "CLOSED": {},
    }

    # Actions requiring mandatory human review notes and non-empty reviewer
    CRITICAL_ACTIONS = {"APPROVE", "REJECT", "ESCALATE", "PUT_ON_HOLD"}

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
        # 1. Look up DecisionApproval if exists
        approval = db.scalar(
            select(DecisionApproval).where(
                or_(
                    DecisionApproval.decision_id == decision_id,
                    DecisionApproval.id == decision_id,
                    DecisionApproval.recommendation_id == decision_id,
                )
            )
        )

        rec_id = approval.recommendation_id if approval else decision_id
        dataset_id = approval.dataset_id if approval else None

        # 2. Look up Recommendation
        rec = db.scalar(
            select(DecisionRecommendationEvaluation).where(
                or_(
                    DecisionRecommendationEvaluation.id == rec_id,
                    DecisionRecommendationEvaluation.id == decision_id,
                )
            )
        )
        if not rec:
            rec = db.scalar(
                select(DecisionRecommendation).where(
                    or_(
                        DecisionRecommendation.id == rec_id,
                        DecisionRecommendation.id == decision_id,
                    )
                )
            )

        if not dataset_id and rec:
            dataset_id = rec.dataset_id

        if not approval and not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{decision_id}' not found.",
            )

        # 3. Resolve Dataset & Project
        dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id)) if dataset_id else None
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset for decision '{decision_id}' not found.",
            )

        project = db.scalar(select(Project).where(Project.id == dataset.project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project for dataset '{dataset.id}' not found.",
            )

        # 4. Enforce strict Project Isolation
        if expected_project_id and project.id != expected_project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Decision '{decision_id}' does not belong to project '{expected_project_id}'.",
            )

        return approval, rec, dataset, project

    @classmethod
    def get_governance_state(
        cls,
        db: Session,
        decision_id: str,
        project_id: Optional[str] = None,
    ) -> DecisionGovernanceResponse:
        """
        Compute and return the complete factual Decision Governance & Control Plane view.
        Does not alter database state.
        """
        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        current_status = approval.status if approval else "DRAFT"
        allowed_actions = list(cls.STATE_MACHINE.get(current_status, {}).keys())

        # Collect Evidence Components
        guardrail = None
        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else decision_id)
        if rec_id:
            guardrail = db.scalar(
                select(DecisionGuardrailEvaluation).where(
                    DecisionGuardrailEvaluation.recommendation_id == rec_id,
                    DecisionGuardrailEvaluation.dataset_id == dataset.id,
                )
            )

        # Outcomes for this decision
        outcomes = db.scalars(
            select(DecisionOutcome).where(
                or_(
                    DecisionOutcome.decision_id == decision_id,
                    DecisionOutcome.recommendation_id == decision_id,
                    (DecisionOutcome.recommendation_id == rec_id) if rec_id else False,
                )
            )
        ).all()

        # Learning signals for this project / decision
        signals = db.scalars(
            select(DecisionLearningSignal).where(
                DecisionLearningSignal.project_id == project.id,
            )
        ).all()

        # Filter learning signals relevant to this decision
        decision_signals = []
        for s in signals:
            src_dec_ids = s.source_decision_ids or []
            if (
                decision_id in src_dec_ids
                or (rec_id and rec_id in src_dec_ids)
                or (approval and approval.id in src_dec_ids)
            ):
                decision_signals.append(s)
        # If no directly linked signals, check metric relevance if recommendation has target metric
        rec_metric = getattr(rec, "target_metric", None)
        if not decision_signals and rec_metric:
            decision_signals = [s for s in signals if s.metric_name == rec_metric]

        # Active vs Resolved/Dismissed signals
        active_signals = [s for s in decision_signals if s.status in ["NEW", "ACKNOWLEDGED", "INVESTIGATING"]]
        high_active_signals = [s for s in active_signals if s.severity == "HIGH"]

        # 5. Evaluate Factual Readiness Checks
        readiness_checks = cls._evaluate_readiness_checks(
            dataset=dataset,
            rec=rec,
            guardrail=guardrail,
            outcomes=outcomes,
            active_signals=active_signals,
            total_project_signals=len(signals),
            current_status=current_status,
            reviewer=approval.actor_id if approval else None,
        )

        # 6. Evaluate Deterministic Escalation Assessment
        escalation = cls._evaluate_escalation(
            high_active_signals=high_active_signals,
            guardrail=guardrail,
            outcomes=outcomes,
            dataset=dataset,
            rec=rec,
        )

        # 7. Collect Active Governance Issues
        active_issues = cls._collect_active_issues(
            high_active_signals=high_active_signals,
            active_signals=active_signals,
            guardrail=guardrail,
            outcomes=outcomes,
            current_status=current_status,
            reviewer=approval.actor_id if approval else None,
        )

        # 8. Evidence Snapshot
        target_metric = getattr(rec, "target_metric", None)
        projected_value = getattr(rec, "projected_value", None)
        if not target_metric and hasattr(rec, "evidence_traceability") and isinstance(rec.evidence_traceability, dict):
            target_metric = rec.evidence_traceability.get("target_metric")
        if projected_value is None and hasattr(rec, "evidence_traceability") and isinstance(rec.evidence_traceability, dict):
            projected_value = rec.evidence_traceability.get("projected_value")

        ds_version = getattr(dataset, "version_number", getattr(dataset, "version", 1))

        evidence_summary = {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "dataset_version": ds_version,
            "is_dataset_processed": dataset.is_processed,
            "recommendation_id": rec_id,
            "recommendation_title": getattr(rec, "title", None) or "Executive Recommendation",
            "target_metric": target_metric,
            "projected_value": projected_value,
            "guardrail_status": getattr(guardrail, "decision_status", "NOT_EVALUATED"),
            "guardrail_feasibility": getattr(guardrail, "feasibility_status", "NOT_EVALUATED"),
            "observed_outcomes_count": len(outcomes),
            "active_learning_signals_count": len(active_signals),
            "high_severity_signals_count": len(high_active_signals),
        }

        # 9. Retrieve Append-Only History
        history = cls._get_history_events(db=db, decision_id=decision_id, approval=approval)

        return DecisionGovernanceResponse(
            decision_id=decision_id,
            project_id=project.id,
            dataset_id=dataset.id,
            status=current_status,
            reviewer=approval.actor_id if approval else None,
            review_notes=approval.reason if approval else None,
            last_updated=approval.updated_at if approval else None,
            created_at=approval.created_at if approval else None,
            allowed_actions=allowed_actions,
            readiness_checks=readiness_checks,
            escalation=escalation,
            active_issues=active_issues,
            evidence_summary=evidence_summary,
            history=history,
        )

    @classmethod
    def transition_governance_state(
        cls,
        db: Session,
        decision_id: str,
        payload: GovernanceTransitionRequest,
        project_id: Optional[str] = None,
    ) -> DecisionGovernanceResponse:
        """
        Execute an explicit, human-authorized governance transition.
        Enforces:
        - Project and decision isolation
        - Deterministic state machine validation
        - Mandatory reviewer identity and notes for critical actions
        - Append-only event history persistence
        - Evidence graph linkage
        """
        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )

        current_status = approval.status if approval else "DRAFT"
        valid_transitions = cls.STATE_MACHINE.get(current_status, {})

        # Resolve target status and action
        action = payload.action.upper() if payload.action else None
        target_status = payload.target_status.upper() if payload.target_status else None

        if action:
            if action not in valid_transitions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Action '{action}' is not valid for decision in status '{current_status}'. Allowed actions: {list(valid_transitions.keys())}.",
                )
            target_status = valid_transitions[action]
        elif target_status:
            # Reverse lookup action from target_status
            matched_action = None
            for act, st in valid_transitions.items():
                if st == target_status:
                    matched_action = act
                    break
            if not matched_action:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Transition to status '{target_status}' is not valid from status '{current_status}'. Allowed target states: {list(valid_transitions.values())}.",
                )
            action = matched_action
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'action' or 'target_status' must be provided for a governance transition.",
            )

        # Validate Reviewer Identity (no blank or synthetic AI actors)
        reviewer = (payload.reviewer or "").strip()
        if not reviewer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reviewer identifier is required and cannot be empty.",
            )

        # Validate Critical Action Notes
        review_notes = (payload.review_notes or "").strip() if payload.review_notes else None
        if action in cls.CRITICAL_ACTIONS and not review_notes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Action '{action}' requires explicit review notes explaining the human rationale.",
            )

        rec_id = getattr(rec, "id", None) or (approval.recommendation_id if approval else decision_id)

        # 1. Create or Update DecisionApproval (Current State)
        now = utc_now()
        if not approval:
            approval = DecisionApproval(
                dataset_id=dataset.id,
                decision_id=decision_id,
                recommendation_id=rec_id,
                status=target_status,
                actor_type="USER",
                actor_id=reviewer,
                reason=review_notes,
                requested_at=now,
                decided_at=now,
                approval_metadata={
                    "governance": {
                        "last_action": action,
                        "from_status": current_status,
                        "metadata": payload.metadata or {},
                    }
                },
            )
            db.add(approval)
        else:
            approval.status = target_status
            approval.actor_id = reviewer
            approval.actor_type = "USER"
            approval.reason = review_notes
            approval.decided_at = now
            meta = dict(approval.approval_metadata or {})
            meta["governance"] = {
                "last_action": action,
                "from_status": current_status,
                "metadata": payload.metadata or {},
            }
            approval.approval_metadata = meta

        db.commit()
        db.refresh(approval)

        # 2. Persist Append-Only Governance Event
        ds_ver = getattr(dataset, "version_number", getattr(dataset, "version", 1))
        evidence_snap = {
            "dataset_id": dataset.id,
            "dataset_version": ds_ver,
            "recommendation_id": rec_id,
            "transition_metadata": payload.metadata or {},
        }

        gov_event = DecisionGovernanceEvent(
            id=str(uuid.uuid4()),
            project_id=project.id,
            dataset_id=dataset.id,
            decision_id=decision_id,
            recommendation_id=rec_id,
            approval_id=approval.id,
            from_status=current_status,
            to_status=target_status,
            action=action,
            actor=reviewer,
            review_notes=review_notes,
            evidence_snapshot=evidence_snap,
            created_at=now,
        )
        db.add(gov_event)
        db.commit()
        db.refresh(gov_event)

        # 3. Synchronize with DecisionAuditEvent (Existing Phase 5/ActionGate audit trail)
        try:
            DecisionAuditService.record_event(
                db=db,
                dataset_id=dataset.id,
                payload=AuditEventCreate(
                    decision_id=decision_id,
                    recommendation_id=rec_id,
                    event_type=f"GOVERNANCE_{target_status}",
                    event_status="SUCCESS",
                    actor_type="USER",
                    actor_id=reviewer,
                    source_service="decision_governance_service",
                    evidence_references={
                        "governance_event_id": gov_event.id,
                        "approval_id": approval.id,
                        "action": action,
                    },
                    previous_state={"status": current_status},
                    new_state={"status": target_status},
                    metadata={"review_notes": review_notes},
                ),
            )
        except Exception:
            pass

        # 4. Record Edge in Evidence Graph (Phase 5 traceability)
        try:
            EvidenceService.record_edges_batch(
                db=db,
                edges_data=[{
                    "project_id": project.id,
                    "source_id": gov_event.id,
                    "source_type": "GOVERNANCE_REVIEW",
                    "target_id": decision_id,
                    "target_type": "DECISION",
                    "relationship_type": "REVIEWED_BY",
                    "metadata": {
                        "from_status": current_status,
                        "to_status": target_status,
                        "actor": reviewer,
                        "action": action,
                    },
                }],
            )
        except Exception:
            pass

        return cls.get_governance_state(db=db, decision_id=decision_id, project_id=project.id)

    @classmethod
    def get_governance_history(
        cls,
        db: Session,
        decision_id: str,
        project_id: Optional[str] = None,
    ) -> List[GovernanceEventResponse]:
        """Retrieve chronological append-only governance transition history."""
        approval, rec, dataset, project = cls.resolve_decision_context(
            db=db,
            decision_id=decision_id,
            expected_project_id=project_id,
        )
        return cls._get_history_events(db=db, decision_id=decision_id, approval=approval)

    # -------------------------------------------------------------------------
    # Internal Evaluation Helpers
    # -------------------------------------------------------------------------

    @classmethod
    def _evaluate_readiness_checks(
        cls,
        dataset: Dataset,
        rec: Any,
        guardrail: Optional[DecisionGuardrailEvaluation],
        outcomes: List[DecisionOutcome],
        active_signals: List[DecisionLearningSignal],
        total_project_signals: int,
        current_status: str,
        reviewer: Optional[str],
    ) -> List[GovernanceReadinessCheck]:
        checks = []

        # 1. EVIDENCE_AVAILABLE
        ds_v = getattr(dataset, "version_number", getattr(dataset, "version", 1))
        if dataset.is_processed and rec:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="EVIDENCE_AVAILABLE",
                    name="Evidence Chain",
                    status="READY",
                    details=f"Dataset (v{ds_v}) and Recommendation verified",
                )
            )
        else:
            missing = []
            if not dataset.is_processed:
                missing.append("Dataset not processed")
            if not rec:
                missing.append("Recommendation missing")
            checks.append(
                GovernanceReadinessCheck(
                    check_id="EVIDENCE_AVAILABLE",
                    name="Evidence Chain",
                    status="INCOMPLETE",
                    details="; ".join(missing),
                )
            )

        # 2. OUTCOME_AVAILABLE
        if outcomes:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="OUTCOME_AVAILABLE",
                    name="Outcome Evidence",
                    status="READY",
                    details=f"{len(outcomes)} historical outcome observation(s) recorded",
                )
            )
        elif current_status in ["EXECUTED", "CLOSED"]:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="OUTCOME_AVAILABLE",
                    name="Outcome Evidence",
                    status="INCOMPLETE",
                    details="Decision executed but zero actual outcomes recorded",
                )
            )
        else:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="OUTCOME_AVAILABLE",
                    name="Outcome Evidence",
                    status="NOT_APPLICABLE",
                    details="Decision not yet executed (pre-execution phase)",
                )
            )

        # 3. PERFORMANCE_AVAILABLE
        if len(outcomes) >= 3:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="PERFORMANCE_AVAILABLE",
                    name="Performance Analytics",
                    status="READY",
                    details=f"Longitudinal performance baseline verified ({len(outcomes)} observations)",
                )
            )
        elif outcomes:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="PERFORMANCE_AVAILABLE",
                    name="Performance Analytics",
                    status="INCOMPLETE",
                    details=f"Limited outcome observations ({len(outcomes)}/3 minimum required for trend)",
                )
            )
        else:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="PERFORMANCE_AVAILABLE",
                    name="Performance Analytics",
                    status="NOT_APPLICABLE",
                    details="Performance tracking begins after outcome recording",
                )
            )

        # 4. LEARNING_SIGNALS_REVIEWED
        if active_signals:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="LEARNING_SIGNALS_REVIEWED",
                    name="Learning Signals",
                    status="INCOMPLETE",
                    details=f"{len(active_signals)} active learning signal(s) require human review",
                )
            )
        else:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="LEARNING_SIGNALS_REVIEWED",
                    name="Learning Signals",
                    status="READY",
                    details="No active or unresolved learning signals for this decision",
                )
            )

        # 5. GUARDRAILS_AVAILABLE
        if guardrail:
            if (
                guardrail.feasibility_status == "INFEASIBLE"
                or guardrail.decision_status == "NOT_RECOMMENDED"
            ):
                checks.append(
                    GovernanceReadinessCheck(
                        check_id="GUARDRAILS_AVAILABLE",
                        name="Guardrail Safety",
                        status="INCOMPLETE",
                        details=f"Guardrail check flagged: feasibility={guardrail.feasibility_status}, decision={guardrail.decision_status}",
                    )
                )
            else:
                checks.append(
                    GovernanceReadinessCheck(
                        check_id="GUARDRAILS_AVAILABLE",
                        name="Guardrail Safety",
                        status="READY",
                        details="Safety boundaries and feasibility constraints passed",
                    )
                )
        else:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="GUARDRAILS_AVAILABLE",
                    name="Guardrail Safety",
                    status="NOT_APPLICABLE",
                    details="No dedicated guardrail evaluation required",
                )
            )

        # 6. REVIEWER_ASSIGNED
        if reviewer:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="REVIEWER_ASSIGNED",
                    name="Reviewer Assignment",
                    status="READY",
                    details=f"Assigned reviewer: {reviewer}",
                )
            )
        else:
            checks.append(
                GovernanceReadinessCheck(
                    check_id="REVIEWER_ASSIGNED",
                    name="Reviewer Assignment",
                    status="INCOMPLETE",
                    details="No reviewer assigned yet",
                )
            )

        return checks

    @classmethod
    def _evaluate_escalation(
        cls,
        high_active_signals: List[DecisionLearningSignal],
        guardrail: Optional[DecisionGuardrailEvaluation],
        outcomes: List[DecisionOutcome],
        dataset: Dataset,
        rec: Any,
    ) -> GovernanceEscalationAssessment:
        reasons = []

        # 1. Unresolved HIGH learning signal
        if high_active_signals:
            reasons.append(
                f"An unresolved HIGH learning signal is associated with this decision ({len(high_active_signals)} signal(s))."
            )

        # 2. Guardrail issue
        if guardrail and (
            guardrail.feasibility_status == "INFEASIBLE"
            or guardrail.decision_status == "NOT_RECOMMENDED"
        ):
            reasons.append(
                f"Guardrail evaluation indicates violated constraints (feasibility: {guardrail.feasibility_status}, status: {guardrail.decision_status})."
            )

        # 3. Material outcome deviation
        material_deviations = [o for o in outcomes if getattr(o, "is_material_deviation", False)]
        if material_deviations:
            reasons.append(
                f"Material outcome deviation observed in historical execution ({len(material_deviations)} deviation(s))."
            )

        # 4. Missing required evidence
        if not dataset.is_processed:
            reasons.append("Dataset lineage is incomplete or not processed.")
        if not rec:
            reasons.append("Recommendation record is missing from decision provenance.")

        return GovernanceEscalationAssessment(
            escalation_recommended=len(reasons) > 0,
            reasons=reasons,
        )

    @classmethod
    def _collect_active_issues(
        cls,
        high_active_signals: List[DecisionLearningSignal],
        active_signals: List[DecisionLearningSignal],
        guardrail: Optional[DecisionGuardrailEvaluation],
        outcomes: List[DecisionOutcome],
        current_status: str,
        reviewer: Optional[str],
    ) -> List[GovernanceIssue]:
        issues = []

        # High Learning Signals
        for s in high_active_signals:
            issues.append(
                GovernanceIssue(
                    severity="HIGH",
                    issue_type="ACTIVE_HIGH_LEARNING_SIGNAL",
                    description=f"[{s.signal_type}] {s.title} ({s.status})",
                    entity_ref={"signal_id": s.id, "signal_type": s.signal_type},
                )
            )

        # Non-High Active Signals
        for s in active_signals:
            if s.severity != "HIGH":
                issues.append(
                    GovernanceIssue(
                        severity="WARNING",
                        issue_type="ACTIVE_LEARNING_SIGNAL",
                        description=f"[{s.signal_type}] {s.title} ({s.status})",
                        entity_ref={"signal_id": s.id, "signal_type": s.signal_type},
                    )
                )

        # Guardrails Violation
        if guardrail and (
            guardrail.feasibility_status == "INFEASIBLE"
            or guardrail.decision_status == "NOT_RECOMMENDED"
        ):
            issues.append(
                GovernanceIssue(
                    severity="HIGH",
                    issue_type="GUARDRAIL_VIOLATION",
                    description=f"Guardrail constraints violated (feasibility={guardrail.feasibility_status})",
                    entity_ref={"guardrail_id": guardrail.id},
                )
            )

        # Material Deviations
        for o in outcomes:
            if getattr(o, "is_material_deviation", False):
                issues.append(
                    GovernanceIssue(
                        severity="WARNING",
                        issue_type="MATERIAL_OUTCOME_DEVIATION",
                        description=f"Outcome deviation on metric '{o.actual_metric}' (actual: {o.actual_value}, deviation: {getattr(o, 'deviation_magnitude', 'N/A')})",
                        entity_ref={"outcome_id": o.id},
                    )
                )

        # Unassigned Reviewer for decisions under review
        if current_status in ["UNDER_REVIEW", "PENDING_APPROVAL"] and not reviewer:
            issues.append(
                GovernanceIssue(
                    severity="INFO",
                    issue_type="UNASSIGNED_REVIEWER",
                    description="Decision is in review queue but has no assigned human reviewer.",
                )
            )

        return issues

    @classmethod
    def _get_history_events(
        cls,
        db: Session,
        decision_id: str,
        approval: Optional[DecisionApproval],
    ) -> List[GovernanceEventResponse]:
        # 1. Fetch explicit DecisionGovernanceEvent records
        stmt = (
            select(DecisionGovernanceEvent)
            .where(
                or_(
                    DecisionGovernanceEvent.decision_id == decision_id,
                    DecisionGovernanceEvent.recommendation_id == decision_id,
                    (DecisionGovernanceEvent.approval_id == approval.id) if approval else False,
                )
            )
            .order_by(DecisionGovernanceEvent.created_at.asc())
        )
        events = db.scalars(stmt).all()
        result = [GovernanceEventResponse.model_validate(e) for e in events]

        # 2. If no explicit governance events exist, check DecisionAuditEvent for backward compatibility
        if not result:
            audit_stmt = (
                select(DecisionAuditEvent)
                .where(
                    or_(
                        DecisionAuditEvent.decision_id == decision_id,
                        DecisionAuditEvent.recommendation_id == decision_id,
                    ),
                    DecisionAuditEvent.event_type.like("GOVERNANCE_%")
                    | DecisionAuditEvent.event_type.in_(["DECISION_APPROVED", "DECISION_REJECTED", "APPROVAL_REQUESTED"]),
                )
                .order_by(DecisionAuditEvent.timestamp.asc())
            )
            audit_events = db.scalars(audit_stmt).all()
            for ae in audit_events:
                from_st = (ae.previous_state or {}).get("status", "DRAFT")
                to_st = (ae.new_state or {}).get("status", ae.event_type.replace("GOVERNANCE_", ""))
                result.append(
                    GovernanceEventResponse(
                        id=ae.id,
                        decision_id=decision_id,
                        from_status=from_st,
                        to_status=to_st,
                        action=ae.event_type,
                        actor=ae.actor_id or "Human Reviewer",
                        review_notes=(ae.metadata_json or {}).get("review_notes"),
                        created_at=ae.timestamp,
                        evidence_snapshot=ae.evidence_references,
                    )
                )

        return result
