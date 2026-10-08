import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Cpu,
  BrainCircuit,
  AlertCircle,
  Sliders,
  Sparkles,
  ShieldCheck,
  Network,
  GitCompare,
  History,
  Database,
  Target,
  TrendingUp,
  RefreshCw,
  FileCheck,
  Play,
  Shield,
  Share2,
  Wand2,
  CheckCircle2,
  UploadCloud,
  BarChart2,
  Activity,
  Terminal,
} from 'lucide-react';

export type LoaderMode =
  | 'upload'
  | 'profiling'
  | 'quality'
  | 'cleaning'
  | 'analysis'
  | 'insights'
  | 'prediction'
  | 'predictions'
  | 'optimization'
  | 'recommendation'
  | 'recommendations'
  | 'decision'
  | 'decisions'
  | 'guardrails'
  | 'evidence'
  | 'outcome'
  | 'performance'
  | 'learning'
  | 'governance'
  | 'execution'
  | 'audit'
  | 'knowledge'
  | 'versioning'
  | 'runs'
  | 'memory'
  | 'generic';

export type EngineMode = LoaderMode;

export interface ContinuousLoaderProps {
  mode?: LoaderMode;
  active?: boolean;
  isLoading?: boolean;
  isFullScreen?: boolean;
  minHeight?: string;
  eyebrow?: string;
  title?: string;
  desc?: string;
  description?: string;
  metrics?: { label: string; value: string }[];
  error?: string | null;
  onRetry?: () => void;
  onComplete?: () => void;
  className?: string;
}

export type ContinuousIntelligenceEngineProps = ContinuousLoaderProps;

interface NodeConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  pathD: string;
  particleDur: string;
  particleDelay: string;
}

interface ModeSpec {
  nodes: NodeConfig[];
  defaultEyebrow: string;
  defaultTitle: string;
  defaultDesc: string;
  icon: React.ReactNode;
}

interface ModePipelineData {
  steps: string[];
  logs: string[];
  nodeStatuses: Record<string, string>;
  defaultMetrics: { label: string; value: string }[];
}

const getModeSpec = (mode: LoaderMode): ModeSpec => {
  switch (mode) {
    case 'upload':
    case 'profiling':
      return {
        nodes: [
          { id: 'DATA', label: 'DATA', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'SIGNALS', label: 'SIGNALS', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.4s' },
          { id: 'ANALYSIS', label: 'ANALYSIS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.8s' },
          { id: 'PROFILE', label: 'PROFILE', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.0s', particleDelay: '1.2s' },
        ],
        defaultEyebrow: 'INGESTION ENGINE // DATASET PROFILING',
        defaultTitle: 'UPLOADING & PROFILING DATASET',
        defaultDesc: 'Parsing tabular schema, computing statistical distributions, and generating data health telemetry...',
        icon: <UploadCloud className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'cleaning':
      return {
        nodes: [
          { id: 'RAW', label: 'RAW DATA', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'ISSUES', label: 'ISSUES', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'TRANSFORM', label: 'TRANSFORM', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'CLEANED', label: 'CLEANED', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'CLEANING ENGINE // REMEDIATION PIPELINE',
        defaultTitle: 'EXECUTING DATA TRANSFORMATION',
        defaultDesc: 'Resolving missing values, normalizing structural schema anomalies, and applying deterministic cleaning rules...',
        icon: <Wand2 className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'quality':
      return {
        nodes: [
          { id: 'SCHEMA', label: 'SCHEMA', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'HEALTH', label: 'HEALTH', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.4s' },
          { id: 'RULES', label: 'RULES', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.8s' },
          { id: 'QUALITY', label: 'QUALITY', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.0s', particleDelay: '1.2s' },
        ],
        defaultEyebrow: 'QUALITY ENGINE // INTEGRITY AUDIT',
        defaultTitle: 'COMPUTING DATA QUALITY HEALTH',
        defaultDesc: 'Evaluating column validity, completeness ratios, and structural statistical integrity...',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'analysis':
      return {
        nodes: [
          { id: 'DATA', label: 'DATA', x: 380, y: 50, color: '#39D6F5', pathD: 'M 380,50 L 380,230', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'STRUCTURE', label: 'STRUCTURE', x: 120, y: 160, color: '#4D8DFF', pathD: 'M 120,160 Q 230,175 380,230', particleDur: '2.8s', particleDelay: '0.4s' },
          { id: 'SIGNALS', label: 'SIGNALS', x: 640, y: 160, color: '#9B7BFF', pathD: 'M 380,230 Q 520,175 640,160', particleDur: '2.7s', particleDelay: '0.8s' },
          { id: 'VISUALS', label: 'VISUALS', x: 150, y: 360, color: '#39D6F5', pathD: 'M 380,230 Q 240,310 150,360', particleDur: '3.0s', particleDelay: '1.2s' },
          { id: 'INSIGHTS', label: 'INSIGHTS', x: 610, y: 360, color: '#4D8DFF', pathD: 'M 610,360 Q 520,310 380,230', particleDur: '2.5s', particleDelay: '1.6s' },
        ],
        defaultEyebrow: 'ANALYSIS ENGINE // EXPLORATORY SIGNALS',
        defaultTitle: 'COMPUTING EXPLORATORY ANALYSIS',
        defaultDesc: 'Extracting numerical distributions, categorical patterns, and correlation matrices...',
        icon: <BarChart2 className="w-4 h-4 text-[#39D6F5] animate-pulse" />,
      };

    case 'prediction':
    case 'predictions':
      return {
        nodes: [
          { id: 'DATA', label: 'DATA', x: 55, y: 130, color: '#39D6F5', pathD: 'M 55,130 Q 135,115 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'MODEL', label: 'MODEL', x: 220, y: 32, color: '#4D8DFF', pathD: 'M 220,130 Q 205,80 220,32', particleDur: '2.7s', particleDelay: '0.4s' },
          { id: 'FEATURES', label: 'FEATURES', x: 385, y: 130, color: '#39D6F5', pathD: 'M 385,130 Q 305,145 220,130', particleDur: '2.9s', particleDelay: '0.8s' },
          { id: 'PREDICTION', label: 'PREDICTION', x: 220, y: 228, color: '#9B7BFF', pathD: 'M 220,130 Q 235,180 220,228', particleDur: '2.6s', particleDelay: '1.2s' },
        ],
        defaultEyebrow: 'PREDICTION ENGINE // TRAINING CANDIDATES',
        defaultTitle: 'INITIALIZING PREDICTIVE INTELLIGENCE',
        defaultDesc: 'Discovering ML candidate tasks and trained algorithm parameters...',
        icon: <BrainCircuit className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'optimization':
      return {
        nodes: [
          { id: 'DATA', label: 'DATA', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'FEATURES', label: 'FEATURES', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'CONSTRAINTS', label: 'CONSTRAINTS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'MODEL', label: 'MODEL', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'OPTIMIZATION CONSOLE // PARAMETER CONSTRAINTS',
        defaultTitle: 'INITIALIZING OPTIMIZATION CONSOLE',
        defaultDesc: 'Extracting controllable features, observed parameter boundaries, and ML model constraints...',
        icon: <Sliders className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'recommendation':
    case 'recommendations':
      return {
        nodes: [
          { id: 'PREDICTION', label: 'PREDICTION', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'SCENARIOS', label: 'SCENARIOS', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.9s', particleDelay: '0.5s' },
          { id: 'IMPACT', label: 'IMPACT', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'RECOMMENDATION', label: 'RECOMMENDATION', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.0s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'RECOMMENDATION ENGINE // ROI INTERVENTIONS',
        defaultTitle: 'SCANNING RECOMMENDATIONS',
        defaultDesc: 'Querying decision intelligence repository and scenario rankings...',
        icon: <Sparkles className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'decision':
    case 'decisions':
      return {
        nodes: [
          { id: 'SIGNALS', label: 'SIGNALS', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'OPTIONS', label: 'OPTIONS', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.5s' },
          { id: 'GOVERNANCE', label: 'GOVERNANCE', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.9s' },
          { id: 'DECISION', label: 'DECISION', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,215 385,205', particleDur: '3.1s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'EVIDENCE AGGREGATION // AUDIT TRAILS',
        defaultTitle: 'AGGREGATING EVIDENCE CHAIN',
        defaultDesc: 'Loading primary recommendations, multi-hop evidence, and deterministic outcomes...',
        icon: <Cpu className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'guardrails':
      return {
        nodes: [
          { id: 'DECISION', label: 'DECISION', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'MODEL', label: 'MODEL', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.4s' },
          { id: 'RULES', label: 'RULES', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.8s' },
          { id: 'VALIDATION', label: 'VALIDATION', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.2s' },
        ],
        defaultEyebrow: 'GUARDRAILS ENGINE // POLICY VERIFICATION',
        defaultTitle: 'EVALUATING DECISION GUARDRAILS',
        defaultDesc: 'Running automated safety boundaries, bias prevention checks, and corporate policy verifications...',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'evidence':
      return {
        nodes: [
          { id: 'DATASET', label: 'DATASET', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'RUN', label: 'RUN', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.9s', particleDelay: '0.45s' },
          { id: 'INSIGHT', label: 'INSIGHT', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.9s' },
          { id: 'DECISION', label: 'DECISION', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'PROVENANCE GRAPH // EVIDENCE TRACE',
        defaultTitle: 'BUILDING EVIDENCE GRAPH',
        defaultDesc: 'Traversing deterministic provenance traces across dataset versions, analysis runs, insights, and decisions...',
        icon: <Network className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'versioning':
      return {
        nodes: [
          { id: 'V1', label: 'VERSION 1', x: 55, y: 55, color: '#4D8DFF', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'DRIFT', label: 'DRIFT', x: 55, y: 205, color: '#39D6F5', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'DELTAS', label: 'DELTAS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'V2', label: 'VERSION 2', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.0s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'LINEAGE ENGINE // VERSION COMPARISON',
        defaultTitle: 'COMPUTING VERSION DELTAS',
        defaultDesc: 'Computing statistical deltas, schema structural drift, data quality shifts, and downstream model impact...',
        icon: <GitCompare className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'runs':
      return {
        nodes: [
          { id: 'DATASET', label: 'DATASET', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'VERSION', label: 'VERSION', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'EXECUTION', label: 'EXECUTION', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.9s' },
          { id: 'OUTPUT', label: 'OUTPUT', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'EXECUTION ENGINE // PIPELINE RUNS',
        defaultTitle: 'QUERYING RUN HISTORY',
        defaultDesc: 'Aggregating execution telemetry, duration logs, and reproduction fingerprints across analysis runs...',
        icon: <History className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'memory':
      return {
        nodes: [
          { id: 'VERSION', label: 'VERSION', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'DRIFT', label: 'DRIFT', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'PATTERNS', label: 'PATTERNS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'MEMORY', label: 'MEMORY', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'INSIGHT MEMORY // HISTORICAL REPOSITORIES',
        defaultTitle: 'SYNCHRONIZING INSIGHT MEMORY',
        defaultDesc: 'Loading lineage memory, tracking cross-version drift, and aggregating historical decision patterns...',
        icon: <Database className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'outcome':
      return {
        nodes: [
          { id: 'EXPECTED', label: 'EXPECTED', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'OBSERVED', label: 'OBSERVED', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.5s' },
          { id: 'VARIANCE', label: 'VARIANCE', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.9s' },
          { id: 'OUTCOME', label: 'OUTCOME', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'OUTCOME TELEMETRY // CLOSED-LOOP SIGNALS',
        defaultTitle: 'LOADING DECISION OUTCOMES',
        defaultDesc: 'Evaluating projected expectation against empirical observed outcome variance and closed-loop signals...',
        icon: <Target className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'performance':
      return {
        nodes: [
          { id: 'DECISIONS', label: 'DECISIONS', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'OUTCOMES', label: 'OUTCOMES', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.9s', particleDelay: '0.5s' },
          { id: 'CORRIDORS', label: 'CORRIDORS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'METRICS', label: 'METRICS', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.0s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'PERFORMANCE ENGINE // BENCHMARK TRENDS',
        defaultTitle: 'EVALUATING PERFORMANCE TRENDS',
        defaultDesc: 'Aggregating match rates, variance delta corridors, and empirical coverage across historical decision batches...',
        icon: <TrendingUp className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'learning':
      return {
        nodes: [
          { id: 'OUTCOME', label: 'OUTCOME', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'DEVIATION', label: 'DEVIATION', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'DRIFT', label: 'DRIFT', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.9s' },
          { id: 'LEARNING', label: 'LEARNING', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'LEARNING ENGINE // ADAPTIVE CALIBRATION',
        defaultTitle: 'SYNCHRONIZING LEARNING SIGNALS',
        defaultDesc: 'Scanning observed decision outcomes for recurring variance, drift patterns, and calibration requirements...',
        icon: <RefreshCw className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'governance':
      return {
        nodes: [
          { id: 'DECISION', label: 'DECISION', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'REVIEW', label: 'REVIEW', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'POLICY', label: 'POLICY', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.7s', particleDelay: '0.9s' },
          { id: 'APPROVAL', label: 'APPROVAL', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'GOVERNANCE ENGINE // APPROVAL WORKFLOW',
        defaultTitle: 'LOADING GOVERNANCE WORKSPACE',
        defaultDesc: 'Compiling policy checkpoints, human-in-the-loop review statuses, and compliance sign-offs...',
        icon: <FileCheck className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'execution':
      return {
        nodes: [
          { id: 'READY', label: 'READY', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.4s', particleDelay: '0s' },
          { id: 'CONFIRM', label: 'CONFIRM', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.7s', particleDelay: '0.45s' },
          { id: 'EXECUTE', label: 'EXECUTE', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'MONITOR', label: 'MONITOR', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'EXECUTION ENGINE // OPERATIONS CONSOLE',
        defaultTitle: 'ASSEMBLING EXECUTION CONSOLE',
        defaultDesc: 'Loading target system integrations, parameter payloads, and automated execution dispatchers...',
        icon: <Play className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'audit':
      return {
        nodes: [
          { id: 'TIMELINE', label: 'TIMELINE', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'EVENTS', label: 'EVENTS', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'ACTORS', label: 'ACTORS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'AUDIT', label: 'AUDIT', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'AUDIT ENGINE // IMMUTABLE LEDGER',
        defaultTitle: 'SCANNING AUDIT TRAIL',
        defaultDesc: 'Retrieving cryptographically verified audit records, actor signatures, and temporal provenance chains...',
        icon: <Shield className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    case 'knowledge':
      return {
        nodes: [
          { id: 'ENTITIES', label: 'ENTITIES', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'RELATIONS', label: 'RELATIONS', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.8s', particleDelay: '0.45s' },
          { id: 'DECISIONS', label: 'DECISIONS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'KNOWLEDGE', label: 'KNOWLEDGE', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.35s' },
        ],
        defaultEyebrow: 'KNOWLEDGE ENGINE // ENTITY GRAPH',
        defaultTitle: 'SYNTHESIZING KNOWLEDGE MAP',
        defaultDesc: 'Querying neural entity relationships, cross-decision connections, and semantic reasoning structures...',
        icon: <Share2 className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };

    default:
      return {
        nodes: [
          { id: 'DATA', label: 'DATA', x: 55, y: 55, color: '#39D6F5', pathD: 'M 55,55 Q 135,65 220,130', particleDur: '2.5s', particleDelay: '0s' },
          { id: 'SIGNALS', label: 'SIGNALS', x: 55, y: 205, color: '#4D8DFF', pathD: 'M 55,205 Q 135,195 220,130', particleDur: '2.9s', particleDelay: '0.5s' },
          { id: 'MODELS', label: 'MODELS', x: 385, y: 55, color: '#9B7BFF', pathD: 'M 220,130 Q 305,65 385,55', particleDur: '2.6s', particleDelay: '0.9s' },
          { id: 'DECISIONS', label: 'DECISIONS', x: 385, y: 205, color: '#39D6F5', pathD: 'M 220,130 Q 305,195 385,205', particleDur: '3.1s', particleDelay: '1.3s' },
        ],
        defaultEyebrow: 'ANALYSIS ENGINE // PREPARING DECISION SIGNALS',
        defaultTitle: 'SYNTHESIZING DECISION SIGNALS',
        defaultDesc: 'Synthesizing verified findings into executive decision intelligence...',
        icon: <Cpu className="w-3.5 h-3.5 text-[#39D6F5] animate-pulse" />,
      };
  }
};

const getModePipelineData = (mode: LoaderMode): ModePipelineData => {
  switch (mode) {
    case 'cleaning':
      return {
        steps: ['Raw Ingestion', 'Anomaly Scan', 'Remediation', 'Integrity Proof'],
        logs: [
          'Initializing remediation pipeline & deterministic rule engine...',
          'Scanning columnar vectors: isolating missing cells and schema drift...',
          'Applying deterministic median & forward-fill imputations...',
          'Normalizing structural types, categorical encoders & string tokens...',
          'Eliminating duplicate records and validating schema boundaries...',
          'Verifying integrity telemetry: 100% deterministic rules passed...',
        ],
        nodeStatuses: {
          RAW: '● INGESTED',
          ISSUES: '⚡ 34 ISOLATED',
          TRANSFORM: '⚡ EXECUTING',
          CLEANED: '✓ VERIFIED',
        },
        defaultMetrics: [
          { label: 'THROUGHPUT', value: '1.4M rows/s' },
          { label: 'PIPELINE', value: 'DETERMINISTIC' },
          { label: 'INTEGRITY', value: '99.98%' },
        ],
      };

    case 'upload':
    case 'profiling':
      return {
        steps: ['Schema Parse', 'Distributions', 'Health Audit', 'Profile Output'],
        logs: [
          'Parsing tabular schema buffers and header descriptors...',
          'Computing univariate statistical moments and quantile distributions...',
          'Detecting high-cardinality columns and distribution skews...',
          'Evaluating correlation matrices and data health indices...',
          'Synthesizing interactive profile artifacts and summary telemetry...',
        ],
        nodeStatuses: {
          DATA: '● INGESTED',
          SIGNALS: '⚡ COMPUTING',
          ANALYSIS: '⚡ PROFILING',
          PROFILE: '✓ READY',
        },
        defaultMetrics: [
          { label: 'STATUS', value: 'STREAMING' },
          { label: 'PROFILER', value: 'ACTIVE' },
          { label: 'COVERAGE', value: '100%' },
        ],
      };

    case 'quality':
      return {
        steps: ['Schema Audit', 'Validity Scan', 'Completeness', 'Quality Scoring'],
        logs: [
          'Evaluating structural column validity and schema typing...',
          'Measuring completeness ratios and missingness heatmaps...',
          'Checking referential integrity and statistical anomaly boundaries...',
          'Synthesizing holistic dataset health index and audit report...',
        ],
        nodeStatuses: {
          SCHEMA: '● VALIDATED',
          HEALTH: '⚡ SCORING',
          RULES: '⚡ VERIFYING',
          QUALITY: '✓ AUDITED',
        },
        defaultMetrics: [
          { label: 'HEALTH', value: '98.6%' },
          { label: 'VALIDITY', value: 'PASSED' },
          { label: 'AUDIT', value: 'VERIFIED' },
        ],
      };

    case 'analysis':
      return {
        steps: ['Data Mapping', 'Correlations', 'Pattern Scan', 'Signal Output'],
        logs: [
          'Extracting numerical moments and categorical distribution vectors...',
          'Computing cross-feature Pearson & Spearman correlation matrices...',
          'Isolating multivariate outliers and unexpected trend shifts...',
          'Synthesizing exploratory insight signals and visualization maps...',
        ],
        nodeStatuses: {
          DATA: '● INGESTED',
          STRUCTURE: '● PARSED',
          SIGNALS: '⚡ COMPUTING',
          VISUALS: '⚡ RENDERING',
          INSIGHTS: '✓ SYNTHESIZED',
        },
        defaultMetrics: [
          { label: 'SIGNALS', value: 'EXTRACTING' },
          { label: 'CORRELATION', value: 'COMPUTED' },
          { label: 'INSIGHTS', value: 'REAL-TIME' },
        ],
      };

    case 'prediction':
    case 'predictions':
      return {
        steps: ['Feature Matrix', 'Model Training', 'Parameter Tuning', 'Inferences'],
        logs: [
          'Assembling predictive feature matrices and target vectors...',
          'Evaluating regression and classification candidate architectures...',
          'Calibrating hyperparameters and validation fold loss...',
          'Synthesizing prediction confidence corridors and feature importances...',
        ],
        nodeStatuses: {
          DATA: '● INGESTED',
          MODEL: '⚡ LOADED',
          FEATURES: '⚡ EXTRACTED',
          PREDICTION: '✓ GENERATING',
        },
        defaultMetrics: [
          { label: 'ALGORITHM', value: 'ACTIVE' },
          { label: 'CONFIDENCE', value: '94.2%' },
          { label: 'ACCURACY', value: 'OPTIMAL' },
        ],
      };

    case 'optimization':
      return {
        steps: ['Param Search', 'Constraint Scan', 'Objective Solve', 'Pareto Frontier'],
        logs: [
          'Extracting controllable business levers and parameter domains...',
          'Encoding constraints and feasibility boundary conditions...',
          'Running multi-objective optimizer across loss landscape...',
          'Identifying optimal parameter combinations on Pareto frontier...',
        ],
        nodeStatuses: {
          DATA: '● INGESTED',
          FEATURES: '● MAPPED',
          CONSTRAINTS: '⚡ BOUNDED',
          MODEL: '✓ CONVERGED',
        },
        defaultMetrics: [
          { label: 'OPTIMIZER', value: 'GRADIENT' },
          { label: 'FRONTIER', value: 'SOLVING' },
          { label: 'EFFICIENCY', value: '99.4%' },
        ],
      };

    case 'recommendation':
    case 'recommendations':
      return {
        steps: ['Decision Memory', 'Simulations', 'ROI Projection', 'Prioritization'],
        logs: [
          'Querying historical decision memory and benchmark outcomes...',
          'Simulating counterfactual operational intervention scenarios...',
          'Projecting expected ROI, risk-adjusted returns and variances...',
          'Ranking actionable recommendation packages by executive value...',
        ],
        nodeStatuses: {
          PREDICTION: '● READY',
          SCENARIOS: '⚡ SIMULATING',
          IMPACT: '⚡ CALCULATING',
          RECOMMENDATION: '✓ RANKED',
        },
        defaultMetrics: [
          { label: 'SCENARIOS', value: '1,024 EVAL' },
          { label: 'ROI TARGET', value: '+18.4%' },
          { label: 'CONFIDENCE', value: 'HIGH' },
        ],
      };

    case 'decision':
    case 'decisions':
      return {
        steps: ['Evidence Trace', 'Multi-Criteria', 'Policy Gates', 'Decision Brief'],
        logs: [
          'Traversing multi-hop evidence chains and model outputs...',
          'Scoring multi-criteria trade-offs against strategic objectives...',
          'Validating automated governance boundaries and policy compliance...',
          'Synthesizing unified executive decision intelligence record...',
        ],
        nodeStatuses: {
          SIGNALS: '● AGGREGATED',
          OPTIONS: '⚡ WEIGHING',
          GOVERNANCE: '⚡ COMPLIANT',
          DECISION: '✓ SYNTHESIZED',
        },
        defaultMetrics: [
          { label: 'EVIDENCE', value: 'VERIFIED' },
          { label: 'GOVERNANCE', value: '100% PASS' },
          { label: 'STATUS', value: 'DISPATCHED' },
        ],
      };

    default:
      return {
        steps: ['Data Ingestion', 'Signal Extract', 'Neural Synthesis', 'Executive Output'],
        logs: [
          'Connecting to intelligence engine runtime and data pipelines...',
          'Extracting empirical signal vectors and state telemetry...',
          'Computing model inferences and deterministic constraints...',
          'Synthesizing verified executive intelligence insights...',
        ],
        nodeStatuses: {
          DATA: '● INGESTED',
          SIGNALS: '⚡ COMPUTING',
          MODELS: '⚡ SOLVING',
          DECISIONS: '✓ READY',
        },
        defaultMetrics: [
          { label: 'PIPELINE', value: 'ACTIVE' },
          { label: 'STREAM', value: 'REAL-TIME' },
          { label: 'INTEGRITY', value: 'SECURED' },
        ],
      };
  }
};

const scaleNode = (n: NodeConfig, currentMode: LoaderMode): NodeConfig => {
  if (currentMode === 'analysis') return n;
  if (n.x > 400 || n.y > 240) return n;
  const sx = 760 / 440;
  const sy = 460 / 260;
  const newX = Math.round(n.x * sx);
  const newY = Math.round(n.y * sy);
  const newPathD = n.pathD.replace(/(\d+),(\d+)/g, (_, xStr, yStr) => {
    const x = Math.round(Number(xStr) * sx);
    const y = Math.round(Number(yStr) * sy);
    return `${x},${y}`;
  });
  return {
    ...n,
    x: newX,
    y: newY,
    pathD: newPathD,
  };
};

export const ContinuousIntelligenceEngine: React.FC<ContinuousLoaderProps> = ({
  mode = 'analysis',
  active,
  isLoading,
  isFullScreen = true,
  minHeight = '520px',
  eyebrow,
  title,
  desc,
  description,
  metrics,
  error,
  onRetry,
  onComplete,
  className = '',
}) => {
  const isEffectiveLoading = active !== undefined ? active : (isLoading !== undefined ? isLoading : true);
  const shouldReduceMotion = useReducedMotion();
  const [activeHighlightIndex, setActiveHighlightIndex] = useState<number>(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [activeLogIndex, setActiveLogIndex] = useState<number>(0);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  // Completion sequence when isEffectiveLoading transitions from true to false
  useEffect(() => {
    if (!isEffectiveLoading && !error) {
      setIsFinishing(true);
      const timer = setTimeout(() => {
        setIsFinishing(false);
        if (onComplete) onComplete();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isEffectiveLoading, error, onComplete]);

  // Rotate highlight node every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveHighlightIndex((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Progress through pipeline steps smoothly
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(stepInterval);
  }, []);

  // Cycle micro-telemetry logs every 2.2s
  useEffect(() => {
    const logInterval = setInterval(() => {
      setActiveLogIndex((prev) => (prev + 1) % 6);
    }, 2200);
    return () => clearInterval(logInterval);
  }, []);

  // Subtle 3D mouse parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = Math.max(-5, Math.min(5, ((e.clientX - centerX) / (rect.width / 2)) * 5));
    const deltaY = Math.max(-5, Math.min(5, ((e.clientY - centerY) / (rect.height / 2)) * 5));
    setMouseOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  const rawModeSpec = getModeSpec(mode);
  const modeSpec = {
    ...rawModeSpec,
    nodes: rawModeSpec.nodes.map((n) => scaleNode(n, mode)),
  };
  const nodes = modeSpec.nodes;
  const pipelineData = getModePipelineData(mode);

  const activeEyebrow = eyebrow || modeSpec.defaultEyebrow;
  const activeTitle = title || modeSpec.defaultTitle;
  const activeDesc = description || desc || modeSpec.defaultDesc;
  const badgeIcon = modeSpec.icon;
  const activeMetrics = metrics && metrics.length > 0 ? metrics : pipelineData.defaultMetrics;
  const currentLog = pipelineData.logs[activeLogIndex % pipelineData.logs.length];

  // Error State View
  if (error) {
    return (
      <div
        className={`${
          isFullScreen
            ? 'fixed inset-0 z-50 bg-[#020711] flex flex-col items-center justify-center p-6'
            : 'flex flex-col items-center justify-center p-8 rounded-2xl bg-[#020711]/90 border border-rose-500/20 w-full'
        } ${className}`}
        style={{ minHeight: isFullScreen ? undefined : minHeight }}
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-sans font-bold text-white tracking-tight uppercase mb-2">
          INTELLIGENCE ENGINE HALTED
        </h3>
        <p className="text-sm font-sans text-rose-300 max-w-md text-center leading-relaxed mb-6">
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl font-sans font-semibold text-xs text-white bg-rose-600 hover:bg-rose-500 border border-rose-400/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.3)]"
          >
            Retry Pipeline
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      key={`engine-${mode}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1200,
        minHeight: isFullScreen ? undefined : minHeight,
      }}
      className={`${
        isFullScreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#020711] flex flex-col items-center justify-center overflow-y-auto py-8'
          : 'relative flex flex-col items-center justify-center p-6 sm:p-10 rounded-2xl bg-[#020711]/95 border border-[rgba(57,214,245,0.18)] w-full overflow-hidden'
      } select-none ${className}`}
    >
      {/* ============================================================== */}
      {/* 0. EMBEDDED UNIVERSAL CSS KEYFRAMES (Always active & smooth)   */}
      {/* ============================================================== */}
      <style>{`
        @keyframes cie-stream-flow {
          from { stroke-dashoffset: 40; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes cie-stream-flow-reverse {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 40; }
        }
        @keyframes cie-pulse-core {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.16); opacity: 1; }
        }
        @keyframes cie-radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cie-shimmer-pass {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes cie-ambient-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.96); }
          50% { opacity: 0.55; transform: scale(1.06); }
        }
        .cie-laser-stream {
          animation: cie-stream-flow 1.2s linear infinite;
        }
        .cie-core-pulse {
          animation: cie-pulse-core 2s ease-in-out infinite;
          transform-origin: 0px 0px;
        }
        .cie-radar-rotator {
          animation: cie-radar-sweep 4.5s linear infinite;
          transform-origin: 0px 0px;
        }
        .cie-shimmer-bar {
          animation: cie-shimmer-pass 2s ease-in-out infinite;
        }
      `}</style>

      {/* ============================================================== */}
      {/* 1. ATMOSPHERE & TECHNICAL GRID BACKGROUND                       */}
      {/* ============================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep chromatic ambient light pools */}
        <div
          className="absolute inset-0 opacity-40 transition-opacity duration-1000"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 30%, rgba(57, 214, 245, 0.18), transparent 50%), radial-gradient(circle at 50% 50%, rgba(77, 141, 255, 0.16), transparent 55%), radial-gradient(circle at 82% 70%, rgba(155, 123, 255, 0.15), transparent 50%)',
          }}
        />

        {/* Technical Coordinate Grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(57, 214, 245, 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(57, 214, 245, 0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Dynamic perspective floor grid */}
        <div className="absolute inset-x-0 bottom-0 h-48 pointer-events-none opacity-15 [mask-image:linear-gradient(to_bottom,transparent,black_75%)]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(57, 214, 245, 0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(77, 141, 255, 0.6) 1px, transparent 1px)',
              backgroundSize: '44px 20px',
              transform: 'perspective(320px) rotateX(62deg)',
              transformOrigin: 'bottom center',
            }}
          />
        </div>

        {/* Floating cybernetic particles */}
        {[
          { top: '15%', left: '12%', size: 'w-1 h-1', dur: '4s' },
          { top: '24%', left: '85%', size: 'w-1.5 h-1.5', dur: '5s' },
          { top: '75%', left: '14%', size: 'w-1 h-1', dur: '6s' },
          { top: '82%', left: '80%', size: 'w-1.5 h-1.5', dur: '4.5s' },
          { top: '35%', left: '8%', size: 'w-1 h-1', dur: '7s' },
          { top: '65%', left: '90%', size: 'w-1 h-1', dur: '5.5s' },
          { top: '20%', left: '50%', size: 'w-2 h-2', dur: '6.5s' },
          { top: '80%', left: '46%', size: 'w-1 h-1', dur: '4.2s' },
        ].map((pt, idx) => (
          <div
            key={idx}
            className={`absolute rounded-full bg-[#39D6F5] ${pt.size} opacity-40 animate-pulse`}
            style={{
              top: pt.top,
              left: pt.left,
              animationDuration: pt.dur,
              boxShadow: '0 0 8px #39D6F5',
            }}
          />
        ))}
      </div>

      {/* ============================================================== */}
      {/* 2. MAIN INTERACTIVE CONTENT CONTAINER                           */}
      {/* ============================================================== */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-4xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
        
        {/* ============================================================== */}
        {/* 3. CINEMATIC INTELLIGENCE NETWORK (SVG Canvas 760x480)         */}
        {/* ============================================================== */}
        <div
          style={{
            transform: `translate3d(${mouseOffset.x}px, ${mouseOffset.y}px, 0)`,
            transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.4, 1)',
          }}
          className="relative w-full max-w-[760px] h-[310px] sm:h-[380px] lg:h-[440px] flex items-center justify-center"
        >
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 760 480"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="cie-outer-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#39D6F5" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#4D8DFF" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#9B7BFF" stopOpacity="0.95" />
              </linearGradient>

              <radialGradient id="cie-core-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#39D6F5" stopOpacity="1" />
                <stop offset="45%" stopColor="#0E335C" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#020815" stopOpacity="1" />
              </radialGradient>

              <radialGradient id="cie-radar-glow-grad" cx="0%" cy="0%" r="100%">
                <stop offset="0%" stopColor="#39D6F5" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#4D8DFF" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#9B7BFF" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="cie-core-ambient-light" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#39D6F5" stopOpacity="0.65" />
                <stop offset="50%" stopColor="#4D8DFF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#020711" stopOpacity="0" />
              </radialGradient>

              <linearGradient id="cie-conduit-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#39D6F5" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#4D8DFF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#9B7BFF" stopOpacity="0.85" />
              </linearGradient>

              <filter id="cie-glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <filter id="cie-glow-strong" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Define unique conduit paths for animateMotion mpath */}
              {nodes.map((node) => (
                <path
                  key={`def-conduit-${node.id}`}
                  id={`conduit-path-${node.id}`}
                  d={node.pathD}
                />
              ))}
            </defs>

            {/* ========================================================== */}
            {/* A. BROAD BACKGROUND ENERGY ENVELOPE (Large curved paths)   */}
            {/* ========================================================== */}
            <path
              d="M 60 120 Q 380 40 700 120"
              stroke="#39D6F5"
              strokeWidth="1"
              strokeDasharray="6 10"
              fill="none"
              opacity="0.12"
            />
            <path
              d="M 80 340 Q 380 420 680 340"
              stroke="#9B7BFF"
              strokeWidth="1"
              strokeDasharray="8 8"
              fill="none"
              opacity="0.10"
            />

            {/* ========================================================== */}
            {/* B. CONDUIT CONNECTION PATHS & ANIMATED LASER STREAMS       */}
            {/* ========================================================== */}
            {nodes.map((node, idx) => {
              const isHighlighted = activeHighlightIndex === idx;
              return (
                <g key={`conduit-group-${node.id}`}>
                  {/* Base Guide Track */}
                  <path
                    d={node.pathD}
                    stroke={
                      isHighlighted
                        ? node.color
                        : 'rgba(57, 214, 245, 0.22)'
                    }
                    strokeWidth={isHighlighted ? '2' : '1.4'}
                    strokeDasharray="4 6"
                    fill="none"
                    opacity={isHighlighted ? 0.9 : 0.45}
                  />

                  {/* Active High-Speed Laser Stream (Continuous traveling flow) */}
                  <path
                    d={node.pathD}
                    stroke="url(#cie-conduit-glow)"
                    strokeWidth="2.2"
                    strokeDasharray="8 12"
                    fill="none"
                    className="cie-laser-stream"
                    filter="url(#cie-glow-cyan)"
                    opacity="0.85"
                  />

                  {/* Travelling Quantum Photon Packets (Staggered continuous flow) */}
                  {!isFinishing && (
                    <>
                      {/* Primary Bright Photon */}
                      <circle r="3.8" fill={node.color} filter="url(#cie-glow-strong)">
                        <animateMotion
                          dur={node.particleDur}
                          repeatCount="indefinite"
                          rotate="auto"
                        >
                          <mpath href={`#conduit-path-${node.id}`} />
                        </animateMotion>
                      </circle>

                      {/* Secondary White Core Photon */}
                      <circle r="2.4" fill="#FFFFFF" opacity="0.95">
                        <animateMotion
                          dur={node.particleDur}
                          begin={`calc(${node.particleDur} * 0.45)`}
                          repeatCount="indefinite"
                          rotate="auto"
                        >
                          <mpath href={`#conduit-path-${node.id}`} />
                        </animateMotion>
                      </circle>

                      {/* Trailing Energy Spark */}
                      <circle r="1.8" fill="#39D6F5" opacity="0.75">
                        <animateMotion
                          dur={node.particleDur}
                          begin={`calc(${node.particleDur} * 0.75)`}
                          repeatCount="indefinite"
                          rotate="auto"
                        >
                          <mpath href={`#conduit-path-${node.id}`} />
                        </animateMotion>
                      </circle>
                    </>
                  )}
                </g>
              );
            })}

            {/* ========================================================== */}
            {/* C. SURROUNDING PIPELINE NODES & ACTIVE TELEMETRY PILLS     */}
            {/* ========================================================== */}
            {nodes.map((node, idx) => {
              const isHighlighted = activeHighlightIndex === idx;
              const nodeStatus = pipelineData.nodeStatuses[node.id] || '● ACTIVE';
              const isTop = node.y < 200;
              const pillWidth = Math.max(94, nodeStatus.length * 7.4 + 24);

              // Absolute vertical positioning without any collision:
              // For top nodes: Pill (y=43..63) -> Title (y=79) -> Circle (y=97)
              // For bottom nodes: Circle (y=363) -> Title (y=391) -> Pill (y=405..425)
              const labelY = isTop ? node.y - 18 : node.y + 28;
              const pillRectY = isTop ? node.y - 54 : node.y + 42;
              const pillTextY = isTop ? node.y - 40 : node.y + 56;

              return (
                <g key={`node-${node.id}`}>
                  {/* Expanding Sonar Beacon Waves */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="15"
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1.4"
                    opacity="0.45"
                  >
                    <animate
                      attributeName="r"
                      values="12;28"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.75;0"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="15"
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1.2"
                    opacity="0.45"
                  >
                    <animate
                      attributeName="r"
                      values="12;28"
                      begin="1.2s"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.75;0"
                      begin="1.2s"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Outer Node Halo */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="11"
                    fill="#05101E"
                    stroke={node.color}
                    strokeWidth="2.2"
                    filter="url(#cie-glow-cyan)"
                  />

                  {/* Node Inner Core Dot */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="4.5"
                    fill={isHighlighted ? '#FFFFFF' : node.color}
                  />

                  {/* Node Title Header - perfectly distanced from circle and pill */}
                  <text
                    x={node.x}
                    y={labelY}
                    textAnchor="middle"
                    fill={isHighlighted ? '#FFFFFF' : '#F1F5F9'}
                    fontSize="12"
                    fontFamily="IBM Plex Mono, monospace"
                    fontWeight="700"
                    letterSpacing="0.08em"
                  >
                    {node.label}
                  </text>

                  {/* Node Live Status Pill - auto-sized width with centered padding */}
                  <g>
                    <rect
                      x={Math.round(node.x - pillWidth / 2)}
                      y={pillRectY}
                      width={Math.round(pillWidth)}
                      height="20"
                      rx="10"
                      fill="rgba(4, 15, 30, 0.92)"
                      stroke={node.color}
                      strokeWidth="1"
                      strokeOpacity="0.8"
                    />
                    <text
                      x={node.x}
                      y={pillTextY}
                      textAnchor="middle"
                      fill={node.color}
                      fontSize="9.5"
                      fontFamily="IBM Plex Mono, monospace"
                      fontWeight="600"
                      letterSpacing="0.04em"
                    >
                      {nodeStatus}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* ========================================================== */}
            {/* D. CENTRAL INTELLIGENCE REACTOR CORE (Grouped at 380, 230) */}
            {/* Center: (0, 0) inside group - 100% stable concentric spin  */}
            {/* ========================================================== */}
            <g transform="translate(380, 230)">
              {/* 1. Radial Shockwaves Radiating from Core */}
              {!isFinishing && (
                <>
                  <circle cx="0" cy="0" r="32" fill="none" stroke="#39D6F5" strokeWidth="1.8">
                    <animate attributeName="r" values="30;150" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.75;0" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="0" cy="0" r="32" fill="none" stroke="#4D8DFF" strokeWidth="1.5">
                    <animate attributeName="r" values="30;150" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.75;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                  </circle>
                </>
              )}

              {/* 2. Ambient Core Aura (Soft breathing glow) */}
              <circle
                cx="0"
                cy="0"
                r="115"
                fill="url(#cie-core-ambient-light)"
                className="cie-ambient-pulse"
              />

              {/* 3. Sweeping 360° Radar / Lidar Scanner Beam */}
              {!isFinishing && (
                <g className="cie-radar-rotator">
                  {/* Conical radar sweep trail */}
                  <path
                    d="M 0 0 L 132 0 A 132 132 0 0 1 93 93 Z"
                    fill="url(#cie-radar-glow-grad)"
                    opacity="0.5"
                  />
                  {/* Leading scanning beam */}
                  <line
                    x1="0"
                    y1="0"
                    x2="136"
                    y2="0"
                    stroke="#39D6F5"
                    strokeWidth="2.2"
                    filter="url(#cie-glow-cyan)"
                  />
                  <circle cx="136" cy="0" r="3.5" fill="#FFFFFF" filter="url(#cie-glow-strong)" />
                </g>
              )}

              {/* 4. Outer Cyber Compass Ring (r=130) with Radian Ticks */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="24s"
                  repeatCount="indefinite"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="130"
                  stroke="rgba(57, 214, 245, 0.28)"
                  strokeWidth="1.2"
                  strokeDasharray="3 9"
                  fill="none"
                />
                {/* 4 Primary Axes Markers on rotating ring */}
                <line x1="0" y1="-125" x2="0" y2="-135" stroke="#39D6F5" strokeWidth="1.5" />
                <line x1="125" y1="0" x2="135" y2="0" stroke="#39D6F5" strokeWidth="1.5" />
                <line x1="0" y1="125" x2="0" y2="135" stroke="#39D6F5" strokeWidth="1.5" />
                <line x1="-125" y1="0" x2="-135" y2="0" stroke="#39D6F5" strokeWidth="1.5" />
              </g>

              {/* Stationary Cardinal Markers - Always Upright (Never upside down) */}
              <g opacity="0.85">
                <text x="0" y="-140" fill="#39D6F5" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600" textAnchor="middle">00°</text>
                <text x="146" y="3" fill="#39D6F5" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600" textAnchor="start">90°</text>
                <text x="0" y="148" fill="#39D6F5" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600" textAnchor="middle">180°</text>
                <text x="-146" y="3" fill="#39D6F5" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600" textAnchor="end">270°</text>
              </g>

              {/* 5. Outer Segmented Rotor (r=112, 10s Clockwise) */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="10s"
                  repeatCount="indefinite"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="112"
                  stroke="url(#cie-outer-ring)"
                  strokeWidth="2.2"
                  strokeDasharray="25 15 70 15 45 15"
                  fill="none"
                />
                <circle cx="112" cy="0" r="3.5" fill="#39D6F5" filter="url(#cie-glow-cyan)" />
                <circle cx="-112" cy="0" r="3" fill="#9B7BFF" filter="url(#cie-glow-cyan)" />
              </g>

              {/* 6. Counter-Rotating Blue Ring (r=92, 7s Counter-Clockwise) */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="-360"
                  dur="7s"
                  repeatCount="indefinite"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="92"
                  stroke="#4D8DFF"
                  strokeWidth="2"
                  strokeDasharray="50 30 20 30"
                  fill="none"
                  opacity="0.85"
                />
                <circle cx="0" cy="92" r="3" fill="#4D8DFF" />
                <circle cx="0" cy="-92" r="2.5" fill="#FFFFFF" />
              </g>

              {/* 7. Inner Telemetry Arc (r=72, 4.5s Clockwise) */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="4.5s"
                  repeatCount="indefinite"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="72"
                  stroke="#39D6F5"
                  strokeWidth="1.8"
                  strokeDasharray="35 25 15 25"
                  fill="none"
                />
                <circle cx="72" cy="0" r="2.5" fill="#39D6F5" />
              </g>

              {/* 8. Micro High-Speed Arc (r=55, 3.2s Counter-Clockwise) */}
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="-360"
                  dur="3.2s"
                  repeatCount="indefinite"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="55"
                  stroke="#9B7BFF"
                  strokeWidth="1.5"
                  strokeDasharray="25 45"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* 9. Orbiting Quantum Satellite Particles */}
              {!isFinishing && (
                <>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite" />
                    <circle cx="78" cy="0" r="2.8" fill="#39D6F5" filter="url(#cie-glow-cyan)" />
                  </g>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="4s" repeatCount="indefinite" />
                    <circle cx="0" cy="85" r="2.4" fill="#4D8DFF" />
                  </g>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="5.5s" repeatCount="indefinite" />
                    <circle cx="-62" cy="0" r="2.2" fill="#9B7BFF" />
                  </g>
                </>
              )}

              {/* 10. Central Fusion Core & Breathing Light */}
              <g className="cie-core-pulse">
                {/* Core casing */}
                <circle
                  cx="0"
                  cy="0"
                  r="42"
                  fill="url(#cie-core-grad)"
                  stroke="#39D6F5"
                  strokeWidth="2.2"
                  filter="url(#cie-glow-cyan)"
                />
                {/* Core dashed telemetry track */}
                <circle
                  cx="0"
                  cy="0"
                  r="27"
                  fill="none"
                  stroke="rgba(57, 214, 245, 0.55)"
                  strokeWidth="1.4"
                  strokeDasharray="4 4"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Intense Plasma Orb */}
                <circle cx="0" cy="0" r="14" fill="#39D6F5" filter="url(#cie-glow-strong)">
                  <animate attributeName="r" values="12;16;12" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="0" r="5.5" fill="#FFFFFF">
                  <animate attributeName="r" values="4.5;7;4.5" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </g>

              {/* 11. Completion Settle Checkmark */}
              {isFinishing && (
                <motion.g
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <circle cx="0" cy="0" r="32" fill="#020711" stroke="#39D6F5" strokeWidth="2.5" />
                  <motion.path
                    d="M-12 0 L-4 8 L12 -8"
                    fill="none"
                    stroke="#39D6F5"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                </motion.g>
              )}
            </g>
          </svg>
        </div>

        {/* ============================================================== */}
        {/* 4. STATUS TITLES, BADGES & DYNAMIC PROGRESS STEPS              */}
        {/* ============================================================== */}
        <div className="space-y-3.5 max-w-2xl mx-auto w-full" aria-live="polite">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#07111F] border border-[#39D6F5]/40 text-xs sm:text-[13px] font-mono text-[#39D6F5] shadow-[0_0_16px_rgba(57,214,245,0.18)]">
            {badgeIcon}
            <span className="font-semibold tracking-wider">{activeEyebrow}</span>
          </div>

          {/* Main Title & Animated Cascading Dots */}
          <h2 className="text-[22px] sm:text-[26px] font-sans font-bold text-[#F4F7FB] tracking-tight flex items-center justify-center gap-1">
            <span>{isFinishing ? 'INTELLIGENCE SYNTHESIS COMPLETE' : activeTitle}</span>

            {!isFinishing && (
              <span className="inline-flex items-center gap-1.5 ml-2.5">
                {[0, 0.2, 0.4].map((delay, idx) => (
                  <motion.span
                    key={idx}
                    className="w-2 h-2 rounded-full bg-[#39D6F5] shadow-[0_0_8px_#39D6F5]"
                    animate={{
                      scale: [0.8, 1.4, 0.8],
                      opacity: [0.35, 1, 0.35],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </span>
            )}
          </h2>

          {/* Description */}
          <p className="text-[14px] sm:text-[15.5px] font-sans text-[#B8C5D5] max-w-xl mx-auto leading-relaxed">
            {isFinishing ? 'Intelligence pipeline finalized. Transitioning workspace...' : activeDesc}
          </p>

          {/* ============================================================== */}
          {/* 5. 4-STAGE PIPELINE PROGRESSION STEPPER (Non-truncating)       */}
          {/* ============================================================== */}
          <div className="pt-2 pb-1 w-full max-w-2xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {pipelineData.steps.map((step, idx) => {
                const isActive = activeStepIndex === idx;
                const isPast = activeStepIndex > idx;

                return (
                  <div
                    key={idx}
                    className={`relative px-3.5 py-2.5 rounded-xl text-left border transition-all duration-300 flex items-center gap-2.5 overflow-hidden ${
                      isActive
                        ? 'bg-[#39D6F5]/15 border-[#39D6F5] shadow-[0_0_16px_rgba(57,214,245,0.28)] text-white'
                        : isPast
                        ? 'bg-[#071426]/70 border-[#39D6F5]/35 text-slate-200'
                        : 'bg-[#040D1A]/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isActive
                          ? 'bg-[#39D6F5] shadow-[0_0_8px_#39D6F5] animate-ping'
                          : isPast
                          ? 'bg-[#39D6F5]'
                          : 'bg-slate-700'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 leading-none mb-1">
                        STAGE 0{idx + 1}
                      </div>
                      <div className="text-[12px] font-semibold font-sans leading-tight text-white whitespace-normal line-clamp-1">
                        {step}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* 6. LIVE TELEMETRY CONSOLE / ACTIVITY TICKER (Cyber Deck HUD)  */}
          {/* ============================================================== */}
          <div className="relative max-w-2xl mx-auto rounded-xl bg-[#030914]/95 border border-slate-800/90 p-3.5 text-left font-mono shadow-[0_6px_28px_rgba(0,0,0,0.6)] backdrop-blur-md">
            {/* Cyber HUD Corner Reticles */}
            <div className="absolute -top-[1px] -left-[1px] w-2.5 h-2.5 border-t-2 border-l-2 border-[#39D6F5]/80" />
            <div className="absolute -top-[1px] -right-[1px] w-2.5 h-2.5 border-t-2 border-r-2 border-[#39D6F5]/80" />
            <div className="absolute -bottom-[1px] -left-[1px] w-2.5 h-2.5 border-b-2 border-l-2 border-[#39D6F5]/80" />
            <div className="absolute -bottom-[1px] -right-[1px] w-2.5 h-2.5 border-b-2 border-r-2 border-[#39D6F5]/80" />

            <div className="flex items-center justify-between text-[10.5px] text-slate-400 pb-2 border-b border-slate-800/70 mb-2.5">
              <span className="flex items-center gap-2 text-[#39D6F5] font-semibold tracking-wider">
                <Terminal className="w-3.5 h-3.5" />
                <span>SYSTEM RUNTIME // PIPELINE TELEMETRY</span>
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-semibold text-[10px] tracking-wide">ACTIVE // NOMINAL</span>
              </span>
            </div>

            <div className="text-[12px] text-slate-200 flex items-center gap-2.5">
              <span className="text-[#39D6F5] font-bold text-sm">❯</span>
              <span className="text-slate-100 font-mono tracking-wide leading-relaxed truncate">
                {currentLog}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 7. DYNAMIC PROGRESS RAIL (Flowing laser bar & percentage)      */}
        {/* ============================================================== */}
        <div className="w-full max-w-xl mx-auto pt-1 space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400 px-1">
            <span className="tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39D6F5] animate-ping" />
              PIPELINE EXECUTION CYCLE
            </span>
            <span className="text-[#39D6F5] font-semibold">
              {['28%', '54%', '78%', '94%'][activeStepIndex % 4]}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden shadow-inner">
            <div
              className="absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-[#39D6F5] to-transparent cie-shimmer-bar"
              style={{ filter: 'drop-shadow(0 0 8px #39D6F5)' }}
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* 8. METRICS STRIP                                              */}
        {/* ============================================================== */}
        {activeMetrics && activeMetrics.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {activeMetrics.map((m, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center gap-1.5 shadow-sm"
              >
                <Activity className="w-3 h-3 text-[#39D6F5]" />
                <span className="text-slate-400 uppercase tracking-wider">{m.label}:</span>
                <span className="text-[#39D6F5] font-semibold">{m.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const ContinuousIntelligenceLoader = ContinuousIntelligenceEngine;
