import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
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
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'active' | 'empty' | 'error'>('idle');

  // Load real insights only if valid dataset is selected
  useEffect(() => {
    if (!selectedDatasetId) {
      setEvents([]);
      setStatus('idle');
      return;
    }

    let isSubscribed = true;
    setStatus('loading');

    fetchInsights(selectedDatasetId)
      .then((res) => {
        if (!isSubscribed) return;
        if (res && res.insights && res.insights.length > 0) {
          const insightEvents = res.insights.slice(0, 8).reverse().map((insight) => ({
            id: insight.id,
            time: new Date(insight.created_at).toLocaleTimeString([], { hour12: false }),
            title: insight.title.toUpperCase(),
            desc: insight.title,
            type: 'insight',
            color: 'bg-accent-cyan shadow-[0_0_10px_#22D3EE]',
            icon: Activity
          }));
          setEvents(insightEvents);
          setStatus('active');
        } else {
          setEvents([]);
          setStatus('empty');
        }
      })
      .catch((_err) => {
        if (!isSubscribed) return;
        setEvents([]);
        setStatus('error');
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedDatasetId]);

  return (
    <motion.aside 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="w-[320px] shrink-0 hidden xl:flex flex-col h-full border-l border-[rgba(34,211,238,0.08)] bg-[rgba(2,7,14,0.82)] backdrop-blur-xl relative z-20"
    >
      <div className="flex items-center justify-between p-6 border-b border-[rgba(34,211,238,0.08)] bg-[#040C19]/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {status === 'active' && (
              <>
                <div className="absolute w-3 h-3 bg-accent-success rounded-full animate-ping opacity-20" />
                <div className="w-1.5 h-1.5 bg-accent-success rounded-full shadow-[0_0_8px_#22C55E]" />
              </>
            )}
            {status === 'loading' && (
              <>
                <div className="absolute w-3 h-3 bg-accent-cyan rounded-full animate-ping opacity-20" />
                <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full shadow-[0_0_8px_#22D3EE]" />
              </>
            )}
            {(status === 'idle' || status === 'empty' || status === 'error') && (
              <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
            )}
          </div>
          <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-slate-300 uppercase">
            LIVE INTELLIGENCE
          </h3>
        </div>

        <div className="text-[9px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full border border-white/5 text-slate-400">
          {status === 'active' ? 'STREAMING' : status === 'loading' ? 'FETCHING' : 'INACTIVE'}
        </div>
      </div>
      
      <div className="relative flex-1 overflow-y-auto p-4 custom-scrollbar">
        {status === 'loading' && (
          <div className="space-y-4 pt-4">
            <div className="h-20 bg-slate-900/40 rounded-xl border border-white/5 animate-pulse" />
            <div className="h-20 bg-slate-900/40 rounded-xl border border-white/5 animate-pulse" />
            <div className="h-20 bg-slate-900/40 rounded-xl border border-white/5 animate-pulse" />
          </div>
        )}

        {(status === 'idle' || status === 'empty' || !selectedDatasetId) && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8 relative">
            
            {/* Holographic Orb with Orbital Rings */}
            <div className="relative w-36 h-36 flex items-center justify-center mb-6">
              {/* Radial background glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-blue-600/10 to-purple-600/20 rounded-full blur-2xl pointer-events-none animate-pulse" />
              
              {/* Outer Orbital Ring (tilted) */}
              <motion.div 
                className="absolute inset-0 rounded-full border border-cyan-400/30"
                style={{ transform: "rotateX(68deg) rotateY(18deg)" }}
                animate={{ rotateZ: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22D3EE]" />
              </motion.div>

              {/* Counter Orbital Ring */}
              <motion.div 
                className="absolute inset-2 rounded-full border border-purple-500/25"
                style={{ transform: "rotateX(62deg) rotateY(-25deg)" }}
                animate={{ rotateZ: -360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-300 shadow-[0_0_8px_#C084FC]" />
              </motion.div>

              {/* Glowing Core Sphere */}
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-900 shadow-[0_0_30px_rgba(34,211,238,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tl from-slate-950/80 via-transparent to-white/20" />
              </div>
            </div>

            {/* Informational Text */}
            <h4 className="font-sans text-[14px] font-semibold text-white tracking-tight mb-2">
              No active intelligence stream
            </h4>
            <p className="font-sans text-[12px] text-slate-400 leading-relaxed max-w-[220px]">
              Select a pipeline stage to receive real-time insights for this dataset.
            </p>

            {/* Subtle flowing wave at bottom of rail */}
            <div className="absolute bottom-4 left-0 right-0 h-28 pointer-events-none overflow-hidden opacity-30">
              <svg className="w-full h-full" viewBox="0 0 320 100" fill="none">
                <motion.path
                  d="M0 60 C80 30, 160 90, 240 50 C280 30, 310 70, 340 50"
                  stroke="url(#rail-wave-cyan)"
                  strokeWidth="1.5"
                  animate={{ d: [
                    "M0 60 C80 30, 160 90, 240 50 C280 30, 310 70, 340 50",
                    "M0 50 C80 70, 160 30, 240 70 C280 50, 310 40, 340 60",
                    "M0 60 C80 30, 160 90, 240 50 C280 30, 310 70, 340 50"
                  ]}}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                <defs>
                  <linearGradient id="rail-wave-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
                    <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        )}

        {status === 'active' && events.length > 0 && (
          <>
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
          </>
        )}
      </div>

      <div className="p-6 border-t border-[rgba(34,211,238,0.08)] bg-[#040C19]/50 backdrop-blur-md">
        <button 
          disabled={status !== 'active'}
          className={`w-full h-10 glass-button rounded-xl flex items-center justify-center gap-2 group ${status !== 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
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

