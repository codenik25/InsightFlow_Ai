import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Award,
  Target,
  Database,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { ExecutiveReport } from '../types';
import {
  fetchExecutiveReport,
  getDownloadUrl,
  getReportMarkdownExportUrl,
  getReportJsonExportUrl,
} from '../services/api';

interface ExecutiveSummaryDashboardProps {
  datasetId: string;
}

export const ExecutiveSummaryDashboard: React.FC<ExecutiveSummaryDashboardProps> = ({ datasetId }) => {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchExecutiveReport(datasetId);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load executive report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [datasetId]);

  const handleCopySummary = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.executive_narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-4">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
        <p className="text-sm font-mono">Synthesizing Executive Report across Quality, EDA & Business Insights...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-8 text-center text-rose-400 space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h4 className="text-base font-bold text-white">Unable to Generate Executive Report</h4>
        <p className="text-xs text-slate-300 max-w-lg mx-auto">{error}</p>
        <button
          onClick={loadReport}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Executive Header & Export Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Executive Data Narrative & Export Hub</h3>
            <p className="text-xs text-slate-400">Synthesized decision-intelligence narrative and export center</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={handleCopySummary}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copied ? 'Copied Narrative' : 'Copy Summary'}</span>
          </button>

          <a
            href={getReportMarkdownExportUrl(datasetId)}
            download
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Markdown</span>
          </a>

          <a
            href={getReportJsonExportUrl(datasetId)}
            download
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span>Export JSON</span>
          </a>

          <a
            href={getDownloadUrl(report.dataset_id, 'processed')}
            download
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Clean CSV</span>
          </a>
        </div>
      </div>

      {/* Dataset Context & Status Banner */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 bg-emerald-500/5 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Status: Processed</span>
          </span>
          <span className="text-slate-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            Dataset: <strong className="text-white font-bold">{report.dataset_name}</strong>
          </span>
          {report.source_dataset_name && report.source_dataset_name !== report.dataset_name && (
            <span className="text-slate-400 border-l border-slate-700 pl-3">
              Source Dataset: <strong className="text-slate-300">{report.source_dataset_name}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 font-sans font-semibold">
          <span className="text-slate-400">Quality Score: <strong className="text-emerald-400 font-mono font-bold">{report.quality_score.toFixed(1)}/100</strong></span>
          <span className="text-slate-400">Rows: <strong className="text-white font-mono font-bold">{report.total_rows.toLocaleString()}</strong></span>
          <span className="text-slate-400">Columns: <strong className="text-white font-mono font-bold">{report.total_columns}</strong></span>
        </div>
      </div>

      {/* Key Executive KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {report.key_kpis.slice(0, 3).map((kpi, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">{kpi.name}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${kpi.nature === 'price_rate' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                {kpi.aggregation.toUpperCase()}
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">{kpi.formatted_value}</div>
            {kpi.reason && <p className="text-[11px] text-slate-400">{kpi.reason}</p>}
          </div>
        ))}
      </div>

      {/* Executive Narrative Block */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 space-y-3 bg-amber-500/5">
        <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 font-mono">
          <FileText className="w-4 h-4" />
          <span>Executive Summary Narrative</span>
        </h4>
        <p className="text-sm text-slate-200 leading-relaxed font-sans font-medium">
          {report.executive_narrative}
        </p>
      </div>

      {/* Achievements vs Critical Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Achievements */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 font-mono border-b border-slate-800 pb-3">
            <Award className="w-4 h-4" />
            <span>Key Achievements ({report.key_achievements.length})</span>
          </h4>

          {report.key_achievements.length > 0 ? (
            <div className="space-y-3">
              {report.key_achievements.map((item) => (
                <div key={item.id} className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1">
                  <div className="text-xs font-bold text-white">{item.title}</div>
                  <p className="text-xs text-slate-300">{item.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No specific positive highlights recorded.</p>
          )}
        </div>

        {/* Critical Risks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 font-mono border-b border-slate-800 pb-3">
            <AlertTriangle className="w-4 h-4" />
            <span>Critical Attention Areas ({report.critical_risks.length})</span>
          </h4>

          {report.critical_risks.length > 0 ? (
            <div className="space-y-3">
              {report.critical_risks.map((item) => (
                <div key={item.id} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1">
                  <div className="text-xs font-bold text-white">{item.title}</div>
                  <p className="text-xs text-slate-300">{item.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No critical risk flags detected.</p>
          )}
        </div>
      </div>

      {/* Strategic Actions Plan */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2 font-mono border-b border-slate-800 pb-3">
          <Target className="w-4 h-4" />
          <span>Prioritized Strategic Action Plan ({report.strategic_actions.length})</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.strategic_actions.map((act) => (
            <div key={act.priority} className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                    Priority #{act.priority}
                  </span>
                  {act.target_metric && (
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                      {act.target_metric}
                    </span>
                  )}
                </div>
                <h5 className="text-xs font-bold text-white">{act.title}</h5>
                <p className="text-xs text-slate-300 leading-normal">{act.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence & Traceability Footer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
        <span className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Analyzed <strong>{report.total_insights_analyzed}</strong> persisted Phase 4 business insights</span>
        </span>
        <span className="text-slate-400">Traceable & Deterministic | No Generative AI Inference</span>
      </div>
    </div>
  );
};
