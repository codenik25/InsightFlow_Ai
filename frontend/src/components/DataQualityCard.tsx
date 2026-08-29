import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, AlertOctagon } from 'lucide-react';

import { DatasetQualityResponse } from '../types';
import { ScoreGauge } from './ui/ScoreGauge';

interface DataQualityCardProps {
  qualityData: DatasetQualityResponse;
}

export const DataQualityCard: React.FC<DataQualityCardProps> = ({ qualityData }) => {
  const { score } = qualityData;

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'excellent':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Excellent Quality</span>
          </span>
        );
      case 'good':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Good Quality</span>
          </span>
        );
      case 'fair':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Fair Quality</span>
          </span>
        );
      case 'poor':
      case 'critical':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 font-mono">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{severity} Quality</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
            {severity}
          </span>
        );
    }
  };

  const getScoreColor = (val: number) => {
    if (val >= 90) return 'text-emerald-400';
    if (val >= 80) return 'text-sky-400';
    if (val >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getBarColor = (val: number) => {
    if (val >= 90) return 'bg-emerald-500';
    if (val >= 80) return 'bg-sky-500';
    if (val >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const components = [
    { label: 'Completeness', score: score.completeness_score, desc: 'Cell non-null ratio' },
    { label: 'Uniqueness', score: score.uniqueness_score, desc: 'Row & ID duplication' },
    { label: 'Validity', score: score.validity_score, desc: 'Type conformance' },
    { label: 'Consistency', score: score.consistency_score, desc: 'Whitespace & casing' },
    { label: 'Structural', score: score.structural_score, desc: 'Column anomalies' },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Data Quality Engine Score</h3>
            <p className="text-xs text-slate-400">Deterministic 5-part dimension analysis</p>
          </div>
        </div>
        {getSeverityBadge(score.severity)}
      </div>

      {/* Main Score & Component Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Overall Score Gauge Card */}
        <div className="flex flex-col items-center justify-center p-2">
          <ScoreGauge
            score={score.overall_score}
            label="Overall Quality Index"
            size="lg"
            showSubtext
            subtext={`${score.total_issue_count} Issues Detected`}
          />
        </div>

        {/* Component Scores Breakdown */}
        <div className="md:col-span-2 space-y-3.5">
          {components.map((c) => (
            <div key={c.label} className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-semibold text-slate-200">{c.label}</span>
                <span className={`font-bold ${getScoreColor(c.score)}`}>{c.score}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getBarColor(c.score)}`}
                  style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
