import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export const FinalCTA: React.FC = () => {
  return (
    <section className="relative w-full py-40 overflow-hidden border-t border-white/5 mt-20">
      
      {/* Subtle Background Core */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <svg viewBox="0 0 800 800" className="w-[1200px] h-[1200px] max-w-none">
           <circle cx="400" cy="400" r="300" fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="10 20" />
           <circle cx="400" cy="400" r="350" fill="none" stroke="#3B82F6" strokeWidth="1" />
           <circle cx="400" cy="400" r="200" fill="none" stroke="#8B5CF6" strokeWidth="4" strokeDasharray="5 40" />
        </svg>
      </div>

      <div className="max-w-[800px] mx-auto px-[5vw] relative z-10 text-center flex flex-col items-center">
        
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display font-bold text-5xl md:text-6xl text-text-white mb-6"
        >
          Turn your data into <span className="text-gradient-cyan">decisions.</span>
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-sans text-lg text-text-secondary mb-12 max-w-[600px]"
        >
          From analysis to action, InsightFlow AI gives teams a clear path from business data to measurable outcomes.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <button className="primary-glow-button text-navy-900 font-semibold px-8 py-4 rounded-xl text-base flex items-center gap-2 group w-full sm:w-auto justify-center">
            Open InsightFlow
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button className="glass-button text-text-white font-medium px-8 py-4 rounded-xl text-base w-full sm:w-auto">
            Explore the Platform
          </button>
        </motion.div>

      </div>
    </section>
  );
};
