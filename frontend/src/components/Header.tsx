import React from 'react';
import { Database, Server, RefreshCw, Sparkles } from 'lucide-react';

import { HealthStatus } from '../types';

interface HeaderProps {
  health: HealthStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, loading, onRefresh }) => {
  const isHealthy = health?.status === 'healthy';
  const isDbConnected = health?.database_connected ?? false;

  return (
    <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Platform Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 text-white flex items-center justify-center font-extrabold text-lg shadow-lg shadow-indigo-500/20 shrink-0">
            IF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight font-sans">
                Insight<span className="text-gradient-primary">Flow</span> AI
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-bold font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300 fill-current" />
                Phase 1–7.7 Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Automated Analytics & Decision Intelligence Suite</p>
          </div>
        </div>

        {/* System Health Probe Indicators & Refresh */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2.5 text-xs font-mono">
            {/* Backend API Service */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">API:</span>
              <span className={isHealthy ? "text-emerald-400 font-bold flex items-center gap-1" : "text-rose-400 font-bold flex items-center gap-1"}>
                <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                {isHealthy ? "Operational" : "Offline"}
              </span>
            </div>

            {/* PostgreSQL Database ORM */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">PostgreSQL:</span>
              <span className={isDbConnected ? "text-emerald-400 font-bold flex items-center gap-1" : "text-amber-400 font-bold flex items-center gap-1"}>
                <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {isDbConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 shadow-md transition-all disabled:opacity-50"
            title="Refresh System Health Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Refresh Health</span>
          </button>
        </div>
      </div>
    </header>
  );
};
