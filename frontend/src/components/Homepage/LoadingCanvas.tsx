/**
 * LoadingCanvas.tsx
 *
 * Renders the 300-frame InsightFlow AI cinematic loading sequence on a single
 * HTML5 Canvas using requestAnimationFrame with elapsed-time frame selection.
 *
 * Architecture
 * ────────────
 *  1. Preload phase  – decode all frames via Image() before playback starts.
 *  2. Play phase     – rAF loop draws the correct frame based on elapsed time.
 *  3. Hold phase     – final frame is held for FINAL_HOLD_MS.
 *  4. Fade phase     – canvas opacity is reduced to 0 over FADE_OUT_MS.
 *  5. Complete       – onComplete() is called exactly once.
 *
 * The canvas always preserves the 16:9 source aspect ratio (object-fit:contain
 * behaviour) and never stretches or crops frames.
 *
 * Reduced-motion preference: skips directly to the final frame, holds it
 * briefly, then calls onComplete.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  clamp,
  FADE_OUT_MS,
  FINAL_HOLD_MS,
  frameUrl,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
} from './frameSequenceUtils';

/* ─── types ──────────────────────────────────────────────────────────────── */

type Phase = 'preload' | 'play' | 'hold' | 'fade' | 'done';

interface Props {
  onComplete: () => void;
}

/* ─── constants ──────────────────────────────────────────────────────────── */

const FRAME_DURATION_MS = 1000 / PLAYBACK_FPS;   // ms per frame
const SOURCE_W = 1280;
const SOURCE_H = 720;
const ASPECT   = SOURCE_W / SOURCE_H;             // 16/9

/* ─── component ─────────────────────────────────────────────────────────── */

const LoadingCanvas: React.FC<Props> = ({ onComplete }) => {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const imagesRef      = useRef<HTMLImageElement[]>([]);
  const rafRef         = useRef<number>(0);
  const completedRef   = useRef(false);           // guard: call onComplete once
  const phaseRef       = useRef<Phase>('preload');
  const playStartRef   = useRef(0);               // timestamp when play began
  const holdStartRef   = useRef(0);               // timestamp when hold began
  const fadeStartRef   = useRef(0);               // timestamp when fade began
  const currentFrameRef = useRef(0);              // last drawn frame index

  const [phase, setPhase]             = useState<Phase>('preload');
  const [loadedCount, setLoadedCount] = useState(0);
  const [canvasOpacity, setCanvasOpacity] = useState(1);

  /* ── check reduced-motion preference ──────────────────────────────────── */
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── safe completion guard ─────────────────────────────────────────────── */
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onComplete();
  }, [onComplete]);

  /* ── draw a single frame onto the canvas ──────────────────────────────── */
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img    = imagesRef.current[index];
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Letterbox / pillarbox to maintain 16:9 inside the canvas viewport
    const cw = canvas.width;
    const ch = canvas.height;
    const canvasAspect = cw / ch;

    let drawW: number, drawH: number, dx: number, dy: number;
    if (canvasAspect >= ASPECT) {
      // canvas is wider than 16:9 → letterbox left/right
      drawH = ch;
      drawW = ch * ASPECT;
      dx    = (cw - drawW) / 2;
      dy    = 0;
    } else {
      // canvas is taller than 16:9 → pillarbox top/bottom
      drawW = cw;
      drawH = cw / ASPECT;
      dx    = 0;
      dy    = (ch - drawH) / 2;
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    currentFrameRef.current = index;
  }, []);

  /* ── resize the canvas to fill the viewport ───────────────────────────── */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    drawFrame(currentFrameRef.current);   // redraw after resize
  }, [drawFrame]);

  /* ── main rAF loop ─────────────────────────────────────────────────────── */
  const loop = useCallback((timestamp: number) => {
    const phase = phaseRef.current;

    if (phase === 'play') {
      if (playStartRef.current === 0) playStartRef.current = timestamp;

      const elapsed  = timestamp - playStartRef.current;
      const frameIdx = clamp(
        Math.floor(elapsed / FRAME_DURATION_MS),
        0,
        TOTAL_FRAMES - 1,
      );
      drawFrame(frameIdx);

      if (frameIdx >= TOTAL_FRAMES - 1) {
        // Reached final frame → enter hold
        phaseRef.current = 'hold';
        holdStartRef.current = timestamp;
        setPhase('hold');
      }

    } else if (phase === 'hold') {
      const elapsed = timestamp - holdStartRef.current;
      if (elapsed >= FINAL_HOLD_MS) {
        // Hold complete → start fade
        phaseRef.current = 'fade';
        fadeStartRef.current = timestamp;
        setPhase('fade');
      }

    } else if (phase === 'fade') {
      const elapsed  = timestamp - fadeStartRef.current;
      const progress = clamp(elapsed / FADE_OUT_MS, 0, 1);
      setCanvasOpacity(1 - progress);

      if (progress >= 1) {
        phaseRef.current = 'done';
        setPhase('done');
        finish();
        return;   // stop rAF
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [drawFrame, finish]);

  /* ── start playback (called once preload is done) ─────────────────────── */
  const startPlayback = useCallback(() => {
    phaseRef.current   = 'play';
    playStartRef.current = 0;
    setPhase('play');
    rafRef.current = requestAnimationFrame(loop);

    // Defensive: even if rAF somehow stalls, complete after max possible time
    const maxMs = TOTAL_FRAMES * FRAME_DURATION_MS + FINAL_HOLD_MS + FADE_OUT_MS + 2000;
    const safeTimer = setTimeout(finish, maxMs);
    return () => clearTimeout(safeTimer);
  }, [loop, finish]);

  /* ── preload pipeline ─────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    imagesRef.current = images;
    let loaded = 0;

    const onLoad = () => {
      if (cancelled) return;
      loaded++;
      setLoadedCount(loaded);
      if (loaded === TOTAL_FRAMES) {
        startPlayback();
      }
    };

    // If reduced-motion: just show the final frame then complete
    if (prefersReducedMotion) {
      const lastImg = new Image();
      lastImg.onload = () => {
        if (cancelled) return;
        imagesRef.current = Array(TOTAL_FRAMES).fill(lastImg);
        drawFrame(TOTAL_FRAMES - 1);
        setTimeout(finish, 600);
      };
      lastImg.src = frameUrl(TOTAL_FRAMES);
      return () => { cancelled = true; };
    }

    // Normal: preload all frames
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.onload  = onLoad;
      img.onerror = onLoad;  // count errors so we don't stall forever
      img.src     = frameUrl(i + 1);   // frameUrl is 1-based
      images[i]   = img;
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── resize listener ──────────────────────────────────────────────────── */
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(rafRef.current);
    };
  }, [resizeCanvas]);

  /* ── render ───────────────────────────────────────────────────────────── */
  const preloadProgress = Math.round((loadedCount / TOTAL_FRAMES) * 100);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#02050A] flex items-center justify-center"
      role="status"
      aria-label="InsightFlow AI is initializing its decision intelligence environment."
    >
      {/* The single canvas that renders all frames */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          opacity: canvasOpacity,
          transition: phase === 'fade' ? 'none' : undefined, // rAF drives opacity during fade
          display: phase === 'preload' ? 'none' : 'block',
        }}
        aria-hidden="true"
      />

      {/* Preload screen — shown only while frames decode */}
      {phase === 'preload' && (
        <div className="relative z-10 flex flex-col items-center justify-center select-none pointer-events-none">
          {/* Logo mark */}
          <svg
            viewBox="0 0 100 100"
            className="w-12 h-12 mb-6 text-[#67E8F9]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 20 L80 20 L50 80 Z"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinejoin="round"
              fill="rgba(34,211,238,0.15)"
            />
            <path d="M30 35 L70 35 L50 70 Z" fill="currentColor" />
          </svg>

          <p
            className="text-white text-sm tracking-[0.3em] font-semibold uppercase mb-1"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            INSIGHTFLOW AI
          </p>
          <p className="text-slate-400 text-xs tracking-widest uppercase mb-8 font-mono">
            Loading Intelligence Environment
          </p>

          {/* Thin progress track */}
          <div className="w-64 h-[2px] bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#22D3EE] rounded-full transition-all duration-100"
              style={{
                width: `${preloadProgress}%`,
                boxShadow: '0 0 8px rgba(34,211,238,0.8)',
              }}
            />
          </div>
          <p className="text-slate-500 text-[10px] font-mono mt-3 tracking-widest">
            {preloadProgress}%
          </p>
        </div>
      )}
    </div>
  );
};

export default LoadingCanvas;
