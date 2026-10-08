from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    workspaces,
    projects,
    datasets,
    eda,
    insights,
    reports,
    ml,
    decision,
    recommendations,
    guardrails,
    command_center,
    decision_briefs,
    outcomes,
    forecasting,
    anomaly,
    impact,
    audit,
    approval,
    ai_evaluations,
    runs,
    evidence,
    decision_performance,
    learning_signals,
    decision_governance,
    decision_execution,
    decision_portfolio,
    decision_reporting,
    decision_knowledge,
)

api_v1_router = APIRouter()

api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(runs.router, prefix="/runs", tags=["Analysis Runs"])
api_v1_router.include_router(evidence.router, tags=["Decision Evidence Graph"])
api_v1_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_v1_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_v1_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_v1_router.include_router(eda.router, prefix="/datasets", tags=["EDA & KPIs"])
api_v1_router.include_router(insights.router, prefix="/datasets", tags=["Business Insights"])
api_v1_router.include_router(reports.router, prefix="/datasets", tags=["Executive Reports"])
api_v1_router.include_router(ml.router, prefix="/datasets", tags=["Predictive Analytics & ML"])
api_v1_router.include_router(forecasting.router, tags=["Demand Forecasting"])
api_v1_router.include_router(anomaly.router, tags=["Anomaly Intelligence"])
api_v1_router.include_router(decision_briefs.router, prefix="/datasets", tags=["AI Decision Briefs"])
api_v1_router.include_router(command_center.router, prefix="/datasets", tags=["Decision Command Center"])
api_v1_router.include_router(outcomes.router, prefix="/datasets", tags=["Decision Outcomes & Memory"])
api_v1_router.include_router(outcomes.phase6_router, tags=["Decision Outcome & Learning Loop"])
api_v1_router.include_router(guardrails.router, prefix="/datasets", tags=["Decision Guardrails"])
api_v1_router.include_router(recommendations.router, prefix="/datasets", tags=["Decision Recommendations"])
api_v1_router.include_router(decision.router, prefix="/datasets", tags=["Decision Intelligence"])
api_v1_router.include_router(impact.router, prefix="/datasets", tags=["Decision Impact & Value"])
api_v1_router.include_router(audit.router, prefix="/datasets", tags=["Decision Audit Trail"])
api_v1_router.include_router(approval.router, prefix="/datasets", tags=["Human Approval & Action Gate"])
api_v1_router.include_router(ai_evaluations.router, prefix="/datasets", tags=["AI Evaluation Framework"])
api_v1_router.include_router(decision_performance.router, tags=["Decision Performance Intelligence"])
api_v1_router.include_router(learning_signals.router, tags=["Decision Learning Signals"])
api_v1_router.include_router(decision_governance.router, tags=["Decision Governance & Control Plane"])
api_v1_router.include_router(decision_execution.router, tags=["Decision Execution & Closed-Loop Monitoring"])
api_v1_router.include_router(decision_portfolio.router, prefix="/projects", tags=["Decision Portfolio & Cross-Decision Intelligence"])
api_v1_router.include_router(decision_reporting.router, tags=["Enterprise Decision Reporting & Audit"])
api_v1_router.include_router(decision_knowledge.router, tags=["Decision Knowledge & Operating Memory"])


