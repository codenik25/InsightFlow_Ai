import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
  accentColor?: 'sky' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  accentColor = 'sky',
  className = '',
}) => {
  const accentGradients = {
    sky: 'from-sky-500/10 via-slate-900 to-slate-900 border-sky-500/30 text-sky-400',
    indigo: 'from-indigo-500/10 via-slate-900 to-slate-900 border-indigo-500/30 text-indigo-400',
    emerald: 'from-emerald-500/10 via-slate-900 to-slate-900 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/30 text-amber-400',
    purple: 'from-purple-500/10 via-slate-900 to-slate-900 border-purple-500/30 text-purple-400',
    rose: 'from-rose-500/10 via-slate-900 to-slate-900 border-rose-500/30 text-rose-400',
  };

  const iconBg = {
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div
      className={`bg-gradient-to-br ${accentGradients[accentColor]} border rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 animate-fadeIn ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
          {label}
        </span>
        {Icon && (
          <div className={`p-2 rounded-xl border ${iconBg[accentColor]} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="text-2xl font-bold font-mono text-white tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>

        {trend && (
          <span
            className={`text-xs font-semibold font-mono px-2 py-0.5 rounded-full border ${
              trend.positive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subValue && (
        <p className="text-xs text-slate-400 mt-1.5 font-mono truncate">{subValue}</p>
      )}
    </div>
  );
};
