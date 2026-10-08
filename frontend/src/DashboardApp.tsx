import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { PlatformOverview } from './components/PlatformOverview';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import {
  fetchHealthStatus,
  fetchWorkspaces,
  fetchProjects,
} from './services/api';
import { HealthStatus, Workspace, Project } from './types';
import { motion } from 'framer-motion';

const STORAGE_KEY_DATASET = 'insightflow_last_active_dataset_id';
const STORAGE_KEY_PROJECT = 'insightflow_last_active_project_id';

export const DashboardApp: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true);
  const [currentStage, setCurrentStage] = useState<string>('UPLOAD');
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Phase 1: Workspace & Project SaaS Hierarchy State
  const [, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Global Workflow State: active dataset starts as null (no auto-selection)
  const [rawDatasetId, setRawDatasetId] = useState<string | null>(null);
  const [processedDatasetId, setProcessedDatasetId] = useState<string | null>(null);
  const [optimizationId, setOptimizationId] = useState<string | null>(null);

  // Set active dataset ONLY when user explicitly selects or uploads a dataset
  const handleSetRawDatasetId = useCallback((id: string | null) => {
    setRawDatasetId(id);
    if (!id) {
      setProcessedDatasetId(null);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsAppInitializing(true);

      // Clean up any legacy persistent active dataset keys on startup
      try {
        localStorage.removeItem(STORAGE_KEY_DATASET);
        sessionStorage.removeItem('insightflow_active_dataset_global');
      } catch {}

      const [healthRes, wsList] = await Promise.all([
        fetchHealthStatus().catch(() => null),
        fetchWorkspaces().catch(() => []),
      ]);
      if (healthRes) setHealth(healthRes);
      setWorkspaces(wsList);

      const activeWs = wsList.length > 0 ? wsList[0] : null;
      setCurrentWorkspace(activeWs);

      if (activeWs) {
        const projList = await fetchProjects(activeWs.id).catch(() => []);
        setProjects(projList);

        const savedProjId = localStorage.getItem(STORAGE_KEY_PROJECT);
        const activeProj =
          (savedProjId && projList.find((p) => p.id === savedProjId)) ||
          (projList.length > 0 ? projList[0] : null);
        setCurrentProject(activeProj);
      }

      // DETERMINISTIC STARTUP: No active dataset is selected automatically.
      // Starts cleanly in the pre-upload / dataset selection experience.
      setRawDatasetId(null);
      setProcessedDatasetId(null);
      setCurrentStage('UPLOAD');
    } catch (err) {
      console.error('Failed to load application health or SaaS context:', err);
      setCurrentStage('UPLOAD');
    } finally {
      // Smooth intentional transition from initialization
      setTimeout(() => {
        setIsAppInitializing(false);
      }, 250);
    }
  }, []);

  const handleSelectProject = useCallback(
    (project: Project) => {
      setCurrentProject(project);
      localStorage.setItem(STORAGE_KEY_PROJECT, project.id);
      // Project change resets dataset selection state to null until user explicitly chooses one
      setRawDatasetId(null);
      setProcessedDatasetId(null);
      setCurrentStage('UPLOAD');
    },
    []
  );

  const handleProjectCreated = useCallback(
    (newProject: Project) => {
      setProjects((prev) => [...prev, newProject]);
      handleSelectProject(newProject);
    },
    [handleSelectProject]
  );

  const handleProjectUpdated = useCallback(
    (updatedProject: Project) => {
      setProjects((prev) => (prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))));
      if (currentProject?.id === updatedProject.id) {
        setCurrentProject(updatedProject);
      }
    },
    [currentProject]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // INITIALIZATION STATE (NO FLASH OF PRE-UPLOAD)
  if (isAppInitializing) {
    return (
      <div className="min-h-screen w-full bg-[#02050A] flex flex-col items-center justify-center relative font-sans overflow-hidden select-none">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.12),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_60%,rgba(168,85,247,0.1),transparent_50%)] pointer-events-none" />
        
        {/* Technical grid */}
        <div 
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col items-center text-center relative z-10"
        >
          {/* Subtle glowing IF logo */}
          <div className="relative w-14 h-14 rounded-2xl bg-[rgba(10,16,30,0.85)] border border-cyan-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.25)] mb-5">
            <motion.div
              className="absolute inset-0 rounded-2xl border border-cyan-400"
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="font-sans font-black text-white text-2xl tracking-tight">IF</span>
          </div>

          <h2 className="font-sans text-lg font-bold text-white tracking-tight mb-2">
            InsightFlow AI
          </h2>

          <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-300 tracking-widest uppercase">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span>INITIALIZING DATA INTELLIGENCE WORKSPACE</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#030713] text-slate-100 selection:bg-accent-cyan/30 selection:text-white relative font-sans w-full max-w-full overflow-x-hidden">
      
      {/* BACKGROUND LAYERS (ISOLATED TO Z-0, STRICTLY BOUNDED & SUBTLE) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" style={{ isolation: 'isolate' }}>
        
        {/* Layer 0: Atmospheric glows (Cyan, Blue, Violet) - Base */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Left Cyan Atmosphere */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              background: 'radial-gradient(circle at 15% 35%, rgba(34, 211, 238, 0.09), transparent 50%)',
              filter: 'blur(70px)',
            }} 
          />
          
          {/* Right Violet Atmosphere */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              background: 'radial-gradient(circle at 85% 45%, rgba(168, 85, 247, 0.08), transparent 50%)',
              filter: 'blur(70px)',
            }} 
          />
          
          {/* Center Blue Atmosphere */}
          <div 
            className="absolute inset-0 z-0 pointer-events-none" 
            style={{ 
              background: 'radial-gradient(circle at 50% 60%, rgba(59, 130, 246, 0.06), transparent 55%)',
              filter: 'blur(80px)',
            }} 
          />

        </div>

        {/* Layer 2: Soft vignette (Depth) */}
        <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_center,transparent_45%,rgba(2,6,13,0.35)_100%)] pointer-events-none" />
      </div>

      {/* TOP HEADER (STRICTLY ABOVE BACKGROUND GRAPHICS AT Z-50) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="relative z-50 shrink-0 w-full"
      >
        <Header 
          health={health} 
          activeTab={currentStage} 
          setActiveTab={setCurrentStage}
          currentWorkspace={currentWorkspace}
          currentProject={currentProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onProjectCreated={handleProjectCreated}
          onProjectUpdated={handleProjectUpdated}
          rawDatasetId={rawDatasetId}
        />
      </motion.div>

      {/* MAIN APPLICATION SHELL */}
      <div className="flex flex-1 w-full relative z-10 overflow-hidden min-w-0">
        
        {/* MAIN INTELLIGENCE WORKSPACE (USES 100% AVAILABLE WIDTH) */}
        <main className="flex-1 min-w-0 relative flex flex-col overflow-hidden w-full">
          <PlatformOverview 
            activeTab={currentStage}
            rawDatasetId={rawDatasetId}
            processedDatasetId={processedDatasetId}
            setRawDatasetId={handleSetRawDatasetId}
            setProcessedDatasetId={setProcessedDatasetId}
            setCurrentStage={setCurrentStage}
            optimizationId={optimizationId}
            setOptimizationId={setOptimizationId}
            projectId={currentProject?.id || null}
            projectName={currentProject?.name}
            currentWorkspace={currentWorkspace}
            currentProject={currentProject}
            projects={projects}
            onSelectProject={handleSelectProject}
            onProjectCreated={handleProjectCreated}
            onProjectUpdated={handleProjectUpdated}
          />
        </main>
      </div>

      {/* AUTHENTICATION MODAL */}
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />
    </div>
  );
};

export default DashboardApp;
