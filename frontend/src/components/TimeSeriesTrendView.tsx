import React from 'react';
import { LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendMetric } from '../types';

interface TimeSeriesTrendViewProps {
  trends: TrendMetric[];
}

export const TimeSeriesTrendView: React.FC<TimeSeriesTrendViewProps> = ({ trends }) => {
  if (!trends || trends.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
        No valid datetime column or time series data available for trend evaluation.
      </div>
    );
  }

  const getTrendBadge = (dir: string, pct: number) => {
    switch (dir) {
      case 'increasing':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Increasing (+{pct}%)</span>
          </span>
        );
      case 'decreasing':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Decreasing ({pct}%)</span>
          </span>
        );
      case 'stable':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <Minus className="w-3.5 h-3.5" />
            <span>Stable ({pct > 0 ? `+${pct}` : pct}%)</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Insufficient Data</span>
          </span>
        );
    }
  };

  const formatTitle = (str: string) => str.replace(/_/g, ' ').replace("-", " ").toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <LineChartIcon className="w-4 h-4 text-purple-400" />
          <span>Automated Time-Series Trend & Period Analysis ({trends.length} series)</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {trends.map((item, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            {/* Header Title & Trend Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white font-mono">
                  {formatTitle(item.measure)} Over Time ({item.datetime_column})
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Granularity: <strong className="text-purple-300 capitalize">{item.granularity}</strong> | Slope: <strong className="text-slate-200">{item.slope}</strong>
                </p>
              </div>
              {getTrendBadge(item.trend_direction, item.pct_change)}
            </div>

            {/* Metrics summary */}
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">First Period Value</span>
                <span className="text-slate-200 font-bold">{item.first_period_value ?? 'N/A'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Latest Period Value</span>
                <span className="text-purple-300 font-bold">{item.latest_period_value ?? 'N/A'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Period Change</span>
                <span className={`font-bold ${item.pct_change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.pct_change >= 0 ? `+${item.pct_change}%` : `${item.pct_change}%`}
                </span>
              </div>
            </div>

            {/* Recharts Line Chart */}
            {item.time_series && item.time_series.length > 0 ? (
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={item.time_series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="period" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                      formatter={(val: any) => [Number(val).toLocaleString(), formatTitle(item.measure)]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#c084fc"
                      strokeWidth={2.5}
                      dot={{ fill: '#c084fc', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-6">
                Insufficient observations to render time series line chart.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
