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

// Phase 3 Types

export interface ColumnRoleInfo {
  column: string;
  role: 'identifier' | 'measure' | 'categorical_dimension' | 'datetime_dimension' | 'text' | 'boolean' | string;
  reason: string;
  inferred_type: string;
}

export interface KPIMetric {
  name: string;
  value: number | string | any;
  metric_type: 'sum' | 'mean' | 'median' | 'min' | 'max' | 'std' | 'count' | 'unique' | string;
  source_column?: string | null;
  format?: 'currency' | 'percentage' | 'number' | 'integer' | string;
  reason?: string | null;
}

export interface DatasetOverviewKPIs {
  total_rows: number;
  total_columns: number;
  measure_count: number;
  dimension_count: number;
  datetime_count: number;
  total_missing_cells: number;
  duplicate_rows: number;
}

export interface GroupedCategoryValue {
  category_value: string;
  metric_value: number;
  contribution_pct: number;
}

export interface CategoryBreakdown {
  dimension: string;
  measure: string;
  total_measure_value: number;
  aggregation_method?: 'sum' | 'mean' | string;
  top_category?: GroupedCategoryValue | null;
  bottom_category?: GroupedCategoryValue | null;
  top_5: GroupedCategoryValue[];
  bottom_5: GroupedCategoryValue[];
  grouped_data: GroupedCategoryValue[];
}

export interface TimeSeriesPoint {
  period: string;
  value: number;
  count: number;
}

export interface TrendMetric {
  measure: string;
  datetime_column: string;
  granularity: 'daily' | 'weekly' | 'monthly' | string;
  trend_direction: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data' | string;
  slope: number;
  pct_change: number;
  first_period_value?: number | null;
  latest_period_value?: number | null;
  time_series: TimeSeriesPoint[];
}

export interface RelationshipMetric {
  column_a: string;
  column_b: string;
  correlation: number;
  strength: 'strong_positive' | 'moderate_positive' | 'neutral' | 'moderate_negative' | 'strong_negative' | string;
}

export interface DistributionStats {
  column: string;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  p25: number;
  p50: number;
  p75: number;
  iqr: number;
  skewness: number;
  zero_count: number;
  is_constant: boolean;
}

export interface EDAResponse {
  id: string;
  dataset_id: string;
  created_at: string;
  column_roles: ColumnRoleInfo[];
  overview_kpis: DatasetOverviewKPIs;
  discovered_kpis: KPIMetric[];
  category_breakdowns: CategoryBreakdown[];
  trends: TrendMetric[];
  relationships: RelationshipMetric[];
  distributions: DistributionStats[];
}

// Phase 4 Business Insight Types

export interface InsightEvidence {
  dimension?: string | null;
  metric?: string | null;
  top_value?: any;
  total_value?: any;
  contribution_percent?: number | null;
  second_best_value?: any;
  comparison_diff?: number | null;
  correlation?: number | null;
  sample_size?: number | null;
  quality_score_before?: number | null;
  quality_score_after?: number | null;
  details?: Record<string, any> | null;
}

export interface Insight {
  id: string;
  dataset_id: string;
  category: 'KPI' | 'PERFORMANCE' | 'TREND' | 'COMPARISON' | 'CORRELATION' | 'DATA_QUALITY' | 'ANOMALY' | 'OPPORTUNITY' | string;
  severity: 'INFO' | 'POSITIVE' | 'WARNING' | 'CRITICAL' | string;
  title: string;
  observation: string;
  evidence: InsightEvidence;
  explanation?: string | null;
  recommendation?: string | null;
  priority_score: number;
  confidence: number;
  source_column?: string | null;
  dimension?: string | null;
  metric_value?: number | null;
  comparison_value?: number | null;
  percentage_change?: number | null;
  created_at: string;
}

export interface InsightSummary {
  total: number;
  critical_count: number;
  warning_count: number;
  positive_count: number;
  info_count: number;
  opportunity_count: number;
}

export interface InsightResponse {
  dataset_id: string;
  summary: InsightSummary;
  insights: Insight[];
}

export interface ExecutiveKPINode {
  name: string;
  value: number;
  formatted_value: string;
  aggregation: string;
  nature: string;
  unit?: string | null;
  reason?: string | null;
}

export interface ExecutiveHighlight {
  id: string;
  highlight_type: 'ACHIEVEMENT' | 'RISK' | 'OPPORTUNITY';
  title: string;
  summary: string;
  source_insight_id?: string | null;
  priority_score: number;
  evidence?: Record<string, any> | null;
}

export interface StrategicAction {
  priority: number;
  title: string;
  recommendation: string;
  target_metric?: string | null;
  target_dimension?: string | null;
  source_insight_id?: string | null;
}

export interface ExecutiveReport {
  dataset_id: string;
  raw_dataset_id?: string | null;
  dataset_name: string;
  source_dataset_name?: string | null;
  generated_at: string;
  quality_score: number;
  total_rows: number;
  total_columns: number;
  key_kpis: ExecutiveKPINode[];
  executive_narrative: string;
  key_achievements: ExecutiveHighlight[];
  critical_risks: ExecutiveHighlight[];
  key_opportunities: ExecutiveHighlight[];
  strategic_actions: StrategicAction[];
  total_insights_analyzed: number;
}




