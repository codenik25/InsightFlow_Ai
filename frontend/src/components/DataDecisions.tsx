import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Network,
  BookOpen,
  Activity,
  Sparkles,
  GitCommit,
  CheckCircle2,
  RefreshCw,
  Zap,
  Target,
  BarChart3,
  PlayCircle,
  FileSearch
} from 'lucide-react';
import {
  DecisionCommandCenterResponse,
  DecisionBriefResponse,
} from '../types';
import {
  fetchDecisionCommandCenter,
  generateDecisionBrief,
  fetchDecisionBrief,
  recordDecisionOutcome
} from '../services/api';
import { EvidenceGraphView } from './EvidenceGraphView';
import { DecisionOutcomeView } from './DecisionOutcomeView';
import { DecisionPerformanceView } from './DecisionPerformanceView';
import { DecisionLearningSignalsView } from './DecisionLearningSignalsView';
import { DecisionGovernanceView } from './DecisionGovernanceView';
import { DecisionExecutionView } from './DecisionExecutionView';
import { DecisionReportView } from './DecisionReportView';
import { DecisionKnowledgeView } from './DecisionKnowledgeView';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DataDecisionsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
  projectId?: string | null;
}

export const DataDecisions: React.FC<DataDecisionsProps> = ({ 
  processedDatasetId, 
  setCurrentStage, 
  projectId 
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [decisionData, setDecisionData] = useState<DecisionCommandCenterResponse | null>(null);
  
  // Brief State
  const [brief, setBrief] = useState<DecisionBriefResponse | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState<boolean>(false);
  
  // Outcome State
  const [formalizing, setFormalizing] = useState<boolean>(false);
  const [outcomeSuccess, setOutcomeSuccess] = useState<boolean>(false);
  const [actualMetric, setActualMetric] = useState<string>('');
  const [actualValue, setActualValue] = useState<string>('');
  const [rationale, setRationale] = useState<string>('');
  const [decisionViewMode, setDecisionViewMode] = useState<
    'details' | 'evidence' | 'outcomes' | 'performance' | 'learning_signals' | 'governance' | 'execution' | 'report' | 'knowledge'
  >('details');

  const loadData = useCallback(async () => {
    if (!processedDatasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDecisionCommandCenter(processedDatasetId);
      setDecisionData(data);
      
      // Attempt to load existing brief
      try {
        const existingBrief = await fetchDecisionBrief(processedDatasetId);
        setBrief(existingBrief);
      } catch (err) {
        // Brief might not exist yet, ignore
      }

      if (data.primary_recommendation) {
        setActualMetric(data.primary_recommendation.target_metric);
        setActualValue(String(data.primary_recommendation.projected_value));
      }

    } catch (err: any) {
      setError(err.message || 'Failed to aggregate Decision Intelligence evidence chain.');
    } finally {
      setLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateBrief = async () => {
    if (!processedDatasetId || !decisionData?.primary_recommendation?.recommendation_id) return;
    setGeneratingBrief(true);
    try {
      const newBrief = await generateDecisionBrief(processedDatasetId, decisionData.primary_recommendation.recommendation_id);
      setBrief(newBrief);
    } catch (err: any) {
      setError(err.message || 'Failed to generate formal Decision Brief.');
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleFormalizeDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processedDatasetId || !decisionData?.primary_recommendation?.recommendation_id) return;
    
    setFormalizing(true);
    setError(null);
    setOutcomeSuccess(false);

    try {
      await recordDecisionOutcome(processedDatasetId, {
        recommendation_id: decisionData.primary_recommendation.recommendation_id,
        actual_metric: actualMetric,
        actual_value: parseFloat(actualValue) || 0,
        notes: rationale || undefined,
      });
      setOutcomeSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to formalize decision outcome.');
    } finally {
      setFormalizing(false);
    }
  };

  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);

  const primary = decisionData?.primary_recommendation;

  const transitionCurve: any = { duration: 0.55, ease: [0.22, 1, 0.36, 1] };

  // Phase navigation items
  const timelinePhases = useMemo(() => [
    {
      id: 'details',
      number: '01',
      label: 'DECISION',
      phaseTag: 'CORE',
      icon: Activity,
      status: decisionViewMode === 'details' ? 'CURRENT' : 'READY',
      subtitle: 'Core parameter formalization, metrics & snapshot',
      color: '#39D6F5',
    },
    {
      id: 'evidence',
      number: '02',
      label: 'EVIDENCE',
      phaseTag: 'PHASE 5',
      icon: Network,
      status: decisionViewMode === 'evidence' ? 'CURRENT' : (decisionData?.evidence_chain ? 'AVAILABLE' : 'STANDBY'),
      subtitle: 'Multi-hop graph & metric provenance chain',
      color: '#4D8DFF',
    },
    {
      id: 'outcomes',
      number: '03',
      label: 'OUTCOME',
      phaseTag: 'PHASE 6',
      icon: Target,
      status: decisionViewMode === 'outcomes' ? 'CURRENT' : (outcomeSuccess ? 'RECORDED' : 'AVAILABLE'),
      subtitle: 'Deterministic projection vs observed real-world',
      color: '#35D399',
    },
    {
      id: 'performance',
      number: '04',
      label: 'PERFORMANCE',
      phaseTag: 'PHASE 7',
      icon: BarChart3,
      status: decisionViewMode === 'performance' ? 'CURRENT' : 'AVAILABLE',
      subtitle: 'Execution drift, latency & historical metric delta',
      color: '#9B7BFF',
    },
    {
      id: 'learning_signals',
      number: '05',
      label: 'LEARNING',
      phaseTag: 'PHASE 8',
      icon: Sparkles,
      status: decisionViewMode === 'learning_signals' ? 'CURRENT' : 'AVAILABLE',
      subtitle: 'Adaptive closed-loop feedback & recalibration signals',
      color: '#C084FC',
    },
    {
      id: 'governance',
      number: '06',
      label: 'GOVERNANCE',
      phaseTag: 'PHASE 9',
      icon: ShieldCheck,
      status: decisionViewMode === 'governance' ? 'CURRENT' : (decisionData?.snapshot?.decision_status ? 'REVIEW' : 'AVAILABLE'),
      subtitle: 'Review gates, consensus approval & compliance verification',
      color: '#38BDF8',
    },
    {
      id: 'execution',
      number: '07',
      label: 'EXECUTION',
      phaseTag: 'PHASE 10',
      icon: PlayCircle,
      status: decisionViewMode === 'execution' ? 'CURRENT' : 'AVAILABLE',
      subtitle: 'Production dispatch, run status & deployment pipelines',
      color: '#60A5FA',
    },
    {
      id: 'report',
      number: '08',
      label: 'AUDIT',
      phaseTag: 'PHASE 13',
      icon: FileSearch,
      status: decisionViewMode === 'report' ? 'CURRENT' : (brief ? 'GENERATED' : 'AVAILABLE'),
      subtitle: 'Immutable forensic ledger & executive audit exports',
      color: '#2DD4BF',
    },
    {
      id: 'knowledge',
      number: '09',
      label: 'KNOWLEDGE',
      phaseTag: 'PHASE 14',
      icon: BookOpen,
      status: decisionViewMode === 'knowledge' ? 'CURRENT' : 'AVAILABLE',
      subtitle: 'Decision memory bank & organizational precedents',
      color: '#A78BFA',
    },
  ], [decisionViewMode, decisionData, brief]);

  const activeIndex = useMemo(() => {
    const idx = timelinePhases.findIndex(p => p.id === decisionViewMode);
    return idx >= 0 ? idx : 0;
  }, [timelinePhases, decisionViewMode]);

  const activePhaseMeta = timelinePhases[activeIndex] || timelinePhases[0];

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-10 max-w-xl mx-auto space-y-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-sans font-semibold text-white tracking-tight">NO PROCESSED DATASET</h3>
        <p className="text-[#8795A8] font-sans text-sm max-w-md leading-relaxed">
          Decisions require a processed dataset artifact from the Optimization and Recommendations stages.
        </p>
        <button 
          onClick={() => setCurrentStage('OPTIMIZATION')}
          className="h-11 px-7 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 rounded-xl text-xs font-mono font-semibold tracking-wider uppercase border border-cyan-500/30 transition-all flex items-center gap-2"
        >
          ← BACK TO OPTIMIZATION
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <ContinuousIntelligenceEngine
        mode="decisions"
        isLoading={loading}
        isFullScreen={false}
        minHeight="540px"
        error={error}
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="relative w-full max-w-[1550px] mx-auto space-y-6 min-w-0 select-none pb-12">
      {/* Background Dynamic Atmospheric Glow shifted by active phase */}
      <div 
        className="absolute -top-12 -left-12 -right-12 h-[420px] pointer-events-none overflow-hidden -z-10 transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(ellipse 65% 50% at 50% 0%, ${activePhaseMeta.color}15 0%, transparent 70%)`
        }}
      >
        <svg className="w-full h-full opacity-30" preserveAspectRatio="none" viewBox="0 0 1400 300">
          <path d="M 0,70 Q 350,20 700,90 T 1400,50" fill="none" stroke={activePhaseMeta.color} strokeWidth="1.5" strokeDasharray="4 6" opacity="0.35" />
          <path d="M 0,160 Q 400,60 800,170 T 1400,90" fill="none" stroke={activePhaseMeta.color} strokeWidth="1.5" opacity="0.25" />
          <circle r="3.5" fill={activePhaseMeta.color} opacity="0.85">
            <animateMotion dur="11s" repeatCount="indefinite" path="M 0,160 Q 400,60 800,170 T 1400,90" />
          </circle>
        </svg>
      </div>

      {/* ============================================================== */}
      {/* 1. HERO — DECISION COMMAND CENTER                              */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transitionCurve}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-[rgba(120,190,230,0.14)]"
      >
        <div className="space-y-2 relative">
          {/* Subtle radial glow behind COMMAND CENTER */}
          <div className="absolute top-6 left-52 w-72 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              INTELLIGENCE CONVERGENCE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-[#8795A8] bg-[#07111F]/70 border border-[rgba(120,190,230,0.12)]">
              Stage 09
            </span>
          </div>

          <h1 className="text-4xl sm:text-[48px] lg:text-[50px] font-sans font-semibold tracking-tight text-white leading-tight">
            DECISION{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 font-semibold">
              COMMAND CENTER
            </span>
          </h1>

          <p className="text-[#B8C4D4] font-sans text-[15px] sm:text-[16px] max-w-2xl leading-[1.6]">
            Finalize the selected decision with its verified evidence, scenario parameters, governance state, and expected outcome.
          </p>
        </div>

        {/* Hero Metadata Chips */}
        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] text-xs font-mono shadow-sm">
              <span className="text-[#8795A8] uppercase tracking-wider font-semibold text-[11px]">DATASET</span>
              <span className="text-cyan-400 font-semibold truncate max-w-[130px]" title={processedDatasetId}>
                {processedDatasetId.substring(0, 12)}...
              </span>
            </div>

            {decisionData?.evidence_chain?.optimization_id && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] text-xs font-mono shadow-sm">
                <span className="text-[#8795A8] uppercase tracking-wider font-semibold text-[11px]">OPTIMIZATION</span>
                <span className="text-violet-400 font-semibold truncate max-w-[130px]" title={decisionData.evidence_chain.optimization_id}>
                  {decisionData.evidence_chain.optimization_id.substring(0, 12)}...
                </span>
              </div>
            )}
          </div>

          <button 
            onClick={() => setCurrentStage('OPTIMIZATION')}
            className="text-xs font-mono text-[#8795A8] hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1"
          >
            ← BACK TO OPTIMIZATION
          </button>
        </div>
      </motion.section>

      {/* Global Error Banner */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="text-sm">{error}</span>
          </div>
          <button 
            onClick={loadData} 
            className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800 rounded-lg uppercase text-xs tracking-wider transition-colors shrink-0"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 2. DECISION INTELLIGENCE TIMELINE & PHASE CONTROL              */}
      {/* ============================================================== */}
      {decisionData && (
        <motion.section 
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...transitionCurve, delay: 0.08 }}
          className="bg-[rgba(7,16,29,0.85)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.25)] relative overflow-visible"
        >
          {/* Top Rail Header */}
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[rgba(120,190,230,0.08)]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.8)] animate-pulse" />
              <span className="text-[11px] font-mono tracking-widest text-[#8795A8] uppercase font-semibold">
                DECISION INTELLIGENCE LIFECYCLE
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#8795A8]">
              <span>PHASE {activePhaseMeta.number} OF 09</span>
              <span className="text-white/20">•</span>
              <span className="text-cyan-400 font-semibold">{activePhaseMeta.label}</span>
            </div>
          </div>

          {/* Horizontal Timeline Rail (Horizontal scroll only on small screens) */}
          <div className="relative w-full overflow-x-auto scrollbar-none py-1">
            <div 
              className="flex items-stretch justify-between min-w-[960px] lg:min-w-0 w-full"
              style={{ perspective: '1200px' }}
            >
              {timelinePhases.map((phase, index) => {
                const Icon = phase.icon;
                const isActive = decisionViewMode === phase.id;
                const isPast = index < activeIndex;
                const isHovered = hoveredPhase === phase.id;

                return (
                  <div
                    key={phase.id}
                    className="relative flex-1 flex flex-col items-center group cursor-pointer select-none px-1"
                    onMouseEnter={() => setHoveredPhase(phase.id)}
                    onMouseLeave={() => setHoveredPhase(null)}
                    onClick={() => setDecisionViewMode(phase.id as any)}
                    style={{
                      transition: 'transform 200ms ease-out',
                      transform: isHovered ? 'translateY(-2px) rotateX(1deg)' : 'none',
                    }}
                  >
                    {/* CONNECTOR LINE ROW - EXACT VERTICAL CENTER OF NODE CIRCLE */}
                    <div className="relative w-full h-11 flex items-center justify-center">
                      {/* Left connector half */}
                      {index > 0 && (
                        <div 
                          className={`absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-[2px] transition-colors duration-500 ${
                            index <= activeIndex
                              ? 'bg-gradient-to-r from-cyan-400 to-[#39D6F5]'
                              : 'bg-[rgba(120,190,230,0.14)]'
                          }`}
                        />
                      )}

                      {/* Right connector half */}
                      {index < timelinePhases.length - 1 && (
                        <div 
                          className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-[2px] transition-colors duration-500 ${
                            index < activeIndex
                              ? 'bg-cyan-400'
                              : index === activeIndex
                              ? 'bg-gradient-to-r from-[#39D6F5] to-[rgba(120,190,230,0.2)]'
                              : 'bg-[rgba(120,190,230,0.14)]'
                          }`}
                        />
                      )}

                      {/* Subtle moving signal particle travelling from current phase to next phase */}
                      {index === activeIndex && index < timelinePhases.length - 1 && (
                        <div className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-[2px] overflow-hidden pointer-events-none z-10">
                          <motion.div
                            animate={{ x: ['-20%', '120%'], opacity: [0, 1, 1, 0] }}
                            transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5 }}
                            className="w-5 h-[2px] bg-gradient-to-r from-transparent via-[#39D6F5] to-white shadow-[0_0_8px_#39D6F5]"
                          />
                        </div>
                      )}

                      {/* NODE CIRCLE / BUTTON */}
                      <div
                        className={`relative z-10 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-b from-[#0B223D] to-[#040C1A] border-2 border-[#39D6F5] text-cyan-300 shadow-[0_0_24px_rgba(57,214,245,0.35)]'
                            : isPast
                            ? 'bg-[#061224] border border-cyan-500/30 text-cyan-400 group-hover:border-cyan-400/60'
                            : 'bg-[rgba(7,16,29,0.9)] border border-[rgba(120,190,230,0.18)] text-[#8795A8] group-hover:text-white group-hover:border-cyan-400/40 group-hover:bg-[#0A182E]'
                        }`}
                      >
                        {/* Animated active pulse ring */}
                        {isActive && (
                          <motion.div
                            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.15, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute -inset-1 rounded-2xl border border-cyan-400/60 pointer-events-none"
                          />
                        )}

                        {/* Icon with micro-animation */}
                        <Icon
                          className={`w-5 h-5 transition-transform duration-200 ${
                            isHovered ? 'scale-110' : ''
                          } ${isActive ? 'text-cyan-300' : isPast ? 'text-cyan-400' : 'text-[#8795A8] group-hover:text-white'}`}
                        />
                      </div>

                      {/* FLOATING HOVER PREVIEW TOOLTIP */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="absolute bottom-full mb-3 z-50 pointer-events-none whitespace-nowrap px-3 py-2 rounded-xl bg-[rgba(6,14,26,0.96)] border border-cyan-400/30 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-md"
                          >
                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                              <span>Phase {phase.number}</span>
                              <span className="text-white/20">•</span>
                              <span className="text-white">{phase.label}</span>
                            </div>
                            <div className="text-[11px] font-sans text-[#B8C4D4] mt-0.5 max-w-[200px] leading-tight">
                              {phase.subtitle}
                            </div>
                            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-[rgba(6,14,26,0.96)] border-r border-b border-cyan-400/30" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* NODE DETAILS BELOW CIRCLE */}
                    <div className="mt-2.5 flex flex-col items-center text-center px-1 w-full">
                      {/* Phase Number in IBM Plex Mono 11-12px */}
                      <span
                        className={`text-[11px] font-mono tracking-wider font-semibold transition-colors duration-150 ${
                          isActive ? 'text-cyan-400' : isPast ? 'text-cyan-400/70' : 'text-[#8795A8] group-hover:text-[#B8C4D4]'
                        }`}
                      >
                        {phase.number}
                      </span>

                      {/* Phase Name in Plus Jakarta Sans 13-14px */}
                      <span
                        className={`text-[13px] font-sans font-bold tracking-tight transition-colors duration-150 mt-0.5 ${
                          isActive ? 'text-white' : 'text-[#B8C4D4] group-hover:text-white'
                        }`}
                      >
                        {phase.label}
                      </span>

                      {/* Phase Status Pill */}
                      <div className="mt-1 flex items-center gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-semibold tracking-wider uppercase transition-all ${
                            isActive
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_8px_rgba(57,214,245,0.25)]'
                              : isPast
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/[0.03] text-[#8795A8] border border-white/[0.06] group-hover:border-white/10'
                          }`}
                        >
                          {phase.status}
                        </span>
                      </div>

                      {/* Active Phase Slider / Indicator */}
                      {isActive ? (
                        <motion.div
                          layoutId="activePhaseSlider"
                          className="h-[3px] w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mt-2 shadow-[0_0_12px_rgba(57,214,245,0.9)]"
                          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        />
                      ) : (
                        <div className="h-[3px] w-12 bg-transparent mt-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase Context Bar Directly Below Timeline (Section 16) */}
          <div className="mt-4 pt-3.5 border-t border-[rgba(120,190,230,0.1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.8)] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase text-[#8795A8] tracking-widest block font-semibold">
                  CURRENT FOCUS
                </span>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activePhaseMeta.id + (primary?.title || '')}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="text-xs sm:text-[13.5px] font-sans font-medium text-white truncate max-w-[650px]"
                  >
                    {primary?.title || decisionData?.dataset_name || 'Multi-Hop Decision Optimization & Evidence Convergence'}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePhaseMeta.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)]"
                >
                  <span className="text-[11px] font-mono text-cyan-400 font-bold tracking-wider">
                    {activePhaseMeta.label}
                  </span>
                  <span className="text-[#8795A8] text-[11px] font-mono">•</span>
                  <span className="text-[11px] font-mono text-[#B8C4D4] font-semibold">
                    PHASE {activePhaseMeta.number}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 uppercase">
                    {activePhaseMeta.phaseTag}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      )}

      {/* Subviews Container with Smooth Slide-Fade Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={decisionViewMode}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="w-full space-y-6"
        >
          {decisionViewMode === 'evidence' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <EvidenceGraphView
                datasetId={processedDatasetId}
                datasetName={decisionData?.dataset_name || 'Decision Dataset'}
                initialDecisionId={primary?.recommendation_id}
              />
            </motion.div>
      ) : decisionViewMode === 'outcomes' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionOutcomeView
            decisionId={primary?.recommendation_id || decisionData?.evidence_chain?.recommendation_id || ''}
            datasetId={processedDatasetId}
            datasetName={decisionData?.dataset_name}
          />
        </motion.div>
      ) : decisionViewMode === 'performance' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionPerformanceView
            projectId={projectId}
            onSelectDecision={() => setDecisionViewMode('details')}
          />
        </motion.div>
      ) : decisionViewMode === 'learning_signals' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionLearningSignalsView
            projectId={projectId}
            onSelectDecision={() => setDecisionViewMode('details')}
          />
        </motion.div>
      ) : decisionViewMode === 'governance' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionGovernanceView
            decisionId={primary?.recommendation_id || decisionData?.evidence_chain?.recommendation_id || ''}
            datasetId={processedDatasetId}
            projectId={projectId}
            datasetName={decisionData?.dataset_name}
            onSelectTab={(tab) => setDecisionViewMode(tab as any)}
          />
        </motion.div>
      ) : decisionViewMode === 'execution' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionExecutionView
            decisionId={primary?.recommendation_id || decisionData?.evidence_chain?.recommendation_id || ''}
            projectId={projectId}
            datasetName={decisionData?.dataset_name}
            onOpenOutcomeMonitor={() => setDecisionViewMode('outcomes')}
          />
        </motion.div>
      ) : decisionViewMode === 'report' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionReportView
            decisionId={primary?.recommendation_id || decisionData?.evidence_chain?.recommendation_id || ''}
            projectId={projectId}
            datasetName={decisionData?.dataset_name}
          />
        </motion.div>
      ) : decisionViewMode === 'knowledge' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <DecisionKnowledgeView
            projectId={projectId || ''}
            decisionId={primary?.recommendation_id || decisionData?.evidence_chain?.recommendation_id || ''}
            datasetId={processedDatasetId}
            title={`Decision Operating Memory • ${primary?.title || primary?.recommendation_id || 'Decision'}`}
          />
        </motion.div>
      ) : (
        /* Core Decision Details View */
        <>
          {/* ============================================================== */}
          {/* 3. CURRENT DECISION FOCUS BANNER                               */}
          {/* ============================================================== */}
          {primary && (
            <motion.section 
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitionCurve, delay: 0.12 }}
              className="bg-[#030914] border border-[rgba(120,190,230,0.16)] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.8)] shrink-0" />
                <div>
                  <span className="text-[10.5px] font-mono uppercase text-[#8795A8] tracking-wider block font-semibold">
                    CURRENT DECISION IN FOCUS
                  </span>
                  <h3 className="text-sm sm:text-[15px] font-sans font-bold text-white tracking-tight">
                    {primary.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                  {decisionData?.snapshot?.decision_status 
                    ? decisionData.snapshot.decision_status.replace(/_/g, ' ') 
                    : 'HUMAN REVIEW REQUIRED'}
                </span>
              </div>
            </motion.section>
          )}

          {/* ============================================================== */}
          {/* 4. MAIN DECISION WORKSPACE (55% Left | 45% Right)              */}
          {/* ============================================================== */}
          {decisionData && primary ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ------------------------------------------------------------ */}
              {/* LEFT: DECISION IMPACT (55% Width = 7 cols)                   */}
              {/* ------------------------------------------------------------ */}
              <motion.div 
                initial={{ opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...transitionCurve, delay: 0.16 }}
                className="lg:col-span-7 bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.22)] space-y-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(120,190,230,0.12)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                      <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                        DECISION IMPACT
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-[#8795A8]">
                      Confidence: <strong className="text-cyan-400">{primary.confidence}</strong> · Target: <strong className="text-white">{primary.target_metric}</strong>
                    </span>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                    PROVENANCE VERIFIED
                  </span>
                </div>

                {/* Primary Decision Title */}
                <div>
                  <h3 className="text-xl sm:text-[24px] font-sans font-bold text-white tracking-tight leading-snug">
                    {primary.title}
                  </h3>
                </div>

                {/* Metric Composition Quartet with Circular Arc SVG */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="h-[92px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                    <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                      Baseline
                    </span>
                    <span className="text-[24px] sm:text-[28px] font-mono font-bold text-slate-300 leading-none">
                      {primary.baseline_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="h-[92px] bg-[#020711] border border-cyan-400/40 rounded-xl p-3.5 flex flex-col justify-between text-center shadow-[inset_0_0_20px_rgba(57,214,245,0.08)]">
                    <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                      Projected
                    </span>
                    <span className="text-[24px] sm:text-[28px] font-mono font-bold text-white leading-none">
                      {primary.projected_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="h-[92px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                    <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                      Impact (Δ)
                    </span>
                    <span className={`text-[24px] sm:text-[28px] font-mono font-bold leading-none ${
                      primary.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {primary.absolute_delta >= 0 ? '+' : ''}{primary.absolute_delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Relative Shift with signature animated circular SVG stroke */}
                  <div className="h-[92px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3 flex items-center justify-between relative overflow-hidden">
                    <div className="text-left">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#8795A8] block">
                        Shift
                      </span>
                      <span className={`text-[22px] sm:text-[24px] font-mono font-bold leading-none ${
                        primary.percentage_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {primary.percentage_delta >= 0 ? '+' : ''}{primary.percentage_delta}%
                      </span>
                    </div>

                    {/* Signature Circular Stroke Arc */}
                    <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="18" stroke="rgba(120,190,230,0.15)" strokeWidth="3.5" fill="none" />
                        <motion.circle
                          cx="24"
                          cy="24"
                          r="18"
                          stroke="url(#decisionArcGrad)"
                          strokeWidth="3.5"
                          fill="none"
                          strokeDasharray={2 * Math.PI * 18}
                          initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
                          animate={{ strokeDashoffset: 0 }}
                          transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="decisionArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#35D399" />
                            <stop offset="100%" stopColor="#39D6F5" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <Zap className="w-3.5 h-3.5 text-cyan-400 absolute" />
                    </div>
                  </div>
                </div>

                {/* Animated SVG Impact Comparison Bars */}
                <div className="bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8795A8] uppercase tracking-wider font-semibold">
                      DECISION IMPACT COMPARISON
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Baseline
                      </span>
                      <span className="flex items-center gap-1.5 text-violet-400 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Projected
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Baseline Bar */}
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-xs font-mono font-semibold text-[#8795A8]">Baseline</span>
                      <div className="flex-1 bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${Math.min(100, Math.max(15, (primary.baseline_value / Math.max(primary.baseline_value, primary.projected_value)) * 100))}%` 
                          }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(57,214,245,0.6)]"
                        />
                      </div>
                      <span className="w-24 text-right text-sm font-mono text-cyan-300 font-bold">
                        {primary.baseline_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Projected Bar */}
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-xs font-mono font-semibold text-[#8795A8]">Projected</span>
                      <div className="flex-1 bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${Math.min(100, Math.max(15, (primary.projected_value / Math.max(primary.baseline_value, primary.projected_value)) * 100))}%` 
                          }}
                          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full shadow-[0_0_10px_rgba(155,123,255,0.6)]"
                        />
                      </div>
                      <span className="w-24 text-right text-sm font-mono text-violet-300 font-bold">
                        {primary.projected_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Selected Scenario Transformation Visual */}
                {decisionData.comparison && decisionData.comparison.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#8795A8] block font-semibold">
                      SELECTED SCENARIO PARAMETERS
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {decisionData.comparison.map((cmp, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-[#020711] p-3 rounded-xl border border-[rgba(120,190,230,0.14)] font-mono text-xs">
                          <span className="text-[#8795A8] truncate pr-2 font-medium">{cmp.feature}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-slate-500">{String(cmp.baseline_value)}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-bold text-white">{String(cmp.proposed_value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* ------------------------------------------------------------ */}
              {/* RIGHT: FINALIZE DECISION (45% Width = 5 cols)                */}
              {/* ------------------------------------------------------------ */}
              <motion.div 
                initial={{ opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...transitionCurve, delay: 0.22 }}
                className="lg:col-span-5 bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.22)] space-y-6"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                    <h3 className="text-[18px] font-sans font-bold text-white tracking-wide">
                      FINALIZE DECISION
                    </h3>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#8795A8] font-sans leading-relaxed">
                    Record the selected scenario and rationale before moving into governance and constraints.
                  </p>
                </div>

                {outcomeSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs font-mono text-emerald-300 flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Decision outcome formalized and recorded successfully.</span>
                  </div>
                )}

                <form onSubmit={handleFormalizeDecision} className="space-y-4 bg-[#020711] p-4 sm:p-5 rounded-xl border border-[rgba(120,190,230,0.14)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs text-[#8795A8] font-mono uppercase font-semibold block mb-1.5">
                        Target Metric
                      </label>
                      <input
                        type="text"
                        value={actualMetric}
                        onChange={(e) => setActualMetric(e.target.value)}
                        required
                        className="w-full h-11 bg-[#07111F] border border-[rgba(120,190,230,0.2)] text-sm text-white rounded-xl px-3.5 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-[#8795A8] font-mono uppercase font-semibold block mb-1.5">
                        Expected Value
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={actualValue}
                        onChange={(e) => setActualValue(e.target.value)}
                        required
                        className="w-full h-11 bg-[#07111F] border border-[rgba(120,190,230,0.2)] text-sm text-white rounded-xl px-3.5 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#8795A8] font-mono uppercase font-semibold block mb-1.5">
                      Decision Rationale / Notes
                    </label>
                    <textarea
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      rows={3}
                      placeholder="Context for finalizing this scenario..."
                      className="w-full bg-[#07111F] border border-[rgba(120,190,230,0.2)] text-sm text-[#F4F7FB] rounded-xl p-3.5 focus:outline-none focus:border-cyan-400 font-sans transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={formalizing}
                    className="w-full h-[48px] flex items-center justify-center gap-2.5 px-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-[13.5px] uppercase tracking-wider font-mono font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
                  >
                    {formalizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>RECORDING DECISION...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>FINALIZE DECISION</span>
                      </>
                    )}
                  </button>
                </form>

                {/* AI Executive Brief Module */}
                <div className="pt-2 border-t border-[rgba(120,190,230,0.12)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> AI EXECUTIVE BRIEF
                      </h4>
                      <p className="text-[11px] text-[#8795A8] font-sans">
                        Generate a concise evidence-backed summary of this decision.
                      </p>
                    </div>
                    {brief && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                        Available
                      </span>
                    )}
                  </div>

                  {!brief ? (
                    <button
                      onClick={handleGenerateBrief}
                      disabled={generatingBrief}
                      className="w-full h-11 flex items-center justify-center gap-2 px-5 bg-[#020711] hover:bg-[#030c1d] border border-[rgba(120,190,230,0.2)] disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-semibold uppercase tracking-wider transition-colors"
                    >
                      {generatingBrief ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>SYNTHESIZING BRIEF...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>GENERATE DECISION BRIEF</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="bg-[#020711] p-4 rounded-xl border border-cyan-400/30 space-y-3">
                      <p className="text-xs sm:text-[13px] font-sans text-[#F4F7FB] leading-relaxed">
                        {brief.executive_summary}
                      </p>
                      <div className="text-[11px] font-mono text-[#8795A8] flex justify-between border-t border-[rgba(120,190,230,0.08)] pt-2">
                        <span>Model: <strong className="text-slate-300">{brief.model_name}</strong></span>
                        <span>Validation: <strong className="text-emerald-400">{brief.validation_status}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          ) : (
            !loading && !error && (
              <div className="p-8 bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl text-center space-y-2">
                <p className="text-sm font-sans text-[#8795A8]">
                  No primary decision context found. Ensure recommendations have been generated.
                </p>
              </div>
            )
          )}

          {/* ============================================================== */}
          {/* 5. DECISION EVIDENCE PATH (Provenanced Chain)                   */}
          {/* ============================================================== */}
          {decisionData?.evidence_chain && decisionData.evidence_chain.nodes.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...transitionCurve, delay: 0.28 }}
              className="bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[rgba(120,190,230,0.12)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                  <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                    DECISION EVIDENCE PATH
                  </h2>
                </div>

                <button
                  onClick={() => setDecisionViewMode('evidence')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition-all w-fit"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>EXPLORE MULTI-HOP EVIDENCE GRAPH ↗</span>
                </button>
              </div>

              {/* Connected horizontal evidence cards */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {decisionData.evidence_chain.nodes.map((node, idx) => (
                  <div key={node.node_id + idx} className="flex items-center shrink-0">
                    <div className="bg-[#020711] border border-[rgba(120,190,230,0.14)] hover:border-cyan-400/40 rounded-xl p-4 min-w-[200px] max-w-[240px] space-y-2 transition-all hover:-translate-y-1 hover:shadow-lg">
                      <div className="flex justify-between items-center">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-mono text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900 text-slate-400 uppercase border border-slate-800 tracking-wider">
                          {node.node_type}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-[13px] font-sans font-bold text-white line-clamp-1">
                        {node.title}
                      </h4>
                      <p className="text-[11px] text-[#8795A8] font-sans leading-relaxed line-clamp-2">
                        {node.description}
                      </p>
                    </div>

                    {idx < decisionData.evidence_chain!.nodes.length - 1 && (
                      <div className="px-3 flex items-center text-cyan-400/50">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ============================================================== */}
          {/* 6. DECISION LIFECYCLE & READINESS INDICATOR                    */}
          {/* ============================================================== */}
          <motion.section 
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...transitionCurve, delay: 0.35 }}
            className="bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6 sm:gap-10">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5" /> DECISION LIFECYCLE
                </span>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Evidence
                  </span>
                  <span className="text-[#8795A8]">→</span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Governance
                  </span>
                  <span className="text-[#8795A8]">→</span>
                  <span className="flex items-center gap-1.5 text-cyan-400 animate-pulse">
                    <Activity className="w-3.5 h-3.5" /> Execution Ready
                  </span>
                  <span className="text-[#8795A8]">→</span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    Outcome
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start lg:self-center text-xs font-mono text-[#8795A8]">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold uppercase">
                  {decisionData?.snapshot?.decision_status?.replace(/_/g, ' ') || 'VERIFIED'}
                </span>
              </div>
            </div>
          </motion.section>
        </>
      )}
        </motion.div>
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 7. FINAL HANDOFF — CONTINUE TO GUARDRAILS                      */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...transitionCurve, delay: 0.42 }}
        className="bg-gradient-to-r from-[rgba(8,17,31,0.95)] via-[rgba(12,24,44,0.9)] to-[rgba(8,17,31,0.95)] border border-[rgba(120,190,230,0.2)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> NEXT STAGE: GUARDRAILS & CONTROL
            </span>
            <p className="text-sm font-sans text-[#B8C4D4] leading-relaxed">
              Decision formalization complete. Continue to validate constraints and governance conditions.
            </p>
          </div>

          <div className="shrink-0 flex items-center justify-end">
            <button
              onClick={() => setCurrentStage('GUARDRAILS')}
              disabled={!decisionData}
              className="group w-full sm:w-auto h-[48px] px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-[13.5px] font-mono font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5"
            >
              <span>CONTINUE TO GUARDRAILS</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
