import React from 'react';
import { Sparkles, Info } from 'lucide-react';
import { KPIMetric } from '../types';

interface KpiCardsGridProps {
  kpis: KPIMetric[];
}

export const KpiCardsGrid: React.FC<KpiCardsGridProps> = ({ kpis }) => {
  if (!kpis || kpis.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-400 font-mono">
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


    switch (type) {
      case 'sum':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20 uppercase">Total</span>;
      case 'mean':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">Average</span>;
      case 'count':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase">Volume</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Auto-Discovered Key Performance Indicators (KPIs) ({kpis.length})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          return (
            <div
              key={idx}
              className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 space-y-3 hover:border-slate-700/80 transition-all shadow-lg hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300 font-mono truncate">{kpi.name}</span>
                  {getMetricBadge(kpi.metric_type)}
                </div>
                <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
                  {formatValue(kpi.value, kpi.format)}
                </div>
              </div>

              {kpi.reason && (
                <div className="pt-3 border-t border-slate-800/80 flex items-start gap-1.5 text-[11px] text-slate-400 font-sans">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{kpi.reason}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
