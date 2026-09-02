import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HeroEnvironment } from '../home/HeroEnvironment';
import { TransformationSection } from './TransformationSection';
import { CapabilitiesSection } from './CapabilitiesSection';
import { OrbitalArchitectureSection } from './OrbitalArchitectureSection';
import { FinalCTA } from './FinalCTA';
import { HomeFooter } from './HomeFooter';
import LoadingSequence from './LoadingSequence';
import { CinematicBackgroundEnvironment } from '../home/CinematicBackgroundEnvironment';

interface HomepageProps {
  onLaunch: () => void;
}

export const Homepage: React.FC<HomepageProps> = ({ onLaunch }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleLoaderComplete = () => {
    setHasLoaded(true);
    // Smoothly fade out the loader overlay over 600ms
    setTimeout(() => {
      setIsInitializing(false);
    }, 600);
  };

  return (
    <div className="bg-[#02050A] min-h-screen text-slate-100 font-sans selection:bg-accent-cyan/30 selection:text-white relative overflow-x-hidden">
      
      {/* ============================================================ */}
      {/* 0. CONTINUOUS CINEMATIC BACKGROUND (Z-INDEX 0) */}
      {/* ============================================================ */}
      <CinematicBackgroundEnvironment />

      {/* ============================================================ */}
      {/* 1. CINEMATIC LOADING OVERLAY (Z-INDEX 100) */}
      {/* ============================================================ */}
      <AnimatePresence>
        {isInitializing && (
          <motion.div
            key="loading-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-transparent overflow-hidden"
          >
            <LoadingSequence onComplete={handleLoaderComplete} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 2. HERO COCKPIT ENVIRONMENT (Mounted underneath loader) */}
      {/* ============================================================ */}
      <HeroEnvironment hasLoaded={hasLoaded} onLaunch={onLaunch} />

      {/* ============================================================ */}
      {/* 3. CONTINUOUS BELOW-THE-FOLD SECTIONS */}
      {/* ============================================================ */}
      <div className="relative z-10 bg-transparent">
        {/* Soft background ambient light blooms that continue across scroll */}
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-3/4 right-1/4 w-[700px] h-[700px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.04)_0%,transparent_60%)] rounded-full blur-[140px] pointer-events-none" />

        {/* Section 1: How It Works / Transformation (RAW DATA -> DECISION) */}
        <TransformationSection />

        {/* Section 2: Capabilities (6 Core Decision Intelligence Capabilities) */}
        <CapabilitiesSection />

        {/* Section 3: Intelligence Pipeline (Orbital Redesign) */}
        <OrbitalArchitectureSection />

        {/* Section 4: Final Cinematic CTA */}
        <FinalCTA onLaunch={onLaunch} />

        {/* Section 5: Brand Footer */}
        <HomeFooter />
      </div>

    </div>
  );
};

export default Homepage;
