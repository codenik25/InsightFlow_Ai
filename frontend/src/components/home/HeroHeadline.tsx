import React from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface HeroHeadlineProps {
  hasLoaded: boolean;
  onLaunch?: () => void;
}

export const HeroHeadline: React.FC<HeroHeadlineProps> = ({ hasLoaded, onLaunch }) => {
  const lineVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.75, ease: [0.25, 0.1, 0.25, 1] }
    }
  };

  return (
    <div className="flex flex-col justify-center max-w-[420px] xl:max-w-[460px] z-20">
      
      {/* 1. Status Badge */}
      <motion.div
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={hasLoaded ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 12, filter: 'blur(4px)' }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-accent-cyan/30 bg-[#040C19]/60 backdrop-blur-md mb-5 w-fit shadow-[0_0_15px_rgba(34,211,238,0.1)]"
      >
        <div className="relative flex items-center justify-center w-2 h-2">
          <div className="absolute w-full h-full rounded-full bg-accent-cyan opacity-75 animate-ping" />
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
        </div>
        <span className="font-mono text-[9.5px] sm:text-[10px] text-accent-cyan tracking-[0.2em] uppercase font-semibold">
          Intelligence Engine Online / Real-Time
        </span>
      </motion.div>

      {/* 2. Main Headline */}
      <h1 className="font-display font-extrabold text-[46px] sm:text-[54px] lg:text-[60px] xl:text-[68px] leading-[0.96] tracking-tight mb-5 select-none">
        <motion.div
          variants={lineVariants}
          initial="hidden"
          animate={hasLoaded ? "visible" : "hidden"}
          transition={{ delay: 0.6 }}
          className="text-white"
        >
          Turn Data Into
        </motion.div>
        
        <motion.div
          variants={lineVariants}
          initial="hidden"
          animate={hasLoaded ? "visible" : "hidden"}
          transition={{ delay: 0.78 }}
          className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] via-[#3B82F6] to-[#8B5CF6]"
        >
          Intelligent
        </motion.div>

        <motion.div
          variants={lineVariants}
          initial="hidden"
          animate={hasLoaded ? "visible" : "hidden"}
          transition={{ delay: 0.96 }}
          className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] via-[#3B82F6] to-[#8B5CF6]"
        >
          Decisions.
        </motion.div>
      </h1>

      {/* 3. Supporting Copy */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        transition={{ duration: 0.8, delay: 1.1 }}
        className="font-sans text-[14.5px] sm:text-[15.5px] text-slate-400 leading-relaxed max-w-[430px] mb-7 font-normal"
      >
        Most analytics stop at explaining what happened. InsightFlow AI helps you understand what matters, decide what to do next, and measure whether that decision actually worked.
      </motion.p>

      {/* 4. Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        transition={{ duration: 0.8, delay: 1.25 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5"
      >
        <button
          onClick={onLaunch}
          className="relative overflow-hidden group px-6 py-3 rounded-xl font-sans font-bold text-xs sm:text-sm text-[#02050A] bg-gradient-to-r from-[#22D3EE] via-[#67E8F9] to-[#3B82F6] shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          <span className="relative z-10">Explore InsightFlow</span>
          <ArrowRight size={15} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </button>

        <a
          href="#how-it-works"
          className="px-6 py-3 rounded-xl font-sans font-medium text-xs sm:text-sm text-white bg-[#06101C]/60 hover:bg-[#06101C]/90 border border-white/10 hover:border-accent-cyan/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 shadow-sm text-center"
        >
          See How It Works
        </a>
      </motion.div>

    </div>
  );
};

export default HeroHeadline;
