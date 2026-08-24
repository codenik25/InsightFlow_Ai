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

// Phase 6 Predictive Analytics & ML Types

export interface MLTaskCandidate {
  task_type: 'regression' | 'classification' | 'time_series_forecasting' | 'anomaly_detection' | string;
  target_column?: string | null;
  suitability_score: number;
  reasons: string[];
  warnings: string[];
  required_conditions: string[];
}

export interface MLTaskDiscoveryResponse {
  dataset_id: string;
  is_processed: boolean;
  candidate_tasks: MLTaskCandidate[];
  message?: string | null;
}

export interface MLFeatureInfo {
  name: string;
  role: string;
  status: 'included' | 'excluded' | string;
  reason: string;
}

export interface MLModelCandidate {
  model_name: string;
  metrics: Record<string, number | null | undefined>;
  is_selected: boolean;
  selection_reason: string;
}

export interface MLAnalysisResponse {
  id: string;
  dataset_id: string;
  task_type: string;
  target_column?: string | null;
  feature_summary: MLFeatureInfo[];
  feature_columns: string[];
  model_name: string;
  model_version: string;
  training_row_count: number;
  test_row_count: number;
  metrics: Record<string, number | null | undefined>;
  candidate_models: MLModelCandidate[];
  status: string;
  selection_reason: string;
  data_warnings: string[];
  model_artifact_path?: string | null;
  created_at: string;
}

export interface PredictionRequest {
  inputs: Record<string, any>[];
}

export interface PredictionResponse {
  analysis_id: string;
  task_type: string;
  target_column?: string | null;
  predictions: any[];
  probabilities?: Record<string, number>[] | null;
  explanation: string;
}

// Phase 7 Decision Intelligence Types

export interface ScenarioCreateRequest {
  name: string;
  description?: string | null;
  ml_analysis_id?: string | null;
  feature_changes: Record<string, any>;
}

export interface ScenarioResponse {
  id: string;
  dataset_id: string;
  ml_analysis_id?: string | null;
  name: string;
  description?: string | null;
  target_column: string;
  base_value: number;
  feature_changes: Record<string, any>;
  predicted_outcome: number;
  predicted_delta: number;
  predicted_delta_percentage: number;
  confidence_score: number;
  feature_importances?: Record<string, number>;
  feature_contributions?: Record<string, {
    baseline_value: any;
    scenario_value: any;
    changed: boolean;
    marginal_delta: number;
    contribution_percentage: number;
  }>;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface MLExplanationResponse {
  analysis_id: string;
  dataset_id: string;
  model_name: string;
  model_version: string;
  task_type: string;
  target_column: string;
  feature_columns: string[];
  feature_importances: Record<string, number>;
  explanation_summary: string;
}


export interface ScenarioComparisonResponse {
  dataset_id: string;
  ml_analysis_id: string;
  target_column: string;
  baseline_record: Record<string, any>;
  baseline_prediction: number;
  scenario_name: string;
  scenario_changes: Record<string, any>;
  scenario_prediction: number;
  predicted_delta: number;
  predicted_delta_percentage: number;
  feature_importances: Record<string, number>;
  feature_contributions: Record<string, {
    baseline_value: any;
    scenario_value: any;
    changed: boolean;
    marginal_delta: number;
    contribution_percentage: number;
  }>;
}

export interface DecisionRecommendationResponse {
  id: string;
  dataset_id: string;
  scenario_id?: string | null;
  ml_analysis_id?: string | null;
  insight_id?: string | null;
  title: string;
  recommendation_type: 'optimization' | 'risk_mitigation' | 'action' | string;
  impact_level: 'high' | 'medium' | 'low' | string;
  expected_impact: string;
  action_items: string[];
  evidence_traceability: Record<string, any>;
  created_at: string;
}

export interface DecisionSummaryResponse {
  dataset_id: string;
  is_processed: boolean;
  scenarios: ScenarioResponse[];
  recommendations: DecisionRecommendationResponse[];
  message?: string | null;
}

// Phase 7.2 Decision Optimization Types

export interface ControllableFeatureInfo {
  column: string;
  data_type: string;
  role: string;
  current_value?: any;
  min_value?: number | null;
  max_value?: number | null;
  categories?: string[] | null;
  importance: number;
  allowed: boolean;
  exclusion_reason?: string | null;
  optimization_supported: boolean;
}

export interface OptimizationOptionResponse {
  dataset_id: string;
  analysis_id: string;
  target_column: string;
  objective_options: string[];
  controllable_features: ControllableFeatureInfo[];
  warnings: string[];
}

export interface FeatureConstraint {
  min?: number | null;
  max?: number | null;
}

export interface OptimizationRequest {
  analysis_id?: string | null;
  baseline_inputs?: Record<string, any> | null;
  objective?: 'maximize' | 'minimize' | string;
  max_scenarios?: number;
  feature_constraints?: Record<string, FeatureConstraint> | null;
}

export interface OptimizationScenario {
  rank: number;
  scenario_id: string;
  changes: Record<string, any>;
  inputs: Record<string, any>;
  predicted_target: number;
  baseline_prediction: number;
  absolute_delta: number;
  percentage_delta: number;
  feasibility: string;
  explanation: string;
}

export interface OptimizationResponse {
  optimization_id: string;
  dataset_id: string;
  ml_analysis_id: string;
  target_column: string;
  objective: string;
  baseline_inputs: Record<string, any>;
  baseline_prediction: number;
  scenarios: OptimizationScenario[];
  best_scenario?: OptimizationScenario | null;
  warning?: string | null;
  generated_at: string;
}

// Phase 7.3 Types

export interface RecommendationEvidence {
  dataset_id: string;
  ml_analysis_id: string;
  optimization_id: string;
  scenario_id?: string | null;
  insight_ids: string[];
}

export interface DecisionRecommendation {
  id: string;
  title: string;
  recommendation_type: string;
  priority: number;
  target_metric: string;
  baseline_value: number;
  projected_value: number;
  absolute_delta: number;
  percentage_delta: number;
  changed_features: Record<string, any>;
  rationale: string;
  tradeoffs: string;
  confidence: 'EXPLORATORY' | 'MODERATE' | 'STRONG' | string;
  evidence: RecommendationEvidence;
}

export interface RecommendationResponse {
  dataset_id: string;
  optimization_id: string;
  recommendations: DecisionRecommendation[];
  overall_confidence: string;
  warning?: string | null;
  generated_at: string;
}

// Phase 7.4 Decision Guardrails & Feasibility Types

export interface GuardrailResult {
  rule_id: string;
  rule_name: string;
  category: 'RANGE' | 'DATA_QUALITY' | 'MODEL_CONFIDENCE' | 'SAMPLE_SIZE' | 'SCENARIO_CHANGE' | 'FEATURE_STABILITY' | 'BUSINESS_FEASIBILITY' | string;
  status: 'PASS' | 'WARNING' | 'FAIL' | string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  message: string;
  evidence: Record<string, any>;
}

export interface DecisionGuardrailResponse {
  id: string;
  recommendation_id: string;
  dataset_id: string;
  ml_analysis_id: string;
  optimization_id: string;
  scenario_id?: string | null;
  feasibility_score: number;
  realism_score: number;
  risk_score: number;
  confidence_score: number;
  decision_readiness_score: number;
  feasibility_status: 'FEASIBLE' | 'CAUTION' | 'INFEASIBLE' | string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  decision_status: 'READY_TO_CONSIDER' | 'HUMAN_REVIEW_REQUIRED' | 'NOT_RECOMMENDED' | string;
  guardrail_results: GuardrailResult[];
  passed_rules: GuardrailResult[];
  warnings: GuardrailResult[];
  violated_rules: GuardrailResult[];
  explanation: string;
  created_at: string;
}

export interface GuardrailBatchResponse {
  dataset_id: string;
  evaluated_count: number;
  evaluations: DecisionGuardrailResponse[];
}

// Phase 7.5 Decision Command Center Types

export interface DecisionSnapshot {
  decision_readiness_score: number;
  decision_status: string;
  feasibility_score: number;
  realism_score: number;
  risk_score: number;
  confidence_score: number;
  dataset_quality_score: number;
  sample_size: number;
  small_dataset_warning?: string | null;
}

export interface DecisionRecommendationSummary {
  recommendation_id: string;
  priority: number;
  recommendation_type: string;
  title: string;
  target_metric: string;
  baseline_value: number;
  projected_value: number;
  absolute_delta: number;
  percentage_delta: number;
  confidence: string;
  decision_status: string;
}

export interface EvidenceNode {
  node_type: string;
  node_id: string;
  title: string;
  description: string;
}

export interface EvidenceChain {
  recommendation_id: string;
  optimization_id?: string | null;
  scenario_id?: string | null;
  ml_analysis_id?: string | null;
  insight_ids: string[];
  guardrail_id?: string | null;
  nodes: EvidenceNode[];
}

export interface DecisionComparison {
  feature: string;
  baseline_value: any;
  proposed_value: any;
  delta?: number | null;
  contribution_percent?: number | null;
}

export interface RiskSummary {
  risk_level: string;
  warnings: string[];
  failed_rules: string[];
  passed_rules: string[];
}

export interface DecisionCommandCenterResponse {
  dataset_id: string;
  processed_dataset_id: string;
  dataset_name: string;
  generated_at: string;
  snapshot: DecisionSnapshot;
  primary_recommendation?: DecisionRecommendationSummary | null;
  alternative_recommendations: DecisionRecommendationSummary[];
  comparison: DecisionComparison[];
  risk_summary: RiskSummary;
  evidence_chain?: EvidenceChain | null;
  key_insights: any[];
  next_actions: string[];
}

// Phase 7.6 AI Decision Brief Engine Types

export interface ClaimEvidenceRef {
  type: string;
  id: string;
}

export interface ClaimEvidenceItem {
  claim: string;
  evidence_refs: ClaimEvidenceRef[];
}

export interface DecisionBriefSection {
  section_id: string;
  title: string;
  content: string;
  bullet_points: string[];
}

export interface DecisionBriefResponse {
  id: string;
  dataset_id: string;
  recommendation_id: string;
  provider_name: string;
  model_name: string;
  generation_mode: 'ai' | 'deterministic_fallback' | string;
  validation_status: 'validated' | 'fallback' | string;
  fallback_reason?: string | null;
  executive_summary: string;
  sections: DecisionBriefSection[];
  key_findings: string[];
  risk_breakdown: Record<string, any>;
  claim_evidence_map: ClaimEvidenceItem[];
  created_at: string;
}

// Phase 7.7 Decision Memory & Outcome Feedback Types

export interface DecisionOutcome {
  id: string;
  dataset_id: string;
  recommendation_id: string;
  optimization_id: string;
  scenario_id?: string | null;
  ml_analysis_id: string;

  expected_metric: string;
  expected_value: number;
  actual_metric: string;
  actual_value: number;

  absolute_error: number;
  percentage_error: number;
  achievement_percentage: number;
  objective: string;
  outcome_status: 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'NOT_ACHIEVED' | string;

  notes?: string | null;
  recorded_at: string;
  evaluated_at: string;
}

export interface DecisionMemoryItem {
  outcome_id: string;
  recommendation_id: string;
  recommendation_title: string;
  recommendation_type: string;
  target_metric: string;

  expected_value: number;
  actual_value: number;
  achievement_percentage: number;
  outcome_status: 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'NOT_ACHIEVED' | string;
  decision_status: string;
  confidence: string;
  recorded_at: string;
}

export interface DecisionMemoryResponse {
  dataset_id: string;
  total_records: number;
  history: DecisionMemoryItem[];
}

export interface DecisionPerformanceSummary {
  dataset_id: string;
  total_decisions: number;
  achieved_count: number;
  partially_achieved_count: number;
  not_achieved_count: number;

  achievement_rate: number;
  average_percentage_error: number;
  average_achievement_percentage: number;
  limited_history_warning?: string | null;
}




