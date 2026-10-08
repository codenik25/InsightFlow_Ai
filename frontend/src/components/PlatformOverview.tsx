import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DatasetUploadModal } from './DatasetUploadModal';
import { PreUploadWorkspace } from './PreUploadWorkspace';
import { DatasetOverview } from './DatasetOverview';
import { DataQuality } from './DataQuality';
import { DataCleaning } from './DataCleaning';
import { DataAnalysis } from './DataAnalysis';
import { DataInsights } from './DataInsights';
import { DataPredictions } from './DataPredictions';
import { DataRecommendations } from './DataRecommendations';
import { DataOptimization } from './DataOptimization';
import { DataDecisions } from './DataDecisions';
import { DataGuardrails } from './DataGuardrails';
import { DatasetRegistry } from './DatasetRegistry';
import { WorkspaceProjectsView } from './WorkspaceProjectsView';
import { DatasetVersionComparison } from './DatasetVersionComparison';
import { AnalysisRunHistory } from './AnalysisRunHistory';
import { InsightMemoryView } from './InsightMemoryView';
import { EvidenceGraphView } from './EvidenceGraphView';
import { DecisionPortfolioView } from './DecisionPortfolioView';
import { DecisionReportView } from './DecisionReportView';
import { DecisionKnowledgeView } from './DecisionKnowledgeView';
import { Workspace, Project, DatasetProfileData } from '../types';
import { Network } from 'lucide-react';

interface PlatformOverviewProps {
  activeTab: string;
  rawDatasetId?: string | null;
  processedDatasetId?: string | null;
  setRawDatasetId?: (id: string | null) => void;
  setProcessedDatasetId?: (id: string | null) => void;
  setCurrentStage?: (stage: string) => void;
  optimizationId?: string | null;
  setOptimizationId?: (id: string | null) => void;
  projectId?: string | null;
  projectName?: string;
  currentWorkspace?: Workspace | null;
  currentProject?: Project | null;
  projects?: Project[];
  onSelectProject?: (project: Project) => void;
  onProjectCreated?: (project: Project) => void;
  onProjectUpdated?: (project: Project) => void;
}

export const PlatformOverview: React.FC<PlatformOverviewProps> = ({
  activeTab,
  rawDatasetId,
  processedDatasetId,
  setRawDatasetId,
  setProcessedDatasetId,
  setCurrentStage,
  optimizationId,
  setOptimizationId,
  projectId = null,
  projectName = 'Hospital Operations',
  currentWorkspace = null,
  currentProject = null,
  projects = [],
  onSelectProject,
  onProjectCreated,
  onProjectUpdated,
}) => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleDatasetSelected = (dsId: string) => {
    if (setRawDatasetId) setRawDatasetId(dsId);
    if (setCurrentStage) setCurrentStage('OVERVIEW');
  };

  const handleDatasetUploaded = (profile: DatasetProfileData) => {
    if (setRawDatasetId) setRawDatasetId(profile.dataset_id);
    if (setCurrentStage) setCurrentStage('OVERVIEW');
    setIsUploadModalOpen(false);
  };

  return (
    <div className="w-full h-full relative overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center">
      <AnimatePresence mode="wait">
        
        {/* ============================================================== */}
        {/* 1. UPLOAD & INGESTION TAB */}
        {/* ============================================================== */}
        {activeTab === 'UPLOAD' && (
          <motion.div
            key="UPLOAD"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full pt-4 pb-16 min-w-0"
          >
            <PreUploadWorkspace
              projectId={projectId || currentProject?.id || null}
              projectName={projectName || currentProject?.name}
              onSelectDataset={handleDatasetSelected}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              onNavigateToRegistry={() => setCurrentStage && setCurrentStage('DATASETS')}
              onDatasetUploaded={handleDatasetUploaded}
            />
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 2. OVERVIEW / DASHBOARD TAB */}
        {/* STATE A: NO DATASET -> Pre-upload design */}
        {/* STATE B: ACTIVE DATASET -> SaaS Analytics Dashboard */}
        {/* ============================================================== */}
        {activeTab === 'OVERVIEW' && (
          <motion.div
            key={rawDatasetId ? `OVERVIEW_ACTIVE_${rawDatasetId}` : 'OVERVIEW_EMPTY'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={rawDatasetId ? "w-full px-6 lg:px-8 py-6 pb-20 min-w-0 box-border" : "w-full px-6 lg:px-8 pt-4 pb-16 min-w-0 box-border"}
          >
            {!rawDatasetId ? (
              <PreUploadWorkspace
                projectId={projectId || currentProject?.id || null}
                projectName={projectName || currentProject?.name}
                onSelectDataset={handleDatasetSelected}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onNavigateToRegistry={() => setCurrentStage && setCurrentStage('DATASETS')}
                onDatasetUploaded={handleDatasetUploaded}
              />
            ) : (
              <DatasetOverview
                rawDatasetId={rawDatasetId}
                setCurrentStage={setCurrentStage || (() => {})}
                projectName={projectName || currentProject?.name}
                projectId={projectId || currentProject?.id || null}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onSelectAnotherDataset={() => setCurrentStage && setCurrentStage('DATASETS')}
              />
            )}
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 3. INTELLIGENCE PIPELINE STAGES */}
        {/* ============================================================== */}
        {activeTab === 'QUALITY' && (
          <motion.div key="QUALITY" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DataQuality rawDatasetId={rawDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'CLEANING' && (
          <motion.div key="CLEANING" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DataCleaning rawDatasetId={rawDatasetId || null} setProcessedDatasetId={setProcessedDatasetId} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'ANALYSIS' && (
          <motion.div key="ANALYSIS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataAnalysis processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'INSIGHTS' && (
          <motion.div key="INSIGHTS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataInsights processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'PREDICTIONS' && (
          <motion.div key="PREDICTIONS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataPredictions processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'RECOMMENDATIONS' && (
          <motion.div key="RECOMMENDATIONS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataRecommendations processedDatasetId={processedDatasetId || null} optimizationId={optimizationId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {activeTab === 'OPTIMIZATION' && (
          <motion.div key="OPTIMIZATION" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataOptimization processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} setOptimizationId={setOptimizationId} />
          </motion.div>
        )}

        {activeTab === 'DECISIONS' && (
          <motion.div key="DECISIONS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataDecisions processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} projectId={projectId || currentProject?.id || null} />
          </motion.div>
        )}

        {activeTab === 'GUARDRAILS' && (
          <motion.div key="GUARDRAILS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 min-w-0 mx-auto">
            <DataGuardrails processedDatasetId={processedDatasetId || null} setCurrentStage={setCurrentStage || (() => {})} />
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 4. WORKSPACE STAGES */}
        {/* ============================================================== */}
        {activeTab === 'DATASETS' && (
          <motion.div key="DATASETS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DatasetRegistry
              projectId={projectId || currentProject?.id || null}
              projectName={projectName || currentProject?.name}
              onSelectDataset={(dsId, targetStage = 'OVERVIEW') => {
                if (setRawDatasetId) setRawDatasetId(dsId);
                if (setCurrentStage) setCurrentStage(targetStage);
              }}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
            />
          </motion.div>
        )}

        {activeTab === 'PROJECTS' && (
          <motion.div key="PROJECTS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <WorkspaceProjectsView
              currentWorkspace={currentWorkspace}
              currentProject={currentProject}
              projects={projects}
              onSelectProject={onSelectProject || (() => {})}
              onProjectCreated={onProjectCreated || (() => {})}
              onProjectUpdated={onProjectUpdated || (() => {})}
              onNavigateToDatasets={() => setCurrentStage && setCurrentStage('DATASETS')}
            />
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 5. DECISION INTELLIGENCE STAGES */}
        {/* ============================================================== */}
        {(activeTab === 'DECISION_PORTFOLIO' || activeTab === 'CAPACITY_RISK') && (
          <motion.div key="DECISION_PORTFOLIO" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DecisionPortfolioView
              projectId={projectId || currentProject?.id || null}
              projectName={projectName || currentProject?.name}
              onNavigateToDecision={() => {
                if (setCurrentStage) setCurrentStage('DECISIONS');
              }}
            />
          </motion.div>
        )}

        {activeTab === 'REPORTS' && (
          <motion.div key="REPORTS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DecisionReportView
              decisionId={processedDatasetId || rawDatasetId || ''}
              projectId={projectId || currentProject?.id || null}
              datasetName={projectName}
            />
          </motion.div>
        )}

        {activeTab === 'KNOWLEDGE' && (
          <motion.div key="KNOWLEDGE" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DecisionKnowledgeView
              projectId={projectId || currentProject?.id || ''}
            />
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 6. TRACEABILITY & GOVERNANCE STAGES */}
        {/* ============================================================== */}
        {activeTab === 'VERSIONS' && (
          <motion.div key="VERSIONS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <DatasetVersionComparison
              projectId={projectId || currentProject?.id || ''}
              projectName={projectName || currentProject?.name}
              initialCompId={rawDatasetId || undefined}
              onClose={() => setCurrentStage && setCurrentStage('DATASETS')}
            />
          </motion.div>
        )}

        {activeTab === 'RUNS' && (
          <motion.div key="RUNS" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <AnalysisRunHistory
              projectId={projectId || currentProject?.id || null}
              datasetId={rawDatasetId || undefined}
            />
          </motion.div>
        )}

        {activeTab === 'INSIGHT_MEMORY' && (
          <motion.div key="INSIGHT_MEMORY" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            <InsightMemoryView
              projectId={projectId || currentProject?.id || null}
              datasetId={rawDatasetId || undefined}
              datasetName={projectName}
              onClearDatasetFilter={() => {}}
              onClose={() => setCurrentStage && setCurrentStage('DATASETS')}
            />
          </motion.div>
        )}

        {activeTab === 'EVIDENCE' && (
          <motion.div key="EVIDENCE" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="w-full max-w-7xl px-4 sm:px-6 pt-4 pb-16 min-w-0">
            {rawDatasetId || processedDatasetId ? (
              <EvidenceGraphView
                datasetId={processedDatasetId || rawDatasetId || ''}
                datasetName={projectName || 'Dataset'}
              />
            ) : (
              <div className="p-12 rounded-2xl glass-panel-premium border border-white/5 text-center max-w-xl mx-auto space-y-4 my-12">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                  <Network className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-sans">No Dataset Selected for Evidence Tracing</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Select a dataset from the Dataset Registry or run the decision pipeline to inspect the multi-hop decision evidence graph and audit traceability.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentStage && setCurrentStage('DATASETS')}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue text-[#02060D] font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                  >
                    OPEN DATASET REGISTRY →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      <DatasetUploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        projectId={projectId || currentProject?.id || null}
        onSuccess={handleDatasetUploaded}
      />
    </div>
  );
};
