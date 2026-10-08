import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, FileText, Zap, AlertTriangle, ChevronRight } from 'lucide-react';
import { DecisionBriefResponse } from '../types';
import { fetchDecisionBrief, generateDecisionBrief } from '../services/api';
import { ContinuousIntelligenceEngine } from './ContinuousIntelligenceEngine';

interface AIDecisionBriefCardProps {
  datasetId: string;
  recommendationId?: string;
}

export const AIDecisionBriefCard: React.FC<AIDecisionBriefCardProps> = ({
  datasetId,
  recommendationId,
}) => {
  const [brief, setBrief] = useState<DecisionBriefResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBrief();
  }, [datasetId]);

  const loadBrief = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDecisionBrief(datasetId);
      setBrief(data);
    } catch (err: any) {
      // If not generated yet, auto-generate initial brief
      handleGenerate();
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const newBrief = await generateDecisionBrief(datasetId, recommendationId);
      setBrief(newBrief);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI Decision Brief');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4">
        <ContinuousIntelligenceEngine
          mode="decision"
          active={loading}
          title="SYNTHESIZING EXECUTIVE DECISION BRIEF"
          description="Synthesizing recommendation rationale, expected impacts, confidence scoring, and trade-offs..."
          metrics={[
            { label: 'DATASET', value: datasetId.slice(0, 8) },
            { label: 'SYNTHESIS', value: 'ACTIVE' },
            { label: 'STATUS', value: 'CONTINUOUS' }
          ]}
        />
      </div>
    );
  }

  if (error && !brief) {
    return (
      <div className="bg-gray-900 border border-rose-500/30 rounded-2xl p-6 text-rose-300 text-xs flex items-center justify-between">
        <span>⚠️ {error}</span>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {generating ? 'Synthesizing...' : 'Generate AI Brief'}
        </button>
      </div>
    );
  }

  if (!brief) return null;

  const isAI = brief.generation_mode === 'ai';
  const modeBadgeColor = isAI
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  return (
    <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-indigo-950/30 border border-indigo-500/40 rounded-2xl p-6 sm:p-7 space-y-6 shadow-2xl font-sans">
      {/* Header & Metadata Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Executive Decision Brief</h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${modeBadgeColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAI ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isAI ? 'Continuous AI Synthesis' : 'Deterministic Fallback'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-sans">
            Provider: <strong className="text-slate-200">{brief.provider_name}</strong> <span className="text-slate-500">({brief.model_name})</span>
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="self-start sm:self-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.25)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          <Zap className="w-4 h-4 text-cyan-300" />
          <span>{generating ? 'Re-evaluating...' : 'Re-evaluate Decision Brief'}</span>
        </button>
      </div>

      {/* Fallback Reason Callout */}
      {brief.fallback_reason && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-amber-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <strong className="block font-semibold">Fallback Mode Active:</strong>
            <span className="text-xs sm:text-sm text-amber-200 leading-relaxed">{brief.fallback_reason}</span>
          </div>
        </div>
      )}

      {/* Executive Summary Box */}
      <div className="bg-gray-950/80 p-5 rounded-xl border border-indigo-500/30 space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
          <FileText className="w-3.5 h-3.5" />
          High-Level Executive Summary
        </span>
        <p className="text-sm sm:text-[15px] leading-relaxed text-slate-200 font-sans">{brief.executive_summary}</p>
      </div>

      {/* Structured Narrative Sections */}
      {brief.sections && brief.sections.length > 0 && (
        <div className="space-y-4">
          {brief.sections.map((sec) => (
            <div key={sec.section_id} className="bg-gray-950/60 p-5 rounded-xl border border-gray-800 space-y-2.5">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{sec.title}</span>
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">{sec.content}</p>

              {sec.bullet_points && sec.bullet_points.length > 0 && (
                <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-300 font-sans pl-2 pt-1">
                  {sec.bullet_points.map((bp, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Claim-Level Evidence Provenance */}
      {brief.claim_evidence_map && brief.claim_evidence_map.length > 0 && (
        <div className="bg-gray-950/70 p-5 rounded-xl border border-gray-800 space-y-3">
          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Claim-Level Evidence Provenance ({brief.claim_evidence_map.length} Validated Claims)
          </span>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {brief.claim_evidence_map.map((item, idx) => (
              <div key={idx} className="bg-gray-900/60 p-3 rounded-lg border border-gray-800 space-y-1.5 text-sm">
                <p className="text-slate-100 font-medium font-sans">{item.claim}</p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {item.evidence_refs.map((ref, rIdx) => (
                    <span key={rIdx} className="bg-indigo-950/80 text-indigo-300 text-xs px-2.5 py-0.5 rounded-md border border-indigo-800/80 font-mono">
                      {ref.type}: {ref.id.slice(0, 8)}...
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Causal Executive Disclaimer */}
      <div className="bg-gray-950/90 p-3.5 rounded-xl border border-gray-800/80 text-xs text-slate-400 flex items-start gap-2.5 leading-relaxed font-sans">
        <ShieldCheck className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
        <span><strong className="text-slate-300">Executive Disclaimer:</strong> Continuous decision rationale synthesized from deterministic statistical evidence. Always review underlying metrics prior to operational deployment.</span>
      </div>
    </div>
  );
};
