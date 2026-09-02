/**
 * LoadingSequence.tsx
 *
 * InsightFlow AI  Cinematic 5 second loading screen.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type Stage,
  SciFiFrame,
  SystemTelemetry,
  DynamicInsightEngine,
  
  VerticalDataStreams,
  SignalNetwork,
  DataTerrain,
  DataParticleField,
  
  FloatingAnalyticsPanel,
  LoadingProgress,
} from './LoadingComponents';

// --- Constants ----------------------------------------------------------------

/** Exact cinematic duration  5 seconds */
const TOTAL_MS = 5000;

/** Progress -> stage mapping. Progress is 0-100 over TOTAL_MS. */
const STAGE_THRESHOLDS: [number, Stage][] = [
  [0,   'ENVIRONMENT_ESTABLISHMENT'],
  [14,  'DATA_PROCESSING'],
  [34,  'PATTERN_DETECTION'],
  [56,  'INTELLIGENCE_FORMATION'],
  [80,  'DECISION_READINESS'],
  [92,  'FINALIZING'],
  [100, 'COMPLETE'],
];

/** Status messages  cross-fade as loading progresses. No typewriter effect. */
const STATUS_MESSAGES: [number, string][] = [
  [0,   'INITIALIZING INSIGHTFLOW AI'],
  [14,  'ANALYZING SIGNALS'],
  [34,  'DETECTING PATTERNS'],
  [56,  'BUILDING INTELLIGENCE'],
  [80,  'DECISION INTELLIGENCE ONLINE'],
];

function progressToStage(p: number): Stage {
  let s: Stage = 'ENVIRONMENT_ESTABLISHMENT';
  for (const [thr, stage] of STAGE_THRESHOLDS) {
    if (p >= thr) s = stage;
  }
  return s;
}

function progressToStatusMsg(p: number): string {
  let msg = STATUS_MESSAGES[0][1];
  for (const [thr, m] of STATUS_MESSAGES) {
    if (p >= thr) msg = m;
  }
  return msg;
}

// --- LoadingSequence ---------------------------------------------------------

interface Props {
  onComplete: () => void;
}

const LoadingSequence: React.FC<Props> = ({ onComplete }) => {
  const [progress,        setProgress]        = useState(0);
  const [stage,           setStage]           = useState<Stage>('ENVIRONMENT_ESTABLISHMENT');
  const [statusMsg,       setStatusMsg]       = useState(STATUS_MESSAGES[0][1]);
  const [showOnline,      setShowOnline]      = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const rafRef       = useRef<number>(0);

  const prefersReducedMotion = useMemo(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  []);

  // -- Single-fire completion -------------------------------------------------
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onComplete();
  }, [onComplete]);

  // -- Main animation loop ----------------------------------------------------
  useEffect(() => {
    const duration  = prefersReducedMotion ? 900 : TOTAL_MS;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const raw     = Math.min((elapsed / duration) * 100, 100);
      const p       = Math.floor(raw);

      setProgress(p);
      setStage(progressToStage(p));
      setStatusMsg(progressToStatusMsg(p));

      if (p >= 100) {
        setShowOnline(true);
        finish();
        return; // stop rAF -- completion sequence takes over
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    const safeOut = setTimeout(finish, duration + 3500);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(safeOut);
    };
  }, [finish, prefersReducedMotion]);

  const isFinalizing = stage === 'FINALIZING' || stage === 'COMPLETE';

  // -- Camera depth system ----------------------------------------------------
  const t             = progress / 100;
  const panelScale    = 1 + t * 0.025;   // analytics panels slightly moving
  const coreScale     = isFinalizing ? 1 + t * 0.05 : 1 + t * 0.025;   // push slightly forward at end
  const logoScale     = 1 + t * 0.005;   // logo / brand / progress -- locked

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: '#02050A' }}
      aria-label="InsightFlow AI is initializing"
      role="status"
    >
          {/* == BACKGROUND TERRAIN & PARTICLES ============================== */}
          <DataTerrain stage={stage} isFinalizing={isFinalizing} prefersReducedMotion={prefersReducedMotion} />
          <DataParticleField stage={stage} progress={progress} isFinalizing={isFinalizing} prefersReducedMotion={prefersReducedMotion} />

          {/* == HUD FRAME -- not scaled (always correct viewport size) ======= */}
          <SciFiFrame isFinalizing={isFinalizing} />

          {/* == TELEMETRY -- not scaled (decorative corner text) ============= */}
          <SystemTelemetry stage={stage} progress={progress} />

          {/* == SIGNAL NETWORK -- not scaled (SVG uses viewport % coords) === */}
          <SignalNetwork stage={stage} isFinalizing={isFinalizing} />

          {/* == ANALYTICS PANEL LAYER -- scale 1.025 ========================= */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ transform: `scale(${panelScale})`, transformOrigin: 'center center' }}
          >
            <FloatingAnalyticsPanel
              quadrant="top-left"
              title="DATA ANALYSIS"
              subtitle="Revenue Growth"
              value="+24.8%"
              footnote="vs last month"
              chartType="line"
              stage={stage}
              delay={0}
              isFinalizing={isFinalizing}
              animProgress={progress}
            />
            <FloatingAnalyticsPanel
              quadrant="bottom-left"
              title="AI INSIGHTS"
              subtitle="Patterns Detected"
              value="93.7%"
              footnote="Confidence Score"
              chartType="bar"
              stage={stage}
              delay={0.3}
              isFinalizing={isFinalizing}
              animProgress={progress}
            />
            <FloatingAnalyticsPanel
              quadrant="top-right"
              title="DECISION IMPACT"
              subtitle="Value Created"
              value="&#x20B9;2.45 Cr"
              footnote="This Quarter"
              chartType="bar"
              stage={stage}
              delay={0.15}
              isFinalizing={isFinalizing}
              animProgress={progress}
            />
            <FloatingAnalyticsPanel
              quadrant="bottom-right"
              title="SYSTEM STATUS"
              subtitle=""
              value=""
              footnote=""
              chartType="status"
              stage={stage}
              delay={0.45}
              isFinalizing={isFinalizing}
              animProgress={progress}
            />
          </div>

          {/* == CENTER COLUMN -- logo (1.005) + core ========================= */}
          <div className="absolute inset-0 flex flex-col items-center pointer-events-none">

            {/* Brand block */}
            <div style={{ transform: `scale(${logoScale})`, transformOrigin: 'center top' }}>
              <motion.div
                className="flex flex-col items-center"
                style={{ marginTop: '5vh' }}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
              >
                <motion.div
                  className="mb-5"
                  animate={isFinalizing
                    ? { filter: 'drop-shadow(0 0 28px rgba(34,211,238,0.95))' }
                    : { filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.55))' }
                  }
                  transition={{ duration: 1.0 }}
                >
                  <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
                    <path d="M8 8 L60 8 L34 60 Z" stroke="#22D3EE" strokeWidth="2"
                      strokeLinejoin="round" fill="rgba(34,211,238,0.08)" />
                    <path d="M8 8 L34 8 L21 34 Z" fill="rgba(59,130,246,0.55)" />
                    <path d="M20 26 L48 26 L34 50 Z" fill="#67E8F9" opacity="0.92" />
                    <rect x="8" y="8" width="52" height="2" rx="1" fill="rgba(34,211,238,0.45)" />
                  </svg>
                </motion.div>

                <h1
                  className="text-white text-center font-semibold uppercase"
                  style={{
                    fontFamily:    '"Space Grotesk", sans-serif',
                    fontSize:      'clamp(22px, 2.8vw, 34px)',
                    letterSpacing: '0.28em',
                    textShadow:    '0 0 50px rgba(34,211,238,0.28)',
                  }}
                >
                  INSIGHTFLOW{' '}
                  <span style={{ color: '#22D3EE' }}>AI</span>
                </h1>

                <motion.p
                  className="text-center text-[#94A3B8]"
                  style={{
                    fontFamily:    '"Inter", sans-serif',
                    fontSize:      'clamp(12px, 1.1vw, 14px)',
                    letterSpacing: '0.12em',
                    marginTop:     8,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 1.4 }}
                >
                  Turning Data Into Decisions
                </motion.p>
              </motion.div>
            </div>

            {/* Intelligence zone: streams + dynamic engine */}
            <div
              className="relative flex items-center justify-center w-full"
              style={{
                flex:            '1 1 auto',
                minHeight:       0,
                transform:       `scale(${coreScale})`,
                transformOrigin: 'center center',
              }}
            >
              <div className="relative flex items-center justify-center w-full h-full">
                <VerticalDataStreams
                  stage={stage}
                  progress={progress}
                  isFinalizing={isFinalizing}
                  prefersReducedMotion={prefersReducedMotion}
                />
                <DynamicInsightEngine
                  stage={stage}
                  progress={progress}
                  isFinalizing={isFinalizing}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            </div>

          </div>

          {/* == PROGRESS SYSTEM -- not scaled (UI chrome) ==================== */}
          <div
            className="absolute left-0 right-0 flex justify-center pointer-events-none"
            style={{ bottom: 32 }}
          >
            <LoadingProgress
              progress={progress}
              statusMsg={statusMsg}
              isFinalizing={isFinalizing}
              showOnline={showOnline}
            />
          </div>

          {/* == EXIT PULSE + FLARE -- fires during finalization (4.6s - 5.0s) ================= */}
          <AnimatePresence>
            {isFinalizing && (
              <>
                <motion.div
                  className="absolute inset-0 pointer-events-none z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.52, 0] }}
                  transition={{ duration: 0.40, times: [0, 0.32, 1], ease: 'easeOut' }}
                  style={{
                    background: 'radial-gradient(ellipse 68% 58% at 50% 52%, rgba(34,211,238,0.26) 0%, rgba(255,255,255,0.05) 38%, transparent 68%)',
                  }}
                />
                <motion.div
                  className="absolute pointer-events-none z-50"
                  style={{
                    top:        '50%',
                    left:       0,
                    right:      0,
                    height:     2,
                    transform:  'translateY(-50%)',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.50) 18%, rgba(255,255,255,0.82) 50%, rgba(34,211,238,0.50) 82%, transparent 100%)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.80, 0] }}
                  transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
                />
              </>
            )}
          </AnimatePresence>

    </div>
  );
};

export default LoadingSequence;
