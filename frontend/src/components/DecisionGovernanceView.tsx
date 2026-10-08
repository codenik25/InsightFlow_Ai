import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Play,
  RotateCcw,
  Zap,
  Archive,
  RefreshCw,
  User,
  Clock,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Send,
  FileCheck,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import {
  DecisionGovernanceResponse,
  GovernanceAction,
  GovernanceEvent,
} from '../types';
import {
  fetchDecisionGovernance,
  transitionDecisionGovernance,
} from '../services/api';

interface DecisionGovernanceViewProps {
  decisionId: string;
  projectId?: string | null;
  datasetId?: string | null;
  datasetName?: string | null;
  onSelectTab?: (tab: 'details' | 'evidence' | 'outcomes' | 'performance' | 'learning_signals') => void;
}

const GOVERNANCE_STAGES = [
  { id: 'DRAFT', label: 'DRAFT', step: 1 },
  { id: 'UNDER_REVIEW', label: 'UNDER REVIEW', step: 2 },
  { id: 'PENDING_APPROVAL', label: 'PENDING APPROVAL', step: 3 },
  { id: 'APPROVED', label: 'APPROVED', step: 4 },
  { id: 'EXECUTED', label: 'EXECUTED', step: 5 },
  { id: 'CLOSED', label: 'CLOSED', step: 6 },
];

export const DecisionGovernanceView: React.FC<DecisionGovernanceViewProps> = ({
  decisionId,
  projectId,
  datasetName,
  onSelectTab,
}) => {
  const [data, setData] = useState<DecisionGovernanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Dialog State
  const [activeAction, setActiveAction] = useState<GovernanceAction | null>(null);
  const [reviewerInput, setReviewerInput] = useState<string>('Governance Officer');
  const [notesInput, setNotesInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadGovernance = useCallback(async () => {
    if (!decisionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDecisionGovernance(decisionId, projectId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load Decision Governance control room.');
    } finally {
      setLoading(false);
    }
  }, [decisionId, projectId]);

  useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  const handleActionClick = (action: GovernanceAction) => {
    setActiveAction(action);
    setActionError(null);
    setNotesInput('');
  };

  const handleConfirmTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction || !decisionId) return;

    const trimmedReviewer = reviewerInput.trim();
    if (!trimmedReviewer) {
      setActionError('Reviewer identity is required.');
      return;
    }

    const trimmedNotes = notesInput.trim();
    const criticalActions = ['APPROVE', 'REJECT', 'ESCALATE', 'PUT_ON_HOLD'];
    if (criticalActions.includes(activeAction) && !trimmedNotes) {
      setActionError(`Review notes are required for '${activeAction}'. Unjustified state changes are prohibited.`);
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const updated = await transitionDecisionGovernance(
        decisionId,
        {
          action: activeAction,
          reviewer: trimmedReviewer,
          review_notes: trimmedNotes || undefined,
        },
        projectId
      );
      setData(updated);
      setActiveAction(null);
      setNotesInput('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to perform governance transition.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.2)]';
      case 'REJECTED':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      case 'ESCALATED':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse';
      case 'ON_HOLD':
        return 'bg-amber-500/15 text-amber-200 border-amber-500/40';
      case 'UNDER_REVIEW':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
      case 'PENDING_APPROVAL':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40';
      case 'EXECUTED':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
      case 'CLOSED':
        return 'bg-slate-700/40 text-slate-400 border-slate-600/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getCheckIcon = (checkStatus: string) => {
    switch (checkStatus) {
      case 'READY':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'INCOMPLETE':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  const getActionLabel = (action: GovernanceAction) => {
    switch (action) {
      case 'START_REVIEW':
        return { label: 'START REVIEW', icon: Play, color: 'hover:border-sky-500 text-sky-300 bg-sky-500/10' };
      case 'SUBMIT_FOR_APPROVAL':
        return { label: 'SUBMIT FOR APPROVAL', icon: Send, color: 'hover:border-indigo-500 text-indigo-300 bg-indigo-500/10' };
      case 'APPROVE':
        return { label: 'APPROVE DECISION', icon: CheckCircle2, color: 'hover:border-emerald-500 text-emerald-300 bg-emerald-500/15 border-emerald-500/30' };
      case 'REJECT':
        return { label: 'REJECT DECISION', icon: XCircle, color: 'hover:border-rose-500 text-rose-300 bg-rose-500/10 border-rose-500/30' };
      case 'ESCALATE':
        return { label: 'ESCALATE DECISION', icon: AlertTriangle, color: 'hover:border-amber-500 text-amber-300 bg-amber-500/10 border-amber-500/30' };
      case 'PUT_ON_HOLD':
        return { label: 'PUT ON HOLD', icon: PauseCircle, color: 'hover:border-amber-500 text-amber-200 bg-amber-500/10' };
      case 'RETURN_TO_REVIEW':
        return { label: 'RETURN TO REVIEW', icon: RotateCcw, color: 'hover:border-sky-500 text-sky-300 bg-sky-500/10' };
      case 'EXECUTE':
        return { label: 'EXECUTE ACTION', icon: Zap, color: 'hover:border-purple-500 text-purple-300 bg-purple-500/10' };
      case 'CLOSE':
        return { label: 'CLOSE GOVERNANCE', icon: Archive, color: 'hover:border-slate-500 text-slate-300 bg-slate-500/10' };
      default:
        return { label: action, icon: ShieldCheck, color: 'hover:border-slate-500 text-slate-300 bg-slate-500/10' };
    }
  };

  // Phase-specific Loading State (Timeline Skeleton)
  if (loading && !data) {
    return (
      <ContinuousIntelligenceEngine
        mode="governance"
        isLoading={loading}
        isFullScreen={false}
        minHeight="520px"
        error={error}
        onRetry={loadGovernance}
      />
    );
  }

  // Phase-specific Error State
  if (error || !data) {
    return (
      <div className="w-full max-w-[1580px] mx-auto p-8 border border-rose-500/30 rounded-2xl bg-rose-500/5 text-rose-300">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
          <h4 className="font-bold text-base font-sans tracking-wide uppercase">
            GOVERNANCE CONTROL ROOM UNAVAILABLE
          </h4>
        </div>
        <p className="text-sm font-sans text-rose-200/80 mb-6">
          {error || 'Unable to retrieve persisted governance state for this decision.'}
        </p>
        <button
          onClick={loadGovernance}
          className="px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-mono font-bold text-rose-200 transition-colors"
        >
          RETRY LOAD
        </button>
      </div>
    );
  }

  const {
    status,
    reviewer,
    review_notes,
    last_updated,
    allowed_actions,
    readiness_checks,
    escalation,
    active_issues,
    evidence_summary,
    history,
  } = data;

  const currentStageIndex = GOVERNANCE_STAGES.findIndex((s) => s.id === status);
  const activeStepNumber = currentStageIndex >= 0 ? currentStageIndex + 1 : 1;

  return (
    <div className="w-full max-w-[1580px] mx-auto space-y-6 text-[#F4F7FB]">
      {/* ============================================================== */}
      {/* 1. CONTROL ROOM HERO & STATUS STRIP                            */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border border-[rgba(56,189,248,0.2)] rounded-2xl bg-[#030914]/90 backdrop-blur-xl p-6 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-br from-teal-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold">
                PHASE 06 — CONTROL ROOM
              </span>
              <span className="text-[12px] font-mono text-[#8492A5]">
                Target Decision: <strong className="text-[#F4F7FB]">{decisionId}</strong>
              </span>
              {datasetName && (
                <span className="text-[12px] font-mono text-[#8492A5]">
                  • Context: <strong className="text-slate-300">{datasetName}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl sm:text-[28px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                <ShieldCheck className="w-7 h-7 text-teal-400" />
                DECISION GOVERNANCE CONTROL ROOM
              </h2>
              <div className={`px-3.5 py-1 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider ${getStatusBadge(status)}`}>
                {status.replace(/_/g, ' ')}
              </div>
            </div>

            <p className="text-sm font-sans text-[#B7C3D3] mt-2 max-w-3xl leading-relaxed">
              Enforce deterministic human oversight, sign-off accountability, and immutable auditability before operational deployment.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadGovernance}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-xs font-mono font-semibold flex items-center gap-2"
              title="Refresh Governance State"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
              REFRESH
            </button>
          </div>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 2. LARGE VISUAL GOVERNANCE STATE MACHINE                      */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
              GOVERNANCE STATE MACHINE & SEQUENTIAL LIFECYCLE
            </h3>
          </div>
          <span className="text-[12px] font-mono text-[#8492A5]">
            Stage <strong className="text-teal-400">{activeStepNumber}</strong> of {GOVERNANCE_STAGES.length}
          </span>
        </div>

        {/* State Machine Rail */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 relative">
          {GOVERNANCE_STAGES.map((stage, idx) => {
            const isCurrent = stage.id === status;
            const isCompleted = activeStepNumber > stage.step;

            return (
              <div
                key={stage.id}
                className={`relative p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-teal-500/10 border-teal-400/50 shadow-[0_0_20px_rgba(45,212,191,0.18)]'
                    : isCompleted
                    ? 'bg-emerald-500/[0.04] border-emerald-500/30'
                    : 'bg-white/[0.02] border-white/[0.06] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-mono font-bold ${isCurrent ? 'text-teal-300' : isCompleted ? 'text-emerald-400' : 'text-[#8492A5]'}`}>
                    0{stage.step}
                  </span>
                  {isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.9)] animate-pulse" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>

                <div className={`text-xs font-sans font-bold tracking-tight uppercase ${isCurrent ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-[#8492A5]'}`}>
                  {stage.label}
                </div>

                <div className="mt-2 text-[11px] font-mono text-[#8492A5]">
                  {isCurrent ? (
                    <span className="text-teal-400 font-bold uppercase">● Active Focus</span>
                  ) : isCompleted ? (
                    <span className="text-emerald-400">Passed</span>
                  ) : (
                    <span>Upcoming</span>
                  )}
                </div>

                {/* Arrow connector for desktop */}
                {idx < GOVERNANCE_STAGES.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                    <ArrowRight className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-500/60' : 'text-slate-700'}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 3. DETERMINISTIC ESCALATION ADVISORY (IF TRIGGERED)            */}
      {/* ============================================================== */}
      {escalation.escalation_recommended && (
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 border border-amber-500/40 rounded-2xl bg-amber-500/10 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
        >
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold font-sans text-base tracking-wide uppercase text-amber-300">
                  ESCALATION RECOMMENDED (FACTUAL DETERMINISTIC CRITERIA)
                </h4>
                <p className="text-xs font-sans text-amber-200/90 mt-1 mb-3">
                  Underlying factual indicators require senior review attention. State is NOT mutated automatically.
                </p>
                <ul className="space-y-1.5">
                  {escalation.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs font-mono text-amber-100">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {allowed_actions.includes('ESCALATE') && (
              <button
                onClick={() => handleActionClick('ESCALATE')}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs rounded-xl tracking-wider uppercase transition-all shadow-md shrink-0"
              >
                ESCALATE DECISION →
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 4. MAIN WORKSPACE (LEFT 8 COLS / RIGHT 4 COLS)                 */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ------------------------------------------------------------ */}
        {/* LEFT PANEL: ACTIONS, READINESS, ISSUES, AUDIT LOG (8 COLS)  */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-8 space-y-6">
          {/* AVAILABLE HUMAN ACTIONS TOOLBAR */}
          <div className="p-5 border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] shadow-md">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
                  AUTHORIZED HUMAN GOVERNANCE ACTIONS
                </h3>
              </div>
              <span className="text-[12px] font-mono text-[#8492A5]">
                Governed by State Machine
              </span>
            </div>

            {allowed_actions.length === 0 ? (
              <div className="text-xs font-mono text-[#8492A5] p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
                Decision is in terminal state <strong className="text-slate-200">[{status}]</strong>. No further lifecycle transitions allowed.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {allowed_actions.map((act) => {
                  const { label, icon: ActionIcon, color } = getActionLabel(act);
                  return (
                    <button
                      key={act}
                      onClick={() => handleActionClick(act)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700/80 font-mono font-bold text-xs tracking-wider uppercase transition-all shadow-sm ${color}`}
                    >
                      <ActionIcon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* FACTUAL GOVERNANCE READINESS GRID */}
          <div className="p-5 border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
              <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
                FACTUAL READINESS CHECKS & EVIDENCE VERIFICATION
              </h3>
              <span className="text-[12px] font-mono text-[#8492A5]">
                {readiness_checks.filter(c => c.status === 'READY').length} / {readiness_checks.length} Passed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {readiness_checks.map((check) => (
                <div
                  key={check.check_id}
                  className="p-4 rounded-xl border border-white/[0.06] bg-slate-950/50 flex flex-col justify-between space-y-2.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wide">
                      {check.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getCheckIcon(check.status)}
                      <span
                        className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                          check.status === 'READY'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : check.status === 'INCOMPLETE'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {check.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-sans text-[#B7C3D3] leading-relaxed">
                    {check.details}
                  </p>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-[#8492A5]">
                    <span>ID: {check.check_id}</span>
                    {onSelectTab && (
                      <button
                        onClick={() => {
                          if (check.check_id === 'EVIDENCE_AVAILABLE') onSelectTab('evidence');
                          else if (check.check_id === 'OUTCOME_AVAILABLE') onSelectTab('outcomes');
                          else if (check.check_id === 'PERFORMANCE_AVAILABLE') onSelectTab('performance');
                          else if (check.check_id === 'LEARNING_SIGNALS_REVIEWED') onSelectTab('learning_signals');
                        }}
                        className="text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors"
                      >
                        Inspect Phase <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACTIVE GOVERNANCE CONDITIONS & TRACEABLE ISSUES */}
          <div className="border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
              <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider flex items-center gap-2">
                <span>ACTIVE GOVERNANCE CONDITIONS</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                  {active_issues.length} Active
                </span>
              </h3>
              <span className="text-[12px] font-mono text-[#8492A5]">Persisted Evidence Provenance</span>
            </div>

            {active_issues.length === 0 ? (
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-xs font-mono text-slate-200 font-bold uppercase tracking-wide">
                  No Active Governance Blocking Conditions
                </div>
                <p className="text-xs font-sans text-[#8492A5] mt-1">
                  All required upstream evidence, guardrails, and signals are verified.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {active_issues.map((iss, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                      iss.severity === 'HIGH'
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                        : iss.severity === 'WARNING'
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {iss.severity === 'HIGH' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : iss.severity === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase">
                            {iss.severity}
                          </span>
                          <span className="text-xs font-mono font-bold text-white uppercase">{iss.issue_type}</span>
                        </div>
                        <p className="text-xs font-sans text-slate-300 mt-0.5">{iss.description}</p>
                      </div>
                    </div>

                    {onSelectTab && (
                      <button
                        onClick={() => {
                          if (iss.issue_type.includes('SIGNAL')) onSelectTab('learning_signals');
                          else if (iss.issue_type.includes('GUARDRAIL')) onSelectTab('details');
                          else if (iss.issue_type.includes('OUTCOME')) onSelectTab('outcomes');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-mono text-teal-300 flex items-center gap-1 transition-colors shrink-0"
                      >
                        Investigate <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CHRONOLOGICAL APPEND-ONLY GOVERNANCE AUDIT TIMELINE */}
          <div className="border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
              <div>
                <h3 className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
                  IMMUTABLE GOVERNANCE EVENT LEDGER
                </h3>
                <p className="text-xs font-sans text-[#8492A5] mt-0.5">
                  Append-only ledger of state transitions, reviewer signatures, and recorded justifications.
                </p>
              </div>
              <span className="text-xs font-mono text-[#8492A5]">
                {history.length} Event(s)
              </span>
            </div>

            {history.length === 0 ? (
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-center text-xs font-mono text-[#8492A5]">
                No governance events recorded yet. Initial state is <strong className="text-slate-300">DRAFT</strong>.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {history.map((evt: GovernanceEvent) => (
                  <div key={evt.id} className="relative group">
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/[0.06] hover:border-slate-700 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white uppercase">{evt.action}</span>
                          <span className="text-[11px] font-mono text-[#8492A5]">
                            ({evt.from_status} → <strong className="text-teal-300">{evt.to_status}</strong>)
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#8492A5] flex items-center gap-2">
                          <span>Signatory: <strong className="text-slate-200">{evt.actor}</strong></span>
                          <span>•</span>
                          <span>{new Date(evt.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {evt.review_notes && (
                        <p className="text-xs font-sans text-slate-300 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] mt-2 leading-relaxed">
                          "{evt.review_notes}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT PANEL: CURRENT GOVERNANCE STATE & SNAPSHOT (4 COLS)    */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-4 space-y-6">
          {/* CURRENT GOVERNANCE STATE CARD */}
          <div className="border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                CURRENT GOVERNANCE STATE
              </span>
              <span className="text-[11px] font-mono text-teal-400 font-bold">
                STAGE {activeStepNumber}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5] uppercase text-[10.5px] block mb-1">Assigned Reviewer</span>
                <div className="flex items-center gap-2 text-white font-bold">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  <span>{reviewer || 'Unassigned'}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5] uppercase text-[10.5px] block mb-1">Last Updated</span>
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{last_updated ? new Date(last_updated).toLocaleString() : 'N/A'}</span>
                </div>
              </div>

              {review_notes && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-white/[0.06]">
                  <span className="text-[#8492A5] uppercase text-[10.5px] block mb-1">Current Sign-Off Note</span>
                  <p className="text-xs font-sans text-slate-300 italic leading-relaxed">
                    "{review_notes}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* PROVENANCE EVIDENCE SNAPSHOT */}
          <div className="border border-[rgba(120,190,230,0.16)] rounded-2xl bg-[#030914] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <span className="text-xs font-mono font-bold text-[#F4F7FB] uppercase tracking-wider">
                PROVENANCE EVIDENCE
              </span>
              <span className="text-[11px] font-mono text-[#8492A5]">
                Upstream
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5]">Dataset Version</span>
                <span className="text-white font-bold">v{evidence_summary.dataset_version || 1}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5]">Target Metric</span>
                <span className="text-teal-300 font-bold truncate max-w-[150px]">{evidence_summary.target_metric || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5]">Projected Value</span>
                <span className="text-white font-bold">{evidence_summary.projected_value ?? 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5]">Guardrails</span>
                <span className="text-emerald-400 font-bold">{evidence_summary.guardrail_feasibility || 'PASSED'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5]">Observed Outcomes</span>
                <span className="text-white font-bold">{evidence_summary.observed_outcomes_count || 0}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-white/[0.06]">
                <span className="text-[#8492A5]">Active Signals</span>
                <span className={`font-bold ${evidence_summary.active_learning_signals_count ? 'text-amber-400' : 'text-slate-400'}`}>
                  {evidence_summary.active_learning_signals_count || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. HUMAN REVIEW / TRANSITION MODAL                             */}
      {/* ============================================================== */}
      <AnimatePresence>
        {activeAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 bg-[#030914] border border-teal-500/30 rounded-2xl shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-400" />
                  <h3 className="font-mono font-bold text-sm text-white uppercase tracking-wider">
                    AUTHORIZE TRANSITION: {activeAction}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveAction(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs font-sans text-[#B7C3D3] leading-relaxed">
                You are performing an explicit human governance transition on decision <strong className="text-white">{decisionId}</strong>.
                This action and rationale will be permanently recorded in the immutable audit ledger.
              </p>

              <form onSubmit={handleConfirmTransition} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                    Reviewer Identity (Required)
                  </label>
                  <input
                    type="text"
                    value={reviewerInput}
                    onChange={(e) => setReviewerInput(e.target.value)}
                    placeholder="e.g. lead.analyst@organization.com or Executive Director"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                    Review Notes & Rationale {['APPROVE', 'REJECT', 'ESCALATE', 'PUT_ON_HOLD'].includes(activeAction) && <span className="text-rose-400 font-bold">*Required</span>}
                  </label>
                  <textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Record verifiable justification, evidence observed, or rationale for this governance decision..."
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-sans text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                {actionError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-300">
                    {actionError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveAction(null)}
                    disabled={submitting}
                    className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-mono text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold text-xs rounded-xl uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'RECORDING...' : `CONFIRM ${activeAction}`}
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
