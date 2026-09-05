import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { RelationshipMetric, DistributionStats } from '../types';

interface CorrelationMatrixViewProps {
  relationships: RelationshipMetric[];
  distributions: DistributionStats[];
}

export const CorrelationMatrixView: React.FC<CorrelationMatrixViewProps> = ({
  relationships,
  distributions,
}) => {
  const getStrengthBadge = (strength: string, corr: number) => {
    switch (strength) {
      case 'strong_positive':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Strong Positive ({corr})</span>
          </span>
        );
      case 'moderate_positive':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Moderate Positive ({corr})</span>
          </span>
        );
      case 'strong_negative':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Strong Negative ({corr})</span>
          </span>
        );
      case 'moderate_negative':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Moderate Negative ({corr})</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <Minus className="w-3.5 h-3.5" />
            <span>Neutral / Weak ({corr})</span>
          </span>
        );
    }
  };

  const formatTitle = (str: string) => str.replace(/_/g, ' ').replace("-", " ").toUpperCase();

  const sortedRels = [...relationships].sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  const primaryRel = sortedRels.length > 0 ? sortedRels[0] : null;
  const secondaryRels = sortedRels.slice(1);

  return (
    <div className="space-y-12">
      {/* 04 — VARIABLE RELATIONSHIPS */}
      <div className="space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="pt-16 pb-2 relative"
        >
          <div className="flex items-center gap-6">
            <h2 className="text-[20px] lg:text-[28px] font-bold text-white tracking-tight flex items-center gap-4">
              <span className="text-accent-cyan font-mono text-[20px] lg:text-[28px] font-normal tracking-wider">04</span> 
              VARIABLE RELATIONSHIPS
            </h2>
            <div className="h-px bg-gradient-to-r from-slate-800 to-transparent flex-1" />
          </div>
        </motion.div>

        {relationships.length === 0 ? (
          <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 text-center text-xs text-slate-400">
            Fewer than 2 numeric measure columns available for correlation pairing.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Primary Relationship */}
            {primaryRel && (
              <div className="bg-transparent border border-slate-800/80 p-8 flex flex-col items-center text-center relative overflow-hidden group">
                <div className="text-xs font-mono font-bold text-slate-500 mb-6 tracking-widest uppercase">
                  PRIMARY RELATIONSHIP
                </div>
                
                <div className="flex items-center justify-center gap-6 mb-8 w-full">
                  <div className="text-xl lg:text-3xl font-bold text-white tracking-tight text-right flex-1 truncate">
                    {formatTitle(primaryRel.column_a)}
                  </div>
                  <div className="text-slate-600 font-bold text-2xl">×</div>
                  <div className="text-xl lg:text-3xl font-bold text-white tracking-tight text-left flex-1 truncate">
                    {formatTitle(primaryRel.column_b)}
                  </div>
                </div>
                
                <div className="text-5xl lg:text-6xl font-bold text-white tracking-tighter mb-4 flex items-center justify-center">
                  {primaryRel.correlation > 0 ? '+' : ''}{primaryRel.correlation.toFixed(4)}
                </div>
                
                <div className="mb-10">{getStrengthBadge(primaryRel.strength, primaryRel.correlation)}</div>

                {/* Visual Correlation Indicator */}
                <div className="w-full max-w-2xl mx-auto relative h-2 bg-slate-800/50 rounded-full mb-6 mt-4">
                  <div className="absolute left-0 -top-6 text-[10px] font-mono text-slate-500 uppercase">Negative (-1)</div>
                  <div className="absolute left-1/2 -top-6 -translate-x-1/2 text-[10px] font-mono text-slate-500 uppercase">0</div>
                  <div className="absolute right-0 -top-6 text-[10px] font-mono text-slate-500 uppercase">Positive (+1)</div>
                  
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
                  
                  <div 
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#070D18] ${primaryRel.correlation >= 0 ? 'bg-emerald-400' : 'bg-rose-400'} shadow-[0_0_15px_currentColor]`}
                    style={{ left: `calc(50% + ${primaryRel.correlation * 50}%)`, transform: 'translate(-50%, -50%)' }}
                  />
                </div>
              </div>
            )}

            {/* Secondary Relationships List */}
            {secondaryRels.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4 pt-6">
                <div className="col-span-full mb-2">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">SECONDARY RELATIONSHIPS</h3>
                </div>
                {secondaryRels.map((rel, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors px-2">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-mono font-bold text-white tracking-tight flex items-center gap-2">
                        <span>{formatTitle(rel.column_a)}</span>
                        <span className="text-slate-600">×</span>
                        <span>{formatTitle(rel.column_b)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        {rel.strength.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-white font-mono">
                      {rel.correlation > 0 ? '+' : ''}{rel.correlation.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 05 — DISTRIBUTION & SHAPE */}
      {distributions.length > 0 && (
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="pt-16 pb-2 relative"
          >
            <div className="flex items-center gap-6">
              <h2 className="text-[20px] lg:text-[28px] font-bold text-white tracking-tight flex items-center gap-4">
                <span className="text-accent-cyan font-mono text-[20px] lg:text-[28px] font-normal tracking-wider">05</span> 
                DISTRIBUTION & SHAPE
              </h2>
              <div className="h-px bg-gradient-to-r from-slate-800 to-transparent flex-1" />
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {distributions.map((dist) => {
              // Conceptual normalization for the visual span since we don't have global min/max
              const spanWidth = Math.min(100, Math.max(10, (dist.iqr / (Math.abs(dist.p75) + 0.001)) * 100));
              
              return (
              <div key={dist.column} className="bg-transparent border border-slate-800/80 hover:border-slate-700 transition-colors p-6 group relative overflow-hidden flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-mono font-bold text-white uppercase tracking-widest mb-6 truncate pr-4">
                    {formatTitle(dist.column)}
                  </h3>

                  {dist.is_constant ? (
                    <div className="h-24 flex items-center justify-center">
                      <span className="px-3 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold tracking-widest uppercase">
                        Constant Value
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Conceptual Distribution Span */}
                      <div className="w-full py-4 relative group-hover:opacity-100 opacity-80 transition-opacity">
                        <div className="absolute left-0 top-0 text-[9px] font-mono text-slate-500">Q1 ({dist.p25})</div>
                        <div className="absolute right-0 top-0 text-[9px] font-mono text-slate-500">Q3 ({dist.p75})</div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full mt-4 relative overflow-hidden">
                          <div 
                            className="absolute h-full bg-accent-cyan/80 rounded-full" 
                            style={{ left: `${50 - spanWidth/2}%`, width: `${spanWidth}%` }}
                          />
                        </div>
                        <div className="text-center mt-2 text-[10px] font-mono text-white font-bold">
                          IQR: {dist.iqr}
                        </div>
                      </div>
                      
                      <div className="w-full h-px bg-slate-800/50" />
                      
                      <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Skewness</span>
                          <span className={`font-mono text-sm font-bold ${dist.skewness > 0.5 || dist.skewness < -0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {dist.skewness.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Zero Count</span>
                          <span className="text-white font-mono text-sm font-bold">{dist.zero_count.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  );
};
