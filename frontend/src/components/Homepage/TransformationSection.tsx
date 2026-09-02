import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, Variants } from 'framer-motion';
import { Database, ScanSearch, Cpu, Target } from 'lucide-react';

type FlowStep = 
  | 'data'
  | 'data-to-analysis'
  | 'analysis'
  | 'analysis-to-intelligence'
  | 'intelligence'
  | 'intelligence-to-decision'
  | 'decision'
  | 'idle';

const stages = [
  { id: 'data', icon: Database, label: 'RAW DATA', title: 'Collecting data from', subtitle: 'multiple sources', color: '#22D3EE', next: 'analysis' },
  { id: 'analysis', icon: ScanSearch, label: 'ANALYSIS', title: 'Processing and discovering', subtitle: 'patterns that matter', color: '#38BDF8', next: 'intelligence' },
  { id: 'intelligence', icon: Cpu, label: 'INTELLIGENCE', title: 'AI models turn insights', subtitle: 'into intelligence', color: '#3B82F6', next: 'decision' },
  { id: 'decision', icon: Target, label: 'DECISION', title: 'Intelligent decisions drive', subtitle: 'growth and outcomes', color: '#8B5CF6', next: null },
];

export const TransformationSection: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState<FlowStep>('idle');

  // Central Animation Controller (8.0s precise cinematic cycle)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const sequence: { step: FlowStep; duration: number }[] = [
      { step: 'data', duration: 800 },
      { step: 'data-to-analysis', duration: 1300 },
      { step: 'analysis', duration: 700 },
      { step: 'analysis-to-intelligence', duration: 1300 },
      { step: 'intelligence', duration: 700 },
      { step: 'intelligence-to-decision', duration: 1400 },
      { step: 'decision', duration: 800 },
      { step: 'idle', duration: 1000 },
    ];

    let currentStepIdx = 0;

    const tick = () => {
      if (!isMounted) return;
      setActiveStep(sequence[currentStepIdx].step);
      timeoutId = setTimeout(tick, sequence[currentStepIdx].duration);
      currentStepIdx = (currentStepIdx + 1) % sequence.length;
    };

    tick();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, duration: 1 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  };

  return (
    <section id="decision-flow" className="relative w-full overflow-hidden bg-transparent py-32 flex flex-col items-center justify-center min-h-[900px] border-t border-b border-white/5">
      
      {!prefersReducedMotion && <BackgroundParticles activeStep={activeStep} />}

      {/* Global CSS for directional chevrons */}
      <style>{`
        @keyframes chevron-pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.8; filter: drop-shadow(0 0 4px currentColor); }
        }
        .chev-1 { animation: chevron-pulse 1.2s infinite 0s; }
        .chev-2 { animation: chevron-pulse 1.2s infinite 0.2s; }
        .chev-3 { animation: chevron-pulse 1.2s infinite 0.4s; }
      `}</style>

      <motion.div
        className="relative z-10 w-full max-w-[1440px] mx-auto px-6 flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.div variants={itemVariants} className="text-center mb-24 z-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#F5F7FA] tracking-tight mb-4" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Business data tells you what happened.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#22D3EE] via-[#3B82F6] to-[#8B5CF6] filter drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]">
              InsightFlow decides what happens next.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-base md:text-lg mt-4 max-w-2xl mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
            From raw data to intelligent decisions — in one continuous flow.
          </p>
        </motion.div>

        <div className="relative w-full flex flex-col lg:flex-row items-center justify-between lg:justify-center mt-8">
          
          <div className="hidden lg:block absolute left-[50%] lg:left-[70%] top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
             <IntelligenceBackdrop activeStep={activeStep} prefersReducedMotion={!!prefersReducedMotion} />
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center w-full max-w-[1200px] relative z-10">
            {stages.map((stage, index) => {
              const isProcessing = activeStep === stage.id;
              // Card remains in transmitting state while packet exits
              const isTransmitting = activeStep === `${stage.id}-to-${stage.next}`;
              // Only one dominant state
              const status = isProcessing ? 'processing' : isTransmitting ? 'transmitting' : 'idle';

              return (
                <React.Fragment key={stage.id}>
                  <StageModule 
                    stage={stage} 
                    index={index} 
                    status={status}
                    prefersReducedMotion={!!prefersReducedMotion} 
                  />
                  
                  {stage.next && (
                    <FlowConnector 
                      fromId={stage.id}
                      fromColor={stage.color} 
                      toColor={stages[index + 1].color} 
                      isTransmitting={isTransmitting}
                      prefersReducedMotion={!!prefersReducedMotion} 
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
};

// ─── STAGE MODULE (Holographic HUD) ──────────────────────────────────────────
interface StageModuleProps {
  stage: any;
  index: number;
  status: 'idle' | 'processing' | 'transmitting';
  prefersReducedMotion: boolean;
}

const StageModule: React.FC<StageModuleProps> = ({ stage, index, status, prefersReducedMotion }) => {
  const Icon = stage.icon;
  const isIdle = status === 'idle';
  const isProcessing = status === 'processing';
  const isTransmitting = status === 'transmitting';

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: 'easeOut' } }
      }}
      className="relative z-10 flex flex-col items-center group w-full lg:w-[200px]" // increased width slightly for balance
    >
      {/* Arrival Pulse Layer - Triggers ONLY when entering 'processing' */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-[24px] z-0 pointer-events-none"
          style={{ background: stage.color }}
          initial={{ scale: 1, opacity: 0 }}
          animate={isProcessing ? { scale: [1, 1.4, 1.6], opacity: [0, 0.4, 0] } : { scale: 1, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }} // 350-500ms equivalent visual punch
        />
      )}

      {/* Main Glassmorphism Panel */}
      <motion.div
        initial={false}
        animate={prefersReducedMotion ? {} : { 
          scale: isProcessing ? [1, 1.025, 1] : 1, // Specific arrival scale pulse
          opacity: isIdle ? 0.7 : 1,
          borderColor: isIdle ? `rgba(34, 211, 238, 0.15)` : `${stage.color}A0`,
          boxShadow: isIdle 
            ? `0 0 10px ${stage.color}00, inset 0 0 5px ${stage.color}00` 
            : `0 0 40px ${stage.color}50, inset 0 0 25px ${stage.color}30`
        }}
        transition={{ 
          scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }, 
          opacity: { duration: 0.4 }, 
          borderColor: { duration: 0.4 }, 
          boxShadow: { duration: 0.4 } 
        }}
        className="relative z-10 w-[160px] h-[160px] lg:w-[180px] lg:h-[180px] rounded-[24px] flex flex-col items-center justify-center transition-all duration-300"
        style={{
          background: 'rgba(4, 12, 25, 0.50)', 
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full border border-white/20 flex items-center justify-center bg-[#02050A]/60">
          <span className="text-[#94A3B8] text-[9px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>0{index + 1}</span>
        </div>
        
        <div className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/30" />
        <div className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/30" />

        {/* Central Icon Area */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <motion.div
            initial={false}
            animate={prefersReducedMotion ? {} : { 
              filter: isIdle ? `drop-shadow(0 0 2px ${stage.color}30)` : `drop-shadow(0 0 18px ${stage.color}) drop-shadow(0 0 30px ${stage.color})`
            }}
            transition={{ duration: 0.4 }}
          >
            <Icon size={48} color={isIdle ? '#64748B' : stage.color} strokeWidth={isIdle ? 1.5 : 2} className="transition-colors duration-300" />
          </motion.div>
          
          {/* Internal Processing Micro-animations */}
          {!prefersReducedMotion && (isProcessing || isTransmitting) && (
            <MicroAnimations index={index} color={stage.color} />
          )}
        </div>
      </motion.div>

      <div className="mt-6 text-center">
        <motion.h3 
          initial={false}
          className="font-bold text-[15px] uppercase tracking-[0.2em] mb-2"
          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          animate={{ color: isIdle ? '#64748B' : stage.color }}
          transition={{ duration: 0.4 }}
        >
          {stage.label}
        </motion.h3>
        <p className="text-[#94A3B8] text-[12px] leading-relaxed max-w-[160px] mx-auto" style={{ fontFamily: '"Inter", sans-serif' }}>
          {stage.title}<br/>{stage.subtitle}
        </p>
      </div>
    </motion.div>
  );
};

// ─── MICRO ANIMATIONS (Only rendered when active) ──────────────────────────────
const MicroAnimations: React.FC<{ index: number, color: string }> = ({ index, color }) => {
  if (index === 0) {
    return (
      <div className="absolute top-[-35px] left-1/2 -translate-x-1/2 w-[40px] h-[35px] overflow-hidden pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute bottom-0 w-[3px] h-[8px] rounded-full"
            style={{ background: color, left: 10 + i * 10, boxShadow: `0 0 8px ${color}` }}
            animate={{ y: [0, -40], opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2, ease: 'easeOut' }}
          />
        ))}
      </div>
    );
  }
  if (index === 1) {
    return (
      <>
        <motion.div
          className="absolute inset-[-20px] border-2 border-dashed rounded-full pointer-events-none"
          style={{ borderColor: `${color}80` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[-20px] rounded-full pointer-events-none"
          style={{ border: `2px solid ${color}` }}
          animate={{ scale: [1, 1.25], opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeOut' }}
        />
      </>
    );
  }
  if (index === 2) {
    return (
      <>
        <motion.div
          className="absolute inset-[-22px] rounded-full border-2 pointer-events-none"
          style={{ borderColor: `${color}90` }}
          animate={{ scale: [1, 1.35], opacity: [0.9, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.div
           className="absolute inset-0 rounded-full"
           style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
           animate={{ opacity: [0.6, 0], scale: [1, 1.6] }}
           transition={{ duration: 0.8, repeat: Infinity, ease: 'easeOut' }}
        />
      </>
    );
  }
  if (index === 3) {
    return (
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 80%)` }}
        animate={{ scale: [1, 1.8], opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeOut' }}
      />
    );
  }
  return null;
};

// ─── MASSIVE ENERGY FLOW CONNECTOR ───────────────────────────────────────────
const FlowConnector: React.FC<{ fromId: string, fromColor: string, toColor: string, isTransmitting: boolean, prefersReducedMotion: boolean }> = ({ fromId, fromColor, toColor, isTransmitting, prefersReducedMotion }) => {
  
  // Base duration is derived from the step duration (approx 1.2s - 1.4s)
  const durationStr = fromId === 'intelligence' ? '1.4s' : '1.3s';

  return (
    // -mx-4 to physically overlap the cards so the signal exits FROM WITHIN the card boundary
    <div className="flex-1 w-full lg:w-auto h-[100px] lg:h-[60px] flex items-center justify-center my-4 lg:my-0 lg:-mt-16 relative z-0 min-w-[80px] -mx-4 opacity-100">
      
      {/* Desktop Horizontal Connecting Line */}
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="hidden lg:block w-full h-full overflow-visible">
         <defs>
           <linearGradient id={`grad-h-${fromId}`} x1="0%" y1="0%" x2="100%" y2="0%">
             <stop offset="0%" stopColor={fromColor} stopOpacity="1" />
             <stop offset="100%" stopColor={toColor} stopOpacity="1" />
           </linearGradient>
           
           {/* Huge unclipped glow filter for the main energy pulse */}
           <filter id={`hugeGlow-${fromId}`} x="-200%" y="-200%" width="500%" height="500%">
             <feGaussianBlur stdDeviation="6" result="blur1"/>
             <feGaussianBlur stdDeviation="2" result="blur2"/>
             <feMerge>
               <feMergeNode in="blur1"/>
               <feMergeNode in="blur2"/>
               <feMergeNode in="SourceGraphic"/>
             </feMerge>
           </filter>
         </defs>
         
         {/* Faint permanent base path (opacity 0.2) */}
         <path id={`path-h-${fromId}`} d="M 0 20 Q 25 5, 50 20 T 100 20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
         
         {/* Active path illuminates when transmitting */}
         <motion.path 
           d="M 0 20 Q 25 5, 50 20 T 100 20" 
           fill="none" 
           stroke={`url(#grad-h-${fromId})`} 
           strokeWidth="3" 
           initial={{ opacity: 0 }}
           animate={{ opacity: isTransmitting ? 0.8 : 0 }}
           transition={{ duration: 0.3 }}
           style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
         />

         {/* True SVG animateMotion packets tracing the exact path */}
         {!prefersReducedMotion && isTransmitting && (
           <g filter={`url(#hugeGlow-${fromId})`}>
             <animateMotion dur={durationStr} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.36 1">
               <mpath href={`#path-h-${fromId}`} />
             </animateMotion>
             {/* Fade in/out to avoid snapping at edges */}
             <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.95;1" dur={durationStr} fill="freeze" />
             
             {/* The Energy Trail (Long fading tail) */}
             {/* Using ellipses to simulate motion blur / comet tail */}
             <ellipse cx="-15" cy="0" rx="20" ry="2" fill={fromColor} opacity="0.6" />
             <ellipse cx="-35" cy="0" rx="15" ry="1.5" fill={toColor} opacity="0.3" />
             
             {/* The Core Energy Pulse */}
             <circle cx="0" cy="0" r="12" fill={fromColor} opacity="0.4" />
             <circle cx="0" cy="0" r="6" fill={toColor} opacity="0.9" />
             <circle cx="0" cy="0" r="3" fill="#FFFFFF" />
           </g>
         )}
         
         {/* Directional Chevrons */}
         <g opacity={isTransmitting ? 1 : 0.2} color={toColor}>
            <path className="chev-1" d="M 40 15 L 45 20 L 40 25" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path className="chev-2" d="M 48 15 L 53 20 L 48 25" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path className="chev-3" d="M 56 15 L 61 20 L 56 25" fill="none" stroke="currentColor" strokeWidth="2.5" />
         </g>
      </svg>
      
      {/* Mobile Vertical Connecting Line */}
      <svg className="block lg:hidden w-[60px] h-[100px] overflow-visible" viewBox="0 0 40 100" preserveAspectRatio="none">
         <defs>
           <linearGradient id={`grad-v-${fromId}`} x1="0%" y1="0%" x2="0%" y2="100%">
               <stop offset="0%" stopColor={fromColor} stopOpacity="1" />
               <stop offset="100%" stopColor={toColor} stopOpacity="1" />
           </linearGradient>
           <filter id={`hugeGlow-v-${fromId}`} x="-200%" y="-200%" width="500%" height="500%">
             <feGaussianBlur stdDeviation="6" result="blur1"/>
             <feGaussianBlur stdDeviation="2" result="blur2"/>
             <feMerge>
               <feMergeNode in="blur1"/>
               <feMergeNode in="blur2"/>
               <feMergeNode in="SourceGraphic"/>
             </feMerge>
           </filter>
         </defs>
         
         <path id={`path-v-${fromId}`} d="M 20 0 L 20 100" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
         
         <motion.path 
           d="M 20 0 L 20 100" 
           fill="none" 
           stroke={`url(#grad-v-${fromId})`} 
           strokeWidth="3" 
           initial={{ opacity: 0 }}
           animate={{ opacity: isTransmitting ? 0.8 : 0 }}
           transition={{ duration: 0.3 }}
         />
         
         {!prefersReducedMotion && isTransmitting && (
           <g filter={`url(#hugeGlow-v-${fromId})`}>
             <animateMotion dur={durationStr} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 0.61 0.36 1">
               <mpath href={`#path-v-${fromId}`} />
             </animateMotion>
             <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.95;1" dur={durationStr} fill="freeze" />
             
             {/* Vertical trail (swapped rx/ry) */}
             <ellipse cx="0" cy="-15" rx="2" ry="20" fill={fromColor} opacity="0.6" />
             <ellipse cx="0" cy="-35" rx="1.5" ry="15" fill={toColor} opacity="0.3" />
             
             <circle cx="0" cy="0" r="12" fill={fromColor} opacity="0.4" />
             <circle cx="0" cy="0" r="6" fill={toColor} opacity="0.9" />
             <circle cx="0" cy="0" r="3" fill="#FFFFFF" />
           </g>
         )}

         {/* Downward chevrons */}
         <g opacity={isTransmitting ? 1 : 0.2} color={toColor}>
            <path className="chev-1" d="M 15 40 L 20 45 L 25 40" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path className="chev-2" d="M 15 48 L 20 53 L 25 48" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path className="chev-3" d="M 15 56 L 20 61 L 25 56" fill="none" stroke="currentColor" strokeWidth="2.5" />
         </g>
      </svg>
    </div>
  );
};

// ─── LOCAL PARTICLES & INTELLIGENCE GEOMETRY ─────────────────────────────────
const BackgroundParticles: React.FC<{ activeStep: FlowStep }> = ({ activeStep }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
       {Array.from({ length: 40 }).map((_, i) => {
         const color = i % 4 === 0 ? '#8B5CF6' : i % 3 === 0 ? '#3B82F6' : i % 2 === 0 ? '#38BDF8' : '#22D3EE';
         const isRelevant = 
            (activeStep.includes('data') && color === '#22D3EE') ||
            (activeStep.includes('analysis') && color === '#38BDF8') ||
            (activeStep.includes('intelligence') && color === '#3B82F6') ||
            (activeStep.includes('decision') && color === '#8B5CF6');

         return (
           <motion.div
             key={`p-${i}`}
             className="absolute rounded-full"
             style={{ 
               width: Math.random() * 2 + 1 + 'px',
               height: Math.random() * 2 + 1 + 'px',
               left: `${Math.random() * 100}%`, 
               top: `${Math.random() * 100}%`, 
               background: color,
             }}
             animate={{ 
               y: [0, -30 - Math.random() * 30, 0], 
               x: [0, Math.random() * 40 - 20, 0], 
               opacity: isRelevant ? [0.3, 0.9, 0.3] : [0.05, 0.2, 0.05],
               boxShadow: isRelevant ? `0 0 12px ${color}` : `0 0 2px ${color}`
             }}
             transition={{ duration: 8 + Math.random() * 8, repeat: Infinity, ease: 'easeInOut' }}
           />
         );
       })}
    </div>
  );
};

const IntelligenceBackdrop: React.FC<{ activeStep: FlowStep, prefersReducedMotion: boolean }> = ({ activeStep, prefersReducedMotion }) => {
  if (prefersReducedMotion) return null;

  const isIntelligenceActive = activeStep === 'intelligence' || activeStep === 'intelligence-to-decision';

  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-80">
       <motion.div
         className="absolute w-[360px] h-[360px] lg:w-[420px] lg:h-[420px] rounded-full border border-white/5 pointer-events-none"
         animate={{ rotate: 360 }}
         transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
       />
       
       <motion.div
         className="absolute w-[280px] h-[280px] lg:w-[320px] lg:h-[320px] rounded-full border border-dashed pointer-events-none"
         animate={{ 
           rotate: -360,
           borderColor: isIntelligenceActive ? `rgba(59,130,246,0.9)` : `rgba(59,130,246,0.15)` 
         }}
         transition={{ 
           rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
           borderColor: { duration: 0.5 }
         }}
       />

       <motion.div
          className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 60%)' }}
          initial={{ scale: 1, opacity: 0.1 }}
          animate={{ 
            scale: isIntelligenceActive ? 1.5 : 1, 
            opacity: isIntelligenceActive ? 1 : 0.1 
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
       />
       
       <svg className="absolute w-[440px] h-[440px] lg:w-[500px] lg:h-[500px] pointer-events-none" viewBox="0 0 100 100">
          <motion.path 
            d="M 50 10 A 40 40 0 0 1 90 50" 
            fill="none" 
            stroke="url(#arc-grad-backdrop)" 
            strokeWidth="0.5" 
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: 'center' }}
          />
          <defs>
            <linearGradient id="arc-grad-backdrop">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
            </linearGradient>
          </defs>
       </svg>
    </div>
  );
};

export default TransformationSection;
