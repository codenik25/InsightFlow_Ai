import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Settings, 
  Play, 
  RefreshCw, 
  AlertTriangle,
  ArrowRight,
  Sliders,
  Database
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

interface DataOptimizationProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
  setOptimizationId?: (id: string | null) => void;
}

export const DataOptimization: React.FC<DataOptimizationProps> = ({ processedDatasetId, setCurrentStage, setOptimizationId }) => {
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
    setOptResult(null);

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

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Optimization requires a processed dataset artifact.</p>
        <button 
          onClick={() => setCurrentStage('PREDICTIONS')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO PREDICTIONS
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-3xl mx-auto space-y-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
          <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
        </div>
        <div>
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Initializing Optimization Lab</h3>
          <p className="text-slate-400 font-mono text-xs">Loading controllable features and model parameters.</p>
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
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">OPTIMIZATION</h1>
          <p className="text-slate-400 font-mono text-sm max-w-xl">
            Evaluate decision scenarios against measurable objectives and constraints.
          </p>
        </div>
        <div className="self-start md:self-auto flex flex-col items-end gap-3">
          <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
             <div className="flex flex-col text-right">
               <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Data Source</span>
               <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Processed Dataset</span>
             </div>
             <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={processedDatasetId}>
               {processedDatasetId}
             </div>
          </div>
          {activeAnalysis && (
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="flex flex-col text-right">
                <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Model Analysis</span>
                <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">ID Context</span>
              </div>
              <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={activeAnalysis.id}>
                {activeAnalysis.id}
              </div>
            </div>
          )}
          <button 
            onClick={() => setCurrentStage('PREDICTIONS')}
            className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors mt-2"
          >
            ← BACK TO PREDICTIONS
          </button>
        </div>
      </motion.section>

      {error && (
        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-300 font-mono flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800 rounded uppercase text-[10px] tracking-widest transition-colors">Retry</button>
        </motion.div>
      )}

      {/* 02 — CONFIGURATION LAB */}
      {optOptions && !error && (
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-8">
            <div className="flex-1">
              <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" /> Scenario Configuration
              </h2>
              
              <div className="flex flex-wrap items-end gap-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/60">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-2 font-mono">Objective</label>
                  <select
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 font-mono tracking-wide"
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
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-2 font-mono">Target Metric</label>
                  <div className="bg-slate-900 border border-slate-700 text-sm text-slate-300 rounded-xl px-4 py-2.5 font-mono cursor-not-allowed">
                    {optOptions.target_column}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-2 font-mono">Max Scenarios</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxScenarios}
                    onChange={(e) => setMaxScenarios(parseInt(e.target.value) || 10)}
                    className="w-24 bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 font-mono text-center"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-end">
              <button
                onClick={handleRunOptimization}
                disabled={runningOpt}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-xs uppercase tracking-widest font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.15)]"
              >
                {runningOpt ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> EXECUTING...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" /> RUN SCENARIOS</>
                )}
              </button>
            </div>
          </div>

          <div className="relative z-10 border-t border-slate-800/80 pt-8">
            <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Sliders className="w-3.5 h-3.5" /> Controllable Features & Bound Constraints
            </h3>
            
            {optOptions.controllable_features.length === 0 ? (
               <div className="text-center p-8 bg-slate-950/30 rounded-xl border border-slate-800 border-dashed">
                 <p className="text-sm font-mono text-slate-500">No controllable features identified.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {optOptions.controllable_features.map((feat) => {
                  const bounds = userConstraints[feat.column] || {};
                  const isAllowed = feat.allowed;

                  return (
                    <div key={feat.column} className={`rounded-2xl p-4 border ${isAllowed ? 'bg-slate-950/80 border-slate-700 hover:border-indigo-500/50 transition-colors' : 'bg-slate-900/30 border-slate-800 opacity-60'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-white font-mono truncate" title={feat.column}>{feat.column}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-widest ${isAllowed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                          {isAllowed ? 'Controllable' : 'Excluded'}
                        </span>
                      </div>

                      {!isAllowed ? (
                        <p className="text-[10px] text-slate-500 font-mono mt-2">{feat.exclusion_reason || 'Not supported for optimization'}</p>
                      ) : (
                        <div className="space-y-4 mt-4">
                          <div className="text-[10px] text-slate-500 font-mono">
                            <div className="mb-1 uppercase tracking-widest font-bold">Observed Bounds</div>
                            <div className="text-slate-300 bg-slate-900 px-2 py-1.5 rounded border border-slate-800">
                              {feat.data_type === 'numeric' 
                                ? `[${feat.min_value ?? '-∞'}, ${feat.max_value ?? '∞'}]`
                                : feat.categories?.join(', ') || 'N/A'
                              }
                            </div>
                          </div>

                          {feat.data_type === 'numeric' && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1 font-mono">Min Bound</label>
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
                                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1.5 rounded-lg font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1 font-mono">Max Bound</label>
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
                                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1.5 rounded-lg font-mono focus:outline-none focus:border-indigo-500 transition-colors"
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
          </div>
        </motion.section>
      )}

      {/* 03 — ERRORS */}
      {optError && (
        <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-300 font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{optError}</span>
        </motion.div>
      )}

      {/* 04 — OPTIMIZATION RESULTS */}
      <AnimatePresence>
        {optResult && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {optResult.warning && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-sm text-amber-300 font-mono flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                <span>{optResult.warning}</span>
              </div>
            )}

            {optResult.best_scenario && (
              <div className="bg-slate-900 border border-indigo-900/50 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(79,70,229,0.05)]">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                    <div>
                       <span className="px-3 py-1 rounded-md text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-widest uppercase block w-fit mb-3">
                         RANK #1 OPTIMAL SCENARIO
                       </span>
                       <h3 className="text-2xl font-bold text-white font-sans tracking-tight">Optimal Parameter Configuration</h3>
                    </div>
                    <div className="text-right">
                       <span className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-1">Target Metric</span>
                       <span className="text-sm font-bold text-white uppercase font-mono">{optResult.target_column}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-center">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Baseline Prediction</span>
                      <span className="text-2xl font-light text-slate-300 font-sans tracking-tight">
                        {optResult.baseline_prediction.toLocaleString(undefined, {maximumFractionDigits: 4})}
                      </span>
                    </div>
                    <div className="bg-slate-950/50 border border-indigo-900/40 rounded-2xl p-5 text-center shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]">
                      <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono mb-2">Optimal Prediction</span>
                      <span className="text-2xl font-bold text-white font-sans tracking-tight">
                        {optResult.best_scenario.predicted_target.toLocaleString(undefined, {maximumFractionDigits: 4})}
                      </span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-center">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Absolute Delta</span>
                      <span className={`text-2xl font-bold font-sans tracking-tight ${optResult.best_scenario.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {optResult.best_scenario.absolute_delta > 0 ? '+' : ''}{optResult.best_scenario.absolute_delta.toLocaleString(undefined, {maximumFractionDigits: 4})}
                      </span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-center">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Percentage Shift</span>
                      <span className={`text-2xl font-bold font-sans tracking-tight ${optResult.best_scenario.percentage_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {optResult.best_scenario.percentage_delta > 0 ? '+' : ''}{optResult.best_scenario.percentage_delta}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 flex items-start gap-4">
                    <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-1">Scenario Explanation</span>
                      <p className="text-sm text-slate-300 font-sans leading-relaxed">{optResult.best_scenario.explanation}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
               <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Database className="w-3.5 h-3.5" /> Scenario Ranking Table ({optResult.scenarios.length} Evaluated)
               </h3>
               
               <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/50">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="text-[10px] text-slate-500 uppercase tracking-widest font-bold border-b border-slate-800 bg-slate-900/50 font-mono">
                     <tr>
                       <th className="py-4 px-4 text-center w-16">Rank</th>
                       <th className="py-4 px-4">Parameter Configuration</th>
                       <th className="py-4 px-4 text-right">Prediction</th>
                       <th className="py-4 px-4 text-right">Delta</th>
                       <th className="py-4 px-4 text-center">Feasibility</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                     {optResult.scenarios.map((sc) => {
                       const isBest = sc.rank === 1;
                       const isPositive = sc.absolute_delta >= 0;
                       
                       return (
                         <tr key={sc.scenario_id} className={`transition-colors font-mono text-xs ${isBest ? 'bg-indigo-950/20' : 'hover:bg-slate-900/40'}`}>
                           <td className="py-4 px-4 text-center">
                             {isBest ? (
                               <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded font-bold">#{sc.rank}</span>
                             ) : (
                               <span className="text-slate-500">#{sc.rank}</span>
                             )}
                           </td>
                           <td className="py-4 px-4">
                             <div className="flex flex-wrap gap-2 max-w-xl">
                               {Object.entries(sc.changes).map(([k, v]) => (
                                 <span key={k} className="bg-slate-900 border border-slate-700 px-2 py-1 rounded-md flex items-center gap-2 text-[10px]">
                                   <span className="text-slate-400">{k}</span>
                                   <span className="text-white font-bold">{String(v)}</span>
                                 </span>
                               ))}
                             </div>
                           </td>
                           <td className={`py-4 px-4 text-right font-bold ${isBest ? 'text-white' : 'text-slate-300'}`}>
                             {sc.predicted_target.toLocaleString(undefined, {maximumFractionDigits: 4})}
                           </td>
                           <td className={`py-4 px-4 text-right ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {isPositive ? '+' : ''}{sc.absolute_delta.toLocaleString(undefined, {maximumFractionDigits: 4})} 
                             <span className="opacity-70 ml-1">({isPositive ? '+' : ''}{sc.percentage_delta}%)</span>
                           </td>
                           <td className="py-4 px-4 text-center text-[10px] uppercase tracking-wider text-slate-400">
                             {sc.feasibility}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
               <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Optimization ID: {optResult.optimization_id}</span>
                  <span>Generated: {new Date(optResult.generated_at).toLocaleTimeString()}</span>
               </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 05 — CONTINUE NAVIGATION */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-slate-800/60 mt-12">
        <button
          onClick={() => setCurrentStage('RECOMMENDATIONS')}
          disabled={!optResult}
          className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          CONTINUE TO RECOMMENDATIONS
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
};
