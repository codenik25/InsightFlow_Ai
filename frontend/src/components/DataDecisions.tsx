import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Layers,
  Link as LinkIcon
} from 'lucide-react';
import {
  DecisionCommandCenterResponse,
  DecisionBriefResponse,
} from '../types';
import {
  fetchDecisionCommandCenter,
  generateDecisionBrief,
  fetchDecisionBrief,
  recordDecisionOutcome
} from '../services/api';

interface DataDecisionsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataDecisions: React.FC<DataDecisionsProps> = ({ processedDatasetId, setCurrentStage }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [decisionData, setDecisionData] = useState<DecisionCommandCenterResponse | null>(null);
  
  // Brief State
  const [brief, setBrief] = useState<DecisionBriefResponse | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState<boolean>(false);
  
  // Outcome State
  const [formalizing, setFormalizing] = useState<boolean>(false);
  const [outcomeSuccess, setOutcomeSuccess] = useState<boolean>(false);
  const [actualMetric, setActualMetric] = useState<string>('');
  const [actualValue, setActualValue] = useState<string>('');
  const [rationale, setRationale] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!processedDatasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDecisionCommandCenter(processedDatasetId);
      setDecisionData(data);
      
      // Attempt to load existing brief
      try {
        const existingBrief = await fetchDecisionBrief(processedDatasetId);
        setBrief(existingBrief);
      } catch (err) {
        // Brief might not exist yet, ignore
      }

      if (data.primary_recommendation) {
        setActualMetric(data.primary_recommendation.target_metric);
        setActualValue(String(data.primary_recommendation.projected_value));
      }

    } catch (err: any) {
      setError(err.message || 'Failed to aggregate Decision Intelligence evidence chain.');
    } finally {
      setLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateBrief = async () => {
    if (!processedDatasetId || !decisionData?.primary_recommendation?.recommendation_id) return;
    setGeneratingBrief(true);
    try {
      const newBrief = await generateDecisionBrief(processedDatasetId, decisionData.primary_recommendation.recommendation_id);
      setBrief(newBrief);
    } catch (err: any) {
      setError(err.message || 'Failed to generate formal Decision Brief.');
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleFormalizeDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processedDatasetId || !decisionData?.primary_recommendation?.recommendation_id) return;
    
    setFormalizing(true);
    setError(null);
    setOutcomeSuccess(false);

    try {
      await recordDecisionOutcome(processedDatasetId, {
        recommendation_id: decisionData.primary_recommendation.recommendation_id,
        actual_metric: actualMetric,
        actual_value: parseFloat(actualValue) || 0,
        notes: rationale || undefined,
      });
      setOutcomeSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to formalize decision outcome.');
    } finally {
      setFormalizing(false);
    }
  };

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Decisions require a processed dataset artifact.</p>
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
          <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
        </div>
        <div>
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Aggregating Evidence Chain</h3>
          <p className="text-slate-400 font-mono text-xs">Loading primary recommendations and deterministic outcomes.</p>
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

  const primary = decisionData?.primary_recommendation;

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
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">DECISIONS</h1>
          <p className="text-slate-400 font-mono text-sm max-w-xl">
            Formalize the selected decision with its evidence, scenario, and expected outcome.
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
          {decisionData?.evidence_chain?.optimization_id && (
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
              <div className="flex flex-col text-right">
                <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Scenario</span>
                <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Optimization Context</span>
              </div>
              <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={decisionData.evidence_chain.optimization_id}>
                {decisionData.evidence_chain.optimization_id}
              </div>
            </div>
          )}
          <button 
            onClick={() => setCurrentStage('OPTIMIZATION')}
            className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors mt-2"
          >
            ← BACK TO OPTIMIZATION
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

      {/* 02 — PRIMARY DECISION SUMMARY & FORMALIZATION */}
      {decisionData && primary ? (
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: DECISION SUMMARY */}
          <div className="space-y-6">
             <div className="bg-slate-900/40 border border-indigo-500/30 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden h-full flex flex-col">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
                <div className="relative z-10 flex-1 flex flex-col">
                   <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                      <div>
                         <span className="px-3 py-1 rounded-md text-[10px] font-bold font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-widest uppercase block w-fit mb-3">
                           DECISION SUMMARY
                         </span>
                         <h3 className="text-2xl font-bold text-white font-sans tracking-tight leading-snug">{primary.title}</h3>
                      </div>
                      <div className="text-right flex flex-col items-end">
                         <span className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-1">Status</span>
                         <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-widest uppercase">
                           {decisionData.snapshot.decision_status.replace(/_/g, ' ')}
                         </span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mb-8 font-mono">
                      <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Target Metric</span>
                        <span className="text-sm font-bold text-slate-300 uppercase">{primary.target_metric}</span>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Model Confidence</span>
                        <span className="text-sm font-bold text-indigo-400 uppercase">{primary.confidence}</span>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Baseline</span>
                        <span className="text-xl font-bold text-slate-300">{primary.baseline_value.toLocaleString(undefined, {maximumFractionDigits: 4})}</span>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Projected</span>
                        <span className="text-xl font-bold text-white">{primary.projected_value.toLocaleString(undefined, {maximumFractionDigits: 4})}</span>
                      </div>
                      <div className="col-span-2 bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Impact / Delta</span>
                        <div className="flex items-end gap-3">
                          <span className={`text-2xl font-bold ${primary.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {primary.absolute_delta >= 0 ? '+' : ''}{primary.absolute_delta.toLocaleString(undefined, {maximumFractionDigits: 4})}
                          </span>
                          <span className={`text-sm font-bold pb-1 ${primary.percentage_delta >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                             ({primary.percentage_delta >= 0 ? '+' : ''}{primary.percentage_delta}%)
                          </span>
                        </div>
                      </div>
                   </div>

                   {decisionData.comparison && decisionData.comparison.length > 0 && (
                     <div className="mt-auto">
                        <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> Selected Scenario Changes
                        </h4>
                        <div className="space-y-2">
                           {decisionData.comparison.map((cmp, idx) => (
                             <div key={idx} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 font-mono text-xs">
                               <span className="text-slate-400 truncate pr-4">{cmp.feature}</span>
                               <div className="flex items-center gap-3 shrink-0">
                                 <span className="text-slate-500">{String(cmp.baseline_value)}</span>
                                 <ArrowRight className="w-3 h-3 text-slate-600" />
                                 <span className="font-bold text-white">{String(cmp.proposed_value)}</span>
                               </div>
                             </div>
                           ))}
                        </div>
                     </div>
                   )}
                </div>
             </div>
          </div>

          {/* RIGHT: FORMALIZATION / OUTCOME */}
          <div className="space-y-6">
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm relative h-full">
                <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Formalize Decision
                </h3>

                <p className="text-slate-400 text-sm leading-relaxed font-sans mb-8">
                  By formalizing this decision, you record the projected outcome against the baseline for historical accuracy tracking.
                  This preserves the operational evidence chain for governance and auditability.
                </p>

                {outcomeSuccess && (
                  <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-sm text-emerald-300 font-mono flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
                    <span>Decision outcome formalized and recorded successfully.</span>
                  </div>
                )}

                <form onSubmit={handleFormalizeDecision} className="space-y-5 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-2 font-mono">Actual / Targeted Metric</label>
                      <input
                        type="text"
                        value={actualMetric}
                        onChange={(e) => setActualMetric(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-2 font-mono">Expected Value</label>
                      <input
                        type="number"
                        step="any"
                        value={actualValue}
                        onChange={(e) => setActualValue(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-2 font-mono">Decision Rationale / Notes</label>
                    <textarea
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      rows={3}
                      placeholder="Context for finalizing this scenario..."
                      className="w-full bg-slate-900 border border-slate-700 text-sm text-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 font-sans transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={formalizing}
                    className="w-full mt-2 flex items-center justify-center gap-3 px-6 py-3.5 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs uppercase tracking-widest font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.15)]"
                  >
                    {formalizing ? 'RECORDING DECISION...' : 'FORMALIZE DECISION'}
                  </button>
                </form>

                <div className="mt-8 pt-8 border-t border-slate-800">
                   <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center justify-between mb-4">
                     <span><FileText className="w-3.5 h-3.5 inline mr-2 text-indigo-400" /> AI Executive Brief</span>
                     {brief && <span className="text-emerald-400">Available</span>}
                   </h4>
                   
                   {!brief ? (
                     <button
                       onClick={handleGenerateBrief}
                       disabled={generatingBrief}
                       className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs uppercase tracking-widest font-bold transition-all border border-slate-700"
                     >
                       {generatingBrief ? 'SYNTHESIZING BRIEF...' : 'GENERATE DECISION BRIEF'}
                     </button>
                   ) : (
                     <div className="bg-slate-950/80 p-5 rounded-2xl border border-indigo-500/30">
                        <p className="text-sm font-sans text-slate-300 leading-relaxed mb-4">
                          {brief.executive_summary}
                        </p>
                        <div className="text-[10px] font-mono text-slate-500 uppercase flex justify-between">
                          <span>Model: {brief.model_name}</span>
                          <span>Validation: {brief.validation_status}</span>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          </div>

        </motion.div>
      ) : (
        !loading && !error && (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 border-dashed text-center">
             <p className="text-slate-400 font-mono text-sm">No primary decision context found. Ensure recommendations have been generated.</p>
          </div>
        )
      )}

      {/* 03 — EVIDENCE CHAIN */}
      {decisionData?.evidence_chain && decisionData.evidence_chain.nodes.length > 0 && (
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
           <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-8">
             <LinkIcon className="w-3.5 h-3.5 text-indigo-400" /> Evidence Provenance Chain
           </h3>
           
           <div className="flex flex-col md:flex-row items-stretch gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {decisionData.evidence_chain.nodes.map((node, idx) => (
                <div key={node.node_id + idx} className="flex items-center">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 min-w-[240px] max-w-[280px] shrink-0 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900 text-slate-400 uppercase border border-slate-800 tracking-wider">
                          {node.node_type}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white font-sans mb-2 leading-snug">{node.title}</h4>
                      <p className="text-[11px] text-slate-400 font-mono leading-relaxed line-clamp-3">
                        {node.description}
                      </p>
                    </div>
                  </div>
                  {idx < decisionData.evidence_chain!.nodes.length - 1 && (
                    <div className="hidden md:flex px-4 items-center">
                      <ArrowRight className="w-5 h-5 text-slate-700" />
                    </div>
                  )}
                </div>
              ))}
           </div>
        </motion.section>
      )}

      {/* 04 — CONTINUE NAVIGATION */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-slate-800/60 mt-12">
        <button
          onClick={() => setCurrentStage('GUARDRAILS')}
          disabled={!decisionData}
          className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          CONTINUE TO GUARDRAILS
          <ShieldCheck className="w-4 h-4" />
        </button>
      </motion.div>
    </motion.div>
  );
};
