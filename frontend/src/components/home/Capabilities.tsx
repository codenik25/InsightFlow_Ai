import React from 'react';
import { motion } from 'framer-motion';
import { Network, Zap, Shield, Search, TrendingUp, LineChart } from 'lucide-react';

const capabilities = [
  { icon: Network, title: 'Data Intelligence', desc: 'Connect disparate data sources into a unified analytical graph.' },
  { icon: Zap, title: 'Automated Insights', desc: 'Instantly surface hidden patterns without manual querying.' },
  { icon: Search, title: 'Anomaly Detection', desc: 'Real-time monitoring that alerts you to critical deviations.' },
  { icon: LineChart, title: 'Predictive ML', desc: 'Forecast future trends based on historical performance.' },
  { icon: TrendingUp, title: 'Optimization', desc: 'Identify the highest-yield actions for your current constraints.' },
  { icon: Shield, title: 'Decision Guardrails', desc: 'Simulate outcomes before committing resources to an action.' },
];

export const Capabilities: React.FC = () => {
  return (
    <section id="capabilities" className="relative w-full py-24 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-[5vw] relative z-10">
        
        <div className="mb-16">
          <span className="font-mono text-sm text-accent-cyan tracking-widest uppercase mb-4 block">Capabilities</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text-white max-w-2xl">
            Everything you need to turn information into action.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-panel-premium p-8 rounded-2xl group hover:border-accent-blue/40 transition-colors duration-300 relative overflow-hidden"
            >
              {/* Hover Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <cap.icon size={28} className="text-accent-blue mb-6 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="font-display text-xl font-semibold text-text-white mb-3">{cap.title}</h3>
              <p className="font-sans text-text-secondary leading-relaxed">{cap.desc}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
