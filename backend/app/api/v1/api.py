from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
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
)

api_v1_router = APIRouter()

api_v1_router.include_router(health.router, tags=["Health"])
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
api_v1_router.include_router(guardrails.router, prefix="/datasets", tags=["Decision Guardrails"])
api_v1_router.include_router(recommendations.router, prefix="/datasets", tags=["Decision Recommendations"])
api_v1_router.include_router(decision.router, prefix="/datasets", tags=["Decision Intelligence"])

