import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlatformOverview } from './components/PlatformOverview';
import { LiveIntelligenceRail } from './components/LiveIntelligenceRail';
import { DecisionStream } from './components/DecisionStream';
import { fetchHealthStatus, fetchDatasets } from './services/api';
import { HealthStatus, DatasetListResponse } from './types';
import { motion } from 'framer-motion';

export const DashboardApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('data');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [datasets, setDatasets] = useState<DatasetListResponse | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [healthRes, datasetsRes] = await Promise.all([
        fetchHealthStatus(),
        fetchDatasets(),
      ]);
      setHealth(healthRes);
      setDatasets(datasetsRes);
    } catch (err) {
      console.error('Failed to load application health or datasets:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [loadData]);

  // Slow camera movement variants for the background
  const cameraVariants: any = {
    animate: {
      scale: [1, 1.015, 1],
      x: [0, -4, 0],
      y: [0, 3, 0],
      transition: {
        duration: 25,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    reduced: {
      scale: 1,
      x: 0,
      y: 0
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#02050A] text-slate-100 selection:bg-accent-cyan/30 selection:text-white relative overflow-hidden font-sans">
      
      {/* BACKGROUND ENVIRONMENT */}
      <motion.div 
        className="fixed inset-0 pointer-events-none z-0"
        variants={cameraVariants}
        animate={reducedMotion ? "reduced" : "animate"}
      >
        {/* Layer 1: Deep navy gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#02050A] to-[#030814]" />
        
        {/* Layer 2: Large blurred cyan atmospheric bloom behind engine */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-[radial-gradient(circle,rgba(34,211,238,0.06)_0%,transparent_60%)] blur-[120px]" />
        
        {/* Layer 3: Subtle violet bloom near decision area */}
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(139,92,246,0.04)_0%,transparent_50%)] blur-[100px]" />
        
        {/* Layer 4: Technical micro-grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] opacity-70" />
        
        {/* Layer 5: Perspective data floor */}
        <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-[linear-gradient(transparent_0%,rgba(34,211,238,0.02)_100%)]" style={{ transform: 'perspective(1000px) rotateX(60deg) scale(2)' }} />
        
        {/* Layer 6: Floating particles */}
        {!reducedMotion && [...Array(20)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1 h-1 rounded-full bg-accent-cyan/30 blur-[1px]"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight 
            }}
            animate={{ 
              y: [null, Math.random() * window.innerHeight],
              opacity: [0.1, 0.4, 0.1]
            }}
            transition={{ 
              duration: 10 + Math.random() * 20, 
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}

        {/* Layer 7: Very faint curved signal paths */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <path d="M 0,200 Q 500,400 1000,100 T 2000,500" fill="none" stroke="#22D3EE" strokeWidth="1" />
          <path d="M 0,600 Q 800,200 1200,800 T 2000,300" fill="none" stroke="#22D3EE" strokeWidth="1" />
        </svg>

        {/* Layer 8: Edge vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(2,5,10,0.9)]" />
      </motion.div>

      {/* TOP COMMAND BAR */}
      <Header health={health} />

      {/* MAIN APPLICATION SHELL */}
      <div className="flex flex-1 w-full relative z-10 overflow-hidden">
        
        {/* LEFT NAV */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* MAIN INTELLIGENCE WORKSPACE */}
        <main className="flex-1 min-w-0 relative">
          <PlatformOverview activeTab={activeTab} />
        </main>
        
        {/* RIGHT LIVE INTELLIGENCE */}
        <LiveIntelligenceRail />
      </div>

      {/* BOTTOM INTELLIGENCE ACTIVITY */}
      <DecisionStream />
    </div>
  );
};

export default DashboardApp;

