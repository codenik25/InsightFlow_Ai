from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_portfolio import (
    DecisionPortfolioOverviewResponse,
    DecisionPortfolioTrendsResponse,
    DecisionPortfolioMetricsResponse,
    DecisionPortfolioSignalsResponse,
    DecisionPortfolioDependenciesResponse,
    PortfolioCapacityResponse,
)
from app.services.decision_portfolio_service import DecisionPortfolioService

router = APIRouter()


@router.get(
    "/{project_id}/decision-portfolio",
    response_model=DecisionPortfolioOverviewResponse,
    summary="Get project decision portfolio overview",
)
def get_decision_portfolio_overview(
    project_id: str = Path(..., description="Project ID"),
    governance_status: Optional[str] = Query(None, description="Filter by governance state"),
    execution_status: Optional[str] = Query(None, description="Filter by execution state"),
    outcome_status: Optional[str] = Query(None, description="Filter by outcome state"),
    metric: Optional[str] = Query(None, description="Filter by metric name"),
    signal_type: Optional[str] = Query(None, description="Filter by learning signal type"),
    date_from: Optional[datetime] = Query(None, description="Filter decisions created on/after this date"),
    date_to: Optional[datetime] = Query(None, description="Filter decisions created on/before this date"),
    min_observations: int = Query(3, ge=1, description="Minimum observations required for recurring deviations"),
    db: Session = Depends(get_db),
):
    """
    Retrieve read-only decision portfolio intelligence for a project.
    Aggregates KPIs, governance and execution distributions, outcome tracking,
    cross-decision metric patterns, recurring deviations, active learning signals,
    execution failures, and explicit dependencies.
    """
    return DecisionPortfolioService.get_portfolio_overview(
        db=db,
        project_id=project_id,
        governance_status_filter=governance_status,
        execution_status_filter=execution_status,
        outcome_status_filter=outcome_status,
        metric_filter=metric,
        signal_type_filter=signal_type,
        date_from=date_from,
        date_to=date_to,
        min_observations=min_observations,
    )


@router.get(
    "/{project_id}/decision-portfolio/trends",
    response_model=DecisionPortfolioTrendsResponse,
    summary="Get project decision portfolio chronological trends",
)
def get_decision_portfolio_trends(
    project_id: str = Path(..., description="Project ID"),
    period: str = Query("week", pattern="^(day|week|month)$", description="Bucketing period: day, week, month"),
    date_from: Optional[datetime] = Query(None, description="Filter trends on/after this date"),
    date_to: Optional[datetime] = Query(None, description="Filter trends on/before this date"),
    db: Session = Depends(get_db),
):
    """
    Retrieve chronological decision lifecycle trends (creations, approvals, executions,
    outcomes, learning signals, failures) aggregated by Day, Week, or Month.
    """
    return DecisionPortfolioService.get_decision_trends(
        db=db,
        project_id=project_id,
        period=period,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/{project_id}/decision-portfolio/metrics",
    response_model=DecisionPortfolioMetricsResponse,
    summary="Get cross-decision metric intelligence",
)
def get_decision_portfolio_metrics(
    project_id: str = Path(..., description="Project ID"),
    min_observations: int = Query(3, ge=1, description="Minimum observations required for recurring deviations"),
    db: Session = Depends(get_db),
):
    """
    Retrieve metrics appearing across multiple decisions in this project,
    their observed outcomes, and empirical recurring deviation findings.
    """
    return DecisionPortfolioService.get_metric_patterns(
        db=db,
        project_id=project_id,
        min_observations=min_observations,
    )


@router.get(
    "/{project_id}/decision-portfolio/signals",
    response_model=DecisionPortfolioSignalsResponse,
    summary="Get learning signal portfolio summary",
)
def get_decision_portfolio_signals(
    project_id: str = Path(..., description="Project ID"),
    db: Session = Depends(get_db),
):
    """
    Retrieve active Phase 8 learning signals across the portfolio,
    grouped by severity and signal type.
    """
    return DecisionPortfolioService.get_learning_signal_summary(
        db=db,
        project_id=project_id,
    )


@router.get(
    "/{project_id}/decision-portfolio/dependencies",
    response_model=DecisionPortfolioDependenciesResponse,
    summary="Get explicit decision dependencies and clusters",
)
def get_decision_portfolio_dependencies(
    project_id: str = Path(..., description="Project ID"),
    db: Session = Depends(get_db),
):
    """
    Retrieve explicit shared dependencies (dataset versions, scenarios, ML models, metrics)
    and factual clusters across decisions.
    """
    return DecisionPortfolioService.get_dependencies_and_clusters(
        db=db,
        project_id=project_id,
    )


@router.get(
    "/{project_id}/decision-portfolio/capacity",
    response_model=PortfolioCapacityResponse,
    summary="Get portfolio risk, capacity and dependency intelligence",
)
def get_decision_portfolio_capacity(
    project_id: str = Path(..., description="Project ID"),
    db: Session = Depends(get_db),
):
    """
    Retrieve read-only project-level portfolio risk, capacity, concentration,
    and dependency intelligence. Strictly descriptive from persisted records.
    """
    return DecisionPortfolioService.get_portfolio_capacity(
        db=db,
        project_id=project_id,
    )

