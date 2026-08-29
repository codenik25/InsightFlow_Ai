import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { StatusCard } from './components/StatusCard';
import { DatasetSection } from './components/DatasetSection';
import { ArchitectureCard } from './components/ArchitectureCard';
import { fetchHealthStatus, fetchDatasets } from './services/api';
import { HealthStatus, DatasetListResponse } from './types';
import { Sparkles } from 'lucide-react';


export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [datasets, setDatasets] = useState<DatasetListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, datasetsRes] = await Promise.all([
        fetchHealthStatus(),
        fetchDatasets(),
      ]);
      setHealth(healthRes);
      setDatasets(datasetsRes);
    } catch (err) {
      console.error('Failed to load application health or datasets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Header Topbar */}
      <Header health={health} loading={loading} onRefresh={loadData} />

      {/* Main Layout Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Primary Content Container */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Product Purpose Hero Banner */}
          <section className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/80 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
            <div className="max-w-3xl space-y-3 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Next-Gen Analytics & Decision Workspace</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                From Raw Data to <span className="text-gradient-primary">Evidence-Backed Business Decisions</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                InsightFlow AI combines automated dataset profiling, deterministic data quality scoring, exploratory data analysis, predictive machine learning, decision optimization, safety guardrails, executive decision command center aggregation, and real-world outcome feedback across Phase 1 through Phase 7.7.
              </p>
            </div>

            {/* Glowing background accent circle */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          </section>

          {/* Tab Views */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* System Health Probe Card */}
              <StatusCard health={health} loading={loading} />

              {/* Dataset Registry Section */}
              <DatasetSection datasets={datasets} />

              {/* Architecture & Tech Stack Card */}
              <ArchitectureCard />
            </div>
          )}

          {activeTab === 'datasets' && (
            <div className="space-y-6">
              <DatasetSection datasets={datasets} />
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900/80 backdrop-blur-md border-t border-slate-800/80 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div>
            <span className="font-bold text-slate-200">InsightFlow AI</span> — Phase 1–7.7 Executive Decision Intelligence Platform
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>FastAPI v0.110+</span>
            <span>•</span>
            <span>React 18 + TS</span>
            <span>•</span>
            <span>SQLAlchemy 2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
