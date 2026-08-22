import React, { useEffect, useState, useCallback } from 'react';
import {
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  BarChart3,
  Cpu,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  MLTaskDiscoveryResponse,
  MLTaskCandidate,
  MLAnalysisResponse,
  PredictionResponse,
} from '../types';
import { fetchMLTasks, runMLAnalysis, fetchMLAnalyses, runMLPrediction } from '../services/api';

interface MLInsightsDashboardProps {
  datasetId: string;
}

export const MLInsightsDashboard: React.FC<MLInsightsDashboardProps> = ({ datasetId }) => {
  const [taskDiscovery, setTaskDiscovery] = useState<MLTaskDiscoveryResponse | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<MLAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected task state for custom triggers
  const [selectedTask, setSelectedTask] = useState<MLTaskCandidate | null>(null);

  // Interactive prediction form state
  const [predictionInputs, setPredictionInputs] = useState<Record<string, string>>({});
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResponse | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const loadMLData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksRes, analysesRes] = await Promise.all([
        fetchMLTasks(datasetId),
        fetchMLAnalyses(datasetId),
      ]);
      setTaskDiscovery(tasksRes);

      if (tasksRes.candidate_tasks.length > 0) {
        setSelectedTask(tasksRes.candidate_tasks[0]);
      }

      if (analysesRes.length > 0) {
        setActiveAnalysis(analysesRes[0]);
      }
    } catch (err: any) {
      console.warn('Failed to load ML tasks/analyses:', err);
      setError(err.message || 'Dataset must be cleaned/processed before running ML Task Discovery.');
    } finally {
      setIsLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadMLData();
  }, [loadMLData]);

  const handleRunAnalysis = async (candidate?: MLTaskCandidate) => {
    const targetCandidate = candidate || selectedTask;
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await runMLAnalysis(
        datasetId,
        targetCandidate?.task_type,
        targetCandidate?.target_column || undefined
      );
      setActiveAnalysis(response);
    } catch (err: any) {
      setError(err.message || 'Failed to execute ML task analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handlePredictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAnalysis) return;

    setIsPredicting(true);
    setPredictionError(null);
    setPredictionResult(null);

    try {
      const parsedInput: Record<string, any> = {};
      for (const [key, val] of Object.entries(predictionInputs)) {
        if (val.trim() !== '') {
          const num = Number(val);
          parsedInput[key] = isNaN(num) ? val : num;
        }
      }

      const res = await runMLPrediction(datasetId, activeAnalysis.id, [parsedInput]);
      setPredictionResult(res);
    } catch (err: any) {
      setPredictionError(err.message || 'Prediction failed.');
    } finally {
      setIsPredicting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card-panel py-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
        <p className="text-sm font-medium text-slate-300">Discovering ML Tasks & Feature Suitability...</p>
        <p className="text-xs text-slate-500">Evaluating target distributions, measure roles, and feature candidates.</p>
      </div>
    );
  }

  if (error && !taskDiscovery) {
    return (
      <div className="card-panel border-rose-800/60 bg-rose-950/20 p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white">ML Task Discovery Unavailable</h3>
            <p className="text-xs text-rose-300 mt-0.5">{error}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Predictive Analytics & ML Task Discovery require a clean, processed dataset to guarantee model stability and prevent missingness errors. Please switch to the <strong className="text-emerald-400">Profile & Cleaning</strong> tab to apply a cleaning plan first.
        </p>
      </div>
    );
  }

  const candidateTasks = taskDiscovery?.candidate_tasks || [];

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="card-panel bg-slate-900/90 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-purple-400 font-medium text-xs tracking-wider uppercase">
              <BrainCircuit className="w-4 h-4 text-purple-400" />
              <span>Phase 6 Predictive Analytics & ML Foundation</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Automated ML Task Discovery & Baseline Modeling
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              InsightFlow inspects dataset features, cardinality, missingness, and column roles to deterministically recommend predictive tasks (Regression, Classification, Time-Series Forecasting, Anomaly Detection) without requiring manual model tuning.
            </p>
          </div>

          <button
            onClick={() => handleRunAnalysis()}
            disabled={isAnalyzing || candidateTasks.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-colors shrink-0"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Fitting Models...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Recommended Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* DISCOVERED ML TASK CANDIDATES GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Discovered ML Task Candidates ({candidateTasks.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">Domain-Agnostic Scoring</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidateTasks.map((task, idx) => {
            const isSelected = selectedTask?.task_type === task.task_type && selectedTask?.target_column === task.target_column;
            const pct = Math.round(task.suitability_score * 100);

            return (
              <div
                key={`${task.task_type}-${task.target_column}-${idx}`}
                onClick={() => setSelectedTask(task)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                  isSelected
                    ? 'bg-purple-950/30 border-purple-600/80 shadow-lg shadow-purple-950/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                        {task.task_type.replace(/_/g, ' ')}
                      </span>
                      {task.target_column && (
                        <span className="text-xs text-slate-300 font-mono font-medium">
                          Target: <span className="text-sky-300">{task.target_column}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-400">Suitability</span>
                    <div className="text-lg font-bold font-mono text-emerald-400">{pct}%</div>
                  </div>
                </div>

                {/* Reasons List */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Why Selected?</div>
                  <ul className="space-y-1">
                    {task.reasons.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Warnings if small dataset */}
                {task.warnings.length > 0 && (
                  <div className="bg-amber-950/20 border border-amber-800/40 rounded p-2 text-[11px] text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{task.warnings[0]}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/60 text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">
                    {task.required_conditions.join(' • ')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunAnalysis(task);
                    }}
                    className="px-2.5 py-1 bg-purple-600/90 hover:bg-purple-500 text-white rounded text-[11px] font-medium transition-colors"
                  >
                    Analyze Task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIVE MODEL ANALYSIS RESULTS */}
      {activeAnalysis && (
        <div className="space-y-6 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Model Evaluation & Selection Results</h3>
                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize font-mono">
                  {activeAnalysis.task_type.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Model ID: <span className="font-mono text-slate-300">{activeAnalysis.id}</span> • Version: {activeAnalysis.model_version}
              </p>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-4">
              <div>Train Rows: <span className="text-white font-semibold">{activeAnalysis.training_row_count}</span></div>
              <div>Test Rows: <span className="text-white font-semibold">{activeAnalysis.test_row_count}</span></div>
            </div>
          </div>

          {/* Small Sample Warning */}
          {activeAnalysis.data_warnings.map((w, i) => (
            <div key={i} className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 text-xs text-amber-200 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{w}</span>
            </div>
          ))}

          {/* Model Selection Explanation Banner */}
          <div className="bg-purple-950/30 border border-purple-800/60 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                Selected Model: {activeAnalysis.model_name}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-700">
                Artifact Saved
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              "{activeAnalysis.selection_reason}"
            </p>
          </div>

          {/* EVALUATED CANDIDATE MODELS METRICS TABLE */}
          <div className="card-panel space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>Candidate Models Evaluation Metrics</span>
            </h4>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Model Candidate</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Validation Metrics</th>
                    <th className="px-4 py-2.5 font-semibold">Selection Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {activeAnalysis.candidate_models.map((cand, i) => (
                    <tr key={i} className={cand.is_selected ? 'bg-purple-950/20 font-medium' : ''}>
                      <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                        {cand.is_selected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        <span>{cand.model_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        {cand.is_selected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            SELECTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                            EVALUATED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {Object.entries(cand.metrics)
                          .filter(([_, v]) => v !== null && v !== undefined)
                          .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
                          .join(' • ') || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 leading-relaxed text-[11px]">
                        {cand.selection_reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FEATURE SELECTION SUMMARY (INCLUDED VS EXCLUDED) */}
          <div className="card-panel space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Feature Discovery & Classification Rationale</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeAnalysis.feature_summary.map((feat) => (
                <div
                  key={feat.name}
                  className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                    feat.status === 'included'
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-950/60 border-slate-900 opacity-75'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{feat.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {feat.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{feat.reason}</p>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider font-mono ${
                      feat.status === 'included'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {feat.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* INTERACTIVE PREDICTION ENGINE PANEL */}
          <div className="card-panel space-y-4 border-purple-800/40 bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-purple-400 fill-current" />
                  <span>Run Prediction Engine</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Execute inference using trained model artifact: <code className="text-purple-300">{activeAnalysis.model_name}</code>
                </p>
              </div>
              <span className="text-[11px] px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                No Model Refitting
              </span>
            </div>

            <form onSubmit={handlePredictSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAnalysis.feature_columns.map((feat) => (
                  <div key={feat} className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 font-mono block">
                      {feat}
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter value for ${feat}`}
                      value={predictionInputs[feat] || ''}
                      onChange={(e) =>
                        setPredictionInputs({ ...predictionInputs, [feat]: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-xs text-slate-500 font-mono">
                  Inputs will pass through saved pipeline transformer
                </span>

                <button
                  type="submit"
                  disabled={isPredicting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5"
                >
                  {isPredicting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Predicting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                      <span>Execute Prediction</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {predictionError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
                {predictionError}
              </div>
            )}

            {predictionResult && (
              <div className="bg-purple-950/40 border border-purple-800/80 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Prediction Engine Output</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-sm text-emerald-400">
                  {predictionResult.predictions.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">
                        {activeAnalysis.target_column ? `Predicted ${activeAnalysis.target_column}` : 'Output'}:
                      </span>
                      <span className="font-bold text-white">{typeof p === 'number' ? p.toLocaleString() : String(p)}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-400 italic">
                  {predictionResult.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
