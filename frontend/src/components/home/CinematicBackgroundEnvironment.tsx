import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DataTerrain } from './DataTerrain';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'ambient' | 'core' | 'terrain' | 'signal';
  baseOpacity: number;
  phase: number;
  depthPlane: 'distant' | 'mid' | 'foreground';
}

export const CinematicBackgroundEnvironment: React.FC = () => {
  const canvasDistantRef = useRef<HTMLCanvasElement>(null);
  const canvasForegroundRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 }); // Normalized 0-1

  // Track mouse for parallax (Desktop only)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Canvas Particles Rendering (Both Canvases)
  useEffect(() => {
    const cDist = canvasDistantRef.current;
    const cFore = canvasForegroundRef.current;
    if (!cDist || !cFore) return;
    
    const ctxDist = cDist.getContext('2d', { alpha: true });
    const ctxFore = cFore.getContext('2d', { alpha: true });
    if (!ctxDist || !ctxFore) return;

    let particles: Particle[] = [];
    let animationFrameId: number;

    const initParticles = () => {
      cDist.width = window.innerWidth;
      cDist.height = window.innerHeight;
      cFore.width = window.innerWidth;
      cFore.height = window.innerHeight;
      particles = [];

      const numParticles = window.innerWidth < 768 ? 50 : 120;
      for (let i = 0; i < numParticles; i++) {
        const typeRand = Math.random();
        let type: Particle['type'] = 'ambient';
        if (typeRand > 0.75) type = 'core';
        else if (typeRand > 0.55) type = 'terrain';
        else if (typeRand > 0.45) type = 'signal';

        const depthRand = Math.random();
        let depthPlane: Particle['depthPlane'] = 'distant';
        let size = 1;
        let baseOpacity = 0.2;

        if (depthRand > 0.8) {
          depthPlane = 'foreground';
          size = type === 'core' ? (Math.random() * 1.5 + 1.5) : (Math.random() * 1 + 2); // 2-3px
          baseOpacity = Math.random() > 0.7 ? 0.9 : 0.5; // Occasional strong glow
        } else if (depthRand > 0.4) {
          depthPlane = 'mid';
          size = Math.random() * 0.5 + 1.5; // 1.5-2px
          baseOpacity = 0.4;
        } else {
          depthPlane = 'distant';
          size = Math.random() * 0.5 + 1; // 1-1.5px
          baseOpacity = 0.15;
        }

        particles.push({
          x: Math.random() * cDist.width,
          y: Math.random() * cDist.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size,
          type,
          baseOpacity,
          phase: Math.random() * Math.PI * 2,
          depthPlane
        });
      }
    };

    const draw = (time: number) => {
      ctxDist.clearRect(0, 0, cDist.width, cDist.height);
      ctxFore.clearRect(0, 0, cFore.width, cFore.height);

      const coreX = cDist.width * 0.68; // 68%
      const coreY = cDist.height * 0.5;

      // Draw core energy radial rays (Z-7)
      ctxFore.save();
      ctxFore.translate(coreX, coreY);
      ctxFore.rotate(time * 0.0002);
      for (let i = 0; i < 12; i++) {
        ctxFore.rotate((Math.PI * 2) / 12);
        ctxFore.beginPath();
        ctxFore.moveTo(0, 50);
        ctxFore.lineTo(0, 150 + Math.sin(time * 0.002 + i) * 50);
        ctxFore.strokeStyle = `rgba(34, 211, 238, ${0.03 + Math.sin(time * 0.001 + i) * 0.02})`;
        ctxFore.lineWidth = 1;
        ctxFore.stroke();
      }
      ctxFore.restore();

      particles.forEach((p) => {
        // Update logic
        if (p.type === 'ambient') {
          p.x += p.vx * 0.5;
          p.y += p.vy * 0.5;
        } else if (p.type === 'core') {
          const dx = coreX - p.x;
          const dy = coreY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 80) {
            p.x += (dx / dist) * 0.3;
            p.y += (dy / dist) * 0.3;
          } else {
            p.x = Math.random() * cDist.width * 0.4; // respawn left side
            p.y = Math.random() * cDist.height;
          }
        } else if (p.type === 'terrain') {
          p.x += 1.2;
          p.y = cDist.height * 0.8 + Math.sin(p.x * 0.005 + time * 0.001) * 30;
          if (p.x > cDist.width) p.x = 0;
        } else if (p.type === 'signal') {
          p.x += (p.vx > 0 ? 1 : -1) * 2;
          p.y += (p.vy > 0 ? 1 : -1) * 0.5;
          if (p.x > cDist.width || p.x < 0) p.vx *= -1;
          if (p.y > cDist.height || p.y < 0) p.vy *= -1;
        }

        // Wrap ambient
        if (p.type === 'ambient') {
          if (p.x < 0) p.x = cDist.width;
          if (p.x > cDist.width) p.x = 0;
          if (p.y < 0) p.y = cDist.height;
          if (p.y > cDist.height) p.y = 0;
        }

        // Draw based on depth plane
        const parallaxMultiplier = p.depthPlane === 'foreground' ? 15 : p.depthPlane === 'mid' ? 8 : 2;
        const parallaxOffsetX = (0.5 - mousePos.x) * parallaxMultiplier;
        const parallaxOffsetY = (0.5 - mousePos.y) * parallaxMultiplier;

        const ctx = p.depthPlane === 'distant' ? ctxDist : ctxFore;

        ctx.beginPath();
        ctx.arc(p.x + parallaxOffsetX, p.y + parallaxOffsetY, p.size, 0, Math.PI * 2);
        
        const currentOpacity = p.baseOpacity * (0.8 + 0.2 * Math.sin(time * 0.002 + p.phase));
        
        // Don't make everything cyan - occasional violet or blue
        const color = p.phase > 5 ? '139, 92, 246' : p.phase > 4 ? '59, 130, 246' : '34, 211, 238';
        
        ctx.fillStyle = `rgba(${color}, ${currentOpacity})`;
        if (p.baseOpacity > 0.6) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${color}, 1)`;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', initParticles);
    initParticles();
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', initParticles);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mousePos]);

  // Parallax calculations
  const pX = (0.5 - mousePos.x); 
  const pY = (0.5 - mousePos.y);

  return (
    <motion.div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#02050A]"
      initial={{ scale: 1, x: 0, y: 0 }}
      animate={{
        scale: [1.00, 1.025, 1.00],
        x: [-5, 5, -5],
        y: [3, -3, 3]
      }}
      transition={{
        duration: 22, // 18-22s scale, 20-25s drift combined approx
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {/* =========================================
          Z-0: DEEP NAVY ATMOSPHERE 
          ========================================= */}
      <div className="absolute inset-0 bg-[#02050A]" />
      
      {/* =========================================
          Z-1: LARGE ATMOSPHERIC LIGHT FIELDS 
          ========================================= */}
      {/* Behind core: Cyan/Blue glow. Not a hard circle, very large. */}
      <motion.div 
        className="absolute top-1/2 left-[68%] -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 68% 50%, rgba(20,140,190,0.16) 0%, rgba(10,60,100,0.07) 35%, transparent 70%)',
          filter: 'blur(90px)',
          x: pX * 10, y: pY * 10
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Outer right: Subtle violet */}
      <motion.div 
        className="absolute top-[40%] left-[85%] -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(139,92,246,0.05) 0%, transparent 60%)',
          filter: 'blur(100px)',
          x: pX * 12, y: pY * 12
        }}
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Left side protection: keep it extremely dark / atmospheric */}
      <div className="absolute top-0 left-0 bottom-0 w-[40%] bg-gradient-to-r from-[#02050A] via-[#030812] to-transparent z-[1]" />

      {/* =========================================
          Z-2: TECHNICAL GRID 
          ========================================= */}
      <motion.div 
        className="absolute inset-0 z-[2]"
        style={{ x: pX * 2, y: pY * 2 }} // Grid: 2px parallax
      >
        {/* Primary Grid 65px */}
        <div className="absolute inset-0 opacity-[0.045]" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)', backgroundSize: '65px 65px' }} />
        {/* Micro Grid 22px */}
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        
        {/* Occasional horizontal/vertical traces */}
        <div className="absolute top-[30%] left-0 right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[rgba(34,211,238,0.2)] to-transparent" />
        <div className="absolute top-0 bottom-[10%] left-[68%] w-[1px] bg-gradient-to-b from-transparent via-[rgba(34,211,238,0.15)] to-transparent" />

        {/* Mask to fade upper-left (Left Side Protection) and increase on right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(0,0,0,0)_10%,rgba(2,5,10,0.95)_90%)]" />
      </motion.div>

      {/* =========================================
          Z-3: DISTANT PARTICLES & SIGNAL NETWORK 
          ========================================= */}
      <div className="absolute inset-0 z-[3]">
        {/* Canvas 1: Distant particles */}
        <canvas ref={canvasDistantRef} className="absolute inset-0 w-full h-full" />
        
        {/* Distant Signal Network (Faint curves) */}
        <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
          <path d="M 100 100 Q 300 50, 500 300 T 900 150" fill="none" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="0.5" />
          <path d="M 0 600 Q 400 400, 800 500 T 1600 300" fill="none" stroke="rgba(139, 92, 246, 0.15)" strokeWidth="0.5" />
          
          {/* Signal pulses */}
          <motion.circle cx="100" cy="100" r="1.5" fill="#22D3EE" opacity="0.6" animate={{ cx: [100, 500, 900], cy: [100, 300, 150] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
          <motion.circle cx="0" cy="600" r="1.5" fill="#8B5CF6" opacity="0.6" animate={{ cx: [0, 800, 1600], cy: [600, 500, 300] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear', delay: 2 }} />
          
          {/* Static Nodes */}
          <circle cx="500" cy="300" r="2" fill="rgba(34, 211, 238, 0.4)" />
          <circle cx="900" cy="150" r="2.5" fill="rgba(34, 211, 238, 0.5)" />
          <circle cx="800" cy="500" r="2" fill="rgba(139, 92, 246, 0.4)" />
        </svg>
      </div>

      {/* =========================================
          Z-4: LARGE ORBITAL GEOMETRY 
          ========================================= */}
      <motion.div 
        className="absolute top-1/2 left-[68%] w-[1200px] h-[1200px] -translate-x-1/2 -translate-y-1/2 z-[4]"
        style={{ x: pX * 7, y: pY * 7 }} // 7px parallax
      >
        {/* Protection: Ensure opacity is low so it blends */}
        <svg viewBox="0 0 1200 1200" className="w-full h-full opacity-[0.10]">
          {/* Outer dashed arc rotating clockwise */}
          <motion.g animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} style={{ originX: '50%', originY: '50%' }}>
            <circle cx="600" cy="600" r="580" fill="none" stroke="#22D3EE" strokeWidth="1" strokeDasharray="15 40" />
            {/* Technical markers */}
            <line x1="600" y1="0" x2="600" y2="20" stroke="#3B82F6" strokeWidth="2" />
            <line x1="600" y1="1180" x2="600" y2="1200" stroke="#3B82F6" strokeWidth="2" />
          </motion.g>
          
          {/* Inner dotted arc rotating counter-clockwise */}
          <motion.g animate={{ rotate: -360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} style={{ originX: '50%', originY: '50%' }}>
            <circle cx="600" cy="600" r="480" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="4 16" />
            <circle cx="600" cy="600" r="450" fill="none" stroke="#22D3EE" strokeWidth="0.5" strokeDasharray="100 50 20 50" />
            {/* Radial ticks */}
            {Array.from({length: 72}).map((_, i) => (
              <line key={i} x1="600" y1="120" x2="600" y2="128" stroke="#67E8F9" strokeWidth="1" transform={`rotate(${i * 5} 600 600)`} />
            ))}
          </motion.g>
        </svg>
      </motion.div>

      {/* =========================================
          Z-5: PERSPECTIVE FLOOR 
          ========================================= */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 h-[40%] origin-bottom z-[5]"
        style={{ x: pX * 4, y: pY * 4 }}
      >
        <svg viewBox="0 0 1600 400" preserveAspectRatio="none" className="w-full h-full opacity-[0.08]">
          <defs>
            <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="40%" stopColor="rgba(34,211,238,0.15)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.03)" />
            </linearGradient>
          </defs>
          <path d="M 0 0 L 1600 0 L 1600 400 L 0 400 Z" fill="url(#floorFade)" />
          
          {/* Lines converging towards intelligence core (~68% width -> x=1088) */}
          <g stroke="rgba(34,211,238,0.6)" strokeWidth="1">
            {Array.from({ length: 45 }).map((_, i) => {
              const startX = 1088; 
              const startY = -150; // virtual horizon
              const endX = (i - 22) * 140 + 800; // spread along bottom
              const endY = 400;
              return <line key={i} x1={startX} y1={startY} x2={endX} y2={endY} />;
            })}
          </g>
          {/* Horizontal perspective lines */}
          <g stroke="rgba(34,211,238,0.4)" strokeWidth="1">
            {Array.from({ length: 18 }).map((_, i) => {
              const yPos = 400 - Math.pow(i, 1.7) * 4;
              if (yPos > 0) return <line key={i} x1="0" y1={yPos} x2="1600" y2={yPos} />;
              return null;
            })}
          </g>
        </svg>
      </motion.div>

      {/* =========================================
          Z-6: DATA TERRAIN 
          ========================================= */}
      <DataTerrain />

      {/* =========================================
          Z-7: CORE ENERGY FIELD & FOREGROUND PARTICLES
          ========================================= */}
      <div className="absolute inset-0 z-[7] pointer-events-none">
        
        {/* Core Blooms (400-600px) */}
        <motion.div 
          className="absolute top-1/2 left-[68%] -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full"
          style={{ background: 'radial-gradient(circle at center, rgba(34,211,238,0.12) 0%, rgba(59,130,246,0.05) 40%, transparent 70%)', filter: 'blur(40px)' }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Vertical Data Streams (Rising from terrain to core) */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({length: 18}).map((_, i) => {
            const xPos = 45 + Math.random() * 45; // 45% to 90% (right side dense)
            const h = 80 + Math.random() * 220; // 80-300px
            const isBright = Math.random() > 0.8;
            return (
              <motion.div 
                key={i} 
                className={`absolute w-[1px] bottom-[20%] ${isBright ? 'bg-gradient-to-t from-transparent via-[#67E8F9] to-transparent shadow-[0_0_8px_#67E8F9]' : 'bg-gradient-to-t from-transparent via-[#22D3EE] to-transparent'}`}
                style={{ 
                  left: `${xPos}%`,
                  height: `${h}px`,
                  opacity: isBright ? 0.6 : 0.2
                }}
                animate={{ 
                  opacity: [0, isBright ? 0.8 : 0.3, 0],
                  y: [0, -150 - Math.random() * 100]
                }}
                transition={{ 
                  duration: 3 + Math.random() * 4,
                  repeat: Infinity,
                  delay: Math.random() * 6,
                  ease: 'easeInOut'
                }}
              />
            );
          })}
        </div>

        {/* Canvas 2: Midground & Foreground Particles + Core Rays */}
        <canvas ref={canvasForegroundRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* =========================================
          HORIZONTAL SCAN (System scan)
          ========================================= */}
      <motion.div 
        className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[rgba(34,211,238,0.05)] to-transparent z-[8] shadow-[0_0_4px_rgba(34,211,238,0.08)] pointer-events-none"
        animate={{ y: ['-5vh', '105vh'] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      />

    </motion.div>
  );
};
