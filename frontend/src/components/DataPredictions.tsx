import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMLTasks, runMLAnalysis, fetchMLAnalyses, runMLPrediction } from '../services/api';
import { MLTaskDiscoveryResponse, MLTaskCandidate, MLAnalysisResponse, PredictionResponse } from '../types';
import { 
  BrainCircuit,
  AlertTriangle, 
  Play, 
  Layers, 
  BarChart3, 
  RefreshCw, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Target,
  ListFilter
} from 'lucide-react';

interface DataPredictionsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataPredictions: React.FC<DataPredictionsProps> = ({ processedDatasetId, setCurrentStage }) => {
  const [taskDiscovery, setTaskDiscovery] = useState<MLTaskDiscoveryResponse | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<MLAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected state
  const [selectedTask, setSelectedTask] = useState<MLTaskCandidate | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);

  // Dropdown states
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [isModelComparisonOpen, setIsModelComparisonOpen] = useState(false);
  const [isPredictionInputsOpen, setIsPredictionInputsOpen] = useState(false);

  // Prediction state
  const [predictionInputs, setPredictionInputs] = useState<Record<string, string>>({});
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResponse | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const loadMLData = useCallback(async () => {
    if (!processedDatasetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [tasksRes, analysesRes] = await Promise.all([
        fetchMLTasks(processedDatasetId),
        fetchMLAnalyses(processedDatasetId),
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
      setErrorMsg(err.message || 'Predictive model is not available yet.');
    } finally {
      setIsLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadMLData();
  }, [loadMLData]);

  const handleRunAnalysis = async () => {
    if (!processedDatasetId || !selectedTask) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const response = await runMLAnalysis(
        processedDatasetId,
        selectedTask.task_type,
        selectedTask.target_column || undefined
      );
      setActiveAnalysis(response);
      const selectedModel = response.candidate_models.find(m => m.is_selected) || response.candidate_models[0];
      if (selectedModel) {
        setSelectedModelName(selectedModel.model_name);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute ML task analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePredictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processedDatasetId || !activeAnalysis) return;

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

      const res = await runMLPrediction(processedDatasetId, activeAnalysis.id, [parsedInput]);
      setPredictionResult(res);
    } catch (err: any) {
      setPredictionError(err.message || 'Prediction failed.');
    } finally {
      setIsPredicting(false);
    }
  };

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

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Predictions require a processed dataset artifact from the Analysis stage.</p>
        <button 
          onClick={() => setCurrentStage('INSIGHTS')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO INSIGHTS
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-3xl mx-auto space-y-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
          <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin" />
        </div>
        <div>
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Initializing Models</h3>
          <p className="text-slate-400 font-mono text-xs">Loading predictive commands and feature intelligence.</p>
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  } as any;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1750px] mx-auto space-y-12 pb-24"
    >
      {/* 01 — HEADER */}
      <motion.section variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/60 pb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">PREDICTIONS</h1>
          <p className="text-slate-400 font-mono text-sm max-w-xl">
            Model-based forecasts generated from the processed dataset.
          </p>
        </div>
        <div className="self-start md:self-auto flex flex-col items-end gap-3">
          <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
             <div className="flex flex-col text-right">
               <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Source</span>
               <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Processed Dataset</span>
             </div>
             <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={processedDatasetId}>
               {processedDatasetId}
             </div>
          </div>
          <button 
            onClick={() => setCurrentStage('INSIGHTS')}
            className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
          >
            ← BACK TO INSIGHTS
          </button>
        </div>
      </motion.section>

      {errorMsg && !taskDiscovery && (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-900/50 border border-rose-500/20 rounded-3xl p-8">
          <AlertTriangle className="w-8 h-8 text-rose-400 mb-4" />
          <p className="text-slate-300 font-mono text-sm">{errorMsg}</p>
        </div>
      )}

      {/* 02 — MODEL GENERATION / TASK SELECTION */}
      {taskDiscovery && (
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-sm">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-cyan-400" /> Model Configuration
          </h2>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-1">ML TASK</span>
                <button 
                  onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
                  className="flex items-center gap-3 bg-slate-950 border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-mono text-white hover:border-cyan-500 transition-colors"
                >
                  {selectedTask?.task_type.replace(/_/g, ' ') || 'Select Task'}
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                {isTaskDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-2">
                    {availableTaskTypes.map(t => (
                      <button
                        key={t}
                        className="w-full text-left px-4 py-2 text-sm text-slate-300 font-mono hover:bg-slate-800 hover:text-white capitalize transition-colors"
                        onClick={() => {
                          const newTask = taskDiscovery.candidate_tasks.find(c => c.task_type === t);
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
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-1">TARGET</span>
                <button 
                  onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                  className="flex items-center gap-3 bg-slate-950 border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-mono text-white hover:border-cyan-500 transition-colors"
                >
                  {selectedTask?.target_column || 'None'}
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                {isTargetDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 py-2 max-h-60 overflow-y-auto">
                    {availableTargets.map(t => (
                      <button
                        key={t}
                        className="w-full text-left px-4 py-2 text-sm text-slate-300 font-mono hover:bg-slate-800 hover:text-white transition-colors"
                        onClick={() => {
                          const newTask = taskDiscovery.candidate_tasks.find(c => c.target_column === t && c.task_type === selectedTask?.task_type);
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
            
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !selectedTask}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-cyan-600/90 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs uppercase tracking-widest font-bold transition-all shrink-0"
            >
              {isAnalyzing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> TRAINING MODEL...</>
              ) : (
                <><Play className="w-4 h-4 fill-current" /> TRAIN MODEL</>
              )}
            </button>
          </div>
          
          {errorMsg && activeAnalysis === null && (
            <div className="mt-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-sm text-rose-300 font-mono">
              {errorMsg}
            </div>
          )}
        </motion.section>
      )}

      {/* 03 — MODEL READINESS & METRICS */}
      {activeAnalysis && selectedModelDetails && (
        <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-50"></div>
            <div className="relative z-10 space-y-6">
              <div className="uppercase tracking-widest text-[10px] font-bold text-cyan-400 mb-2 border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 rounded-full w-fit">
                {activeAnalysis.task_type.replace(/_/g, ' ')}
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Target Variable</div>
                <div className="text-2xl font-sans text-white tracking-tight break-words">
                  {activeAnalysis.target_column || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Selected Algorithm</div>
                <div className="text-lg font-mono font-bold text-purple-300">
                  {selectedModelDetails.model_name}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4 border-t border-slate-800/80">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Model Status: Ready</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(selectedModelDetails.metrics)
              .filter(([_, v]) => v !== null && v !== undefined)
              .slice(0, 4)
              .map(([key, val]) => (
                <div key={key} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col justify-center backdrop-blur-sm relative overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 z-10">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-3xl font-mono font-bold text-white z-10 tracking-tight">
                    {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(4) : val) : val}
                  </span>
                </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* 04 — FEATURE IMPORTANCE & COMPARISON */}
      {activeAnalysis && (
        <motion.section variants={itemVariants} className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-2">
            <button 
              onClick={() => setIsModelComparisonOpen(!isModelComparisonOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">Evaluated Models</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span className="text-xs font-mono">{activeAnalysis.candidate_models.length} Candidates</span>
                {isModelComparisonOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>
            
            <AnimatePresence>
              {isModelComparisonOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 border-t border-slate-800/60 mt-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-[10px] text-slate-500 uppercase tracking-widest font-bold border-b border-slate-800">
                          <tr>
                            <th className="pb-3 pr-4">Algorithm</th>
                            <th className="pb-3 px-4">Evaluation Metrics</th>
                            <th className="pb-3 px-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {activeAnalysis.candidate_models.map((cand, i) => (
                            <tr key={i} className={`hover:bg-slate-800/20 transition-colors ${cand.model_name === selectedModelName ? 'bg-cyan-950/10' : ''}`}>
                              <td className="py-4 pr-4 font-mono font-bold text-white flex items-center gap-2">
                                {cand.model_name}
                              </td>
                              <td className="py-4 px-4 font-mono text-xs text-slate-300">
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(cand.metrics).filter(([_,v])=>v!==null).slice(0,3).map(([k, v]) => (
                                      <span key={k} className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 flex items-center gap-1.5">
                                        <span className="text-slate-500 uppercase">{k}</span>
                                        <span className="text-white">{typeof v === 'number' ? v.toFixed(3) : v}</span>
                                      </span>
                                    ))}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                {cand.model_name === selectedModelName ? (
                                  <span className="px-3 py-1 rounded-full text-[9px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">
                                    Active
                                  </span>
                                ) : (
                                  <button 
                                    onClick={() => setSelectedModelName(cand.model_name)}
                                    className="px-3 py-1 rounded-full text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors uppercase tracking-widest"
                                  >
                                    Select
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
            <h3 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" /> Feature Set ({featureSummaryCounts.used})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800/80 text-center">
                <div className="text-3xl font-bold font-mono text-white tracking-tight">{featureSummaryCounts.used}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Included</div>
              </div>
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800/80 text-center">
                <div className="text-3xl font-bold font-mono text-slate-400 tracking-tight">{featureSummaryCounts.excluded}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Excluded</div>
              </div>
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800/80 text-center">
                <div className="text-3xl font-bold font-mono text-sky-400 tracking-tight">{featureSummaryCounts.numeric}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Numeric</div>
              </div>
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800/80 text-center">
                <div className="text-3xl font-bold font-mono text-amber-400 tracking-tight">{featureSummaryCounts.categorical}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Categorical</div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* 05 — PREDICTION WORKSPACE */}
      {activeAnalysis && selectedModelDetails && (
        <motion.section variants={itemVariants} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/60 pb-6">
            <div>
              <h3 className="text-xl font-sans text-white uppercase tracking-tight flex items-center gap-3 mb-1">
                <Zap className="w-6 h-6 text-cyan-400 fill-current" />
                Prediction Workspace
              </h3>
              <p className="text-sm text-slate-400 font-mono">
                Model: <span className="text-cyan-300">{selectedModelDetails.model_name}</span>
              </p>
            </div>
            <button
              onClick={() => setIsPredictionInputsOpen(!isPredictionInputsOpen)}
              className="flex items-center gap-2 bg-slate-950 border border-slate-700 hover:border-cyan-500 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-colors"
            >
              <ListFilter className="w-4 h-4" />
              {isPredictionInputsOpen ? 'Close Inputs' : 'Configure Inputs'}
            </button>
          </div>

          <AnimatePresence>
            {isPredictionInputsOpen && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handlePredictSubmit} 
                className="relative z-10 space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                  {activeAnalysis.feature_columns.map((feat) => {
                    const featureInfo = activeAnalysis.feature_summary.find(f => f.name === feat);
                    const isCategorical = featureInfo?.role.includes('categor') || featureInfo?.role.includes('dimension');
                    const isNumeric = featureInfo?.role.includes('numeric') || featureInfo?.role.includes('measure');
                    
                    return (
                      <div key={feat} className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block truncate" title={feat}>
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                   <button
                    type="submit"
                    disabled={isPredicting || activeAnalysis.feature_columns.length === 0}
                    className="flex items-center gap-3 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    {isPredicting ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> EXECUTING...</>
                    ) : (
                      <><Play className="w-4 h-4 fill-current" /> GENERATE FORECAST</>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {predictionError && (
            <div className="relative z-10 p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-300 font-mono flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" /> {predictionError}
            </div>
          )}

          <AnimatePresence>
            {predictionResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 mt-8 bg-slate-950 border border-cyan-900/40 rounded-3xl p-8 space-y-6 shadow-[0_0_40px_rgba(34,211,238,0.05)]"
              >
                <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-2 border border-cyan-500/20 bg-cyan-500/10 w-fit px-3 py-1.5 rounded-full">
                  <Target className="w-3.5 h-3.5" />
                  PREDICTION OUTPUT
                </div>
                
                <div className="py-2">
                  {predictionResult.predictions.map((p, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-xs text-slate-500 mb-2 uppercase tracking-widest font-bold">Predicted: {activeAnalysis.target_column || 'Outcome'}</span>
                      <span className="text-5xl md:text-7xl font-sans font-light text-white tracking-tighter">
                        {typeof p === 'number' ? p.toLocaleString(undefined, {maximumFractionDigits: 4}) : String(p)}
                      </span>
                    </div>
                  ))}
                </div>

                {predictionResult.probabilities && predictionResult.probabilities.length > 0 && (
                  <div className="pt-6 border-t border-slate-800/80 space-y-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class Probability Distribution</div>
                    <div className="space-y-4 max-w-2xl">
                      {predictionResult.probabilities.map((probObj, recordIdx) => (
                        <div key={recordIdx} className="space-y-3">
                          {Object.entries(probObj).sort((a,b)=>b[1]-a[1]).map(([cls, probVal]) => {
                            const pct = (probVal * 100).toFixed(1);
                            return (
                              <div key={cls} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-300 font-bold uppercase tracking-wider">{cls}</span>
                                  <span className="text-cyan-400 font-mono font-bold">{pct}%</span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(Number(pct), 1)}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className="bg-cyan-500 h-2 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                  ></motion.div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}

      {/* 06 — CONTINUE NAVIGATION */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-slate-800/60 mt-12">
        <button
          onClick={() => setCurrentStage('OPTIMIZATION')}
          disabled={!activeAnalysis}
          className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          CONTINUE TO OPTIMIZATION
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  );
};
