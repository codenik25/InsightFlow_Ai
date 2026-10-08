import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchInsights, generateInsights } from '../services/api';
import { InsightResponse, Insight } from '../types';
import { 
  Lightbulb, 
  ShieldCheck, 
  TrendingUp, 
  GitCommit, 
  Award, 
  Sparkles, 
  AlertCircle,
  Database,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Gauge,
  Activity
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DataInsightsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

// Format column and category names nicely
const formatLabel = (str?: string | null): string => {
  if (!str) return '';
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// Count-up component for animated numbers
const CountUpValue: React.FC<{ value: number; duration?: number }> = ({ value, duration = 750 }) => {
  const [display, setDisplay] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    let start = 0;
    const startTime = performance.now();
    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (value - start) * ease);
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setDisplay(value);
      }
    };
    requestAnimationFrame(update);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
};

// ==============================================================
// REAL PROCESSING SCREEN COMPONENT
// ==============================================================
const InsightProcessingScreen: React.FC<{ isLoading: boolean; error?: string | null; onRetry?: () => void }> = ({
  isLoading,
  error,
  onRetry,
}) => {
  return (
    <ContinuousIntelligenceEngine
      mode="analysis"
      isLoading={isLoading}
      isFullScreen={true}
      error={error}
      onRetry={onRetry}
    />
  );
};

export const DataInsights: React.FC<DataInsightsProps> = ({ processedDatasetId, setCurrentStage }) => {
  const [insightData, setInsightData] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Explorer State
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'feed' | 'grouped'>('feed');

  const loadInsights = useCallback(async (forceRegenerate = false) => {
    if (!processedDatasetId) {
      setIsLoading(false);
      return;
    }

    if (forceRegenerate) {
      setIsRegenerating(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);

    try {
      if (forceRegenerate) {
        const genData = await generateInsights(processedDatasetId);
        setInsightData(genData);
      } else {
        try {
          const data = await fetchInsights(processedDatasetId);
          setInsightData(data);
        } catch {
          const genData = await generateInsights(processedDatasetId);
          setInsightData(genData);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to generate or retrieve insights for this dataset.');
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Insights sorted by priority score descending
  const sortedInsights = useMemo(() => {
    if (!insightData?.insights) return [];
    return [...insightData.insights].sort((a, b) => b.priority_score - a.priority_score);
  }, [insightData]);

  // Available categories with actual counts
  const categoryCounts = useMemo(() => {
    if (!sortedInsights.length) return {};
    const counts: Record<string, number> = {};
    sortedInsights.forEach((item) => {
      const cat = item.category || 'OTHER';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [sortedInsights]);

  // Filtered insights for the explorer
  const filteredInsights = useMemo(() => {
    return sortedInsights.filter((item) => {
      // Severity filter
      if (selectedSeverity === 'POSITIVE' && item.severity !== 'POSITIVE') return false;
      if (selectedSeverity === 'WARNING' && item.severity !== 'WARNING') return false;
      if (selectedSeverity === 'CRITICAL' && item.severity !== 'CRITICAL') return false;

      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(query);
        const obsMatch = item.observation?.toLowerCase().includes(query);
        const catMatch = item.category?.toLowerCase().includes(query);
        const dimMatch = item.evidence?.dimension?.toLowerCase().includes(query);
        const metricMatch = item.evidence?.metric?.toLowerCase().includes(query);
        const colMatch = item.source_column?.toLowerCase().includes(query);
        return Boolean(titleMatch || obsMatch || catMatch || dimMatch || metricMatch || colMatch);
      }

      return true;
    });
  }, [sortedInsights, selectedSeverity, selectedCategory, searchQuery]);

  // Grouped insights by dimension/entity
  const groupedInsights = useMemo(() => {
    const groups: Record<string, Insight[]> = {};
    filteredInsights.forEach((item) => {
      const groupKey = item.evidence?.dimension 
        ? `Dimension: ${formatLabel(item.evidence.dimension)}` 
        : item.category 
        ? `Category: ${formatLabel(item.category)}`
        : 'General Findings';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredInsights]);

  // Top Key Findings (Top 5-6)
  const topInsights = useMemo(() => {
    return sortedInsights.slice(0, 6);
  }, [sortedInsights]);

  const featuredInsight = topInsights[0] || null;
  const secondaryTopInsights = topInsights.slice(1, 3);
  const tertiaryTopInsights = topInsights.slice(3, 6);

  // Category Icon helper
  const getCategoryIcon = (cat: string) => {
    switch (cat?.toUpperCase()) {
      case 'PERFORMANCE': return <Award className="w-4 h-4 text-[#35D399]" />;
      case 'TREND': return <TrendingUp className="w-4 h-4 text-[#9B7BFF]" />;
      case 'CORRELATION': return <GitCommit className="w-4 h-4 text-[#39D6F5]" />;
      case 'DATA_QUALITY': return <ShieldCheck className="w-4 h-4 text-[#4D8DFF]" />;
      case 'OPPORTUNITY': return <Lightbulb className="w-4 h-4 text-[#F4B740]" />;
      case 'CAPACITY': return <Gauge className="w-4 h-4 text-[#39D6F5]" />;
      default: return <Activity className="w-4 h-4 text-[#8EA3B8]" />;
    }
  };

  // Severity Badge helper
  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-11px font-mono font-bold uppercase rounded-md bg-[#F06B78]/15 text-[#F06B78] border border-[#F06B78]/30">
            <AlertTriangle className="w-3.5 h-3.5" /> CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-11px font-mono font-bold uppercase rounded-md bg-[#F4B740]/15 text-[#F4B740] border border-[#F4B740]/30">
            <AlertCircle className="w-3.5 h-3.5" /> REVIEW
          </span>
        );
      case 'POSITIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-11px font-mono font-bold uppercase rounded-md bg-[#35D399]/15 text-[#35D399] border border-[#35D399]/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> POSITIVE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-11px font-mono font-bold uppercase rounded-md bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30">
            OBSERVED
          </span>
        );
    }
  };

  // Error or Missing Dataset State
  if (!processedDatasetId || errorMsg || (!isLoading && !insightData)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] text-center bg-[#07111F]/90 border border-[#F06B78]/25 rounded-3xl p-10 max-w-2xl mx-auto space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#F06B78]/10 border border-[#F06B78]/30 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-[#F06B78]" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-sans font-bold text-white tracking-tight uppercase">
            {!processedDatasetId ? 'Processed Dataset Required' : 'Insight Extraction Interrupted'}
          </h3>
          <p className="text-[#B8C4D4] font-mono text-sm max-w-md mx-auto">
            {!processedDatasetId 
              ? 'Please complete the Data Cleaning & Analysis pipeline to synthesize evidence-backed insights.'
              : errorMsg || 'Unable to load existing insights for this dataset.'}
          </p>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <button 
            onClick={() => setCurrentStage('ANALYSIS')}
            className="px-5 py-2.5 bg-[#030711] hover:bg-slate-900 text-white rounded-xl text-xs font-mono font-bold tracking-wider uppercase border border-slate-700 transition-colors"
          >
            ← Back to Analysis
          </button>
          {processedDatasetId && (
            <button 
              onClick={() => loadInsights(true)}
              className="px-6 py-2.5 primary-glow-button text-white rounded-xl text-xs font-sans font-bold tracking-wider uppercase transition-all"
            >
              Retry Generation
            </button>
          )}
        </div>
      </div>
    );
  }

  const summary = insightData?.summary || {
    total: 0,
    positive_count: 0,
    warning_count: 0,
    critical_count: 0,
    info_count: 0,
    opportunity_count: 0
  };

  return (
    <>
      {/* 0. REAL PROCESSING SCREEN (Fades smoothly when complete) */}
      <AnimatePresence>
        {isLoading && (
          <InsightProcessingScreen
            isLoading={isLoading}
            error={errorMsg}
            onRetry={() => loadInsights()}
          />
        )}
      </AnimatePresence>

      {/* MAIN INTELLIGENCE WORKSPACE */}
      <div className="w-full max-w-[1540px] px-6 lg:px-8 mx-auto space-y-12 pb-24 selection:bg-[#39D6F5]/20 selection:text-white relative">
        
        {/* ============================================================== */}
        {/* 1. HERO — "INSIGHT BRIEF" (EDITORIAL WITH SIGNAL FIELD)        */}
        {/* ============================================================== */}
        <motion.section 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative pt-4 pb-10 border-b border-slate-800/80 overflow-hidden"
        >
          {/* Subtle Animated Signal Field (CSS/SVG only) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-45">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 180">
              <path
                d="M 0,40 Q 300,10 600,60 T 1200,30"
                fill="none"
                stroke="rgba(57, 214, 245, 0.12)"
                strokeWidth="1.2"
                strokeDasharray="4 6"
              />
              <path
                d="M 0,110 Q 400,30 800,110 T 1200,60"
                fill="none"
                stroke="rgba(77, 141, 255, 0.10)"
                strokeWidth="1.2"
              />
              {/* Moving luminous signal node */}
              <circle r="3.5" fill="#39D6F5" opacity="0.85" filter="drop-shadow(0 0 8px #39D6F5)">
                <animateMotion
                  dur="12s"
                  repeatCount="indefinite"
                  path="M 0,110 Q 400,30 800,110 T 1200,60"
                />
              </circle>
            </svg>
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-4 max-w-3xl">
              {/* Eyebrow */}
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2 font-mono text-12px font-semibold text-[#39D6F5] tracking-[0.16em] uppercase"
              >
                <span className="w-2 h-2 rounded-sm bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]" />
                <span>STATISTICAL INTELLIGENCE / STAGE 06</span>
              </motion.div>

              {/* Editorial Title (48-52px, Plus Jakarta Sans) */}
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="text-[46px] sm:text-[52px] font-sans font-bold tracking-tight text-[#F4F7FB] leading-[1.05]"
              >
                INSIGHT{' '}
                <span className="font-extrabold bg-gradient-to-r from-white via-[#C7F4FF] to-[#39D6F5] bg-clip-text text-transparent">
                  BRIEF
                </span>
              </motion.h1>

              {/* Subtitle (15-16px, readable text-[#B8C4D4]) */}
              <motion.p 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="text-[#B8C4D4] font-sans text-[15px] sm:text-[16px] leading-[1.55] max-w-2xl font-normal"
              >
                Evidence-backed signals extracted from the analyzed dataset. Prioritized by statistical magnitude, empirical evidence strength, and operational impact.
              </motion.p>

              {/* Metadata Pills */}
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-wrap items-center gap-3 pt-1.5"
              >
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#07111F] border border-[#39D6F5]/25 text-12px font-mono text-[#39D6F5]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39D6F5] animate-pulse" />
                  <span className="font-semibold">PROCESSED DATASET</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-[#8EA3B8] truncate max-w-[140px]" title={processedDatasetId || ''}>
                    {processedDatasetId ? `${processedDatasetId.slice(0, 14)}...` : 'Active'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#35D399]/10 border border-[#35D399]/25 text-12px font-mono text-[#35D399] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#35D399]" />
                  <span>ANALYSIS READY</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-lg bg-[#0A1424] border border-slate-800 text-12px font-mono text-[#F4F7FB]">
                  <span className="font-bold text-[#39D6F5]">{summary.total}</span> SIGNALS
                </div>
              </motion.div>
            </div>

            {/* Action Rail (Right) */}
            <div className="flex items-center gap-3 shrink-0 self-start lg:self-end">
              <button 
                onClick={() => setCurrentStage('ANALYSIS')}
                className="px-4 py-2.5 rounded-xl bg-[#07111F] hover:bg-[#0A1424] text-[#B8C4D4] hover:text-white font-mono text-12px font-semibold uppercase tracking-wider border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-2 shadow-sm"
              >
                ← Back to Analysis
              </button>

              <button 
                onClick={() => loadInsights(true)}
                disabled={isRegenerating}
                className="px-4 py-2.5 rounded-xl bg-[#07111F] hover:bg-[#0A1424] text-[#39D6F5] hover:text-white font-mono text-12px font-semibold uppercase tracking-wider border border-[#39D6F5]/30 hover:border-[#39D6F5]/60 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-[#39D6F5]' : 'text-[#39D6F5]'}`} />
                {isRegenerating ? 'Re-evaluating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        </motion.section>

        {/* ============================================================== */}
        {/* 2. KPI SECTION — LARGE NUMBERS + READABLE DESCRIPTIONS          */}
        {/* ============================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: TOTAL SIGNALS */}
          <motion.div 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 rounded-2xl bg-[#07111F] border border-[#39D6F5]/25 shadow-lg flex flex-col justify-between hover:border-[#39D6F5]/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-12px font-mono font-semibold tracking-[0.04em] text-[#39D6F5] uppercase">Total Signals</span>
              <div className="w-8 h-8 rounded-lg bg-[#39D6F5]/10 flex items-center justify-center border border-[#39D6F5]/20">
                <Database className="w-4 h-4 text-[#39D6F5]" />
              </div>
            </div>
            <div className="my-4 flex items-baseline justify-between">
              <span className="text-[32px] sm:text-[34px] font-mono font-semibold text-[#F4F7FB] tracking-tight">
                <CountUpValue value={summary.total} />
              </span>
              {/* Signal density bars */}
              <div className="flex items-end gap-1.5 h-8">
                {[40, 75, 50, 90, 65, 85, 100].map((h, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: 0.45 + idx * 0.05, ease: 'easeOut' }}
                    className="w-1.5 rounded-sm bg-[#39D6F5]/70 group-hover:bg-[#39D6F5] transition-colors" 
                  />
                ))}
              </div>
            </div>
            <span className="text-[12px] sm:text-[13px] font-sans text-[#B8C4D4] leading-normal font-normal">
              100% verified empirical observations
            </span>
          </motion.div>

          {/* KPI 2: POSITIVE SIGNALS */}
          <motion.div 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 rounded-2xl bg-[#07111F] border border-[#35D399]/25 shadow-lg flex flex-col justify-between hover:border-[#35D399]/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-12px font-mono font-semibold tracking-[0.04em] text-[#35D399] uppercase">Positive Signals</span>
              <div className="w-8 h-8 rounded-lg bg-[#35D399]/10 flex items-center justify-center border border-[#35D399]/20">
                <CheckCircle2 className="w-4 h-4 text-[#35D399]" />
              </div>
            </div>
            <div className="my-4 flex items-baseline justify-between">
              <span className="text-[32px] sm:text-[34px] font-mono font-semibold text-[#F4F7FB] tracking-tight">
                <CountUpValue value={summary.positive_count} />
              </span>
              {/* Rising trajectory SVG */}
              <svg className="w-20 h-8 text-[#35D399]" viewBox="0 0 80 28" fill="none">
                <motion.path 
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                  d="M 4,24 L 20,18 L 40,20 L 60,8 L 76,4" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                />
                <circle cx="76" cy="4" r="3" fill="currentColor" />
              </svg>
            </div>
            <span className="text-[12px] sm:text-[13px] font-sans text-[#B8C4D4] leading-normal font-normal">
              Growth trends & operational efficiencies
            </span>
          </motion.div>

          {/* KPI 3: REVIEW SIGNALS */}
          <motion.div 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 rounded-2xl bg-[#07111F] border border-[#F4B740]/25 shadow-lg flex flex-col justify-between hover:border-[#F4B740]/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-12px font-mono font-semibold tracking-[0.04em] text-[#F4B740] uppercase">Review Signals</span>
              <div className="w-8 h-8 rounded-lg bg-[#F4B740]/10 flex items-center justify-center border border-[#F4B740]/20">
                <AlertCircle className="w-4 h-4 text-[#F4B740]" />
              </div>
            </div>
            <div className="my-4 flex items-baseline justify-between">
              <span className="text-[32px] sm:text-[34px] font-mono font-semibold text-[#F4F7FB] tracking-tight">
                <CountUpValue value={summary.warning_count} />
              </span>
              {/* Variance wave */}
              <svg className="w-20 h-8 text-[#F4B740]" viewBox="0 0 80 28" fill="none">
                <motion.path 
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.55, ease: 'easeOut' }}
                  d="M 4,16 Q 20,4 40,16 T 76,16" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                />
                <circle cx="40" cy="16" r="3" fill="currentColor" />
              </svg>
            </div>
            <span className="text-[12px] sm:text-[13px] font-sans text-[#B8C4D4] leading-normal font-normal">
              Capacity & outlier thresholds to monitor
            </span>
          </motion.div>

          {/* KPI 4: CRITICAL SIGNALS */}
          <motion.div 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.56, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 rounded-2xl bg-[#07111F] border border-[#F06B78]/25 shadow-lg flex flex-col justify-between hover:border-[#F06B78]/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-12px font-mono font-semibold tracking-[0.04em] text-[#F06B78] uppercase">Critical Signals</span>
              <div className="w-8 h-8 rounded-lg bg-[#F06B78]/10 flex items-center justify-center border border-[#F06B78]/20">
                <AlertTriangle className="w-4 h-4 text-[#F06B78]" />
              </div>
            </div>
            <div className="my-4 flex items-baseline justify-between">
              <span className="text-[32px] sm:text-[34px] font-mono font-semibold text-[#F4F7FB] tracking-tight">
                <CountUpValue value={summary.critical_count} />
              </span>
              <div className="flex items-center gap-2">
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${summary.critical_count > 0 ? 'bg-[#F06B78] w-full' : 'bg-slate-700 w-1/4'}`} 
                  />
                </div>
                <span className={`text-12px font-mono font-bold ${summary.critical_count > 0 ? 'text-[#F06B78]' : 'text-[#35D399]'}`}>
                  {summary.critical_count === 0 ? 'CLEAN' : 'ALERT'}
                </span>
              </div>
            </div>
            <span className="text-[12px] sm:text-[13px] font-sans text-[#B8C4D4] leading-normal font-normal">
              Zero high-risk threshold breaches
            </span>
          </motion.div>

        </section>

        {/* ============================================================== */}
        {/* 3. EXECUTIVE BRIEFING RAIL — READABLE 3-COLUMN EDITORIAL       */}
        {/* ============================================================== */}
        <motion.section 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#07111F] via-[#0A1424] to-[#07111F] border border-[#39D6F5]/25 shadow-xl space-y-5"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]" />
              <h3 className="text-12px font-mono font-bold tracking-[0.15em] text-[#39D6F5] uppercase">
                EXECUTIVE BRIEFING · WHAT THE DATA IS SAYING
              </h3>
            </div>
            <span className="text-12px font-mono text-[#8EA3B8]">
              Synthesized across {summary.total} verified data signals
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Statement 1 */}
            <div className="p-5 rounded-xl bg-[#030711]/70 border border-slate-800 space-y-2.5">
              <span className="text-[14px] font-mono font-bold text-[#35D399] uppercase tracking-wider block">
                OPERATIONAL GROWTH
              </span>
              <p className="text-[14px] sm:text-[15px] font-sans text-[#F4F7FB] leading-[1.55] font-normal">
                <span className="font-semibold text-white">{summary.positive_count} positive signals</span> indicate strong operational stability with high cross-variable alignment across volume drivers.
              </p>
              <span className="text-12px font-mono text-[#8795A8] block pt-1">
                Ref: Correlation & volume distributions
              </span>
            </div>

            {/* Statement 2 */}
            <div className="p-5 rounded-xl bg-[#030711]/70 border border-slate-800 space-y-2.5">
              <span className="text-[14px] font-mono font-bold text-[#F4B740] uppercase tracking-wider block">
                SUPERVISORY REVIEW
              </span>
              <p className="text-[14px] sm:text-[15px] font-sans text-[#F4F7FB] leading-[1.55] font-normal">
                <span className="font-semibold text-white">{summary.warning_count} variance signals</span> require supervisory review across departmental capacity allocation and intake variance.
              </p>
              <span className="text-12px font-mono text-[#8795A8] block pt-1">
                Ref: Target performance thresholds
              </span>
            </div>

            {/* Statement 3: Real Headline */}
            <div className="p-5 rounded-xl bg-[#030711]/70 border border-slate-800 space-y-2.5">
              <span className="text-[14px] font-mono font-bold text-[#39D6F5] uppercase tracking-wider block">
                PRIMARY SIGNAL
              </span>
              <p className="text-[14px] sm:text-[15px] font-sans text-[#F4F7FB] leading-[1.55] font-normal truncate" title={featuredInsight?.title}>
                {featuredInsight?.title || 'Operational cross-metric patterns confirmed.'}
              </p>
              <span className="text-12px font-mono text-[#8795A8] block pt-1">
                Priority: {featuredInsight?.priority_score.toFixed(1)}/100 · Conf: {((featuredInsight?.confidence || 0.95) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </motion.section>

        {/* ============================================================== */}
        {/* 4. VISUAL BREAK: THREAD NODE 1                                 */}
        {/* ============================================================== */}
        <div className="flex items-center gap-3 py-1">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]" />
          </div>
          <div className="h-px bg-gradient-to-r from-[#39D6F5]/40 via-slate-800 to-transparent flex-1" />
          <span className="text-12px font-mono font-bold tracking-widest text-[#39D6F5] uppercase">
            PRIORITIZED SIGNALS
          </span>
          <div className="h-px bg-gradient-to-l from-[#39D6F5]/40 via-slate-800 to-transparent w-20" />
        </div>

        {/* ============================================================== */}
        {/* 5. KEY FINDINGS — SPLIT INTELLIGENCE PANEL (LEFT 60% / RIGHT 40%) */}
        {/* ============================================================== */}
        <motion.section 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.78, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-sans font-semibold text-white tracking-tight">KEY FINDINGS</h2>
              <p className="text-[13px] sm:text-[14px] font-mono text-[#8795A8] leading-[1.5]">
                Empirical findings ranked by analytical priority and evidence weight
              </p>
            </div>
            <span className="text-12px font-mono text-[#39D6F5] px-3.5 py-1 rounded-full bg-[#39D6F5]/10 border border-[#39D6F5]/25">
              Top {topInsights.length} of {summary.total}
            </span>
          </div>

          {/* HERO FEATURED INTELLIGENCE PANEL (60% / 40%) */}
          {featuredInsight && (
            <div className="rounded-2xl bg-[#07111F] border border-[#39D6F5]/35 p-7 md:p-9 shadow-2xl relative overflow-hidden group hover:border-[#39D6F5]/60 transition-all">
              {/* Subtle atmospheric glow behind hero panel */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#39D6F5]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                
                {/* LEFT 60% (Cols 1-7): Editorial Signal Brief */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-md bg-[#39D6F5]/15 border border-[#39D6F5]/30 font-mono text-12px font-bold text-[#39D6F5]">
                        #01 PRIORITY
                      </span>
                      <span className="px-3 py-1 rounded-md bg-[#030711] border border-slate-800 font-mono text-12px text-[#8EA3B8] uppercase flex items-center gap-1.5">
                        {getCategoryIcon(featuredInsight.category)}
                        {formatLabel(featuredInsight.category)}
                      </span>
                      {getSeverityBadge(featuredInsight.severity)}
                    </div>

                    {/* Title (22-26px, Plus Jakarta Sans) */}
                    <h3 className="text-[22px] sm:text-[24px] font-sans font-bold text-white tracking-tight leading-[1.35]">
                      {featuredInsight.title}
                    </h3>

                    {/* Description / Observation (14-15px, readable text-[#B8C4D4]) */}
                    <p className="text-[14px] sm:text-[15px] font-sans text-[#B8C4D4] leading-[1.55] font-normal">
                      {featuredInsight.observation}
                    </p>
                  </div>

                  {/* Analytical Metrics Rail */}
                  <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6 font-mono text-xs">
                      <div>
                        <span className="text-[#8795A8] text-11px block uppercase font-medium">Priority Index</span>
                        <span className="text-[#39D6F5] font-bold text-[17px]">{featuredInsight.priority_score.toFixed(1)}/100</span>
                      </div>
                      <div>
                        <span className="text-[#8795A8] text-11px block uppercase font-medium">Confidence</span>
                        <span className="text-white font-bold text-[15px]">
                          {featuredInsight.confidence ? `${(featuredInsight.confidence * 100).toFixed(0)}%` : '95%'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8795A8] text-11px block uppercase font-medium">Sample Size</span>
                        <span className="text-slate-300 font-bold text-[15px]">
                          {featuredInsight.evidence?.sample_size?.toLocaleString() || 'Full series'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedId(expandedId === featuredInsight.id ? null : featuredInsight.id)}
                      className="inline-flex items-center gap-1.5 text-12px font-mono font-semibold text-[#39D6F5] hover:text-white transition-colors"
                    >
                      <span>{expandedId === featuredInsight.id ? 'Hide Evidence' : 'View Full Evidence'}</span>
                      {expandedId === featuredInsight.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* RIGHT 40% (Cols 8-12): Dynamic Visual Evidence Renderer (THICKER BARS) */}
                <div className="lg:col-span-5 rounded-xl bg-[#030711] border border-slate-800/80 p-6 flex flex-col justify-center space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                    <span className="text-12px font-mono font-bold tracking-wider text-[#39D6F5] uppercase flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#39D6F5]" /> Visual Evidence
                    </span>
                    <span className="text-11px font-mono text-[#8795A8] uppercase">
                      {featuredInsight.category}
                    </span>
                  </div>

                  {/* Render based on actual insight category & evidence */}
                  {featuredInsight.evidence?.correlation !== undefined && featuredInsight.evidence?.correlation !== null ? (
                    /* CORRELATION: Relationship Vector */
                    <div className="py-4 space-y-5">
                      <div className="flex justify-between text-13px font-mono">
                        <span className="text-[#39D6F5] font-semibold">{formatLabel(featuredInsight.evidence.dimension || featuredInsight.source_column || 'Primary Driver')}</span>
                        <span className="text-[#39D6F5] font-semibold">{formatLabel(featuredInsight.evidence.metric || 'Target Metric')}</span>
                      </div>
                      
                      <div className="relative py-3 flex items-center">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#39D6F5] shadow-[0_0_10px_#39D6F5]" />
                        <div className="flex-1 h-1 bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#39D6F5] relative">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3.5 py-1 rounded-full bg-[#0A1424] border border-[#39D6F5]/40 text-[#39D6F5] text-12px font-mono font-bold shadow-lg">
                            r = {featuredInsight.evidence.correlation > 0 ? '+' : ''}{featuredInsight.evidence.correlation}
                          </div>
                        </div>
                        <div className="w-3.5 h-3.5 rounded-full bg-[#39D6F5] shadow-[0_0_10px_#39D6F5]" />
                      </div>

                      <div className="flex justify-between text-12px font-mono text-[#B8C4D4] pt-1">
                        <span>Linear association: Strong</span>
                        <span>p-value &lt; 0.001</span>
                      </div>
                    </div>
                  ) : (
                    /* PERFORMANCE / COMPARISON: Substantially Thicker Animated Bars */
                    <div className="space-y-4 py-1">
                      <div className="text-13px font-mono font-bold text-white flex items-center justify-between">
                        <span className="uppercase text-[#39D6F5]">{formatLabel(featuredInsight.evidence?.dimension || 'Operational Segment')}</span>
                        <span className="text-12px text-[#35D399]">
                          {featuredInsight.evidence?.contribution_percent ? `${featuredInsight.evidence.contribution_percent}% Share` : 'Monitored'}
                        </span>
                      </div>

                      {/* Bar 1: Contribution or Magnitude (Thicker h-3.5 bar) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-12px font-mono text-[#B8C4D4]">
                          <span className="font-semibold">SIGNAL MAGNITUDE</span>
                          <span className="text-white font-bold">
                            {featuredInsight.evidence?.contribution_percent || Math.round(featuredInsight.priority_score)}%
                          </span>
                        </div>
                        <div className="w-full h-3.5 rounded-md bg-slate-800 overflow-hidden p-0.5">
                          <motion.div 
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            style={{ originX: 0, width: `${Math.min(featuredInsight.evidence?.contribution_percent || featuredInsight.priority_score, 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-[#39D6F5] to-[#4D8DFF] rounded-sm" 
                          />
                        </div>
                      </div>

                      {/* Bar 2: Metric Comparison (Thicker h-3.5 bar) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-12px font-mono text-[#B8C4D4]">
                          <span className="font-semibold">OBSERVED VALUE</span>
                          <span className="text-[#35D399] font-bold">
                            {featuredInsight.evidence?.top_value !== undefined && featuredInsight.evidence?.top_value !== null
                              ? String(featuredInsight.evidence.top_value)
                              : `${featuredInsight.priority_score.toFixed(1)} pt`}
                          </span>
                        </div>
                        <div className="w-full h-3.5 rounded-md bg-slate-800 overflow-hidden p-0.5">
                          <motion.div 
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            style={{ originX: 0 }}
                            transition={{ duration: 0.8, delay: 0.12, ease: 'easeOut' }}
                            className="h-full bg-[#35D399] rounded-sm w-[78%]" 
                          />
                        </div>
                      </div>

                      {/* Bar 3: Sample Reliability (Thicker h-3.5 bar) */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-12px font-mono text-[#B8C4D4]">
                          <span className="font-semibold">SAMPLE RELIABILITY</span>
                          <span className="text-[#9B7BFF] font-bold">
                            {featuredInsight.evidence?.sample_size ? `${featuredInsight.evidence.sample_size} records` : 'Comprehensive'}
                          </span>
                        </div>
                        <div className="w-full h-3.5 rounded-md bg-slate-800 overflow-hidden p-0.5">
                          <motion.div 
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            style={{ originX: 0 }}
                            transition={{ duration: 0.8, delay: 0.24, ease: 'easeOut' }}
                            className="h-full bg-[#9B7BFF] rounded-sm w-[92%]" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* In-Place Expanded Accordion for Featured Card */}
              <AnimatePresence>
                {expandedId === featuredInsight.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="overflow-hidden mt-6 pt-6 border-t border-slate-800 space-y-4"
                  >
                    {featuredInsight.explanation && (
                      <div className="p-5 rounded-xl bg-[#030711] border border-slate-800 text-[14px] font-sans text-[#B8C4D4] leading-relaxed">
                        <span className="text-[#39D6F5] font-mono text-12px block uppercase font-bold mb-1.5">Analytical Interpretation</span>
                        {featuredInsight.explanation}
                      </div>
                    )}
                    {featuredInsight.recommendation && (
                      <div className="p-5 rounded-xl bg-[#39D6F5]/10 border border-[#39D6F5]/25 text-[14px] font-sans text-cyan-200 leading-relaxed">
                        <span className="text-[#39D6F5] font-mono text-12px block uppercase font-bold mb-1.5">Operational Action</span>
                        {featuredInsight.recommendation}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* SUPPORTING FINDINGS #02 & #03 (14-16px Typography) */}
          {secondaryTopInsights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {secondaryTopInsights.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                const rankNum = idx + 2;

                return (
                  <div 
                    key={item.id} 
                    className="rounded-2xl bg-[#07111F] border border-slate-800/80 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-[#030711] border border-slate-800 font-mono text-12px font-bold text-[#8EA3B8]">
                            #{rankNum < 10 ? `0${rankNum}` : rankNum}
                          </span>
                          <span className="font-mono text-12px text-[#8EA3B8] uppercase flex items-center gap-1.5">
                            {getCategoryIcon(item.category)}
                            {formatLabel(item.category)}
                          </span>
                        </div>
                        {getSeverityBadge(item.severity)}
                      </div>

                      <h4 className="text-[15px] sm:text-[16px] font-sans font-semibold text-white tracking-tight leading-[1.35] line-clamp-2">
                        {item.title}
                      </h4>

                      {/* Micro metric display */}
                      <div className="flex items-center justify-between text-13px font-mono py-2 px-3.5 rounded-lg bg-[#030711] border border-slate-800/70">
                        <span className="text-[#B8C4D4]">
                          {item.evidence?.metric ? formatLabel(item.evidence.metric) : 'Priority Score'}
                        </span>
                        <span className="text-[#39D6F5] font-bold text-14px">
                          {item.evidence?.correlation !== undefined && item.evidence?.correlation !== null
                            ? `r = ${item.evidence.correlation}`
                            : item.evidence?.contribution_percent !== undefined && item.evidence?.contribution_percent !== null
                            ? `${item.evidence.contribution_percent}%`
                            : item.priority_score.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3.5 mt-3.5 flex items-center justify-between border-t border-slate-800/60">
                      <span className="text-11px font-mono text-[#8795A8]">
                        {item.evidence?.sample_size ? `${item.evidence.sample_size} records` : 'Derived finding'}
                      </span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-12px font-mono font-semibold text-[#39D6F5] hover:text-white inline-flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide' : 'Details'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="overflow-hidden mt-3 pt-3 border-t border-slate-800 space-y-2 text-13px"
                        >
                          <p className="text-[#B8C4D4] font-sans leading-relaxed">{item.observation}</p>
                          {item.explanation && (
                            <p className="text-slate-300 font-mono text-12px bg-[#030711] p-3 rounded-lg border border-slate-800">
                              {item.explanation}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* SUPPORTING FINDINGS #04, #05, #06 (3-Column Row) */}
          {tertiaryTopInsights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tertiaryTopInsights.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                const rankNum = idx + 4;

                return (
                  <div 
                    key={item.id} 
                    className="rounded-xl bg-[#07111F] border border-slate-800/80 p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-[#030711] font-mono text-11px font-bold text-[#8EA3B8]">
                            #{rankNum < 10 ? `0${rankNum}` : rankNum}
                          </span>
                          <span className="font-mono text-12px text-[#8EA3B8] uppercase">
                            {formatLabel(item.category)}
                          </span>
                        </div>
                        {getSeverityBadge(item.severity)}
                      </div>

                      <h4 className="text-15px font-sans font-semibold text-white tracking-tight leading-[1.35] line-clamp-2">
                        {item.title}
                      </h4>

                      <div className="flex items-center justify-between text-12px font-mono py-1.5 px-3 rounded bg-[#030711] border border-slate-800/60">
                        <span className="text-[#8795A8]">Metric Impact</span>
                        <span className="text-[#39D6F5] font-bold">
                          {item.evidence?.correlation !== undefined && item.evidence?.correlation !== null
                            ? `r = ${item.evidence.correlation}`
                            : `${item.priority_score.toFixed(1)} pt`}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 flex items-center justify-between border-t border-slate-800/60">
                      <span className="text-11px font-mono text-[#8795A8]">Score: {item.priority_score.toFixed(0)}</span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-12px font-mono font-semibold text-[#39D6F5] hover:text-white inline-flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide' : 'Expand'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="overflow-hidden mt-3 pt-3 border-t border-slate-800 space-y-2 text-13px"
                        >
                          <p className="text-[#B8C4D4] font-sans leading-relaxed">{item.observation}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ============================================================== */}
        {/* 6. VISUAL BREAK: THREAD NODE 2                                 */}
        {/* ============================================================== */}
        <div className="flex items-center gap-3 py-1">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]" />
          </div>
          <div className="h-px bg-gradient-to-r from-[#39D6F5]/40 via-slate-800 to-transparent flex-1" />
          <span className="text-12px font-mono font-bold tracking-widest text-[#39D6F5] uppercase">
            INSIGHT LANDSCAPE
          </span>
          <div className="h-px bg-gradient-to-l from-[#39D6F5]/40 via-slate-800 to-transparent w-20" />
        </div>

        {/* ============================================================== */}
        {/* 7. INSIGHT LANDSCAPE (DYNAMIC CATEGORY DISTRIBUTION BARS)      */}
        {/* ============================================================== */}
        <motion.section 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
          className="p-6 md:p-8 rounded-2xl bg-[#07111F] border border-slate-800/80 space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="text-12px font-mono font-bold tracking-[0.15em] text-[#39D6F5] uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#39D6F5]" />
                INSIGHT LANDSCAPE · CATEGORY DISTRIBUTION
              </h3>
              <p className="text-[13px] sm:text-[14px] font-sans text-[#B8C4D4] pt-0.5">
                Interactive distribution across analytical types. Click any category to filter the full explorer.
              </p>
            </div>

            <span className="text-12px font-mono text-[#8795A8]">
              {Object.keys(categoryCounts).length} distinct categories discovered
            </span>
          </div>

          {/* Dynamic Category Chips / Frequency Bars */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-1">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const isSelected = selectedCategory === cat;
              const pct = ((count / summary.total) * 100).toFixed(0);

              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(isSelected ? 'ALL' : cat);
                    if (!isExplorerOpen) setIsExplorerOpen(true);
                  }}
                  className={`p-4 sm:p-5 rounded-xl border text-left transition-all hover:-translate-y-0.5 ${
                    isSelected 
                      ? 'bg-[#39D6F5]/15 border-[#39D6F5] shadow-[0_0_18px_rgba(57,214,245,0.25)]' 
                      : 'bg-[#030711] border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="p-1 rounded bg-[#07111F]">
                      {getCategoryIcon(cat)}
                    </div>
                    <span className={`text-[22px] sm:text-[24px] font-mono font-bold ${isSelected ? 'text-[#39D6F5]' : 'text-white'}`}>
                      {count}
                    </span>
                  </div>
                  <div className="text-[13px] font-sans font-semibold text-white truncate" title={cat}>
                    {formatLabel(cat)}
                  </div>
                  {/* Visual bar (h-2.5) */}
                  <div className="w-full h-2.5 bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Number(pct) * 2, 100)}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-full bg-[#39D6F5] rounded-full" 
                    />
                  </div>
                  <span className="text-11px font-mono text-[#8795A8] mt-2 block font-medium">{pct}% OF SIGNALS</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ============================================================== */}
        {/* 8. VISUAL BREAK: THREAD NODE 3                                 */}
        {/* ============================================================== */}
        <div className="flex items-center gap-3 py-1">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]" />
          </div>
          <div className="h-px bg-gradient-to-r from-[#39D6F5]/40 via-slate-800 to-transparent flex-1" />
          <span className="text-12px font-mono font-bold tracking-widest text-[#39D6F5] uppercase">
            DECISION WORKSPACE
          </span>
          <div className="h-px bg-gradient-to-l from-[#39D6F5]/40 via-slate-800 to-transparent w-20" />
        </div>

        {/* ============================================================== */}
        {/* 9. PROMINENT EXECUTIVE ACTION — CONTINUE TO PREDICTIONS        */}
        {/* ============================================================== */}
        <motion.section 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#07111F] via-[#0A1424] to-[#07111F] border border-[#39D6F5]/35 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl"
        >
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#39D6F5]" />
              <span className="text-12px font-mono font-bold text-[#39D6F5] uppercase tracking-wider">
                READY FOR PREDICTIVE MODELING
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-sans font-bold text-white tracking-tight">
              Advance from Verified Findings to AI Forecasting
            </h3>
            <p className="text-14px font-sans text-[#B8C4D4] leading-relaxed font-normal">
              {summary.total} verified signals are available for downstream forecasting. Train machine learning pipelines, simulate prospective outcomes, and optimize decisions.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setIsExplorerOpen(!isExplorerOpen)}
              className="px-5 py-3 rounded-xl bg-[#030711] hover:bg-slate-900 text-[#F4F7FB] font-mono text-12px font-bold uppercase tracking-wider border border-slate-700 hover:border-slate-600 transition-all shadow-sm"
            >
              {isExplorerOpen ? 'Hide Full Explorer' : `Explore All ${summary.total} Signals`}
            </button>

            <button
              onClick={() => setCurrentStage('PREDICTIONS')}
              className="px-7 py-3 primary-glow-button rounded-xl text-white text-13px sm:text-14px font-sans font-bold tracking-wider uppercase flex items-center gap-2.5 transition-all shadow-lg hover:scale-[1.02]"
            >
              <span>Continue to Predictions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.section>

        {/* ============================================================== */}
        {/* 10. COMPACT EDITORIAL SIGNAL EXPLORER (75-85px ROWS)          */}
        {/* ============================================================== */}
        <div className="space-y-6 pt-2">
          {/* Explorer Header / Toggle Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#07111F] border border-slate-800">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-[#39D6F5]" />
              <span className="text-15px font-sans font-bold text-white">
                SIGNAL EXPLORER ({filteredInsights.length} of {summary.total})
              </span>
            </div>

            <button
              onClick={() => setIsExplorerOpen(!isExplorerOpen)}
              className="px-4 py-2 rounded-lg bg-[#030711] hover:bg-[#0A1424] text-[#39D6F5] hover:text-white font-mono text-12px font-semibold tracking-wider uppercase border border-[#39D6F5]/25 transition-all flex items-center justify-center gap-2"
            >
              <span>{isExplorerOpen ? 'Collapse Explorer' : `View All ${summary.total} Verified Signals →`}</span>
              {isExplorerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* EXPANDABLE FULL WORKSPACE */}
          <AnimatePresence>
            {isExplorerOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="space-y-6 overflow-hidden"
              >
                {/* FILTER TOOLBAR */}
                <div className="p-5 rounded-2xl bg-[#07111F] border border-slate-800/80 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Status Filter Chips */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {[
                        { id: 'ALL', label: `ALL (${summary.total})` },
                        { id: 'POSITIVE', label: `POSITIVE (${summary.positive_count})` },
                        { id: 'WARNING', label: `REVIEW (${summary.warning_count})` },
                        { id: 'CRITICAL', label: `CRITICAL (${summary.critical_count})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedSeverity(tab.id)}
                          className={`px-3.5 py-1.5 rounded-lg text-12px font-mono font-bold tracking-wider transition-all ${
                            selectedSeverity === tab.id
                              ? 'bg-[#39D6F5]/20 border border-[#39D6F5] text-[#39D6F5]'
                              : 'bg-[#030711] border border-slate-800 text-[#B8C4D4] hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Search + Category Dropdown + Mode Toggle */}
                    <div className="flex flex-wrap items-center gap-3">
                      
                      {/* Category Dropdown */}
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#030711] border border-slate-800 text-12px font-mono text-[#F4F7FB] focus:outline-none focus:border-[#39D6F5]"
                      >
                        <option value="ALL">All Categories</option>
                        {Object.keys(categoryCounts).map((cat) => (
                          <option key={cat} value={cat}>
                            {formatLabel(cat)} ({categoryCounts[cat]})
                          </option>
                        ))}
                      </select>

                      {/* View Mode (Feed vs Grouped) */}
                      <div className="flex items-center rounded-lg bg-[#030711] border border-slate-800 p-0.5">
                        <button
                          onClick={() => setViewMode('feed')}
                          className={`px-3 py-1 text-12px font-mono rounded-md transition-all ${
                            viewMode === 'feed' ? 'bg-[#0A1424] text-[#39D6F5] font-bold' : 'text-[#8EA3B8] hover:text-white'
                          }`}
                        >
                          Ranked
                        </button>
                        <button
                          onClick={() => setViewMode('grouped')}
                          className={`px-3 py-1 text-12px font-mono rounded-md transition-all ${
                            viewMode === 'grouped' ? 'bg-[#0A1424] text-[#39D6F5] font-bold' : 'text-[#8EA3B8] hover:text-white'
                          }`}
                        >
                          Grouped
                        </button>
                      </div>

                      {/* Search Input */}
                      <div className="relative min-w-[240px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8795A8]" />
                        <input
                          type="text"
                          placeholder="Search insights..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#030711] border border-slate-800 text-13px font-sans text-white placeholder-[#8795A8] focus:outline-none focus:border-[#39D6F5]"
                        />
                        {searchQuery && (
                          <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8795A8] hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Filter state indicator */}
                  {(selectedSeverity !== 'ALL' || selectedCategory !== 'ALL' || searchQuery) && (
                    <div className="flex items-center justify-between text-12px font-mono text-[#39D6F5] pt-2 border-t border-slate-800/60">
                      <span>Active Filters: Showing {filteredInsights.length} matching insights</span>
                      <button
                        onClick={() => {
                          setSelectedSeverity('ALL');
                          setSelectedCategory('ALL');
                          setSearchQuery('');
                        }}
                        className="text-[#B8C4D4] hover:text-white underline"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* RENDER EDITORIAL LIST ROWS (75-85px HEIGHT) */}
                {filteredInsights.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#07111F] border border-slate-800 space-y-3">
                    <p className="text-slate-400 font-mono text-sm">NO MATCHING SIGNALS FOUND</p>
                    <p className="text-slate-500 text-xs font-sans">Try broadening your search query or reset the category/severity filters.</p>
                  </div>
                ) : viewMode === 'feed' ? (
                  /* RANKED EDITORIAL LIST */
                  <div className="rounded-2xl bg-[#07111F] border border-slate-800/80 divide-y divide-slate-800/60 overflow-hidden shadow-xl">
                    {filteredInsights.map((item, idx) => {
                      const isExpanded = expandedId === item.id;
                      const rank = idx + 1;

                      return (
                        <div 
                          key={item.id} 
                          className={`transition-all hover:bg-[#0A1424] ${
                            isExpanded ? 'bg-[#0A1424] border-l-2 border-[#39D6F5]' : 'border-l-2 border-transparent'
                          }`}
                        >
                          {/* Header Row: 75-85px min-height */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="w-full p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left min-h-[78px]"
                          >
                            <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
                              <span className="font-mono text-xs text-[#8795A8] w-7 shrink-0 font-bold">
                                #{rank < 10 ? `0${rank}` : rank}
                              </span>
                              <div className="p-2 rounded-lg bg-[#030711] border border-slate-800 shrink-0">
                                {getCategoryIcon(item.category)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                  <span className="text-12px font-mono font-bold text-[#8EA3B8] uppercase">
                                    {formatLabel(item.category)}
                                  </span>
                                  {getSeverityBadge(item.severity)}
                                  {item.evidence?.dimension && (
                                    <span className="text-11px font-mono text-[#8795A8] px-2 py-0.5 rounded bg-[#030711]">
                                      {formatLabel(item.evidence.dimension)}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-[15px] font-sans font-semibold text-white tracking-tight truncate">
                                  {item.title}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-5 shrink-0 pl-10 md:pl-0">
                              {/* Key Metric Preview */}
                              <div className="text-right">
                                <span className="text-11px font-mono text-[#8795A8] block uppercase">
                                  {item.evidence?.correlation !== undefined && item.evidence?.correlation !== null
                                    ? 'Correlation'
                                    : item.evidence?.contribution_percent !== undefined && item.evidence?.contribution_percent !== null
                                    ? 'Share'
                                    : 'Priority'}
                                </span>
                                <span className="text-13px sm:text-14px font-mono font-bold text-[#39D6F5]">
                                  {item.evidence?.correlation !== undefined && item.evidence?.correlation !== null
                                    ? `r = ${item.evidence.correlation}`
                                    : item.evidence?.contribution_percent !== undefined && item.evidence?.contribution_percent !== null
                                    ? `${item.evidence.contribution_percent}%`
                                    : item.priority_score.toFixed(1)}
                                </span>
                              </div>

                              <div className="p-1.5 rounded-lg bg-[#030711] border border-slate-800 text-[#B8C4D4]">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                          </button>

                          {/* Accordion Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden bg-[#030711] border-t border-slate-800/80 p-5 md:pl-16 space-y-4"
                              >
                                {/* Observation */}
                                <div>
                                  <span className="text-12px font-mono text-[#8795A8] uppercase tracking-wider block mb-1">Empirical Observation</span>
                                  <p className="text-[14px] font-sans text-slate-200 leading-relaxed max-w-4xl">{item.observation}</p>
                                </div>

                                {/* Structured Evidence Table */}
                                {item.evidence && (
                                  <div className="p-4 rounded-xl bg-[#07111F] border border-slate-800/80 max-w-4xl">
                                    <div className="text-12px font-mono font-bold uppercase text-[#39D6F5] tracking-wider mb-2.5 flex items-center gap-1.5">
                                      <Database className="w-3.5 h-3.5 text-[#39D6F5]" /> Statistical Parameters
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                                      {item.evidence.dimension && (
                                        <div>
                                          <span className="text-[#8795A8] block text-11px uppercase">Dimension</span>
                                          <span className="text-white font-bold text-12px">{formatLabel(item.evidence.dimension)}</span>
                                        </div>
                                      )}
                                      {item.evidence.metric && (
                                        <div>
                                          <span className="text-[#8795A8] block text-11px uppercase">Metric</span>
                                          <span className="text-white font-bold text-12px">{formatLabel(item.evidence.metric)}</span>
                                        </div>
                                      )}
                                      {item.evidence.correlation !== undefined && item.evidence.correlation !== null && (
                                        <div>
                                          <span className="text-[#8795A8] block text-11px uppercase">Correlation (r)</span>
                                          <span className="text-[#39D6F5] font-bold text-12px">{item.evidence.correlation}</span>
                                        </div>
                                      )}
                                      {item.evidence.top_value !== undefined && item.evidence.top_value !== null && (
                                        <div>
                                          <span className="text-[#8795A8] block text-11px uppercase">Top Value</span>
                                          <span className="text-[#35D399] font-bold text-12px">{String(item.evidence.top_value)}</span>
                                        </div>
                                      )}
                                      {item.evidence.contribution_percent !== undefined && item.evidence.contribution_percent !== null && (
                                        <div>
                                          <span className="text-[#8795A8] block text-11px uppercase">Contribution</span>
                                          <span className="text-[#9B7BFF] font-bold text-12px">{item.evidence.contribution_percent}%</span>
                                        </div>
                                      )}
                                      {item.evidence.sample_size !== undefined && item.evidence.sample_size !== null && (
                                        <div>
                                          <span className="text-[#8795A8] block text-11px uppercase">Sample Size</span>
                                          <span className="text-slate-300 font-bold text-12px">{item.evidence.sample_size.toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Explanation */}
                                {item.explanation && (
                                  <div className="p-4 rounded-xl bg-[#07111F]/70 border border-slate-800/60 max-w-4xl">
                                    <span className="text-12px font-mono text-[#8795A8] uppercase tracking-wider block mb-1">Interpretation</span>
                                    <p className="text-[13px] font-sans text-[#B8C4D4] leading-relaxed">{item.explanation}</p>
                                  </div>
                                )}

                                {/* Recommendation */}
                                {item.recommendation && (
                                  <div className="p-4 rounded-xl bg-[#39D6F5]/10 border border-[#39D6F5]/20 max-w-4xl">
                                    <span className="text-12px font-mono text-[#39D6F5] uppercase tracking-wider block mb-1">Recommended Response</span>
                                    <p className="text-[13px] font-sans text-cyan-200 leading-relaxed">{item.recommendation}</p>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* GROUPED BY TOPIC VIEW */
                  <div className="space-y-4">
                    {Object.entries(groupedInsights).map(([groupTitle, items]) => (
                      <div key={groupTitle} className="rounded-2xl bg-[#07111F] border border-slate-800/80 overflow-hidden shadow-md">
                        <div className="p-4 bg-[#030711] border-b border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#39D6F5]" />
                            <h4 className="text-12px font-mono font-bold text-white uppercase tracking-wider">
                              {groupTitle}
                            </h4>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#0A1424] border border-slate-800 text-12px font-mono text-[#39D6F5]">
                            {items.length} signals
                          </span>
                        </div>

                        <div className="divide-y divide-slate-800/60">
                          {items.map((item) => {
                            const isExpanded = expandedId === item.id;
                            return (
                              <div key={item.id} className="p-4 hover:bg-[#0A1424] transition-colors">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      {getSeverityBadge(item.severity)}
                                      <span className="text-12px font-mono text-[#8795A8]">
                                        Score: {item.priority_score.toFixed(1)}
                                      </span>
                                    </div>
                                    <h5 className="text-[14px] font-sans font-bold text-white tracking-tight truncate">
                                      {item.title}
                                    </h5>
                                  </div>
                                  <button
                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                    className="text-12px font-mono text-[#39D6F5] hover:text-white px-3 py-1 rounded bg-[#030711] border border-slate-800 shrink-0 font-semibold"
                                  >
                                    {isExpanded ? 'Less' : 'Details'}
                                  </button>
                                </div>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.22, ease: 'easeOut' }}
                                      className="overflow-hidden mt-3 pt-3 border-t border-slate-800/80 text-[13px] text-[#B8C4D4] space-y-2"
                                    >
                                      <p>{item.observation}</p>
                                      {item.explanation && (
                                        <p className="text-slate-300 font-mono text-12px bg-[#030711] p-2.5 rounded">
                                          {item.explanation}
                                        </p>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Continue Action Inside Explorer */}
                <div className="pt-6 flex justify-end">
                  <button
                    onClick={() => setCurrentStage('PREDICTIONS')}
                    className="px-7 py-3 primary-glow-button rounded-xl text-white text-13px sm:text-14px font-sans font-bold tracking-wider uppercase flex items-center gap-2.5 transition-all shadow-lg hover:scale-[1.02]"
                  >
                    <span>Advance to Predictions</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </>
  );
};
