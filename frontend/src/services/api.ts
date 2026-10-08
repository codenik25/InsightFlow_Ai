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
  DecisionOutcomePhase6,
  DecisionOutcomeCreatePhase6Payload,
  DecisionOutcomeFromVersionPayload,
  DecisionOutcomesListResponse,
  DecisionMemoryResponse,
  DecisionPerformanceSummary,
  ForecastTaskDiscoveryResponse,
  ForecastAnalysisResponse,
  AnomalyAnalysisResponse,
  ScenarioCreateRequest,
  ScenarioResponse,
  ScenarioComparisonResponse,
  DecisionSummaryResponse,
  MLExplanationResponse,
  Workspace,
  Project,
  ProjectWithDatasets,
  DatasetVersionListResponse,
  DatasetComparisonResponse,
  AnalysisRun,
  AnalysisRunListResponse,
  InsightMemoryListResponse,
  InsightImpactComparisonResponse,
  EvidenceGraphResponse,
  EvidenceChainResponse,
  DecisionPerformanceResponse,
  MetricPerformanceItem,
  TrendPeriodItem,
  ModelPerformanceItem,
  ScenarioPerformanceItem,
  DecisionLearningSignalRecord,
  DecisionLearningSignalUpdate,
  DecisionLearningSignalsListResponse,
  DecisionGovernanceResponse,
  GovernanceTransitionPayload,
  GovernanceEvent,
  DecisionExecutionResponse,
  ExecutionRequestPayload,
  ExecutionConfirmPayload,
  ExecutionFailPayload,
  ExecutionNotExecutedPayload,
  DecisionExecutionHistoryResponse,
  IndividualDecisionReportResponse,
  ProjectDecisionReportResponse,
  DecisionKnowledgeEntry,
  ProjectKnowledgeListResponse,
  KnowledgeEntryCreatePayload,
  KnowledgeEntryUpdatePayload,
  User,
  AuthResponse,
  ExistingDatasetSummary,
  ExistingDatasetListResponse,
} from '../types';

export type {
  IndividualDecisionReportResponse,
  ProjectDecisionReportResponse,
  DecisionKnowledgeEntry,
  ProjectKnowledgeListResponse,
  KnowledgeEntryCreatePayload,
  KnowledgeEntryUpdatePayload,
  User,
  AuthResponse,
  ExistingDatasetSummary,
  ExistingDatasetListResponse,
};


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const AUTH_TOKEN_KEY = 'insightflow_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string, persist: boolean = true) {
  if (persist) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(extractErrorMessage(errData, 'Failed to sign in. Please verify your credentials.'));
  }
  const data: AuthResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

export async function registerUser(email: string, password: string, fullName: string, role?: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, full_name: fullName, role: role || 'Admin' }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(extractErrorMessage(errData, 'Failed to create account.'));
  }
  const data: AuthResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 401) {
        clearAuthToken();
      }
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    const headers = getAuthHeaders();
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
  } catch {
    // Ignore network error on logout
  } finally {
    clearAuthToken();
  }
}

export async function fetchExistingDatasets(projectId?: string | null): Promise<ExistingDatasetListResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const url = projectId
    ? `${API_BASE_URL}/api/v1/datasets/existing?project_id=${projectId}`
    : `${API_BASE_URL}/api/v1/datasets/existing`;
    
  const response = await fetch(url, {
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(extractErrorMessage(errData, 'Failed to retrieve datasets.'));
  }
  return await response.json();
}

export function extractErrorMessage(errData: any, fallback: string): string {
  if (!errData) return fallback;
  if (typeof errData === 'string') return errData;
  if (typeof errData.detail === 'string') return errData.detail;
  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    const first = errData.detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first.msg === 'string') {
      const field = Array.isArray(first.loc) ? first.loc.slice(1).join('.') : '';
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }
  if (typeof errData.message === 'string') return errData.message;
  if (typeof errData.error === 'string') return errData.error;
  return fallback;
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load workspaces (${response.status})`);
  }
  return await response.json();
}

export async function createWorkspace(data: { name: string; description?: string }): Promise<Workspace> {
  const response = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(extractErrorMessage(errData, 'Failed to create workspace'));
  }
  return await response.json();
}


export async function fetchProjects(workspaceId?: string): Promise<Project[]> {
  const url = workspaceId 
    ? `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/projects`
    : `${API_BASE_URL}/api/v1/projects`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load projects (${response.status})`);
  }
  return await response.json();
}

export async function createProject(data: { workspace_id?: string; name: string; description?: string }): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(errData.detail || 'Failed to create project');
  }
  return await response.json();
}

export async function updateProject(projectId: string, data: { name?: string; description?: string }): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(errData.detail || 'Failed to update project');
  }
  return await response.json();
}

export async function fetchProjectDatasets(projectId: string): Promise<ProjectWithDatasets> {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/datasets`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load project dataset registry (${response.status})`);
  }
  return await response.json();
}

export async function fetchProjectVersions(projectId: string, lineage?: string): Promise<DatasetVersionListResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/projects/${projectId}/versions`);
  if (lineage) {
    url.searchParams.append('lineage', lineage);
  }
  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load project versions (${response.status})`);
  }
  return await response.json();
}

export async function fetchDatasetVersions(datasetId: string): Promise<DatasetVersionListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/versions`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load dataset versions (${response.status})`);
  }
  return await response.json();
}

export async function compareDatasetVersions(baseId: string, comparisonId: string): Promise<DatasetComparisonResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${baseId}/compare/${comparisonId}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(errData.detail || `Comparison failed (${response.status})`);
  }
  return await response.json();
}

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

export async function fetchDatasets(projectId?: string): Promise<DatasetListResponse> {
  try {
    const url = projectId 
      ? `${API_BASE_URL}/api/v1/datasets?project_id=${encodeURIComponent(projectId)}`
      : `${API_BASE_URL}/api/v1/datasets`;
    const response = await fetch(url, {
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

export async function uploadDataset(file: File, projectId?: string): Promise<DatasetProfileData> {
  const formData = new FormData();
  formData.append('file', file);
  if (projectId) {
    formData.append('project_id', projectId);
  }

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
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/analyze`, {
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
  } catch (err: any) {
    throw new Error(`Network Error: Unable to reach the backend or CORS issue. (${err.message || 'Failed to fetch'})`);
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errData = await response.json();
      errorMessage = errData.detail || errData.message || errData.error || errorMessage;
    } catch (e) {
      // Failed to parse JSON, stick with generic status message
    }
    
    if (response.status === 404) {
      throw new Error(`Endpoint or resource not found (404): ${errorMessage}`);
    } else if (response.status === 422) {
      throw new Error(`Validation Error (422): ${errorMessage}`);
    } else if (response.status >= 500) {
      throw new Error(`Server Error (${response.status}): ${errorMessage}`);
    } else {
      throw new Error(`API Error (${response.status}): ${errorMessage}`);
    }
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
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/ml/${analysisId}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ inputs }),
    });
  } catch (err: any) {
    throw new Error(`Network Error: Unable to reach the backend or CORS issue. (${err.message || 'Failed to fetch'})`);
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errData = await response.json();
      errorMessage = errData.detail || errData.message || errData.error || errorMessage;
    } catch (e) {
      // Failed to parse JSON
    }
    
    if (response.status === 404) {
      throw new Error(`Endpoint or resource not found (404): ${errorMessage}`);
    } else if (response.status === 422) {
      throw new Error(`Validation Error (422): ${errorMessage}`);
    } else if (response.status >= 500) {
      throw new Error(`Server Error (${response.status}): ${errorMessage}`);
    } else {
      throw new Error(`API Error (${response.status}): ${errorMessage}`);
    }
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
  optimizationId?: string,
  maxRecommendations: number = 3
): Promise<RecommendationResponse> {
  const url = `${API_BASE_URL}/api/v1/datasets/${datasetId}/decision/optimize/recommendations`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      ...(optimizationId ? { optimization_id: optimizationId } : {}),
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

// ============================================================================
// Phase 6 — Decision Outcome & Learning Loop Client APIs
// ============================================================================

export async function fetchDecisionOutcomesPhase6(
  decisionId: string
): Promise<DecisionOutcomesListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/decisions/${decisionId}/outcomes`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch decision outcomes (${response.status})`);
  }

  return await response.json();
}

export async function recordDecisionOutcomePhase6(
  decisionId: string,
  payload: DecisionOutcomeCreatePhase6Payload
): Promise<DecisionOutcomePhase6> {
  const response = await fetch(`${API_BASE_URL}/api/v1/decisions/${decisionId}/outcomes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Recording decision outcome failed (${response.status})`);
  }

  return await response.json();
}

export async function recordDecisionOutcomeFromVersion(
  decisionId: string,
  payload: DecisionOutcomeFromVersionPayload
): Promise<DecisionOutcomePhase6> {
  const response = await fetch(`${API_BASE_URL}/api/v1/decisions/${decisionId}/outcomes/from-version`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Recording outcome from version failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionOutcomeRecordById(
  outcomeId: string
): Promise<DecisionOutcomePhase6> {
  const response = await fetch(`${API_BASE_URL}/api/v1/outcomes/${outcomeId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch outcome record (${response.status})`);
  }

  return await response.json();
}

export async function fetchProjectOutcomes(
  projectId: string
): Promise<DecisionOutcomePhase6[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/outcomes`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch project outcomes (${response.status})`);
  }

  return await response.json();
}


// Demand Forecasting APIs

export async function fetchForecastTasks(datasetId: string): Promise<ForecastTaskDiscoveryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/forecast/tasks`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to discover forecast tasks (${response.status})`);
  }

  return await response.json();
}

export async function runForecastAnalysis(
  datasetId: string,
  targetColumn?: string,
  timeColumn?: string,
  horizon: number = 30
): Promise<ForecastAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/forecast/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      target_column: targetColumn || null,
      time_column: timeColumn || null,
      horizon,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Forecast analysis failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchForecastResult(
  datasetId: string,
  forecastId: string
): Promise<ForecastAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/forecast/${forecastId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch forecast result (${response.status})`);
  }

  return await response.json();
}

// Anomaly Intelligence APIs

export async function runAnomalyAnalysis(
  datasetId: string,
  featureColumns?: string[],
  contamination?: number
): Promise<AnomalyAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/anomaly/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      feature_columns: featureColumns || null,
      contamination: contamination || null,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Anomaly analysis failed (${response.status})`);
  }

  return await response.json();
}

export async function fetchAnomalyResult(datasetId: string): Promise<AnomalyAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/anomaly`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch anomaly results (${response.status})`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchAnomalyById(
  datasetId: string,
  anomalyId: string
): Promise<AnomalyAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/datasets/${datasetId}/anomaly/${anomalyId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch anomaly details (${response.status})`);
  }

  return await response.json();
}

export async function getProjectRuns(
  projectId: string,
  params?: {
    run_type?: string;
    status?: string;
    dataset_version?: number;
    limit?: number;
    offset?: number;
  }
): Promise<AnalysisRunListResponse> {
  const query = new URLSearchParams();
  if (params?.run_type) query.append('run_type', params.run_type);
  if (params?.status) query.append('status', params.status);
  if (params?.dataset_version !== undefined) query.append('dataset_version', params.dataset_version.toString());
  if (params?.limit !== undefined) query.append('limit', params.limit.toString());
  if (params?.offset !== undefined) query.append('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/v1/projects/${projectId}/runs${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch project analysis runs (${response.status})`);
  }

  return await response.json();
}

export async function getDatasetRuns(
  datasetId: string,
  params?: {
    run_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<AnalysisRunListResponse> {
  const query = new URLSearchParams();
  if (params?.run_type) query.append('run_type', params.run_type);
  if (params?.status) query.append('status', params.status);
  if (params?.limit !== undefined) query.append('limit', params.limit.toString());
  if (params?.offset !== undefined) query.append('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/v1/datasets/${datasetId}/runs${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch dataset analysis runs (${response.status})`);
  }

  return await response.json();
}

export async function getAnalysisRun(
  runId: string,
  projectId?: string
): Promise<AnalysisRun> {
  const query = new URLSearchParams();
  if (projectId) query.append('project_id', projectId);

  const url = `${API_BASE_URL}/api/v1/runs/${runId}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch analysis run (${response.status})`);
  }

  return await response.json();
}

// Phase 4: AI Insight Memory & Impact Tracking APIs

export async function fetchProjectInsightMemory(
  projectId: string,
  params?: {
    status?: string;
    category?: string;
    lineage?: string;
    dataset_version?: number;
    limit?: number;
    offset?: number;
  }
): Promise<InsightMemoryListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.category) query.append('category', params.category);
  if (params?.lineage) query.append('lineage', params.lineage);
  if (params?.dataset_version !== undefined) query.append('dataset_version', params.dataset_version.toString());
  if (params?.limit !== undefined) query.append('limit', params.limit.toString());
  if (params?.offset !== undefined) query.append('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/v1/projects/${projectId}/insight-memory${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch project insight memory (${response.status})`);
  }

  return await response.json();
}

export async function fetchDatasetInsightMemory(
  datasetId: string,
  params?: {
    status?: string;
    category?: string;
  }
): Promise<InsightMemoryListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.category) query.append('category', params.category);

  const url = `${API_BASE_URL}/api/v1/datasets/${datasetId}/insight-memory${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch dataset insight memory (${response.status})`);
  }

  return await response.json();
}

export async function fetchInsightImpactComparison(
  baseId: string,
  comparisonId: string
): Promise<InsightImpactComparisonResponse> {
  const url = `${API_BASE_URL}/api/v1/datasets/${baseId}/insight-impact/${comparisonId}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to compare insight impacts (${response.status})`);
  }

  return await response.json();
}

export async function fetchRunInsights(runId: string): Promise<any[]> {
  const url = `${API_BASE_URL}/api/v1/runs/${runId}/insights`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch run insights (${response.status})`);
  }

  return await response.json();
}

// Phase 5: Decision Evidence Graph & Traceability APIs
export async function fetchProjectEvidenceGraph(
  projectId: string,
  nodeType?: string,
  limit: number = 200
): Promise<EvidenceGraphResponse> {
  let url = `${API_BASE_URL}/api/v1/projects/${projectId}/evidence?limit=${limit}`;
  if (nodeType) {
    url += `&node_type=${encodeURIComponent(nodeType)}`;
  }
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
    throw new Error(errData.detail || `Failed to fetch project evidence graph (${response.status})`);
  }

  return await response.json();
}

const inFlightRequests = new Map<string, Promise<any>>();

async function fetchWithDedupAndTimeout<T>(url: string, timeoutMs = 10000): Promise<T> {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)! as Promise<T>;
  }

  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: `HTTP error ${response.status}` }));
        throw new Error(errData.detail || `Request failed with status ${response.status}`);
      }
      return await response.json();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, promise);
  return promise as Promise<T>;
}

export async function fetchDatasetEvidenceGraph(
  datasetId: string
): Promise<EvidenceGraphResponse> {
  const url = `${API_BASE_URL}/api/v1/datasets/${datasetId}/evidence`;
  return fetchWithDedupAndTimeout<EvidenceGraphResponse>(url, 10000);
}

export async function fetchRunEvidenceGraph(
  runId: string
): Promise<EvidenceGraphResponse> {
  const url = `${API_BASE_URL}/api/v1/runs/${runId}/evidence`;
  return fetchWithDedupAndTimeout<EvidenceGraphResponse>(url, 10000);
}

export async function fetchNodeEvidence(
  nodeType: string,
  nodeId: string
): Promise<EvidenceGraphResponse> {
  const url = `${API_BASE_URL}/api/v1/evidence/${encodeURIComponent(nodeType)}/${encodeURIComponent(nodeId)}`;
  return fetchWithDedupAndTimeout<EvidenceGraphResponse>(url, 10000);
}

export async function fetchDecisionEvidenceChain(
  decisionId: string
): Promise<EvidenceChainResponse> {
  const url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/evidence`;
  return fetchWithDedupAndTimeout<EvidenceChainResponse>(url, 10000);
}

// =====================================================================
// Phase 7 — Decision Performance Intelligence API
// =====================================================================

export async function fetchProjectDecisionPerformance(
  projectId: string,
  minObservations: number = 3,
  period: string = 'week',
  threshold: number = 0.05
): Promise<DecisionPerformanceResponse> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-performance?min_observations=${minObservations}&period=${encodeURIComponent(period)}&threshold=${threshold}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision performance intelligence (${response.status})`);
  }

  return await response.json();
}

export async function fetchPerformanceByMetric(
  projectId: string,
  minObservations: number = 3,
  threshold: number = 0.05
): Promise<MetricPerformanceItem[]> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-performance/by-metric?min_observations=${minObservations}&threshold=${threshold}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch metric performance (${response.status})`);
  }

  return await response.json();
}

export async function fetchPerformanceTrends(
  projectId: string,
  period: string = 'week',
  minObservations: number = 3
): Promise<TrendPeriodItem[]> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-performance/trends?period=${encodeURIComponent(period)}&min_observations=${minObservations}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch performance trends (${response.status})`);
  }

  return await response.json();
}

export async function fetchPerformanceByModel(
  projectId: string
): Promise<ModelPerformanceItem[]> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-performance/by-model`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch model performance (${response.status})`);
  }

  return await response.json();
}

export async function fetchPerformanceByScenario(
  projectId: string
): Promise<ScenarioPerformanceItem[]> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-performance/by-scenario`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch scenario performance (${response.status})`);
  }

  return await response.json();
}

// ============================================================================
// Phase 8: Decision Learning & Improvement Signals API Client
// ============================================================================

export async function fetchDecisionLearningSignals(
  projectId: string,
  params?: {
    minObservations?: number;
    threshold?: number;
    status?: string;
    severity?: string;
  }
): Promise<DecisionLearningSignalsListResponse> {
  const query = new URLSearchParams();
  if (params?.minObservations !== undefined) {
    query.set('min_observations', String(params.minObservations));
  }
  if (params?.threshold !== undefined) {
    query.set('threshold', String(params.threshold));
  }
  if (params?.status) {
    query.set('status', params.status);
  }
  if (params?.severity) {
    query.set('severity', params.severity);
  }

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/learning-signals${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision learning signals (${response.status})`);
  }

  return await response.json();
}

export async function fetchLearningSignalById(
  projectId: string,
  signalId: string
): Promise<DecisionLearningSignalRecord> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/learning-signals/${encodeURIComponent(signalId)}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch learning signal (${response.status})`);
  }

  return await response.json();
}

export async function updateLearningSignalStatus(
  projectId: string,
  signalId: string,
  payload: DecisionLearningSignalUpdate
): Promise<DecisionLearningSignalRecord> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/learning-signals/${encodeURIComponent(signalId)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to update learning signal status (${response.status})`);
  }

  return await response.json();
}

// ---------------------------------------------------------------------------
// Phase 9: Decision Governance & Control Plane API
// ---------------------------------------------------------------------------

export async function fetchDecisionGovernance(
  decisionId: string,
  projectId?: string | null
): Promise<DecisionGovernanceResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/governance`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision governance state (${response.status})`);
  }

  return await response.json();
}

export async function transitionDecisionGovernance(
  decisionId: string,
  payload: GovernanceTransitionPayload,
  projectId?: string | null
): Promise<DecisionGovernanceResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/governance/transition`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to execute governance transition (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionGovernanceHistory(
  decisionId: string,
  projectId?: string | null
): Promise<GovernanceEvent[]> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/governance/history`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch governance history (${response.status})`);
  }

  return await response.json();
}

// =====================================================================
// Phase 10 — Controlled Decision Execution & Closed-Loop Monitoring API
// =====================================================================

export async function fetchDecisionExecution(
  decisionId: string,
  projectId?: string | null
): Promise<DecisionExecutionResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/execution`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to load decision execution state (${response.status})`);
  }

  return await response.json();
}

export async function requestDecisionExecution(
  decisionId: string,
  payload: ExecutionRequestPayload,
  projectId?: string | null
): Promise<DecisionExecutionResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/execution/request`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to request decision execution (${response.status})`);
  }

  return await response.json();
}

export async function confirmDecisionExecution(
  decisionId: string,
  payload: ExecutionConfirmPayload,
  projectId?: string | null
): Promise<DecisionExecutionResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/execution/confirm`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to confirm decision execution (${response.status})`);
  }

  return await response.json();
}

export async function failDecisionExecution(
  decisionId: string,
  payload: ExecutionFailPayload,
  projectId?: string | null
): Promise<DecisionExecutionResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/execution/fail`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to mark execution failed (${response.status})`);
  }

  return await response.json();
}

export async function markDecisionNotExecuted(
  decisionId: string,
  payload: ExecutionNotExecutedPayload,
  projectId?: string | null
): Promise<DecisionExecutionResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/execution/not-executed`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to mark decision as not executed (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionExecutionHistory(
  decisionId: string,
  projectId?: string | null
): Promise<DecisionExecutionHistoryResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/execution/history`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch execution history (${response.status})`);
  }

  return await response.json();
}

// ============================================================================
// Phase 11 — Decision Portfolio & Cross-Decision Intelligence APIs
// ============================================================================

export interface PortfolioSummaryKPIs {
  total_decisions: number;
  decisions_under_review: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  escalated: number;
  on_hold: number;
  executed: number;
  not_executed: number;
  closed: number;
  outcome_monitoring: number;
  decisions_with_observed_outcomes: number;
  decisions_with_pending_outcomes: number;
  decisions_with_active_learning_signals: number;
  decisions_with_execution_failures: number;
}

export interface GovernanceDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface ExecutionDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface OutcomeDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface CrossDecisionMetricItem {
  metric_name: string;
  decisions_count: number;
  observed_outcomes_count: number;
  material_deviations_count: number;
  decision_ids: string[];
}

export interface PortfolioRecurringDeviation {
  metric_name: string;
  decision_ids: string[];
  observed_outcomes_count: number;
  material_deviations_count: number;
  description: string;
  source_outcome_ids: string[];
  source_signal_ids: string[];
}

export interface PortfolioSignalSummary {
  total_active_signals: number;
  high_count: number;
  review_count: number;
  info_count: number;
  by_type: Record<string, number>;
  unresolved_signal_decisions: string[];
}

export interface ExecutionFailureFinding {
  decision_id: string;
  execution_id: string;
  failure_reason: string;
  occurred_at?: string | null;
  similarity_group?: string | null;
}

export interface PortfolioTrendPeriod {
  period_start: string;
  period_label: string;
  decisions_created: number;
  approvals_count: number;
  executions_count: number;
  observed_outcomes_count: number;
  learning_signals_count: number;
  execution_failures_count: number;
}

export interface DecisionDependencyItem {
  entity_type: string;
  entity_id: string;
  entity_label: string;
  decision_count: number;
  decision_ids: string[];
}

export interface DecisionClusterItem {
  cluster_name: string;
  shared_attribute_type: string;
  shared_attribute_value: string;
  decision_count: number;
  decision_ids: string[];
  evidence_summary: Record<string, any>;
}

export interface PortfolioDecisionRow {
  decision_id: string;
  recommendation_id?: string | null;
  dataset_id: string;
  dataset_name?: string | null;
  metric?: string | null;
  governance_status: string;
  execution_status?: string | null;
  outcome_status: string;
  active_signals_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PortfolioConcentrationItem {
  key: string;
  label: string;
  decision_count: number;
}

export interface PortfolioDependencyExposure {
  dependency_type: string;
  dependency_id: string;
  label: string;
  decision_count: number;
  decision_ids: string[];
  advisory: string;
}

export interface PortfolioOperationsSummary {
  pending_approval: number;
  pending_confirmation: number;
  executing: number;
  outcome_monitoring: number;
  execution_failed: number;
  pending_outcomes: number;
  active_learning_signals: number;
}

export interface PortfolioBottleneckItem {
  indicator: string;
  count: number;
  description: string;
}

export interface PortfolioCapacityIndicators {
  pending_confirmations: number;
  currently_executing: number;
  execution_failures: number;
  outcome_monitoring: number;
  executions_completed: number;
  avg_execution_duration_seconds?: number | null;
}

export interface PortfolioExposureIndicators {
  decisions_with_active_learning_signals: number;
  decisions_awaiting_outcomes: number;
  decisions_with_material_deviations: number;
  decisions_with_execution_failures: number;
}

export interface PortfolioCapacityResponse {
  project_id: string;
  operations: PortfolioOperationsSummary;
  bottlenecks: PortfolioBottleneckItem[];
  capacity_indicators: PortfolioCapacityIndicators;
  exposure_indicators: PortfolioExposureIndicators;
  concentration: Record<string, PortfolioConcentrationItem[]>;
  dependencies: PortfolioDependencyExposure[];
}

export interface DecisionPortfolioOverviewResponse {
  project_id: string;
  project_name?: string | null;
  last_updated?: string | null;
  kpis: PortfolioSummaryKPIs;
  governance_distribution: GovernanceDistributionItem[];
  execution_distribution: ExecutionDistributionItem[];
  outcome_distribution: OutcomeDistributionItem[];
  metrics_patterns: CrossDecisionMetricItem[];
  recurring_deviations: PortfolioRecurringDeviation[];
  learning_signals_summary: PortfolioSignalSummary;
  execution_failures: ExecutionFailureFinding[];
  dependencies: DecisionDependencyItem[];
  clusters: DecisionClusterItem[];
  decisions: PortfolioDecisionRow[];
  total_decisions_count: number;
  portfolio_operations?: PortfolioOperationsSummary | null;
  capacity?: PortfolioCapacityResponse | null;
}

export interface DecisionPortfolioTrendsResponse {
  project_id: string;
  period: string;
  trends: PortfolioTrendPeriod[];
}

export interface PortfolioFilterParams {
  governance_status?: string;
  execution_status?: string;
  outcome_status?: string;
  metric?: string;
  signal_type?: string;
  date_from?: string;
  date_to?: string;
  min_observations?: number;
}

export async function fetchDecisionPortfolioOverview(
  projectId: string,
  filters?: PortfolioFilterParams
): Promise<DecisionPortfolioOverviewResponse> {
  const queryParams = new URLSearchParams();
  if (filters?.governance_status) queryParams.append('governance_status', filters.governance_status);
  if (filters?.execution_status) queryParams.append('execution_status', filters.execution_status);
  if (filters?.outcome_status) queryParams.append('outcome_status', filters.outcome_status);
  if (filters?.metric) queryParams.append('metric', filters.metric);
  if (filters?.signal_type) queryParams.append('signal_type', filters.signal_type);
  if (filters?.date_from) queryParams.append('date_from', filters.date_from);
  if (filters?.date_to) queryParams.append('date_to', filters.date_to);
  if (filters?.min_observations) queryParams.append('min_observations', String(filters.min_observations));

  const queryStr = queryParams.toString();
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-portfolio${queryStr ? `?${queryStr}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision portfolio overview (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionPortfolioTrends(
  projectId: string,
  period: string = 'week',
  dateFrom?: string,
  dateTo?: string
): Promise<DecisionPortfolioTrendsResponse> {
  const queryParams = new URLSearchParams({ period });
  if (dateFrom) queryParams.append('date_from', dateFrom);
  if (dateTo) queryParams.append('date_to', dateTo);

  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-portfolio/trends?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision portfolio trends (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionPortfolioMetrics(
  projectId: string,
  minObservations: number = 3
): Promise<any> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-portfolio/metrics?min_observations=${minObservations}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision portfolio metrics (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionPortfolioSignals(projectId: string): Promise<any> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-portfolio/signals`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision portfolio signals (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionPortfolioDependencies(projectId: string): Promise<any> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-portfolio/dependencies`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision portfolio dependencies (${response.status})`);
  }

  return await response.json();
}

export async function fetchDecisionPortfolioCapacity(projectId: string): Promise<PortfolioCapacityResponse> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-portfolio/capacity`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch decision portfolio capacity (${response.status})`);
  }

  return await response.json();
}

// =====================================================================
// Phase 13 — Enterprise Decision Reporting & Audit Endpoints
// =====================================================================

export async function fetchIndividualDecisionReport(
  decisionId: string,
  projectId?: string
): Promise<IndividualDecisionReportResponse> {
  let url = `${API_BASE_URL}/api/v1/decisions/${encodeURIComponent(decisionId)}/report`;
  if (projectId) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch individual decision report (${response.status})`);
  }

  return await response.json();
}

export async function fetchProjectDecisionReport(
  projectId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<ProjectDecisionReportResponse> {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/decision-report${qs}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch project decision report (${response.status})`);
  }

  return await response.json();
}

// =====================================================================
// Phase 14 — Decision Knowledge & Operating Memory APIs
// =====================================================================

export async function fetchProjectKnowledge(
  projectId: string,
  params?: {
    category?: string;
    source_type?: string;
    decision_id?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    entry_type?: string;
    include_system_derived?: boolean;
  }
): Promise<ProjectKnowledgeListResponse> {
  const q = new URLSearchParams();
  if (params?.category) q.append('category', params.category);
  if (params?.source_type) q.append('source_type', params.source_type);
  if (params?.decision_id) q.append('decision_id', params.decision_id);
  if (params?.date_from) q.append('date_from', params.date_from);
  if (params?.date_to) q.append('date_to', params.date_to);
  if (params?.search) q.append('search', params.search);
  if (params?.entry_type) q.append('entry_type', params.entry_type);
  if (params?.include_system_derived !== undefined) {
    q.append('include_system_derived', String(params.include_system_derived));
  }

  const qs = q.toString() ? `?${q.toString()}` : '';
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/knowledge${qs}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to fetch project knowledge (${response.status})`);
  }

  return await response.json();
}

export async function createProjectKnowledge(
  projectId: string,
  payload: KnowledgeEntryCreatePayload
): Promise<DecisionKnowledgeEntry> {
  const url = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/knowledge`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to record knowledge entry (${response.status})`);
  }

  return await response.json();
}

export async function getKnowledgeEntry(knowledgeId: string): Promise<DecisionKnowledgeEntry> {
  const url = `${API_BASE_URL}/api/v1/knowledge/${encodeURIComponent(knowledgeId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to get knowledge entry (${response.status})`);
  }

  return await response.json();
}

export async function updateKnowledgeEntry(
  knowledgeId: string,
  payload: KnowledgeEntryUpdatePayload
): Promise<DecisionKnowledgeEntry> {
  const url = `${API_BASE_URL}/api/v1/knowledge/${encodeURIComponent(knowledgeId)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to update knowledge entry (${response.status})`);
  }

  return await response.json();
}

export async function archiveKnowledgeEntry(
  knowledgeId: string
): Promise<{ message: string; id: string; is_archived: boolean }> {
  const url = `${API_BASE_URL}/api/v1/knowledge/${encodeURIComponent(knowledgeId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `Failed to archive knowledge entry (${response.status})`);
  }

  return await response.json();
}

