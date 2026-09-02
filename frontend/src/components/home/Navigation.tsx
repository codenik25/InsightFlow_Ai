import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface NavigationProps {
  onLaunch?: () => void;
  hasLoaded: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ onLaunch, hasLoaded }) => {
  const navItems = ['Platform', 'Capabilities', 'Solutions'];

  return (
    <motion.header
      initial={{ opacity: 0, y: -15 }}
      animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: -15 }}
      transition={{ duration: 0.7, delay: 0.35 }}
      className="absolute top-0 left-0 right-0 z-40 px-5 sm:px-12 pt-5 sm:pt-6 pb-3 flex items-center justify-between pointer-events-auto select-none"
    >
      {/* Invisible spacer on left for desktop to center the middle logo */}
      <div className="w-[180px] hidden md:block" />

      {/* Center Branding & Navigation */}
      <div className="flex flex-col items-start md:items-center">
        <div className="flex items-center gap-2 mb-0.5 sm:mb-1.5">
          <span className="font-display font-bold text-lg sm:text-2xl tracking-[0.22em] text-white">
            INSIGHTFLOW
          </span>
          <span className="text-accent-cyan font-mono text-[11px] sm:text-xs font-bold tracking-[0.2em] -mt-0.5">
            AI
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-[13px] font-sans font-medium text-slate-400">
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="hover:text-accent-cyan transition-colors duration-200 tracking-wide"
            >
              {item}
            </a>
          ))}
        </nav>
      </div>

      {/* Right Open Platform Button */}
      <div className="flex justify-end md:w-[180px] md:pr-24 lg:pr-28 xl:pr-36">
        <button
          onClick={onLaunch}
          className="group flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#06101C]/80 hover:bg-[#06101C]/95 border border-white/10 hover:border-accent-cyan/50 text-white font-sans text-xs font-medium backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
        >
          <span>Open Platform</span>
          <ArrowRight size={12} className="text-accent-cyan transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.header>
  );
};

export default Navigation;
