import React, { useState, useEffect } from 'react';


export const HomeNavbar: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-navy-black/90 backdrop-blur-xl border-b border-white/5 py-4 shadow-2xl' : 'bg-transparent py-8'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-2xl tracking-[0.2em] text-slate-100">
            INSIGHTFLOW
          </span>
          <span className="text-accent-cyan font-mono text-xs tracking-[0.3em] font-bold mt-1">
            AI
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-sans font-medium text-slate-300">
          <a href="#how-it-works" className="hover:text-accent-cyan transition-colors">Platform</a>
          <a href="#capabilities" className="hover:text-accent-cyan transition-colors">Capabilities</a>
          <a href="#" className="hover:text-accent-cyan transition-colors">Solutions</a>
        </div>

        <button 
          onClick={onLaunch}
          className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-2.5 rounded-lg font-semibold transition-all hover:border-accent-cyan/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] text-sm"
        >
          Open Platform
        </button>

      </div>
    </nav>
  );
};

export default HomeNavbar;
