import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Database, Activity, Target, Zap, Shield, GitMerge } from 'lucide-react';

const MODULES = [
  { id: 'DATA', label: 'DATA INTELLIGENCE', desc: 'Raw information ingestion', icon: Database, pos: 'top', dir: 'in', delay: 0.8 },
  { id: 'SIGNAL', label: 'SIGNAL ANALYSIS', desc: 'Identify data signatures', icon: Activity, pos: 'top-left', dir: 'in', delay: 2.6 },
  { id: 'PATTERN', label: 'PATTERN DETECTION', desc: 'Find hidden correlations', icon: GitMerge, pos: 'top-right', dir: 'in', delay: 4.4 },
  { id: 'PREDICT', label: 'PREDICTIVE INTELLIGENCE', desc: 'Estimate future states', icon: Target, pos: 'bottom-left', dir: 'out', delay: 6.3 },
  { id: 'OPTIMIZE', label: 'DECISION OPTIMIZATION', desc: 'Maximize business KPIs', icon: Zap, pos: 'bottom-right', dir: 'out', delay: 7.5 },
  { id: 'GUARDRAILS', label: 'DECISION GUARDRAILS', desc: 'Safety and compliance', icon: Shield, pos: 'bottom', dir: 'out', delay: 8.7 },
];

export const OrbitalArchitectureSection: React.FC = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  
  // Animation state (0 to 10 seconds)
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let startTime = performance.now();
    let frameId: number;
    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      setTime(elapsed);
      if (elapsed < 12) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isInView]);

  // Core is processing between inputs and outputs
  const isCoreProcessing = time > 5.7 && time < 6.3;
  // Core is active at all when receiving or sending signals
  const isCoreActive = time > 1.4;

  const getModuleStyle = (pos: string) => {
    // Desktop layout using absolute positioning around the 480px core
    const radiusX = 380;
    const radiusY = 260;
    
    switch (pos) {
      case 'top': return { top: `calc(50% - ${radiusY + 40}px)`, left: '50%', transform: 'translate(-50%, -50%)' };
      case 'bottom': return { top: `calc(50% + ${radiusY + 40}px)`, left: '50%', transform: 'translate(-50%, -50%)' };
      case 'top-left': return { top: `calc(50% - ${radiusY * 0.5}px)`, left: `calc(50% - ${radiusX}px)`, transform: 'translate(-50%, -50%)' };
      case 'top-right': return { top: `calc(50% - ${radiusY * 0.5}px)`, left: `calc(50% + ${radiusX}px)`, transform: 'translate(-50%, -50%)' };
      case 'bottom-left': return { top: `calc(50% + ${radiusY * 0.5}px)`, left: `calc(50% - ${radiusX}px)`, transform: 'translate(-50%, -50%)' };
      case 'bottom-right': return { top: `calc(50% + ${radiusY * 0.5}px)`, left: `calc(50% + ${radiusX}px)`, transform: 'translate(-50%, -50%)' };
      default: return {};
    }
  };

  // Helper for SVG paths connecting to center
  const getPathD = (pos: string) => {
    // Center is 500,500
    switch (pos) {
      case 'top': return "M500,100 C500,250 500,350 500,500";
      case 'bottom': return "M500,900 C500,750 500,650 500,500";
      case 'top-left': return "M100,250 C300,250 350,500 500,500";
      case 'top-right': return "M900,250 C700,250 650,500 500,500";
      case 'bottom-left': return "M100,750 C300,750 350,500 500,500";
      case 'bottom-right': return "M900,750 C700,750 650,500 500,500";
      default: return "";
    }
  };

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen py-24 md:py-32 overflow-hidden bg-[#02050A]"
    >
      {/* Background Environment */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06)_0%,transparent_60%)] rounded-full blur-[100px]" />
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_60%)] rounded-full blur-[80px]" />
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col items-center h-full">
        
        {/* Header */}
        <motion.div 
          className="text-center mb-16 md:mb-24"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full text-xs font-mono font-bold bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 tracking-wider">
            INTELLIGENCE ARCHITECTURE
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight tracking-tight">
            <span className="text-white block mb-2">Everything Your Data</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-violet">
              Needs to Become a Decision.
            </span>
          </h2>
        </motion.div>

        {/* DESKTOP: Orbital Layout Container */}
        <div className="hidden md:flex relative w-full max-w-[1200px] h-[800px] items-center justify-center">
          
          {/* SVG Connections Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
            {MODULES.map((mod) => {
              // Signal travel time is ~0.6s
              const signalTravelStart = mod.dir === 'in' ? mod.delay + 0.6 : mod.delay;
              const signalTravelEnd = signalTravelStart + 0.6;
              const isSignalTraveling = time > signalTravelStart && time < signalTravelEnd;
              const hasSignalReached = time > signalTravelEnd;

              const pathD = getPathD(mod.pos);

              return (
                <g key={mod.id}>
                  {/* Base path */}
                  <path d={pathD} fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="2" />
                  
                  {/* Glowing active path */}
                  <motion.path 
                    d={pathD} 
                    fill="none" 
                    stroke="rgba(34,211,238,0.5)" 
                    strokeWidth="3"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: isSignalTraveling || hasSignalReached ? 1 : 0,
                      opacity: (isSignalTraveling || hasSignalReached) ? 1 : 0
                    }}
                    transition={{ duration: 0.6, ease: "linear" }}
                  />

                  {/* Travelling Energy Particle */}
                  {isSignalTraveling && (
                    <motion.circle 
                      r="4" 
                      fill="#fff" 
                      className="filter drop-shadow-[0_0_8px_#22D3EE]"
                    >
                      <animateMotion
                        dur="0.6s"
                        repeatCount="1"
                        path={pathD}
                        keyPoints={mod.dir === 'in' ? "0;1" : "1;0"}
                        keyTimes="0;1"
                        calcMode="linear"
                        fill="freeze"
                      />
                    </motion.circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Central Insight Engine */}
          <motion.div 
            className="relative z-30 flex items-center justify-center w-[480px] h-[480px] rounded-full border border-accent-cyan/20 bg-[#050f1c]/80 backdrop-blur-xl shadow-[0_0_80px_rgba(34,211,238,0.08)]"
            animate={{
              boxShadow: isCoreProcessing 
                ? '0 0 120px rgba(34,211,238,0.3), inset 0 0 60px rgba(34,211,238,0.2)' 
                : isCoreActive 
                  ? '0 0 80px rgba(34,211,238,0.15), inset 0 0 30px rgba(34,211,238,0.1)'
                  : '0 0 40px rgba(34,211,238,0.05), inset 0 0 10px rgba(34,211,238,0.05)',
              borderColor: isCoreProcessing ? 'rgba(34,211,238,0.5)' : 'rgba(34,211,238,0.2)'
            }}
            transition={{ duration: 0.5 }}
          >
            {/* Inner rings and particles */}
            <div className="absolute inset-4 rounded-full border border-accent-cyan/20 border-dashed animate-[spin_20s_linear_infinite]" />
            <div className="absolute inset-12 rounded-full border border-accent-blue/10 animate-[spin_15s_linear_infinite_reverse]" />
            <div className="absolute inset-24 rounded-full border-2 border-accent-violet/10 border-dotted animate-[spin_10s_linear_infinite]" />
            
            <div className="text-center z-10 flex flex-col items-center gap-2">
              <motion.div 
                className="w-16 h-16 rounded-full bg-accent-cyan/10 flex items-center justify-center mb-2"
                animate={{ scale: isCoreProcessing ? [1, 1.2, 1] : 1, opacity: isCoreProcessing ? [0.5, 1, 0.5] : 0.5 }}
                transition={{ duration: 1, repeat: isCoreProcessing ? Infinity : 0 }}
              >
                <div className="w-8 h-8 rounded-full bg-accent-cyan shadow-[0_0_20px_#22D3EE]" />
              </motion.div>
              <h3 className="font-display font-bold text-3xl tracking-widest text-white drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                INSIGHT
              </h3>
              <h3 className="font-display font-bold text-3xl tracking-widest text-accent-cyan drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                ENGINE
              </h3>
              <div className="mt-4 font-mono text-[10px] text-accent-cyan/70 tracking-widest uppercase">
                {isCoreProcessing ? 'INTELLIGENCE PROCESSING' : isCoreActive ? 'SYSTEM ONLINE' : 'AWAITING SIGNAL'}
              </div>
            </div>
          </motion.div>

          {/* Orbital Modules */}
          {MODULES.map((mod, index) => {
            const isActive = time > mod.delay;
            // Outbound modules get a bump when signal reaches them
            const signalReachTime = mod.dir === 'out' ? mod.delay + 0.6 : 0;
            const isReceiving = mod.dir === 'out' && time > signalReachTime && time < signalReachTime + 0.5;

            return (
              <motion.div 
                key={mod.id}
                className="absolute w-[240px] z-40"
                style={getModuleStyle(mod.pos)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: isActive ? 1 : 0.4, 
                  scale: isActive ? 1 : 0.9,
                  y: isReceiving ? -4 : 0
                }}
                transition={{ duration: 0.5 }}
              >
                <div className={`p-5 rounded-2xl backdrop-blur-[16px] transition-all duration-500
                  ${isActive 
                    ? 'bg-[#040C19]/40 border-accent-cyan/30 shadow-[0_4px_30px_rgba(34,211,238,0.1)]' 
                    : 'bg-[#040C19]/20 border-white/5 shadow-none'}
                  border
                `}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500
                      ${isActive ? 'bg-accent-cyan/20 text-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-white/5 text-slate-500'}
                    `}>
                      <mod.icon className="w-4 h-4" />
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 tracking-widest">SEQ-0{index + 1}</div>
                  </div>
                  <h4 className={`font-display font-bold text-[13px] tracking-wider mb-1 transition-colors duration-500
                    ${isActive ? 'text-white' : 'text-slate-400'}
                  `}>
                    {mod.label}
                  </h4>
                  <p className="font-sans text-[11px] text-slate-400 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
          
        </div>

        {/* MOBILE: Vertical Pipeline Layout */}
        <div className="md:hidden flex flex-col items-center w-full max-w-sm relative mt-8">
          
          {/* Vertical Energy Spine */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-slate-800 rounded-full" />
          <motion.div 
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-gradient-to-b from-accent-cyan via-accent-blue to-accent-violet rounded-full blur-[2px]"
            initial={{ height: 0 }}
            animate={{ height: time > 1 ? '100%' : 0 }}
            transition={{ duration: 8, ease: "linear" }}
          />

          {MODULES.map((mod, index) => {
            const isActive = time > mod.delay;
            
            // Insert Core in the middle (after PATTERN)
            const showCore = index === 3;

            return (
              <React.Fragment key={mod.id}>
                {showCore && (
                  <motion.div 
                    className="relative z-10 w-[240px] h-[240px] rounded-full border border-accent-cyan/30 bg-[#050f1c]/80 backdrop-blur-xl flex flex-col items-center justify-center my-8 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: isCoreActive ? 1 : 0.8, opacity: isCoreActive ? 1 : 0.5 }}
                    transition={{ duration: 0.5 }}
                  >
                     <h3 className="font-display font-bold text-xl tracking-widest text-white">INSIGHT</h3>
                     <h3 className="font-display font-bold text-xl tracking-widest text-accent-cyan">ENGINE</h3>
                  </motion.div>
                )}
                
                <motion.div 
                  className="relative z-10 w-full mb-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: isActive ? 1 : 0.4, x: isActive ? 0 : -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={`p-4 rounded-xl backdrop-blur-lg border transition-all duration-500 flex items-center gap-4
                    ${isActive ? 'bg-[#040C19]/60 border-accent-cyan/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'bg-[#040C19]/20 border-white/5'}
                  `}>
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                        ${isActive ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-white/5 text-slate-500'}
                     `}>
                        <mod.icon className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className={`font-display font-bold text-[12px] tracking-wider mb-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                          {mod.label}
                        </h4>
                        <p className="font-sans text-[10px] text-slate-400">
                          {mod.desc}
                        </p>
                     </div>
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default OrbitalArchitectureSection;
