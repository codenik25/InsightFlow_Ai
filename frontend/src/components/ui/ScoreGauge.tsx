import React from 'react';

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
  subtext?: string;
  className?: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  maxScore = 100,
  label,
  size = 'md',
  showSubtext = false,
  subtext,
  className = '',
}) => {
  const percentage = Math.min(Math.max((score / maxScore) * 100, 0), 100);

  const getColor = (pct: number) => {
    if (pct >= 80) return { stroke: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (pct >= 60) return { stroke: '#0EA5E9', text: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' };
    if (pct >= 40) return { stroke: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { stroke: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  };

  const theme = getColor(percentage);

  const radius = size === 'sm' ? 24 : size === 'lg' ? 44 : 34;
  const strokeWidth = size === 'sm' ? 4 : size === 'lg' ? 7 : 5;
  const dimension = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg ${className}`}>
      <div className="relative flex items-center justify-center">
        <svg width={dimension} height={dimension} className="transform -rotate-90">
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            stroke={theme.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center font-mono">
          <span className={`font-extrabold ${theme.text} ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-base'}`}>
            {score.toFixed(0)}
          </span>
          <span className="text-[9px] text-slate-500">/{maxScore}</span>
        </div>
      </div>

      <span className="mt-2 text-xs font-semibold text-slate-300 font-mono text-center truncate max-w-[120px]">
        {label}
      </span>

      {showSubtext && (
        <span className={`mt-1 px-2 py-0.5 rounded text-[10px] font-mono border ${theme.bg} ${theme.text}`}>
          {subtext || (percentage >= 80 ? 'Optimal' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Caution' : 'Critical')}
        </span>
      )}
    </div>
  );
};
