import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionGuardrailEvaluation(Base):
    """ORM model for Phase 7.4 Decision Guardrails & Feasibility Analysis."""

    __tablename__ = "decision_guardrail_evaluations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    ml_analysis_id = Column(String, ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    optimization_id = Column(String, ForeignKey("decision_optimizations.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_id = Column(String, ForeignKey("decision_recommendation_evaluations.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_id = Column(String, nullable=True)

    # Scores (0.0 to 100.0)
    feasibility_score = Column(Float, nullable=False, default=100.0)
    realism_score = Column(Float, nullable=False, default=100.0)
    risk_score = Column(Float, nullable=False, default=0.0)
    confidence_score = Column(Float, nullable=False, default=100.0)
    decision_readiness_score = Column(Float, nullable=False, default=100.0)

    # Classifications
    feasibility_status = Column(String, nullable=False, default="FEASIBLE")  # FEASIBLE, CAUTION, INFEASIBLE
    risk_level = Column(String, nullable=False, default="LOW")  # LOW, MEDIUM, HIGH
    decision_status = Column(String, nullable=False, default="READY_TO_CONSIDER")  # READY_TO_CONSIDER, HUMAN_REVIEW_REQUIRED, NOT_RECOMMENDED

    # Evidence and rules breakdowns
    guardrail_results = Column(JSON, nullable=False)  # Full rule evaluation list
    passed_rules = Column(JSON, nullable=False)       # List of passed rule results
    warnings = Column(JSON, nullable=False)           # List of warning rule results
    violated_rules = Column(JSON, nullable=False)     # List of failed rule results
    explanation = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    dataset = relationship("Dataset", backref="guardrails")
    ml_analysis = relationship("MLAnalysis", backref="guardrails")
    optimization = relationship("DecisionOptimization", backref="guardrails")
    recommendation = relationship("DecisionRecommendationEvaluation", backref="guardrails")
