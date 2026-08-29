import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-800 rounded w-1/3"></div>
            <div className="h-8 w-8 bg-slate-800 rounded-xl"></div>
          </div>
          <div className="h-8 bg-slate-800 rounded w-1/2"></div>
          <div className="h-3 bg-slate-800/60 rounded w-3/4"></div>
        </div>
      ))}
    </>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="h-6 bg-slate-800 rounded w-1/4 mb-4"></div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b border-slate-800/40">
          <div className="h-4 bg-slate-800 rounded w-1/4"></div>
          <div className="h-4 bg-slate-800/60 rounded w-1/6"></div>
          <div className="h-4 bg-slate-800/60 rounded w-1/6"></div>
          <div className="h-4 bg-slate-800 rounded w-1/8"></div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="h-5 bg-slate-800 rounded w-1/3"></div>
        <div className="h-4 bg-slate-800/60 rounded w-2/3"></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CardSkeleton count={4} />
      </div>

      <TableSkeleton rows={4} />
    </div>
  );
};
