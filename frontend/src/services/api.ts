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
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
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





