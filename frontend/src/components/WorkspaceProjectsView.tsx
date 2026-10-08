import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Plus, Check, Folder, Database, Calendar, Edit3, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Workspace, Project } from '../types';
import { createProject, updateProject } from '../services/api';

interface WorkspaceProjectsViewProps {
  currentWorkspace: Workspace | null;
  currentProject: Project | null;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onProjectCreated: (project: Project) => void;
  onProjectUpdated: (project: Project) => void;
  onNavigateToDatasets: () => void;
}

export const WorkspaceProjectsView: React.FC<WorkspaceProjectsViewProps> = ({
  currentWorkspace,
  currentProject,
  projects,
  onSelectProject,
  onProjectCreated,
  onProjectUpdated,
  onNavigateToDatasets,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createProject({
        workspace_id: currentWorkspace?.id,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      onProjectCreated(created);
      setNewName('');
      setNewDesc('');
      setIsCreateOpen(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (proj: Project) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditDesc(proj.description || '');
    setUpdateError(null);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const updated = await updateProject(editingProject.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      onProjectUpdated(updated);
      setEditingProject(null);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update project');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (isoString?: string): string => {
    if (!isoString) return 'Unknown';
    try {
      return new Date(isoString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 font-sans">
      {/* 1. WORKSPACE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-premium border border-[rgba(34,211,238,0.15)] shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded bg-accent-cyan/15 border border-accent-cyan/30 text-[11px] font-semibold text-accent-cyan tracking-wider uppercase">
              Phase 1 — Workspace & Projects
            </span>
            <span className="text-xs text-slate-400">
              Workspace: <strong className="text-white">{currentWorkspace?.name || "Nikunj's Workspace"}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Project Command Center
            <span className="text-xs font-medium text-slate-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10">
              {projects.length} Projects
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            SaaS organizational hierarchy scoping analytical pipelines, dataset versions, run histories, insight memories, and decision evidence.
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue hover:opacity-90 text-[#02060D] font-semibold text-xs tracking-normal transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Project
          </button>
        </div>
      </div>

      {/* 2. STATS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-panel-premium border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Active Workspace</div>
            <div className="text-base font-bold text-white mt-1 font-sans truncate max-w-[200px]">
              {currentWorkspace?.name || 'Default Workspace'}
            </div>
            <div className="font-mono text-xs text-slate-500 mt-0.5">
              ID: {currentWorkspace?.id.slice(0, 12)}...
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-accent-cyan">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel-premium border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Current Project</div>
            <div className="text-base font-bold text-accent-cyan mt-1 font-sans truncate max-w-[200px]">
              {currentProject?.name || 'None Selected'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {currentProject?.dataset_count || 0} Registered Datasets
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent-electricBlue/10 border border-accent-electricBlue/20 flex items-center justify-center text-accent-electricBlue">
            <Folder className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel-premium border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Total Datasets Across Projects</div>
            <div className="text-2xl font-bold text-white mt-1">
              {projects.reduce((acc, p) => acc + (p.dataset_count || 0), 0)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-accent-success/10 border border-accent-success/20 flex items-center justify-center text-accent-success">
            <Database className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. PROJECT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((proj) => {
          const isSelected = currentProject?.id === proj.id;

          return (
            <motion.div
              key={proj.id}
              whileHover={{ y: -2 }}
              className={`p-6 rounded-2xl glass-panel-premium border transition-all flex flex-col justify-between relative overflow-hidden group ${
                isSelected
                  ? 'border-accent-cyan/40 bg-accent-cyan/[0.03] shadow-[0_0_25px_rgba(34,211,238,0.12)]'
                  : 'border-white/5 hover:border-white/15'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 shadow-[0_0_8px_#22D3EE]'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </div>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded bg-accent-cyan/20 border border-accent-cyan/30 text-xs font-semibold text-accent-cyan tracking-wide flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartEdit(proj)}
                    className="p-1 text-slate-500 hover:text-white transition-colors"
                    title="Edit project details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-white font-sans tracking-tight mb-1.5 group-hover:text-accent-cyan transition-colors">
                  {proj.name}
                </h3>

                <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-4 min-h-[36px]">
                  {proj.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-white font-bold">{proj.dataset_count || 0}</span>
                    <span>datasets</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDate(proj.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-5 pt-3 border-t border-white/5">
                {!isSelected ? (
                  <button
                    onClick={() => onSelectProject(proj)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-accent-cyan/15 hover:text-accent-cyan hover:border-accent-cyan/30 border border-white/10 font-semibold text-xs transition-all text-slate-200 flex items-center justify-center gap-1.5"
                  >
                    Select Project
                  </button>
                ) : (
                  <button
                    onClick={onNavigateToDatasets}
                    className="flex-1 py-2.5 rounded-xl bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 font-semibold text-xs text-accent-cyan transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Open Dataset Registry
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 4. CREATE PROJECT MODAL */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isCreateOpen && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsCreateOpen(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 12 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-md p-6 rounded-2xl bg-[#040C18] border border-[rgba(34,211,238,0.3)] shadow-[0_24px_70px_rgba(0,0,0,0.9)] font-sans relative my-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan">
                        <Plus className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-white">Create New Project</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {createError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 font-mono flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Project Name <span className="text-accent-cyan">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Supply Chain Analytics"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Description <span className="text-slate-500 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Project domain, analytical objectives, and data scope..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 font-sans resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreating || !newName.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue text-[#02060D] font-semibold text-xs tracking-normal transition-all disabled:opacity-50"
                      >
                        {isCreating ? 'Creating...' : 'Create Project'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* 5. EDIT PROJECT MODAL */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {editingProject && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setEditingProject(null);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 12 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-md p-6 rounded-2xl bg-[#040C18] border border-[rgba(34,211,238,0.3)] shadow-[0_24px_70px_rgba(0,0,0,0.9)] font-sans relative my-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan">
                        <Edit3 className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-white">Edit Project</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {updateError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 font-mono flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{updateError}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdateSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Project Name <span className="text-accent-cyan">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Description <span className="text-slate-500 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan/50 font-sans resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingProject(null)}
                        className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdating || !editName.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue text-[#02060D] font-semibold text-xs tracking-normal transition-all disabled:opacity-50"
                      >
                        {isUpdating ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
