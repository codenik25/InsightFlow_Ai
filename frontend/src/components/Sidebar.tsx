import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, Cpu, BrainCircuit, Activity, Settings, Target, Shield, Layers, Server, HelpCircle } from 'lucide-react';

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
      className="w-[240px] shrink-0 border-r border-[rgba(34,211,238,0.08)] bg-[rgba(2,7,14,0.82)] backdrop-blur-xl hidden md:flex flex-col py-6 overflow-y-auto relative z-20 custom-scrollbar"
    >
      <div className="flex flex-col gap-8">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="px-6 text-[9px] font-mono font-bold text-slate-500 tracking-[0.25em] uppercase mb-3">
              {section.title}
            </h3>
            <nav className="flex flex-col relative space-y-1 px-3">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center px-4 h-[44px] text-left transition-all duration-200 rounded-lg group overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan/50
                      ${isActive ? 'bg-gradient-to-r from-accent-cyan/10 to-transparent text-white border border-accent-cyan/10 shadow-[inset_2px_0_10px_rgba(34,211,238,0.05)]' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}`}
                  >
                    {/* Active Left Border Indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[24px] bg-accent-cyan shadow-[0_0_10px_#22D3EE] rounded-r-full" />
                    )}
                    
                    {/* Hover Line */}
                    {!isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[16px] bg-accent-cyan/0 group-hover:bg-accent-cyan/30 rounded-r-full transition-colors" />
                    )}

                    <div className="relative z-10 flex items-center gap-2 pl-2">
                      <item.icon className={`w-[18px] h-[18px] mr-3 relative z-10 transition-colors duration-200 stroke-[1.5px]
                        ${isActive ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'text-slate-500 group-hover:text-accent-cyan/80'}`} 
                      />
                      <span className="relative z-10 font-sans font-medium text-[12px] tracking-wide">
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
      <div className="p-6 mt-auto">
        <button className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 hover:border-accent-cyan/20 hover:bg-white/5 transition-colors duration-200 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center text-slate-400 group-hover:text-accent-cyan group-hover:border-accent-cyan/50 transition-colors">
              <HelpCircle className="w-4 h-4 stroke-[1.5px]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-sans font-bold text-[10px] tracking-widest text-white uppercase group-hover:text-accent-cyan transition-colors">
                NEED HELP?
              </span>
              <span className="font-sans text-[10px] text-slate-500">
                Documentation & Support
              </span>
            </div>
          </div>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-slate-600 group-hover:text-accent-cyan transition-colors">
            <path d="M1 9L5 5L1 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </motion.aside>
  );
};
