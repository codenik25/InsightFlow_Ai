import React from 'react';
import { motion } from 'framer-motion';
import { Database, BrainCircuit, Lightbulb, Target } from 'lucide-react';

const stages = [
  { id: 'data', label: 'RAW DATA', icon: Database, desc: 'Ingest signals' },
  { id: 'analysis', label: 'ANALYSIS', icon: BrainCircuit, desc: 'Detect patterns' },
  { id: 'intelligence', label: 'INTELLIGENCE', icon: Lightbulb, desc: 'Generate insights' },
  { id: 'decision', label: 'DECISION', icon: Target, desc: 'Execute action' },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="relative w-full py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-[5vw] relative z-10">
        
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-4xl md:text-5xl font-bold mb-6 text-text-white"
          >
            Business data tells you what happened.<br />
            <span className="text-gradient-cyan">InsightFlow helps you decide what happens next.</span>
          </motion.h2>
        </div>

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-4">
          
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-navy-800 -translate-y-1/2 -z-10">
            <motion.div 
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-violet origin-left"
            />
          </div>

          {stages.map((stage, i) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              className="flex flex-col items-center w-full md:w-1/4 text-center group"
            >
              <div className="w-20 h-20 rounded-2xl glass-panel-premium flex items-center justify-center mb-6 relative group-hover:border-accent-cyan/50 transition-colors duration-300">
                <div className="absolute inset-0 bg-accent-cyan/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <stage.icon size={32} className="text-accent-cyan" />
              </div>
              <div className="font-mono text-sm font-semibold tracking-widest text-text-white mb-2">{stage.label}</div>
              <div className="font-sans text-sm text-text-secondary">{stage.desc}</div>
            </motion.div>
          ))}
          
        </div>
      </div>
    </section>
  );
};
