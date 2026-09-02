import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

const pipelineStages = [
  { id: 'DATA', desc: 'Raw information ingestion and storage.' },
  { id: 'PROFILE', desc: 'Semantic type and quality detection.' },
  { id: 'ANALYZE', desc: 'Exploratory data analysis and correlations.' },
  { id: 'DETECT', desc: 'Identify anomalies and unusual patterns.' },
  { id: 'PREDICT', desc: 'Estimate future outcomes from historical data.' },
  { id: 'OPTIMIZE', desc: 'Maximize KPIs using solver algorithms.' },
  { id: 'RECOMMEND', desc: 'Propose evidence-backed actions.' },
  { id: 'DECIDE', desc: 'Final execution governed by guardrails.' },
  { id: 'LEARN', desc: 'Feedback loop to improve future models.' }
];

export const PipelineSection: React.FC = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-150px" });
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [activeSignalIndex, setActiveSignalIndex] = useState(-1);

  // Storytelling pulse that moves through the nodes slowly
  useEffect(() => {
    if (!isInView) return;
    
    let currentIndex = -1;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % pipelineStages.length;
      setActiveSignalIndex(currentIndex);
    }, 1500); // 1.5 seconds per node for clear storytelling

    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section className="py-40 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#080d17] to-navy-black border-t border-b border-white/5" ref={containerRef}>
      
      {/* Cool blue technical environment ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_40px]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="mb-32 text-center max-w-2xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8 }}
            className="text-4xl lg:text-5xl font-display font-bold text-white mb-4 tracking-tight"
          >
            The Intelligence <span className="text-accent-blue">Pipeline</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-slate-400 text-sm font-mono tracking-widest uppercase"
          >
            Continuous movement from raw information to validated decision
          </motion.p>
        </div>

        <div className="relative w-full h-40 flex items-center">
          
          {/* Main Track Background */}
          <div className="absolute left-0 right-0 h-1 bg-slate-800 rounded-full" />
          
          {/* Active Connection Lines (Light up between nodes) */}
          <div className="absolute left-0 right-0 h-1 rounded-full flex">
            {pipelineStages.map((_, i) => (
              <div 
                key={i} 
                className={`h-full flex-1 transition-colors duration-700 ease-in-out
                  ${activeSignalIndex > i ? 'bg-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-transparent'}
                  ${activeSignalIndex === i ? 'bg-gradient-to-r from-accent-cyan to-transparent' : ''}
                `} 
              />
            ))}
          </div>

          {/* Pipeline Nodes */}
          <div className="absolute inset-0 flex justify-between items-center w-full px-2 sm:px-8">
            {pipelineStages.map((stage, index) => {
              const isActive = activeSignalIndex === index;
              const isPast = activeSignalIndex > index;
              const isHovered = hoveredStage === stage.id;

              return (
                <div 
                  key={stage.id} 
                  className="relative flex flex-col items-center group cursor-crosshair z-20"
                  onMouseEnter={() => setHoveredStage(stage.id)}
                  onMouseLeave={() => setHoveredStage(null)}
                >
                  {/* Node Dot */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : { scale: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5, type: "spring" }}
                    className={`w-4 h-4 bg-navy-black border-2 rounded-full z-20 transition-all duration-500
                      ${isHovered ? 'border-accent-cyan scale-150 shadow-[0_0_20px_rgba(34,211,238,0.8)]' : 
                        isActive ? 'border-accent-cyan scale-[1.3] shadow-[0_0_15px_rgba(34,211,238,0.6)]' :
                        isPast ? 'border-accent-cyan/60' : 'border-slate-700'}
                    `}
                  >
                    {/* Inner active pulse */}
                    {(isActive || isHovered) && (
                      <motion.div 
                        className="absolute inset-0 bg-accent-cyan rounded-full"
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                  
                  {/* Label */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                    transition={{ delay: (index * 0.1) + 0.3, duration: 0.5 }}
                    className="absolute top-8 whitespace-nowrap"
                  >
                    <span className={`text-[10px] sm:text-[11px] font-mono tracking-widest transition-colors duration-500
                      ${(isActive || isHovered) ? 'text-accent-cyan font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 
                        isPast ? 'text-slate-300' : 'text-slate-600'}
                    `}>
                      {stage.id}
                    </span>
                  </motion.div>

                  {/* Floating Tooltip */}
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={isHovered ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -10, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-12 w-56 bg-navy-panel/95 backdrop-blur-xl border border-accent-cyan/40 rounded-xl p-4 shadow-2xl pointer-events-none z-30"
                    style={{ left: '50%', x: '-50%' }}
                  >
                    <div className="text-[10px] text-accent-cyan font-mono font-bold mb-1.5 tracking-wider">{stage.id} LAYER</div>
                    <div className="text-xs text-slate-300 leading-relaxed font-sans">{stage.desc}</div>
                  </motion.div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PipelineSection;
