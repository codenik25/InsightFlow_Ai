import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  Database,
  Activity,
  Sparkles,
  Network,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileText,
  Search,
  LayoutGrid,
  Lightbulb,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchDatasetProfile,
  fetchDatasetQuality,
  fetchInsights,
  fetchTransformationHistory,
  fetchDatasetVersions,
  fetchHealthStatus,
  getDownloadUrl,
} from '../services/api';
import {
  DatasetProfileData,
  DatasetQualityResponse,
  InsightResponse,
  TransformationLogItem,
  HealthStatus,
} from '../types';
import { GlassCard3D } from './ui/GlassCard3D';
import { AnimatedCounter } from './ui/AnimatedCounter';

interface DatasetOverviewProps {
  rawDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
  projectName?: string;
  projectId?: string | null;
  onOpenUploadModal?: () => void;
  onSelectAnotherDataset?: () => void;
}

// ============================================================================
// SIGNATURE OPENING TRANSITION (Sections 3 & 24)
// Total sequence: 1.2–1.4 seconds. Calm and stable thereafter.
// ============================================================================
const heroVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
};

const kpiContainerVariant: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.40,
      staggerChildren: 0.05,
    },
  },
};

const kpiItemVariant: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

const healthCompositionVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const columnProfileVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: 0.70, ease: [0.16, 1, 0.3, 1] },
  },
};

const sampleDataVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

const pipelineVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.40, delay: 1.00, ease: [0.16, 1, 0.3, 1] },
  },
};

const continueCtaVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.40, delay: 1.15, ease: [0.16, 1, 0.3, 1] },
  },
};

export const DatasetOverview: React.FC<DatasetOverviewProps> = ({
  rawDatasetId,
  setCurrentStage,
  projectName = 'Hospital Operations',
  projectId: _projectId = null,
  onOpenUploadModal,
  onSelectAnotherDataset,
}) => {
  const [profile, setProfile] = useState<DatasetProfileData | null>(null);
  const [qualityData, setQualityData] = useState<DatasetQualityResponse | null>(null);
  const [insightsData, setInsightsData] = useState<InsightResponse | null>(null);
  const [activityLogs, setActivityLogs] = useState<TransformationLogItem[]>([]);
  const [versionCount, setVersionCount] = useState<number>(1);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('');
  const [hoveredPipelineStage, setHoveredPipelineStage] = useState<string | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const loadAllRealData = useCallback(async () => {
    if (!rawDatasetId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Profile (Mandatory for dataset context)
      const profData = await fetchDatasetProfile(rawDatasetId);
      setProfile(profData);

      // 2. Fetch Supporting Real Data in parallel
      const [qRes, insRes, histRes, verRes, healthRes] = await Promise.all([
        fetchDatasetQuality(rawDatasetId).catch(() => null),
        fetchInsights(rawDatasetId).catch(() => null),
        fetchTransformationHistory(rawDatasetId).catch(() => null),
        fetchDatasetVersions(rawDatasetId).catch(() => null),
        fetchHealthStatus().catch(() => null),
      ]);

      if (qRes) setQualityData(qRes);
      if (insRes) setInsightsData(insRes);
      if (histRes?.items) setActivityLogs(histRes.items);
      if (verRes?.versions) setVersionCount(verRes.versions.length);
      if (healthRes) setHealth(healthRes);
    } catch (err: any) {
      console.warn('Dataset load failed or unavailable:', err);
      setError(err.message || 'The selected dataset is no longer available.');
    } finally {
      setLoading(false);
    }
  }, [rawDatasetId]);

  useEffect(() => {
    loadAllRealData();
  }, [loadAllRealData]);

  // Filter columns based on search input
  const filteredColumns = useMemo(() => {
    if (!profile?.columns) return [];
    if (!columnSearchQuery.trim()) return profile.columns;
    const q = columnSearchQuery.toLowerCase();
    return profile.columns.filter(
      (col) =>
        col.name.toLowerCase().includes(q) ||
        col.inferred_type.toLowerCase().includes(q)
    );
  }, [profile?.columns, columnSearchQuery]);

  // Dynamic next workflow step based on real pipeline progression
  const nextStepInfo = useMemo(() => {
    if (insightsData?.insights && insightsData.insights.length > 0) {
      return {
        stage: 'DECISIONS',
        buttonLabel: 'CONTINUE TO DECISIONS',
        title: 'Actionable Insights Ready',
        description: 'Quality, cleaning, and insight generation complete. Proceed to evaluate algorithmic decision recommendations.',
      };
    }
    if (activityLogs.length > 0) {
      return {
        stage: 'ANALYSIS',
        buttonLabel: 'CONTINUE TO ANALYSIS',
        title: 'Transformed Dataset Ready',
        description: 'Cleaning applied. Proceed through statistical modeling and automated pattern analysis.',
      };
    }
    if (qualityData || profile?.quality) {
      return {
        stage: 'CLEANING',
        buttonLabel: 'CONTINUE TO CLEANING',
        title: 'Quality Audit Complete',
        description: 'Automated integrity constraints and profiling complete. Continue through the intelligence pipeline.',
      };
    }
    return {
      stage: 'QUALITY',
      buttonLabel: 'CONTINUE TO DATA QUALITY',
      title: 'Baseline Audit Ready',
      description: 'Run automated integrity validations and feature health diagnostics.',
    };
  }, [qualityData, profile?.quality, activityLogs.length, insightsData]);

  // STATE A: NO DATASET SELECTED
  if (!rawDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] text-center bg-[rgba(7,14,26,0.72)] border border-white/[0.08] rounded-2xl p-8 max-w-2xl mx-auto backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-5 text-accent-cyan shadow-[0_0_20px_rgba(34,211,238,0.15)]">
          <Database className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-sans font-bold text-white mb-2 tracking-tight">
          NO DATASET SELECTED
        </h3>
        <p className="text-slate-400 mb-6 font-sans text-sm max-w-md">
          Select or upload a dataset to begin intelligence analysis.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentStage('UPLOAD')}
            className="px-6 py-2.5 bg-accent-cyan/15 hover:bg-accent-cyan/25 text-accent-cyan rounded-xl text-xs font-sans font-semibold tracking-wider uppercase border border-accent-cyan/30 transition-all shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:-translate-y-0.5 active:scale-98"
          >
            ← GO TO UPLOAD
          </button>
          <button
            onClick={() => setCurrentStage('DATASETS')}
            className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white rounded-xl text-xs font-sans font-semibold tracking-wider uppercase border border-white/10 transition-colors hover:-translate-y-0.5"
          >
            DATASET REGISTRY
          </button>
        </div>
      </div>
    );
  }

  // LOADING STATE
  if (loading) {
    return (
      <div className="animate-pulse space-y-6 max-w-[1600px] mx-auto w-full px-2 pb-20">
        <div className="h-36 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 h-72 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5" />
          <div className="lg:col-span-7 h-72 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5" />
        </div>
        <div className="h-80 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5 w-full" />
        <div className="h-80 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5 w-full" />
        <div className="h-28 bg-[rgba(7,14,26,0.6)] rounded-2xl border border-white/5 w-full" />
      </div>
    );
  }

  // STATE: DATASET UNAVAILABLE / ERROR
  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] text-center bg-[rgba(7,14,26,0.72)] border border-rose-500/25 rounded-2xl p-8 max-w-2xl mx-auto backdrop-blur-xl my-10">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-sans font-bold text-white mb-2 tracking-tight">
          DATASET UNAVAILABLE
        </h3>
        <p className="text-slate-400 mb-6 font-sans text-sm max-w-md">
          {error || 'The selected dataset is no longer available.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onSelectAnotherDataset) {
                onSelectAnotherDataset();
              } else {
                setCurrentStage('DATASETS');
              }
            }}
            className="px-6 py-2.5 bg-accent-cyan/15 hover:bg-accent-cyan/25 text-accent-cyan rounded-xl text-xs font-sans font-semibold tracking-wider uppercase border border-accent-cyan/30 transition-colors shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:-translate-y-0.5"
          >
            Choose Another Dataset
          </button>
          <button
            onClick={() => setCurrentStage('DATASETS')}
            className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white rounded-xl text-xs font-sans font-semibold tracking-wider uppercase border border-white/10 transition-colors hover:-translate-y-0.5"
          >
            Dataset Registry
          </button>
        </div>
      </div>
    );
  }

  const { overview, columns, quality } = profile;

  // Real data calculations
  const typesCount = columns.reduce((acc, col) => {
    const t = col.inferred_type.toLowerCase();
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const numericCount = typesCount['numeric'] || typesCount['integer'] || typesCount['float'] || 0;
  const categoricalCount = typesCount['categorical'] || typesCount['string'] || typesCount['text'] || 0;
  const datetimeCount = typesCount['datetime'] || typesCount['date'] || typesCount['timestamp'] || 0;

  const totalCols = overview.total_columns || 1;
  const numericPct = Math.round((numericCount / totalCols) * 100);
  const categoricalPct = Math.round((categoricalCount / totalCols) * 100);
  const datetimePct = Math.round((datetimeCount / totalCols) * 100);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const qualityScore =
    qualityData?.score?.overall_score ??
    (quality
      ? Math.max(0, 100 - quality.empty_columns.length * 5 - (overview.duplicate_rows > 0 ? 5 : 0))
      : null);

  const insightsCount = insightsData?.insights?.length ?? 0;
  const runsCount = activityLogs.length > 0 ? activityLogs.length : versionCount > 1 ? versionCount : 0;
  const decisionsCount = insightsData?.insights?.filter((i) => Boolean(i.recommendation)).length ?? 0;

  // Quality status
  const isQualityGood = qualityScore === null || qualityScore >= 75;

  return (
    <div 
      className="overview-shell relative w-full space-y-6 sm:space-y-7 pb-24 min-w-0"
      style={{ isolation: 'isolate' }}
    >
      {/* LOCAL OVERVIEW BACKGROUND LAYER (CLIPPED TO SHELL, STRICTLY Z-0, NEVER OVERLAPS CONTENT) */}
      <div className="overview-background absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Soft Ambient Glows Bounded to Overview */}
        <div 
          className="absolute -top-10 left-1/4 w-[420px] h-[280px] bg-cyan-500/[0.05] rounded-full pointer-events-none" 
          style={{ filter: 'blur(80px)' }}
        />
        <div 
          className="absolute top-1/3 -right-16 w-[420px] h-[320px] bg-purple-500/[0.04] rounded-full pointer-events-none" 
          style={{ filter: 'blur(80px)' }}
        />
      </div>
      
      {/* ============================================================== */}
      {/* 1. DATASET COMMAND CENTER (HERO SECTION - LEVEL 3 SURFACE)     */}
      {/* Dominant title, animated active signal pulse, zero clipping    */}
      {/* ============================================================== */}
      <motion.div 
        variants={heroVariant} 
        initial="hidden" 
        animate="visible" 
        className="w-full relative z-[2]"
      >
        <GlassCard3D 
          accentColor="cyan" 
          surfaceLevel={3}
          className="p-6 sm:p-7 relative overflow-hidden group w-full"
          style={{ isolation: 'isolate' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10 w-full">
            <div className="flex-1 min-w-0">
              
              {/* Technical Hierarchy: Project Name / ACTIVE DATASET / V1.0 */}
              <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                <span className="font-sans font-bold text-xs tracking-wider text-cyan-400">{projectName.toUpperCase()}</span>
                <span className="text-slate-600 font-mono">/</span>
                <span className="font-mono text-slate-300 font-semibold">ACTIVE DATASET</span>
                <span className="text-slate-600 font-mono">/</span>
                <span className="font-mono text-slate-400 font-medium">V{versionCount}.0</span>
              </div>

              {/* Dominant Dataset Title (34–40px Plus Jakarta Sans, Weight: 800) */}
              <div className="relative mb-3">
                {/* Subtle soft radial illumination behind dataset title */}
                <div 
                  className="absolute left-0 top-0 w-72 h-20 bg-cyan-500/[0.05] rounded-full pointer-events-none" 
                  style={{ filter: 'blur(40px)' }}
                />
                
                <h1 className="text-2xl sm:text-3xl lg:text-[38px] font-sans font-extrabold text-white tracking-tight leading-[1.15] pb-1 break-all sm:break-normal relative z-10">
                  {overview.filename}
                </h1>
              </div>

              {/* Technical Metadata Row (IBM Plex Mono) */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-slate-400">
                <span className="text-slate-200 font-sans font-semibold">
                  {overview.total_rows.toLocaleString()} <span className="font-mono text-slate-400 text-[11px]">rows</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-200 font-sans font-semibold">
                  {overview.total_columns} <span className="font-mono text-slate-400 text-[11px]">columns</span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300 text-xs font-mono">
                  {formatBytes(overview.file_size_bytes)}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500 text-[11px] font-mono select-all">
                  ID: <span className="text-cyan-300/90">{profile.dataset_id}</span>
                </span>
              </div>
            </div>

            {/* Action Buttons & Analysis Ready Badge with Data Signal (Section 5) */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              
              {/* Analysis Ready Badge with Animated Data Pulse Signal */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE] animate-pulse shrink-0" />
                <span>ANALYSIS READY</span>
                
                {/* Horizontal data pulse SVG: ──────╱╲───── (Strictly bounded) */}
                <svg className="w-14 h-3 text-cyan-400/80 overflow-hidden shrink-0 block" viewBox="0 0 56 12" fill="none">
                  <path
                    d="M 0 6 L 20 6 L 25 1 L 29 11 L 33 6 L 56 6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-35"
                  />
                  {!prefersReducedMotion && (
                    <motion.path
                      d="M 0 6 L 20 6 L 25 1 L 29 11 L 33 6 L 56 6"
                      stroke="#22D3EE"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="14 42"
                      animate={{ strokeDashoffset: [56, -56] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </svg>
              </div>

              {/* Raw CSV Button */}
              <a
                href={getDownloadUrl(profile.dataset_id, 'raw')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white text-xs font-sans font-semibold border border-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-2 group/btn shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 active:scale-98"
              >
                <FileText className="w-4 h-4 text-cyan-400 group-hover/btn:scale-105 transition-transform" />
                <span>Raw CSV</span>
              </a>

              {/* Dataset Actions Button */}
              <button
                onClick={() => {
                  if (onOpenUploadModal) {
                    onOpenUploadModal();
                  } else {
                    setCurrentStage('UPLOAD');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-[#02060D] text-xs font-sans font-bold tracking-wider hover:opacity-95 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-all flex items-center gap-2 group/btn hover:scale-[1.02] active:scale-[0.98] hover:-translate-y-0.5"
              >
                <SlidersHorizontal className="w-4 h-4 group-hover/btn:scale-105 transition-transform" />
                <span>Dataset Actions</span>
              </button>
            </div>
          </div>
        </GlassCard3D>
      </motion.div>

      {/* ============================================================== */}
      {/* 2. KEY DATA SIGNALS: SIX 3D DATA TILES (LEVEL 3 SURFACES)      */}
      {/* Opening 50ms stagger entrance, real data graphical micro-vis   */}
      {/* ============================================================== */}
      <motion.div 
        variants={kpiContainerVariant} 
        initial="hidden" 
        animate="visible" 
        className="w-full relative z-[2]"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5 w-full">
          
          {/* Card 1: TOTAL RECORDS (Blue/Cyan Accent) */}
          <motion.div variants={kpiItemVariant}>
            <GlassCard3D 
              enableTilt={true} 
              accentColor="blue" 
              surfaceLevel={3}
              className="p-5 flex flex-col justify-between min-h-[165px] sm:min-h-[175px] select-none group"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-[11px] text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors">
                  TOTAL RECORDS
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:border-blue-400/50 transition-all shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                  <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-[32px] sm:text-[36px] font-sans font-extrabold text-white tracking-tight leading-none group-hover:text-blue-100 transition-colors">
                  <AnimatedCounter value={overview.total_rows} duration={650} />
                </div>
              </div>

              {/* Graphical Micro-Visualization: Real Column Completeness Density Waveform */}
              <div className="pt-1.5 border-t border-white/[0.04]">
                <div className="flex items-end gap-1 h-5 pt-0.5">
                  {columns.slice(0, 10).map((col, idx) => {
                    const compRatio = Math.max(0.25, (overview.total_rows - col.null_count) / (overview.total_rows || 1));
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-t bg-cyan-400/35 hover:bg-cyan-300 transition-colors"
                        style={{ height: `${compRatio * 100}%` }}
                        title={`${col.name}: ${Math.round(compRatio * 100)}% non-null`}
                      />
                    );
                  })}
                </div>
                <div className="font-sans text-[11px] text-slate-400 font-normal mt-1 flex items-center justify-between">
                  <span>Persisted rows</span>
                  <span className="font-mono text-[9px] text-cyan-400/80">density</span>
                </div>
              </div>
            </GlassCard3D>
          </motion.div>

          {/* Card 2: COLUMNS (Cyan Accent) */}
          <motion.div variants={kpiItemVariant}>
            <GlassCard3D 
              enableTilt={true} 
              accentColor="cyan" 
              surfaceLevel={3}
              className="p-5 flex flex-col justify-between min-h-[165px] sm:min-h-[175px] select-none group"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-[11px] text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors">
                  COLUMNS
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:border-cyan-400/50 transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)]">
                  <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-[32px] sm:text-[36px] font-sans font-extrabold text-white tracking-tight leading-none group-hover:text-cyan-100 transition-colors">
                  <AnimatedCounter value={overview.total_columns} duration={500} />
                </div>
              </div>

              {/* Graphical Micro-Visualization: Miniature Column Composition Stacked Bar */}
              <div className="pt-1.5 border-t border-white/[0.04]">
                <div className="w-full h-1.5 rounded-full bg-slate-800 flex overflow-hidden">
                  <div style={{ width: `${numericPct}%` }} className="bg-cyan-400 h-full" title={`Numeric: ${numericCount}`} />
                  <div style={{ width: `${categoricalPct}%` }} className="bg-purple-400 h-full" title={`Categorical: ${categoricalCount}`} />
                  <div style={{ width: `${datetimePct}%` }} className="bg-pink-400 h-full" title={`Datetime: ${datetimeCount}`} />
                </div>
                <div className="font-sans text-[11px] text-slate-400 font-normal mt-1 flex items-center justify-between">
                  <span>Features profiled</span>
                  <span className="font-mono text-[9px] text-cyan-400/80">{totalCols} types</span>
                </div>
              </div>
            </GlassCard3D>
          </motion.div>

          {/* Card 3: QUALITY (Cyan/Green Accent) - Circular SVG Quality Gauge (Section 8) */}
          <motion.div variants={kpiItemVariant}>
            <GlassCard3D 
              enableTilt={true} 
              accentColor="cyan" 
              surfaceLevel={3}
              className="p-5 flex flex-col justify-between min-h-[165px] sm:min-h-[175px] select-none group"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-[11px] text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors">
                  QUALITY
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:border-cyan-400 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              {/* Circular Quality Gauge / Centerpiece (Section 8) */}
              <div className="my-1 flex items-center justify-between gap-2">
                <div className="text-[30px] sm:text-[34px] font-sans font-extrabold text-cyan-400 tracking-tight leading-none drop-shadow-[0_0_14px_rgba(34,211,238,0.35)]">
                  {qualityScore !== null ? `${Math.round(qualityScore)}%` : '--'}
                </div>
                
                {/* Compact Circular SVG Gauge */}
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 52 52">
                    {/* Secondary outer subtle ring */}
                    <circle
                      cx="26"
                      cy="26"
                      r="24"
                      className="text-white/[0.03]"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    {/* Base track ring */}
                    <circle
                      cx="26"
                      cy="26"
                      r="20"
                      className="text-white/[0.08]"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    {/* Animated value ring over 900ms */}
                    <motion.circle
                      cx="26"
                      cy="26"
                      r="20"
                      strokeWidth="3.5"
                      stroke="url(#kpi-quality-gauge-refined)"
                      strokeLinecap="round"
                      fill="transparent"
                      strokeDasharray="125.66"
                      initial={{ strokeDashoffset: 125.66 }}
                      animate={{ strokeDashoffset: 125.66 - (125.66 * (qualityScore || 0)) / 100 }}
                      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                    />
                    <defs>
                      <linearGradient id="kpi-quality-gauge-refined" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22D3EE" />
                        <stop offset="100%" stopColor="#10B981" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              <div className="pt-1.5 border-t border-white/[0.04] font-sans text-[11px] text-slate-400 font-normal flex items-center justify-between">
                <span>Audit baseline</span>
                <span className="font-mono text-[9px] text-emerald-400/90">{qualityScore !== null && qualityScore >= 75 ? 'passed' : 'review'}</span>
              </div>
            </GlassCard3D>
          </motion.div>

          {/* Card 4: INSIGHTS (Violet Accent) */}
          <motion.div variants={kpiItemVariant}>
            <GlassCard3D 
              enableTilt={true} 
              accentColor="purple" 
              surfaceLevel={3}
              className="p-5 flex flex-col justify-between min-h-[165px] sm:min-h-[175px] select-none group"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-[11px] text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors">
                  INSIGHTS
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 group-hover:border-purple-400/50 transition-all shadow-[0_0_12px_rgba(168,85,247,0.18)]">
                  <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-[32px] sm:text-[36px] font-sans font-extrabold text-purple-300 tracking-tight leading-none drop-shadow-[0_0_12px_rgba(168,85,247,0.25)] group-hover:text-purple-200 transition-colors">
                  <AnimatedCounter value={insightsCount} duration={500} />
                </div>
              </div>

              {/* Graphical Micro-Visualization: Real Insight Detection Constellation */}
              <div className="pt-1.5 border-t border-white/[0.04]">
                <div className="h-5 flex items-center justify-between px-1">
                  <svg className="w-full h-4" viewBox="0 0 100 16" fill="none">
                    <path d="M 6 12 Q 28 3, 52 9 T 94 6" stroke="rgba(168,85,247,0.35)" strokeWidth="1.5" fill="none" />
                    <circle cx="10" cy="11" r="2" className="fill-purple-400" />
                    <circle cx="50" cy="9" r="2.5" className="fill-purple-300" />
                    <circle cx="90" cy="6" r="2" className="fill-purple-400" />
                  </svg>
                </div>
                <div className="font-sans text-[11px] text-slate-400 font-normal mt-0.5 flex items-center justify-between">
                  <span>Patterns uncovered</span>
                  <span className="font-mono text-[9px] text-purple-400/80">signals</span>
                </div>
              </div>
            </GlassCard3D>
          </motion.div>

          {/* Card 5: RUNS (Blue/Indigo Accent) */}
          <motion.div variants={kpiItemVariant}>
            <GlassCard3D 
              enableTilt={true} 
              accentColor="indigo" 
              surfaceLevel={3}
              className="p-5 flex flex-col justify-between min-h-[165px] sm:min-h-[175px] select-none group"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-[11px] text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors">
                  RUNS
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:border-indigo-400/50 transition-all shadow-[0_0_12px_rgba(99,102,241,0.15)]">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-[32px] sm:text-[36px] font-sans font-extrabold text-white tracking-tight leading-none group-hover:text-indigo-100 transition-colors">
                  <AnimatedCounter value={runsCount} duration={500} />
                </div>
              </div>

              {/* Graphical Micro-Visualization: Real Pipeline Execution Timeline Nodes */}
              <div className="pt-1.5 border-t border-white/[0.04]">
                <div className="h-5 flex items-center px-1">
                  <div className="w-full h-[1.5px] bg-indigo-500/25 relative flex items-center justify-between">
                    {[0, 1, 2, 3, 4].map((step) => {
                      const isPassed = step < Math.max(1, runsCount);
                      return (
                        <div
                          key={step}
                          className={`w-2 h-2 rounded-full border transition-all ${
                            isPassed
                              ? 'bg-indigo-400 border-indigo-300 shadow-[0_0_6px_#818CF8]'
                              : 'bg-slate-800 border-white/10'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="font-sans text-[11px] text-slate-400 font-normal mt-0.5 flex items-center justify-between">
                  <span>Pipeline runs</span>
                  <span className="font-mono text-[9px] text-indigo-400/80">logged</span>
                </div>
              </div>
            </GlassCard3D>
          </motion.div>

          {/* Card 6: DECISIONS (Emerald/Green Accent) */}
          <motion.div variants={kpiItemVariant}>
            <GlassCard3D 
              enableTilt={true} 
              accentColor="emerald" 
              surfaceLevel={3}
              className="p-5 flex flex-col justify-between min-h-[165px] sm:min-h-[175px] select-none group"
            >
              <div className="flex items-center justify-between">
                <span className="font-sans font-bold text-[11px] text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors">
                  DECISIONS
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 group-hover:border-emerald-400/50 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              <div className="my-1">
                <div className="text-[32px] sm:text-[36px] font-sans font-extrabold text-emerald-400 tracking-tight leading-none drop-shadow-[0_0_14px_rgba(16,185,129,0.3)]">
                  <AnimatedCounter value={decisionsCount} duration={500} />
                </div>
              </div>

              {/* Graphical Micro-Visualization: Real Decision Progression Graph */}
              <div className="pt-1.5 border-t border-white/[0.04]">
                <div className="h-5 flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 rounded bg-emerald-500/40" title="Signals Identified" />
                  <div className={`h-1.5 flex-1 rounded ${decisionsCount > 0 ? 'bg-emerald-400/70 shadow-[0_0_6px_#34D399]' : 'bg-slate-800'}`} title="Formulated" />
                  <div className={`h-1.5 flex-1 rounded ${decisionsCount > 0 ? 'bg-emerald-300 shadow-[0_0_8px_#10B981]' : 'bg-slate-800'}`} title="Prescribed" />
                </div>
                <div className="font-sans text-[11px] text-slate-400 font-normal mt-0.5 flex items-center justify-between">
                  <span>Prescriptions</span>
                  <span className="font-mono text-[9px] text-emerald-400/80">ready</span>
                </div>
              </div>
            </GlassCard3D>
          </motion.div>

        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 3. DATA HEALTH + DATA COMPOSITION (LEVEL 2 SURFACES)           */}
      {/* Visual priority signals, large analytical distribution bars    */}
      {/* ============================================================== */}
      <motion.div
        variants={healthCompositionVariant}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-w-0 relative z-[2]"
      >
        
        {/* LEFT COLUMN (5 of 12): DATA HEALTH (Section 10) */}
        <div className="lg:col-span-5">
          <GlassCard3D 
            accentColor="cyan" 
            surfaceLevel={2}
            className="p-6 h-full flex flex-col justify-between space-y-5 transition-all duration-200"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE]" />
                  <h3 className="text-lg sm:text-[19px] font-sans font-bold text-white tracking-wide uppercase">
                    DATA HEALTH
                  </h3>
                </div>
                <span
                  className={`text-[10.5px] font-mono font-bold uppercase px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                    isQualityGood
                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isQualityGood ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]' : 'bg-amber-400 shadow-[0_0_8px_#F59E0B]'
                    }`}
                  />
                  {isQualityGood ? 'GOOD' : 'NEEDS REVIEW'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mb-4">
                Automated integrity constraints and duplicate checks
              </p>

              {/* Rows with real radial visual signals (Section 10) */}
              <div className="space-y-2.5">
                
                {/* Missing Columns */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:border-white/20 hover:bg-white/[0.045] hover:-translate-y-[1px] transition-all group/hrow">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full transition-transform group-hover/hrow:scale-110 ${
                      quality.empty_columns.length === 0
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]'
                        : 'bg-rose-400 shadow-[0_0_8px_#F43F5E]'
                    }`} />
                    <span className="text-slate-300 font-sans text-xs font-medium group-hover/hrow:text-white transition-colors">Missing Columns</span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      quality.empty_columns.length === 0
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 group-hover/hrow:bg-emerald-500/20'
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/25 group-hover/hrow:bg-rose-500/20'
                    }`}
                  >
                    ● {quality.empty_columns.length}
                  </span>
                </div>

                {/* Duplicate Rows */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:border-white/20 hover:bg-white/[0.045] hover:-translate-y-[1px] transition-all group/hrow">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full transition-transform group-hover/hrow:scale-110 ${
                      overview.duplicate_rows === 0
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]'
                        : 'bg-amber-400 shadow-[0_0_8px_#F59E0B]'
                    }`} />
                    <span className="text-slate-300 font-sans text-xs font-medium group-hover/hrow:text-white transition-colors">Duplicate Rows</span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      overview.duplicate_rows === 0
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 group-hover/hrow:bg-emerald-500/20'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/25 group-hover/hrow:bg-amber-500/20'
                    }`}
                  >
                    ● {overview.duplicate_rows.toLocaleString()}
                  </span>
                </div>

                {/* Constant Columns */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] hover:border-white/20 hover:bg-white/[0.045] hover:-translate-y-[1px] transition-all group/hrow">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full transition-transform group-hover/hrow:scale-110 ${
                      quality.constant_columns.length === 0
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]'
                        : 'bg-amber-400 shadow-[0_0_8px_#F59E0B]'
                    }`} />
                    <span className="text-slate-300 font-sans text-xs font-medium group-hover/hrow:text-white transition-colors">Constant Columns</span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      quality.constant_columns.length === 0
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 group-hover/hrow:bg-emerald-500/20'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/25 group-hover/hrow:bg-amber-500/20'
                    }`}
                  >
                    ● {quality.constant_columns.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Action: [ Inspect Quality Report → ] */}
            <div className="pt-2">
              <button
                onClick={() => setCurrentStage('QUALITY')}
                className="w-full py-2.5 rounded-xl text-xs font-sans font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 transition-all flex items-center justify-center gap-2 group/inspect shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:-translate-y-0.5 active:scale-98"
              >
                <span>Inspect Quality Report</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/inspect:translate-x-1 transition-transform" />
              </button>
            </div>
          </GlassCard3D>
        </div>

        {/* RIGHT COLUMN (7 of 12): DATA COMPOSITION (Section 9) & SYSTEM TELEMETRY (Section 11) */}
        <div className="lg:col-span-7">
          <GlassCard3D 
            accentColor="purple" 
            surfaceLevel={2}
            className="p-6 h-full flex flex-col justify-between space-y-6 transition-all duration-200"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#A855F7]" />
                <h3 className="text-lg sm:text-[19px] font-sans font-bold text-white tracking-wide uppercase">
                  DATA COMPOSITION
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-sans mb-4">
                Inferred type distributions across {overview.total_columns} columns
              </p>

              {/* Graphical Analytical Bars with 3-Layer Depth: Track + Fill + Specular Highlight */}
              <div className="space-y-4">
                
                {/* Numeric Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-sans mb-1.5">
                    <span className="text-slate-200 font-semibold tracking-wide">NUMERIC</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs font-mono">{numericCount} columns</span>
                      <span className="text-cyan-300 font-sans font-bold text-xs">{numericPct}%</span>
                    </div>
                  </div>
                  {/* Layer 1: Base Track */}
                  <div className="w-full h-3.5 rounded-full bg-slate-900 border border-white/[0.05] p-[1.5px] overflow-hidden relative shadow-inner">
                    {/* Layer 2: Filled Layer */}
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.4)] relative"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${numericPct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                      {/* Layer 3: Subtle Specular Highlight */}
                      <div className="absolute top-0 left-1 right-1 h-[1px] bg-white/30 rounded-full" />
                      {!prefersReducedMotion && (
                        <motion.div
                          className="absolute right-0 top-0 bottom-0 w-6 bg-white/40 blur-[2px] rounded-full"
                          animate={{ opacity: [0.3, 0.9, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Categorical Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-sans mb-1.5">
                    <span className="text-slate-200 font-semibold tracking-wide">CATEGORICAL</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs font-mono">{categoricalCount} column{categoricalCount !== 1 ? 's' : ''}</span>
                      <span className="text-purple-300 font-sans font-bold text-xs">{categoricalPct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-900 border border-white/[0.05] p-[1.5px] overflow-hidden relative shadow-inner">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 shadow-[0_0_12px_rgba(168,85,247,0.35)] relative"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${categoricalPct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                    >
                      <div className="absolute top-0 left-1 right-1 h-[1px] bg-white/30 rounded-full" />
                    </motion.div>
                  </div>
                </div>

                {/* Datetime Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-sans mb-1.5">
                    <span className="text-slate-200 font-semibold tracking-wide">DATETIME</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs font-mono">{datetimeCount} column{datetimeCount !== 1 ? 's' : ''}</span>
                      <span className="text-pink-300 font-sans font-bold text-xs">{datetimePct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-900 border border-white/[0.05] p-[1.5px] overflow-hidden relative shadow-inner">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)] relative"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${datetimePct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    >
                      <div className="absolute top-0 left-1 right-1 h-[1px] bg-white/30 rounded-full" />
                    </motion.div>
                  </div>
                </div>

              </div>
            </div>

            {/* SYSTEM TELEMETRY STRIP (Section 11) */}
            <div className="pt-4 border-t border-white/[0.08]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-sans font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
                  SYSTEM TELEMETRY
                </span>
                <span className="text-[11px] font-mono text-emerald-300 font-semibold flex items-center gap-1.5">
                  Operational Core Synced
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                
                {/* API Gateway */}
                <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-sans truncate">API GATEWAY</span>
                  <span className={`font-mono font-bold text-[10px] flex items-center gap-1.5 ${
                    health?.status === 'unhealthy' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      health?.status === 'unhealthy' ? 'bg-rose-400' : 'bg-emerald-400'
                    }`} />
                    {health?.status === 'unhealthy' ? 'DEGRADED' : 'ONLINE'}
                  </span>
                </div>

                {/* Intelligence Core */}
                <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-sans truncate">INTELLIGENCE</span>
                  <span className="text-purple-400 font-mono font-bold text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    ACTIVE
                  </span>
                </div>

                {/* Storage Engine */}
                <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-sans truncate">STORAGE</span>
                  <span className="text-cyan-400 font-mono font-bold text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    SYNCED
                  </span>
                </div>

                {/* Audit Engine */}
                <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-sans truncate">AUDIT</span>
                  <span className="text-emerald-400 font-mono font-bold text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    TRACEABLE
                  </span>
                </div>

              </div>
            </div>
          </GlassCard3D>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 4. COLUMN PROFILE (LEVEL 2 SURFACE - ANALYTICS TABLE)          */}
      {/* Visual completeness mini-bars & uniqueness distribution bars   */}
      {/* ============================================================== */}
      <motion.div variants={columnProfileVariant} initial="hidden" animate="visible" className="w-full relative z-[2]">
        <GlassCard3D 
          accentColor="cyan" 
          surfaceLevel={2}
          className="p-6 transition-all duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE]" />
                <h2 className="text-lg sm:text-[19px] font-sans font-bold text-white tracking-wide uppercase">
                  COLUMN PROFILE ({columns.length} COLUMNS)
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-1">
                Inferred types, null counts, distinct uniqueness, and health status
              </p>
            </div>

            {/* Column Search Filter */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={columnSearchQuery}
                onChange={(e) => setColumnSearchQuery(e.target.value)}
                placeholder="Search columns or types..."
                className="w-full h-9 pl-9 pr-3.5 bg-white/[0.035] border border-white/10 rounded-xl text-xs text-white font-sans placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>
          </div>

          {/* Table Container with graphical cell indicators (Section 12 & 13) */}
          <div className="overflow-x-auto max-h-[440px] custom-scrollbar border border-white/[0.08] rounded-xl">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-[rgba(10,16,30,0.98)] backdrop-blur-md text-slate-400 uppercase tracking-widest text-[10.5px] font-mono font-bold border-b border-white/[0.1] z-10">
                <tr>
                  <th className="px-4 py-3.5">#</th>
                  <th className="px-4 py-3.5">Column Name</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Completeness</th>
                  <th className="px-4 py-3.5">Uniqueness</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredColumns.map((col, i) => {
                  const completenessPct = Math.round(
                    ((overview.total_rows - col.null_count) / (overview.total_rows || 1)) * 100
                  );
                  const uniquenessPct = Math.min(
                    100,
                    Math.round((col.unique_count / (overview.total_rows || 1)) * 100)
                  );

                  return (
                    <tr
                      key={col.name}
                      className="min-h-[48px] hover:bg-white/[0.04] hover:border-l-2 hover:border-l-cyan-400 hover:translate-x-[1px] transition-all group/row"
                    >
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px] group-hover/row:text-slate-400">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3.5 text-white font-sans font-semibold group-hover/row:text-cyan-200">
                        <span className="hover:underline cursor-default">{col.name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-[10px] font-mono uppercase font-semibold">
                          {col.inferred_type}
                        </span>
                      </td>

                      {/* Completeness with inline visual mini-bar: ██████████████ 100% */}
                      <td className="px-4 py-3.5 font-mono text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                            <div
                              style={{ width: `${completenessPct}%` }}
                              className={`h-full ${
                                completenessPct === 100
                                  ? 'bg-emerald-400'
                                  : completenessPct >= 90
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                          </div>
                          <span className={completenessPct === 100 ? 'text-emerald-400' : 'text-amber-400'}>
                            {completenessPct}% <span className="text-slate-500 text-[10px]">({col.null_count} nulls)</span>
                          </span>
                        </div>
                      </td>

                      {/* Uniqueness with inline distribution ratio mini-bar */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                        <div className="flex items-center gap-2.5">
                          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                            <div
                              style={{ width: `${uniquenessPct}%` }}
                              className="h-full bg-cyan-400/80"
                            />
                          </div>
                          <span>{col.unique_count.toLocaleString()} <span className="text-slate-500 text-[10px]">unique</span></span>
                        </div>
                      </td>

                      {/* Health Status badge */}
                      <td className="px-4 py-3.5">
                        {col.null_count === 0 ? (
                          <span className="text-xs font-sans text-emerald-400 font-medium flex items-center gap-2 leading-none">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
                            Complete
                          </span>
                        ) : (
                          <span className="text-xs font-sans text-amber-400 font-medium flex items-center gap-2 leading-none">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#F59E0B]" />
                            {Math.round((col.null_count / overview.total_rows) * 100)}% Missing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard3D>
      </motion.div>

      {/* ============================================================== */}
      {/* 5. SAMPLE DATA (LEVEL 2 SURFACE - VERIFIED PREVIEW)            */}
      {/* Interactive hover, left accent line, numeric cell illumination */}
      {/* ============================================================== */}
      <motion.div variants={sampleDataVariant} initial="hidden" animate="visible" className="w-full relative z-[2]">
        <GlassCard3D 
          accentColor="cyan" 
          surfaceLevel={2}
          className="p-6 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE]" />
                <h2 className="text-lg sm:text-[19px] font-sans font-bold text-white tracking-wide uppercase">
                  SAMPLE DATA (FIRST 5 RECORDS)
                </h2>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
                <p className="text-[11px] font-mono text-emerald-400 font-semibold tracking-wide uppercase">
                  VERIFIED STORAGE PREVIEW
                </p>
                <span className="text-slate-600">•</span>
                <p className="text-xs text-slate-400 font-sans">
                  Exact raw dataset ingestion preview from verified storage
                </p>
              </div>
            </div>

            <button
              onClick={() => setCurrentStage('QUALITY')}
              className="text-xs font-sans font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors group/viewFull"
            >
              <span>Inspect All Data</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover/viewFull:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[380px] custom-scrollbar border border-white/[0.08] rounded-xl max-w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-[rgba(10,16,30,0.98)] backdrop-blur-md text-slate-400 text-[10.5px] font-mono font-bold tracking-wider border-b border-white/[0.1] z-10">
                <tr>
                  {columns.map((col, i) => (
                    <th key={i} className="px-4 py-3.5 font-bold">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono text-xs text-slate-300">
                {Array.from({
                  length: Math.min(5, Math.max(...columns.map((c) => c.sample_values?.length || 0))),
                }).map((_, rowIndex) => (
                  <tr 
                    key={rowIndex} 
                    className="min-h-[48px] hover:bg-white/[0.04] hover:border-l-2 hover:border-l-cyan-400 hover:-translate-y-[1px] transition-all group/row"
                  >
                    {columns.map((col, colIndex) => {
                      const val = col.sample_values?.[rowIndex];
                      const isNumeric = !isNaN(Number(val)) && val !== null && val !== '';
                      const displayVal =
                        val === null || val === undefined ? (
                          <span className="text-slate-600 italic">null</span>
                        ) : (
                          String(val)
                        );
                      return (
                        <td 
                          key={colIndex} 
                          className={`px-4 py-3.5 transition-colors ${
                            isNumeric ? 'group-hover/row:text-cyan-200' : ''
                          }`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard3D>
      </motion.div>

      {/* ============================================================== */}
      {/* 6. INTELLIGENCE PIPELINE (BOTTOM LEVEL 3 CONTROL CENTER)        */}
      {/* Continuous SVG data stream, 3D elevated stages, interactive    */}
      {/* ============================================================== */}
      <motion.div variants={pipelineVariant} initial="hidden" animate="visible" className="w-full relative z-[2]">
        <GlassCard3D 
          accentColor="cyan" 
          surfaceLevel={3}
          className="p-6 sm:p-7 transition-all duration-300 relative overflow-hidden"
          style={{ isolation: 'isolate' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE]" />
                <h2 className="text-lg sm:text-[19px] font-sans font-bold text-white tracking-wide uppercase">
                  INTELLIGENCE PIPELINE
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-1">
                Sequential workflow progression from raw ingestion to evidence-backed decisioning
              </p>
            </div>

            <button
              onClick={() => setCurrentStage('QUALITY')}
              className="text-xs font-sans font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors self-start sm:self-auto group/pipelineLink"
            >
              <span>Explore Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/pipelineLink:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Continuous Connected Intelligence Stream Container (Strictly bounded) */}
          <div className="relative pb-1 overflow-hidden" style={{ isolation: 'isolate' }}>
            
            {/* SVG Animated Continuous Stream Pulse - bounded between stage 1 center (8.33%) and stage 6 center (91.67%) */}
            <div className="pipeline-track absolute top-[32px] left-[8.33%] right-[8.33%] h-[2px] hidden lg:block pointer-events-none z-0 overflow-hidden">
              <svg className="w-full h-[2px] overflow-hidden block" preserveAspectRatio="none">
                {/* Base passive wire */}
                <line x1="0%" y1="1" x2="100%" y2="1" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                
                {/* Dynamic animated intelligence stream pulse */}
                {!prefersReducedMotion && (
                  <motion.line
                    x1="0%"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke="url(#pipeline-stream-gradient)"
                    strokeWidth="2"
                    strokeDasharray="16 28"
                    animate={{ strokeDashoffset: [0, -352] }}
                    transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                
                <defs>
                  <linearGradient id="pipeline-stream-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Stages: 01 QUALITY -> 02 CLEANING -> 03 ANALYSIS -> 04 INSIGHTS -> 05 DECISIONS -> 06 EVIDENCE */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4 relative z-[2]">
              {[
                { 
                  id: 'QUALITY', 
                  step: '01', 
                  label: 'QUALITY', 
                  status: 'AUDITED', 
                  icon: ShieldCheck, 
                  active: true, 
                  completed: true,
                  note: 'Automated constraints & health checked'
                },
                { 
                  id: 'CLEANING', 
                  step: '02', 
                  label: 'CLEANING', 
                  status: activityLogs.length > 0 ? 'COMPLETED' : 'READY', 
                  icon: Sparkles, 
                  active: false, 
                  completed: activityLogs.length > 0,
                  note: 'Outlier handling & standardization'
                },
                { 
                  id: 'ANALYSIS', 
                  step: '03', 
                  label: 'ANALYSIS', 
                  status: 'STANDBY', 
                  icon: Activity, 
                  active: false, 
                  completed: false,
                  note: 'Statistical modeling & correlation discovery'
                },
                { 
                  id: 'INSIGHTS', 
                  step: '04', 
                  label: 'INSIGHTS', 
                  status: insightsCount > 0 ? `${insightsCount} DETECTED` : 'STANDBY', 
                  icon: Lightbulb, 
                  active: false, 
                  completed: insightsCount > 0,
                  note: 'High-impact pattern extraction & signals'
                },
                { 
                  id: 'DECISIONS', 
                  step: '05', 
                  label: 'DECISIONS', 
                  status: decisionsCount > 0 ? `${decisionsCount} PRESCRIBED` : 'STANDBY', 
                  icon: TrendingUp, 
                  active: false, 
                  completed: decisionsCount > 0,
                  note: 'Algorithmic policy recommendations'
                },
                { 
                  id: 'EVIDENCE', 
                  step: '06', 
                  label: 'EVIDENCE', 
                  status: 'STANDBY', 
                  icon: Network, 
                  active: false, 
                  completed: false,
                  note: 'Causal graphs & audit-grade lineage'
                },
              ].map((stage) => {
                const Icon = stage.icon;
                const isHovered = hoveredPipelineStage === stage.id;

                return (
                  <button
                    key={stage.id}
                    onClick={() => setCurrentStage(stage.id)}
                    onMouseEnter={() => setHoveredPipelineStage(stage.id)}
                    onMouseLeave={() => setHoveredPipelineStage(null)}
                    style={{
                      transform: isHovered && !prefersReducedMotion ? 'perspective(800px) rotateX(1deg) translateY(-4px)' : 'none',
                      transition: 'transform 0.25s ease-out, border-color 0.25s, box-shadow 0.25s',
                    }}
                    className={`pipeline-stage p-4 rounded-xl border text-left relative z-[2] overflow-hidden flex flex-col justify-between min-h-[120px] select-none backdrop-blur-md
                      ${
                        stage.active
                          ? 'bg-[#07162c]/95 border-cyan-500/50 shadow-[0_8px_24px_rgba(34,211,238,0.22)]'
                          : stage.completed
                          ? 'bg-[#06181b]/95 border-emerald-500/30 hover:border-emerald-400/50'
                          : 'bg-[#070e1c]/95 border-white/5 hover:border-cyan-500/35 hover:bg-[#0c172a]'
                      }`}
                  >
                    {/* Active / Hover Glowing Underline Indicator */}
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-[2.5px] transition-all duration-200
                      ${
                        stage.active
                          ? 'bg-cyan-400 shadow-[0_0_10px_#22D3EE]'
                          : stage.completed
                          ? 'bg-emerald-400/70 shadow-[0_0_8px_#34D399]'
                          : 'bg-transparent group-hover:bg-cyan-400/40'
                      }`}
                    />

                    <div className="flex items-center justify-between w-full mb-2 relative z-10">
                      <div
                        style={{
                          transform: isHovered && !prefersReducedMotion ? 'translateZ(5px)' : 'none',
                          transition: 'transform 0.25s ease-out',
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 relative z-10 ${
                          stage.active
                            ? 'bg-[#0b2742] border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                            : stage.completed
                            ? 'bg-[#0b2920] border border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                            : 'bg-[#0c182e] border border-white/10 text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <span className="font-mono text-[10.5px] text-slate-500 font-bold relative z-10">
                        {stage.step}
                      </span>
                    </div>

                    <div>
                      <div className="font-sans text-xs font-bold tracking-wide text-white">
                        {stage.label}
                      </div>
                      
                      <div className={`font-mono text-[9.5px] tracking-wider uppercase mt-0.5 font-semibold ${
                        stage.active ? 'text-cyan-300' : stage.completed ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {stage.status}
                      </div>

                      {/* Brief contextual stage note */}
                      <p className="font-sans text-[10.5px] text-slate-400 mt-1 line-clamp-1 leading-snug">
                        {stage.note}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </GlassCard3D>
      </motion.div>

      {/* ============================================================== */}
      {/* 7. RESTORED WORKFLOW PRIMARY ACTION (CONTINUE TO...)          */}
      {/* Level 3 surface, light sweep, dynamic stage destination        */}
      {/* ============================================================== */}
      <motion.div variants={continueCtaVariant} initial="hidden" animate="visible" className="w-full relative z-[2]">
        <GlassCard3D 
          accentColor="cyan" 
          surfaceLevel={3}
          enableTilt={true}
          className="p-6 sm:p-8 relative overflow-hidden group/cta shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
        >
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[10.5px] font-bold tracking-widest uppercase inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE]" />
                  NEXT STEP
                </span>
              </div>
              
              <h3 className="text-lg sm:text-xl font-sans font-bold text-white tracking-tight">
                {nextStepInfo.title}
              </h3>
              
              <p className="text-xs sm:text-sm text-slate-400 font-sans leading-relaxed">
                {nextStepInfo.description}
              </p>
            </div>

            <button
              onClick={() => setCurrentStage(nextStepInfo.stage)}
              style={{
                boxShadow: '0 0 25px rgba(34, 211, 238, 0.35)',
              }}
              className="px-7 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-600 text-slate-950 font-sans font-extrabold text-xs sm:text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-3 hover:shadow-[0_0_35px_rgba(34,211,238,0.55)] hover:-translate-y-1 active:translate-y-0 active:scale-98 group/ctaBtn shrink-0"
            >
              <span>{nextStepInfo.buttonLabel}</span>
              <ArrowRight className="w-4 h-4 text-slate-950 group-hover/ctaBtn:translate-x-1.5 transition-transform duration-200" />
            </button>
          </div>
        </GlassCard3D>
      </motion.div>

    </div>
  );
};
