import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchDatasetProfile } from '../services/api';
import { DatasetProfileData } from '../types';

interface DatasetOverviewProps {
  rawDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DatasetOverview: React.FC<DatasetOverviewProps> = ({ rawDatasetId, setCurrentStage }) => {
  const [profile, setProfile] = useState<DatasetProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!rawDatasetId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDatasetProfile(rawDatasetId);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [rawDatasetId]);

  if (!rawDatasetId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">NO DATASET SELECTED</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm">Please return to Upload and ingest a dataset.</p>
        <button 
          onClick={() => setCurrentStage('UPLOAD')}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          ← BACK TO UPLOAD
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-8 max-w-5xl mx-auto">
        <div className="h-24 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
        <div className="grid grid-cols-3 gap-6">
          <div className="h-32 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
          <div className="h-32 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
          <div className="h-32 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
        </div>
        <div className="h-64 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center bg-slate-900/50 border border-rose-500/20 rounded-3xl p-8 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">UNABLE TO LOAD DATASET OVERVIEW</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">{error}</p>
        <button 
          onClick={loadProfile}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          RETRY
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">DATA PROFILE UNAVAILABLE</h3>
        <p className="text-slate-400 font-mono text-sm">The dataset exists, but profile data could not be parsed.</p>
      </div>
    );
  }

  const { overview, columns, quality } = profile;

  // Compute composition
  const typesCount = columns.reduce((acc, col) => {
    const t = col.inferred_type.toLowerCase();
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  } as any;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto space-y-12 pb-24"
    >
      
      {/* DATASET IDENTITY */}
      <motion.section variants={itemVariants} className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-800/60 pb-8 w-full">
        <div className="flex-1 min-w-0">
          <h2 className="text-[10px] font-mono font-bold text-slate-500 tracking-widest uppercase mb-3">Dataset Overview</h2>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-sans font-light tracking-tight text-white break-all">
              {overview.filename}
            </h1>
            <span className="shrink-0 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold font-mono tracking-widest uppercase whitespace-nowrap">
              PROFILED
            </span>
          </div>
          <p className="text-slate-400 font-mono text-xs md:text-sm truncate">
            ID: <span className="text-cyan-300/70">{profile.dataset_id}</span>
          </p>
        </div>
        <button 
          onClick={() => setCurrentStage('UPLOAD')}
          className="shrink-0 px-4 py-2 text-slate-400 hover:text-white font-mono text-[10px] md:text-xs uppercase tracking-wider transition-colors border border-slate-800/50 hover:border-slate-600 rounded-lg"
        >
          ← BACK TO UPLOAD
        </button>
      </motion.section>

      {/* DATASET METRICS */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel-premium p-8">
            <h3 className="text-slate-500 font-mono text-xs font-bold tracking-widest uppercase mb-4">Rows</h3>
            <div className="text-5xl font-mono text-white font-light tracking-tight">{overview.total_rows.toLocaleString()}</div>
          </div>
          <div className="glass-panel-premium p-8">
            <h3 className="text-slate-500 font-mono text-xs font-bold tracking-widest uppercase mb-4">Columns</h3>
            <div className="text-5xl font-mono text-white font-light tracking-tight">{overview.total_columns.toLocaleString()}</div>
          </div>
          <div className="glass-panel-premium p-8 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-slate-500 font-mono text-xs font-bold tracking-widest uppercase mb-4">File Size</h3>
              <div className="text-5xl font-mono text-white font-light tracking-tight">{formatBytes(overview.file_size_bytes)}</div>
            </div>
            {/* Subtle glow */}
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>

        {/* Data Composition Mini-Bar */}
        <div className="mt-6 flex flex-wrap gap-4 items-center px-4">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Composition:</span>
          {Object.entries(typesCount).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></div>
              <span className="text-xs font-mono text-slate-300 uppercase">{type}: <span className="text-white font-bold">{count}</span></span>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 min-w-0">
        {/* LEFT COLUMN: HEALTH SNAPSHOT */}
        <motion.section variants={itemVariants} className="lg:col-span-1 space-y-6 min-w-0">
          <div>
            <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Health Snapshot</h2>
            <div className="space-y-4">
              
              <div className="flex items-center justify-between p-5 rounded-2xl glass-panel-premium bg-opacity-40">
                <span className="text-slate-400 font-sans text-sm">Missing Values</span>
                <span className="font-mono text-white text-lg">{quality.empty_columns.length} <span className="text-xs text-slate-500">cols</span></span>
              </div>
              
              <div className="flex items-center justify-between p-5 rounded-2xl glass-panel-premium bg-opacity-40">
                <span className="text-slate-400 font-sans text-sm">Duplicate Rows</span>
                <span className="font-mono text-white text-lg">{overview.duplicate_rows.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl glass-panel-premium bg-opacity-40">
                <span className="text-slate-400 font-sans text-sm">Constant Columns</span>
                <span className="font-mono text-white text-lg">{quality.constant_columns.length}</span>
              </div>

            </div>
          </div>
        </motion.section>

        {/* RIGHT COLUMN: COLUMN PROFILE & PREVIEW */}
        <motion.section variants={itemVariants} className="lg:col-span-2 space-y-12 min-w-0">
          
          <div>
            <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">Column Profile</h2>
            <div className="glass-panel-premium overflow-hidden">
              <div className="overflow-x-auto max-h-[360px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-500 uppercase tracking-widest text-[10px] font-mono font-bold">
                    <tr>
                      <th className="px-6 py-4 font-bold border-b border-slate-800">Column Name</th>
                      <th className="px-6 py-4 font-bold border-b border-slate-800">Type</th>
                      <th className="px-6 py-4 font-bold border-b border-slate-800 text-right">Nulls</th>
                      <th className="px-6 py-4 font-bold border-b border-slate-800 text-right">Unique</th>
                      <th className="px-6 py-4 font-bold border-b border-slate-800">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                    {columns.map((col, i) => (
                      <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-3.5 text-white">{col.name}</td>
                        <td className="px-6 py-3.5 text-cyan-400/80 uppercase text-[10px] tracking-wider">{col.inferred_type}</td>
                        <td className="px-6 py-3.5 text-right text-slate-300">
                          {col.null_count > 0 ? (
                            <span className="text-rose-400">{col.null_count}</span>
                          ) : '0'}
                        </td>
                        <td className="px-6 py-3.5 text-right text-slate-300">{col.unique_count.toLocaleString()}</td>
                        <td className="px-6 py-3.5 text-slate-500 uppercase text-[10px]">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </motion.section>
      </div>

      {/* DATA PREVIEW */}
      <motion.section variants={itemVariants} className="w-full min-w-0">
        <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80 flex items-center justify-between">
          <span>Data Preview</span>
          <span className="text-slate-500 text-[10px] font-mono">Sample Rows</span>
        </h2>
        
        <div className="glass-panel-premium overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/60 text-slate-500 text-[10px] font-mono font-bold tracking-widest border-b border-slate-800">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-6 py-4 truncate max-w-[200px]">{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono text-xs text-slate-300">
              {/* Generate up to 5 rows based on sample_values arrays */}
              {Array.from({ length: Math.min(5, Math.max(...columns.map(c => c.sample_values?.length || 0))) }).map((_, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-800/20">
                  {columns.map((col, colIndex) => {
                    const val = col.sample_values?.[rowIndex];
                    const displayVal = val === null || val === undefined ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : String(val);

                    return (
                      <td key={colIndex} className="px-6 py-3.5 truncate max-w-[200px]">
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* PRIMARY ACTION */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-[rgba(34,211,238,0.12)] mt-12">
        <button
          onClick={() => setCurrentStage('QUALITY')}
          className="px-8 py-3.5 primary-glow-button rounded-full text-white text-[15px] font-sans font-semibold tracking-wide flex items-center gap-2"
        >
          CONTINUE TO DATA QUALITY
          <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </motion.div>

    </motion.div>
  );
};
