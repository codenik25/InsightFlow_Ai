import {
  HealthStatus,
  DatasetListResponse,
  DatasetProfileData,
  DatasetQualityResponse,
  CleaningPlan,
  CleaningPreviewResponse,
  CleaningApplyResponse,
  TransformationHistoryResponse,
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

