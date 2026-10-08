import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Upload,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Sparkles,
  Search,
  Layers,
  Info,
  X,
  Copy,
  Check,
  GitCompare,
  Activity,
  Network,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DatasetRegistryItem } from '../types';
import { fetchProjectDatasets } from '../services/api';
import { DatasetVersionComparison } from './DatasetVersionComparison';
import { AnalysisRunHistory } from './AnalysisRunHistory';
import { InsightMemoryView } from './InsightMemoryView';
import { EvidenceGraphView } from './EvidenceGraphView';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface DatasetRegistryProps {
  projectId: string | null;
  projectName?: string;
  onSelectDataset: (datasetId: string, targetStage?: string) => void;
  onOpenUploadModal: () => void;
}

export const DatasetRegistry: React.FC<DatasetRegistryProps> = ({
  projectId,
  projectName = 'Hospital Operations',
  onSelectDataset,
  onOpenUploadModal,
}) => {
  const [datasets, setDatasets] = useState<DatasetRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<DatasetRegistryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [viewMode, setViewMode] = useState<'inventory' | 'comparison' | 'runs' | 'memory' | 'evidence'>('inventory');
  const [selectedCompId, setSelectedCompId] = useState<string | undefined>(undefined);
  const [selectedRunsDatasetId, setSelectedRunsDatasetId] = useState<string | undefined>(undefined);
  const [selectedMemoryDatasetId, setSelectedMemoryDatasetId] = useState<string | undefined>(undefined);
  const [selectedEvidenceDatasetId, setSelectedEvidenceDatasetId] = useState<string | undefined>(undefined);
  const [selectedEvidenceDatasetName, setSelectedEvidenceDatasetName] = useState<string>('Dataset');

  const loadDatasets = useCallback(async () => {
    if (!projectId) {
      // Keep loading while project is being initialized
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectDatasets(projectId);
      setDatasets(res.datasets || []);
    } catch (err: any) {
      console.error('Failed to load dataset registry:', err);
      setError(err.message || 'Unable to load dataset registry.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return 'Unknown';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const filteredDatasets = datasets.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0);
  const validScores = datasets.map((d) => d.quality_score).filter((s): s is number => s !== null && s !== undefined);
  const avgQuality = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : null;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 font-sans">
      {/* 1. REGISTRY HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-premium border border-[rgba(34,211,238,0.15)] shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded bg-accent-cyan/15 border border-accent-cyan/30 text-[9px] font-mono font-bold text-accent-cyan tracking-widest uppercase">
              DATASET REGISTRY
            </span>
            <span className="font-mono text-[9px] text-slate-400 tracking-wider">
              PROJECT: <strong className="text-white">{projectName}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Registered Datasets
            <span className="font-mono text-xs font-normal text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              {datasets.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Persistent repository of raw sources and cleaned intelligence datasets supporting the 11-stage decision pipeline.
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={loadDatasets}
            disabled={loading}
            title="Refresh registry"
            className="p-2.5 rounded-xl border border-white/10 hover:border-accent-cyan/30 bg-[#040C18]/80 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent-cyan' : ''}`} />
          </button>

          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue hover:opacity-90 text-[#02060D] font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
            UPLOAD DATASET
          </button>
        </div>
      </div>

      {/* VIEW MODE TOGGLE TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setViewMode('inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            viewMode === 'inventory'
              ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          DATASET INVENTORY ({datasets.length})
        </button>

        <button
          onClick={() => setViewMode('comparison')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            viewMode === 'comparison'
              ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          VERSION COMPARISON & "WHAT CHANGED?"
        </button>
        <button
          onClick={() => {
            setSelectedRunsDatasetId(undefined);
            setViewMode('runs');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            viewMode === 'runs'
              ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          ANALYSIS RUNS & REPRODUCIBILITY
        </button>

        <button
          onClick={() => {
            setSelectedMemoryDatasetId(undefined);
            setViewMode('memory');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            viewMode === 'memory'
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          AI INSIGHT MEMORY & IMPACT
        </button>

        <button
          onClick={() => {
            if (!selectedEvidenceDatasetId && datasets.length > 0) {
              setSelectedEvidenceDatasetId(datasets[0].id);
              setSelectedEvidenceDatasetName(datasets[0].name);
            }
            setViewMode('evidence');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            viewMode === 'evidence'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Network className="w-3.5 h-3.5 text-rose-400" />
          DECISION EVIDENCE & TRACEABILITY
        </button>
      </div>

      {viewMode === 'comparison' ? (
        <DatasetVersionComparison
          projectId={projectId || ''}
          projectName={projectName}
          initialCompId={selectedCompId}
          onClose={() => setViewMode('inventory')}
        />
      ) : viewMode === 'runs' ? (
        <AnalysisRunHistory
          projectId={projectId}
          datasetId={selectedRunsDatasetId}
        />
      ) : viewMode === 'memory' ? (
        <InsightMemoryView
          projectId={projectId}
          datasetId={selectedMemoryDatasetId}
          onClearDatasetFilter={() => setSelectedMemoryDatasetId(undefined)}
        />
      ) : viewMode === 'evidence' ? (
        <EvidenceGraphView
          datasetId={selectedEvidenceDatasetId || (datasets.length > 0 ? datasets[0].id : '')}
          datasetName={selectedEvidenceDatasetName || (datasets.length > 0 ? datasets[0].name : 'Dataset')}
          version={datasets.find((d) => d.id === selectedEvidenceDatasetId)?.version}
        />
      ) : (
        <>
          {/* 2. STATS OVERVIEW BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-panel-premium border border-white/5 flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] text-slate-400 tracking-widest uppercase">TOTAL DATASETS</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{datasets.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-accent-cyan">
            <Database className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel-premium border border-white/5 flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] text-slate-400 tracking-widest uppercase">COMBINED VOLUME</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">
              {totalRows > 0 ? totalRows.toLocaleString() : '0'} <span className="text-xs text-slate-400 font-sans">rows</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent-electricBlue/10 border border-accent-electricBlue/20 flex items-center justify-center text-accent-electricBlue">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel-premium border border-white/5 flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] text-slate-400 tracking-widest uppercase">AVG QUALITY RATING</div>
            <div className="text-xl font-bold text-accent-cyan mt-1 font-mono">
              {avgQuality !== null ? `${avgQuality}%` : 'N/A'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent-success/10 border border-accent-success/20 flex items-center justify-center text-accent-success">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. SEARCH / FILTER CONTROLS */}
      {datasets.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search datasets by filename or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#040C18]/80 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 focus:shadow-[0_0_12px_rgba(34,211,238,0.15)] transition-all"
            />
          </div>
        </div>
      )}

      {/* 4. CONTENT STATES */}

      {/* Loading state */}
      {loading && (
        <div className="py-6">
          <ContinuousIntelligenceEngine
            mode="runs"
            active={loading}
            title="SYNCHRONIZING DATASET REGISTRY"
            description={`Retrieving dataset catalogue, schema versions, cleaning logs, and intelligence runs for project ${projectName}...`}
            metrics={[
              { label: 'PROJECT', value: projectName },
              { label: 'CATALOGUE', value: 'INDEXING' },
              { label: 'REGISTRY', value: 'SYNCING' }
            ]}
          />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-8 rounded-2xl bg-accent-error/10 border border-accent-error/30 flex flex-col items-center justify-center text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-accent-error" />
          <h4 className="text-sm font-bold text-white">Failed to Load Registry</h4>
          <p className="text-xs text-slate-400 max-w-md">{error}</p>
          <button
            onClick={loadDatasets}
            className="mt-2 px-4 py-1.5 rounded-lg border border-accent-error/40 hover:bg-accent-error/20 text-accent-error font-mono text-xs font-bold transition-all"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && projectId && datasets.length === 0 && (
        <div className="p-12 rounded-2xl glass-panel-premium border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0A1930] border border-accent-cyan/20 flex items-center justify-center text-accent-cyan shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">No Datasets Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              There are no datasets registered under project &ldquo;{projectName}&rdquo; yet. Upload a CSV file to begin automated profiling and decision analysis.
            </p>
          </div>
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue hover:opacity-90 text-[#02060D] font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
            UPLOAD FIRST DATASET
          </button>
        </div>
      )}

      {/* Dataset Grid / Cards */}
      {!loading && !error && filteredDatasets.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {filteredDatasets.map((ds) => {
            const isCleaned = ds.is_processed || ds.name.includes('cleaned');
            const score = ds.quality_score;

            return (
              <motion.div
                key={ds.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl glass-panel-premium border border-white/10 hover:border-accent-cyan/30 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.3)] group relative overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left info */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#041224] border border-accent-cyan/20 flex items-center justify-center text-accent-cyan shrink-0 group-hover:border-accent-cyan/50 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-base font-bold text-white truncate max-w-md group-hover:text-accent-cyan transition-colors">
                          {ds.name}
                        </span>

                        {/* Version & Lineage Badges */}
                        {!isCleaned ? (
                          <>
                            <span className="px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase border bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30">
                              v{ds.version || 1}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase border bg-accent-electricBlue/15 text-accent-electricBlue border-accent-electricBlue/30">
                              RAW SOURCE
                            </span>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase border bg-accent-violet/15 text-accent-violet border-accent-violet/30">
                            PROCESSED ARTIFACT (v{ds.version || 1})
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wider uppercase border flex items-center gap-1 ${
                            ds.status === 'READY'
                              ? 'bg-accent-success/15 text-accent-success border-accent-success/30'
                              : ds.status === 'PROCESSING'
                              ? 'bg-amber-400/15 text-amber-400 border-amber-400/30 animate-pulse'
                              : 'bg-accent-error/15 text-accent-error border-accent-error/30'
                          }`}
                        >
                          {ds.status === 'READY' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {ds.status}
                        </span>
                      </div>

                      {/* Description or ID snippet */}
                      <p className="text-xs text-slate-400 truncate max-w-xl">
                        {isCleaned && ds.parent_id ? (
                          <span className="text-accent-violet/90 font-mono text-[11px]">
                            Derived from parent raw dataset ({ds.parent_id.slice(0, 8)}...) •{' '}
                          </span>
                        ) : null}
                        {ds.description || `ID: ${ds.id}`}
                      </p>

                      {/* Technical Specs row */}
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 uppercase">Rows:</span>
                          <span className="font-bold text-white">
                            {ds.row_count !== null && ds.row_count !== undefined ? ds.row_count.toLocaleString() : 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 uppercase">Columns:</span>
                          <span className="font-bold text-white">
                            {ds.column_count !== null && ds.column_count !== undefined ? ds.column_count : 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 uppercase">Size:</span>
                          <span className="text-slate-300">{formatFileSize(ds.file_size_bytes)}</span>
                        </div>

                        {score !== null && score !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 uppercase">Quality:</span>
                            <span
                              className={`font-bold ${
                                score >= 90
                                  ? 'text-accent-success'
                                  : score >= 70
                                  ? 'text-amber-400'
                                  : 'text-accent-error'
                              }`}
                            >
                              {score}%
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatDate(ds.updated_at || ds.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/5">
                    <button
                      onClick={() => {
                        setSelectedCompId(ds.id);
                        setViewMode('comparison');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-accent-cyan/25 hover:border-accent-cyan/50 bg-accent-cyan/10 hover:bg-accent-cyan/20 text-accent-cyan text-xs font-mono transition-all flex items-center gap-1.5 font-bold"
                      title="Compare this dataset version against another"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      COMPARE
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRunsDatasetId(ds.id);
                        setViewMode('runs');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-indigo-500/25 hover:border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-mono transition-all flex items-center gap-1.5 font-bold"
                      title="View analysis runs for this dataset"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      RUNS
                    </button>

                    <button
                      onClick={() => {
                        setSelectedMemoryDatasetId(ds.id);
                        setViewMode('memory');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-purple-500/25 hover:border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-mono transition-all flex items-center gap-1.5 font-bold"
                      title="View AI insight memory and impact for this dataset"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      MEMORY
                    </button>

                    <button
                      onClick={() => {
                        setSelectedEvidenceDatasetId(ds.id);
                        setSelectedEvidenceDatasetName(ds.name);
                        setViewMode('evidence');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/25 hover:border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono transition-all flex items-center gap-1.5 font-bold"
                      title="Trace decision evidence graph for this dataset"
                    >
                      <Network className="w-3.5 h-3.5" />
                      EVIDENCE
                    </button>

                    <button
                      onClick={() => setSelectedDetails(ds)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 bg-white/[0.03] text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5" />
                      DETAILS
                    </button>

                    {/* Stage Launcher Shortcuts */}
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        onClick={() => onSelectDataset(ds.id, 'QUALITY')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-[10px] font-mono text-slate-400 hover:text-accent-cyan transition-colors"
                      >
                        QUALITY
                      </button>
                      <button
                        onClick={() => onSelectDataset(ds.id, 'ANALYSIS')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-[10px] font-mono text-slate-400 hover:text-accent-cyan transition-colors"
                      >
                        ANALYSIS
                      </button>
                      <button
                        onClick={() => onSelectDataset(ds.id, 'PREDICTIONS')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-[10px] font-mono text-slate-400 hover:text-accent-cyan transition-colors"
                      >
                        PREDICT
                      </button>
                    </div>

                    {/* Primary Open Button */}
                    <button
                      onClick={() => onSelectDataset(ds.id, 'OVERVIEW')}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/40 text-accent-cyan hover:text-white text-xs font-mono font-bold tracking-wider transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    >
                      OPEN
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 5. TECHNICAL DETAILS DRAWER / MODAL */}
      <AnimatePresence>
        {selectedDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl border border-[rgba(34,211,238,0.25)] bg-[#040C18] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.8)] font-sans relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent-cyan/15 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white truncate max-w-sm">
                      {selectedDetails.name}
                    </h3>
                    <span className="font-mono text-[8px] text-accent-cyan tracking-wider uppercase">
                      TECHNICAL METADATA & PIPELINE SPECS
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetails(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="py-4 space-y-3 font-mono text-xs">
                {/* ID with copy */}
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">DATASET ID</span>
                    <span className="text-slate-300 select-all">{selectedDetails.id}</span>
                  </div>
                  <button
                    onClick={() => handleCopyId(selectedDetails.id)}
                    className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-accent-cyan transition-colors"
                    title="Copy Dataset ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-accent-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase block">ROW COUNT</span>
                    <span className="text-sm font-bold text-white">
                      {selectedDetails.row_count?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase block">COLUMN COUNT</span>
                    <span className="text-sm font-bold text-white">
                      {selectedDetails.column_count || 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase block">FILE SIZE</span>
                    <span className="text-sm font-bold text-white">
                      {formatFileSize(selectedDetails.file_size_bytes)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase block">QUALITY SCORE</span>
                    <span className="text-sm font-bold text-accent-cyan">
                      {selectedDetails.quality_score !== null && selectedDetails.quality_score !== undefined
                        ? `${selectedDetails.quality_score}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Lineage & Storage */}
                <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">LINEAGE RELATIONSHIP:</span>
                    <span className="text-white font-semibold">
                      {selectedDetails.is_processed ? 'Cleaned derivative' : 'Raw primary input'}
                    </span>
                  </div>
                  {selectedDetails.parent_id && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">PARENT RAW DATASET:</span>
                      <span className="text-accent-cyan">{selectedDetails.parent_id.slice(0, 12)}...</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">STORAGE KEY:</span>
                    <span className="text-slate-300 truncate max-w-[280px]">
                      {selectedDetails.file_path || 'Default storage path'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">CREATED:</span>
                    <span className="text-slate-300">{formatDate(selectedDetails.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Stage Jump */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[9px] font-mono text-slate-500 uppercase">
                  LAUNCH PIPELINE STAGE:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['OVERVIEW', 'QUALITY', 'ANALYSIS', 'INSIGHTS', 'PREDICTIONS', 'DECISIONS'].map((stg) => (
                    <button
                      key={stg}
                      onClick={() => {
                        onSelectDataset(selectedDetails.id, stg);
                        setSelectedDetails(null);
                      }}
                      className="px-2.5 py-1 rounded bg-accent-cyan/10 hover:bg-accent-cyan/20 text-[9.5px] font-mono font-bold text-accent-cyan border border-accent-cyan/30 transition-colors"
                    >
                      {stg}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedRunsDatasetId(selectedDetails.id);
                      setViewMode('runs');
                      setSelectedDetails(null);
                    }}
                    className="px-2.5 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-[9.5px] font-mono font-bold text-indigo-300 border border-indigo-500/40 transition-colors flex items-center gap-1"
                  >
                    <Activity className="w-3 h-3" />
                    RUNS
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
};
