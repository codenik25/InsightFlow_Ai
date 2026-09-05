import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, BarChart, TrendingUp, Activity, Search, Target, BrainCircuit, Settings, CheckCircle2 } from 'lucide-react';
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
    <div className="w-full h-full flex items-center justify-center relative bg-transparent overflow-hidden">


      {/* LANDING CONTENT ONLY RENDERED ON UPLOAD SCREEN */}
      {activeTab === 'UPLOAD' && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col p-6 xl:p-10 pointer-events-none"
          >
            {/* 1. HEADER / HERO ZONE */}
            <div className="w-full max-w-[1400px] mx-auto flex justify-between items-start shrink-0 pt-2 relative z-20">
              
              {/* Top Left: Data Analysis */}
              <motion.div className="w-[260px] rounded-[16px] p-5 flex flex-col justify-between group glass-panel-premium pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="font-mono text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">DATA ANALYSIS</div>
                  <LineChart className="w-4 h-4 text-accent-cyan group-hover:drop-shadow-[0_0_8px_#22D3EE] transition-all" />
                </div>
                <div>
                  <div className="text-[17px] font-sans font-medium text-white mb-2">Dataset Status</div>
                  {rawDatasetId ? (
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-accent-success shadow-[0_0_8px_#22C55E]" />
                       <div className="text-sm font-mono text-accent-success font-bold">Analysis Ready</div>
                     </div>
                  ) : (
                     <div className="flex items-center gap-2 opacity-50">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                       <div className="text-xs font-mono text-slate-500">AWAITING DATA</div>
                     </div>
                  )}
                </div>
              </motion.div>

              {/* Center: Hero Text & CTA */}
              <div className="flex-1 flex flex-col items-center justify-start text-center px-8 z-20 pointer-events-none -mt-1">
                <h1 className="text-[11px] font-mono font-bold tracking-[0.3em] text-slate-500 mb-3 uppercase drop-shadow-sm">TURN DATA INTO DECISIONS</h1>
                <motion.h2 
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl md:text-5xl lg:text-[52px] font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-electricBlue to-accent-brightViolet drop-shadow-[0_0_20px_rgba(34,211,238,0.15)] mb-4 leading-tight"
                >
                  {activeTitle}
                </motion.h2>
                <motion.p
                  key={`${activeTab}-sub`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-[15px] font-sans text-slate-400 max-w-xl leading-relaxed mb-6"
                >
                  Upload your dataset and let InsightFlow AI uncover signals, patterns and decisions that drive real impact.
                </motion.p>
                <div className="pointer-events-auto">
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-7 py-3 primary-glow-button rounded-full text-white text-[14px] font-sans font-semibold tracking-wide flex items-center gap-2 shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Dataset
                    <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Top Right: Decision Impact */}
              <motion.div className="w-[260px] rounded-[16px] p-5 flex flex-col justify-between group glass-panel-premium pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="font-mono text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">DECISION IMPACT</div>
                  <TrendingUp className="w-4 h-4 text-accent-electricBlue group-hover:drop-shadow-[0_0_8px_#3B82F6] transition-all" />
                </div>
                <div>
                  <div className="text-[17px] font-sans font-medium text-white mb-2">Value Created</div>
                  {optimizationId ? (
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_8px_#22D3EE]" />
                       <div className="text-sm font-mono text-accent-cyan font-bold">Optimization Active</div>
                     </div>
                  ) : (
                     <div className="flex items-center gap-2 opacity-50">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                       <div className="text-xs font-mono text-slate-500">PENDING ACTION</div>
                     </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* 2. CENTRAL INTELLIGENCE NETWORK ZONE */}
            <div className="flex-1 w-full max-w-[1100px] mx-auto relative min-h-[350px] my-2 z-10">
              
              {/* SVG Flow Paths */}
              <svg className="absolute inset-0 w-full h-full opacity-90 z-0 pointer-events-none overflow-visible">
                <defs>
                  <linearGradient id="flow-left" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.05)" />
                    <stop offset="100%" stopColor="rgba(34,211,238,0.7)" />
                  </linearGradient>
                  <linearGradient id="flow-right" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(139,92,246,0.7)" />
                    <stop offset="100%" stopColor="rgba(59,130,246,0.05)" />
                  </linearGradient>
                </defs>
                
                {/* Inputs (Left to Center[x:50, y:50]) */}
                <path d="M 12% 20% C 25% 20%, 35% 50%, 43% 50%" fill="none" stroke="url(#flow-left)" strokeWidth="1.5" />
                <path d="M 12% 40% C 25% 40%, 35% 50%, 43% 50%" fill="none" stroke="url(#flow-left)" strokeWidth="1.5" />
                <path d="M 12% 60% C 25% 60%, 35% 50%, 43% 50%" fill="none" stroke="url(#flow-left)" strokeWidth="1.5" />
                <path d="M 12% 80% C 25% 80%, 35% 50%, 43% 50%" fill="none" stroke="url(#flow-left)" strokeWidth="1.5" />

                {/* Outputs (Center[x:50, y:50] to Right) */}
                <path d="M 57% 50% C 65% 50%, 75% 20%, 88% 20%" fill="none" stroke="url(#flow-right)" strokeWidth="1.5" />
                <path d="M 57% 50% C 65% 50%, 75% 40%, 88% 40%" fill="none" stroke="url(#flow-right)" strokeWidth="1.5" />
                <path d="M 57% 50% C 65% 50%, 75% 60%, 88% 60%" fill="none" stroke="url(#flow-right)" strokeWidth="1.5" />
                <path d="M 57% 50% C 65% 50%, 75% 80%, 88% 80%" fill="none" stroke="url(#flow-right)" strokeWidth="1.5" />

                {/* Animated Particles */}
                {!reducedMotion && (
                  <>
                    <circle r="2.5" fill="#22D3EE" filter="drop-shadow(0 0 6px #22D3EE)">
                      <animateMotion dur="4s" repeatCount="indefinite" path="M 12% 20% C 25% 20%, 35% 50%, 43% 50%" />
                    </circle>
                    <circle r="2" fill="#22D3EE" filter="drop-shadow(0 0 4px #22D3EE)">
                      <animateMotion dur="5.5s" repeatCount="indefinite" path="M 12% 40% C 25% 40%, 35% 50%, 43% 50%" />
                    </circle>
                    <circle r="2.5" fill="#22D3EE" filter="drop-shadow(0 0 6px #22D3EE)">
                      <animateMotion dur="4.5s" repeatCount="indefinite" path="M 12% 60% C 25% 60%, 35% 50%, 43% 50%" />
                    </circle>
                    <circle r="2" fill="#22D3EE" filter="drop-shadow(0 0 4px #22D3EE)">
                      <animateMotion dur="6s" repeatCount="indefinite" path="M 12% 80% C 25% 80%, 35% 50%, 43% 50%" />
                    </circle>

                    <circle r="2.5" fill="#8B5CF6" filter="drop-shadow(0 0 6px #8B5CF6)">
                      <animateMotion dur="4s" repeatCount="indefinite" path="M 57% 50% C 65% 50%, 75% 20%, 88% 20%" />
                    </circle>
                    <circle r="2" fill="#8B5CF6" filter="drop-shadow(0 0 4px #8B5CF6)">
                      <animateMotion dur="5.5s" repeatCount="indefinite" path="M 57% 50% C 65% 50%, 75% 40%, 88% 40%" />
                    </circle>
                    <circle r="2.5" fill="#8B5CF6" filter="drop-shadow(0 0 6px #8B5CF6)">
                      <animateMotion dur="4.5s" repeatCount="indefinite" path="M 57% 50% C 65% 50%, 75% 60%, 88% 60%" />
                    </circle>
                    <circle r="2" fill="#8B5CF6" filter="drop-shadow(0 0 4px #8B5CF6)">
                      <animateMotion dur="6s" repeatCount="indefinite" path="M 57% 50% C 65% 50%, 75% 80%, 88% 80%" />
                    </circle>
                  </>
                )}
              </svg>

              {/* Data Flow Nodes (Left) */}
              <div className="absolute left-[12%] top-[20%] -translate-y-1/2 -translate-x-full pr-4 text-right pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap border-l-2 border-l-accent-cyan/60 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  DATA SOURCES
                </div>
              </div>
              <div className="absolute left-[12%] top-[40%] -translate-y-1/2 -translate-x-full pr-4 text-right pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap border-l-2 border-l-accent-cyan/60 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  EXTERNAL APIS
                </div>
              </div>
              <div className="absolute left-[12%] top-[60%] -translate-y-1/2 -translate-x-full pr-4 text-right pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap border-l-2 border-l-accent-cyan/60 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  REAL-TIME STREAMS
                </div>
              </div>
              <div className="absolute left-[12%] top-[80%] -translate-y-1/2 -translate-x-full pr-4 text-right pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap border-l-2 border-l-accent-cyan/60 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  MANUAL UPLOADS
                </div>
              </div>

              {/* Data Flow Nodes (Right) */}
              <div className="absolute right-[12%] top-[20%] -translate-y-1/2 translate-x-full pl-4 pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 border-r-2 border-r-accent-intelligence/60 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                  <BrainCircuit className="w-3 h-3 text-accent-electricBlue" /> PREDICTIONS
                </div>
              </div>
              <div className="absolute right-[12%] top-[40%] -translate-y-1/2 translate-x-full pl-4 pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 border-r-2 border-r-accent-intelligence/60 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                  <Target className="w-3 h-3 text-accent-intelligence" /> RECOMMENDATIONS
                </div>
              </div>
              <div className="absolute right-[12%] top-[60%] -translate-y-1/2 translate-x-full pl-4 pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 border-r-2 border-r-accent-cyan/60 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  <Settings className="w-3 h-3 text-accent-cyan" /> OPTIMIZATION
                </div>
              </div>
              <div className="absolute right-[12%] top-[80%] -translate-y-1/2 translate-x-full pl-4 pointer-events-auto">
                <div className="glass-panel-premium px-3.5 py-1.5 rounded-[6px] font-mono text-[9px] font-bold text-slate-300 tracking-[0.2em] whitespace-nowrap flex items-center gap-1.5 border-r-2 border-r-slate-400/60 shadow-[0_0_15px_rgba(148,163,184,0.15)]">
                  <TrendingUp className="w-3 h-3 text-slate-400" /> BUSINESS IMPACT
                </div>
              </div>

              {/* Insight Engine Core */}
              <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20 pointer-events-auto scale-[0.6] sm:scale-75 lg:scale-90 xl:scale-100 transition-transform origin-center">
                
                {/* Layer 1: soft atmospheric halo behind engine */}
                <div 
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: '650px',
                    height: '650px',
                    background: 'radial-gradient(circle, rgba(34,211,238,0.13), rgba(59,130,246,0.06) 35%, transparent 70%)',
                    filter: 'blur(50px)'
                  }} 
                />

                {/* Layer 2: outer energy halo */}
                <div className="absolute w-[280px] h-[280px] rounded-full border border-accent-cyan/10 bg-accent-cyan/5 shadow-[0_0_50px_rgba(34,211,238,0.15)] animate-pulseSlow" />

                {/* Layer 3: large technical orbital ring */}
                <svg className="absolute w-[340px] h-[340px] opacity-30 animate-spinSlow" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#22D3EE" strokeWidth="0.5" strokeDasharray="4 8" />
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#22D3EE" strokeWidth="0.2" opacity="0.5" />
                </svg>

                {/* Layer 4: secondary dashed ring */}
                <svg className="absolute w-[240px] h-[240px] opacity-40 animate-spinSlowReverse" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="10 4 2 4" />
                </svg>

                {/* Layer 5: particle ring */}
                <svg className="absolute w-[180px] h-[180px] opacity-60 animate-spinSlow" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="1 12" strokeLinecap="round" />
                </svg>

                {/* Layer 6: glass/energy sphere */}
                <div className="absolute w-[140px] h-[140px] rounded-full border border-white/20 bg-gradient-to-br from-[rgba(34,211,238,0.1)] to-[rgba(139,92,246,0.05)] backdrop-blur-md shadow-[inset_0_0_30px_rgba(34,211,238,0.2)]" />

                {/* Layer 7: dark inner core */}
                <div className="absolute w-[100px] h-[100px] rounded-full border border-accent-cyan/40 bg-[#02050A] flex flex-col items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.3),inset_0_0_20px_rgba(34,211,238,0.1)] animate-breathe relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.15)_0%,transparent_70%)] animate-pulseSlow" />
                  <div className="font-sans font-black text-lg text-white tracking-[0.15em] mb-0.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] relative z-10">INSIGHT</div>
                  <div className="font-mono text-[8px] text-accent-cyan tracking-[0.3em] font-bold uppercase relative z-10">ENGINE</div>
                </div>
              </div>

            </div>

            {/* 3. BOTTOM CARDS ZONE */}
            <div className="w-full max-w-[1400px] mx-auto flex justify-between items-end shrink-0 pb-2 relative z-20">
              
              {/* Bottom Left: AI Insights */}
              <motion.div className="w-[260px] rounded-[16px] p-5 flex flex-col justify-between group glass-panel-premium pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="font-mono text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">AI INSIGHTS</div>
                  <BarChart className="w-4 h-4 text-accent-intelligence group-hover:drop-shadow-[0_0_8px_#8B5CF6] transition-all" />
                </div>
                <div>
                  <div className="text-[17px] font-sans font-medium text-white mb-2">Patterns Detected</div>
                  {processedDatasetId ? (
                     <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden shadow-inner">
                       <motion.div className="h-full bg-gradient-to-r from-accent-intelligence to-accent-cyan" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.5, ease: "easeOut" }} />
                     </div>
                  ) : (
                     <div className="flex items-center gap-2 opacity-50">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                       <div className="text-xs font-mono text-slate-500">AWAITING ENGINE</div>
                     </div>
                  )}
                </div>
              </motion.div>

              {/* Bottom Center: Active Investigation */}
              <div className="flex-1 max-w-[560px] mx-6 pointer-events-auto relative z-30">
                <div className="w-full glass-panel-premium p-6 rounded-[20px] relative overflow-hidden group shadow-[0_15px_40px_rgba(0,0,0,0.5)] border-t border-white/10">
                  <div 
                    className="absolute inset-0 opacity-[0.04] mix-blend-screen pointer-events-none transition-colors duration-1000"
                    style={{ background: `radial-gradient(circle at center top, ${themeColor}, transparent 80%)` }}
                  />
                  
                  <div className="flex justify-between items-center relative z-10">
                    <div>
                      <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold text-slate-400 tracking-[0.25em] uppercase mb-2">
                        <Search className="w-3.5 h-3.5 text-accent-cyan" /> ACTIVE INVESTIGATION
                      </h3>
                      <div className="text-xl font-display font-medium text-white mb-1 tracking-tight">
                        {rawDatasetId ? 'Intelligence Overview Ready' : 'Awaiting System Input'}
                      </div>
                      <div className="text-xs text-slate-400 font-sans">
                        {rawDatasetId ? 'Proceed to Overview to begin structural analysis.' : 'Upload a dataset to initiate the intelligence flow.'}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end justify-center pl-5 border-l border-white/10">
                      <div className="w-12 h-12 rounded-full border border-white/5 bg-[#040C1A] flex items-center justify-center relative shadow-inner">
                        <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="3" />
                          <circle cx="50" cy="50" r="46" fill="none" stroke={rawDatasetId ? '#22D3EE' : 'transparent'} strokeWidth="3" strokeDasharray="289" strokeDashoffset={rawDatasetId ? '0' : '289'} className="transition-all duration-1000 ease-out" />
                        </svg>
                        {rawDatasetId ? (
                          <CheckCircle2 className="w-5 h-5 text-accent-cyan" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulseSlow" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Right: System Status */}
              <motion.div className="w-[260px] rounded-[16px] p-5 flex flex-col justify-between group glass-panel-premium pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="font-mono text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase">SYSTEM STATUS</div>
                  <Activity className="w-4 h-4 text-accent-success group-hover:drop-shadow-[0_0_8px_#22C55E] transition-all" />
                </div>
                <div className="space-y-3 flex-1 flex flex-col justify-end">
                  <div className="flex justify-between items-center group/item">
                    <span className="font-mono text-[10px] text-slate-400 group-hover/item:text-slate-200 transition-colors">Data Pipeline</span>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${rawDatasetId && !processedDatasetId ? 'bg-accent-cyan animate-pulseSlow shadow-[0_0_5px_#22D3EE]' : rawDatasetId ? 'bg-accent-success shadow-[0_0_5px_#22C55E]' : 'bg-slate-600'}`} />
                  </div>
                  <div className="flex justify-between items-center group/item">
                    <span className="font-mono text-[10px] text-slate-400 group-hover/item:text-slate-200 transition-colors">Intelligence Core</span>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${processedDatasetId ? 'bg-accent-intelligence animate-pulseSlow shadow-[0_0_5px_#8B5CF6]' : 'bg-slate-600'}`} />
                  </div>
                  <div className="flex justify-between items-center group/item">
                    <span className="font-mono text-[10px] text-slate-400 group-hover/item:text-slate-200 transition-colors">API Services</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-success shadow-[0_0_5px_#22C55E]" />
                  </div>
                </div>
              </motion.div>

            </div>

          </motion.div>
        </AnimatePresence>
      )}

      {/* WORKFLOW CONTAINER - ensures content fits within viewport */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden flex flex-col items-center custom-scrollbar pointer-events-none z-30">
        <AnimatePresence mode="wait">

        {activeTab === 'OVERVIEW' && (
          <motion.div key="OVERVIEW" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DatasetOverview rawDatasetId={rawDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'QUALITY' && (
          <motion.div key="QUALITY" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataQuality rawDatasetId={rawDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'CLEANING' && (
          <motion.div key="CLEANING" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataCleaning rawDatasetId={rawDatasetId || null} setProcessedDatasetId={setProcessedDatasetId} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'ANALYSIS' && (
          <motion.div key="ANALYSIS" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataAnalysis processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'INSIGHTS' && (
          <motion.div key="INSIGHTS" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataInsights processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'PREDICTIONS' && (
          <motion.div key="PREDICTIONS" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataPredictions processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'RECOMMENDATIONS' && (
          <motion.div key="RECOMMENDATIONS" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataRecommendations processedDatasetId={processedDatasetId || null} optimizationId={optimizationId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'OPTIMIZATION' && (
          <motion.div key="OPTIMIZATION" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataOptimization processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} setOptimizationId={setOptimizationId} />
          </motion.div>
        )}

        {activeTab === 'DECISIONS' && (
          <motion.div key="DECISIONS" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataDecisions processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'GUARDRAILS' && (
          <motion.div key="GUARDRAILS" initial={{ opacity: 0, y: 15, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -15, scale: 0.99 }} transition={{ duration: 0.3, ease: "easeOut" }} className="mt-8 z-30 pointer-events-auto w-full max-w-7xl px-4 pb-20 absolute">
            <DataGuardrails processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}
        </AnimatePresence>
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
