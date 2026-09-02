import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Brain, Target, Server, ArrowUpRight, MoreHorizontal } from 'lucide-react';

export const DataAnalysisCard: React.FC<{ hasLoaded: boolean }> = ({ hasLoaded }) => {
  const points = [
    { x: 10, y: 44 },
    { x: 38, y: 41 },
    { x: 70, y: 32 },
    { x: 98, y: 36 },
    { x: 130, y: 22 },
    { x: 160, y: 26 },
    { x: 190, y: 15 },
    { x: 220, y: 11 }
  ];

  const pathD = "M 10 44 C 25 42, 50 32, 70 32 C 85 32, 92 36, 98 36 C 112 36, 122 22, 130 22 C 145 22, 152 26, 160 26 C 175 26, 182 15, 190 15 C 205 15, 212 11, 220 11";
  const areaD = `${pathD} L 220 54 L 10 54 Z`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
      animate={hasLoaded ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -20, filter: 'blur(8px)' }}
      transition={{ duration: 0.9, delay: 0.7 }}
      whileHover={{ y: -3, transition: { duration: 0.3 } }}
      className="w-[280px] xl:w-[320px] h-[190px] lg:h-[210px] rounded-2xl p-4 relative overflow-hidden backdrop-blur-[12px] bg-[#030812]/70 border border-[#43D7FF]/25 shadow-[0_0_30px_rgba(34,211,238,0.08)] flex flex-col justify-between group transition-colors hover:border-[#67E8F9]/50"
      style={{ rotate: '-0.6deg' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-accent-cyan" />
          <span className="font-mono text-[9px] tracking-[0.18em] font-semibold text-slate-300 uppercase">
            Data Analysis
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <MoreHorizontal size={12} className="opacity-60" />
          <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-accent-cyan/80 bg-white/5">
            <ArrowUpRight size={10} />
          </div>
        </div>
      </div>

      {/* Metric Section */}
      <div>
        <div className="text-[10px] font-sans text-slate-400 mb-0.5">Revenue Growth</div>
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-3xl lg:text-[34px] text-white tracking-tight leading-none">
            +24.8%
          </span>
        </div>
        <div className="font-mono text-[9px] text-accent-cyan tracking-wider mt-0.5">vs last month</div>
      </div>

      {/* Area Line Chart */}
      <div className="w-full h-[54px] relative">
        <svg viewBox="0 0 230 54" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="curveFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#02050A" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="curveLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#67E8F9" />
            </linearGradient>
          </defs>

          {/* Faint Grid Lines */}
          <line x1="10" y1="16" x2="220" y2="16" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1="10" y1="35" x2="220" y2="35" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

          {/* Area Fill */}
          <motion.path
            d={areaD}
            fill="url(#curveFillGrad)"
            initial={{ opacity: 0 }}
            animate={hasLoaded ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.9 }}
          />

          {/* Luminous Stroke Line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="url(#curveLineGrad)"
            strokeWidth="1.8"
            className="filter drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            initial={{ pathLength: 0 }}
            animate={hasLoaded ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
          />

          {/* Glowing Vertex Dots */}
          {points.map((pt, i) => (
            <motion.circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === points.length - 1 ? 2.5 : 1.6}
              fill={i === points.length - 1 ? "#67E8F9" : "#22D3EE"}
              className={i === points.length - 1 ? "filter drop-shadow-[0_0_6px_#67E8F9]" : ""}
              initial={{ scale: 0 }}
              animate={hasLoaded ? { scale: 1 } : { scale: 0 }}
              transition={{ delay: 0.9 + i * 0.08 }}
            />
          ))}
        </svg>

        {/* X-Axis Tick Labels */}
        <div className="flex justify-between px-1 text-[7px] font-mono text-slate-500 mt-0.5">
          <span>01</span>
          <span>05</span>
          <span>09</span>
          <span>13</span>
          <span>17</span>
          <span>21</span>
          <span>25</span>
          <span>30</span>
        </div>
      </div>
    </motion.div>
  );
};

export const AIInsightsCard: React.FC<{ hasLoaded: boolean }> = ({ hasLoaded }) => {
  const bars = [
    { height: 32 }, { height: 45 }, { height: 28 }, { height: 55 },
    { height: 40 }, { height: 65 }, { height: 50 }, { height: 75 },
    { height: 92, active: true }, { height: 60 }, { height: 70 }, { height: 48 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
      animate={hasLoaded ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -20, filter: 'blur(8px)' }}
      transition={{ duration: 0.9, delay: 0.85 }}
      whileHover={{ y: -3, transition: { duration: 0.3 } }}
      className="w-[280px] xl:w-[320px] h-[190px] lg:h-[210px] rounded-2xl p-4 relative overflow-hidden backdrop-blur-[12px] bg-[#030812]/70 border border-[#43D7FF]/25 shadow-[0_0_30px_rgba(34,211,238,0.08)] flex flex-col justify-between group transition-colors hover:border-[#67E8F9]/50"
      style={{ rotate: '0.4deg' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-accent-cyan" />
          <span className="font-mono text-[9px] tracking-[0.18em] font-semibold text-slate-300 uppercase">
            AI Insights
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <MoreHorizontal size={12} className="opacity-60" />
          <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-accent-cyan/80 bg-white/5">
            <span className="text-[8px]">◎</span>
          </div>
        </div>
      </div>

      {/* Metric Section */}
      <div>
        <div className="text-[10px] font-sans text-slate-400 mb-0.5">Patterns Detected</div>
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-3xl lg:text-[34px] text-white tracking-tight leading-none">
            93.7%
          </span>
        </div>
        <div className="font-mono text-[9px] text-accent-cyan tracking-wider mt-0.5">Confidence Score</div>
      </div>

      {/* Vertical Bar Chart (12 Bars) */}
      <div>
        <div className="w-full h-[50px] flex items-end justify-between gap-1 px-0.5">
          {bars.map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <motion.div
                initial={{ height: 0 }}
                animate={hasLoaded ? { height: `${bar.height}%` } : { height: 0 }}
                transition={{ duration: 1, delay: 0.9 + i * 0.05, ease: "easeOut" }}
                className={`w-full rounded-t-sm ${
                  bar.active
                    ? "bg-gradient-to-t from-accent-cyan via-accent-brightCyan to-white shadow-[0_0_12px_rgba(103,232,249,0.9)]"
                    : "bg-gradient-to-t from-accent-blue/30 via-accent-blue/70 to-accent-cyan/70"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Bar Index Numbers (01 - 12) */}
        <div className="flex justify-between px-0.5 text-[6.5px] font-mono text-slate-500 mt-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={i === 8 ? "text-accent-brightCyan font-bold" : ""}>
              {String(i + 1).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const DecisionImpactCard: React.FC<{ hasLoaded: boolean }> = ({ hasLoaded }) => {
  const months = [
    { label: 'JAN', height: 42 },
    { label: 'FEB', height: 58 },
    { label: 'MAR', height: 48 },
    { label: 'APR', height: 70 },
    { label: 'MAY', height: 95, active: true },
    { label: 'JUN', height: 68 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
      animate={hasLoaded ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: 20, filter: 'blur(8px)' }}
      transition={{ duration: 0.9, delay: 0.75 }}
      whileHover={{ y: -3, transition: { duration: 0.3 } }}
      className="w-[280px] xl:w-[320px] h-[190px] lg:h-[210px] rounded-2xl p-4 relative overflow-hidden backdrop-blur-[12px] bg-[#030812]/70 border border-[#43D7FF]/25 shadow-[0_0_30px_rgba(34,211,238,0.08)] flex flex-col justify-between group transition-colors hover:border-[#67E8F9]/50"
      style={{ rotate: '0.5deg' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={13} className="text-accent-cyan" />
          <span className="font-mono text-[9px] tracking-[0.18em] font-semibold text-slate-300 uppercase">
            Decision Impact
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <MoreHorizontal size={12} className="opacity-60" />
          <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-accent-cyan/80 bg-white/5">
            <ArrowUpRight size={10} />
          </div>
        </div>
      </div>

      {/* Metric Section */}
      <div>
        <div className="text-[10px] font-sans text-slate-400 mb-0.5">Value Created</div>
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-3xl lg:text-[34px] text-white tracking-tight leading-none">
            ₹2.45 Cr
          </span>
        </div>
        <div className="font-mono text-[9px] text-accent-cyan tracking-wider mt-0.5">This Quarter</div>
      </div>

      {/* Monthly Bar Chart */}
      <div>
        <div className="w-full h-[50px] flex items-end justify-between gap-1.5 px-1">
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative">
              {m.active && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={hasLoaded ? { scale: 1 } : { scale: 0 }}
                  transition={{ delay: 1.5 }}
                  className="absolute -top-2.5 w-1.5 h-1.5 rounded-full bg-accent-brightCyan shadow-[0_0_8px_#67E8F9] animate-pulse"
                />
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={hasLoaded ? { height: `${m.height}%` } : { height: 0 }}
                transition={{ duration: 1, delay: 0.9 + i * 0.08, ease: "easeOut" }}
                className={`w-full rounded-t-sm ${
                  m.active
                    ? "bg-gradient-to-t from-accent-blue via-accent-cyan to-accent-brightCyan shadow-[0_0_15px_rgba(34,211,238,0.7)]"
                    : "bg-gradient-to-t from-accent-blue/30 to-accent-blue/60"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Month Labels */}
        <div className="flex justify-between px-1 text-[7px] font-mono text-slate-500 mt-1">
          {months.map((m, i) => (
            <span key={i} className={m.active ? "text-accent-brightCyan font-bold" : ""}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const SystemStatusCard: React.FC<{ hasLoaded: boolean }> = ({ hasLoaded }) => {
  const statusItems = [
    { label: 'Data Processing', dotColor: 'bg-accent-cyan', glow: 'shadow-[0_0_8px_#22D3EE]' },
    { label: 'Model Running', dotColor: 'bg-accent-brightCyan', glow: 'shadow-[0_0_8px_#67E8F9]' },
    { label: 'Insight Generating', dotColor: 'bg-accent-blue', glow: 'shadow-[0_0_8px_#3B82F6]' },
    { label: 'Decision Ready', dotColor: 'bg-emerald-400', glow: 'shadow-[0_0_8px_#34D399]' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, filter: 'blur(8px)' }}
      animate={hasLoaded ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: 20, filter: 'blur(8px)' }}
      transition={{ duration: 0.9, delay: 0.9 }}
      whileHover={{ y: -3, transition: { duration: 0.3 } }}
      className="w-[280px] xl:w-[320px] h-[190px] lg:h-[210px] rounded-2xl p-4 relative overflow-hidden backdrop-blur-[12px] bg-[#030812]/70 border border-[#43D7FF]/25 shadow-[0_0_30px_rgba(34,211,238,0.08)] flex flex-col justify-between group transition-colors hover:border-[#67E8F9]/50"
      style={{ rotate: '-0.4deg' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={13} className="text-accent-cyan" />
          <span className="font-mono text-[9px] tracking-[0.18em] font-semibold text-slate-300 uppercase">
            System Status
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <MoreHorizontal size={12} className="opacity-60" />
        </div>
      </div>

      {/* 4 Status Rows */}
      <div className="space-y-2 my-auto">
        {statusItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 10 }}
            animate={hasLoaded ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
            transition={{ delay: 1.0 + i * 0.1 }}
            className="flex items-center justify-between text-[11px] py-0.5"
          >
            <span className="font-sans text-slate-300 font-medium tracking-wide">
              {item.label}
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${item.dotColor} ${item.glow} animate-pulse`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer subtle ping indicator */}
      <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[8px] font-mono text-slate-500">
        <span>LATENCY 12ms</span>
        <span className="text-accent-cyan">SYNC OPTIMAL</span>
      </div>
    </motion.div>
  );
};
