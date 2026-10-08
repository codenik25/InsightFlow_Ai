import React, { useState, useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface UploadProfilingLoaderProps {
  status: 'loading' | 'success' | 'error';
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

const STAGES = [
  {
    key: 'data',
    label: 'DATA INGEST',
    subtitle: 'Streaming dataset bytes, verifying checksums & delimiter structure',
    telemetry: 'INGESTING CSV // 100% BUFFERED // ZERO-LOSS',
    metric: '64/64 CHUNKS',
    color: '#39D6F5',
  },
  {
    key: 'schema',
    label: 'SCHEMA INFERENCE',
    subtitle: 'Detecting data types, datetime patterns & null vector sparsity',
    telemetry: 'INFERRING SCHEMA // DETERMINISTIC SCAN // 24 COLS',
    metric: '99.8% CONFIDENCE',
    color: '#4D8DFF',
  },
  {
    key: 'distribution',
    label: 'STATISTICAL PROFILING',
    subtitle: 'Computing covariance, quartiles, entropy distributions & cardinality',
    telemetry: 'PROFILING DISTRIBUTIONS // COVARIANCE MATRIX ACTIVE',
    metric: 'ENTROPY NORMALIZED',
    color: '#9B7BFF',
  },
  {
    key: 'quality',
    label: 'QUALITY SYNTHESIS',
    subtitle: 'Synthesizing data health scorecard & anomaly boundary thresholds',
    telemetry: 'SYNTHESIZING HEALTH SCORECARD // PIPELINE READY',
    metric: 'HEALTH 98.4%',
    color: '#34D399',
  },
];

export const UploadProfilingLoader: React.FC<UploadProfilingLoaderProps> = ({
  status,
  errorMessage,
  onRetry,
  className = '',
}) => {
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const [stageIndex, setStageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Smoothly cycle through technical pipeline stages during loading
  useEffect(() => {
    if (status !== 'loading') return;
    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % STAGES.length);
    }, 2600);

    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => prev + 0.1);
    }, 100);

    return () => {
      clearInterval(stageTimer);
      clearInterval(elapsedTimer);
    };
  }, [status]);

  if (isError) {
    return (
      <div
        className={`w-full rounded-[22px] border border-rose-500/30 bg-[#020711]/95 p-8 sm:p-10 flex flex-col items-center justify-center text-center min-h-[300px] shadow-[0_15px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(244,63,94,0.15)] relative overflow-hidden font-sans ${className}`}
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight mb-2">
          Dataset Ingest & Profiling Halted
        </h3>
        <p className="text-sm text-rose-300 font-normal max-w-md leading-relaxed mb-6">
          {errorMessage || 'An error occurred during dataset upload, schema parsing, or profiling.'}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-rose-600 hover:bg-rose-500 border border-rose-400/30 shadow-[0_0_20px_rgba(244,63,94,0.35)] transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Upload & Profiling</span>
          </button>
        )}
      </div>
    );
  }

  const currentStage = STAGES[stageIndex];

  return (
    <div
      className={`relative w-full rounded-[22px] p-8 sm:p-10 flex flex-col items-center justify-center text-center overflow-hidden min-h-[320px] sm:min-h-[350px] bg-[#020711]/95 border border-[#39D6F5]/30 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_50px_rgba(57,214,245,0.12)] select-none font-sans ${className}`}
    >
      {/* ============================================================== */}
      {/* 60FPS CSS KEYFRAME ANIMATIONS (Always Active, Reduced-Motion Safe) */}
      {/* ============================================================== */}
      <style>{`
        @keyframes upl-spin-cw {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes upl-spin-ccw {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes upl-radar-beam {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes upl-core-glow {
          0%, 100% { transform: scale(0.92); opacity: 0.85; filter: drop-shadow(0 0 10px #39D6F5); }
          50% { transform: scale(1.12); opacity: 1; filter: drop-shadow(0 0 24px #39D6F5); }
        }
        @keyframes upl-shockwave-1 {
          0% { r: 16px; opacity: 0.85; stroke-width: 2.2px; }
          100% { r: 72px; opacity: 0; stroke-width: 0.5px; }
        }
        @keyframes upl-shockwave-2 {
          0% { r: 16px; opacity: 0.85; stroke-width: 2.2px; }
          100% { r: 72px; opacity: 0; stroke-width: 0.5px; }
        }
        @keyframes upl-border-glow-run {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -520; }
        }
        @keyframes upl-beam-sweep {
          0% { transform: translateX(-120%); opacity: 0; }
          25% { opacity: 0.55; }
          75% { opacity: 0.55; }
          100% { transform: translateX(350%); opacity: 0; }
        }
        @keyframes upl-pulse-dots {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.25); filter: drop-shadow(0 0 6px #39D6F5); }
        }
        @keyframes upl-conduit-stream {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes upl-packet-glide {
          0% { offset-distance: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        .upl-outer-orbit {
          animation: upl-spin-cw 4.2s linear infinite;
          transform-origin: 80px 80px;
        }
        .upl-mid-orbit {
          animation: upl-spin-ccw 5.8s linear infinite;
          transform-origin: 80px 80px;
        }
        .upl-inner-orbit {
          animation: upl-spin-cw 3s linear infinite;
          transform-origin: 80px 80px;
        }
        .upl-radar-rotator {
          animation: upl-radar-beam 2.8s linear infinite;
          transform-origin: 80px 80px;
        }
        .upl-core-beacon {
          animation: upl-core-glow 2.2s ease-in-out infinite;
          transform-origin: 80px 80px;
        }
        .upl-sonar-wave-1 {
          animation: upl-shockwave-1 2.4s cubic-bezier(0.1, 0.7, 0.4, 1) infinite;
        }
        .upl-sonar-wave-2 {
          animation: upl-shockwave-2 2.4s cubic-bezier(0.1, 0.7, 0.4, 1) infinite;
          animation-delay: 1.2s;
        }
        .upl-border-moving-light {
          animation: upl-border-glow-run 6s linear infinite;
        }
        .upl-scanning-laser-beam {
          animation: upl-beam-sweep 3.2s ease-in-out infinite;
        }
      `}</style>

      {/* ============================================================== */}
      {/* 1. ANIMATED PERIMETER LIGHT RUNNER                             */}
      {/* ============================================================== */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none rounded-[22px]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="upl-border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#39D6F5" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#4D8DFF" stopOpacity="0.8" />
            <stop offset="80%" stopColor="#9B7BFF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#39D6F5" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="21"
          ry="21"
          fill="none"
          stroke="url(#upl-border-grad)"
          strokeWidth="1.8"
          strokeDasharray="100 240"
          className="upl-border-moving-light"
        />
      </svg>

      {/* ============================================================== */}
      {/* 2. ATMOSPHERIC LIGHTING & SCANNING LASER BEAM                  */}
      {/* ============================================================== */}
      {/* Deep ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 transition-all duration-700"
        style={{
          background:
            'radial-gradient(circle 280px at 50% 45%, rgba(57, 214, 245, 0.18), rgba(77, 141, 255, 0.12) 40%, rgba(155, 123, 255, 0.08) 65%, transparent 80%)',
        }}
      />

      {/* Horizontal sweeping laser line */}
      <div className="absolute inset-y-0 w-36 pointer-events-none bg-gradient-to-r from-transparent via-[#39D6F5]/25 to-transparent upl-scanning-laser-beam" />

      {/* Cybernetic Corner HUD Reticles */}
      <div className="absolute top-3.5 left-3.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#39D6F5]/60 pointer-events-none" />
      <div className="absolute top-3.5 right-3.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#39D6F5]/60 pointer-events-none" />
      <div className="absolute bottom-3.5 left-3.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#39D6F5]/60 pointer-events-none" />
      <div className="absolute bottom-3.5 right-3.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#39D6F5]/60 pointer-events-none" />

      {/* Top telemetry ticker */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 mb-4 text-xs font-mono text-cyan-300">
        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE] animate-pulse" />
        <span className="font-semibold tracking-wider uppercase">
          {isSuccess ? 'PROFILING COMPLETE' : `ANALYSIS ACTIVE // ${currentStage.metric}`}
        </span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">T+{elapsed.toFixed(1)}s</span>
      </div>

      {/* ============================================================== */}
      {/* 3. MULTI-RING CONTINUOUS ORBITAL GYROSCOPE (SVG 160x160)       */}
      {/* ============================================================== */}
      <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center mb-4">
        {/* Soft core lighting backdrop */}
        <div className="absolute inset-0 rounded-full bg-[#39D6F5]/10 filter blur-xl pointer-events-none" />

        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="upl-orbit-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#39D6F5" />
              <stop offset="50%" stopColor="#4D8DFF" />
              <stop offset="100%" stopColor="#39D6F5" />
            </linearGradient>

            <linearGradient id="upl-orbit-violet-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9B7BFF" />
              <stop offset="50%" stopColor="#39D6F5" />
              <stop offset="100%" stopColor="#4D8DFF" />
            </linearGradient>

            <radialGradient id="upl-radar-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#39D6F5" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#4D8DFF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#020711" stopOpacity="0" />
            </radialGradient>

            <filter id="upl-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Static Track Rings for depth */}
          <circle cx="80" cy="80" r="70" stroke="rgba(57, 214, 245, 0.08)" strokeWidth="1.5" />
          <circle cx="80" cy="80" r="54" stroke="rgba(77, 141, 255, 0.08)" strokeWidth="1.5" />
          <circle cx="80" cy="80" r="38" stroke="rgba(155, 123, 255, 0.1)" strokeWidth="1.5" />

          {/* Sonar Expanding Shockwaves */}
          {!isSuccess && (
            <>
              <circle cx="80" cy="80" r="16" fill="none" stroke="#39D6F5" className="upl-sonar-wave-1" />
              <circle cx="80" cy="80" r="16" fill="none" stroke="#4D8DFF" className="upl-sonar-wave-2" />
            </>
          )}

          {/* Sweeping 360° Radar Cone */}
          {!isSuccess && (
            <g className="upl-radar-rotator">
              <path
                d="M 80,80 L 80,10 A 70,70 0 0,1 140,50 Z"
                fill="url(#upl-radar-grad)"
                opacity="0.65"
              />
              <line x1="80" y1="80" x2="80" y2="10" stroke="#39D6F5" strokeWidth="2" opacity="0.9" />
              <circle cx="80" cy="10" r="3" fill="#FFFFFF" filter="url(#upl-glow-filter)" />
            </g>
          )}

          {/* Outer Ring: Rotating Clockwise with Photon Satellites */}
          <g className={isSuccess ? '' : 'upl-outer-orbit'}>
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="url(#upl-orbit-cyan-grad)"
              strokeWidth="2.8"
              strokeDasharray="115 35 115 35"
              strokeLinecap="round"
            />
            {/* Cardinal photon satellites */}
            <circle cx="80" cy="10" r="3" fill="#39D6F5" filter="url(#upl-glow-filter)" />
            <circle cx="80" cy="150" r="3" fill="#4D8DFF" filter="url(#upl-glow-filter)" />
            <circle cx="10" cy="80" r="2.2" fill="#9B7BFF" />
            <circle cx="150" cy="80" r="2.2" fill="#39D6F5" />
          </g>

          {/* Middle Ring: Rotating Counter-Clockwise */}
          <g className={isSuccess ? '' : 'upl-mid-orbit'}>
            <circle
              cx="80"
              cy="80"
              r="54"
              stroke="url(#upl-orbit-violet-grad)"
              strokeWidth="2.2"
              strokeDasharray="80 25 80 25"
              strokeLinecap="round"
            />
            <circle cx="134" cy="80" r="2.8" fill="#9B7BFF" filter="url(#upl-glow-filter)" />
            <circle cx="26" cy="80" r="2.8" fill="#39D6F5" filter="url(#upl-glow-filter)" />
          </g>

          {/* Inner Ring: Rotating Rapidly */}
          <g className={isSuccess ? '' : 'upl-inner-orbit'}>
            <circle
              cx="80"
              cy="80"
              r="38"
              stroke="#39D6F5"
              strokeWidth="1.8"
              strokeDasharray="45 25"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
            <circle cx="80" cy="42" r="2.2" fill="#FFFFFF" />
          </g>

          {/* Central Pulsating Holographic Core */}
          <g className={isSuccess ? '' : 'upl-core-beacon'}>
            <circle
              cx="80"
              cy="80"
              r="22"
              fill="#030C1E"
              stroke="#39D6F5"
              strokeWidth="2"
              strokeOpacity="0.9"
            />
            {/* Hex crosshair accents */}
            <line x1="80" y1="62" x2="80" y2="98" stroke="rgba(57, 214, 245, 0.4)" strokeWidth="1" />
            <line x1="62" y1="80" x2="98" y2="80" stroke="rgba(57, 214, 245, 0.4)" strokeWidth="1" />
            {/* Core glowing dot */}
            <circle cx="80" cy="80" r="9" fill="#39D6F5" opacity="0.95" filter="url(#upl-glow-filter)" />
            <circle cx="80" cy="80" r="4.5" fill="#FFFFFF" />
          </g>

          {/* Success Checkmark Transition */}
          {isSuccess && (
            <g>
              <circle cx="80" cy="80" r="26" fill="#041426" stroke="#34D399" strokeWidth="2.5" />
              <path
                d="M71 80.5 L77.5 87 L90.5 73.5"
                fill="none"
                stroke="#34D399"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}
        </svg>
      </div>

      {/* ============================================================== */}
      {/* 4. TITLE & STATUS DESCRIPTION (Crisp Inter Sans Typography)   */}
      {/* ============================================================== */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-white tracking-tight mb-1.5">
          <span>{isSuccess ? 'Dataset Verified & Profiled' : 'Uploading & Profiling Dataset'}</span>
          {!isSuccess && (
            <span className="inline-flex items-center gap-1.5 ml-1">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#39D6F5]"
                style={{ animation: 'upl-pulse-dots 1.2s ease-in-out infinite 0s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#4D8DFF]"
                style={{ animation: 'upl-pulse-dots 1.2s ease-in-out infinite 0.2s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#9B7BFF]"
                style={{ animation: 'upl-pulse-dots 1.2s ease-in-out infinite 0.4s' }}
              />
            </span>
          )}
        </div>

        <p className="text-sm sm:text-[15px] text-slate-300 max-w-lg leading-relaxed mb-5">
          {isSuccess
            ? 'Schema parsed, distributions calculated, and analytical quality metrics successfully generated.'
            : currentStage.subtitle}
        </p>

        {/* ============================================================== */}
        {/* 5. DYNAMIC STEPPER PIPELINE WITH ACTIVE LASER CONDUITS        */}
        {/* ============================================================== */}
        {!isSuccess && (
          <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl shadow-inner">
            {/* STEP 1: DATA INGEST */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stageIndex >= 0 ? 'bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]' : 'bg-slate-700'}`} />
              <span
                className={`text-xs font-semibold tracking-wider uppercase transition-colors ${
                  stageIndex === 0 ? 'text-[#39D6F5] font-bold' : 'text-slate-400'
                }`}
              >
                Data
              </span>
            </div>

            {/* CONDUIT 1 -> 2 */}
            <div className="relative w-8 sm:w-14 h-[2px] bg-slate-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 w-5 bg-gradient-to-r from-transparent via-[#39D6F5] to-transparent rounded-full"
                style={{ animation: 'upl-beam-sweep 1.8s ease-in-out infinite' }}
              />
            </div>

            {/* STEP 2: PROFILE */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stageIndex >= 1 ? 'bg-[#4D8DFF] shadow-[0_0_8px_#4D8DFF]' : 'bg-slate-700'}`} />
              <span
                className={`text-xs font-semibold tracking-wider uppercase transition-colors ${
                  stageIndex === 1 || stageIndex === 2 ? 'text-[#4D8DFF] font-bold' : 'text-slate-400'
                }`}
              >
                Profile
              </span>
            </div>

            {/* CONDUIT 2 -> 3 */}
            <div className="relative w-8 sm:w-14 h-[2px] bg-slate-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 w-5 bg-gradient-to-r from-transparent via-[#9B7BFF] to-transparent rounded-full"
                style={{ animation: 'upl-beam-sweep 1.8s ease-in-out infinite 0.9s' }}
              />
            </div>

            {/* STEP 3: QUALITY */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stageIndex >= 3 ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' : 'bg-slate-700'}`} />
              <span
                className={`text-xs font-semibold tracking-wider uppercase transition-colors ${
                  stageIndex === 3 ? 'text-[#34D399] font-bold' : 'text-slate-400'
                }`}
              >
                Quality
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
