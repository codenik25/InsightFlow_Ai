import React from 'react';
import { motion } from 'framer-motion';
import { Database, Radar, Activity, TrendingUp, Sparkles, Zap } from 'lucide-react';

interface InsightCoreProps {
  hasLoaded: boolean;
}

export const InsightCore: React.FC<InsightCoreProps> = ({ hasLoaded }) => {
  // Nodes surrounding the core in tight, balanced orbital arrangement
  const nodes = [
    // Left side nodes
    { id: 'data', label: 'DATA', icon: Database, x: -85, y: -70, delay: 1.1 },
    { id: 'signals', label: 'SIGNALS', icon: Radar, x: -100, y: 0, delay: 1.2 },
    { id: 'anomalies', label: 'ANOMALIES', icon: Activity, x: -85, y: 70, delay: 1.3 },
    // Right side nodes
    { id: 'insights', label: 'INSIGHTS', icon: TrendingUp, x: 85, y: -65, delay: 1.2 },
    { id: 'recommendations', label: 'RECOMMEND', icon: Sparkles, x: 100, y: 5, delay: 1.3 },
    { id: 'actions', label: 'ACTIONS', icon: Zap, x: 85, y: 75, delay: 1.4 },
  ];

  // Vertical light beams
  const beams = [
    { x: 315, height: 290, opacity: 0.6, delay: 0.2 },
    { x: 340, height: 370, opacity: 0.85, delay: 0.5 },
    { x: 365, height: 260, opacity: 0.55, delay: 0.8 },
    { x: 385, height: 410, opacity: 0.95, delay: 0.1 },
    { x: 400, height: 440, opacity: 1.0, delay: 0.3 },
    { x: 415, height: 420, opacity: 0.95, delay: 0.6 },
    { x: 435, height: 280, opacity: 0.55, delay: 0.9 },
    { x: 460, height: 380, opacity: 0.85, delay: 0.4 },
    { x: 485, height: 310, opacity: 0.6, delay: 0.7 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: hasLoaded ? 1 : 0 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      className="relative w-full h-[480px] lg:h-[540px] xl:h-[580px] flex items-center justify-center pointer-events-none select-none"
    >
      
      {/* 1. Large Radial Cyan & Blue Bloom behind Core */}
      <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22)_0%,rgba(59,130,246,0.08)_40%,transparent_70%)] blur-[50px] pointer-events-none" />
      <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.06)_0%,transparent_60%)] blur-[75px] pointer-events-none" />

      {/* Main SVG Visualization Canvas */}
      <svg viewBox="0 0 800 700" className="w-full h-full max-w-[800px] overflow-visible">
        <defs>
          {/* Radial glow for central energy orb */}
          <radialGradient id="centerOrbGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#67E8F9" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#22D3EE" stopOpacity="0.5" />
            <stop offset="80%" stopColor="#3B82F6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#050F1C" stopOpacity="0" />
          </radialGradient>

          {/* Vertical light beam gradient */}
          <linearGradient id="beamGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#22D3EE" stopOpacity="0.7" />
            <stop offset="85%" stopColor="#67E8F9" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Ring Gradients */}
          <linearGradient id="orbitCyanBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="scanSweep" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="70%" stopColor="#22D3EE" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#67E8F9" stopOpacity="0.95" />
          </linearGradient>

          {/* Perspective Ground Base Gradient */}
          <radialGradient id="groundDiscGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#1E3A8A" stopOpacity="0.25" />
            <stop offset="80%" stopColor="#02050A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#02050A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ============================================================ */}
        {/* A. 3D PERSPECTIVE FLOOR STAGE (Concentric ground ellipses) */}
        {/* ============================================================ */}
        <g id="ground-stage" className="origin-center">
          {/* Base glowing floor disc */}
          <ellipse cx="400" cy="500" rx="240" ry="60" fill="url(#groundDiscGrad)" />
          
          {/* Concentric Ground Rings */}
          <ellipse cx="400" cy="500" rx="250" ry="62" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" strokeDasharray="6 6" />
          <ellipse cx="400" cy="500" rx="210" ry="52" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5" />
          <ellipse cx="400" cy="500" rx="160" ry="40" fill="none" stroke="rgba(103,232,249,0.7)" strokeWidth="1.2" strokeDasharray="3 4" />
          <ellipse cx="400" cy="500" rx="110" ry="27" fill="none" stroke="rgba(34,211,238,0.85)" strokeWidth="2" />
          <ellipse cx="400" cy="500" rx="60" ry="15" fill="none" stroke="#67E8F9" strokeWidth="2" className="filter drop-shadow-[0_0_8px_#67E8F9]" />

          {/* Radial Spokes on the ground plane */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 22.5 * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return (
              <line
                key={`spoke-${i}`}
                x1={400 + cos * 110}
                y1={500 + sin * 27}
                x2={400 + cos * 240}
                y2={500 + sin * 60}
                stroke="rgba(34,211,238,0.25)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {/* ============================================================ */}
        {/* B. VERTICAL DATA STREAMS (Luminous light pillars) */}
        {/* ============================================================ */}
        <g id="vertical-beams">
          {beams.map((beam, i) => (
            <g key={`beam-${i}`}>
              <line
                x1={beam.x}
                y1={500}
                x2={beam.x}
                y2={500 - beam.height}
                stroke="url(#beamGrad)"
                strokeWidth={i === 4 ? "3.5" : i % 2 === 0 ? "2" : "1.5"}
                opacity={beam.opacity}
                className={i === 4 ? "filter drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]" : ""}
              />
              
              <motion.circle
                cx={beam.x}
                cy={500}
                r={i === 4 ? "3" : "2"}
                fill="#FFFFFF"
                className="filter drop-shadow-[0_0_6px_#67E8F9]"
                animate={{
                  cy: [500, 500 - beam.height],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 2.2 + (i % 3) * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: beam.delay
                }}
              />
            </g>
          ))}
        </g>

        {/* ============================================================ */}
        {/* C. CONCENTRIC FLOATING ORBITAL RINGS */}
        {/* ============================================================ */}
        <g id="core-orbital-system">
          {/* Ring 1: Outermost dashed radar perimeter */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "400px 310px" }}
          >
            <circle cx="400" cy="310" r="210" fill="none" stroke="rgba(34,211,238,0.18)" strokeWidth="1" strokeDasharray="5 10" />
            <circle cx="400" cy="310" r="222" fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="1" />
            <line x1="400" y1="85" x2="400" y2="100" stroke="#67E8F9" strokeWidth="2" opacity="0.8" />
            <line x1="400" y1="520" x2="400" y2="535" stroke="#67E8F9" strokeWidth="2" opacity="0.8" />
            <line x1="175" y1="310" x2="190" y2="310" stroke="#67E8F9" strokeWidth="2" opacity="0.8" />
            <line x1="610" y1="310" x2="625" y2="310" stroke="#67E8F9" strokeWidth="2" opacity="0.8" />
          </motion.g>

          {/* Ring 2: Primary orbital ring (Clockwise 18s) */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "400px 310px" }}
          >
            <circle cx="400" cy="310" r="165" fill="none" stroke="url(#orbitCyanBlue)" strokeWidth="1.8" strokeDasharray="14 10 4 10" />
            <circle cx="565" cy="310" r="3" fill="#67E8F9" className="filter drop-shadow-[0_0_6px_#67E8F9]" />
            <circle cx="235" cy="310" r="3" fill="#67E8F9" className="filter drop-shadow-[0_0_6px_#67E8F9]" />
          </motion.g>

          {/* Ring 3: Middle segmented ring (Counter-clockwise 22s) */}
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "400px 310px" }}
          >
            <circle cx="400" cy="310" r="128" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="3" strokeDasharray="1 8" />
            <circle cx="400" cy="310" r="118" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1.2" strokeDasharray="40 25" />
          </motion.g>

          {/* Ring 4: Inner precision ring (Clockwise 14s) */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "400px 310px" }}
          >
            <circle cx="400" cy="310" r="92" fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="8 16" opacity="0.75" />
            <circle cx="400" cy="310" r="82" fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth="2" strokeDasharray="80 120" />
          </motion.g>

          {/* High-speed scanning sweep arc */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "400px 310px" }}
          >
            <path d="M 400 192 A 118 118 0 0 1 518 310" fill="none" stroke="url(#scanSweep)" strokeWidth="3.5" />
          </motion.g>

          {/* ============================================================ */}
          {/* D. CENTRAL CORE ORB & CHIP */}
          {/* ============================================================ */}
          <motion.circle
            cx="400"
            cy="310"
            r="68"
            fill="url(#centerOrbGrad)"
            animate={{
              r: [65, 75, 65],
              opacity: [0.85, 1, 0.85]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          <circle cx="400" cy="310" r="56" fill="#040C19" stroke="#67E8F9" strokeWidth="2" className="filter drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]" />
          <circle cx="400" cy="310" r="48" fill="#050F1C" stroke="rgba(34,211,238,0.4)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Central Cybernetic Chip Icon */}
          <g transform="translate(384, 284) scale(1.35)" className="filter drop-shadow-[0_0_8px_rgba(103,232,249,0.9)]">
            <rect x="5" y="5" width="14" height="14" rx="2" fill="#061224" stroke="#67E8F9" strokeWidth="1.5" />
            <rect x="8" y="8" width="8" height="8" fill="none" stroke="#22D3EE" strokeWidth="1" />
            <rect x="10.5" y="10.5" width="3" height="3" fill="#FFFFFF" />
            <line x1="9" y1="2" x2="9" y2="5" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="12" y1="2" x2="12" y2="5" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="15" y1="2" x2="15" y2="5" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="9" y1="19" x2="9" y2="22" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="12" y1="19" x2="12" y2="22" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="15" y1="19" x2="15" y2="22" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="2" y1="9" x2="5" y2="9" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="2" y1="12" x2="5" y2="12" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="2" y1="15" x2="5" y2="15" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="19" y1="9" x2="22" y2="9" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="19" y1="12" x2="22" y2="12" stroke="#67E8F9" strokeWidth="1.2" />
            <line x1="19" y1="15" x2="22" y2="15" stroke="#67E8F9" strokeWidth="1.2" />
          </g>

          <text
            x="400"
            y="329"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="JetBrains Mono, monospace"
            fontSize="9"
            fontWeight="bold"
            letterSpacing="0.25em"
            className="filter drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          >
            INSIGHT
          </text>
          <text
            x="400"
            y="340"
            textAnchor="middle"
            fill="#67E8F9"
            fontFamily="JetBrains Mono, monospace"
            fontSize="8"
            fontWeight="bold"
            letterSpacing="0.25em"
            className="filter drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]"
          >
            ENGINE
          </text>
        </g>

        {/* ============================================================ */}
        {/* E. CONNECTING SIGNAL PATHS (from core to nodes) */}
        {/* ============================================================ */}
        <g id="signal-paths" opacity="0.65">
          <path d="M 400 310 C 350 270, 320 250, 295 230" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
          <path d="M 400 310 C 350 310, 310 310, 278 310" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
          <path d="M 400 310 C 350 345, 320 370, 295 390" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
          <path d="M 400 310 C 450 270, 480 250, 505 235" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
          <path d="M 400 310 C 450 310, 490 312, 522 315" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
          <path d="M 400 310 C 450 345, 480 375, 505 395" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />

          {/* Traveling Signal Packets */}
          <motion.circle r="2.2" fill="#67E8F9" className="filter drop-shadow-[0_0_6px_#67E8F9]">
            <animateMotion dur="3s" repeatCount="indefinite" path="M 295 230 C 320 250, 350 270, 400 310" />
          </motion.circle>
          <motion.circle r="2.2" fill="#67E8F9" className="filter drop-shadow-[0_0_6px_#67E8F9]">
            <animateMotion dur="3.5s" repeatCount="indefinite" path="M 278 310 C 310 310, 350 310, 400 310" />
          </motion.circle>
          <motion.circle r="2.2" fill="#67E8F9" className="filter drop-shadow-[0_0_6px_#67E8F9]">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 400 310 C 450 270, 480 250, 505 235" />
          </motion.circle>
          <motion.circle r="2.2" fill="#67E8F9" className="filter drop-shadow-[0_0_6px_#67E8F9]">
            <animateMotion dur="3.2s" repeatCount="indefinite" path="M 400 310 C 450 310, 490 312, 522 315" />
          </motion.circle>
        </g>
      </svg>

      {/* ============================================================ */}
      {/* F. CONNECTED FLOATING NODES (HTML Overlay centered at Core center 44%) */}
      {/* ============================================================ */}
      <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 pointer-events-none">
        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={hasLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.8, delay: node.delay }}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute px-2 py-0.5 rounded-md bg-[#040C19]/85 backdrop-blur-md border border-accent-cyan/35 shadow-[0_0_15px_rgba(34,211,238,0.18)] flex items-center gap-1.5 pointer-events-auto hover:border-accent-cyan hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-default group whitespace-nowrap"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan group-hover:shadow-[0_0_6px_#67E8F9] animate-pulse" />
              <Icon size={10} className="text-accent-cyan" />
              <span className="font-mono text-[8px] font-bold tracking-[0.14em] text-slate-200 uppercase">
                {node.label}
              </span>
            </motion.div>
          );
        })}
      </div>

    </motion.div>
  );
};

export default InsightCore;
