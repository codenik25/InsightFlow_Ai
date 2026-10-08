import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User as UserIcon, Key, ExternalLink, LogOut, CheckCircle2, Command, Activity, ArrowRight } from 'lucide-react';
import { HealthStatus, Workspace, Project } from '../types';
import { WorkspaceSelector } from './WorkspaceSelector';
import { SlideDownNavigation } from './SlideDownNavigation';
import { useAuth } from '../context/AuthContext';
import { fetchInsights } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderProps {
  health?: HealthStatus | null;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  currentWorkspace?: Workspace | null;
  currentProject?: Project | null;
  projects?: Project[];
  onSelectProject?: (project: Project) => void;
  onProjectCreated?: (project: Project) => void;
  onProjectUpdated?: (project: Project) => void;
  rawDatasetId?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  activeTab = 'OVERVIEW',
  setActiveTab,
  currentWorkspace = null,
  currentProject = null,
  projects = [],
  onSelectProject,
  onProjectCreated,
  onProjectUpdated,
  rawDatasetId = null,
}) => {
  const isHealthy = health?.status === 'healthy';
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Live Intelligence Hover Dropdown State
  const [liveSignals, setLiveSignals] = useState<Array<{
    id: string;
    time: string;
    title: string;
    type: string;
  }>>([]);
  const [isLiveHovered, setIsLiveHovered] = useState(false);
  const liveHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logoRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch real insights for Live Intelligence state
  useEffect(() => {
    if (!rawDatasetId) {
      setLiveSignals([]);
      return;
    }
    let isSubscribed = true;
    fetchInsights(rawDatasetId)
      .then((res) => {
        if (!isSubscribed) return;
        if (res?.insights && res.insights.length > 0) {
          const mapped = res.insights.slice(0, 6).map((ins) => ({
            id: ins.id,
            time: new Date(ins.created_at || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
            title: ins.title,
            type: ins.category || 'INSIGHT',
          }));
          setLiveSignals(mapped);
        } else {
          setLiveSignals([]);
        }
      })
      .catch(() => {
        if (isSubscribed) setLiveSignals([]);
      });

    return () => {
      isSubscribed = false;
    };
  }, [rawDatasetId]);

  const handleLiveMouseEnter = () => {
    if (liveHoverTimeoutRef.current) clearTimeout(liveHoverTimeoutRef.current);
    setIsLiveHovered(true);
  };

  const handleLiveMouseLeave = () => {
    liveHoverTimeoutRef.current = setTimeout(() => {
      setIsLiveHovered(false);
    }, 180);
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  // Compute user initials
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'NR';

  const displayName = user?.full_name || 'Nikunj Rathi';
  const displayRole = user?.role || 'Admin';

  return (
    <header className="h-[68px] w-full bg-[#030713]/95 backdrop-blur-2xl flex items-center justify-between px-5 sm:px-6 shrink-0 relative z-50 border-b border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
      
      {/* Subtle bottom animated light line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/[0.07] overflow-hidden pointer-events-none">
        <motion.div 
          className="h-full w-1/2 bg-gradient-to-r from-transparent via-cyan-500/25 to-purple-500/25"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* ============================================================== */}
      {/* LEFT GROUP: IF LOGO + WORKSPACE/PROJECT + ENGINE STATUS */}
      {/* ============================================================== */}
      <div className="flex items-center gap-3.5 sm:gap-4 shrink-0 min-w-0">
        
        {/* 1. PRIMARY IF LOGO CONTROL */}
        <div className="relative flex items-center shrink-0" ref={logoRef}>
          <motion.button
            type="button"
            onClick={() => setIsNavOpen((prev) => !prev)}
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            animate={
              !isNavOpen
                ? {
                    boxShadow: [
                      '0 0 10px rgba(34,211,238,0.12)',
                      '0 0 20px rgba(34,211,238,0.28)',
                      '0 0 10px rgba(34,211,238,0.12)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative w-[46px] h-[46px] rounded-xl flex items-center justify-center cursor-pointer select-none transition-all duration-200 ease-out
              bg-[rgba(10,16,30,0.75)] backdrop-blur-md border border-cyan-500/30
              hover:scale-[1.04] hover:border-cyan-400/80 hover:bg-[rgba(18,28,52,0.85)] hover:shadow-[0_0_22px_rgba(34,211,238,0.36)]
              active:scale-[0.98]
              ${isNavOpen ? 'border-cyan-400 bg-[rgba(18,28,54,0.92)] shadow-[0_0_24px_rgba(34,211,238,0.4)]' : ''}`}
            aria-label="Toggle Primary Navigation"
            aria-expanded={isNavOpen}
          >
            {/* Subtle inner gradient lighting */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />
            <span className="relative z-10 font-sans font-black text-white text-[19px] tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              IF
            </span>
          </motion.button>

          {/* HOVER TOOLTIP (ONLY WHEN CLOSED) */}
          <AnimatePresence>
            {!isNavOpen && isLogoHovered && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[rgba(15,23,42,0.96)] border border-cyan-500/25 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.55)] text-[13px] font-sans font-semibold text-white whitespace-nowrap pointer-events-none z-[110]"
              >
                InsightFlow AI
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. WORKSPACE / PROJECT SELECTOR */}
        {onSelectProject && (
          <div className="hidden sm:block min-w-0">
            <WorkspaceSelector
              currentWorkspace={currentWorkspace}
              currentProject={currentProject}
              projects={projects}
              onSelectProject={onSelectProject}
              onProjectCreated={onProjectCreated || (() => {})}
              onProjectUpdated={onProjectUpdated || (() => {})}
            />
          </div>
        )}

        {/* 3. ENGINE STATUS */}
        <div 
          className="hidden xl:flex items-center gap-2 group cursor-default px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 transition-all duration-200" 
          title="Insight engine operational"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399] animate-[pulse_3s_ease-in-out_infinite]" />
          <span className="font-sans text-[12px] font-medium text-emerald-300">
            Engine Online
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CENTER GROUP: COMPACT SEARCH BAR */}
      {/* ============================================================== */}
      <div className="hidden lg:flex items-center justify-center flex-1 max-w-[360px] xl:max-w-[420px] mx-4">
        <div className="relative group/search w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within/search:text-cyan-400 transition-colors duration-200" />
          <input 
            type="text" 
            placeholder="Search datasets, insights, decisions..." 
            className="w-full h-[38px] bg-[rgba(15,23,42,0.4)] border border-white/10 hover:border-white/20 rounded-lg py-2 pl-9 pr-12 text-[13px] text-white font-sans placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus:bg-[rgba(15,23,42,0.65)] transition-all duration-200"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 pointer-events-none">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT GROUP: LIVE INTELLIGENCE, SYSTEM STATUS, NOTIFICATION, USER */}
      {/* ============================================================== */}
      <div className="flex items-center justify-end gap-3 sm:gap-4 shrink-0">
        
        {/* 1. LIVE INTELLIGENCE HOVER TRIGGER & SLIDE-DOWN DROPDOWN */}
        <div
          className="relative"
          onMouseEnter={handleLiveMouseEnter}
          onMouseLeave={handleLiveMouseLeave}
        >
          <button
            type="button"
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none
              ${
                isLiveHovered
                  ? 'bg-white/[0.08] border-cyan-500/40 shadow-[0_0_16px_rgba(34,211,238,0.2)]'
                  : 'bg-white/[0.03] border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.05]'
              }`}
            aria-label="Live Intelligence Signals"
          >
            {/* Pulsing Status Dot */}
            <div className="relative flex items-center justify-center">
              {liveSignals.length > 0 ? (
                <>
                  <div className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-40" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
                </>
              ) : rawDatasetId ? (
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE]" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              )}
            </div>

            <div className="flex flex-col text-left">
              <span className="font-sans text-[10.5px] font-bold tracking-wider text-slate-200 uppercase leading-none">
                LIVE INTELLIGENCE
              </span>
              <span
                className={`font-mono text-[9px] font-semibold uppercase leading-none mt-1 ${
                  liveSignals.length > 0
                    ? 'text-emerald-400'
                    : rawDatasetId
                    ? 'text-cyan-400'
                    : 'text-slate-500'
                }`}
              >
                {liveSignals.length > 0
                  ? `${liveSignals.length} SIGNALS`
                  : rawDatasetId
                  ? 'CONNECTED'
                  : 'INACTIVE'}
              </span>
            </div>
          </button>

          {/* SLIDE-DOWN DROPDOWN PANEL (OVERLAYS DASHBOARD WITHOUT PUSHING CONTENT) */}
          <AnimatePresence>
            {isLiveHovered && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="absolute right-0 top-[calc(100%+8px)] w-[360px] sm:w-[420px] bg-[rgba(6,12,24,0.96)] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.75),0_0_30px_rgba(34,211,238,0.12)] p-4 z-[120] overflow-hidden"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-sans font-bold text-xs uppercase tracking-wider text-white">
                      LIVE INTELLIGENCE
                    </span>
                  </div>

                  <span
                    className={`font-mono text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      liveSignals.length > 0
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {liveSignals.length > 0 ? 'STREAMING' : 'IDLE'}
                  </span>
                </div>

                {/* Signals Event Stream */}
                <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                  {liveSignals.length > 0 ? (
                    liveSignals.map((sig) => (
                      <div
                        key={sig.id}
                        className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-cyan-500/25 transition-all group/sig"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider">
                            {sig.type}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {sig.time}
                          </span>
                        </div>
                        <div className="text-xs font-sans font-medium text-slate-200 group-hover/sig:text-white line-clamp-2">
                          {sig.title}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-2 text-slate-500">
                        <Activity className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-sans text-slate-300 font-medium mb-1">
                        {rawDatasetId ? 'No signals detected yet' : 'No dataset connected'}
                      </p>
                      <p className="text-[11px] font-sans text-slate-500 max-w-[260px] mx-auto">
                        {rawDatasetId
                          ? 'Run automated quality checks and analysis to stream signals.'
                          : 'Select or upload a dataset to begin live intelligence analysis.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Link */}
                <div className="pt-3 mt-3 border-t border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => {
                      if (setActiveTab) setActiveTab(rawDatasetId ? 'INSIGHTS' : 'UPLOAD');
                      setIsLiveHovered(false);
                    }}
                    className="w-full py-2 rounded-xl bg-white/[0.04] hover:bg-cyan-500/15 text-xs font-sans font-bold text-cyan-300 hover:text-white border border-white/10 hover:border-cyan-500/30 transition-all flex items-center justify-center gap-1.5 group/btn cursor-pointer shadow-sm"
                  >
                    <span>VIEW FULL LOG</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. System Status */}
        <div className="hidden sm:flex items-center gap-2 group cursor-default" title="System API & Services">
          <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]' : 'bg-rose-500 shadow-[0_0_8px_#EF4444]'} animate-[pulse_3s_ease-in-out_infinite]`} />
          <span className="font-sans text-[12px] font-medium text-slate-400 group-hover:text-slate-300 transition-colors duration-200">
            {isHealthy ? 'System Online' : 'System Offline'}
          </span>
        </div>

        {/* Notifications with badge */}
        <button 
          type="button"
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-200 group"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-all" />
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-mono font-bold text-white flex items-center justify-center shadow-[0_0_8px_rgba(244,63,94,0.6)]">
            3
          </span>
        </button>

        {/* User Identity Control with Dropdown */}
        <div className="relative" ref={userMenuRef}>
          {isAuthenticated ? (
            <button 
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 pl-3 border-l border-white/10 cursor-pointer group hover:bg-white/[0.04] pr-2 py-1.5 rounded-lg transition-all duration-200 select-none"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 border border-white/20 flex items-center justify-center text-[12px] font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.3)] group-hover:shadow-[0_0_18px_rgba(34,211,238,0.4)] transition-all duration-200">
                {initials}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-sans text-[13px] text-white font-semibold group-hover:text-cyan-300 transition-colors leading-tight">
                  {displayName}
                </span>
                <span className="font-sans text-[11px] text-slate-400 leading-tight">
                  {displayRole}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform duration-200 ml-0.5 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 hover:border-cyan-400 text-cyan-300 hover:text-white text-[13px] font-sans font-semibold transition-all duration-150 shadow-[0_0_12px_rgba(34,211,238,0.15)] hover:shadow-[0_0_18px_rgba(34,211,238,0.3)]"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* User Dropdown Menu */}
          <AnimatePresence>
            {isUserMenuOpen && isAuthenticated && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute right-0 top-[calc(100%+8px)] w-60 bg-[rgba(10,16,30,0.96)] backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(34,211,238,0.08)] py-1.5 z-[110]"
              >
                <div className="px-3.5 py-2.5 border-b border-white/5 mb-1">
                  <div className="font-sans text-[13px] font-semibold text-white truncate">
                    {displayName}
                  </div>
                  <div className="font-sans text-[11px] text-slate-400 truncate">
                    {user?.email}
                  </div>
                  <div className="font-sans text-[10px] text-emerald-400 flex items-center gap-1.5 mt-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{displayRole} Access Active</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-sans text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-sans text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                >
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>API Keys & Governance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-sans text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>System Documentation</span>
                </button>

                <div className="my-1 border-t border-white/5" />

                <button
                  type="button"
                  onClick={async () => {
                    setIsUserMenuOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-sans text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* ============================================================== */}
      {/* SLIDE-DOWN FLOATING NAVIGATION OVERLAY */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isNavOpen && (
          <SlideDownNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOpen={isNavOpen}
            onClose={() => setIsNavOpen(false)}
            logoRef={logoRef}
          />
        )}
      </AnimatePresence>
    </header>
  );
};
