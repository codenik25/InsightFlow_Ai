from fastapi import APIRouter
from app.api.v1.endpoints import health, datasets, eda, insights, reports, ml

api_v1_router = APIRouter()

api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_v1_router.include_router(eda.router, prefix="/datasets", tags=["EDA & KPIs"])
api_v1_router.include_router(insights.router, prefix="/datasets", tags=["Business Insights"])
api_v1_router.include_router(reports.router, prefix="/datasets", tags=["Executive Reports"])
api_v1_router.include_router(ml.router, prefix="/datasets", tags=["Predictive Analytics & ML"])


