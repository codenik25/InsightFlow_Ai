import React, { useState, useMemo } from 'react';
import { Tag, Hash, Calendar, Key, FileText, CheckSquare } from 'lucide-react';
import { ColumnRoleInfo } from '../types';

interface ColumnRoleBadgeTableProps {
  roles: ColumnRoleInfo[];
}

type RoleFilter = 'ALL' | 'DIMENSIONS' | 'MEASURES' | 'DATETIME' | 'TEXT';

export const ColumnRoleBadgeTable: React.FC<ColumnRoleBadgeTableProps> = ({ roles }) => {
  const [activeFilter, setActiveFilter] = useState<RoleFilter>('ALL');

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'measure':
        return (
          <span className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <Hash className="w-3.5 h-3.5" />
            <span>Numeric Measure</span>
          </span>
        );
      case 'categorical_dimension':
        return (
          <span className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 w-fit">
            <Tag className="w-3.5 h-3.5" />
            <span>Categorical Dimension</span>
          </span>
        );
      case 'datetime_dimension':
        return (
          <span className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5 w-fit">
            <Calendar className="w-3.5 h-3.5" />
            <span>Datetime Dimension</span>
          </span>
        );
      case 'identifier':
        return (
          <span className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-fit">
            <Key className="w-3.5 h-3.5" />
            <span>Identifier Candidate</span>
          </span>
        );
      case 'boolean':
        return (
          <span className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1.5 w-fit">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Boolean Flag</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 w-fit">
            <FileText className="w-3.5 h-3.5" />
            <span>Text</span>
          </span>
        );
    }
  };

  const filteredRoles = useMemo(() => {
    if (activeFilter === 'ALL') return roles;
    return roles.filter(r => {
      if (activeFilter === 'DIMENSIONS') return r.role.includes('dimension') || r.role === 'boolean';
      if (activeFilter === 'MEASURES') return r.role === 'measure';
      if (activeFilter === 'DATETIME') return r.role === 'datetime_dimension';
      if (activeFilter === 'TEXT') return r.role === 'text' || r.role === 'identifier';
      return true;
    });
  }, [roles, activeFilter]);

  const FILTERS: RoleFilter[] = ['ALL', 'DIMENSIONS', 'MEASURES', 'DATETIME', 'TEXT'];

  return (
    <div className="bg-transparent border-t border-slate-800/80 pt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-2">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Automatic Column Role Discovery <span className="mx-2 text-slate-700">|</span> <span className="text-accent-cyan">{roles.length} columns</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors ${
                activeFilter === f 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500 font-mono border-b border-slate-800/50 uppercase tracking-widest text-[10px]">
            <tr>
              <th className="py-2 px-2 font-bold">COLUMN</th>
              <th className="py-2 px-2 font-bold">ROLE</th>
              <th className="py-2 px-2 font-bold">TYPE</th>
              <th className="py-2 px-2 font-bold">DISCOVERY REASON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {filteredRoles.map((r) => (
              <tr key={r.column} className="hover:bg-slate-800/10 transition-colors group">
                <td className="py-2.5 px-2 font-mono font-bold text-white tracking-tight group-hover:text-accent-cyan transition-colors">{r.column}</td>
                <td className="py-2.5 px-2">{getRoleBadge(r.role)}</td>
                <td className="py-2.5 px-2 font-mono text-slate-400 capitalize">{r.inferred_type}</td>
                <td className="py-2.5 px-2 text-slate-500 leading-relaxed max-w-md">{r.reason}</td>
              </tr>
            ))}
            {filteredRoles.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500 font-mono text-[10px] uppercase tracking-widest">
                  No columns match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
