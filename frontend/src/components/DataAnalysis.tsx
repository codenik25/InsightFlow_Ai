import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Database, 
  RefreshCw, 
  Info, 
  Layers, 
  Activity,
  ChevronDown
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { fetchEDA, generateEDA } from '../services/api';
import { 
  EDAResponse, 
  DistributionStats
} from '../types';

interface DataAnalysisProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

type ChartType = 'area' | 'line' | 'bar';

interface KPIDropdownOption {
  id: string;
  column: string;
  label: string;
  sourceType: 'trend' | 'category' | 'numeric';
  dataRef?: any;
}

// ============================================================================
// HELPER: Human-readable column formatting (Dynamic, no hardcoding)
// ============================================================================
const formatColumnName = (col: string): string => {
  if (!col) return '';
  return col
    .split('_')
    .map(word => {
      const lower = word.toLowerCase();
      if (lower === 'pct' || lower === 'percent' || lower === 'percentage') return '%';
      if (lower === 'id') return 'ID';
      if (lower === 'iqr') return 'IQR';
      if (lower === 'kpi') return 'KPI';
      if (lower === 'avg') return 'Average';
      if (lower === 'min') return 'Min';
      if (lower === 'max') return 'Max';
      if (lower === 'std') return 'Std';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// ============================================================================
// HELPER: Smart metric formatting by column nature
// ============================================================================
const formatMetricValue = (val: number, colName: string): string => {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  const lower = colName.toLowerCase();
  const isPct = lower.includes('pct') || lower.includes('percent') || lower.includes('rate');
  const isInt = Number.isInteger(val) && !isPct;

  const formattedNum = isInt
    ? val.toLocaleString()
    : val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  if (isPct) {
    return `${formattedNum}%`;
  }
  return formattedNum;
};

// ============================================================================
// COUNT-UP NUMERICAL COMPONENT (Section 7 & 28)
// Smoothly counts from 0 -> actual value over 700-900ms with easing.
// Runs strictly once on mount. Respects prefers-reduced-motion.
// ============================================================================
const CountUpValue: React.FC<{
  value: number | string;
  duration?: number;
  decimals?: number;
}> = ({ value, duration = 800, decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState<number | string>(() => {
    if (typeof value !== 'number') return value;
    return 0;
  });

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    let animFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Easing: easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = progress === 1 ? value : ease * value;
      setDisplayValue(current);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [value, duration]);

  if (typeof value !== 'number') return <>{value}</>;
  const num = typeof displayValue === 'number' ? displayValue : value;
  return (
    <>
      {num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
};

// ============================================================================
// LUXURY ANALYTICAL PANEL COMPONENT (Sections 21, 22, 23, 25)
// - Primary Surface: rgba(7, 15, 28, 0.78)
// - Elevated Surface: rgba(12, 22, 38, 0.90)
// - Subtle depth on hover: translateY(-2px), rotateX(0.4deg), rotateY(0.4deg), perspective 1400px
// - Mouse-following pointer reflection
// - Optional analytical scan sweep line
// ============================================================================
interface AnalyticalPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  enableTilt?: boolean;
  surfaceLevel?: 'primary' | 'elevated';
  accent?: 'cyan' | 'blue' | 'violet' | 'neutral';
  showScanLine?: boolean;
}

const AnalyticalPanel: React.FC<AnalyticalPanelProps> = ({
  children,
  className = '',
  enableTilt = false,
  surfaceLevel = 'primary',
  accent = 'neutral',
  showScanLine = false,
  ...props
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    setMousePos({ x: Math.round(xRatio * 100), y: Math.round(yRatio * 100) });

    if (enableTilt) {
      const rotY = (xRatio - 0.5) * 0.8;
      const rotX = (0.5 - yRatio) * 0.8;
      setRotate({
        x: Math.min(0.4, Math.max(-0.4, rotX)),
        y: Math.min(0.4, Math.max(-0.4, rotY)),
      });
    }
  };

  const handleMouseEnter = () => {
    if (!reducedMotion) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
    setMousePos({ x: 50, y: 50 });
  };

  const accentBorderHover = useMemo(() => {
    switch (accent) {
      case 'cyan': return 'hover:border-cyan-500/25';
      case 'blue': return 'hover:border-blue-500/25';
      case 'violet': return 'hover:border-violet-500/25';
      default: return 'hover:border-slate-400/22';
    }
  }, [accent]);

  const bgSurface = surfaceLevel === 'elevated' 
    ? 'rgba(12, 22, 38, 0.90)' 
    : 'rgba(7, 15, 28, 0.78)';

  return (
    <div
      ref={panelRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '1400px',
        transformStyle: 'preserve-3d',
        transform: reducedMotion ? 'none' : `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: isHovered ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 300ms ease-out',
        background: bgSurface,
        borderColor: 'rgba(148, 163, 184, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
      }}
      className={`relative border backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 ${accentBorderHover} ${className}`}
      {...props}
    >
      {/* Hero Analytical Scan Line */}
      {showScanLine && !reducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[15px] z-0">
          <div className="absolute top-0 bottom-0 w-36 bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent animate-hero-scan" />
        </div>
      )}

      {/* Subtle pointer reflection */}
      {!reducedMotion && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[15px] opacity-100 transition-opacity duration-300 overflow-hidden z-0"
          style={{
            background: `radial-gradient(circle 300px at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.04), transparent 40%)`,
          }}
        />
      )}
      <div className="relative z-[1] w-full">
        {children}
      </div>
    </div>
  );
};

export const DataAnalysis: React.FC<DataAnalysisProps> = ({ 
  processedDatasetId, 
  setCurrentStage 
}) => {
  const [edaData, setEdaData] = useState<EDAResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic KPI Selector state
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chart view type
  const [chartType, setChartType] = useState<ChartType>('area');
  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState<number>(0);
  const [hoveredCatIdx, setHoveredCatIdx] = useState<number | null>(null);

  // Mouse parallax for subtle atmospheric shift
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Dropdown click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGlobalMouseMove = useCallback((e: React.MouseEvent) => {
    if (prefersReducedMotion) return;
    const { clientX, clientY } = e;
    const xOffset = ((clientX / window.innerWidth) - 0.5) * 6; // max ±3px
    const yOffset = ((clientY / window.innerHeight) - 0.5) * 6;
    setMouseParallax({ x: xOffset, y: yOffset });
  }, [prefersReducedMotion]);

  const loadEDA = useCallback(async () => {
    if (!processedDatasetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEDA(processedDatasetId);
      setEdaData(data);
    } catch (err: any) {
      console.warn('Failed to load existing EDA, attempting to generate...', err);
      try {
        const genData = await generateEDA(processedDatasetId);
        setEdaData(genData);
      } catch (genErr: any) {
        setErrorMsg(genErr.message || 'Unable to generate exploratory analysis for the processed dataset.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadEDA();
  }, [loadEDA]);

  // ==========================================================================
  // DYNAMIC KPI OPTIONS BUILDER (Sections 1 & 2: Real numeric columns only)
  // Dynamically constructed from backend EDA response data without hardcoding.
  // ==========================================================================
  const kpiOptions = useMemo<KPIDropdownOption[]>(() => {
    if (!edaData) return [];
    const options: KPIDropdownOption[] = [];
    const seenCols = new Set<string>();

    // 1. First add all metrics with real time-series trends
    edaData.trends.forEach(t => {
      const col = t.measure;
      if (!seenCols.has(col)) {
        seenCols.add(col);
        options.push({
          id: `trend-${col}`,
          column: col,
          label: formatColumnName(col),
          sourceType: 'trend',
          dataRef: t,
        });
      }
    });

    // 2. Add any remaining numeric columns from distributions that don't have trends yet
    edaData.distributions.forEach(d => {
      const col = d.column;
      if (!seenCols.has(col)) {
        seenCols.add(col);
        // Check if there is a category breakdown for this column
        const cat = edaData.category_breakdowns.find(c => c.measure === col);
        options.push({
          id: cat ? `cat-${col}` : `dist-${col}`,
          column: col,
          label: formatColumnName(col),
          sourceType: cat ? 'category' : 'numeric',
          dataRef: cat || d,
        });
      }
    });

    return options;
  }, [edaData]);

  // Set default selected metric once options are loaded
  useEffect(() => {
    if (kpiOptions.length > 0 && !selectedMetricId) {
      setSelectedMetricId(kpiOptions[0].id);
    }
  }, [kpiOptions, selectedMetricId]);

  const selectedOption = useMemo(() => {
    return kpiOptions.find(opt => opt.id === selectedMetricId) || kpiOptions[0];
  }, [kpiOptions, selectedMetricId]);

  // Handle switching KPI with smooth analytical transition (Section 4)
  const handleSelectMetric = (metricId: string) => {
    if (metricId === selectedMetricId) {
      setIsDropdownOpen(false);
      return;
    }
    setIsTransitioning(true);
    setIsDropdownOpen(false);
    // Smooth transition sequence: dim old chart, swap data, animate new line
    setTimeout(() => {
      setSelectedMetricId(metricId);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 200);
    }, 220);
  };

  // Chart data extraction for selected KPI
  const chartData = useMemo(() => {
    if (!selectedOption || !edaData) return [];
    
    // Check if trend exists for this column
    const trend = edaData.trends.find(t => t.measure === selectedOption.column);
    if (trend && trend.time_series.length > 0) {
      return trend.time_series.map(pt => ({
        label: pt.period,
        value: pt.value,
      }));
    }

    // Check if category breakdown exists
    const cat = edaData.category_breakdowns.find(c => c.measure === selectedOption.column);
    if (cat && cat.grouped_data.length > 0) {
      return cat.grouped_data.map(pt => ({
        label: pt.category_value,
        value: pt.metric_value,
      }));
    }

    return [];
  }, [selectedOption, edaData]);

  // Correlation helpers
  const sortedRelationships = useMemo(() => {
    if (!edaData?.relationships) return [];
    return [...edaData.relationships].sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [edaData?.relationships]);

  const primaryRelationship = sortedRelationships.length > 0 ? sortedRelationships[0] : null;

  // Staggered Editorial Entrance Animations (Section 27: ~1.3s total)
  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const sectionVariants: any = {
    hidden: { 
      opacity: 0, 
      y: prefersReducedMotion ? 0 : 14, 
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: { 
        duration: prefersReducedMotion ? 0.2 : 0.45, 
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const metricCardVariants: any = {
    hidden: { 
      opacity: 0, 
      y: prefersReducedMotion ? 0 : 8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: { 
        duration: prefersReducedMotion ? 0.15 : 0.38, 
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  // ============================================================================
  // 1. EMPTY STATE: NO PROCESSED DATASET
  // ============================================================================
  if (!processedDatasetId) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center min-h-[500px]">
        <AnalyticalPanel 
          className="p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center mb-6 text-cyan-400">
            <Database className="w-7 h-7" />
          </div>
          <span className="font-mono text-xs text-cyan-400 font-semibold tracking-wider uppercase mb-2">
            PRE-REQUISITE REQUIRED
          </span>
          <h2 className="text-2xl font-sans font-bold text-white mb-3 tracking-tight">
            No Processed Dataset Artifact
          </h2>
          <p className="text-slate-400 font-sans text-sm max-w-md mb-8 leading-relaxed">
            Analysis requires a cleaned and verified dataset artifact. Navigate to the Data Cleaning stage to execute transformations and generate the processed dataset.
          </p>
          <button 
            onClick={() => setCurrentStage('CLEANING')}
            className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans text-[13.5px] font-semibold tracking-wide transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Data Cleaning</span>
          </button>
        </AnalyticalPanel>
      </div>
    );
  }

  // ============================================================================
  // 2. LOADING STATE
  // ============================================================================
  if (isLoading) {
    return (
      <ContinuousIntelligenceEngine
        mode="analysis"
        isLoading={isLoading}
        isFullScreen={true}
        error={errorMsg}
        onRetry={loadEDA}
      />
    );
  }

  // ============================================================================
  // 3. ERROR STATE
  // ============================================================================
  if (errorMsg || !edaData) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center min-h-[500px]">
        <AnalyticalPanel 
          className="p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-400">
            <Info className="w-7 h-7" />
          </div>
          <span className="font-mono text-xs text-amber-400 font-semibold tracking-wider uppercase mb-2">
            EXPLORATORY DATA ANALYSIS
          </span>
          <h2 className="text-2xl font-sans font-bold text-white mb-3 tracking-tight">
            Analysis Unavailable
          </h2>
          <p className="text-slate-400 font-sans text-sm max-w-md mb-8 leading-relaxed">
            {errorMsg || 'Unable to compute exploratory statistical distributions for this processed dataset artifact.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button 
              onClick={loadEDA}
              className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans text-[13.5px] font-semibold tracking-wide flex items-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Analysis</span>
            </button>
            <button 
              onClick={() => setCurrentStage('CLEANING')}
              className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 font-sans text-[13.5px] font-semibold tracking-wide border border-slate-700/60 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Cleaning</span>
            </button>
          </div>
        </AnalyticalPanel>
      </div>
    );
  }

  const { overview_kpis, discovered_kpis, category_breakdowns, trends, distributions } = edaData;
  const activeCategory = category_breakdowns[selectedCategoryIdx] || category_breakdowns[0];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onMouseMove={handleGlobalMouseMove}
      className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-7 min-w-0 relative"
    >
      {/* Background Atmosphere Layers with subtle parallax (Section 24 & 26) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
        <div 
          className="absolute -top-24 left-1/4 w-[600px] h-[320px] bg-cyan-950/20 rounded-full blur-[140px] transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${mouseParallax.x * -1}px, ${mouseParallax.y * -1}px, 0)` }}
        />
        <div 
          className="absolute top-1/2 right-1/4 w-[500px] h-[350px] bg-indigo-950/15 rounded-full blur-[160px] transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${mouseParallax.x}px, ${mouseParallax.y}px, 0)` }}
        />
      </div>

      {/* ============================================================== */}
      {/* 1. HERO — ANALYTICAL SCAN (Section 3 & 4)                      */}
      {/* ============================================================== */}
      <motion.section variants={sectionVariants} className="w-full relative z-[2]">
        <AnalyticalPanel 
          accent="cyan"
          showScanLine={true}
          className="p-6 sm:p-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5">
              {/* Overline & State */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-cyan-400 tracking-wider uppercase">
                  STATISTICAL INTELLIGENCE
                </span>
                <span className="text-slate-600 text-xs">•</span>
                <span className="font-mono text-xs text-slate-400 tracking-wider">
                  STAGE 03 / 06
                </span>
              </div>

              {/* Title: 44–48px, font-weight 800, tracking: -0.04em */}
              <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-sans font-extrabold tracking-[-0.04em] text-white leading-[1.05]">
                ANALYSIS & VISUAL SIGNALS
              </h1>

              {/* Subtitle */}
              <p className="text-[14px] sm:text-[15px] font-sans font-normal text-slate-300/90 max-w-[650px] leading-relaxed">
                Explore the mathematical structure, frequency distributions, inter-variable correlations, and longitudinal trends within the verified dataset.
              </p>

              {/* Supporting Metadata Strip */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/50 font-mono text-xs text-slate-300">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 uppercase text-[11px]">PROCESSED DATASET:</span>
                  <span className="font-medium text-white select-all">
                    {processedDatasetId}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 font-sans text-xs font-semibold text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
                  <span>ANALYSIS READY</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/50 font-mono text-xs text-slate-300">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  <span>{overview_kpis.total_rows.toLocaleString()} OBSERVATIONS</span>
                </div>
              </div>
            </div>

            {/* Back to Cleaning Button */}
            <div className="self-start lg:self-center shrink-0">
              <button 
                onClick={() => setCurrentStage('CLEANING')}
                className="h-10 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white font-sans text-[13px] font-semibold border border-slate-700/60 transition-all duration-150 flex items-center gap-2 group/backBtn hover:-translate-y-0.5"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover/backBtn:-translate-x-0.5 transition-transform" />
                <span>Back to Cleaning</span>
              </button>
            </div>
          </div>
        </AnalyticalPanel>
      </motion.section>

      {/* ============================================================== */}
      {/* 2. DATASET SNAPSHOT — COMPOSITION STRIP (Section 5)            */}
      {/* ============================================================== */}
      <motion.section variants={sectionVariants} className="w-full relative z-[2]">
        <AnalyticalPanel className="p-6">
          <div className="flex items-center justify-between mb-5 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-[15px] font-sans font-semibold text-slate-200 uppercase tracking-wider">
                Dataset Composition Strip
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {overview_kpis.total_columns} total features mapped
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 lg:divide-x divide-slate-800/80">
            {/* Column 1: ROWS with Density Graphic */}
            <div className="pt-2 sm:pt-0 lg:pr-5 space-y-2">
              <span className="font-sans text-[13px] font-medium text-slate-400 uppercase tracking-wider block">
                ROWS
              </span>
              <div className="text-[32px] font-sans font-extrabold text-white tracking-tight leading-tight">
                <CountUpValue value={overview_kpis.total_rows} duration={750} />
              </div>
              <div className="pt-1 space-y-1.5">
                <div className="h-5 flex items-end gap-1 overflow-hidden">
                  {[45, 70, 85, 60, 95, 80, 50, 90, 75, 60, 85, 100, 70, 90, 60, 80].map((h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-sm bg-cyan-400/40"
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: i * 0.025 }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                  <span>complete population</span>
                  <span className="text-cyan-400 font-semibold">100% density</span>
                </div>
              </div>
            </div>

            {/* Column 2: COLUMNS with Discrete Segments */}
            <div className="pt-4 sm:pt-0 sm:pl-5 lg:px-5 space-y-2">
              <span className="font-sans text-[13px] font-medium text-slate-400 uppercase tracking-wider block">
                COLUMNS
              </span>
              <div className="text-[32px] font-sans font-extrabold text-white tracking-tight leading-tight">
                <CountUpValue value={overview_kpis.total_columns} duration={750} />
              </div>
              <div className="pt-1 space-y-1.5">
                <div className="h-3 flex items-center gap-1 overflow-hidden">
                  {Array.from({ length: Math.min(16, overview_kpis.total_columns) }).map((_, i) => (
                    <motion.div
                      key={i}
                      className={`h-full flex-1 rounded-sm ${i < overview_kpis.measure_count ? 'bg-cyan-500' : 'bg-violet-500'}`}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: i * 0.03 }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                  <span className="text-cyan-400">{overview_kpis.measure_count} Numeric</span>
                  <span className="text-violet-400">{overview_kpis.dimension_count} Categorical</span>
                </div>
              </div>
            </div>

            {/* Column 3: NUMERIC MEASURES */}
            <div className="pt-4 lg:pt-0 lg:px-5 space-y-2">
              <span className="font-sans text-[13px] font-medium text-slate-400 uppercase tracking-wider block">
                NUMERIC MEASURES
              </span>
              <div className="text-[32px] font-sans font-extrabold text-cyan-400 tracking-tight leading-tight">
                <CountUpValue value={overview_kpis.measure_count} duration={750} />
              </div>
              <div className="pt-1 space-y-1.5">
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex">
                  <motion.div 
                    className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full" 
                    initial={{ width: 0 }}
                    animate={{ width: `${(overview_kpis.measure_count / Math.max(1, overview_kpis.total_columns)) * 100}%` }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: 0.2 }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                  <span>continuous measures</span>
                  <span className="font-semibold text-slate-300">{((overview_kpis.measure_count / Math.max(1, overview_kpis.total_columns)) * 100).toFixed(0)}% space</span>
                </div>
              </div>
            </div>

            {/* Column 4: CATEGORICAL FEATURES */}
            <div className="pt-4 lg:pt-0 lg:pl-5 space-y-2">
              <span className="font-sans text-[13px] font-medium text-slate-400 uppercase tracking-wider block">
                CATEGORICAL FEATURES
              </span>
              <div className="text-[32px] font-sans font-extrabold text-violet-400 tracking-tight leading-tight">
                <CountUpValue value={overview_kpis.dimension_count} duration={750} />
              </div>
              <div className="pt-1 space-y-1.5">
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex">
                  <motion.div 
                    className="bg-violet-500 h-full rounded-full" 
                    initial={{ width: 0 }}
                    animate={{ width: `${(overview_kpis.dimension_count / Math.max(1, overview_kpis.total_columns)) * 100}%` }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: 0.3 }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                  <span>discrete dimensions</span>
                  <span className="font-semibold text-slate-300">{((overview_kpis.dimension_count / Math.max(1, overview_kpis.total_columns)) * 100).toFixed(0)}% space</span>
                </div>
              </div>
            </div>
          </div>
        </AnalyticalPanel>
      </motion.section>

      {/* ============================================================== */}
      {/* 3. KEY DISCOVERED METRICS (Sections 6 & 7)                     */}
      {/* ============================================================== */}
      {discovered_kpis && discovered_kpis.length > 0 && (
        <motion.section variants={sectionVariants} className="w-full relative z-[2] space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE]" />
            <div>
              <h2 className="text-[19px] font-sans font-bold text-white tracking-normal">
                KEY DISCOVERED METRICS
              </h2>
              <p className="text-[13px] font-sans font-normal text-slate-400 mt-0.5">
                Automatically derived statistical signals from the processed dataset
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {discovered_kpis.slice(0, 8).map((kpi, idx) => {
              const dist = distributions.find(d => {
                if (kpi.source_column && d.column === kpi.source_column) return true;
                const kn = kpi.name.toLowerCase().replace(/[\s_]+/g, '');
                const dn = d.column.toLowerCase().replace(/[\s_]+/g, '');
                return kn === dn || kn.includes(dn) || dn.includes(kn);
              });

              const trend = trends.find(t => {
                if (kpi.source_column && t.measure === kpi.source_column) return true;
                const kn = kpi.name.toLowerCase().replace(/[\s_]+/g, '');
                const tm = t.measure.toLowerCase().replace(/[\s_]+/g, '');
                return kn === tm || kn.includes(tm) || tm.includes(kn);
              });

              const kpiType = kpi.metric_type?.toLowerCase() || '';
              const kpiNameLower = kpi.name.toLowerCase();
              const isAverage = kpiType === 'mean' || kpiNameLower.includes('average') || kpiNameLower.includes('mean');
              const isMedian = kpiType === 'median' || kpiNameLower.includes('median');
              const isMin = kpiType === 'min' || kpiNameLower.includes('min');
              const isMax = kpiType === 'max' || kpiNameLower.includes('max');
              const hasTrendSeries = trend && trend.time_series && trend.time_series.length > 2;

              const isDecimal = typeof kpi.value === 'number' && !Number.isInteger(kpi.value);

              return (
                <motion.div 
                  key={idx} 
                  variants={metricCardVariants}
                  transition={{ delay: idx * 0.045 }}
                >
                  <AnalyticalPanel 
                    enableTilt={true}
                    className="p-5 flex flex-col justify-between min-h-[164px]"
                  >
                    <div>
                      <span className="font-sans text-[14px] font-semibold text-slate-300 truncate block" title={kpi.name}>
                        {kpi.name}
                      </span>

                      <div className="mt-2.5 mb-3">
                        <div className="text-[34px] font-sans font-extrabold text-white tracking-tight leading-none">
                          <CountUpValue 
                            value={kpi.value} 
                            duration={800} 
                            decimals={isDecimal ? 2 : 0} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="w-full pt-2.5 border-t border-slate-800/80">
                      {isAverage && dist ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                            <span>mean relative to bounds</span>
                            <span className="text-cyan-400 font-semibold">μ: {dist.mean.toFixed(1)}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-900 relative overflow-hidden">
                            <motion.div 
                              className="absolute top-0 bottom-0 w-2.5 h-full bg-cyan-400 rounded-full shadow-[0_0_6px_#22D3EE]"
                              initial={{ left: '0%' }}
                              animate={{ 
                                left: `${Math.min(95, Math.max(5, dist.max > dist.min ? ((dist.mean - dist.min) / (dist.max - dist.min)) * 100 : 50))}%` 
                              }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      ) : isMedian && dist ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                            <span>median center value</span>
                            <span className="text-cyan-400 font-semibold">Q2: {dist.p50.toFixed(0)}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-900 relative overflow-hidden">
                            <motion.div 
                              className="absolute top-0 bottom-0 w-3 h-full bg-cyan-400 rounded-full shadow-[0_0_6px_#22D3EE]"
                              initial={{ left: '0%' }}
                              animate={{ 
                                left: `${Math.min(95, Math.max(5, dist.max > dist.min ? ((dist.p50 - dist.min) / (dist.max - dist.min)) * 100 : 50))}%` 
                              }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      ) : (isMin || isMax) && dist ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                            <span>boundary bound</span>
                            <span className="text-slate-300 font-semibold">[{dist.min} — {dist.max}]</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-900 relative">
                            <div 
                              className={`absolute top-0 bottom-0 w-2 h-full rounded-full shadow-[0_0_6px_#22D3EE] ${isMin ? 'bg-cyan-400 left-0' : 'bg-cyan-400 right-0'}`} 
                            />
                          </div>
                        </div>
                      ) : hasTrendSeries ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-slate-400">
                            {trend.time_series.length} observed periods
                          </span>
                          <div className="w-24 h-5 shrink-0">
                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                              {(() => {
                                const pts = trend.time_series;
                                const minVal = Math.min(...pts.map(p => p.value));
                                const maxVal = Math.max(...pts.map(p => p.value));
                                const range = Math.max(1, maxVal - minVal);
                                const coords = pts.map((p, i) => {
                                  const x = (i / (pts.length - 1)) * 96;
                                  const y = 18 - ((p.value - minVal) / range) * 14;
                                  return { x, y };
                                });
                                const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                                const lastPt = coords[coords.length - 1];

                                return (
                                  <>
                                    <motion.path 
                                      d={pathD} 
                                      fill="none" 
                                      stroke="#38D8FF" 
                                      strokeWidth="1.5" 
                                      strokeLinecap="round"
                                      initial={{ pathLength: 0 }}
                                      animate={{ pathLength: 1 }}
                                      transition={{ duration: prefersReducedMotion ? 0 : 0.9, ease: 'easeOut' }}
                                    />
                                    <circle 
                                      cx={lastPt.x} 
                                      cy={lastPt.y} 
                                      r="2" 
                                      fill="#38D8FF" 
                                    />
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                          <span>verified aggregate</span>
                          <span className="text-slate-500">stable</span>
                        </div>
                      )}
                    </div>
                  </AnalyticalPanel>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 4. PRIMARY CHART — CINEMATIC VISUALIZATION WORKSTATION         */}
      {/* Sections 1, 2, 4, 8, 9, 10, 11, 13, 14: Dynamic KPI Selector   */}
      {/* ============================================================== */}
      <motion.section variants={sectionVariants} className="w-full relative z-[2]">
        <AnalyticalPanel 
          accent="cyan"
          className="p-6 sm:p-8 space-y-6"
        >
          {/* Header & Controls: Sections 1, 2, 6, 13 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#38D8FF]" />
                <span className="font-sans text-xs font-semibold text-cyan-400 tracking-wider uppercase">
                  PRIMARY SIGNAL
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-xs text-slate-400">
                  {chartData.length} observations
                </span>
              </div>
              {/* Dynamic Chart Title: Section 6 */}
              <h3 className="text-[20px] font-sans font-bold text-white tracking-tight mt-1">
                {selectedOption ? `${selectedOption.label} Over Time` : 'Analytical Trajectory'}
              </h3>
            </div>

            {/* Controls Bar: Sections 1, 2, 3, 8 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Premium Functional KPI Selector Dropdown (Sections 1, 2, 3) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  className="h-11 px-4 min-w-[220px] sm:min-w-[250px] max-w-[280px] rounded-xl bg-slate-900/90 hover:bg-slate-850 text-slate-100 font-sans text-[13.5px] font-semibold border border-slate-700/70 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-3 shadow-md group/btn"
                  aria-haspopup="listbox"
                  aria-expanded={isDropdownOpen}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-[#38D8FF] shadow-[0_0_6px_#38D8FF]" />
                    <span className="truncate text-white font-medium">
                      {selectedOption ? selectedOption.label : 'Select Metric'}
                    </span>
                  </div>
                  <ChevronDown 
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180 text-cyan-400' : 'group-hover/btn:text-slate-200'}`} 
                  />
                </button>

                {/* Animated Dropdown Menu (Section 2 & 3) */}
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute top-full right-0 sm:left-0 mt-1.5 w-72 max-h-80 overflow-y-auto bg-[rgba(8,16,32,0.98)] border border-slate-700/80 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50 divide-y divide-slate-800/60"
                    role="listbox"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Available Metrics</span>
                      <span className="text-cyan-400">{kpiOptions.length} total</span>
                    </div>
                    <div className="py-1 space-y-0.5">
                      {kpiOptions.map((opt) => {
                        const isSelected = opt.id === selectedMetricId;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectMetric(opt.id)}
                            className={`w-full px-3 py-2 text-left rounded-lg text-[13px] font-sans transition-colors flex items-center justify-between gap-2 ${
                              isSelected 
                                ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30' 
                                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <span className="truncate">{opt.label}</span>
                            <span className="shrink-0 font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
                              {opt.sourceType === 'trend' ? 'TIME SERIES' : 'OBSERVED'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Segmented Control: AREA | LINE | BAR (Section 8) */}
              <div className="inline-flex rounded-xl bg-slate-900 border border-slate-700/70 p-0.5">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-3 py-2 rounded-lg font-sans text-[12.5px] font-semibold transition-colors ${
                    chartType === 'area' ? 'bg-cyan-500/20 text-[#38D8FF] border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  AREA
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-2 rounded-lg font-sans text-[12.5px] font-semibold transition-colors ${
                    chartType === 'line' ? 'bg-cyan-500/20 text-[#38D8FF] border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  LINE
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-2 rounded-lg font-sans text-[12.5px] font-semibold transition-colors ${
                    chartType === 'bar' ? 'bg-cyan-500/20 text-[#38D8FF] border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  BAR
                </button>
              </div>
            </div>
          </div>

          {/* Plotting Region with Smooth Analytical KPI Transition (Sections 4, 9, 10, 11) */}
          <div 
            className={`w-full h-[430px] sm:h-[460px] pt-1 transition-all duration-300 ${
              isTransitioning ? 'opacity-30 blur-[1.5px] scale-[0.995]' : 'opacity-100 blur-0 scale-100'
            }`}
          >
            {chartData.length === 0 ? (
              /* Factual Unsupported State: Section 5 */
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900/30 rounded-xl border border-slate-800">
                <Info className="w-8 h-8 text-slate-500 mb-3" />
                <span className="font-mono text-xs text-slate-400 uppercase tracking-widest block mb-1">
                  VISUALIZATION UNAVAILABLE
                </span>
                <p className="text-slate-400 text-sm max-w-sm">
                  No compatible longitudinal or categorical series is available for {selectedOption?.label || 'this metric'}.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={chartData} margin={{ top: 12, right: 20, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="area-editorial-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38D8FF" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#38D8FF" stopOpacity={0.005} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.10)" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="rgba(226, 232, 240, 0.65)" 
                      fontSize={12} 
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }}
                      dy={10}
                    />
                    <YAxis 
                      stroke="rgba(226, 232, 240, 0.65)" 
                      fontSize={12} 
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                      dx={-10}
                    />
                    {/* Crosshair & Tooltip (Section 11, 14, 15) */}
                    <Tooltip 
                      cursor={{ stroke: 'rgba(56, 216, 255, 0.45)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = Number(payload[0].value);
                          const colName = selectedOption?.column || '';
                          return (
                            <div className="bg-[#0A1324]/95 backdrop-blur-md border border-slate-700/70 rounded-xl p-3.5 shadow-2xl min-w-[170px]">
                              <span className="font-mono text-xs text-slate-400 block uppercase tracking-wider mb-1">
                                {selectedOption?.sourceType === 'trend' ? 'PERIOD / DATE' : 'CATEGORY'}
                              </span>
                              <p className="font-sans text-[13.5px] font-semibold text-slate-200 mb-2">
                                {label}
                              </p>
                              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between gap-3">
                                <span className="font-sans text-xs text-slate-400 truncate max-w-[110px]">
                                  {selectedOption?.label || 'Value'}
                                </span>
                                <span className="font-mono text-[15px] font-bold text-[#38D8FF]">
                                  {formatMetricValue(val, colName)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#38D8FF" 
                      strokeWidth={2.2} 
                      fill="url(#area-editorial-gradient)" 
                      activeDot={{ r: 6, fill: '#38D8FF', stroke: '#02050A', strokeWidth: 3 }}
                      animationDuration={prefersReducedMotion ? 0 : 1100}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 12, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.10)" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="rgba(226, 232, 240, 0.65)" 
                      fontSize={12} 
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }}
                      dy={10}
                    />
                    <YAxis 
                      stroke="rgba(226, 232, 240, 0.65)" 
                      fontSize={12} 
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                      dx={-10}
                    />
                    <Tooltip 
                      cursor={{ stroke: 'rgba(56, 216, 255, 0.45)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = Number(payload[0].value);
                          const colName = selectedOption?.column || '';
                          return (
                            <div className="bg-[#0A1324]/95 backdrop-blur-md border border-slate-700/70 rounded-xl p-3.5 shadow-2xl min-w-[170px]">
                              <span className="font-mono text-xs text-slate-400 block uppercase tracking-wider mb-1">
                                {selectedOption?.sourceType === 'trend' ? 'PERIOD / DATE' : 'CATEGORY'}
                              </span>
                              <p className="font-sans text-[13.5px] font-semibold text-slate-200 mb-2">
                                {label}
                              </p>
                              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between gap-3">
                                <span className="font-sans text-xs text-slate-400 truncate max-w-[110px]">
                                  {selectedOption?.label || 'Value'}
                                </span>
                                <span className="font-mono text-[15px] font-bold text-[#38D8FF]">
                                  {formatMetricValue(val, colName)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#38D8FF" 
                      strokeWidth={2.2} 
                      dot={false}
                      activeDot={{ r: 6, fill: '#38D8FF', stroke: '#02050A', strokeWidth: 3 }}
                      animationDuration={prefersReducedMotion ? 0 : 1100}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 12, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.10)" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="rgba(226, 232, 240, 0.65)" 
                      fontSize={12} 
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }}
                      dy={10}
                    />
                    <YAxis 
                      stroke="rgba(226, 232, 240, 0.65)" 
                      fontSize={12} 
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                      dx={-10}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = Number(payload[0].value);
                          const colName = selectedOption?.column || '';
                          return (
                            <div className="bg-[#0A1324]/95 backdrop-blur-md border border-slate-700/70 rounded-xl p-3.5 shadow-2xl min-w-[170px]">
                              <span className="font-mono text-xs text-slate-400 block uppercase tracking-wider mb-1">
                                CATEGORY
                              </span>
                              <p className="font-sans text-[13.5px] font-semibold text-slate-200 mb-2">
                                {label}
                              </p>
                              <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between gap-3">
                                <span className="font-sans text-xs text-slate-400 truncate max-w-[110px]">
                                  {selectedOption?.label || 'Value'}
                                </span>
                                <span className="font-mono text-[15px] font-bold text-[#38D8FF]">
                                  {formatMetricValue(val, colName)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#38D8FF" 
                      radius={[4, 4, 0, 0]} 
                      animationDuration={prefersReducedMotion ? 0 : 900}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </AnalyticalPanel>
      </motion.section>

      {/* ============================================================== */}
      {/* 5. CORRELATION & CATEGORY (Sections 12, 13, 14, 15, 16, 17)    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start relative z-[2]">
        
        {/* LEFT (lg:col-span-5): CORRELATION RELATIONSHIP GRAPH */}
        <motion.section variants={sectionVariants} className="lg:col-span-5 space-y-4">
          <AnalyticalPanel 
            accent="violet"
            className="p-6 sm:p-7 space-y-6"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_#818CF8]" />
                <h3 className="text-[18px] font-sans font-bold text-white tracking-normal">
                  CORRELATION INTELLIGENCE
                </h3>
              </div>
              <p className="text-[13px] font-sans font-normal text-slate-400 mt-0.5">
                Variable interdependence & linear relationships
              </p>
            </div>

            {primaryRelationship ? (
              <div className="space-y-6">
                {/* Visual Relationship Vector Graph (Section 12 & 22) */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 text-center space-y-4">
                  <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    RELATIONSHIP VECTOR
                  </span>

                  {/* Node A ──── Vector ──── Node B */}
                  <div className="relative py-3">
                    <div className="flex items-center justify-between gap-2 px-2">
                      <div className="flex flex-col items-center gap-1.5 max-w-[130px]">
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-slate-950 shadow-[0_0_8px_#3B82F6]" />
                        <span className="font-sans text-xs font-bold text-white uppercase truncate" title={primaryRelationship.column_a}>
                          {primaryRelationship.column_a.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col items-center px-2">
                        <div className="text-[40px] font-sans font-extrabold text-white tracking-tight leading-none">
                          <CountUpValue 
                            value={primaryRelationship.correlation} 
                            duration={800} 
                            decimals={4} 
                          />
                        </div>
                        <span className="inline-block text-[11px] font-sans font-semibold text-cyan-400 uppercase tracking-wider mt-1">
                          {primaryRelationship.strength?.replace(/_/g, ' ') || 'STRONG POSITIVE'}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1.5 max-w-[130px]">
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_8px_#22D3EE]" />
                        <span className="font-sans text-xs font-bold text-white uppercase truncate" title={primaryRelationship.column_b}>
                          {primaryRelationship.column_b.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-8 pt-1">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <motion.path 
                          d="M 25 15 C 80 0, 160 0, 215 15" 
                          fill="none" 
                          stroke={primaryRelationship.correlation > 0 ? '#38D8FF' : '#8B5CF6'} 
                          strokeWidth={Math.min(3.5, Math.max(1.5, Math.abs(primaryRelationship.correlation) * 3.5))}
                          strokeDasharray="4 2"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="pt-1 space-y-2">
                    <div className="flex justify-between font-mono text-xs text-slate-400">
                      <span>NEGATIVE (-1.0)</span>
                      <span>0.0</span>
                      <span>POSITIVE (+1.0)</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 relative overflow-visible">
                      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-700/80" />
                      <motion.div 
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#38D8FF] border-2 border-slate-950 shadow-[0_0_10px_#38D8FF]"
                        initial={{ left: '50%' }}
                        animate={{ left: `${((primaryRelationship.correlation + 1) / 2) * 100}%` }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>

                {sortedRelationships.length > 1 && (
                  <div className="space-y-2.5 pt-1">
                    <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Secondary Ranked Pairs ({sortedRelationships.length - 1})
                    </span>
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {sortedRelationships.slice(1, 5).map((rel, idx) => {
                        const isPos = rel.correlation > 0;
                        const barWidth = Math.min(100, Math.max(8, Math.abs(rel.correlation) * 100));
                        return (
                          <div 
                            key={idx} 
                            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2"
                          >
                            <div className="flex items-center justify-between text-[14px]">
                              <div className="font-sans font-medium text-slate-200 truncate max-w-[210px]">
                                <span>{rel.column_a.replace(/_/g, ' ')}</span>
                                <span className="text-slate-500 mx-1.5">×</span>
                                <span>{rel.column_b.replace(/_/g, ' ')}</span>
                              </div>
                              <span className={`font-mono text-[13px] font-semibold ${isPos ? 'text-cyan-400' : 'text-violet-400'}`}>
                                {isPos ? '+' : ''}{rel.correlation.toFixed(3)}
                              </span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-slate-950 overflow-hidden">
                              <motion.div 
                                className={`h-full rounded-full ${isPos ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'bg-gradient-to-r from-violet-600 to-amber-500'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: 0.2 + idx * 0.05 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400 font-sans">
                Fewer than 2 numeric columns available for correlation pairing.
              </div>
            )}
          </AnalyticalPanel>
        </motion.section>

        {/* RIGHT (lg:col-span-7): CATEGORY INTELLIGENCE */}
        <motion.section variants={sectionVariants} className="lg:col-span-7 space-y-4">
          <AnalyticalPanel 
            accent="blue"
            className="p-6 sm:p-7 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60A5FA]" />
                  <h3 className="text-[18px] font-sans font-bold text-white tracking-normal">
                    CATEGORY INTELLIGENCE
                  </h3>
                </div>
                <p className="text-[13px] font-sans font-normal text-slate-400 mt-0.5">
                  Feature-level distribution and contribution breakdown
                </p>
              </div>

              {category_breakdowns.length > 1 && (
                <div className="relative self-start sm:self-auto">
                  <select
                    value={selectedCategoryIdx}
                    onChange={(e) => setSelectedCategoryIdx(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700/60 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-[12.5px] text-slate-200 font-sans outline-none cursor-pointer"
                  >
                    {category_breakdowns.map((cat, idx) => (
                      <option key={idx} value={idx}>
                        {cat.dimension.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {activeCategory ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800/80">
                  <div>
                    <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      MEASURE BY DIMENSION
                    </span>
                    <span className="font-sans text-[15px] font-bold text-white mt-0.5 block">
                      {activeCategory.measure.replace(/_/g, ' ')} by {activeCategory.dimension.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      {activeCategory.aggregation_method === 'mean' ? 'OVERALL AVERAGE' : 'TOTAL VALUE'}
                    </span>
                    <span className="font-mono text-lg font-bold text-cyan-400 block">
                      <CountUpValue value={activeCategory.total_measure_value} duration={750} />
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeCategory.top_category && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 border-l-2 border-l-emerald-500/80 space-y-1">
                      <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        TOP PERFORMER
                      </span>
                      <div className="text-white font-sans font-bold text-[15px] truncate" title={activeCategory.top_category.category_value}>
                        {activeCategory.top_category.category_value}
                      </div>
                      <div className="font-mono text-xs text-slate-300">
                        {activeCategory.top_category.metric_value.toLocaleString()}
                        {activeCategory.top_category.contribution_pct > 0 && ` (${activeCategory.top_category.contribution_pct}%)`}
                      </div>
                    </div>
                  )}

                  {activeCategory.bottom_category && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 border-l-2 border-l-amber-500/80 space-y-1">
                      <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        LOWEST PERFORMER
                      </span>
                      <div className="text-white font-sans font-bold text-[15px] truncate" title={activeCategory.bottom_category.category_value}>
                        {activeCategory.bottom_category.category_value}
                      </div>
                      <div className="font-mono text-xs text-slate-300">
                        {activeCategory.bottom_category.metric_value.toLocaleString()}
                        {activeCategory.bottom_category.contribution_pct > 0 && ` (${activeCategory.bottom_category.contribution_pct}%)`}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-1">
                  <span className="font-sans text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Distribution Breakdown ({activeCategory.grouped_data?.length || activeCategory.top_5?.length} categories)
                  </span>

                  <div className="space-y-3.5">
                    {(activeCategory.top_5 || activeCategory.grouped_data.slice(0, 5)).map((item: any, i: number) => {
                      const maxVal = Math.max(...(activeCategory.top_5 || activeCategory.grouped_data).map((c: any) => c.metric_value || 1));
                      const pct = Math.min(100, Math.max(6, ((item.metric_value / maxVal) * 100)));
                      const isHovered = hoveredCatIdx === i;
                      const hasHover = hoveredCatIdx !== null;

                      return (
                        <div 
                          key={i} 
                          onMouseEnter={() => setHoveredCatIdx(i)}
                          onMouseLeave={() => setHoveredCatIdx(null)}
                          className={`space-y-1.5 transition-opacity duration-200 cursor-pointer ${
                            hasHover && !isHovered ? 'opacity-55' : 'opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[14px]">
                            <span className={`font-sans font-medium truncate max-w-[260px] transition-colors ${
                              isHovered ? 'text-white font-semibold' : 'text-slate-200'
                            }`} title={item.category_value}>
                              {item.category_value}
                            </span>
                            <span className={`font-mono text-xs transition-colors ${
                              isHovered ? 'text-[#38D8FF] font-bold' : 'text-slate-300 font-semibold'
                            }`}>
                              {Number(item.metric_value).toLocaleString()}
                            </span>
                          </div>

                          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800/80 overflow-hidden">
                            <motion.div 
                              className={`h-full rounded-full transition-all duration-200 ${
                                isHovered 
                                  ? 'bg-[#38D8FF] shadow-[0_0_8px_#38D8FF]' 
                                  : 'bg-gradient-to-r from-blue-600/80 to-cyan-500/80'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ 
                                duration: prefersReducedMotion ? 0 : 0.7, 
                                delay: prefersReducedMotion ? 0 : (0.1 + i * 0.07),
                                ease: 'easeOut'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400 font-sans">
                No categorical dimension breakdowns available for this dataset.
              </div>
            )}
          </AnalyticalPanel>
        </motion.section>
      </div>

      {/* ============================================================== */}
      {/* 6. DATASET METRIC EXPLORER (Sections 18, 19, 20, 21, 24)       */}
      {/* ============================================================== */}
      {distributions && distributions.length > 0 && (
        <motion.section 
          variants={sectionVariants} 
          className="w-full relative z-[2] space-y-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE]" />
            <div>
              <h2 className="text-[19px] font-sans font-bold text-white tracking-normal">
                DATASET METRIC EXPLORER
              </h2>
              <p className="text-[13px] font-sans font-normal text-slate-400 mt-0.5">
                Statistical distribution parameters & quartile spread across numeric columns
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {distributions.map((dist: DistributionStats, idx: number) => {
              const range = Math.max(0.0001, dist.max - dist.min);
              const q1Pct = Math.min(100, Math.max(0, ((dist.p25 - dist.min) / range) * 100));
              const medianPct = Math.min(100, Math.max(0, ((dist.p50 - dist.min) / range) * 100));
              const q3Pct = Math.min(100, Math.max(0, ((dist.p75 - dist.min) / range) * 100));
              const iqrWidth = Math.max(4, q3Pct - q1Pct);

              const skewMarkerPct = Math.min(90, Math.max(10, 50 + (dist.skewness * 25)));

              return (
                <motion.div 
                  key={idx} 
                  variants={metricCardVariants}
                  transition={{ delay: idx * 0.04 }}
                >
                  <AnalyticalPanel 
                    enableTilt={true}
                    className="p-6 flex flex-col justify-between min-h-[260px]"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3.5">
                        <h4 className="font-sans text-[15px] font-semibold text-white truncate max-w-[170px]" title={dist.column}>
                          {dist.column.replace(/_/g, ' ')}
                        </h4>
                        {!dist.is_constant && (
                          <span className="font-mono text-xs text-slate-400">
                            IQR {dist.iqr.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </span>
                        )}
                      </div>

                      {dist.is_constant ? (
                        <div className="space-y-3 py-2">
                          <div className="text-[32px] font-sans font-extrabold text-white leading-none">
                            <CountUpValue value={dist.min} duration={600} />
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                            CONSTANT VALUE
                          </span>
                          <div className="w-full h-1 bg-slate-700/60 rounded-full my-2 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-950" />
                          </div>
                          <div className="border-t border-slate-800/80 pt-2 text-xs font-sans text-slate-400">
                            No observed variance across rows
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[11px] font-sans text-slate-400 block">Q1</span>
                              <span className="font-mono font-bold text-white text-[13px] block mt-0.5">
                                {dist.p25.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[11px] font-sans text-cyan-400 block">MEDIAN</span>
                              <span className="font-mono font-bold text-cyan-300 text-[13px] block mt-0.5">
                                {dist.p50.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[11px] font-sans text-slate-400 block">Q3</span>
                              <span className="font-mono font-bold text-white text-[13px] block mt-0.5">
                                {dist.p75.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center justify-between text-xs font-sans text-slate-400">
                              <span>Skewness: <strong className="font-mono text-slate-200">{dist.skewness.toFixed(3)}</strong></span>
                              <span>Zeros: <strong className="font-mono text-slate-200">{dist.zero_count}</strong></span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-950 border border-slate-800 relative">
                              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-700/80" />
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-sm"
                                style={{ left: `${skewMarkerPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="pt-2 space-y-1.5">
                            <div className="flex justify-between font-mono text-xs text-slate-400">
                              <span>{dist.min.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span className="text-cyan-400 font-semibold">{dist.p50.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span>{dist.max.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>

                            <div className="w-full h-3 rounded-md bg-slate-950 border border-slate-800 relative overflow-hidden flex items-center">
                              <div className="w-full h-0.5 bg-slate-800 absolute" />
                              
                              <motion.div 
                                className="absolute top-0.5 bottom-0.5 bg-cyan-500/20 border border-cyan-400/40 rounded-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: 0.2 }}
                                style={{ 
                                  left: `${q1Pct}%`, 
                                  width: `${iqrWidth}%` 
                                }}
                              />

                              <motion.div 
                                className="absolute top-0 bottom-0 w-1 bg-cyan-400 rounded-sm shadow-[0_0_6px_#22D3EE]"
                                initial={{ opacity: 0, scaleY: 0 }}
                                animate={{ opacity: 1, scaleY: 1 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: 0.3 }}
                                style={{ 
                                  left: `${medianPct}%`,
                                  transform: 'translateX(-50%)'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </AnalyticalPanel>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 7. CONTINUE TO INSIGHTS CTA (Section 31)                       */}
      {/* ============================================================== */}
      <motion.section 
        variants={sectionVariants} 
        className="w-full relative z-[2] pt-1"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <AnalyticalPanel 
          surfaceLevel="elevated"
          accent="cyan"
          className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                STAGE 03 COMPLETE
              </span>
            </div>

            <div className="w-48 h-0.5 bg-slate-800 rounded-full overflow-hidden mx-auto sm:mx-0">
              <motion.div 
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut' }}
              />
            </div>

            <h3 className="text-[19px] sm:text-[21px] font-sans font-bold text-white tracking-tight">
              Ready for Automated Business Insights
            </h3>
            <p className="text-slate-400 font-sans text-[13.5px] max-w-xl leading-relaxed">
              Statistical exploration and distribution modeling complete. Synthesize discovered patterns into executive business insights and decision signals.
            </p>
          </div>

          <button
            onClick={() => setCurrentStage('INSIGHTS')}
            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500 text-white font-sans text-[13.5px] font-bold tracking-wide uppercase transition-all duration-150 flex items-center justify-center gap-2.5 min-w-[240px] shadow-lg hover:-translate-y-0.5 active:translate-y-0 group/ctaBtn shrink-0"
          >
            <span>CONTINUE TO INSIGHTS</span>
            <ArrowRight className="w-4 h-4 group-hover/ctaBtn:translate-x-1 transition-transform" />
          </button>
        </AnalyticalPanel>
      </motion.section>
    </motion.div>
  );
};
