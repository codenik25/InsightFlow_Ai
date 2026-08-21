import React from 'react';
import { Database, Server, RefreshCw } from 'lucide-react';
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
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Phase Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            IF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white tracking-tight">InsightFlow AI</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-sky-950 text-sky-400 border border-sky-800 rounded">
                Phase 0 Foundation
              </span>
            </div>
            <p className="text-xs text-slate-400">Automated Analytics & Decision Intelligence Platform</p>
          </div>
        </div>

        {/* Live Status Indicators & Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 text-xs">
            {/* Backend Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300 font-medium">Backend:</span>
              <span className={isHealthy ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                {isHealthy ? "Operational" : "Offline"}
              </span>
            </div>

            {/* DB Connection Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300 font-medium">PostgreSQL:</span>
              <span className={isDbConnected ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {isDbConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh System Health Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Check Health</span>
          </button>
        </div>
      </div>
    </header>
  );
};
