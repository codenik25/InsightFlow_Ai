import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  FolderMinus,
} from 'lucide-react';
import { DecisionPerformanceResponse } from '../types';
import { fetchProjectDecisionPerformance } from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DecisionPerformanceViewProps {
  projectId?: string | null;
  onSelectDecision?: (decisionId: string) => void;
}

export const DecisionPerformanceView: React.FC<DecisionPerformanceViewProps> = ({
  projectId,
  onSelectDecision: _onSelectDecision,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DecisionPerformanceResponse | null>(null);

  // Filters & Configuration
  const [minObservations, setMinObservations] = useState<number>(3);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

  const loadPerformance = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectDecisionPerformance(projectId, minObservations, period);
      setData(res);
      if (res.metrics.length > 0 && !selectedMetric) {
        setSelectedMetric(res.metrics[0].metric_name);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve Decision Performance Intelligence.');
    } finally {
      setLoading(false);
    }
  }, [projectId, minObservations, period]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  if (!projectId) {
    return (
      <div className="bg-[#030914] border border-[rgba(120,190,230,0.16)] rounded-2xl p-10 sm:p-14 text-center max-w-lg mx-auto space-y-4 shadow-xl">
        <FolderMinus className="w-12 h-12 text-[#8795A8] mx-auto" />
        <h3 className="text-xl font-sans font-bold text-white tracking-tight">NO PROJECT SCOPE</h3>
        <p className="text-sm font-sans text-[#8795A8]">
          Performance intelligence requires a valid project context to evaluate longitudinal multi-decision variance.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <ContinuousIntelligenceEngine
        mode="performance"
        isLoading={loading}
        isFullScreen={false}
        minHeight="520px"
        error={error}
        onRetry={loadPerformance}
      />
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#030914] border border-rose-500/30 rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-sans font-bold text-white tracking-tight">PERFORMANCE TELEMETRY UNAVAILABLE</h3>
          <p className="text-sm font-sans text-[#8795A8]">{error || 'Unable to retrieve project performance.'}</p>
        </div>
        <button
          onClick={loadPerformance}
          className="h-10 px-6 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-mono font-semibold tracking-wider uppercase rounded-xl border border-rose-500/30 transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Load</span>
        </button>
      </div>
    );
  }

  const { summary, trends, metrics, observations } = data;

  return (
    <div className="space-y-6 select-none">
      {/* 1. HERO — DECISION PERFORMANCE LAB */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.25)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[rgba(120,190,230,0.12)] pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-violet-500/10 text-violet-400 border border-violet-500/25">
                <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
                PHASE 04 PERFORMANCE LAB
              </span>
              <span className="text-xs font-mono text-[#8795A8] bg-[#07111F]/70 px-2.5 py-1 rounded-full border border-[rgba(120,190,230,0.12)]">
                {summary.total_decisions} Governed Decisions
              </span>
            </div>

            <h2 className="text-3xl sm:text-[36px] font-sans font-bold text-white tracking-tight leading-tight">
              DECISION <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400">PERFORMANCE LAB</span>
            </h2>

            <p className="text-sm sm:text-base font-sans text-[#B7C3D3] max-w-2xl leading-relaxed">
              Track longitudinal empirical accuracy, material deviation corridors, and closed-loop model recalibration rates across decisions.
            </p>
          </div>

          {/* Controls: Period & Min Observations */}
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            {/* Period Selector */}
            <div className="flex items-center gap-1 bg-[#030914] p-1 rounded-xl border border-[rgba(120,190,230,0.16)] text-xs font-mono">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg uppercase font-bold transition-all ${
                    period === p
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'text-[#8795A8] hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Min Obs Threshold */}
            <div className="flex items-center gap-2 bg-[#030914] px-3.5 py-2 rounded-xl border border-[rgba(120,190,230,0.16)] text-xs font-mono text-[#8795A8]">
              <span>Min Obs:</span>
              <select
                value={minObservations}
                onChange={(e) => setMinObservations(parseInt(e.target.value, 10))}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value={1} className="bg-slate-900">1 (Strict)</option>
                <option value={3} className="bg-slate-900">3 (Standard)</option>
                <option value={5} className="bg-slate-900">5 (Robust)</option>
              </select>
            </div>

            <button
              onClick={loadPerformance}
              className="h-10 w-10 rounded-xl bg-[#030914] border border-[rgba(120,190,230,0.16)] text-[#8795A8] hover:text-white flex items-center justify-center transition-colors"
              title="Refresh Performance"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. KPI RIBBON (32-40px Metrics) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-1">
          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1">
            <span className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
              TOTAL DECISIONS
            </span>
            <span className="text-3xl font-mono font-bold text-white block">
              {summary.total_decisions}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Tracked records</span>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1">
            <span className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
              OBSERVED
            </span>
            <span className="text-3xl font-mono font-bold text-emerald-400 block">
              {summary.decisions_with_outcomes}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Empirical results</span>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1">
            <span className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
              AWAITING ACTUALS
            </span>
            <span className="text-3xl font-mono font-bold text-amber-400 block">
              {summary.pending_outcomes}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Pending measure</span>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1">
            <span className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
              COVERAGE RATE
            </span>
            <span className="text-3xl font-mono font-bold text-cyan-300 block">
              {(summary.outcome_coverage_rate * 100).toFixed(0)}%
            </span>
            <span className="text-[11px] font-mono text-slate-500">{summary.decisions_with_actual_outcomes} tracked</span>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1">
            <span className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
              MATCH RATE
            </span>
            <span className="text-3xl font-mono font-bold text-teal-300 block">
              {(summary.match_rate * 100).toFixed(1)}%
            </span>
            <span className="text-[11px] font-mono text-slate-500">≤ 1% error tolerance</span>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1">
            <span className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
              MATERIAL SHIFT
            </span>
            <span className={`text-3xl font-mono font-bold block ${
              summary.material_difference_rate > 0.2 ? 'text-rose-400' : 'text-slate-200'
            }`}>
              {(summary.material_difference_rate * 100).toFixed(1)}%
            </span>
            <span className="text-[11px] font-mono text-slate-500">Exceeded threshold</span>
          </div>
        </div>
      </div>

      {/* 3. REPEATED DEVIATION WARNING BANNER */}
      {observations.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h4 className="text-sm font-sans font-bold text-white uppercase tracking-wider">
              REPEATED OUTCOME DEVIATION SIGNALS FLAGGED
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {observations.map((obs, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#020711] border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold uppercase">Deviation Rate</span>
                  <span className="text-white font-bold">{(obs.deviation_rate * 100).toFixed(0)}%</span>
                </div>
                <p className="text-sm font-sans text-[#B7C3D3] leading-relaxed">
                  {obs.statement}
                </p>
                <div className="pt-2 border-t border-[rgba(120,190,230,0.1)] flex items-center justify-between text-[11px] font-mono text-[#8795A8]">
                  <span>Observed: <strong className="text-white">{obs.observed_count}</strong></span>
                  <span>Material Dev: <strong className="text-rose-400">{obs.material_deviation_count}</strong></span>
                  <span>Threshold: <strong className="text-slate-300">{(obs.threshold_used * 100).toFixed(0)}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. CHRONOLOGICAL TREND VISUALIZATION */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-4">
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold tracking-widest text-violet-400 uppercase">
              LONGITUDINAL DRIFT & VARIANCE
            </span>
            <h3 className="text-xl font-sans font-bold text-white tracking-tight">
              Periodic Match Rate & Mean Variance ({period.toUpperCase()})
            </h3>
          </div>
          <span className="text-xs font-mono text-[#8795A8]">
            {trends.length} Observation Periods
          </span>
        </div>

        {trends.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.12)] text-center text-xs font-mono text-[#8795A8]">
            NO PERIODIC OBSERVATION POINTS RECORDED FOR THE SELECTED CRITERIA
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visual SVG Trend Bar / Line */}
            <div className="h-44 w-full bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-4 flex items-end gap-3 justify-between">
              {trends.map((t, idx) => {
                const matchPct = t.observed_outcomes > 0 ? (t.matched_outcomes / t.observed_outcomes) * 100 : 0;
                const isHovered = hoveredPointIdx === idx;
                return (
                  <div
                    key={t.period_start}
                    className="flex-1 flex flex-col items-center justify-end h-full gap-2 group cursor-pointer"
                    onMouseEnter={() => setHoveredPointIdx(idx)}
                    onMouseLeave={() => setHoveredPointIdx(null)}
                  >
                    {isHovered && (
                      <div className="text-[10px] font-mono text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-cyan-400/40 whitespace-nowrap">
                        {matchPct.toFixed(0)}% Match ({t.observed_outcomes} obs)
                      </div>
                    )}
                    <div className="w-full max-w-[48px] bg-slate-900 rounded-t h-full flex items-end overflow-hidden p-0.5">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(12, matchPct)}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.05 }}
                        className={`w-full rounded-t transition-colors ${
                          isHovered
                            ? 'bg-cyan-400 shadow-[0_0_12px_rgba(57,214,245,0.7)]'
                            : 'bg-gradient-to-t from-violet-600 to-indigo-400'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#8795A8] truncate max-w-[50px]">
                      {t.period_label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Periodic Breakdown Rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {trends.map((t) => {
                const avgRel = t.average_relative_delta;
                const periodMatchPct = t.observed_outcomes > 0 ? (t.matched_outcomes / t.observed_outcomes) * 100 : 0;
                return (
                  <div key={t.period_start} className="p-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.12)] space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-white font-bold">
                      <span>{t.period_label}</span>
                      <span className="text-cyan-400">{periodMatchPct.toFixed(0)}% Match</span>
                    </div>
                    <div className="flex items-center justify-between text-[#8795A8] text-[11px]">
                      <span>Observed: <strong className="text-white">{t.observed_outcomes}</strong></span>
                      <span>Mean Var: <strong className={avgRel && avgRel > 0.05 ? 'text-rose-400' : 'text-emerald-400'}>
                        {avgRel !== null && avgRel !== undefined ? `${(avgRel * 100).toFixed(1)}%` : '0.0%'}
                      </strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. METRIC ACCURACY BREAKDOWN TABLE */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-4">
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold tracking-widest text-violet-400 uppercase">
              METRIC GRANULARITY
            </span>
            <h3 className="text-xl font-sans font-bold text-white tracking-tight">
              Individual Metric Calibration & Variance
            </h3>
          </div>
          <span className="text-xs font-mono text-[#8795A8]">
            {metrics.length} Target Metrics Tracked
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[rgba(120,190,230,0.14)] bg-[#020711]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-white/[0.02] text-[#8795A8] border-b border-[rgba(120,190,230,0.12)]">
              <tr>
                <th className="py-3 px-4 font-semibold">Target Metric</th>
                <th className="py-3 px-4 text-right font-semibold">Decisions</th>
                <th className="py-3 px-4 text-right font-semibold">Observed</th>
                <th className="py-3 px-4 text-right font-semibold">Mean Variance</th>
                <th className="py-3 px-4 text-right font-semibold">Match Rate</th>
                <th className="py-3 px-4 text-right font-semibold">Material Dev</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(120,190,230,0.06)] text-slate-300">
              {metrics.map((m) => {
                const meanVal = m.mean_relative_delta;
                const meanPercent = meanVal !== null && meanVal !== undefined ? (meanVal * 100).toFixed(2) : '—';
                return (
                  <tr key={m.metric_name} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      {m.metric_name}
                    </td>
                    <td className="py-3 px-4 text-right">{m.total_decisions}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">{m.observed_outcomes}</td>
                    <td className="py-3 px-4 text-right font-bold text-cyan-300">
                      {meanPercent !== '—' ? `${meanVal! > 0 ? '+' : ''}${meanPercent}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-teal-300">
                      {(m.match_rate * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-400">
                      {m.material_deviations}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase border ${
                        m.status === 'ACTIVE' || m.status === 'OPTIMAL'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
