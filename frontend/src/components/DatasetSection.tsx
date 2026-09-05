import React, { useState } from 'react';
import { Database, Upload, FileSpreadsheet, HardDrive, Search, Eye, RefreshCw } from 'lucide-react';

import { DatasetListResponse, DatasetProfileData, DatasetItem } from '../types';
import { DatasetUploadModal } from './DatasetUploadModal';
import { DatasetProfileView } from './DatasetProfileView';
import { fetchDatasetProfile } from '../services/api';

interface DatasetSectionProps {
  datasets: DatasetListResponse | null;
  onRefresh?: () => void;
  onSelectDataset?: (id: string, name: string) => void;
}

export const DatasetSection: React.FC<DatasetSectionProps> = ({ datasets, onRefresh, onSelectDataset }) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeProfile, setActiveProfile] = useState<DatasetProfileData | null>(null);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleDatasetClick = async (item: DatasetItem) => {
    if (onSelectDataset) {
      onSelectDataset(item.id, item.name);
    }
    
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

  const rawItems = datasets?.items || [];
  const filteredItems = rawItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.status && item.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  return (
    <div className="card-panel space-y-6">
      {/* Upload Controls for Table */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue hover:from-accent-cyan/80 hover:to-accent-blue/80 text-white rounded-full text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Ingest Dataset</span>
        </button>
      </div>

      {/* Dataset Search Bar & Counter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 flex items-center gap-2.5 focus-within:border-indigo-500/50 transition-colors">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search registered datasets by filename, status or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
          />
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center justify-between sm:justify-start gap-2">
          <span>Registered Datasets:</span>
          <span className="text-white font-bold">{filteredItems.length} / {rawItems.length}</span>
        </div>
      </div>

      {/* Dataset Metadata Table */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-2xl bg-slate-950/40">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] font-mono border-b border-slate-800/80">
            <tr>
              <th className="px-4 py-3.5 font-bold">Dataset Name</th>
              <th className="px-4 py-3.5 font-bold">Status</th>
              <th className="px-4 py-3.5 font-bold">Rows × Cols</th>
              <th className="px-4 py-3.5 font-bold">Size</th>
              <th className="px-4 py-3.5 font-bold">Ingested Date</th>
              <th className="px-4 py-3.5 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 bg-slate-900/30">
            {rawItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Database className="w-8 h-8 text-slate-500 mb-2" />
                    <h3 className="text-lg font-sans text-white">No datasets found</h3>
                    <p className="text-slate-400 font-sans text-sm pb-4">Upload your first dataset to get started</p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue hover:from-accent-cyan/80 hover:to-accent-blue/80 text-white rounded-full text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Dataset</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-xs font-mono">
                  No datasets matching filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleDatasetClick(item)}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3.5 font-semibold text-white flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <span className="font-mono text-xs text-white group-hover:text-sky-300 transition-colors">{item.name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {item.status || 'profiled'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-300">
                    <span className="text-white font-semibold">{item.row_count?.toLocaleString() ?? 'N/A'}</span> rows × <span className="text-white font-semibold">{item.column_count ?? 'N/A'}</span> cols
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-400">
                    {formatBytes(item.file_size_bytes)}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDatasetClick(item);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-sky-600 text-sky-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm"
                    >
                      {loadingProfileId === item.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-sky-400 group-hover:text-white" />
                          <span>Open Workspace</span>
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

      {/* Pipeline Info Footer Banner */}
      <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 flex items-start gap-3 text-xs">
        <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-slate-400 space-y-0.5 font-sans">
          <p className="font-semibold text-slate-200 font-mono">Phase 1 Secure Storage & Profiling Pipeline</p>
          <p className="leading-relaxed">
            CSV datasets are stored in <code className="text-sky-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[11px]">data/raw/</code>, assigned immutable UUID keys, and automatically profiled for missing ratios, categorical distributions, measure roles, and data types.
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
