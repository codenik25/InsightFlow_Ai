import React from 'react';
import { Server, Database, Clock, ShieldCheck, AlertTriangle, Cpu } from 'lucide-react';
import { HealthStatus } from '../types';

interface StatusCardProps {
  health: HealthStatus | null;
  loading: boolean;
}

export const StatusCard: React.FC<StatusCardProps> = ({ health, loading }) => {
  if (loading) {
    return (
      <div className="card-panel animate-pulse space-y-4">
        <div className="h-4 bg-slate-800 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-16 bg-slate-800/60 rounded"></div>
          <div className="h-16 bg-slate-800/60 rounded"></div>
          <div className="h-16 bg-slate-800/60 rounded"></div>
        </div>
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';
  const isDbConnected = health?.database_connected ?? false;

  return (
    <div className="card-panel space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <h2 className="text-base font-semibold text-white">System Status & Environment Probe</h2>
        </div>
        <span className={isHealthy ? "badge-success" : "badge-warning"}>
          {health?.status.toUpperCase() || 'UNKNOWN'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Backend API Service */}
        <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Server className="w-3.5 h-3.5 text-slate-400" /> API Gateway
            </span>
            <span className="font-mono text-slate-400">/api/health</span>
          </div>
          <p className="text-sm font-semibold text-white mt-1">
            {health?.project_name || 'FastAPI Service'}
          </p>
          <div className="flex items-center gap-2 text-xs mt-2">
            <span className="text-slate-400">Version:</span>
            <span className="text-slate-200 font-mono">{health?.version || 'v0.1.0'}</span>
          </div>
        </div>

        {/* Database Status */}
        <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Database className="w-3.5 h-3.5 text-slate-400" /> Database Engine
            </span>
            <span className="font-mono text-slate-400">PostgreSQL</span>
          </div>
          <p className="text-sm font-semibold text-white mt-1">
            {isDbConnected ? 'PostgreSQL 16' : 'Awaiting Service'}
          </p>
          <div className="flex items-center gap-2 text-xs mt-2">
            <span className="text-slate-400">Driver:</span>
            <span className="text-slate-200 font-mono">psycopg 3</span>
          </div>
        </div>

        {/* Environment */}
        <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-slate-400" /> Runtime Mode
            </span>
          </div>
          <p className="text-sm font-semibold text-white capitalize mt-1">
            {health?.environment || 'development'}
          </p>
          <div className="flex items-center gap-2 text-xs mt-2">
            <span className="text-slate-400">CORS:</span>
            <span className="text-slate-200">Enabled</span>
          </div>
        </div>

        {/* Last Probe Time */}
        <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Health Probe
            </span>
          </div>
          <p className="text-sm font-medium font-mono text-slate-300 mt-1 truncate">
            {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
            <span className="truncate">{health?.details || 'System active'}</span>
          </div>
        </div>
      </div>

      {!isDbConnected && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Note: PostgreSQL container is inactive or connecting. Start PostgreSQL via <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-200">docker-compose up -d db</code> for active database connection verification.
          </span>
        </div>
      )}
    </div>
  );
};
