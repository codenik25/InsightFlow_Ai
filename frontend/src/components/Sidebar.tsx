import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const sections = [
    {
      title: 'INTELLIGENCE',
      items: [
        { id: 'data', label: 'DATA INTELLIGENCE' },
        { id: 'signals', label: 'SIGNAL ANALYSIS' },
        { id: 'patterns', label: 'PATTERN DETECTION' },
      ]
    },
    {
      title: 'DECISION ENGINE',
      items: [
        { id: 'predictions', label: 'PREDICTIONS' },
        { id: 'recommendations', label: 'RECOMMENDATIONS' },
        { id: 'optimization', label: 'OPTIMIZATION' },
        { id: 'guardrails', label: 'DECISION GUARDRAILS' },
      ]
    },
    {
      title: 'DATA',
      items: [
        { id: 'sources', label: 'DATA SOURCES' },
        { id: 'pipelines', label: 'INGESTION PIPELINES' },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'model', label: 'MODEL STATUS' },
        { id: 'activity', label: 'ACTIVITY' },
      ]
    }
  ];

  return (
    <motion.aside 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-[200px] shrink-0 border-r border-white/5 bg-[#02050A]/70 backdrop-blur-xl hidden md:flex flex-col py-6 overflow-y-auto relative z-20"
    >
      <div className="flex flex-col gap-8">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="px-6 text-[9px] font-mono font-bold text-slate-500 tracking-[0.25em] uppercase mb-3">
              {section.title}
            </h3>
            <nav className="flex flex-col relative space-y-0.5 px-3">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center px-4 py-2.5 text-left transition-all duration-300 rounded-md group overflow-hidden
                      ${isActive ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
                  >
                    {/* Active Background Glow */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div 
                          layoutId="activeTabBg"
                          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.1)_0%,transparent_100%)] rounded-md pointer-events-none"
                          initial={false}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </AnimatePresence>
                    
                    {/* Active Indicator Line */}
                    {isActive && (
                      <motion.div 
                        layoutId="activeTabLine"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent-cyan rounded-r-full shadow-[0_0_12px_#22D3EE]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    
                    {/* Hover Line */}
                    {!isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent-cyan/0 group-hover:bg-accent-cyan/30 rounded-r-full transition-colors" />
                    )}

                    <span className={`font-sans text-[11px] tracking-widest uppercase transition-colors relative z-10 pl-1 ${isActive ? 'text-white font-medium drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </motion.aside>
  );
};

