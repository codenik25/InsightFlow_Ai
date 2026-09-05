import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  DecisionCommandCenterResponse,
  DecisionGuardrailResponse
} from '../types';
import {
  fetchDecisionCommandCenter,
  getGuardrailByRecommendationId,
  evaluateGuardrailsForRecommendation
} from '../services/api';

interface DataGuardrailsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataGuardrails: React.FC<DataGuardrailsProps> = ({ processedDatasetId, setCurrentStage }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [decisionData, setDecisionData] = useState<DecisionCommandCenterResponse | null>(null);
  const [guardrail, setGuardrail] = useState<DecisionGuardrailResponse | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);

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

      if (data.primary_recommendation) {
        try {
          const gRes = await getGuardrailByRecommendationId(processedDatasetId, data.primary_recommendation.recommendation_id);
          setGuardrail(gRes);
        } catch (err: any) {
          // If guardrail isn't found, we just leave it null so the user can run it
          console.warn('Guardrails not yet evaluated for this recommendation', err);
        }
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

  const handleRunGuardrails = async () => {
    if (!processedDatasetId || !decisionData?.primary_recommendation) return;
    setEvaluating(true);
    setError(null);
    try {
      const gRes = await evaluateGuardrailsForRecommendation(processedDatasetId, decisionData.primary_recommendation.recommendation_id);
      setGuardrail(gRes);
    } catch (err: any) {
      setError(err.message || 'Failed to run guardrails audit.');
    } finally {
      setEvaluating(false);
    }
  };

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Guardrails require a processed dataset artifact.</p>
        <button 
          onClick={() => setCurrentStage('DECISIONS')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO DECISIONS
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
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Loading Validation Context</h3>
          <p className="text-slate-400 font-mono text-xs">Fetching selected decision and guardrail evaluations...</p>
        </div>
      </div>
    );
  }

  const primary = decisionData?.primary_recommendation;

  if (!error && !primary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO DECISION AVAILABLE</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">There is no primary decision to validate.</p>
        <button 
          onClick={() => setCurrentStage('DECISIONS')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO DECISIONS
        </button>
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

  const dStatusColor = guardrail?.decision_status === 'READY_TO_CONSIDER'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : guardrail?.decision_status === 'HUMAN_REVIEW_REQUIRED'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  const fStatusColor = guardrail?.feasibility_status === 'FEASIBLE'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : guardrail?.feasibility_status === 'CAUTION'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

  const rLevelColor = guardrail?.risk_level === 'LOW'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : guardrail?.risk_level === 'MEDIUM'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1750px] mx-auto space-y-10 pb-24"
    >
      {/* 01 — PAGE HEADER */}
      <motion.section variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/60 pb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">GUARDRAILS</h1>
          <p className="text-slate-400 font-mono text-sm max-w-2xl">
            Validate the selected decision against defined constraints, thresholds, and safety rules.
          </p>
        </div>
        <div className="self-start md:self-auto flex flex-col items-end gap-3">
          {primary?.recommendation_id && (
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
               <div className="flex flex-col text-right">
                 <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Decision</span>
                 <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Recommendation ID</span>
               </div>
               <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={primary.recommendation_id}>
                 {primary.recommendation_id}
               </div>
            </div>
          )}
          {decisionData?.evidence_chain?.optimization_id && (
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
               <div className="flex flex-col text-right">
                 <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Optimization</span>
                 <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Optimization ID</span>
               </div>
               <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={decisionData.evidence_chain.optimization_id}>
                 {decisionData.evidence_chain.optimization_id}
               </div>
            </div>
          )}
          {decisionData?.evidence_chain?.scenario_id && (
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
               <div className="flex flex-col text-right">
                 <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Scenario</span>
                 <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Scenario ID</span>
               </div>
               <div className="pl-3 border-l border-slate-700 font-mono text-white text-xs truncate max-w-[150px]" title={decisionData.evidence_chain.scenario_id}>
                 {decisionData.evidence_chain.scenario_id}
               </div>
            </div>
          )}
          <button 
            onClick={() => setCurrentStage('DECISIONS')}
            className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors mt-2"
          >
            ← BACK TO DECISIONS
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

      {/* 02 — DECISION UNDER VALIDATION */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Decision Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm h-full">
            <h3 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3">Decision Under Validation</h3>
            
            {primary && (
              <div className="space-y-6">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase mb-2 inline-block">
                    {primary.recommendation_type}
                  </span>
                  <h4 className="text-xl font-bold text-white tracking-tight leading-snug">{primary.title}</h4>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-3">
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-500">Target Metric</span>
                    <span className="text-slate-300 font-bold">{primary.target_metric}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-500">Baseline</span>
                    <span className="text-slate-300 font-bold">{primary.baseline_value.toLocaleString(undefined, {maximumFractionDigits: 4})}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Projected</span>
                    <span className="text-white font-bold">{primary.projected_value.toLocaleString(undefined, {maximumFractionDigits: 4})}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Delta Impact</span>
                    <span className={`font-bold ${primary.absolute_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {primary.absolute_delta >= 0 ? '+' : ''}{primary.absolute_delta.toLocaleString(undefined, {maximumFractionDigits: 4})}
                    </span>
                  </div>
                </div>

                {decisionData?.comparison && decisionData.comparison.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-3">Feature Operations</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {decisionData.comparison.map((cmp, idx) => (
                        <div key={idx} className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[10px] flex justify-between items-center">
                          <span className="text-slate-400 truncate pr-2 max-w-[100px]" title={cmp.feature}>{cmp.feature}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-slate-500">{String(cmp.baseline_value)}</span>
                            <span className="text-slate-600">→</span>
                            <span className="font-bold text-white">{String(cmp.proposed_value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Guardrail Execution & Results */}
        <div className="lg:col-span-2 space-y-6">
          {!guardrail ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 backdrop-blur-sm h-full flex flex-col items-center justify-center text-center">
              <ShieldCheck className="w-16 h-16 text-slate-700 mb-6" />
              <h3 className="text-2xl font-sans text-white mb-3 tracking-tight">Run Guardrail Validation</h3>
              <p className="text-slate-400 font-mono text-sm max-w-md mb-8">
                Evaluate this strategic decision against safety boundaries, feasibility constraints, and compliance rules.
              </p>
              <button
                onClick={handleRunGuardrails}
                disabled={evaluating}
                className="px-8 py-4 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm uppercase tracking-widest font-bold transition-all shadow-[0_0_30px_rgba(79,70,229,0.2)]"
              >
                {evaluating ? 'AUDITING RULES...' : 'RUN GUARDRAILS'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Risk Scores Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-center">
                    <span className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-2">Feasibility</span>
                    <span className="text-2xl font-bold text-white font-mono">{guardrail.feasibility_score}<span className="text-sm text-slate-600">/100</span></span>
                 </div>
                 <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-center">
                    <span className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-2">Realism</span>
                    <span className="text-2xl font-bold text-white font-mono">{guardrail.realism_score}<span className="text-sm text-slate-600">/100</span></span>
                 </div>
                 <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-center">
                    <span className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-2">Risk Score</span>
                    <span className="text-2xl font-bold text-amber-400 font-mono">{guardrail.risk_score}<span className="text-sm text-amber-400/30">/100</span></span>
                 </div>
                 <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-center">
                    <span className="block text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-2">Confidence</span>
                    <span className="text-2xl font-bold text-indigo-400 font-mono">{guardrail.confidence_score}<span className="text-sm text-indigo-400/30">/100</span></span>
                 </div>
              </div>

              {/* Guardrails Detailed Results */}
              <div className="bg-slate-900/40 border border-indigo-500/20 rounded-3xl p-8">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight mb-1">Guardrail Results</h3>
                    <p className="text-xs font-mono text-slate-400">{guardrail.explanation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-md text-[10px] font-bold font-mono border uppercase tracking-widest ${dStatusColor}`}>
                      Status: {guardrail.decision_status.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-3 py-1 rounded-md text-[10px] font-bold font-mono border uppercase tracking-widest ${fStatusColor}`}>
                      Feasibility: {guardrail.feasibility_status}
                    </span>
                    <span className={`px-3 py-1 rounded-md text-[10px] font-bold font-mono border uppercase tracking-widest ${rLevelColor}`}>
                      Risk: {guardrail.risk_level}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {guardrail.guardrail_results && guardrail.guardrail_results.map((rule, idx) => {
                    const statusIcon = rule.status === 'PASS' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> 
                                     : rule.status === 'WARNING' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> 
                                     : <XCircle className="w-4 h-4 text-rose-400" />;
                    const bgClass = rule.status === 'PASS' ? 'bg-emerald-950/20 border-emerald-900/40'
                                  : rule.status === 'WARNING' ? 'bg-amber-950/20 border-amber-900/40'
                                  : 'bg-rose-950/20 border-rose-900/40';
                    const textClass = rule.status === 'PASS' ? 'text-emerald-400'
                                    : rule.status === 'WARNING' ? 'text-amber-400'
                                    : 'text-rose-400';
                    
                    return (
                      <div key={idx} className={`p-4 rounded-xl border ${bgClass}`}>
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5 shrink-0">{statusIcon}</div>
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <h4 className={`font-bold font-mono text-xs uppercase tracking-wider ${textClass}`}>{rule.rule_name}</h4>
                              <div className="flex gap-2">
                                <span className="bg-slate-900/50 border border-slate-700/50 text-slate-400 text-[9px] px-2 py-0.5 rounded uppercase font-mono tracking-widest">
                                  {rule.category}
                                </span>
                                <span className={`border text-[9px] px-2 py-0.5 rounded uppercase font-mono tracking-widest font-bold ${bgClass} ${textClass}`}>
                                  {rule.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-300 text-xs font-mono leading-relaxed">{rule.message}</p>
                            
                            {rule.evidence && Object.keys(rule.evidence).length > 0 && (
                              <div className="mt-3 bg-slate-950/40 rounded-lg p-3 border border-slate-800/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                                  {Object.entries(rule.evidence).map(([k, v], i) => (
                                    <div key={i} className="flex justify-between gap-4">
                                      <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                                      <span className="text-slate-300 font-bold truncate max-w-[120px]" title={String(v)}>{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* FINAL VALIDATION SUMMARY */}
              <div className="bg-gradient-to-r from-slate-900/80 to-slate-950 border border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest mb-1">Final Validation Summary</h3>
                  {guardrail.decision_status === 'READY_TO_CONSIDER' || guardrail.decision_status === 'PASS' || guardrail.feasibility_status === 'FEASIBLE' ? (
                    <div className="text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-3">
                      <ShieldCheck className="w-8 h-8" /> DECISION VALIDATION COMPLETE
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-amber-400 tracking-tight flex items-center gap-3">
                      <AlertTriangle className="w-8 h-8" /> DECISION REQUIRES REVIEW
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="text-center">
                    <span className="block text-2xl font-bold font-mono text-emerald-400">{guardrail.passed_rules.length}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Passed</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-bold font-mono text-amber-400">{guardrail.warnings.length}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Warnings</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-2xl font-bold font-mono text-rose-400">{guardrail.violated_rules.length}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Violations</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </motion.section>

    </motion.div>
  );
};
