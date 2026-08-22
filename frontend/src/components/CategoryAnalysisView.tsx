import React from 'react';
import { BarChart2, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CategoryBreakdown } from '../types';

interface CategoryAnalysisViewProps {
  breakdowns: CategoryBreakdown[];
}

export const CategoryAnalysisView: React.FC<CategoryAnalysisViewProps> = ({ breakdowns }) => {
  if (!breakdowns || breakdowns.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
        No categorical dimension and measure pairs available for grouped breakdown.
      </div>
    );
  }

  const formatTitle = (str: string) => str.replace(/_/g, ' ').replace("-", " ").toUpperCase();

  const formatMeasureName = (m: string) => {
    let clean = m.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
    if (clean.startsWith('TOTAL ')) {
      clean = clean.slice(6);
    }
    return clean;
  };

  const COLORS = ['#10b981', '#0284c7', '#6366f1', '#a855f7', '#ec4899', '#f59e0b'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          <span>Category Analysis & Grouped Dimension Metrics ({breakdowns.length} breakdowns)</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {breakdowns.map((item, idx) => {
          const isMean = item.aggregation_method === 'mean';
          const measureLabel = formatMeasureName(item.measure);
          const dimLabel = formatTitle(item.dimension);

          return (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between"
            >
              {/* Header Title */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">
                    {isMean ? 'AVERAGE' : 'TOTAL'} {measureLabel} by {dimLabel}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {isMean ? 'Overall Average' : 'Total Measure Value'}: <strong className="text-emerald-400">{item.total_measure_value.toLocaleString()}</strong>
                  </p>
                </div>
              </div>

              {/* Top vs Bottom Highlights */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                {item.top_category && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{isMean ? 'Highest Average' : 'Top Performer'}</span>
                    </div>
                    <div className="text-white font-bold text-sm truncate">{item.top_category.category_value}</div>
                    <div className="text-slate-300 text-[11px]">
                      {item.top_category.metric_value.toLocaleString()}
                      {!isMean && item.top_category.contribution_pct > 0 && ` (${item.top_category.contribution_pct}%)`}
                    </div>
                  </div>
                )}

                {item.bottom_category && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[11px]">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>{isMean ? 'Lowest Average' : 'Lowest Performer'}</span>
                    </div>
                    <div className="text-white font-bold text-sm truncate">{item.bottom_category.category_value}</div>
                    <div className="text-slate-300 text-[11px]">
                      {item.bottom_category.metric_value.toLocaleString()}
                      {!isMean && item.bottom_category.contribution_pct > 0 && ` (${item.bottom_category.contribution_pct}%)`}
                    </div>
                  </div>
                )}
              </div>

              {/* Recharts Bar Chart */}
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={item.top_5} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis
                      dataKey="category_value"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                      formatter={(val: any) => [Number(val).toLocaleString(), isMean ? `Average ${measureLabel}` : measureLabel]}
                    />
                    <Bar dataKey="metric_value" radius={[4, 4, 0, 0]}>
                      {item.top_5.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
