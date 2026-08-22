import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Download, RefreshCw, Sparkles, Layers, Lightbulb, FileText, BrainCircuit } from 'lucide-react';
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
import { fetchDatasetQuality, fetchTransformationHistory, getDownloadUrl } from '../services/api';

interface DatasetProfileViewProps {
  profile: DatasetProfileData;
  onBack: () => void;
}

export const DatasetProfileView: React.FC<DatasetProfileViewProps> = ({ profile, onBack }) => {
  const { overview, quality, columns } = profile;

  const [activeTab, setActiveTab] = useState<'profile' | 'analytics' | 'insights' | 'executive' | 'ml'>('profile');
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
      {/* Top Action Header & Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Registry</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-mono">{overview.filename}</h2>
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                Profiled
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Dataset ID: {profile.dataset_id}</p>
          </div>
        </div>

        {/* Tab Buttons & Download */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'profile'
                  ? 'bg-emerald-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Profile & Cleaning</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Automated Analytics (EDA)</span>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'insights'
                  ? 'bg-amber-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-200" />
              <span>Business Insights</span>
            </button>

            <button
              onClick={() => setActiveTab('executive')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'executive'
                  ? 'bg-amber-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-200" />
              <span>Executive Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('ml')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'ml'
                  ? 'bg-purple-600 text-white shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-300" />
              <span>Predictive Analytics</span>
            </button>
          </div>

          <a
            href={getDownloadUrl(profile.dataset_id, 'raw')}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Download Raw CSV</span>
          </a>
        </div>
      </div>

      {activeTab === 'ml' ? (
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
