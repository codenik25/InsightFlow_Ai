import React, { useState, useEffect } from 'react';
import {
  
  
  
  
  
  DecisionRecommendation,
  
  DecisionGuardrailResponse,
  
} from '../types';
import {
  
  
  
  fetchRecommendations,
  
  evaluateGuardrailsForRecommendation,
  fetchGuardrailsForDataset,
  
  
  
  
  
} from '../services/api';

interface GuardrailsDashboardProps {
  datasetId: string;
  isProcessed: boolean;
}

export const GuardrailsDashboard: React.FC<GuardrailsDashboardProps> = ({
  datasetId,
  isProcessed,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // What-If Scenario Form & Comparison State

  // Phase 7.2 Optimization Lab State

  // Phase 7.3 Executive Recommendations State
  const [recommendations, setRecommendations] = useState<DecisionRecommendation[]>([]);

  // Phase 7.4 Decision Guardrails State
  const [guardrailsMap, setGuardrailsMap] = useState<Record<string, DecisionGuardrailResponse>>({});
  const [evaluatingGuardrailId, setEvaluatingGuardrailId] = useState<string | null>(null);

  useEffect(() => {
    fetchDecisionData();
  }, [datasetId]);

  const fetchDecisionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 5. Fetch Phase 7.3 Decision Recommendations
      try {
        const storedRecs = await fetchRecommendations(datasetId);
        setRecommendations(storedRecs);
      } catch (recErr) {
        console.warn('Recommendations fetch warning:', recErr);
      }

      // 6. Fetch Phase 7.4 Guardrail Evaluations
      try {
        const storedGuardrails = await fetchGuardrailsForDataset(datasetId);
        const gMap: Record<string, DecisionGuardrailResponse> = {};
        storedGuardrails.forEach((g) => {
          gMap[g.recommendation_id] = g;
        });
        setGuardrailsMap(gMap);
      } catch (gErr) {
        console.warn('Guardrails fetch warning:', gErr);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading Decision Intelligence data');
    } finally {
      setLoading(false);
    }
  };









  const handleEvaluateGuardrailForRec = async (recId: string) => {
    setEvaluatingGuardrailId(recId);
    try {
      const gRes = await evaluateGuardrailsForRecommendation(datasetId, recId);
      setGuardrailsMap((prev) => ({ ...prev, [recId]: gRes }));
    } catch (err: any) {
      console.error('Guardrail evaluation error:', err);
    } finally {
      setEvaluatingGuardrailId(null);
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
                Phase 7.4 Decision Guardrails
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Deterministic Scenario Ranking
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Decision Guardrails & Feasibility Audit</h2>
            <p className="text-gray-400 text-sm">
              Evaluate strategic decisions against safety boundaries, feasibility constraints, and compliance rules.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm">
          {error}
        </div>
      )}

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

                
              </div>

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

                        {/* Phase 7.4 Decision Guardrails & Feasibility Analysis Card */}
                        {(() => {
                          const guardrail = guardrailsMap[rec.id];
                          if (!guardrail) {
                            return (
                              <div className="bg-gray-950/80 rounded-lg p-3 border border-gray-800 flex items-center justify-between text-xs">
                                <span className="text-gray-400 font-mono text-[11px]">🛡️ Guardrails: Not evaluated yet</span>
                                <button
                                  onClick={() => handleEvaluateGuardrailForRec(rec.id)}
                                  disabled={evaluatingGuardrailId === rec.id}
                                  className="text-[10px] font-semibold bg-indigo-600/80 hover:bg-indigo-500 text-white px-2.5 py-1 rounded transition-colors"
                                >
                                  {evaluatingGuardrailId === rec.id ? 'Auditing Rules...' : 'Run Guardrails Audit'}
                                </button>
                              </div>
                            );
                          }

                          const dStatusColor =
                            guardrail.decision_status === 'READY_TO_CONSIDER'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : guardrail.decision_status === 'HUMAN_REVIEW_REQUIRED'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

                          const rLevelColor =
                            guardrail.risk_level === 'LOW'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : guardrail.risk_level === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                          const fStatusColor =
                            guardrail.feasibility_status === 'FEASIBLE'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : guardrail.feasibility_status === 'CAUTION'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                          return (
                            <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-indigo-950/20 rounded-lg p-4 border border-indigo-500/30 space-y-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-white text-xs flex items-center space-x-1">
                                    <span>🛡️</span>
                                    <span>Decision Guardrails & Feasibility Audit</span>
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${dStatusColor}`}>
                                    {guardrail.decision_status.replace(/_/g, ' ')}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold border uppercase ${fStatusColor}`}>
                                    Feasibility: {guardrail.feasibility_status}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold border uppercase ${rLevelColor}`}>
                                    Risk: {guardrail.risk_level}
                                  </span>
                                </div>
                              </div>

                              {/* Guardrail Scores Bar Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-gray-950/90 rounded p-2.5 border border-gray-800 font-mono text-[10px] text-center">
                                <div>
                                  <span className="block text-gray-500 text-[9px]">Feasibility</span>
                                  <span className="font-bold text-white">{guardrail.feasibility_score}/100</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500 text-[9px]">Realism</span>
                                  <span className="font-bold text-gray-300">{guardrail.realism_score}/100</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500 text-[9px]">Risk Score</span>
                                  <span className="font-bold text-amber-400">{guardrail.risk_score}/100</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500 text-[9px]">Confidence</span>
                                  <span className="font-bold text-indigo-300">{guardrail.confidence_score}/100</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500 text-[9px]">Readiness</span>
                                  <span className="font-bold text-emerald-400">{guardrail.decision_readiness_score}/100</span>
                                </div>
                              </div>

                              {/* Executive Guardrail Explanation */}
                              <p className="text-[11px] text-gray-300 leading-relaxed font-mono bg-gray-950/50 p-2.5 rounded border border-gray-800">
                                💡 {guardrail.explanation}
                              </p>

                              {/* Rule Breakdown List */}
                              {guardrail.guardrail_results && guardrail.guardrail_results.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    Rule Verification Log ({guardrail.passed_rules.length} Passed, {guardrail.warnings.length} Warnings, {guardrail.violated_rules.length} Failed)
                                  </span>
                                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                    {guardrail.guardrail_results.map((rule, idx) => {
                                      const statusIcon =
                                        rule.status === 'PASS' ? '✅' : rule.status === 'WARNING' ? '⚠️' : '❌';
                                      const badgeClass =
                                        rule.status === 'PASS'
                                          ? 'text-emerald-400'
                                          : rule.status === 'WARNING'
                                          ? 'text-amber-400'
                                          : 'text-rose-400';
                                      return (
                                        <div
                                          key={idx}
                                          className="bg-gray-950/60 p-2 rounded border border-gray-800 flex items-start justify-between gap-2 text-[10px]"
                                        >
                                          <div className="space-y-0.5">
                                            <div className="flex items-center space-x-1.5">
                                              <span>{statusIcon}</span>
                                              <span className={`font-bold font-mono ${badgeClass}`}>{rule.rule_name}</span>
                                              <span className="bg-gray-800 text-gray-400 text-[9px] px-1.5 py-0.2 rounded font-mono">
                                                {rule.category}
                                              </span>
                                            </div>
                                            <p className="text-gray-300 text-[10px] pl-5">{rule.message}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
    </div>
  );
};

export default GuardrailsDashboard;
