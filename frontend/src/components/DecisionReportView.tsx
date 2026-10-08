import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Fingerprint,
} from 'lucide-react';
import { IndividualDecisionReportResponse } from '../types';
import { fetchIndividualDecisionReport } from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DecisionReportViewProps {
  decisionId: string;
  projectId?: string | null;
  datasetName?: string;
}

export const DecisionReportView: React.FC<DecisionReportViewProps> = ({
  decisionId,
  projectId,
  datasetName,
}) => {
  const [report, setReport] = useState<IndividualDecisionReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedEventIdx, setExpandedEventIdx] = useState<number | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('ALL');

  const loadReport = async () => {
    if (!decisionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIndividualDecisionReport(decisionId, projectId || undefined);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to assemble multi-hop decision audit trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [decisionId, projectId]);

  const handleCopyJson = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Continuous Intelligence Loader for Audit Ledger Assembly
  if (loading && !report) {
    return (
      <div className="w-full max-w-[1580px] mx-auto py-8">
        <ContinuousIntelligenceEngine
          mode="audit"
          active={loading}
          title="ASSEMBLING AUDIT-GRADE DECISION LEDGER"
          description={`Extracting cryptographic timeline, sign-offs, governance approvals, and immutable ledger events for decision ${decisionId}...`}
          metrics={[
            { label: 'LEDGER', value: 'APPEND-ONLY' },
            { label: 'EVIDENCE INTEGRITY', value: 'SHA-256' },
            { label: 'COMPLIANCE', value: 'VALIDATING' },
            { label: 'VERIFICATION', value: 'CONTINUOUS' }
          ]}
        />
      </div>
    );
  }

  // Phase-specific Error State
  if (error || !report) {
    return (
      <div className="w-full max-w-[1580px] mx-auto p-8 rounded-2xl bg-rose-950/20 border border-rose-800/50 text-rose-300">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <h4 className="font-bold text-base font-sans tracking-wide uppercase">
            AUDIT TIMELINE UNAVAILABLE
          </h4>
        </div>
        <p className="text-sm font-sans text-rose-200/80 mb-6">
          {error || `No persisted audit ledger available for decision ${decisionId}.`}
        </p>
        <button
          onClick={loadReport}
          className="px-5 py-2.5 bg-rose-900/50 hover:bg-rose-800 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors"
        >
          RETRY AUDIT ASSEMBLY
        </button>
      </div>
    );
  }

  const {
    metadata,
    decision_identity,
    governance_audit,
    execution_audit,
    outcome_audit,
    audit_timeline,
  } = report;

  // Filtered Events
  const filteredEvents = audit_timeline.filter((evt) => {
    if (eventFilter === 'ALL') return true;
    return evt.event_type.toUpperCase().includes(eventFilter);
  });

  return (
    <div className="w-full max-w-[1580px] mx-auto space-y-6 text-[#F4F7FB]">
      {/* ============================================================== */}
      {/* 1. AUDIT HEADER & METADATA BAR                                 */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[#030914]/90 border border-[rgba(226,232,240,0.18)] rounded-2xl p-6 sm:p-7 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-br from-slate-400/5 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest bg-slate-800/80 text-slate-300 border border-slate-700 font-semibold flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                PHASE 08 — AUDIT LEDGER
              </span>
              <span className="text-[12px] font-mono text-[#8492A5]">
                Scope: <strong className="text-white">{metadata.scope}</strong>
              </span>
              <span className="text-[12px] font-mono text-[#8492A5]">
                • Ledger ID: <strong className="text-cyan-300">{metadata.report_id.slice(0, 12)}...</strong>
              </span>
              {datasetName && (
                <span className="text-[12px] font-mono text-[#8492A5]">
                  • Context: <strong className="text-slate-300">{datasetName}</strong>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-[28px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-cyan-400" />
              IMMUTABLE DECISION AUDIT TIMELINE
            </h2>

            <p className="text-sm font-sans text-[#B7C3D3] mt-2 max-w-3xl leading-relaxed">
              Forensic, chronological ledger reconstructing the end-to-end provenance lifecycle—from dataset ingestion through analytical inference, governance approval, operational execution, and measured outcomes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="text-right font-mono text-[11px] text-[#8492A5] hidden sm:block">
              <div>Assembled: <span className="text-slate-300">{new Date(metadata.generated_at).toLocaleString()}</span></div>
              <div className="text-[10.5px]">Data Snapshot: {new Date(metadata.data_as_of).toLocaleTimeString()}</div>
            </div>

            <button
              onClick={handleCopyJson}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl font-mono text-xs font-bold transition-all border border-slate-700 flex items-center gap-2"
              title="Copy Complete Audit JSON Payload"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'COPIED TO CLIPBOARD' : 'COPY AUDIT JSON'}
            </button>

            <button
              onClick={loadReport}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
              title="Refresh Audit Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 2. AUDIT FORENSIC STRIP (MINIMAL PROVENANCE METRICS)          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-[#030914] border border-white/[0.06] rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Decision Status</span>
          <span className="text-sm font-mono font-bold text-cyan-400 uppercase truncate">
            {decision_identity.status || 'ACTIVE'}
          </span>
        </div>

        <div className="p-3.5 bg-[#030914] border border-white/[0.06] rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Governance</span>
          <span className="text-sm font-mono font-bold text-white uppercase truncate">
            {governance_audit.current_stage || 'DRAFT'}
          </span>
        </div>

        <div className="p-3.5 bg-[#030914] border border-white/[0.06] rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Execution</span>
          <span className="text-sm font-mono font-bold text-blue-400 uppercase truncate">
            {execution_audit.status || 'UNEXECUTED'}
          </span>
        </div>

        <div className="p-3.5 bg-[#030914] border border-white/[0.06] rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Target Metric</span>
          <span className="text-sm font-mono font-bold text-white truncate">
            {decision_identity.target_metric || 'N/A'}
          </span>
        </div>

        <div className="p-3.5 bg-[#030914] border border-white/[0.06] rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Outcome Status</span>
          <span className="text-sm font-mono font-bold text-emerald-400 truncate">
            {outcome_audit.actual_value !== undefined && outcome_audit.actual_value !== null ? 'MEASURED' : 'PENDING'}
          </span>
        </div>

        <div className="p-3.5 bg-[#030914] border border-white/[0.06] rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-mono text-[#8492A5] uppercase block mb-1">Total Audit Events</span>
          <span className="text-sm font-mono font-bold text-white">
            {audit_timeline.length}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. VERTICAL CHRONOLOGICAL LEDGER (MAIN VISUAL)                */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="border border-[rgba(226,232,240,0.14)] rounded-2xl bg-[#030914] p-6 sm:p-8 shadow-xl space-y-6"
      >
        {/* Ledger Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                CHRONOLOGICAL PROVENANCE LEDGER
              </h3>
              <span className="text-xs font-sans text-[#8492A5]">
                Strict append-only record sorted chronologically from inception to latest state.
              </span>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#8492A5] uppercase">Filter:</span>
            {['ALL', 'GOVERNANCE', 'EXECUTION', 'DECISION', 'OUTCOME'].map((f) => (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold uppercase transition-colors ${
                  eventFilter === f
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                    : 'bg-white/[0.02] text-[#8492A5] hover:text-slate-200 border border-white/[0.06]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* The Vertical Ledger Line & Events */}
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-[#8492A5] bg-slate-950/40 rounded-xl border border-slate-800">
            No audit ledger events found matching the selected filter criteria.
          </div>
        ) : (
          <div className="relative pl-8 sm:pl-10 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-cyan-400 before:via-blue-500 before:to-slate-800">
            {filteredEvents.map((evt, idx) => {
              const isExpanded = expandedEventIdx === idx;
              const dateObj = new Date(evt.timestamp);

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="relative group cursor-pointer"
                  onClick={() => setExpandedEventIdx(isExpanded ? null : idx)}
                >
                  {/* Glowing Node on Spine */}
                  <div className="absolute -left-[30px] sm:-left-[34px] top-4 w-4 h-4 rounded-full bg-[#030914] border-2 border-cyan-400 shadow-[0_0_10px_rgba(57,214,245,0.7)] group-hover:scale-125 transition-transform" />

                  {/* Ledger Event Row Surface */}
                  <div className={`p-4 sm:p-5 rounded-xl border transition-all ${
                    isExpanded
                      ? 'bg-slate-950/90 border-cyan-400/40 shadow-lg'
                      : 'bg-slate-950/50 border-white/[0.06] hover:border-slate-700'
                  }`}>
                    {/* Header Row: Timestamp + Event Type + Actor + Expand Caret */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Timestamp: 12px IBM Plex Mono */}
                        <span className="text-[12px] font-mono text-cyan-300 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                          {dateObj.toLocaleTimeString()}
                        </span>

                        {/* Event Type: 14px */}
                        <span className="text-[14px] font-sans font-bold text-white uppercase tracking-tight">
                          {evt.event_type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-[#8492A5]">
                        {evt.actor && (
                          <span>
                            Actor: <strong className="text-slate-200">{evt.actor}</strong>
                          </span>
                        )}
                        <span>{dateObj.toLocaleDateString()}</span>
                        <div className="text-slate-400 group-hover:text-white transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Details: 13–14px */}
                    <p className="text-[13.5px] font-sans text-[#B7C3D3] leading-relaxed">
                      {evt.description}
                    </p>

                    {/* Forensic Details Drawer (Click to Expand) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-white/[0.06] space-y-2 text-xs font-mono"
                        >
                          <div className="text-[11px] uppercase text-[#8492A5] font-bold">
                            FORENSIC RECORD PAYLOAD
                          </div>
                          <div className="p-3 bg-black/60 rounded-lg border border-white/[0.04] text-slate-300 space-y-1">
                            <div><strong className="text-[#8492A5]">Event Type:</strong> {evt.event_type}</div>
                            <div><strong className="text-[#8492A5]">Timestamp:</strong> {evt.timestamp}</div>
                            <div><strong className="text-[#8492A5]">Recorded Actor:</strong> {evt.actor || 'System Engine'}</div>
                            <div><strong className="text-[#8492A5]">Decision Context:</strong> {decisionId}</div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};
