import {
  HealthStatus,
  DatasetListResponse,
  DatasetProfileData,
  DatasetQualityResponse,
  CleaningPlan,
  CleaningPreviewResponse,
  CleaningApplyResponse,
  TransformationHistoryResponse,
  EDAResponse,
  KPIMetric,
  TrendMetric,
  RelationshipMetric,
  InsightResponse,
  ExecutiveReport,
  MLTaskDiscoveryResponse,
  MLAnalysisResponse,
  PredictionResponse,
  OptimizationOptionResponse,
  OptimizationRequest,
  OptimizationResponse,
  DecisionRecommendation,
  RecommendationResponse,
  DecisionGuardrailResponse,
  GuardrailBatchResponse,
  DecisionCommandCenterResponse,
  DecisionBriefResponse,
  DecisionOutcome,
  DecisionMemoryResponse,
  DecisionPerformanceSummary,
  ScenarioCreateRequest,
  ScenarioResponse,
  ScenarioComparisonResponse,
  DecisionSummaryResponse,
  MLExplanationResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    return {
      status: 'unhealthy',
      project_name: 'InsightFlow AI',
      version: '0.1.0',
      environment: 'development',
      timestamp: new Date().toISOString(),
      database_connected: false,
      details: error.message || 'Unable to connect to FastAPI backend service.',
    };
  }
}

export async function fetchDatasets(): Promise<DatasetListResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/datasets`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.warn('Dataset API currently unreachable:', error);
    return {
      total: 0,
      items: [],
    };
  }
}

export async function uploadDataset(file: File): Promise<DatasetProfileData> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Upload failed with status ${response.status}`);
  }

  return await response.json();
}

export async function fetchDatasetProfile(datasetId: string): Promise<DatasetProfileData> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/profile`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch dataset profile (${response.status})`);
  }

  return await response.json();
}

// Phase 2 APIs

export async function fetchDatasetQuality(datasetId: string): Promise<DatasetQualityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/quality`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch dataset quality evaluation (${response.status})`);
  }

  return await response.json();
}

export async function previewCleaningPlan(
  datasetId: string,
  plan: CleaningPlan
): Promise<CleaningPreviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/clean/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(plan),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Preview failed with status ${response.status}`);
  }

  return await response.json();
}

export async function applyCleaningPlan(
  datasetId: string,
  plan: CleaningPlan
): Promise<CleaningApplyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/clean/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(plan),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Apply failed with status ${response.status}`);
  }

  return await response.json();
}

export async function fetchTransformationHistory(
  datasetId: string
): Promise<TransformationHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/transformations`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch transformation history (${response.status})`);
  }

  return await response.json();
}

export function getDownloadUrl(datasetId: string, version: 'raw' | 'processed' = 'raw'): string {
  return `${API_BASE_URL}/api/v1/datasets/${datasetId}/download?version=${version}`;
}

// Phase 3 EDA APIs

export async function generateEDA(datasetId: string): Promise<EDAResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/eda`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to generate EDA analysis (${response.status})`);
  }

  return await response.json();
}

export async function fetchEDA(datasetId: string): Promise<EDAResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/eda`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch EDA analysis (${response.status})`);
  }

  return await response.json();
}

export async function fetchKPIs(datasetId: string): Promise<KPIMetric[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/kpis`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch KPIs (${response.status})`);
  }

  return await response.json();
}

export async function fetchTrends(datasetId: string): Promise<TrendMetric[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/trends`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch trends (${response.status})`);
  }

  return await response.json();
}

export async function fetchRelationships(datasetId: string): Promise<RelationshipMetric[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/relationships`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch relationships (${response.status})`);
  }

  return await response.json();
}

// Phase 4 Business Insights APIs

export async function fetchInsights(datasetId: string): Promise<InsightResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/insights`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Unable to fetch business insights (${response.status})`);
  }

  return await response.json();
}

export async function generateInsights(datasetId: string): Promise<InsightResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/insights/generate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to generate business insights (${response.status})`);
  }

  return await response.json();
}

// Phase 5 Executive Report & Export APIs

export async function fetchExecutiveReport(datasetId: string): Promise<ExecutiveReport> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/reports/executive`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch executive report (${response.status})`);
  }

  return await response.json();
}

export function getReportMarkdownExportUrl(datasetId: string): string {
  return `${API_BASE_URL}/api/v1/datasets/${datasetId}/reports/export`;
}

export function getReportJsonExportUrl(datasetId: string): string {
  return `${API_BASE_URL}/api/v1/datasets/${datasetId}/reports/export/json`;
}

// Phase 6 Predictive Analytics & ML APIs

export async function fetchMLTasks(datasetId: string): Promise<MLTaskDiscoveryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/tasks`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Unable to discover ML tasks (${response.status})`);
  }

  return await response.json();
}

export async function runMLAnalysis(
  datasetId: string,
  taskType?: string,
  targetColumn?: string
): Promise<MLAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      task_type: taskType || null,
      target_column: targetColumn || null,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to run ML analysis (${response.status})`);
  }

  return await response.json();
}

export async function fetchMLAnalyses(datasetId: string): Promise<MLAnalysisResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ML analyses (${response.status})`);
  }

  return await response.json();
}

export async function fetchMLAnalysisById(datasetId: string, analysisId: string): Promise<MLAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/${analysisId}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ML analysis details (${response.status})`);
  }

  return await response.json();
}

export async function runMLPrediction(
  datasetId: string,
  analysisId: string,
  inputs: Record<string, any>[]
): Promise<PredictionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/${analysisId}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Prediction failed with status ${response.status}`);
  }

  return await response.json();
}

export async function explainMLModel(
  datasetId: string,
  analysisId: string
): Promise<MLExplanationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/${analysisId}/explain`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to explain ML model (${response.status})`);
  }

  return await response.json();
}

// Phase 7.0 - 7.1 Decision Intelligence & Scenario Simulation APIs

export async function fetchDecisionSummary(datasetId: string): Promise<DecisionSummaryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch decision summary (${response.status})`);
  }

  return await response.json();
}

export async function evaluateWhatIfScenario(
  datasetId: string,
  payload: ScenarioCreateRequest
): Promise<ScenarioResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/scenarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to evaluate scenario (${response.status})`);
  }

  return await response.json();
}

export async function fetchWhatIfScenarios(datasetId: string): Promise<ScenarioResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/scenarios`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scenarios (${response.status})`);
  }

  return await response.json();
}

export async function compareWhatIfScenario(
  datasetId: string,
  scenarioId: string
): Promise<ScenarioComparisonResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/scenarios/${scenarioId}/compare`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to compare scenario (${response.status})`);
  }

  return await response.json();
}

// Phase 7.2 Decision Optimization APIs

export async function fetchOptimizationOptions(
  datasetId: string,
  analysisId?: string
): Promise<OptimizationOptionResponse> {
  const url = analysisId
    ? `${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/optimization/options?analysis_id=${encodeURIComponent(analysisId)}`
    : `${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/optimization/options`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch optimization options (${response.status})`);
  }

  return await response.json();
}

export async function runOptimization(
  datasetId: string,
  payload: OptimizationRequest
): Promise<OptimizationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Optimization execution failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchOptimizations(datasetId: string): Promise<OptimizationResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/optimizations`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch optimizations (${response.status})`);
  }

  return await response.json();
}

export async function fetchOptimizationById(datasetId: string, optimizationId: string): Promise<OptimizationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/optimizations/${optimizationId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch optimization details (${response.status})`);
  }

  return await response.json();
}

export async function generateRecommendations(
  datasetId: string,
  optimizationId: string,
  maxRecommendations: number = 3
): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      optimization_id: optimizationId,
      max_recommendations: maxRecommendations,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Recommendation generation failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchRecommendations(datasetId: string): Promise<DecisionRecommendation[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/recommendations`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recommendations (${response.status})`);
  }

  return await response.json();
}

export async function fetchRecommendationById(datasetId: string, recommendationId: string): Promise<DecisionRecommendation> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/recommendations/${recommendationId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recommendation (${response.status})`);
  }

  return await response.json();
}

// Phase 7.4 Decision Guardrails APIs

export async function evaluateGuardrailsForRecommendation(
  datasetId: string,
  recommendationId: string
): Promise<DecisionGuardrailResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/recommendations/${recommendationId}/guardrails`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Guardrail evaluation failed (${response.status})`);
  }

  return await response.json();
}

export async function evaluateAllGuardrails(datasetId: string): Promise<GuardrailBatchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/guardrails`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Batch guardrail evaluation failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchGuardrailsForDataset(datasetId: string): Promise<DecisionGuardrailResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/guardrails`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset guardrails (${response.status})`);
  }

  return await response.json();
}

export async function getGuardrailByRecommendationId(
  datasetId: string,
  recommendationId: string
): Promise<DecisionGuardrailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/recommendations/${recommendationId}/guardrails`,
    {
      headers: { 'Accept': 'application/json' },
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch recommendation guardrails (${response.status})`);
  }

  return await response.json();
}

// Phase 7.5 Decision Command Center API

export async function fetchDecisionCommandCenter(datasetId: string): Promise<DecisionCommandCenterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/command-center`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Command center aggregation failed (${response.status})`);
  }

  return await response.json();
}

// Phase 7.6 AI Decision Brief Engine APIs

export async function generateDecisionBrief(
  datasetId: string,
  recommendationId?: string
): Promise<DecisionBriefResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/brief`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ recommendation_id: recommendationId || null }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Brief generation failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionBrief(datasetId: string): Promise<DecisionBriefResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/brief`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AI decision brief (${response.status})`);
  }

  return await response.json();
}

// Phase 7.7 Decision Memory & Outcome Feedback APIs

export async function recordDecisionOutcome(
  datasetId: string,
  payload: {
    recommendation_id: string;
    actual_metric: string;
    actual_value: number;
    notes?: string;
  }
): Promise<DecisionOutcome> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/outcomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Recording outcome failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionOutcomes(datasetId: string): Promise<DecisionOutcome[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/outcomes`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset outcomes (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionOutcomeById(datasetId: string, outcomeId: string): Promise<DecisionOutcome> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/outcomes/${outcomeId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch decision outcome (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionMemory(datasetId: string): Promise<DecisionMemoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/memory`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch decision memory (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionPerformance(datasetId: string): Promise<DecisionPerformanceSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/performance`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch decision performance (${response.status})`);
  }

  return await response.json();
}








