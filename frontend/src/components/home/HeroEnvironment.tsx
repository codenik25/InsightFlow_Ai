import React from 'react';

import { Navigation } from './Navigation';
import { CockpitFrame } from './CockpitFrame';
import { HeroHeadline } from './HeroHeadline';
import { InsightCore } from './InsightCore';
import {
  DataAnalysisCard,
  AIInsightsCard,
  DecisionImpactCard,
  SystemStatusCard
} from './AnalyticsCards';

interface HeroEnvironmentProps {
  hasLoaded: boolean;
  onLaunch: () => void;
}

export const HeroEnvironment: React.FC<HeroEnvironmentProps> = ({ hasLoaded, onLaunch }) => {
  return (
    <section className="relative w-full min-h-[850px] lg:h-screen lg:min-h-[900px] lg:max-h-[1050px] overflow-hidden bg-transparent select-none flex flex-col justify-between">
      
      {/* ============================================================ */}
      {/* 1. CINEMATIC BACKGROUND LAYERS (Now handled globally) */}
      {/* ============================================================ */}
      {/* The background is now globally mounted in Homepage.tsx as CinematicBackgroundEnvironment */}


      {/* ============================================================ */}
      {/* 3. SCI-FI HUD COCKPIT FRAME (Brackets, 4 Telemetry, Stage Bar) */}
      {/* ============================================================ */}
      <CockpitFrame hasLoaded={hasLoaded} />

      {/* ============================================================ */}
      {/* 4. TOP NAVIGATION */}
      {/* ============================================================ */}
      <Navigation onLaunch={onLaunch} hasLoaded={hasLoaded} />

      {/* ============================================================ */}
      {/* 5. DESKTOP HERO COCKPIT STAGE (2-Column Layout) */}
      {/* ============================================================ */}
      <div className="hidden lg:flex relative z-20 w-full max-w-[1400px] xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 h-full items-center justify-between pt-16 pb-12">
        
        {/* COLUMN 1: LEFT 42% (Headline, Description, CTA, Status Badge) */}
        <div className="w-[42%] flex flex-col justify-center z-20 pr-4 xl:pr-8">
          <HeroHeadline hasLoaded={hasLoaded} onLaunch={onLaunch} />
        </div>

        {/* COLUMN 2: RIGHT 58% (Core, Analytical Panels, Signals) */}
        <div className="w-[58%] relative flex items-center justify-center z-10 h-full">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10 w-full max-w-[650px] xl:max-w-[850px] 2xl:max-w-[1000px]">
             <InsightCore hasLoaded={hasLoaded} />
           </div>

           {/* Analytical Panels */}
           <div className="absolute top-[16%] left-[6%] xl:left-[10%] z-20">
             <DataAnalysisCard hasLoaded={hasLoaded} />
           </div>
           <div className="absolute bottom-[16%] left-[6%] xl:left-[10%] z-20">
             <AIInsightsCard hasLoaded={hasLoaded} />
           </div>
           <div className="absolute top-[16%] right-[6%] xl:right-[10%] z-20">
             <DecisionImpactCard hasLoaded={hasLoaded} />
           </div>
           <div className="absolute bottom-[16%] right-[6%] xl:right-[10%] z-20">
             <SystemStatusCard hasLoaded={hasLoaded} />
           </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. MOBILE & TABLET ADAPTIVE LAYOUT (< lg) */}
      {/* ============================================================ */}
      <div className="lg:hidden flex flex-col items-center justify-center pt-24 pb-16 px-6 relative z-20 gap-8">
        <HeroHeadline hasLoaded={hasLoaded} onLaunch={onLaunch} />

        <div className="w-full max-w-[380px] h-[340px] flex items-center justify-center overflow-hidden">
          <InsightCore hasLoaded={hasLoaded} />
        </div>

        <div className="w-full max-w-[340px] flex justify-center">
          <DataAnalysisCard hasLoaded={hasLoaded} />
        </div>
      </div>

    </section>
  );
};

export default HeroEnvironment;
