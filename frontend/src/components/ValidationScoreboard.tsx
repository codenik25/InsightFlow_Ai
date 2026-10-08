import React, { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DecisionGuardrailResponse } from '../types';

interface ValidationScoreboardProps {
  guardrail: DecisionGuardrailResponse | null;
  evaluating: boolean;
}

// Lightweight smooth number count-up component with staggered delay
const AnimatedScoreValue: React.FC<{
  value: number;
  duration?: number;
  delay?: number;
  shouldReduceMotion: boolean;
  className?: string;
}> = ({ value, duration = 800, delay = 0, shouldReduceMotion, className = '' }) => {
  const [displayValue, setDisplayValue] = useState(shouldReduceMotion ? value : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    let startTime: number | null = null;
    let animId: number;
    let timeoutId: NodeJS.Timeout;

    timeoutId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Smooth cubic-bezier(0.22, 1, 0.36, 1) approximation
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(eased * value));

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        }
      };

      animId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [value, duration, delay, shouldReduceMotion]);

  return <span className={className}>{displayValue}</span>;
};

// Calculate SVG endpoint position for arc tip luminous particle
const getArcEndpoint = (score: number, radius: number, center: number) => {
  if (score <= 0) return { x: center, y: center - radius };
  // Start from top (-90 degrees) and rotate clockwise
  const angleDeg = -90 + (Math.min(score, 100) / 100) * 360;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Number((center + radius * Math.cos(rad)).toFixed(2)),
    y: Number((center + radius * Math.sin(rad)).toFixed(2)),
  };
};

export const ValidationScoreboard: React.FC<ValidationScoreboardProps> = ({
  guardrail,
  evaluating,
}) => {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [hoveredGauge, setHoveredGauge] = useState<string | null>(null);
  const [signalComplete, setSignalComplete] = useState<boolean>(false);
  const [completionHalo, setCompletionHalo] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Handle mouse move for subtle interactive surface reflection
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Trigger signal completion and one-shot halo pulse
  useEffect(() => {
    if (guardrail && !evaluating) {
      // Signal travels across the 4 nodes for 1.4s
      const signalTimer = setTimeout(() => {
        setSignalComplete(true);
        // Subtle completion halo pulse: expands 1.0 -> 1.04 -> 1.0 for 600ms, then settles
        setCompletionHalo(true);
        const haloTimer = setTimeout(() => {
          setCompletionHalo(false);
        }, 650);
        return () => clearTimeout(haloTimer);
      }, 1450);
      return () => clearTimeout(signalTimer);
    } else {
      setSignalComplete(false);
      setCompletionHalo(false);
    }
  }, [guardrail, evaluating]);

  // Large thick gauge geometry: 128px diameter, 9px stroke, 54px radius
  const center = 64;
  const strokeWidth = 9;
  const radius = 54;
  const innerRingRadius = 43;
  const circumference = 2 * Math.PI * radius; // ~339.29px

  // Score semantics based on actual backend data
  const scores = useMemo(() => {
    if (!guardrail) return null;

    const isRiskLow = guardrail.risk_level === 'LOW' || guardrail.risk_score <= 30;
    const isRiskMed = guardrail.risk_level === 'MEDIUM' || (guardrail.risk_score > 30 && guardrail.risk_score <= 60);

    const riskColor = isRiskLow ? '#35D399' : isRiskMed ? '#F4B740' : '#F06B78';
    const riskStatusLabel = isRiskLow ? 'LOW RISK' : isRiskMed ? 'MODERATE RISK' : 'ELEVATED RISK';

    return [
      {
        id: 'feasibility',
        label: 'FEASIBILITY',
        score: guardrail.feasibility_score,
        status: guardrail.feasibility_status,
        subLabel: 'RULES PASSED',
        tooltip: `${guardrail.feasibility_score} / 100 · Factual constraints verified`,
        color: '#35D399',
        glowColor: 'rgba(53, 211, 153, 0.22)',
        delay: 0,
        isRisk: false,
      },
      {
        id: 'realism',
        label: 'REALISM',
        score: guardrail.realism_score,
        status: guardrail.realism_score >= 80 ? 'HIGH' : guardrail.realism_score >= 60 ? 'MODERATE' : 'CAUTION',
        subLabel: 'REALISM CHECK',
        tooltip: `${guardrail.realism_score} / 100 · Baseline distribution parity`,
        color: '#39D6F5',
        glowColor: 'rgba(57, 214, 245, 0.22)',
        delay: 0.12,
        isRisk: false,
      },
      {
        id: 'risk',
        label: 'RISK SCORE',
        score: guardrail.risk_score,
        status: riskStatusLabel,
        subLabel: 'LOWER IS SAFER',
        tooltip: `${guardrail.risk_score} / 100 · Calibrated risk threshold`,
        color: riskColor,
        glowColor: isRiskLow ? 'rgba(53, 211, 153, 0.22)' : 'rgba(244, 183, 64, 0.22)',
        delay: 0.24,
        isRisk: true,
      },
      {
        id: 'confidence',
        label: 'CONFIDENCE',
        score: guardrail.confidence_score,
        status: guardrail.confidence_score >= 80 ? 'HIGH' : guardrail.confidence_score >= 60 ? 'MODERATE' : 'LIMITED',
        subLabel: 'MODEL CONFIDENCE',
        tooltip: `${guardrail.confidence_score} / 100 · Algorithmic certainty bounds`,
        color: '#9B7BFF',
        glowColor: 'rgba(155, 123, 255, 0.22)',
        delay: 0.36,
        isRisk: false,
      },
    ];
  }, [guardrail]);

  return (
    <motion.section
      onMouseMove={handleMouseMove}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: completionHalo && !shouldReduceMotion ? 1.006 : 1,
      }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full rounded-2xl bg-[#07101D]/90 border transition-all duration-700 p-8 sm:p-9 lg:p-10 relative overflow-hidden ${
        signalComplete
          ? 'border-[rgba(57,214,245,0.32)] shadow-[0_0_50px_rgba(57,214,245,0.1),0_20px_60px_rgba(0,0,0,0.28)]'
          : 'border-[rgba(120,190,230,0.16)] shadow-[0_20px_60px_rgba(0,0,0,0.22)]'
      }`}
      style={{ perspective: '1400px' }}
    >
      {/* Subtle dynamic mouse reflection */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 420px at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.045), transparent 70%)`,
        }}
      />

      {/* Center Core Watermark & Radial Anchor */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 select-none">
        <div className="w-[500px] h-[260px] rounded-full bg-gradient-to-r from-[#39D6F5]/6 via-[#4D8DFF]/6 to-[#9B7BFF]/6 blur-3xl" />
        <span className="text-[76px] sm:text-[104px] font-sans font-black tracking-[0.25em] text-white/[0.018] uppercase absolute">
          VALIDATION
        </span>
      </div>

      {/* ============================================================== */}
      {/* SCOREBOARD HEADER: VALIDATION PROFILE + REVIEW STATE           */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06] relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#39D6F5]" />
            <h2 className="text-[20px] font-sans font-bold text-white tracking-tight">
              VALIDATION PROFILE
            </h2>
          </div>
          <p className="text-[13.5px] sm:text-[14px] font-sans text-[#B8C5D5] leading-[1.55]">
            Multi-dimensional integrity status
          </p>
        </div>

        {/* Review State Badge */}
        {guardrail && (
          <div className="shrink-0">
            <span
              className={`px-4 py-1.5 rounded-full text-[13px] font-sans font-bold border uppercase tracking-wider flex items-center gap-2 ${
                guardrail.decision_status === 'READY_TO_CONSIDER' || guardrail.feasibility_status === 'FEASIBLE'
                  ? 'bg-[#35D399]/15 text-[#35D399] border-[#35D399]/30'
                  : guardrail.decision_status === 'HUMAN_REVIEW_REQUIRED'
                  ? 'bg-[#F4B740]/15 text-[#F4B740] border-[#F4B740]/30'
                  : 'bg-[#F06B78]/15 text-[#F06B78] border-[#F06B78]/30'
              }`}
            >
              {guardrail.decision_status === 'READY_TO_CONSIDER' || guardrail.feasibility_status === 'FEASIBLE' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {guardrail.decision_status.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* INDETERMINATE PROCESSING STATE (WHEN EVALUATING OR NO DATA)    */}
      {/* ============================================================== */}
      {(!guardrail || evaluating) && (
        <div className="py-10 grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 text-center relative z-10">
          {['FEASIBILITY', 'REALISM', 'RISK SCORE', 'CONFIDENCE'].map((label, idx) => (
            <div key={idx} className="space-y-4 flex flex-col items-center">
              {/* 128px Large Indeterminate Gauge */}
              <div className="relative w-[128px] h-[128px] flex items-center justify-center">
                {/* Layer 1: Dark Slate Track */}
                <svg className="w-[128px] h-[128px] absolute inset-0">
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="#101B2B"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  {/* Layer 3: Concentric inner accent track */}
                  <circle
                    cx={center}
                    cy={center}
                    r={innerRingRadius}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    fill="transparent"
                  />
                </svg>

                {/* Rotating Indeterminate Outer Arc */}
                <motion.div
                  animate={evaluating ? { rotate: 360 } : { rotate: 0 }}
                  transition={evaluating ? { duration: 3.2, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
                  className="absolute inset-0 rounded-full"
                >
                  <svg className="w-[128px] h-[128px]">
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke="#39D6F5"
                      strokeWidth={strokeWidth}
                      strokeDasharray="75 264"
                      strokeLinecap="round"
                      fill="transparent"
                      opacity={evaluating ? 0.9 : 0.25}
                    />
                  </svg>
                </motion.div>

                {/* Counter-rotating Inner Accent */}
                <motion.div
                  animate={evaluating ? { rotate: -360 } : { rotate: 0 }}
                  transition={evaluating ? { duration: 2.2, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
                  className="absolute inset-[16px] rounded-full border-2 border-transparent border-t-[#39D6F5]/60"
                />

                {/* Center Core Dot */}
                <span
                  className={`w-3 h-3 rounded-full ${
                    evaluating ? 'bg-[#39D6F5] animate-ping' : 'bg-white/20'
                  }`}
                />
              </div>

              <div>
                <span className="text-[13px] font-sans font-semibold uppercase tracking-[0.03em] text-[#8A98AA] block">
                  {label}
                </span>
                <span
                  className={`text-[13px] font-sans font-bold uppercase block mt-1 ${
                    evaluating ? 'text-[#39D6F5] animate-pulse' : 'text-[#8A98AA]'
                  }`}
                >
                  {evaluating ? 'ANALYZING...' : 'STANDBY'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* SIGNATURE 4 LARGE THICK GAUGES + CONNECTING ENERGY SYSTEM      */}
      {/* ============================================================== */}
      {!evaluating && scores && (
        <div className="pt-8 pb-3 relative">
          {/* Horizontal Intelligence Connection Line: Exactly aligns to center of 128px gauges (64px) */}
          {!shouldReduceMotion && (
            <div className="absolute top-[80px] left-0 right-0 h-[2px] hidden lg:block pointer-events-none z-0">
              <svg className="w-full h-4 overflow-visible" preserveAspectRatio="none">
                {/* Connection track behind the 4 node centers: 12.5%, 37.5%, 62.5%, 87.5% */}
                <line
                  x1="12.5%"
                  y1="2"
                  x2="87.5%"
                  y2="2"
                  stroke="rgba(120, 190, 230, 0.18)"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                />
                {/* One-shot traveling signal: Feasibility -> Realism -> Risk -> Confidence */}
                <motion.circle
                  r="4"
                  fill="#39D6F5"
                  filter="drop-shadow(0 0 8px #39D6F5)"
                  initial={{ cx: '12.5%', cy: 2, opacity: 0 }}
                  animate={{
                    cx: ['12.5%', '37.5%', '62.5%', '87.5%'],
                    opacity: [0, 1, 1, 0.85],
                  }}
                  transition={{
                    duration: 1.4,
                    ease: [0.22, 1, 0.36, 1],
                    repeat: 0,
                  }}
                />
              </svg>
            </div>
          )}

          {/* Gauges Grid: 4 horizontal on desktop, 2x2 on tablet/mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 relative z-10">
            {scores.map((item) => {
              const isHovered = hoveredGauge === item.id;
              const endpoint = getArcEndpoint(item.score, radius, center);

              return (
                <motion.div
                  key={item.id}
                  onMouseEnter={() => setHoveredGauge(item.id)}
                  onMouseLeave={() => setHoveredGauge(null)}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 0, scale: 0.88, y: 10 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: shouldReduceMotion ? 0 : item.delay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex flex-col items-center text-center p-3 rounded-2xl transition-all duration-200 cursor-default group relative"
                  style={{
                    transform: isHovered
                      ? 'translateY(-3px) rotateX(0.4deg) rotateY(0.4deg)'
                      : 'translateY(0px) rotateX(0deg) rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Compact Tooltip on Hover */}
                  {isHovered && item.tooltip && (
                    <div className="absolute -top-7 px-3 py-1 rounded-md bg-slate-900/95 border border-white/[0.12] text-[11px] font-mono text-white tracking-wide shadow-xl whitespace-nowrap z-30 pointer-events-none">
                      {item.tooltip}
                    </div>
                  )}

                  {/* 128px Large Gauge Container */}
                  <div className="relative w-[128px] h-[128px] flex items-center justify-center mb-3">
                    {/* Soft local atmospheric halo behind active gauge */}
                    <div
                      className="absolute inset-0 rounded-full blur-2xl transition-opacity duration-300 pointer-events-none"
                      style={{
                        backgroundColor: item.color,
                        opacity: isHovered ? 0.35 : 0.12,
                      }}
                    />

                    {/* SVG Radial Instrument (128x128px) */}
                    <svg className="w-[128px] h-[128px] transform -rotate-90 overflow-visible">
                      {/* LAYER 1: Outer Dark Slate Track (9px stroke) */}
                      <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#101B2B"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />

                      {/* LAYER 3: Very Subtle Inner Concentric Accent Ring */}
                      <circle
                        cx={center}
                        cy={center}
                        r={innerRingRadius}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth="1.5"
                        fill="transparent"
                      />

                      {/* Calibrated Safe Boundary Ring for Risk (highlights safe boundary <=30) */}
                      {item.isRisk && (
                        <circle
                          cx={center}
                          cy={center}
                          r={radius}
                          stroke="rgba(53, 211, 153, 0.25)"
                          strokeWidth="2"
                          strokeDasharray={`${circumference * 0.3} ${circumference * 0.7}`}
                          fill="transparent"
                        />
                      )}

                      {/* Interactive Subtle Outer Hover Ring */}
                      {isHovered && (
                        <circle
                          cx={center}
                          cy={center}
                          r={radius + 7}
                          stroke={item.color}
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                          opacity={0.5}
                          fill="transparent"
                        />
                      )}

                      {/* LAYER 2: Main Validation Arc (Thick 9px, bright semantic accent, round end cap) */}
                      <motion.circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={item.color}
                        strokeWidth={isHovered ? strokeWidth + 1 : strokeWidth}
                        strokeDasharray={circumference}
                        initial={{
                          strokeDashoffset: shouldReduceMotion
                            ? circumference * (1 - item.score / 100)
                            : circumference,
                        }}
                        animate={{
                          strokeDashoffset: circumference * (1 - item.score / 100),
                        }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 1.15,
                          delay: shouldReduceMotion ? 0 : item.delay,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        strokeLinecap="round"
                        fill="transparent"
                      />

                      {/* SECTION 7: Tiny Luminous Endpoint Particle Marker */}
                      {item.score > 0 && !shouldReduceMotion && (
                        <motion.circle
                          cx={endpoint.x}
                          cy={endpoint.y}
                          r="3.5"
                          fill="#FFFFFF"
                          filter={`drop-shadow(0 0 5px ${item.color})`}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.35,
                            delay: item.delay + 0.9,
                            ease: 'easeOut',
                          }}
                        />
                      )}
                    </svg>

                    {/* Dominant Centered Number: 36–40px, bold Plus Jakarta Sans, NO monospace */}
                    <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                      <AnimatedScoreValue
                        value={item.score}
                        shouldReduceMotion={shouldReduceMotion}
                        duration={800}
                        delay={item.delay}
                        className={`text-[36px] sm:text-[38px] lg:text-[40px] font-sans font-bold tracking-tight transition-colors duration-200 ${
                          isHovered ? 'text-white' : 'text-[#F5F7FA]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Status Hierarchy (Sequentially reveals after number counts) */}
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: shouldReduceMotion ? 0 : item.delay + 0.45,
                    }}
                    className="space-y-1"
                  >
                    {/* Label: 13–14px, weight 600 */}
                    <span className="text-[13px] sm:text-[14px] font-sans uppercase tracking-[0.03em] text-[#8A98AA] block font-semibold transition-colors duration-200 group-hover:text-[#B8C5D5]">
                      {item.label}
                    </span>

                    {/* Status: 14px, weight 700 */}
                    <span
                      className="text-[14px] font-sans font-bold uppercase block tracking-wider transition-all duration-200"
                      style={{
                        color: item.color,
                        textShadow: isHovered ? `0 0 12px ${item.glowColor}` : 'none',
                      }}
                    >
                      {item.status}
                    </span>

                    {/* Micro Data Visual */}
                    <div className="pt-2 flex flex-col items-center">
                      <div className="w-10 h-[1.5px] bg-white/[0.08] mb-1.5" />
                      <span className="text-[11.5px] font-mono text-[#8A98AA] uppercase tracking-wider">
                        {item.subLabel}
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.section>
  );
};
