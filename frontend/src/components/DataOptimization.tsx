import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Settings2, 
  Play, 
  RefreshCw, 
  AlertTriangle,
  ArrowRight,
  Layers,
  ChevronDown,
  ChevronUp,
  Activity,
  ShieldCheck
} from 'lucide-react';
import {
  MLAnalysisResponse,
  OptimizationOptionResponse,
  OptimizationResponse,
} from '../types';
import {
  fetchMLAnalyses,
  fetchOptimizationOptions,
  runOptimization,
} from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DataOptimizationProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
  setOptimizationId?: (id: string | null) => void;
}

export const DataOptimization: React.FC<DataOptimizationProps> = ({ 
  processedDatasetId, 
  setCurrentStage, 
  setOptimizationId 
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeAnalysis, setActiveAnalysis] = useState<MLAnalysisResponse | null>(null);
  const [optOptions, setOptOptions] = useState<OptimizationOptionResponse | null>(null);

  // Configuration State
  const [objective, setObjective] = useState<string>('maximize');
  const [maxScenarios, setMaxScenarios] = useState<number>(10);
  const [userConstraints, setUserConstraints] = useState<Record<string, { min?: number; max?: number }>>({});

  // Execution State
  const [runningOpt, setRunningOpt] = useState<boolean>(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [optResult, setOptResult] = useState<OptimizationResponse | null>(null);

  // Display State
  const [showAllScenarios, setShowAllScenarios] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!processedDatasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mlList = await fetchMLAnalyses(processedDatasetId);
      if (mlList.length > 0) {
        const analysis = mlList[0];
        setActiveAnalysis(analysis);
        
        const options = await fetchOptimizationOptions(processedDatasetId, analysis.id);
        setOptOptions(options);

        // Pre-select first valid objective if available
        if (options.objective_options && options.objective_options.length > 0) {
          setObjective(options.objective_options[0]);
        }
      } else {
        setError("No ML Analysis found. Optimization requires a model context from the Predictions stage.");
      }
    } catch (err: any) {
      console.warn("Failed to load optimization context:", err);
      setError(err.message || 'Failed to initialize optimization lab.');
    } finally {
      setLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunOptimization = async () => {
    if (!processedDatasetId || !activeAnalysis) return;
    setRunningOpt(true);
    setOptError(null);

    try {
      const constraintsPayload: Record<string, { min?: number; max?: number }> = {};
      Object.entries(userConstraints).forEach(([feat, bounds]) => {
        if (bounds.min !== undefined || bounds.max !== undefined) {
          constraintsPayload[feat] = bounds;
        }
      });

      const res = await runOptimization(processedDatasetId, {
        analysis_id: activeAnalysis.id,
        objective: objective,
        max_scenarios: maxScenarios,
        feature_constraints: Object.keys(constraintsPayload).length > 0 ? constraintsPayload : null,
      });

      setOptResult(res);
      if (res.optimization_id && setOptimizationId) {
        setOptimizationId(res.optimization_id);
      }
    } catch (err: any) {
      setOptError(err.message || 'Optimization scenario execution failed.');
    } finally {
      setRunningOpt(false);
    }
  };

  // Count active constraint overrides
  const activeConstraintCount = useMemo(() => {
    return Object.values(userConstraints).filter(
      b => b.min !== undefined || b.max !== undefined
    ).length;
  }, [userConstraints]);

  // Ranking data for visual impact chart
  const rankingChartData = useMemo(() => {
    if (!optResult || !optResult.scenarios || optResult.scenarios.length === 0) return [];
    const list = optResult.scenarios.slice(0, showAllScenarios ? optResult.scenarios.length : 5);
    const maxAbsDelta = Math.max(...list.map(s => Math.abs(s.percentage_delta || 0)), 1);
    return list.map(sc => ({
      rank: sc.rank,
      id: sc.scenario_id,
      pctDelta: sc.percentage_delta,
      absDelta: sc.absolute_delta,
      target: sc.predicted_target,
      relativeWidth: Math.min(100, Math.max(10, (Math.abs(sc.percentage_delta || 0) / maxAbsDelta) * 100)),
      isFeasible: sc.feasibility?.toLowerCase().includes('feasible') && !sc.feasibility?.toLowerCase().includes('infeasible'),
    }));
  }, [optResult, showAllScenarios]);

  // Framer motion easing transition
  const transitionCurve: any = { duration: 0.6, ease: [0.22, 1, 0.36, 1] };

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-8 bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-sans font-semibold text-white mb-2 tracking-tight">NO PROCESSED DATASET</h3>
        <p className="text-[#8795A8] mb-6 font-sans text-sm max-w-md leading-relaxed">
          Decision Optimization requires a trained model context from the Predictions workspace.
        </p>
        <button 
          onClick={() => setCurrentStage('PREDICTIONS')}
          className="h-11 px-7 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 rounded-xl text-xs font-mono font-semibold tracking-wider uppercase border border-cyan-500/30 transition-all flex items-center gap-2"
        >
          ← BACK TO PREDICTIONS
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <ContinuousIntelligenceEngine
        mode="optimization"
        isLoading={loading}
        isFullScreen={false}
        minHeight="540px"
        error={error}
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="relative w-full max-w-[1550px] mx-auto space-y-7 min-w-0 select-none pb-12">
      {/* Background SVG subtle optimization curves */}
      <div className="absolute -top-10 -left-10 -right-10 h-[420px] pointer-events-none overflow-hidden opacity-25 -z-10">
        <svg viewBox="0 0 1400 400" fill="none" className="w-full h-full text-cyan-500/20">
          <path d="M-100,180 C250,90 550,260 850,140 C1150,20 1350,220 1600,110" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
          <path d="M-50,230 C300,120 600,310 900,190 C1200,70 1400,270 1650,160" stroke="rgba(155, 123, 255, 0.25)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* ============================================================== */}
      {/* 1. HERO SECTION */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transitionCurve}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-5 border-b border-[rgba(120,190,230,0.14)]"
      >
        <div className="space-y-2 relative">
          {/* Subtle radial glow behind INTELLIGENCE */}
          <div className="absolute top-6 left-56 w-72 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              DECISION INTELLIGENCE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-[#8795A8] bg-[#07111F]/70 border border-[rgba(120,190,230,0.12)]">
              Enterprise Console
            </span>
          </div>

          <h1 className="text-4xl sm:text-[48px] lg:text-[50px] font-sans font-semibold tracking-tight text-white leading-tight">
            OPTIMIZATION{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 font-semibold">
              INTELLIGENCE
            </span>
          </h1>

          <p className="text-[#B8C4D4] font-sans text-[15px] sm:text-[16px] max-w-2xl leading-[1.6]">
            Evaluate decision scenarios against measurable objectives and operational constraints with machine-learning precision.
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
            onClick={() => setCurrentStage('PREDICTIONS')}
            className="text-xs font-mono text-[#8795A8] hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 mt-0.5"
          >
            ← BACK TO PREDICTIONS
          </button>
        </div>
      </motion.section>

      {/* Global Error Banner */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="text-sm">{error}</span>
          </div>
          <button 
            onClick={loadData} 
            className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800 rounded-lg uppercase text-xs tracking-wider transition-colors shrink-0"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 2. SCENARIO CONTROL STRIP (Compact Horizontal Control Bar) */}
      {/* ============================================================== */}
      {optOptions && !error && (
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
                  <Settings2 className="w-4 h-4 text-cyan-400" /> SCENARIO CONTROL
                </span>
                <span className="text-sm font-sans text-white font-semibold">Simulation Parameters</span>
              </div>

              {/* Objective Selector */}
              <div className="flex flex-col gap-1.5 min-w-[165px]">
                <label className="text-xs text-[#8795A8] uppercase font-semibold tracking-wider font-mono">
                  Objective
                </label>
                <div className="relative">
                  <select
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="w-full h-11 bg-[#020711] border border-[rgba(120,190,230,0.22)] text-sm text-white rounded-xl px-3.5 pr-8 focus:outline-none focus:border-cyan-400 font-mono tracking-wide appearance-none transition-colors"
                  >
                    {optOptions.objective_options?.length > 0 ? (
                      optOptions.objective_options.map(opt => (
                        <option key={opt} value={opt}>{opt.toUpperCase()} TARGET</option>
                      ))
                    ) : (
                      <>
                        <option value="maximize">MAXIMIZE TARGET</option>
                        <option value="minimize">MINIMIZE TARGET</option>
                      </>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#8795A8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Target Metric */}
              <div className="flex flex-col gap-1.5 min-w-[175px]">
                <label className="text-xs text-[#8795A8] uppercase font-semibold tracking-wider font-mono">
                  Target Metric
                </label>
                <div className="h-11 bg-[#020711] border border-[rgba(120,190,230,0.16)] text-sm text-cyan-300 font-mono font-semibold rounded-xl px-3.5 flex items-center justify-between">
                  <span className="truncate">{optOptions.target_column}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase font-mono font-bold">Target</span>
                </div>
              </div>

              {/* Max Scenarios */}
              <div className="flex flex-col gap-1.5 w-32">
                <label className="text-xs text-[#8795A8] uppercase font-semibold tracking-wider font-mono">
                  Max Scenarios
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxScenarios}
                  onChange={(e) => setMaxScenarios(parseInt(e.target.value) || 10)}
                  className="w-full h-11 bg-[#020711] border border-[rgba(120,190,230,0.22)] text-sm text-white rounded-xl px-3.5 focus:outline-none focus:border-cyan-400 font-mono text-center transition-colors font-medium"
                />
              </div>
            </div>

            {/* Run Scenarios Dominant Action */}
            <div className="shrink-0 flex items-center justify-end pt-2 lg:pt-0">
              <button
                onClick={handleRunOptimization}
                disabled={runningOpt}
                className="relative group overflow-hidden w-full lg:w-auto h-[46px] flex items-center justify-center gap-2.5 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-[13.5px] uppercase tracking-wider font-mono font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
              >
                {/* Subtle animated shine sweep on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {runningOpt ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>SIMULATING SCENARIOS...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>RUN SCENARIOS →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.section>
      )}

      {/* Optimization Execution Error */}
      {optError && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="text-sm">{optError}</span>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 3. OPTIMIZATION WORKSPACE (2 Columns: Controls + Result Hero) */}
      {/* ============================================================== */}
      {optOptions && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ------------------------------------------------------------ */}
          {/* LEFT: CONTROLLED PARAMETERS (Level 2 Hierarchy) */}
          {/* ------------------------------------------------------------ */}
          <motion.div 
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...transitionCurve, delay: 0.16 }}
            className="lg:col-span-6 bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4"
          >
            {/* Section Header with cyan indicator dot */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(120,190,230,0.12)]">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                  <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                    CONTROLLED PARAMETERS
                  </h2>
                </div>
                <span className="text-xs sm:text-[13px] text-[#8795A8] font-mono">
                  {optOptions.controllable_features.length} model variables evaluated
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#020711] text-[#B8C4D4] border border-[rgba(120,190,230,0.18)]">
                  <span className="text-cyan-400 font-bold">{activeConstraintCount}</span> active limits
                </span>
                {activeConstraintCount > 0 && (
                  <button
                    onClick={() => setUserConstraints({})}
                    className="text-xs font-mono text-[#8795A8] hover:text-rose-400 underline transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Parameter Items - 2-Column Grid of mini analytical controls */}
            {optOptions.controllable_features.length === 0 ? (
              <div className="text-center p-8 bg-[#020711]/60 rounded-xl border border-[rgba(120,190,230,0.1)]">
                <p className="text-sm font-sans text-[#8795A8]">No controllable features identified for this model.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[610px] overflow-y-auto pr-1.5 custom-scrollbar">
                {optOptions.controllable_features.map((feat) => {
                  const bounds = userConstraints[feat.column] || {};
                  const isAllowed = feat.allowed;
                  const hasCustom = bounds.min !== undefined || bounds.max !== undefined;

                  return (
                    <div 
                      key={feat.column} 
                      className={`p-4 rounded-xl border transition-all duration-300 group ${
                        hasCustom
                          ? 'bg-[#020711] border-cyan-400/50 shadow-md shadow-cyan-500/10 -translate-y-0.5'
                          : isAllowed 
                            ? 'bg-[#020711]/80 border-[rgba(120,190,230,0.14)] hover:border-cyan-400/40 hover:-translate-y-0.5 hover:bg-[#030c1d]' 
                            : 'bg-[#020711]/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      {/* Title & Tag */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[14.5px] font-sans font-semibold text-white truncate group-hover:text-cyan-300 transition-colors" title={feat.column}>
                          {feat.column}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-semibold uppercase tracking-wider ${
                          isAllowed 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isAllowed ? 'CONTROLLABLE' : 'EXCLUDED'}
                        </span>
                      </div>

                      {!isAllowed ? (
                        <p className="text-xs text-[#8795A8] font-sans line-clamp-2">
                          {feat.exclusion_reason || 'Fixed feature constraint'}
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {/* Observed bounds pill */}
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#8795A8] font-semibold">Observed</span>
                            <span className="text-white font-medium bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800 text-[12.5px]">
                              {feat.data_type === 'numeric' 
                                ? `[${feat.min_value !== null && feat.min_value !== undefined ? feat.min_value.toLocaleString(undefined, {maximumFractionDigits: 1}) : '-∞'} — ${feat.max_value !== null && feat.max_value !== undefined ? feat.max_value.toLocaleString(undefined, {maximumFractionDigits: 1}) : '∞'}]`
                                : feat.categories?.slice(0, 2).join(', ') + (feat.categories && feat.categories.length > 2 ? '...' : '') || 'N/A'
                              }
                            </span>
                          </div>

                          {/* Visual Range Indicator Bar */}
                          {feat.data_type === 'numeric' && (
                            <div className="space-y-1">
                              <div className="relative h-2 w-full bg-slate-800/90 rounded-full overflow-hidden">
                                <div className="absolute inset-y-0 left-1/4 right-1/4 bg-cyan-500/30 group-hover:bg-cyan-500/50 rounded-full transition-colors" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.9)]" />
                              </div>
                              <div className="flex justify-between text-[11px] font-mono text-[#8795A8]">
                                <span>{feat.min_value ?? 'min'}</span>
                                <span>{feat.max_value ?? 'max'}</span>
                              </div>
                            </div>
                          )}

                          {/* Interactive Min/Max Overrides */}
                          {feat.data_type === 'numeric' && (
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[rgba(120,190,230,0.08)]">
                              <div>
                                <label className="text-[10px] text-[#8795A8] font-mono uppercase font-bold block mb-1">Min Bound</label>
                                <input
                                  type="number"
                                  placeholder={String(feat.min_value ?? '')}
                                  value={bounds.min !== undefined ? bounds.min : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                    setUserConstraints((prev) => ({
                                      ...prev,
                                      [feat.column]: { ...prev[feat.column], min: val },
                                    }));
                                  }}
                                  className="w-full h-8 bg-[#020711] border border-[rgba(120,190,230,0.18)] text-xs text-white px-2.5 rounded-lg font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-[#8795A8] font-mono uppercase font-bold block mb-1">Max Bound</label>
                                <input
                                  type="number"
                                  placeholder={String(feat.max_value ?? '')}
                                  value={bounds.max !== undefined ? bounds.max : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                    setUserConstraints((prev) => ({
                                      ...prev,
                                      [feat.column]: { ...prev[feat.column], max: val },
                                    }));
                                  }}
                                  className="w-full h-8 bg-[#020711] border border-[rgba(120,190,230,0.18)] text-xs text-white px-2.5 rounded-lg font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition-colors"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ------------------------------------------------------------ */}
          {/* RIGHT: OPTIMAL SCENARIO CENTERPIECE (Level 1 Dominant Hero) */}
          {/* ------------------------------------------------------------ */}
          <motion.div 
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...transitionCurve, delay: 0.22 }}
            className="lg:col-span-6 bg-[rgba(8,17,31,0.85)] border border-[rgba(120,190,230,0.18)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.22)] relative overflow-hidden"
          >
            {/* Ambient atmospheric glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-24 -mt-24" />

            {/* Awaiting Simulation State */}
            {!optResult ? (
              <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-6 space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(57,214,245,0.2)]">
                  <Zap className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-sans font-semibold text-white tracking-tight">
                    OPTIMIZATION ENGINE READY
                  </h3>
                  <p className="text-sm text-[#8795A8] max-w-sm mx-auto leading-relaxed">
                    Set target objective and constraints on the left, then click <strong className="text-cyan-400">RUN SCENARIOS</strong> above to generate optimal decisions.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-[#8795A8] bg-[#020711] px-4 py-2 rounded-xl border border-[rgba(120,190,230,0.15)]">
                  <span>Target: <span className="text-white font-semibold">{optOptions.target_column}</span></span>
                  <span>•</span>
                  <span>Objective: <span className="text-cyan-400 font-semibold">{objective.toUpperCase()}</span></span>
                </div>
              </div>
            ) : (
              /* Optimal Result Visual Hero (Level 1 Priority) */
              <div className="space-y-6 relative z-10">
                {/* Result Warning if any */}
                {optResult.warning && (
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs font-mono text-amber-300 flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{optResult.warning}</span>
                  </div>
                )}

                {/* Header Strip with Rank #1 Badge & Target */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(120,190,230,0.12)]">
                  <div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 inline-block mb-1.5">
                      RANK #1 OPTIMAL SCENARIO
                    </span>
                    <h3 className="text-xl sm:text-[22px] font-sans font-bold text-white tracking-tight">
                      Optimal Decision Impact
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono uppercase text-[#8795A8] tracking-wider block font-semibold">TARGET METRIC</span>
                    <span className="text-sm font-mono font-bold text-cyan-400 uppercase">{optResult.target_column}</span>
                  </div>
                </div>

                {/* Primary Metric Quartet (Dominant Level 1 Values) */}
                {optResult.best_scenario && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Baseline */}
                      <div className="h-[88px] sm:h-[94px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                        <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                          Baseline
                        </span>
                        <span className="text-[24px] sm:text-[28px] font-mono font-bold text-slate-300 leading-none">
                          {optResult.baseline_prediction.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </span>
                      </div>

                      {/* Optimal */}
                      <div className="h-[88px] sm:h-[94px] bg-[#020711] border border-cyan-400/40 rounded-xl p-3.5 flex flex-col justify-between text-center shadow-[inset_0_0_20px_rgba(57,214,245,0.08)]">
                        <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                          Optimal
                        </span>
                        <span className="text-[24px] sm:text-[28px] font-mono font-bold text-white leading-none">
                          {optResult.best_scenario.predicted_target.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </span>
                      </div>

                      {/* Change */}
                      <div className="h-[88px] sm:h-[94px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center">
                        <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                          Change (Δ)
                        </span>
                        <span className={`text-[24px] sm:text-[28px] font-mono font-bold leading-none ${
                          optResult.best_scenario.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {optResult.best_scenario.absolute_delta > 0 ? '+' : ''}
                          {optResult.best_scenario.absolute_delta.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </span>
                      </div>

                      {/* Shift with mini SVG Ring */}
                      <div className="h-[88px] sm:h-[94px] bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-3.5 flex flex-col justify-between text-center relative overflow-hidden">
                        <span className="text-[11.5px] font-mono font-semibold uppercase tracking-wider text-[#8795A8]">
                          Shift (%)
                        </span>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`text-[24px] sm:text-[28px] font-mono font-bold leading-none ${
                            optResult.best_scenario.percentage_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {optResult.best_scenario.percentage_delta > 0 ? '+' : ''}
                            {optResult.best_scenario.percentage_delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Impact Comparison Bar & Relative Impact Visualization */}
                    <div className="bg-[#020711] border border-[rgba(120,190,230,0.14)] rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#8795A8] uppercase tracking-wider font-semibold">
                          VISUAL IMPACT COMPARISON
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Baseline
                          </span>
                          <span className="flex items-center gap-1.5 text-violet-400 font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Optimal
                          </span>
                        </div>
                      </div>

                      {/* Comparative Animated Bars */}
                      <div className="space-y-3">
                        {/* Baseline Bar */}
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs font-mono font-semibold text-[#8795A8]">Baseline</span>
                          <div className="flex-1 bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ 
                                width: `${Math.min(100, Math.max(15, (optResult.baseline_prediction / Math.max(optResult.baseline_prediction, optResult.best_scenario.predicted_target)) * 100))}%` 
                              }}
                              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                              className="h-full bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(57,214,245,0.6)]"
                            />
                          </div>
                          <span className="w-24 text-right text-sm font-mono text-cyan-300 font-bold">
                            {optResult.baseline_prediction.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Optimal Bar */}
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs font-mono font-semibold text-[#8795A8]">Optimal</span>
                          <div className="flex-1 bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ 
                                width: `${Math.min(100, Math.max(15, (optResult.best_scenario.predicted_target / Math.max(optResult.baseline_prediction, optResult.best_scenario.predicted_target)) * 100))}%` 
                              }}
                              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full shadow-[0_0_10px_rgba(155,123,255,0.6)]"
                            />
                          </div>
                          <span className="w-24 text-right text-sm font-mono text-violet-300 font-bold">
                            {optResult.best_scenario.predicted_target.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Best Scenario Parameter Adjustments */}
                    {optResult.best_scenario.changes && Object.keys(optResult.best_scenario.changes).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-[#8795A8] block font-semibold">
                          RECOMMENDED PARAMETER SHIFTS
                        </span>
                        <div className="flex flex-wrap gap-2.5">
                          {Object.entries(optResult.best_scenario.changes).map(([k, v]) => (
                            <span 
                              key={k} 
                              className="bg-[#020711] border border-[rgba(120,190,230,0.2)] px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs sm:text-[13px] font-mono shadow-sm"
                            >
                              <span className="text-[#8795A8]">{k}:</span>
                              <span className="text-white font-bold">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scenario Explanation ("WHY THIS SCENARIO?") */}
                    <div className="bg-[#020711] rounded-xl border border-[rgba(120,190,230,0.14)] p-4 sm:p-5 flex items-start gap-3.5">
                      <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 flex-1">
                        <span className="block text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">
                          WHY THIS SCENARIO?
                        </span>
                        <p className="text-[14.5px] text-[#F4F7FB] font-sans leading-[1.6]">
                          {optResult.best_scenario.explanation || 'Optimal parameter combination predicted by regression gradient model.'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. TOP SCENARIOS & SCENARIO IMPACT VISUALIZATION */}
      {/* ============================================================== */}
      <AnimatePresence>
        {optResult && optResult.scenarios && optResult.scenarios.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ ...transitionCurve, delay: 0.28 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Top Scenarios List (Left 7 Cols) */}
            <div className="lg:col-span-7 bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(120,190,230,0.12)]">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                    <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                      TOP SCENARIOS
                    </h2>
                  </div>
                  <span className="text-xs sm:text-[13px] text-[#8795A8] font-mono">
                    Showing {showAllScenarios ? optResult.scenarios.length : Math.min(5, optResult.scenarios.length)} of {optResult.scenarios.length} evaluated
                  </span>
                </div>

                {optResult.scenarios.length > 5 && (
                  <button
                    onClick={() => setShowAllScenarios(!showAllScenarios)}
                    className="text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors px-2 py-1"
                  >
                    {showAllScenarios ? (
                      <>SHOW TOP 5 ONLY <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>VIEW ALL {optResult.scenarios.length} SCENARIOS → <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>

              {/* Scenario rows (58-64px height with smooth hover) */}
              <div className="space-y-2.5">
                {optResult.scenarios.slice(0, showAllScenarios ? optResult.scenarios.length : 5).map((sc) => {
                  const isBest = sc.rank === 1;
                  const isPositive = sc.absolute_delta >= 0;
                  const isFeasible = sc.feasibility?.toLowerCase().includes('feasible') && !sc.feasibility?.toLowerCase().includes('infeasible');

                  return (
                    <div
                      key={sc.scenario_id}
                      className={`min-h-[60px] p-3.5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                        isBest 
                          ? 'bg-cyan-950/20 border-cyan-400/40 shadow-sm shadow-cyan-500/10 hover:translate-x-1' 
                          : 'bg-[#020711]/80 border-[rgba(120,190,230,0.12)] hover:border-cyan-400/30 hover:bg-[#030c1d] hover:translate-x-1'
                      }`}
                    >
                      {/* Rank + Parameter Changes */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
                          isBest 
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                            : 'bg-slate-800 text-slate-300 group-hover:bg-cyan-500/20 group-hover:text-cyan-400'
                        }`}>
                          #{sc.rank < 10 ? `0${sc.rank}` : sc.rank}
                        </span>

                        <div className="flex flex-wrap gap-2 min-w-0">
                          {Object.entries(sc.changes).slice(0, 3).map(([k, v]) => (
                            <span 
                              key={k} 
                              className="text-xs font-mono bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-[#B8C4D4] truncate max-w-[200px]"
                            >
                              <span className="text-[#8795A8]">{k}:</span> {String(v)}
                            </span>
                          ))}
                          {Object.keys(sc.changes).length > 3 && (
                            <span className="text-xs font-mono text-[#8795A8] self-center">
                              +{Object.keys(sc.changes).length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prediction + Delta + Feasibility */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 font-mono text-xs">
                        <div className="text-right">
                          <span className="text-[11px] text-[#8795A8] block font-semibold">PREDICTION</span>
                          <span className="font-bold text-white text-[13.5px]">
                            {sc.predicted_target.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="text-right min-w-[75px]">
                          <span className="text-[11px] text-[#8795A8] block font-semibold">DELTA</span>
                          <span className={`font-bold text-[13.5px] ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}{sc.percentage_delta}%
                          </span>
                        </div>

                        {/* Status Indicator */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                          <span className={`w-2.5 h-2.5 rounded-full ${isFeasible ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-amber-400'}`} />
                          <span className={isFeasible ? 'text-emerald-400' : 'text-amber-400'}>
                            {sc.feasibility || 'FEASIBLE'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scenario Impact Ranking Chart (Right 5 Cols) */}
            <div className="lg:col-span-5 bg-[rgba(8,17,31,0.82)] border border-[rgba(120,190,230,0.15)] rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(120,190,230,0.12)]">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(57,214,245,0.7)]" />
                    <h2 className="text-[18px] font-sans font-bold text-white tracking-wide">
                      SCENARIO IMPACT
                    </h2>
                  </div>
                  <span className="text-xs sm:text-[13px] text-[#8795A8] font-mono">Relative Shift (% Delta)</span>
                </div>
                <span className="text-xs font-mono text-[#8795A8] uppercase tracking-wider font-semibold">
                  RELATIVE CHANGE
                </span>
              </div>

              {/* Visual Horizontal Bars */}
              <div className="space-y-3.5 pt-1">
                {rankingChartData.map((item) => {
                  const isPositive = item.pctDelta >= 0;
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300 font-bold">#{item.rank < 10 ? `0${item.rank}` : item.rank}</span>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[#8795A8] text-xs">pred: {item.target.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                          <span className={`font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}{item.pctDelta}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.relativeWidth}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          className={`h-full rounded-full ${
                            item.rank === 1 
                              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(57,214,245,0.6)]' 
                              : isPositive 
                                ? 'bg-emerald-400/80' 
                                : 'bg-rose-400/80'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[rgba(120,190,230,0.1)] flex items-center justify-between text-xs text-[#8795A8] font-mono">
                <span>Optimized via regression frontier</span>
                <span>ID: {optResult.optimization_id.substring(0, 14)}...</span>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 5. DECISION READY SUMMARY & DOCKED CONTINUE ACTION */}
      {/* ============================================================== */}
      <motion.section 
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...transitionCurve, delay: 0.35 }}
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
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">OBJECTIVE</span>
                <span className="text-sm font-mono font-bold text-white uppercase">
                  {objective.toUpperCase()} TARGET
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">TARGET</span>
                <span className="text-sm font-mono font-bold text-cyan-400">
                  {optOptions?.target_column || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">SCENARIOS</span>
                <span className="text-sm font-mono font-bold text-white">
                  {optResult ? `${optResult.scenarios.length} evaluated` : `${maxScenarios} configured`}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8795A8] uppercase tracking-wider block font-semibold">STATUS</span>
                <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                  {optResult ? (optResult.best_scenario?.feasibility || 'FEASIBLE') : 'VERIFIED'}
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Continue Action */}
          <div className="shrink-0 flex items-center justify-end">
            <button
              onClick={() => setCurrentStage('RECOMMENDATIONS')}
              disabled={!optResult}
              className="group w-full lg:w-auto h-[48px] px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-[13.5px] font-mono font-bold tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5"
            >
              <span>CONTINUE TO RECOMMENDATIONS</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
