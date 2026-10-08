import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  Database,
  FileText,
  ChevronRight,
  Search,
  BarChart3,
  ArrowRight,
  Loader2,
  Lock,
  LogIn
} from 'lucide-react';
import { fetchExistingDatasets, uploadDataset } from '../services/api';
import { DatasetProfileData, ExistingDatasetSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { UploadProfilingLoader } from './UploadProfilingLoader';

interface PreUploadWorkspaceProps {
  projectId?: string | null;
  projectName?: string;
  onSelectDataset: (datasetId: string) => void;
  onOpenUploadModal?: () => void;
  onNavigateToRegistry: () => void;
  onDatasetUploaded?: (profile: DatasetProfileData) => void;
}

export const PreUploadWorkspace: React.FC<PreUploadWorkspaceProps> = ({
  projectId = null,
  onSelectDataset,
  onNavigateToRegistry,
  onDatasetUploaded,
}) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [existingDatasets, setExistingDatasets] = useState<ExistingDatasetSummary[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load actual persisted datasets from real API ONLY IF AUTHENTICATED
  useEffect(() => {
    let isMounted = true;
    if (!isAuthenticated) {
      setExistingDatasets([]);
      setLoadingDatasets(false);
      return;
    }

    const load = async () => {
      setLoadingDatasets(true);
      try {
        const res = await fetchExistingDatasets(projectId || undefined);
        if (isMounted) {
          setExistingDatasets(res.items.slice(0, 4));
          setLoadingDatasets(false);
        }
      } catch (err) {
        console.warn('Failed to load existing datasets:', err);
        if (isMounted) {
          setExistingDatasets([]);
          setLoadingDatasets(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [projectId, isAuthenticated]);

  const formatUploadDate = (isoStr?: string | null): string => {
    if (!isoStr) return 'Recently';
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Updated today';
      if (diffDays === 1) return 'Updated yesterday';
      if (diffDays < 7) return `Updated ${diffDays} days ago`;
      if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
      return `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } catch {
      return 'Updated recently';
    }
  };

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes) return '4.6 MB';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const getStatusBadge = (status?: string, isProcessed?: boolean) => {
    const s = (status || '').toUpperCase();
    if (isProcessed || s === 'PROCESSED' || s === 'READY') {
      return {
        label: 'Processed',
        bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
      };
    }
    if (s.includes('CLEAN')) {
      return {
        label: 'Cleaning',
        bg: 'bg-blue-500/15 border-blue-500/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
      };
    }
    return {
      label: 'Quality Check',
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    };
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFileUpload(e.target.files[0]);
    }
  };

  const handleResetUpload = () => {
    setUploadStatus('idle');
    setIsUploading(false);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFileUpload = async (file: File) => {
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Only CSV files (.csv) are supported.');
      setUploadStatus('error');
      return;
    }

    if (file.size > 52_428_800) {
      setUploadError('File size exceeds the 50MB limit.');
      setUploadStatus('error');
      return;
    }

    setIsUploading(true);
    setUploadStatus('loading');
    const uploadStartTime = Date.now();
    try {
      const profile = await uploadDataset(file, projectId || undefined);
      // Ensure users see the smooth intelligence pipeline transition for at least 1200ms
      const uploadElapsed = Date.now() - uploadStartTime;
      if (uploadElapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - uploadElapsed));
      }
      setUploadStatus('success');
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('idle');
        if (onDatasetUploaded) {
          onDatasetUploaded(profile);
        } else {
          onSelectDataset(profile.dataset_id);
        }
      }, 700);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload dataset.');
      setUploadStatus('error');
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full px-8 sm:px-12 lg:px-16 py-6 lg:py-8 flex flex-col justify-start relative z-10 min-w-0 box-border">
      
      {/* ============================================================== */}
      {/* 1. SECTION TITLE & HERO (PART O) */}
      {/* ============================================================== */}
      <div className="mb-8 md:mb-10 text-left min-w-0">
        
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 mb-3"
        >
          <div className="w-1.5 h-1.5 bg-cyan-400 rotate-45 shrink-0 shadow-[0_0_8px_#22D3EE]" />
          <span className="font-sans text-[12px] font-bold text-cyan-400 tracking-widest uppercase">
            DATA WORKSPACE
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="text-[44px] sm:text-[52px] lg:text-[56px] font-sans font-extrabold text-white leading-[1.1] tracking-tight"
        >
          Turn Your Data Into{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
            Real Impact
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mt-3.5 text-[17px] sm:text-[19px] text-slate-400 font-sans max-w-3xl leading-relaxed font-normal"
        >
          Upload a new dataset or choose from your existing datasets to start the intelligence pipeline.
        </motion.p>
      </div>

      {/* ============================================================== */}
      {/* 2. TWO PRIMARY INTERACTIVE ACTION CARDS (PART P, Q, R, S) */}
      {/* ============================================================== */}
      <div className="relative w-full mb-10 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 relative z-[20] w-full min-w-0">
          
          {/* CARD 1: UPLOAD A NEW DATASET */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-[24px] p-8 sm:p-10 lg:p-12 min-h-[480px] bg-[rgba(8,15,28,0.78)] border border-[rgba(148,163,184,0.14)] hover:border-cyan-500/40 hover:bg-[rgba(12,22,40,0.85)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_15px_50px_rgba(0,0,0,0.6),0_0_35px_rgba(34,211,238,0.12)] backdrop-blur-2xl flex flex-col justify-between group min-w-0 select-none"
          >
            {/* Top inner subtle highlight */}
            <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

            <div>
              {/* Header */}
              <div className="flex items-start gap-4 sm:gap-5 mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.25)] shrink-0 group-hover:scale-105 group-hover:border-cyan-400 transition-all duration-200">
                  <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[24px] sm:text-[28px] font-sans font-bold text-white tracking-tight leading-tight">
                    Upload a New Dataset
                  </h2>
                  <p className="text-[14px] sm:text-[15px] text-slate-400 font-sans mt-1.5 leading-relaxed">
                    Upload your CSV file to begin the analysis pipeline and generate actionable insights.
                  </p>
                </div>
              </div>

              {/* Drag & Drop Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              
              {uploadStatus !== 'idle' ? (
                <UploadProfilingLoader
                  status={uploadStatus}
                  errorMessage={uploadError}
                  onRetry={handleResetUpload}
                  className="mt-2 mb-4"
                />
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleFileDrop}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className={`w-full rounded-[20px] border-2 border-dashed p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 mt-2 mb-4 relative overflow-hidden min-h-[200px] sm:min-h-[220px] group/drop ${
                    dragActive
                      ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_30px_rgba(34,211,238,0.25)]'
                      : 'border-white/10 hover:border-cyan-500/40 bg-[rgba(15,22,38,0.4)] hover:bg-[rgba(15,22,38,0.7)]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-cyan-400 mb-3.5 transition-all duration-200 group-hover/drop:-translate-y-1 ${
                    dragActive ? 'bg-cyan-500/25 shadow-[0_0_20px_rgba(34,211,238,0.5)] scale-110 -translate-y-1' : 'bg-cyan-500/10 group-hover/drop:bg-cyan-500/20 group-hover/drop:shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                  }`}>
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className={`text-[16px] sm:text-[17px] font-sans font-medium mb-1 transition-colors ${dragActive ? 'text-white' : 'text-slate-200 group-hover/drop:text-white'}`}>
                    Drag & drop your CSV file here
                  </span>
                  <span className={`text-[13px] sm:text-[14px] font-sans transition-colors ${dragActive ? 'text-cyan-200' : 'text-slate-500 group-hover/drop:text-slate-400'}`}>
                    or click to browse
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    fileInputRef.current?.click();
                  }
                }}
                disabled={isUploading}
                className="w-full h-[50px] sm:h-[52px] rounded-xl font-sans font-semibold text-[15px] text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_35px_rgba(34,211,238,0.45)] hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 hover:-translate-y-[1px] active:translate-y-0 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing Dataset...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    <span>Choose File / Upload Dataset</span>
                  </>
                )}
              </button>
              <div className="text-center mt-3 text-xs sm:text-[13px] font-sans text-slate-400">
                Supports CSV datasets up to 50MB
              </div>
            </div>
          </motion.div>

          {/* CARD 2: USE AN EXISTING DATASET */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="relative rounded-[24px] p-8 sm:p-10 lg:p-12 min-h-[480px] bg-[rgba(8,15,28,0.78)] border border-[rgba(148,163,184,0.14)] hover:border-purple-500/40 hover:bg-[rgba(12,22,40,0.85)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_15px_50px_rgba(0,0,0,0.6),0_0_35px_rgba(168,85,247,0.12)] backdrop-blur-2xl flex flex-col justify-between group min-w-0 select-none"
          >
            {/* Top inner subtle highlight */}
            <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent pointer-events-none" />

            <div>
              {/* Header */}
              <div className="flex items-start gap-4 sm:gap-5 mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.25)] shrink-0 group-hover:scale-105 group-hover:border-purple-400 transition-all duration-200">
                  <Database className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[24px] sm:text-[28px] font-sans font-bold text-white tracking-tight leading-tight">
                    Open Existing Dataset / Project
                  </h2>
                  <p className="text-[14px] sm:text-[15px] text-slate-400 font-sans mt-1.5 leading-relaxed">
                    {isAuthenticated 
                      ? 'Choose from your previously uploaded datasets and continue your analysis.'
                      : 'Sign in to access your datasets and projects.'}
                  </p>
                </div>
              </div>

              {/* BODY: CONDITIONAL ON REAL AUTHENTICATION */}
              {!isAuthenticated ? (
                /* Unauthenticated State (PART B & J) */
                <div className="py-10 px-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center my-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3.5 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="text-[16px] font-sans font-bold text-white mb-1">
                    Authentication Required
                  </h3>
                  <p className="text-[13px] text-slate-400 font-sans max-w-xs mb-5">
                    Sign in to access your protected dataset registry, version lineage, and insights.
                  </p>
                  <button
                    type="button"
                    onClick={openAuthModal}
                    className="h-10 px-5 rounded-xl font-sans font-semibold text-[13px] text-white bg-gradient-to-r from-purple-600 to-cyan-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                </div>
              ) : (
                /* Authenticated State: Real Dataset List (PART J & S) */
                <div className="space-y-2 mt-2 mb-4">
                  {loadingDatasets ? (
                    <div className="space-y-2.5 py-2">
                      <div className="h-14 rounded-xl bg-white/[0.03] animate-pulse border border-white/5" />
                      <div className="h-14 rounded-xl bg-white/[0.03] animate-pulse border border-white/5" />
                      <div className="h-14 rounded-xl bg-white/[0.03] animate-pulse border border-white/5" />
                    </div>
                  ) : existingDatasets.length > 0 ? (
                    existingDatasets.map((ds) => {
                      const badge = getStatusBadge(ds.status, ds.is_processed);
                      return (
                        <div
                          key={ds.id}
                          onClick={() => onSelectDataset(ds.id)}
                          className="p-3 sm:p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/40 cursor-pointer transition-all duration-180 flex items-center justify-between group/row hover:translate-x-[3px] shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0 group-hover/row:border-purple-500/50 group-hover/row:scale-105 group-hover/row:shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14px] sm:text-[15px] font-sans font-semibold text-slate-200 group-hover/row:text-white transition-colors truncate">
                                {ds.name}
                              </div>
                              <div className="text-[12px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{formatFileSize(ds.file_size_bytes)}</span>
                                <span>·</span>
                                <span>{formatUploadDate(ds.created_at)}</span>
                                {ds.column_count !== undefined && ds.column_count !== null && ds.column_count > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{ds.column_count} columns</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500 group-hover/row:text-purple-300 group-hover/row:translate-x-1 transition-all shrink-0" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 px-4 text-center rounded-xl bg-white/[0.01] border border-white/5">
                      <p className="text-sm text-slate-300 font-sans font-medium mb-1">
                        No datasets registered in this project yet
                      </p>
                      <p className="text-xs text-slate-500 font-sans">
                        Upload your first dataset on the left to begin analysis.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={isAuthenticated ? onNavigateToRegistry : openAuthModal}
                className="w-full h-[50px] sm:h-[52px] rounded-xl font-sans font-semibold text-[15px] text-slate-200 hover:text-white bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-white/10 hover:border-purple-500/40 shadow-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Search className="w-4 h-4 text-purple-400" />
                <span>Browse All Datasets in Registry</span>
              </button>
              <div className="text-center mt-3 text-xs sm:text-[13px] font-sans text-slate-400">
                View project dataset versions & comparisons
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. "FROM DATA TO DECISIONS" 4-STEP PIPELINE (PART T) */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="w-full min-w-0 mt-6 relative z-[20]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-[20px] sm:text-[22px] font-sans font-bold text-white tracking-tight">
              From Data to Decisions
            </h3>
            <p className="text-[14px] sm:text-[15px] text-slate-400 font-sans mt-1 font-normal">
              A simple pipeline to turn your data into real-world impact.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToRegistry}
            className="text-[14px] font-sans font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 self-start sm:self-auto shrink-0 transition-colors cursor-pointer group"
          >
            <span>View Full Pipeline</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 4 Steps Row - Connected Cards with Arrows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 relative min-w-0 w-full">
          
          {/* Step 1 */}
          <div className="p-6 rounded-[20px] bg-[rgba(8,15,28,0.78)] border border-[rgba(148,163,184,0.14)] flex flex-col items-start gap-4 min-w-0 relative group hover:border-cyan-500/40 hover:bg-[rgba(12,22,40,0.85)] hover:-translate-y-[2px] transition-all duration-200 w-full min-h-[140px] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.15)]">
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-[13px] font-mono font-bold text-slate-500 group-hover:text-cyan-400 transition-colors">01</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] sm:text-[17px] font-sans font-bold text-white mb-1">
                Add Your Data
              </div>
              <div className="text-[13px] sm:text-[14px] text-slate-400 font-sans leading-snug">
                Upload a new dataset or select an existing one.
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-[20px] bg-[rgba(8,15,28,0.78)] border border-[rgba(148,163,184,0.14)] flex flex-col items-start gap-4 min-w-0 relative group hover:border-blue-500/40 hover:bg-[rgba(12,22,40,0.85)] hover:-translate-y-[2px] transition-all duration-200 w-full min-h-[140px] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]">
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 group-hover:bg-blue-500/20 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all">
                <Database className="w-5 h-5" />
              </div>
              <div className="text-[13px] font-mono font-bold text-slate-500 group-hover:text-blue-400 transition-colors">02</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] sm:text-[17px] font-sans font-bold text-white mb-1">
                Run the Pipeline
              </div>
              <div className="text-[13px] sm:text-[14px] text-slate-400 font-sans leading-snug">
                Quality check, cleaning, analysis and AI insights.
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-[20px] bg-[rgba(8,15,28,0.78)] border border-[rgba(148,163,184,0.14)] flex flex-col items-start gap-4 min-w-0 relative group hover:border-purple-500/40 hover:bg-[rgba(12,22,40,0.85)] hover:-translate-y-[2px] transition-all duration-200 w-full min-h-[140px] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.15)]">
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 group-hover:bg-purple-500/20 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-[13px] font-mono font-bold text-slate-500 group-hover:text-purple-400 transition-colors">03</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] sm:text-[17px] font-sans font-bold text-white mb-1">
                Make Decisions
              </div>
              <div className="text-[13px] sm:text-[14px] text-slate-400 font-sans leading-snug">
                Get recommendations and take action.
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-6 rounded-[20px] bg-[rgba(8,15,28,0.78)] border border-[rgba(148,163,184,0.14)] flex flex-col items-start gap-4 min-w-0 relative group hover:border-indigo-500/40 hover:bg-[rgba(12,22,40,0.85)] hover:-translate-y-[2px] transition-all duration-200 w-full min-h-[140px] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.15)]">
            <div className="flex items-center justify-between w-full">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 group-hover:bg-indigo-500/20 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="text-[13px] font-mono font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">04</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] sm:text-[17px] font-sans font-bold text-white mb-1">
                Track Impact
              </div>
              <div className="text-[13px] sm:text-[14px] text-slate-400 font-sans leading-snug">
                Monitor outcomes and continuously learn.
              </div>
            </div>
          </div>

        </div>
      </motion.div>

    </div>
  );
};
