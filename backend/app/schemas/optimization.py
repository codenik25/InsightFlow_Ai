from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

OptimizationObjective = Literal["maximize", "minimize"]


class ControllableFeatureInfo(BaseModel):
    column: str = Field(..., description="Feature column name")
    data_type: str = Field(..., description="Inferred data type (e.g. numeric, categorical)")
    role: str = Field(..., description="Column role classification")
    current_value: Optional[Any] = Field(None, description="Historical mean or mode value")
    min_value: Optional[float] = Field(None, description="Minimum numeric boundary in processed dataset")
    max_value: Optional[float] = Field(None, description="Maximum numeric boundary in processed dataset")
    categories: Optional[List[str]] = Field(None, description="Supported distinct categorical values")
    importance: float = Field(0.0, description="Normalized model feature importance weight (0.0 to 1.0)")
    allowed: bool = Field(..., description="Whether this feature is allowed as a controllable optimization lever")
    exclusion_reason: Optional[str] = Field(None, description="Reason if excluded from optimization")
    optimization_supported: bool = Field(..., description="Whether optimization engine can safely perturb this feature")


class FeatureConstraint(BaseModel):
    min: Optional[float] = Field(None, description="Optional min bound constraint")
    max: Optional[float] = Field(None, description="Optional max bound constraint")


class OptimizationConstraints(BaseModel):
    min_change_percent: Optional[float] = Field(None, description="Minimum allowed percentage change")
    max_change_percent: Optional[float] = Field(None, description="Maximum allowed percentage change")
    absolute_min: Optional[float] = Field(None, description="Absolute lower bound constraint")
    absolute_max: Optional[float] = Field(None, description="Absolute upper bound constraint")
    max_scenarios: int = Field(10, description="Maximum number of candidate scenarios to generate")



class OptimizationRequest(BaseModel):
    analysis_id: Optional[str] = Field(None, description="Target ML analysis ID (auto-selected if omitted)")
    baseline_inputs: Optional[Dict[str, Any]] = Field(None, description="Baseline feature inputs")
    objective: OptimizationObjective = Field("maximize", description="Optimization objective (maximize or minimize)")
    max_scenarios: int = Field(10, ge=1, le=50, description="Maximum candidate scenarios to evaluate")
    feature_constraints: Optional[Dict[str, FeatureConstraint]] = Field(None, description="User feature constraints")


class OptimizationOptionResponse(BaseModel):
    dataset_id: str
    analysis_id: str
    target_column: str
    objective_options: List[str] = Field(default_factory=lambda: ["maximize", "minimize"])
    controllable_features: List[ControllableFeatureInfo] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class OptimizationScenario(BaseModel):
    rank: int = Field(..., description="Scenario rank (1 = best)")
    scenario_id: str = Field(..., description="Unique scenario ID")
    changes: Dict[str, Any] = Field(..., description="Modified feature key-value pairs")
    inputs: Dict[str, Any] = Field(..., description="Complete input record evaluated")
    predicted_target: float = Field(..., description="Model predicted target outcome")
    baseline_prediction: float = Field(..., description="Model baseline prediction")
    absolute_delta: float = Field(..., description="Absolute change vs baseline")
    percentage_delta: float = Field(..., description="Percentage change vs baseline")
    feasibility: str = Field("Feasible", description="Feasibility indicator")
    explanation: str = Field(..., description="Deterministic non-causal explanation")


class OptimizationResponse(BaseModel):
    optimization_id: str = Field(..., description="Optimization run ID")
    dataset_id: str = Field(..., description="Dataset ID")
    ml_analysis_id: str = Field(..., description="ML Analysis ID")
    target_column: str = Field(..., description="Target column optimized")
    objective: str = Field(..., description="Optimization objective")
    baseline_inputs: Dict[str, Any] = Field(..., description="Baseline feature inputs used")
    baseline_prediction: float = Field(..., description="Baseline prediction outcome")
    scenarios: List[OptimizationScenario] = Field(default_factory=list, description="Ranked scenario results")
    best_scenario: Optional[OptimizationScenario] = Field(None, description="Rank #1 best scenario")
    warning: Optional[str] = Field(None, description="Informational warning message")
    generated_at: str = Field(..., description="ISO timestamp")
