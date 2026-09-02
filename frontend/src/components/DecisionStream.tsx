import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const DecisionStream: React.FC = () => {
  const steps = [
    'DATA INGESTED',
    'SIGNALS ANALYZED',
    'PATTERNS DETECTED',
    'INSIGHTS GENERATED',
    'PREDICTION READY',
    'DECISION RECOMMENDED'
  ];

  // Animate the active stage across the timeline continuously
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4000); // 4 seconds per step
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="h-[80px] shrink-0 border-t border-white/5 bg-[#02050A]/90 backdrop-blur-xl relative flex flex-col justify-center px-12 overflow-hidden z-20">
      
      {/* Background Energy Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          animate={{ x: `${activeStep * 20}vw` }}
          transition={{ duration: 1, type: "spring", stiffness: 50 }}
          className="absolute top-1/2 left-[10%] w-[20vw] h-[40px] -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.1)_0%,transparent_70%)] blur-xl"
        />
      </div>
      
      {/* Traveling Signal Line */}
      <div className="absolute top-1/2 left-12 right-12 h-[1px] bg-white/5 -translate-y-1/2 z-0" />
      
      {/* Animated Energy Progress */}
      <motion.div 
        animate={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        className="absolute top-1/2 left-12 right-12 h-[1px] bg-gradient-to-r from-accent-cyan/10 via-accent-cyan/80 to-accent-cyan -translate-y-1/2 z-0 origin-left"
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-white shadow-[0_0_15px_#22D3EE,0_0_5px_#fff]" />
      </motion.div>

      <div className="w-full flex justify-between relative z-10">
        {steps.map((step, idx) => {
          const isActive = idx === activeStep;
          const isPassed = idx < activeStep;

          return (
            <div key={idx} className="flex flex-col items-center gap-3 group cursor-default">
              <div className="relative flex items-center justify-center">
                
                {/* Node Container */}
                <div className={`w-3 h-3 rounded-full border-[1.5px] transition-colors duration-500 z-10
                  ${isActive ? 'bg-[#02050A] border-accent-cyan' : 
                    isPassed ? 'bg-accent-cyan/20 border-accent-cyan/40' : 
                    'bg-[#02050A] border-white/10'}`} 
                />
                
                {/* Active Core Glow */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 rounded-full bg-accent-cyan shadow-[0_0_15px_#22D3EE] z-20"
                    />
                  )}
                </AnimatePresence>

                {/* Pulsing ring for active */}
                {isActive && (
                  <motion.div
                    animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full bg-accent-cyan"
                  />
                )}
              </div>
              
              <span className={`font-sans text-[10px] uppercase tracking-widest transition-all duration-500 font-medium
                ${isActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]' : 
                  isPassed ? 'text-slate-400' : 'text-slate-600'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

