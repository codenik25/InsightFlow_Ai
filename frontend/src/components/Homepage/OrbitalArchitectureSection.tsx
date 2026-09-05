import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Database, Activity, Target, Zap, Shield, GitMerge } from 'lucide-react';

const MODULES = [
  { id: 'DATA', label: 'DATA INTELLIGENCE', desc: 'Raw information ingestion', icon: Database, x: 600, y: 170, dir: 'in', delay: 0.1 },
  { id: 'SIGNAL', label: 'SIGNAL ANALYSIS', desc: 'Identify data signatures', icon: Activity, x: 310, y: 320, dir: 'in', delay: 0.2 },
  { id: 'PATTERN', label: 'PATTERN DETECTION', desc: 'Find hidden correlations', icon: GitMerge, x: 890, y: 320, dir: 'in', delay: 0.3 },
  { id: 'PREDICT', label: 'PREDICTIVE INTELLIGENCE', desc: 'Estimate future states', icon: Target, x: 310, y: 570, dir: 'out', delay: 0.4 },
  { id: 'OPTIMIZE', label: 'DECISION OPTIMIZATION', desc: 'Maximize business KPIs', icon: Zap, x: 890, y: 570, dir: 'out', delay: 0.5 },
  { id: 'GUARDRAILS', label: 'DECISION GUARDRAILS', desc: 'Safety and compliance', icon: Shield, x: 600, y: 700, dir: 'out', delay: 0.6 },
];

export const OrbitalArchitectureSection: React.FC = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const ENGINE_X = 600;
  const ENGINE_Y = 430;
  const ENGINE_RADIUS = 160;
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 90;

  const getPathD = (mod: typeof MODULES[0]) => {
    const dx = mod.x - ENGINE_X;
    const dy = mod.y - ENGINE_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const startX = ENGINE_X + (dx / dist) * ENGINE_RADIUS;
    const startY = ENGINE_Y + (dy / dist) * ENGINE_RADIUS;
    
    let endX, endY;
    if (Math.abs(dx) > Math.abs(dy)) {
      endX = mod.x - Math.sign(dx) * (NODE_WIDTH / 2);
      endY = mod.y - Math.sign(dx) * (NODE_WIDTH / 2) * (dy / dx);
      return `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`;
    } else {
      endY = mod.y - Math.sign(dy) * (NODE_HEIGHT / 2);
      endX = mod.x - Math.sign(dy) * (NODE_HEIGHT / 2) * (dx / dy);
      return `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
    }
  };

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen py-24 md:py-32 overflow-hidden bg-transparent"
    >
      {/* Background Environment - Retained as requested */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06)_0%,transparent_60%)] rounded-full blur-[100px]" />
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_60%)] rounded-full blur-[80px]" />
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col items-center h-full">
        
        {/* Header - Fixed Text Gradient */}
        <motion.div 
          className="text-center mb-16 md:mb-24"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full text-xs font-mono font-bold bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 tracking-wider">
            INTELLIGENCE ARCHITECTURE
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-[64px] font-display font-bold leading-tight tracking-tight">
            <span className="text-white block mb-2 opacity-100">Everything Your Data</span>
            <span 
              className="inline-block opacity-100"
              style={{
                backgroundImage: 'linear-gradient(90deg, #67E8F9 0%, #38BDF8 25%, #3B82F6 50%, #6366F1 75%, #A78BFA 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(56,189,248,0.10)',
              }}
            >
              Needs to Become a Decision.
            </span>
          </h2>
        </motion.div>

        {/* DESKTOP: Orbital Layout Container */}
        <div className="hidden md:block relative w-[1200px] h-[850px] mx-auto">
          
          {/* SVG Connections Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 1200 850">
            {MODULES.map((mod) => {
              const pathD = getPathD(mod);
              return (
                <g key={mod.id}>
                  {/* Base path */}
                  <path d={pathD} fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />
                  
                  {/* Animated flowing line */}
                  <motion.path 
                    d={pathD} 
                    fill="none" 
                    stroke="rgba(34,211,238,0.7)" 
                    strokeWidth="1.5"
                    strokeDasharray="40 120"
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: mod.dir === 'in' ? 160 : -160 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Central Insight Engine */}
          <motion.div 
            className="absolute z-10 flex items-center justify-center w-[320px] h-[320px] rounded-full border border-accent-cyan/20 bg-[#050f1c]/80 backdrop-blur-xl shadow-[0_0_80px_rgba(34,211,238,0.08)]"
            style={{ 
              left: ENGINE_X - 160, 
              top: ENGINE_Y - 160 
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8 }}
          >
            {/* Inner rings and particles */}
            <div className="absolute inset-2 rounded-full border border-accent-cyan/20 border-dashed animate-[spin_20s_linear_infinite]" />
            <div className="absolute inset-8 rounded-full border border-accent-blue/10 animate-[spin_15s_linear_infinite_reverse]" />
            <div className="absolute inset-16 rounded-full border-2 border-accent-violet/10 border-dotted animate-[spin_10s_linear_infinite]" />
            
            <div className="text-center z-10 flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-accent-cyan/10 flex items-center justify-center mb-1">
                <div className="w-6 h-6 rounded-full bg-accent-cyan shadow-[0_0_20px_#22D3EE]" />
              </div>
              <h3 className="font-display font-bold text-2xl tracking-widest text-white drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                INSIGHT
              </h3>
              <h3 className="font-display font-bold text-2xl tracking-widest text-accent-cyan drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                ENGINE
              </h3>
              <div className="mt-2 font-mono text-[9px] text-accent-cyan/70 tracking-widest uppercase flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-[0_0_6px_#22D3EE] animate-pulse" />
                SYSTEM ONLINE
              </div>
            </div>
          </motion.div>

          {/* Orbital Modules */}
          {MODULES.map((mod, index) => {
            return (
              <motion.div 
                key={mod.id}
                className="absolute z-20"
                style={{ 
                  left: mod.x - (NODE_WIDTH / 2), 
                  top: mod.y - (NODE_HEIGHT / 2),
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ duration: 0.6, delay: 0.4 + mod.delay, ease: "easeOut" }}
              >
                <div className="w-full h-full p-3 rounded-2xl flex flex-col justify-center transition-all duration-300 bg-[rgba(4,12,25,0.72)] border border-[rgba(34,211,238,0.28)] backdrop-blur-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#02050A]/80 border border-white/5 text-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                      <mod.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="font-mono text-[9px] text-slate-500 tracking-widest uppercase font-bold">SEQ-0{index + 1}</div>
                  </div>
                  <h4 className="font-display font-bold text-[12px] tracking-wider mb-0.5 text-white truncate">
                    {mod.label}
                  </h4>
                  <p className="font-sans text-[10px] text-slate-400 leading-tight line-clamp-2 pr-1">
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
            className="absolute top-0 left-1/2 -translate-x-1/2 w-1 bg-gradient-to-b from-accent-cyan via-accent-blue to-accent-violet rounded-full blur-[2px]"
            initial={{ height: 0 }}
            animate={isInView ? { height: '100%' } : { height: 0 }}
            transition={{ duration: 6, ease: "linear" }}
          />

          {MODULES.map((mod, index) => {
            const showCore = index === 3;
            return (
              <React.Fragment key={mod.id}>
                {showCore && (
                  <motion.div 
                    className="relative z-10 w-[240px] h-[240px] rounded-full border border-accent-cyan/30 bg-[#050f1c]/80 backdrop-blur-xl flex flex-col items-center justify-center my-8 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                  >
                     <h3 className="font-display font-bold text-xl tracking-widest text-white">INSIGHT</h3>
                     <h3 className="font-display font-bold text-xl tracking-widest text-accent-cyan">ENGINE</h3>
                  </motion.div>
                )}
                
                <motion.div 
                  className="relative z-10 w-full mb-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, delay: 0.2 + mod.delay }}
                >
                  <div className="p-4 rounded-xl backdrop-blur-lg border transition-all duration-500 flex items-center gap-4 bg-[rgba(4,12,25,0.72)] border-[rgba(34,211,238,0.28)] shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                     <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#02050A]/80 border border-white/5 text-accent-cyan">
                        <mod.icon className="w-5 h-5" />
                     </div>
                     <div>
                        <h4 className="font-display font-bold text-[12px] tracking-wider mb-0.5 text-white">
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
