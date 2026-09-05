import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  GitCommit,
  Award,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Database,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { InsightResponse } from '../types';
import { fetchInsights, generateInsights } from '../services/api';

interface InsightsDashboardProps {
  datasetId: string;
  onNavigate?: (tab: string) => void;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ datasetId, onNavigate }) => {
  const [insightData, setInsightData] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'priority' | 'severity' | 'category'>('priority');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchInsights(datasetId);
      setInsightData(data);
    } catch (err: any) {
      console.warn('Failed to fetch insights, attempting generation:', err);
      try {
        const genData = await generateInsights(datasetId);
        setInsightData(genData);
      } catch (genErr: any) {
        setErrorMsg(genErr.message || 'Unable to generate automated business insights.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleRecalculate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const genData = await generateInsights(datasetId);
      setInsightData(genData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Insight generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 space-y-3 flex flex-col items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
        <span className="font-semibold text-slate-200 text-sm">Evaluating Evidence & Generating Automated Business Insights...</span>
        <p className="text-slate-500 max-w-md">Processing top performers, time-series trends, data quality logs, and bivariate correlations.</p>
      </div>
    );
  }

  if (errorMsg || !insightData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-6">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit mx-auto text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Cleaning & Processing Required</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {errorMsg || 'Automated insights require a processed dataset. Please apply a cleaning plan to generate a processed dataset version first.'}
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
        >
          Try Reloading Insights
        </button>
      </div>
    );
  }

  const { summary, insights } = insightData;

  // Filter logic
  let filtered = insights.filter((item) => {
    if (categoryFilter === 'ALL') return true;
    return item.category === categoryFilter;
  });

  // Sort logic
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'priority') {
      return b.priority_score - a.priority_score;
    }
    if (sortBy === 'severity') {
      const order: Record<string, number> = { CRITICAL: 4, WARNING: 3, POSITIVE: 2, INFO: 1 };
      return (order[b.severity] || 0) - (order[a.severity] || 0);
    }
    return a.category.localeCompare(b.category);
  });
  
  // Top Insights (always top 3 by priority from the currently filtered set)
  const topPriorityInsights = [...filtered].sort((a, b) => b.priority_score - a.priority_score).slice(0, 3);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">CRITICAL</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">WARNING</span>;
      case 'POSITIVE':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">POSITIVE</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">INFO</span>;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'PERFORMANCE':
        return <Award className="w-4 h-4 text-emerald-400" />;
      case 'TREND':
        return <TrendingUp className="w-4 h-4 text-purple-400" />;
      case 'CORRELATION':
        return <GitCommit className="w-4 h-4 text-sky-400" />;
      case 'DATA_QUALITY':
        return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      case 'OPPORTUNITY':
        return <Lightbulb className="w-4 h-4 text-amber-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* 01. INSIGHT ENGINE HEADER */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
            <Sparkles className="w-7 h-7 text-amber-400" />
            Automated Business Insight Engine
          </h1>
          <div className="flex items-center gap-4 mt-3 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-bold uppercase">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Status: Processed
            </span>
            <span className="text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Dataset ID: <strong className="text-white">{insightData.dataset_id}</strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-1">TOTAL INSIGHTS</div>
            <div className="text-5xl font-bold text-white font-mono leading-none tracking-tighter">
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 1 }}>
                {summary.total}
              </motion.span>
            </div>
          </div>
          <button
            onClick={handleRecalculate}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors h-fit"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>Regenerate</span>
          </button>
        </div>
      </motion.div>

      {/* 02. KEY SUMMARY NUMBERS */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'POSITIVE', count: summary.positive_count, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'WARNING', count: summary.warning_count, color: 'text-amber-400', border: 'border-amber-500/20' },
          { label: 'INFO', count: summary.info_count, color: 'text-sky-400', border: 'border-sky-500/20' },
          { label: 'OPPORTUNITY', count: summary.opportunity_count, color: 'text-indigo-400', border: 'border-indigo-500/20' },
        ].map((stat) => (
          <div key={stat.label} className={`bg-slate-900/50 border ${stat.border} rounded-xl p-5 flex flex-col justify-center transition-colors hover:bg-slate-900`}>
            <div className={`text-xs font-bold ${stat.color} uppercase tracking-wider mb-2 font-mono`}>{stat.label}</div>
            <div className="text-3xl font-bold text-white font-mono tracking-tight">{stat.count}</div>
          </div>
        ))}
      </motion.div>

      {/* 03. FILTER / SORT BAR */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 flex items-center gap-1.5 mr-2 pl-2">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-mono uppercase">Category:</span>
          </span>

          {['ALL', 'PERFORMANCE', 'TREND', 'CORRELATION', 'DATA_QUALITY', 'OPPORTUNITY'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg transition-colors font-mono uppercase ${
                categoryFilter === cat
                  ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30'
                  : 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pr-2">
          <span className="text-slate-400 flex items-center gap-1.5 font-mono uppercase">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort By:</span>
          </span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="priority">Priority Score (High → Low)</option>
            <option value="severity">Severity (Critical → Info)</option>
            <option value="category">Category</option>
          </select>
        </div>
      </motion.div>

      {/* 04. PRIORITY INSIGHTS (Top 3) */}
      {topPriorityInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Top Priority Insights
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {topPriorityInsights.map((item, i) => (
              <motion.div
                key={`top-${item.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col hover:border-slate-600 transition-colors shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                      {getCategoryIcon(item.category)}
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-wider">{item.category}</span>
                  </div>
                  {getSeverityBadge(item.severity)}
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-base font-bold text-white leading-tight">{item.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{item.observation}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-800 flex items-end justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider">Priority Score</span>
                  <span className="text-2xl font-bold text-amber-400 font-mono leading-none tracking-tight">{item.priority_score}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 05 & 06. INSIGHT EXPLORER (Compact List + Expandable Detail) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-400" />
          Insight Explorer ({filtered.length})
        </h2>
        
        {filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400 font-mono">
            No insights match the selected filters.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            {filtered.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div key={`explorer-${item.id}`} className="border-b border-slate-800/60 last:border-0 transition-colors">
                  {/* Compact Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-800/40 transition-colors text-left gap-4 ${isExpanded ? 'bg-slate-800/30' : ''}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider truncate">{item.category}</span>
                          {getSeverityBadge(item.severity)}
                        </div>
                        <h4 className="text-sm font-bold text-white truncate pr-4">{item.title}</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 shrink-0 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 font-mono block uppercase tracking-wider mb-0.5">Priority</span>
                        <span className="text-base font-bold text-amber-400 font-mono">{item.priority_score}</span>
                      </div>
                      <div className="text-slate-500 bg-slate-950/50 p-1.5 rounded-md border border-slate-800">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>
                  
                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden bg-slate-950/50 border-t border-slate-800/60"
                      >
                        <div className="p-6 space-y-6">
                          
                          {/* Title & Description */}
                          <div>
                            <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                            <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">{item.observation}</p>
                          </div>
                          
                          {/* Calculated Dataset Evidence */}
                          {item.evidence && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono">
                              <div className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5 mb-4">
                                <Database className="w-3.5 h-3.5" />
                                <span>Calculated Dataset Evidence</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                {item.evidence.dimension && (
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Dimension</span>
                                    <span className="text-slate-200 font-bold">{item.evidence.dimension}</span>
                                  </div>
                                )}
                                {item.evidence.metric && (
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Metric</span>
                                    <span className="text-slate-200 font-bold">{item.evidence.metric}</span>
                                  </div>
                                )}
                                {item.evidence.top_value !== undefined && item.evidence.top_value !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Value</span>
                                    <span className="text-emerald-400 font-bold text-sm">
                                      {typeof item.evidence.top_value === 'number'
                                        ? item.evidence.top_value.toLocaleString()
                                        : String(item.evidence.top_value)}
                                    </span>
                                  </div>
                                )}
                                {item.evidence.contribution_percent !== undefined && item.evidence.contribution_percent !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Contribution</span>
                                    <span className="text-indigo-400 font-bold text-sm">{item.evidence.contribution_percent}%</span>
                                  </div>
                                )}
                                {item.evidence.correlation !== undefined && item.evidence.correlation !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Correlation (r)</span>
                                    <span className="text-sky-400 font-bold text-sm">{item.evidence.correlation}</span>
                                  </div>
                                )}
                                {item.evidence.sample_size !== undefined && item.evidence.sample_size !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Sample Size</span>
                                    <span className="text-slate-300 font-bold text-sm">{item.evidence.sample_size.toLocaleString()} rows</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Why It Matters */}
                          {item.explanation && (
                            <div className="flex items-start gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                              <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />
                              <div>
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">Why It Matters</h5>
                                <p className="text-sm text-slate-300 leading-relaxed">{item.explanation}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Evidence-Backed Recommendation */}
                          {item.recommendation && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                              <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                              <div>
                                <h5 className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-1">Evidence-Backed Recommendation</h5>
                                <p className="text-sm text-amber-200 leading-relaxed">{item.recommendation}</p>
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* 07. NEXT ACTION */}
      {onNavigate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex justify-end pt-6 pb-12">
          <button
            onClick={() => onNavigate('predictions')}
            className="group relative flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full overflow-hidden shadow-lg transition-all duration-300 hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="font-sans font-bold text-xs tracking-widest text-white uppercase relative z-10 flex items-center gap-2">
              Continue to Predictions <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </motion.div>
      )}
    </div>
  );
};
