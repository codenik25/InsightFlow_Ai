import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  AlertOctagon,
  ExternalLink,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import {
  DecisionExecutionResponse,
  ExecutionEventResponse,
} from '../types';
import {
  fetchDecisionExecution,
  requestDecisionExecution,
  confirmDecisionExecution,
  failDecisionExecution,
  markDecisionNotExecuted,
  fetchDecisionExecutionHistory,
} from '../services/api';

interface DecisionExecutionViewProps {
  decisionId: string;
  projectId?: string | null;
  datasetName?: string;
  onOpenOutcomeMonitor?: () => void;
}

const EXECUTION_STAGES = [
  { id: 'NOT_READY', label: 'NOT READY', step: 1 },
  { id: 'READY', label: 'READY', step: 2 },
  { id: 'PENDING_CONFIRMATION', label: 'PENDING CONFIRMATION', step: 3 },
  { id: 'CONFIRMED', label: 'CONFIRMED', step: 4 },
  { id: 'EXECUTING', label: 'EXECUTING', step: 5 },
  { id: 'EXECUTED', label: 'EXECUTED', step: 6 },
  { id: 'OUTCOME_MONITORING', label: 'OUTCOME MONITORING', step: 7 },
  { id: 'CLOSED', label: 'CLOSED', step: 8 },
];

export const DecisionExecutionView: React.FC<DecisionExecutionViewProps> = ({
  decisionId,
  projectId,
  datasetName,
  onOpenOutcomeMonitor,
}) => {
  const [data, setData] = useState<DecisionExecutionResponse | null>(null);
  const [history, setHistory] = useState<ExecutionEventResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<'request' | 'confirm' | 'fail' | 'not_executed' | null>(null);
  const [operatorId, setOperatorId] = useState<string>('');
  const [rationale, setRationale] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  const loadExecutionState = useCallback(async () => {
    if (!decisionId) return;
    setLoading(true);
    setError(null);
    try {
      const [execState, historyData] = await Promise.all([
        fetchDecisionExecution(decisionId, projectId),
        fetchDecisionExecutionHistory(decisionId, projectId),
      ]);
      setData(execState);
      setHistory(historyData.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load decision execution state.');
    } finally {
      setLoading(false);
    }
  }, [decisionId, projectId]);

  useEffect(() => {
    loadExecutionState();
  }, [loadExecutionState]);

  const handleRequestExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId.trim() || !rationale.trim()) {
      setModalError('Operator identity and rationale are required.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      await requestDecisionExecution(
        decisionId,
        {
          requested_by: operatorId.trim(),
          rationale: rationale.trim(),
        },
        projectId
      );
      setActiveModal(null);
      setRationale('');
      await loadExecutionState();
    } catch (err: any) {
      setModalError(err.message || 'Failed to request execution.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId.trim() || !rationale.trim()) {
      setModalError('Operator identity and confirmation rationale are required.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      await confirmDecisionExecution(
        decisionId,
        {
          confirmed_by: operatorId.trim(),
          rationale: rationale.trim(),
          execution_reference: reference.trim() || undefined,
        },
        projectId
      );
      setActiveModal(null);
      setRationale('');
      setReference('');
      await loadExecutionState();
    } catch (err: any) {
      setModalError(err.message || 'Failed to confirm execution.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFailExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId.trim() || !rationale.trim()) {
      setModalError('Operator identity and failure reason are required.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      await failDecisionExecution(
        decisionId,
        {
          failed_by: operatorId.trim(),
          failure_reason: rationale.trim(),
        },
        projectId
      );
      setActiveModal(null);
      setRationale('');
      await loadExecutionState();
    } catch (err: any) {
      setModalError(err.message || 'Failed to report execution failure.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotExecuted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId.trim() || !rationale.trim()) {
      setModalError('Operator identity and reason are required.');
      return;
    }
    setActionLoading(true);
    setModalError(null);
    try {
      await markDecisionNotExecuted(
        decisionId,
        {
          actor: operatorId.trim(),
          reason: rationale.trim(),
        },
        projectId
      );
      setActiveModal(null);
      setRationale('');
      await loadExecutionState();
    } catch (err: any) {
      setModalError(err.message || 'Failed to mark decision as not executed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Phase-specific Loading State (Processing Skeleton)
  if (loading && !data) {
    return (
      <ContinuousIntelligenceEngine
        mode="execution"
        isLoading={loading}
        isFullScreen={false}
        minHeight="520px"
        error={error}
        onRetry={loadExecutionState}
      />
    );
  }

  // Phase-specific Error State
  if (error || !data) {
    return (
      <div className="w-full max-w-[1580px] mx-auto p-8 rounded-2xl bg-rose-950/20 border border-rose-800/50 text-rose-300">
        <div className="flex items-center gap-3 mb-2">
          <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
          <h4 className="font-bold text-base font-sans tracking-wide uppercase">
            EXECUTION OPERATIONS CONSOLE UNAVAILABLE
          </h4>
        </div>
        <p className="text-sm font-sans text-rose-200/80 mb-6">
          {error || 'Unable to retrieve persisted execution control plane.'}
        </p>
        <button
          onClick={loadExecutionState}
          className="px-5 py-2.5 bg-rose-900/50 hover:bg-rose-800 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors"
        >
          RETRY LOAD
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'PENDING_CONFIRMATION':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'CONFIRMED':
      case 'EXECUTING':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.3)] animate-pulse';
      case 'EXECUTED':
      case 'OUTCOME_MONITORING':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'EXECUTION_FAILED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'NOT_EXECUTED':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      case 'CLOSED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-700/30 text-slate-300 border-slate-600';
    }
  };

  const isExecuting = data.status === 'EXECUTING' || data.status === 'CONFIRMED';
  const currentStageIdx = EXECUTION_STAGES.findIndex(s => s.id === data.status);
  const activeStepNumber = currentStageIdx >= 0 ? currentStageIdx + 1 : 2;

  return (
    <div className="w-full max-w-[1580px] mx-auto space-y-6 text-[#F4F7FB]">
      {/* ============================================================== */}
      {/* 1. OPERATIONS CONSOLE HEADER                                   */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[#030914]/90 border border-[rgba(96,165,250,0.25)] rounded-2xl p-6 sm:p-7 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                PHASE 07 — OPERATIONS CONSOLE
              </span>
              <span className="text-[12px] font-mono text-[#8492A5]">
                Target Decision: <strong className="text-white">{decisionId}</strong>
              </span>
              {datasetName && (
                <span className="text-[12px] font-mono text-[#8492A5]">
                  • Context: <strong className="text-slate-300">{datasetName}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl sm:text-[28px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                <Cpu className="w-7 h-7 text-blue-400" />
                EXECUTION OPERATIONS CONSOLE
              </h2>
              <div className={`px-3.5 py-1 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider ${getStatusBadge(data.status)}`}>
                {data.status.replace(/_/g, ' ')}
              </div>
            </div>

            <p className="text-sm font-sans text-[#B7C3D3] mt-2 max-w-3xl leading-relaxed">
              Real-time operational dispatch and verification plane. Tracks human operator confirmation, deployment execution, and handoff to closed-loop monitoring.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadExecutionState}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-xs font-mono font-semibold flex items-center gap-2"
              title="Refresh Execution State"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              REFRESH
            </button>
          </div>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 2. EXECUTION STATE MACHINE TRACK                               */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
              OPERATIONAL EXECUTION STATE MACHINE
            </h3>
          </div>
          <span className="text-[12px] font-mono text-[#8492A5]">
            Stage <strong className="text-blue-400">{activeStepNumber}</strong> of {EXECUTION_STAGES.length}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {EXECUTION_STAGES.map((stage) => {
            const isCurrent = stage.id === data.status;
            const isCompleted = activeStepNumber > stage.step;

            return (
              <div
                key={stage.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-blue-500/15 border-blue-400/60 shadow-[0_0_18px_rgba(96,165,250,0.22)]'
                    : isCompleted
                    ? 'bg-emerald-500/[0.04] border-emerald-500/30'
                    : 'bg-white/[0.02] border-white/[0.06] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10.5px] font-mono font-bold ${isCurrent ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-[#8492A5]'}`}>
                    0{stage.step}
                  </span>
                  {isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  )}
                </div>

                <div className={`text-[11.5px] font-sans font-bold uppercase truncate ${isCurrent ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-[#8492A5]'}`}>
                  {stage.label}
                </div>

                <div className="mt-1 text-[10.5px] font-mono text-[#8492A5]">
                  {isCurrent ? (
                    <span className="text-blue-300 font-bold">Active</span>
                  ) : isCompleted ? (
                    <span className="text-emerald-400">Passed</span>
                  ) : (
                    <span>Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 3. CENTER EXECUTION STATUS CORE                                */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="border border-[rgba(96,165,250,0.28)] rounded-2xl bg-gradient-to-b from-[#040C1A] to-[#020711] p-7 shadow-xl relative overflow-hidden text-center"
      >
        {/* Subtle processing ring / signal animation during execution */}
        {isExecuting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[360px] h-[360px] rounded-full border border-blue-400/20 animate-ping duration-1000" />
            <div className="w-[480px] h-[480px] rounded-full border border-cyan-400/10 animate-pulse duration-700" />
          </div>
        )}

        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-xs font-mono font-semibold text-blue-300 uppercase">
            <Terminal className="w-3.5 h-3.5" />
            EXECUTION STATUS CORE
          </div>

          <h3 className="text-3xl sm:text-[38px] font-sans font-bold text-white tracking-tight uppercase">
            {data.status.replace(/_/g, ' ')}
          </h3>

          <p className="text-sm font-sans text-[#B7C3D3] leading-relaxed">
            {data.status === 'EXECUTED'
              ? 'The decision has been confirmed and deployed to operations. Closed-loop telemetry is actively recording outcomes.'
              : data.status === 'READY'
              ? 'Governance sign-off completed. The decision is authorized and ready for human operator dispatch.'
              : data.status === 'PENDING_CONFIRMATION'
              ? 'An operator has submitted an execution request. Awaiting operational execution confirmation.'
              : data.status === 'EXECUTION_FAILED'
              ? 'Operational failure was reported during deployment. See recorded failure rationale below.'
              : data.status === 'NOT_EXECUTED'
              ? 'The approved decision was deliberately marked not executed.'
              : 'Decision execution control plane is active.'}
          </p>

          {/* Operational Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-left">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
              <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Operator</span>
              <span className="text-xs font-mono font-bold text-white truncate block">
                {data.executed_by || data.confirmed_by || data.requested_by || 'Pending'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
              <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Governance</span>
              <span className={`text-xs font-mono font-bold truncate block ${data.is_approved ? 'text-emerald-400' : 'text-amber-400'}`}>
                {data.governance_status}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
              <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Signatory</span>
              <span className="text-xs font-mono text-slate-200 truncate block">
                {data.approved_by || 'Verified'}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
              <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Reference ID</span>
              <span className="text-xs font-mono text-blue-300 truncate block">
                {data.execution_reference || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 4. ACTIONS & CLOSED-LOOP NOTIFICATIONS                         */}
      {/* ============================================================== */}
      <div className="bg-[#030914] border border-[rgba(120,190,230,0.16)] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div>
          <span className="text-xs font-mono uppercase text-[#F4F7FB] font-bold tracking-wider block">
            AVAILABLE OPERATIONAL COMMANDS
          </span>
          <span className="text-xs text-[#8492A5] font-sans">
            {data.valid_next_actions.length > 0
              ? 'Authorized human operator procedures for the current state:'
              : 'Controlled state; no further execution actions.'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data.can_request_execution && (
            <button
              onClick={() => {
                setActiveModal('request');
                setModalError(null);
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider border border-slate-700 transition-colors flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              REQUEST EXECUTION
            </button>
          )}

          {data.can_confirm_execution && (
            <button
              onClick={() => {
                setActiveModal('confirm');
                setModalError(null);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-950/50 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              CONFIRM EXECUTION
            </button>
          )}

          {data.can_mark_failed && (
            <button
              onClick={() => {
                setActiveModal('fail');
                setModalError(null);
              }}
              className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border border-rose-800/50 transition-colors flex items-center gap-2"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              MARK FAILED
            </button>
          )}

          {data.can_mark_not_executed && (
            <button
              onClick={() => {
                setActiveModal('not_executed');
                setModalError(null);
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border border-slate-700 transition-colors"
            >
              MARK NOT EXECUTED
            </button>
          )}

          {onOpenOutcomeMonitor && (data.status === 'EXECUTED' || data.status === 'OUTCOME_MONITORING') && (
            <button
              onClick={onOpenOutcomeMonitor}
              className="px-4 py-2.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
            >
              <span>OUTCOME MONITOR (PHASE 03)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. READINESS CHECKS & EVENT HISTORY SPLIT                     */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* READINESS CHECKS (6 COLS) */}
        <div className="lg:col-span-6 border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
                EXECUTION READINESS EVALUATION
              </h3>
            </div>
            <span className="text-[12px] font-mono text-[#8492A5]">
              {data.readiness_checks.filter(c => c.passed).length} / {data.readiness_checks.length} Passed
            </span>
          </div>

          <div className="space-y-3">
            {data.readiness_checks.map((check) => (
              <div
                key={check.check_key}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 ${
                  check.passed
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-tight">
                    {check.name}
                  </span>
                  {check.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </div>

                <p className="text-xs font-sans text-[#B7C3D3] leading-relaxed">
                  {check.details}
                </p>

                <div className="pt-2 border-t border-white/[0.06] text-[11px] font-mono text-[#8492A5] flex justify-between">
                  <span>{check.passed ? 'PASSED' : 'ACTION REQUIRED'}</span>
                  {check.is_blocking && <span className="text-rose-400 font-bold">BLOCKING</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* IMMUTABLE EXECUTION EVENT STREAM (6 COLS) */}
        <div className="lg:col-span-6 border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
                IMMUTABLE EXECUTION EVENT STREAM
              </h3>
            </div>
            <span className="text-[12px] font-mono text-[#8492A5]">
              {history.length} Event(s)
            </span>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#8492A5] bg-slate-950/40 rounded-xl border border-slate-800">
              No operational execution events recorded yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {history.map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="bg-slate-950/50 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between gap-2.5 text-xs font-mono hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <span className="text-white font-bold">{evt.event_type}</span>
                        <span className="text-[#8492A5] ml-2 text-[11px]">
                          ({evt.from_status} → <strong className="text-blue-300">{evt.to_status}</strong>)
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#8492A5]">
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {evt.rationale && (
                    <p className="text-xs font-sans text-slate-300 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                      "{evt.rationale}"
                    </p>
                  )}

                  <div className="text-[11px] text-[#8492A5] flex items-center justify-between border-t border-white/[0.04] pt-1.5">
                    <span>Operator: <strong className="text-slate-200">{evt.actor}</strong></span>
                    <span>{new Date(evt.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 6. MODALS                                                      */}
      {/* ============================================================== */}

      {/* REQUEST MODAL */}
      <AnimatePresence>
        {activeModal === 'request' && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#030914] border border-blue-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Request Decision Execution
              </h3>
              <p className="text-xs font-sans text-[#B7C3D3]">
                Submit an operational execution request for this approved decision.
              </p>

              {modalError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl font-mono">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleRequestExecution} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Operator Identity (Required)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ops-engineer-42 or Jane Doe"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Execution Rationale (Required)
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Operational justification for initiating execution..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM EXECUTION MODAL */}
      <AnimatePresence>
        {activeModal === 'confirm' && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#030914] border border-blue-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-400 fill-blue-400" />
                CONFIRM DECISION EXECUTION
              </h3>
              <p className="text-xs font-sans text-[#B7C3D3]">
                Confirm that this authorized decision was executed in real operations. This records an immutable execution timestamp and transitions the decision into closed-loop outcome monitoring.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                <div>Decision ID: <span className="text-white">{decisionId}</span></div>
                <div>Governance Status: <span className="text-emerald-400 font-bold">{data.governance_status}</span></div>
                <div>Signatory: <span className="text-slate-300">{data.approved_by || 'Verified'}</span></div>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl font-mono">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleConfirmExecution} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Operator Identity (Required)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ops-lead-01 or Alex Smith"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Confirmation Rationale (Required)
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain how/where this decision was applied..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    System Reference / Tracking ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JIRA-4821 or WORKORDER-901"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Confirming...' : 'Confirm Execution'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MARK FAILED MODAL */}
      <AnimatePresence>
        {activeModal === 'fail' && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#030914] border border-rose-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-rose-300 font-mono uppercase tracking-wider flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                Report Execution Failure
              </h3>
              <p className="text-xs font-sans text-[#B7C3D3]">
                Record that execution could not proceed or failed in operation.
              </p>

              {modalError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl font-mono">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleFailExecution} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Operator Identity (Required)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ops-engineer-09"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Failure Reason (Required)
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Factual reason why execution failed..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Recording...' : 'Record Failure'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MARK NOT EXECUTED MODAL */}
      <AnimatePresence>
        {activeModal === 'not_executed' && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#030914] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Mark Decision Not Executed
              </h3>
              <p className="text-xs font-sans text-[#B7C3D3]">
                Record that an approved decision was deliberately not carried out.
              </p>

              {modalError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-xl font-mono">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleNotExecuted} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Actor Identity (Required)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. business-owner-01"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[#8492A5] uppercase text-[11px] mb-1">
                    Justification / Reason (Required)
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Operational window expired or business owner chose alternative path..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Mark Not Executed'}
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
