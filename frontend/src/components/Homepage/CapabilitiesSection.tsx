import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Database, Activity, Network, BrainCircuit, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

// ─── DATA DEFINITIONS ─────────────────────────────────────────────────────────

type FlowStage = 0 | 1 | 2 | 3 | 4 | 5;

const capabilities = [
  {
    id: 0,
    title: 'DATA INTELLIGENCE',
    desc: 'Automatically profile, organize, and understand business data before analysis begins.',
    icon: Database,
    color: '#22D3EE',
    desktopPos: { left: 'calc(50% - 160px)', top: '0px' }, // Top Center
    pathD: 'M 600 240 L 600 140', // From core top edge to module bottom
    flowIn: true
  },
  {
    id: 1,
    title: 'SIGNAL ANALYSIS',
    desc: 'Detect meaningful signals across metrics, trends and operational activity.',
    icon: Activity,
    color: '#38BDF8',
    desktopPos: { left: '20px', top: '160px' }, // Top Left
    pathD: 'M 400 320 Q 250 240 250 240',
    flowIn: true
  },
  {
    id: 2,
    title: 'PATTERN DETECTION',
    desc: 'Identify hidden relationships, anomalies and patterns conventional analytics can miss.',
    icon: Network,
    color: '#3B82F6',
    desktopPos: { right: '20px', top: '160px' }, // Top Right
    pathD: 'M 800 320 Q 950 240 950 240',
    flowIn: true
  },
  {
    id: 3,
    title: 'PREDICTIVE INTELLIGENCE',
    desc: 'Use historical signals and machine learning to understand what is likely to happen next.',
    icon: BrainCircuit,
    color: '#8B5CF6',
    desktopPos: { left: '20px', top: '480px' }, // Bottom Left
    pathD: 'M 400 530 Q 250 560 250 560',
    flowIn: false
  },
  {
    id: 4,
    title: 'DECISION OPTIMIZATION',
    desc: 'Compare possible actions and identify decisions most likely to improve business outcomes.',
    icon: TrendingUp,
    color: '#A855F7',
    desktopPos: { right: '20px', top: '480px' }, // Bottom Right
    pathD: 'M 800 530 Q 950 560 950 560',
    flowIn: false
  },
  {
    id: 5,
    title: 'DECISION GUARDRAILS',
    desc: 'Apply business rules, constraints and validation before recommendations become actions.',
    icon: ShieldCheck,
    color: '#D946EF',
    desktopPos: { left: 'calc(50% - 160px)', bottom: '0px' }, // Bottom Center
    pathD: 'M 600 610 L 600 700',
    flowIn: false
  }
];

export const CapabilitiesSection: React.FC = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotion();
  const [activeStage, setActiveStage] = useState<FlowStage | -1>(-1);

  // Global Sequential Flow Animation (Activates once in view)
  useEffect(() => {
    if (!isInView) return;
    
    // Start sequence
    setActiveStage(0);
    
    // Each cycle gives the active module 3 seconds of focus before moving
    const interval = setInterval(() => {
      setActiveStage(prev => (prev === 5 ? 0 : (prev + 1) as FlowStage));
    }, 3500);
    
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section id="capabilities" className="py-24 relative overflow-hidden bg-transparent min-h-screen flex flex-col items-center" ref={containerRef}>
      
      {/* ─── LOCAL BACKGROUND LAYERS ───────────────────────────────────────────── */}
      <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(34,211,238,0.04)_0%,transparent_60%)] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(139,92,246,0.05)_0%,transparent_60%)] pointer-events-none -z-10" />
      
      {/* Atmospheric Orbit (Depth behind core) */}
      {!prefersReducedMotion && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] pointer-events-none -z-10 opacity-30">
          <motion.div className="absolute inset-20 rounded-full border border-white/5" animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute inset-40 rounded-full border border-dashed border-[#22D3EE]/10" animate={{ rotate: -360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.02)_0%,transparent_70%)]" />
        </div>
      )}

      {/* ─── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 w-full max-w-[1400px] mx-auto px-6 flex flex-col items-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-[#22D3EE]/20 bg-[#02050A]/60 backdrop-blur-md mb-8"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
          <span className="text-[10px] text-[#22D3EE] tracking-[0.2em] uppercase font-bold" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            DECISION INTELLIGENCE ARCHITECTURE
          </span>
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="text-4xl md:text-5xl lg:text-[64px] font-bold text-center leading-[1.05] tracking-[-0.03em] mb-6"
          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
        >
          <span className="text-white">Everything Your Data</span><br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] via-[#3B82F6] to-[#8B5CF6] filter drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            Needs to Become a Decision.
          </span>
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-[#94A3B8] text-lg max-w-[650px] text-center" 
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          From raw business data to intelligent recommendations, InsightFlow connects every step of the decision journey.
        </motion.p>
      </div>

      {/* ─── DESKTOP ORBITAL ARCHITECTURE (lg+) ───────────────────────────────── */}
      <div className="hidden lg:block relative w-[1200px] h-[850px] mx-auto mt-10">
        
        {/* SVG Flow Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible" viewBox="0 0 1200 850">
          <defs>
            <filter id="orbitalGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {capabilities.map(cap => {
            const isActive = activeStage === cap.id;
            const pathId = `orbit-path-${cap.id}`;
            return (
              <g key={cap.id}>
                {/* Base connection line */}
                <path d={cap.pathD} fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="1" strokeDasharray="4 4" />
                
                {/* Active travelling energy pulse */}
                {!prefersReducedMotion && (
                  <>
                    {/* The visible trail path that illuminates */}
                    <motion.path 
                      id={pathId}
                      d={cap.pathD} 
                      fill="none" 
                      stroke={cap.color} 
                      strokeWidth="2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isActive ? 0.8 : 0 }}
                      transition={{ duration: 0.5 }}
                      style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
                    />
                    
                    {/* The moving bright particle */}
                    {isActive && (
                      <g filter="url(#orbitalGlow)">
                        {/* 
                           If flowIn is true (Data, Signal, Pattern), the signal goes FROM module TO core.
                           So we draw the path from core to module, but animate backward (keyPoints="1;0").
                           If flowIn is false, it goes from core to module (keyPoints="0;1").
                        */}
                        <animateMotion 
                          dur="1.5s" 
                          repeatCount="indefinite" 
                          calcMode="spline" 
                          keyTimes="0;1" 
                          keySplines="0.25 0.1 0.25 1"
                          keyPoints={cap.flowIn ? "1;0" : "0;1"} 
                        >
                          <mpath href={`#${pathId}`} />
                        </animateMotion>
                        <circle r="4" fill="#FFFFFF" />
                        <circle r="8" fill={cap.color} opacity="0.6" />
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Central Insight Engine Core (Z-index 10) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] z-10 flex items-center justify-center">
          <InsightEngineCore isActive={activeStage !== -1} prefersReducedMotion={!!prefersReducedMotion} />
        </div>

        {/* Orbiting Capability Modules (Z-index 20) */}
        {capabilities.map((cap, index) => {
          const isActive = activeStage === cap.id;
          return (
            <motion.div
              key={cap.id}
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: "easeOut" }}
              className="absolute z-20 w-[320px]"
              style={cap.desktopPos}
            >
               <CapabilityModule cap={cap} isActive={isActive} prefersReducedMotion={!!prefersReducedMotion} />
            </motion.div>
          );
        })}
      </div>

      {/* ─── MOBILE / TABLET PIPELINE ARCHITECTURE (< lg) ────────────────────── */}
      <div className="lg:hidden w-full px-4 flex flex-col items-center mt-8 gap-6 relative">
         <div className="w-[340px] h-[340px] relative flex items-center justify-center mb-8">
            <InsightEngineCore isActive={activeStage !== -1} prefersReducedMotion={!!prefersReducedMotion} />
         </div>
         
         <div className="absolute top-[360px] bottom-0 w-[1px] bg-gradient-to-b from-[#22D3EE]/20 to-transparent left-1/2 -translate-x-1/2 -z-10" />

         {capabilities.map((cap) => (
           <motion.div
             key={cap.id}
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true, margin: "-50px" }}
             transition={{ duration: 0.6 }}
             className="w-full max-w-[380px]"
           >
             <CapabilityModule cap={cap} isActive={activeStage === cap.id} prefersReducedMotion={!!prefersReducedMotion} />
           </motion.div>
         ))}
      </div>

      {/* ─── DATA TERRAIN (BOTTOM) ─────────────────────────────────────────────── */}
      {!prefersReducedMotion && (
        <div className="absolute bottom-0 left-0 w-full h-[180px] pointer-events-none overflow-hidden opacity-40 -z-20">
          <svg width="100%" height="100%" preserveAspectRatio="none">
             <defs>
               <linearGradient id="terrainGradRadial" x1="0%" y1="0%" x2="0%" y2="100%">
                 <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
                 <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.6" />
               </linearGradient>
             </defs>
             {/* Dotted perspective lines */}
             <motion.path 
               d="M 0 150 Q 300 80 600 120 T 1200 90 T 1800 130" 
               fill="none" stroke="#22D3EE" strokeWidth="1" strokeDasharray="2 6"
               animate={{ x: [0, -600, 0] }}
               transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
             />
             <motion.path 
               d="M 0 180 L 0 120 Q 200 90, 400 100 T 800 120 T 1200 80 T 1500 110 L 1500 180 Z" 
               fill="url(#terrainGradRadial)" 
               animate={{ x: [0, -300, 0] }}
               transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
             />
          </svg>
        </div>
      )}

    </section>
  );
};

// ─── CENTRAL INTELLIGENCE ENGINE COMPONENT ─────────────────────────────────
const InsightEngineCore: React.FC<{ isActive: boolean, prefersReducedMotion: boolean }> = ({ isActive, prefersReducedMotion }) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer Glow */}
      <motion.div 
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.1)_0%,transparent_60%)] blur-md"
        animate={prefersReducedMotion ? {} : { opacity: [0.45, 0.75, 0.45], scale: [1, 1.025, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Outer segmented ring */}
      {!prefersReducedMotion && (
        <motion.svg className="absolute w-[90%] h-[90%] opacity-40" viewBox="0 0 100 100" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
          <circle cx="50" cy="50" r="48" fill="none" stroke="#3B82F6" strokeWidth="0.5" strokeDasharray="10 5 2 5" />
        </motion.svg>
      )}

      {/* Middle rotating ring (reverse) */}
      {!prefersReducedMotion && (
        <motion.svg className="absolute w-[70%] h-[70%] opacity-50" viewBox="0 0 100 100" animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}>
          <circle cx="50" cy="50" r="48" fill="none" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="4 8" />
        </motion.svg>
      )}

      {/* Scanning Radar Arc */}
      {!prefersReducedMotion && (
        <motion.div 
          className="absolute inset-0 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(34,211,238,0.15) 100%)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* The Core Hub */}
      <div className="relative z-10 w-[140px] h-[140px] rounded-full bg-[#02050A]/80 border border-[#22D3EE]/30 backdrop-blur-md flex flex-col items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)]">
         <Zap className="text-[#22D3EE] w-6 h-6 mb-2 drop-shadow-[0_0_8px_#22D3EE]" />
         <span className="text-white font-bold text-sm tracking-widest text-center leading-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
           INSIGHT<br/>ENGINE
         </span>
         {/* Small Active Status Dot */}
         <div className="absolute bottom-4 flex items-center gap-1.5">
           <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#34D399] shadow-[0_0_6px_#34D399]' : 'bg-slate-500'} transition-colors duration-300`} />
           <span className="text-[8px] text-slate-400 uppercase font-mono tracking-wider">Active</span>
         </div>
      </div>
    </div>
  );
};

// ─── COMPACT CAPABILITY MODULE COMPONENT ──────────────────────────────────
const CapabilityModule: React.FC<{ cap: any, isActive: boolean, prefersReducedMotion: boolean }> = ({ cap, isActive, prefersReducedMotion }) => {
  const Icon = cap.icon;
  
  return (
    <motion.div
      animate={prefersReducedMotion ? {} : { y: [-2, 2, -2] }}
      transition={{ duration: cap.cycle || 6, repeat: Infinity, ease: "easeInOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`group relative w-full h-[150px] p-5 rounded-[16px] flex flex-col justify-start transition-all duration-300 overflow-hidden cursor-default
        ${isActive ? 'bg-[#02050A]/60' : 'bg-[#02050A]/40'}`}
      style={{
        border: isActive ? `1px solid ${cap.color}60` : `1px solid rgba(67,215,255,0.25)`,
        backdropFilter: 'blur(16px)',
        boxShadow: isActive ? `0 0 20px ${cap.color}20, inset 0 0 10px ${cap.color}10` : '0 0 10px rgba(0,0,0,0.5)'
      }}
    >
      {/* Background ambient bloom on hover or active */}
      <div 
        className={`absolute -inset-4 rounded-full blur-2xl pointer-events-none transition-opacity duration-500
          ${isActive ? 'opacity-30' : 'opacity-0 group-hover:opacity-15'}`}
        style={{ background: `radial-gradient(circle, ${cap.color} 0%, transparent 70%)` }}
      />
      
      {/* Number Label */}
      <div className="absolute top-4 right-4 text-[10px] text-slate-500 tracking-widest font-bold" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        0{cap.id + 1}
      </div>

      <div className="flex items-center gap-3 mb-3 relative z-10">
        <div 
          className="p-2 rounded-lg bg-[#02050A]/80 border border-white/5 transition-colors duration-300"
          style={{ 
            boxShadow: isActive ? `0 0 12px ${cap.color}40` : 'none',
            borderColor: isActive ? `${cap.color}40` : 'rgba(255,255,255,0.05)'
          }}
        >
          <Icon className="w-4 h-4 transition-all duration-300" style={{ color: isActive ? cap.color : '#94A3B8' }} />
        </div>
        <h4 className="text-[14px] font-bold text-white tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
          {cap.title}
        </h4>
      </div>

      <p className="text-[12px] text-[#94A3B8] leading-relaxed relative z-10 font-sans" style={{ fontFamily: '"Inter", sans-serif' }}>
        {cap.desc}
      </p>
    </motion.div>
  );
};

export default CapabilitiesSection;
