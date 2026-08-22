import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Database, CheckCircle2 } from 'lucide-react';
import { EDAResponse } from '../types';
import { fetchEDA, generateEDA } from '../services/api';
import { ColumnRoleBadgeTable } from './ColumnRoleBadgeTable';
import { KpiCardsGrid } from './KpiCardsGrid';
import { CategoryAnalysisView } from './CategoryAnalysisView';
import { TimeSeriesTrendView } from './TimeSeriesTrendView';
import { CorrelationMatrixView } from './CorrelationMatrixView';

interface AnalyticsDashboardProps {
  datasetId: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ datasetId }) => {
  const [edaData, setEdaData] = useState<EDAResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadEDA = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEDA(datasetId);
      setEdaData(data);
    } catch (err: any) {
      console.warn('Failed to load EDA analysis, attempting generation:', err);
      try {
        const genData = await generateEDA(datasetId);
        setEdaData(genData);
      } catch (genErr: any) {
        setErrorMsg(genErr.message || 'Unable to generate automated EDA analysis.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    loadEDA();
  }, [loadEDA]);

  const handleRecalculate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const genData = await generateEDA(datasetId);
      setEdaData(genData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Recalculation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 space-y-3 flex flex-col items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="font-semibold text-slate-200 text-sm">Analyzing Processed Dataset & Running Automated EDA...</span>
        <p className="text-slate-500 max-w-md">Discovering column roles, calculating metrics on cleaned data, and evaluating time series trends.</p>
      </div>
    );
  }

  if (errorMsg || !edaData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-6">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit mx-auto text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Cleaning & Processing Required</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {errorMsg || 'Automated EDA requires a processed dataset. Please apply a cleaning plan to generate a cleaned dataset version first.'}
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
        >
          Try Reloading Analysis
        </button>
      </div>
    );
  }

  const { overview_kpis, column_roles, discovered_kpis, category_breakdowns, trends, relationships, distributions } = edaData;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Dashboard Top Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Automated Exploratory Data Analysis & KPI Engine</h3>
            <p className="text-xs text-slate-400">Deterministic, domain-agnostic metric discovery (Version {edaData.id.slice(0, 8)})</p>
          </div>
        </div>

        <button
          onClick={handleRecalculate}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Recalculate EDA</span>
        </button>
      </div>

      {/* Visible Dataset Metadata Banner (Requirement 8) */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 bg-emerald-500/5 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2.5 py-1 text-xs font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Status: Processed</span>
          </span>
          <span className="text-slate-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            Analyzing Dataset ID: <strong className="text-white font-bold">{edaData.dataset_id}</strong>
          </span>
        </div>

        <div className="flex items-center gap-5 text-slate-300">
          <div>Rows: <strong className="text-white font-bold">{overview_kpis.total_rows}</strong></div>
          <div>Missing Cells: <strong className="text-emerald-400 font-bold">{overview_kpis.total_missing_cells}</strong></div>
          <div>Duplicates: <strong className="text-emerald-400 font-bold">{overview_kpis.duplicate_rows}</strong></div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Total Rows</div>
          <div className="text-lg font-bold font-mono text-white">{overview_kpis.total_rows.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Total Columns</div>
          <div className="text-lg font-bold font-mono text-white">{overview_kpis.total_columns}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Measures</div>
          <div className="text-lg font-bold font-mono text-emerald-400">{overview_kpis.measure_count}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Dimensions</div>
          <div className="text-lg font-bold font-mono text-indigo-400">{overview_kpis.dimension_count}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Date Fields</div>
          <div className="text-lg font-bold font-mono text-purple-400">{overview_kpis.datetime_count}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Missing Cells</div>
          <div className="text-lg font-bold font-mono text-emerald-400">{overview_kpis.total_missing_cells}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[11px] font-medium text-slate-400">Duplicates</div>
          <div className="text-lg font-bold font-mono text-emerald-400">{overview_kpis.duplicate_rows}</div>
        </div>
      </div>

      {/* 1. DISCOVERED KPIS */}
      <KpiCardsGrid kpis={discovered_kpis} />

      {/* 2. CATEGORY BREAKDOWNS */}
      <CategoryAnalysisView breakdowns={category_breakdowns} />

      {/* 3. TIME-SERIES TRENDS */}
      {trends.length > 0 && <TimeSeriesTrendView trends={trends} />}

      {/* 4. RELATIONSHIPS & DISTRIBUTIONS */}
      <CorrelationMatrixView relationships={relationships} distributions={distributions} />

      {/* 5. DISCOVERED COLUMN ROLES */}
      <ColumnRoleBadgeTable roles={column_roles} />
    </div>
  );
};
