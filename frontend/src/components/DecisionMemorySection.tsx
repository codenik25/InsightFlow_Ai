import React, { useState, useEffect } from 'react';
import { DecisionMemoryResponse, DecisionPerformanceSummary, DecisionRecommendationSummary } from '../types';
import { fetchDecisionMemory, fetchDecisionPerformance, recordDecisionOutcome } from '../services/api';

interface DecisionMemorySectionProps {
  datasetId: string;
  recommendations: DecisionRecommendationSummary[];
  onOutcomeRecorded?: () => void;
}

export const DecisionMemorySection: React.FC<DecisionMemorySectionProps> = ({
  datasetId,
  recommendations,
  onOutcomeRecorded,
}) => {
  const [memory, setMemory] = useState<DecisionMemoryResponse | null>(null);
  const [perf, setPerf] = useState<DecisionPerformanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedRecId, setSelectedRecId] = useState<string>('');
  const [actualMetric, setActualMetric] = useState<string>('');
  const [actualValue, setActualValue] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [datasetId]);

  useEffect(() => {
    if (recommendations && recommendations.length > 0) {
      if (!selectedRecId) {
        setSelectedRecId(recommendations[0].recommendation_id);
        setActualMetric(recommendations[0].target_metric || 'target');
      }
    }
  }, [recommendations]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [memData, perfData] = await Promise.all([
        fetchDecisionMemory(datasetId),
        fetchDecisionPerformance(datasetId),
      ]);
      setMemory(memData);
      setPerf(perfData);
    } catch (err: any) {
      setError(err.message || 'Failed to load Decision Memory');
    } finally {
      setLoading(false);
    }
  };

  const handleRecChange = (recId: string) => {
    setSelectedRecId(recId);
    const found = recommendations.find((r) => r.recommendation_id === recId);
    if (found) {
      setActualMetric(found.target_metric || 'target');
    }
  };

  const handleSubmitOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecId || !actualMetric || !actualValue) {
      setError('Please fill in all required outcome fields.');
      return;
    }

    const val = parseFloat(actualValue);
    if (isNaN(val)) {
      setError('Actual value must be a valid number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await recordDecisionOutcome(datasetId, {
        recommendation_id: selectedRecId,
        actual_metric: actualMetric,
        actual_value: val,
        notes: notes || undefined,
      });

      // Clear Form & Reload Memory
      setActualValue('');
      setNotes('');
      await loadData();
      if (onOutcomeRecorded) onOutcomeRecorded();
    } catch (err: any) {
      setError(err.message || 'Failed to record decision outcome.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center space-y-2">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-gray-400">Loading Decision Memory & Performance History...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🧠</span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">Decision Memory & Outcome Feedback</h3>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Closed-loop observational feedback comparing expected model projections against real-world measured outcomes.
          </p>
        </div>
        <button
          onClick={loadData}
          className="self-start sm:self-auto bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-mono px-3 py-1.5 rounded-lg border border-gray-800 transition-colors"
        >
          🔄 Refresh Memory
        </button>
      </div>

      {/* Performance Summary Cards */}
      {perf && (
        <div className="space-y-3">
          {perf.limited_history_warning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs font-mono flex items-center space-x-2">
              <span>⚠️</span>
              <span>{perf.limited_history_warning}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
            <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Decisions</span>
              <p className="text-2xl font-black text-white">{perf.total_decisions}</p>
              <p className="text-[10px] text-gray-500">Evaluated outcomes</p>
            </div>

            <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">Achieved (≥95%)</span>
              <p className="text-2xl font-black text-emerald-400">{perf.achieved_count}</p>
              <p className="text-[10px] text-gray-500">Target met or exceeded</p>
            </div>

            <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-1">
              <span className="text-[10px] font-bold text-indigo-400 uppercase">Achievement Rate</span>
              <p className="text-2xl font-black text-indigo-300">{perf.achievement_rate}%</p>
              <p className="text-[10px] text-gray-500">Decisions ≥70% target</p>
            </div>

            <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase">Avg Projection Error</span>
              <p className="text-2xl font-black text-amber-300">{perf.average_percentage_error}%</p>
              <p className="text-[10px] text-gray-500">Relative deviation</p>
            </div>
          </div>
        </div>
      )}

      {/* Record Outcome Form */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
          <span>📝</span>
          <span>Record Real-World Outcome</span>
        </h4>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-lg font-mono">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmitOutcome} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">Select Recommendation *</label>
              <select
                value={selectedRecId}
                onChange={(e) => handleRecChange(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 focus:border-indigo-500 focus:outline-none"
              >
                {recommendations.map((r) => (
                  <option key={r.recommendation_id} value={r.recommendation_id}>
                    #{r.priority} {r.title} (Exp: {r.projected_value})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">Actual Metric *</label>
              <input
                type="text"
                value={actualMetric}
                onChange={(e) => setActualMetric(e.target.value)}
                placeholder="e.g. total_revenue"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">Observed Actual Value *</label>
              <input
                type="number"
                step="any"
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                placeholder="e.g. 102400"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-300 mb-1">Measurement Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Observed revenue 30 days post-implementation"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || recommendations.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Evaluating & Saving...' : 'Record & Evaluate Outcome'}
          </button>
        </form>
      </div>

      {/* Decision Memory Table */}
      {memory && memory.history && memory.history.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
            <span>📜</span>
            <span>Historical Decision Memory ({memory.total_records} Entries)</span>
          </h4>

          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-gray-900/90 text-gray-400 text-[10px] uppercase border-b border-gray-800">
                <tr>
                  <th className="p-3">Decision Recommendation</th>
                  <th className="p-3">Projected (Expected)</th>
                  <th className="p-3">Observed (Actual)</th>
                  <th className="p-3">Achievement %</th>
                  <th className="p-3">Outcome Status</th>
                  <th className="p-3">Recorded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {memory.history.map((h) => {
                  const statusColor =
                    h.outcome_status === 'ACHIEVED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : h.outcome_status === 'PARTIALLY_ACHIEVED'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

                  return (
                    <tr key={h.outcome_id} className="hover:bg-gray-900/50 transition-colors">
                      <td className="p-3 font-medium text-white">
                        <div>{h.recommendation_title}</div>
                        <span className="text-[10px] text-gray-500">Metric: {h.target_metric}</span>
                      </td>
                      <td className="p-3 text-indigo-300 font-bold">{h.expected_value}</td>
                      <td className="p-3 text-gray-100 font-bold">{h.actual_value}</td>
                      <td className="p-3 font-bold">{h.achievement_percentage}%</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${statusColor}`}>
                          {h.outcome_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-[10px] text-gray-400">
                        {new Date(h.recorded_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-xl p-6 text-center font-mono text-xs text-gray-400 space-y-1">
          <p>No real-world outcome feedback recorded yet for this dataset.</p>
          <p className="text-[11px] text-gray-500">Record an outcome above to initialize historical Decision Memory.</p>
        </div>
      )}

      {/* Non-Causal Observational Notice */}
      <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-[11px] text-gray-500 font-mono">
        🛡️ <strong>Observational Notice:</strong> Recorded outcomes represent user-supplied real-world measurements compared against historical model projections. InsightFlow does not claim causal attribution for observed business changes.
      </div>
    </div>
  );
};
