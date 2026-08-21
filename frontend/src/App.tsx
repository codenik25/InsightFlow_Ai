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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <Header health={health} loading={loading} onRefresh={loadData} />

      {/* Main Layout Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content Container */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Product Purpose Banner */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
            <div className="max-w-3xl space-y-2 relative z-10">
              <div className="flex items-center gap-2 text-sky-400 font-medium text-xs tracking-wide uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Product Purpose & Foundation</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Automated Analytics & Decision Intelligence Platform
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                InsightFlow AI is engineered to streamline raw dataset validation, cleaning, automated analytics, KPI generation, anomaly detection, and natural language query execution. Phase 0 establishes the production-grade project architecture, clean API routing, and database ORM layer.
              </p>
            </div>
          </section>

          {/* Tab Views */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* System Health Probe Card */}
              <StatusCard health={health} loading={loading} />

              {/* Dataset Registry Placeholder Section */}
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
      <footer className="bg-slate-900 border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div>
            <span className="font-semibold text-slate-300">InsightFlow AI</span> — Phase 0 Production Foundation
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <span>FastAPI v0.110+</span>
            <span>•</span>
            <span>React 18 + TS</span>
            <span>•</span>
            <span>SQLAlchemy 2.0 (psycopg 3)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
