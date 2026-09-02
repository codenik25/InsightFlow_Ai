import React from 'react';
import { motion } from 'framer-motion';

const pipelineStages = [
  'DATA', 'PROFILE', 'ANALYZE', 'DETECT', 'PREDICT', 'OPTIMIZE', 'RECOMMEND', 'DECIDE', 'LEARN'
];

export const IntelligencePipeline: React.FC = () => {
  return (
    <section className="relative w-full py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-[5vw] relative z-10">
        
        <div className="text-center mb-20">
          <h2 className="font-display text-3xl font-bold text-text-white">Intelligence Pipeline</h2>
        </div>

        <div className="relative w-full max-w-5xl mx-auto h-[120px] flex items-center">
          
          {/* Base Rail */}
          <div className="absolute left-0 right-0 h-1 bg-navy-800 rounded-full" />
          
          {/* Animated Signal on Rail */}
          <motion.div 
            className="absolute left-0 h-1 bg-gradient-to-r from-transparent via-accent-cyan to-transparent w-[20%]"
            animate={{ left: ['-20%', '100%'] }}
            transition={{ duration: 4, ease: "linear", repeat: Infinity }}
          />

          {/* Nodes */}
          <div className="absolute left-0 right-0 flex justify-between items-center">
            {pipelineStages.map((stage, i) => (
              <motion.div
                key={stage}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group relative flex flex-col items-center"
              >
                {/* Node Point */}
                <div className="w-3 h-3 rounded-full bg-navy-900 border-2 border-accent-cyan relative z-10 group-hover:bg-accent-cyan group-hover:shadow-[0_0_15px_rgba(34,211,238,0.8)] transition-all duration-300" />
                
                {/* Label */}
                <div className="absolute top-6 font-mono text-[10px] sm:text-xs text-text-muted group-hover:text-accent-cyan transition-colors tracking-widest whitespace-nowrap rotate-45 sm:rotate-0 origin-left sm:origin-center mt-2 sm:mt-0">
                  {stage}
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
