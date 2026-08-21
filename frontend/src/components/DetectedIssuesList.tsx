import React from 'react';
import { AlertCircle, AlertTriangle, Info, ListFilter } from 'lucide-react';
import { IssueDetail } from '../types';

interface DetectedIssuesListProps {
  issues: IssueDetail[];
}

export const DetectedIssuesList: React.FC<DetectedIssuesListProps> = ({ issues }) => {
  if (!issues || issues.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
        No quality issues or anomalies detected.
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Critical</span>
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Warning</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>Info</span>
          </span>
        );
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'completeness':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'uniqueness':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'validity':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'consistency':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      default:
        return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-amber-400" />
          <span>Detected Data Quality Issues & Anomalies ({issues.length})</span>
        </h3>
      </div>

      <div className="space-y-2">
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs"
          >
            <div className="flex items-start gap-3 max-w-[80%]">
              {getSeverityBadge(issue.severity)}
              <div className="space-y-1">
                <p className="text-slate-200 font-medium leading-relaxed">{issue.description}</p>
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-semibold ${getCategoryColor(issue.category)}`}>
                    {issue.category}
                  </span>
                  {issue.column && (
                    <span>Column: <strong className="text-slate-300">{issue.column}</strong></span>
                  )}
                  {issue.count !== undefined && issue.count !== null && (
                    <span>Affected count: <strong className="text-slate-300">{issue.count}</strong></span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
