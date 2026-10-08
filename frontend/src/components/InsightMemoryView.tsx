import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BrainCircuit,
  Search,
  RefreshCw,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  AlertCircle,
  EyeOff,
  Filter,
  Layers,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldAlert,
  Zap,
  Check,
  Copy,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowRight,
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  InsightMemory,
  InsightMemoryCounters,
  InsightTimelineItem,
} from '../types';
import { fetchProjectInsightMemory, fetchDatasetInsightMemory } from '../services/api';

interface InsightMemoryViewProps {
  projectId?: string | null;
  datasetId?: string | null;
  datasetName?: string;
  onClearDatasetFilter?: () => void;
  onClose?: () => void;
}

export const InsightMemoryView: React.FC<InsightMemoryViewProps> = ({
  projectId,
  datasetId,
  datasetName = 'Hospital Operations',
  onClose,
}) => {
  const shouldReduceMotion = Boolean(useReducedMotion());

  const [items, setItems] = useState<InsightMemory[]>([]);
  const [timeline, setTimeline] = useState<InsightTimelineItem[]>([]);
  const [counters, setCounters] = useState<InsightMemoryCounters>({
    total: 0,
    new_count: 0,
    persisted_count: 0,
    strengthened_count: 0,
    weakened_count: 0,
    disappeared_count: 0,
  });
  const [versions, setVersions] = useState<number[]>([]);
  const [datasetLineage, setDatasetLineage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Explorer Controls
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('DEFAULT');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selected Detail Drawer
  const [selectedInsight, setSelectedInsight] = useState<InsightMemory | null>(null);

  // Optional Secondary Detailed Matrix Modal / Drawer
  const [showDetailedMatrix, setShowDetailedMatrix] = useState<boolean>(false);

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (datasetId) {
        res = await fetchDatasetInsightMemory(datasetId);
      } else if (projectId) {
        res = await fetchProjectInsightMemory(projectId);
      } else {
        setLoading(false);
        return;
      }
      setItems(res.items || []);
      setTimeline(res.timeline || []);
      setCounters(res.counters || {
        total: 0,
        new_count: 0,
        persisted_count: 0,
        strengthened_count: 0,
        weakened_count: 0,
        disappeared_count: 0,
      });
      setVersions(res.versions || [1]);
      setDatasetLineage(res.dataset_lineage || datasetName);
    } catch (err: any) {
      console.error('Failed to load insight memory:', err);
      setError(err.message || 'Unable to fetch insight memory.');
    } finally {
      setLoading(false);
    }
  }, [projectId, datasetId, datasetName]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Distinct dynamic categories derived from real data
  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((it) => {
      if (it.category) cats.add(it.category.toUpperCase());
    });
    return Array.from(cats);
  }, [items]);

  // Exact counts derived from loaded memory records
  const itemStats = useMemo(() => {
    let persisted = 0;
    let strengthened = 0;
    let weakened = 0;
    let disappeared = 0;
    let newCount = 0;
    items.forEach((it) => {
      const st = (it.status || '').toUpperCase();
      if (st === 'PERSISTED') persisted++;
      else if (st === 'STRENGTHENED') strengthened++;
      else if (st === 'WEAKENED') weakened++;
      else if (st === 'DISAPPEARED') disappeared++;
      else if (st === 'NEW') newCount++;
    });
    return {
      total: items.length,
      persisted,
      strengthened,
      weakened,
      disappeared,
      newCount,
    };
  }, [items]);

  // Filtered and sorted records
  const processedItems = useMemo(() => {
    let list = items.filter((item) => {
      const matchStatus = statusFilter === 'ALL' || item.status.toUpperCase() === statusFilter.toUpperCase();
      const matchCat = categoryFilter === 'ALL' || item.category.toUpperCase() === categoryFilter.toUpperCase();
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.affected_columns && item.affected_columns.some((c) => c.toLowerCase().includes(q))) ||
        item.insight_fingerprint.toLowerCase().includes(q) ||
        item.dataset_lineage.toLowerCase().includes(q);
      return matchStatus && matchCat && matchSearch;
    });

    if (sortBy === 'LATEST_SEEN') {
      list = [...list].sort((a, b) => b.latest_seen_version - a.latest_seen_version);
    } else if (sortBy === 'STRENGTH') {
      list = [...list].sort((a, b) => (b.strength_latest ?? 0) - (a.strength_latest ?? 0));
    } else if (sortBy === 'STATUS') {
      list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    } else if (sortBy === 'CATEGORY') {
      list = [...list].sort((a, b) => a.category.localeCompare(b.category));
    }

    return list;
  }, [items, statusFilter, categoryFilter, searchQuery, sortBy]);

  // Total pages calculation
  const totalPages = Math.max(1, Math.ceil(processedItems.length / pageSize));

  // Reset to first page when search/filter changes
  const handleStatusFilter = (st: string) => {
    setStatusFilter(st);
    setCurrentPage(1);
  };

  const handleCategoryFilter = (cat: string) => {
    setCategoryFilter(cat);
    setCurrentPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedItems.slice(start, start + pageSize);
  }, [processedItems, currentPage, pageSize]);

  const startIndex = processedItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(processedItems.length, currentPage * pageSize);


  // Featured memory insight (first record or highest delta)
  const featuredInsight = useMemo(() => {
    if (items.length === 0) return null;
    return items[0];
  }, [items]);

  // Disappeared insights list for targeted impact inspection
  const disappearedItems = useMemo(() => {
    return items.filter((i) => i.status.toUpperCase() === 'DISAPPEARED');
  }, [items]);

  // Distribution proportions for the horizontal memory state bar
  const memoryDistribution = useMemo(() => {
    const total = counters.total || (counters.new_count + counters.persisted_count + counters.strengthened_count + counters.weakened_count + counters.disappeared_count);
    if (total === 0) return null;

    return {
      total,
      newPct: (counters.new_count / total) * 100,
      strengthenedPct: (counters.strengthened_count / total) * 100,
      persistedPct: (counters.persisted_count / total) * 100,
      weakenedPct: (counters.weakened_count / total) * 100,
      disappearedPct: (counters.disappeared_count / total) * 100,
    };
  }, [counters]);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'NEW':
        return {
          label: 'NEW',
          color: '#39D6F5',
          bg: 'bg-[#39D6F5]/15 text-[#39D6F5] border-[#39D6F5]/30',
          dotBg: 'bg-[#39D6F5]',
          icon: Sparkles,
        };
      case 'STRENGTHENED':
        return {
          label: 'STRENGTHENED',
          color: '#35D399',
          bg: 'bg-[#35D399]/15 text-[#35D399] border-[#35D399]/30',
          dotBg: 'bg-[#35D399]',
          icon: TrendingUp,
        };
      case 'PERSISTED':
        return {
          label: 'PERSISTED',
          color: '#4D8DFF',
          bg: 'bg-[#4D8DFF]/15 text-[#4D8DFF] border-[#4D8DFF]/30',
          dotBg: 'bg-[#4D8DFF]',
          icon: Minus,
        };
      case 'WEAKENED':
        return {
          label: 'WEAKENED',
          color: '#F4B740',
          bg: 'bg-[#F4B740]/15 text-[#F4B740] border-[#F4B740]/30',
          dotBg: 'bg-[#F4B740]',
          icon: TrendingDown,
        };
      case 'DISAPPEARED':
        return {
          label: 'DISAPPEARED',
          color: '#F06B78',
          bg: 'bg-[#F06B78]/15 text-[#F06B78] border-[#F06B78]/30',
          dotBg: 'bg-[#F06B78]',
          icon: EyeOff,
        };
      default:
        return {
          label: status,
          color: '#8795A8',
          bg: 'bg-slate-900 text-[#8795A8] border-white/[0.08]',
          dotBg: 'bg-slate-500',
          icon: AlertCircle,
        };
    }
  };

  const currentVersion = versions.length > 0 ? Math.max(...versions) : 1;

  // Stride of versions for the horizontal memory evolution line
  const timelineVersionNodes = useMemo(() => {
    if (versions.length <= 8) return versions;
    // Sample 6-8 evenly spaced version milestones
    const step = Math.ceil(versions.length / 7);
    const sampled = versions.filter((_, i) => i % step === 0);
    const last = versions[versions.length - 1];
    if (!sampled.includes(last)) sampled.push(last);
    return sampled;
  }, [versions]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1550px] mx-auto py-6 px-3 sm:px-6 lg:px-8 font-sans text-[#F4F7FB] relative overflow-x-hidden">
      {/* Ambient Atmospheric Lighting */}
      <div className="absolute top-0 left-12 w-[520px] h-[520px] bg-gradient-to-br from-[#39D6F5]/10 via-[#4D8DFF]/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 right-12 w-[560px] h-[560px] bg-gradient-to-bl from-[#9B7BFF]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ============================================================== */}
      {/* 1. HERO HEADER: INSIGHT MEMORY OBSERVATORY                     */}
      {/* ============================================================== */}
      <motion.header
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl bg-[#020711]/85 border border-[rgba(120,190,230,0.16)] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        {/* Subtle Memory Field Waveform SVG Behind Hero */}
        {!shouldReduceMotion && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
            <svg viewBox="0 0 1200 160" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M 50 80 Q 250 20 500 80 T 950 80 T 1150 40"
                fill="none"
                stroke="rgba(57, 214, 245, 0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
              />
              <path
                d="M 50 80 H 1150"
                fill="none"
                stroke="rgba(155, 123, 255, 0.12)"
                strokeWidth="1"
              />
              {/* Traveling Memory Packet */}
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
                  offsetPath: "path('M 50 80 Q 250 20 500 80 T 950 80 T 1150 40')",
                }}
              />
            </svg>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3.5 py-1 rounded-full text-[12px] font-sans uppercase tracking-wider bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 font-bold flex items-center gap-2">
                <BrainCircuit className="w-3.5 h-3.5 text-[#39D6F5]" />
                TEMPORAL PATTERN INTELLIGENCE
              </span>
              <span className="text-[#8795A8] text-xs font-semibold">•</span>
              <span className="text-[#B8C5D5] text-[13px] font-semibold">PHASE 4 MEMORY LEDGER</span>
            </div>

            <h1 className="text-3xl sm:text-[46px] lg:text-[50px] font-sans font-bold tracking-tight text-white leading-[1.08]">
              INSIGHT MEMORY <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#9B7BFF]">OBSERVATORY</span>
            </h1>

            <p className="text-[15px] sm:text-[16px] font-sans text-[#B8C5D5] leading-[1.6]">
              Track how analytical patterns persist, strengthen, weaken, or disappear as datasets evolve across versions.
            </p>
          </div>

          {/* Right Header Badges & Refresh */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-left">
                <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">
                  CURRENT VERSION
                </span>
                <span className="text-[15px] font-mono font-bold text-[#39D6F5]">
                  v{currentVersion}
                </span>
              </div>

              <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-left">
                <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">
                  LINEAGE
                </span>
                <span className="text-[14px] font-sans font-bold text-white truncate max-w-[160px] block" title={datasetLineage || datasetName}>
                  {datasetLineage || datasetName}
                </span>
              </div>

              <button
                onClick={loadMemory}
                disabled={loading}
                className="h-[46px] px-5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-sans font-bold text-[13px] uppercase tracking-wider border border-white/[0.1] hover:border-[#39D6F5]/40 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-[#39D6F5] ${loading ? 'animate-spin' : ''}`} />
                <span>REFRESH</span>
              </button>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[13px] font-sans font-semibold text-[#8795A8] hover:text-white transition-colors"
              >
                ← Back to Inventory
              </button>
            )}
          </div>
        </div>
      </motion.header>

      {/* ============================================================== */}
      {/* 2. MEMORY STATUS: UNIFIED COMPOSITION & DISTRIBUTION           */}
      {/* ============================================================== */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="rounded-2xl bg-[#020711]/85 border border-white/[0.08] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.25)] space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div className="space-y-1">
            <h2 className="text-[19px] sm:text-[21px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-[#39D6F5]" />
              MEMORY STATUS & STATE DISTRIBUTION
            </h2>
            <p className="text-[14px] font-sans text-[#B8C5D5]">
              Quantified survival and evolution of analytical patterns across observed dataset updates.
            </p>
          </div>
          <span className="text-[13px] font-mono text-[#8795A8] px-4 py-1.5 rounded-full bg-slate-950 border border-white/[0.08]">
            {counters.total || (counters.new_count + counters.persisted_count + counters.strengthened_count + counters.weakened_count + counters.disappeared_count)} Total Patterns Tracked
          </span>
        </div>

        {/* 5 States Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* NEW */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-[#39D6F5]/25 text-center space-y-1.5">
            <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#39D6F5] flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              NEW
            </span>
            <div className="text-[32px] sm:text-[36px] font-sans font-bold text-white tracking-tight">
              {counters.new_count}
            </div>
            <span className="text-[12px] font-sans text-[#8795A8] block">First observed</span>
          </div>

          {/* STRENGTHENED */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-[#35D399]/25 text-center space-y-1.5">
            <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#35D399] flex items-center justify-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              STRENGTHENED
            </span>
            <div className="text-[32px] sm:text-[36px] font-sans font-bold text-[#35D399] tracking-tight">
              {counters.strengthened_count}
            </div>
            <span className="text-[12px] font-sans text-[#8795A8] block">Magnitude increased</span>
          </div>

          {/* PERSISTED (Dominant State) */}
          <div className="p-5 rounded-2xl bg-[#4D8DFF]/10 border border-[#4D8DFF]/40 text-center space-y-1.5 shadow-[0_0_30px_rgba(77,141,255,0.15)]">
            <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#4D8DFF] flex items-center justify-center gap-1.5">
              <Minus className="w-3.5 h-3.5" />
              PERSISTED
            </span>
            <div className="text-[32px] sm:text-[36px] font-sans font-bold text-white tracking-tight">
              {counters.persisted_count}
            </div>
            <span className="text-[12px] font-sans text-[#B8C5D5] block">Consistent findings</span>
          </div>

          {/* WEAKENED */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-[#F4B740]/25 text-center space-y-1.5">
            <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#F4B740] flex items-center justify-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              WEAKENED
            </span>
            <div className="text-[32px] sm:text-[36px] font-sans font-bold text-[#F4B740] tracking-tight">
              {counters.weakened_count}
            </div>
            <span className="text-[12px] font-sans text-[#8795A8] block">Signal attenuated</span>
          </div>

          {/* DISAPPEARED */}
          <div className="p-5 rounded-2xl bg-[#F06B78]/10 border border-[#F06B78]/30 text-center space-y-1.5 col-span-2 sm:col-span-1">
            <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#F06B78] flex items-center justify-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              DISAPPEARED
            </span>
            <div className="text-[32px] sm:text-[36px] font-sans font-bold text-[#F06B78] tracking-tight">
              {counters.disappeared_count}
            </div>
            <span className="text-[12px] font-sans text-rose-200 block">No longer supported</span>
          </div>
        </div>

        {/* Horizontal State Distribution Bar */}
        {memoryDistribution && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-[12px] font-sans text-[#8795A8]">
              <span>MEMORY STATE PROPORTIONS</span>
              <span>{counters.persisted_count} persisted ({memoryDistribution.persistedPct.toFixed(1)}%)</span>
            </div>
            <div className="h-3.5 rounded-full overflow-hidden flex bg-slate-900 border border-white/[0.08]">
              {memoryDistribution.newPct > 0 && (
                <div style={{ width: `${memoryDistribution.newPct}%` }} className="bg-[#39D6F5]" title={`New: ${counters.new_count}`} />
              )}
              {memoryDistribution.strengthenedPct > 0 && (
                <div style={{ width: `${memoryDistribution.strengthenedPct}%` }} className="bg-[#35D399]" title={`Strengthened: ${counters.strengthened_count}`} />
              )}
              {memoryDistribution.persistedPct > 0 && (
                <div style={{ width: `${memoryDistribution.persistedPct}%` }} className="bg-[#4D8DFF]" title={`Persisted: ${counters.persisted_count}`} />
              )}
              {memoryDistribution.weakenedPct > 0 && (
                <div style={{ width: `${memoryDistribution.weakenedPct}%` }} className="bg-[#F4B740]" title={`Weakened: ${counters.weakened_count}`} />
              )}
              {memoryDistribution.disappearedPct > 0 && (
                <div style={{ width: `${memoryDistribution.disappearedPct}%` }} className="bg-[#F06B78]" title={`Disappeared: ${counters.disappeared_count}`} />
              )}
            </div>
          </div>
        )}
      </motion.section>

      {/* ============================================================== */}
      {/* 3. MEMORY EVOLUTION: HORIZONTAL TEMPORAL TIMELINE              */}
      {/* ============================================================== */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="rounded-2xl bg-[#020711]/85 border border-white/[0.08] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.25)] space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="space-y-1">
            <h3 className="text-[19px] sm:text-[21px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#39D6F5]" />
              MEMORY EVOLUTION TIMELINE
            </h3>
            <p className="text-[14px] font-sans text-[#B8C5D5]">
              Chronological checkpoint trace across {versions.length} registered dataset versions.
            </p>
          </div>
          <span className="text-[12px] font-mono text-[#39D6F5] font-bold px-3.5 py-1.5 rounded-full bg-[#39D6F5]/10 border border-[#39D6F5]/25">
            Lineage Range: v{versions[0] || 1} → v{currentVersion}
          </span>
        </div>

        {/* Horizontal Timeline Track */}
        <div className="pt-4 pb-2 overflow-x-auto custom-scrollbar">
          <div className="relative min-w-max flex items-center justify-between px-6 py-4">
            {/* Background connection bar */}
            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 -z-0" />

            {timelineVersionNodes.map((v) => {
              const isCurrent = v === currentVersion;
              return (
                <div key={v} className="relative z-10 flex flex-col items-center gap-2 group">
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-[#39D6F5] text-slate-950 border-[#39D6F5] shadow-[0_0_20px_#39D6F5] scale-110 font-bold'
                        : 'bg-slate-950 border-slate-700 text-[#B8C5D5] group-hover:border-[#4D8DFF] group-hover:text-white'
                    }`}
                  >
                    <span className="text-[12px] font-mono font-bold">v{v}</span>
                  </div>
                  <span
                    className={`text-[12px] font-sans uppercase font-bold tracking-wider ${
                      isCurrent ? 'text-[#39D6F5]' : 'text-[#8795A8] group-hover:text-white'
                    }`}
                  >
                    {isCurrent ? 'LATEST' : `V${v}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* ============================================================== */}
      {/* 4. FEATURED MEMORY INSIGHT HIGHLIGHT                           */}
      {/* ============================================================== */}
      {featuredInsight && (
        <motion.section
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="rounded-2xl bg-[#020711]/90 border border-[rgba(57,214,245,0.25)] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.3)] space-y-6 relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#39D6F5]" />
              <h3 className="text-[19px] sm:text-[21px] font-sans font-bold text-white tracking-tight uppercase">
                FEATURED MEMORY PATTERN
              </h3>
            </div>
            <button
              onClick={() => setSelectedInsight(featuredInsight)}
              className="text-[13px] font-sans font-bold text-[#39D6F5] hover:text-white flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <span>INSPECT EVIDENCE DETAILS</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-lg text-[12px] font-sans font-bold bg-[#4D8DFF]/15 text-[#4D8DFF] border border-[#4D8DFF]/30 uppercase">
                {featuredInsight.category}
              </span>
              <span className={`px-3 py-1 rounded-lg text-[12px] font-sans font-bold uppercase border ${getStatusBadge(featuredInsight.status).bg}`}>
                {getStatusBadge(featuredInsight.status).label}
              </span>
              <span className="text-[13px] font-mono text-[#8795A8]">
                First Observed: v{featuredInsight.first_seen_version} → Latest: v{featuredInsight.latest_seen_version}
              </span>
            </div>

            <h4 className="text-[20px] sm:text-[22px] font-sans font-bold text-white tracking-tight leading-[1.3]">
              {featuredInsight.title}
            </h4>

            {featuredInsight.impact_summary && (
              <p className="text-[14px] sm:text-[15px] font-sans text-[#B8C5D5] leading-[1.6]">
                {featuredInsight.impact_summary}
              </p>
            )}

            {/* Metric Metrics & Sparkline Evidence Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/[0.06]">
                <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">BASELINE STRENGTH</span>
                <span className="text-[18px] font-mono font-bold text-white block mt-1">
                  {featuredInsight.strength_baseline != null ? featuredInsight.strength_baseline.toFixed(4) : 'N/A'}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/[0.06]">
                <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">LATEST STRENGTH</span>
                <span className="text-[18px] font-mono font-bold text-[#39D6F5] block mt-1">
                  {featuredInsight.strength_latest != null ? featuredInsight.strength_latest.toFixed(4) : 'N/A'}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/[0.06]">
                <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">DELTA MAGNITUDE</span>
                <span className="text-[18px] font-mono font-bold text-[#35D399] block mt-1">
                  {featuredInsight.delta_magnitude != null ? featuredInsight.delta_magnitude.toFixed(4) : '0.0000'}
                </span>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 5. DOWNSTREAM IMPACT & DISAPPEARED SIGNALS FOCUS               */}
      {/* ============================================================== */}
      {disappearedItems.length > 0 && (
        <motion.section
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl bg-[#020711]/90 border border-[#F06B78]/30 p-6 sm:p-8 shadow-[0_16px_50px_rgba(240,107,120,0.12)] space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#F06B78]/20">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-[#F06B78]" />
              <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight">
                DOWNSTREAM IMPACT: {disappearedItems.length} DISAPPEARED PATTERN{disappearedItems.length !== 1 ? 'S' : ''}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-[12px] font-sans font-bold uppercase tracking-wider bg-[#F06B78]/20 text-[#F06B78] border border-[#F06B78]/40">
              AUDIT REQUIRED
            </span>
          </div>
          <p className="text-[14px] font-sans text-[#B8C5D5] leading-[1.6]">
            The following analytical findings were previously active but are no longer observed in the latest dataset version (v{currentVersion}). Downstream policies formulated against these signals should be verified:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {disappearedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedInsight(item)}
                className="p-4 rounded-xl bg-slate-950/80 border border-[#F06B78]/20 hover:border-[#F06B78]/50 transition-colors cursor-pointer flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-sans font-bold text-[#F06B78] uppercase">{item.category}</span>
                    <span className="text-[11px] font-mono text-[#8795A8]">Seen: v{item.first_seen_version} → v{item.latest_seen_version}</span>
                  </div>
                  <h5 className="font-sans font-bold text-[14px] text-white truncate" title={item.title}>
                    {item.title}
                  </h5>
                </div>
                {item.impact_summary && (
                  <p className="text-[12px] font-sans text-[#8795A8] line-clamp-2">
                    {item.impact_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 6. INSIGHT MEMORY DATA EXPLORER (HIGH DENSITY 100-RECORD UI)  */}
      {/* ============================================================== */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="rounded-2xl bg-[#07111F]/85 border border-[#39D6F5]/15 p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.25)] space-y-6"
      >
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
          <div className="space-y-1">
            <h3 className="text-[20px] sm:text-[22px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-[#39D6F5]" />
              INSIGHT MEMORY EXPLORER
            </h3>
            <p className="text-[14px] sm:text-[15px] font-sans text-[#B8C5D5]">
              Search and filter analytical memory records by lifecycle state and dimension.
            </p>
          </div>

          {/* Prominent Record Counter */}
          <div className="flex items-center gap-2 self-start md:self-auto px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/[0.08] font-mono text-[13px] text-[#B8C5D5]">
            <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8]">Showing</span>
            <span className="text-[17px] font-bold text-white tracking-tight">
              {processedItems.length === 0 ? '0' : `${startIndex}–${endIndex}`}
            </span>
            <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8]">of</span>
            <span className="text-[18px] font-bold text-[#39D6F5] tracking-tight">{items.length}</span>
            <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8]">Records</span>
          </div>
        </div>

        {/* Compact Memory Summary Strip */}
        <div className="p-3 sm:p-4 rounded-xl bg-slate-950/70 border border-white/[0.06] flex flex-wrap items-center gap-2 sm:gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] mr-1 hidden sm:inline">
              MEMORY SNAPSHOT:
            </span>

            <button
              onClick={() => handleStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-[12px] font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'ALL'
                  ? 'bg-white/10 text-white font-bold border border-white/20'
                  : 'text-[#8795A8] hover:text-white'
              }`}
            >
              <span className="text-[11px] font-sans uppercase">TOTAL</span>
              <strong className="text-white text-[13px]">{itemStats.total}</strong>
            </button>

            <button
              onClick={() => handleStatusFilter('PERSISTED')}
              className={`px-3 py-1 rounded-lg text-[12px] font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'PERSISTED'
                  ? 'bg-[#4D8DFF]/20 text-[#4D8DFF] font-bold border border-[#4D8DFF]/40'
                  : 'text-[#8795A8] hover:text-[#4D8DFF]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#4D8DFF]" />
              <span className="text-[11px] font-sans uppercase">PERSISTED</span>
              <strong className="text-[#4D8DFF] text-[13px]">{itemStats.persisted}</strong>
            </button>

            <button
              onClick={() => handleStatusFilter('STRENGTHENED')}
              className={`px-3 py-1 rounded-lg text-[12px] font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'STRENGTHENED'
                  ? 'bg-[#35D399]/20 text-[#35D399] font-bold border border-[#35D399]/40'
                  : 'text-[#8795A8] hover:text-[#35D399]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#35D399]" />
              <span className="text-[11px] font-sans uppercase">STRENGTHENED</span>
              <strong className="text-[#35D399] text-[13px]">{itemStats.strengthened}</strong>
            </button>

            <button
              onClick={() => handleStatusFilter('WEAKENED')}
              className={`px-3 py-1 rounded-lg text-[12px] font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'WEAKENED'
                  ? 'bg-[#F4B740]/20 text-[#F4B740] font-bold border border-[#F4B740]/40'
                  : 'text-[#8795A8] hover:text-[#F4B740]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F4B740]" />
              <span className="text-[11px] font-sans uppercase">WEAKENED</span>
              <strong className="text-[#F4B740] text-[13px]">{itemStats.weakened}</strong>
            </button>

            <button
              onClick={() => handleStatusFilter('DISAPPEARED')}
              className={`px-3 py-1 rounded-lg text-[12px] font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'DISAPPEARED'
                  ? 'bg-[#F06B78]/20 text-[#F06B78] font-bold border border-[#F06B78]/40'
                  : 'text-[#8795A8] hover:text-[#F06B78]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F06B78]" />
              <span className="text-[11px] font-sans uppercase">DISAPPEARED</span>
              <strong className="text-[#F06B78] text-[13px]">{itemStats.disappeared}</strong>
            </button>

            <button
              onClick={() => handleStatusFilter('NEW')}
              className={`px-3 py-1 rounded-lg text-[12px] font-mono transition-all flex items-center gap-1.5 ${
                statusFilter === 'NEW'
                  ? 'bg-[#39D6F5]/20 text-[#39D6F5] font-bold border border-[#39D6F5]/40'
                  : 'text-[#8795A8] hover:text-[#39D6F5]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#39D6F5]" />
              <span className="text-[11px] font-sans uppercase">NEW</span>
              <strong className="text-[#39D6F5] text-[13px]">{itemStats.newCount}</strong>
            </button>
          </div>

          {/* Density / Rows Per Page Selector */}
          <div className="flex items-center gap-2 text-[12px] font-sans text-[#8795A8]">
            <span className="uppercase text-[11px]">Rows:</span>
            {[10, 20, 50].map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={`w-8 h-7 rounded text-[12px] font-mono font-bold transition-all ${
                  pageSize === size
                    ? 'bg-[#39D6F5] text-slate-950 font-bold'
                    : 'bg-slate-900 text-[#8795A8] hover:text-white hover:bg-slate-800'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/80 border border-white/[0.08]">
          {/* Lifecycle Segmented Control */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
            {['ALL', 'NEW', 'STRENGTHENED', 'PERSISTED', 'WEAKENED', 'DISAPPEARED'].map((st) => (
              <button
                key={st}
                onClick={() => handleStatusFilter(st)}
                className={`h-[44px] px-3.5 rounded-lg text-[12px] sm:text-[13px] font-sans font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-[#39D6F5] text-slate-950 shadow-[0_0_15px_rgba(57,214,245,0.3)]'
                    : 'bg-slate-900 text-[#8795A8] hover:text-white hover:bg-slate-800 border border-white/[0.06]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search, Category, and Sorting Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search memory records..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-[44px] pl-10 pr-9 bg-slate-900 border border-slate-700/80 rounded-lg text-[13px] text-white placeholder-[#8795A8] focus:outline-none focus:border-[#39D6F5] focus:ring-1 focus:ring-[#39D6F5]/40 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dynamic Category Selector */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryFilter(e.target.value)}
                className="h-[44px] appearance-none pl-3.5 pr-8 bg-slate-900 border border-slate-700/80 rounded-lg text-[13px] font-sans text-white focus:outline-none focus:border-[#39D6F5] focus:ring-1 focus:ring-[#39D6F5]/40 transition-all cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {dynamicCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sorting Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="h-[44px] appearance-none pl-3.5 pr-8 bg-slate-900 border border-slate-700/80 rounded-lg text-[13px] font-sans text-white focus:outline-none focus:border-[#39D6F5] focus:ring-1 focus:ring-[#39D6F5]/40 transition-all cursor-pointer"
              >
                <option value="DEFAULT">Sort: Default (Lineage)</option>
                <option value="LATEST_SEEN">Sort: Latest Seen</option>
                <option value="STRENGTH">Sort: Strength</option>
                <option value="STATUS">Sort: Status</option>
                <option value="CATEGORY">Sort: Category</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Disappeared Filter Alert Banner */}
        {statusFilter === 'DISAPPEARED' && (
          <div className="p-4 rounded-xl bg-[#F06B78]/10 border border-[#F06B78]/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <EyeOff className="w-5 h-5 text-[#F06B78] shrink-0" />
              <div>
                <h4 className="text-[14px] font-sans font-bold text-white uppercase tracking-tight">
                  DISAPPEARED MEMORY SIGNALS ({processedItems.length} RECORDS)
                </h4>
                <p className="text-[13px] font-sans text-rose-200">
                  These analytical patterns previously persisted but are no longer observed in the latest dataset version.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleStatusFilter('ALL')}
              className="text-[12px] font-sans font-bold text-[#F06B78] hover:text-white underline uppercase shrink-0"
            >
              View All States
            </button>
          </div>
        )}

        {/* Records Content Area */}
        {loading ? (
          <ContinuousIntelligenceEngine
            mode="memory"
            isLoading={loading}
            isFullScreen={false}
            minHeight="380px"
            error={error}
            onRetry={loadMemory}
          />
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-950/30 border border-[#F06B78]/40 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-[#F06B78] mx-auto" />
            <h4 className="text-[16px] font-sans font-bold text-white uppercase">MEMORY EXPLORER UNAVAILABLE</h4>
            <p className="text-[14px] text-rose-200">{error}</p>
            <button
              onClick={loadMemory}
              className="h-[40px] px-5 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-sans font-bold text-[13px] uppercase tracking-wider transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>RETRY</span>
            </button>
          </div>
        ) : processedItems.length === 0 ? (
          <div className="p-12 text-center text-[14px] font-sans text-[#8795A8] rounded-2xl bg-slate-950/50 border border-white/[0.06] space-y-3">
            <AlertCircle className="w-8 h-8 text-[#8795A8] mx-auto" />
            <p className="font-semibold text-white text-[16px]">NO MATCHING MEMORY SIGNALS</p>
            <p className="text-[13px]">
              No analytical memory records match the current filters
              {searchQuery ? ` for "${searchQuery}"` : ''}.
            </p>
            {(statusFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="mt-2 h-[38px] px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#39D6F5] border border-[#39D6F5]/30 text-[12px] font-sans font-bold uppercase tracking-wider transition-colors"
              >
                CLEAR ALL FILTERS
              </button>
            )}
          </div>
        ) : (
          /* Table / List Hybrid Container */
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-slate-950/80">
            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-900/90 border-b border-white/[0.08] text-[12px] font-sans font-bold uppercase tracking-wider text-[#8795A8]">
              <div className="col-span-2">STATUS</div>
              <div className="col-span-4">INSIGHT PATTERN</div>
              <div className="col-span-2">CATEGORY</div>
              <div className="col-span-2">VERSION RANGE</div>
              <div className="col-span-1">STRENGTH</div>
              <div className="col-span-1 text-right">ACTION</div>
            </div>

            {/* Rows List with Subtle Memory Stream Line */}
            <motion.div
              key={`${currentPage}-${statusFilter}-${categoryFilter}-${sortBy}`}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.6, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="divide-y divide-white/[0.04] relative"
            >
              {/* Continuous Memory Stream Vertical Line (Left) */}
              <div className="hidden lg:block absolute left-4 top-0 bottom-0 w-[1px] bg-white/[0.06] pointer-events-none" />

              {paginatedItems.map((item) => {
                const badge = getStatusBadge(item.status);
                const BadgeIcon = badge.icon;
                const isSelected = selectedInsight?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedInsight(item)}
                    className={`min-h-[76px] py-3.5 px-4 sm:px-5 transition-all cursor-pointer flex flex-col lg:grid lg:grid-cols-12 lg:items-center gap-3 group border-l-2 ${
                      isSelected
                        ? 'bg-[#39D6F5]/10 border-l-[#39D6F5]'
                        : 'hover:bg-white/[0.03] border-l-transparent hover:border-l-[#39D6F5]/50'
                    }`}
                    style={{ transform: 'translateZ(2px)' }}
                  >
                    {/* Status Column with Memory Stream Node */}
                    <div className="lg:col-span-2 flex items-center gap-2.5">
                      {/* Left stream node */}
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px] ${badge.dotBg}`} />

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider border flex items-center gap-1.5 shrink-0 ${badge.bg}`}
                      >
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {/* Insight Pattern Column */}
                    <div className="lg:col-span-4 min-w-0 space-y-1">
                      <h4
                        className="text-[14px] sm:text-[15px] font-sans font-semibold text-white group-hover:text-[#39D6F5] transition-colors leading-[1.4]"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                        <span>FP: #{item.insight_fingerprint.slice(0, 8)}</span>
                        {item.affected_columns && item.affected_columns.length > 0 && (
                          <span className="truncate max-w-[200px] text-[#8795A8]">
                            • {item.affected_columns.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Category Column */}
                    <div className="lg:col-span-2 flex items-center">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-sans font-bold uppercase bg-slate-900 text-[#B8C5D5] border border-white/[0.08] truncate max-w-[150px]">
                        {item.category}
                      </span>
                    </div>

                    {/* Version History Mini Timeline Column */}
                    <div className="lg:col-span-2 flex items-center">
                      <div className="flex flex-col gap-1 min-w-[110px]">
                        <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#B8C5D5]">
                          <span className="text-slate-400 font-semibold">v{item.first_seen_version}</span>
                          <div className="flex-1 h-[2px] bg-slate-800 relative flex items-center justify-between min-w-[36px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#39D6F5]" />
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'DISAPPEARED' ? 'bg-[#F06B78]' : 'bg-[#39D6F5]'
                              }`}
                            />
                          </div>
                          <span
                            className={`font-bold ${
                              item.status === 'DISAPPEARED' ? 'text-[#F06B78]' : 'text-[#39D6F5]'
                            }`}
                          >
                            v{item.latest_seen_version}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] font-sans text-slate-500 uppercase tracking-wider">
                          <span>First</span>
                          <span>{item.status === 'DISAPPEARED' ? 'Last' : 'Latest'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Strength Gauge Column */}
                    <div className="lg:col-span-1 flex items-center">
                      {item.strength_latest != null ? (
                        <div
                          className="flex flex-col gap-1 min-w-[80px]"
                          title={`Strength: ${item.strength_latest.toFixed(4)}${
                            item.delta_magnitude ? ` (Δ ${item.delta_magnitude.toFixed(4)})` : ''
                          }`}
                        >
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className="text-[14px] sm:text-[15px] font-bold text-white">
                              {item.strength_latest.toFixed(2)}
                            </span>
                            {item.delta_magnitude ? (
                              <span
                                className={`text-[10px] font-mono font-semibold ${
                                  item.status === 'STRENGTHENED'
                                    ? 'text-[#35D399]'
                                    : item.status === 'WEAKENED'
                                    ? 'text-[#F4B740]'
                                    : 'text-[#8795A8]'
                                }`}
                              >
                                {item.status === 'STRENGTHENED' ? '+' : item.status === 'WEAKENED' ? '-' : ''}
                                {item.delta_magnitude.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                          <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#4D8DFF] to-[#39D6F5]"
                              style={{ width: `${Math.min(100, Math.max(8, item.strength_latest * 100))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-[13px] text-slate-600">—</span>
                      )}
                    </div>

                    {/* Action Column */}
                    <div className="lg:col-span-1 flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInsight(item);
                        }}
                        className="h-[34px] px-3 rounded-lg bg-slate-900 group-hover:bg-[#39D6F5]/20 text-slate-400 group-hover:text-[#39D6F5] border border-white/[0.08] group-hover:border-[#39D6F5]/40 text-[12px] font-sans font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5"
                      >
                        <span>DETAILS</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Pagination Controls Footer */}
            <div className="p-4 bg-slate-900/90 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[13px] font-mono text-[#B8C5D5]">
                Showing <strong className="text-white">{startIndex}–{endIndex}</strong> of{' '}
                <strong className="text-white">{processedItems.length}</strong> matching records
                {items.length !== processedItems.length && ` (total ${items.length})`}
              </span>

              {/* Page navigation buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-[36px] px-3 rounded-lg bg-slate-950 border border-white/[0.08] text-[12px] font-sans font-bold uppercase text-[#8795A8] hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">PREV</span>
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;

                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-600 font-mono text-sm">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-[36px] h-[36px] rounded-lg text-[13px] font-mono font-bold transition-all ${
                            currentPage === p
                              ? 'bg-[#39D6F5] text-slate-950 shadow-[0_0_10px_rgba(57,214,245,0.4)]'
                              : 'bg-slate-950 text-[#8795A8] hover:text-white hover:bg-slate-800 border border-white/[0.08]'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-[36px] px-3 rounded-lg bg-slate-950 border border-white/[0.08] text-[12px] font-sans font-bold uppercase text-[#8795A8] hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1"
                >
                  <span className="hidden sm:inline">NEXT</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* ============================================================== */}
      {/* 7. SECONDARY DETAILED MATRIX VIEW TRIGGER                     */}
      {/* ============================================================== */}
      {timeline.length > 0 && versions.length > 1 && (
        <div className="p-6 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-center space-y-3">
          <SlidersHorizontal className="w-6 h-6 text-[#39D6F5] mx-auto" />
          <h4 className="text-[16px] font-sans font-bold text-white uppercase tracking-tight">
            DETAILED AUDIT MATRIX
          </h4>
          <p className="text-[14px] font-sans text-[#B8C5D5] max-w-lg mx-auto">
            Need to inspect cell-by-cell version presence across all {versions.length} versions? Open the internal version matrix.
          </p>
          <button
            onClick={() => setShowDetailedMatrix(true)}
            className="h-[44px] px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#39D6F5] hover:text-white border border-[#39D6F5]/40 text-[13px] font-sans font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
          >
            <span>VIEW DETAILED VERSION MATRIX</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. SLIDE-OVER INSIGHT HISTORY PANEL (INSPECTOR)                */}
      {/* ============================================================== */}
      <AnimatePresence>
        {selectedInsight && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInsight(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-2xl bg-[#020711] border-l border-white/[0.1] shadow-2xl p-6 sm:p-8 overflow-y-auto flex flex-col justify-between space-y-6 z-10"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between pb-5 border-b border-white/[0.08]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-0.5 rounded text-[11px] font-sans font-bold uppercase bg-slate-900 text-[#B8C5D5] border border-white/[0.08]">
                        {selectedInsight.category}
                      </span>
                      <span className={`px-3 py-0.5 rounded text-[11px] font-sans font-bold uppercase border ${getStatusBadge(selectedInsight.status).bg}`}>
                        {getStatusBadge(selectedInsight.status).label}
                      </span>
                    </div>
                    <h3 className="text-[20px] font-sans font-bold text-white tracking-tight leading-[1.3]">
                      {selectedInsight.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedInsight(null)}
                    className="p-2 text-[#8795A8] hover:text-white rounded-xl hover:bg-slate-900 border border-transparent hover:border-white/[0.08] transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Signature Memory Path Evolution */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8]">
                    <span>MEMORY PATH EVOLUTION</span>
                    <span className="font-mono text-[#39D6F5]">
                      v{selectedInsight.first_seen_version} → v{selectedInsight.latest_seen_version}
                    </span>
                  </div>
                  <div className="py-3 px-4 rounded-xl bg-slate-900/60 border border-white/[0.04]">
                    <div className="flex items-center justify-between font-mono text-[13px] text-white">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-sans uppercase text-[#8795A8] block">First Seen</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#39D6F5]" />
                          <span className="font-bold text-white">v{selectedInsight.first_seen_version}</span>
                        </div>
                      </div>
                      <div className="flex-1 mx-4 h-[2px] bg-slate-800 relative flex items-center justify-center">
                        <div className="absolute left-0 w-2.5 h-2.5 rounded-full bg-[#39D6F5]" />
                        <span className="text-[10px] font-mono text-slate-400 uppercase px-2 py-0.5 rounded bg-slate-950 border border-white/[0.06]">
                          {selectedInsight.status === 'DISAPPEARED' ? 'DISCONTINUED' : 'PERSISTED RANGE'}
                        </span>
                        <div
                          className={`absolute right-0 w-2.5 h-2.5 rounded-full ${
                            selectedInsight.status === 'DISAPPEARED' ? 'bg-[#F06B78]' : 'bg-[#35D399]'
                          }`}
                        />
                      </div>
                      <div className="space-y-0.5 text-right">
                        <span className="text-[10px] font-sans uppercase text-[#8795A8] block">
                          {selectedInsight.status === 'DISAPPEARED' ? 'Disappeared At' : 'Latest Seen'}
                        </span>
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`font-bold ${
                              selectedInsight.status === 'DISAPPEARED' ? 'text-[#F06B78]' : 'text-[#39D6F5]'
                            }`}
                          >
                            v{selectedInsight.latest_seen_version}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              selectedInsight.status === 'DISAPPEARED' ? 'bg-[#F06B78]' : 'bg-[#35D399]'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evidence & Evolution */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-4">
                  <span className="text-[12px] font-sans uppercase tracking-wider text-[#39D6F5] font-bold block">
                    ANALYTICAL EVIDENCE & EVOLUTION
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.04]">
                      <span className="text-[11px] font-sans text-[#8795A8] uppercase block">BASELINE STRENGTH</span>
                      <span className="text-[15px] font-mono font-bold text-white block mt-1">
                        {selectedInsight.strength_baseline != null ? selectedInsight.strength_baseline.toFixed(4) : 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.04]">
                      <span className="text-[11px] font-sans text-[#8795A8] uppercase block">LATEST STRENGTH</span>
                      <span className="text-[15px] font-mono font-bold text-[#39D6F5] block mt-1">
                        {selectedInsight.strength_latest != null ? selectedInsight.strength_latest.toFixed(4) : 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.04]">
                      <span className="text-[11px] font-sans text-[#8795A8] uppercase block">DELTA MAGNITUDE</span>
                      <span className="text-[15px] font-mono font-bold text-[#35D399] block mt-1">
                        {selectedInsight.delta_magnitude != null ? selectedInsight.delta_magnitude.toFixed(4) : '0.0000'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.04]">
                      <span className="text-[11px] font-sans text-[#8795A8] uppercase block">CURRENT STATE</span>
                      <span className="text-[14px] font-sans font-bold text-white block mt-1">
                        {selectedInsight.status}
                      </span>
                    </div>
                  </div>

                  {selectedInsight.impact_summary && (
                    <div className="pt-3 border-t border-white/[0.04]">
                      <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">STATEMENT</span>
                      <p className="text-[14px] font-sans text-[#B8C5D5] mt-1 leading-[1.6]">
                        {selectedInsight.impact_summary}
                      </p>
                    </div>
                  )}
                </div>

                {/* Affected Columns */}
                {selectedInsight.affected_columns && selectedInsight.affected_columns.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-bold block">
                      AFFECTED COLUMNS & DIMENSIONS
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedInsight.affected_columns.map((c) => (
                        <span key={c} className="px-3 py-1 rounded-lg bg-slate-900 text-white font-mono text-[12px] border border-white/[0.08]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lineage & Run Provenance */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-3 text-[13px] font-sans">
                  <span className="text-[12px] font-sans uppercase tracking-wider text-[#39D6F5] font-bold block">
                    LINEAGE & AUDIT PROVENANCE
                  </span>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-[#8795A8]">Dataset Lineage</span>
                      <span className="font-semibold text-white">{selectedInsight.dataset_lineage}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-[#8795A8]">Fingerprint</span>
                      <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#39D6F5]">
                        <span>{selectedInsight.insight_fingerprint}</span>
                        <button
                          onClick={() => handleCopy(selectedInsight.insight_fingerprint, 'fp')}
                          className="hover:text-white"
                          title="Copy Fingerprint"
                        >
                          {copiedId === 'fp' ? <Check className="w-3.5 h-3.5 text-[#35D399]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-[#8795A8]">First Observed</span>
                      <span className="font-mono text-[#B8C5D5]">
                        Version {selectedInsight.first_seen_version} (Run: {selectedInsight.first_seen_run_id.slice(0, 10)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                      <span className="text-[#8795A8]">Latest Observed</span>
                      <span className="font-mono text-[#B8C5D5]">
                        Version {selectedInsight.latest_seen_version} (Run: {selectedInsight.latest_run_id.slice(0, 10)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[#8795A8]">Last Seen Timestamp</span>
                      <span className="font-mono text-[#B8C5D5]">
                        {new Date(selectedInsight.last_seen_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08]">
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="w-full h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-[13px] uppercase tracking-wider transition-colors"
                >
                  CLOSE INSPECTION
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 9. DETAILED VERSION MATRIX MODAL (OPTIONAL SECONDARY VIEW)     */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showDetailedMatrix && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailedMatrix(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-6xl max-h-[85vh] bg-[#020711] border border-white/[0.12] rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden flex flex-col space-y-5 z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] shrink-0">
                <div className="space-y-1">
                  <h3 className="text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-[#39D6F5]" />
                    DETAILED VERSION MATRIX
                  </h3>
                  <p className="text-[13px] font-sans text-[#B8C5D5]">
                    Cell-by-cell pattern presence across {versions.length} versions.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-4 text-[12px] font-sans text-[#8795A8]">
                    <span><strong className="text-[#35D399]">●</strong> OBSERVED</span>
                    <span><strong className="text-[#F06B78]">×</strong> DISAPPEARED</span>
                    <span><strong className="text-slate-600">—</strong> NOT DETECTED</span>
                  </div>
                  <button
                    onClick={() => setShowDetailedMatrix(false)}
                    className="p-2 text-[#8795A8] hover:text-white rounded-xl hover:bg-slate-900 border border-transparent hover:border-white/[0.08] transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Scrollable Matrix Table */}
              <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 border border-white/[0.06] rounded-xl">
                <table className="w-full text-left font-mono text-[13px] border-collapse">
                  <thead className="sticky top-0 bg-slate-950 z-20 text-[11px] uppercase tracking-wider text-[#8795A8] border-b border-white/[0.08]">
                    <tr>
                      <th className="py-3 px-4 font-sans font-bold text-white sticky left-0 bg-slate-950 z-30 min-w-[280px]">
                        Analytical Pattern
                      </th>
                      <th className="py-3 px-3 font-sans font-bold">Category</th>
                      {versions.map((v) => (
                        <th key={v} className="py-3 px-3 text-center text-[#39D6F5] font-bold min-w-[42px]">
                          v{v}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-right font-sans font-bold min-w-[120px]">Current</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {timeline.map((t) => {
                      const badge = getStatusBadge(t.current_status);
                      return (
                        <tr
                          key={t.fingerprint}
                          onClick={() => {
                            const match = items.find((i) => i.insight_fingerprint === t.fingerprint);
                            if (match) {
                              setShowDetailedMatrix(false);
                              setSelectedInsight(match);
                            }
                          }}
                          className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 max-w-[320px] truncate text-white font-sans font-medium sticky left-0 bg-[#020711] group-hover:bg-slate-900 z-10 transition-colors">
                            {t.title}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-slate-900 text-[#B8C5D5] border border-white/[0.06]">
                              {t.category}
                            </span>
                          </td>
                          {t.cells.map((c) => (
                            <td key={c.version} className="py-3 px-3 text-center">
                              {c.status === 'NOT_OBSERVED' ? (
                                <span className="text-slate-600">—</span>
                              ) : c.status === 'DISAPPEARED' ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F06B78]/20 text-[#F06B78] text-[11px] font-bold">
                                  ×
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#35D399]/20 text-[#35D399] text-[11px] font-bold"
                                  title={c.strength !== null ? `Strength: ${c.strength}` : 'Observed'}
                                >
                                  ●
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2.5 py-0.5 rounded text-[11px] font-sans font-bold border uppercase ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
