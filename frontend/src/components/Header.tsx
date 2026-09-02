import { Activity, Server, User } from 'lucide-react';
import { HealthStatus } from '../types';

interface HeaderProps {
  health?: HealthStatus | null;
}

export const Header: React.FC<HeaderProps> = ({ health }) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="h-14 shrink-0 w-full border-b border-white/5 bg-[#02050A]/90 backdrop-blur-md flex items-center justify-between px-6 z-50">
      
      {/* LEFT: Logo & Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-accent-cyan shadow-[0_0_12px_#22D3EE]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <span className="font-sans font-bold text-sm tracking-widest text-white">INSIGHTFLOW AI</span>
        </div>
        
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
          <span className="font-mono text-[10px] text-emerald-400/90 tracking-widest uppercase">INTELLIGENCE ENGINE ONLINE</span>
        </div>
      </div>

      {/* CENTER: Navigation Categories */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-8">
        <nav className="flex items-center gap-6 font-sans text-xs tracking-wider">
          <button className="text-accent-cyan transition-colors">DATA INTELLIGENCE</button>
          <button className="text-slate-400 hover:text-slate-200 transition-colors">SIGNAL ANALYSIS</button>
          <button className="text-slate-400 hover:text-slate-200 transition-colors">PATTERNS</button>
          <button className="text-slate-400 hover:text-slate-200 transition-colors">PREDICTIONS</button>
          <button className="text-slate-400 hover:text-slate-200 transition-colors">DECISIONS</button>
        </nav>
      </div>

      {/* RIGHT: System Status & User */}
      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[10px] text-slate-400 tracking-wider">SYSTEM</span>
            <span className={`font-mono text-[10px] ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[10px] text-slate-400 tracking-wider">SYNC</span>
            <span className="font-mono text-[10px] text-accent-cyan">98.7%</span>
          </div>
        </div>

        <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />

        <button className="flex items-center gap-2 group hover:bg-white/5 px-2 py-1.5 rounded transition-colors">
          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center group-hover:border-accent-cyan/50 transition-colors">
            <User className="w-3.5 h-3.5 text-slate-300 group-hover:text-accent-cyan" />
          </div>
          <span className="font-mono text-[10px] text-slate-300 uppercase tracking-widest hidden sm:block">COMMANDER</span>
        </button>
      </div>
    </header>
  );
};

