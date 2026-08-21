import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { uploadDataset } from '../services/api';
import { DatasetProfileData } from '../types';

interface DatasetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: DatasetProfileData) => void;
}

export const DatasetUploadModal: React.FC<DatasetUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'error'>('idle');
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

    setStatus('uploading');
    setErrorMsg(null);

    try {
      setTimeout(() => {
        setStatus('processing');
      }, 500);

      const profile = await uploadDataset(file);
      onSuccess(profile);
      onClose();
      setFile(null);
      setStatus('idle');
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
            disabled={status === 'uploading' || status === 'processing'}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Processing Indicator */}
        {(status === 'uploading' || status === 'processing') && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-sky-950/40 border border-sky-800 text-xs text-sky-300">
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
            <span>
              {status === 'uploading' ? 'Uploading file content...' : 'Analyzing & generating dataset profile...'}
            </span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'uploading' || status === 'processing'}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={!file || status === 'uploading' || status === 'processing'}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-500 transition-colors disabled:opacity-50"
          >
            {(status === 'uploading' || status === 'processing') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{status === 'processing' ? 'Profiling...' : 'Upload & Profile'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
