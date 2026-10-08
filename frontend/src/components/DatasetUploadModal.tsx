import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet } from 'lucide-react';
import { uploadDataset } from '../services/api';
import { DatasetProfileData } from '../types';
import { UploadProfilingLoader } from './UploadProfilingLoader';

interface DatasetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: DatasetProfileData) => void;
  projectId?: string | null;
}

export const DatasetUploadModal: React.FC<DatasetUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId = null,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile: File | null) => {
    setErrorMsg(null);
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Only CSV files (.csv) are supported in Phase 1.');
      setFile(null);
      return;
    }

    if (selectedFile.size > 52_428_800) {
      setErrorMsg('File size exceeds the maximum limit of 50 MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!file) return;

    setStatus('loading');
    setErrorMsg(null);

    try {
      const profile = await uploadDataset(file, projectId || undefined);
      // Real request completed successfully!
      // Trigger completion transition (500-700ms)
      setStatus('success');
      setTimeout(() => {
        onSuccess(profile);
        onClose();
        setFile(null);
        setStatus('idle');
      }, 650);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to upload and profile dataset.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">Upload CSV Dataset</h3>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'loading' || status === 'success'}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status !== 'idle' ? (
          <UploadProfilingLoader
            status={status}
            errorMessage={errorMsg}
            onRetry={() => {
              setStatus('idle');
              setErrorMsg(null);
            }}
          />
        ) : (
          <>
            {/* Dropzone Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-sky-500 bg-sky-950/20'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-950/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                className="hidden"
              />

              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-white font-mono truncate">{file.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {(file.size / 1024).toFixed(1)} KB — Ready for ingestion
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-200">
                    Drag and drop your CSV file here, or <span className="text-sky-400 hover:underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Supported format: <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">.csv</code> (Max 50 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={!file}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-500 transition-colors disabled:opacity-50"
              >
                <span>Upload & Profile</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
