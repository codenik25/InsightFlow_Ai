import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchDatasetQuality, fetchDatasetProfile, applyCleaningPlan } from '../services/api';
import { DatasetQualityResponse, DatasetProfileData, CleaningPlan, CleaningOperation, CleaningApplyResponse } from '../types';

interface DataCleaningProps {
  rawDatasetId: string | null;
  setProcessedDatasetId?: (id: string | null) => void;
  setCurrentStage: (stage: string) => void;
}

export const DataCleaning: React.FC<DataCleaningProps> = ({ rawDatasetId, setProcessedDatasetId, setCurrentStage }) => {
  const [quality, setQuality] = useState<DatasetQualityResponse | null>(null);
  const [profile, setProfile] = useState<DatasetProfileData | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cleaning configuration
  const [removeDuplicates, setRemoveDuplicates] = useState<boolean>(true);
  const [fillOperations, setFillOperations] = useState<CleaningOperation[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('mode');
  
  // Execution
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleaningError, setCleaningError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<CleaningApplyResponse | null>(null);

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
      
      // Auto-configure duplicate removal if duplicates exist
      setRemoveDuplicates(qData.uniqueness.duplicate_rows > 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawDatasetId]);

  const handleAddFillOperation = () => {
    if (!selectedColumn) return;
    if (fillOperations.some(op => op.column === selectedColumn)) return;

    setFillOperations([...fillOperations, {
      type: 'fill_missing',
      column: selectedColumn,
      strategy: selectedStrategy
    }]);
    setSelectedColumn('');
  };

  const handleRemoveFillOperation = (col: string) => {
    setFillOperations(fillOperations.filter(op => op.column !== col));
  };

  const executeCleaning = async () => {
    if (!rawDatasetId) return;

    const operations: CleaningOperation[] = [];
    if (removeDuplicates) {
      operations.push({ type: 'remove_duplicates' });
    }
    operations.push(...fillOperations);

    if (operations.length === 0) {
      setCleaningError('Please configure at least one cleaning operation.');
      return;
    }

    setIsCleaning(true);
    setCleaningError(null);

    try {
      const plan: CleaningPlan = {
        dataset_id: rawDatasetId,
        operations
      };
      const res = await applyCleaningPlan(rawDatasetId, plan);
      setApplyResult(res);
    } catch (err: any) {
      setCleaningError(err.message || 'Failed to apply cleaning plan');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleContinueToAnalysis = () => {
    if (applyResult && setProcessedDatasetId) {
      setProcessedDatasetId(applyResult.output_dataset_id);
      setCurrentStage('ANALYSIS');
    }
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
        <div className="h-32 bg-slate-800/50 rounded-2xl border border-slate-700/50"></div>
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
        <h3 className="text-xl font-sans text-white mb-2 tracking-tight">UNABLE TO LOAD CLEANING PROFILE</h3>
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

  if (!quality || !profile) return null;

  const colsWithMissing = profile.columns.filter((c) => c.null_count > 0);
  const targetCol = profile.columns.find((c) => c.name === selectedColumn);
  const isNumeric = targetCol?.inferred_type === 'numeric';

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
      className="max-w-6xl mx-auto space-y-12 pb-24"
    >
      <motion.section variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/60 pb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-sans font-light tracking-tight text-white mb-3">DATA CLEANING</h1>
          <p className="text-slate-400 font-mono text-sm max-w-xl">
            Execute cleaning operations to produce a processed dataset artifact. <br/>
            The raw source dataset <span className="text-cyan-300">({profile.overview.filename})</span> remains completely immutable.
          </p>
        </div>
        {!applyResult && (
          <button 
            onClick={() => setCurrentStage('QUALITY')}
            className="self-start md:self-auto px-4 py-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
          >
            ← BACK TO DATA QUALITY
          </button>
        )}
      </motion.section>

      {/* AFTER SUCCESSFUL CLEANING */}
      {applyResult ? (
        <motion.div variants={itemVariants} className="space-y-12">
          
          <div className="bg-emerald-900/10 border border-emerald-500/30 rounded-3xl p-10 flex flex-col items-center text-center backdrop-blur-sm">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-sans text-white mb-4 tracking-wide">CLEANING COMPLETE</h2>
            <p className="text-slate-400 font-mono text-sm mb-2">Raw dataset preserved</p>
            <p className="text-slate-300 font-mono text-sm mb-8">Processed dataset ready for downstream analysis</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left">
              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">RAW DATASET</div>
                <div className="font-mono text-slate-300 text-xs truncate" title={applyResult.original_dataset_id}>{applyResult.original_dataset_id}</div>
              </div>
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl">
                <div className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest mb-1">PROCESSED DATASET</div>
                <div className="font-mono text-emerald-300 text-xs truncate" title={applyResult.output_dataset_id}>{applyResult.output_dataset_id}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="glass-panel-premium p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Processed Rows</div>
              <div className="text-3xl font-mono text-white tracking-tight">{applyResult.after.total_rows}</div>
              <div className="text-slate-400 font-mono text-[10px] mt-2 line-through">{applyResult.before.total_rows} originally</div>
            </div>
            <div className="glass-panel-premium p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Missing Values</div>
              <div className="text-3xl font-mono text-emerald-400 tracking-tight">{applyResult.after.total_missing_cells}</div>
              <div className="text-slate-400 font-mono text-[10px] mt-2">{applyResult.before.total_missing_cells} originally</div>
            </div>
            <div className="glass-panel-premium p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Duplicates</div>
              <div className="text-3xl font-mono text-emerald-400 tracking-tight">{applyResult.after.duplicate_rows}</div>
              <div className="text-slate-400 font-mono text-[10px] mt-2">{applyResult.before.duplicate_rows} originally</div>
            </div>
            <div className="glass-panel-premium p-6">
              <div className="text-slate-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">Quality Score</div>
              <div className="text-3xl font-mono text-cyan-400 tracking-tight">{applyResult.after.quality_score}</div>
              <div className="text-slate-400 font-mono text-[10px] mt-2">{applyResult.before.quality_score} originally</div>
            </div>
          </div>

          <div className="pt-8 flex justify-end border-t border-slate-800/60">
            <button
              onClick={handleContinueToAnalysis}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-sm font-bold tracking-widest uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              CONTINUE TO ANALYSIS
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

        </motion.div>
      ) : (
        /* BEFORE CLEANING */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* A. CLEANING READINESS / SUMMARY */}
            <motion.section variants={itemVariants} className="lg:col-span-1 space-y-6">
              <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">A. Readiness Summary</h2>
              
              <div className="glass-panel-premium p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
                  <span className="text-slate-400 font-mono text-xs uppercase">Target Dataset</span>
                  <span className="font-mono text-white text-xs truncate max-w-[150px]">{profile.overview.filename}</span>
                </div>
                
                <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
                  <span className="text-slate-400 font-mono text-xs uppercase">Missing Values</span>
                  <span className={`font-mono text-xs ${quality.completeness.total_missing_cells > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {quality.completeness.total_missing_cells} cells
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
                  <span className="text-slate-400 font-mono text-xs uppercase">Duplicate Rows</span>
                  <span className={`font-mono text-xs ${quality.uniqueness.duplicate_rows > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {quality.uniqueness.duplicate_rows}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400 font-mono text-xs uppercase">Quality Score</span>
                  <span className="font-mono text-cyan-400 font-bold text-sm">{quality.score.overall_score}/100</span>
                </div>
              </div>
            </motion.section>

            {/* B. CLEANING OPERATIONS */}
            <motion.section variants={itemVariants} className="lg:col-span-2 space-y-6">
              <h2 className="text-sm font-sans text-white tracking-widest uppercase mb-6 opacity-80">B. Cleaning Operations</h2>
              
              <div className="glass-panel-premium p-8 space-y-8">
                
                {/* Remove Duplicates */}
                <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-2xl p-5">
                  <div>
                    <h3 className="font-sans text-white text-sm mb-1">Remove Exact Duplicate Rows</h3>
                    <p className="font-mono text-slate-500 text-[10px] uppercase tracking-wide">
                      {quality.uniqueness.duplicate_rows} duplicates detected
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={removeDuplicates}
                      onChange={(e) => setRemoveDuplicates(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Fill Missing Builder */}
                <div className="space-y-4">
                  <h3 className="font-sans text-white text-sm">Handle Missing Values</h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <select
                      value={selectedColumn}
                      onChange={(e) => {
                        setSelectedColumn(e.target.value);
                        const col = profile.columns.find((c) => c.name === e.target.value);
                        if (col?.inferred_type === 'numeric') {
                          setSelectedStrategy('median');
                        } else {
                          setSelectedStrategy('mode');
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Select column with missing values</option>
                      {colsWithMissing.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.null_count} missing)</option>
                      ))}
                    </select>
                    
                    <select
                      value={selectedStrategy}
                      onChange={(e) => setSelectedStrategy(e.target.value)}
                      disabled={!selectedColumn}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                    >
                      {isNumeric ? (
                        <>
                          <option value="median">Median</option>
                          <option value="mean">Mean</option>
                          <option value="drop_rows">Drop Rows</option>
                        </>
                      ) : (
                        <>
                          <option value="mode">Mode</option>
                          <option value="drop_rows">Drop Rows</option>
                        </>
                      )}
                    </select>
                    
                    <button
                      onClick={handleAddFillOperation}
                      disabled={!selectedColumn}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold tracking-widest uppercase border border-slate-700 transition-colors shrink-0"
                    >
                      ADD
                    </button>
                  </div>
                </div>

                {/* Active Operations List */}
                {fillOperations.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {fillOperations.map((op, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="font-mono text-xs text-slate-300">
                            Fill <span className="text-white">{op.column}</span> using <span className="text-cyan-400">{op.strategy}</span>
                          </span>
                        </div>
                        <button 
                          onClick={() => handleRemoveFillOperation(op.column!)}
                          className="text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          </div>

          {/* C. BEFORE -> AFTER CONCEPT VISUALIZATION */}
          <motion.section variants={itemVariants} className="glass-panel-premium p-10 flex flex-col items-center justify-center relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-900 via-cyan-500/50 to-slate-900"></div>

            <div className="flex items-center gap-8 text-center max-w-3xl w-full">
              <div className="flex-1">
                <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl mx-auto flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">RAW SOURCE</div>
                <div className="text-xs font-mono text-white">Immutable Dataset</div>
              </div>
              
              <div className="flex-1 flex flex-col items-center text-cyan-500/50">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>

              <div className="flex-1">
                <div className="w-16 h-16 bg-cyan-950 border border-cyan-500/30 rounded-2xl mx-auto flex items-center justify-center mb-4 relative">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  {isCleaning && (
                    <div className="absolute inset-0 border-2 border-cyan-400 rounded-2xl animate-ping opacity-20"></div>
                  )}
                </div>
                <div className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-1">CLEANING ENGINE</div>
                <div className="text-xs font-mono text-cyan-300">Transformation</div>
              </div>

              <div className="flex-1 flex flex-col items-center text-cyan-500/50">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>

              <div className="flex-1">
                <div className="w-16 h-16 bg-emerald-950 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest mb-1">PROCESSED OUTPUT</div>
                <div className="text-xs font-mono text-emerald-300">Analysis Ready</div>
              </div>
            </div>
          </motion.section>

          {cleaningError && (
            <motion.div variants={itemVariants} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm font-mono text-center">
              {cleaningError}
            </motion.div>
          )}

          {/* PRIMARY ACTION */}
          <motion.div variants={itemVariants} className="pt-8 flex justify-end border-t border-[rgba(34,211,238,0.12)] mt-8">
            <button
              onClick={executeCleaning}
              disabled={isCleaning}
              className="px-8 py-3.5 primary-glow-button disabled:opacity-50 rounded-full text-white text-[15px] font-sans font-semibold tracking-wide flex items-center justify-center gap-2 min-w-[240px]"
            >
              {isCleaning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  PROCESSING...
                </>
              ) : (
                <>
                  RUN CLEANING
                  <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </motion.div>
        </>
      )}

    </motion.div>
  );
};
