import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Download, RefreshCw, Sparkles, Layers, Lightbulb, FileText, BrainCircuit, Compass, ShieldCheck, TrendingUp, ShieldAlert } from 'lucide-react';

import { DatasetProfileData, DatasetQualityResponse, TransformationLogItem } from '../types';
import { ColumnProfileTable } from './ColumnProfileTable';
import { DataQualityCard } from './DataQualityCard';
import { DetectedIssuesList } from './DetectedIssuesList';
import { CleaningWorkflow } from './CleaningWorkflow';
import { TransformationHistory } from './TransformationHistory';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { InsightsDashboard } from './InsightsDashboard';
import { ExecutiveSummaryDashboard } from './ExecutiveSummaryDashboard';
import { MLInsightsDashboard } from './MLInsightsDashboard';
import { DemandForecastView } from './DemandForecastView';
import { AnomalyIntelligenceView } from './AnomalyIntelligenceView';
import { DecisionIntelligenceView } from './DecisionIntelligenceView';
import { DecisionCommandCenter } from './DecisionCommandCenter';
import { fetchDatasetQuality, fetchTransformationHistory, getDownloadUrl } from '../services/api';

interface DatasetProfileViewProps {
  profile: DatasetProfileData;
  onBack: () => void;
}

export const DatasetProfileView: React.FC<DatasetProfileViewProps> = ({ profile, onBack }) => {
  const { overview, quality, columns } = profile;

  const [activeTab, setActiveTab] = useState<'profile' | 'analytics' | 'insights' | 'executive' | 'ml' | 'forecast' | 'anomaly' | 'decision' | 'command_center'>('profile');
  const [qualityData, setQualityData] = useState<DatasetQualityResponse | null>(null);
  const [transformationLogs, setTransformationLogs] = useState<TransformationLogItem[]>([]);
  const [isLoadingQuality, setIsLoadingQuality] = useState<boolean>(true);

  const loadPhase2Data = useCallback(async () => {
    setIsLoadingQuality(true);
    try {
      const qRes = await fetchDatasetQuality(profile.dataset_id);
      setQualityData(qRes);
    } catch (err) {
      console.warn('Failed to fetch dataset quality score:', err);
    }

    try {
      const tRes = await fetchTransformationHistory(profile.dataset_id);
      setTransformationLogs(tRes.items || []);
    } catch (err) {
      console.warn('Failed to fetch transformation audit logs:', err);
    } finally {
      setIsLoadingQuality(false);
    }
  }, [profile.dataset_id]);

  useEffect(() => {
    loadPhase2Data();
  }, [loadPhase2Data]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Workspace Header */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/80 transition-all shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-sky-400" />
              <span>Back to Registry</span>
            </button>

            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white font-mono tracking-tight">{overview.filename}</h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full uppercase">
                  Profiled Dataset
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Dataset ID: <span className="text-sky-300">{profile.dataset_id}</span> • {overview.total_rows.toLocaleString()} rows × {overview.total_columns} cols • {formatBytes(overview.file_size_bytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getDownloadUrl(profile.dataset_id, 'raw')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Raw CSV</span>
            </a>
            <a
              href={getDownloadUrl(profile.dataset_id, 'processed')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cleaned CSV</span>
            </a>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold font-mono">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'profile'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4 text-sky-300" />
            <span>1. Profile & Cleaning</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>2. EDA Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'insights'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-amber-200" />
            <span>3. Business Insights</span>
          </button>

          <button
            onClick={() => setActiveTab('executive')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'executive'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-200" />
            <span>4. Executive Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('ml')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'ml'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BrainCircuit className="w-4 h-4 text-purple-300" />
            <span>5. Predictive ML & XGBoost</span>
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'forecast'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-sky-300" />
            <span>6. Demand Forecast</span>
          </button>

          <button
            onClick={() => setActiveTab('anomaly')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'anomaly'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-300" />
            <span>7. Anomaly Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('decision')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'decision'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-4 h-4 text-indigo-300" />
            <span>8. Decision Optimization</span>
          </button>

          <button
            onClick={() => setActiveTab('command_center')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'command_center'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>9. Command Center</span>
          </button>
        </div>
      </div>

      {activeTab === 'command_center' ? (
        <DecisionCommandCenter datasetId={profile.dataset_id} isProcessed={overview.duplicate_rows === 0 || transformationLogs.length > 0} />
      ) : activeTab === 'decision' ? (
        <DecisionIntelligenceView datasetId={profile.dataset_id} isProcessed={overview.duplicate_rows === 0 || transformationLogs.length > 0} />
      ) : activeTab === 'anomaly' ? (
        <AnomalyIntelligenceView datasetId={profile.dataset_id} />
      ) : activeTab === 'forecast' ? (
        <DemandForecastView datasetId={profile.dataset_id} />
      ) : activeTab === 'ml' ? (
        <MLInsightsDashboard datasetId={profile.dataset_id} />
      ) : activeTab === 'executive' ? (
        <ExecutiveSummaryDashboard datasetId={profile.dataset_id} />
      ) : activeTab === 'insights' ? (
        <InsightsDashboard datasetId={profile.dataset_id} />
      ) : activeTab === 'analytics' ? (
        <AnalyticsDashboard datasetId={profile.dataset_id} />
      ) : (

        <div className="space-y-6">

          {/* 1. DATASET OVERVIEW (Phase 1 KPI Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-400">Total Rows</div>
              <div className="text-xl font-bold font-mono text-white">{overview.total_rows.toLocaleString()}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-400">Total Columns</div>
              <div className="text-xl font-bold font-mono text-white">{overview.total_columns}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-400">File Size</div>
              <div className="text-xl font-bold font-mono text-white">{formatBytes(overview.file_size_bytes)}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-400">RAM Usage</div>
              <div className="text-xl font-bold font-mono text-white">{formatBytes(overview.memory_usage_bytes)}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-400">Duplicate Rows</div>
              <div className={`text-xl font-bold font-mono ${overview.duplicate_rows > 0 ? 'text-amber-400' : 'text-white'}`}>
                {overview.duplicate_rows} <span className="text-xs text-slate-400 font-normal">({overview.duplicate_row_percentage}%)</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-400">Empty Columns</div>
              <div className={`text-xl font-bold font-mono ${quality.empty_columns.length > 0 ? 'text-rose-400' : 'text-white'}`}>
                {quality.empty_columns.length}
              </div>
            </div>
          </div>

          {/* 2. DATA QUALITY SCORE (Phase 2) */}
          {isLoadingQuality ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              <span>Evaluating Data Quality Score...</span>
            </div>
          ) : qualityData ? (
            <DataQualityCard qualityData={qualityData} />
          ) : null}

          {/* 3. DETECTED QUALITY ISSUES (Phase 2) */}
          {qualityData && qualityData.issues && (
            <DetectedIssuesList issues={qualityData.issues} />
          )}

          {/* 4. CLEANING WORKFLOW (Phase 2 Plan, Preview, Apply) */}
          <CleaningWorkflow
            datasetId={profile.dataset_id}
            columns={columns}
            hasDuplicates={overview.duplicate_rows > 0}
            onApplySuccess={loadPhase2Data}
          />

          {/* 5. TRANSFORMATION AUDIT HISTORY */}
          <TransformationHistory logs={transformationLogs} />

          {/* 6. COLUMN SPECIFICATION & DESCRIPTIVE STATS */}
          <ColumnProfileTable columns={columns} />
        </div>
      )}
    </div>
  );
};

