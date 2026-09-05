import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
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

  const getBarColor = (item: CategoryBreakdown, category_value: string) => {
    if (item.top_category && item.top_category.category_value === category_value) {
      return '#10b981'; // Top - green
    }
    if (item.bottom_category && item.bottom_category.category_value === category_value) {
      return '#f59e0b'; // Lowest - amber
    }
    return '#3b82f6'; // Neutral Blue instead of Cyan for standard bars to reduce cyan overload
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
      {breakdowns.map((item, idx) => {
        const isMean = item.aggregation_method === 'mean';
        const measureLabel = formatMeasureName(item.measure);
        const dimLabel = formatTitle(item.dimension);
        return (
          <div
            key={idx}
            className="flex flex-col gap-6 p-6 min-h-[320px] bg-[rgba(4,12,25,0.4)] backdrop-blur-md rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-colors min-w-0"
          >
            {/* Header Title */}
            <div className="flex flex-col gap-3 border-b border-slate-800/50 pb-4 min-w-0">
              <h4 className="text-sm font-mono font-bold text-white tracking-widest uppercase leading-snug break-words whitespace-normal min-w-0" style={{ overflowWrap: 'anywhere' }}>
                {measureLabel} <br/> <span className="text-slate-600 font-normal">BY</span> {dimLabel}
              </h4>
              <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase flex items-center gap-2">
                <span>{isMean ? 'Overall Average' : 'Total Value'}</span>
                <span className="text-slate-700">—</span>
                <strong className="text-white text-xs">{item.total_measure_value.toLocaleString()}</strong>
              </div>
            </div>

            {/* Top vs Bottom Highlights */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs font-mono relative z-10 py-1 min-w-0" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {item.top_category && (
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>{isMean ? 'Highest' : 'Top Performer'}</span>
                  </div>
                  <div className="text-white font-bold text-sm break-words whitespace-normal tracking-tight leading-tight min-w-0" style={{ overflowWrap: 'anywhere' }}>{item.top_category.category_value}</div>
                  <div className="text-slate-400 text-[10px] break-words whitespace-normal min-w-0" style={{ overflowWrap: 'anywhere' }}>
                    {item.top_category.metric_value.toLocaleString()}
                    {!isMean && item.top_category.contribution_pct > 0 && ` (${item.top_category.contribution_pct}%)`}
                  </div>
                </div>
              )}

              {item.bottom_category && (
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-widest">
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    <span>{isMean ? 'Lowest' : 'Lowest Performer'}</span>
                  </div>
                  <div className="text-white font-bold text-sm break-words whitespace-normal tracking-tight leading-tight min-w-0" style={{ overflowWrap: 'anywhere' }}>{item.bottom_category.category_value}</div>
                  <div className="text-slate-400 text-[10px] break-words whitespace-normal min-w-0" style={{ overflowWrap: 'anywhere' }}>
                    {item.bottom_category.metric_value.toLocaleString()}
                    {!isMean && item.bottom_category.contribution_pct > 0 && ` (${item.bottom_category.contribution_pct}%)`}
                  </div>
                </div>
              )}
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-[220px] lg:h-[250px] w-full relative z-10 mt-4 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={item.top_5} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis
                    type="number"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="JetBrains Mono"
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                  />
                  <YAxis 
                    dataKey="category_value" 
                    type="category" 
                    stroke="#cbd5e1" 
                    fontSize={10} 
                    fontFamily="JetBrains Mono"
                    tickLine={false} 
                    axisLine={false} 
                    width={100}
                    tick={{ fill: '#cbd5e1', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(2,5,10,0.85)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', fontSize: '11px', backdropFilter: 'blur(12px)' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(val: any) => [Number(val).toLocaleString(), isMean ? `Avg ${measureLabel}` : measureLabel]}
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  />
                  <Bar dataKey="metric_value" radius={[0, 4, 4, 0]} animationDuration={1000} barSize={24}>
                    {item.top_5.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(item, entry.category_value)} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
};
