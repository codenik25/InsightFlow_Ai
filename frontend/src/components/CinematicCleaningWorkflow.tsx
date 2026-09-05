import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, Loader2, AlertCircle, XCircle, 
  ArrowRight, ShieldCheck, Database, Wand2, FileSpreadsheet, Lock, Plus
} from 'lucide-react';
import { 
  CleaningPlan, CleaningOperation, CleaningPreviewResponse, 
  CleaningApplyResponse, IssueDetail, ColumnProfile 
} from '../types';
import { previewCleaningPlan, applyCleaningPlan } from '../services/api';

interface CinematicCleaningWorkflowProps {
  datasetId: string;
  filename: string;
  totalRows: number;
  totalColumns: number;
  issues: IssueDetail[];
  columns: ColumnProfile[];
  onComplete: (processedDatasetId: string) => void;
  onCancel: () => void;
}

type RecommendationState = 'RECOMMENDED' | 'APPROVED' | 'SKIPPED';

interface CleaningRecommendation {
  id: string;
  issue: IssueDetail;
  operation: CleaningOperation;
  state: RecommendationState;
  supported: boolean;
}

export const CinematicCleaningWorkflow: React.FC<CinematicCleaningWorkflowProps> = ({
  datasetId,
  filename,
  totalRows: _totalRows,
  totalColumns: _totalColumns,
  issues,
  columns,
  onComplete,
  onCancel
}) => {
  const [recommendations, setRecommendations] = useState<CleaningRecommendation[]>([]);
  const [previewResult, setPreviewResult] = useState<CleaningPreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<CleaningApplyResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<'idle' | 'preparing' | 'applying' | 'validating' | 'success' | 'error'>('idle');

  // Map issues to supported cleaning operations
  useEffect(() => {
    const mapped: CleaningRecommendation[] = issues.map((issue, idx) => {
      let operation: CleaningOperation | null = null;
      let supported = false;

      const desc = issue.description.toLowerCase();
      
      if (issue.category === 'completeness' || desc.includes('missing') || desc.includes('null')) {
        const colType = columns.find(c => c.name === issue.column)?.inferred_type;
        operation = { 
          type: 'fill_missing', 
          column: issue.column, 
          strategy: colType === 'numeric' ? 'median' : 'mode' 
        };
        supported = true;
      } else if (issue.category === 'uniqueness' || desc.includes('duplicate')) {
        operation = { type: 'remove_duplicates' };
        supported = true;
      } else if (issue.category === 'structural' && desc.includes('empty')) {
        operation = { type: 'remove_empty_columns', column: issue.column };
        supported = true;
      } else if (issue.category === 'structural' && desc.includes('constant')) {
        operation = { type: 'remove_constant_columns', column: issue.column };
        supported = true;
      } else if (issue.category === 'consistency' && desc.includes('whitespace')) {
        operation = { type: 'trim_whitespace', column: issue.column };
        supported = true;
      }

      return {
        id: `rec-${idx}`,
        issue,
        operation: operation || { type: 'unknown' },
        state: 'RECOMMENDED',
        supported
      };
    });

    setRecommendations(mapped);
  }, [issues, columns]);

  const updateRecommendationState = (id: string, newState: RecommendationState) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, state: newState } : r));
    setPreviewResult(null); // Invalidate preview when plan changes
  };

  const updateOperationStrategy = (id: string, strategy: string) => {
    setRecommendations(prev => prev.map(r => 
      r.id === id ? { ...r, operation: { ...r.operation, strategy } } : r
    ));
    setPreviewResult(null);
  };

  const getActivePlan = (): CleaningPlan => {
    return {
      dataset_id: datasetId,
      operations: recommendations
        .filter(r => r.state === 'APPROVED' && r.supported)
        .map(r => r.operation)
    };
  };

  const handlePreview = async () => {
    const plan = getActivePlan();
    if (plan.operations.length === 0) return;
    
    try {
      const res = await previewCleaningPlan(datasetId, plan);
      setPreviewResult(res);
    } catch (err: any) {
      console.error("Preview failed:", err);
      // We don't block the UI, but we can't show a preview
    }
  };

  // Debounced preview when approved operations change
  useEffect(() => {
    const plan = getActivePlan();
    if (plan.operations.length > 0) {
      const timeout = setTimeout(() => {
        handlePreview();
      }, 500);
      return () => clearTimeout(timeout);
    } else {
      setPreviewResult(null);
    }
  }, [recommendations]);

  const handleApply = async () => {
    const plan = getActivePlan();
    if (plan.operations.length === 0) {
      setErrorMsg("No supported operations approved.");
      return;
    }

    setErrorMsg(null);
    setProcessingState('preparing');
    
    try {
      await new Promise(r => setTimeout(r, 800));
      setProcessingState('applying');
      
      const res = await applyCleaningPlan(datasetId, plan);
      
      setProcessingState('validating');
      await new Promise(r => setTimeout(r, 600));
      
      setApplyResult(res);
      setProcessingState('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply cleaning plan.');
      setProcessingState('error');
    }
  };

  const getStrategyOptions = (columnName?: string | null) => {
    if (!columnName) return [];
    const colType = columns.find(c => c.name === columnName)?.inferred_type;
    if (colType === 'numeric') {
      return [
        { value: 'median', label: 'Median' },
        { value: 'mean', label: 'Mean' },
        { value: 'mode', label: 'Mode' },
        { value: 'drop_rows', label: 'Drop Rows' }
      ];
    }
    return [
      { value: 'mode', label: 'Mode' },
      { value: 'drop_rows', label: 'Drop Rows' }
    ];
  };

  const approvedCount = recommendations.filter(r => r.state === 'APPROVED').length;

  if (processingState === 'success' && applyResult) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh]"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">CLEANING COMPLETE</h2>
        <p className="text-slate-400 mb-12">Your processed dataset is ready for analysis.</p>

        <div className="flex items-center gap-6 mb-12 w-full max-w-2xl">
          <div className="flex-1 bg-[rgba(4,12,25,0.6)] border border-slate-800 rounded-xl p-5 text-center relative overflow-hidden">
            <Lock className="w-4 h-4 text-slate-500 absolute top-3 right-3" />
            <Database className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <div className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">RAW DATASET</div>
            <div className="text-sm font-medium text-slate-300 truncate px-4">{filename}</div>
            <div className="text-xs text-slate-500 mt-2">Unchanged</div>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <div className="h-[1px] w-8 bg-slate-700" />
            <Plus className="w-4 h-4 text-slate-600" />
            <div className="h-[1px] w-8 bg-slate-700" />
          </div>

          <div className="flex-1 bg-accent-cyan/5 border border-accent-cyan/20 rounded-xl p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 to-transparent opacity-50" />
            <FileSpreadsheet className="w-8 h-8 text-accent-cyan mx-auto mb-3 relative z-10" />
            <div className="text-xs font-mono text-accent-cyan uppercase tracking-widest mb-1 relative z-10">PROCESSED DATASET</div>
            <div className="text-sm font-medium text-white truncate px-4 relative z-10">{applyResult.processed_filename || 'cleaned_dataset.csv'}</div>
            <div className="text-xs text-emerald-400 mt-2 relative z-10">{applyResult.transformation_logs_count} transformations</div>
          </div>
        </div>

        <button 
          onClick={() => onComplete(applyResult.output_dataset_id)}
          className="px-10 py-4 bg-gradient-to-r from-accent-cyan to-accent-blue text-white rounded-full font-sans font-bold text-[14px] tracking-widest uppercase hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all flex items-center gap-3"
        >
          CONTINUE TO ANALYSIS <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    );
  }

  if (processingState !== 'idle' && processingState !== 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[50vh]">
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
          <motion.div 
            className="absolute inset-0 rounded-full border-2 border-accent-cyan"
            style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 50%, 50% 50%)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Wand2 className="w-10 h-10 text-accent-cyan" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white tracking-widest uppercase mb-2">
          {processingState === 'preparing' && 'PREPARING CLEANING PLAN...'}
          {processingState === 'applying' && 'APPLYING TRANSFORMATIONS...'}
          {processingState === 'validating' && 'VALIDATING PROCESSED DATA...'}
        </h3>
        <p className="text-slate-400 text-sm">Please wait while the AI generates your new processed artifact.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 h-full pb-32">
      {/* Header Panel */}
      <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800 rounded-2xl p-6 flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg">
              <Wand2 className="w-5 h-5 text-accent-cyan" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">AI CLEANING RECOMMENDATIONS</h2>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Review AI-recommended transformations before analysis. 
            Approving these will generate a <strong className="text-white">new processed dataset</strong> artifact. Your original raw dataset remains locked and immutable.
          </p>
        </div>
        
        <div className="flex gap-6">
          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Detected Issues</div>
            <div className="text-2xl font-bold text-white">{issues.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Supported Fixes</div>
            <div className="text-2xl font-bold text-accent-cyan">{recommendations.filter(r => r.supported).length}</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-400">CLEANING FAILED</h4>
            <p className="text-xs text-rose-300 mt-1">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recommendations Column */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Recommended Transformations
          </h3>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {recommendations.map((rec) => (
              <motion.div 
                key={rec.id}
                layout
                className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                  rec.state === 'APPROVED' ? 'bg-accent-cyan/5 border-accent-cyan/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]' :
                  rec.state === 'SKIPPED' ? 'bg-slate-900/40 border-slate-800 opacity-60' :
                  'bg-[rgba(4,12,25,0.6)] border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      {rec.issue.severity === 'critical' ? (
                        <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">{rec.issue.category} ISSUE</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-md">{rec.issue.description}</p>
                      </div>
                    </div>
                    
                    {!rec.supported ? (
                      <span className="px-3 py-1 bg-slate-800 text-slate-400 text-[10px] font-mono rounded-full uppercase tracking-widest border border-slate-700">
                        Requires Review
                      </span>
                    ) : (
                      <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                        <button 
                          onClick={() => updateRecommendationState(rec.id, 'SKIPPED')}
                          className={`px-4 py-1.5 rounded-md text-[11px] font-bold tracking-wider transition-colors ${
                            rec.state === 'SKIPPED' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          SKIP
                        </button>
                        <button 
                          onClick={() => updateRecommendationState(rec.id, 'APPROVED')}
                          className={`px-4 py-1.5 rounded-md text-[11px] font-bold tracking-wider transition-colors ${
                            rec.state === 'APPROVED' ? 'bg-accent-cyan text-slate-950' : 'text-accent-cyan hover:bg-accent-cyan/10'
                          }`}
                        >
                          APPROVE
                        </button>
                      </div>
                    )}
                  </div>

                  {rec.supported && (
                    <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-wrap gap-4 items-center bg-black/20 p-3 rounded-lg">
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        Proposed Fix: <strong className="text-accent-blue">{rec.operation.type}</strong>
                      </div>
                      
                      {rec.operation.type === 'fill_missing' && rec.operation.column && (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Method:</span>
                          <select 
                            value={rec.operation.strategy || 'mode'}
                            onChange={(e) => updateOperationStrategy(rec.id, e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1 outline-none focus:border-accent-cyan"
                          >
                            {getStrategyOptions(rec.operation.column).map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Impact Column */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Cleaning Impact
          </h3>
          
          <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800 rounded-2xl p-6">
            {approvedCount === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Approve recommendations to see impact preview.
              </div>
            ) : previewResult ? (
              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Rows Affected</div>
                  <div className="text-3xl font-bold text-white">
                    {previewResult.proposed_changes.reduce((sum, c) => sum + c.affected_rows, 0)}
                  </div>
                </div>
                
                <div className="h-[1px] bg-slate-800" />
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Rows</span>
                    <span className="text-white">{previewResult.expected_after.total_rows} <span className="text-slate-600 text-xs">(was {previewResult.before.total_rows})</span></span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Missing Cells</span>
                    <span className="text-accent-cyan">{previewResult.expected_after.total_missing_cells} <span className="text-slate-600 text-xs">(was {previewResult.before.total_missing_cells})</span></span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Quality Score</span>
                    <span className="text-emerald-400">{Math.round(previewResult.expected_after.quality_score)} <span className="text-slate-600 text-xs">(was {Math.round(previewResult.before.quality_score)})</span></span>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Transformations</div>
                  {previewResult.proposed_changes.map((change, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-start gap-2 mb-1.5 last:mb-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan mt-1 flex-shrink-0" />
                      <span>{change.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-sm flex flex-col items-center">
                <Loader2 className="w-5 h-5 animate-spin mb-3 text-slate-600" />
                Calculating preview impact...
              </div>
            )}
          </div>

          {/* Lineage Visual */}
          <div className="bg-[rgba(4,12,25,0.6)] backdrop-blur-md border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-accent-violet/5 blur-[30px]" />
             
             <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3 w-full p-2 rounded bg-slate-900/50 border border-slate-800 text-slate-400">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs truncate">{filename} (RAW)</span>
                </div>
                
                <div className="h-4 border-l border-dashed border-accent-cyan/30" />
                
                <div className="flex items-center gap-3 w-full p-2 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
                  <Wand2 className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-mono uppercase tracking-widest">Apply {approvedCount} Fixes</span>
                </div>
                
                <div className="h-4 border-l border-dashed border-accent-cyan/30 relative">
                   <motion.div 
                     className="absolute top-0 left-[-1px] w-0.5 h-2 bg-accent-cyan"
                     animate={{ y: [0, 16, 0] }}
                     transition={{ duration: 2, repeat: Infinity }}
                   />
                </div>
                
                <div className="flex items-center gap-3 w-full p-2 rounded border border-slate-700 border-dashed text-slate-300 bg-slate-800/20">
                  <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs italic truncate text-slate-500">Processed Artifact...</span>
                </div>
             </div>
          </div>
        </div>

      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-[rgba(2,5,10,0.8)] backdrop-blur-xl border-t border-slate-800 p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
             <span className="text-sm text-slate-400">
               {approvedCount} transformations selected
             </span>
             {approvedCount > 0 && (
               <span className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan text-[10px] font-mono rounded uppercase tracking-widest">
                 Ready to Apply
               </span>
             )}
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onCancel}
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              BACK TO QUALITY
            </button>
            <button 
              onClick={handleApply}
              disabled={approvedCount === 0 || processingState !== 'idle'}
              className="group relative px-8 py-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue rounded-full overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="font-sans font-bold text-[12px] tracking-widest text-white uppercase relative z-10 drop-shadow-md flex items-center gap-2">
                APPLY SELECTED FIXES <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
