import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart as LineChartIcon, Info, 
  ChevronDown, Maximize2
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { TrendMetric, CategoryBreakdown } from '../types';

interface PremiumChartWorkspaceProps {
  trends: TrendMetric[];
  categories: CategoryBreakdown[];
}

type ChartType = 'line' | 'area' | 'bar';

export const PremiumChartWorkspace: React.FC<PremiumChartWorkspaceProps> = ({ trends, categories }) => {
  // Combine available metrics from trends and categories
  const availableMetrics = useMemo(() => {
    const metrics: { id: string; label: string; type: 'time' | 'category'; dataRef: any }[] = [];
    trends.forEach((t, i) => {
      metrics.push({ id: `trend-${i}`, label: `${t.measure} over Time`, type: 'time', dataRef: t });
    });
    categories.forEach((c, i) => {
      metrics.push({ id: `cat-${i}`, label: `${c.measure} by ${c.dimension}`, type: 'category', dataRef: c });
    });
    return metrics;
  }, [trends, categories]);

  const [selectedMetricId, setSelectedMetricId] = useState<string>(availableMetrics[0]?.id || '');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [timeRange, setTimeRange] = useState<string>('all');

  const selectedMetric = availableMetrics.find(m => m.id === selectedMetricId);

  // Derive valid chart types based on data type
  const validChartTypes: { value: ChartType; label: string }[] = useMemo(() => {
    if (!selectedMetric) return [];
    if (selectedMetric.type === 'time') return [{ value: 'line', label: 'Line Chart' }, { value: 'area', label: 'Area Chart' }, { value: 'bar', label: 'Bar Chart' }];
    return [{ value: 'bar', label: 'Bar Chart' }];
  }, [selectedMetric]);

  // Ensure chartType is valid when metric changes
  React.useEffect(() => {
    if (selectedMetric && !validChartTypes.find(t => t.value === chartType)) {
      setChartType(validChartTypes[0].value);
    }
  }, [selectedMetric, validChartTypes, chartType]);

  if (availableMetrics.length === 0) {
    return (
      <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <Info className="w-8 h-8 text-slate-500 mb-3" />
        <h3 className="text-white font-bold tracking-widest uppercase mb-1">NOT AVAILABLE FOR THIS DATASET</h3>
        <p className="text-slate-400 text-sm max-w-md">No suitable time-series or categorical distributions were found during automated EDA.</p>
      </div>
    );
  }

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[rgba(2,5,10,0.85)] backdrop-blur-xl border border-slate-800/80 rounded-xl p-4 shadow-2xl min-w-[160px]">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent-cyan" />
            <p className="text-2xl font-bold text-white tracking-tight">
              {Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const chartData = useMemo(() => {
    if (!selectedMetric) return [];
    if (selectedMetric.type === 'time') {
      const trend = selectedMetric.dataRef as TrendMetric;
      return trend.time_series.map(pt => ({ label: pt.period, value: pt.value }));
    } else {
      const cat = selectedMetric.dataRef as CategoryBreakdown;
      return cat.grouped_data.map(pt => ({ label: pt.category_value, value: pt.metric_value }));
    }
  }, [selectedMetric]);

  const renderChart = () => {
    if (!selectedMetric) return null;

    const data = chartData;
    let dataKey = 'value';
    let xAxisKey = 'label';

    return (
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'area' ? (
          <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={12} fontFamily="JetBrains Mono" />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} fontFamily="JetBrains Mono" tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
            <Tooltip content={renderCustomTooltip} cursor={{ stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke="#22d3ee" 
              strokeWidth={1.5}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={800}
              animationBegin={300}
              isAnimationActive={true}
              activeDot={{ r: 4, fill: '#020617', stroke: '#22d3ee', strokeWidth: 2 }}
            />
          </AreaChart>
        ) : chartType === 'line' ? (
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={12} fontFamily="JetBrains Mono" />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} fontFamily="JetBrains Mono" tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
            <Tooltip content={renderCustomTooltip} cursor={{ stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke="#22d3ee" 
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#020617', stroke: '#22d3ee', strokeWidth: 2 }}
              animationDuration={800}
              animationBegin={300}
              isAnimationActive={true}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={12} fontFamily="JetBrains Mono" />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} fontFamily="JetBrains Mono" tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
            <Tooltip content={renderCustomTooltip} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar 
              dataKey={dataKey} 
              fill="#3b82f6" 
              radius={[2, 2, 0, 0]}
              animationDuration={800}
              animationBegin={300}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#22d3ee'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="relative group overflow-visible pt-4 border border-slate-800/50 p-6 lg:p-8 bg-transparent">
      {/* Decorative background flare removed to avoid over-glow */}
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="flex flex-wrap items-center justify-between gap-4 mb-10 relative z-10"
      >
        <div className="flex items-start gap-6">
          <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50 mt-1">
            <LineChartIcon className="w-6 h-6 text-accent-cyan" />
          </div>
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
                PRIMARY SIGNAL
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">LIVE SIGNAL</span>
              </div>
            </div>
            
            <div className="relative inline-block group mb-2">
              <select 
                value={selectedMetricId} 
                onChange={(e) => setSelectedMetricId(e.target.value)}
                className="appearance-none bg-transparent text-3xl lg:text-[40px] font-bold text-white pr-12 outline-none cursor-pointer hover:text-accent-cyan transition-colors"
              >
                {availableMetrics.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-sm">
                    {m.label.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-6 h-6 text-slate-600 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-accent-cyan transition-colors" />
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
               <span>{timeRange === 'all' ? 'All available data' : `Last ${timeRange.replace('d', ' Days')}`}</span>
               <span className="text-slate-600">·</span>
               <span>{chartData.length > 0 ? `${chartData.length.toLocaleString()} observations` : 'No observations'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedMetric?.type === 'time' && (
            <div className="relative">
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="appearance-none bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-xs font-bold text-slate-300 uppercase tracking-widest outline-none hover:border-slate-500 cursor-pointer transition-colors"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          
          <div className="relative">
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="appearance-none bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-xs font-bold text-slate-300 uppercase tracking-widest outline-none hover:border-slate-500 cursor-pointer transition-colors"
            >
              {validChartTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button className="p-2 text-slate-400 hover:text-white bg-slate-900/50 border border-slate-700 rounded-lg transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      <div className="h-[500px] w-full relative z-10">
        <AnimatePresence mode="wait">
          <motion.div 
            key={`${selectedMetricId}-${chartType}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            {renderChart()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
