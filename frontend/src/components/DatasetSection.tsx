import React, { useState } from 'react';
import { Database, Upload, FileSpreadsheet, HardDrive, Filter, Eye, RefreshCw } from 'lucide-react';
import { DatasetListResponse, DatasetProfileData, DatasetItem } from '../types';
import { DatasetUploadModal } from './DatasetUploadModal';
import { DatasetProfileView } from './DatasetProfileView';
import { fetchDatasetProfile } from '../services/api';

interface DatasetSectionProps {
  datasets: DatasetListResponse | null;
  onRefresh?: () => void;
}

export const DatasetSection: React.FC<DatasetSectionProps> = ({ datasets, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeProfile, setActiveProfile] = useState<DatasetProfileData | null>(null);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);

  const handleDatasetClick = async (item: DatasetItem) => {
    if (item.profile_data) {
      setActiveProfile(item.profile_data);
      return;
    }

    try {
      setLoadingProfileId(item.id);
      const profile = await fetchDatasetProfile(item.id);
      setActiveProfile(profile);
    } catch (err) {
      console.error('Failed to load profile for dataset:', err);
    } finally {
      setLoadingProfileId(null);
    }
  };

  const handleUploadSuccess = (profile: DatasetProfileData) => {
    setActiveProfile(profile);
    if (onRefresh) onRefresh();
  };

  if (activeProfile) {
    return (
      <DatasetProfileView
        profile={activeProfile}
        onBack={() => setActiveProfile(null)}
      />
    );
  }

  const items = datasets?.items || [];

  return (
    <div className="card-panel space-y-5">
      {/* Header & Upload Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-semibold text-white">Dataset Registry & Ingestion Pipeline</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono">
              Phase 1 Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload CSV datasets to trigger automated column profiling, missing value detection, and metric extraction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV Dataset</span>
          </button>
        </div>
      </div>

      {/* Dataset Filter & Search Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span>Filter registered datasets by name, status or path...</span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Total: <span className="text-white font-semibold">{items.length}</span>
        </div>
      </div>

      {/* Dataset Metadata Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold">Dataset Name</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Rows / Cols</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Registered At</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                  No datasets ingested yet. Click <strong className="text-sky-400">"Upload CSV Dataset"</strong> to profile your first CSV file.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleDatasetClick(item)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="font-mono text-xs">{item.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {item.status || 'profiled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {item.row_count ?? 'N/A'} rows × {item.column_count ?? 'N/A'} cols
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {item.file_size_bytes ? `${item.file_size_bytes} B` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDatasetClick(item);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium"
                    >
                      {loadingProfileId === item.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> View Profile
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800 flex items-start gap-3">
        <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400">
          <p className="font-medium text-slate-300">Phase 1 Ingestion Pipeline</p>
          <p className="mt-0.5">
            Uploaded CSV files are validated, stored securely in <code className="text-sky-300 bg-slate-900 px-1 rounded">data/raw/</code> with UUID keys, and profiled for column data types, missing ratios, and statistical distributions.
          </p>
        </div>
      </div>

      {/* Upload Modal */}
      <DatasetUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};
