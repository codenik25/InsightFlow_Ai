import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  AlertTriangle, 
  Play, 
  RefreshCw,
  Info,
  Scale,
  ArrowRight,
  ShieldCheck,
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
  GitCommit
} from 'lucide-react';
import {
  DecisionRecommendation,
  RecommendationResponse,
} from '../types';
import {
  generateRecommendations,
  fetchRecommendations,
} from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DataRecommendationsProps {
  processedDatasetId: string | null;
  optimizationId?: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataRecommendations: React.FC<DataRecommendationsProps> = ({ 
  processedDatasetId, 
  optimizationId, 
  setCurrentStage 
}) => {
  const [recommendations, setRecommendations] = useState<DecisionRecommendation[]>([]);
  const [recResponse, setRecResponse] = useState<RecommendationResponse | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState<boolean>(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Active selected recommendation index
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  // Accordion state for operational trade-offs
  const [isTradeoffsOpen, setIsTradeoffsOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!processedDatasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setRecError(null);
    try {
      const storedRecs = await fetchRecommendations(processedDatasetId);
      const recList = Array.isArray(storedRecs) 
        ? storedRecs 
        : ((storedRecs as any)?.recommendations || []);
      setRecommendations(recList);
      if (recList.length > 0) {
        setSelectedRecId(recList[0].id);
      }
    } catch (err: any) {
      console.warn('Unable to load existing recommendations, or none exist.', err);
    } finally {
      setLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateRecommendations = async () => {
    if (!processedDatasetId) return;
    setGeneratingRecs(true);
    setRecError(null);
    try {
      const res = await generateRecommendations(processedDatasetId, optimizationId || undefined, 5);
      setRecResponse(res);
      const recList = res.recommendations || [];
      setRecommendations(recList);
      if (recList.length > 0) {
        setSelectedRecId(recList[0].id);
      }
    } catch (err: any) {
      setRecError(err.message || 'Failed to generate recommendations');
    } finally {
      setGeneratingRecs(false);
    }
  };

  const safeRecommendations: DecisionRecommendation[] = useMemo(() => {
    return Array.isArray(recommendations) 
      ? recommendations 
      : ((recommendations as any)?.recommendations || []);
  }, [recommendations]);

  // Primary active recommendation
  const activeRec: DecisionRecommendation | null = useMemo(() => {
    if (safeRecommendations.length === 0) return null;
    return safeRecommendations.find(r => r.id === selectedRecId) || safeRecommendations[0];
  }, [safeRecommendations, selectedRecId]);

  // Top recommendation for summary stats
  const topRec: DecisionRecommendation | null = useMemo(() => {
    return safeRecommendations[0] || null;
  }, [safeRecommendations]);

  // Easing transition configuration
  const transitionCurve: any = { duration: 0.55, ease: [0.22, 1, 0.36, 1] };

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-10 max-w-xl mx-auto space-y-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <Target className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-sans font-semibold text-white tracking-tight">NO PROCESSED DATASET</h3>
        <p className="text-[#8795A8] font-sans text-sm max-w-md leading-relaxed">
          Action recommendations require a verified processed dataset artifact from the Optimization stage.
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
        mode="recommendations"
        isLoading={loading}
        isFullScreen={false}
        minHeight="540px"
        error={recError}
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="relative w-full max-w-[1550px] mx-auto space-y-6 min-w-0 select-none pb-12">
      {/* Background Subtle Data Flow Waveform */}
      <div className="absolute -top-10 -left-10 -right-10 h-[380px] pointer-events-none overflow-hidden opacity-25 -z-10">
        <svg className="w-full h-full text-cyan-500/20" preserveAspectRatio="none" viewBox="0 0 1400 300">
          <path d="M 0,70 Q 350,15 700,85 T 1400,45" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <path d="M 0,150 Q 400,60 800,160 T 1400,80" fill="none" stroke="rgba(155, 123, 255, 0.25)" strokeWidth="1.5" />
          <circle r="3.5" fill="#39D6F5" opacity="0.85">
            <animateMotion dur="12s" repeatCount="indefinite" path="M 0,150 Q 400,60 800,160 T 1400,80" />
          </circle>
        </svg>
      </div>

      {/* ============================================================== */}
      {/* 1. HERO — RECOMMENDATION INTELLIGENCE                          */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transitionCurve}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-[rgba(120,190,230,0.14)]"
      >
        <div className="space-y-2 relative">
          {/* Subtle radial glow behind INTELLIGENCE */}
          <div className="absolute top-6 left-64 w-72 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              DECISION ENGINE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-[#8795A8] bg-[#07111F]/70 border border-[rgba(120,190,230,0.12)]">
              Stage 08
            </span>
          </div>

          <h1 className="text-4xl sm:text-[48px] lg:text-[50px] font-sans font-semibold tracking-tight text-white leading-tight">
            RECOMMENDATION{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 font-semibold">
              INTELLIGENCE
            </span>
          </h1>

          <p className="text-[#B8C4D4] font-sans text-[15px] sm:text-[16px] max-w-2xl leading-[1.6]">
            Evidence-backed actions derived from optimization scenarios and verified analytical signals.
          </p>
        </div>

        {/* Hero Metadata & Decision Flow Signal */}
        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] text-xs font-mono shadow-sm">
              <span className="text-[#8795A8] uppercase tracking-wider font-semibold text-[11px]">DATASET</span>
              <span className="text-cyan-400 font-semibold truncate max-w-[130px]" title={processedDatasetId}>
                {processedDatasetId.substring(0, 12)}...
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] text-xs font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <span className="font-semibold">OPTIMIZATION READY</span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#07111F] border border-[rgba(120,190,230,0.15)] text-xs font-mono text-white">
              <span className="font-bold text-cyan-400">{safeRecommendations.length}</span> ACTIONS PRIORITIZED
            </div>
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
      {recError && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="text-sm">{recError}</span>
          </div>
          <button 
            onClick={loadData} 
            className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800 rounded-lg uppercase text-xs tracking-wider transition-colors shrink-0"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Warning Banner */}
      {recResponse && recResponse.warning && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs font-mono text-amber-300 flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="text-sm">{recResponse.warning}</span>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 2. DECISION SUMMARY STRIP                                      */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...transitionCurve, delay: 0.08 }}
        className="bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
          {/* Summary KPIs */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-10 flex-1">
            <div className="pr-6 border-r border-[rgba(120,190,230,0.12)]">
              <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> RECOMMENDATION SUMMARY
              </span>
              <span className="text-sm font-sans text-white font-semibold">Prioritized Action Synthesis</span>
            </div>

            <div>
              <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">CANDIDATES</span>
              <span className="text-lg font-mono font-bold text-white">
                {safeRecommendations.length} Actions
              </span>
            </div>

            {topRec && (
              <>
                <div>
                  <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">PROJECTED DELTA</span>
                  <span className={`text-lg font-mono font-bold ${
                    (topRec.absolute_delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(topRec.absolute_delta ?? 0) > 0 ? '+' : ''}
                    {topRec.absolute_delta?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">RELATIVE SHIFT</span>
                  <span className={`text-lg font-mono font-bold ${
                    (topRec.percentage_delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(topRec.percentage_delta ?? 0) > 0 ? '+' : ''}
                    {topRec.percentage_delta ?? 'N/A'}%
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">TARGET METRIC</span>
                  <span className="text-lg font-mono font-bold text-cyan-400 uppercase">
                    {topRec.target_metric}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action Trigger */}
          <div className="shrink-0 flex items-center justify-end">
            <button
              onClick={handleGenerateRecommendations}
              disabled={generatingRecs}
              className="relative group overflow-hidden w-full lg:w-auto h-[46px] flex items-center justify-center gap-2.5 px-7 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-[13px] uppercase tracking-wider font-mono font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

              {generatingRecs ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>SYNTHESIZING ACTIONS...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-white" />
                  <span>{safeRecommendations.length > 0 ? 'REFRESH RECOMMENDATIONS' : 'GENERATE RECOMMENDATIONS'} →</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.section>

      {/* In-Flight Indeterminate Loading Animation */}
      <AnimatePresence>
        {generatingRecs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-[#081326] border border-cyan-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
              <div>
                <span className="text-cyan-400 font-bold uppercase tracking-wide block">GENERATING RECOMMENDATIONS</span>
                <p className="text-[#8795A8] text-[11.5px]">Synthesizing optimal parameters against verified scenario evidence...</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-[#8795A8] shrink-0">
              <span className="text-cyan-400 font-bold">OPTIMIZATION</span>
              <span>→</span>
              <span className="text-blue-400 font-bold">RATIONALE</span>
              <span>→</span>
              <span className="text-violet-400 font-bold animate-pulse">ACTION</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 3. PRIORITIZED RECOMMENDATION BOARD (Left 40% | Right 60%)     */}
      {/* ============================================================== */}
      {safeRecommendations.length === 0 ? (
        /* Empty State */
        <motion.section 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-12 text-center backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 mx-auto">
            <Target className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-xl font-sans font-bold text-white tracking-tight">NO RECOMMENDATIONS YET</h3>
            <p className="text-sm font-sans text-[#8795A8] leading-relaxed">
              Run the recommendation engine to synthesize actionable decision candidates from the verified optimization scenarios.
            </p>
          </div>
          <button
            onClick={handleGenerateRecommendations}
            disabled={generatingRecs}
            className="h-11 px-7 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 inline-flex items-center gap-2"
          >
            <span>GENERATE RECOMMENDATIONS →</span>
          </button>
        </motion.section>
      ) : (
        /* Two-Column Interactive Board */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ------------------------------------------------------------ */}
          {/* LEFT: RECOMMENDATION INDEX (40% Width = 5 cols)              */}
          {/* ------------------------------------------------------------ */}
          <motion.div 
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...transitionCurve, delay: 0.16 }}
            className="lg:col-span-5 bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-3.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(120,190,230,0.12)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                <h2 className="text-[17px] font-sans font-bold text-white tracking-wide">
                  RECOMMENDATION INDEX
                </h2>
              </div>
              <span className="text-xs font-mono text-[#8795A8]">
                {safeRecommendations.length} Prioritized
              </span>
            </div>

            {/* List of compact interactive recommendation cards (74-84px tall) */}
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
              {safeRecommendations.map((rec) => {
                const isSelected = activeRec?.id === rec.id;
                const isPositive = (rec.absolute_delta ?? 0) >= 0;

                const confBadge = rec.confidence === 'STRONG'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : rec.confidence === 'MODERATE'
                  ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

                return (
                  <button
                    key={rec.id}
                    onClick={() => setSelectedRecId(rec.id)}
                    type="button"
                    className={`w-full min-h-[76px] p-3.5 rounded-xl border text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between gap-1.5 group ${
                      isSelected 
                        ? 'bg-[#030d20] border-cyan-400/50 shadow-md shadow-cyan-500/10 translate-x-1' 
                        : 'bg-[#020711]/80 border-[rgba(120,190,230,0.12)] hover:border-cyan-400/30 hover:bg-[#030c1d] hover:translate-x-1'
                    }`}
                  >
                    {/* Active vertical accent line */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(57,214,245,0.8)]" />
                    )}

                    {/* Top Row: Priority + Badges */}
                    <div className="flex items-center justify-between gap-2 pl-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                          isSelected 
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                            : 'bg-slate-800 text-slate-300 group-hover:text-cyan-300'
                        }`}>
                          #{rec.priority < 10 ? `0${rec.priority}` : rec.priority}
                        </span>

                        <span className="text-[10.5px] font-mono text-[#8795A8] uppercase tracking-wider truncate max-w-[140px]">
                          {rec.recommendation_type || 'ACTION'}
                        </span>
                      </div>

                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wider ${confBadge}`}>
                        {rec.confidence || 'MODERATE'}
                      </span>
                    </div>

                    {/* Middle: Title */}
                    <div className="pl-1">
                      <h4 className={`text-[13.5px] font-sans font-semibold leading-tight line-clamp-1 ${
                        isSelected ? 'text-white' : 'text-[#B8C4D4] group-hover:text-white'
                      }`}>
                        {rec.title}
                      </h4>
                    </div>

                    {/* Bottom: Delta & Shift */}
                    <div className="flex items-center justify-between text-xs font-mono pl-1 pt-1 border-t border-[rgba(120,190,230,0.08)]">
                      <span className="text-[#8795A8] text-[11px]">
                        Target: <strong className="text-slate-300">{rec.target_metric}</strong>
                      </span>
                      <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{rec.absolute_delta?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'N/A'}{' '}
                        <span className="text-[10.5px] opacity-80">
                          ({(rec.percentage_delta ?? 0) > 0 ? '+' : ''}{rec.percentage_delta ?? 'N/A'}%)
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ------------------------------------------------------------ */}
          {/* RIGHT: PRIMARY RECOMMENDATION WORKSPACE (60% Width = 7 cols) */}
          {/* ------------------------------------------------------------ */}
          <motion.div 
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...transitionCurve, delay: 0.22 }}
            className="lg:col-span-7 bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.22)] relative overflow-hidden"
          >
            {/* Ambient atmospheric glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

            {activeRec && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeRec.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6 relative z-10"
                >
                  {/* Header Strip with Priority and Confidence */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(120,190,230,0.12)]">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          PRIORITY #{activeRec.priority} RECOMMENDATION
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono text-[#8795A8] bg-[#020711] border border-[rgba(120,190,230,0.14)] uppercase">
                          {activeRec.recommendation_type || 'ACTION'}
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-[22px] font-sans font-bold text-white tracking-tight leading-tight">
                        {activeRec.title}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono uppercase text-[#8795A8] tracking-wider block font-semibold">
                        TARGET METRIC
                      </span>
                      <span className="text-sm font-mono font-bold text-cyan-400 uppercase">
                        {activeRec.target_metric}
                      </span>
                    </div>
                  </div>

                  {/* Primary Projected Impact Values */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Baseline */}
                    <div className="h-[90px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                      <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                        Baseline
                      </span>
                      <span className="text-[24px] sm:text-[28px] font-mono font-bold text-slate-300 leading-none">
                        {activeRec.baseline_value?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'N/A'}
                      </span>
                    </div>

                    {/* Projected */}
                    <div className="h-[90px] bg-[#020711] border border-cyan-400/40 rounded-xl p-3.5 flex flex-col justify-between text-center shadow-[inset_0_0_20px_rgba(57,214,245,0.08)]">
                      <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                        Projected
                      </span>
                      <span className="text-[24px] sm:text-[28px] font-mono font-bold text-white leading-none">
                        {activeRec.projected_value?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'N/A'}
                      </span>
                    </div>

                    {/* Projected Delta */}
                    <div className="h-[90px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                      <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                        Projected Delta
                      </span>
                      <span className={`text-[24px] sm:text-[28px] font-mono font-bold leading-none ${
                        (activeRec.absolute_delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(activeRec.absolute_delta ?? 0) > 0 ? '+' : ''}
                        {activeRec.absolute_delta?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'N/A'}
                      </span>
                    </div>

                    {/* Relative Shift */}
                    <div className="h-[90px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                      <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                        Relative Shift
                      </span>
                      <span className={`text-[24px] sm:text-[28px] font-mono font-bold leading-none ${
                        (activeRec.percentage_delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(activeRec.percentage_delta ?? 0) > 0 ? '+' : ''}
                        {activeRec.percentage_delta ?? 'N/A'}%
                      </span>
                    </div>
                  </div>

                  {/* Impact Visualization: Animated SVG Comparison Bars */}
                  <div className="bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#8795A8] uppercase tracking-wider font-semibold">
                        PROJECTED IMPACT VISUALIZATION
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

                    {/* Comparative Bars */}
                    <div className="space-y-3">
                      {/* Baseline */}
                      <div className="flex items-center gap-3">
                        <span className="w-20 text-xs font-mono font-semibold text-[#8795A8]">Baseline</span>
                        <div className="flex-1 bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: `${Math.min(100, Math.max(15, ((activeRec.baseline_value || 1) / Math.max(activeRec.baseline_value || 1, activeRec.projected_value || 1)) * 100))}%` 
                            }}
                            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(57,214,245,0.6)]"
                          />
                        </div>
                        <span className="w-24 text-right text-sm font-mono text-cyan-300 font-bold">
                          {activeRec.baseline_value?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'N/A'}
                        </span>
                      </div>

                      {/* Projected */}
                      <div className="flex items-center gap-3">
                        <span className="w-20 text-xs font-mono font-semibold text-[#8795A8]">Projected</span>
                        <div className="flex-1 bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: `${Math.min(100, Math.max(15, ((activeRec.projected_value || 1) / Math.max(activeRec.baseline_value || 1, activeRec.projected_value || 1)) * 100))}%` 
                            }}
                            transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full shadow-[0_0_10px_rgba(155,123,255,0.6)]"
                          />
                        </div>
                        <span className="w-24 text-right text-sm font-mono text-violet-300 font-bold">
                          {activeRec.projected_value?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parameter Adjustments (Changed Features) */}
                  {activeRec.changed_features && Object.keys(activeRec.changed_features).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-[#8795A8] block font-semibold">
                        ACTIONABLE PARAMETER ADJUSTMENTS
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {Object.entries(activeRec.changed_features).map(([k, v]) => (
                          <span 
                            key={k} 
                            className="bg-[#020711] border border-[rgba(120,190,230,0.2)] px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs sm:text-[13px] font-mono shadow-sm"
                          >
                            <span className="text-[#8795A8]">{k}:</span>
                            <span className="text-white font-bold">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WHY THIS ACTION / Rationale */}
                  <div className="bg-[#020711] rounded-xl border border-[rgba(120,190,230,0.14)] p-4 sm:p-5 flex items-start gap-3.5">
                    <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <span className="block text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">
                        WHY THIS ACTION
                      </span>
                      <p className="text-[14.5px] text-[#F4F7FB] font-sans leading-[1.6] max-w-[700px]">
                        {activeRec.rationale}
                      </p>
                    </div>
                  </div>

                  {/* TRADE-OFFS & CONSTRAINTS (Expandable Accordion) */}
                  {activeRec.tradeoffs && (
                    <div className="bg-[#020711] rounded-xl border border-[rgba(120,190,230,0.14)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsTradeoffsOpen(!isTradeoffsOpen)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-[#030c1d] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Scale className="w-4 h-4 text-violet-400" />
                          <span className="text-xs sm:text-[13px] font-mono font-bold uppercase tracking-wider text-slate-200">
                            TRADE-OFFS & OPERATIONAL CONSTRAINTS
                          </span>
                        </div>
                        <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                          {isTradeoffsOpen ? 'Hide Details' : 'View Considerations'}
                          {isTradeoffsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      <AnimatePresence>
                        {isTradeoffsOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="px-4 pb-4 pt-1 border-t border-[rgba(120,190,230,0.08)]"
                          >
                            <p className="text-sm font-sans text-[#B8C4D4] leading-relaxed">
                              {activeRec.tradeoffs}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* EVIDENCE PROVENANCE RAIL */}
                  {activeRec.evidence && (
                    <div className="p-4 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.12)] space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <GitCommit className="w-3.5 h-3.5 text-cyan-400" /> EVIDENCE PROVENANCE
                        </span>
                        <span className="text-[#8795A8] text-[11px]">Traceable lineage</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="p-2.5 rounded-lg bg-[#07111F] border border-[rgba(120,190,230,0.1)]">
                          <span className="block text-[10px] font-mono uppercase text-[#8795A8]">DATASET ID</span>
                          <span className="text-xs font-mono text-slate-300 truncate block" title={activeRec.evidence.dataset_id}>
                            {activeRec.evidence.dataset_id?.slice(0, 14) || 'N/A'}...
                          </span>
                        </div>

                        {activeRec.evidence.ml_analysis_id && (
                          <div className="p-2.5 rounded-lg bg-[#07111F] border border-[rgba(120,190,230,0.1)]">
                            <span className="block text-[10px] font-mono uppercase text-[#8795A8]">ML CONTEXT</span>
                            <span className="text-xs font-mono text-slate-300 truncate block" title={activeRec.evidence.ml_analysis_id}>
                              {activeRec.evidence.ml_analysis_id?.slice(0, 14) || 'N/A'}...
                            </span>
                          </div>
                        )}

                        {activeRec.evidence.optimization_id && (
                          <div className="p-2.5 rounded-lg bg-[#07111F] border border-[rgba(120,190,230,0.1)]">
                            <span className="block text-[10px] font-mono uppercase text-[#8795A8]">OPTIMIZATION CTX</span>
                            <span className="text-xs font-mono text-slate-300 truncate block" title={activeRec.evidence.optimization_id}>
                              {activeRec.evidence.optimization_id?.slice(0, 14) || 'N/A'}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. DECISION READY SUMMARY & DOCKED CONTINUE ACTION             */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...transitionCurve, delay: 0.35 }}
        className="bg-gradient-to-r from-[rgba(8,17,31,0.95)] via-[rgba(12,24,44,0.9)] to-[rgba(8,17,31,0.95)] border border-[rgba(120,190,230,0.2)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          {/* Executive Summary Metrics */}
          <div className="space-y-2.5 flex-1">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> DECISION READY
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pt-1">
              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">ACTIONS</span>
                <span className="text-sm font-mono font-bold text-white">
                  {safeRecommendations.length} Prioritized
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">TOP DELTA</span>
                <span className={`text-sm font-mono font-bold ${
                  (topRec?.absolute_delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {(topRec?.absolute_delta ?? 0) > 0 ? '+' : ''}
                  {topRec?.absolute_delta?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">TARGET</span>
                <span className="text-sm font-mono font-bold text-cyan-400">
                  {topRec?.target_metric || 'patient_visits'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">STATUS</span>
                <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  CONFIRMED
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Continue Action */}
          <div className="shrink-0 flex items-center justify-end">
            <button
              onClick={() => setCurrentStage('DECISIONS')}
              disabled={safeRecommendations.length === 0 || generatingRecs || !!recError}
              className="group w-full lg:w-auto h-[48px] px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-[13.5px] font-mono font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5"
            >
              <span>CONTINUE TO DECISIONS</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
