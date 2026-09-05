import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { RelationshipMetric } from '../types';

interface CorrelationMatrixViewProps {
  relationships: RelationshipMetric[];
}

export const CorrelationMatrixView: React.FC<CorrelationMatrixViewProps> = ({
  relationships,
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
                
                <div className="flex items-center justify-center gap-4 lg:gap-6 mb-8 w-full min-w-0">
                  <div className="text-xl lg:text-3xl font-bold text-white tracking-tight text-right flex-1 break-words min-w-0 leading-tight">
                    {formatTitle(primaryRel.column_a)}
                  </div>
                  <div className="text-slate-600 font-bold text-2xl shrink-0">×</div>
                  <div className="text-xl lg:text-3xl font-bold text-white tracking-tight text-left flex-1 break-words min-w-0 leading-tight">
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
              <div className="grid gap-x-8 lg:gap-x-12 gap-y-4 pt-6 min-w-0 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                <div className="col-span-full mb-2">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">SECONDARY RELATIONSHIPS</h3>
                </div>
                {secondaryRels.map((rel, idx) => (
                  <div key={idx} className="flex items-center justify-between py-4 border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors px-2 min-w-0 gap-4">
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      <div className="text-xs font-mono font-bold text-white flex flex-col gap-1 min-w-0" style={{ overflowWrap: 'anywhere' }}>
                        <span className="break-words whitespace-normal leading-snug">{formatTitle(rel.column_a)}</span>
                        <span className="text-slate-600">×</span>
                        <span className="break-words whitespace-normal leading-snug">{formatTitle(rel.column_b)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-1">
                        {rel.strength.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="text-xl lg:text-2xl font-bold text-white font-mono shrink-0 text-right">
                      {rel.correlation > 0 ? '+' : ''}{rel.correlation.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
