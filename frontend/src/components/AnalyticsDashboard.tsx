import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertCircle, Database, ChevronRight, ArrowRight, Brain, Loader2, TrendingDown, Activity, ChevronDown } from 'lucide-react';
import { EDAResponse, InsightResponse } from '../types';
import { fetchEDA, generateEDA, fetchInsights, generateInsights } from '../services/api';
import { KpiCardsGrid } from './KpiCardsGrid';
import { PremiumChartWorkspace } from './PremiumChartWorkspace';

interface AnalyticsDashboardProps {
  datasetId: string;
  onNavigate?: (tab: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ datasetId, onNavigate }) => {
  const [edaData, setEdaData] = useState<EDAResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pattern Detection State
  const [patternType, setPatternType] = useState('All Patterns');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [patternResult, setPatternResult] = useState<InsightResponse | null>(null);
  const [patternError, setPatternError] = useState<string | null>(null);

  const loadEDA = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEDA(datasetId);
      setEdaData(data);
    } catch (err: any) {
      console.warn('Failed to load EDA analysis, attempting generation:', err);
      try {
        const genData = await generateEDA(datasetId);
        setEdaData(genData);
      } catch (genErr: any) {
        setErrorMsg(genErr.message || 'Unable to generate automated EDA analysis.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadEDA();
  }, [loadEDA]);

  const handleRecalculate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const genData = await generateEDA(datasetId);
      setEdaData(genData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Recalculation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setPatternError(null);
    try {
      // For pattern detection, we leverage the Insights endpoint which uses ML to find patterns
      let res: InsightResponse;
      try {
        res = await fetchInsights(datasetId);
      } catch (e) {
        res = await generateInsights(datasetId);
      }
      setPatternResult(res);
    } catch (err: any) {
      setPatternError(err.message || 'Failed to detect patterns.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border border-slate-800" />
          <div className="absolute inset-0 rounded-full border-t border-accent-cyan animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent-cyan" />
          </div>
        </div>
        <span className="font-bold text-white uppercase tracking-widest text-sm mb-2">Analyzing Processed Dataset</span>
        <p className="text-slate-500 max-w-md">Discovering metrics, calculating trends, and rendering visual workspaces.</p>
      </div>
    );
  }

  if (errorMsg || !edaData) {
    return (
      <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit mx-auto text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white uppercase tracking-widest">Cleaning & Processing Required</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {errorMsg || 'Automated EDA requires a processed dataset. Please apply a cleaning plan to generate a cleaned dataset version first.'}
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg border border-slate-700 transition-colors"
        >
          Try Reloading Analysis
        </button>
      </div>
    );
  }

  const { overview_kpis, discovered_kpis, category_breakdowns, trends } = edaData;

  // Filter insights based on patternType
  const getFilteredPatterns = () => {
    if (!patternResult) return [];
    if (patternType === 'All Patterns') return patternResult.insights;
    if (patternType === 'Seasonal Trends') return patternResult.insights.filter(i => i.category === 'TREND');
    if (patternType === 'Anomalies') return patternResult.insights.filter(i => i.category === 'ANOMALY');
    if (patternType === 'Correlation Patterns') return patternResult.insights.filter(i => i.category === 'CORRELATION');
    if (patternType === 'Category Performance') return patternResult.insights.filter(i => i.category === 'PERFORMANCE');
    return patternResult.insights;
  };

  const filteredPatterns = getFilteredPatterns();
  const primaryInsight = filteredPatterns.length > 0 ? filteredPatterns[0] : null;
  const topPatterns = filteredPatterns.slice(1, 5);

  return (
    <div className="max-w-[1750px] mx-auto px-6 space-y-12 animate-fadeIn pb-32">
      {/* 01 — HEADER / DATASET CONTEXT */}
      <div className="flex flex-col gap-6 pt-8">
        <div className="flex items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest gap-2">
          <span>Data Intelligence</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-accent-cyan font-bold">Analysis</span>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-6 pb-4">
          <div className="space-y-2">
            <h1 className="text-[52px] lg:text-[64px] font-[800] text-white tracking-tighter leading-none font-sans">
              Data <span className="text-accent-cyan">Analysis</span>
            </h1>
            <p className="text-lg text-slate-400 font-light tracking-tight max-w-2xl mt-2 font-sans">
              Explore patterns, trends and relationships in your data to uncover actionable insights.
            </p>
          </div>
          
          <div className="flex items-center gap-6 bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-[rgba(34,211,238,0.2)] rounded-2xl p-4 shadow-lg h-full">
            <div className="flex items-center gap-4 border-r border-slate-700 pr-6">
               <div className="p-3 bg-accent-blue/10 rounded-xl">
                 <Database className="w-6 h-6 text-accent-blue" />
               </div>
               <div className="flex flex-col">
                 <span className="text-white font-bold text-sm truncate max-w-[200px]">{datasetId}</span>
                 <span className="text-slate-500 text-[10px] uppercase font-mono tracking-widest mt-0.5">Uploaded Dataset</span>
               </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-white font-bold text-lg">{overview_kpis.total_rows.toLocaleString()}</span>
              <span className="text-accent-cyan font-mono text-[10px] uppercase tracking-widest">ROWS</span>
            </div>
            <div className="flex flex-col items-center pl-4 border-l border-slate-700">
              <span className="text-white font-bold text-lg">{overview_kpis.total_columns}</span>
              <span className="text-accent-cyan font-mono text-[10px] uppercase tracking-widest">COLUMNS</span>
            </div>
            <div className="pl-6 flex items-center">
               <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                 <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Processed</span>
                 <ChevronDown className="w-3 h-3 text-emerald-400" />
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-slate-800 via-slate-800/50 to-transparent" />

      {/* 02 — KPI INTELLIGENCE */}
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <KpiCardsGrid kpis={discovered_kpis} trends={trends} />
      </motion.div>

      {/* 03 — PRIMARY SIGNAL */}
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
        <PremiumChartWorkspace trends={trends} categories={category_breakdowns} />
      </motion.div>

      {/* 04, 05, 06 — PATTERN DETECTION & INSIGHTS GRID */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
        className="pt-8 relative"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 04 — PATTERN DETECTION (Left Column) */}
          <div className="lg:col-span-4 bg-[rgba(4,12,25,0.45)] backdrop-blur-md border border-[rgba(34,211,238,0.2)] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-accent-violet/10 rounded-lg">
                <Brain className="w-5 h-5 text-accent-violet" />
              </div>
              <div>
                <h2 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">PATTERN DETECTION</h2>
                <h3 className="text-xl font-bold text-white tracking-tight">Find Hidden Patterns</h3>
              </div>
            </div>
            
            <p className="text-sm text-slate-400 font-sans mb-8 leading-relaxed">
              Let AI analyze your data and discover meaningful patterns, hidden correlations, and critical anomalies.
            </p>
            
            <div className="mt-auto space-y-4">
              <div className="relative">
                <select 
                  value={patternType}
                  onChange={(e) => setPatternType(e.target.value)}
                  className="w-full appearance-none bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3.5 pr-10 text-sm font-medium text-slate-200 outline-none hover:border-slate-500 cursor-pointer transition-colors focus:border-accent-cyan"
                >
                  <option value="All Patterns">All Patterns</option>
                  <option value="Seasonal Trends">Seasonal Trends</option>
                  <option value="Anomalies">Anomalies</option>
                  <option value="Correlation Patterns">Correlation Patterns</option>
                  <option value="Category Performance">Category Performance</option>
                  <option value="Growth/Decline Patterns">Growth/Decline Patterns</option>
                </select>
                <ChevronDown className="w-5 h-5 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              
              <button 
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-accent-violet to-accent-blue hover:from-accent-violet hover:to-[#22D3EE] text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    RUNNING ANALYSIS...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    RUN ANALYSIS
                  </>
                )}
              </button>
              
              {patternError && (
                <div className="mt-2 text-rose-400 text-xs text-center font-mono">
                  {patternError} - Try again
                </div>
              )}
            </div>
          </div>

          {/* 05 — KEY INSIGHTS (Middle Column) */}
          <div className="lg:col-span-4 bg-[rgba(4,12,25,0.45)] backdrop-blur-md border border-[rgba(34,211,238,0.2)] rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6 relative z-10">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-rose-500" />
                 <h2 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">KEY INSIGHTS</h2>
               </div>
               {primaryInsight && (
                 <button className="text-[10px] font-mono text-accent-cyan uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1">
                   View All <ArrowRight className="w-3 h-3" />
                 </button>
               )}
            </div>

            {primaryInsight ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col justify-center relative z-10">
                 <h3 className="text-2xl font-bold text-white tracking-tight leading-tight mb-3">
                   {primaryInsight.title}
                 </h3>
                 <div className="flex items-baseline gap-2 mb-4">
                   <span className="text-[40px] font-black text-rose-400 tracking-tighter leading-none">
                     {primaryInsight.percentage_change ? `${primaryInsight.percentage_change}%` : primaryInsight.metric_value ? primaryInsight.metric_value.toLocaleString() : 'HIGH'}
                   </span>
                 </div>
                 <p className="text-sm text-slate-400 font-sans leading-relaxed">
                   {primaryInsight.explanation || primaryInsight.observation}
                 </p>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 relative z-10">
                 <Activity className="w-10 h-10 text-slate-600 mb-3" />
                 <p className="text-sm text-slate-400">Run analysis to generate key insights</p>
              </div>
            )}
            
            {/* Soft background glow */}
            <div className="absolute -bottom-[30%] -right-[30%] w-full h-full bg-rose-500/5 blur-[100px] pointer-events-none" />
          </div>

          {/* 06 — TOP PATTERNS (Right Column) */}
          <div className="lg:col-span-4 bg-[rgba(4,12,25,0.45)] backdrop-blur-md border border-[rgba(34,211,238,0.2)] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-accent-cyan" />
              <h2 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">TOP PATTERNS (AI DETECTED)</h2>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              {topPatterns.length > 0 ? (
                <AnimatePresence>
                  {topPatterns.map((pattern, idx) => (
                    <motion.div 
                      key={pattern.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-4 overflow-hidden pr-2">
                        <div className={`p-2 rounded-full flex-shrink-0 ${pattern.category === 'TREND' ? 'bg-amber-500/10 text-amber-400' : pattern.category === 'ANOMALY' ? 'bg-rose-500/10 text-rose-400' : pattern.category === 'CORRELATION' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {pattern.category === 'TREND' ? <TrendingDown className="w-4 h-4" /> : pattern.category === 'ANOMALY' ? <AlertCircle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <span className="text-sm text-slate-200 font-medium truncate group-hover:text-white transition-colors">
                          {pattern.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          {pattern.category}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-accent-cyan transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                   <p className="text-sm text-slate-400">No patterns detected yet. Run analysis to discover.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 07 — CONTINUE TO NEXT DECISION STAGE */}
      {onNavigate && (
        <div className="flex justify-end pt-12 border-t border-slate-800/50">
          <button
            onClick={() => onNavigate('insights')}
            className="group relative flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-accent-cyan via-[#3B82F6] to-accent-violet rounded-full overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="font-sans font-bold text-[13px] tracking-widest text-white uppercase relative z-10 flex items-center gap-2">
              NEXT <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
