import React from 'react';
import { HealthStatus } from '../types';

interface HeaderProps {
  health?: HealthStatus | null;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ health, activeTab, setActiveTab }) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-[72px] w-full border-b border-white/5 bg-[#02050A]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 relative z-50">
      {/* LEFT: Logo & Engine Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          {/* IF Box Logo */}
          <div className="w-9 h-9 bg-accent-cyan rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
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
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#040F1A] border border-white/5 rounded-full mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
          <span className="font-mono text-[9px] tracking-widest text-emerald-400 font-bold">
            ENGINE ONLINE
          </span>
        </div>
      </div>

      {/* CENTER: Navigation Categories */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center h-full mt-1">
        <nav className="flex items-center h-full font-sans text-[11px] font-semibold tracking-[0.1em] gap-8">
          {['DATA', 'SIGNALS', 'PATTERNS', 'PREDICTIONS', 'DECISIONS'].map(tab => {
            const id = tab.toLowerCase();
            const isActive = activeTab === id;
            return (
              <button 
                key={id}
                onClick={() => setActiveTab && setActiveTab(id)}
                className={`relative h-full flex items-center transition-all duration-300
                  ${isActive ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-400 hover:text-slate-200'}`}
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

      {/* RIGHT: System Status & User */}
      <div className="flex items-center gap-8 mt-1">
        <div className="hidden sm:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]' : 'bg-rose-400 shadow-[0_0_8px_#FB7185]'}`} />
            <span className={`font-mono text-[9px] font-bold tracking-[0.15em] uppercase ${isHealthy ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
              SYSTEM {isHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-slate-400 uppercase">
              SYNC 98.7%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-white/10 pl-6 cursor-pointer group">
          <div className="w-6 h-6 rounded-full bg-[#0A1930] border border-accent-blue/30 flex items-center justify-center text-[10px] font-bold text-accent-cyan">
            CM
          </div>
          <span className="font-mono text-[9px] tracking-widest text-slate-300 font-bold group-hover:text-white transition-colors">
            COMMANDER
          </span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-slate-500 ml-1">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </header>
  );
};

