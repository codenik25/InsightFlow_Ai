from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.decision import (
    ScenarioCreateRequest,
    ScenarioResponse,
    DecisionRecommendationResponse,
    DecisionSummaryResponse,
    ScenarioComparisonResponse,
)
from app.schemas.optimization import (
    OptimizationOptionResponse,
    OptimizationRequest,
    OptimizationResponse,
)
from app.services.decision_service import DecisionService
from app.services.optimization_service import OptimizationService

router = APIRouter()




@router.get("/{dataset_id}/decision", response_model=DecisionSummaryResponse)
def get_decision_summary(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> DecisionSummaryResponse:
    """Retrieve full Decision Intelligence summary (scenarios and recommendations) for a dataset."""
    return DecisionService.get_decision_summary(db=db, dataset_id=dataset_id)


@router.post("/{dataset_id}/decision/scenarios", response_model=ScenarioResponse)
def evaluate_what_if_scenario(
    dataset_id: str,
    payload: ScenarioCreateRequest,
    db: Session = Depends(get_db),
) -> ScenarioResponse:
    """Execute a what-if scenario simulation on a processed dataset and compute feature explainability."""
    return DecisionService.evaluate_scenario(db=db, dataset_id=dataset_id, payload=payload)


@router.get("/{dataset_id}/decision/scenarios", response_model=List[ScenarioResponse])
def list_what_if_scenarios(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[ScenarioResponse]:
    """Retrieve all previously evaluated what-if scenarios for a dataset."""
    return DecisionService.get_scenarios_for_dataset(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/decision/scenarios/{scenario_id}/compare", response_model=ScenarioComparisonResponse)
def compare_what_if_scenario(
    dataset_id: str,
    scenario_id: str,
    db: Session = Depends(get_db),
) -> ScenarioComparisonResponse:
    """Get side-by-side baseline vs scenario comparison and feature attribution breakdown."""
    return DecisionService.compare_scenario(db=db, dataset_id=dataset_id, scenario_id=scenario_id)


@router.post("/{dataset_id}/decision/recommendations", response_model=List[DecisionRecommendationResponse])
def generate_decision_recommendations(
    dataset_id: str,
    scenario_id: Optional[str] = None,
    ml_analysis_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[DecisionRecommendationResponse]:
    """Generate evidence-backed recommendations by combining predictions and Phase 4 business insights."""
    return DecisionService.generate_recommendations(
        db=db, dataset_id=dataset_id, scenario_id=scenario_id, ml_analysis_id=ml_analysis_id
    )


@router.get("/{dataset_id}/decision/recommendations", response_model=List[DecisionRecommendationResponse])
def list_decision_recommendations(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[DecisionRecommendationResponse]:
    """Retrieve all stored decision recommendations for a dataset."""
    return DecisionService.get_recommendations_for_dataset(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/decision/optimization/options", response_model=OptimizationOptionResponse)
def get_optimization_options(
    dataset_id: str,
    analysis_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> OptimizationOptionResponse:
    """Discover controllable features available for optimization and explain exclusion rationale."""
    return OptimizationService.discover_controllable_features(
        db=db, dataset_id=dataset_id, analysis_id=analysis_id
    )


@router.post("/{dataset_id}/decision/optimize", response_model=OptimizationResponse)
def run_decision_optimization(
    dataset_id: str,
    payload: OptimizationRequest,
    db: Session = Depends(get_db),
) -> OptimizationResponse:
    """Deterministically generate candidate what-if scenarios, evaluate via ML artifact, and rank by objective."""
    return OptimizationService.run_optimization(
        db=db, dataset_id=dataset_id, payload=payload
    )


@router.get("/{dataset_id}/decision/optimizations", response_model=List[OptimizationResponse])
def list_decision_optimizations(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> List[OptimizationResponse]:
    """Retrieve all previously executed optimization runs for a dataset."""
    return OptimizationService.get_optimizations_for_dataset(db=db, dataset_id=dataset_id)


@router.get("/{dataset_id}/decision/optimizations/{optimization_id}", response_model=OptimizationResponse)
def get_decision_optimization_by_id(
    dataset_id: str,
    optimization_id: str,
    db: Session = Depends(get_db),
) -> OptimizationResponse:
    """Retrieve a specific decision optimization run by ID."""
    return OptimizationService.get_optimization_by_id(
        db=db, dataset_id=dataset_id, optimization_id=optimization_id
    )


