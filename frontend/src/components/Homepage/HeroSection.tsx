import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Activity, Cpu, Database, Radar, TrendingUp } from 'lucide-react';

export const HeroSection: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mouse position for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for mouse position
  const springConfig = { damping: 30, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Layer Transforms
  const bgTransformX = useTransform(smoothX, [-0.5, 0.5], [-10, 10]);
  const bgTransformY = useTransform(smoothY, [-0.5, 0.5], [-10, 10]);
  
  const midTransformX = useTransform(smoothX, [-0.5, 0.5], [-25, 25]);
  const midTransformY = useTransform(smoothY, [-0.5, 0.5], [-25, 25]);

  const fgTransformX = useTransform(smoothX, [-0.5, 0.5], [-50, 50]);
  const fgTransformY = useTransform(smoothY, [-0.5, 0.5], [-50, 50]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen flex items-center pt-24 pb-0 overflow-hidden bg-navy-black"
    >
      {/* BACKGROUND LAYER: Deep Grid and Ambient Energy */}
      <motion.div 
        style={{ x: bgTransformX, y: bgTransformY }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <div className="absolute top-[40%] right-[10%] w-[1200px] h-[1200px] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08)_0%,transparent_60%)] rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGF0aCBkPSJNMCAwaDYwdjYwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDE1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </motion.div>
      
      <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* LEFT COMPOSITION (50%) */}
        <div className="max-w-xl z-20">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-navy-panel/80 backdrop-blur-md mb-10 shadow-xl"
          >
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <div className="absolute w-full h-full rounded-full bg-accent-cyan opacity-60 animate-ping" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase">
              <span className="text-slate-300">Intelligence Engine Online</span>
              <span className="text-slate-600">/</span>
              <span className="text-accent-cyan font-bold">Real-Time</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="text-5xl lg:text-[76px] font-display font-bold text-white leading-[1.05] mb-8 tracking-tight"
          >
            Turn Data Into <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-violet pb-2 inline-block">
              Intelligent Decisions.
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="text-lg text-slate-400 mb-12 leading-relaxed max-w-lg font-sans pr-4"
          >
            Most analytics stop at explaining what happened. InsightFlow AI helps you understand what matters, decide what to do next, and measure whether that decision actually worked.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="flex flex-col sm:flex-row gap-5"
          >
            <button
              onClick={onLaunch}
              className="relative overflow-hidden flex items-center justify-center gap-3 bg-gradient-to-r from-accent-cyan to-accent-blue text-navy-black px-9 py-4 rounded-xl font-bold transition-all group hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] hover:-translate-y-1"
            >
              {/* Light Sweep */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" />
              <span className="relative z-10 text-[15px]">Explore InsightFlow</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="#how-it-works"
              className="flex items-center justify-center gap-2 px-9 py-4 rounded-xl font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            >
              See How It Works
            </a>
          </motion.div>
        </div>

        {/* RIGHT VISUALIZATION (50% - SCALED UP) */}
        <div className="relative h-[800px] flex items-center justify-center lg:justify-end">
          
          {/* MIDGROUND LAYER: Orbits and Paths */}
          <motion.div 
            style={{ x: midTransformX, y: midTransformY }}
            className="absolute inset-0 flex items-center justify-center lg:justify-end z-10 pointer-events-none"
          >
            <div className="relative w-[700px] h-[700px] flex items-center justify-center opacity-70">
              <motion.div
                className="absolute w-[400px] h-[400px] rounded-full border border-accent-blue/10"
                animate={{ rotate: 180 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute w-[600px] h-[600px] rounded-full border border-dashed border-accent-violet/10"
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              />
              
              {/* Data connections rendering beneath foreground */}
              {[
                { angle: -145 }, { angle: -180 }, { angle: 145 },
                { angle: -35 }, { angle: 0 }, { angle: 35 }
              ].map((node, i) => (
                <ConnectionLine key={i} angle={node.angle} delay={1.5 + (i * 0.1)} />
              ))}
            </div>
          </motion.div>

          {/* FOREGROUND LAYER: Intelligence Core & Floating Panels */}
          <motion.div 
            style={{ x: fgTransformX, y: fgTransformY }}
            className="relative w-[700px] h-[700px] flex items-center justify-center z-30"
          >
            {/* The Massive Insight Engine Core */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.8, type: "spring", damping: 20 }}
              className="absolute bg-navy-panel/90 backdrop-blur-2xl border border-accent-cyan/50 rounded-full flex flex-col items-center justify-center shadow-[0_0_100px_rgba(34,211,238,0.2)] group hover:border-accent-cyan hover:shadow-[0_0_120px_rgba(34,211,238,0.4)] transition-all duration-700 w-48 h-48"
            >
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.15)_0%,transparent_70%)]" />
              <Cpu className="w-10 h-10 text-accent-cyan mb-3 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <span className="text-xs font-mono text-white font-bold tracking-widest text-center leading-tight">INSIGHT<br/>ENGINE</span>
            </motion.div>

            {/* Input Nodes (Left) */}
            {[
              { icon: Database, label: 'DATA', angle: -145, delay: 1.2 },
              { icon: Radar, label: 'SIGNALS', angle: -180, delay: 1.3 },
              { icon: Activity, label: 'ANOMALIES', angle: 145, delay: 1.4 }
            ].map((node, i) => (
              <VisualNode key={i} {...node} isInput={true} />
            ))}

            {/* Output Nodes (Right) */}
            {[
              { icon: TrendingUp, label: 'INSIGHTS', angle: -35, delay: 1.5 },
              { icon: Cpu, label: 'RECOMMENDATIONS', angle: 0, delay: 1.6 },
              { icon: ArrowRight, label: 'ACTIONS', angle: 35, delay: 1.7 }
            ].map((node, i) => (
              <VisualNode key={i} {...node} isInput={false} />
            ))}
            
            {/* Massive Floating Analytical Panels */}
            <FloatingPanel 
              title="PATTERN DETECTED" 
              value="+24.8%" 
              color="text-accent-cyan" 
              position={{ top: '15%', left: '5%' }} 
              delay={2.0} 
            />
            <FloatingPanel 
              title="MODEL CONFIDENCE" 
              value="94.7%" 
              color="text-accent-violet" 
              position={{ bottom: '15%', left: '0%' }} 
              delay={2.2} 
            />
            <FloatingPanel 
              title="DECISION STATUS" 
              value="READY" 
              color="text-accent-blue" 
              position={{ top: '25%', right: '5%' }} 
              delay={2.4} 
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Sub-components mapped for scale

const FloatingPanel = ({ title, value, color, position, delay }: { title: string, value: string, color: string, position: React.CSSProperties, delay: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
    transition={{ duration: 1, delay, type: 'spring' }}
    className="absolute bg-navy-panel/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl pointer-events-none"
    style={position}
  >
    <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-2">{title}</div>
    <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
  </motion.div>
);

const VisualNode = ({ icon: Icon, label, angle, delay, isInput }: { icon: any, label: string, angle: number, delay: number, isInput: boolean }) => {
  const distance = 280; // Scaled up distance
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * distance;
  const y = Math.sin(rad) * distance;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay, type: "spring" }}
      className={`absolute top-1/2 left-1/2 w-32 h-14 -ml-16 -mt-7 rounded-xl flex items-center justify-center gap-2.5 z-20 shadow-xl ${isInput ? 'bg-navy-dark border border-white/5' : 'bg-navy-panel border border-accent-cyan/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]'}`}
      style={{ x, y }}
    >
      <Icon className={`w-4 h-4 ${isInput ? 'text-slate-400' : 'text-accent-cyan'}`} />
      <span className={`text-[10px] font-mono font-bold tracking-wider ${isInput ? 'text-slate-300' : 'text-accent-cyan'}`}>{label}</span>
    </motion.div>
  );
};

const ConnectionLine = ({ angle, delay }: { angle: number, delay: number }) => {
  const distance = 280;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * distance;
  const y = Math.sin(rad) * distance;
  const isInput = angle < -90 || angle > 90;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      <motion.line
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: isInput ? 0.2 : 0.4 }}
        transition={{ duration: 1.5, delay }}
        x1="50%" y1="50%"
        x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
        stroke={isInput ? "#9BA8C0" : "#22D3EE"}
        strokeWidth={isInput ? "1" : "2"}
        strokeDasharray={isInput ? "4 4" : "none"}
      />
      {/* Traveling particle - direction depends on input vs output */}
      <motion.circle
        r={isInput ? "2.5" : "3.5"}
        fill={isInput ? "#3B82F6" : "#fff"}
        initial={{ 
          cx: isInput ? `calc(50% + ${x}px)` : "50%", 
          cy: isInput ? `calc(50% + ${y}px)` : "50%", 
          opacity: 0 
        }}
        animate={{ 
          cx: isInput ? "50%" : `calc(50% + ${x}px)`, 
          cy: isInput ? "50%" : `calc(50% + ${y}px)`, 
          opacity: [0, 1, 0] 
        }}
        transition={{ duration: 2.5, delay: delay + 0.5, repeat: Infinity, ease: "easeInOut" }}
        style={!isInput ? { filter: 'drop-shadow(0 0 5px #22D3EE)' } : {}}
      />
    </svg>
  );
};

export default HeroSection;
