import React from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface HeroContentProps {
  hasLoaded: boolean;
}

export const HeroContent: React.FC<HeroContentProps> = ({ hasLoaded }) => {

  const textVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' }
  };

  return (
    <div className="absolute top-[10%] bottom-[20%] left-[5vw] w-[45%] z-[7] flex flex-col justify-center">
      
      {/* Status Badge */}
      <motion.div 
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={hasLoaded ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.6, delay: 0.50 }}
        className="flex items-center gap-3 mb-8 w-fit bg-[#040C19]/40 backdrop-blur-md border border-accent-cyan/20 rounded-full px-4 py-1.5"
      >
        <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulseGlow" />
        <span className="font-mono text-xs text-accent-cyan tracking-[0.2em] uppercase">
          Intelligence Engine Online / Real-Time
        </span>
      </motion.div>

      {/* Main Headline */}
      <div className="font-display font-bold text-[68px] lg:text-[76px] xl:text-[82px] leading-[0.95] tracking-tight mb-8">
        <motion.div
          variants={textVariants}
          initial="hidden"
          animate={hasLoaded ? "visible" : "hidden"}
          transition={{ duration: 0.8, delay: 0.65 }}
          className="text-text-white mb-2"
        >
          Turn Data Into
        </motion.div>
        <motion.div
          variants={textVariants}
          initial="hidden"
          animate={hasLoaded ? "visible" : "hidden"}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="text-gradient-cyan pb-2"
        >
          Intelligent
        </motion.div>
        <motion.div
          variants={textVariants}
          initial="hidden"
          animate={hasLoaded ? "visible" : "hidden"}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="text-gradient-cyan"
        >
          Decisions.
        </motion.div>
      </div>

      {/* Supporting Copy */}
      <motion.p 
        initial={{ opacity: 0, y: 15 }}
        animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        transition={{ duration: 0.8, delay: 0.85 }}
        className="font-sans text-[16px] xl:text-[18px] text-text-secondary leading-relaxed max-w-[520px] mb-12"
      >
        Most analytics stop at explaining what happened. InsightFlow AI helps you understand what matters, decide what to do next, and measure whether that decision actually worked.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        transition={{ duration: 0.8, delay: 1.00 }}
        className="flex items-center gap-6"
      >
        <button className="primary-glow-button text-navy-900 font-semibold px-8 py-4 rounded-xl text-base flex items-center gap-2 group">
          Explore InsightFlow
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        
        <button className="glass-button text-text-white font-medium px-8 py-4 rounded-xl text-base">
          See How It Works
        </button>
      </motion.div>

    </div>
  );
};
