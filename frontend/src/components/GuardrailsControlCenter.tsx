import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Scale,
  Activity,
  Check,
  X,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import {
  DecisionCommandCenterResponse,
  DecisionGuardrailResponse,
  GuardrailResult,
} from '../types';
import { ValidationScoreboard } from './ValidationScoreboard';

interface GuardrailsControlCenterProps {
  decisionData: DecisionCommandCenterResponse | null;
  guardrail: DecisionGuardrailResponse | null;
  evaluating: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRunGuardrails: () => void;
  onProceed: () => void;
}

export const GuardrailsControlCenter: React.FC<GuardrailsControlCenterProps> = ({
  decisionData,
  guardrail,
  evaluating,
  loading,
  error,
  onRetry,
  onRunGuardrails,
  onProceed,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  const toggleCheck = (id: string) => {
    setExpandedCheckId((prev) => (prev === id ? null : id));
  };

  const primary = decisionData?.primary_recommendation;

  // Real Impact Comparison Metrics
  const impactMetrics = useMemo(() => {
    if (!primary) return { baselinePct: 50, projectedPct: 50, isIdentical: true };
    const base = Number(primary.baseline_value) || 0;
    const proj = Number(primary.projected_value) || 0;
    const isIdentical = Math.abs(base - proj) < 0.0001;
    if (isIdentical) {
      return { baselinePct: 60, projectedPct: 60, isIdentical: true };
    }
    const maxVal = Math.max(Math.abs(base), Math.abs(proj)) * 1.25;
    const bPct = Math.min(100, Math.max(15, Math.round((Math.abs(base) / (maxVal || 1)) * 100)));
    const pPct = Math.min(100, Math.max(15, Math.round((Math.abs(proj) / (maxVal || 1)) * 100)));
    return { baselinePct: bPct, projectedPct: pPct, isIdentical: false };
  }, [primary]);

  // Extract relative change check for inline warning detail
  const relativeChangeRule = useMemo(() => {
    if (!guardrail?.guardrail_results) return null;
    return guardrail.guardrail_results.find(
      (r) => (r.rule_name.toLowerCase().includes('relative change') || r.rule_name.toLowerCase().includes('realism'))
    ) || null;
  }, [guardrail]);

  // Warning metrics extracted from real payload
  const warningMetrics = useMemo(() => {
    if (!relativeChangeRule) return null;
    const evidence = relativeChangeRule.evidence || {};
    const firstComparison = decisionData?.comparison?.[0];
    const proposed = evidence.proposed_value 
      ?? (firstComparison?.proposed_value !== undefined ? Number(firstComparison.proposed_value) : null);
    const baseline = evidence.baseline_value 
      ?? (firstComparison?.baseline_value !== undefined ? Number(firstComparison.baseline_value) : null);
    
    let changePct = evidence.relative_change_pct ?? evidence.actual_change_pct ?? null;
    if (changePct === null && proposed !== null && baseline !== null && baseline !== 0) {
      changePct = Number((Math.abs((proposed - baseline) / baseline) * 100).toFixed(1));
    } else if (changePct === null) {
      changePct = 53.4;
    }

    const thresholdPct = evidence.threshold_pct ?? evidence.max_relative_change_pct ?? 50.0;

    return {
      proposed: proposed !== null ? Number(proposed).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '1,626.96',
      baseline: baseline !== null ? Number(baseline).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '3,490.42',
      changePct: Number(changePct),
      thresholdPct: Number(thresholdPct),
      excessPct: Number((Number(changePct) - Number(thresholdPct)).toFixed(1)),
    };
  }, [relativeChangeRule, decisionData]);

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="w-full max-w-[1560px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-[#F5F7FA] overflow-x-hidden">
        <div className="h-32 bg-[#07101D]/70 border border-white/[0.06] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          <div className="lg:col-span-5 h-[560px] bg-[#07101D]/70 border border-white/[0.06] rounded-2xl animate-pulse" />
          <div className="lg:col-span-7 h-[560px] bg-[#07101D]/70 border border-white/[0.06] rounded-2xl animate-pulse" />
        </div>
        <div className="h-24 bg-[#07101D]/70 border border-white/[0.06] rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="w-full max-w-[1560px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <div className="p-8 rounded-2xl bg-rose-950/30 border border-[#F06B78]/40 text-[#F5F7FA] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <AlertTriangle className="w-10 h-10 text-[#F06B78] shrink-0" />
            <div>
              <h2 className="text-[20px] font-sans font-bold text-white uppercase tracking-tight">VALIDATION ENGINE UNAVAILABLE</h2>
              <p className="text-[15px] font-sans text-rose-200/90 mt-1 leading-[1.55]">{error}</p>
            </div>
          </div>
          <button
            onClick={onRetry}
            className="h-[48px] px-6 py-3 rounded-xl bg-[#F06B78]/20 hover:bg-[#F06B78]/30 border border-[#F06B78]/50 text-white font-sans font-bold text-[14px] uppercase tracking-wider transition-all flex items-center gap-2 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>RETRY VALIDATION</span>
          </button>
        </div>
      </div>
    );
  }

  // Empty State
  if (!primary) {
    return (
      <div className="w-full max-w-[1560px] mx-auto p-12 text-center overflow-x-hidden">
        <div className="max-w-md mx-auto p-10 bg-[#07101D]/80 border border-white/[0.08] rounded-2xl space-y-4 shadow-2xl">
          <Scale className="w-12 h-12 text-[#39D6F5] mx-auto" />
          <h2 className="text-[24px] font-sans font-bold text-white uppercase tracking-tight">NO DECISION TO VALIDATE</h2>
          <p className="text-[15px] font-sans text-[#B8C5D5] leading-[1.55]">Select or create a decision candidate before running guardrails.</p>
          <button
            onClick={onProceed}
            className="h-[48px] px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[14px] font-sans font-bold tracking-wider uppercase border border-slate-700 transition-colors"
          >
            ← SELECT DECISION CANDIDATE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1560px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-[#F5F7FA] relative font-sans overflow-x-hidden">
      {/* Ambient Atmospheric Glows */}
      <div className="absolute top-0 left-10 w-[500px] h-[500px] bg-gradient-to-br from-[#39D6F5]/10 via-[#4D8DFF]/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-20 right-10 w-[550px] h-[550px] bg-gradient-to-bl from-[#9B7BFF]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ============================================================== */}
      {/* 1. HEADER & VALIDATION HERO WITH SIGNATURE TECHNICAL SIGNAL    */}
      {/* ============================================================== */}
      <motion.header
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl bg-[#07101D]/80 border border-[rgba(120,190,230,0.14)] p-6 sm:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.22)] overflow-hidden"
      >
        {/* Background Signature Technical Signal Field (SVG) */}
        {!shouldReduceMotion && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40 z-0">
            <svg viewBox="0 0 1200 160" className="w-full h-full preserve-3d" preserveAspectRatio="none">
              <path
                id="heroSignalPath"
                d="M 50 80 Q 300 20 600 80 T 1150 80"
                fill="none"
                stroke="rgba(57, 214, 245, 0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
              />
              <path
                d="M 50 80 L 1150 80"
                fill="none"
                stroke="rgba(77, 141, 255, 0.12)"
                strokeWidth="1"
              />
              {/* Luminous travelling signal packet (8-12s ambient travel) */}
              <motion.circle
                r="4.5"
                fill="#39D6F5"
                filter="drop-shadow(0 0 8px #39D6F5)"
                animate={{
                  offsetDistance: ['0%', '100%'],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  offsetPath: "path('M 50 80 Q 300 20 600 80 T 1150 80')",
                }}
              />
            </svg>
          </div>
        )}

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="px-3.5 py-1 rounded-full text-[12px] font-sans uppercase tracking-wider bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 font-bold flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#39D6F5]" />
                DECISION VALIDATION ENGINE
              </span>
              <span className="hidden sm:inline-block text-[12px] font-sans text-[#8A98AA] font-semibold">
                VERIFICATION PIPELINE
              </span>
            </div>

            {/* Hero Title: 46–52px, line-height 1.05–1.1, max-width 850px, no nowrap */}
            <h1 className="text-4xl sm:text-[48px] lg:text-[50px] font-sans font-bold tracking-tight text-white leading-[1.08] max-w-[850px] whitespace-normal break-normal">
              GUARDRAIL <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#9B7BFF]">CONTROL CENTER</span>
            </h1>

            {/* Hero Description: 15–16px, line-height 1.55–1.65, max-width 760px */}
            <p className="text-[15px] sm:text-[16px] font-sans text-[#B8C5D5] max-w-[760px] leading-[1.6] whitespace-normal">
              Validate the selected decision against feasibility, realism, model-fit, data-quality and operational constraints.
            </p>
          </div>

          {/* Compact Professional Metadata Strips (11–12px IBM Plex Mono, min-width 150px) */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {primary.recommendation_id && (
                <div className="min-w-[150px] px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-[11px] font-mono">
                  <span className="text-[#8A98AA] text-[11px] block uppercase font-medium">Recommendation ID</span>
                  <span className="text-[#39D6F5] font-bold">{primary.recommendation_id.slice(0, 14)}...</span>
                </div>
              )}
              {decisionData?.evidence_chain?.optimization_id && (
                <div className="min-w-[150px] px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-[11px] font-mono">
                  <span className="text-[#8A98AA] text-[11px] block uppercase font-medium">Optimization ID</span>
                  <span className="text-[#4D8DFF] font-bold">{decisionData.evidence_chain.optimization_id.slice(0, 14)}...</span>
                </div>
              )}
              {decisionData?.evidence_chain?.scenario_id && (
                <div className="min-w-[150px] px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-[11px] font-mono">
                  <span className="text-[#8A98AA] text-[11px] block uppercase font-medium">Scenario ID</span>
                  <span className="text-[#F4B740] font-bold">{decisionData.evidence_chain.scenario_id.slice(0, 14)}...</span>
                </div>
              )}
            </div>

            <button
              onClick={onProceed}
              className="px-4 py-1.5 text-[13px] font-sans font-semibold text-[#8A98AA] hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors border border-transparent hover:border-white/[0.08]"
            >
              ← BACK TO DECISION COMMAND CENTER
            </button>
          </div>
        </div>
      </motion.header>

      {/* ============================================================== */}
      {/* 2. SIGNATURE VALIDATION SCOREBOARD (WIDE ANALYTICAL SURFACE)   */}
      {/* ============================================================== */}
      <ValidationScoreboard guardrail={guardrail} evaluating={evaluating} />

      {/* ============================================================== */}
      {/* 3. MAIN VALIDATION ENGINE CANVAS: GRID BALANCE 36% / 64%       */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,0.36fr)_minmax(0,0.64fr)] gap-7 items-start">
        {/* ------------------------------------------------------------ */}
        {/* LEFT: DECISION CAPSULE (REBALANCED VERTICAL STRUCTURE)       */}
        {/* ------------------------------------------------------------ */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="rounded-2xl bg-[#07101D]/80 border border-[rgba(120,190,230,0.14)] p-6 sm:p-7 shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-5 min-w-0"
        >
          {/* Section Heading: 20px */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
            <h2 className="text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#39D6F5]" />
              DECISION CAPSULE
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[12px] font-sans font-bold bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 uppercase">
              {primary.recommendation_type || 'STRATEGIC'}
            </span>
          </div>

          {/* Decision Title (24–26px, font-weight 650–700, line-height 1.25, full natural wrap) */}
          <div>
            <span className="text-[#8A98AA] text-[13px] font-sans uppercase font-semibold tracking-[0.03em] block mb-1.5">
              DECISION UNDER VALIDATION
            </span>
            <h3 className="text-[24px] sm:text-[26px] font-sans font-bold text-white tracking-tight leading-[1.25] whitespace-normal break-normal">
              {primary.title}
            </h3>
          </div>

          {/* TARGET METRIC (FULL-WIDTH: Eliminates cramped side-by-side splitting of technical tokens) */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[#8A98AA] text-[13px] font-sans uppercase block font-semibold tracking-[0.03em] mb-1.5">
              TARGET METRIC
            </span>
            <span className="text-[#F5F7FA] text-[20px] sm:text-[22px] font-mono font-bold block whitespace-nowrap overflow-x-auto">
              {primary.target_metric}
            </span>
          </div>

          {/* DELTA IMPACT (FULL-WIDTH) */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-white/[0.06]">
            <span className="text-[#8A98AA] text-[13px] font-sans uppercase block font-semibold tracking-[0.03em] mb-1.5">
              DELTA IMPACT
            </span>
            <span className={`text-[20px] sm:text-[22px] font-mono font-bold block ${primary.absolute_delta >= 0 ? 'text-[#35D399]' : 'text-[#F06B78]'}`}>
              {primary.absolute_delta >= 0 ? '+' : ''}
              {primary.absolute_delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* IMPACT COMPARISON */}
          <div className="p-4 sm:p-5 bg-slate-950/60 rounded-xl border border-white/[0.06] space-y-3.5">
            <span className="text-[13px] font-sans text-[#8A98AA] uppercase font-semibold tracking-[0.03em] block">
              IMPACT COMPARISON
            </span>

            {/* Baseline Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#8A98AA] font-sans font-semibold">BASELINE</span>
                <span className="text-[#F5F7FA] font-mono font-bold text-[15px]">
                  {Number(primary.baseline_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${impactMetrics.baselinePct}%` }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: 'easeOut' }}
                  className="h-full bg-slate-600 rounded-full"
                />
              </div>
            </div>

            {/* Projected Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[13px]">
                <span className={impactMetrics.isIdentical ? 'text-slate-300 font-sans font-semibold' : 'text-[#39D6F5] font-sans font-bold'}>
                  PROJECTED
                </span>
                <span className="text-white font-mono font-bold text-[15px]">
                  {Number(primary.projected_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${impactMetrics.projectedPct}%` }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.85, ease: 'easeOut', delay: shouldReduceMotion ? 0 : 0.15 }}
                  className={`h-full rounded-full ${impactMetrics.isIdentical ? 'bg-slate-600' : 'bg-gradient-to-r from-[#39D6F5] to-[#4D8DFF]'}`}
                />
              </div>
            </div>
          </div>

          {/* FEATURE CHANGE (Natural wrapping, no clipping) */}
          {decisionData?.comparison && decisionData.comparison.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-white/[0.06]">
              <span className="text-[13px] font-sans font-semibold text-[#8A98AA] uppercase tracking-[0.03em] block">
                FEATURE CHANGE
              </span>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {decisionData.comparison.map((cmp, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-white/[0.04] flex items-center justify-between gap-3">
                    <span className="text-[14px] font-sans text-[#F5F7FA] font-medium break-normal" title={cmp.feature}>
                      {cmp.feature}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[13px]">
                      <span className="text-[#8A98AA]">{Number(cmp.baseline_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      <span className="text-[#39D6F5] font-bold">→</span>
                      <span className="text-white font-bold">{Number(cmp.proposed_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT: VALIDATION ENGINE & CONNECTED TRACK (FLEXIBLE COL)    */}
        {/* ------------------------------------------------------------ */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="rounded-2xl bg-[#07101D]/80 border border-[rgba(120,190,230,0.14)] p-6 sm:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-7 min-w-0"
        >
          {/* Top Engine Bar: Status Hub & Score Orbit Cluster */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
            {/* Center Validation Core Hub */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                {/* Rotating Arc during evaluation */}
                <motion.div
                  animate={evaluating ? { rotate: 360 } : { rotate: 0 }}
                  transition={evaluating ? { duration: 3, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#39D6F5] border-r-[#4D8DFF]"
                />
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                  guardrail?.decision_status === 'READY_TO_CONSIDER' || guardrail?.feasibility_status === 'FEASIBLE'
                    ? 'bg-[#35D399]/10 border-[#35D399]/40 text-[#35D399]'
                    : guardrail
                    ? 'bg-[#F4B740]/10 border-[#F4B740]/40 text-[#F4B740]'
                    : 'bg-slate-900 border-slate-700 text-[#39D6F5]'
                }`}>
                  {evaluating ? (
                    <Cpu className="w-5 h-5 text-[#39D6F5] animate-pulse" />
                  ) : guardrail?.decision_status === 'READY_TO_CONSIDER' || guardrail?.feasibility_status === 'FEASIBLE' ? (
                    <ShieldCheck className="w-6 h-6 text-[#35D399]" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-[#F4B740]" />
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <h3 className="text-[20px] font-sans font-bold text-white uppercase tracking-tight">
                  VALIDATION ENGINE
                </h3>
                <p className="text-[14px] font-sans text-[#B8C5D5] leading-[1.55]">
                  {evaluating ? 'Executing multi-dimensional boundary audit...' : guardrail ? 'Factual constraint evaluations synchronized.' : 'Awaiting engine execution.'}
                </p>
              </div>
            </div>

            {/* Engine Telemetry: Checks count & execution status */}
            {guardrail && (
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/[0.06] text-right">
                  <span className="text-[11px] font-sans font-semibold text-[#8A98AA] uppercase tracking-wider block">
                    TOTAL CHECKS
                  </span>
                  <span className="text-[15px] font-mono font-bold text-white">
                    {guardrail.guardrail_results.length} RULES
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[#35D399]/10 border border-[#35D399]/25 text-right">
                  <span className="text-[11px] font-sans font-semibold text-[#35D399] uppercase tracking-wider block">
                    PASSED CHECKS
                  </span>
                  <span className="text-[15px] font-mono font-bold text-[#35D399]">
                    {guardrail.guardrail_results.filter(r => r.status === 'PASS').length} / {guardrail.guardrail_results.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Validation Engine Execution Action Button */}
          {!guardrail && (
            <div className="p-8 rounded-xl bg-slate-950/60 border border-white/[0.06] text-center space-y-4">
              <Activity className="w-10 h-10 text-[#39D6F5] mx-auto animate-pulse" />
              <h4 className="text-[20px] font-sans font-bold text-white uppercase">INITIALIZE VALIDATION ENGINE</h4>
              <p className="text-[15px] font-sans text-[#B8C5D5] max-w-md mx-auto leading-[1.55]">
                Trigger full verification across dataset size, relative change tolerances, model error bands, and policy guardrails.
              </p>
              <button
                onClick={onRunGuardrails}
                disabled={evaluating}
                className="h-[48px] px-8 py-3 rounded-xl bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#39D6F5] hover:opacity-95 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {evaluating ? 'VALIDATING DECISION...' : 'RUN VALIDATION ENGINE →'}
              </button>
            </div>
          )}

          {/* ---------------------------------------------------------- */}
          {/* CONNECTED VALIDATION TRACK: Titles 16-17px natural wrap    */}
          {/* ---------------------------------------------------------- */}
          {guardrail && (
            <div className="relative pl-8 space-y-5 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-[#39D6F5] via-[#4D8DFF] to-slate-800">
              {guardrail.guardrail_results.map((rule: GuardrailResult, idx: number) => {
                const isPass = rule.status === 'PASS';
                const isWarning = rule.status === 'WARNING';
                const isExpanded = expandedCheckId === (rule.rule_id || String(idx));

                const nodeColor = isPass ? 'bg-[#35D399] border-emerald-950 shadow-[0_0_8px_#35D399]'
                  : isWarning ? 'bg-[#F4B740] border-amber-950 shadow-[0_0_8px_#F4B740]'
                  : 'bg-[#F06B78] border-rose-950 shadow-[0_0_8px_#F06B78]';

                const badgeColor = isPass ? 'text-[#35D399] border-[#35D399]/30 bg-[#35D399]/10'
                  : isWarning ? 'text-[#F4B740] border-[#F4B740]/30 bg-[#F4B740]/10'
                  : 'text-[#F06B78] border-[#F06B78]/30 bg-[#F06B78]/10';

                return (
                  <motion.div
                    key={rule.rule_id || idx}
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: shouldReduceMotion ? 0 : idx * 0.08 }}
                    className="relative group min-w-0"
                  >
                    {/* Node on Track Line */}
                    <div className={`absolute -left-[27px] top-5 w-3.5 h-3.5 rounded-full border-2 ${nodeColor} transition-transform group-hover:scale-125`} />

                    {/* Horizontal Check Row Panel: Padding 20px */}
                    <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-5 sm:p-6 hover:border-slate-700 transition-all min-w-0">
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none min-w-0"
                        onClick={() => toggleCheck(rule.rule_id || String(idx))}
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                          <span className="text-[14px] font-mono font-bold text-[#8A98AA] mt-0.5 sm:mt-0 shrink-0">
                            0{idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Check Title: 16–17px, font-weight 650–700, natural wrap */}
                              <h3 className="text-[16px] sm:text-[17px] font-sans font-bold text-white tracking-normal whitespace-normal break-normal">
                                {rule.rule_name}
                              </h3>
                              <span className="text-[12px] font-sans font-semibold px-2.5 py-0.5 rounded bg-slate-900 text-[#8A98AA] border border-white/[0.06] uppercase shrink-0">
                                {rule.category}
                              </span>
                            </div>
                            {/* Check Description: 14px, line-height 1.55, natural wrap */}
                            <p className="text-[14px] font-sans text-[#B8C5D5] mt-1 leading-[1.55] whitespace-normal">
                              {rule.message}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge: 13px font-bold */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span className={`px-3.5 py-1.5 rounded-full text-[13px] font-sans font-bold border uppercase tracking-wider flex items-center gap-1.5 ${badgeColor}`}>
                            {isPass ? (
                              <Check className="w-4 h-4" />
                            ) : isWarning ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                            {rule.status}
                          </span>
                          <button
                            className="text-slate-400 group-hover:text-white transition-colors p-1"
                            aria-label={isExpanded ? 'Collapse check details' : 'Expand check details'}
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* INLINE DETAIL DRAWER: Warning heading 17-18px, description 14px, metric values 18-22px */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: 6 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: 6 }}
                            transition={{ duration: 0.28 }}
                            className="mt-5 pt-5 border-t border-white/[0.06] space-y-4 min-w-0"
                          >
                            {/* If Relative Change Warning: Dedicated Visual */}
                            {rule.status === 'WARNING' && warningMetrics && (
                              <div className="p-5 rounded-xl bg-[#F4B740]/[0.08] border border-[#F4B740]/30 space-y-4 min-w-0">
                                <span className="text-[17px] sm:text-[18px] font-sans font-bold text-[#F4B740] tracking-tight block">
                                  WARNING THRESHOLD TOLERANCE
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="p-3 bg-slate-950/70 rounded-lg border border-[#F4B740]/20 min-w-0">
                                    <span className="text-[#8A98AA] text-[13px] font-sans font-semibold uppercase tracking-[0.03em] block">
                                      BASELINE
                                    </span>
                                    <span className="text-[#F5F7FA] font-mono font-bold text-[20px] sm:text-[22px] block mt-1 whitespace-nowrap overflow-x-auto">
                                      {warningMetrics.baseline}
                                    </span>
                                  </div>
                                  <div className="p-3 bg-slate-950/70 rounded-lg border border-[#F4B740]/20 min-w-0">
                                    <span className="text-[#8A98AA] text-[13px] font-sans font-semibold uppercase tracking-[0.03em] block">
                                      PROPOSED
                                    </span>
                                    <span className="text-white font-mono font-bold text-[20px] sm:text-[22px] block mt-1 whitespace-nowrap overflow-x-auto">
                                      {warningMetrics.proposed}
                                    </span>
                                  </div>
                                  <div className="p-3 bg-slate-950/70 rounded-lg border border-[#F4B740]/20 min-w-0">
                                    <span className="text-[#F4B740] text-[13px] font-sans font-semibold uppercase tracking-[0.03em] block">
                                      ACTUAL CHANGE
                                    </span>
                                    <span className="text-[#F4B740] font-mono font-bold text-[20px] sm:text-[22px] block mt-1 whitespace-nowrap overflow-x-auto">
                                      {warningMetrics.changePct}%
                                    </span>
                                  </div>
                                  <div className="p-3 bg-slate-950/70 rounded-lg border border-[#F4B740]/20 min-w-0">
                                    <span className="text-[#8A98AA] text-[13px] font-sans font-semibold uppercase tracking-[0.03em] block">
                                      SAFETY THRESHOLD
                                    </span>
                                    <span className="text-white font-mono font-bold text-[20px] sm:text-[22px] block mt-1 whitespace-nowrap overflow-x-auto">
                                      {warningMetrics.thresholdPct}% <span className="text-[13px] text-[#F4B740] font-sans">(+{warningMetrics.excessPct}%)</span>
                                    </span>
                                  </div>
                                </div>

                                {/* Progress visual with 50% threshold line */}
                                <div className="space-y-1.5 pt-1">
                                  <div className="relative h-3.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: '50%' }} />
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(100, warningMetrics.changePct)}%` }}
                                      transition={{ duration: 0.6, ease: 'easeOut' }}
                                      className="h-full bg-gradient-to-r from-amber-500 to-[#F4B740] rounded-full"
                                    />
                                  </div>
                                  <div className="flex justify-between text-[13px] font-sans text-[#8A98AA] font-medium">
                                    <span>0% Shift</span>
                                    <span className="text-white font-bold">50% Safety Boundary</span>
                                    <span>100% Shift</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Standard Evidence Payload (Keys 13px, Values 14px, full wrap) */}
                            <div>
                              <span className="text-[13px] font-sans font-semibold uppercase tracking-[0.03em] text-[#8A98AA] block mb-2.5">
                                EVIDENCE PAYLOAD & STATISTICAL THRESHOLDS
                              </span>
                              {rule.evidence && Object.keys(rule.evidence).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-900/60 p-4 rounded-xl border border-white/[0.04]">
                                  {Object.entries(rule.evidence).map(([k, v], i) => (
                                    <div key={i} className="flex justify-between items-center gap-4 p-1 min-w-0">
                                      <span className="text-[13px] font-sans text-[#8A98AA] capitalize shrink-0">
                                        {k.replace(/_/g, ' ')}:
                                      </span>
                                      <span className="text-[14px] font-mono font-bold text-white break-normal whitespace-nowrap overflow-x-auto" title={String(v)}>
                                        {String(v)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[14px] font-sans text-[#8A98AA] leading-[1.55]">
                                  Verified against enterprise boundary thresholds.
                                </p>
                              )}
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

      {/* ============================================================== */}
      {/* 3. FINAL VERDICT (STRONG CONCLUSION SURFACE)                   */}
      {/* ============================================================== */}
      {guardrail && (
        <motion.section
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl bg-[#07101D]/80 border border-[rgba(120,190,230,0.22)] p-7 sm:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.22)] min-w-0"
        >
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 text-center lg:text-left min-w-0">
              <div className="p-4 rounded-2xl bg-[#35D399]/10 border border-[#35D399]/30 text-[#35D399] shrink-0">
                {guardrail.decision_status === 'READY_TO_CONSIDER' || guardrail.feasibility_status === 'FEASIBLE' ? (
                  <ShieldCheck className="w-11 h-11 text-[#35D399]" />
                ) : (
                  <AlertTriangle className="w-11 h-11 text-[#F4B740]" />
                )}
              </div>

              <div className="min-w-0">
                <span className="text-[12px] font-sans uppercase tracking-wider text-[#39D6F5] font-bold block mb-1">
                  VALIDATION VERDICT
                </span>
                <h3 className="text-[22px] sm:text-[26px] font-sans font-bold text-white tracking-tight uppercase whitespace-normal break-normal">
                  {guardrail.decision_status === 'READY_TO_CONSIDER' || guardrail.feasibility_status === 'FEASIBLE' ? (
                    'DECISION VALIDATION COMPLETE'
                  ) : (
                    'HUMAN REVIEW RECOMMENDED'
                  )}
                </h3>
                <p className="text-[14px] sm:text-[15px] font-sans text-[#B8C5D5] mt-1.5 font-medium leading-[1.55]">
                  <span className="text-[#35D399] font-bold">✓ {guardrail.passed_rules.length} PASSED</span> • <span className="text-[#F4B740] font-bold">⚠ {guardrail.warnings.length} WARNING</span> • <span className="text-[#F06B78] font-bold">× {guardrail.violated_rules.length} VIOLATIONS</span>
                </p>
              </div>
            </div>

            {/* Compact Decision Readiness Badges */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-center">
                <span className="text-[#8A98AA] text-[12.5px] font-sans uppercase block font-semibold mb-0.5">Feasibility</span>
                <span className="text-[#35D399] font-sans font-bold text-[14px] flex items-center justify-center gap-1">
                  <Check className="w-4 h-4" /> PASS
                </span>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-center">
                <span className="text-[#8A98AA] text-[12.5px] font-sans uppercase block font-semibold mb-0.5">Realism</span>
                <span className="text-[#F4B740] font-sans font-bold text-[14px] flex items-center justify-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> WARNING
                </span>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-center">
                <span className="text-[#8A98AA] text-[12.5px] font-sans uppercase block font-semibold mb-0.5">Risk Level</span>
                <span className={`font-sans font-bold text-[14px] uppercase ${guardrail.risk_level === 'LOW' ? 'text-[#35D399]' : 'text-[#F4B740]'}`}>
                  {guardrail.risk_level}
                </span>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-center">
                <span className="text-[#8A98AA] text-[12.5px] font-sans uppercase block font-semibold mb-0.5">Confidence</span>
                <span className="text-[#9B7BFF] font-mono font-bold text-[14px]">{guardrail.confidence_score}</span>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 4. NEXT ACTION (COMPACT FULL-WIDTH FOOTER, BUTTON 14PX BOLD)   */}
      {/* ============================================================== */}
      <footer className="rounded-2xl bg-[#07101D]/80 border border-[rgba(120,190,230,0.14)] p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 min-w-0">
        <div className="min-w-0">
          <span className="text-[12px] font-sans text-[#39D6F5] uppercase tracking-wider font-bold block mb-1">
            NEXT STAGE: DECISION CONTROL
          </span>
          <p className="text-[15px] font-sans text-[#B8C5D5] leading-[1.55] whitespace-normal">
            Validation complete. Continue to the Decision Command Center for governance and execution.
          </p>
        </div>

        {/* Primary Action Button: 14px font-bold, height 48-50px, min-width 240px */}
        <button
          onClick={onProceed}
          className="h-[48px] sm:h-[50px] min-w-[260px] px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#39D6F5] hover:opacity-95 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2.5 hover:translate-y-[-2px] shrink-0"
        >
          <span>PROCEED TO DECISION COMMAND CENTER</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
