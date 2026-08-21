import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Database, Hash, Tag, Calendar, Download, RefreshCw } from 'lucide-react';
import { DatasetProfileData, DatasetQualityResponse, TransformationLogItem } from '../types';
import { ColumnProfileTable } from './ColumnProfileTable';
import { DataQualityCard } from './DataQualityCard';
import { DetectedIssuesList } from './DetectedIssuesList';
import { CleaningWorkflow } from './CleaningWorkflow';
import { TransformationHistory } from './TransformationHistory';
import { fetchDatasetQuality, fetchTransformationHistory, getDownloadUrl } from '../services/api';

interface DatasetProfileViewProps {
  profile: DatasetProfileData;
  onBack: () => void;
}

export const DatasetProfileView: React.FC<DatasetProfileViewProps> = ({ profile, onBack }) => {
  const { overview, quality, columns } = profile;

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

  const numericCols = columns.filter((c) => c.inferred_type === 'numeric' && c.numeric_stats);
  const categoricalCols = columns.filter(
    (c) => ['categorical', 'identifier', 'boolean', 'text'].includes(c.inferred_type) && c.categorical_stats
  );
  const datetimeCols = columns.filter((c) => c.inferred_type === 'datetime' && c.datetime_stats);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
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

        {/* Action Downloads */}
        <div className="flex items-center gap-2">
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

      {/* 5. TRANSFORMATION HISTORY AUDIT LOGS (Phase 2) */}
      {transformationLogs.length > 0 && (
        <TransformationHistory logs={transformationLogs} />
      )}

      {/* 6. COLUMN SPECIFICATIONS & MISSING VALUES (Phase 1) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-400" />
          <span>Column Specifications & Missing Values</span>
        </h3>
        <ColumnProfileTable columns={columns} />
      </div>

      {/* Numeric Columns Statistics Breakdown */}
      {numericCols.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-400" />
            <span>Numeric Statistics (Descriptive Metrics)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {numericCols.map((col) => {
              const stats = col.numeric_stats!;
              return (
                <div key={col.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-sm font-semibold text-white">{col.name}</span>
                    <span className="text-xs text-slate-400 font-mono">min-max span</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Min</span>
                      <span className="text-emerald-400 font-semibold">{stats.min ?? 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Max</span>
                      <span className="text-emerald-400 font-semibold">{stats.max ?? 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Mean</span>
                      <span className="text-slate-200">{stats.mean ?? 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Median (P50)</span>
                      <span className="text-slate-200">{stats.median ?? 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Std Dev</span>
                      <span className="text-slate-300">{stats.std ?? 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">IQR (P25 - P75)</span>
                      <span className="text-slate-300">{stats.p25} - {stats.p75}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categorical Distribution Breakdown */}
      {categoricalCols.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            <span>Categorical & Value Frequency Distribution</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoricalCols.map((col) => {
              const stats = col.categorical_stats!;
              return (
                <div key={col.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-sm font-semibold text-white">{col.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{stats.unique_count} unique</span>
                  </div>

                  <div className="space-y-2">
                    {stats.top_values.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300 truncate max-w-[180px]">{item.value}</span>
                          <span className="text-slate-400">{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Datetime Range Breakdown */}
      {datetimeCols.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>Datetime Timeline Ranges</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datetimeCols.map((col) => {
              const stats = col.datetime_stats!;
              return (
                <div key={col.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-sm font-semibold text-white">{col.name}</span>
                    <span className="text-xs text-purple-400 font-mono">{stats.date_range_days} days span</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Min Date</span>
                      <span className="text-purple-300">{stats.min_date || 'N/A'}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Max Date</span>
                      <span className="text-purple-300">{stats.max_date || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
