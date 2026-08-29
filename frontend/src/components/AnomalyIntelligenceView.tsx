import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from 'lucide-react';
import { AnomalyAnalysisResponse } from '../types';
import { fetchAnomalyResult, runAnomalyAnalysis } from '../services/api';


interface AnomalyIntelligenceViewProps {
  datasetId: string;
}

export const AnomalyIntelligenceView: React.FC<AnomalyIntelligenceViewProps> = ({ datasetId }) => {
  const [anomalyData, setAnomalyData] = useState<AnomalyAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & pagination state
  const [filterMode, setFilterMode] = useState<'ALL' | 'ANOMALOUS' | 'NORMAL' | 'HIGH_SEVERITY'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const loadAnomaly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnomalyResult(datasetId);
      setAnomalyData(res);
    } catch (err: any) {
      console.warn('Failed to load anomaly results:', err);
      try {
        const fresh = await runAnomalyAnalysis(datasetId);
        setAnomalyData(fresh);
      } catch (runErr: any) {
        setError(runErr.message || 'Anomaly Intelligence pipeline could not be executed for this dataset.');
      }
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadAnomaly();
  }, [loadAnomaly]);

  if (loading) {
    return (
      <div className="card-panel py-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-rose-400 mx-auto" />
        <p className="text-sm font-medium text-slate-300">Running Isolation Forest Anomaly Detection...</p>
        <p className="text-xs text-slate-500">Evaluating multi-dimensional feature space, computing normalized anomaly scores, and attributing feature deviations.</p>
      </div>
    );
  }

  if (error || !anomalyData) {
    return (
      <div className="card-panel border-rose-800/60 bg-rose-950/20 p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white">Anomaly Intelligence Unavailable</h3>
            <p className="text-xs text-rose-300 mt-0.5">{error}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Unsupervised Anomaly Detection requires at least one numeric continuous measure column and at least 3 dataset records.
        </p>
      </div>
    );
  }

  const {
    total_observations,
    anomaly_count,
    anomaly_rate,
    high_severity_count,
    confidence,
    anomalies,
    warnings,
    score_distribution,
  } = anomalyData;

  // Filter items
  const filteredItems = anomalies.filter((item) => {
    if (filterMode === 'ANOMALOUS') return item.status === 'ANOMALOUS';
    if (filterMode === 'NORMAL') return item.status === 'NORMAL';
    if (filterMode === 'HIGH_SEVERITY') return item.severity === 'HIGH';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card-panel bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>ANOMALY INTELLIGENCE</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase border ${
                  confidence === 'STANDARD'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                Confidence: {confidence}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Isolation Forest Outlier & Risk Signal Analysis
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Evaluated {anomalyData.feature_columns.length} numeric dimensions across {total_observations} observations.
            </p>
          </div>

          <button
            onClick={() => loadAnomaly()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span>Re-run Anomaly Engine</span>
          </button>
        </div>
      </div>

      {/* Warnings List */}
      {warnings.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 space-y-1 text-xs text-amber-200">
          {warnings.map((w, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Total Observations</div>
          <div className="text-xl font-bold font-mono text-white">{total_observations}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Anomalies Detected</div>
          <div className={`text-xl font-bold font-mono ${anomaly_count > 0 ? 'text-amber-400' : 'text-white'}`}>
            {anomaly_count}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Anomaly Rate (%)</div>
          <div className={`text-xl font-bold font-mono ${anomaly_rate > 5.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {anomaly_rate}%
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">High Severity Outliers</div>
          <div className={`text-xl font-bold font-mono ${high_severity_count > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {high_severity_count}
          </div>
        </div>
      </div>

      {/* Score Distribution Overview */}
      {score_distribution && (
        <div className="card-panel bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <span>Anomaly Score Distribution Ranges</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
            {Object.entries(score_distribution).map(([range, count]) => (
              <div key={range} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">{range} Score:</span>
                <span className="font-bold text-white">{count} rows</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly Table with Filter & Pagination */}
      <div className="card-panel bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Observation Inspection Table
            </h4>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {(['ALL', 'ANOMALOUS', 'NORMAL', 'HIGH_SEVERITY'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setFilterMode(mode);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all font-semibold ${
                  filterMode === mode
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Row</th>
                <th className="px-4 py-2.5 font-semibold">Anomaly Score</th>
                <th className="px-4 py-2.5 font-semibold">Severity</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Statistically Unusual Attribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {paginatedItems.map((item) => (
                <tr key={item.row_id} className={item.status === 'ANOMALOUS' ? 'bg-rose-950/20' : ''}>
                  <td className="px-4 py-3 font-mono font-bold text-white">#{item.row_id}</td>
                  <td className="px-4 py-3 font-mono text-rose-300 font-bold">{item.anomaly_score}</td>
                  <td className="px-4 py-3 font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                        item.severity === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : item.severity === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {item.status === 'ANOMALOUS' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        ANOMALOUS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        NORMAL
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 leading-relaxed text-[11px]">
                    <p className="font-medium text-slate-200">{item.explanation}</p>
                    {item.feature_deviations.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.feature_deviations.map((d, di) => (
                          <span key={di} className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-mono">
                            {d.feature}: {d.observed_value} ({d.deviation_zscore}σ)
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-xs font-mono">
                    No observations matching filter criteria '{filterMode}'.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2">
          <div>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(filteredItems.length, currentPage * pageSize)} of {filteredItems.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
