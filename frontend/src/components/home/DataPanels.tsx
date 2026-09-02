import React from 'react';
import { motion, Variants } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, Brain, Target, Server } from 'lucide-react';

interface DataPanelsProps {
  hasLoaded: boolean;
}

const revenueData = [
  { name: '01', value: 400 },
  { name: '05', value: 300 },
  { name: '09', value: 550 },
  { name: '13', value: 480 },
  { name: '17', value: 700 },
  { name: '21', value: 650 },
  { name: '25', value: 850 },
  { name: '30', value: 920 },
];

const insightsData = [
  { name: 'A', value: 40 },
  { name: 'B', value: 65 },
  { name: 'C', value: 85 },
  { name: 'D', value: 50 },
  { name: 'E', value: 95 },
  { name: 'F', value: 70 },
];

export const DataPanels: React.FC<DataPanelsProps> = ({ hasLoaded }) => {
  const panelVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.8, delay: 1.10 } }
  };

  const panelBaseClasses = "absolute z-[5] bg-[#040C19]/40 backdrop-blur-[16px] rounded-xl p-5 border border-accent-cyan/25 shadow-[0_0_30px_rgba(34,211,238,0.08)] pointer-events-auto";

  return (
    <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
      
      {/* 1. TOP: DATA ANALYSIS */}
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate={hasLoaded ? "visible" : "hidden"}
        className={`${panelBaseClasses} top-[8%] left-[45%] md:left-[55%] xl:left-[50%] w-[320px] h-[200px] border-accent-cyan/25`}
        style={{ rotate: '-0.5deg', y: -2 }}
        whileHover={{ y: -5, boxShadow: '0 0 40px rgba(34,211,238,0.15)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-accent-cyan" />
            <span className="font-mono text-xs text-text-secondary uppercase tracking-[0.15em]">Data Analysis</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulseGlow" />
        </div>
        <div className="mb-4">
          <div className="text-sm text-text-muted mb-1">Revenue Growth</div>
          <div className="font-display text-4xl text-text-white font-bold tracking-tight">+24.8%</div>
        </div>
        <div className="h-[60px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22D3EE" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#22D3EE" strokeWidth={1.5} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 2. LEFT/LOWER: AI INSIGHTS */}
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate={hasLoaded ? "visible" : "hidden"}
        className={`${panelBaseClasses} bottom-[15%] left-[42%] md:left-[45%] xl:left-[52%] w-[280px] h-[190px] border-accent-blue/25`}
        style={{ rotate: '1deg', y: 3 }}
        whileHover={{ y: 0, boxShadow: '0 0 40px rgba(59,130,246,0.15)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-accent-blue" />
            <span className="font-mono text-xs text-text-secondary uppercase tracking-[0.15em]">AI Insights</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulseGlow" />
        </div>
        <div className="mb-4">
          <div className="text-sm text-text-muted mb-1">Patterns Detected</div>
          <div className="font-display text-3xl text-text-white font-bold tracking-tight">93.7%</div>
        </div>
        <div className="h-[50px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={insightsData}>
              <Bar dataKey="value" fill="#3B82F6" radius={[2, 2, 0, 0]} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 3. RIGHT: DECISION IMPACT */}
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate={hasLoaded ? "visible" : "hidden"}
        className={`${panelBaseClasses} top-[22%] right-[2%] xl:right-[5%] w-[300px] h-[200px] border-accent-violet/25`}
        style={{ rotate: '0.5deg', y: 2 }}
        whileHover={{ y: -2, boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-accent-violet" />
            <span className="font-mono text-xs text-text-secondary uppercase tracking-[0.15em]">Decision Impact</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-accent-violet animate-pulseGlow" />
        </div>
        <div className="mb-4">
          <div className="text-sm text-text-muted mb-1">Value Created</div>
          <div className="font-display text-4xl text-text-white font-bold tracking-tight">₹2.45 Cr</div>
        </div>
        <div className="h-[50px] w-full flex items-end justify-between gap-1.5">
          {[40, 60, 45, 80, 55, 90, 70, 100].map((h, i) => (
            <motion.div
              key={i}
              className="w-full bg-gradient-to-t from-accent-violet/10 to-accent-violet/80 rounded-t-sm"
              animate={{ height: hasLoaded ? `${h}%` : '0%' }}
              transition={{ duration: 1.5, delay: 1.2 + (i * 0.05) }}
            />
          ))}
        </div>
      </motion.div>

      {/* 4. SYSTEM STATUS (Lower Right) */}
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate={hasLoaded ? "visible" : "hidden"}
        className={`${panelBaseClasses} bottom-[12%] right-[5%] xl:right-[8%] w-[240px] h-[160px] border-slate-700/50`}
        style={{ rotate: '-1deg', y: -1 }}
        whileHover={{ y: -3, boxShadow: '0 0 30px rgba(255,255,255,0.05)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-text-secondary" />
            <span className="font-mono text-[10px] text-text-secondary uppercase tracking-[0.15em]">System Status</span>
          </div>
        </div>
        
        <div className="space-y-3">
          {[
            { label: 'Data Processing', status: 'active', color: 'bg-accent-cyan' },
            { label: 'Model Running', status: 'active', color: 'bg-accent-blue' },
            { label: 'Decision Ready', status: 'active', color: 'bg-emerald-400' }
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="font-sans text-xs text-text-muted">{item.label}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${item.color} animate-pulseGlow`} />
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
};
