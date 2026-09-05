import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  BarChart3,
  RefreshCw,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Target,
  ListFilter
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
  onNavigate?: (tab: string) => void;
}

export const MLInsightsDashboard: React.FC<MLInsightsDashboardProps> = ({ datasetId, onNavigate }) => {
  const [taskDiscovery, setTaskDiscovery] = useState<MLTaskDiscoveryResponse | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<MLAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected state
  const [selectedTask, setSelectedTask] = useState<MLTaskCandidate | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);

  // Dropdown states
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [isModelComparisonOpen, setIsModelComparisonOpen] = useState(false);
  const [isFeatureDetailsOpen, setIsFeatureDetailsOpen] = useState(false);
  const [isPredictionInputsOpen, setIsPredictionInputsOpen] = useState(false);
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  const [isReasonsExpanded, setIsReasonsExpanded] = useState(false);

  // Prediction state
  const [predictionInputs, setPredictionInputs] = useState<Record<string, string>>({});
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResponse | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [animatedLoad, setAnimatedLoad] = useState(false);

  useEffect(() => {
    setAnimatedLoad(true);
  }, []);

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
        const analysis = analysesRes[0];
        setActiveAnalysis(analysis);
        const selectedModel = analysis.candidate_models.find(m => m.is_selected) || analysis.candidate_models[0];
        if (selectedModel) {
          setSelectedModelName(selectedModel.model_name);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load ML tasks/analyses:', err);
      setError(err.message || 'Predictive model is not available yet.');
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
      const selectedModel = response.candidate_models.find(m => m.is_selected) || response.candidate_models[0];
      if (selectedModel) {
        setSelectedModelName(selectedModel.model_name);
      }
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

  // Derive unique tasks and targets for dropdowns
  const availableTaskTypes = useMemo(() => {
    if (!taskDiscovery) return [];
    return Array.from(new Set(taskDiscovery.candidate_tasks.map(t => t.task_type)));
  }, [taskDiscovery]);

  const availableTargets = useMemo(() => {
    if (!taskDiscovery) return [];
    return Array.from(new Set(taskDiscovery.candidate_tasks.map(t => t.target_column).filter(Boolean))) as string[];
  }, [taskDiscovery]);

  const selectedModelDetails = useMemo(() => {
    if (!activeAnalysis || !selectedModelName) return null;
    return activeAnalysis.candidate_models.find(m => m.model_name === selectedModelName) || activeAnalysis.candidate_models[0];
  }, [activeAnalysis, selectedModelName]);

  const featureSummaryCounts = useMemo(() => {
    if (!activeAnalysis) return { used: 0, excluded: 0, numeric: 0, categorical: 0 };
    const summary = activeAnalysis.feature_summary;
    const used = summary.filter(f => f.status === 'included').length;
    const excluded = summary.filter(f => f.status === 'excluded').length;
    const numeric = summary.filter(f => f.role.includes('numeric') || f.role.includes('measure')).length;
    const categorical = summary.filter(f => f.role.includes('category') || f.role.includes('dimension')).length;
    return { used, excluded, numeric, categorical };
  }, [activeAnalysis]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-sm font-medium text-slate-300 tracking-widest uppercase">Initializing Predictive Command Center...</p>
      </div>
    );
  }

  if (error && !taskDiscovery) {
    return (
      <div className="border border-rose-800/60 bg-rose-950/20 p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white">Initialization Error</h3>
            <p className="text-xs text-rose-300 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-8 transition-opacity duration-700 ease-in-out ${animatedLoad ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* 01 - ML COMMAND HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight uppercase flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-cyan-400" />
            Predictive Analytics
          </h1>
          <p className="text-sm text-slate-400 font-medium">AI-powered prediction, model evaluation and feature intelligence.</p>
        </div>
        
        {activeAnalysis && (
          <div className="flex bg-slate-900/60 border border-slate-800 rounded-lg p-3 gap-6 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase">Dataset</span>
              <span className="text-slate-200 font-bold">{datasetId.substring(0, 8)}...</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase">Rows</span>
              <span className="text-slate-200 font-bold">{activeAnalysis.training_row_count + activeAnalysis.test_row_count}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase">Target</span>
              <span className="text-cyan-400 font-bold">{activeAnalysis.target_column || 'N/A'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase">Task Type</span>
              <span className="text-purple-400 font-bold">{activeAnalysis.task_type.replace(/_/g, ' ')}</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-sm text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* DISCOVERED TASKS CONTROLS (Compact) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="text-xs text-slate-500 uppercase font-bold block mb-1">ML TASK</span>
              <button 
                onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
                className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-4 py-2 rounded-lg text-sm text-white hover:border-cyan-500 transition-colors"
              >
                {selectedTask?.task_type.replace(/_/g, ' ') || 'Select Task'}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {isTaskDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                  {availableTaskTypes.map(t => (
                    <button
                      key={t}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white capitalize"
                      onClick={() => {
                        const newTask = taskDiscovery?.candidate_tasks.find(c => c.task_type === t);
                        if (newTask) setSelectedTask(newTask);
                        setIsTaskDropdownOpen(false);
                      }}
                    >
                      {t.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <span className="text-xs text-slate-500 uppercase font-bold block mb-1">TARGET</span>
              <button 
                onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-4 py-2 rounded-lg text-sm text-white hover:border-cyan-500 transition-colors"
              >
                {selectedTask?.target_column || 'None'}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {isTargetDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                  {availableTargets.map(t => (
                    <button
                      key={t}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                      onClick={() => {
                        const newTask = taskDiscovery?.candidate_tasks.find(c => c.target_column === t && c.task_type === selectedTask?.task_type);
                        if (newTask) setSelectedTask(newTask);
                        setIsTargetDropdownOpen(false);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {selectedTask && (
              <div className="flex items-center gap-3 bg-emerald-950/20 border border-emerald-900/50 px-4 py-2 rounded-lg">
                <span className="text-xs text-slate-400 uppercase font-bold">SUITABILITY</span>
                <span className="text-2xl font-bold text-emerald-400 font-mono tracking-tighter">
                  {Math.round(selectedTask.suitability_score * 100)}%
                </span>
              </div>
            )}
            <button
              onClick={() => handleRunAnalysis()}
              disabled={isAnalyzing || !selectedTask}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600/90 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all shrink-0"
            >
              {isAnalyzing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Play className="w-4 h-4 fill-current" /> Analyze Task</>
              )}
            </button>
          </div>
        </div>

        {/* Selected Task Details Collapse */}
        {selectedTask && (
          <div className="pt-3 border-t border-slate-800/60">
            <button 
              onClick={() => setIsTasksExpanded(!isTasksExpanded)}
              className="text-xs font-bold text-cyan-400 uppercase flex items-center gap-1 hover:text-cyan-300 transition-colors"
            >
              {isTasksExpanded ? 'HIDE DISCOVERY DETAILS' : 'VIEW DISCOVERY DETAILS'}
              {isTasksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isTasksExpanded && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Why Selected?</h4>
                  <ul className="space-y-1.5">
                    {(isReasonsExpanded ? selectedTask.reasons : selectedTask.reasons.slice(0, 2)).map((r, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedTask.reasons.length > 2 && (
                    <button onClick={() => setIsReasonsExpanded(!isReasonsExpanded)} className="text-xs text-cyan-500 hover:text-cyan-400 font-medium">
                      {isReasonsExpanded ? 'Show Less' : `+${selectedTask.reasons.length - 2} more reasons`}
                    </button>
                  )}
                </div>
                {selectedTask.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Warnings</h4>
                    <ul className="space-y-1.5">
                      {selectedTask.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activeAnalysis && selectedModelDetails && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out space-y-8">
          
          {/* 02 - MODEL / TASK SUMMARY & 03 - PERFORMANCE SIGNAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Main Summary */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-700/80 rounded-2xl p-6 relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-cyan-500/5 opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10 space-y-6">
                <div className="uppercase tracking-widest text-[10px] font-bold text-purple-400 mb-2">
                  {activeAnalysis.task_type.replace(/_/g, ' ')}
                </div>
                
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Target</div>
                  <div className="text-3xl font-extrabold text-white tracking-tight break-words">
                    {activeAnalysis.target_column || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Selected Model</div>
                  <div className="text-2xl font-bold text-cyan-300">
                    {selectedModelDetails.model_name}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Model Status: Ready</span>
                </div>
              </div>
            </div>

            {/* Performance Signal Strip */}
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(selectedModelDetails.metrics)
                .filter(([_, v]) => v !== null && v !== undefined)
                .slice(0, 4) // Show top 4 metrics
                .map(([key, val]) => (
                  <div key={key} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-full -mr-8 -mt-8"></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 z-10">
                      {key}
                    </span>
                    <span className="text-3xl font-mono font-bold text-white z-10">
                      {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(4) : val) : val}
                    </span>
                  </div>
              ))}
            </div>
          </div>

          {/* 04 - MODEL COMPARISON */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-1">
            <button 
              onClick={() => setIsModelComparisonOpen(!isModelComparisonOpen)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-cyan-500" />
                <span className="text-sm font-bold text-white uppercase tracking-wider">Model Comparison</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">{activeAnalysis.candidate_models.length} Models Evaluated</span>
                {isModelComparisonOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </button>
            
            {isModelComparisonOpen && (
              <div className="p-5 border-t border-slate-800/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500 uppercase tracking-wider font-bold border-b border-slate-800">
                      <tr>
                        <th className="pb-3 pr-4">Model</th>
                        <th className="pb-3 px-4">Metrics</th>
                        <th className="pb-3 px-4 text-center">Status</th>
                        <th className="pb-3 pl-4">Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {activeAnalysis.candidate_models.map((cand, i) => (
                        <tr key={i} className={`group hover:bg-slate-800/30 transition-colors ${cand.model_name === selectedModelName ? 'bg-cyan-950/10' : ''}`}>
                          <td className="py-4 pr-4 font-medium text-white flex items-center gap-2">
                            {cand.model_name}
                            {cand.is_selected && <StarIcon className="w-4 h-4 text-amber-400" />}
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-300">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(cand.metrics)
                                .filter(([_, v]) => v !== null && v !== undefined)
                                .slice(0, 3)
                                .map(([k, v]) => (
                                  <span key={k} className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                    <span className="text-slate-500 mr-1">{k.toUpperCase()}</span>
                                    <span className="text-white">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {cand.model_name === selectedModelName ? (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase tracking-widest">
                                Displayed
                              </span>
                            ) : cand.is_selected ? (
                               <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                                Winner
                              </span>
                            ) : (
                              <button 
                                onClick={() => setSelectedModelName(cand.model_name)}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors uppercase tracking-widest"
                              >
                                View
                              </button>
                            )}
                          </td>
                          <td className="py-4 pl-4 text-xs text-slate-400 leading-relaxed max-w-xs">
                            {cand.selection_reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 05 - FEATURE INTELLIGENCE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                Feature Intelligence
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold font-mono text-white mb-1">{featureSummaryCounts.used}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Features Used</div>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold font-mono text-slate-400 mb-1">{featureSummaryCounts.excluded}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Excluded</div>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold font-mono text-sky-400 mb-1">{featureSummaryCounts.numeric}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Numeric</div>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold font-mono text-amber-400 mb-1">{featureSummaryCounts.categorical}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Categorical</div>
              </div>
            </div>

            <div>
              <button 
                onClick={() => setIsFeatureDetailsOpen(!isFeatureDetailsOpen)}
                className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider hover:text-cyan-300 transition-colors"
              >
                {isFeatureDetailsOpen ? 'HIDE FEATURE DETAILS' : 'VIEW FEATURE DETAILS'}
                {isFeatureDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {isFeatureDetailsOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                  {activeAnalysis.feature_summary.map((feat) => (
                    <div key={feat.name} className={`p-3 rounded-lg border flex flex-col gap-2 ${
                        feat.status === 'included' ? 'bg-slate-950/80 border-slate-700/50' : 'bg-slate-950/40 border-slate-800/50 opacity-70'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-white truncate pr-2">{feat.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border ${
                          feat.status === 'included' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {feat.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">{feat.role}</span>
                        <span className="text-slate-500 truncate">{feat.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 06 - PREDICTION ENGINE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400 fill-current" />
                  Run Prediction
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Using model: <span className="text-cyan-300 font-mono">{selectedModelDetails.model_name}</span>
                </p>
              </div>
              
              <button
                onClick={() => setIsPredictionInputsOpen(!isPredictionInputsOpen)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-lg text-sm text-white transition-colors"
              >
                <ListFilter className="w-4 h-4" />
                {isPredictionInputsOpen ? 'Close Inputs' : 'Configure Inputs'}
                {isPredictionInputsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isPredictionInputsOpen && (
              <form onSubmit={handlePredictSubmit} className="relative z-10 space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
                  {activeAnalysis.feature_columns.map((feat) => {
                    const featureInfo = activeAnalysis.feature_summary.find(f => f.name === feat);
                    const isCategorical = featureInfo?.role.includes('categor') || featureInfo?.role.includes('dimension');
                    const isNumeric = featureInfo?.role.includes('numeric') || featureInfo?.role.includes('measure');
                    
                    return (
                      <div key={feat} className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 font-mono block truncate" title={feat}>
                          {feat}
                        </label>
                        <input
                          type={isNumeric ? 'number' : 'text'}
                          step={isNumeric ? 'any' : undefined}
                          placeholder={isCategorical ? 'Enter category...' : isNumeric ? '0.00' : 'Enter value...'}
                          value={predictionInputs[feat] || ''}
                          onChange={(e) =>
                            setPredictionInputs({ ...predictionInputs, [feat]: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                   <button
                    type="submit"
                    disabled={isPredicting || activeAnalysis.feature_columns.length === 0}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    {isPredicting ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> EXECUTING...</>
                    ) : (
                      <><Play className="w-4 h-4 fill-current" /> EXECUTE PREDICTION</>
                    )}
                  </button>
                </div>
              </form>
            )}

            {predictionError && (
              <div className="relative z-10 p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-sm text-rose-300">
                {predictionError}
              </div>
            )}

            {predictionResult && (
              <div className="relative z-10 mt-6 bg-slate-950 border border-cyan-900/50 rounded-xl p-6 space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                <div className="text-xs font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  PREDICTION RESULT
                </div>
                
                <div className="py-4">
                  {predictionResult.predictions.map((p, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-sm text-slate-400 mb-2 uppercase font-bold">Predicted {activeAnalysis.target_column || 'Outcome'}</span>
                      <span className="text-5xl md:text-6xl font-extrabold text-white font-mono tracking-tighter">
                        {typeof p === 'number' ? p.toLocaleString(undefined, {maximumFractionDigits: 4}) : String(p)}
                      </span>
                    </div>
                  ))}
                </div>

                {predictionResult.probabilities && predictionResult.probabilities.length > 0 && (
                  <div className="pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Class Probabilities</div>
                    <div className="space-y-3 max-w-md">
                      {predictionResult.probabilities.map((probObj, recordIdx) => (
                        <div key={recordIdx} className="space-y-2">
                          {Object.entries(probObj).sort((a,b)=>b[1]-a[1]).map(([cls, probVal]) => {
                            const pct = (probVal * 100).toFixed(1);
                            return (
                              <div key={cls} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-300 font-medium">{cls}</span>
                                  <span className="text-cyan-400 font-mono font-bold">{pct}%</span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-cyan-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.max(Number(pct), 1)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 07 - NEXT ACTION */}
          {onNavigate && (
            <div className="flex justify-end pt-8 pb-12">
              <button
                onClick={() => onNavigate('recommendations')}
                className="group relative flex items-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-full overflow-hidden shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                <span className="font-sans font-extrabold text-sm tracking-widest uppercase relative z-10 flex items-center gap-2">
                  CONTINUE TO RECOMMENDATIONS <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// Helper for Star Icon
const StarIcon = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default MLInsightsDashboard;
