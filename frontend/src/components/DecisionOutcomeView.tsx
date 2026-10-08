import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DecisionOutcomesListResponse,
  DecisionOutcomeStatus,
  DecisionLearningSignal,
  DatasetVersionItem,
  DecisionOutcomePhase6,
} from '../types';
import {
  fetchDecisionOutcomesPhase6,
  recordDecisionOutcomePhase6,
  recordDecisionOutcomeFromVersion,
  fetchDatasetVersions,
} from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  X,
  Target,
} from 'lucide-react';

interface DecisionOutcomeViewProps {
  decisionId: string;
  datasetId: string;
  datasetName?: string;
  projectId?: string;
  onClose?: () => void;
}

const STATUS_CONFIG: Record<
  DecisionOutcomeStatus,
  { label: string; bg: string; border: string; text: string; icon: any }
> = {
  PENDING: {
    label: 'PENDING MEASUREMENT',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Clock,
  },
  OBSERVED: {
    label: 'OBSERVED',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Activity,
  },
  MATCHED: {
    label: 'MATCHED EXPECTATION',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle2,
  },
  DIFFERED: {
    label: 'DIFFERED',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    icon: Scale,
  },
  MATERIALLY_DIFFERED: {
    label: 'MATERIALLY DIFFERED',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    icon: AlertTriangle,
  },
};

const SIGNAL_CONFIG: Record<
  DecisionLearningSignal,
  { label: string; desc: string; badgeClass: string }
> = {
  PREDICTION_ACCURACY: {
    label: 'Prediction Accuracy',
    desc: 'Empirical outcome aligned within designated variance threshold.',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  OUTCOME_DEVIATION: {
    label: 'Outcome Deviation',
    desc: 'Measured result deviated from deterministic baseline projection.',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  SCENARIO_DEVIATION: {
    label: 'Scenario Deviation',
    desc: 'Material divergence detected relative to parameterized decision scenario.',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  ASSUMPTION_CHANGE: {
    label: 'Assumption Change',
    desc: 'Underlying operational variables diverged between run and observation.',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  DATA_DRIFT_RELEVANT: {
    label: 'Data Drift Relevant',
    desc: 'Distributional shift observed in subsequent lineage version.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  UNAVAILABLE: {
    label: 'Signal Unavailable',
    desc: 'Awaiting empirical measurement. Real-world actuals have not been recorded.',
    badgeClass: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
  },
};

export const DecisionOutcomeView: React.FC<DecisionOutcomeViewProps> = ({
  decisionId,
  datasetId,
  datasetName,
  projectId,
  onClose,
}) => {
  const [data, setData] = useState<DecisionOutcomesListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Record Outcome Modal / Form State
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [recordMode, setRecordMode] = useState<'manual' | 'version'>('manual');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Manual Form Fields
  const [inputActualMetric, setInputActualMetric] = useState<string>('');
  const [inputActualValue, setInputActualValue] = useState<string>('');
  const [inputThreshold, setInputThreshold] = useState<string>('0.05');
  const [inputNotes, setInputNotes] = useState<string>('');

  // Version Mode State
  const [availableVersions, setAvailableVersions] = useState<DatasetVersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);

  const loadOutcomes = useCallback(async () => {
    if (!decisionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDecisionOutcomesPhase6(decisionId);
      setData(res);
      setInputActualMetric(res.expected_metric || '');
      setInputThreshold(String(res.threshold_used || 0.05));
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve decision outcome telemetry.');
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  useEffect(() => {
    loadOutcomes();
  }, [loadOutcomes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetchDecisionOutcomesPhase6(decisionId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenRecordModal = async () => {
    setFormError(null);
    setShowRecordModal(true);
    if (recordMode === 'version' && availableVersions.length === 0 && datasetId) {
      setLoadingVersions(true);
      try {
        const vRes = await fetchDatasetVersions(datasetId);
        setAvailableVersions(vRes.versions || []);
        if (vRes.versions && vRes.versions.length > 0) {
          setSelectedVersion(vRes.versions[0].version);
        }
      } catch {
        // Fallback
      } finally {
        setLoadingVersions(false);
      }
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (recordMode === 'manual') {
        const val = parseFloat(inputActualValue);
        if (isNaN(val)) {
          throw new Error('Please enter a valid numeric actual value.');
        }
        const thresh = parseFloat(inputThreshold);
        await recordDecisionOutcomePhase6(decisionId, {
          actual_metric: inputActualMetric || data?.expected_metric || 'metric',
          actual_value: val,
          material_difference_threshold: !isNaN(thresh) ? thresh : undefined,
          notes: inputNotes || undefined,
        });
      } else {
        if (!selectedVersion) {
          throw new Error('Please select a dataset version.');
        }
        await recordDecisionOutcomeFromVersion(decisionId, {
          source_dataset_id: datasetId,
          notes: inputNotes || undefined,
        });
      }

      setShowRecordModal(false);
      setInputActualValue('');
      setInputNotes('');
      await loadOutcomes();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record decision outcome.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ContinuousIntelligenceEngine
        mode="outcome"
        isLoading={loading}
        isFullScreen={false}
        minHeight="520px"
        error={error}
        onRetry={loadOutcomes}
      />
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#030914] border border-rose-500/30 rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-sans font-bold text-white tracking-tight">OUTCOME TELEMETRY UNAVAILABLE</h3>
          <p className="text-sm font-sans text-[#8795A8]">{error || 'Unable to retrieve decision telemetry.'}</p>
        </div>
        <button
          onClick={loadOutcomes}
          className="h-10 px-6 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-mono font-semibold tracking-wider uppercase rounded-xl border border-rose-500/30 transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Load</span>
        </button>
      </div>
    );
  }

  const latest = data.latest_outcome;
  const statusCfg = STATUS_CONFIG[data.current_status] || STATUS_CONFIG.PENDING;
  const signalCfg = SIGNAL_CONFIG[data.learning_signal] || SIGNAL_CONFIG.UNAVAILABLE;
  const StatusIcon = statusCfg.icon;

  const expectedVal = data.expected_value;
  const actualVal = latest?.actual_value ?? null;
  const absDelta = latest?.absolute_delta ?? null;
  const relDelta = latest?.relative_delta ?? null;
  const thresholdPct = (data.threshold_used * 100).toFixed(1);

  const maxVal = Math.max(Math.abs(expectedVal || 1), Math.abs(actualVal || 1));
  const expectedWidthPct = Math.min(100, Math.max(15, (Math.abs(expectedVal) / maxVal) * 100));
  const actualWidthPct = actualVal !== null ? Math.min(100, Math.max(15, (Math.abs(actualVal) / maxVal) * 100)) : 0;

  return (
    <div className="space-y-6 select-none">
      {/* 1. HERO — OUTCOME MONITOR */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.25)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[rgba(120,190,230,0.12)] pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                PHASE 03 OUTCOME MONITOR
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
              <span className="text-xs font-mono text-[#8795A8] bg-[#07111F]/70 px-2.5 py-1 rounded-full border border-[rgba(120,190,230,0.12)]">
                Threshold: ±{thresholdPct}%
              </span>
              {datasetName && (
                <span className="text-xs font-mono text-[#8492A5] bg-[#07111F]/70 px-2.5 py-1 rounded-full border border-[rgba(120,190,230,0.12)]">
                  Dataset: {datasetName} {projectId ? `(${projectId.slice(0, 8)})` : ''}
                </span>
              )}
            </div>

            <h2 className="text-3xl sm:text-[36px] font-sans font-bold text-white tracking-tight leading-tight">
              OUTCOME <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">MONITOR</span>
            </h2>

            <p className="text-sm sm:text-base font-sans text-[#B7C3D3] max-w-2xl leading-relaxed">
              Compare deterministic projected expectations against empirical observed metrics. Verify whether real-world execution achieved expected gains.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start lg:self-center">
            <button
              onClick={handleOpenRecordModal}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>RECORD OUTCOME</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-11 w-11 rounded-xl bg-[#030914] border border-[rgba(120,190,230,0.16)] text-[#8795A8] hover:text-white flex items-center justify-center transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="h-11 w-11 rounded-xl bg-[#030914] border border-[rgba(120,190,230,0.16)] text-[#8795A8] hover:text-white flex items-center justify-center transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Closed-Loop Learning Signal Banner */}
        <div className="bg-[#030914] border border-[rgba(120,190,230,0.14)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8795A8] block">
                LEARNING SIGNAL STATUS
              </span>
              <h4 className="text-sm sm:text-base font-sans font-bold text-white tracking-tight">
                {signalCfg.label}: <span className="text-[#B7C3D3] font-normal">{signalCfg.desc}</span>
              </h4>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border self-start sm:self-center shrink-0 ${signalCfg.badgeClass}`}>
            {data.learning_signal.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* 2. MAIN EXPECTED VS ACTUAL VISUALIZATION CENTERPIECE */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-6 sm:p-7 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.22)] space-y-6">
        <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-4">
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              EMPIRICAL COMPARISON VISUALIZATION
            </span>
            <h3 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight">
              Deterministic Projection vs Observed Metric
            </h3>
          </div>

          <div className="text-right font-mono text-xs text-[#8795A8]">
            Target Metric: <strong className="text-white">{data.expected_metric}</strong>
          </div>
        </div>

        {/* Expected vs Actual Comparison Bars */}
        <div className="bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-2xl p-6 sm:p-7 space-y-6">
          {/* Expected Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
              <span className="text-[#8795A8] uppercase tracking-wider font-semibold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                EXPECTED VALUE (MODEL PROJECTION)
              </span>
              <span className="text-xl sm:text-2xl font-mono font-bold text-cyan-300">
                {expectedVal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-5 p-0.5 overflow-hidden border border-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${expectedWidthPct}%` }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(57,214,245,0.6)]"
              />
            </div>
          </div>

          {/* Actual Observed Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
              <span className="text-[#8795A8] uppercase tracking-wider font-semibold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(53,211,153,0.7)]" />
                ACTUAL VALUE (EMPIRICALLY OBSERVED)
              </span>
              {actualVal !== null ? (
                <span className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
                  {actualVal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              ) : (
                <span className="text-xs font-mono font-semibold text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  Awaiting Observed Result
                </span>
              )}
            </div>
            <div className="w-full bg-slate-900 rounded-full h-5 p-0.5 overflow-hidden border border-slate-800">
              {actualVal !== null ? (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${actualWidthPct}%` }}
                  transition={{ duration: 1.0, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(53,211,153,0.6)]"
                />
              ) : (
                <div className="h-full w-24 bg-amber-500/20 rounded-full animate-pulse" />
              )}
            </div>
          </div>

          {/* Variance / Delta Card Quartet */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[rgba(120,190,230,0.1)]">
            <div className="bg-[#030914] border border-[rgba(120,190,230,0.12)] rounded-xl p-4 space-y-1">
              <span className="text-xs font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">
                ABSOLUTE VARIANCE (Δ)
              </span>
              <span className={`text-xl sm:text-2xl font-mono font-bold block ${
                absDelta === null ? 'text-[#8795A8]' : absDelta === 0 ? 'text-slate-300' : absDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {absDelta !== null ? `${absDelta > 0 ? '+' : ''}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '—'}
              </span>
            </div>

            <div className="bg-[#030914] border border-[rgba(120,190,230,0.12)] rounded-xl p-4 space-y-1">
              <span className="text-xs font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">
                RELATIVE SHIFT (%)
              </span>
              <span className={`text-xl sm:text-2xl font-mono font-bold block ${
                relDelta === null ? 'text-[#8795A8]' : relDelta === 0 ? 'text-slate-300' : relDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {relDelta !== null ? `${relDelta > 0 ? '+' : ''}${(relDelta * 100).toFixed(2)}%` : '—'}
              </span>
            </div>

            <div className="bg-[#030914] border border-[rgba(120,190,230,0.12)] rounded-xl p-4 space-y-1">
              <span className="text-xs font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">
                GOVERNED TOLERANCE
              </span>
              <span className="text-xl sm:text-2xl font-mono font-bold text-cyan-300 block">
                ±{thresholdPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CLOSED-LOOP DECISION-TO-OUTCOME TIMELINE */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-4">
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              CLOSED-LOOP LIFECYCLE
            </span>
            <h3 className="text-xl font-sans font-bold text-white tracking-tight">
              Progression: Decision to Learning Emission
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold">01 DECISION</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-[#8795A8] text-[11px] font-sans">Formalized in command center.</p>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-blue-400 font-bold">02 EXPECTED</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-white font-bold">{expectedVal.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold">03 OBSERVED</span>
              {actualVal !== null ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              )}
            </div>
            <p className="text-white font-bold">{actualVal !== null ? actualVal.toLocaleString() : 'Pending'}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-violet-400 font-bold">04 COMPARISON</span>
              {absDelta !== null ? <CheckCircle2 className="w-4 h-4 text-violet-400" /> : <Clock className="w-4 h-4 text-slate-600" />}
            </div>
            <p className="text-white font-bold">{relDelta !== null ? `${(relDelta * 100).toFixed(1)}%` : 'Pending'}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.14)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-teal-400 font-bold">05 STATUS</span>
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-white font-bold uppercase truncate">{data.current_status}</p>
          </div>
        </div>
      </div>

      {/* 4. HISTORICAL OBSERVATIONS TABLE */}
      {data.history && data.history.length > 0 && (
        <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-4">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                OBSERVATION LOG
              </span>
              <h3 className="text-xl font-sans font-bold text-white tracking-tight">
                Empirical Measurements History ({data.history.length})
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[rgba(120,190,230,0.14)] bg-[#020711]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/[0.02] text-[#8795A8] border-b border-[rgba(120,190,230,0.12)]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Source</th>
                  <th className="py-3 px-4 font-semibold text-right">Actual Value</th>
                  <th className="py-3 px-4 font-semibold text-right">Variance (Δ)</th>
                  <th className="py-3 px-4 font-semibold text-right">Shift (%)</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(120,190,230,0.06)] text-slate-300">
                {data.history.map((out: DecisionOutcomePhase6) => {
                  const cfg = STATUS_CONFIG[out.outcome_status] || STATUS_CONFIG.OBSERVED;
                  const actualVal = out.actual_value ?? 0;
                  const absDelta = out.absolute_delta ?? 0;
                  const relDelta = out.relative_delta ?? 0;
                  const dateStr = out.recorded_at || out.created_at;

                  return (
                    <tr key={out.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-[#8795A8]">
                        {dateStr ? new Date(dateStr).toLocaleString() : 'Recorded'}
                      </td>
                      <td className="py-3 px-4">
                        {out.source_dataset_version ? (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/25">
                            v{out.source_dataset_version}
                          </span>
                        ) : (
                          <span className="text-slate-400">Manual Entry</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {actualVal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        absDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {absDelta >= 0 ? '+' : ''}{absDelta.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        relDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {relDelta >= 0 ? '+' : ''}{(relDelta * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] border uppercase font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                          {out.outcome_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD OUTCOME MODAL DIALOG */}
      <AnimatePresence>
        {showRecordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#030914] border border-[rgba(120,190,230,0.22)] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                    CLOSED-LOOP RECORDING
                  </span>
                  <h3 className="text-lg font-sans font-bold text-white tracking-tight">
                    Record Observed Metric Outcome
                  </h3>
                </div>
                <button
                  onClick={() => setShowRecordModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] text-[#8795A8] hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-[#020711] p-1 rounded-xl border border-[rgba(120,190,230,0.12)] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setRecordMode('manual')}
                  className={`py-2 rounded-lg font-bold transition-all ${
                    recordMode === 'manual' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-[#8795A8] hover:text-white'
                  }`}
                >
                  Manual Number
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecordMode('version');
                    handleOpenRecordModal();
                  }}
                  className={`py-2 rounded-lg font-bold transition-all ${
                    recordMode === 'version' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-[#8795A8] hover:text-white'
                  }`}
                >
                  From Dataset Version
                </button>
              </div>

              <form onSubmit={handleRecordSubmit} className="space-y-4">
                {recordMode === 'manual' ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                        Observed Metric Name
                      </label>
                      <input
                        type="text"
                        value={inputActualMetric}
                        onChange={(e) => setInputActualMetric(e.target.value)}
                        placeholder="e.g. avg_bill"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                        Actual Observed Value
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={inputActualValue}
                        onChange={(e) => setInputActualValue(e.target.value)}
                        placeholder="e.g. 1625.5"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                        Evaluation Threshold (Fraction)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={inputThreshold}
                        onChange={(e) => setInputThreshold(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                      Subsequent Dataset Version
                    </label>
                    {loadingVersions ? (
                      <div className="h-11 px-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] flex items-center text-xs font-mono text-[#8795A8]">
                        Loading versions...
                      </div>
                    ) : (
                      <select
                        value={selectedVersion ?? ''}
                        onChange={(e) => setSelectedVersion(parseInt(e.target.value, 10))}
                        className="w-full h-11 px-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                        required
                      >
                        {availableVersions.map((v) => (
                          <option key={v.version} value={v.version}>
                            Version {v.version} ({v.row_count} rows · {new Date(v.created_at).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                    Measurement Notes (Optional)
                  </label>
                  <textarea
                    value={inputNotes}
                    onChange={(e) => setInputNotes(e.target.value)}
                    placeholder="Provide operational context regarding this empirical observation..."
                    className="w-full h-20 p-3 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-sans focus:outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecordModal(false)}
                    className="h-10 px-5 rounded-xl bg-white/[0.04] text-[#8795A8] hover:text-white text-xs font-mono uppercase font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {submitting ? 'RECORDING...' : 'COMMIT OBSERVATION'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
