import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  EvidenceGraphResponse,
  EvidenceChainResponse,
  EvidenceNode,
  EvidenceNodeType,
  EvidenceEdge,
} from '../types';
import { fetchDatasetEvidenceGraph, fetchDecisionEvidenceChain } from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';
import {
  Database,
  Zap,
  Sparkles,
  Activity,
  Target,
  FileText,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Search,
  Layers,
  GitBranch,
  Network,
  AlertTriangle,
  ChevronRight,
  Plus,
  Minus,
  RotateCcw,
  ArrowRight,
  Copy,
  Check,
  X,
  Filter,
  Maximize2,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface EvidenceGraphViewProps {
  datasetId?: string;
  datasetName?: string;
  version?: number;
  initialDecisionId?: string;
  onSelectNode?: (node: EvidenceNode) => void;
  onBackToDecision?: () => void;
}

const TIER_ORDER: EvidenceNodeType[] = [
  'DATASET_VERSION',
  'ANALYSIS_RUN',
  'INSIGHT',
  'PREDICTION',
  'OPTIMIZATION',
  'RECOMMENDATION',
  'DECISION',
  'GUARDRAIL',
];

interface NodeTheme {
  bg: string;
  border: string;
  text: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const NODE_THEMES: Record<string, NodeTheme> = {
  DATASET: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    accent: '#4D8DFF',
    icon: Database,
    label: 'Dataset',
  },
  DATASET_VERSION: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    accent: '#4D8DFF',
    icon: Database,
    label: 'Dataset Version',
  },
  ANALYSIS_RUN: {
    bg: 'bg-indigo-950/40',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    accent: '#818CF8',
    icon: Zap,
    label: 'Analysis Run',
  },
  INSIGHT: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    accent: '#35D399',
    icon: Sparkles,
    label: 'Insight',
  },
  PREDICTION: {
    bg: 'bg-purple-950/40',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    accent: '#C084FC',
    icon: Activity,
    label: 'Prediction',
  },
  OPTIMIZATION: {
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    accent: '#39D6F5',
    icon: Target,
    label: 'Optimization',
  },
  RECOMMENDATION: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    accent: '#F4B740',
    icon: FileText,
    label: 'Recommendation',
  },
  DECISION: {
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    accent: '#F06B78',
    icon: ShieldCheck,
    label: 'Decision',
  },
  GUARDRAIL: {
    bg: 'bg-teal-950/40',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    accent: '#2DD4BF',
    icon: ShieldAlert,
    label: 'Guardrail',
  },
};

const getNodeTheme = (type: string): NodeTheme => {
  const normalized = (type || '').toUpperCase();
  return (
    NODE_THEMES[normalized] || {
      bg: 'bg-slate-900',
      border: 'border-slate-700',
      text: 'text-[#8795A8]',
      accent: '#8795A8',
      icon: Layers,
      label: type || 'Entity',
    }
  );
};

export const EvidenceGraphView: React.FC<EvidenceGraphViewProps> = ({
  datasetId,
  datasetName = 'Dataset Lineage',
  version,
  initialDecisionId,
  onSelectNode,
  onBackToDecision,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Data states
  const [graphData, setGraphData] = useState<EvidenceGraphResponse | null>(null);
  const [chainData, setChainData] = useState<EvidenceChainResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active workspace view
  const [activeTab, setActiveTab] = useState<'graph' | 'entities' | 'relationships'>('graph');

  // Selected item states
  const [selectedNode, setSelectedNode] = useState<EvidenceNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EvidenceEdge | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState<string>('ALL');

  // Canvas pan & zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Load evidence data
  const loadEvidence = async (isCancelled = () => false) => {
    if (!datasetId && !initialDecisionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const graphPromise = datasetId
        ? fetchDatasetEvidenceGraph(datasetId)
        : Promise.resolve(null);

      const chainPromise = initialDecisionId
        ? fetchDecisionEvidenceChain(initialDecisionId)
        : Promise.resolve(null);

      const [gData, cData] = await Promise.all([graphPromise, chainPromise]);

      if (!isCancelled()) {
        setGraphData(gData);
        setChainData(cData);

        if (cData && cData.nodes.length > 0) {
          const defaultNode =
            cData.nodes.find((n) => n.id === initialDecisionId) ||
            cData.nodes[cData.nodes.length - 1];
          setSelectedNode(defaultNode || cData.nodes[0]);
        } else if (gData && gData.nodes.length > 0) {
          setSelectedNode(gData.nodes[0]);
        }
      }
    } catch (err: any) {
      if (!isCancelled()) {
        console.error('Evidence graph load error:', err);
        setError(err.message || 'Unable to retrieve persisted evidence for this context.');
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadEvidence(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [datasetId, initialDecisionId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNodeClick = (node: EvidenceNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  // Effective combined graph
  const effectiveGraph = useMemo(() => {
    return (
      graphData || {
        project_id: chainData?.project_id || '',
        dataset_id: null,
        root_node_id: null,
        root: null,
        nodes: chainData?.nodes || [],
        edges: chainData?.edges || [],
        counters: {},
      }
    );
  }, [graphData, chainData]);

  // Edges linked to selected node
  const incomingEdges = useMemo(() => {
    return (effectiveGraph.edges || []).filter((e) => e.target === selectedNode?.id);
  }, [effectiveGraph.edges, selectedNode?.id]);

  const outgoingEdges = useMemo(() => {
    return (effectiveGraph.edges || []).filter((e) => e.source === selectedNode?.id);
  }, [effectiveGraph.edges, selectedNode?.id]);

  const relatedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const ids = new Set<string>([selectedNode.id]);
    incomingEdges.forEach((e) => ids.add(e.source));
    outgoingEdges.forEach((e) => ids.add(e.target));
    return ids;
  }, [selectedNode, incomingEdges, outgoingEdges]);

  // Provenance path from root to selected node
  const activePathNodes = useMemo(() => {
    if (!selectedNode) return [];
    const path: EvidenceNode[] = [selectedNode];
    const visited = new Set<string>([selectedNode.id]);
    let current = selectedNode;

    while (current) {
      const parentEdge = (effectiveGraph.edges || []).find((e) => e.target === current.id);
      if (!parentEdge || visited.has(parentEdge.source)) break;
      const parentNode = (effectiveGraph.nodes || []).find((n) => n.id === parentEdge.source);
      if (!parentNode) break;
      visited.add(parentNode.id);
      path.unshift(parentNode);
      current = parentNode;
    }
    return path;
  }, [selectedNode, effectiveGraph]);

  const activePathEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < activePathNodes.length - 1; i++) {
      const srcId = activePathNodes[i].id;
      const tgtId = activePathNodes[i + 1].id;
      const match = (effectiveGraph.edges || []).find(
        (e) => e.source === srcId && e.target === tgtId
      );
      if (match) {
        ids.add(match.id || `${match.source}->${match.target}`);
      }
    }
    return ids;
  }, [activePathNodes, effectiveGraph.edges]);

  // Available distinct entity types
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    (effectiveGraph.nodes || []).forEach((n) => types.add(n.type));
    return Array.from(types);
  }, [effectiveGraph.nodes]);

  // Available distinct relationship types
  const availableRelationshipTypes = useMemo(() => {
    const types = new Set<string>();
    (effectiveGraph.edges || []).forEach((e) => types.add(e.relationship_type));
    return Array.from(types);
  }, [effectiveGraph.edges]);

  // Filtered nodes for the entity list
  const filteredEntities = useMemo(() => {
    return (effectiveGraph.nodes || []).filter((n) => {
      const matchType = typeFilter === 'ALL' || n.type === typeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.status && n.status.toLowerCase().includes(q));
      return matchType && matchQuery;
    });
  }, [effectiveGraph.nodes, typeFilter, searchQuery]);

  // Filtered edges for relationships view
  const filteredEdges = useMemo(() => {
    return (effectiveGraph.edges || []).filter((e) => {
      const matchRel =
        relationshipTypeFilter === 'ALL' || e.relationship_type === relationshipTypeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        e.relationship_type.toLowerCase().includes(q) ||
        e.source_type.toLowerCase().includes(q) ||
        e.target_type.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q);
      return matchRel && matchQuery;
    });
  }, [effectiveGraph.edges, relationshipTypeFilter, searchQuery]);

  // =========================================================================
  // GRAPH CANVAS COORDINATE LAYOUT CALCULATION
  // =========================================================================
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 104;
  const COLUMN_SPACING = 300;
  const ROW_SPACING = 136;

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; tierIndex: number }> = {};
    const nodes = effectiveGraph.nodes || [];

    // Group nodes by tier
    const tierGroups: Record<string, EvidenceNode[]> = {};
    TIER_ORDER.forEach((tier) => {
      tierGroups[tier] = [];
    });
    nodes.forEach((node) => {
      const t = node.type.toUpperCase();
      const key = TIER_ORDER.find((orderTier) => orderTier === t) || 'DATASET_VERSION';
      if (!tierGroups[key]) tierGroups[key] = [];
      tierGroups[key].push(node);
    });

    // Active tiers that actually have nodes
    const activeTiers = TIER_ORDER.filter((t) => (tierGroups[t]?.length || 0) > 0);

    // Compute coordinates
    activeTiers.forEach((tier, colIdx) => {
      const group = tierGroups[tier] || [];
      const count = group.length;
      const colX = colIdx * COLUMN_SPACING + 40;

      group.forEach((node, rowIdx) => {
        // Center nodes vertically around y = 280
        const y = 280 + (rowIdx - (count - 1) / 2) * ROW_SPACING;
        positions[node.id] = {
          x: colX,
          y: Math.max(30, y),
          tierIndex: colIdx,
        };
      });
    });

    return positions;
  }, [effectiveGraph.nodes]);

  // Canvas bounds
  const canvasBounds = useMemo(() => {
    const vals = Object.values(nodePositions);
    if (vals.length === 0) return { width: 1200, height: 600 };
    const maxX = Math.max(...vals.map((v) => v.x)) + NODE_WIDTH + 100;
    const maxY = Math.max(...vals.map((v) => v.y)) + NODE_HEIGHT + 100;
    return {
      width: Math.max(1200, maxX),
      height: Math.max(620, maxY),
    };
  }, [nodePositions]);

  // Canvas mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.evidence-node-card')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetCamera = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitCamera = () => {
    if (!canvasContainerRef.current) return;
    const containerW = canvasContainerRef.current.clientWidth;
    const containerH = canvasContainerRef.current.clientHeight;
    const scaleX = containerW / canvasBounds.width;
    const scaleY = containerH / canvasBounds.height;
    const newZoom = Math.max(0.65, Math.min(1.1, Math.min(scaleX, scaleY) * 0.9));
    setZoom(newZoom);
    setPan({ x: 20, y: 20 });
  };

  // =========================================================================
  // RENDER: LOADING STATE (GRAPH SKELETON)
  // =========================================================================
  if (loading) {
    return (
      <ContinuousIntelligenceEngine
        mode="evidence"
        isLoading={loading}
        isFullScreen={false}
        minHeight="540px"
        error={error}
        onRetry={loadEvidence}
      />
    );
  }

  // =========================================================================
  // RENDER: ERROR STATE
  // =========================================================================
  if (error || (!graphData && !chainData)) {
    return (
      <div className="bg-[#020711] border border-[#F06B78]/30 rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-[#F06B78]/10 border border-[#F06B78]/20 flex items-center justify-center mx-auto text-[#F06B78]">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-[18px] font-sans font-bold text-white tracking-tight">
            EVIDENCE GRAPH UNAVAILABLE
          </h3>
          <p className="text-[14px] font-sans text-rose-200">
            {error || 'Unable to retrieve the decision evidence chain.'}
          </p>
        </div>
        <button
          onClick={() => loadEvidence()}
          className="h-[42px] px-6 bg-[#F06B78]/15 hover:bg-[#F06B78]/25 text-rose-200 text-[13px] font-sans font-bold tracking-wider uppercase rounded-xl border border-[#F06B78]/30 transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>RETRY LOAD</span>
        </button>
      </div>
    );
  }

  // =========================================================================
  // RENDER: EMPTY STATE
  // =========================================================================
  if (!effectiveGraph.nodes || effectiveGraph.nodes.length === 0) {
    return (
      <div className="bg-[#020711] border border-white/[0.08] rounded-2xl p-10 sm:p-12 text-center max-w-xl mx-auto my-6 space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-[#8795A8]">
          <Network className="w-6 h-6 text-[#39D6F5]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-[18px] font-sans font-bold text-white tracking-tight">
            NO EVIDENCE RECORDED
          </h3>
          <p className="text-[14px] font-sans text-[#B8C5D5]">
            No persisted evidence relationships are available for this decision or dataset context yet.
          </p>
        </div>
        {onBackToDecision && (
          <button
            onClick={onBackToDecision}
            className="h-[40px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#39D6F5] text-[13px] font-sans font-bold uppercase tracking-wider border border-[#39D6F5]/30 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO DECISION</span>
          </button>
        )}
      </div>
    );
  }

  // Root or active decision label
  const activeDecisionNode =
    effectiveGraph.nodes.find((n) => n.type === 'DECISION') ||
    effectiveGraph.nodes[effectiveGraph.nodes.length - 1];

  return (
    <div className="space-y-6 select-none">
      {/* ============================================================== */}
      {/* 1. HERO — EVIDENCE GRAPH EXPLORER                              */}
      {/* ============================================================== */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[#07111F]/85 border border-[#39D6F5]/15 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.25)] space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.08]">
          <div className="space-y-2">
            {/* Context Back Action & Phase Pill */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {onBackToDecision && (
                <button
                  onClick={onBackToDecision}
                  className="h-[30px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#39D6F5] border border-[#39D6F5]/30 text-[12px] font-sans font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>BACK TO DECISION</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide bg-[#39D6F5]/10 text-[#39D6F5] border border-[#39D6F5]/25">
                <Network className="w-3.5 h-3.5" />
                PHASE 02 EVIDENCE CHAIN
              </span>
              <span className="text-[12px] font-mono text-[#B8C5D5] bg-slate-900/80 px-3 py-1 rounded-full border border-white/[0.08]">
                {datasetName} {version !== undefined ? `(v${version})` : ''}
              </span>
            </div>

            {/* Redesigned Hero Title */}
            <h2 className="text-3xl sm:text-[44px] lg:text-[48px] font-sans font-extrabold text-white tracking-tight leading-tight">
              EVIDENCE{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39D6F5] via-[#4D8DFF] to-[#9B7BFF]">
                GRAPH EXPLORER
              </span>
            </h2>

            <p className="text-[14px] sm:text-[15px] font-sans text-[#B8C5D5] max-w-3xl leading-relaxed">
              Trace the decision back to the exact dataset, version, analytical run, insight, model,
              optimization and recommendation evidence.
            </p>
          </div>

          {/* Hero Metadata Indicators (Right Side) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] min-w-[140px]">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                CURRENT DECISION
              </span>
              <span className="text-[14px] font-mono font-bold text-white block mt-1 truncate" title={activeDecisionNode?.label}>
                {activeDecisionNode ? activeDecisionNode.label : 'Active Target'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] min-w-[140px]">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                LINEAGE
              </span>
              <span className="text-[14px] font-sans font-bold text-[#39D6F5] block mt-1 truncate">
                {datasetName}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] min-w-[140px]">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                TOTAL NODES
              </span>
              <span className="text-[20px] font-mono font-bold text-white block mt-0.5">
                {effectiveGraph.nodes.length}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] min-w-[140px]">
              <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                RELATIONSHIPS
              </span>
              <span className="text-[20px] font-mono font-bold text-[#35D399] block mt-0.5">
                {effectiveGraph.edges.length}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. EVIDENCE WORKSPACE NAV (THREE DISTINCT WORKSPACES)          */}
        {/* ============================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-950/90 border border-white/[0.08]">
            {[
              {
                id: 'graph',
                label: 'EVIDENCE CHAIN',
                icon: Network,
                badge: `${effectiveGraph.nodes.length} Nodes`,
              },
              {
                id: 'entities',
                label: 'ALL ENTITIES',
                icon: Layers,
                badge: `${effectiveGraph.nodes.length} Items`,
              },
              {
                id: 'relationships',
                label: 'RELATIONSHIPS',
                icon: GitBranch,
                badge: `${effectiveGraph.edges.length} Edges`,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-4 sm:px-5 py-2.5 rounded-lg text-[13px] font-sans font-bold uppercase tracking-wider transition-all flex items-center gap-2 z-10 ${
                    isActive ? 'text-slate-950 font-extrabold' : 'text-[#8795A8] hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="evidence-workspace-active"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#39D6F5] to-[#4D8DFF] shadow-[0_0_20px_rgba(57,214,245,0.4)]"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-[#8795A8]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => loadEvidence()}
            className="h-[42px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#8795A8] hover:text-white border border-white/[0.08] text-[12px] font-sans font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH GRAPH</span>
          </button>
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 3. WORKSPACE 1: EVIDENCE CHAIN (INTERACTIVE PROVENANCE GRAPH)  */}
      {/* ============================================================== */}
      <AnimatePresence mode="wait">
        {activeTab === 'graph' && (
          <motion.div
            key="graph-workspace"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Graph Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-[#07111F]/85 border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#39D6F5] flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  PROVENANCE GRAPH
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[12px] font-sans text-[#8795A8]">
                  Drag canvas to pan • Click node to inspect deterministic lineage
                </span>
              </div>

              {/* Camera Controls */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                  className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-white/[0.08] flex items-center justify-center transition-colors text-sm font-bold"
                  title="Zoom Out"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono text-[12px] text-[#B8C5D5] w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                  className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white border border-white/[0.08] flex items-center justify-center transition-colors text-sm font-bold"
                  title="Zoom In"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={handleFitCamera}
                  className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#B8C5D5] hover:text-white border border-white/[0.08] text-[11px] font-sans font-bold uppercase transition-colors inline-flex items-center gap-1"
                  title="Fit to Canvas"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>FIT</span>
                </button>
                <button
                  onClick={handleResetCamera}
                  className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#B8C5D5] hover:text-white border border-white/[0.08] text-[11px] font-sans font-bold uppercase transition-colors inline-flex items-center gap-1"
                  title="Reset Pan & Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET</span>
                </button>
              </div>
            </div>

            {/* Main Canvas + Side Inspector Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Interactive Graph Canvas Area (8 cols on desktop) */}
              <div
                ref={canvasContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="lg:col-span-8 min-h-[580px] h-[640px] rounded-2xl bg-[#030914] border border-white/[0.08] relative overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
              >
                {/* Subtle Dotted Grid Background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(120,190,230,0.12)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                {/* Scalable & Pannable Graph World */}
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: `${canvasBounds.width}px`,
                    height: `${canvasBounds.height}px`,
                  }}
                  className="absolute left-0 top-0 transition-transform duration-75 ease-out"
                >
                  {/* SVG Layer for Curved Connection Edges */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width={canvasBounds.width}
                    height={canvasBounds.height}
                  >
                    <defs>
                      <marker
                        id="arrow-neutral"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(120, 190, 230, 0.4)" />
                      </marker>
                      <marker
                        id="arrow-active"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 1 L 9 5 L 0 9 z" fill="#39D6F5" />
                      </marker>
                    </defs>

                    {(effectiveGraph.edges || []).map((edge, idx) => {
                      const srcPos = nodePositions[edge.source];
                      const tgtPos = nodePositions[edge.target];
                      if (!srcPos || !tgtPos) return null;

                      const x1 = srcPos.x + NODE_WIDTH;
                      const y1 = srcPos.y + NODE_HEIGHT / 2;
                      const x2 = tgtPos.x;
                      const y2 = tgtPos.y + NODE_HEIGHT / 2;
                      const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);

                      const edgeKey = edge.id || `${edge.source}->${edge.target}`;
                      const isPathActive = activePathEdgeIds.has(edgeKey);
                      const isHovered =
                        hoveredNodeId &&
                        (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
                      const isEdgeSelected = selectedEdge?.id === edge.id;

                      const strokeColor =
                        isPathActive || isEdgeSelected
                          ? '#39D6F5'
                          : isHovered
                          ? '#4D8DFF'
                          : 'rgba(120, 190, 230, 0.22)';
                      const strokeWidth = isPathActive || isEdgeSelected ? 3 : isHovered ? 2.5 : 1.5;

                      return (
                        <g key={edgeKey || idx}>
                          <path
                            d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            markerEnd={isPathActive ? 'url(#arrow-active)' : 'url(#arrow-neutral)'}
                            className="transition-all duration-200"
                          />
                          {/* Midpoint Relationship Label Badge */}
                          <foreignObject
                            x={(x1 + x2) / 2 - 40}
                            y={(y1 + y2) / 2 - 11}
                            width="80"
                            height="22"
                            className="pointer-events-auto cursor-pointer"
                            onClick={() => setSelectedEdge(edge)}
                          >
                            <div
                              className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded text-center truncate border ${
                                isPathActive
                                  ? 'bg-[#39D6F5]/20 text-[#39D6F5] border-[#39D6F5]/40 font-bold'
                                  : 'bg-slate-950/80 text-slate-400 border-white/[0.08]'
                              }`}
                              title={edge.relationship_type}
                            >
                              {edge.relationship_type.replace(/_/g, ' ')}
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Node Cards Layer */}
                  {effectiveGraph.nodes.map((node) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;

                    const theme = getNodeTheme(node.type);
                    const NodeIcon = theme.icon;
                    const isSelected = selectedNode?.id === node.id;
                    const isRelated = relatedNodeIds.has(node.id);
                    const isPathNode = activePathNodes.some((n) => n.id === node.id);

                    return (
                      <div
                        key={node.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeClick(node);
                        }}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        style={{
                          left: `${pos.x}px`,
                          top: `${pos.y}px`,
                          width: `${NODE_WIDTH}px`,
                          height: `${NODE_HEIGHT}px`,
                          borderLeftColor: theme.accent,
                        }}
                        className={`evidence-node-card absolute rounded-xl p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer border-l-4 ${
                          isSelected
                            ? 'bg-[#07111F] ring-2 ring-[#39D6F5] shadow-[0_0_25px_rgba(57,214,245,0.4)] z-30 scale-[1.03]'
                            : isPathNode
                            ? 'bg-[#07111F] border-white/[0.18] shadow-lg z-20'
                            : isRelated
                            ? 'bg-[#07111F]/95 border-white/[0.14] z-10'
                            : selectedNode
                            ? 'bg-[#030914]/80 border-white/[0.06] opacity-40 hover:opacity-100 z-0'
                            : 'bg-[#07111F]/90 border-white/[0.1] hover:border-white/[0.22] hover:bg-[#061224] z-10'
                        }`}
                      >
                        {/* Header: Type icon & tag */}
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <NodeIcon className={`w-3.5 h-3.5 shrink-0 ${theme.text}`} />
                            <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-300 truncate">
                              {theme.label}
                            </span>
                          </div>

                          {node.dataset_version && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30">
                              v{node.dataset_version}
                            </span>
                          )}
                          {node.status && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/[0.06] text-[#B8C5D5] border border-white/[0.08] truncate max-w-[60px]">
                              {node.status}
                            </span>
                          )}
                        </div>

                        {/* Title: 2 lines maximum */}
                        <h4
                          className="text-[13px] font-sans font-semibold text-white leading-snug tracking-tight"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          title={node.label}
                        >
                          {node.label}
                        </h4>

                        {/* Bottom: ID snippet & upstream/downstream indicators */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8795A8] pt-1 border-t border-white/[0.06]">
                          <span className="truncate max-w-[120px]">#{node.id.slice(0, 10)}</span>
                          <span className="text-[#39D6F5] font-bold">
                            {(effectiveGraph.edges || []).filter(
                              (e) => e.source === node.id || e.target === node.id
                            ).length}{' '}
                            links
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side Evidence Inspector (4 cols on desktop) */}
              <div className="lg:col-span-4 bg-[#07111F]/85 border border-[#39D6F5]/15 rounded-2xl p-5 sm:p-6 backdrop-blur-md space-y-5 sticky top-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#39D6F5]">
                      EVIDENCE INSPECTOR
                    </span>
                    <h3 className="text-[17px] font-sans font-bold text-white tracking-tight">
                      Selected Evidence Node
                    </h3>
                  </div>

                  {selectedNode && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 uppercase">
                      {selectedNode.type}
                    </span>
                  )}
                </div>

                {selectedNode ? (
                  <div className="space-y-5">
                    {/* Node Title & Identifier */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {React.createElement(getNodeTheme(selectedNode.type).icon, {
                          className: `w-5 h-5 ${getNodeTheme(selectedNode.type).text}`,
                        })}
                        <span className="text-[12px] font-sans font-bold text-slate-300 uppercase">
                          {getNodeTheme(selectedNode.type).label}
                        </span>
                      </div>
                      <h4 className="text-[16px] font-sans font-bold text-white leading-snug tracking-tight">
                        {selectedNode.label}
                      </h4>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-white/[0.06] text-[11px] font-mono text-[#8795A8]">
                        <span className="truncate max-w-[240px]">ID: {selectedNode.id}</span>
                        <button
                          onClick={() => handleCopy(selectedNode.id, 'node-id')}
                          className="hover:text-white"
                          title="Copy ID"
                        >
                          {copiedId === 'node-id' ? (
                            <Check className="w-3.5 h-3.5 text-[#35D399]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Upstream Parents */}
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-sans font-bold uppercase tracking-wider text-[#4D8DFF]">
                        <span>UPSTREAM DERIVATION ({incomingEdges.length})</span>
                        <span className="text-[10px] text-[#8795A8] font-mono">Parents</span>
                      </div>
                      {incomingEdges.length === 0 ? (
                        <p className="text-[12px] font-sans text-[#8795A8] py-1">
                          Root boundary node in the evidence lineage.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {incomingEdges.map((e, idx) => {
                            const parentNode = effectiveGraph.nodes.find((n) => n.id === e.source);
                            return (
                              <div
                                key={idx}
                                onClick={() => parentNode && handleNodeClick(parentNode)}
                                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-white/[0.04] text-[12px] font-sans flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <span className="text-white font-medium truncate max-w-[160px]">
                                  {parentNode ? parentNode.label : e.source_type}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#39D6F5] uppercase px-1.5 py-0.5 rounded bg-[#39D6F5]/10">
                                  {e.relationship_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Downstream Consumers */}
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-sans font-bold uppercase tracking-wider text-[#35D399]">
                        <span>DOWNSTREAM IMPACT ({outgoingEdges.length})</span>
                        <span className="text-[10px] text-[#8795A8] font-mono">Supports</span>
                      </div>
                      {outgoingEdges.length === 0 ? (
                        <p className="text-[12px] font-sans text-[#8795A8] py-1">
                          Terminal node or governance validation boundary.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {outgoingEdges.map((e, idx) => {
                            const childNode = effectiveGraph.nodes.find((n) => n.id === e.target);
                            return (
                              <div
                                key={idx}
                                onClick={() => childNode && handleNodeClick(childNode)}
                                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-white/[0.04] text-[12px] font-sans flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <span className="text-white font-medium truncate max-w-[160px]">
                                  {childNode ? childNode.label : e.target_type}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#35D399] uppercase px-1.5 py-0.5 rounded bg-[#35D399]/10">
                                  {e.relationship_type.replace(/_/g, ' ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Persisted Metadata Payload */}
                    {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                          PERSISTED PAYLOAD METADATA
                        </span>
                        <pre className="p-3 rounded-xl bg-slate-950 border border-white/[0.06] text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
                          {JSON.stringify(selectedNode.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-10 text-center text-[13px] font-sans text-[#8795A8]">
                    Select any evidence node in the provenance canvas to inspect its multi-hop relations.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Context Bar: Visual Provenance Trail / Breadcrumb */}
            <div className="p-4 rounded-xl bg-[#07111F]/85 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#39D6F5] shrink-0 mr-1">
                  ACTIVE PROVENANCE PATH:
                </span>
                {activePathNodes.map((n, idx) => (
                  <React.Fragment key={n.id}>
                    {idx > 0 && <span className="text-slate-600 font-mono">→</span>}
                    <button
                      onClick={() => handleNodeClick(n)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors shrink-0 flex items-center gap-1.5 ${
                        selectedNode?.id === n.id
                          ? 'bg-[#39D6F5]/20 text-[#39D6F5] border border-[#39D6F5]/40 font-bold'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-white/[0.06]'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getNodeTheme(n.type).accent }}
                      />
                      <span>{getNodeTheme(n.type).label}</span>
                      {n.dataset_version && <span>v{n.dataset_version}</span>}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <span className="text-[11px] font-mono text-[#8795A8] shrink-0">
                {activePathNodes.length} hops to selected node
              </span>
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 4. WORKSPACE 2: ALL ENTITIES (ENTITY INVENTORY)                */}
        {/* ============================================================== */}
        {activeTab === 'entities' && (
          <motion.div
            key="entities-workspace"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Entity Inventory Summary Strip */}
            <div className="p-6 rounded-2xl bg-[#07111F]/85 border border-[#39D6F5]/15 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#39D6F5]" />
                    ENTITY INVENTORY
                  </h3>
                  <p className="text-[14px] font-sans text-[#B8C5D5]">
                    Browse and inspect all traceable analytical entities in this decision lineage.
                  </p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-slate-950 font-mono text-[13px] text-[#B8C5D5] border border-white/[0.08] self-start sm:self-auto">
                  <span className="text-[11px] uppercase text-[#8795A8] mr-2">Total:</span>
                  <strong className="text-[16px] text-white">{effectiveGraph.nodes.length}</strong>{' '}
                  Entities
                </div>
              </div>

              {/* Entity Type Distribution Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
                {TIER_ORDER.map((tier) => {
                  const count = (effectiveGraph.nodes || []).filter((n) => n.type === tier).length;
                  const theme = getNodeTheme(tier);
                  const Icon = theme.icon;
                  return (
                    <button
                      key={tier}
                      onClick={() => setTypeFilter(typeFilter === tier ? 'ALL' : tier)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        typeFilter === tier
                          ? 'bg-[#39D6F5]/15 border-[#39D6F5] ring-1 ring-[#39D6F5]'
                          : 'bg-slate-950/70 border-white/[0.06] hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
                        <span className="font-mono font-bold text-white text-[13px]">{count}</span>
                      </div>
                      <span className="text-[11px] font-sans text-[#8795A8] block mt-1 truncate">
                        {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/80 border border-white/[0.08]">
              {/* Type Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setTypeFilter('ALL')}
                  className={`h-[38px] px-3.5 rounded-lg text-[12px] font-sans font-bold uppercase tracking-wider transition-all shrink-0 ${
                    typeFilter === 'ALL'
                      ? 'bg-[#39D6F5] text-slate-950 shadow-md font-extrabold'
                      : 'bg-slate-900 text-[#8795A8] hover:text-white border border-white/[0.06]'
                  }`}
                >
                  ALL ({effectiveGraph.nodes.length})
                </button>
                {availableTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`h-[38px] px-3.5 rounded-lg text-[12px] font-sans font-bold uppercase tracking-wider transition-all shrink-0 ${
                      typeFilter === t
                        ? 'bg-[#39D6F5] text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-900 text-[#8795A8] hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    {getNodeTheme(t).label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search entities, IDs, labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[40px] pl-9 pr-8 bg-slate-900 border border-slate-700 rounded-lg text-[13px] text-white placeholder-[#8795A8] focus:outline-none focus:border-[#39D6F5]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Structured Entity Explorer Table + Detail Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 rounded-xl border border-white/[0.08] overflow-hidden bg-slate-950/80">
                <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-900/90 border-b border-white/[0.08] text-[12px] font-sans font-bold uppercase tracking-wider text-[#8795A8]">
                  <div className="col-span-3">TYPE</div>
                  <div className="col-span-5">ENTITY LABEL & ID</div>
                  <div className="col-span-2">STATUS / VER</div>
                  <div className="col-span-2 text-right">ACTION</div>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {filteredEntities.length === 0 ? (
                    <div className="p-10 text-center text-[13px] font-sans text-[#8795A8]">
                      No entities matching the active filters.
                    </div>
                  ) : (
                    filteredEntities.map((node) => {
                      const theme = getNodeTheme(node.type);
                      const Icon = theme.icon;
                      const isSelected = selectedNode?.id === node.id;
                      const linkCount = (effectiveGraph.edges || []).filter(
                        (e) => e.source === node.id || e.target === node.id
                      ).length;

                      return (
                        <div
                          key={node.id}
                          onClick={() => handleNodeClick(node)}
                          className={`min-h-[68px] py-3 px-4 sm:px-5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-3 cursor-pointer transition-all border-l-2 ${
                            isSelected
                              ? 'bg-[#39D6F5]/10 border-l-[#39D6F5]'
                              : 'hover:bg-white/[0.02] border-l-transparent hover:border-l-[#39D6F5]/40'
                          }`}
                        >
                          <div className="sm:col-span-3 flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg ${theme.bg} ${theme.border} border shrink-0`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
                            </span>
                            <span className="text-[12px] font-sans font-bold uppercase text-slate-200 truncate">
                              {theme.label}
                            </span>
                          </div>

                          <div className="sm:col-span-5 min-w-0 space-y-0.5">
                            <h4 className="text-[14px] font-sans font-semibold text-white truncate">
                              {node.label}
                            </h4>
                            <span className="text-[11px] font-mono text-[#8795A8] block truncate">
                              ID: {node.id}
                            </span>
                          </div>

                          <div className="sm:col-span-2 flex items-center gap-1.5">
                            {node.dataset_version && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30">
                                v{node.dataset_version}
                              </span>
                            )}
                            {node.status && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-white/[0.04] text-[#B8C5D5] border border-white/[0.06]">
                                {node.status}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-end gap-2">
                            <span className="text-[11px] font-mono text-[#8795A8] hidden sm:inline">
                              {linkCount} links
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeClick(node);
                              }}
                              className="h-[32px] px-3 rounded-lg bg-slate-900 hover:bg-[#39D6F5]/20 text-slate-300 hover:text-[#39D6F5] border border-white/[0.08] text-[11px] font-sans font-bold uppercase transition-colors inline-flex items-center gap-1"
                            >
                              <span>INSPECT</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Side Inspector in Entity View */}
              <div className="lg:col-span-4 bg-[#07111F]/85 border border-[#39D6F5]/15 rounded-2xl p-5 sm:p-6 backdrop-blur-md space-y-5 sticky top-6 shadow-xl">
                <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#39D6F5] block">
                  ENTITY DETAILS
                </span>
                {selectedNode ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#39D6F5]/15 text-[#39D6F5] border border-[#39D6F5]/30 uppercase">
                        {selectedNode.type}
                      </span>
                      <h4 className="text-[17px] font-sans font-bold text-white tracking-tight mt-2">
                        {selectedNode.label}
                      </h4>
                      <div className="text-[11px] font-mono text-[#8795A8]">ID: {selectedNode.id}</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-white/[0.06] space-y-2">
                      <div className="text-[11px] font-sans font-bold uppercase text-[#4D8DFF]">
                        Connected Edges
                      </div>
                      <div className="text-[13px] font-sans text-white">
                        {incomingEdges.length} Upstream • {outgoingEdges.length} Downstream
                      </div>
                    </div>

                    {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                          Persisted Payload
                        </span>
                        <pre className="p-3 rounded-xl bg-slate-950 border border-white/[0.06] text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
                          {JSON.stringify(selectedNode.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-[13px] font-sans text-[#8795A8]">
                    Select any entity in the list to view its details.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* 5. WORKSPACE 3: RELATIONSHIPS (FLOW & EDGE LEDGER)             */}
        {/* ============================================================== */}
        {activeTab === 'relationships' && (
          <motion.div
            key="relationships-workspace"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Relationship Summary KPIs */}
            <div className="p-6 rounded-2xl bg-[#07111F]/85 border border-[#39D6F5]/15 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-[20px] font-sans font-bold text-white tracking-tight flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-[#39D6F5]" />
                    RELATIONSHIP ANALYSIS
                  </h3>
                  <p className="text-[14px] font-sans text-[#B8C5D5]">
                    Trace explicit directional relationships connecting data, models, insights, and decisions.
                  </p>
                </div>
              </div>

              {/* 3 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/[0.06]">
                  <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                    TOTAL EDGES
                  </span>
                  <span className="text-[24px] font-mono font-bold text-white block mt-1">
                    {effectiveGraph.edges.length}
                  </span>
                  <span className="text-[12px] font-sans text-[#8795A8] mt-0.5 block">
                    Persisted graph relationships
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/[0.06]">
                  <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                    RELATIONSHIP TYPES
                  </span>
                  <span className="text-[24px] font-mono font-bold text-[#39D6F5] block mt-1">
                    {availableRelationshipTypes.length}
                  </span>
                  <span className="text-[12px] font-sans text-[#8795A8] mt-0.5 block">
                    Distinct semantic verbs
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-white/[0.06]">
                  <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#8795A8] block">
                    CONNECTED ENTITIES
                  </span>
                  <span className="text-[24px] font-mono font-bold text-[#35D399] block mt-1">
                    {effectiveGraph.nodes.length}
                  </span>
                  <span className="text-[12px] font-sans text-[#8795A8] mt-0.5 block">
                    Nodes in relationship network
                  </span>
                </div>
              </div>
            </div>

            {/* High-Level Relationship Flow Diagram */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-4">
              <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-[#39D6F5] block">
                TYPICAL DECISION EVIDENCE PROGRESSION
              </span>
              <div className="overflow-x-auto pb-2">
                <div className="flex items-center gap-3 min-w-[800px] text-center">
                  {[
                    { label: 'DATASET', verb: 'HAS_VERSION' },
                    { label: 'VERSION', verb: 'PRODUCED_RUN' },
                    { label: 'RUN', verb: 'SUPPORTS' },
                    { label: 'INSIGHT', verb: 'OPTIMIZED_FROM' },
                    { label: 'OPTIMIZATION', verb: 'RESULTED_IN' },
                    { label: 'DECISION', verb: 'EVALUATED_BY' },
                    { label: 'GUARDRAILS', verb: '' },
                  ].map((step, idx) => (
                    <React.Fragment key={idx}>
                      <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/[0.08] text-[12px] font-sans font-bold text-white shrink-0">
                        {step.label}
                      </div>
                      {step.verb && (
                        <div className="flex flex-col items-center gap-0.5 shrink-0 px-1">
                          <span className="text-[9px] font-mono font-bold uppercase text-[#39D6F5] bg-[#39D6F5]/10 px-2 py-0.5 rounded border border-[#39D6F5]/25">
                            {step.verb}
                          </span>
                          <span className="text-slate-600 text-xs">→</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Relationship Ledger Table */}
            <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-slate-950/80">
              <div className="p-4 bg-slate-900/90 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h4 className="text-[15px] font-sans font-bold text-white uppercase tracking-tight">
                  RELATIONSHIP LEDGER ({filteredEdges.length})
                </h4>

                {/* Filter Selector */}
                <div className="relative">
                  <select
                    value={relationshipTypeFilter}
                    onChange={(e) => setRelationshipTypeFilter(e.target.value)}
                    className="h-[38px] appearance-none pl-3.5 pr-8 bg-slate-900 border border-slate-700 rounded-lg text-[12px] font-sans text-white focus:outline-none focus:border-[#39D6F5]"
                  >
                    <option value="ALL">All Relationship Types</option>
                    {availableRelationshipTypes.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-[13px]">
                  <thead className="bg-slate-900/50 text-[#8795A8] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-5">SOURCE ENTITY</th>
                      <th className="py-3 px-4 text-center">RELATIONSHIP TYPE</th>
                      <th className="py-3 px-5">TARGET ENTITY</th>
                      <th className="py-3 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-slate-300">
                    {filteredEdges.map((edge, idx) => {
                      const srcNode = effectiveGraph.nodes.find((n) => n.id === edge.source);
                      const tgtNode = effectiveGraph.nodes.find((n) => n.id === edge.target);
                      const srcTheme = getNodeTheme(edge.source_type);
                      const tgtTheme = getNodeTheme(edge.target_type);

                      return (
                        <tr
                          key={edge.id || idx}
                          onClick={() => {
                            if (srcNode) handleNodeClick(srcNode);
                            setSelectedEdge(edge);
                          }}
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded ${srcTheme.bg} ${srcTheme.border} border`}>
                                {React.createElement(srcTheme.icon, {
                                  className: `w-3 h-3 ${srcTheme.text}`,
                                })}
                              </span>
                              <div>
                                <div className="font-semibold text-white group-hover:text-[#39D6F5] transition-colors">
                                  {srcNode ? srcNode.label : edge.source_type}
                                </div>
                                <div className="font-mono text-[11px] text-[#8795A8]">
                                  #{edge.source.slice(0, 12)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-[#39D6F5]/10 text-[#39D6F5] border border-[#39D6F5]/25">
                              {edge.relationship_type.replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded ${tgtTheme.bg} ${tgtTheme.border} border`}>
                                {React.createElement(tgtTheme.icon, {
                                  className: `w-3 h-3 ${tgtTheme.text}`,
                                })}
                              </span>
                              <div>
                                <div className="font-semibold text-white group-hover:text-[#39D6F5] transition-colors">
                                  {tgtNode ? tgtNode.label : edge.target_type}
                                </div>
                                <div className="font-mono text-[11px] text-[#8795A8]">
                                  #{edge.target.slice(0, 12)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (srcNode) handleNodeClick(srcNode);
                                setSelectedEdge(edge);
                              }}
                              className="h-[32px] px-3 rounded-lg bg-slate-900 group-hover:bg-[#39D6F5]/20 text-slate-300 group-hover:text-[#39D6F5] border border-white/[0.08] text-[11px] font-sans font-bold uppercase transition-colors inline-flex items-center gap-1"
                            >
                              <span>TRACE</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
