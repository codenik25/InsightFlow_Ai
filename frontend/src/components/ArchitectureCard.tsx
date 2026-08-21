import React from 'react';
import { Layers, CheckCircle2, Terminal } from 'lucide-react';

export const ArchitectureCard: React.FC = () => {
  const stackItems = [
    { name: 'React 18 + Vite', role: 'Frontend UI Framework', category: 'Frontend' },
    { name: 'TypeScript', role: 'Strict Type System', category: 'Frontend' },
    { name: 'Tailwind CSS', role: 'Analytics Design System', category: 'Frontend' },
    { name: 'FastAPI', role: 'Asynchronous Python Web API', category: 'Backend' },
    { name: 'Pydantic v2', role: 'API Request/Response Schemas', category: 'Backend' },
    { name: 'SQLAlchemy 2.0', role: 'Database ORM Layer', category: 'Data' },
    { name: 'psycopg 3', role: 'Native PostgreSQL Driver', category: 'Data' },
    { name: 'Alembic', role: 'Database Migration Engine', category: 'Data' },
    { name: 'PostgreSQL 16', role: 'Relational Database Engine', category: 'Data' },
    { name: 'Docker Compose', role: 'Containerized Stack', category: 'DevOps' },
  ];

  return (
    <div className="card-panel space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-400" />
          <h2 className="text-base font-semibold text-white">Project Architecture & Stack Foundation</h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
          Production Foundation
        </span>
      </div>

      {/* Tech Stack Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Technology Stack Components
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stackItems.map((item, idx) => (
            <div key={idx} className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-sky-400">{item.category}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-white truncate">{item.name}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Development Commands Guide */}
      <div className="bg-slate-950/80 rounded-lg p-4 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Local Development Commands</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[11px] mb-1 font-sans">Start PostgreSQL (Docker)</span>
            <code className="text-sky-300">docker-compose up -d db</code>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[11px] mb-1 font-sans">Start FastAPI Backend</span>
            <code className="text-sky-300">uvicorn app.main:app --reload</code>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[11px] mb-1 font-sans">Run Automated Tests</span>
            <code className="text-sky-300">python -m pytest tests/</code>
          </div>
        </div>
      </div>
    </div>
  );
};
