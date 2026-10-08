import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Layers,
  FileCode,
  X,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Database,
  Sliders,
  Cpu,
  ShieldCheck,
  Compass,
  Code,
  Terminal,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AnalysisRun } from '../types';
import { getProjectRuns, getDatasetRuns } from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface AnalysisRunHistoryProps {
  projectId: string | null;
  datasetId?: string;
  initialRunType?: string;
  onSelectRun?: (run: AnalysisRun) => void;
}

// Helpers for formatted date & duration
const formatExecutionTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return { date: dateFormatted, time: timeFormatted };
  } catch {
    return { date: dateStr, time: '' };
  }
};

const formatDuration = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export const AnalysisRunHistory: React.FC<AnalysisRunHistoryProps> = ({
  projectId,
  datasetId,
  initialRunType,
  onSelectRun,
}) => {
  const shouldReduceMotion = Boolean(useReducedMotion());

  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);

  // Filters
  const [filterRunType, setFilterRunType] = useState<string>(initialRunType || '');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterVersion, setFilterVersion] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    if (!projectId && !datasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let res;
      if (datasetId) {
        res = await getDatasetRuns(datasetId, {
          run_type: filterRunType || undefined,
          status: filterStatus || undefined,
          limit: 100,
        });
      } else if (projectId) {
        res = await getProjectRuns(projectId, {
          run_type: filterRunType || undefined,
          status: filterStatus || undefined,
          dataset_version: filterVersion ? parseInt(filterVersion, 10) : undefined,
          limit: 100,
        });
      }
      setRuns(res?.runs || []);
    } catch (err: any) {
      console.error('Failed to load analysis runs:', err);
      setError(err.message || 'Unable to load analysis runs.');
    } finally {
      setLoading(false);
    }
  }, [projectId, datasetId, filterRunType, filterStatus, filterVersion]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Distinct run type identity (Semantic color for identification only)
  const getRunTypeMeta = (runType: string) => {
    switch (runType.toUpperCase()) {
      case 'EDA':
        return {
          color: '#39D6F5',
          bg: 'bg-[#39D6F5]/10 text-[#39D6F5] border-[#39D6F5]/30',
          icon: Database,
          label: 'EDA',
        };
      case 'INSIGHTS':
        return {
          color: '#9B7BFF',
          bg: 'bg-[#9B7BFF]/10 text-[#9B7BFF] border-[#9B7BFF]/30',
          icon: Compass,
          label: 'INSIGHTS',
        };
      case 'PREDICTION':
        return {
          color: '#4D8DFF',
          bg: 'bg-[#4D8DFF]/10 text-[#4D8DFF] border-[#4D8DFF]/30',
          icon: Cpu,
          label: 'PREDICTION',
        };
      case 'OPTIMIZATION':
        return {
          color: '#F4B740',
          bg: 'bg-[#F4B740]/10 text-[#F4B740] border-[#F4B740]/30',
          icon: Sliders,
          label: 'OPTIMIZATION',
        };
      case 'RECOMMENDATION':
        return {
          color: '#35D399',
          bg: 'bg-[#35D399]/10 text-[#35D399] border-[#35D399]/30',
          icon: FileCode,
          label: 'RECOMMENDATION',
        };
      case 'GUARDRAIL':
        return {
          color: '#F06B78',
          bg: 'bg-[#F06B78]/10 text-[#F06B78] border-[#F06B78]/30',
          icon: ShieldCheck,
          label: 'GUARDRAIL',
        };
      case 'DECISION':
        return {
          color: '#38BDF8',
          bg: 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30',
          icon: Activity,
          label: 'DECISION',
        };
      default:
        return {
          color: '#8795A8',
          bg: 'bg-slate-800 text-[#8795A8] border-slate-700',
          icon: Activity,
          label: runType.toUpperCase(),
        };
    }
  };

  // Status badge with icon & semantic styling
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return {
          color: '#35D399',
          bg: 'bg-[#35D399]/15 text-[#35D399] border-[#35D399]/30',
          icon: CheckCircle2,
          label: 'COMPLETED',
        };
      case 'RUNNING':
        return {
          color: '#39D6F5',
          bg: 'bg-[#39D6F5]/15 text-[#39D6F5] border-[#39D6F5]/30 animate-pulse',
          icon: RefreshCw,
          label: 'RUNNING',
        };
      case 'FAILED':
        return {
          color: '#F06B78',
          bg: 'bg-[#F06B78]/15 text-[#F06B78] border-[#F06B78]/30',
          icon: AlertTriangle,
          label: 'FAILED',
        };
      default:
        return {
          color: '#8795A8',
          bg: 'bg-slate-900 text-[#8795A8] border-white/[0.08]',
          icon: Clock,
          label: status.toUpperCase(),
        };
    }
  };

  // Filter runs strictly based on user query
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        run.id.toLowerCase().includes(query) ||
        run.run_type.toLowerCase().includes(query) ||
        (run.dataset_name && run.dataset_name.toLowerCase().includes(query)) ||
        (run.error_message && run.error_message.toLowerCase().includes(query))
      );
    });
  }, [runs, searchQuery]);

  // Safely derived execution summary statistics
  const summaryStats = useMemo(() => {
    if (runs.length === 0) return null;
    const completed = runs.filter((r) => r.status.toUpperCase() === 'COMPLETED').length;
    const failed = runs.filter((r) => r.status.toUpperCase() === 'FAILED').length;
    const latestRun = runs[0];
    const latestVersion = latestRun?.dataset_version !== undefined ? `v${latestRun.dataset_version}` : 'N/A';

    return {
      total: runs.length,
      completed,
      failed,
      latestRunType: latestRun?.run_type || 'None',
      latestVersion,
    };
  }, [runs]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1550px] mx-auto py-6 px-3 sm:px-6 lg:px-8 font-sans text-[#F4F7FB] relative overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="absolute top-0 left-12 w-[500px] h-[500px] bg-gradient-to-br from-[#39D6F5]/10 via-[#4D8DFF]/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 right-12 w-[540px] h-[540px] bg-gradient-to-bl from-[#9B7BFF]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ============================================================== */}
      {/* 1. HERO HEADER: RUN OBSERVATORY + SIGNATURE EXECUTION NETWORK  */}
      {/* ============================================================== */}
      <motion.header
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl bg-[#020711]/85 border border-[rgba(120,190,230,0.16)] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        {/* Signature Subtle Execution Network SVG Behind Hero */}
        {!shouldReduceMotion && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35 z-0">
            <svg viewBox="0 0 1200 160" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M 60 80 H 320 Q 360 80 390 50 T 460 20 H 750 Q 800 20 830 80 T 920 140 H 1140"
                fill="none"
                stroke="rgba(57, 214, 245, 0.18)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
              />
              <path
                d="M 60 80 H 1140"
                fill="none"
                stroke="rgba(77, 141, 255, 0.1)"
                strokeWidth="1"
              />
              {/* Traveling execution signal: Dataset -> Version -> Run -> Result */}
              <motion.circle
                r="4"
                fill="#39D6F5"
                filter="drop-shadow(0 0 8px #39D6F5)"
                animate={{
                  offsetDistance: ['0%', '100%'],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  offsetPath: "path('M 60 80 H 320 Q 360 80 390 50 T 460 20 H 750 Q 800 20 830 80 T 920 140 H 1140')",
                }}
              />
            </svg>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className="px-3.5 py-1 rounded-full text-[12px] font-sans uppercase tracking-wider bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 font-bold flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#39D6F5]" />
                AUDITABLE RUN REPRODUCIBILITY
              </span>
              <span className="text-[#8795A8] text-xs font-semibold">•</span>
              <span className="text-[#B8C5D5] text-[13px] font-semibold">EXECUTION LEDGER</span>
            </div>

            <h1 className="text-3xl sm:text-[46px] lg:text-[50px] font-sans font-bold tracking-tight text-white leading-[1.08]">
              ANALYTICAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#9B7BFF]">RUN OBSERVATORY</span>
            </h1>

            <p className="text-[15px] sm:text-[16px] font-sans text-[#B8C5D5] leading-[1.6]">
              Audit and reproduce every analytical execution across datasets, versions, configurations, and processing stages.
            </p>
          </div>

          {/* Refresh Action Button */}
          <div className="shrink-0 flex items-center gap-3">
            <button
              onClick={loadRuns}
              disabled={loading}
              className="h-[48px] px-6 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-sans font-bold text-[13px] uppercase tracking-wider border border-white/[0.1] hover:border-[#39D6F5]/40 transition-all flex items-center gap-2.5 shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-[#39D6F5] ${loading ? 'animate-spin' : ''}`} />
              <span>REFRESH RUNS</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* ============================================================== */}
      {/* 2. RUN OVERVIEW & HORIZONTAL EXECUTION RAIL                    */}
      {/* ============================================================== */}
      {summaryStats && (
        <motion.section
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl bg-[#020711]/85 border border-white/[0.08] p-6 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.2)] space-y-6"
        >
          {/* Header Row: Overview Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#39D6F5]" />
              <h2 className="text-[19px] sm:text-[21px] font-sans font-bold text-white tracking-tight">
                EXECUTION RAIL
              </h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-white/[0.08] text-[13px] font-sans text-[#B8C5D5]">
                Total Runs: <strong className="font-mono text-white text-[14px]">{summaryStats.total}</strong>
              </span>
              <span className="px-3.5 py-1.5 rounded-xl bg-[#35D399]/10 border border-[#35D399]/25 text-[13px] font-sans text-[#35D399]">
                Completed: <strong className="font-mono font-bold text-[14px]">{summaryStats.completed}</strong>
              </span>
              {summaryStats.failed > 0 && (
                <span className="px-3.5 py-1.5 rounded-xl bg-[#F06B78]/10 border border-[#F06B78]/25 text-[13px] font-sans text-[#F06B78]">
                  Failed: <strong className="font-mono font-bold text-[14px]">{summaryStats.failed}</strong>
                </span>
              )}
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-white/[0.08] text-[13px] font-sans text-[#B8C5D5]">
                Latest: <strong className="text-[#39D6F5] uppercase font-bold text-[13px]">{summaryStats.latestRunType}</strong> ({summaryStats.latestVersion})
              </span>
            </div>
          </div>

          {/* Interactive Horizontal Execution Rail Track */}
          <div className="pt-2 pb-1 overflow-x-auto custom-scrollbar">
            <div className="relative min-w-max flex items-center gap-3 sm:gap-4 px-2 py-2">
              {runs.map((run, idx) => {
                const statusMeta = getStatusBadge(run.status);
                const isSelected = selectedRun?.id === run.id;

                return (
                  <React.Fragment key={run.id}>
                    {/* Node Interactive Point */}
                    <motion.button
                      whileHover={shouldReduceMotion ? {} : { scale: 1.1, y: -2 }}
                      onClick={() => {
                        setSelectedRun(run);
                        if (onSelectRun) onSelectRun(run);
                      }}
                      className={`relative group p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                        isSelected
                          ? 'bg-slate-800 border-[#39D6F5] shadow-[0_0_20px_rgba(57,214,245,0.25)]'
                          : 'bg-slate-950/70 border-white/[0.08] hover:border-white/[0.2]'
                      }`}
                      title={`${run.run_type} · ${run.status} · ${formatDuration(run.duration_ms)}`}
                    >
                      {/* Node Status Dot */}
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{
                          backgroundColor: statusMeta.color,
                          boxShadow: `0 0 10px ${statusMeta.color}`,
                        }}
                      />
                      <div className="text-left">
                        <span className="text-[13px] font-sans font-bold text-white block uppercase tracking-wider">
                          {run.run_type}
                        </span>
                        <span className="text-[11px] font-mono text-[#8795A8] block">
                          v{run.dataset_version} · {formatDuration(run.duration_ms)}
                        </span>
                      </div>
                    </motion.button>

                    {/* Connecting line between rail points */}
                    {idx < runs.length - 1 && (
                      <div className="w-6 h-[2px] bg-slate-800 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 3. FILTER BAR: SEARCH & CRITERIA SELECTORS                    */}
      {/* ============================================================== */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        className="p-5 sm:p-6 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.2)] space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-sans font-semibold uppercase tracking-wider text-[#8795A8] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#39D6F5]" />
            RUN FILTERS
          </span>
          <span className="text-[13px] font-mono text-[#B8C5D5]">
            Showing <strong className="text-white">{filteredRuns.length}</strong> of {runs.length} runs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, type, dataset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[46px] pl-10 pr-4 bg-slate-950/80 border border-slate-700/80 rounded-xl text-[14px] text-white placeholder-[#8795A8] focus:outline-none focus:border-[#39D6F5] transition-colors"
            />
          </div>

          {/* Run Type Selector */}
          <div className="relative">
            <select
              value={filterRunType}
              onChange={(e) => setFilterRunType(e.target.value)}
              className="w-full h-[46px] appearance-none px-4 bg-slate-950/80 border border-slate-700/80 rounded-xl text-[14px] font-sans font-medium text-white focus:outline-none focus:border-[#39D6F5] pr-10 transition-colors"
            >
              <option value="">All Run Types</option>
              <option value="EDA">EDA (Exploratory Analysis)</option>
              <option value="INSIGHTS">INSIGHTS (Business Insights)</option>
              <option value="PREDICTION">PREDICTION (ML Models)</option>
              <option value="OPTIMIZATION">OPTIMIZATION (Decisions)</option>
              <option value="RECOMMENDATION">RECOMMENDATION (Recommendations)</option>
              <option value="DECISION">DECISION (Scenarios)</option>
              <option value="GUARDRAIL">GUARDRAIL (Validation)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Selector */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-[46px] appearance-none px-4 bg-slate-950/80 border border-slate-700/80 rounded-xl text-[14px] font-sans font-medium text-white focus:outline-none focus:border-[#39D6F5] pr-10 transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="RUNNING">Running</option>
              <option value="FAILED">Failed</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Dataset Version Selector */}
          <div>
            <input
              type="number"
              placeholder="Dataset Version (e.g. 1, 27)"
              value={filterVersion}
              onChange={(e) => setFilterVersion(e.target.value)}
              className="w-full h-[46px] px-4 bg-slate-950/80 border border-slate-700/80 rounded-xl text-[14px] text-white placeholder-[#8795A8] focus:outline-none focus:border-[#39D6F5] transition-colors"
            />
          </div>
        </div>
      </motion.div>

      {/* Error State */}
      {error && (
        <div className="p-6 bg-red-950/40 border border-[#F06B78]/40 rounded-2xl text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-[#F06B78] shrink-0" />
            <div>
              <h4 className="text-[16px] font-sans font-bold">RUN HISTORY UNAVAILABLE</h4>
              <p className="text-[14px] text-rose-200 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadRuns}
            className="px-5 py-2 rounded-xl bg-[#F06B78]/20 hover:bg-[#F06B78]/30 text-white font-sans font-bold text-[13px] uppercase tracking-wider transition-colors shrink-0"
          >
            RETRY
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. EXECUTION STREAM (REPLACES GIANT DATABASE TABLE)            */}
      {/* ============================================================== */}
      {loading && runs.length === 0 ? (
        <ContinuousIntelligenceEngine
          mode="runs"
          isLoading={loading}
          isFullScreen={false}
          minHeight="380px"
          error={error}
          onRetry={loadRuns}
        />
      ) : filteredRuns.length === 0 ? (
        /* Empty / No Matches State */
        <div className="p-16 rounded-2xl bg-[#020711]/85 border border-white/[0.08] text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/[0.08] flex items-center justify-center mx-auto text-[#8795A8]">
            <Activity className="w-7 h-7" />
          </div>
          <h3 className="text-[20px] font-sans font-bold text-white">
            {runs.length === 0 ? 'NO ANALYTICAL RUNS' : 'NO MATCHING RUNS'}
          </h3>
          <p className="text-[14px] font-sans text-[#B8C5D5] max-w-md mx-auto leading-[1.6]">
            {runs.length === 0
              ? 'No analytical executions have been recorded for this project yet. Execute an analysis to generate an auditable run ledger.'
              : 'No runs matched your current search and filter criteria. Adjust the filters above to inspect more executions.'}
          </p>
          {runs.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterRunType('');
                setFilterStatus('');
                setFilterVersion('');
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-sans font-semibold text-[13px] transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        /* Execution Stream Container with Left Timeline Track */
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-[#39D6F5] via-[#4D8DFF] to-slate-800 space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredRuns.map((run) => {
              const typeMeta = getRunTypeMeta(run.run_type);
              const statusMeta = getStatusBadge(run.status);
              const TypeIcon = typeMeta.icon;
              const StatusIcon = statusMeta.icon;
              const execTime = formatExecutionTime(run.started_at);
              const isSelected = selectedRun?.id === run.id;

              return (
                <motion.div
                  key={run.id}
                  layout
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                  className="relative group"
                >
                  {/* Timeline Node on Left Vertical Track */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
                      isSelected
                        ? 'bg-slate-900 border-[#39D6F5] shadow-[0_0_12px_#39D6F5]'
                        : 'bg-[#020711] border-slate-700 group-hover:border-[#39D6F5]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: typeMeta.color }}
                    />
                  </div>

                  {/* Compact Execution Row Card (76–92px) */}
                  <div
                    onClick={() => {
                      setSelectedRun(run);
                      if (onSelectRun) onSelectRun(run);
                    }}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 ${
                      isSelected
                        ? 'bg-[#071326] border-[#39D6F5] shadow-[0_0_30px_rgba(57,214,245,0.18)] translate-x-1'
                        : 'bg-[#020711]/85 border-white/[0.08] hover:border-white/[0.22] hover:bg-slate-900/60 hover:translate-x-1'
                    }`}
                    style={{ perspective: '1400px' }}
                  >
                    {/* LEFT: Run Type Icon & Badge */}
                    <div className="flex items-center gap-3.5 min-w-[200px] shrink-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${typeMeta.bg}`}
                      >
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[14px] font-sans font-bold text-white block uppercase tracking-wider">
                          {run.run_type}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8795A8] mt-0.5">
                          <span>#{run.id.slice(0, 10)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(run.id, run.id);
                            }}
                            className="hover:text-white transition-colors"
                            title="Copy Run ID"
                          >
                            {copiedId === run.id ? (
                              <Check className="w-3 h-3 text-[#35D399]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* CENTER: Dataset Name, Lineage, Version */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-sans font-bold text-[15px] sm:text-[16px] text-white truncate max-w-[320px]" title={run.dataset_name || run.dataset_id}>
                          {run.dataset_name || `Dataset ${run.dataset_id.slice(0, 8)}`}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[12px] font-mono font-bold bg-[#4D8DFF]/15 text-[#4D8DFF] border border-[#4D8DFF]/30">
                          v{run.dataset_version}
                        </span>
                      </div>
                      {run.processed_dataset_id && (
                        <span className="text-[12px] sm:text-[13px] font-sans text-[#8795A8] flex items-center gap-1.5 truncate">
                          <Layers className="w-3.5 h-3.5 text-[#39D6F5]" />
                          Processed Child: <strong className="text-[#B8C5D5] font-normal">{run.processed_dataset_name || run.processed_dataset_id.slice(0, 12)}</strong>
                        </span>
                      )}
                    </div>

                    {/* RIGHT: Status, Duration, Timestamp, Inspect */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-5 sm:gap-6 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.04]">
                      {/* Status */}
                      <div className="min-w-[120px]">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] sm:text-[13px] font-sans font-bold uppercase tracking-wider border gap-1.5 ${statusMeta.bg}`}
                        >
                          <StatusIcon className="w-4 h-4 shrink-0" />
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Duration with Decorative Indicator */}
                      <div className="text-right min-w-[90px]">
                        <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">
                          DURATION
                        </span>
                        <span className="text-[14px] sm:text-[15px] font-mono font-bold text-white block">
                          {formatDuration(run.duration_ms)}
                        </span>
                      </div>

                      {/* Executed At */}
                      <div className="text-right min-w-[120px] hidden sm:block">
                        <span className="text-[13px] font-sans text-[#B8C5D5] block">
                          {execTime.date}
                        </span>
                        <span className="text-[12px] font-mono text-[#8795A8] block">
                          {execTime.time}
                        </span>
                      </div>

                      {/* Inspect Action */}
                      <div className="shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRun(run);
                            if (onSelectRun) onSelectRun(run);
                          }}
                          className="h-[38px] px-4 rounded-xl bg-slate-900 group-hover:bg-[#39D6F5] text-[#39D6F5] group-hover:text-slate-950 border border-white/[0.08] group-hover:border-[#39D6F5] text-[13px] font-sans font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <span>INSPECT</span>
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. INSPECTOR DRAWER: REPRODUCIBILITY WORKSPACE                 */}
      {/* ============================================================== */}
      <AnimatePresence>
        {selectedRun && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Subtle Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRun(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide Drawer Panel (350–450ms smooth transition) */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-2xl bg-[#020711] border-l border-white/[0.1] shadow-2xl p-6 sm:p-8 overflow-y-auto flex flex-col space-y-7 z-10"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
                      getRunTypeMeta(selectedRun.run_type).bg
                    }`}
                  >
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-[20px] font-sans font-bold text-white tracking-tight uppercase">
                        {selectedRun.run_type} RUN
                      </h3>
                      <span
                        className={`inline-flex items-center px-3 py-0.5 rounded-full text-[12px] font-sans font-bold uppercase tracking-wider border ${
                          getStatusBadge(selectedRun.status).bg
                        }`}
                      >
                        {selectedRun.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[12px] font-mono text-[#8795A8] mt-1">
                      <span>ID: {selectedRun.id}</span>
                      <button
                        onClick={() => handleCopy(selectedRun.id, 'drawer_run_id')}
                        className="hover:text-white transition-colors"
                        title="Copy Run ID"
                      >
                        {copiedId === 'drawer_run_id' ? (
                          <Check className="w-3.5 h-3.5 text-[#35D399]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRun(null)}
                  className="p-2 text-[#8795A8] hover:text-white rounded-xl hover:bg-slate-900 border border-transparent hover:border-white/[0.08] transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* ====================================================== */}
              {/* REPRODUCIBILITY CHAIN VISUALIZATION                     */}
              {/* ====================================================== */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-[#39D6F5]/25 space-y-3">
                <span className="text-[12px] font-sans uppercase tracking-wider text-[#39D6F5] font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  REPRODUCIBILITY EXECUTION CHAIN
                </span>
                <p className="text-[13px] font-sans text-[#B8C5D5]">
                  Deterministic pipeline linkage from source dataset version to analytical output.
                </p>

                {/* Horizontal Chain */}
                <div className="flex items-center gap-2 pt-2 overflow-x-auto custom-scrollbar pb-1 text-[12px] font-mono">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/[0.08] text-white shrink-0 text-center">
                    <span className="text-[10px] text-[#8795A8] block uppercase">DATASET</span>
                    <span className="font-bold truncate max-w-[120px] block" title={selectedRun.dataset_name || selectedRun.dataset_id}>
                      {selectedRun.dataset_name || selectedRun.dataset_id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-[#39D6F5] font-bold">→</span>

                  <div className="px-3 py-1.5 rounded-lg bg-[#4D8DFF]/15 border border-[#4D8DFF]/30 text-[#4D8DFF] shrink-0 text-center">
                    <span className="text-[10px] text-[#8795A8] block uppercase">VERSION</span>
                    <span className="font-bold">v{selectedRun.dataset_version}</span>
                  </div>
                  <span className="text-[#39D6F5] font-bold">→</span>

                  {selectedRun.processed_dataset_id && (
                    <>
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/[0.08] text-[#B8C5D5] shrink-0 text-center">
                        <span className="text-[10px] text-[#8795A8] block uppercase">PROCESSED</span>
                        <span className="font-bold truncate max-w-[100px] block">Child Artifact</span>
                      </div>
                      <span className="text-[#39D6F5] font-bold">→</span>
                    </>
                  )}

                  <div className="px-3 py-1.5 rounded-lg bg-[#39D6F5]/15 border border-[#39D6F5]/30 text-[#39D6F5] shrink-0 text-center">
                    <span className="text-[10px] text-[#8795A8] block uppercase">RUN</span>
                    <span className="font-bold uppercase">{selectedRun.run_type}</span>
                  </div>
                  <span className="text-[#39D6F5] font-bold">→</span>

                  <div className="px-3 py-1.5 rounded-lg bg-[#35D399]/15 border border-[#35D399]/30 text-[#35D399] shrink-0 text-center">
                    <span className="text-[10px] text-[#8795A8] block uppercase">OUTPUT</span>
                    <span className="font-bold">Artifacts</span>
                  </div>
                </div>
              </div>

              {/* Execution Summary Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="p-4 bg-slate-950/80 border border-white/[0.08] rounded-xl space-y-1">
                  <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">DURATION</span>
                  <span className="text-[16px] font-mono font-bold text-white block">
                    {formatDuration(selectedRun.duration_ms)}
                  </span>
                </div>
                <div className="p-4 bg-slate-950/80 border border-white/[0.08] rounded-xl space-y-1">
                  <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">EXECUTED AT</span>
                  <span className="text-[14px] font-sans font-semibold text-white block">
                    {new Date(selectedRun.started_at).toLocaleDateString()}
                  </span>
                  <span className="text-[11px] font-mono text-[#8795A8] block">
                    {new Date(selectedRun.started_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="p-4 bg-slate-950/80 border border-white/[0.08] rounded-xl space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-sans uppercase tracking-wider text-[#8795A8] block">LINEAGE VERSION</span>
                  <span className="text-[16px] font-mono font-bold text-[#4D8DFF] block">
                    v{selectedRun.dataset_version}
                  </span>
                </div>
              </div>

              {/* Provenance & Lineage Context */}
              <div className="p-5 bg-slate-950/80 border border-white/[0.08] rounded-2xl space-y-3">
                <h4 className="text-[13px] font-sans font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#39D6F5]" />
                  Dataset Provenance & Scope
                </h4>
                <div className="space-y-2 text-[13px] font-sans">
                  <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <span className="text-[#8795A8]">Raw Dataset</span>
                    <span className="text-white font-semibold">{selectedRun.dataset_name || selectedRun.dataset_id}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                    <span className="text-[#8795A8]">Dataset ID</span>
                    <span className="text-[#8795A8] font-mono text-[11.5px]">{selectedRun.dataset_id}</span>
                  </div>
                  {selectedRun.processed_dataset_id && (
                    <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
                      <span className="text-[#8795A8]">Processed Child</span>
                      <span className="text-[#39D6F5] font-mono font-semibold">
                        {selectedRun.processed_dataset_name || selectedRun.processed_dataset_id}
                      </span>
                    </div>
                  )}
                  {selectedRun.project_name && (
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-[#8795A8]">Project Scope</span>
                      <span className="text-white font-semibold">{selectedRun.project_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message (if failed) */}
              {selectedRun.error_message && (
                <div className="p-5 bg-red-950/40 border border-[#F06B78]/50 rounded-2xl space-y-2">
                  <span className="text-[13px] font-sans font-bold text-[#F06B78] uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Failure Details
                  </span>
                  <p className="text-[13px] text-rose-200 font-mono break-all leading-relaxed">
                    {selectedRun.error_message}
                  </p>
                </div>
              )}

              {/* Configuration Parameters */}
              <div className="space-y-2.5">
                <h4 className="text-[13px] font-sans font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#39D6F5]" />
                  Execution Parameters & Configuration
                </h4>
                <div className="p-4 bg-slate-950 border border-white/[0.08] rounded-xl overflow-x-auto">
                  <pre className="text-[12px] text-[#B8C5D5] font-mono leading-relaxed">
                    {selectedRun.configuration && Object.keys(selectedRun.configuration).length > 0
                      ? JSON.stringify(selectedRun.configuration, null, 2)
                      : '// Default parameter profile applied'}
                  </pre>
                </div>
              </div>

              {/* Output Artifacts */}
              <div className="space-y-2.5">
                <h4 className="text-[13px] font-sans font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#35D399]" />
                  Discovered Output Artifacts
                </h4>
                <div className="p-4 bg-slate-950 border border-white/[0.08] rounded-xl overflow-x-auto">
                  <pre className="text-[12px] text-[#35D399] font-mono leading-relaxed">
                    {selectedRun.output_artifacts && Object.keys(selectedRun.output_artifacts).length > 0
                      ? JSON.stringify(selectedRun.output_artifacts, null, 2)
                      : '// No output artifacts recorded for this run'}
                  </pre>
                </div>
              </div>

              {/* Input Artifacts (if any) */}
              {selectedRun.input_artifacts && Object.keys(selectedRun.input_artifacts).length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[13px] font-sans font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Code className="w-4 h-4 text-[#8795A8]" />
                    Input Artifact References
                  </h4>
                  <div className="p-4 bg-slate-950 border border-white/[0.08] rounded-xl overflow-x-auto">
                    <pre className="text-[12px] text-[#8795A8] font-mono leading-relaxed">
                      {JSON.stringify(selectedRun.input_artifacts, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
