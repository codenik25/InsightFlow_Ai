export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  project_name: string;
  version: string;
  environment: string;
  timestamp: string;
  database_connected: boolean;
  details?: string;
}

export interface DatasetItem {
  id: string;
  name: string;
  description?: string | null;
  file_path?: string | null;
  file_size_bytes?: number | null;
  row_count?: number | null;
  column_count?: number | null;
  mime_type?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  profile_data?: DatasetProfileData | null;
}

export interface DatasetListResponse {
  total: number;
  items: DatasetItem[];
}

export interface NumericStats {
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  p25?: number | null;
  p50?: number | null;
  p75?: number | null;
}

export interface CategoricalValueCount {
  value: string;
  count: number;
  percentage: number;
}

export interface CategoricalStats {
  top_values: CategoricalValueCount[];
  unique_count: number;
}

export interface DatetimeStats {
  min_date?: string | null;
  max_date?: string | null;
  date_range_days?: number | null;
}

export interface ColumnProfile {
  name: string;
  inferred_type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'identifier' | 'text' | string;
  null_count: number;
  null_percentage: number;
  unique_count: number;
  unique_percentage: number;
  sample_values: any[];
  numeric_stats?: NumericStats | null;
  categorical_stats?: CategoricalStats | null;
  datetime_stats?: DatetimeStats | null;
}

export interface QualitySummary {
  duplicate_row_count: number;
  duplicate_row_percentage: number;
  empty_columns: string[];
  constant_columns: string[];
}

export interface DatasetOverview {
  filename: string;
  total_rows: number;
  total_columns: number;
  file_size_bytes: number;
  memory_usage_bytes: number;
  duplicate_rows: number;
  duplicate_row_percentage: number;
  empty_column_count: number;
  constant_column_count: number;
}

export interface DatasetProfileData {
  dataset_id: string;
  overview: DatasetOverview;
  columns: ColumnProfile[];
  quality: QualitySummary;
}

// Phase 2 Types

export interface IssueDetail {
  category: 'completeness' | 'uniqueness' | 'validity' | 'consistency' | 'structural' | string;
  severity: 'critical' | 'warning' | 'info' | string;
  description: string;
  column?: string | null;
  count?: number | null;
}

export interface QualityScore {
  overall_score: number;
  completeness_score: number;
  uniqueness_score: number;
  validity_score: number;
  consistency_score: number;
  structural_score: number;
  total_issue_count: number;
  severity: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' | string;
}

export interface CompletenessMetrics {
  total_missing_cells: number;
  missing_percentage: number;
  missing_by_column?: Record<string, number>;
}

export interface UniquenessMetrics {
  duplicate_rows: number;
  duplicate_row_percentage: number;
  identifier_duplicates?: Record<string, number>;
}

export interface ValidityMetrics {
  total_invalid_cells: number;
  invalid_percentage: number;
  invalid_by_column?: Record<string, number>;
}

export interface ConsistencyMetrics {
  whitespace_issues_count: number;
  casing_inconsistencies_count: number;
  inconsistent_columns?: string[];
}

export interface StructuralMetrics {
  empty_columns?: string[];
  constant_columns?: string[];
  duplicate_column_names?: string[];
}

export interface DatasetQualityResponse {
  dataset_id: string;
  score: QualityScore;
  completeness: CompletenessMetrics;
  uniqueness: UniquenessMetrics;
  validity: ValidityMetrics;
  consistency: ConsistencyMetrics;
  structural: StructuralMetrics;
  issues: IssueDetail[];
}

export interface CleaningOperation {
  type: 'remove_duplicates' | 'fill_missing' | 'remove_empty_columns' | 'remove_constant_columns' | 'trim_whitespace' | 'convert_case' | 'convert_type' | string;
  column?: string | null;
  strategy?: 'drop_rows' | 'mean' | 'median' | 'mode' | 'constant' | 'lowercase' | 'uppercase' | string | null;
  target_type?: string | null;
  fill_value?: any;
}

export interface CleaningPlan {
  dataset_id: string;
  operations: CleaningOperation[];
}

export interface PreviewMetrics {
  total_rows: number;
  total_columns: number;
  total_missing_cells: number;
  duplicate_rows: number;
  quality_score: number;
  severity: string;
}

export interface ProposedChangeDetail {
  operation_type: string;
  column?: string | null;
  strategy?: string | null;
  affected_rows: number;
  description: string;
}

export interface CleaningPreviewResponse {
  dataset_id: string;
  proposed_changes: ProposedChangeDetail[];
  before: PreviewMetrics;
  expected_after: PreviewMetrics;
}

export interface TransformationLogItem {
  id: string;
  dataset_id: string;
  output_dataset_id: string;
  operation_type: string;
  column_name?: string | null;
  strategy?: string | null;
  affected_rows: number;
  details?: any;
  created_at: string;
}

export interface CleaningApplyResponse {
  original_dataset_id: string;
  output_dataset_id: string;
  processed_filename: string;
  storage_key: string;
  transformation_logs_count: number;
  before: PreviewMetrics;
  after: PreviewMetrics;
  transformation_logs: TransformationLogItem[];
}

export interface TransformationHistoryResponse {
  dataset_id: string;
  total: number;
  items: TransformationLogItem[];
}

