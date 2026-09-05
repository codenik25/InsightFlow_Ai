import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  AlertTriangle, 
  Play, 
  RefreshCw,
  Database,
  Info,
  Scale
} from 'lucide-react';
import {
  DecisionRecommendation,
  RecommendationResponse,
} from '../types';
import {
  generateRecommendations,
  fetchRecommendations,
} from '../services/api';

interface DataRecommendationsProps {
  processedDatasetId: string | null;
  optimizationId?: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataRecommendations: React.FC<DataRecommendationsProps> = ({ processedDatasetId, optimizationId, setCurrentStage }) => {
  const [recommendations, setRecommendations] = useState<DecisionRecommendation[]>([]);
  const [recResponse, setRecResponse] = useState<RecommendationResponse | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState<boolean>(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    if (!processedDatasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setRecError(null);
    try {
      const storedRecs = await fetchRecommendations(processedDatasetId);
      setRecommendations(storedRecs);
    } catch (err: any) {
      console.warn('Unable to load existing recommendations, or none exist.', err);
      // We do not auto-generate here unless we want to, but the original dashboard did not auto-generate.
      // So we just leave it empty and let the user generate.
    } finally {
      setLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateRecommendations = async () => {
    if (!processedDatasetId) return;
    setGeneratingRecs(true);
    setRecError(null);
    try {
      const res = await generateRecommendations(processedDatasetId, optimizationId || undefined, 5); // 5 max recs
      setRecResponse(res);
      setRecommendations(res.recommendations);
    } catch (err: any) {
      setRecError(err.message || 'Failed to generate recommendations');
    } finally {
      setGeneratingRecs(false);
    }
  };

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Action recommendations require a processed dataset artifact.</p>
        <button 
          onClick={() => setCurrentStage('OPTIMIZATION')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO OPTIMIZATION
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-3xl mx-auto space-y-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
          <div className="absolute inset-0 rounded-full border-t-2 border-purple-400 animate-spin" />
        </div>
        <div>
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Scanning Recommendations</h3>
          <p className="text-slate-400 font-mono text-xs">Querying decision intelligence...</p>
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

  const safeRecommendations: DecisionRecommendation[] = Array.isArray(recommendations) 
    ? recommendations 
    : ((recommendations as any)?.recommendations || []);


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
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">RECOMMENDATIONS</h1>
          <p className="text-slate-400 font-mono text-sm max-w-xl">
            Action candidates derived from the available analytical and predictive evidence.
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
          <button 
            onClick={() => setCurrentStage('OPTIMIZATION')}
            className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
          >
            ← BACK TO OPTIMIZATION
          </button>
        </div>
      </motion.section>

      {/* 02 — WORKSPACE HEADER / ERROR BOUNDARY */}
      <motion.section variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-1 opacity-80 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" /> Decision Intelligence
          </h2>
          <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">Identify optimal actions</p>
        </div>

        <button
          onClick={handleGenerateRecommendations}
          disabled={generatingRecs}
          className="flex items-center justify-center gap-3 px-8 py-3.5 bg-purple-600/90 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs uppercase tracking-widest font-bold transition-all shrink-0"
        >
          {generatingRecs ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> GENERATING...</>
          ) : (
            <><Play className="w-4 h-4 fill-current" /> GENERATE RECOMMENDATIONS</>
          )}
        </button>
      </motion.section>

      {recError && (
        <motion.div variants={itemVariants} className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-sm text-rose-300 font-mono flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{recError}</span>
          </div>
          <button onClick={loadData} className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800 rounded uppercase text-[10px] tracking-widest transition-colors">Retry</button>
        </motion.div>
      )}

      {recResponse && recResponse.warning && (
        <motion.div variants={itemVariants} className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 text-sm text-amber-300 font-mono flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>{recResponse.warning}</span>
        </motion.div>
      )}

      {/* 03 — RECOMMENDATIONS LIST */}
      <motion.section variants={itemVariants}>
        {safeRecommendations.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 text-center backdrop-blur-sm">
             <Target className="w-12 h-12 text-slate-700 mx-auto mb-4" />
             <p className="text-slate-400 font-mono text-sm max-w-sm mx-auto">No recommendation candidates are available. Run the engine to generate evidence-backed actions.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {safeRecommendations.map((rec) => {
              const isPositive = (rec.absolute_delta ?? 0) >= 0;
              const confColor =
                rec.confidence === 'EXPLORATORY'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : rec.confidence === 'MODERATE'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

              return (
                <div key={rec.id} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm transition-all shadow-[0_0_20px_rgba(168,85,247,0.03)] hover:border-purple-500/30">
                  {/* Title Bar */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-800/60 pb-6 mb-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="px-3 py-1 rounded-md text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 tracking-widest uppercase">
                          PRIORITY {rec.priority || 'N/A'}
                        </span>
                        <span className="px-3 py-1 rounded-md text-[10px] font-bold font-mono bg-slate-800 text-slate-300 border border-slate-700 tracking-widest uppercase">
                          {rec.recommendation_type || 'RECOMMENDATION'}
                        </span>
                        <span className={`px-3 py-1 rounded-md text-[10px] font-bold font-mono border tracking-widest uppercase ${confColor}`}>
                          {rec.confidence || 'UNKNOWN'} CONFIDENCE
                        </span>
                      </div>
                      <h4 className="text-xl md:text-2xl font-bold text-white tracking-tight">{rec.title}</h4>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest block mb-1">Target Metric</span>
                      <span className="text-sm font-bold text-white uppercase">{rec.target_metric}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Col: Rationale & Evidence Details */}
                    <div className="lg:col-span-7 space-y-6">
                      <div>
                         <h5 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                           <Info className="w-3.5 h-3.5" /> Rationale
                         </h5>
                         <p className="text-sm text-slate-300 font-sans leading-relaxed">{rec.rationale}</p>
                      </div>
                      
                      <div>
                         <h5 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                           <Scale className="w-3.5 h-3.5" /> Trade-offs & Constraints
                         </h5>
                         <p className="text-sm text-slate-400 font-sans leading-relaxed">{rec.tradeoffs}</p>
                      </div>

                      {/* Evidence Traceability */}
                      {rec.evidence && (
                        <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800/80">
                          <h5 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <Database className="w-3.5 h-3.5" /> Evidence Provenance
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <div>
                                <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">Dataset context</span>
                                <span className="text-xs text-slate-300 font-mono truncate block" title={rec.evidence.dataset_id}>
                                  {rec.evidence.dataset_id?.slice(0, 12) || 'N/A'}...
                                </span>
                             </div>
                             {rec.evidence.ml_analysis_id && (
                               <div>
                                  <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">ML context</span>
                                  <span className="text-xs text-slate-300 font-mono truncate block" title={rec.evidence.ml_analysis_id}>
                                    {rec.evidence.ml_analysis_id?.slice(0, 12) || 'N/A'}...
                                  </span>
                               </div>
                             )}
                             {rec.evidence.optimization_id && (
                               <div>
                                  <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">Optimization ctx</span>
                                  <span className="text-xs text-slate-300 font-mono truncate block" title={rec.evidence.optimization_id}>
                                    {rec.evidence.optimization_id?.slice(0, 12) || 'N/A'}...
                                  </span>
                               </div>
                             )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Col: Delta Impact Grid */}
                    <div className="lg:col-span-5">
                      <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800">
                        <h5 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-6">Expected Impact</h5>
                        
                        <div className="space-y-6">
                           <div>
                               <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Projected Delta</span>
                                <span className={`text-3xl font-light tracking-tighter ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isPositive ? '+' : ''}{rec.absolute_delta?.toLocaleString() ?? 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono">Percentage Shift</span>
                                <span className={`text-lg font-mono font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {(rec.percentage_delta ?? 0) > 0 ? '+' : ''}{rec.percentage_delta ?? 'N/A'}%
                                </span>
                              </div>
                           </div>

                           <div className="pt-6 border-t border-slate-800/80 grid grid-cols-2 gap-4">
                             <div>
                               <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1 font-mono">Baseline</span>
                               <span className="text-lg font-mono font-bold text-slate-300">{rec.baseline_value?.toLocaleString() ?? 'N/A'}</span>
                             </div>
                             <div className="text-right">
                               <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1 font-mono">Projected</span>
                               <span className="text-lg font-mono font-bold text-white">{rec.projected_value?.toLocaleString() ?? 'N/A'}</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* 04 — CONTINUE NAVIGATION */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-slate-800/60 mt-12">
        <button
          onClick={() => setCurrentStage('DECISIONS')}
          disabled={safeRecommendations.length === 0 || generatingRecs || !!recError}
          className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          CONTINUE TO DECISIONS
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  );
};
