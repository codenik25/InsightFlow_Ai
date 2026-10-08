import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  Database,
  Upload,
  ShieldCheck,
  Sparkles,
  Activity,
  Search,
  BrainCircuit,
  Settings,
  Target,
  Shield,
  Lock,
  GitCompare,
  PlayCircle,
  Network,
  PieChart,
  ShieldAlert,
  FileText,
  BookOpen
} from 'lucide-react';

interface SlideDownNavigationProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  logoRef: React.RefObject<HTMLDivElement | null>;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
      { id: 'PROJECTS', label: 'Projects', icon: Briefcase },
      { id: 'DATASETS', label: 'Dataset Registry', icon: Database },
    ],
  },
  {
    title: 'PIPELINE',
    items: [
      { id: 'UPLOAD', label: 'Upload & Ingestion', icon: Upload },
      { id: 'QUALITY', label: 'Data Quality', icon: ShieldCheck },
      { id: 'CLEANING', label: 'Data Cleaning', icon: Sparkles },
      { id: 'ANALYSIS', label: 'Analysis', icon: Activity },
      { id: 'INSIGHTS', label: 'Insights', icon: Search },
      { id: 'PREDICTIONS', label: 'Predictions', icon: BrainCircuit },
      { id: 'OPTIMIZATION', label: 'Optimization', icon: Settings },
      { id: 'RECOMMENDATIONS', label: 'Recommendations', icon: Target },
      { id: 'DECISIONS', label: 'Decisions', icon: Shield },
      { id: 'GUARDRAILS', label: 'Guardrails', icon: Lock },
    ],
  },
  {
    title: 'TRACEABILITY',
    items: [
      { id: 'VERSIONS', label: 'Dataset Versions', icon: GitCompare },
      { id: 'RUNS', label: 'Analysis Runs', icon: PlayCircle },
      { id: 'INSIGHT_MEMORY', label: 'Insight Memory', icon: BrainCircuit },
      { id: 'EVIDENCE', label: 'Evidence', icon: Network },
    ],
  },
  {
    title: 'DECISION INTELLIGENCE',
    items: [
      { id: 'DECISION_PORTFOLIO', label: 'Portfolio', icon: PieChart },
      { id: 'CAPACITY_RISK', label: 'Capacity & Risk', icon: ShieldAlert },
      { id: 'REPORTS', label: 'Enterprise Reports', icon: FileText },
      { id: 'KNOWLEDGE', label: 'Knowledge', icon: BookOpen },
    ],
  },
];

export const SlideDownNavigation: React.FC<SlideDownNavigationProps> = ({
  activeTab = 'OVERVIEW',
  setActiveTab,
  isOpen,
  onClose,
  logoRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }
      if (logoRef.current && logoRef.current.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, logoRef]);

  if (!isOpen) return null;

  let globalItemIndex = 0;

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="absolute left-5 top-[calc(100%+6px)] z-[100] w-[264px] max-h-[calc(100vh-84px)] overflow-y-auto custom-scrollbar flex flex-col bg-[rgba(6,12,24,0.96)] backdrop-blur-2xl border border-cyan-500/25 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(34,211,238,0.12)] p-2 select-none"
    >
      {/* Brand Header inside expanded navigation */}
      <div className="px-3 pt-2.5 pb-2 mb-1 flex items-center justify-between border-b border-white/5 shrink-0">
        <span className="font-sans font-bold text-white text-[13px] tracking-wide">
          InsightFlow AI
        </span>
        <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          Navigation
        </span>
      </div>

      {/* Nav Sections */}
      <div className="flex flex-col gap-1 w-full pb-1">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="flex flex-col gap-0.5">
            {section.title && (
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const itemIndex = globalItemIndex++;
              const isActive = activeTab === item.id;

              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: itemIndex * 0.02, ease: 'easeOut' }}
                  onClick={() => {
                    if (setActiveTab) setActiveTab(item.id);
                    onClose();
                  }}
                  className={`group relative flex items-center h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150 ease-out w-full text-left select-none
                    ${isActive 
                      ? 'bg-cyan-500/15 text-white border border-cyan-500/35 shadow-[0_0_15px_rgba(34,211,238,0.12)]' 
                      : 'text-slate-400 hover:text-white hover:bg-cyan-500/10 hover:border-cyan-500/20 hover:shadow-[0_0_12px_rgba(34,211,238,0.1)] hover:translate-x-1 border border-transparent'}`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-cyan-400 rounded-r-full shadow-[0_0_8px_#22D3EE]" />
                  )}
                  <item.icon 
                    className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                    }`} 
                  />
                  <span className={`ml-2.5 truncate font-sans ${isActive ? 'text-white font-semibold' : 'group-hover:text-white'}`}>
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
