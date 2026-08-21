import React from 'react';
import { History, CheckCircle2 } from 'lucide-react';
import { TransformationLogItem } from '../types';

interface TransformationHistoryProps {
  logs: TransformationLogItem[];
}

export const TransformationHistory: React.FC<TransformationHistoryProps> = ({ logs }) => {
  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          <span>Transformation Audit Log History ({logs.length} entries)</span>
        </h3>
      </div>

      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold text-white font-mono capitalize">
                  {log.operation_type.replace(/_/g, ' ')}
                  {log.column_name && <span className="text-slate-300"> on '{log.column_name}'</span>}
                </div>
                {log.strategy && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Strategy: <strong className="text-emerald-400 capitalize">{log.strategy}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-right font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                Affected rows: {log.affected_rows}
              </span>
              <span className="text-slate-500">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
