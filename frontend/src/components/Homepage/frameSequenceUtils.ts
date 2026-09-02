/**
 * loadingSequence.ts
 * Utility constants and helpers for the canvas-based frame-sequence loader.
 * The 300 source frames live in /public/loading-sequence/ and are served
 * as static assets by Vite. They are NEVER bundled into the JS chunk.
 */

export const TOTAL_FRAMES = 300;

/** Target playback speed in frames-per-second */
export const PLAYBACK_FPS = 25;

/** Duration in ms to hold the final frame before the fade-out begins */
export const FINAL_HOLD_MS = 450;

/** Duration in ms of the fade-out transition to the homepage */
export const FADE_OUT_MS = 400;

/** Returns the public URL for a given 1-based frame index */
export function frameUrl(index: number): string {
  const padded = String(index).padStart(3, '0');
  return `/loading-sequence/frame-${padded}.jpg`;
}

/** Clamps a value between min and max (inclusive) */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
