import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { InsightResponse } from '../types';
import { fetchInsights, generateInsights } from '../services/api';

interface InsightsDashboardProps {
  datasetId: string;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ datasetId }) => {
  const [insightData, setInsightData] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'priority' | 'severity' | 'category'>('priority');

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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">CRITICAL</span>;
      case 'WARNING':
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">WARNING</span>;
      case 'POSITIVE':
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">POSITIVE</span>;
      default:
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">INFO</span>;
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
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Automated Business Insight Engine</h3>
            <p className="text-xs text-slate-400">Deterministic, evidence-backed findings derived from processed dataset metrics</p>
          </div>
        </div>

        <button
          onClick={handleRecalculate}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Regenerate Insights</span>
        </button>
      </div>

      {/* Visible Dataset Metadata Context Bar (Requirement 9) */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 bg-emerald-500/5 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Status: Processed</span>
          </span>
          <span className="text-slate-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            Analyzing Dataset ID: <strong className="text-white font-bold">{insightData.dataset_id}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 font-sans font-semibold text-xs">
          <span className="text-slate-400">Total Insights: <strong className="text-white font-mono font-bold">{summary.total}</strong></span>
          <span className="text-emerald-400 font-mono">{summary.positive_count} Positive</span>
          <span className="text-amber-400 font-mono">{summary.warning_count} Warning</span>
          <span className="text-sky-400 font-mono">{summary.info_count} Info</span>
          <span className="text-indigo-400 font-mono">{summary.opportunity_count} Opportunity</span>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </span>

          {['ALL', 'PERFORMANCE', 'TREND', 'CORRELATION', 'DATA_QUALITY', 'OPPORTUNITY'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort By:</span>
          </span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-500"
          >
            <option value="priority">Priority Score (High to Low)</option>
            <option value="severity">Severity</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      {/* Insight Cards List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            No insights match the selected category filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors shadow-sm"
            >
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-800 rounded border border-slate-700">
                    {getCategoryIcon(item.category)}
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                    {item.category}
                  </span>
                  {getSeverityBadge(item.severity)}
                </div>

                <div className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-amber-400 font-bold">
                  Priority Score: {item.priority_score}
                </div>
              </div>

              {/* Title & Observation */}
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-white tracking-tight">{item.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.observation}</p>
              </div>

              {/* Traceable Evidence Box */}
              {item.evidence && (
                <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-3.5 space-y-2 font-mono text-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Calculated Dataset Evidence</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px]">
                    {item.evidence.dimension && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Dimension</span>
                        <span className="text-slate-200 font-bold">{item.evidence.dimension}</span>
                      </div>
                    )}
                    {item.evidence.metric && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Metric</span>
                        <span className="text-slate-200 font-bold">{item.evidence.metric}</span>
                      </div>
                    )}
                    {item.evidence.top_value !== undefined && item.evidence.top_value !== null && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Value</span>
                        <span className="text-emerald-400 font-bold">
                          {typeof item.evidence.top_value === 'number'
                            ? item.evidence.top_value.toLocaleString()
                            : String(item.evidence.top_value)}
                        </span>
                      </div>
                    )}
                    {item.evidence.contribution_percent !== undefined && item.evidence.contribution_percent !== null && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Contribution</span>
                        <span className="text-purple-300 font-bold">{item.evidence.contribution_percent}%</span>
                      </div>
                    )}
                    {item.evidence.correlation !== undefined && item.evidence.correlation !== null && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Pearson Correlation (r)</span>
                        <span className="text-sky-400 font-bold">{item.evidence.correlation}</span>
                      </div>
                    )}
                    {item.evidence.sample_size !== undefined && item.evidence.sample_size !== null && (
                      <div>
                        <span className="text-slate-500 block text-[10px]">Sample Size</span>
                        <span className="text-slate-300">{item.evidence.sample_size} rows</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Explanation / Why it matters */}
              {item.explanation && (
                <div className="text-xs text-slate-400 font-sans flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-300">Why it matters: </strong>
                    <span>{item.explanation}</span>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {item.recommendation && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2.5 font-sans">
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-300 font-bold block mb-0.5">Evidence-Backed Recommendation</strong>
                    <span>{item.recommendation}</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
