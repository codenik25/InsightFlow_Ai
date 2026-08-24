import React from 'react';
import { LayoutDashboard, Database, BarChart3, Sparkles, FileText, BrainCircuit, Compass, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const mainItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, status: 'Active' },
    { id: 'datasets', label: 'Dataset Registry & Lab', icon: Database, status: 'Phases 1–7.7' },
  ];

  const modules = [
    { id: 'cleaning', label: 'Data Cleaning & Lineage', icon: BarChart3, status: 'Phase 2' },
    { id: 'kpis', label: 'Automated Analytics & EDA', icon: FileText, status: 'Phase 3' },
    { id: 'ai', label: 'Business Insights', icon: Sparkles, status: 'Phase 4' },
    { id: 'ml', label: 'Predictive Analytics & ML', icon: BrainCircuit, status: 'Phase 6' },
    { id: 'decision', label: 'Decision Optimization', icon: Compass, status: 'Phase 7.2' },
    { id: 'command_center', label: 'Decision Command Center', icon: ShieldCheck, status: 'Phase 7.5' },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col shrink-0">
      <div className="p-4 flex-1 space-y-6">
        {/* Core Navigation */}
        <div>
          <h2 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Platform Core
          </h2>
          <nav className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-950/80 text-sky-300 border border-sky-800/60'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-mono">
                    {item.status}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Integrated Analytical Suite */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Analytical Suite
            </h2>
          </div>
          <nav className="space-y-1">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab('datasets')}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
                  title="Select a dataset in the Registry to enter this view"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                    {item.status}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">InsightFlow AI Engine</p>
          <p>Phase 1–7.7 Decision Intelligence</p>
          <p className="text-[11px] text-slate-500">FastAPI + React + PostgreSQL</p>
        </div>
      </div>
    </aside>
  );
};
