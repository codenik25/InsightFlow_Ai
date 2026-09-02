import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Event {
  id: string;
  time: string;
  label: string;
}

export const LiveIntelligenceRail: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([
    { id: '1', time: '09:42:18', label: 'SIGNAL DETECTED' },
    { id: '2', time: '09:42:21', label: 'PATTERN IDENTIFIED' },
    { id: '3', time: '09:42:24', label: 'ANOMALY DETECTED' },
    { id: '4', time: '09:42:27', label: 'INSIGHT GENERATED' },
    { id: '5', time: '09:42:31', label: 'PREDICTION UPDATED' },
    { id: '6', time: '09:42:35', label: 'DECISION READY' },
  ]);

  // Simulate incoming live intelligence
  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => {
        const labels = ['SIGNAL DETECTED', 'PATTERN IDENTIFIED', 'ANOMALY DETECTED', 'INSIGHT GENERATED', 'PREDICTION UPDATED', 'DECISION READY'];
        const randomLabel = labels[Math.floor(Math.random() * labels.length)];
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const newEvent = { id: Math.random().toString(36).substr(2, 9), time: timeStr, label: randomLabel };
        const updated = [...prev, newEvent];
        if (updated.length > 8) updated.shift();
        return updated;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.aside 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-[260px] shrink-0 border-l border-white/5 bg-[#02050A]/40 backdrop-blur-md hidden xl:flex flex-col py-6 px-6 overflow-hidden relative z-20"
    >
      <div className="flex items-center gap-2 mb-8">
        <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-[0_0_8px_#22D3EE] animate-pulse" />
        <h3 className="text-[9px] font-mono font-bold text-accent-cyan tracking-[0.25em] uppercase">
          LIVE INTELLIGENCE
        </h3>
      </div>
      
      <div className="relative border-l border-slate-800/80 ml-1 space-y-6 flex-1 flex flex-col justify-end pb-8">
        <AnimatePresence initial={false}>
          {events.map((event, idx) => {
            const isNewest = idx === events.length - 1;
            // Calculate opacity based on age (newest is most opaque)
            const age = events.length - 1 - idx;
            const opacity = Math.max(0.15, 1 - age * 0.2);
            
            return (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, x: 12, filter: 'blur(4px)' }}
                animate={{ opacity, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative pl-6 group"
              >
                {/* Timeline dot */}
                <div className={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full border-2 transition-colors duration-500
                  ${isNewest ? 'bg-accent-cyan border-accent-cyan shadow-[0_0_12px_#22D3EE]' : 'bg-[#02050A] border-slate-700 group-hover:border-slate-500'}`} 
                />
                
                {isNewest && (
                  <motion.div 
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-accent-cyan pointer-events-none"
                  />
                )}
                
                <div className="font-mono text-[9px] text-slate-500 mb-1">
                  {event.time}
                </div>
                
                <div className={`font-mono text-[10px] tracking-wider transition-colors duration-500 ${isNewest ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-slate-400'}`}>
                  {event.label}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};

