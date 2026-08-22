import React from 'react';
import { Sparkles, Info } from 'lucide-react';
import { KPIMetric } from '../types';

interface KpiCardsGridProps {
  kpis: KPIMetric[];
}

export const KpiCardsGrid: React.FC<KpiCardsGridProps> = ({ kpis }) => {
  if (!kpis || kpis.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
        No measure metrics discovered for KPI card generation.
      </div>
    );
  }

  const formatValue = (val: any, fmt?: string) => {
    if (val === null || val === undefined) return 'N/A';
    const num = Number(val);
    if (isNaN(num)) return String(val);

    if (fmt === 'currency') {
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    if (fmt === 'integer') {
      return num.toLocaleString();
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const getMetricBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'sum':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SUM</span>;
      case 'mean':
      case 'average':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">AVG</span>;
      case 'median':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">MEDIAN</span>;
      case 'min':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">MIN</span>;
      case 'max':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">MAX</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-800 text-slate-300 border border-slate-700">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Auto-Discovered Key Performance Indicators (KPIs) ({kpis.length})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300 truncate">{kpi.name}</span>
                {getMetricBadge(kpi.metric_type)}
              </div>
              <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
                {formatValue(kpi.value, kpi.format)}
              </div>
            </div>

            {kpi.reason && (
              <div className="pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[11px] text-slate-400">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span className="leading-snug">{kpi.reason}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
