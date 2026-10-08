import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Layers,
  Shield,
  BrainCircuit,
  Sparkles,
  RefreshCw,
  Clock,
  ChevronDown,
  CheckCircle2,
  Database,
} from 'lucide-react';
import {
  DatasetVersionItem,
  DatasetComparisonResponse,
  InsightImpactComparisonResponse,
} from '../types';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import {
  fetchProjectVersions,
  compareDatasetVersions,
  fetchInsightImpactComparison,
} from '../services/api';

interface DatasetVersionComparisonProps {
  projectId: string;
  projectName?: string;
  initialBaseId?: string;
  initialCompId?: string;
  onClose?: () => void;
}

export const DatasetVersionComparison: React.FC<DatasetVersionComparisonProps> = ({
  projectId,
  projectName = 'Hospital Operations',
  initialBaseId,
  initialCompId,
  onClose,
}) => {
  const shouldReduceMotion = Boolean(useReducedMotion());

  const [lineages, setLineages] = useState<string[]>([]);
  const [selectedLineage, setSelectedLineage] = useState<string>('');
  const [versions, setVersions] = useState<DatasetVersionItem[]>([]);
  const [baseId, setBaseId] = useState<string>(initialBaseId || '');
  const [compId, setCompId] = useState<string>(initialCompId || '');
  const [comparison, setComparison] = useState<DatasetComparisonResponse | null>(null);
  const [insightImpact, setInsightImpact] = useState<InsightImpactComparisonResponse | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [loadingInsightImpact, setLoadingInsightImpact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'schema' | 'metrics' | 'quality' | 'impact'>('all');

  // 1. Load versions for project scoped by logical dataset lineage
  const loadVersions = useCallback(async (targetLin?: string) => {
    if (!projectId) return;
    setLoadingVersions(true);
    setError(null);
    try {
      const res = await fetchProjectVersions(projectId, targetLin);
      const items = res.versions || [];
      const distinctLineages = res.lineages || [];
      setLineages(distinctLineages);

      const activeLin = targetLin || res.lineage_name || distinctLineages[0] || '';
      setSelectedLineage(activeLin);
      setVersions(items);

      if (initialBaseId && items.some((it) => it.id === initialBaseId)) {
        setBaseId(initialBaseId);
        if (initialCompId && items.some((it) => it.id === initialCompId)) {
          setCompId(initialCompId);
        } else if (items.length >= 2) {
          setCompId(items[0].id);
        }
      } else if (items.length >= 2) {
        // Default base = older version (index 1), comp = newer version (index 0)
        setBaseId(items[1].id);
        setCompId(items[0].id);
      } else if (items.length === 1) {
        setBaseId(items[0].id);
        setCompId(items[0].id);
      } else {
        setBaseId('');
        setCompId('');
      }
    } catch (err: any) {
      console.error('Failed to load dataset versions:', err);
      setError(err.message || 'Unable to load dataset versions.');
    } finally {
      setLoadingVersions(false);
    }
  }, [projectId, initialBaseId, initialCompId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleLineageChange = (newLineage: string) => {
    setSelectedLineage(newLineage);
    loadVersions(newLineage);
  };

  // 2. Perform comparison when baseId & compId are ready
  const runComparison = useCallback(async (bId: string, cId: string) => {
    if (!bId || !cId) return;
    setLoadingComparison(true);
    setError(null);
    try {
      const res = await compareDatasetVersions(bId, cId);
      setComparison(res);
    } catch (err: any) {
      console.error('Failed to run version comparison:', err);
      setError(err.message || 'Version comparison failed.');
    } finally {
      setLoadingComparison(false);
    }
  }, []);

  const runImpactComparison = useCallback(async (bId: string, cId: string) => {
    if (!bId || !cId || bId === cId) {
      setInsightImpact(null);
      return;
    }
    setLoadingInsightImpact(true);
    try {
      const res = await fetchInsightImpactComparison(bId, cId);
      setInsightImpact(res);
    } catch (err: any) {
      console.error('Failed to run insight impact comparison:', err);
      setInsightImpact(null);
    } finally {
      setLoadingInsightImpact(false);
    }
  }, []);

  useEffect(() => {
    if (baseId && compId) {
      runComparison(baseId, compId);
      runImpactComparison(baseId, compId);
    }
  }, [baseId, compId, runComparison, runImpactComparison]);

  const baseVersion = useMemo(() => versions.find((v) => v.id === baseId), [versions, baseId]);
  const compVersion = useMemo(() => versions.find((v) => v.id === compId), [versions, compId]);

  // Schema change counters
  const schemaSummary = useMemo(() => {
    if (!comparison) return { added: 0, removed: 0, modified: 0, unchanged: 0 };
    let added = 0;
    let removed = 0;
    let modified = 0;
    let unchanged = 0;

    comparison.schema_changes.forEach((sc) => {
      if (sc.change_type === 'added') added++;
      else if (sc.change_type === 'removed') removed++;
      else if (sc.change_type === 'type_changed') modified++;
      else unchanged++;
    });

    return { added, removed, modified, unchanged };
  }, [comparison]);

  // Insight memory evolution distribution proportions
  const memoryDistribution = useMemo(() => {
    if (!insightImpact) return null;
    const c = insightImpact.counters;
    const total = c.total || (c.new_count + c.persisted_count + c.strengthened_count + c.weakened_count + c.disappeared_count);
    if (total === 0) return null;

    return {
      total,
      newPct: (c.new_count / total) * 100,
      persistedPct: (c.persisted_count / total) * 100,
      strengthenedPct: (c.strengthened_count / total) * 100,
      weakenedPct: (c.weakened_count / total) * 100,
      disappearedPct: (c.disappeared_count / total) * 100,
    };
  }, [insightImpact]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1560px] mx-auto py-6 px-3 sm:px-6 lg:px-8 font-sans text-[#F4F7FB] relative overflow-x-hidden">
      {/* Ambient Atmospheric Lighting */}
      <div className="absolute top-0 left-12 w-[520px] h-[520px] bg-gradient-to-br from-[#39D6F5]/10 via-[#4D8DFF]/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 right-12 w-[560px] h-[560px] bg-gradient-to-bl from-[#9B7BFF]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ============================================================== */}
      {/* 1. HERO HEADER: DATASET VERSION INTELLIGENCE                   */}
      {/* ============================================================== */}
      <motion.header
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl bg-[#020711]/85 border border-[rgba(120,190,230,0.16)] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3.5 py-1 rounded-full text-[12px] font-sans uppercase tracking-wider bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 font-bold flex items-center gap-2">
                <GitCompare className="w-3.5 h-3.5 text-[#39D6F5]" />
                VERSION INTELLIGENCE WORKSPACE
              </span>
              <span className="text-[#8795A8] text-xs font-semibold">•</span>
              <span className="text-[#B8C5D5] text-[13px] font-semibold">{projectName}</span>
            </div>

            <h1 className="text-3xl sm:text-[44px] lg:text-[48px] font-sans font-bold tracking-tight text-white leading-[1.08]">
              DATASET VERSION <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#9B7BFF]">INTELLIGENCE</span>
            </h1>

            <p className="text-[15px] sm:text-[16px] font-sans text-[#B8C5D5] leading-[1.6]">
              What changed between dataset versions? Inspect structural changes, statistical drift, quality evolutions, and downstream model & insight impact.
            </p>
          </div>

          {/* Right Action / Lineage Badge */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            {onClose && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[13px] font-sans font-semibold text-[#B8C5D5] hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] transition-colors"
              >
                ← Back to Inventory
              </button>
            )}

            {selectedLineage && (
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-[#39D6F5]/30 text-left">
                <span className="text-[11px] font-mono text-[#39D6F5] uppercase tracking-wider font-semibold block">
                  DATASET LINEAGE
                </span>
                <span className="text-[14px] font-mono font-bold text-white truncate max-w-[260px] block" title={selectedLineage}>
                  {selectedLineage}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dataset Lineage Selector Switcher if multiple lineages exist */}
        {lineages.length > 1 && (
          <div className="mt-6 pt-5 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block">
                SWITCH ACTIVE LINEAGE
              </span>
              <p className="text-[13px] text-[#B8C5D5]">
                Strictly compare versions within the same analytical data family.
              </p>
            </div>
            <div className="relative min-w-[280px]">
              <select
                value={selectedLineage}
                onChange={(e) => handleLineageChange(e.target.value)}
                disabled={loadingVersions}
                className="w-full appearance-none bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-[13px] font-mono font-bold text-white focus:outline-none focus:border-[#39D6F5] pr-9 shadow-inner transition-colors"
              >
                {lineages.map((lin) => (
                  <option key={lin} value={lin}>
                    {lin}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#39D6F5] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}
      </motion.header>

      {/* ============================================================== */}
      {/* 2. VERSION TIMELINE HERO & COMPARISON CONTROLS                 */}
      {/* ============================================================== */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="rounded-2xl bg-[#020711]/85 border border-[rgba(120,190,230,0.16)] p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.25)] relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div className="space-y-1">
            <h2 className="text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#39D6F5]" />
              LINEAGE VERSION TIMELINE
            </h2>
            <p className="text-[14px] font-sans text-[#B8C5D5]">
              Select baseline and candidate nodes to investigate what evolved.
            </p>
          </div>
          <span className="text-[12px] font-mono text-[#8795A8] px-3.5 py-1.5 rounded-full bg-slate-900 border border-white/[0.06]">
            {versions.length} Version{versions.length !== 1 ? 's' : ''} Recorded
          </span>
        </div>

        {/* Timeline Loading / Empty State */}
        {loadingVersions ? (
          <ContinuousIntelligenceEngine
            mode="versioning"
            isLoading={loadingVersions}
            isFullScreen={false}
            minHeight="280px"
            title="LOADING LINEAGE VERSION HISTORY"
            desc="Querying cryptographic lineage provenance records and registered dataset snapshot tags..."
          />
        ) : versions.length === 0 ? (
          <div className="py-12 text-center text-[14px] font-sans text-[#8795A8] max-w-md mx-auto space-y-2">
            <Database className="w-10 h-10 text-[#39D6F5]/40 mx-auto" />
            <p className="font-semibold text-white">No dataset versions recorded yet.</p>
            <p className="text-[13px]">Upload a CSV to establish Version 1 of this lineage.</p>
          </div>
        ) : (
          <div className="pt-8 pb-4 relative">
            {/* Horizontal Timeline Track (Behind Nodes) */}
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex items-center gap-4 sm:gap-6 min-w-max px-2 py-2">
                {versions.map((ver, idx) => {
                  const isBase = ver.id === baseId;
                  const isComp = ver.id === compId;

                  return (
                    <React.Fragment key={ver.id}>
                      {/* Version Node Instrument */}
                      <motion.div
                        whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.02 }}
                        className={`relative rounded-2xl p-5 border transition-all duration-300 w-[240px] sm:w-[260px] text-left shrink-0 ${
                          isComp
                            ? 'bg-[#39D6F5]/10 border-[#39D6F5] shadow-[0_0_30px_rgba(57,214,245,0.2)]'
                            : isBase
                            ? 'bg-[#4D8DFF]/10 border-[#4D8DFF] shadow-[0_0_30px_rgba(77,141,255,0.2)]'
                            : 'bg-slate-950/70 border-white/[0.08] hover:border-white/[0.2]'
                        }`}
                      >
                        {/* Top Node Header: Version Number & Role Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[26px] sm:text-[28px] font-sans font-bold text-white tracking-tight leading-none">
                            V{ver.version}
                          </span>
                          {isComp ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-bold uppercase tracking-wider bg-[#39D6F5] text-slate-950">
                              CANDIDATE
                            </span>
                          ) : isBase ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-bold uppercase tracking-wider bg-[#4D8DFF] text-white">
                              BASELINE
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-[#8795A8] uppercase">
                              VERSION
                            </span>
                          )}
                        </div>

                        {/* Dataset Name */}
                        <h4 className="text-[14px] font-sans font-semibold text-white truncate mb-2" title={ver.name}>
                          {ver.name}
                        </h4>

                        {/* Metadata Rows: Row Count & Quality */}
                        <div className="space-y-1 text-[13px] font-sans text-[#B8C5D5] pb-3 border-b border-white/[0.06]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#8795A8]">Rows:</span>
                            <span className="font-mono font-bold text-white">
                              {ver.row_count?.toLocaleString() ?? 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#8795A8]">Quality:</span>
                            <span className="font-mono font-bold text-[#35D399]">
                              {ver.quality_score ? `${ver.quality_score}%` : 'N/A'}
                            </span>
                          </div>
                          {ver.created_at && (
                            <div className="flex justify-between items-center text-[11px] font-mono text-[#8795A8] pt-0.5">
                              <span>Created:</span>
                              <span>{new Date(ver.created_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Node Role Selector Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button
                            onClick={() => setBaseId(ver.id)}
                            className={`py-1.5 px-2 rounded-lg text-[12px] font-sans font-bold uppercase tracking-wider transition-colors ${
                              isBase
                                ? 'bg-[#4D8DFF] text-white'
                                : 'bg-slate-900 text-[#8795A8] hover:text-white hover:bg-slate-800 border border-white/[0.06]'
                            }`}
                          >
                            Set Base
                          </button>
                          <button
                            onClick={() => setCompId(ver.id)}
                            className={`py-1.5 px-2 rounded-lg text-[12px] font-sans font-bold uppercase tracking-wider transition-colors ${
                              isComp
                                ? 'bg-[#39D6F5] text-slate-950'
                                : 'bg-slate-900 text-[#8795A8] hover:text-white hover:bg-slate-800 border border-white/[0.06]'
                            }`}
                          >
                            Set Cand
                          </button>
                        </div>
                      </motion.div>

                      {/* Connector Line between Nodes */}
                      {idx < versions.length - 1 && (
                        <div className="relative w-8 sm:w-12 h-[2px] bg-slate-800 shrink-0 mx-1 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-slate-700" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Wide Comparison Selectors Bar */}
            <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-slate-950/80 border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-5">
              {/* Baseline Selector */}
              <div className="w-full md:w-5/12 space-y-2">
                <label className="text-[13px] font-sans font-semibold text-[#4D8DFF] uppercase tracking-wider block flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4D8DFF]" />
                  BASELINE VERSION (V1)
                </label>
                <div className="relative">
                  <select
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                    disabled={loadingComparison || versions.length === 0}
                    className="w-full h-[48px] appearance-none bg-slate-900 border border-slate-700/80 rounded-xl px-4 text-[14px] font-sans font-semibold text-white focus:outline-none focus:border-[#4D8DFF] pr-10 shadow-inner"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Version {v.version} — {v.name} ({v.row_count?.toLocaleString()} rows)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* VS Indicator */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/[0.12] flex items-center justify-center shadow-lg">
                  <span className="text-[13px] font-mono font-bold text-[#39D6F5]">VS</span>
                </div>
              </div>

              {/* Candidate Selector */}
              <div className="w-full md:w-5/12 space-y-2">
                <label className="text-[13px] font-sans font-semibold text-[#39D6F5] uppercase tracking-wider block flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#39D6F5]" />
                  CANDIDATE VERSION (V2)
                </label>
                <div className="relative">
                  <select
                    value={compId}
                    onChange={(e) => setCompId(e.target.value)}
                    disabled={loadingComparison || versions.length === 0}
                    className="w-full h-[48px] appearance-none bg-slate-900 border border-slate-700/80 rounded-xl px-4 text-[14px] font-sans font-semibold text-white focus:outline-none focus:border-[#39D6F5] pr-10 shadow-inner"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Version {v.version} — {v.name} ({v.row_count?.toLocaleString()} rows)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Error state */}
      {error && (
        <div className="p-6 rounded-2xl border border-[#F06B78]/30 bg-[#F06B78]/10 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-[#F06B78] shrink-0" />
            <div>
              <h4 className="text-[16px] font-sans font-bold">VERSION COMPARISON UNAVAILABLE</h4>
              <p className="text-[14px] text-rose-200 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => baseId && compId && runComparison(baseId, compId)}
            className="px-5 py-2 rounded-xl bg-[#F06B78]/20 hover:bg-[#F06B78]/30 text-white font-sans font-bold text-[13px] uppercase tracking-wider transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Indeterminate Loading State */}
      {loadingComparison && (
        <ContinuousIntelligenceEngine
          mode="versioning"
          isLoading={loadingComparison}
          isFullScreen={false}
          minHeight="380px"
          eyebrow={`V${baseVersion?.version ?? 1} ↔ V${compVersion?.version ?? 2} // LINEAGE COMPARISON`}
        />
      )}

      {/* ============================================================== */}
      {/* 3. COMPARISON CONTENT CANVAS (WITH VERSION-SWITCH TRANSITION)  */}
      {/* ============================================================== */}
      {!loadingComparison && comparison && (
        <motion.div
          key={`${baseId}-${compId}`}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.4, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-8"
        >
          {/* ========================================================== */}
          {/* EXECUTIVE COMPARISON SUMMARY STRIP (4 METRICS)             */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Rows Metric */}
            <div className="p-6 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
              <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block mb-1.5">
                ROWS
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[32px] sm:text-[34px] font-sans font-bold text-white tracking-tight">
                  {comparison.summary.rows_comparison.toLocaleString()}
                </span>
                <span
                  className={`text-[14px] font-mono font-bold flex items-center gap-1 ${
                    comparison.summary.rows_change > 0
                      ? 'text-[#35D399]'
                      : comparison.summary.rows_change < 0
                      ? 'text-[#F4B740]'
                      : 'text-[#8795A8]'
                  }`}
                >
                  {comparison.summary.rows_change > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : comparison.summary.rows_change < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                  {comparison.summary.rows_change > 0 ? `+${comparison.summary.rows_change}` : comparison.summary.rows_change}
                  {comparison.summary.rows_change_pct !== 0 && ` (${comparison.summary.rows_change_pct > 0 ? '+' : ''}${comparison.summary.rows_change_pct}%)`}
                </span>
              </div>
              <span className="text-[13px] font-sans text-[#8795A8] mt-2 block">
                Baseline: <strong className="text-[#B8C5D5] font-mono">{comparison.summary.rows_base.toLocaleString()}</strong> rows
              </span>
            </div>

            {/* Columns Metric */}
            <div className="p-6 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
              <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block mb-1.5">
                COLUMNS
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[32px] sm:text-[34px] font-sans font-bold text-white tracking-tight">
                  {comparison.summary.columns_comparison}
                </span>
                <div className="flex items-center gap-2 text-[14px] font-mono font-bold">
                  {comparison.summary.columns_added_count > 0 && (
                    <span className="text-[#35D399]">+{comparison.summary.columns_added_count} added</span>
                  )}
                  {comparison.summary.columns_removed_count > 0 && (
                    <span className="text-[#F06B78]">-{comparison.summary.columns_removed_count} removed</span>
                  )}
                  {comparison.summary.columns_added_count === 0 && comparison.summary.columns_removed_count === 0 && (
                    <span className="text-[#8795A8]">Unchanged</span>
                  )}
                </div>
              </div>
              <span className="text-[13px] font-sans text-[#8795A8] mt-2 block">
                Baseline: <strong className="text-[#B8C5D5] font-mono">{comparison.summary.columns_base}</strong> columns
              </span>
            </div>

            {/* Data Quality Metric */}
            <div className="p-6 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
              <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block mb-1.5">
                DATA QUALITY
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[32px] sm:text-[34px] font-sans font-bold text-[#39D6F5] tracking-tight">
                  {comparison.summary.quality_comparison !== null && comparison.summary.quality_comparison !== undefined
                    ? `${comparison.summary.quality_comparison}%`
                    : 'N/A'}
                </span>
                {comparison.summary.quality_change !== null && comparison.summary.quality_change !== undefined && (
                  <span
                    className={`text-[14px] font-mono font-bold flex items-center gap-1 ${
                      comparison.summary.quality_change > 0
                        ? 'text-[#35D399]'
                        : comparison.summary.quality_change < 0
                        ? 'text-[#F06B78]'
                        : 'text-[#8795A8]'
                    }`}
                  >
                    {comparison.summary.quality_change > 0 ? '+' : ''}
                    {comparison.summary.quality_change} pts
                  </span>
                )}
              </div>
              <span className="text-[13px] font-sans text-[#8795A8] mt-2 block">
                Baseline: <strong className="text-[#B8C5D5] font-mono">{comparison.summary.quality_base ? `${comparison.summary.quality_base}%` : 'N/A'}</strong>
              </span>
            </div>

            {/* Missing Cells & Duplicates */}
            <div className="p-6 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
              <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block mb-1.5">
                HEALTH & HYGIENE
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[32px] sm:text-[34px] font-sans font-bold text-white tracking-tight">
                  {comparison.summary.missing_cells_comparison} <span className="text-[18px] text-[#8795A8] font-normal">nulls</span>
                </span>
                <span
                  className={`text-[14px] font-mono font-bold ${
                    comparison.summary.missing_cells_change < 0
                      ? 'text-[#35D399]'
                      : comparison.summary.missing_cells_change > 0
                      ? 'text-[#F06B78]'
                      : 'text-[#8795A8]'
                  }`}
                >
                  {comparison.summary.missing_cells_change > 0 ? `+${comparison.summary.missing_cells_change}` : comparison.summary.missing_cells_change}
                </span>
              </div>
              <span className="text-[13px] font-sans text-[#8795A8] mt-2 block">
                Duplicates: <strong className="text-[#B8C5D5] font-mono">{comparison.summary.duplicate_rows_comparison}</strong> (Δ {comparison.summary.duplicate_rows_change})
              </span>
            </div>
          </div>

          {/* ========================================================== */}
          {/* "WHAT CHANGED?" HERO INTERPRETATION PANEL                  */}
          {/* ========================================================== */}
          <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/90 border border-[rgba(57,214,245,0.25)] shadow-[0_16px_50px_rgba(0,0,0,0.25)] relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#39D6F5]/15 border border-[#39D6F5]/30 flex items-center justify-center text-[#39D6F5]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[20px] font-sans font-bold text-white tracking-tight">
                    WHAT CHANGED?
                  </h3>
                  <p className="text-[13.5px] font-sans text-[#B8C5D5]">
                    Deterministic evaluation of statistical drift and structural evolution.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-4 py-1.5 rounded-full text-[13px] font-sans font-bold uppercase tracking-wider flex items-center gap-2 ${
                  comparison.significant_changes.length === 0
                    ? 'bg-[#35D399]/15 text-[#35D399] border border-[#35D399]/30'
                    : 'bg-[#F4B740]/15 text-[#F4B740] border border-[#F4B740]/30'
                }`}
              >
                {comparison.significant_changes.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    NO SIGNIFICANT CHANGES
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    {comparison.significant_changes.length} SIGNIFICANT SHIFT{comparison.significant_changes.length !== 1 ? 'S' : ''}
                  </>
                )}
              </span>
            </div>

            {/* Changes Content */}
            <div className="pt-6">
              {comparison.significant_changes.length === 0 ? (
                <div className="flex items-start gap-4 p-5 rounded-xl bg-slate-950/70 border border-[#35D399]/20">
                  <CheckCircle2 className="w-6 h-6 text-[#35D399] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[16px] font-sans font-bold text-white">
                      NO SIGNIFICANT STRUCTURAL OR STATISTICAL DRIFT DETECTED
                    </h4>
                    <p className="text-[14px] font-sans text-[#B8C5D5] mt-1 leading-[1.6]">
                      Baseline (v{baseVersion?.version ?? 1}) and candidate (v{compVersion?.version ?? 2}) remain materially aligned across feature distributions, schema consistency, and target behavior.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {comparison.significant_changes.map((sc, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-slate-950/80 border border-white/[0.06] hover:border-[#39D6F5]/30 transition-colors flex items-start gap-3.5"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#39D6F5] shrink-0 mt-2" />
                      <span className="text-[14px] font-sans text-[#F4F7FB] leading-[1.55]">
                        {sc}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================== */}
          {/* SEGMENTED NAVIGATION TABS                                  */}
          {/* ========================================================== */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-950/90 border border-white/[0.08]">
            {[
              { id: 'all', label: 'ALL DRIFT ANALYSIS' },
              { id: 'schema', label: 'SCHEMA CHANGES' },
              { id: 'metrics', label: 'KEY METRICS DELTA' },
              { id: 'quality', label: 'QUALITY DELTA' },
              { id: 'impact', label: 'DOWNSTREAM IMPACT' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-[44px] px-5 rounded-lg text-[13px] sm:text-[14px] font-sans font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#39D6F5]/20 via-[#4D8DFF]/20 to-[#39D6F5]/20 text-[#39D6F5] border border-[#39D6F5]/40 shadow-[0_0_15px_rgba(57,214,245,0.15)]'
                    : 'text-[#8795A8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ========================================================== */}
          {/* TAB 1: SCHEMA & COLUMN CHANGES                             */}
          {/* ========================================================== */}
          {(activeTab === 'all' || activeTab === 'schema') && (
            <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.2)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
                <div className="space-y-1">
                  <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-[#39D6F5]" />
                    SCHEMA & COLUMN EVOLUTION
                  </h3>
                  <p className="text-[14px] font-sans text-[#B8C5D5]">
                    Structural field shifts, data type alterations, and column additions/removals.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-3 py-1 rounded-lg text-[12px] font-sans font-bold bg-[#35D399]/15 text-[#35D399] border border-[#35D399]/30">
                    +{schemaSummary.added} ADDED
                  </span>
                  <span className="px-3 py-1 rounded-lg text-[12px] font-sans font-bold bg-[#F06B78]/15 text-[#F06B78] border border-[#F06B78]/30">
                    -{schemaSummary.removed} REMOVED
                  </span>
                  <span className="px-3 py-1 rounded-lg text-[12px] font-sans font-bold bg-[#F4B740]/15 text-[#F4B740] border border-[#F4B740]/30">
                    {schemaSummary.modified} MODIFIED
                  </span>
                  <span className="px-3 py-1 rounded-lg text-[12px] font-sans font-bold bg-slate-900 text-[#8795A8] border border-white/[0.06]">
                    {schemaSummary.unchanged} UNCHANGED
                  </span>
                </div>
              </div>

              {/* Schema Items Grid */}
              {comparison.schema_changes.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-950/70 border border-white/[0.06] text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#35D399] mx-auto" />
                  <h4 className="text-[16px] font-sans font-bold text-white">SCHEMA UNCHANGED</h4>
                  <p className="text-[14px] text-[#B8C5D5]">
                    All column definitions and data types remain identical between the baseline and candidate datasets.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {comparison.schema_changes.map((sc) => (
                    <div
                      key={sc.column}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        sc.change_type === 'added'
                          ? 'bg-[#35D399]/10 border-[#35D399]/30 text-white'
                          : sc.change_type === 'removed'
                          ? 'bg-[#F06B78]/10 border-[#F06B78]/30 text-white'
                          : sc.change_type === 'type_changed'
                          ? 'bg-[#F4B740]/10 border-[#F4B740]/30 text-white'
                          : 'bg-slate-950/60 border-white/[0.06] text-[#B8C5D5]'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-sans font-bold text-[14px] block truncate" title={sc.column}>
                          {sc.column}
                        </span>
                        {sc.base_type && sc.comparison_type && sc.base_type !== sc.comparison_type && (
                          <span className="text-[12px] font-mono text-[#8795A8] block mt-0.5">
                            {sc.base_type} → {sc.comparison_type}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-sans uppercase font-bold px-2.5 py-1 rounded bg-black/40 shrink-0">
                        {sc.change_type.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: KEY NUMERIC METRICS & STATISTICAL DELTAS            */}
          {/* ========================================================== */}
          {(activeTab === 'all' || activeTab === 'metrics') && (
            <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.2)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
                <div className="space-y-1">
                  <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-[#39D6F5]" />
                    KEY NUMERIC METRICS & STATISTICAL DELTAS
                  </h3>
                  <p className="text-[14px] font-sans text-[#B8C5D5]">
                    Distribution shift, mean variance, and statistical significance across numeric columns.
                  </p>
                </div>
                <span className="text-[12px] font-mono text-[#8795A8] px-3.5 py-1.5 rounded-full bg-slate-900 border border-white/[0.06]">
                  {comparison.metric_changes.length} Measures Profiled
                </span>
              </div>

              {comparison.metric_changes.length === 0 ? (
                <div className="p-8 text-center text-[14px] font-sans text-[#8795A8]">
                  No common numeric measures found between these two versions.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead className="text-[12px] uppercase tracking-wider text-[#8795A8] font-sans font-semibold border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4">Column Name</th>
                        <th className="py-3 px-4">Baseline Mean</th>
                        <th className="py-3 px-4">Candidate Mean</th>
                        <th className="py-3 px-4">Mean Delta</th>
                        <th className="py-3 px-4">Median Delta</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {comparison.metric_changes.map((m) => (
                        <tr key={m.column} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-sans font-bold text-white">{m.column}</td>
                          <td className="py-3.5 px-4 font-mono text-[#B8C5D5]">{m.base_mean?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}</td>
                          <td className="py-3.5 px-4 font-mono text-white">{m.comparison_mean?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}</td>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span
                              className={
                                (m.mean_change_pct || 0) > 0
                                  ? 'text-[#35D399]'
                                  : (m.mean_change_pct || 0) < 0
                                  ? 'text-[#F06B78]'
                                  : 'text-[#8795A8]'
                              }
                            >
                              {(m.mean_change_pct || 0) > 0 ? '+' : ''}
                              {m.mean_change_pct ?? 0}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#B8C5D5]">
                            {(m.median_change_pct || 0) > 0 ? '+' : ''}
                            {m.median_change_pct ?? 0}%
                          </td>
                          <td className="py-3.5 px-4">
                            {m.is_significant ? (
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-sans font-bold uppercase tracking-wider bg-[#F4B740]/15 text-[#F4B740] border border-[#F4B740]/30">
                                SIGNIFICANT SHIFT
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-sans font-semibold uppercase tracking-wider bg-slate-900 text-[#8795A8] border border-white/[0.06]">
                                STABLE
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Categorical & Distribution Shifts */}
              {comparison.distribution_changes.length > 0 && (
                <div className="pt-6 border-t border-white/[0.06] space-y-4">
                  <h4 className="text-[16px] font-sans font-bold text-white uppercase tracking-tight">
                    Categorical & Distribution Drift
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {comparison.distribution_changes.map((dc) => (
                      <div
                        key={dc.column}
                        className="p-4 rounded-xl border border-white/[0.06] bg-slate-950/60 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-bold text-white text-[15px]">{dc.column}</span>
                          <span className="text-[12px] font-mono text-[#39D6F5] uppercase font-bold">{dc.column_type}</span>
                        </div>
                        <p className="text-[#B8C5D5] text-[13.5px] leading-[1.55]">{dc.shift_description}</p>
                        {dc.new_categories.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[12px] text-[#8795A8]">New values:</span>
                            {dc.new_categories.map((c) => (
                              <span key={c} className="px-2 py-0.5 rounded bg-[#35D399]/15 text-[#35D399] font-mono text-[11px] font-bold">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: QUALITY DELTA DEEP DIVE                             */}
          {/* ========================================================== */}
          {(activeTab === 'all' || activeTab === 'quality') && (
            <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.2)] space-y-6">
              <div className="flex items-center justify-between pb-5 border-b border-white/[0.06]">
                <div className="space-y-1">
                  <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-[#39D6F5]" />
                    DATA QUALITY & INTEGRITY DELTA
                  </h3>
                  <p className="text-[14px] font-sans text-[#B8C5D5]">
                    Completeness, validity, duplicate degradation, and null density evolution.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Score Delta */}
                <div className="p-6 rounded-xl bg-slate-950/80 border border-white/[0.06] text-center space-y-2">
                  <span className="text-[12px] font-sans font-semibold uppercase tracking-wider text-[#8795A8] block">
                    QUALITY SCORE
                  </span>
                  <div className="text-[34px] font-sans font-bold text-[#39D6F5]">
                    {comparison.summary.quality_comparison ? `${comparison.summary.quality_comparison}%` : 'N/A'}
                  </div>
                  <div className="text-[13px] text-[#B8C5D5]">
                    Baseline: {comparison.summary.quality_base ? `${comparison.summary.quality_base}%` : 'N/A'} (Δ {comparison.summary.quality_change ?? 0} pts)
                  </div>
                </div>

                {/* Missing Cells Delta */}
                <div className="p-6 rounded-xl bg-slate-950/80 border border-white/[0.06] text-center space-y-2">
                  <span className="text-[12px] font-sans font-semibold uppercase tracking-wider text-[#8795A8] block">
                    MISSING CELLS
                  </span>
                  <div className="text-[34px] font-sans font-bold text-white">
                    {comparison.summary.missing_cells_comparison.toLocaleString()}
                  </div>
                  <div className="text-[13px] text-[#B8C5D5]">
                    Baseline: {comparison.summary.missing_cells_base.toLocaleString()} (Δ {comparison.summary.missing_cells_change})
                  </div>
                </div>

                {/* Duplicates Delta */}
                <div className="p-6 rounded-xl bg-slate-950/80 border border-white/[0.06] text-center space-y-2">
                  <span className="text-[12px] font-sans font-semibold uppercase tracking-wider text-[#8795A8] block">
                    DUPLICATE ROWS
                  </span>
                  <div className="text-[34px] font-sans font-bold text-white">
                    {comparison.summary.duplicate_rows_comparison.toLocaleString()}
                  </div>
                  <div className="text-[13px] text-[#B8C5D5]">
                    Baseline: {comparison.summary.duplicate_rows_base.toLocaleString()} (Δ {comparison.summary.duplicate_rows_change})
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: SPLIT DOWNSTREAM IMPACT VIEW                        */}
          {/* ========================================================== */}
          {(activeTab === 'all' || activeTab === 'impact') && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Machine Learning & Prediction Impact */}
                <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.2)] flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                      <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                        <BrainCircuit className="w-5 h-5 text-[#39D6F5]" />
                        MODEL IMPACT
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-[12px] font-sans font-bold border uppercase tracking-wider ${
                          comparison.prediction_impact.schema_status === 'MODEL INPUT SCHEMA CHANGED'
                            ? 'bg-[#F06B78]/15 text-[#F06B78] border-[#F06B78]/30'
                            : comparison.prediction_impact.schema_status === 'SCHEMA UNCHANGED'
                            ? 'bg-[#35D399]/15 text-[#35D399] border-[#35D399]/30'
                            : 'bg-slate-900 text-[#8795A8] border-white/[0.08]'
                        }`}
                      >
                        {comparison.prediction_impact.schema_status}
                      </span>
                    </div>

                    <p className="text-[14px] font-sans text-[#B8C5D5] leading-[1.6] mb-5">
                      {comparison.prediction_impact.details}
                    </p>

                    {comparison.prediction_impact.affected_features.length > 0 && (
                      <div className="mb-4">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#F06B78] font-semibold block mb-2">
                          Affected Feature Columns:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {comparison.prediction_impact.affected_features.map((f) => (
                            <span key={f} className="px-2.5 py-1 rounded-lg text-[12px] font-mono bg-[#F06B78]/15 text-rose-200 border border-[#F06B78]/30 font-bold">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {comparison.prediction_impact.missing_targets.length > 0 && (
                      <div className="mb-4">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#F06B78] font-semibold block mb-2">
                          Missing Target Columns:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {comparison.prediction_impact.missing_targets.map((t) => (
                            <span key={t} className="px-2.5 py-1 rounded-lg text-[12px] font-mono bg-[#F06B78]/20 text-rose-100 border border-[#F06B78]/40 font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-[14px] font-sans">
                    <span className="text-[#8795A8]">Model Retrain Recommendation:</span>
                    <span
                      className={`font-bold ${
                        comparison.prediction_impact.refresh_recommended
                          ? 'text-[#F4B740]'
                          : 'text-[#35D399]'
                      }`}
                    >
                      {comparison.prediction_impact.refresh_recommended ? 'RECOMMENDED' : 'NOT REQUIRED'}
                    </span>
                  </div>
                </div>

                {/* RIGHT: Impact on Discovered Insights */}
                <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/85 border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.2)] flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                      <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
                        <Shield className="w-5 h-5 text-[#39D6F5]" />
                        INSIGHT IMPACT
                      </h3>
                      <span className="text-[12px] font-mono text-[#8795A8] px-3 py-1 rounded-full bg-slate-900 border border-white/[0.06]">
                        {comparison.insight_impacts.length} Evaluated
                      </span>
                    </div>

                    {comparison.insight_impacts.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-[#35D399] mx-auto" />
                        <h4 className="text-[16px] font-sans font-bold text-white">NO DOWNSTREAM IMPACT</h4>
                        <p className="text-[14px] font-sans text-[#B8C5D5] max-w-sm mx-auto">
                          Existing analytical artifacts and discovered insights remain aligned with the candidate version.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                        {comparison.insight_impacts.map((ins) => (
                          <div
                            key={ins.insight_id}
                            className="p-4 rounded-xl border border-white/[0.06] bg-slate-950/70 flex items-start justify-between gap-3 text-[14px]"
                          >
                            <div className="min-w-0">
                              <span className="font-sans font-bold text-white block truncate">{ins.title}</span>
                              <span className="text-[13px] font-sans text-[#8795A8] mt-1 block leading-[1.5]">{ins.explanation}</span>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-md text-[11px] font-sans font-bold uppercase tracking-wider shrink-0 border ${
                                ins.status === 'SUPPORTED'
                                  ? 'bg-[#35D399]/15 text-[#35D399] border-[#35D399]/30'
                                  : ins.status === 'CHANGED'
                                  ? 'bg-[#F4B740]/15 text-[#F4B740] border-[#F4B740]/30'
                                  : ins.status === 'NO LONGER OBSERVED'
                                  ? 'bg-[#F06B78]/15 text-[#F06B78] border-[#F06B78]/30'
                                  : 'bg-slate-900 text-[#8795A8] border-white/[0.08]'
                              }`}
                            >
                              {ins.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ====================================================== */}
              {/* AI INSIGHT MEMORY EVOLUTION (PHASE 4 TRACKING)         */}
              {/* ====================================================== */}
              <div className="p-7 sm:p-8 rounded-2xl bg-[#020711]/90 border border-[#9B7BFF]/25 shadow-[0_20px_60px_rgba(0,0,0,0.3)] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#9B7BFF]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#9B7BFF]/15 border border-[#9B7BFF]/30 flex items-center justify-center text-[#9B7BFF]">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-[18px] sm:text-[20px] font-sans font-bold text-white tracking-tight uppercase">
                          AI INSIGHT MEMORY DELTA
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#9B7BFF]/20 text-[#9B7BFF] border border-[#9B7BFF]/30 text-[11px] font-sans font-bold uppercase tracking-wider">
                          PHASE 4 TRACKING
                        </span>
                      </div>
                      <p className="text-[13.5px] font-sans text-[#B8C5D5] mt-0.5">
                        Analytical persistence and drift tracking across version transitions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Insight Memory Counters (Large 22–28px Numbers) */}
                {insightImpact && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-[#35D399]/20 text-center">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block">NEW</span>
                        <span className="text-[26px] font-sans font-bold text-[#35D399] block mt-1">{insightImpact.counters.new_count}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-[#4D8DFF]/20 text-center">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block">PERSISTED</span>
                        <span className="text-[26px] font-sans font-bold text-[#4D8DFF] block mt-1">{insightImpact.counters.persisted_count}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-[#39D6F5]/20 text-center">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block">STRENGTHENED</span>
                        <span className="text-[26px] font-sans font-bold text-[#39D6F5] block mt-1">{insightImpact.counters.strengthened_count}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-[#F4B740]/20 text-center">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block">WEAKENED</span>
                        <span className="text-[26px] font-sans font-bold text-[#F4B740] block mt-1">{insightImpact.counters.weakened_count}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-[#F06B78]/20 text-center col-span-2 sm:col-span-1">
                        <span className="text-[12px] font-sans uppercase tracking-wider text-[#8795A8] font-semibold block">DISAPPEARED</span>
                        <span className="text-[26px] font-sans font-bold text-[#F06B78] block mt-1">{insightImpact.counters.disappeared_count}</span>
                      </div>
                    </div>

                    {/* Horizontal State Distribution Bar */}
                    {memoryDistribution && (
                      <div className="h-3 rounded-full overflow-hidden flex bg-slate-900 border border-white/[0.08]">
                        {memoryDistribution.newPct > 0 && (
                          <div style={{ width: `${memoryDistribution.newPct}%` }} className="bg-[#35D399]" title={`New: ${memoryDistribution.newPct.toFixed(1)}%`} />
                        )}
                        {memoryDistribution.persistedPct > 0 && (
                          <div style={{ width: `${memoryDistribution.persistedPct}%` }} className="bg-[#4D8DFF]" title={`Persisted: ${memoryDistribution.persistedPct.toFixed(1)}%`} />
                        )}
                        {memoryDistribution.strengthenedPct > 0 && (
                          <div style={{ width: `${memoryDistribution.strengthenedPct}%` }} className="bg-[#39D6F5]" title={`Strengthened: ${memoryDistribution.strengthenedPct.toFixed(1)}%`} />
                        )}
                        {memoryDistribution.weakenedPct > 0 && (
                          <div style={{ width: `${memoryDistribution.weakenedPct}%` }} className="bg-[#F4B740]" title={`Weakened: ${memoryDistribution.weakenedPct.toFixed(1)}%`} />
                        )}
                        {memoryDistribution.disappearedPct > 0 && (
                          <div style={{ width: `${memoryDistribution.disappearedPct}%` }} className="bg-[#F06B78]" title={`Disappeared: ${memoryDistribution.disappearedPct.toFixed(1)}%`} />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {loadingInsightImpact ? (
                  <div className="py-10 flex items-center justify-center gap-3 text-[#B8C5D5] text-[14px]">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#9B7BFF]" />
                    <span>Analyzing analytical memory across versions...</span>
                  </div>
                ) : !insightImpact || insightImpact.impacts.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-950/60 border border-white/[0.06] text-center space-y-2">
                    <CheckCircle2 className="w-7 h-7 text-[#35D399] mx-auto" />
                    <h4 className="text-[16px] font-sans font-bold text-white">NO MEMORY DIFFERENCES</h4>
                    <p className="text-[14px] text-[#B8C5D5]">
                      No memory differences or formulaic drift detected between baseline (v{baseVersion?.version ?? 1}) and candidate (v{compVersion?.version ?? 2}).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                      {insightImpact.impacts.map((imp) => (
                        <div
                          key={imp.fingerprint}
                          className="p-4 rounded-xl border border-white/[0.06] bg-slate-950/70 hover:border-[#9B7BFF]/40 transition-colors flex flex-col gap-2.5 text-[14px]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[11px] font-sans font-bold uppercase tracking-wider border ${
                                  imp.status === 'NEW'
                                    ? 'bg-[#35D399]/15 text-[#35D399] border-[#35D399]/30'
                                    : imp.status === 'PERSISTED'
                                    ? 'bg-[#4D8DFF]/15 text-[#4D8DFF] border-[#4D8DFF]/30'
                                    : imp.status === 'STRENGTHENED'
                                    ? 'bg-[#39D6F5]/15 text-[#39D6F5] border-[#39D6F5]/30'
                                    : imp.status === 'WEAKENED'
                                    ? 'bg-[#F4B740]/15 text-[#F4B740] border-[#F4B740]/30'
                                    : 'bg-[#F06B78]/15 text-[#F06B78] border-[#F06B78]/30'
                                }`}
                              >
                                {imp.status}
                              </span>
                              <span className="text-[12px] font-sans font-semibold text-[#8795A8] uppercase">
                                {imp.category}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                #{imp.fingerprint.slice(0, 8)}
                              </span>
                            </div>

                            {imp.delta_magnitude !== null && imp.delta_magnitude !== undefined && (
                              <span className="text-[13px] font-mono font-bold text-white">
                                |Δ| = {imp.delta_magnitude.toFixed(3)}
                              </span>
                            )}
                          </div>

                          <div className="text-white font-sans font-bold text-[15px]">
                            {imp.title}
                          </div>

                          <div className="text-[#B8C5D5] text-[13.5px] leading-[1.6]">
                            {imp.explanation}
                          </div>

                          {imp.baseline_strength != null && imp.comparison_strength != null && (
                            <div className="text-[12px] font-mono text-[#8795A8] pt-1 border-t border-white/[0.04]">
                              Baseline: <strong className="text-white">{imp.baseline_strength.toFixed(3)}</strong> → Candidate: <strong className="text-[#39D6F5]">{imp.comparison_strength.toFixed(3)}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Downstream Recommendations Review Banner */}
                    {insightImpact.downstream_reviews.length > 0 && (
                      <div className="p-5 rounded-xl border border-[#F4B740]/30 bg-[#F4B740]/10 space-y-3">
                        <div className="flex items-center gap-2 text-[#F4B740] font-sans font-bold text-[15px]">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          Downstream Recommendations Review Suggested ({insightImpact.downstream_reviews.length})
                        </div>
                        <p className="text-[#F4F7FB] text-[13.5px] leading-[1.55]">
                          The following decisions were formulated against patterns that have weakened or disappeared in candidate version v{insightImpact.comparison_version}:
                        </p>
                        <div className="space-y-2.5">
                          {insightImpact.downstream_reviews.map((rev) => (
                            <div
                              key={rev.recommendation_id}
                              className="p-3.5 rounded-lg border border-[#F4B740]/20 bg-slate-950/80 flex flex-col gap-1 text-[13.5px]"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-sans font-bold text-white text-[14px]">{rev.title}</span>
                                <span className="px-2 py-0.5 rounded bg-[#F4B740]/20 text-[#F4B740] font-mono text-[11px] font-bold">
                                  {rev.target_metric}
                                </span>
                              </div>
                              <div className="text-[#B8C5D5] text-[13px]">{rev.reason}</div>
                              <div className="text-[#8795A8] text-[11.5px] font-mono">
                                Insight Status: {rev.linked_insight_status} {rev.linked_insight_title ? `(${rev.linked_insight_title})` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
