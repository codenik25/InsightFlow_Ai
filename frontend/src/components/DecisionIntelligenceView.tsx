import React, { useState, useEffect } from 'react';
import {
  DecisionSummaryResponse,
  MLAnalysisResponse,
  MLExplanationResponse,
  OptimizationOptionResponse,
  OptimizationResponse,
  DecisionRecommendation,
  RecommendationResponse,
  
  ScenarioComparisonResponse,
} from '../types';
import {
  fetchOptimizationOptions,
  runOptimization,
  generateRecommendations,
  fetchRecommendations,
  
  
  
  fetchDecisionSummary,
  fetchMLAnalyses,
  explainMLModel,
  evaluateWhatIfScenario,
  compareWhatIfScenario,
} from '../services/api';

interface DecisionIntelligenceViewProps {
  datasetId: string;
  isProcessed: boolean;
}

export const DecisionIntelligenceView: React.FC<DecisionIntelligenceViewProps> = ({
  datasetId,
  isProcessed,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummaryResponse | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<MLAnalysisResponse | null>(null);
  const [modelExplanation, setModelExplanation] = useState<MLExplanationResponse | null>(null);

  // What-If Scenario Form & Comparison State
  const [scenarioName, setScenarioName] = useState<string>('Volume & Price Adjustment Simulation');
  const [scenarioDesc, setScenarioDesc] = useState<string>('Simulate predictive delta and feature impact contributions');
  const [featureChangesInput, setFeatureChangesInput] = useState<string>('{\n  "unit_price": 3000,\n  "units_sold": 10\n}');
  const [submittingScenario, setSubmittingScenario] = useState<boolean>(false);
  const [scenarioSuccessMsg, setScenarioSuccessMsg] = useState<string | null>(null);
  const [activeComparison, setActiveComparison] = useState<ScenarioComparisonResponse | null>(null);
  const [comparingScenarioId, setComparingScenarioId] = useState<string | null>(null);

  // Phase 7.2 Optimization Lab State
  const [optimizationOptions, setOptimizationOptions] = useState<OptimizationOptionResponse | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResponse | null>(null);
  const [objective, setObjective] = useState<'maximize' | 'minimize'>('maximize');
  const [maxScenarios, setMaxScenarios] = useState<number>(10);
  const [userConstraints, setUserConstraints] = useState<Record<string, { min?: number; max?: number }>>({});
  const [runningOpt, setRunningOpt] = useState<boolean>(false);
  const [optError, setOptError] = useState<string | null>(null);

  // Phase 7.3 Executive Recommendations State
  const [recommendations, setRecommendations] = useState<DecisionRecommendation[]>([]);
  const [recResponse, setRecResponse] = useState<RecommendationResponse | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState<boolean>(false);
  const [recError, setRecError] = useState<string | null>(null);

  // Phase 7.4 Decision Guardrails State

  useEffect(() => {
    fetchDecisionData();
  }, [datasetId]);

  const fetchDecisionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Decision Summary
      const data = await fetchDecisionSummary(datasetId);
      setDecisionSummary(data);

      // 2. Fetch Latest ML Analysis
      const mlList = await fetchMLAnalyses(datasetId).catch(() => []);
      if (mlList.length > 0) {
        const activeAnalysis = mlList[0];
        setLatestAnalysis(activeAnalysis);

        // 3. Fetch Model Feature Importances / Explainability
        try {
          const expData = await explainMLModel(datasetId, activeAnalysis.id);
          setModelExplanation(expData);
        } catch (expErr) {
          console.warn('Model explanation fetch warning:', expErr);
        }

        // 4. Fetch Phase 7.2 Optimization Controllable Feature Options
        try {
          const optOpts = await fetchOptimizationOptions(datasetId, activeAnalysis.id);
          setOptimizationOptions(optOpts);
        } catch (optErr) {
          console.warn('Optimization options fetch warning:', optErr);
        }

        // 5. Fetch Phase 7.3 Decision Recommendations
        try {
          const storedRecs = await fetchRecommendations(datasetId);
          setRecommendations(storedRecs);
        } catch (recErr) {
          console.warn('Recommendations fetch warning:', recErr);
        }

        // Pre-populate sample JSON based on first 2 feature columns
        const sampleObj: Record<string, any> = {};
        activeAnalysis.feature_columns.slice(0, 2).forEach((col, idx) => {
          sampleObj[col] = (idx + 1) * 10;
        });
        if (Object.keys(sampleObj).length > 0) {
          setFeatureChangesInput(JSON.stringify(sampleObj, null, 2));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading Decision Intelligence data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingScenario(true);
    setError(null);
    setScenarioSuccessMsg(null);

    try {
      let parsedChanges: Record<string, any>;
      try {
        parsedChanges = JSON.parse(featureChangesInput);
      } catch (parseErr) {
        throw new Error('Invalid JSON format for feature changes. Please check syntax.');
      }

      const payload = {
        name: scenarioName,
        description: scenarioDesc,
        ml_analysis_id: latestAnalysis?.id || null,
        feature_changes: parsedChanges,
      };

      const newScenario = await evaluateWhatIfScenario(datasetId, payload);

      setScenarioSuccessMsg(`Scenario '${newScenario.name}' evaluated with prediction explainability!`);
      fetchDecisionData();
    } catch (err: any) {
      setError(err.message || 'Error creating scenario');
    } finally {
      setSubmittingScenario(false);
    }
  };

  const handleCompareScenario = async (scenarioId: string) => {
    setComparingScenarioId(scenarioId);
    try {
      const compRes = await compareWhatIfScenario(datasetId, scenarioId);
      setActiveComparison(compRes);
    } catch (err: any) {
      console.error('Scenario comparison error:', err);
    } finally {
      setComparingScenarioId(null);
    }
  };

  const handleRunOptimization = async () => {
    setRunningOpt(true);
    setOptError(null);
    try {
      const constraintsPayload: Record<string, { min?: number; max?: number }> = {};
      Object.entries(userConstraints).forEach(([feat, bounds]) => {
        if (bounds.min !== undefined || bounds.max !== undefined) {
          constraintsPayload[feat] = bounds;
        }
      });

      const res = await runOptimization(datasetId, {
        analysis_id: latestAnalysis?.id,
        objective: objective,
        max_scenarios: maxScenarios,
        feature_constraints: Object.keys(constraintsPayload).length > 0 ? constraintsPayload : null,
      });

      setOptimizationResult(res);

      // Auto-generate Executive Recommendations from optimization result
      if (res.optimization_id) {
        handleGenerateRecommendations(res.optimization_id);
      }
    } catch (err: any) {
      setOptError(err.message || 'Optimization run failed');
    } finally {
      setRunningOpt(false);
    }
  };

  const handleGenerateRecommendations = async (optId?: string) => {
    const targetOptId = optId || optimizationResult?.optimization_id;
    if (!targetOptId) return;
    setGeneratingRecs(true);
    setRecError(null);
    try {
      const res = await generateRecommendations(datasetId, targetOptId, 3);
      setRecResponse(res);
      setRecommendations(res.recommendations);
    } catch (err: any) {
      setRecError(err.message || 'Failed to generate executive recommendations');
    } finally {
      setGeneratingRecs(false);
    }
  };



  if (!isProcessed) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-amber-200">
        <h3 className="text-lg font-semibold mb-2">Decision Intelligence Locked</h3>
        <p className="text-sm">
          Decision Intelligence, Scenarios, and Optimization require a cleaned, processed dataset. Please clean this dataset first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm">Loading Prediction Explainability & Decision Optimization Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-gray-900 border border-indigo-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 7.2 Decision Optimization Engine
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Deterministic Scenario Ranking
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Decision Optimization & Scenario Ranking</h2>
            <p className="text-gray-400 text-sm">
              Discover controllable feature levers, generate deterministic what-if combinations, and rank scenarios by business objective.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {scenarioSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-300 text-sm">
          {scenarioSuccessMsg}
        </div>
      )}

      {/* Phase 7.2 Optimization Lab */}
      <div className="bg-gray-900/80 border border-indigo-500/30 rounded-xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div>
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
              Optimization Lab
            </span>
            <h3 className="text-xl font-bold text-white mt-1">Automatic Scenario Generator & Ranker</h3>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">
              <label className="text-xs text-gray-400 font-medium">Objective:</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as 'maximize' | 'minimize')}
                className="bg-gray-900 border border-gray-700 text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value="maximize">Maximize Target</option>
                <option value="minimize">Minimize Target</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">
              <label className="text-xs text-gray-400 font-medium">Max Scenarios:</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxScenarios}
                onChange={(e) => setMaxScenarios(parseInt(e.target.value) || 10)}
                className="bg-gray-900 border border-gray-700 text-xs text-white rounded px-2 py-1 w-16 text-center focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleRunOptimization}
              disabled={runningOpt}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {runningOpt ? 'Optimizing...' : 'Generate & Rank Scenarios'}
            </button>
          </div>
        </div>

        {optError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-xs">
            {optError}
          </div>
        )}

        {/* Controllable Features Overview & Bound Controls */}
        {optimizationOptions && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Controllable Optimization Levers & Observed Bounds
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {optimizationOptions.controllable_features.map((feat) => {
                const bounds = userConstraints[feat.column] || {};
                return (
                  <div
                    key={feat.column}
                    className={`rounded-lg p-3 border ${
                      feat.allowed
                        ? 'bg-gray-800/40 border-gray-800 hover:border-indigo-500/30'
                        : 'bg-gray-950/40 border-gray-900 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-white font-mono">{feat.column}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          feat.allowed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {feat.allowed ? 'Controllable' : 'Excluded'}
                      </span>
                    </div>

                    {!feat.allowed ? (
                      <p className="text-[11px] text-rose-400/80 mt-1 italic">{feat.exclusion_reason}</p>
                    ) : (
                      <div className="space-y-2 mt-2 text-xs">
                        <div className="flex justify-between text-gray-400 text-[11px]">
                          <span>Observed Range:</span>
                          <span className="font-mono text-gray-200">
                            {feat.data_type === 'numeric'
                              ? `[${feat.min_value} to ${feat.max_value}]`
                              : feat.categories?.join(', ')}
                          </span>
                        </div>

                        {feat.data_type === 'numeric' && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[10px] text-gray-500 block">Min Constraint</label>
                              <input
                                type="number"
                                placeholder={String(feat.min_value)}
                                value={bounds.min !== undefined ? bounds.min : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  setUserConstraints((prev) => ({
                                    ...prev,
                                    [feat.column]: { ...prev[feat.column], min: val },
                                  }));
                                }}
                                className="w-full bg-gray-900 border border-gray-700 text-xs text-white px-2 py-1 rounded font-mono focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 block">Max Constraint</label>
                              <input
                                type="number"
                                placeholder={String(feat.max_value)}
                                value={bounds.max !== undefined ? bounds.max : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  setUserConstraints((prev) => ({
                                    ...prev,
                                    [feat.column]: { ...prev[feat.column], max: val },
                                  }));
                                }}
                                className="w-full bg-gray-900 border border-gray-700 text-xs text-white px-2 py-1 rounded font-mono focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Optimization Results View */}
        {optimizationResult && (
          <div className="space-y-6 pt-4 border-t border-gray-800">
            {/* Small Dataset Warning Banner */}
            {optimizationResult.warning && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-300 text-xs flex items-center space-x-2">
                <span className="font-semibold">⚠️ Note:</span>
                <span>{optimizationResult.warning}</span>
              </div>
            )}

            {/* Best Scenario Highlight Card */}
            {optimizationResult.best_scenario && (
              <div className="bg-gradient-to-r from-emerald-950/40 via-gray-900 to-indigo-950/30 border border-emerald-500/40 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                      Rank #1 Optimal Scenario
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      Target: {optimizationResult.target_column}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 font-mono">
                    Objective: {optimizationResult.objective}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-3 bg-gray-950/80 rounded-lg p-4 border border-gray-800 text-center">
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Baseline Prediction</span>
                    <span className="text-base font-semibold text-gray-300 font-mono">
                      {optimizationResult.baseline_prediction.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Optimal Prediction</span>
                    <span className="text-base font-semibold text-emerald-400 font-mono">
                      {optimizationResult.best_scenario.predicted_target.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Projected Improvement</span>
                    <span className="text-base font-semibold text-emerald-300 font-mono">
                      {optimizationResult.best_scenario.absolute_delta > 0 ? '+' : ''}
                      {optimizationResult.best_scenario.absolute_delta.toLocaleString()} (
                      {optimizationResult.best_scenario.percentage_delta > 0 ? '+' : ''}
                      {optimizationResult.best_scenario.percentage_delta}%)
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Feasibility</span>
                    <span className="text-base font-semibold text-indigo-400 font-mono">
                      {optimizationResult.best_scenario.feasibility}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-300 bg-gray-950/60 p-3 rounded-lg border border-gray-800 font-mono leading-relaxed">
                  💡 {optimizationResult.best_scenario.explanation}
                </p>
              </div>
            )}

            {/* Scenario Ranking Table */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Deterministic Scenario Ranking Table ({optimizationResult.scenarios.length} Scenarios Evaluated)
              </h4>
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-gray-950 text-gray-400 border-b border-gray-800">
                      <th className="py-2.5 px-3 text-center">Rank</th>
                      <th className="py-2.5 px-3">Scenario Changes</th>
                      <th className="py-2.5 px-3 text-right">Predicted Outcome</th>
                      <th className="py-2.5 px-3 text-right">Delta</th>
                      <th className="py-2.5 px-3 text-right">Delta %</th>
                      <th className="py-2.5 px-3 text-center">Feasibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 bg-gray-900/50">
                    {optimizationResult.scenarios.map((sc) => {
                      const isBest = sc.rank === 1;
                      const isImproved = sc.absolute_delta > 0;
                      return (
                        <tr
                          key={sc.scenario_id}
                          className={isBest ? 'bg-emerald-500/10 font-medium text-white' : 'text-gray-300 hover:bg-gray-800/40'}
                        >
                          <td className="py-2 px-3 text-center font-bold text-indigo-400">#{sc.rank}</td>
                          <td className="py-2 px-3">
                            {Object.entries(sc.changes)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ')}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-white">
                            {sc.predicted_target.toLocaleString()}
                          </td>
                          <td className={`py-2 px-3 text-right ${isImproved ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isImproved ? '+' : ''}{sc.absolute_delta.toLocaleString()}
                          </td>
                          <td className={`py-2 px-3 text-right ${isImproved ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sc.percentage_delta > 0 ? '+' : ''}{sc.percentage_delta}%
                          </td>
                          <td className="py-2 px-3 text-center text-indigo-300">{sc.feasibility}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Non-Causal Model Disclaimer */}
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-[11px] text-gray-500 flex items-center justify-between">
              <span>🛡️ <strong>Model-Based Disclaimer:</strong> These are model-based scenario projections, not causal guarantees.</span>
              <span className="font-mono">Generated: {new Date(optimizationResult.generated_at).toLocaleTimeString()}</span>
            </div>

            {/* Phase 7.3 Executive Recommendations UI */}
            <div className="mt-8 bg-gray-950/80 border border-indigo-500/30 rounded-xl p-6 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-gray-800 gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                      Phase 7.3 Decision Layer
                    </span>
                    <h3 className="text-xl font-bold text-white tracking-tight">Executive Decision Recommendations</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Evidence-backed, trade-off analyzed decision recommendations generated deterministically from model predictions and business insights.
                  </p>
                </div>

                <button
                  onClick={() => handleGenerateRecommendations()}
                  disabled={generatingRecs || !optimizationResult}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1.5 self-start md:self-auto"
                >
                  {generatingRecs ? 'Evaluating Evidence...' : 'Generate Executive Recommendations'}
                </button>
              </div>

              {recError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-xs mb-4">
                  {recError}
                </div>
              )}

              {recResponse && recResponse.warning && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs mb-4 flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>{recResponse.warning}</span>
                </div>
              )}

              {recommendations.length === 0 ? (
                <div className="text-center py-8 bg-gray-900/40 rounded-lg border border-dashed border-gray-800">
                  <p className="text-sm text-gray-400">No recommendation evaluations generated yet.</p>
                  <p className="text-xs text-gray-500 mt-1">Click 'Generate Executive Recommendations' to evaluate trade-offs and evidence.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => {
                    const isPositive = rec.absolute_delta >= 0;
                    const confColor =
                      rec.confidence === 'EXPLORATORY'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : rec.confidence === 'MODERATE'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

                    return (
                      <div
                        key={rec.id}
                        className="bg-gray-900/90 border border-gray-800 hover:border-indigo-500/40 rounded-xl p-5 transition-all shadow-md"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Priority #{rec.priority}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-gray-800 text-gray-300 border border-gray-700">
                              {rec.recommendation_type}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${confColor}`}>
                              {rec.confidence} Confidence
                            </span>
                          </div>

                          <span className="text-xs font-mono text-gray-400">
                            Target Metric: <strong className="text-white">{rec.target_metric}</strong>
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white mb-2">{rec.title}</h4>
                        <p className="text-xs text-gray-300 leading-relaxed mb-4">{rec.rationale}</p>

                        {/* Outcomes Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950/80 rounded-lg p-3 border border-gray-800 text-center mb-4 font-mono text-xs">
                          <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Baseline</span>
                            <span className="font-semibold text-gray-300">{rec.baseline_value.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Projected</span>
                            <span className="font-semibold text-white">{rec.projected_value.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Delta Impact</span>
                            <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? '+' : ''}{rec.absolute_delta.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Percentage Delta</span>
                            <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {rec.percentage_delta > 0 ? '+' : ''}{rec.percentage_delta}%
                            </span>
                          </div>
                        </div>

                        {/* Operational Trade-offs & Evidence Provenance */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
                          <div className="bg-gray-950/60 rounded-lg p-3 border border-gray-800">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                              ⚖️ Operational Trade-offs
                            </span>
                            <p className="text-gray-300 leading-relaxed text-[11px]">{rec.tradeoffs}</p>
                          </div>

                          <div className="bg-gray-950/60 rounded-lg p-3 border border-gray-800">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                              🔍 Evidence Provenance
                            </span>
                            <div className="space-y-1 font-mono text-[10px] text-gray-400">
                              <div className="truncate">Dataset ID: <span className="text-gray-200">{rec.evidence.dataset_id}</span></div>
                              <div className="truncate">ML Analysis ID: <span className="text-gray-200">{rec.evidence.ml_analysis_id}</span></div>
                              <div className="truncate">Optimization ID: <span className="text-gray-200">{rec.evidence.optimization_id}</span></div>
                              {rec.evidence.insight_ids && rec.evidence.insight_ids.length > 0 && (
                                <div className="pt-1 flex flex-wrap gap-1 items-center">
                                  <span>Phase 4 Insights:</span>
                                  {rec.evidence.insight_ids.map((insId) => (
                                    <span key={insId} className="bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800 text-[9px]">
                                      {insId.slice(0, 8)}...
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Model Feature Importance Ranks */}
      {modelExplanation && modelExplanation.feature_importances && (
        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Model Feature Importance Ranks</h3>
              <p className="text-xs text-gray-400">
                Deterministic feature weights extracted from model artifact '{modelExplanation.model_name}' (v{modelExplanation.model_version}).
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full">
              Target: {modelExplanation.target_column}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(modelExplanation.feature_importances)
              .sort(([, a], [, b]) => b - a)
              .map(([feat, weight]) => {
                const pct = Math.round(weight * 100);
                return (
                  <div key={feat} className="bg-gray-800/40 border border-gray-800 rounded-lg p-3">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-medium text-white font-mono">{feat}</span>
                      <span className="font-semibold text-indigo-400">{(weight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* What-If Scenario Builder & Evaluator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-gray-900/70 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Simulate What-If Scenario</h3>
          <form onSubmit={handleCreateScenario} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Scenario Name</label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={scenarioDesc}
                onChange={(e) => setScenarioDesc(e.target.value)}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Feature Delta Changes (JSON Object)
              </label>
              <textarea
                value={featureChangesInput}
                onChange={(e) => setFeatureChangesInput(e.target.value)}
                rows={5}
                required
                className="w-full bg-gray-950 font-mono border border-gray-700 rounded-lg p-3 text-xs text-emerald-400 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Model features: {latestAnalysis?.feature_columns.join(', ') || 'N/A'}
              </p>
            </div>

            <button
              type="submit"
              disabled={submittingScenario}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {submittingScenario ? 'Simulating Outcome...' : 'Evaluate What-If Scenario'}
            </button>
          </form>
        </div>

        {/* Evaluated Scenarios & Attribution */}
        <div className="lg:col-span-2 bg-gray-900/70 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">What-If Scenarios & Attribution</h3>

          {/* Active Comparison Modal / Panel */}
          {activeComparison && (
            <div className="mb-6 bg-gradient-to-r from-gray-950 via-gray-900 to-indigo-950/60 border border-indigo-500/50 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                    Side-by-Side Comparison
                  </span>
                  <h4 className="text-base font-bold text-white mt-1">
                    Baseline vs '{activeComparison.scenario_name}'
                  </h4>
                </div>
                <button
                  onClick={() => setActiveComparison(null)}
                  className="text-xs text-gray-400 hover:text-white bg-gray-800 px-2.5 py-1 rounded border border-gray-700 transition-colors"
                >
                  ✕ Close Comparison
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950 p-4 rounded-lg border border-gray-800 text-center font-mono text-xs">
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase">Baseline Prediction</span>
                  <span className="font-bold text-gray-300 text-sm">{activeComparison.baseline_prediction.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase">Scenario Prediction</span>
                  <span className="font-bold text-white text-sm">{activeComparison.scenario_prediction.toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase">Predicted Delta</span>
                  <span className={`font-bold text-sm ${activeComparison.predicted_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {activeComparison.predicted_delta >= 0 ? '+' : ''}{activeComparison.predicted_delta.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase">Delta %</span>
                  <span className={`font-bold text-sm ${activeComparison.predicted_delta_percentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {activeComparison.predicted_delta_percentage > 0 ? '+' : ''}{activeComparison.predicted_delta_percentage}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {!decisionSummary?.scenarios || decisionSummary.scenarios.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-800 rounded-lg">
              No scenarios simulated yet. Use the builder on the left to simulate input changes.
            </div>
          ) : (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {decisionSummary.scenarios.map((sc) => {
                const isPositive = sc.predicted_delta >= 0;
                return (
                  <div
                    key={sc.id}
                    className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-5 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-base font-semibold text-white">{sc.name}</h4>
                        <p className="text-xs text-gray-400">{sc.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCompareScenario(sc.id)}
                          disabled={comparingScenarioId === sc.id}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600/80 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50"
                        >
                          {comparingScenarioId === sc.id ? 'Comparing...' : 'Compare Side-by-Side'}
                        </button>
                        <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-gray-900 text-indigo-300 border border-gray-700">
                          Target: {sc.target_column}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 my-3 bg-gray-900/80 rounded-lg p-3 border border-gray-800 text-center">
                      <div>
                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Baseline</span>
                        <span className="text-sm font-semibold text-gray-300">{sc.base_value.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Predicted</span>
                        <span className="text-sm font-semibold text-white">{sc.predicted_outcome.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Predicted Impact</span>
                        <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{sc.predicted_delta.toLocaleString()} ({sc.predicted_delta_percentage > 0 ? '+' : ''}{sc.predicted_delta_percentage}%)
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Confidence</span>
                        <span className="text-sm font-semibold text-indigo-400">{(sc.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Feature Attribution Table */}
                    {sc.feature_contributions && Object.keys(sc.feature_contributions).length > 0 && (
                      <div className="mt-3 bg-gray-950/60 rounded-lg p-3 border border-gray-800/80">
                        <span className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                          Feature Delta Impact Attribution
                        </span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="border-b border-gray-800 text-gray-500">
                                <th className="py-1 px-2">Feature</th>
                                <th className="py-1 px-2">Baseline</th>
                                <th className="py-1 px-2">Scenario</th>
                                <th className="py-1 px-2">Marginal Delta</th>
                                <th className="py-1 px-2">Contribution</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50 text-gray-300">
                              {Object.entries(sc.feature_contributions).map(([fCol, info]) => (
                                <tr key={fCol} className={info.changed ? 'bg-indigo-500/10 text-white' : ''}>
                                  <td className="py-1.5 px-2 font-medium">{fCol} {info.changed && <span className="text-[10px] text-indigo-400">(changed)</span>}</td>
                                  <td className="py-1.5 px-2">{String(info.baseline_value ?? 'N/A')}</td>
                                  <td className="py-1.5 px-2 text-emerald-400">{String(info.scenario_value ?? 'N/A')}</td>
                                  <td className="py-1.5 px-2">{info.marginal_delta > 0 ? '+' : ''}{info.marginal_delta}</td>
                                  <td className="py-1.5 px-2 font-semibold text-indigo-300">{info.contribution_percentage}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
