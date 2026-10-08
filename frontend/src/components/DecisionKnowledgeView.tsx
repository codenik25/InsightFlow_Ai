import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  Plus,
  Lock,
  User,
  Cpu,
  Archive,
  RefreshCw,
  AlertCircle,
  Tag,
  Calendar,
  X,
  CheckCircle2,
  GitBranch,
  Database,
  ShieldCheck,
  Zap,
  Activity,
} from 'lucide-react';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import {
  ProjectKnowledgeListResponse,
  KnowledgeCategory,
  KnowledgeEntryCreatePayload,
} from '../types';
import {
  fetchProjectKnowledge,
  createProjectKnowledge,
  archiveKnowledgeEntry,
} from '../services/api';

interface DecisionKnowledgeViewProps {
  projectId: string;
  decisionId?: string | null;
  datasetId?: string | null;
  title?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OBSERVATION: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  DECISION_LESSON: { bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
  OUTCOME_LESSON: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  OPERATIONAL_NOTE: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  ASSUMPTION: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  CONSTRAINT: { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
};

export const DecisionKnowledgeView: React.FC<DecisionKnowledgeViewProps> = ({
  projectId,
  decisionId,
  datasetId,
  title = 'Decision Knowledge & Institutional Memory',
}) => {
  const [data, setData] = useState<ProjectKnowledgeListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Selected Node
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedEntryType, setSelectedEntryType] = useState<string>('ALL');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('ALL');
  const [activeGraphNode, setActiveGraphNode] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<KnowledgeEntryCreatePayload>({
    title: '',
    content: '',
    category: 'DECISION_LESSON',
    source_type: decisionId ? 'DECISION' : 'MANUAL',
    source_id: decisionId || '',
    decision_id: decisionId || null,
    dataset_id: datasetId || null,
    created_by: 'Decision Lead',
  });

  const loadKnowledge = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectKnowledge(projectId, {
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        entry_type: selectedEntryType !== 'ALL' ? selectedEntryType : undefined,
        source_type: selectedSourceType !== 'ALL' ? selectedSourceType : undefined,
        decision_id: decisionId || undefined,
        search: searchTerm.trim() ? searchTerm.trim() : undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load institutional decision memory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, [projectId, decisionId, selectedCategory, selectedEntryType, selectedSourceType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadKnowledge();
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setFormError('Title and content are required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createProjectKnowledge(projectId, {
        ...formData,
        decision_id: formData.decision_id || decisionId || null,
        dataset_id: formData.dataset_id || datasetId || null,
      });
      setIsModalOpen(false);
      setFormData({
        title: '',
        content: '',
        category: 'DECISION_LESSON',
        source_type: decisionId ? 'DECISION' : 'MANUAL',
        source_id: decisionId || '',
        decision_id: decisionId || null,
        dataset_id: datasetId || null,
        created_by: 'Decision Lead',
      });
      loadKnowledge();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record knowledge entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (entryId: string) => {
    if (!confirm('Archive this human-recorded knowledge entry?')) return;
    try {
      await archiveKnowledgeEntry(entryId);
      loadKnowledge();
    } catch (err: any) {
      alert(err.message || 'Failed to archive entry');
    }
  };

  // Phase-specific Loading State (Graph Skeleton)
  if (loading && !data) {
    return (
      <ContinuousIntelligenceEngine
        mode="knowledge"
        isLoading={loading}
        isFullScreen={false}
        minHeight="520px"
        error={error}
        onRetry={loadKnowledge}
      />
    );
  }

  // Phase-specific Error State
  if (error || !data) {
    return (
      <div className="w-full max-w-[1580px] mx-auto p-8 rounded-2xl bg-rose-950/20 border border-rose-800/50 text-rose-300">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <h4 className="font-bold text-base font-sans tracking-wide uppercase">
            KNOWLEDGE MAP UNAVAILABLE
          </h4>
        </div>
        <p className="text-sm font-sans text-rose-200/80 mb-6">
          {error || 'Unable to retrieve persisted institutional memory for this project.'}
        </p>
        <button
          onClick={loadKnowledge}
          className="px-5 py-2.5 bg-rose-900/50 hover:bg-rose-800 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors"
        >
          RETRY LOAD
        </button>
      </div>
    );
  }

  // Categorize entries based on actual data
  const entries = data.entries || [];
  const decisionLessons = entries.filter((e) => e.category === 'DECISION_LESSON');
  const outcomeLessons = entries.filter((e) => e.category === 'OUTCOME_LESSON');
  const observations = entries.filter((e) => e.category === 'OBSERVATION');

  // Filter entries if a graph node was clicked
  const displayedEntries = entries.filter((entry) => {
    if (!activeGraphNode || activeGraphNode === 'ALL') return true;
    if (activeGraphNode === 'DECISION') return entry.category === 'DECISION_LESSON' || entry.source_type === 'DECISION';
    if (activeGraphNode === 'OUTCOME') return entry.category === 'OUTCOME_LESSON' || entry.source_type === 'OUTCOME';
    if (activeGraphNode === 'OBSERVATION') return entry.category === 'OBSERVATION';
    if (activeGraphNode === 'ASSUMPTION') return entry.category === 'ASSUMPTION';
    return true;
  });

  return (
    <div className="w-full max-w-[1580px] mx-auto space-y-6 text-[#F4F7FB]">
      {/* ============================================================== */}
      {/* 1. KNOWLEDGE MAP HEADER                                        */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[#030914]/90 border border-[rgba(167,139,250,0.22)] rounded-2xl p-6 sm:p-7 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest bg-violet-500/15 text-violet-300 border border-violet-500/30 font-semibold flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-violet-400" />
                PHASE 09 — KNOWLEDGE MAP
              </span>
              {decisionId && (
                <span className="text-[12px] font-mono text-[#8492A5]">
                  Target Decision: <strong className="text-white">{decisionId}</strong>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-[28px] font-sans font-bold text-white tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-violet-400" />
              {title}
            </h2>

            <p className="text-sm font-sans text-[#B7C3D3] mt-2 max-w-3xl leading-relaxed">
              Institutional intelligence canvas preserving human observations, policy learnings, and model deviations across the enterprise lifecycle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg shadow-violet-950/40 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              RECORD KNOWLEDGE
            </button>
            <button
              onClick={loadKnowledge}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Refresh Institutional Memory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Counter Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-[#8492A5] font-mono uppercase">Total Memory Entries</span>
            <span className="text-xl font-mono font-bold text-white">{data.total_entries}</span>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-[#8492A5] font-mono uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" /> Human Recorded
            </span>
            <span className="text-xl font-mono font-bold text-emerald-400">{data.total_human_recorded}</span>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-[#8492A5] font-mono uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-violet-400" /> System Derived
            </span>
            <span className="text-xl font-mono font-bold text-violet-300">{data.total_system_derived}</span>
          </div>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 2. MAIN VISUAL: INTERACTIVE KNOWLEDGE RELATIONSHIP GRAPH       */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="border border-[rgba(167,139,250,0.2)] rounded-2xl bg-[#030914] p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              INTERACTIVE DECISION RELATIONSHIP GRAPH
            </h3>
          </div>
          <span className="text-xs font-sans text-[#8492A5]">
            Click any node to focus associated operational memory entries below.
          </span>
        </div>

        {/* Knowledge Topology Canvas */}
        <div className="relative py-4 flex flex-col items-center">
          {/* Top Tier: Dataset Context */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            onClick={() => setActiveGraphNode(activeGraphNode === 'DATASET' ? null : 'DATASET')}
            className={`w-64 p-3.5 rounded-xl border text-center cursor-pointer transition-all shadow-md ${
              activeGraphNode === 'DATASET'
                ? 'bg-blue-500/20 border-blue-400 text-white shadow-[0_0_20px_rgba(96,165,250,0.3)]'
                : 'bg-slate-950/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase mb-1">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              DATASET REPOSITORY
            </div>
            <span className="text-[11px] font-mono text-[#8492A5] truncate block">
              {datasetId || 'Production Ingestion'}
            </span>
          </motion.div>

          {/* SVG Connector 1 */}
          <div className="h-6 w-[2px] bg-gradient-to-b from-blue-500 to-indigo-500 my-1" />

          {/* Middle Tier: Upstream Analysis & Insights */}
          <div className="grid grid-cols-2 gap-8 sm:gap-16 w-full max-w-xl">
            <motion.div
              whileHover={{ scale: 1.03 }}
              onClick={() => setActiveGraphNode(activeGraphNode === 'OBSERVATION' ? null : 'OBSERVATION')}
              className={`p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                activeGraphNode === 'OBSERVATION'
                  ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(57,214,245,0.3)]'
                  : 'bg-slate-950/70 border-white/[0.08] text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-xs font-mono font-bold text-cyan-300 block mb-1 uppercase">
                ANALYTICAL INSIGHTS
              </span>
              <span className="text-[11px] font-mono text-[#8492A5]">
                {observations.length} Observations Recorded
              </span>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              onClick={() => setActiveGraphNode(activeGraphNode === 'ASSUMPTION' ? null : 'ASSUMPTION')}
              className={`p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                activeGraphNode === 'ASSUMPTION'
                  ? 'bg-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-950/70 border-white/[0.08] text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-xs font-mono font-bold text-amber-300 block mb-1 uppercase">
                MODEL ASSUMPTIONS
              </span>
              <span className="text-[11px] font-mono text-[#8492A5]">
                Policy Guardrails
              </span>
            </motion.div>
          </div>

          {/* SVG Connector 2 */}
          <div className="h-6 w-[2px] bg-gradient-to-b from-indigo-500 to-violet-500 my-1" />

          {/* Core Central Node: DECISION */}
          <motion.div
            whileHover={{ scale: 1.04 }}
            onClick={() => setActiveGraphNode(activeGraphNode === 'DECISION' ? null : 'DECISION')}
            className={`w-80 p-5 rounded-2xl border text-center cursor-pointer transition-all shadow-xl ${
              activeGraphNode === 'DECISION'
                ? 'bg-violet-600/30 border-violet-400 text-white shadow-[0_0_30px_rgba(167,139,250,0.4)]'
                : 'bg-slate-950/90 border-violet-500/40 text-white hover:border-violet-400'
            }`}
          >
            <div className="flex items-center justify-center gap-2 text-sm font-sans font-bold uppercase text-violet-300 mb-1">
              <BookOpen className="w-4 h-4 text-violet-400" />
              CENTRAL DECISION ENTITY
            </div>
            <p className="text-xs font-mono text-[#B7C3D3] truncate">
              {decisionId || 'Target Decision'}
            </p>
            <div className="mt-2 text-[11px] font-mono text-violet-400">
              {decisionLessons.length} Recorded Lessons • Connected
            </div>
          </motion.div>

          {/* SVG Connector 3 */}
          <div className="h-6 w-[2px] bg-gradient-to-b from-violet-500 to-emerald-500 my-1" />

          {/* Bottom Tier: Downstream Operations (Outcomes, Governance, Execution) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
            <motion.div
              whileHover={{ scale: 1.03 }}
              onClick={() => setActiveGraphNode(activeGraphNode === 'OUTCOME' ? null : 'OUTCOME')}
              className={`p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                activeGraphNode === 'OUTCOME'
                  ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                  : 'bg-slate-950/70 border-white/[0.08] text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-emerald-300 mb-1 uppercase">
                <Activity className="w-3.5 h-3.5" />
                OUTCOME MONITOR
              </div>
              <span className="text-[11px] font-mono text-[#8492A5]">
                {outcomeLessons.length} Telemetry Lessons
              </span>
            </motion.div>

            <div className="p-3.5 rounded-xl border bg-slate-950/50 border-white/[0.06] text-center text-slate-400">
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-teal-300 mb-1 uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                GOVERNANCE
              </div>
              <span className="text-[11px] font-mono text-[#8492A5]">
                Sign-off Ledger
              </span>
            </div>

            <div className="p-3.5 rounded-xl border bg-slate-950/50 border-white/[0.06] text-center text-slate-400">
              <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-blue-300 mb-1 uppercase">
                <Zap className="w-3.5 h-3.5" />
                EXECUTION
              </div>
              <span className="text-[11px] font-mono text-[#8492A5]">
                Operational Dispatch
              </span>
            </div>
          </div>
        </div>

        {activeGraphNode && (
          <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-800/40 text-xs font-mono text-violet-200 flex items-center justify-between">
            <span>Filtering knowledge entries for graph focus: <strong className="text-white">[{activeGraphNode}]</strong></span>
            <button
              onClick={() => setActiveGraphNode(null)}
              className="text-xs text-violet-400 hover:text-white font-bold underline"
            >
              Clear Filter
            </button>
          </div>
        )}
      </motion.div>

      {/* ============================================================== */}
      {/* 3. FILTER & SEARCH TOOLBAR                                     */}
      {/* ============================================================== */}
      <div className="bg-[#030914] border border-[rgba(120,190,230,0.16)] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-md">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-[#8492A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search institutional memory by title, content, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-mono bg-slate-900 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="ALL">All Categories</option>
            <option value="OBSERVATION">Observation</option>
            <option value="DECISION_LESSON">Decision Lesson</option>
            <option value="OUTCOME_LESSON">Outcome Lesson</option>
            <option value="OPERATIONAL_NOTE">Operational Note</option>
            <option value="ASSUMPTION">Assumption</option>
            <option value="CONSTRAINT">Constraint</option>
          </select>

          <select
            value={selectedEntryType}
            onChange={(e) => setSelectedEntryType(e.target.value)}
            className="text-xs font-mono bg-slate-900 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="ALL">All Origins</option>
            <option value="HUMAN_RECORDED">Human Recorded</option>
            <option value="SYSTEM_DERIVED">System Derived</option>
          </select>

          <select
            value={selectedSourceType}
            onChange={(e) => setSelectedSourceType(e.target.value)}
            className="text-xs font-mono bg-slate-900 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="ALL">All Sources</option>
            <option value="DECISION">Decision</option>
            <option value="OUTCOME">Outcome</option>
            <option value="LEARNING_SIGNAL">Learning Signal</option>
            <option value="AUDIT">Audit</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. KNOWLEDGE CARDS GRID                                        */}
      {/* ============================================================== */}
      {displayedEntries.length === 0 ? (
        <div className="bg-[#030914] border border-dashed border-slate-800 rounded-2xl p-12 text-center text-[#8492A5]">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-sans font-bold text-white">No knowledge entries found</h3>
          <p className="text-xs font-sans text-[#8492A5] mt-1 max-w-sm mx-auto">
            No operating memory entries match the active criteria. Record a new institutional lesson to preserve operational context.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-mono font-bold inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            RECORD FIRST ENTRY
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedEntries.map((entry) => {
            const catStyle = CATEGORY_COLORS[entry.category] || {
              bg: 'bg-slate-800',
              text: 'text-slate-300',
              border: 'border-slate-700',
            };
            const isSystem = entry.entry_type === 'SYSTEM_DERIVED';

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#030914] border border-white/[0.06] hover:border-violet-500/40 rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between space-y-4 shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {entry.category.replace(/_/g, ' ')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isSystem ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          <Cpu className="w-3 h-3" /> System
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <User className="w-3 h-3" /> {entry.created_by || 'Human'}
                        </span>
                      )}
                    </div>
                  </div>

                  <h4 className="text-base font-sans font-bold text-white tracking-tight mb-2">
                    {entry.title}
                  </h4>
                  <p className="text-[14px] font-sans text-[#B7C3D3] leading-relaxed whitespace-pre-line">
                    {entry.content}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#8492A5]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded text-slate-300 border border-white/[0.04]">
                      <Tag className="w-3 h-3 text-violet-400" />
                      {entry.source_type}
                    </span>

                    {entry.decision_id && (
                      <span className="text-[11px] text-[#8492A5]">
                        Dec: {entry.decision_id.slice(0, 10)}...
                      </span>
                    )}

                    <span className="text-[11px] text-[#8492A5] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    {isSystem ? (
                      <span
                        title="Derived from immutable audit records"
                        className="inline-flex items-center gap-1 text-[11px] text-[#8492A5]"
                      >
                        <Lock className="w-3 h-3" /> Read-only
                      </span>
                    ) : (
                      <button
                        onClick={() => handleArchive(entry.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#8492A5] hover:text-rose-400 transition"
                        title="Archive knowledge entry"
                      >
                        <Archive className="w-3 h-3" /> Archive
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. RECORD KNOWLEDGE MODAL                                      */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#030914] border border-violet-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2 text-white font-sans font-bold">
                  <BookOpen className="w-5 h-5 text-violet-400" />
                  Record Institutional Memory
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-mono text-rose-300">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateEntry} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                    Category (Required)
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as KnowledgeCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="DECISION_LESSON">Decision Lesson</option>
                    <option value="OUTCOME_LESSON">Outcome Lesson</option>
                    <option value="OBSERVATION">Observation</option>
                    <option value="OPERATIONAL_NOTE">Operational Note</option>
                    <option value="ASSUMPTION">Assumption</option>
                    <option value="CONSTRAINT">Constraint</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                    Title (Required)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Seasonal inventory elasticity factor shift"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-sans text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                    Knowledge Content / Rationale (Required)
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe what was learned, observed, assumed, or constrained..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-sans text-slate-200 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                      Source Type
                    </label>
                    <select
                      value={formData.source_type}
                      onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      <option value="DECISION">Decision</option>
                      <option value="OUTCOME">Outcome</option>
                      <option value="LEARNING_SIGNAL">Learning Signal</option>
                      <option value="AUDIT">Audit</option>
                      <option value="MANUAL">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#8492A5] uppercase mb-1">
                      Author Signature
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lead Analyst"
                      value={formData.created_by || ''}
                      onChange={(e) => setFormData({ ...formData, created_by: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Save Entry
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
