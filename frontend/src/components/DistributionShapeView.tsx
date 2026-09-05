import React from 'react';
import { motion } from 'framer-motion';
import { DistributionStats } from '../types';

interface DistributionShapeViewProps {
  distributions: DistributionStats[];
}

export const DistributionShapeView: React.FC<DistributionShapeViewProps> = ({ distributions }) => {
  const formatTitle = (str: string) => str.replace(/_/g, ' ').replace("-", " ").toUpperCase();

  if (!distributions || distributions.length === 0) return null;

  return (
    <div className="space-y-6 w-full min-w-0">
      <motion.div 
        initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="pt-12 pb-2 relative"
      >
        <div className="flex items-center gap-6">
          <h2 className="text-[20px] lg:text-[28px] font-bold text-white tracking-tight flex items-center gap-4">
            <span className="text-accent-cyan font-mono text-[20px] lg:text-[28px] font-normal tracking-wider">05</span> 
            DISTRIBUTION & SHAPE
          </h2>
          <div className="h-px bg-gradient-to-r from-slate-800 to-transparent flex-1" />
        </div>
      </motion.div>

      <div className="grid gap-6 lg:gap-8 min-w-0 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {distributions.map((dist) => {
          return (
            <div key={dist.column} className="bg-transparent border border-slate-800/80 hover:border-slate-700 transition-colors p-5 sm:p-6 group relative overflow-hidden flex flex-col justify-between min-w-0">
              <div className="min-w-0">
                <h3 className="text-[14px] leading-snug font-mono font-bold text-white tracking-widest mb-6 break-words whitespace-normal min-w-0">
                  {formatTitle(dist.column)}
                </h3>

                {dist.is_constant ? (
                  <div className="h-32 flex items-center justify-center">
                    <span className="px-3 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold tracking-widest uppercase">
                      Constant Value
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Q1 / Q3 with 2-column grid to prevent overlap */}
                    <div className="grid gap-4 min-w-0" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Q1</span>
                        <span className="text-sm font-mono font-bold text-slate-300 break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
                          {dist.p25.toLocaleString()}
                        </span>
                      </div>
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Q3</span>
                        <span className="text-sm font-mono font-bold text-slate-300 break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
                          {dist.p75.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-px bg-slate-800/60" />

                    {/* IQR */}
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">IQR</span>
                      <span className="text-sm font-mono font-bold text-white break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
                        {dist.iqr.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-full h-px bg-slate-800/60" />
                    
                    {/* SKEWNESS & ZERO COUNT */}
                    <div className="grid gap-4 min-w-0" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Skewness</span>
                        <span className={`text-sm font-mono font-bold break-words min-w-0 ${dist.skewness > 0.5 || dist.skewness < -0.5 ? 'text-amber-400' : 'text-emerald-400'}`} style={{ overflowWrap: 'anywhere' }}>
                          {dist.skewness.toFixed(4)}
                        </span>
                      </div>
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Zero Count</span>
                        <span className="text-sm font-mono font-bold text-white break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
                          {dist.zero_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};
