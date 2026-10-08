import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PieChart,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
  TrendingUp,
  FileText,
  Boxes,
  ArrowRight,
  BarChart3,
  Network,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import {
  fetchDecisionPortfolioOverview,
  fetchDecisionPortfolioTrends,
  DecisionPortfolioOverviewResponse,
  DecisionPortfolioTrendsResponse,
  PortfolioDecisionRow,
  PortfolioFilterParams,
  fetchProjectDecisionReport,
  ProjectDecisionReportResponse,
} from '../services/api';
import { DecisionKnowledgeView } from './DecisionKnowledgeView';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';



interface DecisionPortfolioViewProps {
  projectId: string | null;
  projectName?: string | null;
  onNavigateToDecision?: (decisionId: string) => void;
}

export const DecisionPortfolioView: React.FC<DecisionPortfolioViewProps> = ({
  projectId,
  projectName,
  onNavigateToDecision,
}) => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DecisionPortfolioOverviewResponse | null>(null);
  const [trends, setTrends] = useState<DecisionPortfolioTrendsResponse | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [governanceFilter, setGovernanceFilter] = useState<string>('');
  const [executionFilter, setExecutionFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [metricFilter, setMetricFilter] = useState<string>('');

  // Active view tab: 'overview' | 'capacity' | 'patterns' | 'dependencies' | 'trends' | 'audit_report' | 'knowledge'
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'capacity' | 'patterns' | 'dependencies' | 'trends' | 'audit_report' | 'knowledge'>('overview');
  const [projectReport, setProjectReport] = useState<ProjectDecisionReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportCopied, setReportCopied] = useState<boolean>(false);

  const loadProjectReport = useCallback(async () => {
    if (!projectId) return;
    setLoadingReport(true);
    try {
      const rep = await fetchProjectDecisionReport(projectId);
      setProjectReport(rep);
    } catch (err) {
      console.error('Failed to load project report:', err);
    } finally {
      setLoadingReport(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (activeSubTab === 'audit_report' && !projectReport && !loadingReport) {
      loadProjectReport();
    }
  }, [activeSubTab, projectReport, loadingReport, loadProjectReport]);


  const loadPortfolioData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters: PortfolioFilterParams = {};
      if (governanceFilter) filters.governance_status = governanceFilter;
      if (executionFilter) filters.execution_status = executionFilter;
      if (outcomeFilter) filters.outcome_status = outcomeFilter;
      if (metricFilter) filters.metric = metricFilter;

      const [overviewRes, trendsRes] = await Promise.all([
        fetchDecisionPortfolioOverview(projectId, filters),
        fetchDecisionPortfolioTrends(projectId, period).catch(() => null),
      ]);

      setData(overviewRes);
      setTrends(trendsRes);
    } catch (err: any) {
      console.error('Failed to fetch decision portfolio:', err);
      setError(err?.message || 'Failed to load decision portfolio data.');
    } finally {
      setLoading(false);
    }
  }, [projectId, governanceFilter, executionFilter, outcomeFilter, metricFilter, period]);

  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

  // Client-side search filtering on decision inventory
  const filteredDecisions = useMemo(() => {
    if (!data?.decisions) return [];
    if (!searchQuery.trim()) return data.decisions;

    const q = searchQuery.toLowerCase();
    return data.decisions.filter((d: PortfolioDecisionRow) =>
      d.decision_id.toLowerCase().includes(q) ||
      (d.metric && d.metric.toLowerCase().includes(q)) ||
      (d.dataset_name && d.dataset_name.toLowerCase().includes(q)) ||
      d.governance_status.toLowerCase().includes(q) ||
      (d.execution_status && d.execution_status.toLowerCase().includes(q)) ||
      d.outcome_status.toLowerCase().includes(q)
    );
  }, [data?.decisions, searchQuery]);

  const clearAllFilters = () => {
    setGovernanceFilter('');
    setExecutionFilter('');
    setOutcomeFilter('');
    setMetricFilter('');
    setSearchQuery('');
  };

  const hasActiveFilters = Boolean(
    governanceFilter || executionFilter || outcomeFilter || metricFilter || searchQuery
  );

  // Status color helpers
  const getGovBadgeStyle = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'PENDING_APPROVAL': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'UNDER_REVIEW': return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'ESCALATED': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'REJECTED': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'ON_HOLD': return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'EXECUTED': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'CLOSED': return 'bg-slate-600/10 text-slate-400 border-slate-600/30';
      default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
    }
  };

  const getExecBadgeStyle = (status?: string | null) => {
    if (!status) return 'bg-slate-800/40 text-slate-500 border-slate-700/40';
    switch (status) {
      case 'EXECUTED': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
      case 'CONFIRMED': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'READY': return 'bg-blue-500/15 text-blue-300 border-blue-500/40';
      case 'PENDING_CONFIRMATION': return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      case 'OUTCOME_MONITORING': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40';
      case 'EXECUTION_FAILED': return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      case 'NOT_EXECUTED': return 'bg-slate-600/20 text-slate-400 border-slate-600/40';
      case 'CLOSED': return 'bg-slate-700/20 text-slate-400 border-slate-600/40';
      default: return 'bg-slate-800/40 text-slate-400 border-slate-700/40';
    }
  };

  const getOutcomeBadgeStyle = (status: string) => {
    switch (status) {
      case 'MATCHED': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'OBSERVED': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'DIFFERED': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MATERIALLY_DIFFERED': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-800/30 text-slate-400 border-slate-700/30';
    }
  };

  if (!projectId) {
    return (
      <div className="p-12 rounded-2xl glass-panel-premium border border-white/5 text-center max-w-xl mx-auto space-y-4 my-12">
        <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
          <PieChart className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white font-sans">No Project Selected</h3>
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          Select an active project from Workspace Projects to inspect the portfolio of decisions, governance states, execution records, and cross-decision patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-24 text-slate-100 font-sans">
      
      {/* 1. TOP HEADER BAR */}
      <div className="p-6 rounded-2xl glass-panel-premium border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
              <PieChart className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-accent-cyan">
              PHASE 11 • DECISION PORTFOLIO & CROSS-DECISION INTELLIGENCE
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            Decision Portfolio
            <span className="text-xs font-mono font-normal px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
              Project: {projectName || projectId}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-decision aggregation, governance & execution distribution, empirical patterns, and explicit dependencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 text-xs font-mono">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg uppercase transition-all ${
                  period === p
                    ? 'bg-accent-cyan text-slate-950 font-bold shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={loadPortfolioData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-accent-cyan/40 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Refresh Portfolio"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent-cyan' : ''}`} />
          </button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadPortfolioData}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-mono text-[11px] font-bold text-white transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* CONTINUOUS LOADING STATE */}
      {loading && !data && (
        <div className="py-8">
          <ContinuousIntelligenceEngine
            mode="performance"
            active={loading}
            title="SYNTHESIZING PORTFOLIO INTELLIGENCE"
            description="Aggregating multi-decision metrics, governance states, cross-decision execution patterns, and systemic impact..."
            metrics={[
              { label: 'PORTFOLIO', value: projectName || projectId || 'ACTIVE' },
              { label: 'AGGREGATION', value: 'CROSS-DECISION' },
              { label: 'RESOLUTION', value: period.toUpperCase() },
              { label: 'STATE', value: 'STREAMING' }
            ]}
          />
        </div>
      )}

      {/* EMPTY PORTFOLIO STATE */}
      {!loading && data && data.total_decisions_count === 0 && (
        <div className="p-16 rounded-2xl glass-panel-premium border border-white/5 text-center max-w-xl mx-auto space-y-4 my-8">
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">NO DECISION PORTFOLIO DATA</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No decision records, approvals, or executions exist for project &ldquo;{projectName || projectId}&rdquo;. Create decisions via the Decision Intelligence pipeline to populate the portfolio layer.
          </p>
        </div>
      )}

      {/* MAIN CONTENT ZONE */}
      {data && data.total_decisions_count > 0 && (
        <>
          {/* 2. CONCISE FACTUAL KPI STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'TOTAL DECISIONS', val: data.kpis.total_decisions, icon: Boxes, color: 'text-white' },
              { label: 'UNDER REVIEW', val: data.kpis.decisions_under_review, icon: Clock, color: 'text-sky-400' },
              { label: 'PENDING APPROVAL', val: data.kpis.pending_approval, icon: ShieldCheck, color: 'text-amber-400' },
              { label: 'APPROVED', val: data.kpis.approved, icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'EXECUTED', val: data.kpis.executed, icon: Zap, color: 'text-cyan-400' },
              { label: 'MONITORING', val: data.kpis.outcome_monitoring, icon: Activity, color: 'text-indigo-400' },
              { label: 'ACTIVE SIGNALS', val: data.kpis.decisions_with_active_learning_signals, icon: AlertTriangle, color: 'text-rose-400' },
              { label: 'OBSERVED OUTCOMES', val: data.kpis.decisions_with_observed_outcomes, icon: TrendingUp, color: 'text-teal-400' },
            ].map((kpi, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl glass-panel-premium border border-white/5 shadow-md flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1">
                  <span>{kpi.label}</span>
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
                <div className={`text-xl font-black font-mono ${kpi.color}`}>
                  {kpi.val}
                </div>
              </div>
            ))}
          </div>

          {/* 3. SUB-TAB NAVIGATION */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            {[
              { id: 'overview', label: 'PORTFOLIO OVERVIEW', icon: Layers },
              { id: 'capacity', label: 'OPERATIONS & CAPACITY', icon: Zap },
              { id: 'patterns', label: 'CROSS-DECISION PATTERNS', icon: Activity },
              { id: 'dependencies', label: 'DEPENDENCIES & CLUSTERS', icon: Boxes },
              { id: 'trends', label: 'CHRONOLOGICAL TRENDS', icon: TrendingUp },
              { id: 'audit_report', label: 'ENTERPRISE AUDIT REPORT', icon: FileText },
              { id: 'knowledge', label: 'DECISION KNOWLEDGE', icon: BookOpen },
            ].map((tab) => (

              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                  activeSubTab === tab.id
                    ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW (DISTRIBUTIONS + INVENTORY) */}
          {activeSubTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Distributions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Governance Distribution Panel */}
                <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent-cyan" />
                      Governance Distribution
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Click state to filter
                    </span>
                  </div>

                  <div className="space-y-2">
                    {data.governance_distribution.map((item) => {
                      const isSelected = governanceFilter.toUpperCase() === item.status.toUpperCase();
                      return (
                        <div
                          key={item.status}
                          onClick={() => setGovernanceFilter(isSelected ? '' : item.status)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-accent-cyan/10 border-accent-cyan/40 text-white'
                              : 'bg-black/20 border-white/5 hover:border-white/20 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-accent-cyan shadow-[0_0_8px_#22D3EE]' : 'bg-slate-500'}`} />
                            <span className="font-mono text-xs">{item.status}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="text-slate-400">{item.count}</span>
                            <span className="text-slate-500 w-12 text-right">{item.percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Execution Distribution Panel */}
                <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent-electricBlue" />
                      Execution Distribution
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Click state to filter
                    </span>
                  </div>

                  <div className="space-y-2">
                    {data.execution_distribution.map((item) => {
                      const isSelected = executionFilter.toUpperCase() === item.status.toUpperCase();
                      return (
                        <div
                          key={item.status}
                          onClick={() => setExecutionFilter(isSelected ? '' : item.status)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-accent-electricBlue/10 border-accent-electricBlue/40 text-white'
                              : 'bg-black/20 border-white/5 hover:border-white/20 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-accent-electricBlue shadow-[0_0_8px_#3B82F6]' : 'bg-slate-500'}`} />
                            <span className="font-mono text-xs">{item.status}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="text-slate-400">{item.count}</span>
                            <span className="text-slate-500 w-12 text-right">{item.percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* 4. DECISION INVENTORY TABLE */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                
                {/* Table Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-mono font-bold tracking-wider text-white uppercase flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent-cyan" />
                      Decision Inventory
                    </h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
                      {filteredDecisions.length} of {data.total_decisions_count}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search decisions, metrics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 w-56"
                      />
                    </div>

                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-accent-cyan transition-all"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter tags pill row */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                    <span className="text-slate-500">Active Filters:</span>
                    {governanceFilter && (
                      <span className="px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                        Gov: {governanceFilter}
                        <button onClick={() => setGovernanceFilter('')} className="hover:text-white">×</button>
                      </span>
                    )}
                    {executionFilter && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        Exec: {executionFilter}
                        <button onClick={() => setExecutionFilter('')} className="hover:text-white">×</button>
                      </span>
                    )}
                    {outcomeFilter && (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        Outcome: {outcomeFilter}
                        <button onClick={() => setOutcomeFilter('')} className="hover:text-white">×</button>
                      </span>
                    )}
                    {metricFilter && (
                      <span className="px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                        Metric: {metricFilter}
                        <button onClick={() => setMetricFilter('')} className="hover:text-white">×</button>
                      </span>
                    )}
                  </div>
                )}

                {/* Inventory Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Decision ID</th>
                        <th className="py-2.5 px-3">Metric</th>
                        <th className="py-2.5 px-3">Dataset</th>
                        <th className="py-2.5 px-3">Governance</th>
                        <th className="py-2.5 px-3">Execution</th>
                        <th className="py-2.5 px-3">Outcome</th>
                        <th className="py-2.5 px-3 text-center">Active Signals</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredDecisions.map((row: PortfolioDecisionRow) => (
                        <tr key={row.decision_id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                            <span className="truncate max-w-[140px]" title={row.decision_id}>
                              {row.decision_id}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {row.metric || <span className="text-slate-600">—</span>}
                          </td>
                          <td className="py-3 px-3 text-slate-400 truncate max-w-[120px]" title={row.dataset_name || row.dataset_id}>
                            {row.dataset_name || row.dataset_id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getGovBadgeStyle(row.governance_status)}`}>
                              {row.governance_status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getExecBadgeStyle(row.execution_status)}`}>
                              {row.execution_status || 'NOT_INITIATED'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getOutcomeBadgeStyle(row.outcome_status)}`}>
                              {row.outcome_status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {row.active_signals_count > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                {row.active_signals_count} ACTIVE
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[11px]">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {onNavigateToDecision && (
                              <button
                                onClick={() => onNavigateToDecision(row.decision_id)}
                                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-accent-cyan/15 hover:text-accent-cyan border border-white/10 text-slate-300 text-[11px] font-mono transition-all flex items-center gap-1.5 ml-auto"
                              >
                                <span>Inspect</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredDecisions.length === 0 && (
                    <div className="py-12 text-center text-slate-500 text-xs font-mono">
                      No decisions match the selected filters.
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB: OPERATIONS & CAPACITY (PHASE 12) */}
          {activeSubTab === 'capacity' && (
            <div className="space-y-6">
              
              {/* SECTION A: PORTFOLIO OPERATIONS & BOTTLENECK INDICATORS */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent-cyan" />
                    Portfolio Operations
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Persisted lifecycle states
                  </span>
                </div>

                {/* Compact Operations Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: 'Pending Approval', count: data.capacity?.operations.pending_approval ?? 0, color: 'text-amber-400' },
                    { label: 'Pending Confirmation', count: data.capacity?.operations.pending_confirmation ?? 0, color: 'text-sky-400' },
                    { label: 'Executing', count: data.capacity?.operations.executing ?? 0, color: 'text-cyan-400' },
                    { label: 'Outcome Monitoring', count: data.capacity?.operations.outcome_monitoring ?? 0, color: 'text-indigo-400' },
                    { label: 'Execution Failed', count: data.capacity?.operations.execution_failed ?? 0, color: 'text-rose-400' },
                    { label: 'Pending Outcomes', count: data.capacity?.operations.pending_outcomes ?? 0, color: 'text-teal-400' },
                    { label: 'Active Signals', count: data.capacity?.operations.active_learning_signals ?? 0, color: 'text-purple-400' },
                  ].map((op, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-slate-400 uppercase leading-tight">{op.label}</span>
                      <span className={`text-xl font-mono font-black mt-2 ${op.color}`}>{op.count}</span>
                    </div>
                  ))}
                </div>

                {/* Operational Bottleneck Indicators */}
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
                    Operational Bottleneck Indicators
                  </span>
                  {data.capacity && data.capacity.bottlenecks && data.capacity.bottlenecks.filter(b => b.count > 0).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {data.capacity.bottlenecks.filter(b => b.count > 0).map((b, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-white">{b.indicator}</span>
                            <span className="px-2 py-0.5 rounded bg-white/10 text-accent-cyan font-bold">{b.count}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-sans">{b.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 rounded-xl bg-black/20 border border-white/5 text-center text-slate-500 text-xs font-mono">
                      NO ACTIVE OPERATIONAL BOTTLENECK INDICATORS
                    </div>
                  )}
                </div>

                {/* Workload Capacity & Exposure Strip */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Execution Capacity Indicators */}
                  <div className="p-4 rounded-xl bg-black/25 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 block">
                      Execution Capacity Indicators
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Pending Confirmations:</span>
                        <span className="text-white font-bold">{data.capacity?.capacity_indicators.pending_confirmations ?? 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Currently Executing:</span>
                        <span className="text-cyan-400 font-bold">{data.capacity?.capacity_indicators.currently_executing ?? 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Executions Completed:</span>
                        <span className="text-emerald-400 font-bold">{data.capacity?.capacity_indicators.executions_completed ?? 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Execution Failures:</span>
                        <span className="text-rose-400 font-bold">{data.capacity?.capacity_indicators.execution_failures ?? 0}</span>
                      </div>
                      {data.capacity?.capacity_indicators.avg_execution_duration_seconds != null && (
                        <div className="flex justify-between p-2 rounded bg-white/[0.02] col-span-2">
                          <span className="text-slate-400">Average Execution Duration:</span>
                          <span className="text-accent-cyan font-bold">{data.capacity.capacity_indicators.avg_execution_duration_seconds}s</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Exposure Indicators */}
                  <div className="p-4 rounded-xl bg-black/25 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 block">
                      Active Exposure Indicators
                    </span>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Decisions with Active Signals:</span>
                        <span className="text-rose-400 font-bold">{data.capacity?.exposure_indicators.decisions_with_active_learning_signals ?? 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Decisions Awaiting Outcomes:</span>
                        <span className="text-amber-400 font-bold">{data.capacity?.exposure_indicators.decisions_awaiting_outcomes ?? 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Decisions with Material Deviations:</span>
                        <span className="text-rose-400 font-bold">{data.capacity?.exposure_indicators.decisions_with_material_deviations ?? 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-white/[0.02]">
                        <span className="text-slate-400">Decisions with Execution Failures:</span>
                        <span className="text-rose-400 font-bold">{data.capacity?.exposure_indicators.decisions_with_execution_failures ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* SECTION B: DECISION CONCENTRATION */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-accent-electricBlue" />
                    Decision Concentration
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Descriptive distribution
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* By Metric */}
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold text-slate-300 block border-b border-white/5 pb-1">
                      Decision concentration by metric
                    </span>
                    {data.capacity?.concentration?.by_metric && data.capacity.concentration.by_metric.length > 0 ? (
                      <div className="space-y-1 text-xs font-mono">
                        {data.capacity.concentration.by_metric.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                            <span className="text-slate-300 truncate max-w-[180px]" title={item.key}>{item.key}</span>
                            <span className="text-accent-cyan font-bold">{item.decision_count} decisions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 py-3 text-center">No metric concentration data</div>
                    )}
                  </div>

                  {/* By Dataset */}
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold text-slate-300 block border-b border-white/5 pb-1">
                      Decision concentration by dataset
                    </span>
                    {data.capacity?.concentration?.by_dataset && data.capacity.concentration.by_dataset.length > 0 ? (
                      <div className="space-y-1 text-xs font-mono">
                        {data.capacity.concentration.by_dataset.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                            <span className="text-slate-300 truncate max-w-[180px]" title={item.label}>{item.label}</span>
                            <span className="text-white font-bold">{item.decision_count} decisions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 py-3 text-center">No dataset concentration data</div>
                    )}
                  </div>

                  {/* By Scenario */}
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold text-slate-300 block border-b border-white/5 pb-1">
                      Decision concentration by scenario
                    </span>
                    {data.capacity?.concentration?.by_scenario && data.capacity.concentration.by_scenario.length > 0 ? (
                      <div className="space-y-1 text-xs font-mono">
                        {data.capacity.concentration.by_scenario.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                            <span className="text-slate-300 truncate max-w-[180px]" title={item.label}>{item.label}</span>
                            <span className="text-amber-400 font-bold">{item.decision_count} decisions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 py-3 text-center">No scenario concentration data</div>
                    )}
                  </div>

                  {/* By Model (Explicit linkage only) */}
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold text-slate-300 block border-b border-white/5 pb-1">
                      Decision concentration by model
                    </span>
                    {data.capacity?.concentration?.by_model && data.capacity.concentration.by_model.length > 0 ? (
                      <div className="space-y-1 text-xs font-mono">
                        {data.capacity.concentration.by_model.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                            <span className="text-slate-300 truncate max-w-[180px]" title={item.label}>{item.label}</span>
                            <span className="text-purple-400 font-bold">{item.decision_count} decisions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 py-3 text-center">No explicit model concentration data</div>
                    )}
                  </div>

                  {/* By Status */}
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <span className="text-[11px] font-mono font-bold text-slate-300 block border-b border-white/5 pb-1">
                      Decision concentration by status
                    </span>
                    {data.capacity?.concentration?.by_status && data.capacity.concentration.by_status.length > 0 ? (
                      <div className="space-y-1 text-xs font-mono">
                        {data.capacity.concentration.by_status.map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                            <span className="text-slate-300 truncate max-w-[180px]" title={item.label}>{item.label}</span>
                            <span className="text-sky-400 font-bold">{item.decision_count} decisions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 py-3 text-center">No status concentration data</div>
                    )}
                  </div>
                </div>

              </div>

              {/* SECTION C: SHARED DEPENDENCIES & FACTUAL ADVISORIES */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Network className="w-4 h-4 text-accent-cyan" />
                    Shared Dependencies
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Factual dependency concentration
                  </span>
                </div>

                {data.capacity?.dependencies && data.capacity.dependencies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.capacity.dependencies.map((dep, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-accent-cyan">
                            {dep.dependency_type}: {dep.label}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {dep.decision_count} decisions
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs text-slate-200 font-sans">
                          ℹ️ {dep.advisory}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {dep.decision_ids.map((id) => (
                            <span key={id} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs font-mono">
                    NO SHARED DEPENDENCIES
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: PATTERNS (METRICS, RECURRING DEVIATIONS, SIGNALS, FAILURES) */}
          {activeSubTab === 'patterns' && (

            <div className="space-y-6">
              
              {/* Recurring Deviations Alert Banner */}
              {data.recurring_deviations.length > 0 ? (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    Recurring Material Deviations Detected ({data.recurring_deviations.length})
                  </div>
                  <div className="space-y-3">
                    {data.recurring_deviations.map((dev, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-black/40 border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs font-mono">
                            Metric: {dev.metric_name}
                          </span>
                          <span className="text-[11px] font-mono text-amber-300">
                            {dev.material_deviations_count} of {dev.observed_outcomes_count} outcomes differed
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {dev.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-slate-400">
                          <span>Source Decisions:</span>
                          {dev.decision_ids.map((id) => (
                            <span key={id} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl glass-panel-premium border border-white/5 text-center text-slate-400 text-xs font-mono">
                  NO RECURRING DEVIATION PATTERNS DETECTED (Minimum 3 observations required)
                </div>
              )}

              {/* Cross-Decision Metric Patterns Table */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-cyan" />
                  Cross-Decision Metric Intelligence
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Metric Name</th>
                        <th className="py-2.5 px-3 text-center">Decisions Count</th>
                        <th className="py-2.5 px-3 text-center">Observed Outcomes</th>
                        <th className="py-2.5 px-3 text-center">Material Deviations</th>
                        <th className="py-2.5 px-3">Associated Decisions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.metrics_patterns.map((m) => (
                        <tr key={m.metric_name} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-3 font-bold text-white">{m.metric_name}</td>
                          <td className="py-3 px-3 text-center">{m.decisions_count}</td>
                          <td className="py-3 px-3 text-center text-slate-300">{m.observed_outcomes_count}</td>
                          <td className="py-3 px-3 text-center">
                            {m.material_deviations_count > 0 ? (
                              <span className="text-amber-400 font-bold">{m.material_deviations_count}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {m.decision_ids.slice(0, 4).map((id) => (
                                <span key={id} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300">
                                  {id}
                                </span>
                              ))}
                              {m.decision_ids.length > 4 && (
                                <span className="text-slate-500 text-[10px]">+{m.decision_ids.length - 4} more</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Learning Signals Summary Card */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Learning Signal Portfolio ({data.learning_signals_summary.total_active_signals} Active)
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      HIGH: {data.learning_signals_summary.high_count}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      REVIEW: {data.learning_signals_summary.review_count}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      INFO: {data.learning_signals_summary.info_count}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(data.learning_signals_summary.by_type).map(([sigType, count]) => (
                    <div key={sigType} className="p-3 rounded-xl bg-black/30 border border-white/5">
                      <div className="text-[10px] font-mono text-slate-400 uppercase truncate" title={sigType}>
                        {sigType}
                      </div>
                      <div className="text-lg font-mono font-black text-white mt-1">
                        {count}
                      </div>
                    </div>
                  ))}
                </div>

                {data.learning_signals_summary.unresolved_signal_decisions.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1.5">
                      Decisions with Unresolved Signals:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.learning_signals_summary.unresolved_signal_decisions.map((id) => (
                        <span key={id} className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-mono">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Current Persisted Execution Failures Panel */}
              {data.execution_failures.length > 0 && (
                <div className="p-5 rounded-2xl glass-panel-premium border border-rose-500/20 space-y-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Current Persisted Execution Failures ({data.execution_failures.length})
                  </h3>
                  <div className="space-y-2">
                    {data.execution_failures.map((fail, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-black/40 border border-rose-500/20 space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-white">Decision: {fail.decision_id}</span>
                          <span className="text-slate-500 text-[10px]">Execution ID: {fail.execution_id.slice(0, 8)}</span>
                        </div>
                        <p className="text-xs text-rose-300 font-mono">
                          Reason: {fail.failure_reason}
                        </p>
                        {fail.similarity_group && (
                          <div className="text-[10px] font-mono text-amber-400 pt-1">
                            ℹ️ {fail.similarity_group}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: DEPENDENCIES & CLUSTERS */}
          {activeSubTab === 'dependencies' && (
            <div className="space-y-6">
              
              {/* Dependencies Panel */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-accent-cyan" />
                  Explicit Shared Dependencies
                </h3>
                <p className="text-xs text-slate-400">
                  Decisions explicitly linked to the same persisted dataset version, scenario, or predictive model.
                </p>

                {data.dependencies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.dependencies.map((dep, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-accent-cyan">
                            {dep.entity_type}: {dep.entity_label}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {dep.decision_count} decisions
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {dep.decision_ids.map((id) => (
                            <span key={id} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs font-mono">
                    NO EXPLICIT DECISION DEPENDENCIES RECORDED
                  </div>
                )}
              </div>

              {/* Factual Clusters Panel */}
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent-electricBlue" />
                  Factual Decision Clusters
                </h3>

                {data.clusters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.clusters.map((cl, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 uppercase">
                            {cl.shared_attribute_type}
                          </div>
                          <div className="text-sm font-mono font-bold text-white truncate" title={cl.cluster_name}>
                            {cl.cluster_name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1">
                            {cl.decision_count} Decisions in cluster
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-2">
                          {cl.decision_ids.slice(0, 3).map((id) => (
                            <span key={id} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                              {id}
                            </span>
                          ))}
                          {cl.decision_ids.length > 3 && (
                            <span className="text-[10px] font-mono text-slate-500">+{cl.decision_ids.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs font-mono">
                    NO CLUSTERS IDENTIFIED
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: CHRONOLOGICAL TRENDS */}
          {activeSubTab === 'trends' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent-cyan" />
                    Chronological Decision Lifecycle Trends ({period.toUpperCase()})
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Persisted timestamps only
                  </span>
                </div>

                {trends && trends.trends.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                          <th className="py-2.5 px-3">Period</th>
                          <th className="py-2.5 px-3 text-center">Created</th>
                          <th className="py-2.5 px-3 text-center">Approvals</th>
                          <th className="py-2.5 px-3 text-center">Executions</th>
                          <th className="py-2.5 px-3 text-center">Observed Outcomes</th>
                          <th className="py-2.5 px-3 text-center">Signals</th>
                          <th className="py-2.5 px-3 text-center">Failures</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {trends.trends.map((t) => (
                          <tr key={t.period_start} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-3 font-bold text-white">{t.period_label}</td>
                            <td className="py-3 px-3 text-center">{t.decisions_created}</td>
                            <td className="py-3 px-3 text-center text-emerald-400">{t.approvals_count}</td>
                            <td className="py-3 px-3 text-center text-cyan-400">{t.executions_count}</td>
                            <td className="py-3 px-3 text-center text-teal-400">{t.observed_outcomes_count}</td>
                            <td className="py-3 px-3 text-center text-rose-400">{t.learning_signals_count}</td>
                            <td className="py-3 px-3 text-center">
                              {t.execution_failures_count > 0 ? (
                                <span className="text-rose-400 font-bold">{t.execution_failures_count}</span>
                              ) : (
                                <span className="text-slate-600">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs font-mono">
                    NO TREND DATA FOR THE SELECTED PERIOD
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: ENTERPRISE AUDIT REPORT (PHASE 13) */}
          {activeSubTab === 'audit_report' && (
            <div className="space-y-6">
              {/* HEADER & METADATA BAR */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-white/10 shadow-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      SCOPE: PROJECT AUDIT
                    </span>
                    {projectReport?.metadata?.report_id && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800">
                        REPORT: {projectReport.metadata.report_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent-cyan" />
                    Enterprise Project Decision Audit Report
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Project: <span className="text-white font-bold">{projectName || projectId}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {projectReport?.metadata && (
                    <div className="text-right font-mono text-[11px] text-slate-400">
                      <div>Generated: {new Date(projectReport.metadata.generated_at).toLocaleString()}</div>
                      <div className="text-slate-500 text-[10px]">Data As Of: {new Date(projectReport.metadata.data_as_of).toLocaleTimeString()}</div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (!projectReport) return;
                      navigator.clipboard.writeText(JSON.stringify(projectReport, null, 2));
                      setReportCopied(true);
                      setTimeout(() => setReportCopied(false), 2000);
                    }}
                    disabled={!projectReport}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-xl font-mono text-xs font-bold transition-all border border-slate-700"
                    title="Copy Report JSON"
                  >
                    {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {reportCopied ? 'COPIED' : 'COPY JSON'}
                  </button>
                  <button
                    onClick={loadProjectReport}
                    disabled={loadingReport}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
                    title="Refresh Project Report"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin text-accent-cyan' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingReport && !projectReport && (
                <div className="py-6">
                  <ContinuousIntelligenceEngine
                    mode="audit"
                    active={loadingReport}
                    title="GENERATING ENTERPRISE DECISION REPORT"
                    description="Compiling portfolio-wide governance records, outcome verifications, and compliance summaries..."
                    metrics={[
                      { label: 'REPORT', value: 'ENTERPRISE AUDIT' },
                      { label: 'VERIFICATION', value: 'LEDGER-VERIFIED' },
                      { label: 'STATUS', value: 'COMPILING' }
                    ]}
                  />
                </div>
              )}

              {projectReport && (
                <>
                  {/* PROJECT SUMMARY METRICS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'TOTAL INVENTORY', val: projectReport.project_summary.total_decisions ?? 0, color: 'text-white' },
                      { label: 'ACTIVE DECISIONS', val: projectReport.project_summary.active_decisions ?? 0, color: 'text-sky-400' },
                      { label: 'FORMAL APPROVALS', val: projectReport.project_summary.formal_approvals_count ?? 0, color: 'text-emerald-400' },
                      { label: 'EXECUTED DECISIONS', val: projectReport.project_summary.completed_executions_count ?? 0, color: 'text-cyan-400' },
                      { label: 'OBSERVED OUTCOMES', val: projectReport.project_summary.observed_outcomes_count ?? 0, color: 'text-teal-400' },
                      { label: 'ACTIVE SIGNALS', val: projectReport.project_summary.active_signals_count ?? 0, color: 'text-rose-400' },
                    ].map((m, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl glass-panel-premium border border-white/5">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                          {m.label}
                        </div>
                        <div className={`text-xl font-bold font-mono ${m.color}`}>
                          {m.val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* OPERATIONS & RECURRING DEVIATIONS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Operations & Bottlenecks */}
                    <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                          Operational Bottlenecks & Exposure
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400">
                          {projectReport.operations_and_capacity?.operational_bottlenecks?.total_bottlenecks ?? 0} Flagged
                        </span>
                      </div>
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Decisions Stalled in Review:</span>
                          <span className="text-white font-bold">
                            {projectReport.operations_and_capacity?.operational_bottlenecks?.decisions_stalled_in_review ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Approved Awaiting Execution:</span>
                          <span className="text-white font-bold">
                            {projectReport.operations_and_capacity?.operational_bottlenecks?.approved_awaiting_execution ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Executed Awaiting Outcomes:</span>
                          <span className="text-white font-bold">
                            {projectReport.operations_and_capacity?.operational_bottlenecks?.executed_awaiting_outcomes ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Decisions with Active Deviations:</span>
                          <span className="text-rose-400 font-bold">
                            {projectReport.operations_and_capacity?.operational_bottlenecks?.decisions_with_active_deviations ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Recurring Deviations */}
                    <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                          Recurring Deviations
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {projectReport.recurring_deviations?.length ?? 0} Metrics
                        </span>
                      </div>
                      {projectReport.recurring_deviations && projectReport.recurring_deviations.length > 0 ? (
                        <div className="space-y-2">
                          {projectReport.recurring_deviations.map((dev: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded bg-white/5 border border-white/5 flex items-center justify-between text-xs font-mono">
                              <div>
                                <span className="text-white font-bold">{dev.metric_name}</span>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {dev.material_deviations_count} deviations ({dev.material_deviation_rate ? (dev.material_deviation_rate * 100).toFixed(1) : 0}%)
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                {dev.recurrence_pattern || 'FREQUENT'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-slate-500 p-4 text-center">
                          No recurring deviations observed across this project.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SHARED DEPENDENCIES & CONCENTRATION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Shared Dependencies */}
                    <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                          Shared Dataset & Upstream Dependencies
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {projectReport.shared_dependencies?.length ?? 0} Shared
                        </span>
                      </div>
                      {projectReport.shared_dependencies && projectReport.shared_dependencies.length > 0 ? (
                        <div className="space-y-2">
                          {projectReport.shared_dependencies.map((dep: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded bg-white/5 border border-white/5 text-xs font-mono flex items-center justify-between">
                              <div>
                                <span className="text-slate-200 font-bold">{dep.target_id || dep.upstream_type}</span>
                                <div className="text-[10px] text-slate-400">{dep.dependency_type || 'SHARED_RESOURCE'}</div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300">
                                {dep.dependent_decisions_count ?? (dep.dependent_decision_ids?.length || 0)} Decisions
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-slate-500 p-4 text-center">
                          No multi-decision shared dependencies detected.
                        </div>
                      )}
                    </div>

                    {/* Learning Signals Summary */}
                    <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                          Learning Signals Posture
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300">
                          {projectReport.learning_signals_summary?.total_signals ?? 0} Total
                        </span>
                      </div>
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Active Signals:</span>
                          <span className="text-rose-400 font-bold">
                            {projectReport.learning_signals_summary?.active_signals ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Acknowledged Signals:</span>
                          <span className="text-amber-400 font-bold">
                            {projectReport.learning_signals_summary?.acknowledged_signals ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Resolved Signals:</span>
                          <span className="text-emerald-400 font-bold">
                            {projectReport.learning_signals_summary?.resolved_signals ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AUDIT DECISION INVENTORY TABLE */}
                  <div className="p-5 rounded-2xl glass-panel-premium border border-white/10 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                        Audited Decision Inventory ({projectReport.decision_inventory?.length ?? 0})
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase">
                            <th className="py-2.5 px-3">Decision ID</th>
                            <th className="py-2.5 px-3">Target Metric</th>
                            <th className="py-2.5 px-3">Projected</th>
                            <th className="py-2.5 px-3">Governance</th>
                            <th className="py-2.5 px-3">Execution</th>
                            <th className="py-2.5 px-3">Outcome</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {projectReport.decision_inventory.map((dec: any, idx: number) => (
                            <tr key={idx} className="hover:bg-white/[0.02]">
                              <td className="py-2 px-3 text-white font-bold truncate max-w-[140px]" title={dec.decision_id}>
                                {dec.decision_id}
                              </td>
                              <td className="py-2 px-3">{dec.target_metric || 'N/A'}</td>
                              <td className="py-2 px-3 text-emerald-400 font-bold">
                                {dec.projected_value !== undefined && dec.projected_value !== null ? String(dec.projected_value) : 'N/A'}
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  {dec.governance_stage || dec.governance_status || 'DRAFT'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                  {dec.execution_status || 'NOT_REQUESTED'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  dec.outcome_status === 'RECORDED' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {dec.outcome_status || 'PENDING'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                {onNavigateToDecision && (
                                  <button
                                    onClick={() => onNavigateToDecision(dec.decision_id)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-accent-cyan/15 hover:text-accent-cyan text-[10px] text-slate-300 font-mono transition-all"
                                  >
                                    Audit
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 7: DECISION KNOWLEDGE & OPERATING MEMORY */}
          {activeSubTab === 'knowledge' && (
            <div className="pt-2">
              <DecisionKnowledgeView
                projectId={projectId}
                title={`Project Operating Memory • ${projectName || projectId}`}
              />
            </div>
          )}

        </>

      )}

    </div>
  );
};

export default DecisionPortfolioView;
