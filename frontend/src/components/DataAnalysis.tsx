import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchEDA, generateEDA } from '../services/api';
import { EDAResponse } from '../types';
import { KpiCardsGrid } from './KpiCardsGrid';
import { PremiumChartWorkspace } from './PremiumChartWorkspace';
import { CorrelationMatrixView } from './CorrelationMatrixView';
import { CategoryAnalysisView } from './CategoryAnalysisView';
import { DistributionShapeView } from './DistributionShapeView';

interface DataAnalysisProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataAnalysis: React.FC<DataAnalysisProps> = ({ processedDatasetId, setCurrentStage }) => {
  const [edaData, setEdaData] = useState<EDAResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const loadEDA = useCallback(async () => {
    if (!processedDatasetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEDA(processedDatasetId);
      setEdaData(data);
    } catch (err: any) {
      console.warn('Failed to load existing EDA, attempting to generate...', err);
      try {
        const genData = await generateEDA(processedDatasetId);
        setEdaData(genData);
      } catch (genErr: any) {
        setErrorMsg(genErr.message || 'Unable to generate EDA for the processed dataset.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadEDA();
  }, [loadEDA]);

  if (!processedDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">NO PROCESSED DATASET</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">Analysis requires a processed dataset artifact from the Cleaning stage.</p>
        <button 
          onClick={() => setCurrentStage('CLEANING')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO CLEANING
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
          <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Analyzing Processed Dataset</h3>
          <p className="text-slate-400 font-mono text-xs">Computing statistical distributions, correlations, and identifying visual patterns.</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !edaData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center bg-slate-900/50 border border-rose-500/20 rounded-3xl p-8 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight uppercase">Analysis Failed</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">{errorMsg}</p>
        <button 
          onClick={loadEDA}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          RETRY ANALYSIS
        </button>
      </div>
    );
  }

  const { overview_kpis, discovered_kpis, category_breakdowns, trends, relationships, distributions } = edaData;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  } as any;

  return (
    <div className="relative min-h-full w-full rounded-2xl overflow-hidden">
      {/* CINEMATIC BACKGROUND LAYER */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#02060D]">
        {/* Base deep navy gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030B16] via-[#02060D] to-[#02060D]" />
        
        {/* Atmospheric Glows */}
        <div className="absolute inset-0 overflow-hidden">
          {/* cyan top */}
          <motion.div 
            className="absolute top-[5%] left-[10%] w-[800px] h-[800px] bg-[#22D3EE]/10 rounded-full blur-[150px] mix-blend-screen"
            animate={!reducedMotion ? { x: [0, 50, 0], y: [0, 30, 0], opacity: [0.8, 1, 0.8] } : {}}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* blue middle */}
          <motion.div 
            className="absolute top-[40%] right-[10%] w-[900px] h-[900px] bg-[#3B82F6]/10 rounded-full blur-[150px] mix-blend-screen"
            animate={!reducedMotion ? { x: [0, -40, 0], y: [0, 50, 0], opacity: [0.7, 0.9, 0.7] } : {}}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* violet bottom */}
          <motion.div 
            className="absolute bottom-[10%] left-[20%] w-[800px] h-[800px] bg-[#8B5CF6]/10 rounded-full blur-[150px] mix-blend-screen"
            animate={!reducedMotion ? { x: [0, 40, 0], y: [0, -30, 0], opacity: [0.6, 0.8, 0.6] } : {}}
            transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Technical grid */}
        <motion.div 
          className="absolute inset-[-10%] w-[120%] h-[120%]"
          animate={!reducedMotion ? { y: [-20, 20], x: [-10, 10] } : {}}
          transition={{ duration: 60, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        >
          <div 
            className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.02)_1px,transparent_1px)] bg-[size:60px_60px]"
            style={{ maskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)' }}
          />
        </motion.div>

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(2,6,13,0.8)_100%)]" />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full min-w-0 mx-auto space-y-12 pb-24 px-6 pt-6"
      >
        {/* 01 — HEADER */}
        <motion.section variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/60 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">ANALYSIS / VISUALIZATION</h1>
            <p className="text-slate-400 font-mono text-sm max-w-xl">
              Explore the structure, distributions, relationships, and trends within the processed dataset.
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
              onClick={() => setCurrentStage('CLEANING')}
              className="px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
            >
              ← BACK TO CLEANING
            </button>
          </div>
        </motion.section>

        {/* 02 — DATASET SNAPSHOT */}
        <motion.section variants={itemVariants} className="glass-panel-premium p-8">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Dataset Snapshot</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Rows</div>
              <div className="text-3xl font-mono text-white tracking-tight">{overview_kpis.total_rows.toLocaleString()}</div>
            </div>
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Columns</div>
              <div className="text-3xl font-mono text-white tracking-tight">{overview_kpis.total_columns}</div>
            </div>
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Numeric</div>
              <div className="text-3xl font-mono text-cyan-400 tracking-tight">{overview_kpis.measure_count}</div>
            </div>
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Categorical</div>
              <div className="text-3xl font-mono text-violet-400 tracking-tight">{overview_kpis.dimension_count}</div>
            </div>
          </div>
        </motion.section>

        {/* 03 — METRICS GRID */}
        {discovered_kpis && discovered_kpis.length > 0 && (
          <motion.section variants={itemVariants} className="min-w-0">
            <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Key Discovered Metrics</h2>
            <KpiCardsGrid kpis={discovered_kpis} trends={trends} />
          </motion.section>
        )}

        {/* 04 — PRIMARY VISUALIZATION WORKSPACE */}
        <motion.section variants={itemVariants} className="min-w-0">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Primary Signals</h2>
          <div className="glass-panel-premium overflow-hidden">
            <PremiumChartWorkspace trends={trends} categories={category_breakdowns} />
          </div>
        </motion.section>

        {/* 05 — DETAILED ANALYSIS (Correlations & Categories) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 min-w-0">
          <motion.section variants={itemVariants} className="min-w-0">
            <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Correlation Matrix</h2>
            {relationships && relationships.length > 0 ? (
              <div className="glass-panel-premium overflow-hidden">
                <CorrelationMatrixView relationships={relationships} />
              </div>
            ) : (
              <div className="glass-panel-premium p-8 text-center">
                <p className="text-slate-500 text-sm font-mono">No numerical correlation data available for this dataset.</p>
              </div>
            )}
          </motion.section>

          <motion.section variants={itemVariants} className="min-w-0">
            <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Category Breakdown</h2>
            {category_breakdowns && category_breakdowns.length > 0 ? (
              <div className="glass-panel-premium overflow-hidden">
                <CategoryAnalysisView breakdowns={category_breakdowns} />
              </div>
            ) : (
              <div className="glass-panel-premium p-8 text-center">
                <p className="text-slate-500 text-sm font-mono">No categorical variables available for category analysis.</p>
              </div>
            )}
          </motion.section>
        </div>

        {/* 06 — DISTRIBUTION & SHAPE (Full Width) */}
        <div className="min-w-0">
          <DistributionShapeView distributions={distributions || []} />
        </div>

        {/* 07 — CONTINUE TO INSIGHTS */}
        <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-[rgba(34,211,238,0.12)] mt-12">
          <button
            onClick={() => setCurrentStage('INSIGHTS')}
            className="px-8 py-3.5 primary-glow-button rounded-full text-white text-[15px] font-sans font-semibold tracking-wide flex items-center gap-2"
          >
            CONTINUE TO INSIGHTS
            <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </motion.div>

      </motion.div>
    </div>
  );
};

