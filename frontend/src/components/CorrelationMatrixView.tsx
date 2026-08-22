import React from 'react';
import { GitCommit, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      {/* Pearson Correlation Pairwise Relationships */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-emerald-400" />
            <span>Bivariate Pearson Correlation & Relationship Strength ({relationships.length} pairs)</span>
          </h3>
        </div>

        {relationships.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
            Fewer than 2 numeric measure columns available for correlation pairing.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relationships.map((rel, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                    <span>{formatTitle(rel.column_a)}</span>
                    <span className="text-slate-500">vs</span>
                    <span>{formatTitle(rel.column_b)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Pearson Correlation coefficient r</p>
                </div>
                {getStrengthBadge(rel.strength, rel.correlation)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extended Distribution & Skewness Stats */}
      {distributions.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white">
              Advanced Numeric Measures Distribution & Skewness
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
            {distributions.map((dist) => (
              <div key={dist.column} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white">{dist.column}</span>
                  {dist.is_constant ? (
                    <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">Constant</span>
                  ) : (
                    <span className="text-[11px] text-slate-400">IQR: {dist.iqr}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Skewness</span>
                    <span className="text-emerald-400">{dist.skewness}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Zero Count</span>
                    <span className="text-slate-300">{dist.zero_count}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Quartile 1 (P25)</span>
                    <span className="text-slate-300">{dist.p25}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Quartile 3 (P75)</span>
                    <span className="text-slate-300">{dist.p75}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
