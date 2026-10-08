import React, { useState, useRef, useEffect } from 'react';

type AccentColor = 'cyan' | 'blue' | 'purple' | 'emerald' | 'indigo' | 'amber' | 'default';

interface GlassCard3DProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  enableTilt?: boolean;
  enableReflection?: boolean;
  accentColor?: AccentColor;
  surfaceLevel?: 2 | 3;
}

const getAccentGradient = (accent: AccentColor, x: number, y: number) => {
  switch (accent) {
    case 'blue':
      return `radial-gradient(circle 280px at ${x}% ${y}%, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 40%, transparent 70%)`;
    case 'purple':
      return `radial-gradient(circle 280px at ${x}% ${y}%, rgba(168, 85, 247, 0.13) 0%, rgba(168, 85, 247, 0.04) 40%, transparent 70%)`;
    case 'emerald':
      return `radial-gradient(circle 280px at ${x}% ${y}%, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 70%)`;
    case 'indigo':
      return `radial-gradient(circle 280px at ${x}% ${y}%, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%)`;
    case 'amber':
      return `radial-gradient(circle 280px at ${x}% ${y}%, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 40%, transparent 70%)`;
    case 'cyan':
    case 'default':
    default:
      return `radial-gradient(circle 280px at ${x}% ${y}%, rgba(34, 211, 238, 0.11) 0%, rgba(59, 130, 246, 0.04) 40%, transparent 70%)`;
  }
};

const getHoverBorder = (accent: AccentColor) => {
  switch (accent) {
    case 'blue':
      return 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]';
    case 'purple':
      return 'border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]';
    case 'emerald':
      return 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
    case 'indigo':
      return 'border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.15)]';
    case 'amber':
      return 'border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]';
    case 'cyan':
    case 'default':
    default:
      return 'border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.16)]';
  }
};

export const GlassCard3D: React.FC<GlassCard3DProps> = ({
  children,
  className = '',
  enableTilt = false,
  enableReflection = true,
  accentColor = 'default',
  surfaceLevel = 3,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    setLightPos({ x: Math.round(xRatio * 100), y: Math.round(yRatio * 100) });

    if (enableTilt) {
      // Restrained to maximum ±1.0deg
      const rotY = (xRatio - 0.5) * 2.0;
      const rotX = (0.5 - yRatio) * 2.0;
      setRotate({ x: Math.min(1.0, Math.max(-1.0, rotX)), y: Math.min(1.0, Math.max(-1.0, rotY)) });
    }
  };

  const handleMouseEnter = () => {
    if (!prefersReducedMotion) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
    setLightPos({ x: 50, y: 50 });
  };

  const transformStyle = prefersReducedMotion
    ? undefined
    : {
        transform: isHovered
          ? enableTilt
            ? `perspective(1200px) rotateX(${rotate.x.toFixed(2)}deg) rotateY(${rotate.y.toFixed(2)}deg) translateY(-3px) translateZ(4px)`
            : 'translateY(-3px)'
          : 'translateY(0px)',
        transition: isHovered ? 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : 'transform 0.4s ease-out',
      };

  const surfaceBg = surfaceLevel === 3
    ? 'linear-gradient(180deg, rgba(10, 22, 42, 0.82) 0%, rgba(5, 12, 24, 0.88) 100%)'
    : 'linear-gradient(180deg, rgba(6, 14, 26, 0.72) 0%, rgba(3, 8, 18, 0.76) 100%)';

  const surfaceBorder = surfaceLevel === 3 ? 'border-white/[0.08]' : 'border-white/[0.06]';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...transformStyle,
        background: surfaceBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: isHovered
          ? '0 18px 44px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 0 20px rgba(255, 255, 255, 0.02)'
          : '0 8px 26px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        ['--mouse-x' as any]: `${lightPos.x}%`,
        ['--mouse-y' as any]: `${lightPos.y}%`,
      }}
      className={`relative rounded-2xl border ${surfaceBorder} transition-all duration-300 overflow-hidden ${
        isHovered ? getHoverBorder(accentColor) : ''
      } ${className}`}
      {...props}
    >
      {/* Moving glass reflection highlight on cursor hover */}
      {enableReflection && !prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.07), transparent 38%), ${getAccentGradient(accentColor, lightPos.x, lightPos.y)}`,
          }}
        />
      )}

      {/* Subtle diagonal light sweep on hover */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-transform duration-700 ease-out"
          style={{
            background: 'linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.035) 45%, transparent 60%)',
            transform: isHovered ? 'translateX(120%)' : 'translateX(-120%)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};


