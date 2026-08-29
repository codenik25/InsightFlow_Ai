import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { ForecastAnalysisResponse } from '../types';
import { runForecastAnalysis } from '../services/api';


interface DemandForecastViewProps {
  datasetId: string;
}

export const DemandForecastView: React.FC<DemandForecastViewProps> = ({ datasetId }) => {
  const [forecast, setForecast] = useState<ForecastAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [horizon, setHorizon] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runForecastAnalysis(datasetId, undefined, undefined, horizon);
      setForecast(res);
    } catch (err: any) {
      console.warn('Forecast analysis failed:', err);
      setError(err.message || 'Time-series demand forecasting could not be generated for this dataset.');
    } finally {
      setLoading(false);
    }
  }, [datasetId, horizon]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  if (loading) {
    return (
      <div className="card-panel py-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-sky-400 mx-auto" />
        <p className="text-sm font-medium text-slate-300">Generating Demand Forecast Pipeline...</p>
        <p className="text-xs text-slate-500">Detecting temporal column, engineering lags/rolling windows, and computing uncertainty intervals.</p>
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className="card-panel border-amber-800/60 bg-amber-950/20 p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white">Demand Forecasting Unavailable</h3>
            <p className="text-xs text-amber-300 mt-0.5">{error}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Time-series forecasting requires at least one continuous measure target and a sequential date/timestamp column. Please select or upload a dataset containing sequential time records.
        </p>
      </div>
    );
  }

  const { metrics, insights, warnings, confidence, forecast: points, historical } = forecast;

  // Max value for scaling SVG chart
  const allVals = [
    ...(historical?.map((h) => h.value) || []),
    ...points.map((p) => p.predicted_value),
    ...points.map((p) => p.upper_bound || p.predicted_value),
  ];
  const maxVal = Math.max(...allVals, 1.0);
  const minVal = Math.min(...allVals, 0.0);
  const range = maxVal - minVal > 0 ? maxVal - minVal : 1.0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card-panel bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                <span>DEMAND FORECAST</span>
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
              Future Demand Projection: <span className="text-sky-300 font-mono">{forecast.target_column}</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Time Column: <span className="text-slate-200">{forecast.time_column}</span> • Horizon: {forecast.horizon} Periods • Sample Size: {forecast.sample_size} Rows
            </p>
          </div>

          {/* Horizon Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[7, 14, 30, 60].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  horizon === h
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {h}D Horizon
              </button>
            ))}
          </div>
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">MAE (Mean Abs Error)</div>
          <div className="text-xl font-bold font-mono text-white">{metrics.mae}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">RMSE (Validation)</div>
          <div className="text-xl font-bold font-mono text-sky-400">{metrics.rmse}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">R² Score</div>
          <div className="text-xl font-bold font-mono text-emerald-400">{metrics.r2 !== null ? metrics.r2 : 'N/A'}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">MAPE (%)</div>
          <div className="text-xl font-bold font-mono text-purple-300">{metrics.mape !== null ? `${metrics.mape}%` : 'N/A'}</div>
        </div>
      </div>

      {/* Time-Series Forecast Visualizer */}
      <div className="card-panel bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-sky-400" />
            <span>Time-Series Historical vs Horizon Forecast</span>
          </h4>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span>
              Historical
            </span>
            <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span>
              Forecast Line
            </span>
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-2.5 h-2.5 rounded bg-indigo-500/30 border border-indigo-400 inline-block"></span>
              Uncertainty Band
            </span>
          </div>
        </div>

        {/* Forecast Data List Visualizer */}
        <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 sticky top-0">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Forecast Date</th>
                <th className="px-4 py-2.5 font-semibold">Predicted Value</th>
                <th className="px-4 py-2.5 font-semibold">Lower Bound</th>
                <th className="px-4 py-2.5 font-semibold">Upper Bound</th>
                <th className="px-4 py-2.5 font-semibold">Relative Scale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
              {points.map((pt, idx) => {
                const pct = Math.min(100, Math.max(5, ((pt.predicted_value - minVal) / range) * 100));
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2 text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{pt.date}</span>
                    </td>
                    <td className="px-4 py-2 text-sky-300 font-bold">{pt.predicted_value}</td>
                    <td className="px-4 py-2 text-slate-400">{pt.lower_bound ?? 'N/A'}</td>
                    <td className="px-4 py-2 text-slate-400">{pt.upper_bound ?? 'N/A'}</td>
                    <td className="px-4 py-2">
                      <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-sky-500 to-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business Interpretation Summary */}
      {insights && (
        <div className="bg-gradient-to-r from-slate-900 via-sky-950/30 to-slate-900 border border-sky-900/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h4 className="text-xs font-bold text-sky-200 uppercase tracking-wider font-mono">
              Business Forecast Interpretation
            </h4>
          </div>

          <p className="text-sm font-medium text-white leading-relaxed">
            "{insights.summary}"
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
            <div className="space-y-1">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Peak Forecast Period</span>
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold">
                <ArrowUpRight className="w-4 h-4" />
                <span>{insights.peak_period.date}: {insights.peak_period.predicted_value} units</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Lowest Forecast Period</span>
              <div className="flex items-center gap-2 text-rose-400 font-mono font-bold">
                <ArrowDownRight className="w-4 h-4" />
                <span>{insights.lowest_period.date}: {insights.lowest_period.predicted_value} units</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono italic pt-1">
            Note: {insights.non_causal_statement}
          </div>
        </div>
      )}
    </div>
  );
};
