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
    <div className="min-h-screen flex flex-col bg-[#02060D] text-slate-100 selection:bg-accent-cyan/30 selection:text-white relative font-sans">
      
      {/* BACKGROUND LAYERS */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        
        {/* Layer 1: Atmospheric glows (Cyan, Blue, Violet) */}
        <motion.div 
          className="absolute inset-0"
          animate={!reducedMotion ? { opacity: [0.85, 1, 0.85] } : {}}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Left/Center cyan */}
          <div 
            className="absolute inset-0" 
            style={{ background: 'radial-gradient(circle at 35% 45%, rgba(34, 211, 238, 0.16), rgba(34, 211, 238, 0.05) 25%, transparent 55%)' }} 
          />
          
          {/* Right blue */}
          <div 
            className="absolute inset-0" 
            style={{ background: 'radial-gradient(circle at 78% 45%, rgba(59, 130, 246, 0.13), rgba(59, 130, 246, 0.04) 30%, transparent 60%)' }} 
          />
          
          {/* Bottom violet/navy */}
          <div 
            className="absolute inset-0" 
            style={{ background: 'radial-gradient(circle at 55% 90%, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.03) 30%, transparent 60%)' }} 
          />
        </motion.div>

        {/* Layer 2: Subtle technical grid */}
        <motion.div 
          className="absolute inset-0"
          animate={!reducedMotion ? { y: [-10, 10], x: [-5, 5] } : {}}
          transition={{ duration: 40, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        >
          <div 
            className="absolute inset-[-10%] w-[120%] h-[120%]"
            style={{ 
              backgroundImage: `linear-gradient(rgba(34,211,238,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.035) 1px, transparent 1px)`,
              backgroundSize: '48px 48px'
            }}
          />
        </motion.div>

        {/* Layer 3: Very soft vignette (Depth, NOT PURE BLACK) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(2,6,13,0.3)_100%)] pointer-events-none" />
      </div>

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

