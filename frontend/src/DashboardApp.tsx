import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PlatformOverview } from './components/PlatformOverview';
import { LiveIntelligenceRail } from './components/LiveIntelligenceRail';
import { fetchHealthStatus, fetchDatasets } from './services/api';
import { HealthStatus } from './types';
import { motion } from 'framer-motion';

export const DashboardApp: React.FC = () => {
  const [currentStage, setCurrentStage] = useState<string>('UPLOAD');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  
  // Phase 1: Global Workflow State
  const [rawDatasetId, setRawDatasetId] = useState<string | null>(null);
  
  // Future Phases State (Declared here for architectural consistency)
  const [processedDatasetId, setProcessedDatasetId] = useState<string | null>(null);
  // const [analysisId, setAnalysisId] = useState<string | null>(null);
  // const [mlAnalysisId, setMlAnalysisId] = useState<string | null>(null);
  // const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [optimizationId, setOptimizationId] = useState<string | null>(null);
  // const [decisionId, setDecisionId] = useState<string | null>(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [healthRes, datasetsRes] = await Promise.all([
        fetchHealthStatus(),
        fetchDatasets(),
      ]);
      setHealth(healthRes);
      if (datasetsRes?.items && datasetsRes.items.length > 0) {
        setRawDatasetId(datasetsRes.items[0].id);
      }
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


  return (
    <div className="min-h-screen flex flex-col bg-[#02050A] text-slate-100 selection:bg-accent-cyan/30 selection:text-white relative overflow-hidden font-sans">
      
      {/* BACKGROUND LAYERS */}
      <motion.div 
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      >
        {/* BACKGROUND: deep navy/black gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#02050A] via-[#040914] to-[#081224]" />

        {/* MIDGROUND: very faint technical grid + atmospheric glow */}
        <motion.div 
          className="absolute inset-[-10%] w-[120%] h-[120%]"
          animate={!reducedMotion ? { y: [-10, 10], x: [-10, 10] } : {}}
          transition={{ duration: 30, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        >
          {/* Main Glows */}
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent-cyan/5 rounded-full blur-[150px] mix-blend-screen" />
          <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[400px] bg-accent-violet/5 rounded-full blur-[120px] mix-blend-screen" />
          
          {/* Faint Grid */}
          <div 
            className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"
            style={{ maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)' }}
          />
        </motion.div>

        {/* FOREGROUND: digital terrain/wave mesh near bottom */}
        <motion.div 
          className="absolute bottom-0 left-[-10%] right-[-10%] h-[30vh] overflow-hidden opacity-60"
          style={{ transform: 'perspective(1000px) rotateX(60deg) scale(1.2)', transformOrigin: 'bottom' }}
          animate={!reducedMotion ? { x: [-30, 30] } : {}}
          transition={{ duration: 40, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        >
          <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="terrain-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="rgba(34,211,238,0.25)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path 
              d="M-200 150 C 0 150, 100 50, 300 50 C 500 50, 600 180, 800 180 C 1000 180, 1100 70, 1300 70 C 1400 70, 1500 150, 1500 150"
              fill="none" 
              stroke="url(#terrain-grad)" 
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
            <path 
              d="M-200 100 C -100 100, 50 180, 250 180 C 450 180, 550 80, 750 80 C 950 80, 1050 150, 1250 150 C 1400 150, 1500 100, 1500 100"
              fill="none" 
              stroke="rgba(139,92,246,0.15)" 
              strokeWidth="1"
            />
            {/* Very faint connecting lines to look like a mesh */}
            {[...Array(6)].map((_, i) => (
              <line
                key={`mesh-col-${i}`}
                x1={150 + i * 150} y1="200"
                x2={150 + i * 150} y2="50"
                stroke="rgba(34,211,238,0.05)"
                strokeWidth="1"
              />
            ))}
          </svg>
        </motion.div>
      </motion.div>

      {/* TOP HEADER - 150ms delay */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="relative z-50 shrink-0"
      >
        <Header health={health} activeTab={currentStage} setActiveTab={setCurrentStage} />
      </motion.div>

      {/* MAIN APPLICATION SHELL */}
      <div className="flex flex-1 w-full relative z-10 overflow-hidden">
        
        {/* LEFT NAV - 250ms delay */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          className="shrink-0 flex"
        >
          <Sidebar activeTab={currentStage} setActiveTab={setCurrentStage} />
        </motion.div>
        
        {/* MAIN INTELLIGENCE WORKSPACE */}
        <main className="flex-1 min-w-0 relative">
          <PlatformOverview 
            activeTab={currentStage}
            rawDatasetId={rawDatasetId}
            processedDatasetId={processedDatasetId}
            setRawDatasetId={setRawDatasetId}
            setProcessedDatasetId={setProcessedDatasetId}
            setCurrentStage={setCurrentStage}
            optimizationId={optimizationId}
            setOptimizationId={setOptimizationId}
          />
        </main>
        
        {/* RIGHT LIVE INTELLIGENCE - 1100ms delay in component or here */}
        <LiveIntelligenceRail selectedDatasetId={rawDatasetId} />
      </div>
    </div>
  );
};

export default DashboardApp;

