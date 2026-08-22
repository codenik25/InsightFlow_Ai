import React from 'react';
import { Tag, Hash, Calendar, Key, FileText, CheckSquare, Layers } from 'lucide-react';
import { ColumnRoleInfo } from '../types';

interface ColumnRoleBadgeTableProps {
  roles: ColumnRoleInfo[];
}

export const ColumnRoleBadgeTable: React.FC<ColumnRoleBadgeTableProps> = ({ roles }) => {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'measure':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <Hash className="w-3.5 h-3.5" />
            <span>Numeric Measure</span>
          </span>
        );
      case 'categorical_dimension':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 w-fit">
            <Tag className="w-3.5 h-3.5" />
            <span>Categorical Dimension</span>
          </span>
        );
      case 'datetime_dimension':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5 w-fit">
            <Calendar className="w-3.5 h-3.5" />
            <span>Datetime Dimension</span>
          </span>
        );
      case 'identifier':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-fit">
            <Key className="w-3.5 h-3.5" />
            <span>Identifier Candidate</span>
          </span>
        );
      case 'boolean':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1.5 w-fit">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Boolean Flag</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 w-fit">
            <FileText className="w-3.5 h-3.5" />
            <span>Text</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span>Automatic Column Role Discovery & Deterministic Taxonomy ({roles.length})</span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3 font-medium">Column Name</th>
              <th className="py-2.5 px-3 font-medium">Discovered Role</th>
              <th className="py-2.5 px-3 font-medium">Inferred Data Type</th>
              <th className="py-2.5 px-3 font-medium">Deterministic Discovery Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {roles.map((r) => (
              <tr key={r.column} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-3 font-bold text-white">{r.column}</td>
                <td className="py-3 px-3">{getRoleBadge(r.role)}</td>
                <td className="py-3 px-3 text-slate-400 capitalize">{r.inferred_type}</td>
                <td className="py-3 px-3 text-slate-300 font-sans">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
