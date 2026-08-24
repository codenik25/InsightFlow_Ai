import React, { useState, useEffect } from 'react';
import { DecisionCommandCenterResponse } from '../types';
import { fetchDecisionCommandCenter } from '../services/api';
import { AIDecisionBriefCard } from './AIDecisionBriefCard';
import { DecisionMemorySection } from './DecisionMemorySection';

interface DecisionCommandCenterProps {
  datasetId: string;
  isProcessed: boolean;
}

export const DecisionCommandCenter: React.FC<DecisionCommandCenterProps> = ({
  datasetId,
  isProcessed,
}) => {
  const [data, setData] = useState<DecisionCommandCenterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCommandCenter();
  }, [datasetId]);

  const loadCommandCenter = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDecisionCommandCenter(datasetId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load Decision Command Center data');
    } finally {
      setLoading(false);
    }
  };

  if (!isProcessed) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-amber-200">
        <h3 className="text-lg font-semibold mb-2">Command Center Locked</h3>
        <p className="text-sm">
          The Decision Intelligence Command Center requires a cleaned, processed dataset with generated recommendations and guardrails. Please run the decision pipeline first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-400 font-mono">Aggregating Decision Intelligence Evidence Chain...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-900 border border-rose-500/30 rounded-xl p-6 text-rose-300 space-y-3">
        <h3 className="text-base font-bold flex items-center space-x-2">
          <span>⚠️</span>
          <span>Decision Command Center Unavailable</span>
        </h3>
        <p className="text-xs text-gray-300">{error || 'No decision intelligence artifacts found.'}</p>
        <button
          onClick={loadCommandCenter}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Retry Aggregation
        </button>
      </div>
    );
  }

  const { snapshot, primary_recommendation: primary, alternative_recommendations: alternatives, comparison, risk_summary: risk, evidence_chain: chain, key_insights: insights, next_actions: actions } = data;

  const dStatusColor =
    snapshot.decision_status === 'READY_TO_CONSIDER'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : snapshot.decision_status === 'HUMAN_REVIEW_REQUIRED'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  const riskColor =
    risk.risk_level === 'LOW'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : risk.risk_level === 'MEDIUM'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

  return (
    <div className="space-y-8">
      {/* Section A: Executive Decision Header */}
      <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Phase 7.5 Command Center
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border uppercase ${dStatusColor}`}>
                {snapshot.decision_status.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">{data.dataset_name} — Executive Decision Center</h2>
            <p className="text-xs text-gray-400 mt-1">
              Unified, evidence-backed decision support view aggregating Phase 4–7.4 analytical outputs.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right font-mono text-[11px] text-gray-400 hidden sm:block">
              <div>Dataset ID: {data.processed_dataset_id.slice(0, 8)}...</div>
              <div>Generated: {new Date(data.generated_at).toLocaleTimeString()}</div>
            </div>
            <button
              onClick={loadCommandCenter}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3.5 py-2 rounded-lg border border-gray-700 transition-colors flex items-center space-x-1"
            >
              <span>🔄 Refresh</span>
            </button>
          </div>
        </div>

        {/* Small Dataset Warning Banner */}
        {snapshot.small_dataset_warning && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs flex items-center space-x-2">
            <span className="font-bold text-sm">⚠️</span>
            <span>{snapshot.small_dataset_warning}</span>
          </div>
        )}
      </div>

      {/* Phase 7.6 Executive AI Decision Brief Component */}
      <AIDecisionBriefCard datasetId={datasetId} recommendationId={primary?.recommendation_id} />

      {/* Section B: Decision Snapshot Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Decision Readiness', val: snapshot.decision_readiness_score, color: 'from-emerald-500 to-indigo-500' },
          { label: 'Feasibility Score', val: snapshot.feasibility_score, color: 'from-emerald-500 to-teal-500' },
          { label: 'Realism Score', val: snapshot.realism_score, color: 'from-blue-500 to-indigo-500' },
          { label: 'Risk Profile', val: snapshot.risk_score, color: 'from-amber-500 to-rose-500' },
          { label: 'Model Confidence', val: snapshot.confidence_score, color: 'from-indigo-500 to-purple-500' },
          { label: 'Data Quality', val: snapshot.dataset_quality_score, color: 'from-teal-500 to-emerald-500' },
        ].map((card, idx) => (
          <div key={idx} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{card.label}</span>
            <div className="my-2 flex items-baseline justify-between font-mono">
              <span className="text-xl font-extrabold text-white">{card.val.toFixed(0)}</span>
              <span className="text-[10px] text-gray-500">/ 100</span>
            </div>
            <div className="w-full bg-gray-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`bg-gradient-to-r ${card.color} h-1.5 rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(Math.max(card.val, 5), 100)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Section C & D Grid: Primary Recommendation & Comparison Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section C: Primary Executive Recommendation */}
        <div className="bg-gray-900/90 border border-indigo-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                  Priority #{primary?.priority || 1} Primary Recommendation
                </span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-gray-800 text-gray-300 border border-gray-700">
                  {primary?.recommendation_type}
                </span>
              </div>
              <span className="text-xs font-mono text-gray-400">
                Target: <strong className="text-white">{primary?.target_metric}</strong>
              </span>
            </div>

            <h3 className="text-xl font-extrabold text-white mb-2">{primary?.title || 'No Primary Recommendation'}</h3>

            {/* Projected Outcome Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950/90 rounded-xl p-4 border border-gray-800 text-center my-4 font-mono text-xs">
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">Baseline</span>
                <span className="font-bold text-gray-300 text-sm">{primary?.baseline_value.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">Projected</span>
                <span className="font-bold text-white text-sm">{primary?.projected_value.toLocaleString()}</span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">Projected Delta</span>
                <span className={`font-bold text-sm ${primary && primary.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {primary && primary.absolute_delta >= 0 ? '+' : ''}{primary?.absolute_delta.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-gray-500 uppercase">Delta %</span>
                <span className={`font-bold text-sm ${primary && primary.percentage_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {primary && primary.percentage_delta > 0 ? '+' : ''}{primary?.percentage_delta}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800 text-xs text-gray-300 leading-relaxed font-mono">
            🛡️ <strong>Model-Based Guardrail Status:</strong> {primary?.decision_status.replace(/_/g, ' ')} ({primary?.confidence} Confidence)
          </div>
        </div>

        {/* Section D: Current vs Recommended Feature Comparison Matrix */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1 flex items-center space-x-2">
            <span>📊</span>
            <span>Current vs Recommended Feature Matrix</span>
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Feature-level operational changes proposed under the primary recommendation.
          </p>

          {comparison.length === 0 ? (
            <p className="text-xs text-gray-500 font-mono py-6 text-center border border-dashed border-gray-800 rounded-lg">
              No specific feature adjustments proposed.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-gray-950 text-gray-400 border-b border-gray-800">
                    <th className="py-2.5 px-3">Feature Column</th>
                    <th className="py-2.5 px-3 text-right">Baseline Value</th>
                    <th className="py-2.5 px-3 text-right">Proposed Value</th>
                    <th className="py-2.5 px-3 text-right">Displacement Delta</th>
                    <th className="py-2.5 px-3 text-right">Model Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                  {comparison.map((row) => (
                    <tr key={row.feature} className="hover:bg-gray-800/40 text-gray-300">
                      <td className="py-2.5 px-3 font-semibold text-white">{row.feature}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">{String(row.baseline_value)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-300">{String(row.proposed_value)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {row.delta !== null && row.delta !== undefined
                          ? (row.delta >= 0 ? `+${row.delta}` : row.delta)
                          : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-400 font-semibold">
                        {row.contribution_percent !== null && row.contribution_percent !== undefined
                          ? `${row.contribution_percent}%`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Section E & F Grid: Risk & Evidence Chain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section E: Risk & Guardrail Summary */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>🛡️</span>
              <span>Risk & Guardrail Evaluation Log</span>
            </h3>
            <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${riskColor}`}>
              Risk Level: {risk.risk_level}
            </span>
          </div>

          {/* Warnings List */}
          {risk.warnings && risk.warnings.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Operational Warning Log</span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {risk.warnings.map((w, idx) => (
                  <div key={idx} className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-200 flex items-start space-x-2">
                    <span>⚠️</span>
                    <span className="leading-relaxed">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed Rules List */}
          {risk.passed_rules && risk.passed_rules.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Verified Rules Passed ({risk.passed_rules.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {risk.passed_rules.map((ruleName, idx) => (
                  <span key={idx} className="bg-emerald-950/60 text-emerald-300 border border-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono flex items-center space-x-1">
                    <span>✅</span>
                    <span>{ruleName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section F: Visual Evidence Provenance Chain */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-1 flex items-center space-x-2">
            <span>🔗</span>
            <span>Evidence Provenance Flowchart</span>
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Sequential lineage linking primary recommendation to upstream analytical evidence.
          </p>

          {!chain || !chain.nodes || chain.nodes.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center border border-dashed border-gray-800 rounded-lg">
              No evidence chain available.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {chain.nodes.map((node, idx) => (
                <div key={node.node_id + idx} className="flex items-start space-x-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 text-indigo-300 flex items-center justify-center font-mono text-[10px] font-bold">
                      {idx + 1}
                    </div>
                    {idx < chain.nodes.length - 1 && <div className="w-0.5 h-6 bg-gray-800 my-0.5"></div>}
                  </div>
                  <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono text-[11px]">{node.title}</span>
                      <span className="bg-gray-800 text-gray-400 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase">
                        {node.node_type}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{node.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section G: Supporting Phase 4 Insights & Alternatives */}
      {insights && insights.length > 0 && (
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>💡</span>
            <span>Supporting Phase 4 Business Insights ({insights.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {insights.map((ins: any, idx: number) => (
              <div key={idx} className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{ins.title}</span>
                  <span className="bg-indigo-950 text-indigo-300 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase border border-indigo-800">
                    {ins.category}
                  </span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">{ins.observation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section G: Alternative Recommendations */}
      {alternatives && alternatives.length > 0 && (
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>🔀</span>
            <span>Alternative Optimization Recommendations</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alternatives.map((alt) => (
              <div key={alt.recommendation_id} className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Priority #{alt.priority}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{alt.recommendation_type}</span>
                </div>
                <h4 className="text-sm font-bold text-white">{alt.title}</h4>
                <div className="flex justify-between text-xs font-mono pt-1 text-gray-400 border-t border-gray-900">
                  <span>Projected Outcome: <strong className="text-white">{alt.projected_value.toLocaleString()}</strong></span>
                  <span className={alt.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {alt.absolute_delta >= 0 ? '+' : ''}{alt.absolute_delta.toLocaleString()} ({alt.percentage_delta}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section H: Phase 7.7 Decision Memory & Outcome Feedback Engine */}
      <DecisionMemorySection
        datasetId={datasetId}
        recommendations={[
          ...(primary ? [primary] : []),
          ...alternatives,
        ]}
      />

      {/* Section I: Deterministic Executive Next Actions */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-gray-900 to-gray-950 border border-indigo-500/30 rounded-2xl p-6">
        <h3 className="text-base font-bold text-white mb-1 flex items-center space-x-2">
          <span>📋</span>
          <span>Executive Review Checklist & Deterministic Next Actions</span>
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Recommended review steps prior to taking operational commitment on proposed scenario changes.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map((act, idx) => (
            <div key={idx} className="bg-gray-950 p-3 rounded-lg border border-gray-800 flex items-start space-x-3 text-xs text-gray-300">
              <span className="text-indigo-400 font-bold font-mono">0{idx + 1}.</span>
              <span className="leading-relaxed">{act}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
