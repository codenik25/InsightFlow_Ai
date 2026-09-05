import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Minus, Info, Settings, 
  CheckSquare, Square, ChevronDown
} from 'lucide-react';
import { KPIMetric, TrendMetric } from '../types';

interface KpiCardsGridProps {
  kpis: KPIMetric[];
  trends?: TrendMetric[];
}

const AnimatedCounter = ({ value, format }: { value: any; format?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView || typeof value !== 'number' || isNaN(value)) return;
    let start = 0;
    const end = value;
    const duration = 1000;
    const startTime = performance.now();
    
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    
    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const current = start + (end - start) * easeOutQuart(progress);
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };
    
    requestAnimationFrame(update);
  }, [value, isInView]);

  const formatValue = (val: any, fmt?: string) => {
    if (val === null || val === undefined) return 'N/A';
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num)) return String(val);

    if (fmt === 'currency') {
      return num >= 1000000 
        ? `$${(num / 1000000).toFixed(2)}M` 
        : num >= 1000 
          ? `$${(num / 1000).toFixed(1)}k`
          : `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    if (fmt === 'percentage') return `${num.toFixed(1)}%`;
    if (fmt === 'integer') return Math.floor(num).toLocaleString();
    
    return num >= 1000000 
      ? `${(num / 1000000).toFixed(2)}M` 
      : num >= 10000 
        ? `${(num / 1000).toFixed(1)}k`
        : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  if (typeof value !== 'number' || isNaN(value)) {
    return <span ref={ref}>{formatValue(value, format)}</span>;
  }

  return <span ref={ref}>{formatValue(displayValue, format)}</span>;
};

export const KpiCardsGrid: React.FC<KpiCardsGridProps> = ({ kpis, trends = [] }) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedKpiNames, setSelectedKpiNames] = useState<string[]>(
    kpis.slice(0, 12).map(k => k.name)
  );

  const activeKpis = useMemo(() => {
    return kpis.filter(k => selectedKpiNames.includes(k.name)).slice(0, 12);
  }, [kpis, selectedKpiNames]);

  const toggleKpi = (name: string) => {
    setSelectedKpiNames(prev => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
      }
      if (prev.length >= 12) return prev; // Max 12
      return [...prev, name];
    });
  };

  // Find a trend matching the KPI (heuristic by name matching)
  const getTrendForKpi = (kpi: KPIMetric) => {
    if (!trends || trends.length === 0) return null;
    return trends.find(t => {
      if (kpi.source_column && t.measure === kpi.source_column) return true;
      const kn = kpi.name.toLowerCase().replace(/[\s_]+/g, '');
      const tm = t.measure.toLowerCase().replace(/[\s_]+/g, '');
      return kn === tm || kn === `total${tm}` || kn === `average${tm}`;
    });
  };

  // Basic layout: 4 columns, up to 3 rows
  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between z-20 relative">
        <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest">
          Key Performance Indicators
        </h3>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-700 hover:border-slate-500 rounded text-xs font-bold text-slate-300 transition-colors uppercase tracking-widest"
            >
              KPI VIEW <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
          
          {kpis.length > 12 && (
            <div className="relative">
              <button 
                onClick={() => setIsCustomizing(!isCustomizing)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-none text-xs font-bold transition-colors uppercase tracking-widest ${
                  isCustomizing 
                    ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan' 
                    : 'bg-transparent border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5" /> CUSTOMIZE
              </button>

              {isCustomizing && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl p-4 z-50 max-h-96 overflow-y-auto">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 flex justify-between">
                    <span>Select up to 12</span>
                    <span className={selectedKpiNames.length === 12 ? 'text-accent-cyan' : ''}>
                      {selectedKpiNames.length}/12
                    </span>
                  </div>
                  <div className="space-y-2">
                    {kpis.map(k => {
                      const isSelected = selectedKpiNames.includes(k.name);
                      return (
                        <button
                          key={k.name}
                          onClick={() => toggleKpi(k.name)}
                          disabled={!isSelected && selectedKpiNames.length >= 12}
                          className={`w-full flex items-center gap-3 p-2 rounded text-left text-xs ${
                            !isSelected && selectedKpiNames.length >= 12 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-900'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent-cyan" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                          <span className={isSelected ? 'text-white' : 'text-slate-400 truncate'}>
                            {k.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0 border-y border-slate-800/80 divide-y sm:divide-y-0 divide-slate-800/80 [&>div]:border-b lg:[&>div]:border-b-0 lg:[&:nth-child(-n+4)>div]:border-b [&>div]:border-slate-800/80 sm:[&>div:nth-child(even)]:border-l md:[&>div:nth-child(even)]:border-l-0 md:[&>div:not(:nth-child(3n+1))]:border-l lg:[&>div:not(:nth-child(3n+1))]:border-l-0 lg:[&>div:not(:nth-child(4n+1))]:border-l">
        <AnimatePresence mode="popLayout">
          {activeKpis.map((kpi, idx) => {
            const trend = getTrendForKpi(kpi);
            const isNegative = trend ? trend.pct_change < 0 : false;
            const isPositive = trend ? trend.pct_change > 0 : false;
            
            // Determine semantic accent color
            let indicatorColor = 'border-l-transparent';
            let textAccent = 'text-accent-cyan';
            let strokeColor = '#0ea5e9';
            
            if (isPositive) {
              indicatorColor = 'border-l-emerald-500/50';
              textAccent = 'text-emerald-400';
              strokeColor = '#10b981';
            } else if (isNegative) {
              indicatorColor = 'border-l-amber-500/50';
              textAccent = 'text-amber-400';
              strokeColor = '#f59e0b';
            } else if (trend) {
              indicatorColor = 'border-l-cyan-500/50';
            }

            return (
              <motion.div
                layout
                key={kpi.name}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className={`relative group bg-transparent p-5 overflow-hidden flex flex-col justify-between min-h-[140px] transition-colors hover:bg-slate-800/20`}
              >
                <div className={`absolute top-0 left-0 w-full h-px ${indicatorColor.replace('border-l', 'bg').replace('50', '20')}`} />
                <div className={`absolute top-0 left-0 w-px h-full ${indicatorColor.replace('border-l', 'bg').replace('50', '20')}`} />

                <div className="flex justify-between items-start relative z-10">
                  <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest truncate pr-2">
                    {kpi.name}
                  </h4>
                  {trend ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-bold ${textAccent}`}>
                        {isPositive ? '+' : ''}{trend.pct_change.toFixed(2)}%
                      </span>
                      {isPositive ? <TrendingUp className={`w-3.5 h-3.5 ${textAccent} shrink-0 opacity-80`} /> :
                       isNegative ? <TrendingDown className={`w-3.5 h-3.5 ${textAccent} shrink-0 opacity-80`} /> :
                       <Minus className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                    </div>
                  ) : (
                    <Info className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  )}
                </div>

                <div className="relative z-10 mt-4 mb-2">
                  <div className="text-4xl lg:text-[40px] font-black text-white tracking-tighter flex items-baseline gap-2">
                    <AnimatedCounter value={kpi.value} format={kpi.format} />
                  </div>
                </div>

                {trend && trend.time_series.length > 2 && (
                  <div className="absolute bottom-0 right-0 left-0 h-8 opacity-20 pointer-events-none px-2">
                     <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <motion.polyline 
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                          points={trend.time_series.map((t, i) => `${(i / (trend.time_series.length-1)) * 100},${100 - ((t.value - Math.min(...trend.time_series.map(x=>x.value))) / ((Math.max(...trend.time_series.map(x=>x.value)) - Math.min(...trend.time_series.map(x=>x.value))) || 1) * 100)}`).join(' ')}
                          fill="none" 
                          stroke={strokeColor} 
                          strokeWidth="1.5" 
                          vectorEffect="non-scaling-stroke"
                        />
                     </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {activeKpis.length === 0 && (
          <div className="col-span-full text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            12 KPIs unavailable for this dataset
          </div>
        )}
      </motion.div>
    </div>
  );
};
