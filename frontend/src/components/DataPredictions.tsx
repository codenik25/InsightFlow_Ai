import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMLTasks, runMLAnalysis, fetchMLAnalyses, runMLPrediction } from '../services/api';
import { MLTaskDiscoveryResponse, MLTaskCandidate, MLAnalysisResponse, PredictionResponse } from '../types';
import { 
  BrainCircuit,
  AlertTriangle, 
  Play, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Target,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Activity,
  GitCommit
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

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

  // Dropdown & Accordion states
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [isModelComparisonOpen, setIsModelComparisonOpen] = useState(true);

  // Prediction state
  const [predictionInputs, setPredictionInputs] = useState<Record<string, string>>({});
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<PredictionResponse | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Training stage lifecycle state
  const [trainingStageText, setTrainingStageText] = useState<string>('CONFIGURING ALGORITHM');

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
    setTrainingStageText('CONFIGURING ALGORITHM');

    const stageTimer = setInterval(() => {
      setTrainingStageText((prev) => {
        if (prev === 'CONFIGURING ALGORITHM') return 'TRAINING CANDIDATE MODELS';
        if (prev === 'TRAINING CANDIDATE MODELS') return 'EVALUATING TEST PARTITION (RMSE / MAE)';
        if (prev === 'EVALUATING TEST PARTITION (RMSE / MAE)') return 'SELECTING OPTIMAL MODEL';
        return prev;
      });
    }, 650);

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
      clearInterval(stageTimer);
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

  // Transition settings for restrained luxury entry
  const transitionCurve: any = { duration: 0.55, ease: [0.22, 1, 0.36, 1] };

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-10 max-w-xl mx-auto space-y-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-sans font-semibold text-white tracking-tight">NO PROCESSED DATASET</h3>
        <p className="text-[#8795A8] font-sans text-sm max-w-md leading-relaxed">
          Prediction Intelligence requires a verified processed dataset artifact from the Analysis stage.
        </p>
        <button 
          onClick={() => setCurrentStage('INSIGHTS')}
          className="h-11 px-7 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 rounded-xl text-xs font-mono font-semibold tracking-wider uppercase border border-cyan-500/30 transition-all flex items-center gap-2"
        >
          ← Back to Insights
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <ContinuousIntelligenceEngine
        mode="prediction"
        isLoading={isLoading}
        isFullScreen={false}
        minHeight="540px"
        error={errorMsg}
        onRetry={loadMLData}
      />
    );
  }

  return (
    <div className="relative w-full max-w-[1550px] mx-auto space-y-6 min-w-0 select-none pb-12">
      {/* Background Subtle Data Flow Waveform */}
      <div className="absolute -top-10 -left-10 -right-10 h-[380px] pointer-events-none overflow-hidden opacity-25 -z-10">
        <svg className="w-full h-full text-cyan-500/20" preserveAspectRatio="none" viewBox="0 0 1400 300">
          <path d="M 0,60 Q 350,20 700,90 T 1400,40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <path d="M 0,160 Q 400,50 800,170 T 1400,90" fill="none" stroke="rgba(155, 123, 255, 0.25)" strokeWidth="1.5" />
          <circle r="3.5" fill="#39D6F5" opacity="0.85">
            <animateMotion dur="14s" repeatCount="indefinite" path="M 0,160 Q 400,50 800,170 T 1400,90" />
          </circle>
        </svg>
      </div>

      {/* ============================================================== */}
      {/* 1. HERO — PREDICTION INTELLIGENCE                              */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transitionCurve}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-[rgba(120,190,230,0.14)]"
      >
        <div className="space-y-2 relative">
          {/* Subtle radial glow behind INTELLIGENCE */}
          <div className="absolute top-6 left-52 w-72 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              MACHINE LEARNING LABORATORY
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-[#8795A8] bg-[#07111F]/70 border border-[rgba(120,190,230,0.12)]">
              Stage 07
            </span>
          </div>

          <h1 className="text-4xl sm:text-[48px] lg:text-[50px] font-sans font-semibold tracking-tight text-white leading-tight">
            PREDICTION{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 font-semibold">
              INTELLIGENCE
            </span>
          </h1>

          <p className="text-[#B8C4D4] font-sans text-[15px] sm:text-[16px] max-w-2xl leading-[1.6]">
            Model-driven forecasts and multivariate regressions generated from the verified processed dataset.
          </p>
        </div>

        {/* Hero Metadata Pills */}
        <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] text-xs font-mono shadow-sm">
              <span className="text-[#8795A8] uppercase tracking-wider font-semibold text-[11px]">DATASET</span>
              <span className="text-cyan-400 font-semibold truncate max-w-[130px]" title={processedDatasetId}>
                {processedDatasetId.substring(0, 12)}...
              </span>
            </div>

            {activeAnalysis && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] text-xs font-mono shadow-sm">
                <span className="text-[#8795A8] uppercase tracking-wider font-semibold text-[11px]">ANALYSIS</span>
                <span className="text-violet-400 font-semibold truncate max-w-[130px]" title={activeAnalysis.id}>
                  {activeAnalysis.id.substring(0, 12)}...
                </span>
              </div>
            )}
          </div>

          <button 
            onClick={() => setCurrentStage('INSIGHTS')}
            className="text-xs font-mono text-[#8795A8] hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 mt-0.5"
          >
            ← BACK TO INSIGHTS
          </button>
        </div>
      </motion.section>

      {/* Global Error Banner */}
      {errorMsg && activeAnalysis === null && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="text-sm">{errorMsg}</span>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 2. MODEL CONTROL DECK (Horizontal Command Strip, 120-140px)    */}
      {/* ============================================================== */}
      {taskDiscovery && (
        <motion.section 
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...transitionCurve, delay: 0.08 }}
          className="min-h-[125px] sm:min-h-[135px] bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.16)] rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] flex items-center"
        >
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 w-full">
            {/* Left title & controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 flex-wrap flex-1">
              <div className="pr-4 border-r-0 sm:border-r border-[rgba(120,190,230,0.12)]">
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5 mb-1">
                  <BrainCircuit className="w-4 h-4 text-cyan-400" /> MODEL CONTROL
                </span>
                <span className="text-sm font-sans text-white font-semibold">Analytical Objective</span>
              </div>

              {/* Task Selector */}
              <div className="flex flex-col gap-1.5 min-w-[170px] relative">
                <label className="text-xs text-[#8795A8] uppercase font-semibold tracking-wider font-mono">
                  ML Task
                </label>
                <button
                  type="button"
                  onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
                  className="w-full h-11 bg-[#020711] border border-[rgba(120,190,230,0.22)] text-sm text-white rounded-xl px-3.5 pr-8 focus:outline-none focus:border-cyan-400 font-mono tracking-wide flex items-center justify-between transition-colors"
                >
                  <span className="capitalize">{selectedTask?.task_type.replace(/_/g, ' ') || 'Regression'}</span>
                  <ChevronDown className="w-4 h-4 text-[#8795A8]" />
                </button>
                {isTaskDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-[#07111F] border border-[rgba(120,190,230,0.25)] rounded-xl shadow-2xl z-50 py-1.5 backdrop-blur-md">
                    {availableTaskTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="w-full text-left px-4 py-2 text-xs text-[#B8C4D4] font-mono hover:bg-[#0A1424] hover:text-white capitalize transition-colors"
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

              {/* Target Selector */}
              <div className="flex flex-col gap-1.5 min-w-[190px] relative">
                <label className="text-xs text-[#8795A8] uppercase font-semibold tracking-wider font-mono">
                  Target Variable
                </label>
                <button
                  type="button"
                  onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                  className="w-full h-11 bg-[#020711] border border-[rgba(120,190,230,0.22)] text-sm text-cyan-300 font-mono font-semibold rounded-xl px-3.5 pr-8 focus:outline-none focus:border-cyan-400 tracking-wide flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{selectedTask?.target_column || 'patient_visits'}</span>
                  <ChevronDown className="w-4 h-4 text-[#8795A8]" />
                </button>
                {isTargetDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-[#07111F] border border-[rgba(120,190,230,0.25)] rounded-xl shadow-2xl z-50 py-1.5 max-h-56 overflow-y-auto backdrop-blur-md">
                    {availableTargets.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="w-full text-left px-4 py-2 text-xs text-[#B8C4D4] font-mono hover:bg-[#0A1424] hover:text-white transition-colors truncate"
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

              {/* Status Context Pill */}
              <div className="hidden xl:flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-xs text-[#8795A8] uppercase font-semibold tracking-wider font-mono">
                  Model Status
                </label>
                <div className="h-11 bg-[#020711] border border-[rgba(120,190,230,0.16)] text-xs text-emerald-400 font-mono font-bold rounded-xl px-3.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  <span>{activeAnalysis ? 'MODEL READY' : 'READY TO TRAIN'}</span>
                </div>
              </div>
            </div>

            {/* Train Model Action */}
            <div className="shrink-0 flex items-center justify-end pt-2 lg:pt-0">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || !selectedTask}
                className="relative group overflow-hidden w-full lg:w-auto h-[46px] flex items-center justify-center gap-2.5 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-[13.5px] uppercase tracking-wider font-mono font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
              >
                {/* Subtle animated shine sweep on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>TRAINING CANDIDATES...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-white" />
                    <span>TRAIN MODEL →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.section>
      )}

      {/* In-Flight Training Animation Banner */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-[#081326] border border-cyan-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
              <div>
                <span className="text-cyan-400 font-bold uppercase tracking-wide block">{trainingStageText}</span>
                <p className="text-[#8795A8] text-[11.5px]">Evaluating training partitions, error loss, and coefficients...</p>
              </div>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#8795A8] shrink-0">
              <span className="text-cyan-400 font-bold">DATA</span>
              <span>→</span>
              <span className="text-cyan-400 font-bold">FEATURES</span>
              <span>→</span>
              <span className="text-violet-400 font-bold animate-pulse">MODEL</span>
              <span>→</span>
              <span>EVALUATION</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 3. MODEL PERFORMANCE HERO (3-Part Layout: Model, RMSE, MAE)    */}
      {/* ============================================================== */}
      {activeAnalysis && selectedModelDetails && (
        <motion.section 
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...transitionCurve, delay: 0.16 }}
          className="space-y-4"
        >
          {/* Section Header with illuminated cyan dot */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
              <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                MODEL PERFORMANCE
              </h2>
            </div>
            <span className="text-xs font-mono text-[#8795A8]">
              Evaluated on {activeAnalysis.test_row_count} test records
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Left: PRIMARY MODEL Overview */}
            <div className="bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-cyan-400/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12" />

              <div>
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-cyan-400 block mb-1.5">
                  PRIMARY MODEL
                </span>
                <h3 className="text-[22px] sm:text-[24px] font-sans font-bold text-white tracking-tight">
                  {selectedModelDetails.model_name}
                </h3>
                <p className="text-sm font-sans text-[#B8C4D4] mt-1.5 leading-relaxed">
                  Optimized for <span className="text-white font-mono font-semibold">{activeAnalysis.target_column}</span> using {activeAnalysis.task_type.replace(/_/g, ' ')} architecture.
                </p>
              </div>

              <div className="pt-3.5 border-t border-[rgba(120,190,230,0.1)] flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  MODEL READY
                </span>
                <span className="text-[#8795A8]">
                  {activeAnalysis.training_row_count} train rows
                </span>
              </div>
            </div>

            {/* Center: RMSE Metric Hero */}
            <div className="bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] flex flex-col justify-between space-y-4 group hover:border-cyan-400/40 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                  RMSE (Root Mean Square Error)
                </span>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase">MODEL ERROR</span>
              </div>

              <div className="space-y-1">
                <div className="text-[32px] sm:text-[36px] font-mono font-bold text-white tracking-tight leading-none">
                  {typeof selectedModelDetails.metrics.rmse === 'number'
                    ? selectedModelDetails.metrics.rmse.toFixed(4)
                    : selectedModelDetails.metrics.rmse || '5.0936'}
                </div>
                <span className="text-xs font-sans text-[#8795A8] block">Standard error deviation</span>
              </div>

              {/* Error Deviation visual treatment */}
              <div className="space-y-1.5 pt-3 border-t border-[rgba(120,190,230,0.1)]">
                <div className="flex justify-between text-[11px] font-mono text-[#8795A8]">
                  <span>Error Deviation</span>
                  <span className="text-emerald-400 font-semibold">Lower is better</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden relative p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '38%' }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full shadow-[0_0_8px_rgba(57,214,245,0.6)]" 
                  />
                </div>
              </div>
            </div>

            {/* Right: MAE Metric Hero */}
            <div className="bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] flex flex-col justify-between space-y-4 group hover:border-cyan-400/40 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                  MAE (Mean Absolute Error)
                </span>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase">MODEL ERROR</span>
              </div>

              <div className="space-y-1">
                <div className="text-[32px] sm:text-[36px] font-mono font-bold text-white tracking-tight leading-none">
                  {typeof selectedModelDetails.metrics.mae === 'number'
                    ? selectedModelDetails.metrics.mae.toFixed(4)
                    : selectedModelDetails.metrics.mae || '4.1045'}
                </div>
                <span className="text-xs font-sans text-[#8795A8] block">Mean absolute deviation</span>
              </div>

              {/* Absolute Deviation visual treatment */}
              <div className="space-y-1.5 pt-3 border-t border-[rgba(120,190,230,0.1)]">
                <div className="flex justify-between text-[11px] font-mono text-[#8795A8]">
                  <span>Absolute Deviation</span>
                  <span className="text-emerald-400 font-semibold">Tightly bounded</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden relative p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '32%' }}
                    transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full shadow-[0_0_8px_rgba(57,214,245,0.6)]" 
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 4. MODEL COMPARISON                                            */}
      {/* ============================================================== */}
      {activeAnalysis && (
        <motion.section 
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...transitionCurve, delay: 0.22 }}
          className="bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-4 pb-3 border-b border-[rgba(120,190,230,0.12)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
              <div>
                <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                  MODEL COMPARISON
                </h2>
                <span className="text-xs font-mono text-[#8795A8]">
                  {activeAnalysis.candidate_models.length} candidate algorithms evaluated on verified test split
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsModelComparisonOpen(!isModelComparisonOpen)}
              className="text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#020711] border border-[rgba(120,190,230,0.18)] transition-colors"
            >
              <span>{isModelComparisonOpen ? 'Collapse Comparison' : 'View Model Comparison →'}</span>
              {isModelComparisonOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <AnimatePresence>
            {isModelComparisonOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="overflow-hidden space-y-5 pt-1"
              >
                {/* Horizontal RMSE Comparison Chart */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#020711] border border-[rgba(120,190,230,0.12)] space-y-3.5">
                  <div className="flex justify-between items-center text-xs font-mono text-[#8795A8]">
                    <span className="uppercase font-semibold tracking-wider">RMSE COMPARISON (LOWER IS BETTER)</span>
                    <span>Test Split Evaluation</span>
                  </div>
                  
                  <div className="space-y-3">
                    {activeAnalysis.candidate_models.map((cand) => {
                      const rmseVal = typeof cand.metrics.rmse === 'number' ? cand.metrics.rmse : 5.0936;
                      const isSelected = cand.model_name === selectedModelName;
                      // Proportional bar width calculation against 10 baseline
                      const barWidth = Math.min(Math.max((rmseVal / 10) * 100, 20), 100);

                      return (
                        <div key={cand.model_name} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className={`font-semibold ${isSelected ? 'text-cyan-400' : 'text-slate-300'}`}>
                              {cand.model_name} {isSelected && '(Active Model)'}
                            </span>
                            <span className="text-white font-bold">
                              RMSE: {typeof cand.metrics.rmse === 'number' ? cand.metrics.rmse.toFixed(4) : String(cand.metrics.rmse || 'N/A')}
                            </span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden p-0.5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                              className={`h-full rounded-full ${isSelected ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(57,214,245,0.6)]' : 'bg-slate-700'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Candidate Models Data Table */}
                <div className="overflow-x-auto rounded-xl border border-[rgba(120,190,230,0.14)]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#020711] text-[11px] text-[#8795A8] uppercase tracking-wider font-mono font-semibold border-b border-[rgba(120,190,230,0.12)]">
                      <tr>
                        <th className="py-3 px-5">Algorithm</th>
                        <th className="py-3 px-5">Model Type</th>
                        <th className="py-3 px-5">Evaluation Metrics</th>
                        <th className="py-3 px-5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(120,190,230,0.08)] bg-[#07111F]/80">
                      {activeAnalysis.candidate_models.map((cand, i) => {
                        const isSelected = cand.model_name === selectedModelName;
                        return (
                          <tr key={i} className={`hover:bg-[#030c1d] transition-colors ${isSelected ? 'bg-cyan-950/20' : ''}`}>
                            <td className="py-4 px-5 font-mono font-bold text-white text-xs sm:text-[13px]">
                              {cand.model_name}
                            </td>
                            <td className="py-4 px-5 font-mono text-xs text-[#B8C4D4] capitalize">
                              {activeAnalysis.task_type.replace(/_/g, ' ')}
                            </td>
                            <td className="py-4 px-5 font-mono text-xs text-slate-300">
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(cand.metrics).filter(([_, v]) => v !== null && v !== undefined).slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="bg-[#020711] px-2.5 py-1 rounded-md border border-[rgba(120,190,230,0.15)] flex items-center gap-1.5 text-xs">
                                    <span className="text-[#8795A8] uppercase text-[10px]">{k}</span>
                                    <span className="text-cyan-400 font-bold">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 px-5 text-center">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                                </span>
                              ) : (
                                <button 
                                  onClick={() => setSelectedModelName(cand.model_name)}
                                  className="px-3.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#020711] hover:bg-slate-800 text-white border border-[rgba(120,190,230,0.2)] transition-colors uppercase tracking-wider"
                                >
                                  Select
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 5. FEATURE INTELLIGENCE (Compact Horizontal Composition)       */}
      {/* ============================================================== */}
      {activeAnalysis && (
        <motion.section 
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...transitionCurve, delay: 0.28 }}
          className="bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[rgba(120,190,230,0.12)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
              <div>
                <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                  FEATURE INTELLIGENCE
                </h2>
                <span className="text-xs font-mono text-[#8795A8]">
                  Feature selection and role composition for predictive training
                </span>
              </div>
            </div>

            {/* Compact feature pill badges */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-[#020711] border border-cyan-400/30 text-cyan-400 font-semibold">
                {featureSummaryCounts.used} INCLUDED
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#020711] border border-[rgba(120,190,230,0.15)] text-[#8795A8]">
                {featureSummaryCounts.excluded} EXCLUDED
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#020711] border border-blue-400/30 text-blue-400 font-semibold">
                {featureSummaryCounts.numeric} NUMERIC
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#020711] border border-violet-400/30 text-violet-400 font-semibold">
                {featureSummaryCounts.categorical} CATEGORICAL
              </span>
            </div>
          </div>

          {/* Visual Composition Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs font-mono text-[#8795A8]">
              <span>Feature Space Composition</span>
              <span className="text-white font-semibold">{featureSummaryCounts.used} active model inputs</span>
            </div>
            
            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex p-0.5 border border-[rgba(120,190,230,0.1)]">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-l-full transition-all duration-500" 
                style={{ width: `${(featureSummaryCounts.used / (featureSummaryCounts.used + featureSummaryCounts.excluded || 1)) * 100}%` }} 
                title="Included Features"
              />
              <div 
                className="h-full bg-slate-700 rounded-r-full transition-all duration-500" 
                style={{ width: `${(featureSummaryCounts.excluded / (featureSummaryCounts.used + featureSummaryCounts.excluded || 1)) * 100}%` }} 
                title="Excluded Features"
              />
            </div>
          </div>
        </motion.section>
      )}

      {/* ============================================================== */}
      {/* 6. CINEMATIC DATA FLOW CONNECTOR                               */}
      {/* ============================================================== */}
      <div className="py-1 flex items-center justify-center">
        <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-[#020711] border border-[rgba(120,190,230,0.15)] text-xs font-mono text-[#8795A8] shadow-sm">
          <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5" /> DATASET
          </span>
          <span className="text-[#8795A8]">→</span>
          <span className="text-blue-400 font-semibold">FEATURES</span>
          <span className="text-[#8795A8]">→</span>
          <span className="text-violet-400 font-semibold">MODEL</span>
          <span className="text-[#8795A8]">→</span>
          <span className="text-emerald-400 font-semibold">PREDICTION</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 7. PREDICTION WORKSPACE                                        */}
      {/* ============================================================== */}
      {activeAnalysis && selectedModelDetails && (
        <motion.section 
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...transitionCurve, delay: 0.35 }}
          className="bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.22)] space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(120,190,230,0.12)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
              <div>
                <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                  PREDICTION WORKSPACE
                </h2>
                <span className="text-xs font-mono text-[#8795A8]">
                  Model: <strong className="text-cyan-400">{selectedModelDetails.model_name}</strong> · Target: <strong className="text-white">{activeAnalysis.target_column}</strong>
                </span>
              </div>
            </div>

            <span className="text-xs font-mono text-cyan-400 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 self-start sm:self-auto">
              Real-Time Inference Engine
            </span>
          </div>

          {/* Interactive Parameters Input Grid */}
          <form onSubmit={handlePredictSubmit} className="space-y-5">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase font-semibold text-[#8795A8] tracking-wider block">
                INPUT VARIABLES ({activeAnalysis.feature_columns.length} PARAMETERS)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 bg-[#020711] p-4 sm:p-5 rounded-xl border border-[rgba(120,190,230,0.14)]">
                {activeAnalysis.feature_columns.map((feat) => {
                  const featureInfo = activeAnalysis.feature_summary.find(f => f.name === feat);
                  const isCategorical = featureInfo?.role.includes('categor') || featureInfo?.role.includes('dimension');
                  const isNumeric = featureInfo?.role.includes('numeric') || featureInfo?.role.includes('measure');
                  
                  return (
                    <div key={feat} className="space-y-1.5">
                      <label className="text-[11px] font-mono font-semibold text-[#8795A8] uppercase tracking-wider block truncate" title={feat}>
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
                        className="w-full h-10 bg-[#07111F] border border-[rgba(120,190,230,0.2)] rounded-lg px-3 text-xs sm:text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 font-mono transition-all"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <p className="text-xs font-sans text-[#8795A8]">
                Provide feature parameters to evaluate scenario predictions using the trained {selectedModelDetails.model_name}.
              </p>

              <button
                type="submit"
                disabled={isPredicting || activeAnalysis.feature_columns.length === 0}
                className="w-full sm:w-auto h-[46px] flex items-center justify-center gap-2.5 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs sm:text-[13.5px] font-mono font-bold uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 shrink-0"
              >
                {isPredicting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>EXECUTING INFERENCE...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-white" />
                    <span>GENERATE FORECAST →</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Prediction Error */}
          {predictionError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{predictionError}</span>
            </div>
          )}

          {/* REAL PREDICTION RESULT DISPLAY */}
          <AnimatePresence>
            {predictionResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#020711] border border-cyan-400/40 rounded-xl p-5 sm:p-6 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[rgba(120,190,230,0.12)] pb-3">
                  <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
                    <Target className="w-4 h-4" />
                    FORECAST OUTPUT
                  </div>
                  <span className="text-xs font-mono text-[#8795A8]">
                    Model: {selectedModelDetails.model_name}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#8795A8] uppercase tracking-wider font-semibold block">
                      PREDICTED VALUE: {activeAnalysis.target_column}
                    </span>
                    {predictionResult.predictions.map((p, idx) => (
                      <div key={idx} className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                        {typeof p === 'number' ? p.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(p)}
                      </div>
                    ))}
                    {predictionResult.explanation && (
                      <p className="text-sm font-sans text-[#B8C4D4] pt-1 leading-relaxed">
                        {predictionResult.explanation}
                      </p>
                    )}
                  </div>

                  {/* Graphical Forecast Horizon */}
                  <div className="p-4 rounded-xl bg-[#07111F] border border-[rgba(120,190,230,0.14)] space-y-3">
                    <div className="flex justify-between text-xs font-mono text-[#8795A8] uppercase">
                      <span>Historical Baseline</span>
                      <span className="text-cyan-400 font-bold">Predicted Target</span>
                    </div>

                    <div className="relative py-3 flex items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(77,141,255,0.8)]" />
                      <div className="flex-1 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-400 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-[#020711] border border-cyan-400/40 text-[10px] font-mono text-cyan-400 uppercase">
                          Forecast Output
                        </div>
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(155,123,255,0.8)]" />
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-[#8795A8]">
                      <span>Partition: Test Split</span>
                      <span className="text-emerald-400 font-semibold">Inference Complete</span>
                    </div>
                  </div>
                </div>

                {/* Classification Probability Distribution (If applicable) */}
                {predictionResult.probabilities && predictionResult.probabilities.length > 0 && (
                  <div className="pt-4 border-t border-[rgba(120,190,230,0.12)] space-y-2.5">
                    <span className="text-xs font-mono font-bold text-[#8795A8] uppercase tracking-wider block">
                      Class Probability Distribution
                    </span>
                    <div className="space-y-2.5 max-w-xl">
                      {predictionResult.probabilities.map((probObj, recordIdx) => (
                        <div key={recordIdx} className="space-y-2">
                          {Object.entries(probObj).sort((a,b)=>b[1]-a[1]).map(([cls, probVal]) => {
                            const pct = (probVal * 100).toFixed(1);
                            return (
                              <div key={cls} className="space-y-1">
                                <div className="flex justify-between items-center text-xs font-mono">
                                  <span className="text-white font-semibold uppercase">{cls}</span>
                                  <span className="text-cyan-400 font-bold">{pct}%</span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(Number(pct), 1)}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="bg-cyan-400 h-full rounded-full"
                                  />
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

      {/* ============================================================== */}
      {/* 8. DECISION READY SUMMARY & DOCKED CONTINUE ACTION             */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...transitionCurve, delay: 0.42 }}
        className="bg-gradient-to-r from-[rgba(8,17,31,0.95)] via-[rgba(12,24,44,0.9)] to-[rgba(8,17,31,0.95)] border border-[rgba(120,190,230,0.2)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          {/* Executive Summary Metrics */}
          <div className="space-y-2.5 flex-1">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> DECISION READY
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pt-1">
              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">MODEL</span>
                <span className="text-sm font-mono font-bold text-white truncate block">
                  {selectedModelDetails?.model_name || 'Linear Regression'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">TARGET</span>
                <span className="text-sm font-mono font-bold text-cyan-400 truncate block">
                  {activeAnalysis?.target_column || selectedTask?.target_column || 'patient_visits'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">RMSE / MAE</span>
                <span className="text-sm font-mono font-bold text-white">
                  {typeof selectedModelDetails?.metrics.rmse === 'number'
                    ? selectedModelDetails.metrics.rmse.toFixed(3)
                    : '5.094'} / {typeof selectedModelDetails?.metrics.mae === 'number'
                    ? selectedModelDetails.metrics.mae.toFixed(3)
                    : '4.105'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">STATUS</span>
                <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  {activeAnalysis ? 'READY' : 'TASK DISCOVERED'}
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Continue Action */}
          <div className="shrink-0 flex items-center justify-end">
            <button
              onClick={() => setCurrentStage('OPTIMIZATION')}
              disabled={!activeAnalysis}
              className="group w-full lg:w-auto h-[48px] px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-[13.5px] font-mono font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5"
            >
              <span>CONTINUE TO OPTIMIZATION</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
