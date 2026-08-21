import React, { useState } from 'react';
import {
  Wand2,
  CheckCircle,
  Plus,
  Trash2,
  Eye,
  Play,
  XCircle,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ColumnProfile,
  CleaningPlan,
  CleaningOperation,
  CleaningPreviewResponse,
  CleaningApplyResponse,
} from '../types';
import { previewCleaningPlan, applyCleaningPlan, getDownloadUrl } from '../services/api';

interface CleaningWorkflowProps {
  datasetId: string;
  columns: ColumnProfile[];
  hasDuplicates: boolean;
  onApplySuccess?: () => void;
}

export const CleaningWorkflow: React.FC<CleaningWorkflowProps> = ({
  datasetId,
  columns,
  hasDuplicates,
  onApplySuccess,
}) => {
  const [removeDuplicates, setRemoveDuplicates] = useState<boolean>(hasDuplicates);
  const [fillOperations, setFillOperations] = useState<CleaningOperation[]>([]);

  // Selection states for adding new fill_missing op
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('mode');
  const [customFillValue, setCustomFillValue] = useState<string>('');

  // Execution states
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<CleaningPreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<CleaningApplyResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter columns with missing values or all columns
  const colsWithMissing = columns.filter((c) => c.null_count > 0);
  const targetCol = columns.find((c) => c.name === selectedColumn);
  const isNumeric = targetCol?.inferred_type === 'numeric';

  // Supported strategies for selected column
  const getSupportedStrategies = () => {
    if (isNumeric) {
      return [
        { value: 'median', label: 'Median (Recommended for numeric)' },
        { value: 'mean', label: 'Mean' },
        { value: 'mode', label: 'Mode' },
        { value: 'constant', label: 'Constant Value' },
        { value: 'drop_rows', label: 'Drop Rows with Missing Values' },
      ];
    }
    return [
      { value: 'mode', label: 'Mode (Most Frequent Value)' },
      { value: 'constant', label: 'Constant Value' },
      { value: 'drop_rows', label: 'Drop Rows with Missing Values' },
    ];
  };

  const handleAddFillOperation = () => {
    if (!selectedColumn) return;

    // Avoid duplicate operation for same column
    if (fillOperations.some((op) => op.column === selectedColumn)) {
      setErrorMsg(`Cleaning operation for column '${selectedColumn}' already added.`);
      return;
    }

    setErrorMsg(null);
    const newOp: CleaningOperation = {
      type: 'fill_missing',
      column: selectedColumn,
      strategy: selectedStrategy,
      fill_value: selectedStrategy === 'constant' ? customFillValue : undefined,
    };

    setFillOperations([...fillOperations, newOp]);
    setSelectedColumn('');
    setPreviewResult(null); // Reset preview on plan change
  };

  const handleRemoveFillOperation = (colName: string) => {
    setFillOperations(fillOperations.filter((op) => op.column !== colName));
    setPreviewResult(null);
  };

  const buildPlan = (): CleaningPlan => {
    const operations: CleaningOperation[] = [];
    if (removeDuplicates) {
      operations.push({ type: 'remove_duplicates' });
    }
    operations.push(...fillOperations);

    return {
      dataset_id: datasetId,
      operations,
    };
  };

  const handleRunPreview = async () => {
    const plan = buildPlan();
    if (plan.operations.length === 0) {
      setErrorMsg('Please select at least one cleaning operation.');
      return;
    }

    setErrorMsg(null);
    setIsPreviewing(true);
    try {
      const res = await previewCleaningPlan(datasetId, plan);
      setPreviewResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate cleaning preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecuteApply = async () => {
    const plan = buildPlan();
    if (plan.operations.length === 0) return;

    setErrorMsg(null);
    setIsApplying(true);
    try {
      const res = await applyCleaningPlan(datasetId, plan);
      setApplyResult(res);
      if (onApplySuccess) {
        onApplySuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply cleaning plan.');
    } finally {
      setIsApplying(false);
    }
  };

  const totalOpsCount = (removeDuplicates ? 1 : 0) + fillOperations.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Interactive Data Cleaning Workflow</h3>
            <p className="text-xs text-slate-400">Build cleaning plan, preview metrics in-memory, and persist clean CSV</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cleaning Builder Step 1: Selection */}
      {!applyResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Operation Controls */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Configure Cleaning Rules</h4>

            {/* Remove Duplicates Checkbox */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={removeDuplicates}
                  onChange={(e) => {
                    setRemoveDuplicates(e.target.checked);
                    setPreviewResult(null);
                  }}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Remove Exact Duplicate Rows</span>
              </label>
              {hasDuplicates && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                  Recommended
                </span>
              )}
            </div>

            {/* Fill Missing Values Builder */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Fill Missing Values (Imputation)</span>

              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 block">Select Target Column</label>
                <select
                  value={selectedColumn}
                  onChange={(e) => {
                    setSelectedColumn(e.target.value);
                    const col = columns.find((c) => c.name === e.target.value);
                    if (col?.inferred_type === 'numeric') {
                      setSelectedStrategy('median');
                    } else {
                      setSelectedStrategy('mode');
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose column with missing values --</option>
                  {colsWithMissing.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.null_count} missing cells - {col.inferred_type})
                    </option>
                  ))}
                  {columns
                    .filter((c) => c.null_count === 0)
                    .map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} (0 missing - {col.inferred_type})
                      </option>
                    ))}
                </select>
              </div>

              {selectedColumn && (
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400 block">Select Imputation Strategy</label>
                  <select
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {getSupportedStrategies().map((strat) => (
                      <option key={strat.value} value={strat.value}>
                        {strat.label}
                      </option>
                    ))}
                  </select>

                  {selectedStrategy === 'constant' && (
                    <input
                      type="text"
                      placeholder="Enter fill value"
                      value={customFillValue}
                      onChange={(e) => setCustomFillValue(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!selectedColumn}
                onClick={handleAddFillOperation}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Operation to Plan</span>
              </button>
            </div>
          </div>

          {/* Right Column: Configured Plan & Preview Trigger */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Configured Cleaning Plan</h4>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3 min-h-[160px]">
              {totalOpsCount === 0 ? (
                <div className="text-xs text-slate-500 text-center py-8">
                  No cleaning operations configured. Enable duplicate removal or add column fill operations.
                </div>
              ) : (
                <div className="space-y-2">
                  {removeDuplicates && (
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-800 text-xs">
                      <div className="flex items-center gap-2 text-emerald-400 font-medium">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>Remove duplicate rows</span>
                      </div>
                      <button
                        onClick={() => setRemoveDuplicates(false)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {fillOperations.map((op) => (
                    <div
                      key={op.column}
                      className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 text-slate-200 font-mono">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>{op.column}</span>
                        <span className="text-slate-400 text-[11px] font-sans">
                          (Strategy: <strong className="text-emerald-400 capitalize">{op.strategy}</strong>)
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFillOperation(op.column!)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Action Button */}
            <button
              onClick={handleRunPreview}
              disabled={totalOpsCount === 0 || isPreviewing}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-600/20"
            >
              {isPreviewing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing In-Memory Preview...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Preview Changes ({totalOpsCount} ops)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Before / After Preview Side-by-Side Comparison */}
      {previewResult && !applyResult && (
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              <span>In-Memory Cleaning Impact Preview (Raw file unmodified)</span>
            </h4>
            <span className="px-2 py-0.5 text-xs font-mono bg-sky-500/10 text-sky-400 rounded border border-sky-500/20">
              Safe In-Memory Simulation
            </span>
          </div>

          {/* Impact Comparison Table */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block border-b border-slate-800 pb-1">
                BEFORE (Current Raw)
              </span>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span>Total Rows:</span>
                  <strong className="text-white">{previewResult.before.total_rows}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Missing Cells:</span>
                  <strong className="text-amber-400">{previewResult.before.total_missing_cells}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Duplicate Rows:</span>
                  <strong className="text-amber-400">{previewResult.before.duplicate_rows}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Quality Score:</span>
                  <strong className="text-sky-400">{previewResult.before.quality_score}/100</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-lg space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block border-b border-slate-800 pb-1">
                EXPECTED AFTER (Cleaned)
              </span>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span>Total Rows:</span>
                  <strong className="text-white">{previewResult.expected_after.total_rows}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Missing Cells:</span>
                  <strong className="text-emerald-400">{previewResult.expected_after.total_missing_cells}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Duplicate Rows:</span>
                  <strong className="text-emerald-400">{previewResult.expected_after.duplicate_rows}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Quality Score:</span>
                  <strong className="text-emerald-400">{previewResult.expected_after.quality_score}/100</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Cancel vs Apply */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setPreviewResult(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleExecuteApply}
              disabled={isApplying}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Persisting Processed CSV & Logs...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Apply Changes & Persist CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Post-Apply Confirmation & Result Display */}
      {applyResult && (
        <div className="p-5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Processed Dataset Created Successfully</span>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold">
              Status: Processed
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Rows</span>
              <span className="text-slate-200 font-bold">
                {applyResult.before.total_rows} → <strong className="text-emerald-400">{applyResult.after.total_rows}</strong>
              </span>
            </div>
            <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Missing Cells</span>
              <span className="text-slate-200 font-bold">
                {applyResult.before.total_missing_cells} → <strong className="text-emerald-400">{applyResult.after.total_missing_cells}</strong>
              </span>
            </div>
            <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Duplicates</span>
              <span className="text-slate-200 font-bold">
                {applyResult.before.duplicate_rows} → <strong className="text-emerald-400">{applyResult.after.duplicate_rows}</strong>
              </span>
            </div>
            <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Quality Score</span>
              <span className="text-slate-200 font-bold">
                {applyResult.before.quality_score} → <strong className="text-emerald-400">{applyResult.after.quality_score}/100</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400 font-mono">
              Processed File: <strong className="text-slate-200">{applyResult.processed_filename}</strong> ({applyResult.transformation_logs_count} audit logs recorded)
            </div>

            <a
              href={getDownloadUrl(applyResult.output_dataset_id, 'processed')}
              download
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Download Processed CSV</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
