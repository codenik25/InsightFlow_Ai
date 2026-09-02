import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CockpitFrameProps {
  hasLoaded: boolean;
}

export const CockpitFrame: React.FC<CockpitFrameProps> = ({ hasLoaded }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden">
      {/* Outer framing borders and technical corner brackets */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bracketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Top-Left Corner Bracket (Desktop only) */}
        <path
          d="M 18 80 L 18 30 L 30 18 L 160 18"
          fill="none"
          stroke="url(#bracketGrad)"
          strokeWidth="1.5"
          className="opacity-70 hidden md:block"
        />
        <line x1="30" y1="18" x2="42" y2="18" stroke="#67E8F9" strokeWidth="2.5" className="hidden md:block" />
        <line x1="18" y1="30" x2="18" y2="42" stroke="#67E8F9" strokeWidth="2.5" className="hidden md:block" />
        <circle cx="160" cy="18" r="2" fill="#22D3EE" className="hidden md:block" />

        {/* Top-Right Corner Bracket (Desktop only) */}
        <path
          d="M calc(100% - 160px) 18 L calc(100% - 30px) 18 L calc(100% - 18px) 30 L calc(100% - 18px) 80"
          fill="none"
          stroke="url(#bracketGrad)"
          strokeWidth="1.5"
          className="opacity-70 hidden md:block"
        />
        <line x1="calc(100% - 42px)" y1="18" x2="calc(100% - 30px)" y2="18" stroke="#67E8F9" strokeWidth="2.5" className="hidden md:block" />
        <line x1="calc(100% - 18px)" y1="30" x2="calc(100% - 18px)" y2="42" stroke="#67E8F9" strokeWidth="2.5" className="hidden md:block" />
        <circle cx="calc(100% - 160px)" cy="18" r="2" fill="#22D3EE" className="hidden md:block" />

        {/* Bottom-Left Corner Bracket */}
        <path
          d="M 18 calc(100% - 80px) L 18 calc(100% - 30px) L 30 calc(100% - 18px) L 160 calc(100% - 18px)"
          fill="none"
          stroke="url(#bracketGrad)"
          strokeWidth="1.5"
          className="opacity-70"
        />
        <circle cx="160" cy="calc(100% - 18px)" r="2" fill="#22D3EE" />

        {/* Bottom-Right Corner Bracket */}
        <path
          d="M calc(100% - 160px) calc(100% - 18px) L calc(100% - 30px) calc(100% - 18px) L calc(100% - 18px) calc(100% - 30px) L calc(100% - 18px) calc(100% - 80px)"
          fill="none"
          stroke="url(#bracketGrad)"
          strokeWidth="1.5"
          className="opacity-70"
        />
        <circle cx="calc(100% - 160px)" cy="calc(100% - 18px)" r="2" fill="#22D3EE" />

        {/* Faint Horizontal Screen Edge Tick Marks */}
        <line x1="220" y1="18" x2="340" y2="18" stroke="rgba(34,211,238,0.2)" strokeWidth="1" strokeDasharray="4 6" className="hidden md:block" />
        <line x1="calc(100% - 340px)" y1="18" x2="calc(100% - 220px)" y2="18" stroke="rgba(34,211,238,0.2)" strokeWidth="1" strokeDasharray="4 6" className="hidden md:block" />
      </svg>

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
