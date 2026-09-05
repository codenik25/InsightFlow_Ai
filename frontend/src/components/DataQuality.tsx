import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchDatasetQuality, fetchDatasetProfile } from '../services/api';
import { DatasetQualityResponse, DatasetProfileData } from '../types';

interface DataQualityProps {
  rawDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataQuality: React.FC<DataQualityProps> = ({ rawDatasetId, setCurrentStage }) => {
  const [quality, setQuality] = useState<DatasetQualityResponse | null>(null);
  const [profile, setProfile] = useState<DatasetProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  const loadData = async () => {
    if (!rawDatasetId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const [qData, pData] = await Promise.all([
        fetchDatasetQuality(rawDatasetId),
        fetchDatasetProfile(rawDatasetId)
      ]);
      setQuality(qData);
      setProfile(pData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset quality');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawDatasetId]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreColorHex = (score: number) => {
    if (score >= 90) return '#34d399';
    if (score >= 70) return '#fbbf24';
    return '#fb7185';
  };

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
        <div className="h-16 bg-slate-800/50 rounded-2xl border border-slate-700/50 w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
          <div className="h-64 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
        </div>
        <div className="h-48 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
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
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">UNABLE TO LOAD DATA QUALITY</h3>
        <p className="text-slate-400 mb-6 font-mono text-sm max-w-md">{error}</p>
        <button 
          onClick={loadData}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold tracking-wider uppercase border border-slate-700 transition-colors"
        >
          RETRY
        </button>
      </div>
    );
  }

  if (!quality || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">DATA QUALITY UNAVAILABLE</h3>
      </div>
    );
  }

  const { score, issues, completeness, uniqueness, validity, consistency } = quality;
  const overall = score.overall_score;
  const colorHex = getScoreColorHex(overall);
  const colorClass = getScoreColor(overall);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  } as any;

  // Compute distribution data (mocked from sub-scores as distribution is not explicitly a separate array)
  const distributionData = [
    { label: 'Completeness', value: score.completeness_score, color: '#3b82f6' },
    { label: 'Uniqueness', value: score.uniqueness_score, color: '#8b5cf6' },
    { label: 'Validity', value: score.validity_score, color: '#10b981' },
    { label: 'Consistency', value: score.consistency_score, color: '#f59e0b' }
  ];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto space-y-12 pb-24"
    >
      <motion.section variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/60 pb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">DATA QUALITY</h1>
          <p className="text-slate-400 font-mono text-sm">
            Dataset: <span className="text-cyan-300/70">{profile.overview.filename}</span>
          </p>
        </div>
        <button 
          onClick={() => setCurrentStage('OVERVIEW')}
          className="self-start md:self-auto px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
        >
          ← BACK TO OVERVIEW
        </button>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 01 — QUALITY SCORE */}
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden flex flex-col items-center justify-center">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-8 self-start opacity-80">01 — Quality Score</h2>
          
          <div className="relative w-64 h-40">
            {/* SVG Gauge */}
            <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
              {/* Background Arc */}
              <path 
                d="M 20 100 A 80 80 0 0 1 180 100" 
                fill="none" 
                stroke="#1e293b" 
                strokeWidth="12" 
                strokeLinecap="round" 
              />
              {/* Score Arc */}
              <motion.path 
                d="M 20 100 A 80 80 0 0 1 180 100" 
                fill="none" 
                stroke={colorHex} 
                strokeWidth="12" 
                strokeLinecap="round"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * (overall / 100)) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              {/* Center Pivot */}
              <circle cx="100" cy="100" r="6" fill="#334155" />
              <circle cx="100" cy="100" r="3" fill="#94a3b8" />
              
              {/* Needle Group */}
              <motion.g 
                initial={{ rotate: 0 }}
                animate={{ rotate: overall * 1.8 }}
                style={{ transformOrigin: '100px 100px' }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              >
                <polygon points="100,97 100,103 30,100" fill={colorHex} />
              </motion.g>
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
              <motion.div 
                className={`text-5xl font-mono font-bold tracking-tighter ${colorClass}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {overall}%
              </motion.div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
                {score.severity}
              </div>
            </div>
          </div>
        </motion.section>

        {/* 02 — DATA HEALTH METRICS */}
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-sm">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">02 — Health Metrics</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-1">Missing</div>
              <div className="text-3xl font-mono text-white tracking-tight">
                {completeness.missing_percentage.toFixed(1)}%
              </div>
              <div className="text-slate-400 font-mono text-[10px] mt-1">{completeness.total_missing_cells} cells</div>
            </div>
            
            <div>
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-1">Duplicates</div>
              <div className="text-3xl font-mono text-white tracking-tight">
                {uniqueness.duplicate_row_percentage.toFixed(1)}%
              </div>
              <div className="text-slate-400 font-mono text-[10px] mt-1">{uniqueness.duplicate_rows} rows</div>
            </div>
            
            <div>
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-1">Invalid</div>
              <div className="text-3xl font-mono text-white tracking-tight">
                {validity.invalid_percentage.toFixed(1)}%
              </div>
              <div className="text-slate-400 font-mono text-[10px] mt-1">{validity.total_invalid_cells} cells</div>
            </div>
            
            <div>
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-1">Consistency</div>
              <div className="text-3xl font-mono text-white tracking-tight">
                {consistency.whitespace_issues_count + consistency.casing_inconsistencies_count}
              </div>
              <div className="text-slate-400 font-mono text-[10px] mt-1">format issues</div>
            </div>
          </div>
        </motion.section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 03 — QUALITY DISTRIBUTION */}
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-sm lg:col-span-1">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">03 — Distribution</h2>
          <div className="space-y-4">
            {distributionData.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400 uppercase tracking-wider">{d.label}</span>
                  <span className="text-white font-bold">{d.value}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full rounded-full" 
                    style={{ backgroundColor: d.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.value}%` }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 04 — COLUMN HEALTH */}
        <motion.section variants={itemVariants} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-sm lg:col-span-2 flex flex-col">
          <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">04 — Column Health</h2>
          
          <div className="overflow-x-auto overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent flex-1 border border-slate-800/50 rounded-xl bg-slate-900/20">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-500 uppercase tracking-widest text-[10px] font-mono font-bold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-800">Column</th>
                  <th className="px-4 py-3 border-b border-slate-800">Type</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-right">Nulls</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-right">Unique</th>
                  <th className="px-4 py-3 border-b border-slate-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                {profile.columns.map((col, i) => {
                  // Determine status heuristically from quality data since it's not per-column directly in the profile
                  const hasMissing = (completeness.missing_by_column?.[col.name] || 0) > 0;
                  const hasInvalid = (validity.invalid_by_column?.[col.name] || 0) > 0;
                  const status = hasMissing || hasInvalid ? (hasInvalid ? 'WARNING' : 'FAIR') : 'HEALTHY';
                  const statusColor = status === 'HEALTHY' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 
                                      status === 'WARNING' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 
                                      'text-rose-400 bg-rose-500/10 border-rose-500/20';

                  return (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2.5 text-white">{col.name}</td>
                      <td className="px-4 py-2.5 text-cyan-400/80 uppercase text-[10px] tracking-wider">{col.inferred_type}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{col.null_count}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{col.unique_count.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded border text-[9px] uppercase tracking-widest ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>

      {/* 05 — DIAGNOSTIC ISSUES */}
      <motion.section variants={itemVariants} className="space-y-4">
        <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">05 — Diagnostic Issues</h2>
        
        {issues && issues.length > 0 ? (
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <div key={idx} className="border border-slate-800/80 rounded-2xl bg-slate-900/30 overflow-hidden">
                <div 
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedIssue(expandedIssue === idx ? null : idx)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${issue.severity === 'critical' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : issue.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                    <div>
                      <div className="font-sans text-white text-sm">{issue.description}</div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
                        {issue.category} • {issue.count || 0} affected
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-500 font-mono text-xs flex items-center gap-2">
                    {expandedIssue === idx ? 'HIDE DETAILS ▲' : 'VIEW DETAILS ▼'}
                  </div>
                </div>
                
                {/* Expanded State */}
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: expandedIssue === idx ? 'auto' : 0, opacity: expandedIssue === idx ? 1 : 0 }}
                  className="overflow-hidden bg-slate-950/50"
                >
                  <div className="p-6 border-t border-slate-800/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Affected Column</div>
                        <div className="font-mono text-xs text-cyan-300">{issue.column || 'Dataset Wide'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Severity</div>
                        <div className={`font-mono text-xs uppercase ${issue.severity === 'critical' ? 'text-rose-400' : issue.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                          {issue.severity}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-emerald-500/20 rounded-2xl bg-emerald-500/5 p-8 text-center">
            <h3 className="text-emerald-400 font-mono font-bold tracking-widest uppercase mb-2">DATA QUALITY HEALTHY</h3>
            <p className="text-slate-400 text-sm font-sans">No critical data issues detected during evaluation.</p>
          </div>
        )}
      </motion.section>

      {/* 06 — CONTINUE TO CLEANING */}
      <motion.div variants={itemVariants} className="pt-12 flex justify-end border-t border-slate-800/60 mt-12">
        <button
          onClick={() => setCurrentStage('CLEANING')}
          className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-200 rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          CONTINUE TO CLEANING
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </motion.div>

    </motion.div>
  );
};
