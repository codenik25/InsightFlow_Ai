import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, Cpu, BrainCircuit, Activity, Settings, Target, Shield, Layers, Server } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const sections = [
    {
      title: 'INTELLIGENCE',
      items: [
        { id: 'UPLOAD', label: 'DATA INTELLIGENCE', icon: Database },
        { id: 'ANALYSIS', label: 'SIGNAL ANALYSIS', icon: Activity },
        { id: 'INSIGHTS', label: 'PATTERN DETECTION', icon: Search },
      ]
    },
    {
      title: 'DECISION ENGINE',
      items: [
        { id: 'PREDICTIONS', label: 'PREDICTIONS', icon: BrainCircuit },
        { id: 'OPTIMIZATION', label: 'OPTIMIZATION', icon: Settings },
        { id: 'RECOMMENDATIONS', label: 'RECOMMENDATIONS', icon: Target },
        { id: 'DECISIONS', label: 'DECISIONS', icon: Shield },
        { id: 'GUARDRAILS', label: 'GUARDRAILS', icon: Shield },
      ]
    },
    {
      title: 'DATA',
      items: [
        { id: 'sources', label: 'DATA SOURCES', icon: Layers },
        { id: 'pipelines', label: 'INGESTION', icon: Server },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'model', label: 'MODEL STATUS', icon: Cpu },
        { id: 'activity', label: 'ACTIVITY', icon: Activity },
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
                    className={`relative w-full flex items-center px-4 py-3 text-left transition-all duration-300 rounded-lg group overflow-hidden
                      ${isActive ? 'bg-[#0A1930] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'}`}
                  >
                    {/* Active Left Border Indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/4 bg-accent-cyan shadow-[0_0_10px_#22D3EE] rounded-r-full" />
                    )}
                    
                    {/* Hover Line */}
                    {!isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent-cyan/0 group-hover:bg-accent-cyan/30 rounded-r-full transition-colors" />
                    )}

                    <div className="relative z-10 flex items-center gap-2 pl-1">
                      <item.icon className={`w-4 h-4 mr-3 relative z-10 transition-colors duration-300 ${isActive ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span className="relative z-10 font-sans font-semibold text-[10px] tracking-widest uppercase">
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      
      {/* Footer: Need Help */}
      <div className="p-6">
        <button className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
              ?
            </div>
            <div className="flex flex-col text-left">
              <span className="font-sans font-bold text-[10px] tracking-widest text-white uppercase">
                NEED HELP?
              </span>
              <span className="font-sans text-[10px] text-slate-500">
                Documentation & Support
              </span>
            </div>
          </div>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-slate-600 group-hover:text-slate-400 transition-colors">
            <path d="M1 9L5 5L1 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </motion.aside>
  );
};
