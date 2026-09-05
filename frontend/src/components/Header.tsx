import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { HealthStatus } from '../types';

interface HeaderProps {
  health?: HealthStatus | null;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ health, activeTab, setActiveTab }) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-[72px] w-full border-b border-[rgba(34,211,238,0.10)] bg-[rgba(2,6,13,0.78)] backdrop-blur-md flex items-center justify-between px-6 shrink-0 relative z-50 gap-4">
      {/* LEFT: Logo & Engine Status */}
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-3">
          {/* IF Box Logo */}
          <div className="w-9 h-9 bg-gradient-to-br from-accent-cyan to-accent-electricBlue rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)] border border-white/20">
            <span className="font-sans font-black text-[#02050A] text-lg tracking-tighter">IF</span>
          </div>
          {/* Logo Text */}
          <div className="flex flex-col justify-center mt-1">
            <h1 className="text-[14px] font-bold text-white tracking-widest leading-none font-sans">
              INSIGHTFLOW AI
            </h1>
            <span className="text-[7.5px] font-mono text-slate-400 tracking-[0.25em] uppercase mt-1">
              Decision Intelligence Platform
            </span>
          </div>
        </div>
        
        {/* Engine Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#040F1A]/80 backdrop-blur border border-white/5 rounded-full mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-success shadow-[0_0_8px_#22C55E] animate-pulseSlow" />
          <span className="font-mono text-[9px] tracking-widest text-accent-success font-bold">
            ENGINE ONLINE
          </span>
        </div>
      </div>

      {/* CENTER: Navigation Categories */}
      <div className="hidden lg:flex flex-1 items-center justify-center min-w-0 px-4 mt-1">
        <nav className="flex items-center h-full font-sans text-[11px] font-semibold tracking-[0.1em] gap-4 xl:gap-8 overflow-hidden">
          {['DATA', 'SIGNALS', 'PATTERNS', 'PREDICTIONS', 'DECISIONS'].map(tab => {
            const id = tab.toLowerCase();
            const isActive = activeTab === id;
            return (
              <button 
                key={id}
                onClick={() => setActiveTab && setActiveTab(id)}
                className={`relative h-full flex items-center transition-all duration-300
                  ${isActive ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-400 hover:text-accent-cyan/80'}`}
              >
                {tab}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-accent-cyan shadow-[0_0_8px_#22D3EE] rounded-t-sm" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* RIGHT: Search, System Status & User */}
      <div className="flex items-center gap-4 xl:gap-6 shrink-0 mt-1">
        {/* Search */}
        <div className="hidden xl:flex items-center relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
          <input 
            type="text" 
            placeholder="Search datasets, insights..." 
            className="bg-[#0A1220]/50 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-[11px] text-white font-sans placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 focus:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all w-48 xl:w-64"
          />
        </div>

        <div className="hidden sm:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-accent-success shadow-[0_0_8px_#22C55E] animate-pulseSlow' : 'bg-accent-error shadow-[0_0_8px_#EF4444]'}`} />
            <span className={`font-mono text-[9px] font-bold tracking-[0.15em] uppercase ${isHealthy ? 'text-accent-success' : 'text-accent-error'}`}>
              SYSTEM {isHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-slate-400 uppercase">
              SYNC 98.7%
            </span>
          </div>
        </div>

        {/* Notifications */}
        <button className="relative text-slate-400 hover:text-white focus-visible:outline-none focus-visible:text-accent-cyan transition-colors rounded">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-error shadow-[0_0_5px_#EF4444]" />
        </button>

        <button className="flex items-center gap-2 border-l border-white/10 pl-6 cursor-pointer group focus-visible:outline-none">
          <div className="w-7 h-7 rounded-full bg-[#0A1930] border border-accent-electricBlue/30 flex items-center justify-center text-[10px] font-bold text-accent-cyan shadow-[0_0_10px_rgba(59,130,246,0.15)] group-hover:border-accent-cyan/50 group-focus-visible:border-accent-cyan/80 transition-colors">
            CM
          </div>
          <span className="font-mono text-[9px] tracking-widest text-slate-300 font-bold group-hover:text-white group-focus-visible:text-accent-cyan transition-colors">
            COMMANDER
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-focus-visible:text-accent-cyan transition-colors ml-1" />
        </button>
      </div>
    </header>
  );
};
