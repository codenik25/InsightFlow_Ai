import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, BarChart, TrendingUp, Activity, Maximize2 } from 'lucide-react';
import { DatasetUploadModal } from './DatasetUploadModal';
import { DatasetOverview } from './DatasetOverview';
import { DataQuality } from './DataQuality';
import { DataCleaning } from './DataCleaning';
import { DataAnalysis } from './DataAnalysis';
import { DataInsights } from './DataInsights';
import { DataPredictions } from './DataPredictions';
import { DataRecommendations } from './DataRecommendations';
import { DataOptimization } from './DataOptimization';
import { DataDecisions } from './DataDecisions';
import { DataGuardrails } from './DataGuardrails';

interface PlatformOverviewProps {
  activeTab: string;
  rawDatasetId?: string | null;
  processedDatasetId?: string | null;
  setRawDatasetId?: (id: string | null) => void;
  setProcessedDatasetId?: (id: string | null) => void;
  setCurrentStage?: (stage: string) => void;
  optimizationId?: string | null;
  setOptimizationId?: (id: string | null) => void;
}

export const PlatformOverview: React.FC<PlatformOverviewProps> = ({ activeTab, rawDatasetId, processedDatasetId, setRawDatasetId, setProcessedDatasetId, setCurrentStage, optimizationId, setOptimizationId }) => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let animationFrameId: number;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    
    const animate = () => {
      // time unused
      if (!mediaQuery.matches) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    if (!mediaQuery.matches) {
      animationFrameId = requestAnimationFrame(animate);
    }
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  const themeColor = useMemo(() => {
    switch (activeTab) {
      case 'UPLOAD':
      case 'OVERVIEW':
      case 'QUALITY':
      case 'CLEANING': return '#22D3EE';
      case 'ANALYSIS': return '#0EA5E9';
      case 'INSIGHTS': return '#3B82F6';
      case 'PREDICTIONS': return '#6366F1';
      case 'RECOMMENDATIONS': return '#8B5CF6';
      case 'OPTIMIZATION': return '#A855F7';
      case 'DECISIONS':
      case 'GUARDRAILS': return '#06B6D4';
      default: return '#22D3EE';
    }
  }, [activeTab]);

  const activeTitle = useMemo(() => {
    const titles: Record<string, string> = {
      UPLOAD: 'DATA INTELLIGENCE',
      OVERVIEW: 'DATASET OVERVIEW',
      QUALITY: 'DATA QUALITY',
      CLEANING: 'DATA CLEANING',
      ANALYSIS: 'DATA ANALYSIS',
      INSIGHTS: 'AI INSIGHTS',
      PREDICTIONS: 'PREDICTIVE ANALYTICS',
      RECOMMENDATIONS: 'RECOMMENDATIONS',
      OPTIMIZATION: 'OPTIMIZATION LAB',
      DECISIONS: 'DECISION INTELLIGENCE',
      GUARDRAILS: 'DECISION GUARDRAILS',
    };
    return titles[activeTab] || 'INTELLIGENCE WORKSPACE';
  }, [activeTab]);

  return (
    <div className="w-full h-full flex items-center justify-center relative p-8">
      
      {/* LANDING CONTENT ONLY RENDERED ON UPLOAD SCREEN */}
      {activeTab === 'UPLOAD' && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Top Left: Data Analysis */}
            <motion.div 
              whileHover={{ translateY: -3 }}
              className="absolute top-8 left-8 w-[280px] h-[160px] rounded-[16px] p-5 flex flex-col justify-between z-30 transition-all duration-300 group"
              style={{
                background: 'rgba(4,12,25,0.42)',
                border: '1px solid rgba(34,211,238,0.22)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(2,5,10,0.5), inset 0 0 20px rgba(34,211,238,0.05)'
              }}
            >
              <div className="flex justify-between items-start">
                <div className="font-mono text-[9px] text-slate-400 tracking-[0.2em] uppercase">DATA ANALYSIS</div>
                <LineChart className="w-4 h-4 text-accent-cyan group-hover:drop-shadow-[0_0_8px_#22D3EE] transition-all" />
              </div>
              <div>
                <div className="text-2xl font-sans font-light text-white mb-1">Revenue Growth</div>
                <div className="text-xl font-mono text-emerald-400">+24.8%</div>
              </div>
            </motion.div>

            {/* Bottom Left: AI Insights */}
            <motion.div 
              whileHover={{ translateY: -3 }}
              className="absolute bottom-8 left-8 w-[280px] h-[160px] rounded-[16px] p-5 flex flex-col justify-between z-30 transition-all duration-300 group"
              style={{
                background: 'rgba(4,12,25,0.42)',
                border: '1px solid rgba(34,211,238,0.22)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(2,5,10,0.5), inset 0 0 20px rgba(34,211,238,0.05)'
              }}
            >
              <div className="flex justify-between items-start">
                <div className="font-mono text-[9px] text-slate-400 tracking-[0.2em] uppercase">AI INSIGHTS</div>
                <BarChart className="w-4 h-4 text-accent-cyan group-hover:drop-shadow-[0_0_8px_#22D3EE] transition-all" />
              </div>
              <div>
                <div className="text-2xl font-sans font-light text-white mb-1">Patterns Detected</div>
                <div className="text-xl font-mono text-accent-cyan">93.7%</div>
              </div>
            </motion.div>

            {/* Top Right: Decision Impact */}
            <motion.div 
              whileHover={{ translateY: -3 }}
              className="absolute top-8 right-8 w-[280px] h-[160px] rounded-[16px] p-5 flex flex-col justify-between z-30 transition-all duration-300 group"
              style={{
                background: 'rgba(4,12,25,0.42)',
                border: '1px solid rgba(34,211,238,0.22)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(2,5,10,0.5), inset 0 0 20px rgba(34,211,238,0.05)'
              }}
            >
              <div className="flex justify-between items-start">
                <div className="font-mono text-[9px] text-slate-400 tracking-[0.2em] uppercase">DECISION IMPACT</div>
                <TrendingUp className="w-4 h-4 text-accent-cyan group-hover:drop-shadow-[0_0_8px_#22D3EE] transition-all" />
              </div>
              <div>
                <div className="text-2xl font-sans font-light text-white mb-1">Value Created</div>
                <div className="text-xl font-mono text-emerald-400">₹2.45 Cr</div>
              </div>
            </motion.div>

            {/* Bottom Right: System Status */}
            <motion.div 
              whileHover={{ translateY: -3 }}
              className="absolute bottom-8 right-8 w-[280px] h-[160px] rounded-[16px] p-5 flex flex-col justify-between z-30 transition-all duration-300 group"
              style={{
                background: 'rgba(4,12,25,0.42)',
                border: '1px solid rgba(34,211,238,0.22)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(2,5,10,0.5), inset 0 0 20px rgba(34,211,238,0.05)'
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="font-mono text-[9px] text-slate-400 tracking-[0.2em] uppercase">SYSTEM STATUS</div>
                <Activity className="w-4 h-4 text-accent-cyan group-hover:drop-shadow-[0_0_8px_#22D3EE] transition-all" />
              </div>
              <div className="space-y-2 flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-slate-300">Data Processing</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34D399]" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-slate-300">Model Running</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34D399]" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-slate-300">Insight Generating</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-[0_0_5px_#22D3EE] animate-pulse" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-slate-300">Decision Ready</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                </div>
              </div>
            </motion.div>

            {/* CENTRAL SVG INSIGHT ENGINE (Persistent) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              
              {/* Connection Network SVG */}
              <svg className="absolute inset-0 w-full h-full opacity-60">
                <defs>
                  <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={themeColor} stopOpacity="0.8"/>
                    <stop offset="100%" stopColor={themeColor} stopOpacity="0"/>
                  </radialGradient>
                </defs>
                
                {/* Curved Paths linking nodes to the center engine */}
                <path d="M 20% 50% Q 35% 30% 50% 50%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <path d="M 20% 50% Q 35% 70% 50% 50%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                
                <path d="M 80% 50% Q 65% 30% 50% 50%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <path d="M 80% 50% Q 65% 70% 50% 50%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                {/* Traveling Particles along the paths */}
                {!reducedMotion && (
                  <>
                    <circle r="2" fill={themeColor}>
                      <animateMotion dur="4s" repeatCount="indefinite" path="M 20% 50% Q 35% 30% 50% 50%" />
                    </circle>
                    <circle r="2" fill={themeColor}>
                      <animateMotion dur="4.5s" repeatCount="indefinite" path="M 20% 50% Q 35% 70% 50% 50%" />
                    </circle>
                    <circle r="2" fill={themeColor}>
                      <animateMotion dur="3.5s" repeatCount="indefinite" path="M 50% 50% Q 65% 30% 80% 50%" />
                    </circle>
                  </>
                )}
              </svg>

              {/* Orbiting Nodes */}
              <div className="absolute left-[20%] top-[50%] -translate-x-1/2 -translate-y-1/2 group pointer-events-auto">
                <div className="w-12 h-12 rounded-full border border-white/10 bg-[#02050A]/80 backdrop-blur flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-accent-cyan/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                  <div className="w-2 h-2 rounded-full bg-slate-500 group-hover:bg-accent-cyan transition-colors" />
                </div>
                <div className="absolute top-14 left-1/2 -translate-x-1/2 font-mono text-[9px] text-slate-400 group-hover:text-white transition-colors text-center w-24">DATA SIGNALS</div>
              </div>
              
              <div className="absolute right-[20%] top-[50%] translate-x-1/2 -translate-y-1/2 group pointer-events-auto">
                <div className="w-12 h-12 rounded-full border border-white/10 bg-[#02050A]/80 backdrop-blur flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-accent-cyan/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                  <div className="w-2 h-2 rounded-full bg-slate-500 group-hover:bg-emerald-400 transition-colors" />
                </div>
                <div className="absolute top-14 left-1/2 -translate-x-1/2 font-mono text-[9px] text-slate-400 group-hover:text-white transition-colors text-center w-24">DECISIONS</div>
              </div>

              {/* The Insight Engine Core */}
              <motion.div 
                className="relative flex items-center justify-center z-20 pointer-events-auto group cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <div className="absolute w-48 h-48 rounded-full border border-white/5 bg-[#02050A]/40 backdrop-blur-md" />
                <div className="absolute w-40 h-40 rounded-full border border-white/10 flex items-center justify-center">
                  <svg className="absolute w-full h-full text-white/5 animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                  </svg>
                </div>
                <div className="absolute w-32 h-32 rounded-full border border-accent-cyan/20 bg-gradient-to-br from-[#02050A] to-[#0A1929] flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)] group-hover:shadow-[0_0_50px_rgba(34,211,238,0.3)] transition-shadow">
                  <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center">
                    <div className="font-sans font-bold text-lg text-white tracking-wider mb-1">INSIGHT</div>
                    <div className="font-mono text-[10px] text-accent-cyan tracking-[0.2em] uppercase">ENGINE</div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Application Header Title */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none">
              <h1 className="text-[10px] font-mono font-bold tracking-[0.3em] text-slate-500 mb-2 uppercase">Google InsightFlow</h1>
              <motion.h2 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-sans font-light text-white tracking-tight text-center drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                {activeTitle}
              </motion.h2>
              <motion.h2
                key={`${activeTab}-sub`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm font-mono text-slate-400 mt-3"
              >
                {activeTab === 'UPLOAD' && 'Upload dataset to begin analysis.'}
              </motion.h2>
            </div>

            {/* Dynamic Content Panel (Changes based on route) */}
            <div className="w-full max-w-3xl mt-auto pointer-events-auto absolute bottom-12 left-1/2 -translate-x-1/2">
              <div className="w-full rounded-2xl bg-[#040C19]/50 backdrop-blur-xl border border-white/10 p-8 shadow-2xl relative overflow-hidden group hover:border-accent-cyan/30 transition-colors">
                <div 
                  className="absolute inset-0 opacity-10 mix-blend-screen pointer-events-none transition-colors duration-1000"
                  style={{ background: `radial-gradient(circle at top right, ${themeColor}, transparent 50%)` }}
                />
                
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="font-mono text-[10px] text-slate-400 tracking-[0.2em] uppercase mb-2">ACTIVE INVESTIGATION</h3>
                    <div className="text-xl font-sans text-white">
                      Waiting for dataset
                    </div>
                  </div>
                  
                  <div className="flex gap-8 text-right">
                    <div>
                      <div className="font-mono text-[9px] text-slate-500 tracking-wider mb-1">IMPACT</div>
                      <div className="font-mono text-sm text-emerald-400">+24.8%</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-slate-500 tracking-wider mb-1">CONFIDENCE</div>
                      <div className="font-mono text-sm text-white">93.7%</div>
                    </div>
                    <button className="h-10 w-10 flex items-center justify-center rounded border border-white/10 hover:bg-white/5 transition-colors">
                      <Maximize2 className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Decorative data lines representing content */}
                <div className="mt-8 space-y-3">
                  <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-accent-cyan w-[75%]" />
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-blue-500 w-[45%]" />
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-violet-500 w-[60%]" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* WORKFLOW CONTAINER - ensures content fits within viewport */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden flex flex-col items-center custom-scrollbar">

        {activeTab === 'UPLOAD' && (
          <div className="mt-[200px] z-30 pointer-events-auto">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-8 py-4 bg-gradient-to-r from-accent-cyan to-accent-blue hover:from-accent-cyan/80 hover:to-accent-blue/80 text-white rounded-xl text-lg font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              UPLOAD DATASET
            </button>
          </div>
        )}

        {activeTab === 'OVERVIEW' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DatasetOverview 
              rawDatasetId={rawDatasetId || null} 
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'QUALITY' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataQuality 
              rawDatasetId={rawDatasetId || null} 
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'CLEANING' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataCleaning 
              rawDatasetId={rawDatasetId || null} 
              setProcessedDatasetId={setProcessedDatasetId}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'ANALYSIS' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataAnalysis 
              processedDatasetId={processedDatasetId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'INSIGHTS' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataInsights 
              processedDatasetId={processedDatasetId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'PREDICTIONS' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataPredictions 
              processedDatasetId={processedDatasetId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'RECOMMENDATIONS' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataRecommendations 
              processedDatasetId={processedDatasetId || null}
              optimizationId={optimizationId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'OPTIMIZATION' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataOptimization 
              processedDatasetId={processedDatasetId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
              setOptimizationId={setOptimizationId}
            />
          </div>
        )}

        {activeTab === 'DECISIONS' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataDecisions 
              processedDatasetId={processedDatasetId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

        {activeTab === 'GUARDRAILS' && (
          <div className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20">
            <DataGuardrails 
              processedDatasetId={processedDatasetId || null}
              setCurrentStage={setCurrentStage || (() => {})} 
            />
          </div>
        )}

      </div>

      <DatasetUploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={(profile) => {
          if (setRawDatasetId) setRawDatasetId(profile.dataset_id);
          if (setCurrentStage) setCurrentStage('OVERVIEW');
          setIsUploadModalOpen(false);
        }}
      />
    </div>
  );
};
