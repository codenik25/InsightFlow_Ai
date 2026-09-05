import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, Play, RefreshCw, ArrowRight } from 'lucide-react';
import {
  DecisionRecommendation,
  RecommendationResponse,
} from '../types';
import {
  generateRecommendations,
  fetchRecommendations,
} from '../services/api';

interface RecommendationsDashboardProps {
  datasetId: string;
  onNavigate?: (tab: string) => void;
}

export const RecommendationsDashboard: React.FC<RecommendationsDashboardProps> = ({ datasetId, onNavigate }) => {
  const [recommendations, setRecommendations] = useState<DecisionRecommendation[]>([]);
  const [recResponse, setRecResponse] = useState<RecommendationResponse | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState<boolean>(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, [datasetId]);

  const loadData = async () => {
    setLoading(true);
    setRecError(null);
    try {
      const storedRecs = await fetchRecommendations(datasetId);
      setRecommendations(storedRecs);
    } catch (err: any) {
      setRecError('Unable to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    setGeneratingRecs(true);
    setRecError(null);
    try {
      const res = await generateRecommendations(datasetId, undefined, 3);
      setRecResponse(res);
      setRecommendations(res.recommendations);
    } catch (err: any) {
      setRecError(err.message || 'Failed to generate executive recommendations');
    } finally {
      setGeneratingRecs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
        <p className="text-sm font-medium text-slate-300 tracking-widest uppercase">Loading Decision Recommendations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* 01 - RECOMMENDATIONS HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight uppercase flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-400" />
            Decision Recommendations
          </h1>
          <p className="text-sm text-slate-400 font-medium">AI-generated actions based on analysis, predictions, and available decision intelligence.</p>
        </div>
        
        <button
          onClick={handleGenerateRecommendations}
          disabled={generatingRecs}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600/90 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all shrink-0"
        >
          {generatingRecs ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> GENERATING...</>
          ) : (
            <><Play className="w-4 h-4 fill-current" /> GENERATE RECOMMENDATIONS</>
          )}
        </button>
      </div>

      {recError && (
        <div className="bg-rose-950/40 border border-rose-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{recError}</span>
          </div>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors uppercase"
          >
            Retry
          </button>
        </div>
      )}

      {recResponse && recResponse.warning && (
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 text-amber-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>{recResponse.warning}</span>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="text-center py-16 glass-panel-premium border-dashed">
          <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-base text-white font-bold mb-2">Recommendations are not available yet.</p>
          <p className="text-sm text-slate-500 mb-6">Run the recommendation engine to generate evidence-backed actions.</p>
          <button
            onClick={handleGenerateRecommendations}
            disabled={generatingRecs}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-all"
          >
            {generatingRecs ? 'GENERATING...' : 'GENERATE RECOMMENDATIONS'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Recommendation List</h3>
          {recommendations.map((rec) => {
            const isPositive = rec.absolute_delta >= 0;
            const confColor =
              rec.confidence === 'EXPLORATORY'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : rec.confidence === 'MODERATE'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

            return (
              <div
                key={rec.id}
                className="glass-panel-premium hover:border-purple-500/40 p-6 transition-all shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Priority #{rec.priority}
                    </span>
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {rec.recommendation_type}
                    </span>
                    <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border uppercase tracking-widest ${confColor}`}>
                      {rec.confidence} Confidence
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Target Metric: <strong className="text-slate-300">{rec.target_metric}</strong>
                  </span>
                </div>

                <h4 className="text-xl font-bold text-white mb-3">{rec.title}</h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">{rec.rationale}</p>

                {/* Outcomes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/80 rounded-xl p-5 border border-slate-800 text-center mb-6 font-mono">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Baseline</span>
                    <span className="text-lg font-bold text-slate-300">{rec.baseline_value.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Projected</span>
                    <span className="text-lg font-bold text-white">{rec.projected_value.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Delta Impact</span>
                    <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{rec.absolute_delta.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Percentage</span>
                    <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rec.percentage_delta > 0 ? '+' : ''}{rec.percentage_delta}%
                    </span>
                  </div>
                </div>

                {/* Operational Trade-offs & Evidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="glass-panel-premium p-4">
                    <span className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      <span>⚖️</span> Trade-offs & Constraints
                    </span>
                    <p className="text-slate-300 leading-relaxed text-xs">{rec.tradeoffs}</p>
                  </div>

                  <div className="glass-panel-premium p-4">
                    <span className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      <span>🔍</span> Evidence Provenance
                    </span>
                    <div className="space-y-1.5 font-mono text-[10px] text-slate-500">
                      <div className="flex justify-between items-center"><span className="uppercase">Dataset:</span> <span className="text-slate-300">{rec.evidence.dataset_id.slice(0, 8)}...</span></div>
                      {rec.evidence.ml_analysis_id && <div className="flex justify-between items-center"><span className="uppercase">ML Analysis:</span> <span className="text-slate-300">{rec.evidence.ml_analysis_id.slice(0, 8)}...</span></div>}
                      {rec.evidence.optimization_id && <div className="flex justify-between items-center"><span className="uppercase">Optimization:</span> <span className="text-slate-300">{rec.evidence.optimization_id.slice(0, 8)}...</span></div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 07 - NEXT ACTION */}
      {onNavigate && (
        <div className="flex justify-end pt-8 pb-12 border-t border-slate-800/50 mt-10">
          <button
            onClick={() => onNavigate('optimization')}
            className="group relative flex items-center gap-3 px-8 py-4 primary-glow-button rounded-full overflow-hidden shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-white"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <span className="font-sans font-extrabold text-sm tracking-widest uppercase relative z-10 flex items-center gap-2">
              CONTINUE TO OPTIMIZATION <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default RecommendationsDashboard;
