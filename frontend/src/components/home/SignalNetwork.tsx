import React from 'react';
import { motion } from 'framer-motion';

interface SignalNetworkProps {
  hasLoaded: boolean;
}

const nodes = [
  // Left side connecting to core
  { id: 'data', label: 'DATA', top: '25%', left: '42%' },
  { id: 'signals', label: 'SIGNALS', top: '70%', left: '48%' },
  // Right side connecting to core
  { id: 'anomalies', label: 'ANOMALIES', top: '20%', right: '25%' },
  { id: 'insights', label: 'INSIGHTS', top: '50%', right: '15%' },
  { id: 'actions', label: 'ACTIONS', top: '80%', right: '28%' },
];

export const SignalNetwork: React.FC<SignalNetworkProps> = ({ hasLoaded }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-[4]">
      
      {/* SVG Connections (z-index 3 equivalent within this layer) */}
      <svg className="absolute inset-0 w-full h-full opacity-30">
        <defs>
          <linearGradient id="signalPath" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lines pointing roughly towards the core at 72% width */}
        <motion.path 
          d="M 42vw 25vh L 65vw 40vh" 
          stroke="url(#signalPath)" 
          strokeWidth="1" 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={hasLoaded ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.5, delay: 1.3 }}
        />
        <motion.path 
          d="M 48vw 70vh L 68vw 60vh" 
          stroke="url(#signalPath)" 
          strokeWidth="1" 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={hasLoaded ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.5, delay: 1.4 }}
        />
        <motion.path 
          d="M 75vw 20vh L 72vw 45vh" 
          stroke="url(#signalPath)" 
          strokeWidth="1" 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={hasLoaded ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.5, delay: 1.5 }}
        />
        <motion.path 
          d="M 85vw 50vh L 77vw 55vh" 
          stroke="url(#signalPath)" 
          strokeWidth="1" 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={hasLoaded ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.5, delay: 1.6 }}
        />
        <motion.path 
          d="M 72vw 80vh L 72vw 65vh" 
          stroke="url(#signalPath)" 
          strokeWidth="1" 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={hasLoaded ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.5, delay: 1.7 }}
        />
      </svg>

      {/* Analytical Nodes (z-index 4 equivalent within this layer) */}
      {nodes.map((node, i) => (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={hasLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8, delay: 1.3 + (i * 0.1) }}
          style={{ top: node.top, left: node.left, right: node.right }}
          className="absolute bg-[#040C19]/60 backdrop-blur-md px-3 py-1.5 rounded border border-accent-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] flex items-center gap-2 pointer-events-auto cursor-default hover:border-accent-cyan/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all z-10"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulseGlow" />
          <span className="font-mono text-xs text-text-white tracking-widest uppercase">{node.label}</span>
        </motion.div>
      ))}

    </div>
  );
};
