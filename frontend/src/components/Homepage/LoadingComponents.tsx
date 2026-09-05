/**
 * LoadingComponents.tsx
 *
 * InsightFlow AI — Cinematic Loading Experience (Complete Rebuild)
 *
 * Original procedural animation only.
 * No reference frames, no video playback, no canvas sequences.
 *
 * Core design principles
 * ─────────────────────────────────────────────────────────────────────
 * • Full environment visible from frame 0 — zero empty-screen phases
 * • Energy-model animation: brightness/motion increase over 9–10 seconds
 * • Every element always rendered — only intensity (opacity/scale) varies
 * • Translucent holographic panels — grid/particles visible through them
 * • Large IntelligenceCore — all 7 rings present from start at low opacity
 * • Slow cinematic timing — line chart 3.5 s, bar rise 1.2 s each
 *
 * Typography scale
 * ─────────────────────────────────────────────────────────────────────
 *   Brand heading  : clamp(22px, 2.8vw, 34px), Space Grotesk, tracking 0.28em
 *   Subtitle       : clamp(12px, 1.1vw, 14px), Inter, tracking 0.12em
 *   Panel title    : 10px, JetBrains Mono, uppercase, tracking 0.18em
 *   Panel metric   : 26px, Space Grotesk, bold
 *   Panel label    : 11px, Inter
 *   Telemetry      : 9px, JetBrains Mono
 *   Progress label : 10px, JetBrains Mono
 *   Progress %     : 13px, JetBrains Mono
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Stage Type & Helpers ─────────────────────────────────────────────────────

export type Stage =
  | 'ENVIRONMENT_ESTABLISHMENT'
  | 'CORE_ACTIVATION'
  | 'DATA_PROCESSING'
  | 'PATTERN_DETECTION'
  | 'INTELLIGENCE_FORMATION'
  | 'DECISION_READINESS'
  | 'FINALIZING'
  | 'COMPLETE';

const STAGE_ORDER: Stage[] = [
  'ENVIRONMENT_ESTABLISHMENT',
  'CORE_ACTIVATION',
  'DATA_PROCESSING',
  'PATTERN_DETECTION',
  'INTELLIGENCE_FORMATION',
  'DECISION_READINESS',
  'FINALIZING',
  'COMPLETE',
];

export const stageIndex = (s: Stage): number => STAGE_ORDER.indexOf(s);

/** Seeded pseudo-random — stable across re-renders */
const seeded = (count: number, seed = 1): number[] =>
  Array.from({ length: count }, (_, i) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  });

// ─── SciFiFrame ───────────────────────────────────────────────────────────────
// Thin HUD border: corner L-segments + mid-edge markers.
// Visible at reduced opacity from frame 0.

export const SciFiFrame: React.FC<{ isFinalizing: boolean }> = ({ isFinalizing }) => (
  <motion.div
    className="absolute inset-[10px] pointer-events-none z-40"
    initial={{ opacity: 0.55 }}
    animate={{ opacity: isFinalizing ? 1 : 0.78 }}
    transition={{ duration: 2.0, ease: 'easeOut' }}
  >
    {/* Outer border */}
    <div className="absolute inset-0 border border-cyan-500/[0.14] rounded-sm" />

    {/* Corner L-segments — 50px arms for stronger presence */}
    {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => {
      const isTop  = pos.startsWith('top');
      const isLeft = pos.endsWith('left');
      const edge   = { top: isTop ? 0 : undefined, bottom: !isTop ? 0 : undefined };
      const side   = { left: isLeft ? 0 : undefined, right: !isLeft ? 0 : undefined };
      return (
        <div key={pos} className="absolute w-14 h-14" style={{ ...edge, ...side }}>
          {/* horizontal arm */}
          <div
            className="absolute bg-[#22D3EE]"
            style={{ width: 50, height: 1.5, ...edge, ...side }}
          />
          {/* vertical arm */}
          <div
            className="absolute bg-[#22D3EE]"
            style={{ height: 50, width: 1.5, ...edge, ...side }}
          />
          {/* corner cap dot */}
          <div
            className="absolute w-[6px] h-[6px] rounded-full bg-[#22D3EE]/90"
            style={{ ...edge, ...side }}
          />
          {/* outer notch tick */}
          <div
            className="absolute w-[8px] h-[1.5px] bg-[#22D3EE]/32"
            style={{
              top:    isTop  ? 0 : undefined,
              bottom: !isTop ? 0 : undefined,
              left:   isLeft ? 50 : undefined,
              right:  !isLeft ? 50 : undefined,
            }}
          />
        </div>
      );
    })}

    {/* Top & bottom centre marker groups */}
    {(['top', 'bottom'] as const).map((side) => (
      <div
        key={side}
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
        style={{ [side]: 0 }}
      >
        {[28, 12, 60, 12, 28].map((w, i) => (
          <div key={i} style={{ width: w, height: 1.5, background: 'rgba(34,211,238,0.20)' }} />
        ))}
      </div>
    ))}

    {/* Left & right centre marker groups */}
    {(['left', 'right'] as const).map((side) => (
      <div
        key={side}
        className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
        style={{ [side]: 0 }}
      >
        {[18, 8, 38, 8, 18].map((h, i) => (
          <div key={i} style={{ height: h, width: 1.5, background: 'rgba(34,211,238,0.16)' }} />
        ))}
      </div>
    ))}
  </motion.div>
);

// ─── SystemTelemetry ──────────────────────────────────────────────────────────
// Four-corner monospace telemetry. Visible from frame 0.

export const SystemTelemetry: React.FC<{ stage: Stage; progress: number }> = ({
  stage,
  progress,
}) => {
  const si      = stageIndex(stage);
  const packets = Math.floor(1000 + progress * 4.82).toString().padStart(5, '0');
  const sync    = (95 + progress * 0.037).toFixed(1);
  const cpu     = Math.floor(38 + progress * 0.062);

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-40"
      initial={{ opacity: 0.40 }}
      animate={{ opacity: si >= 1 ? 0.55 : 0.42 }}
      transition={{ duration: 2.2 }}
    >
      {/* TOP LEFT */}
      <div
        className="absolute top-[24px] left-[24px] leading-[1.9] tracking-wider uppercase"
        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: '#8BA0B8' }}
      >
        SYS // INIT<br />
        NODE: 07<br />
        SECURE CHANNEL
      </div>

      {/* TOP RIGHT */}
      <div
        className="absolute top-[24px] right-[24px] leading-[1.9] tracking-wider uppercase text-right"
        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: '#8BA0B8' }}
      >
        SIGNAL {si >= 3 ? 'ACTIVE' : 'SCANNING'}<br />
        DATA SYNC<br />
        MODEL STATUS
      </div>

      {/* BOTTOM LEFT */}
      <div
        className="absolute bottom-[56px] left-[24px] leading-[1.9] tracking-wider uppercase hidden sm:block"
        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: '#8BA0B8' }}
      >
        DATA STREAM<br />
        PACKETS: {packets}<br />
        SYNC: {sync}%
      </div>

      {/* BOTTOM RIGHT */}
      <div
        className="absolute bottom-[56px] right-[24px] leading-[1.9] tracking-wider uppercase text-right hidden sm:block"
        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: '#8BA0B8' }}
      >
        CPU: {cpu}%<br />
        MEM: 16GB<br />
        NET: OPTIMAL
      </div>
    </motion.div>
  );
};

// ─── MiniLineChart ────────────────────────────────────────────────────────────
// Animated SVG line chart — slow 3.5 s pathLength draw.

const MiniLineChart: React.FC<{ active: boolean; animProgress: number }> = ({
  active,
  animProgress,
}) => {
  const drift = animProgress * 0.055;
  const pts = [
    { x: 0,   y: 38 - drift * 2 },
    { x: 12,  y: 31 - drift     },
    { x: 24,  y: 34             },
    { x: 36,  y: 21 + drift     },
    { x: 50,  y: 24 - drift     },
    { x: 63,  y: 13 - drift * 2 },
    { x: 76,  y: 16 + drift     },
    { x: 88,  y: 7  - drift     },
    { x: 100, y: 4  - drift * 2 },
  ];
  const d    = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = d + ' L 100 46 L 0 46 Z';

  return (
    <svg viewBox="0 0 100 46" className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="lcAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#22D3EE" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0"   />
        </linearGradient>
        <linearGradient id="lcLineFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      {/* Faint grid lines */}
      {[12, 24, 36].map(y => (
        <line
          key={y} x1="0" y1={y} x2="100" y2={y}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"
        />
      ))}
      {/* Area fill — fades in after line starts */}
      <motion.path
        d={area}
        fill="url(#lcAreaFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 1.4, delay: 1.0 }}
      />
      {/* Main line — slow cinematic draw */}
      <motion.path
        d={d}
        fill="none"
        stroke="url(#lcLineFill)"
        strokeWidth="2.2"
        style={{ filter: 'drop-shadow(0 2px 5px rgba(34,211,238,0.55))' }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: active ? 1 : 0 }}
        transition={{ duration: 3.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      {/* Active endpoint dot */}
      {active && (
        <motion.circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r="3"
          fill="#67E8F9"
          style={{ filter: 'drop-shadow(0 0 5px #67E8F9)' }}
          animate={{ opacity: [0.5, 1, 0.5], r: [3, 3.8, 3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
    </svg>
  );
};

// ─── MiniBarChart ─────────────────────────────────────────────────────────────
// Animated bar chart — slow 1.2 s rise per bar.

const MiniBarChart: React.FC<{
  active: boolean;
  accent?: string;
  bars?: number[];
}> = ({
  active,
  accent = '#22D3EE',
  bars = [26, 44, 35, 62, 50, 78, 68, 90, 82],
}) => (
  <div className="flex items-end justify-between w-full h-full gap-[2px]">
    {bars.map((h, i) => (
      <motion.div
        key={i}
        className="flex-1 rounded-t-[2px]"
        style={{
          background: `linear-gradient(to top, rgba(34,211,238,0.16), ${accent})`,
          boxShadow:  `0 0 5px ${accent}30`,
        }}
        initial={{ height: 0 }}
        animate={{ height: active ? `${h}%` : 0 }}
        transition={{
          duration: 1.2,
          delay:    active ? i * 0.10 : 0,
          ease:     [0.25, 0.46, 0.45, 0.94],
        }}
      />
    ))}
  </div>
);

// ─── FloatingAnalyticsPanel ───────────────────────────────────────────────────
// Large translucent holographic panel.
// Visible from frame 0 — energy increases with stage.
//
// Transparency spec:
//   background:      rgba(5, 15, 28, 0.46)  — see-through
//   border:          1px rgba(70, 210, 255, 0.28)
//   backdrop-filter: blur(10px)
//
// Position spec (per quadrant):
//   top-left:     top:11vh,  left:3vw
//   bottom-left:  top:50vh,  left:3vw
//   top-right:    top:11vh,  right:3vw
//   bottom-right: top:50vh,  right:3vw

type Quadrant  = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type ChartType = 'line' | 'bar' | 'status';

interface PanelProps {
  quadrant:     Quadrant;
  title:        string;
  subtitle:     string;
  value:        string;
  footnote:     string;
  chartType:    ChartType;
  stage:        Stage;
  delay:        number;
  isFinalizing: boolean;
  animProgress: number;
}

const PANEL_POS: Record<Quadrant, React.CSSProperties> = {
  'top-left':     { top: '10vh',  left: '2.5vw'  },
  'top-right':    { top: '10vh',  right: '2.5vw' },
  'bottom-left':  { top: '52vh',  left: '2.5vw'  },
  'bottom-right': { top: '52vh',  right: '2.5vw' },
};

// Offset so float cycles are desynchronised
const FLOAT_OFFSET: Record<Quadrant, number> = {
  'top-left':     0,
  'top-right':    2.2,
  'bottom-left':  3.8,
  'bottom-right': 5.5,
};

export const FloatingAnalyticsPanel: React.FC<PanelProps> = ({
  quadrant,
  title,
  subtitle,
  value,
  footnote,
  chartType,
  stage,
  delay,
  isFinalizing,
  animProgress,
}) => {
  const si          = stageIndex(stage);
  // Charts begin drawing once CORE_ACTIVATION starts (si >= 1)
  const chartActive = si >= 1;

  const statusItems = [
    { label: 'Data Processing',    activeAt: 1 },
    { label: 'Model Running',      activeAt: 2 },
    { label: 'Insight Generating', activeAt: 3 },
    { label: 'Decision Ready',     activeAt: 5 },
  ];

  const floatAmplitude = 4 + (FLOAT_OFFSET[quadrant] % 2) * 2;
  const floatDuration  = 9 + FLOAT_OFFSET[quadrant] * 0.45;

  return (
    <motion.div
      className="absolute hidden lg:flex flex-col"
      style={{
        ...PANEL_POS[quadrant],
        width:                'clamp(280px, 22vw, 340px)',
        minHeight:            'clamp(180px, 18vh, 220px)',
        background:           'rgba(4, 12, 25, 0.40)',
        border:               '1px solid rgba(67, 215, 255, 0.30)',
        backdropFilter:       'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius:         12,
        boxShadow:            '0 0 30px rgba(34,211,238,0.12), inset 0 0 48px rgba(34,211,238,0.05)',
        overflow:             'hidden',
      }}
      initial={{ opacity: 0.55 }}
      animate={{
        opacity: isFinalizing ? 1 : 0.88,
        y: [0, -floatAmplitude, 0, -(floatAmplitude * 0.6), 0],
        borderColor: isFinalizing
          ? 'rgba(34,211,238,0.58)'
          : 'rgba(70,210,255,0.28)',
        boxShadow: isFinalizing
          ? '0 4px 64px rgba(34,211,238,0.30), inset 0 0 50px rgba(34,211,238,0.14)'
          : '0 4px 48px rgba(34,211,238,0.10), inset 0 0 40px rgba(34,211,238,0.04)',
      }}
      transition={{
        opacity:     { duration: 1.0, delay },
        y: {
          duration: floatDuration,
          repeat:   Infinity,
          ease:     'easeInOut',
          delay:    FLOAT_OFFSET[quadrant],
        },
        borderColor: { duration: 0.9 },
        boxShadow:   { duration: 0.9 },
      }}
    >
      {/* Top accent bar */}
      <div
        className="w-full flex-shrink-0"
        style={{
          height: 1.5,
          background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.62), transparent)',
        }}
      />

      {/* Content */}
      <div className="px-5 pt-4 pb-3 flex flex-col gap-[8px]">

        {/* Header row: title + pulse indicator */}
        <div className="flex items-center justify-between">
          <span
            className="tracking-[0.18em] text-slate-400 uppercase"
            style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}
          >
            {title}
          </span>
          <motion.div
            className="rounded-full bg-[#22D3EE]"
            style={{ width: 7, height: 7 }}
            animate={{
              opacity:   [0.4, 1, 0.4],
              boxShadow: ['0 0 3px #22D3EE', '0 0 12px #22D3EE', '0 0 3px #22D3EE'],
            }}
            transition={{ duration: 2.0, repeat: Infinity }}
          />
        </div>

        {/* Metric block — non-status panels */}
        {chartType !== 'status' && (
          <div className="flex flex-col gap-[4px]">
            {subtitle && (
              <p
                className="text-slate-400 leading-none"
                style={{ fontFamily: '"Inter", sans-serif', fontSize: 12 }}
              >
                {subtitle}
              </p>
            )}
            <p
              className="text-white font-bold leading-none tracking-tight"
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize:   30,
                textShadow: '0 0 20px rgba(255,255,255,0.18)',
              }}
            >
              {value}
            </p>
            {footnote && (
              <p
                className="text-slate-400 leading-none"
                style={{ fontFamily: '"Inter", sans-serif', fontSize: 12 }}
              >
                {footnote}
              </p>
            )}
          </div>
        )}

        {/* Chart area — 80px fixed height for more visual presence */}
        <div className="mt-2" style={{ height: 80 }}>
          {chartType === 'line' && (
            <MiniLineChart active={chartActive} animProgress={animProgress} />
          )}
          {chartType === 'bar' && (
            <MiniBarChart active={chartActive} />
          )}
          {chartType === 'status' && (
            <div className="flex flex-col gap-[12px] py-2">
              {statusItems.map((item) => {
                const on = si >= item.activeAt;
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span
                      className={on ? 'text-slate-200' : 'text-slate-600'}
                      style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}
                    >
                      {item.label}
                    </span>
                    <motion.div
                      className="rounded-full flex-shrink-0"
                      style={{
                        width:      8,
                        height:     8,
                        background: on ? '#22D3EE' : '#1E293B',
                      }}
                      animate={
                        on
                          ? { boxShadow: ['0 0 3px #22D3EE50', '0 0 14px #22D3EE', '0 0 3px #22D3EE50'] }
                          : {}
                      }
                      transition={{ duration: 1.6, repeat: Infinity }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        className="w-full flex-shrink-0"
        style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.22), transparent)',
        }}
      />
    </motion.div>
  );
};

// ─── IntelligenceCore ────────────────────────────────────────────────────────
// Large perspective-ring platform + glowing energy orb.
//
// Critical: ALL 7 rings are visible from the very first frame at low opacity.
// They are never hidden — only their brightness increases with progress.
// Rotation starts immediately (slow: 14–22 s per cycle).
//
// Layout:  W=780 H=400, platform centre CX=390 CY=315, orb at ORB_Y=152

export const IntelligenceCore: React.FC<{
  stage: Stage;
  progress: number;
  isFinalizing: boolean;
  prefersReducedMotion: boolean;
}> = ({ stage, progress, isFinalizing, prefersReducedMotion }) => {
  const si = stageIndex(stage);
  const t  = progress / 100;   // 0 → 1 over the whole sequence

  // Orb color: stays cool cyan, brightens toward white-cyan at finalizing
  const orbR = Math.round(34  + t * 18);
  const orbG = Math.round(211 - t * 35);
  const orbB = Math.round(238 - t * 8);
  const oc   = `rgba(${orbR},${orbG},${orbB},`;   // partial rgba string

  const W = 780, H = 400;
  const CX = 390, CY = 315;
  const ORB_Y = 152;

  // Rings: [rx, ry, baseOpacity, strokeWidth, dashArray, rotDuration, rotDir]
  // baseOpacity = minimum opacity at progress 0 (always visible)
  const rings: [number, number, number, number, string, number, number][] = [
    [330, 72,  0.09, 0.8,  '5 0',   22, 1],   // outermost — solid faint
    [280, 61,  0.13, 0.9,  '6 22',  18, -1],
    [230, 50,  0.18, 1.0,  '4 15',  15, 1],
    [180, 40,  0.26, 1.2,  '3 11',  12, -1],
    [130, 29,  0.36, 1.5,  '2 8',   9,  1],
    [82,  19,  0.50, 1.8,  '2 6',   7,  -1],
    [44,  11,  0.70, 2.2,  '0',     5,  1],   // innermost — solid bright
  ];

  return (
    <div
      className="relative flex items-center justify-center pointer-events-none"
      style={{ width: '100%', maxWidth: 780 }}
    >
      {/* Ambient bloom under the platform — always present */}
      <div
        className="absolute rounded-[100%] pointer-events-none"
        style={{
          width:     640,
          height:    145,
          bottom:    4,
          left:      '50%',
          transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse, ${oc}${0.15 + t * 0.24}) 0%, transparent 70%)`,
          filter:    'blur(40px)',
        }}
      />

      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: 'visible', display: 'block', width: '100%', height: 'auto' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="icRingGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="icOrbGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="14" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="icSphereGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Orb radial gradient — bright white core, cyan body */}
          <radialGradient id="icOrbFill" cx="38%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#ffffff"                                  stopOpacity="0.95" />
            <stop offset="18%"  stopColor={`rgb(${orbR},${orbG},${orbB})`}           stopOpacity="0.84" />
            <stop offset="52%"  stopColor={`rgb(${Math.round(orbR*0.45)},${Math.round(orbG*0.3)},${orbB})`} stopOpacity="0.38" />
            <stop offset="100%" stopColor="#050F1A"                                  stopOpacity="0.04" />
          </radialGradient>

          {/* Platform ambient fill — brightens with progress */}
          <radialGradient id="icPlatformFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={`rgb(${orbR},${orbG},${orbB})`} stopOpacity={0.35 + t * 0.3} />
            <stop offset="100%" stopColor={`rgb(${orbR},${orbG},${orbB})`} stopOpacity="0" />
          </radialGradient>

          {/* Vertical connector gradient */}
          <linearGradient id="icConnector" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={`rgb(${orbR},${orbG},${orbB})`} stopOpacity="0" />
            <stop offset="30%"  stopColor={`rgb(${orbR},${orbG},${orbB})`} stopOpacity={0.45 + t * 0.35} />
            <stop offset="100%" stopColor={`rgb(${orbR},${orbG},${orbB})`} stopOpacity={0.78 + t * 0.18} />
          </linearGradient>
        </defs>

        {/* Platform base glow ellipse — always present */}
        <ellipse
          cx={CX} cy={CY} rx={308} ry={68}
          fill="url(#icPlatformFill)"
          style={{ filter: 'blur(18px)' }}
          opacity={0.24 + si * 0.06}
        />

        {/* ── Concentric rings — ALL visible from frame 0 ── */}
        {rings.map(([rx, ry, baseOp, sw, dash, dur, dir], i) => {
          // Full opacity target scales with progress
          const fullOp   = baseOp * (1 + t * 0.85) * (isFinalizing ? 1.5 : 1);
          // Never go below minimum visibility
          const minOp    = baseOp * 0.55;
          const targetOp = Math.max(minOp, Math.min(fullOp, 1));

          return (
            <motion.ellipse
              key={i}
              cx={CX} cy={CY}
              rx={rx} ry={ry}
              fill="none"
              stroke={`rgb(${orbR},${orbG},${orbB})`}
              strokeWidth={sw}
              strokeDasharray={dash}
              filter="url(#icRingGlow)"
              // Start at minOp — never hidden, never pops in from 0
              initial={{ opacity: minOp }}
              animate={{
                opacity: targetOp,
                rotate:  prefersReducedMotion ? 0 : dir * 360,
              }}
              transition={{
                opacity: { duration: 2.2, delay: i * 0.18, ease: 'easeOut' },
                rotate:  { duration: dur, repeat: Infinity, ease: 'linear' },
              }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />
          );
        })}

        {/* Dotted perimeter on outermost ring */}
        {Array.from({ length: 36 }, (_, i) => {
          const angle  = (i / 36) * Math.PI * 2;
          const isMajor = i % 9 === 0;
          // Approximate ellipse point
          const ex = CX + Math.cos(angle) * 330;
          const ey = CY + Math.sin(angle) * 72;
          return (
            <circle
              key={i}
              cx={ex} cy={ey}
              r={isMajor ? 2.5 : 1.2}
              fill={`rgb(${orbR},${orbG},${orbB})`}
              opacity={(isMajor ? 0.48 : 0.20) * (0.45 + t * 0.55)}
            />
          );
        })}

        {/* Scanning arc — starts invisible, brightens with progress */}
        {!prefersReducedMotion && (
          <motion.ellipse
            cx={CX} cy={CY} rx={344} ry={78}
            fill="none"
            stroke={`rgb(${orbR},${orbG},${orbB})`}
            strokeWidth={1.5}
            strokeDasharray="90 1050"
            animate={{
              opacity: 0.10 + t * 0.48,
              rotate:  360,
            }}
            transition={{
              opacity: { duration: 0.5 },
              rotate:  { duration: 16, repeat: Infinity, ease: 'linear' },
            }}
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              filter: `drop-shadow(0 0 8px rgb(${orbR},${orbG},${orbB}))`,
            }}
          />
        )}

        {/* ── Orb layers ── */}

        {/* Outer halo — large, blurred, breathes */}
        <motion.circle
          cx={CX} cy={ORB_Y} r={96}
          fill={`${oc}0.06)`}
          filter="url(#icOrbGlow)"
          animate={{
            r:       isFinalizing ? [96, 118, 96] : [96, 103, 96],
            opacity: [0.28 + t * 0.30, 0.68 + t * 0.22, 0.28 + t * 0.30],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Mid halo */}
        <motion.circle
          cx={CX} cy={ORB_Y} r={75}
          fill={`${oc}0.09)`}
          filter="url(#icSphereGlow)"
          animate={{
            r:       isFinalizing ? [75, 92, 75] : [75, 81, 75],
            opacity: [0.48 + t * 0.22, 0.90, 0.48 + t * 0.22],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />

        {/* Translucent shell */}
        <circle
          cx={CX} cy={ORB_Y} r={58}
          fill="url(#icOrbFill)"
          stroke={`${oc}0.52)`}
          strokeWidth="1.5"
          style={{ filter: `drop-shadow(0 0 ${18 + si * 12}px ${oc}0.88))` }}
        />

        {/* Lattice grid on orb */}
        <circle cx={CX} cy={ORB_Y} r={57} fill="none"
          stroke={`${oc}0.16)`} strokeWidth="0.5" strokeDasharray="3 9" />
        <circle cx={CX} cy={ORB_Y} r={42} fill="none"
          stroke={`${oc}0.11)`} strokeWidth="0.4" strokeDasharray="2 14" />
        <line x1={CX - 58} y1={ORB_Y} x2={CX + 58} y2={ORB_Y}
          stroke={`${oc}0.09)`} strokeWidth="0.4" />
        <line x1={CX} y1={ORB_Y - 58} x2={CX} y2={ORB_Y + 58}
          stroke={`${oc}0.09)`} strokeWidth="0.4" />

        {/* Orb scanning arc — appears at CORE_ACTIVATION */}
        {!prefersReducedMotion && si >= 1 && (
          <motion.circle
            cx={CX} cy={ORB_Y} r={62}
            fill="none"
            stroke={`${oc}0.28)`}
            strokeWidth="1.5"
            strokeDasharray="54 340"
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: `${CX}px ${ORB_Y}px` }}
          />
        )}

        {/* Pulsing energy core */}
        <motion.circle
          cx={CX} cy={ORB_Y} r={38}
          fill={`${oc}${0.32 + t * 0.32})`}
          animate={{
            r:       isFinalizing ? [38, 48, 38] : [38, 43, 38],
            opacity: [0.58 + t * 0.22, 0.95, 0.58 + t * 0.22],
          }}
          transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* White-hot inner core */}
        <motion.circle
          cx={CX} cy={ORB_Y} r={16}
          fill="white"
          style={{ filter: 'blur(3.5px)' }}
          animate={{
            r:       [16, 20, 16],
            opacity: [0.58 + si * 0.04, 1, 0.58 + si * 0.04],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Vertical energy connector — orb down to platform */}
        <rect
          x={CX - 1} y={ORB_Y + 58}
          width={2}
          height={CY - ORB_Y - 58}
          fill="url(#icConnector)"
          style={{ filter: 'blur(0.8px)' }}
          opacity={0.32 + t * 0.42}
        />

        {/* Moving particles on the connector */}
        {!prefersReducedMotion && Array.from({ length: 5 }, (_, i) => (
          <motion.circle
            key={i}
            cx={CX}
            cy={ORB_Y + 58}
            r={1.5}
            fill={`rgb(${orbR},${orbG},${orbB})`}
            animate={{
              cy:      [ORB_Y + 58, CY - 5, ORB_Y + 58],
              opacity: [0, 0.65 + t * 0.3, 0],
            }}
            transition={{
              duration: 1.5 + i * 0.28,
              repeat:   Infinity,
              ease:     'easeInOut',
              delay:    i * 0.30,
            }}
          />
        ))}

        {/* Platform surface light spot */}
        <motion.ellipse
          cx={CX} cy={CY} rx={42} ry={9}
          fill={`${oc}0.62)`}
          style={{ filter: 'blur(7px)' }}
          animate={{ opacity: [0.42 + t * 0.22, 0.86, 0.42 + t * 0.22] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  );
};

// ─── VerticalDataStreams ──────────────────────────────────────────────────────
// 10 prominent vertical beams rising from the intelligence platform.
// NEVER returns null for si reasons — always rendered.
// Intensity (opacity) is purely proportional to stage + progress.

export const VerticalDataStreams: React.FC<{
  stage: Stage;
  progress: number;
  isFinalizing: boolean;
  prefersReducedMotion: boolean;
}> = ({ stage, progress, isFinalizing, prefersReducedMotion }) => {
  const si = stageIndex(stage);
  const t  = progress / 100;

  const streams = useMemo(() => {
    const hVals   = seeded(12, 55);
    const oVals   = seeded(12, 19);
    const dVals   = seeded(12, 83);
    const dlyVals = seeded(12, 41);
    return Array.from({ length: 12 }, (_, i) => ({
      x:       -250 + i * 42 + (oVals[i] - 0.5) * 10,
      height:  140 + hVals[i] * 260,
      opacity: 0.28 + oVals[i] * 0.55,
      dur:     1.8 + dVals[i] * 2.6,
      delay:   dlyVals[i] * 1.8,
      bright:  i % 3 === 1,
    }));
  }, []);

  if (prefersReducedMotion) return null;

  // Base multiplier: stronger minimum so streams are always visible
  const baseIntensity = 0.14 + si * 0.10 + t * 0.20;
  const intensityMul  = isFinalizing ? 2.2 : baseIntensity + 0.55;

  return (
    <div
      className="absolute bottom-[55px] left-1/2 pointer-events-none"
      style={{ transform: 'translateX(-50%)', width: 600, height: '100%', zIndex: 1 }}
    >
      {streams.map((s, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0"
          style={{
            left:  '50%',
            x:     s.x,
            width: s.bright ? 3.5 : 1.8,
            height: s.height,
            background: s.bright
              ? 'linear-gradient(to top, transparent 0%, rgba(34,211,238,0.60) 28%, rgba(103,232,249,1) 58%, rgba(255,255,255,0.90) 76%, transparent 100%)'
              : 'linear-gradient(to top, transparent 0%, rgba(34,211,238,0.35) 42%, rgba(34,211,238,0.58) 70%, transparent 100%)',
            boxShadow:       s.bright ? '0 0 14px rgba(34,211,238,0.80)' : 'none',
            filter:          'blur(0.3px)',
            transformOrigin: 'bottom center',
          }}
          // Minimum always visible — never pop in from 0
          initial={{ opacity: s.opacity * 0.12 }}
          animate={{
            opacity: s.opacity * intensityMul,
            y:       [0, -(s.height * 0.44), 0],
          }}
          transition={{
            opacity: { duration: 2.2, delay: s.delay, ease: 'easeOut' },
            y:       { duration: s.dur, repeat: Infinity, ease: 'linear', delay: s.delay },
          }}
        />
      ))}
    </div>
  );
};

// ─── DataTerrain ──────────────────────────────────────────────────────────────
// Dense dotted waveform lower landscape — 33vh height.
// Always rendered. Opacity/density scales with stage.

export const DataTerrain: React.FC<{
  stage: Stage;
  isFinalizing: boolean;
  prefersReducedMotion: boolean;
}> = ({ stage, isFinalizing, prefersReducedMotion }) => {
  const si = stageIndex(stage);
  const W  = 1440, H = 220;

  const wave = (amp: number, freq: number, phase: number, baseY: number): string => {
    return Array.from({ length: 100 }, (_, i) => {
      const x  = (i / 99) * W;
      const dy = Math.sin((i / 99) * Math.PI * 2 * freq + phase) * amp
               + Math.sin((i / 99) * Math.PI * 2 * freq * 0.6 + phase * 1.3) * amp * 0.35;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(baseY + dy).toFixed(1)}`;
    }).join(' ');
  };

  // 8 wave layers for rich data landscape
  const waveLayers = [
    { amp: 30, freq: 2.0, phase: 0.0,  baseY: 100, op: 0.50, dash: '3 22', dur: 20, color: '#22D3EE' },
    { amp: 20, freq: 3.4, phase: 1.1,  baseY: 128, op: 0.40, dash: '2 16', dur: 16, color: '#67E8F9' },
    { amp: 40, freq: 1.5, phase: 2.2,  baseY: 80,  op: 0.28, dash: '4 28', dur: 26, color: '#22D3EE' },
    { amp: 14, freq: 4.6, phase: 0.5,  baseY: 150, op: 0.22, dash: '1 13', dur: 12, color: '#3B82F6' },
    { amp: 24, freq: 2.7, phase: 3.0,  baseY: 112, op: 0.32, dash: '3 18', dur: 18, color: '#67E8F9' },
    { amp: 10, freq: 6.0, phase: 1.7,  baseY: 165, op: 0.18, dash: '1 10', dur: 10, color: '#22D3EE' },
    { amp: 18, freq: 1.9, phase: 4.0,  baseY: 88,  op: 0.20, dash: '2 20', dur: 23, color: '#3B82F6' },
    { amp: 8,  freq: 5.5, phase: 2.6,  baseY: 175, op: 0.14, dash: '1 8',  dur: 8,  color: '#67E8F9' },
  ];

  // 160 dots for dense point mesh
  const dots = useMemo(() => {
    const xVals   = seeded(160, 77);
    const yVals   = seeded(160, 55);
    const rVals   = seeded(160, 99);
    const durVals = seeded(160, 23);
    const dlyVals = seeded(160, 44);
    return Array.from({ length: 160 }, (_, i) => ({
      x:      xVals[i]  * W,
      y:      40 + yVals[i] * 175,
      r:      rVals[i] > 0.92 ? 3.0 : rVals[i] > 0.78 ? 1.9 : 1.2,
      dur:    3.5 + durVals[i] * 6,
      dly:    dlyVals[i] * 4.5,
      bright: rVals[i] > 0.92,
    }));
  }, []);

  const globalOpacity = 0.55 + si * 0.12 + (isFinalizing ? 0.22 : 0);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">

      {/* Perspective grid */}
      <div
        className="absolute inset-0"
        style={{ opacity: 0.10 + si * 0.018 }}
      >
        <div
          style={{
            position:        'absolute',
            inset:           0,
            backgroundImage: `
              linear-gradient(rgba(34,211,238,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)
            `,
            backgroundSize:  '55px 55px',
            transform:       'perspective(340px) rotateX(56deg)',
            transformOrigin: 'center top',
          }}
        />
      </div>

      {/* Wave paths + dot mesh */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="terrainGlow" x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {waveLayers.map((w, i) => (
          <motion.path
            key={i}
            d={wave(w.amp, w.freq, w.phase, w.baseY)}
            fill="none"
            stroke={w.color}
            strokeWidth="1.6"
            strokeDasharray={w.dash}
            filter="url(#terrainGlow)"
            style={{ opacity: w.op * globalOpacity }}
            animate={prefersReducedMotion ? {} : {
              d: [
                wave(w.amp, w.freq, w.phase, w.baseY),
                wave(w.amp, w.freq, w.phase + Math.PI, w.baseY),
                wave(w.amp, w.freq, w.phase, w.baseY),
              ],
            }}
            transition={{ duration: w.dur, repeat: Infinity, ease: 'linear' }}
          />
        ))}

        {dots.map((d, i) => (
          <motion.circle
            key={i}
            cx={d.x} cy={d.y} r={d.r}
            fill={d.bright ? '#67E8F9' : '#22D3EE'}
            animate={prefersReducedMotion
              ? { opacity: 0.12 * globalOpacity }
              : {
                  cy:      [d.y, d.y - 12, d.y],
                  opacity: [
                    0.12 * globalOpacity,
                    0.70 * globalOpacity * (isFinalizing ? 1.3 : 1),
                    0.12 * globalOpacity,
                  ],
                }
            }
            transition={{
              duration: d.dur,
              repeat:   Infinity,
              ease:     'easeInOut',
              delay:    d.dly,
            }}
          />
        ))}
      </svg>

      {/* Cyan ground glow — taller and stronger */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height:     110,
          background: `linear-gradient(to top, rgba(34,211,238,${0.08 + si * 0.022}), transparent)`,
        }}
      />
    </div>
  );
};

// ─── SignalNetwork ────────────────────────────────────────────────────────────
// Curved SVG paths from each panel toward the core, with travelling pulse dots.

export const SignalNetwork: React.FC<{
  stage: Stage;
  isFinalizing: boolean;
}> = ({ stage, isFinalizing }) => {
  const si = stageIndex(stage);

  const paths = [
    { id: 'tl', d: 'M 22 25 Q 36 42 50 56', dur: 2.4 },
    { id: 'bl', d: 'M 20 66 Q 36 60 50 56', dur: 3.0 },
    { id: 'tr', d: 'M 78 25 Q 64 42 50 56', dur: 2.1 },
    { id: 'br', d: 'M 80 66 Q 64 60 50 56', dur: 2.7 },
  ];

  // Paths more visible from early stages
  const lineOpacity = Math.max(0.06, si * 0.06);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden lg:block"
      aria-hidden="true"
    >
      {paths.map((p) => (
        <g key={p.id}>
          {/* Static dashed path — visible from stage 0 */}
          <path
            d={p.d}
            fill="none"
            stroke="rgba(34,211,238,0.18)"
            strokeWidth="1.2"
            strokeDasharray="5 12"
            opacity={lineOpacity}
          />
          {/* Travelling pulse — starts at CORE_ACTIVATION */}
          {si >= 1 && (
            <motion.circle
              r={isFinalizing ? 3.5 : 2.5}
              fill="#22D3EE"
              style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.9))' }}
              animate={{ opacity: isFinalizing ? [0.5, 1, 0.5] : [0.35, 0.88, 0.35] }}
              transition={{ duration: 1.0, repeat: Infinity }}
            >
              <animateMotion
                dur={`${p.dur}s`}
                repeatCount="indefinite"
                path={p.d}
              />
            </motion.circle>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── DataParticleField ────────────────────────────────────────────────────────
// Dense particle field — always rendered.
// Opacity scales from very faint at progress 0 to full at progress 100.

export const DataParticleField: React.FC<{
  stage: Stage;
  progress: number;
  isFinalizing: boolean;
  prefersReducedMotion: boolean;
}> = ({ stage, progress, isFinalizing, prefersReducedMotion }) => {
  const si    = stageIndex(stage);
  const t     = progress / 100;
  const count = prefersReducedMotion ? 20 : 160;

  const particles = useMemo(() => {
    const xVals  = seeded(count, 17);
    const svBase = seeded(count, 33);
    return Array.from({ length: count }, (_, i) => {
      const sv = seeded(6, 33 + i * 7);
      return {
        x:     xVals[i] * 100,
        y:     svBase[i] * 100,
        size:  sv[1] > 0.90 ? 2.8 : sv[1] > 0.72 ? 1.8 : 1.2,
        op:    0.08 + sv[2] * 0.44,
        dur:   6 + sv[3] * 11,
        dx:    (sv[4] - 0.5) * 55,
        dy:    (sv[5] - 0.5) * 55,
        color: sv[0] > 0.86 ? '#8B5CF6' : sv[0] > 0.58 ? '#67E8F9' : '#3B82F6',
      };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => {
        // Base opacity: stronger minimum, scales up with progress
        const baseOp = p.op * Math.max(0.15, t * 0.80 + si * 0.08);
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left:       `${p.x}%`,
              top:        `${p.y}%`,
              width:      p.size,
              height:     p.size,
              background: p.color,
            }}
            animate={prefersReducedMotion
              ? { opacity: baseOp }
              : (isFinalizing
                  ? {
                      x:       `calc(50vw - ${p.x}vw)`,
                      y:       `calc(50vh - ${p.y}vh)`,
                      opacity: 0,
                      scale:   0,
                    }
                  : {
                      x:       [0, p.dx, 0],
                      y:       [0, p.dy, 0],
                      opacity: [baseOp * 0.3, baseOp, baseOp * 0.3],
                    }
                )
            }
            transition={
              isFinalizing
                ? { duration: 0.9 + (i / count) * 0.6, ease: 'easeIn' }
                : {
                    duration: p.dur,
                    repeat:   Infinity,
                    ease:     'easeInOut',
                    delay:    (i / count) * p.dur,
                  }
            }
          />
        );
      })}
    </div>
  );
};

// ─── LoadingProgress ──────────────────────────────────────────────────────────
// Bottom-center progress system — same horizontal axis as the brand column.

export const LoadingProgress: React.FC<{
  progress:     number;
  statusMsg:    string;
  isFinalizing: boolean;
  showOnline:   boolean;
}> = ({ progress, statusMsg, isFinalizing, showOnline }) => (
  <div className="flex flex-col items-center w-full max-w-[520px] px-8">

    {/* Status message + percentage — cross-fade on message change */}
    <div className="flex items-center justify-between w-full mb-[10px]">
      <AnimatePresence mode="wait">
        <motion.span
          key={statusMsg}
          className="tracking-[0.18em] uppercase text-slate-300"
          style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}
          initial={{ opacity: 0, y: 5  }}
          animate={{ opacity: 1, y: 0  }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.45 }}
        >
          {statusMsg}
        </motion.span>
      </AnimatePresence>
      <span
        className="font-bold text-[#22D3EE] flex-shrink-0 ml-4"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize:   13,
          textShadow: '0 0 10px rgba(34,211,238,0.80)',
          minWidth:   42,
          textAlign:  'right',
        }}
      >
        {progress}%
      </span>
    </div>

    {/* Progress track */}
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 4, background: 'rgba(34,211,238,0.07)', borderRadius: 3 }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full"
        style={{
          background: isFinalizing
            ? 'linear-gradient(90deg, #3B82F6, #22D3EE, #ffffff)'
            : 'linear-gradient(90deg, #3B82F6, #22D3EE)',
          boxShadow: isFinalizing
            ? '0 0 18px rgba(34,211,238,1)'
            : '0 0 12px rgba(34,211,238,0.80)',
          width: `${progress}%`,
        }}
        transition={{ duration: 0.18 }}
      />
      {/* Shimmer sweep */}
      <motion.div
        className="absolute top-0 h-full w-20 rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.48), transparent)' }}
        animate={{ x: ['-100%', '820%'] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      />
    </div>

    {/* INITIALIZATION COMPLETE — appears with showOnline */}
    <AnimatePresence>
      {showOnline && (
        <motion.p
          className="mt-2 tracking-widest uppercase text-[#22D3EE]/72"
          style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          INITIALIZATION COMPLETE
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

// ─── DynamicInsightEngine ────────────────────────────────────────────────────────
// Flat circular technical intelligence interface.
// Replaces the 3D core in the loading sequence.

export const DynamicInsightEngine: React.FC<{
  stage: Stage;
  progress: number;
  isFinalizing: boolean;
  prefersReducedMotion: boolean;
}> = ({ stage, progress, isFinalizing, prefersReducedMotion }) => {
  const si = stageIndex(stage);
  const t  = progress / 100;   // 0 → 1 over the whole sequence

  // Color progression: 
  // 0-35%: Cyan (#22D3EE)
  // 35-70%: Cyan -> Blue (#3B82F6)
  // 70-100%: Blue -> subtle Violet (#8B5CF6)
  
  // Interpolation logic
  let r, g, b;
  if (t < 0.35) {
    r = 34; g = 211; b = 238; // #22D3EE
  } else if (t < 0.70) {
    const pt = (t - 0.35) / 0.35;
    r = Math.round(34 + pt * (59 - 34)); // 34 to 59
    g = Math.round(211 + pt * (130 - 211)); // 211 to 130
    b = Math.round(238 + pt * (246 - 238)); // 238 to 246
  } else {
    const pt = (t - 0.70) / 0.30;
    r = Math.round(59 + pt * (139 - 59)); // 59 to 139 (Violet #8B5CF6)
    g = Math.round(130 + pt * (92 - 130)); // 130 to 92
    b = Math.round(246 + pt * (246 - 246)); // 246 to 246
  }
  
  const currentColor = `rgb(${r},${g},${b})`;
  const currentColorCore = `rgba(${r},${g},${b},`; // for alpha use

  const W = 600, H = 600;
  const CX = 300, CY = 300;

  // Progressive segment illumination
  const numOuterSegments = 36;
  const numInnerSegments = 24;

  // Particle generation
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => {
      return {
        id: i,
        angle: (i / 40) * Math.PI * 2,
        radius: 120 + Math.random() * 120, // Spread between rings
        speed: 0.05 + Math.random() * 0.1,
        size: 1 + Math.random() * 2,
        opacityBase: 0.2 + Math.random() * 0.4
      }
    });
  }, []);

  return (
    <div
      className="relative flex items-center justify-center pointer-events-none"
      style={{ width: '100%', maxWidth: 600 }}
    >
      <motion.div
         initial={{ scale: 1 }}
         animate={{ scale: isFinalizing ? 0.28 : 1 }}
         transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }} // Collapse scale down to ~InsightCore size
         style={{ width: '100%', height: '100%', transformOrigin: 'center center' }}
      >
        {/* Large outer atmospheric glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: W * 1.5,
            height: H * 1.5,
            background: `radial-gradient(circle, ${currentColorCore}0.15) 0%, transparent 60%)`,
            filter: 'blur(30px)',
          }}
        />

        <svg
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible', display: 'block', width: '100%', height: 'auto', position: 'relative', zIndex: 10 }}
          aria-hidden="true"
        >
          <defs>
            <filter id="deGlowOuter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="15" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="deGlowInner" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* LAYER 2: Very thin outer technical ring (Slow Clockwise 14s) */}
          <motion.g
             animate={{ rotate: prefersReducedMotion ? 0 : 360 }}
             transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
             style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
             <circle cx={CX} cy={CY} r={260} fill="none" stroke={currentColorCore + "0.3)"} strokeWidth="1" />
             <circle cx={CX} cy={CY} r={265} fill="none" stroke={currentColorCore + "0.15)"} strokeWidth="0.5" strokeDasharray="4 12" />
          </motion.g>

          {/* LAYER 3: Segmented ring (Counter-clockwise 11s) */}
          <motion.g
             animate={{ rotate: -360 }}
             transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
             style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            {Array.from({ length: numOuterSegments }).map((_, i) => {
               // progressive illumination
               const threshold = i / numOuterSegments;
               const lit = t >= threshold;
               const op = lit ? 0.85 + (t * 0.15) : 0.15;
               return (
                 <circle
                   key={`outer-seg-${i}`}
                   cx={CX} cy={CY} r={230}
                   fill="none"
                   stroke={currentColor}
                   strokeWidth="8"
                   strokeDasharray={`12 ${2 * Math.PI * 230 / numOuterSegments - 12}`}
                   strokeDashoffset={-i * (2 * Math.PI * 230 / numOuterSegments)}
                   opacity={op}
                   style={{ transition: 'opacity 0.5s ease' }}
                 />
               );
            })}
          </motion.g>

          {/* LAYER 4: Dotted orbital ring */}
          <motion.g
             animate={{ rotate: 360 }}
             transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
             style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
             <circle cx={CX} cy={CY} r={200} fill="none" stroke={currentColorCore + "0.4)"} strokeWidth="2" strokeDasharray="1 8" />
          </motion.g>

          {/* LAYER 5: Technical tick marks */}
          <g opacity={0.5 + t * 0.5}>
            {Array.from({ length: 72 }).map((_, i) => {
              const angle = (i / 72) * Math.PI * 2;
              const isMajor = i % 6 === 0;
              const r1 = 175;
              const r2 = isMajor ? 185 : 180;
              return (
                <line
                  key={`tick-${i}`}
                  x1={CX + Math.cos(angle) * r1}
                  y1={CY + Math.sin(angle) * r1}
                  x2={CX + Math.cos(angle) * r2}
                  y2={CY + Math.sin(angle) * r2}
                  stroke={currentColor}
                  strokeWidth={isMajor ? 1.5 : 1}
                  opacity={isMajor ? 0.8 : 0.4}
                />
              )
            })}
          </g>

          {/* LAYER 6: Second segmented ring (Clockwise 7.5s) */}
          <motion.g
             animate={{ rotate: 360 }}
             transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
             style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            {Array.from({ length: numInnerSegments }).map((_, i) => {
               // progressive illumination
               const threshold = i / numInnerSegments;
               const lit = t >= threshold;
               const op = lit ? 0.9 + (t * 0.1) : 0.1;
               return (
                 <circle
                   key={`inner-seg-${i}`}
                   cx={CX} cy={CY} r={145}
                   fill="none"
                   stroke={currentColor}
                   strokeWidth="12"
                   strokeDasharray={`24 ${2 * Math.PI * 145 / numInnerSegments - 24}`}
                   strokeDashoffset={-i * (2 * Math.PI * 145 / numInnerSegments)}
                   opacity={op}
                   style={{ transition: 'opacity 0.3s ease' }}
                 />
               );
            })}
          </motion.g>

          {/* LAYER 7: Inner scanning ring */}
          {si >= 1 && (
            <motion.circle
               cx={CX} cy={CY} r={115}
               fill="none"
               stroke={currentColor}
               strokeWidth="3"
               strokeDasharray="60 300"
               animate={{ rotate: 360 }}
               transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
               style={{ transformOrigin: `${CX}px ${CY}px`, filter: 'url(#deGlowInner)' }}
            />
          )}

          {/* LAYER 8: Central circular engine */}
          <circle cx={CX} cy={CY} r={90} fill={currentColorCore + "0.1)"} stroke={currentColorCore + "0.5)"} strokeWidth="1.5" />
          <motion.circle
             cx={CX} cy={CY} r={80}
             fill={currentColorCore + "0.15)"}
             animate={{ r: isFinalizing ? 80 : [80, 84, 80], opacity: [0.7, 1, 0.7] }}
             transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
             filter="url(#deGlowInner)"
          />

          <text
            x={CX} y={CY - 5}
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily='"JetBrains Mono", monospace'
            fontSize="18"
            fontWeight="bold"
            letterSpacing="0.25em"
            style={{ textShadow: `0 0 10px ${currentColor}` }}
          >
            INSIGHT
          </text>
          <text
            x={CX} y={CY + 18}
            textAnchor="middle"
            fill={currentColor}
            fontFamily='"JetBrains Mono", monospace'
            fontSize="18"
            fontWeight="bold"
            letterSpacing="0.25em"
            style={{ textShadow: `0 0 10px ${currentColor}` }}
          >
            ENGINE
          </text>

          {/* Orbiting particles */}
          <g>
            {particles.map((p) => {
               // Subtly converge particles inward at finalization
               const currentRadius = isFinalizing ? p.radius * 0.7 : p.radius;
               return (
                 <motion.circle
                   key={`particle-${p.id}`}
                   r={p.size}
                   fill={currentColor}
                   opacity={p.opacityBase + (t * 0.4)}
                   animate={{ 
                     rotate: 360,
                   }}
                   transition={{ duration: 1 / p.speed, repeat: Infinity, ease: 'linear' }}
                   style={{ transformOrigin: `${CX}px ${CY}px` }}
                   cx={CX + currentRadius} // Start on the right side
                   cy={CY}
                 />
               );
            })}
          </g>

          {/* Radial Signal Pulses */}
          <motion.circle
            cx={CX} cy={CY} r={90}
            fill="none"
            stroke={currentColor}
            strokeWidth="2"
            animate={{ r: [90, 260], opacity: [0.6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
          />
          
          {/* Finalization Strong Pulse */}
          <AnimatePresence>
            {isFinalizing && (
              <motion.circle
                cx={CX} cy={CY} r={90}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="4"
                initial={{ r: 90, opacity: 1 }}
                animate={{ r: 350, opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

        </svg>
      </motion.div>
    </div>
  );
};

