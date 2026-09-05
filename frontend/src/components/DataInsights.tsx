import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchInsights, generateInsights } from '../services/api';
import { InsightResponse } from '../types';
import { 
  Lightbulb, 
  ShieldCheck, 
  TrendingUp, 
  GitCommit, 
  Award, 
  Sparkles, 
  AlertCircle,
  Database,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from 'lucide-react';

interface DataInsightsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataInsights: React.FC<DataInsightsProps> = ({ processedDatasetId, setCurrentStage }) => {
  const [insightData, setInsightData] = useState<InsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    if (!processedDatasetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchInsights(processedDatasetId);
      setInsightData(data);
    } catch (err: any) {
      console.warn('Failed to load existing insights, attempting to generate...', err);
      try {
        const genData = await generateInsights(processedDatasetId);
        setInsightData(genData);
      } catch (genErr: any) {
        setErrorMsg(genErr.message || 'Unable to generate insights for the processed dataset.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Insights require a processed dataset artifact from the Analysis stage.</p>
        <button 
          onClick={() => setCurrentStage('ANALYSIS')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO ANALYSIS
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
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Extracting Insights</h3>
          <p className="text-slate-400 font-mono text-xs">Evaluating evidence, cross-referencing analysis, and generating business signals.</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !insightData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center bg-slate-900/50 border border-rose-500/20 rounded-3xl p-8 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Insight Generation Failed</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">{errorMsg}</p>
        <button 
          onClick={loadInsights}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          RETRY GENERATION
        </button>
      </div>
    );
  }

  const { summary, insights } = insightData;

  // Sorting insights by priority (highest first)
  const sortedInsights = [...insights].sort((a, b) => b.priority_score - a.priority_score);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">CRITICAL</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">WARNING</span>;
      case 'POSITIVE':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">POSITIVE</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">INFO</span>;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'PERFORMANCE': return <Award className="w-4 h-4 text-emerald-400" />;
      case 'TREND': return <TrendingUp className="w-4 h-4 text-violet-400" />;
      case 'CORRELATION': return <GitCommit className="w-4 h-4 text-sky-400" />;
      case 'DATA_QUALITY': return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      case 'OPPORTUNITY': return <Lightbulb className="w-4 h-4 text-amber-400" />;
      default: return <Sparkles className="w-4 h-4 text-slate-400" />;
    }
  };

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
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">INSIGHTS</h1>
          <p className="text-slate-400 font-mono text-sm max-w-xl">
            Evidence-backed signals extracted from the processed dataset.
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
            onClick={() => setCurrentStage('ANALYSIS')}
            className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
          >
            ← BACK TO ANALYSIS
          </button>
        </div>
      </motion.section>

      {/* 02 — INSIGHTS SUMMARY GRID */}
      <motion.section variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-sm">
          <div className="text-emerald-400 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Positive Signals</div>
          <div className="text-4xl font-mono text-white tracking-tight">{summary.positive_count}</div>
        </div>
        <div className="bg-slate-900/40 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-sm">
          <div className="text-amber-400 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Warning Signals</div>
          <div className="text-4xl font-mono text-white tracking-tight">{summary.warning_count}</div>
        </div>
        <div className="bg-slate-900/40 border border-rose-500/20 rounded-3xl p-8 backdrop-blur-sm">
          <div className="text-rose-400 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Critical Signals</div>
          <div className="text-4xl font-mono text-white tracking-tight">{summary.critical_count}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm flex flex-col justify-center items-center text-center">
          <button 
            onClick={loadInsights}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest font-mono transition-colors"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" /> REGENERATE
          </button>
        </div>
      </motion.section>

      {/* 03 — INSIGHTS FEED */}
      <motion.section variants={itemVariants}>
        <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80 flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-400" /> Extracted Insights ({sortedInsights.length})
        </h2>
        
        {sortedInsights.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center">
             <p className="text-slate-500 font-mono text-sm">No insight records were returned for this dataset.</p>
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
            {sortedInsights.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} className="border-b border-slate-800/60 last:border-0 transition-colors">
                  {/* Compact Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className={`w-full flex flex-col md:flex-row md:items-center justify-between p-6 hover:bg-slate-800/40 transition-colors text-left gap-4 ${isExpanded ? 'bg-slate-800/40' : ''}`}
                  >
                    <div className="flex items-start md:items-center gap-4 flex-1">
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">{item.category}</span>
                          {getSeverityBadge(item.severity)}
                        </div>
                        <h4 className="text-base font-bold text-white tracking-tight">{item.title}</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 shrink-0 self-start md:self-auto pl-[52px] md:pl-0">
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 font-mono block uppercase tracking-wider mb-1">Priority</span>
                        <span className="text-lg font-bold text-cyan-400 font-mono leading-none">{item.priority_score}</span>
                      </div>
                      <div className="text-slate-500 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Detail Workspace */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden bg-slate-950/40 border-t border-slate-800/60"
                      >
                        <div className="p-6 pl-[52px] md:pl-[88px] space-y-6">
                          
                          {/* Observation / Explanation */}
                          <div>
                            <p className="text-sm text-slate-300 font-sans leading-relaxed max-w-4xl">{item.observation}</p>
                          </div>
                          
                          {/* Evidence Block */}
                          {item.evidence && (
                            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 font-mono max-w-4xl">
                              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-4 flex items-center gap-2">
                                <Database className="w-3.5 h-3.5" /> Calculated Evidence
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                                {item.evidence.dimension && (
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Dimension</span>
                                    <span className="text-white font-bold">{item.evidence.dimension}</span>
                                  </div>
                                )}
                                {item.evidence.metric && (
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Metric</span>
                                    <span className="text-white font-bold">{item.evidence.metric}</span>
                                  </div>
                                )}
                                {item.evidence.correlation !== undefined && item.evidence.correlation !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Correlation (r)</span>
                                    <span className="text-cyan-400 font-bold text-sm">{item.evidence.correlation}</span>
                                  </div>
                                )}
                                {item.evidence.top_value !== undefined && item.evidence.top_value !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Top Value</span>
                                    <span className="text-emerald-400 font-bold text-sm">
                                      {typeof item.evidence.top_value === 'number'
                                        ? item.evidence.top_value.toLocaleString()
                                        : String(item.evidence.top_value)}
                                    </span>
                                  </div>
                                )}
                                {item.evidence.contribution_percent !== undefined && item.evidence.contribution_percent !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Contribution</span>
                                    <span className="text-violet-400 font-bold text-sm">{item.evidence.contribution_percent}%</span>
                                  </div>
                                )}
                                {item.evidence.sample_size !== undefined && item.evidence.sample_size !== null && (
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Sample Size</span>
                                    <span className="text-slate-300 font-bold text-sm">{item.evidence.sample_size.toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Deeper Explanation */}
                          {item.explanation && (
                            <div className="flex items-start gap-3 bg-slate-900/50 p-5 rounded-2xl border border-slate-800/50 max-w-4xl">
                              <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />
                              <div>
                                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Interpretation</h5>
                                <p className="text-sm text-slate-300 font-sans leading-relaxed">{item.explanation}</p>
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* 04 — CONTINUE TO PREDICTIONS */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-slate-800/60 mt-12">
        <button
          onClick={() => setCurrentStage('PREDICTIONS')}
          className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-200 rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          CONTINUE TO PREDICTIONS
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </motion.div>

    </motion.div>
  );
};
