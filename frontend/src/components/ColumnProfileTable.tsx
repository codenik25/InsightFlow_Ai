import React from 'react';
import { ColumnProfile } from '../types';
import { Hash, Calendar, ToggleLeft, Tag, FileText, Fingerprint } from 'lucide-react';

interface ColumnProfileTableProps {
  columns: ColumnProfile[];
}

export const ColumnProfileTable: React.FC<ColumnProfileTableProps> = ({ columns }) => {
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'numeric':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Hash className="w-3 h-3" /> numeric
          </span>
        );
      case 'datetime':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Calendar className="w-3 h-3" /> datetime
          </span>
        );
      case 'boolean':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ToggleLeft className="w-3 h-3" /> boolean
          </span>
        );
      case 'identifier':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Fingerprint className="w-3 h-3" /> identifier
          </span>
        );
      case 'categorical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Tag className="w-3 h-3" /> categorical
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <FileText className="w-3 h-3" /> text
          </span>
        );
    }
  };

  return (
    <div className="overflow-x-auto border border-slate-800 rounded-lg">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
          <tr>
            <th className="px-4 py-3 font-semibold">Column Name</th>
            <th className="px-4 py-3 font-semibold">Inferred Type</th>
            <th className="px-4 py-3 font-semibold">Missing (Nulls)</th>
            <th className="px-4 py-3 font-semibold">Unique Values</th>
            <th className="px-4 py-3 font-semibold">Sample Values Preview</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
          {columns.map((col) => (
            <tr key={col.name} className="hover:bg-slate-800/40 transition-colors">
              <td className="px-4 py-3 font-mono font-semibold text-white">
                {col.name}
              </td>
              <td className="px-4 py-3">
                {getTypeBadge(col.inferred_type)}
              </td>
              <td className="px-4 py-3 font-mono">
                <span className={col.null_count > 0 ? "text-amber-400" : "text-slate-400"}>
                  {col.null_count} ({col.null_percentage}%)
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-slate-300">
                {col.unique_count} ({col.unique_percentage}%)
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-xs truncate">
                {col.sample_values && col.sample_values.length > 0
                  ? col.sample_values.slice(0, 3).join(', ')
                  : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
