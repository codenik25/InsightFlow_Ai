import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logging import logger
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.decision_outcome import DecisionOutcome
from app.models.decision_learning_signal import DecisionLearningSignal
from app.models.ml_analysis import MLAnalysis
from app.models.scenario import Scenario
from app.services.decision_performance_service import DecisionPerformanceService
from app.services.evidence_service import EvidenceService
from app.schemas.learning_signal import (
    DecisionLearningSignalResponse,
    DecisionLearningSignalUpdate,
    DecisionLearningSignalsListResponse,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LearningSignalService:
    """
    Phase 8: Decision Learning & Improvement Signals Service.
    Converts Phase 7 performance patterns and Phase 6 outcomes into structured,
    traceable investigation signals for human analysts.
    Strictly advisory: never automates retraining, parameter changes, or decision mutation.
    """

    ALLOWED_STATUSES = {"NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "DISMISSED"}
    ALLOWED_SEVERITIES = {"INFO", "REVIEW", "HIGH"}

    @classmethod
    def compute_fingerprint(
        cls,
        project_id: str,
        signal_type: str,
        metric_name: Optional[str] = None,
        entity_id: Optional[str] = None,
        threshold: float = 0.05,
    ) -> str:
        """Deterministic fingerprint preventing duplicate signals on repeated syncs."""
        raw = f"{project_id}:{signal_type}:{metric_name or ''}:{entity_id or ''}:{threshold:.4f}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    @classmethod
    def sync_and_get_signals(
        cls,
        db: Session,
        project_id: str,
        min_observations: int = 3,
        threshold: float = 0.05,
    ) -> List[DecisionLearningSignal]:
        """
        Synchronizes Phase 8 learning signals derived from Phase 7 performance intelligence.
        Reuses DecisionPerformanceService to ensure single-source-of-truth calculations.
        Idempotent: updates existing signals (preserving human review status) and adds new ones.
        """
        # 1. Project isolation check
        project = db.scalar(select(Project).where(Project.id == project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # 2. Query Phase 7 performance overview
        perf = DecisionPerformanceService.get_performance_overview(
            db=db,
            project_id=project_id,
            min_observations=min_observations,
            threshold=threshold,
        )

        # 3. Query all project outcomes to extract lineage and Phase 6 learning signals
        outcomes = db.scalars(
            select(DecisionOutcome)
            .where(DecisionOutcome.project_id == project_id)
            .order_by(DecisionOutcome.recorded_at.asc())
        ).all()

        outcome_by_id: Dict[str, DecisionOutcome] = {o.id: o for o in outcomes}

        # Candidate signals to generate
        candidates: List[Dict[str, Any]] = []

        # -------------------------------------------------------------
        # Rule A: OUTCOME_COVERAGE_GAP
        # -------------------------------------------------------------
        # Only when total decisions > 0 and coverage is materially incomplete
        if perf.summary.total_decisions > 0:
            cov_rate = perf.summary.outcome_coverage_rate
            pending = perf.summary.pending_outcomes
            # Coverage gap triggers if coverage < 60% or pending >= 3
            if cov_rate < 0.60 or pending >= 3:
                dec_ids = list({o.decision_id or o.recommendation_id for o in outcomes if (o.decision_id or o.recommendation_id)})
                fp = cls.compute_fingerprint(project_id, "OUTCOME_COVERAGE_GAP", None, None, threshold)
                candidates.append({
                    "signal_type": "OUTCOME_COVERAGE_GAP",
                    "metric_name": None,
                    "title": "Outcome Coverage Incomplete",
                    "description": (
                        f"Outcome coverage is {cov_rate * 100:.1f}% ({perf.summary.decisions_with_actual_outcomes} of "
                        f"{perf.summary.total_decisions} decisions observed, {pending} pending). "
                        "Sufficient outcome observation is required for complete historical performance intelligence."
                    ),
                    "severity": "REVIEW" if cov_rate < 0.50 else "INFO",
                    "sample_count": perf.summary.total_decisions,
                    "observed_count": perf.summary.decisions_with_actual_outcomes,
                    "threshold_used": threshold,
                    "source_outcome_ids": [o.id for o in outcomes if o.actual_value is not None],
                    "source_decision_ids": dec_ids,
                    "source_ml_analysis_ids": list({o.ml_analysis_id for o in outcomes if o.ml_analysis_id}),
                    "source_dataset_ids": list({o.source_dataset_id or o.dataset_id for o in outcomes if (o.source_dataset_id or o.dataset_id)}),
                    "source_dataset_versions": list({o.source_dataset_version for o in outcomes if o.source_dataset_version is not None}),
                    "evidence_summary": {
                        "total_decisions": perf.summary.total_decisions,
                        "observed_outcomes": perf.summary.decisions_with_actual_outcomes,
                        "pending_outcomes": pending,
                        "coverage_rate": round(cov_rate, 4),
                        "statement": "Outcome coverage is incomplete for the selected decision population.",
                    },
                    "fingerprint": fp,
                })

        # -------------------------------------------------------------
        # Rule B & C: PREDICTION_DEVIATION & OUTCOME_DEVIATION
        # -------------------------------------------------------------
        # Derived from Phase 7 repeated deviation observations with minimum sample protection
        for obs in perf.observations:
            m_name = obs.metric_name
            obs_outcomes = [outcome_by_id[oid] for oid in obs.source_outcome_ids if oid in outcome_by_id]
            if not obs_outcomes:
                continue

            # Check if predictive relationship exists (e.g. ml_analysis_id or explicit expected prediction from model/optimization)
            has_predictive_model = any(o.ml_analysis_id is not None or o.optimization_id is not None for o in obs_outcomes)
            sig_type = "PREDICTION_DEVIATION" if has_predictive_model else "OUTCOME_DEVIATION"

            dev_rate = obs.deviation_rate
            sev = "HIGH" if dev_rate >= 0.50 else "REVIEW"

            title_prefix = "Repeated Prediction Deviation" if sig_type == "PREDICTION_DEVIATION" else "Repeated Outcome Deviation"
            fp = cls.compute_fingerprint(project_id, sig_type, m_name, None, threshold)

            source_dec_ids = list({o.decision_id or o.recommendation_id for o in obs_outcomes if (o.decision_id or o.recommendation_id)})
            source_ml_ids = list({o.ml_analysis_id for o in obs_outcomes if o.ml_analysis_id})
            source_ds_ids = list({o.source_dataset_id or o.dataset_id for o in obs_outcomes if (o.source_dataset_id or o.dataset_id)})
            source_ds_vers = list({o.source_dataset_version for o in obs_outcomes if o.source_dataset_version is not None})

            candidates.append({
                "signal_type": sig_type,
                "metric_name": m_name,
                "title": f"{title_prefix}: {m_name}",
                "description": (
                    f"Metric '{m_name}' exhibited material deviation in {obs.material_deviation_count} of "
                    f"{obs.observed_count} observed outcomes ({dev_rate * 100:.1f}%), exceeding the {threshold * 100:.1f}% threshold."
                ),
                "severity": sev,
                "sample_count": obs.sample_count,
                "observed_count": obs.observed_count,
                "threshold_used": threshold,
                "source_outcome_ids": obs.source_outcome_ids,
                "source_decision_ids": source_dec_ids,
                "source_ml_analysis_ids": source_ml_ids,
                "source_dataset_ids": source_ds_ids,
                "source_dataset_versions": source_ds_vers,
                "evidence_summary": {
                    "metric_name": m_name,
                    "observed_count": obs.observed_count,
                    "material_deviations": obs.material_deviation_count,
                    "deviation_rate": round(dev_rate, 4),
                    "threshold_used": threshold,
                    "time_range": obs.time_range,
                    "statement": obs.statement,
                },
                "fingerprint": fp,
            })

        # -------------------------------------------------------------
        # Rule D: MODEL_PERFORMANCE_VARIANCE
        # -------------------------------------------------------------
        # Strict requirement: ONLY generate when DecisionOutcome.ml_analysis_id is explicitly persisted.
        # Minimum sample protection: observed_outcomes >= min_observations and material_deviations >= 2
        for m in perf.models:
            if not m.ml_analysis_id:
                continue
            if m.observed_outcomes >= min_observations and m.material_deviations >= 2:
                model_outcomes = [outcome_by_id[oid] for oid in m.source_outcome_ids if oid in outcome_by_id]
                source_dec_ids = list({o.decision_id or o.recommendation_id for o in model_outcomes if (o.decision_id or o.recommendation_id)})
                source_ds_ids = list({o.source_dataset_id or o.dataset_id for o in model_outcomes if (o.source_dataset_id or o.dataset_id)})
                source_ds_vers = list({o.source_dataset_version for o in model_outcomes if o.source_dataset_version is not None})

                dev_rate = m.material_deviations / max(1, m.observed_outcomes)
                sev = "HIGH" if dev_rate >= 0.50 else "REVIEW"
                fp = cls.compute_fingerprint(project_id, "MODEL_PERFORMANCE_VARIANCE", m.target_column, m.ml_analysis_id, threshold)

                candidates.append({
                    "signal_type": "MODEL_PERFORMANCE_VARIANCE",
                    "metric_name": m.target_column,
                    "title": f"Model Performance Variance: {m.model_name}",
                    "description": (
                        f"Explicitly linked ML model '{m.model_name}' (ID: {m.ml_analysis_id}) recorded "
                        f"{m.material_deviations} material deviations across {m.observed_outcomes} observed outcomes "
                        f"(MAE: {m.mean_absolute_error if m.mean_absolute_error is not None else 'N/A'}, "
                        f"MRE: {f'{m.mean_relative_error * 100:.1f}%' if m.mean_relative_error is not None else 'N/A'})."
                    ),
                    "severity": sev,
                    "sample_count": m.observed_outcomes,
                    "observed_count": m.observed_outcomes,
                    "threshold_used": threshold,
                    "source_outcome_ids": m.source_outcome_ids,
                    "source_decision_ids": source_dec_ids,
                    "source_ml_analysis_ids": [m.ml_analysis_id],
                    "source_dataset_ids": source_ds_ids,
                    "source_dataset_versions": source_ds_vers,
                    "evidence_summary": {
                        "ml_analysis_id": m.ml_analysis_id,
                        "model_name": m.model_name,
                        "target_column": m.target_column,
                        "observed_outcomes": m.observed_outcomes,
                        "material_deviations": m.material_deviations,
                        "mean_absolute_error": m.mean_absolute_error,
                        "mean_relative_error": m.mean_relative_error,
                    },
                    "fingerprint": fp,
                })

        # -------------------------------------------------------------
        # Rule E: SCENARIO_DEVIATION
        # -------------------------------------------------------------
        # Scenarios with recurring material variance: observed >= min_observations and deviations >= 2
        for sc in perf.scenarios:
            if sc.observed_outcomes >= min_observations and sc.material_deviations >= 2:
                sc_outcomes = [outcome_by_id[oid] for oid in sc.source_outcome_ids if oid in outcome_by_id]
                source_dec_ids = list({o.decision_id or o.recommendation_id for o in sc_outcomes if (o.decision_id or o.recommendation_id)})
                source_ds_ids = list({o.source_dataset_id or o.dataset_id for o in sc_outcomes if (o.source_dataset_id or o.dataset_id)})
                source_ds_vers = list({o.source_dataset_version for o in sc_outcomes if o.source_dataset_version is not None})
                source_ml_ids = list({o.ml_analysis_id for o in sc_outcomes if o.ml_analysis_id})

                dev_rate = sc.material_deviations / max(1, sc.observed_outcomes)
                sev = "HIGH" if dev_rate >= 0.50 else "REVIEW"
                fp = cls.compute_fingerprint(project_id, "SCENARIO_DEVIATION", sc.target_metric, sc.scenario_id, threshold)

                candidates.append({
                    "signal_type": "SCENARIO_DEVIATION",
                    "metric_name": sc.target_metric,
                    "title": f"Scenario Deviation: {sc.scenario_name}",
                    "description": (
                        f"Persisted scenario '{sc.scenario_name}' exhibited material variance in "
                        f"{sc.material_deviations} of {sc.observed_outcomes} observed outcomes."
                    ),
                    "severity": sev,
                    "sample_count": sc.total_decisions,
                    "observed_count": sc.observed_outcomes,
                    "threshold_used": threshold,
                    "source_outcome_ids": sc.source_outcome_ids,
                    "source_decision_ids": source_dec_ids,
                    "source_ml_analysis_ids": source_ml_ids,
                    "source_dataset_ids": source_ds_ids,
                    "source_dataset_versions": source_ds_vers,
                    "evidence_summary": {
                        "scenario_id": sc.scenario_id,
                        "scenario_name": sc.scenario_name,
                        "target_metric": sc.target_metric,
                        "observed_outcomes": sc.observed_outcomes,
                        "material_deviations": sc.material_deviations,
                        "mean_relative_delta": sc.mean_relative_delta,
                    },
                    "fingerprint": fp,
                })

        # -------------------------------------------------------------
        # Rule F: DATA_DRIFT_RELEVANT
        # -------------------------------------------------------------
        # Strict constraint: Only generate when explicit persisted evidence of data drift exists in Phase 6 outcomes.
        # Never claim drift caused error: "Data drift evidence is associated with this outcome deviation."
        drift_outcomes = [o for o in outcomes if o.learning_signal == "DATA_DRIFT_RELEVANT"]
        if drift_outcomes:
            source_dec_ids = list({o.decision_id or o.recommendation_id for o in drift_outcomes if (o.decision_id or o.recommendation_id)})
            source_ml_ids = list({o.ml_analysis_id for o in drift_outcomes if o.ml_analysis_id})
            source_ds_ids = list({o.source_dataset_id or o.dataset_id for o in drift_outcomes if (o.source_dataset_id or o.dataset_id)})
            source_ds_vers = list({o.source_dataset_version for o in drift_outcomes if o.source_dataset_version is not None})
            fp = cls.compute_fingerprint(project_id, "DATA_DRIFT_RELEVANT", None, None, threshold)

            candidates.append({
                "signal_type": "DATA_DRIFT_RELEVANT",
                "metric_name": drift_outcomes[0].actual_metric or drift_outcomes[0].expected_metric,
                "title": "Data Drift Relevant to Outcome Variance",
                "description": (
                    f"Data drift evidence is associated with {len(drift_outcomes)} outcome deviations. "
                    "Feature distribution shifts in underlying dataset versions should be investigated."
                ),
                "severity": "REVIEW",
                "sample_count": len(drift_outcomes),
                "observed_count": len(drift_outcomes),
                "threshold_used": threshold,
                "source_outcome_ids": [o.id for o in drift_outcomes],
                "source_decision_ids": source_dec_ids,
                "source_ml_analysis_ids": source_ml_ids,
                "source_dataset_ids": source_ds_ids,
                "source_dataset_versions": source_ds_vers,
                "evidence_summary": {
                    "statement": "Data drift evidence is associated with this outcome deviation.",
                    "drift_outcomes_count": len(drift_outcomes),
                    "source_dataset_versions": source_ds_vers,
                },
                "fingerprint": fp,
            })

        # -------------------------------------------------------------
        # Rule G: ASSUMPTION_CHANGE
        # -------------------------------------------------------------
        # Strict constraint: Only generate when Phase 6 outcome explicitly identifies changed assumptions.
        assumption_outcomes = [o for o in outcomes if o.learning_signal == "ASSUMPTION_CHANGE"]
        if assumption_outcomes:
            source_dec_ids = list({o.decision_id or o.recommendation_id for o in assumption_outcomes if (o.decision_id or o.recommendation_id)})
            source_ml_ids = list({o.ml_analysis_id for o in assumption_outcomes if o.ml_analysis_id})
            source_ds_ids = list({o.source_dataset_id or o.dataset_id for o in assumption_outcomes if (o.source_dataset_id or o.dataset_id)})
            source_ds_vers = list({o.source_dataset_version for o in assumption_outcomes if o.source_dataset_version is not None})
            fp = cls.compute_fingerprint(project_id, "ASSUMPTION_CHANGE", None, None, threshold)

            candidates.append({
                "signal_type": "ASSUMPTION_CHANGE",
                "metric_name": assumption_outcomes[0].actual_metric or assumption_outcomes[0].expected_metric,
                "title": "Operational Assumption Change Detected",
                "description": (
                    f"Explicit operational assumption changes recorded across {len(assumption_outcomes)} decisions. "
                    "Model and scenario baseline parameters should be reviewed for calibration."
                ),
                "severity": "INFO",
                "sample_count": len(assumption_outcomes),
                "observed_count": len(assumption_outcomes),
                "threshold_used": threshold,
                "source_outcome_ids": [o.id for o in assumption_outcomes],
                "source_decision_ids": source_dec_ids,
                "source_ml_analysis_ids": source_ml_ids,
                "source_dataset_ids": source_ds_ids,
                "source_dataset_versions": source_ds_vers,
                "evidence_summary": {
                    "statement": "Operational assumption changes explicitly recorded in decision outcomes.",
                    "assumption_outcomes_count": len(assumption_outcomes),
                },
                "fingerprint": fp,
            })

        # 4. Deterministic Fingerprint Deduplication & Persistence
        existing_signals = db.scalars(
            select(DecisionLearningSignal).where(DecisionLearningSignal.project_id == project_id)
        ).all()
        existing_by_fp = {s.fingerprint: s for s in existing_signals}

        persisted_signals: List[DecisionLearningSignal] = []
        new_edges_to_record: List[Dict[str, Any]] = []

        for cand in candidates:
            fp = cand["fingerprint"]
            if fp in existing_by_fp:
                # Update factual fields; DO NOT overwrite human lifecycle status or notes
                existing = existing_by_fp[fp]
                existing.sample_count = cand["sample_count"]
                existing.observed_count = cand["observed_count"]
                existing.source_outcome_ids = cand["source_outcome_ids"]
                existing.source_decision_ids = cand["source_decision_ids"]
                existing.source_ml_analysis_ids = cand["source_ml_analysis_ids"]
                existing.source_dataset_ids = cand["source_dataset_ids"]
                existing.source_dataset_versions = cand["source_dataset_versions"]
                existing.evidence_summary = cand["evidence_summary"]
                existing.updated_at = utc_now()
                # Update title & description only if signal is still NEW
                if existing.status == "NEW":
                    existing.title = cand["title"]
                    existing.description = cand["description"]
                    existing.severity = cand["severity"]
                persisted_signals.append(existing)
            else:
                # Create brand new signal
                new_signal = DecisionLearningSignal(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    signal_type=cand["signal_type"],
                    metric_name=cand["metric_name"],
                    source_outcome_ids=cand["source_outcome_ids"],
                    source_decision_ids=cand["source_decision_ids"],
                    source_ml_analysis_ids=cand["source_ml_analysis_ids"],
                    source_dataset_ids=cand["source_dataset_ids"],
                    source_dataset_versions=cand["source_dataset_versions"],
                    sample_count=cand["sample_count"],
                    observed_count=cand["observed_count"],
                    threshold_used=cand["threshold_used"],
                    severity=cand["severity"],
                    status="NEW",
                    title=cand["title"],
                    description=cand["description"],
                    evidence_summary=cand["evidence_summary"],
                    fingerprint=fp,
                    created_at=utc_now(),
                    updated_at=utc_now(),
                )
                db.add(new_signal)
                persisted_signals.append(new_signal)

                # Prepare Evidence Graph Edges: LEARNING_SIGNAL -> SUPPORTED_BY -> OUTCOME
                for oid in cand["source_outcome_ids"]:
                    new_edges_to_record.append({
                        "project_id": project_id,
                        "source_type": "LEARNING_SIGNAL",
                        "source_id": new_signal.id,
                        "target_type": "OUTCOME",
                        "target_id": oid,
                        "relationship_type": "SUPPORTED_BY",
                        "metadata": {
                            "signal_type": new_signal.signal_type,
                            "severity": new_signal.severity,
                        },
                    })

        db.commit()
        for s in persisted_signals:
            db.refresh(s)

        # Record Evidence Edges in Phase 5 Graph idempotently
        if new_edges_to_record:
            try:
                EvidenceService.record_edges_batch(db=db, edges_data=new_edges_to_record)
                db.commit()
            except Exception as e:
                logger.warning(f"Could not record evidence edges for learning signals: {e}")

        # Return all active signals for this project, sorted by severity and created_at
        all_signals = db.scalars(
            select(DecisionLearningSignal)
            .where(DecisionLearningSignal.project_id == project_id)
            .order_by(DecisionLearningSignal.created_at.desc())
        ).all()

        return all_signals

    @classmethod
    def get_signal_by_id(
        cls,
        db: Session,
        project_id: str,
        signal_id: str,
    ) -> DecisionLearningSignal:
        """Retrieves a single learning signal with project isolation validation."""
        signal = db.scalar(
            select(DecisionLearningSignal).where(
                DecisionLearningSignal.id == signal_id,
                DecisionLearningSignal.project_id == project_id,
            )
        )
        if not signal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Learning signal '{signal_id}' not found for project '{project_id}'.",
            )
        return signal

    @classmethod
    def update_signal_status(
        cls,
        db: Session,
        project_id: str,
        signal_id: str,
        payload: DecisionLearningSignalUpdate,
    ) -> DecisionLearningSignal:
        """
        Human analyst workflow: transitions lifecycle status (ACKNOWLEDGED, INVESTIGATING, RESOLVED, DISMISSED).
        Never allows arbitrary mutation of computed evidence, source outcomes, or metric thresholds.
        """
        signal = cls.get_signal_by_id(db, project_id, signal_id)

        target_status = payload.status.strip().upper()
        if target_status not in cls.ALLOWED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid signal status '{payload.status}'. Allowed: {sorted(list(cls.ALLOWED_STATUSES))}",
            )

        signal.status = target_status
        if payload.review_notes is not None:
            signal.review_notes = payload.review_notes
        if payload.reviewed_by is not None:
            signal.reviewed_by = payload.reviewed_by
        signal.reviewed_at = utc_now()
        signal.updated_at = utc_now()

        db.commit()
        db.refresh(signal)
        return signal

    @classmethod
    def build_list_response(
        cls,
        project_id: str,
        signals: List[DecisionLearningSignal],
    ) -> DecisionLearningSignalsListResponse:
        """Builds aggregated response summary for the frontend learning signals view."""
        by_sev: Dict[str, int] = defaultdict(int)
        by_stat: Dict[str, int] = defaultdict(int)

        for s in signals:
            by_sev[s.severity] += 1
            by_stat[s.status] += 1

        def to_response(sig: DecisionLearningSignal) -> DecisionLearningSignalResponse:
            if hasattr(DecisionLearningSignalResponse, "model_validate"):
                return DecisionLearningSignalResponse.model_validate(sig)
            return DecisionLearningSignalResponse.from_orm(sig)

        return DecisionLearningSignalsListResponse(
            project_id=project_id,
            total_signals=len(signals),
            by_severity=dict(by_sev),
            by_status=dict(by_stat),
            signals=[to_response(s) for s in signals],
        )
