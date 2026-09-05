import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Cpu } from 'lucide-react';

export const FinalCTA: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section ref={containerRef} className="py-40 relative overflow-hidden bg-transparent border-t border-white/5 flex items-center justify-center min-h-[75vh]">
      
      {/* Cinematic Background Network & Subtle Intelligence Core */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 0.5 } : { scale: 0.8, opacity: 0 }}
          transition={{ duration: 1.8, ease: "easeOut" }}
          className="absolute w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12)_0%,rgba(59,130,246,0.04)_45%,transparent_70%)] rounded-full blur-[80px]"
        />

        {/* Subtle background SVG orbital rings */}
        <svg viewBox="0 0 600 600" className="w-[600px] h-[600px] opacity-15">
          <circle cx="300" cy="300" r="260" fill="none" stroke="#22D3EE" strokeWidth="1" strokeDasharray="4 8" />
          <circle cx="300" cy="300" r="200" fill="none" stroke="#3B82F6" strokeWidth="1.5" />
          <circle cx="300" cy="300" r="140" fill="none" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="12 16" />
        </svg>
        
        {/* Converging Particles */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          return (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-accent-cyan rounded-full shadow-[0_0_6px_#22D3EE]"
              initial={{ x: Math.cos(angle) * 350, y: Math.sin(angle) * 350, opacity: 0 }}
              animate={isInView ? { x: 0, y: 0, opacity: [0, 1, 0] } : { opacity: 0 }}
              transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Glowing Decision Core Icon */}
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="w-20 h-20 mx-auto bg-navy-panel/80 backdrop-blur-xl border border-accent-cyan/40 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(34,211,238,0.25)] mb-10 relative group"
        >
          <Cpu className="w-8 h-8 text-accent-cyan drop-shadow-[0_0_8px_#22D3EE]" />
          <motion.div
            className="absolute inset-0 rounded-full border border-accent-cyan/30"
            animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
        </motion.div>

        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight tracking-tight"
        >
          Turn Data Into <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] via-[#3B82F6] to-[#8B5CF6]">
            Better Decisions.
          </span>
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-base sm:text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed"
        >
          From analysis to action, InsightFlow AI helps teams move from raw information to measurable outcomes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onLaunch}
            className="relative overflow-hidden group inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue text-navy-black px-8 py-4 rounded-xl font-bold text-base transition-all hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:-translate-y-0.5"
          >
            <span className="relative z-10">Open InsightFlow</span>
            <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-white/25 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </button>

          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-medium text-base text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-cyan/40 transition-all hover:-translate-y-0.5"
          >
            Explore the Platform
          </a>
        </motion.div>
      </div>

    </section>
  );
};

export default FinalCTA;
