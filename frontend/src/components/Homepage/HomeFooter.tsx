import React from 'react';

export const HomeFooter: React.FC = () => {
  return (
    <footer className="bg-[#030408] border-t border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        
        <div className="flex flex-col items-center md:items-start gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-xl tracking-[0.2em] text-slate-100">
              INSIGHTFLOW
            </span>
            <span className="text-accent-cyan font-mono text-[10px] tracking-[0.2em] font-bold mt-1">
              AI
            </span>
          </div>
          <p className="text-slate-500 text-xs font-mono tracking-widest uppercase">From data to decisions.</p>
        </div>

        <div className="flex items-center gap-8 text-xs font-sans font-medium text-slate-400">
          <a href="#" className="hover:text-accent-cyan transition-colors">Documentation</a>
          <a href="#" className="hover:text-accent-cyan transition-colors">API Reference</a>
          <a href="#" className="hover:text-accent-cyan transition-colors">Privacy Policy</a>
        </div>

        <div className="text-xs font-mono tracking-wider text-slate-600">
          &copy; {new Date().getFullYear()} InsightFlow AI.
        </div>

      </div>
    </footer>
  );
};

export default HomeFooter;
