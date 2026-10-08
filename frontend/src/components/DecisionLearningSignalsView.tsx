import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  FolderMinus,
  Database,
  Layers,
  Activity,
  Compass,
  Sliders,
} from 'lucide-react';
import { DecisionLearningSignalsListResponse } from '../types';
import { fetchDecisionLearningSignals, updateLearningSignalStatus } from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DecisionLearningSignalsViewProps {
  projectId?: string | null;
  onSelectDecision?: (decisionId: string) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  PREDICTION_ACCURACY: Activity,
  OUTCOME_DEVIATION: Sparkles,
  SCENARIO_DEVIATION: Sliders,
  ASSUMPTION_CHANGE: Compass,
  DATA_DRIFT_RELEVANT: Database,
  DEFAULT: Layers,
};

export const DecisionLearningSignalsView: React.FC<DecisionLearningSignalsViewProps> = ({
  projectId,
  onSelectDecision,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DecisionLearningSignalsListResponse | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  // Filters
  const [minObservations, setMinObservations] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(0.05);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Human Review Modal / Action State
  const [actionTargetStatus, setActionTargetStatus] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('Lead Analyst');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSignals = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetchDecisionLearningSignals(projectId, {
        minObservations,
        threshold,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
      });
      setData(res);
      if (res.signals.length > 0 && !selectedSignalId) {
        setSelectedSignalId(res.signals[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve decision learning signals.');
    } finally {
      setLoading(false);
    }
  }, [projectId, minObservations, threshold, statusFilter, severityFilter, selectedSignalId]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedSignalId) return;
    setActionTargetStatus(newStatus);
  };

  const handleCommitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSignalId || !actionTargetStatus) return;

    setSubmittingAction(true);
    setActionMessage(null);
    try {
      await updateLearningSignalStatus(projectId || '', selectedSignalId, {
        status: actionTargetStatus,
        review_notes: reviewNotes || undefined,
        reviewed_by: reviewerName || 'Analyst',
      });
      setActionMessage({
        type: 'success',
        text: `Signal state updated to ${actionTargetStatus} successfully.`,
      });
      setActionTargetStatus(null);
      setReviewNotes('');
      await loadSignals();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to transition learning signal state.',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const selectedSignal = useMemo(() => {
    return data?.signals.find((s) => s.id === selectedSignalId) || data?.signals[0] || null;
  }, [data?.signals, selectedSignalId]);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'REVIEW':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'RESOLVED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'INVESTIGATING':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'ACKNOWLEDGED':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'DISMISSED':
        return 'bg-slate-700/40 text-slate-400 border-slate-600/40';
      default:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
  };

  if (!projectId) {
    return (
      <div className="bg-[#030914] border border-[rgba(120,190,230,0.16)] rounded-2xl p-10 sm:p-14 text-center max-w-lg mx-auto space-y-4 shadow-xl">
        <FolderMinus className="w-12 h-12 text-[#8795A8] mx-auto" />
        <h3 className="text-xl font-sans font-bold text-white tracking-tight">NO PROJECT SCOPE</h3>
        <p className="text-sm font-sans text-[#8795A8]">
          Learning intelligence requires a valid project context to evaluate longitudinal multi-decision patterns.
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <ContinuousIntelligenceEngine
        mode="learning"
        isLoading={loading}
        isFullScreen={false}
        minHeight="520px"
        error={error}
        onRetry={loadSignals}
      />
    );
  }

  if (error) {
    return (
      <div className="bg-[#030914] border border-rose-500/30 rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-sans font-bold text-white tracking-tight">ERROR SYNCHRONIZING SIGNALS</h3>
          <p className="text-sm font-sans text-[#8795A8]">{error}</p>
        </div>
        <button
          onClick={loadSignals}
          className="h-10 px-6 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-mono font-semibold tracking-wider uppercase rounded-xl border border-rose-500/30 transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Sync</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* 1. HERO — DECISION LEARNING OBSERVATORY */}
      <div className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-6 sm:p-7 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.25)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[rgba(120,190,230,0.12)] pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/25">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                PHASE 05 LEARNING OBSERVATORY
              </span>
              <span className="text-xs font-mono text-[#8795A8] bg-[#07111F]/70 px-2.5 py-1 rounded-full border border-[rgba(120,190,230,0.12)]">
                {data?.total_signals || 0} Intelligence Signals
              </span>
            </div>

            <h2 className="text-3xl sm:text-[36px] font-sans font-bold text-white tracking-tight leading-tight">
              DECISION <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">LEARNING OBSERVATORY</span>
            </h2>

            <p className="text-sm sm:text-base font-sans text-[#B7C3D3] max-w-2xl leading-relaxed">
              Closed-loop observation field monitoring prediction deviations, material variance, and model assumptions. Non-autonomous human-in-the-loop review.
            </p>
          </div>

          {/* Controls: Threshold & Min Observations */}
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <div className="flex items-center gap-2 bg-[#030914] px-3.5 py-2 rounded-xl border border-[rgba(120,190,230,0.16)] text-xs font-mono text-[#8795A8]">
              <span>Tolerance:</span>
              <select
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value={0.01} className="bg-slate-900">1% (Strict)</option>
                <option value={0.05} className="bg-slate-900">5% (Standard)</option>
                <option value={0.10} className="bg-slate-900">10% (Wide)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#030914] px-3.5 py-2 rounded-xl border border-[rgba(120,190,230,0.16)] text-xs font-mono text-[#8795A8]">
              <span>Min Obs:</span>
              <select
                value={minObservations}
                onChange={(e) => setMinObservations(parseInt(e.target.value, 10))}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value={1} className="bg-slate-900">1</option>
                <option value={3} className="bg-slate-900">3</option>
                <option value={5} className="bg-slate-900">5</option>
              </select>
            </div>

            <button
              onClick={loadSignals}
              disabled={loading}
              className="h-10 w-10 rounded-xl bg-[#030914] border border-[rgba(120,190,230,0.16)] text-[#8795A8] hover:text-white flex items-center justify-center transition-colors"
              title="Sync Signals"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Aggregate Status Ribbon */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            <div className="p-3.5 bg-[#020711] border border-[rgba(120,190,230,0.12)] rounded-xl">
              <span className="text-xs font-mono text-[#8795A8] uppercase tracking-wider block">TOTAL SIGNALS</span>
              <span className="text-2xl font-mono font-bold text-white mt-1 block">{data.total_signals}</span>
            </div>
            <div className="p-3.5 bg-[#020711] border border-amber-500/20 rounded-xl">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">HIGH SEVERITY</span>
              <span className="text-2xl font-mono font-bold text-amber-300 mt-1 block">{data.by_severity['HIGH'] || 0}</span>
            </div>
            <div className="p-3.5 bg-[#020711] border border-sky-500/20 rounded-xl">
              <span className="text-xs font-mono text-sky-400 uppercase tracking-wider block">IN REVIEW</span>
              <span className="text-2xl font-mono font-bold text-sky-300 mt-1 block">
                {(data.by_status['NEW'] || 0) + (data.by_status['ACKNOWLEDGED'] || 0)}
              </span>
            </div>
            <div className="p-3.5 bg-[#020711] border border-purple-500/20 rounded-xl">
              <span className="text-xs font-mono text-purple-400 uppercase tracking-wider block">INVESTIGATING</span>
              <span className="text-2xl font-mono font-bold text-purple-300 mt-1 block">{data.by_status['INVESTIGATING'] || 0}</span>
            </div>
            <div className="p-3.5 bg-[#020711] border border-emerald-500/20 rounded-xl">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider block">RESOLVED</span>
              <span className="text-2xl font-mono font-bold text-emerald-300 mt-1 block">{data.by_status['RESOLVED'] || 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. FILTER STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(120,190,230,0.12)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-[#8795A8] uppercase">Status:</span>
          {['ALL', 'NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                statusFilter === st
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-[#8795A8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#8795A8] uppercase">Severity:</span>
          {['ALL', 'HIGH', 'REVIEW', 'INFO'].map((sv) => (
            <button
              key={sv}
              onClick={() => setSeverityFilter(sv)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                severityFilter === sv
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-[#8795A8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {sv}
            </button>
          ))}
        </div>
      </div>

      {/* 3. MAIN OBSERVATORY CONSTELLATION & INSPECTION LAYOUT */}
      {!data || data.signals.length === 0 ? (
        <div className="bg-[#030914] border border-[rgba(120,190,230,0.16)] rounded-2xl p-12 text-center max-w-xl mx-auto my-6 space-y-4 shadow-xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-sans font-bold text-white tracking-tight uppercase">NO LEARNING SIGNALS DETECTED</h3>
          <p className="text-sm font-sans text-[#8795A8]">
            No recurring prediction or outcome deviations meet the current observation threshold (±{(threshold * 100).toFixed(0)}%). The closed-loop learning registry is aligned.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Signal Constellation Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-mono text-[#8795A8] uppercase tracking-wider flex items-center justify-between pb-1">
              <span>ACTIVE INTELLIGENCE SIGNALS ({data.signals.length})</span>
              <span>Click to inspect</span>
            </div>

            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
              {data.signals.map((sig) => {
                const isSelected = sig.id === selectedSignalId;
                const CatIcon = CATEGORY_ICONS[sig.signal_type] || CATEGORY_ICONS.DEFAULT;

                return (
                  <div
                    key={sig.id}
                    onClick={() => setSelectedSignalId(sig.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-purple-950/30 border-purple-400/60 shadow-[0_0_20px_rgba(192,132,252,0.2)]'
                        : 'bg-[#030914] border-[rgba(120,190,230,0.14)] hover:border-purple-400/40 hover:bg-[#07111F]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CatIcon className="w-3.5 h-3.5 text-purple-300" />
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-300">
                          {sig.signal_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase border ${getSeverityBadge(sig.severity)}`}>
                          {sig.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase border ${getStatusBadge(sig.status)}`}>
                          {sig.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-sans font-bold text-white tracking-tight leading-snug">
                      {sig.title}
                    </h4>

                    {sig.metric_name && (
                      <div className="text-xs font-mono text-cyan-400">
                        Metric: <span className="text-white font-semibold">{sig.metric_name}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[rgba(120,190,230,0.08)] flex items-center justify-between text-xs font-mono text-[#8795A8]">
                      <span>{sig.observed_count} observed samples</span>
                      <span className="text-purple-300 font-bold">
                        {sig.threshold_used ? `±${(sig.threshold_used * 100).toFixed(0)}%` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Detailed Inspection & Human Action (7 cols) */}
          <div className="lg:col-span-7 bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-6 sm:p-7 backdrop-blur-md space-y-6 sticky top-6">
            {selectedSignal ? (
              <div className="space-y-6">
                <div className="border-b border-[rgba(120,190,230,0.12)] pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${getSeverityBadge(selectedSignal.severity)}`}>
                        {selectedSignal.severity} SEVERITY
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${getStatusBadge(selectedSignal.status)}`}>
                        {selectedSignal.status}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#8795A8]">
                      ID: {selectedSignal.id.slice(0, 16)}...
                    </span>
                  </div>

                  <h3 className="text-xl font-sans font-bold text-white tracking-tight">
                    {selectedSignal.title}
                  </h3>
                  <p className="text-sm font-sans text-[#B7C3D3] leading-relaxed">
                    {selectedSignal.description}
                  </p>
                </div>

                {/* Evidence Summary Quartet */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="bg-[#030914] p-3 rounded-xl border border-[rgba(120,190,230,0.12)] space-y-1">
                    <span className="text-[10px] text-[#8795A8] uppercase block">SIGNAL TYPE</span>
                    <span className="text-white font-bold truncate block">{selectedSignal.signal_type}</span>
                  </div>

                  <div className="bg-[#030914] p-3 rounded-xl border border-[rgba(120,190,230,0.12)] space-y-1">
                    <span className="text-[10px] text-[#8795A8] uppercase block">TARGET METRIC</span>
                    <span className="text-cyan-400 font-bold truncate block">{selectedSignal.metric_name || 'Population'}</span>
                  </div>

                  <div className="bg-[#030914] p-3 rounded-xl border border-[rgba(120,190,230,0.12)] space-y-1">
                    <span className="text-[10px] text-[#8795A8] uppercase block">OBSERVED SAMPLES</span>
                    <span className="text-white font-bold block">{selectedSignal.observed_count}</span>
                  </div>

                  <div className="bg-[#030914] p-3 rounded-xl border border-[rgba(120,190,230,0.12)] space-y-1">
                    <span className="text-[10px] text-[#8795A8] uppercase block">THRESHOLD USED</span>
                    <span className="text-purple-300 font-bold block">
                      {selectedSignal.threshold_used ? `±${(selectedSignal.threshold_used * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Traceability: Associated Decisions & Outcomes */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="text-xs uppercase tracking-wider text-purple-300 font-bold flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    PERSISTED TRACEABILITY CHAIN
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-[#030914] p-3.5 rounded-xl border border-[rgba(120,190,230,0.12)] space-y-2">
                      <span className="text-[#8795A8] uppercase text-[10.5px] block font-bold">
                        Source Outcomes ({selectedSignal.source_outcome_ids.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selectedSignal.source_outcome_ids.map((oid) => (
                          <span key={oid} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/25 text-[10px]">
                            #{oid.slice(0, 8)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#030914] p-3.5 rounded-xl border border-[rgba(120,190,230,0.12)] space-y-2">
                      <span className="text-[#8795A8] uppercase text-[10.5px] block font-bold">
                        Source Decisions ({selectedSignal.source_decision_ids.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selectedSignal.source_decision_ids.map((did) => (
                          <button
                            key={did}
                            onClick={() => onSelectDecision && onSelectDecision(did)}
                            className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/25 text-[10px] transition-colors"
                          >
                            #{did.slice(0, 8)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Human Investigation Action Panel */}
                <div className="pt-4 border-t border-[rgba(120,190,230,0.12)] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Human Investigation Actions
                    </span>
                    <span className="text-xs font-mono text-[#8795A8]">Non-autonomous control</span>
                  </div>

                  {actionMessage && (
                    <div className={`p-3 rounded-xl text-xs font-mono flex items-center justify-between ${
                      actionMessage.type === 'success'
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
                    }`}>
                      <span>{actionMessage.text}</span>
                      <button onClick={() => setActionMessage(null)} className="text-[#8795A8] hover:text-white">✕</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <button
                      onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
                      disabled={submittingAction || selectedSignal.status === 'ACKNOWLEDGED'}
                      className="py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold transition-all disabled:opacity-40"
                    >
                      ACKNOWLEDGE
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('INVESTIGATING')}
                      disabled={submittingAction || selectedSignal.status === 'INVESTIGATING'}
                      className="py-2.5 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold transition-all disabled:opacity-40"
                    >
                      INVESTIGATE
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('RESOLVED')}
                      disabled={submittingAction || selectedSignal.status === 'RESOLVED'}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold transition-all disabled:opacity-40"
                    >
                      RESOLVE
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('DISMISSED')}
                      disabled={submittingAction || selectedSignal.status === 'DISMISSED'}
                      className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold transition-all disabled:opacity-40"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-xs font-sans text-[#8795A8]">
                Select an intelligence signal to inspect its multi-hop evidence and record review notes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* HUMAN REVIEW MODAL */}
      <AnimatePresence>
        {actionTargetStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#030914] border border-[rgba(120,190,230,0.22)] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[rgba(120,190,230,0.12)] pb-3.5">
                <div className="space-y-0.5">
                  <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest">
                    RECORD HUMAN REVIEW
                  </span>
                  <h4 className="text-base font-sans font-bold text-white tracking-tight">
                    Transition to {actionTargetStatus}
                  </h4>
                </div>
                <button onClick={() => setActionTargetStatus(null)} className="text-[#8795A8] hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCommitReview} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                    Reviewer Identity
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-mono focus:outline-none focus:border-purple-400"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-semibold text-[#8795A8] uppercase tracking-wider block">
                    Investigation Notes / Rationale
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Document root cause, recalibration actions, or observation details..."
                    className="w-full h-24 p-3 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.16)] text-white text-xs font-sans focus:outline-none focus:border-purple-400 resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionTargetStatus(null)}
                    className="h-10 px-5 rounded-xl bg-white/[0.04] text-[#8795A8] hover:text-white text-xs font-mono uppercase font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="h-10 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {submittingAction ? 'RECORDING...' : 'COMMIT REVIEW'}
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
