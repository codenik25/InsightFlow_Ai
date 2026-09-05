import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CockpitFrameProps {
  hasLoaded: boolean;
}

export const CockpitFrame: React.FC<CockpitFrameProps> = ({ hasLoaded }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden">
      {/* Outer framing borders and technical corner brackets */}
      {/* Top-Left Corner Bracket */}
      <div className="absolute top-0 left-0 w-44 h-24 hidden md:block">
        <svg viewBox="0 0 180 100" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="bracketGradTL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M 18 80 L 18 30 L 30 18 L 160 18" stroke="url(#bracketGradTL)" strokeWidth="1.5" className="opacity-70" />
          <line x1="30" y1="18" x2="42" y2="18" stroke="#67E8F9" strokeWidth="2.5" />
          <line x1="18" y1="30" x2="18" y2="42" stroke="#67E8F9" strokeWidth="2.5" />
          <circle cx="160" cy="18" r="2" fill="#22D3EE" />
        </svg>
      </div>

      {/* Top-Right Corner Bracket */}
      <div className="absolute top-0 right-0 w-44 h-24 hidden md:block -scale-x-100">
        <svg viewBox="0 0 180 100" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="bracketGradTR" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M 18 80 L 18 30 L 30 18 L 160 18" stroke="url(#bracketGradTR)" strokeWidth="1.5" className="opacity-70" />
          <line x1="30" y1="18" x2="42" y2="18" stroke="#67E8F9" strokeWidth="2.5" />
          <line x1="18" y1="30" x2="18" y2="42" stroke="#67E8F9" strokeWidth="2.5" />
          <circle cx="160" cy="18" r="2" fill="#22D3EE" />
        </svg>
      </div>

      {/* Bottom-Left Corner Bracket */}
      <div className="absolute bottom-0 left-0 w-44 h-24 -scale-y-100">
        <svg viewBox="0 0 180 100" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="bracketGradBL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M 18 80 L 18 30 L 30 18 L 160 18" stroke="url(#bracketGradBL)" strokeWidth="1.5" className="opacity-70" />
          <circle cx="160" cy="18" r="2" fill="#22D3EE" />
        </svg>
      </div>

      {/* Bottom-Right Corner Bracket */}
      <div className="absolute bottom-0 right-0 w-44 h-24 -scale-100">
        <svg viewBox="0 0 180 100" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="bracketGradBR" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M 18 80 L 18 30 L 30 18 L 160 18" stroke="url(#bracketGradBR)" strokeWidth="1.5" className="opacity-70" />
          <circle cx="160" cy="18" r="2" fill="#22D3EE" />
        </svg>
      </div>

      {/* Faint Horizontal Screen Edge Tick Marks */}
      <div className="absolute top-[18px] left-[220px] w-[120px] h-[1px] border-t border-dashed border-cyan-400/20 hidden md:block" />
      <div className="absolute top-[18px] right-[220px] w-[120px] h-[1px] border-t border-dashed border-cyan-400/20 hidden md:block" />

      {/* TOP-LEFT TELEMETRY (Visible only on md+) */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={hasLoaded ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute top-6 left-8 font-mono text-[10px] tracking-[0.2em] leading-relaxed text-slate-400 hidden md:block"
      >
        <div className="text-slate-200 font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          SYS // INIT
        </div>
        <div className="text-slate-400">NODE 07</div>
        <div className="text-accent-cyan/90 text-[9.5px]">SECURE CHANNEL</div>
      </motion.div>

      {/* TOP-RIGHT TELEMETRY (Visible only on md+) */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={hasLoaded ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute top-6 right-8 text-right font-mono text-[10px] tracking-[0.2em] leading-relaxed text-slate-400 hidden md:block"
      >
        <div className="text-slate-200 font-semibold flex items-center justify-end gap-2">
          SIGNAL ACTIVE
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="text-slate-400">DATA SYNC</div>
        <div className="text-accent-brightCyan text-[9.5px]">MODEL STATUS</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute bottom-5 left-6 sm:left-8 font-mono text-[9.5px] tracking-[0.18em] leading-relaxed text-slate-400 hidden sm:block"
      >
        <div className="text-slate-300 font-semibold mb-1">DATA STREAM</div>
        <div className="text-slate-300">PACKETS: 01482</div>
        <div className="text-accent-cyan">SYNC: 98.7%</div>
      </motion.div>

      {/* BOTTOM-RIGHT TELEMETRY */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={hasLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute bottom-5 right-6 sm:right-8 text-right font-mono text-[9.5px] tracking-[0.18em] leading-relaxed text-slate-400 hidden sm:block"
      >
        <div className="text-slate-300">LAT: 12ms</div>
        <div className="text-accent-cyan">THR: 1.2M/s</div>
      </motion.div>

      {/* CENTER-BOTTOM STAGE PROGRESS INDICATOR (Hidden on Load Complete) */}
      <AnimatePresence>
        {!hasLoaded && (
          <motion.div
            key="stage-progress"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.5 }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto z-40"
          >
            <div className="flex items-center gap-4 sm:gap-6 font-mono text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.25em]">
              <span className="text-slate-400">STAGE 03 / 05</span>
              <span className="text-accent-brightCyan font-semibold drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                DETECTING PATTERNS
              </span>
              <span className="text-slate-300">68%</span>
            </div>

            {/* Progress Rail */}
            <div className="w-[280px] sm:w-[420px] h-2 bg-navy-800/80 rounded-full p-[1px] border border-accent-cyan/25 overflow-hidden relative shadow-[0_0_15px_rgba(34,211,238,0.15)]">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "68%" }}
                transition={{ duration: 1.8, delay: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-brightCyan shadow-[0_0_12px_rgba(103,232,249,0.8)] relative"
              >
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full opacity-90 animate-pulse" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CockpitFrame;
