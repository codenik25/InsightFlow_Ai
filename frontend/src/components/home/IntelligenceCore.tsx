import React from 'react';
import { motion } from 'framer-motion';

interface IntelligenceCoreProps {
  hasLoaded: boolean;
}

export const IntelligenceCore: React.FC<IntelligenceCoreProps> = ({ hasLoaded }) => {
  return (
    <div className="absolute top-[52%] left-[72%] -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] pointer-events-none z-[6] flex items-center justify-center lg:w-[650px] md:left-1/2 md:top-1/2 lg:left-[72%]">
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={hasLoaded ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
        transition={{ duration: 1.5, delay: 0.20 }} /* core stabilizes at 200ms */
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Core SVG Structure */}
        <svg viewBox="0 0 800 800" className="w-full h-full">
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#050f1c" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="scanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Outer Grid Ring (Slower rotation 15s) */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 18, ease: "linear", repeat: Infinity }}
            className="origin-center"
          >
            <circle cx="400" cy="400" r="320" fill="none" stroke="url(#ringGradient)" strokeWidth="1.5" strokeDasharray="4 14" opacity="0.4" />
            <circle cx="400" cy="400" r="350" fill="none" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="1" />
            {/* Markers */}
            <line x1="400" y1="30" x2="400" y2="50" stroke="#67E8F9" strokeWidth="2" opacity="0.7" />
            <line x1="400" y1="750" x2="400" y2="770" stroke="#67E8F9" strokeWidth="2" opacity="0.7" />
            <line x1="30" y1="400" x2="50" y2="400" stroke="#67E8F9" strokeWidth="2" opacity="0.7" />
            <line x1="750" y1="400" x2="770" y2="400" stroke="#67E8F9" strokeWidth="2" opacity="0.7" />
          </motion.g>

          {/* Middle Solid Ring (Slower reverse rotation) */}
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 22, ease: "linear", repeat: Infinity }}
            className="origin-center"
          >
            <circle cx="400" cy="400" r="260" fill="none" stroke="url(#ringGradient)" strokeWidth="2" opacity="0.5" />
            <circle cx="400" cy="400" r="255" fill="none" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="8" strokeDasharray="1 10" />
          </motion.g>

          {/* Inner Data Ring */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 15, ease: "linear", repeat: Infinity }}
            className="origin-center"
          >
            <circle cx="400" cy="400" r="180" fill="none" stroke="#22D3EE" strokeWidth="1.5" opacity="0.6" strokeDasharray="10 30" />
            <circle cx="400" cy="400" r="170" fill="none" stroke="#8B5CF6" strokeWidth="3" opacity="0.4" strokeDasharray="100 200" />
          </motion.g>

          {/* Scanning Arc (6s) */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 6, ease: "linear", repeat: Infinity }}
            className="origin-center"
          >
            <path d="M 400 140 A 260 260 0 0 1 660 400" fill="none" stroke="url(#scanGradient)" strokeWidth="5" />
          </motion.g>

          {/* Central Orb (Larger) */}
          <circle cx="400" cy="400" r="140" fill="url(#coreGlow)" />
          <circle cx="400" cy="400" r="120" fill="none" stroke="#67E8F9" strokeWidth="1" opacity="0.8" />
          
          {/* Inner Chip / Core Icon */}
          <g transform="translate(352, 352) scale(2.0)" opacity="0.95">
            <path d="M6 6h28v28H6z" fill="none" stroke="#F5F7FF" strokeWidth="1.5" />
            <path d="M14 14h12v12H14z" fill="none" stroke="#22D3EE" strokeWidth="2" />
            {/* Pins */}
            <path d="M10 6v-4M20 6v-4M30 6v-4 M10 34v4M20 34v4M30 34v4 M6 10h-4M6 20h-4M6 30h-4 M34 10h4M34 20h4M34 30h4" stroke="#67E8F9" strokeWidth="1.5" />
          </g>
        </svg>

        {/* Pulsing Central Text */}
        <div className="absolute top-[62%] text-center left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
          <span className="font-mono text-xs tracking-[0.3em] text-accent-cyan uppercase mb-1 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">Status</span>
          <span className="font-display text-base tracking-[0.2em] text-text-white uppercase drop-shadow-md">Engine Active</span>
        </div>

      </motion.div>
    </div>
  );
};
