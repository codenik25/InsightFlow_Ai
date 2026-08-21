import React from 'react';
import { LayoutDashboard, Database, BarChart3, Sparkles, Settings, FileText, Lock } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const mainItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, status: 'active' },
    { id: 'datasets', label: 'Datasets (Metadata)', icon: Database, status: 'active' },
  ];

  const futureItems = [
    { id: 'cleaning', label: 'Data Cleaning', icon: BarChart3, status: 'Phase 1+' },
    { id: 'kpis', label: 'EDA & KPIs', icon: FileText, status: 'Phase 1+' },
    { id: 'ai', label: 'AI Insights', icon: Sparkles, status: 'Phase 1+' },
    { id: 'settings', label: 'System Settings', icon: Settings, status: 'Phase 0' },
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
                </button>
              );
            })}
          </nav>
        </div>

        {/* Future Architecture Scope */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Future Modules
            </h2>
            <Lock className="w-3 h-3 text-slate-500" />
          </div>
          <nav className="space-y-1">
            {futureItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg text-slate-500 cursor-not-allowed opacity-75"
                  title="Scheduled for future expansion phase"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {item.status}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">InsightFlow AI Engine</p>
          <p>Version 0.1.0 (Foundation)</p>
          <p className="text-[11px] text-slate-500">FastAPI + React + PostgreSQL</p>
        </div>
      </div>
    </aside>
  );
};
