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
      className="w-[280px] shrink-0 hidden xl:flex flex-col h-[calc(100vh-100px)] mt-6 mr-6 mb-6 rounded-2xl border border-white/5 bg-[#040C19]/80 backdrop-blur-xl relative z-20 shadow-2xl"
    >
      <div className="flex items-center gap-3 p-6 pb-4 border-b border-white/5">
        <Activity className="w-4 h-4 text-accent-cyan" />
        <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-accent-cyan uppercase">
          LIVE INTELLIGENCE
        </h3>
      </div>
      
      <div className="relative flex-1 overflow-y-auto py-2">
        <div className="absolute left-[33.5px] top-4 bottom-4 w-[1px] bg-white/10" />
        
        <AnimatePresence>
          {events.map((event, index) => (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-14 pr-6 py-4 hover:bg-white/[0.02] transition-colors group cursor-pointer"
            >
              {/* Timeline Node Badge */}
              <div className={`absolute left-6 top-5 w-[16px] h-[16px] rounded flex items-center justify-center ${event.color} z-10`}>
                <event.icon className="w-2.5 h-2.5 text-white" />
              </div>
              
              <div className="font-mono text-[9px] text-slate-500 mb-0.5">
                {event.time}
              </div>
              
              <div className="font-mono text-[10px] font-bold tracking-wider text-white">
                {event.title}
              </div>
              
              <div className="font-sans text-[11px] text-slate-400 mt-1 leading-relaxed">
                {event.desc}
              </div>
              
              <div className="absolute right-6 top-5 w-1 h-1 rounded-full bg-slate-600 group-hover:bg-accent-cyan transition-colors" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 mt-auto">
        <button className="w-full py-3.5 px-4 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group flex items-center justify-center gap-2">
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-accent-violet uppercase group-hover:text-white transition-colors">
            VIEW ALL ACTIVITY
          </span>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-accent-violet group-hover:text-white transition-colors">
            <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </motion.aside>
  );
};

