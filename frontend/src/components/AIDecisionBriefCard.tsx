import React, { useState, useEffect } from 'react';
import { DecisionBriefResponse } from '../types';
import { fetchDecisionBrief, generateDecisionBrief } from '../services/api';

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
      <div className="bg-gray-900/90 border border-indigo-500/30 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-mono text-gray-400">Synthesizing Executive AI Decision Brief...</p>
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
    <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-indigo-950/30 border border-indigo-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
      {/* Header & Metadata Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🤖</span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">Executive AI Decision Brief</h3>
            <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${modeBadgeColor}`}>
              {isAI ? 'AI Generated' : 'Deterministic Fallback'}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Provider: <strong className="text-gray-200">{brief.provider_name}</strong> ({brief.model_name})
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="self-start sm:self-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1.5"
        >
          <span>{generating ? 'Re-evaluating...' : '⚡ Generate / Re-evaluate Brief'}</span>
        </button>
      </div>

      {/* Fallback Reason Callout */}
      {brief.fallback_reason && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs flex items-start space-x-2">
          <span>⚠️</span>
          <div>
            <strong className="block">Fallback Mode Active:</strong>
            <span className="text-[11px] text-amber-200">{brief.fallback_reason}</span>
          </div>
        </div>
      )}

      {/* Executive Summary Box */}
      <div className="bg-gray-950/80 p-4 rounded-xl border border-indigo-500/30 font-mono text-xs leading-relaxed text-gray-200">
        <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
          📌 High-Level Executive Summary
        </span>
        <p className="text-gray-300">{brief.executive_summary}</p>
      </div>

      {/* Structured Narrative Sections */}
      {brief.sections && brief.sections.length > 0 && (
        <div className="space-y-4">
          {brief.sections.map((sec) => (
            <div key={sec.section_id} className="bg-gray-950/60 p-4 rounded-xl border border-gray-800 space-y-2">
              <h4 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
                <span className="text-indigo-400">▸</span>
                <span>{sec.title}</span>
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed font-mono">{sec.content}</p>

              {sec.bullet_points && sec.bullet_points.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 font-mono pl-2 pt-1">
                  {sec.bullet_points.map((bp, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      <span className="text-gray-300">{bp}</span>
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
        <div className="bg-gray-950/70 p-4 rounded-xl border border-gray-800 space-y-2">
          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            🔍 Claim-Level Evidence Provenance ({brief.claim_evidence_map.length} Validated Claims)
          </span>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {brief.claim_evidence_map.map((item, idx) => (
              <div key={idx} className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800 space-y-1 text-xs font-mono">
                <p className="text-gray-200 font-medium">{item.claim}</p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {item.evidence_refs.map((ref, rIdx) => (
                    <span key={rIdx} className="bg-indigo-950 text-indigo-300 text-[9px] px-2 py-0.5 rounded border border-indigo-800">
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
      <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-[11px] text-gray-500 font-mono flex items-center justify-between">
        <span>🛡️ <strong>Executive Disclaimer:</strong> AI-generated explanation based on InsightFlow's deterministic analytical evidence. Verify against underlying evidence before making business decisions.</span>
      </div>
    </div>
  );
};
