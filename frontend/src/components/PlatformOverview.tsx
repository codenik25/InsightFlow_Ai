import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, BarChart, TrendingUp, Activity, Maximize2 } from 'lucide-react';

interface PlatformOverviewProps {
  activeTab: string;
}

export const PlatformOverview: React.FC<PlatformOverviewProps> = ({ activeTab }) => {
  const [time, setTime] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let animationFrameId: number;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    
    const animate = (t: number) => {
      setTime(t / 1000);
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
      case 'data': return '#22D3EE';
      case 'signals': return '#0EA5E9';
      case 'patterns': return '#3B82F6';
      case 'predictions': return '#6366F1';
      case 'recommendations': return '#8B5CF6';
      case 'optimization': return '#A855F7';
      case 'guardrails': return '#06B6D4';
      default: return '#22D3EE';
    }
  }, [activeTab]);

  const activeTitle = useMemo(() => {
    const titles: Record<string, string> = {
      data: 'DATA INTELLIGENCE',
      signals: 'SIGNAL ANALYSIS',
      patterns: 'PATTERN DETECTION',
      predictions: 'PREDICTIVE INTELLIGENCE',
      recommendations: 'DECISION RECOMMENDATIONS',
      optimization: 'SCENARIO OPTIMIZATION',
      guardrails: 'DECISION GUARDRAILS',
    };
    return titles[activeTab] || 'INTELLIGENCE WORKSPACE';
  }, [activeTab]);

  // Framer Motion variants for workspace content transitions
  const contentVariants: any = {
    initial: { opacity: 0, scale: 0.98, y: 20, filter: 'blur(8px)' },
    animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, scale: 1.02, y: -20, filter: 'blur(8px)', transition: { duration: 0.5, ease: "easeIn" } }
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative p-8">
      
      {/* 4 CORNER ANALYTICS MODULES */}
      
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
          className="relative w-[480px] h-[480px] flex items-center justify-center pointer-events-auto"
          animate={{ scale: reducedMotion ? 1 : [1, 1.02, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Central Bloom */}
          <div 
            className="absolute inset-0 rounded-full blur-[80px] opacity-30 transition-colors duration-1000"
            style={{ backgroundColor: themeColor }}
          />

          {/* Outer Segmented Ring */}
          <svg className="absolute inset-0 w-full h-full" style={{ transform: `rotate(${reducedMotion ? 0 : time * 10}deg)` }}>
            <circle cx="240" cy="240" r="230" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="240" cy="240" r="215" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </svg>

          {/* Counter-rotating Inner Ring */}
          <svg className="absolute inset-[40px] w-[400px] h-[400px]" style={{ transform: `rotate(${reducedMotion ? 0 : -time * 15}deg)` }}>
            <circle cx="200" cy="200" r="190" fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="1" strokeDasharray="1 12" />
            {/* Scanning Arc */}
            <path d="M 200,10 A 190,190 0 0 1 390,200" fill="none" stroke={themeColor} strokeWidth="2" filter="drop-shadow(0 0 8px currentColor)" />
          </svg>

          {/* Inner Technical Markers */}
          <div className="absolute inset-[100px] rounded-full border border-white/5 flex items-center justify-center">
             <div className="absolute top-0 w-1 h-3 bg-white/20" />
             <div className="absolute bottom-0 w-1 h-3 bg-white/20" />
             <div className="absolute left-0 w-3 h-1 bg-white/20" />
             <div className="absolute right-0 w-3 h-1 bg-white/20" />
          </div>

          {/* Core Sphere */}
          <div className="w-[140px] h-[140px] rounded-full bg-[#02050A] border border-white/10 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-xl shadow-2xl">
            <div 
              className="absolute inset-0 opacity-40 mix-blend-screen transition-colors duration-1000"
              style={{
                background: `radial-gradient(circle at center, ${themeColor} 0%, transparent 80%)`,
                transform: `scale(${1 + Math.sin(time * 4) * 0.15})`
              }}
            />
            <div className="w-4 h-4 mb-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white opacity-80">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="font-sans font-medium text-[10px] tracking-[0.4em] text-white z-10">INSIGHT</span>
            <span className="font-mono text-[8px] tracking-widest text-slate-400 z-10 mt-1">ENGINE</span>
          </div>

        </motion.div>
      </div>

      {/* DYNAMIC WORKSPACE CONTENT OVERLAY */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center pt-24 pb-8 px-12 z-20">
        
        {/* Dynamic Title */}
        <div className="flex flex-col items-center text-center mb-16">
          <motion.h1 
            key={`title-${activeTitle}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-[10px] tracking-[0.3em] text-accent-cyan mb-3 uppercase"
          >
            {activeTitle}
          </motion.h1>
          <motion.h2 
            key={`sub-${activeTitle}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-sans text-3xl font-light tracking-tight text-white max-w-xl leading-tight"
          >
            {activeTab === 'data' && 'Transform raw business data into actionable intelligence.'}
            {activeTab === 'signals' && 'Identify critical anomalies and behavioral spikes.'}
            {activeTab === 'patterns' && 'Discover hidden correlations across the entire dataset.'}
            {activeTab === 'predictions' && 'Forecast future outcomes with AI-driven confidence.'}
            {activeTab === 'recommendations' && 'Deploy optimal strategies based on machine learning.'}
            {activeTab === 'optimization' && 'Balance constraints to maximize business impact.'}
            {activeTab === 'guardrails' && 'Enforce strict compliance and risk boundaries.'}
          </motion.h2>
        </div>

        {/* Dynamic Content Panel (Changes based on route) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full max-w-3xl mt-auto pointer-events-auto"
          >
            {/* Example of specific layout per tab, simplified for demonstration */}
            <div className="w-full rounded-2xl bg-[#040C19]/50 backdrop-blur-xl border border-white/10 p-8 shadow-2xl relative overflow-hidden group hover:border-accent-cyan/30 transition-colors">
              <div 
                className="absolute inset-0 opacity-10 mix-blend-screen pointer-events-none transition-colors duration-1000"
                style={{ background: `radial-gradient(circle at top right, ${themeColor}, transparent 50%)` }}
              />
              
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="font-mono text-[10px] text-slate-400 tracking-[0.2em] uppercase mb-2">ACTIVE INVESTIGATION</h3>
                  <div className="text-xl font-sans text-white">
                    {activeTab === 'data' && 'Customer Revenue Streams'}
                    {activeTab === 'signals' && 'Unusual Traffic Spikes'}
                    {activeTab === 'patterns' && 'Churn vs Engagement'}
                    {activeTab === 'predictions' && 'Q4 Growth Trajectory'}
                    {activeTab === 'recommendations' && 'Retention Strategy Alpha'}
                    {activeTab === 'optimization' && 'Budget Allocation Scenarios'}
                    {activeTab === 'guardrails' && 'Risk Validation Rules'}
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
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
};

