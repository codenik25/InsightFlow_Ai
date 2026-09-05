import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Search, AlertTriangle, BrainCircuit, Target, CheckCircle2 } from 'lucide-react';
import { fetchInsights } from '../services/api';

interface Event {
  id: string;
  time: string;
  title: string;
  desc: string;
  type: string;
  color: string;
  icon: React.ElementType;
}

interface LiveIntelligenceRailProps {
  selectedDatasetId?: string | null;
}

export const LiveIntelligenceRail: React.FC<LiveIntelligenceRailProps> = ({ selectedDatasetId }) => {
  const [events, setEvents] = useState<Event[]>([
    { id: '1', time: '10:28:59', title: 'SIGNAL DETECTED', desc: 'Revenue anomaly signal', type: 'signal', color: 'bg-accent-cyan shadow-[0_0_10px_#22D3EE]', icon: Activity },
    { id: '2', time: '10:29:04', title: 'SIGNAL DETECTED', desc: 'Customer behavior shift', type: 'signal', color: 'bg-[#3B82F6] shadow-[0_0_10px_#3B82F6]', icon: Activity },
    { id: '3', time: '10:29:08', title: 'PATTERN IDENTIFIED', desc: 'Spending trend pattern', type: 'pattern', color: 'bg-accent-violet shadow-[0_0_10px_#8B5CF6]', icon: Search },
    { id: '4', time: '10:29:13', title: 'ANOMALY DETECTED', desc: 'Outlier in marketing data', type: 'anomaly', color: 'bg-amber-500 shadow-[0_0_10px_#F59E0B]', icon: AlertTriangle },
    { id: '5', time: '10:29:17', title: 'INSIGHT GENERATED', desc: 'High churn risk segment', type: 'insight', color: 'bg-teal-500 shadow-[0_0_10px_#14B8A6]', icon: BrainCircuit },
    { id: '6', time: '10:29:22', title: 'PREDICTION UPDATED', desc: 'Revenue forecast revised', type: 'prediction', color: 'bg-indigo-500 shadow-[0_0_10px_#6366F1]', icon: Target },
    { id: '7', time: '10:29:28', title: 'DECISION READY', desc: 'Retention strategy ready', type: 'decision', color: 'bg-emerald-500 shadow-[0_0_10px_#10B981]', icon: CheckCircle2 },
  ]);

  // Load real insights if dataset is selected
  useEffect(() => {
    if (selectedDatasetId) {
      fetchInsights(selectedDatasetId).then((res) => {
        if (res && res.insights && res.insights.length > 0) {
          const insightEvents = res.insights.slice(0, 5).reverse().map((insight) => ({
            id: insight.id,
            time: new Date(insight.created_at).toLocaleTimeString([], { hour12: false }),
            title: insight.title.toUpperCase(),
            desc: insight.title,
            type: 'insight',
            color: 'bg-accent-cyan shadow-[0_0_10px_#22D3EE]',
            icon: Activity
          }));
          setEvents(insightEvents);
        }
      }).catch(err => console.warn('Failed to fetch insights for rail', err));
    }
  }, [selectedDatasetId]);

  return (
    <motion.aside 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="w-[320px] shrink-0 hidden xl:flex flex-col h-full border-l border-[rgba(34,211,238,0.08)] bg-[rgba(2,7,14,0.82)] backdrop-blur-xl relative z-20"
    >
      <div className="flex items-center gap-3 p-6 border-b border-[rgba(34,211,238,0.08)] bg-[#040C19]/50 backdrop-blur-md">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-3 h-3 bg-accent-success rounded-full animate-ping opacity-20" />
          <div className="w-1.5 h-1.5 bg-accent-success rounded-full shadow-[0_0_8px_#22C55E]" />
        </div>
        <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-slate-300 uppercase">
          LIVE INTELLIGENCE
        </h3>
      </div>
      
      <div className="relative flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="absolute left-[35px] top-6 bottom-6 w-[1px] bg-gradient-to-b from-accent-cyan/50 via-white/10 to-transparent" />
        
        <AnimatePresence>
          {events.map((event) => (
            <motion.div 
              layout
              key={event.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative pl-12 py-4 group cursor-pointer"
            >
              {/* Timeline Node */}
              <div className="absolute left-[13px] top-8 w-3 h-3 rounded-full bg-[#02050A] border-2 border-slate-600 group-hover:border-accent-cyan transition-colors z-10 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-transparent group-hover:bg-accent-cyan transition-colors" />
              </div>
              
              <div className="glass-panel-premium p-4 rounded-xl border border-white/5 group-hover:border-accent-cyan/30 transition-all duration-300 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <event.icon className="w-12 h-12" />
                </div>
                
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <span className="font-mono text-[10px] text-accent-cyan tracking-wider">{event.time}</span>
                  <div className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border border-white/10 ${event.color.includes('cyan') ? 'text-accent-cyan bg-accent-cyan/10' : event.color.includes('emerald') ? 'text-emerald-400 bg-emerald-400/10' : 'text-accent-intelligence bg-accent-intelligence/10'}`}>
                    {event.type}
                  </div>
                </div>
                
                <div className="font-sans font-bold text-[13px] tracking-wide text-white mb-1.5 relative z-10">
                  {event.title}
                </div>
                
                <div className="font-sans text-[12px] text-slate-400 leading-relaxed relative z-10">
                  {event.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-6 border-t border-[rgba(34,211,238,0.08)] bg-[#040C19]/50 backdrop-blur-md">
        <button className="w-full h-10 glass-button rounded-xl flex items-center justify-center gap-2 group">
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-accent-cyan uppercase group-hover:text-white transition-colors">
            VIEW FULL LOG
          </span>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-accent-cyan group-hover:text-white transition-colors">
            <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </motion.aside>
  );
};

