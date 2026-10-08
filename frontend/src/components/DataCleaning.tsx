import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Database, 
  ShieldCheck, 
  Cpu, 
  FileSpreadsheet, 
  Sliders, 
  RefreshCw, 
  Zap
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import { fetchDatasetQuality, fetchDatasetProfile, applyCleaningPlan } from '../services/api';
import { 
  DatasetQualityResponse, 
  DatasetProfileData, 
  CleaningPlan, 
  CleaningOperation, 
  CleaningApplyResponse 
} from '../types';
import { GlassCard3D } from './ui/GlassCard3D';

interface DataCleaningProps {
  rawDatasetId: string | null;
  setProcessedDatasetId?: (id: string | null) => void;
  setCurrentStage: (stage: string) => void;
}

export const DataCleaning: React.FC<DataCleaningProps> = ({ 
  rawDatasetId, 
  setProcessedDatasetId, 
  setCurrentStage 
}) => {
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

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

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
      setError(err.message || 'Failed to load dataset diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawDatasetId]);

  const colsWithMissing = useMemo(() => {
    if (!profile) return [];
    return profile.columns.filter((c) => c.null_count > 0);
  }, [profile]);

  const targetCol = useMemo(() => {
    if (!profile || !selectedColumn) return null;
    return profile.columns.find((c) => c.name === selectedColumn);
  }, [profile, selectedColumn]);

  const isNumeric = targetCol?.inferred_type === 'numeric';

  const handleAddFillOperation = () => {
    if (!selectedColumn) return;
    if (fillOperations.some(op => op.column === selectedColumn)) return;

    setFillOperations(prev => [
      ...prev, 
      {
        type: 'fill_missing',
        column: selectedColumn,
        strategy: selectedStrategy
      }
    ]);
    setSelectedColumn('');
  };

  const handleRemoveFillOperation = (col: string) => {
    setFillOperations(prev => prev.filter(op => op.column !== col));
  };

  const executeCleaning = async () => {
    if (!rawDatasetId) return;

    const operations: CleaningOperation[] = [];
    if (removeDuplicates) {
      operations.push({ type: 'remove_duplicates' });
    }
    operations.push(...fillOperations);

    if (operations.length === 0) {
      setCleaningError('Please configure at least one cleaning operation (e.g. duplicate removal or missing-value imputation).');
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

  // Entrance animations staggered across 900ms - 1.2s sequence
  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 12, scale: 0.99 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.45, ease: 'easeOut' } 
    },
  };

  // Estimated outcomes
  const estimatedDuplicateRemoval = removeDuplicates && quality ? quality.uniqueness.duplicate_rows : 0;
  const estimatedRemainingRows = profile ? Math.max(0, profile.overview.total_rows - estimatedDuplicateRemoval) : 0;
  const totalOperationsCount = (removeDuplicates ? 1 : 0) + fillOperations.length;

  // 1. EMPTY STATE: NO DATASET SELECTED
  if (!rawDatasetId) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center min-h-[500px]">
        <GlassCard3D 
          surfaceLevel={2} 
          accentColor="cyan"
          className="p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center border-white/10"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-6 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <Database className="w-8 h-8" />
          </div>
          <span className="font-mono text-[11px] text-cyan-400 font-semibold tracking-widest uppercase mb-2">
            INITIALIZATION REQUIRED
          </span>
          <h2 className="text-2xl font-sans font-bold text-white mb-3 tracking-tight">
            NO DATASET SELECTED
          </h2>
          <p className="text-slate-400 font-sans text-sm max-w-md mb-8 leading-relaxed">
            Select or upload a source dataset to activate the Cleaning Control Center and begin algorithmic data preparation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <button 
              onClick={() => setCurrentStage('UPLOAD')}
              className="px-6 py-3 primary-glow-button text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
            >
              <span>Upload New Dataset</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentStage('DATASETS')}
              className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 rounded-xl text-xs font-bold tracking-wider uppercase border border-white/10 transition-colors"
            >
              Dataset Registry
            </button>
          </div>
        </GlassCard3D>
      </div>
    );
  }

  // 2. LOADING STATE
  if (loading) {
    return (
      <ContinuousIntelligenceEngine
        mode="cleaning"
        isLoading={loading}
        isFullScreen={false}
        minHeight="540px"
        error={error}
        onRetry={loadData}
      />
    );
  }

  // 3. ERROR STATE
  if (error || !quality || !profile) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center min-h-[500px]">
        <GlassCard3D 
          surfaceLevel={2} 
          accentColor="amber"
          className="p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center border-amber-500/30"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <span className="font-mono text-[11px] text-amber-400 font-semibold tracking-widest uppercase mb-2">
            DIAGNOSTICS UNAVAILABLE
          </span>
          <h2 className="text-2xl font-sans font-bold text-white mb-3 tracking-tight">
            DATASET UNAVAILABLE
          </h2>
          <p className="text-slate-400 font-sans text-sm max-w-md mb-8 leading-relaxed">
            {error || 'The active dataset could not be accessed. It may have been archived or removed from the storage service.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <button 
              onClick={() => setCurrentStage('QUALITY')}
              className="px-6 py-3 primary-glow-button text-white rounded-xl text-xs font-bold tracking-wider uppercase flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Data Quality</span>
            </button>
            <button 
              onClick={loadData}
              className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 rounded-xl text-xs font-bold tracking-wider uppercase border border-white/10 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Load</span>
            </button>
          </div>
        </GlassCard3D>
      </div>
    );
  }

  const qualityScore = quality.score.overall_score;
  const completenessRate = (
    (1 - (quality.completeness.total_missing_cells / Math.max(1, profile.overview.total_rows * profile.overview.total_columns))) * 100
  ).toFixed(1);
  const singleValueColsCount = profile.overview.constant_column_count ?? profile.quality?.constant_columns?.length ?? 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 sm:space-y-8"
    >
      {/* ============================================================== */}
      {/* 1. HEADER / HERO COMMAND-CENTER BANNER                         */}
      {/* ============================================================== */}
      <motion.section 
        variants={itemVariants}
        className="w-full relative z-[2]"
      >
        <GlassCard3D 
          surfaceLevel={2} 
          accentColor="cyan"
          className="p-6 sm:p-7 relative overflow-hidden"
          style={{ isolation: 'isolate' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10.5px] font-semibold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE]" />
                  DATA PREPARATION
                </span>
                <span className="text-slate-500 text-xs">•</span>
                <span className="font-mono text-xs text-slate-400">
                  STAGE 02 / 06
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-white flex items-center gap-3">
                <span>Cleaning Control Center</span>
              </h1>

              <p className="text-slate-400 font-sans text-xs sm:text-sm max-w-2xl leading-relaxed">
                Prepare the active dataset for reliable intelligence and modeling. Raw source remains immutable; cleaning generates an isolated, reproducible processed artifact.
              </p>

              {/* Dataset Target Metadata Pills */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[rgba(10,22,42,0.85)] border border-white/10 font-mono text-xs text-slate-200">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-semibold text-white truncate max-w-[280px]" title={profile.overview.filename}>
                    {profile.overview.filename}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 font-mono text-[11px] text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
                  <span>RAW SOURCE VERIFIED</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 font-mono text-[11px] text-blue-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60A5FA]" />
                  <span>IMMUTABLE</span>
                </div>
              </div>
            </div>

            {/* Top Right Action: Return to Data Quality */}
            <div className="self-start lg:self-center shrink-0">
              <button 
                onClick={() => setCurrentStage('QUALITY')}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-mono text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center gap-2 group/backBtn"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 group-hover/backBtn:-translate-x-1 transition-transform" />
                <span>BACK TO DATA QUALITY</span>
              </button>
            </div>
          </div>
        </GlassCard3D>
      </motion.section>

      {/* ============================================================== */}
      {/* 2. COMPACT DATASET STATUS STRIP                                */}
      {/* ============================================================== */}
      <motion.section variants={itemVariants} className="w-full relative z-[2]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
          {/* Source Rows */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5 backdrop-blur-md flex flex-col justify-between">
            <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              SOURCE ROWS
            </span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-white mt-1">
              {profile.overview.total_rows.toLocaleString()}
            </div>
            <span className="font-sans text-[10.5px] text-slate-500 mt-0.5">
              100% indexed
            </span>
          </div>

          {/* Columns */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5 backdrop-blur-md flex flex-col justify-between">
            <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              COLUMNS
            </span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-white mt-1">
              {profile.overview.total_columns}
            </div>
            <span className="font-sans text-[10.5px] text-slate-500 mt-0.5">
              schema mapped
            </span>
          </div>

          {/* Missing Cells */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5 backdrop-blur-md flex flex-col justify-between">
            <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              MISSING CELLS
            </span>
            <div className={`text-xl sm:text-2xl font-mono font-bold mt-1 ${quality.completeness.total_missing_cells > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {quality.completeness.total_missing_cells}
            </div>
            <span className="font-sans text-[10.5px] text-slate-500 mt-0.5">
              {colsWithMissing.length} column(s) affected
            </span>
          </div>

          {/* Duplicate Rows */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5 backdrop-blur-md flex flex-col justify-between">
            <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              DUPLICATE ROWS
            </span>
            <div className={`text-xl sm:text-2xl font-mono font-bold mt-1 ${quality.uniqueness.duplicate_rows > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {quality.uniqueness.duplicate_rows}
            </div>
            <span className="font-sans text-[10.5px] text-slate-500 mt-0.5">
              exact row matches
            </span>
          </div>

          {/* Quality Score */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5 backdrop-blur-md flex flex-col justify-between">
            <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              QUALITY SCORE
            </span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-400 mt-1">
              {qualityScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
            </div>
            <span className="font-sans text-[10.5px] text-slate-500 mt-0.5">
              {qualityScore >= 80 ? 'Optimal tier' : qualityScore >= 60 ? 'Acceptable' : 'Needs attention'}
            </span>
          </div>

          {/* Workflow Status */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5 backdrop-blur-md flex flex-col justify-between">
            <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              STATUS
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${applyResult ? 'bg-emerald-400 shadow-[0_0_8px_#34D399]' : isCleaning ? 'bg-cyan-400 animate-ping' : 'bg-cyan-400 shadow-[0_0_8px_#22D3EE]'}`} />
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                {applyResult ? 'CLEANED' : isCleaning ? 'TRANSFORMING' : 'READY'}
              </span>
            </div>
            <span className="font-sans text-[10.5px] text-cyan-300 mt-0.5">
              {applyResult ? 'Artifact generated' : isCleaning ? 'Executing plan' : 'Awaiting execution'}
            </span>
          </div>
        </div>
      </motion.section>

      {/* ============================================================== */}
      {/* 3. CONDITIONAL: POST-CLEANING ARTIFACT VIEW vs MAIN WORKSPACE  */}
      {/* ============================================================== */}
      {applyResult ? (
        /* AFTER SUCCESSFUL CLEANING */
        <motion.div variants={itemVariants} className="space-y-6 sm:space-y-8 relative z-[2]">
          <GlassCard3D 
            surfaceLevel={3} 
            accentColor="emerald"
            className="p-8 sm:p-10 border-emerald-500/40 relative overflow-hidden text-center flex flex-col items-center"
          >
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="font-mono text-xs text-emerald-400 font-bold tracking-widest uppercase mb-1">
              TRANSFORMATION COMPLETED & VERIFIED
            </span>
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-white tracking-tight mb-2">
              Processed Artifact Generated
            </h2>
            <p className="text-slate-400 font-sans text-sm max-w-lg mb-8">
              Raw source dataset was preserved without modification. The cleaned dataset is now staged for downstream statistical analysis and predictive modeling.
            </p>

            {/* Lineage ID Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left mb-8">
              <div className="p-4 rounded-xl bg-[rgba(6,12,24,0.9)] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-slate-400" />
                  <span>IMMUTABLE RAW SOURCE ID</span>
                </div>
                <div className="font-mono text-xs text-slate-200 select-all break-all">
                  {applyResult.original_dataset_id}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>PROCESSED ARTIFACT ID</span>
                </div>
                <div className="font-mono text-xs text-emerald-300 select-all break-all font-semibold">
                  {applyResult.output_dataset_id}
                </div>
              </div>
            </div>

            {/* Before vs After Impact Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl text-left">
              <div className="p-4 sm:p-5 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  PROCESSED ROWS
                </div>
                <div className="text-2xl font-mono font-bold text-white mt-1">
                  {applyResult.after.total_rows.toLocaleString()}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1 line-through">
                  {applyResult.before.total_rows.toLocaleString()} originally
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  MISSING CELLS
                </div>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                  {applyResult.after.total_missing_cells}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  from {applyResult.before.total_missing_cells} unresolved
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  DUPLICATES
                </div>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                  {applyResult.after.duplicate_rows}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  from {applyResult.before.duplicate_rows} removed
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-[rgba(8,16,32,0.85)] border border-white/5">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  QUALITY SCORE
                </div>
                <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">
                  {applyResult.after.quality_score} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  was {applyResult.before.quality_score} previously
                </div>
              </div>
            </div>

            {/* Next Steps CTA Bar */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8 pt-6 border-t border-white/10 w-full">
              <button
                onClick={() => setApplyResult(null)}
                className="px-6 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-slate-300 font-mono text-xs uppercase tracking-wider border border-white/10 transition-colors"
              >
                Reconfigure Cleaning Plan
              </button>

              <button
                onClick={handleContinueToAnalysis}
                className="px-8 py-3.5 primary-glow-button text-white rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2.5 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
              >
                <span>CONTINUE TO ANALYSIS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </GlassCard3D>
        </motion.div>
      ) : (
        /* BEFORE CLEANING: TWO-COLUMN COMMAND-CENTER LAYOUT */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start relative z-[2]">
            
            {/* ============================================================ */}
            {/* LEFT COLUMN: DATASET DIAGNOSTICS (APPROX 42%)                */}
            {/* ============================================================ */}
            <motion.section variants={itemVariants} className="lg:col-span-5 space-y-6">
              <GlassCard3D 
                surfaceLevel={2} 
                accentColor="blue"
                className="p-6 sm:p-7 space-y-6"
              >
                {/* Section Header */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60A5FA]" />
                    <h2 className="text-base sm:text-lg font-sans font-bold text-white tracking-wide uppercase">
                      DATASET DIAGNOSTICS
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Structural health & anomaly profiling
                  </p>
                </div>

                {/* Target Dataset Analytical Metrics */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[rgba(6,12,24,0.7)] border border-white/5">
                    <span className="text-slate-400 uppercase text-[11px]">TARGET DATASET</span>
                    <span className="text-white font-semibold truncate max-w-[180px]" title={profile.overview.filename}>
                      {profile.overview.filename}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[rgba(6,12,24,0.7)] border border-white/5">
                      <span className="text-slate-400 uppercase text-[10px] block">TOTAL ROWS</span>
                      <span className="text-white text-sm font-bold mt-0.5 block">
                        {profile.overview.total_rows.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[rgba(6,12,24,0.7)] border border-white/5">
                      <span className="text-slate-400 uppercase text-[10px] block">TOTAL COLUMNS</span>
                      <span className="text-white text-sm font-bold mt-0.5 block">
                        {profile.overview.total_columns}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[rgba(6,12,24,0.7)] border border-white/5">
                      <span className="text-slate-400 uppercase text-[10px] block">MISSING CELLS</span>
                      <span className={`text-sm font-bold mt-0.5 block ${quality.completeness.total_missing_cells > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {quality.completeness.total_missing_cells}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[rgba(6,12,24,0.7)] border border-white/5">
                      <span className="text-slate-400 uppercase text-[10px] block">DUPLICATE ROWS</span>
                      <span className={`text-sm font-bold mt-0.5 block ${quality.uniqueness.duplicate_rows > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {quality.uniqueness.duplicate_rows}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Animated Health Gauge */}
                <div className="p-4 rounded-xl bg-[rgba(6,14,30,0.8)] border border-cyan-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      <span>DATA HEALTH INDEX</span>
                    </span>
                    <span className="font-mono text-cyan-400 font-bold text-sm">
                      {qualityScore} / 100
                    </span>
                  </div>

                  {/* Horizontal Gauge Bar */}
                  <div className="w-full h-3 rounded-full bg-slate-900 border border-white/10 overflow-hidden relative">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, qualityScore))}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10.5px] text-slate-400">
                    <span>Completeness: {completenessRate}%</span>
                    <span className="text-cyan-300">
                      {qualityScore >= 80 ? 'HIGH FIDELITY' : qualityScore >= 60 ? 'MODERATE' : 'CLEANING REQUIRED'}
                    </span>
                  </div>
                </div>

                {/* DETECTED ISSUES INTERACTIVE LIST */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-300 font-bold uppercase tracking-wider">
                      DETECTED ISSUES
                    </span>
                    <span className="font-mono text-[10.5px] text-slate-400">
                      {(quality.completeness.total_missing_cells > 0 ? 1 : 0) + (quality.uniqueness.duplicate_rows > 0 ? 1 : 0) + (singleValueColsCount > 0 ? 1 : 0)} flagged
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Missing values issue row */}
                    <div 
                      onClick={() => {
                        if (colsWithMissing.length > 0) {
                          setSelectedColumn(colsWithMissing[0].name);
                          const col = colsWithMissing[0];
                          setSelectedStrategy(col.inferred_type === 'numeric' ? 'median' : 'mode');
                        }
                      }}
                      className="p-3 rounded-xl bg-[rgba(6,12,24,0.6)] border border-white/5 hover:border-amber-500/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${quality.completeness.total_missing_cells > 0 ? 'bg-amber-400 shadow-[0_0_6px_#F59E0B]' : 'bg-emerald-400 shadow-[0_0_6px_#34D399]'}`} />
                        <div>
                          <div className="font-sans text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                            Missing Values
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {colsWithMissing.length > 0 ? `Across ${colsWithMissing.length} column(s)` : 'Zero null cells detected'}
                          </div>
                        </div>
                      </div>

                      <span className={`font-mono text-xs font-bold ${quality.completeness.total_missing_cells > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {quality.completeness.total_missing_cells} cells
                      </span>
                    </div>

                    {/* Duplicate rows issue row */}
                    <div 
                      onClick={() => setRemoveDuplicates(true)}
                      className="p-3 rounded-xl bg-[rgba(6,12,24,0.6)] border border-white/5 hover:border-cyan-500/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${quality.uniqueness.duplicate_rows > 0 ? 'bg-amber-400 shadow-[0_0_6px_#F59E0B]' : 'bg-emerald-400 shadow-[0_0_6px_#34D399]'}`} />
                        <div>
                          <div className="font-sans text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                            Duplicate Rows
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            Exact row match filter
                          </div>
                        </div>
                      </div>

                      <span className={`font-mono text-xs font-bold ${quality.uniqueness.duplicate_rows > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {quality.uniqueness.duplicate_rows} row{quality.uniqueness.duplicate_rows === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Constant Columns issue row */}
                    <div className="p-3 rounded-xl bg-[rgba(6,12,24,0.6)] border border-white/5 hover:border-slate-600 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${singleValueColsCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <div>
                          <div className="font-sans text-xs font-semibold text-slate-200">
                            Constant Columns
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            Single distinct value features
                          </div>
                        </div>
                      </div>

                      <span className={`font-mono text-xs font-bold ${singleValueColsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {singleValueColsCount} column{singleValueColsCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard3D>
            </motion.section>

            {/* ============================================================ */}
            {/* RIGHT COLUMN: CLEANING OPERATIONS (APPROX 58%)               */}
            {/* ============================================================ */}
            <motion.section variants={itemVariants} className="lg:col-span-7 space-y-6">
              <GlassCard3D 
                surfaceLevel={3} 
                accentColor="cyan"
                className="p-6 sm:p-7 space-y-6 border-cyan-500/25"
              >
                {/* Section Header */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22D3EE]" />
                    <h2 className="text-base sm:text-lg font-sans font-bold text-white tracking-wide uppercase">
                      CLEANING OPERATIONS
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Configure transformations before generating the processed dataset
                  </p>
                </div>

                {/* -------------------------------------------------------- */}
                {/* 01 DUPLICATE HANDLING MODULE                             */}
                {/* -------------------------------------------------------- */}
                <div className="p-5 rounded-2xl bg-[rgba(8,16,34,0.85)] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center font-mono text-[11px] font-bold text-cyan-300">
                        01
                      </span>
                      <div>
                        <h3 className="font-sans text-sm font-bold text-white tracking-tight">
                          DUPLICATE HANDLING
                        </h3>
                        <p className="font-sans text-xs text-slate-400 mt-0.5">
                          Remove exact duplicate rows across all features
                        </p>
                      </div>
                    </div>

                    {/* Interactive ON / OFF Switch */}
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={removeDuplicates}
                        onChange={(e) => setRemoveDuplicates(e.target.checked)}
                      />
                      <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 peer-checked:shadow-[0_0_12px_rgba(34,211,238,0.4)]"></div>
                      <span className="font-mono text-xs font-bold text-slate-300 ml-2.5 min-w-[28px]">
                        {removeDuplicates ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>

                  {/* Duplicate Status Callout Badge */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[rgba(6,12,24,0.6)] border border-white/5 font-mono text-xs">
                    <span className="text-slate-400">
                      {quality.uniqueness.duplicate_rows} duplicate{quality.uniqueness.duplicate_rows === 1 ? '' : 's'} detected in raw source
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md font-semibold text-[10.5px] uppercase ${quality.uniqueness.duplicate_rows > 0 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                      {quality.uniqueness.duplicate_rows > 0 ? `${quality.uniqueness.duplicate_rows} REMOVABLE` : 'CLEAN (0 FOUND)'}
                    </span>
                  </div>
                </div>

                {/* -------------------------------------------------------- */}
                {/* 02 MISSING VALUE HANDLING MODULE                         */}
                {/* -------------------------------------------------------- */}
                <div className="p-5 rounded-2xl bg-[rgba(8,16,34,0.85)] border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center font-mono text-[11px] font-bold text-cyan-300">
                      02
                    </span>
                    <div>
                      <h3 className="font-sans text-sm font-bold text-white tracking-tight">
                        MISSING VALUE HANDLING
                      </h3>
                      <p className="font-sans text-xs text-slate-400 mt-0.5">
                        Select affected feature and algorithmic imputation strategy
                      </p>
                    </div>
                  </div>

                  {/* Form Controls Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-1">
                    {/* Column Select */}
                    <div className="sm:col-span-5 space-y-1.5">
                      <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                        COLUMN
                      </label>
                      <select
                        value={selectedColumn}
                        onChange={(e) => {
                          const colName = e.target.value;
                          setSelectedColumn(colName);
                          const col = profile.columns.find((c) => c.name === colName);
                          if (col?.inferred_type === 'numeric') {
                            setSelectedStrategy('median');
                          } else {
                            setSelectedStrategy('mode');
                          }
                        }}
                        className="w-full bg-[rgba(6,12,24,0.9)] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono transition-colors outline-none cursor-pointer"
                      >
                        <option value="">Select affected column...</option>
                        {colsWithMissing.map(c => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.null_count} nulls)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Strategy Select */}
                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                        STRATEGY
                      </label>
                      <select
                        value={selectedStrategy}
                        onChange={(e) => setSelectedStrategy(e.target.value)}
                        disabled={!selectedColumn}
                        className="w-full bg-[rgba(6,12,24,0.9)] border border-white/15 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono transition-colors outline-none disabled:opacity-40 cursor-pointer"
                      >
                        {isNumeric ? (
                          <>
                            <option value="median">Median (robust)</option>
                            <option value="mean">Mean (average)</option>
                            <option value="drop_rows">Drop Null Rows</option>
                          </>
                        ) : (
                          <>
                            <option value="mode">Mode (frequent)</option>
                            <option value="drop_rows">Drop Null Rows</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Action: Add Button */}
                    <div className="sm:col-span-3 space-y-1.5 flex flex-col justify-end">
                      <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest opacity-0 hidden sm:block">
                        ACTION
                      </label>
                      <button
                        onClick={handleAddFillOperation}
                        disabled={!selectedColumn}
                        className="w-full px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-400/40 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ADD</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Imputations Queue */}
                  {fillOperations.length > 0 ? (
                    <div className="space-y-2 pt-2">
                      <span className="font-mono text-[10.5px] text-slate-400 uppercase tracking-widest block">
                        CONFIGURED IMPUTATIONS ({fillOperations.length})
                      </span>
                      <div className="space-y-2">
                        {fillOperations.map((op) => (
                          <div 
                            key={op.column} 
                            className="flex items-center justify-between p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/30"
                          >
                            <div className="flex items-center gap-2.5">
                              <Zap className="w-4 h-4 text-cyan-400" />
                              <div className="font-mono text-xs">
                                <span className="text-white font-bold">{op.column}</span>
                                <span className="text-slate-400"> → Impute using </span>
                                <span className="text-cyan-300 font-bold uppercase">{op.strategy}</span>
                              </div>
                            </div>

                            <button 
                              onClick={() => handleRemoveFillOperation(op.column!)}
                              title="Remove transformation"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-[rgba(6,12,24,0.4)] border border-white/5 font-mono text-[11px] text-slate-500 text-center">
                      No feature-level imputations configured yet. Select a column above to add an operation.
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------------- */}
                {/* 03 ACTIVE CLEANING PLAN SUMMARY                          */}
                {/* -------------------------------------------------------- */}
                <div className="p-4 rounded-xl bg-[rgba(6,12,24,0.7)] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>CLEANING PLAN SUMMARY</span>
                    </span>
                    <span className="font-mono text-xs text-cyan-300 font-semibold">
                      {totalOperationsCount} operation{totalOperationsCount === 1 ? '' : 's'} staged
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">ESTIMATED OUTPUT ROWS</span>
                      <span className="text-white font-bold text-sm block mt-0.5">
                        {estimatedRemainingRows.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">COLUMNS PRESERVED</span>
                      <span className="text-white font-bold text-sm block mt-0.5">
                        {profile.overview.total_columns}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-500 uppercase block">RESOLVED ANOMALIES</span>
                      <span className="text-emerald-400 font-bold text-sm block mt-0.5">
                        {estimatedDuplicateRemoval + fillOperations.length} rule{estimatedDuplicateRemoval + fillOperations.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard3D>
            </motion.section>
          </div>

          {/* ============================================================== */}
          {/* 4. TRANSFORMATION PIPELINE WORKFLOW (BOTTOM MAIN VISUAL)       */}
          {/* ============================================================== */}
          <motion.section variants={itemVariants} className="w-full relative z-[2]">
            <GlassCard3D 
              surfaceLevel={2} 
              accentColor="cyan"
              className="p-6 sm:p-8 relative overflow-hidden"
              style={{ isolation: 'isolate' }}
            >
              <div className="mb-6 text-center">
                <span className="font-mono text-[11px] text-cyan-400 font-semibold tracking-widest uppercase">
                  INTELLIGENT WORKFLOW PROGRESSION
                </span>
                <h3 className="text-lg sm:text-xl font-sans font-bold text-white tracking-tight mt-1">
                  Transformation Architecture
                </h3>
              </div>

              {/* Three Pipeline Nodes with Contained SVG Connector */}
              <div className="relative w-full max-w-4xl mx-auto py-3">
                {/* SVG Animated Connector Track (strictly bounded between node 1 and node 3) */}
                <div className="absolute top-1/2 -translate-y-1/2 left-[15%] right-[15%] h-[2px] hidden md:block pointer-events-none z-0 overflow-hidden">
                  <svg className="w-full h-[2px] overflow-hidden block" preserveAspectRatio="none">
                    <line x1="0%" y1="1" x2="100%" y2="1" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                    
                    {!prefersReducedMotion && (
                      <motion.line
                        x1="0%"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke="url(#cleaning-pipeline-gradient)"
                        strokeWidth="2"
                        strokeDasharray="16 28"
                        animate={{ strokeDashoffset: [0, -352] }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    
                    <defs>
                      <linearGradient id="cleaning-pipeline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* The 3 Stage Nodes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative z-[2]">
                  {/* Node 1: Raw Data */}
                  <div className="p-5 rounded-2xl bg-[rgba(6,12,24,0.95)] border border-white/10 text-center flex flex-col items-center justify-between min-h-[140px] backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 mb-2">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                        NODE 01
                      </div>
                      <div className="font-sans text-sm font-bold text-white mt-0.5">
                        RAW DATASET
                      </div>
                      <div className="font-mono text-xs text-slate-400 mt-1">
                        {profile.overview.total_rows} × {profile.overview.total_columns}
                      </div>
                    </div>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px] text-slate-400">
                      IMMUTABLE
                    </span>
                  </div>

                  {/* Node 2: Cleaning Engine */}
                  <div className={`p-5 rounded-2xl border text-center flex flex-col items-center justify-between min-h-[140px] backdrop-blur-md transition-all duration-300 ${
                    isCleaning 
                      ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.35)] scale-105' 
                      : 'bg-[rgba(6,12,24,0.95)] border-cyan-500/30 shadow-[0_8px_20px_rgba(0,0,0,0.5)]'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      isCleaning 
                        ? 'bg-cyan-500 border border-cyan-300 text-slate-950 animate-pulse' 
                        : 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300'
                    }`}>
                      <Cpu className={`w-5 h-5 ${isCleaning ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest">
                        NODE 02
                      </div>
                      <div className="font-sans text-sm font-bold text-white mt-0.5">
                        CLEANING ENGINE
                      </div>
                      <div className="font-mono text-xs text-cyan-300 mt-1">
                        {isCleaning ? 'PROCESSING RULES...' : `${totalOperationsCount} Rule(s) Configured`}
                      </div>
                    </div>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded font-mono text-[10px] ${
                      isCleaning 
                        ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 animate-pulse' 
                        : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                    }`}>
                      {isCleaning ? 'TRANSFORMING...' : 'TRANSFORM'}
                    </span>
                  </div>

                  {/* Node 3: Processed Artifact */}
                  <div className="p-5 rounded-2xl bg-[rgba(6,12,24,0.95)] border border-white/10 text-center flex flex-col items-center justify-between min-h-[140px] backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 mb-2">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                        NODE 03
                      </div>
                      <div className="font-sans text-sm font-bold text-white mt-0.5">
                        PROCESSED ARTIFACT
                      </div>
                      <div className="font-mono text-xs text-slate-400 mt-1">
                        ~{estimatedRemainingRows} rows output
                      </div>
                    </div>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono text-[10px] text-emerald-300">
                      ANALYSIS READY
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard3D>
          </motion.section>

          {/* Error Callout if Cleaning Fails */}
          {cleaningError && (
            <motion.div 
              variants={itemVariants} 
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs text-center flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{cleaningError}</span>
            </motion.div>
          )}

          {/* ============================================================== */}
          {/* 5. PRIMARY ACTION BAR (RUN CLEANING)                           */}
          {/* ============================================================== */}
          <motion.div 
            variants={itemVariants} 
            className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10"
          >
            <div className="text-xs text-slate-400 font-sans text-center sm:text-left">
              <span className="text-white font-semibold">Ready to generate artifact.</span> Raw source dataset will remain completely immutable.
            </div>

            <button
              onClick={executeCleaning}
              disabled={isCleaning || totalOperationsCount === 0}
              className={`w-full sm:w-auto px-8 py-4 primary-glow-button text-white rounded-xl text-sm font-sans font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2.5 min-w-[260px] shadow-[0_0_30px_rgba(34,211,238,0.25)] ${
                isCleaning || totalOperationsCount === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {isCleaning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>EXECUTING TRANSFORMATIONS...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>RUN CLEANING ({totalOperationsCount})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};
