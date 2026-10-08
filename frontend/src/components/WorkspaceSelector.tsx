import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FolderPlus, Settings2, Check, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Workspace, Project } from '../types';
import { createProject, updateProject } from '../services/api';

interface WorkspaceSelectorProps {
  currentWorkspace: Workspace | null;
  currentProject: Project | null;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onProjectCreated: (project: Project) => void;
  onProjectUpdated: (project: Project) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  currentWorkspace,
  currentProject,
  projects,
  onSelectProject,
  onProjectCreated,
  onProjectUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenSettings = () => {
    if (currentProject) {
      setEditProjectName(currentProject.name);
      setEditProjectDesc(currentProject.description || '');
      setUpdateError(null);
      setIsSettingsModalOpen(true);
      setIsOpen(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createProject({
        workspace_id: currentWorkspace?.id,
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });
      onProjectCreated(created);
      setNewProjectName('');
      setNewProjectDesc('');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !editProjectName.trim()) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const updated = await updateProject(currentProject.id, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim() || undefined,
      });
      onProjectUpdated(updated);
      setIsSettingsModalOpen(false);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update project');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col items-start justify-center px-4 py-2 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.4)] hover:bg-[rgba(15,23,42,0.7)] hover:border-cyan-500/40 transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(34,211,238,0.1)] text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50 min-w-[200px]"
      >
        <div className="flex items-center gap-1.5 w-full">
          <span className="font-sans text-[11px] text-slate-500 font-medium">
            workspace:
          </span>
          <span className="font-sans text-[12px] font-semibold text-slate-300 truncate">
            {currentWorkspace?.name || "Nikunj's Workspace"}
          </span>
        </div>

        <div className="flex items-center justify-between w-full mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[11px] text-slate-500 font-medium">
              project:
            </span>
            <span className="font-sans text-[13px] font-bold text-white tracking-wide truncate group-hover:text-accent-cyan transition-colors duration-150">
              {currentProject?.name || "Hospital Operations"}
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 group-hover:text-accent-cyan transition-transform duration-200 ml-2 ${
              isOpen ? 'rotate-180 text-accent-cyan' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 mt-2 w-72 origin-top-left rounded-xl border border-[rgba(34,211,238,0.25)] bg-[#030914]/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden font-sans"
          >
            {/* Header info */}
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <span className="text-[11px] font-semibold text-accent-cyan tracking-wider uppercase block">
                Active Workspace
              </span>
              <p className="text-[13px] font-bold text-white mt-0.5 truncate">
                {currentWorkspace?.name || "Nikunj's Workspace"}
              </p>
            </div>

            {/* Projects List */}
            <div className="p-2">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                Projects ({projects.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                {projects.map((proj) => {
                  const isSelected = currentProject?.id === proj.id;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-all ${
                        isSelected
                          ? 'bg-accent-cyan/15 text-white font-semibold border border-accent-cyan/30 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]'
                          : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Layers className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-accent-cyan' : 'text-slate-500'}`} />
                        <span className="truncate">{proj.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-slate-400 px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
                          {proj.dataset_count} ds
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-cyan" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-2 border-t border-white/10 bg-white/[0.01] flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setIsOpen(false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-accent-cyan/30 hover:border-accent-cyan/70 hover:bg-accent-cyan/10 text-accent-cyan text-xs font-semibold tracking-wide transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Create Project
              </button>

              {currentProject && (
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  title="Project Settings"
                  className="px-2.5 py-2 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/[0.05] text-slate-300 hover:text-white text-xs transition-all flex items-center justify-center"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE PROJECT MODAL (Rendered into document.body to prevent clipping by header backdrop-blur) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isCreateModalOpen && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsCreateModalOpen(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 12 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-md rounded-2xl border border-[rgba(34,211,238,0.3)] bg-[#040C18] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9)] font-sans relative my-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan">
                        <FolderPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Create New Project</h3>
                        <span className="text-xs text-slate-400">
                          in {currentWorkspace?.name || "Nikunj's Workspace"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {createError && (
                    <div className="mt-4 p-2.5 rounded-lg bg-accent-error/15 border border-accent-error/30 text-accent-error text-xs">
                      {createError}
                    </div>
                  )}

                  <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Project Name <span className="text-accent-cyan">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g., E-commerce Intelligence"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#02060D] border border-white/10 focus:border-accent-cyan/60 focus:outline-none text-sm text-white placeholder-slate-600 font-sans transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Description <span className="text-slate-500 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        placeholder="Objectives, target metrics, or operational scope..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#02060D] border border-white/10 focus:border-accent-cyan/60 focus:outline-none text-sm text-white placeholder-slate-600 font-sans transition-colors resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(false)}
                        className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreating || !newProjectName.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue hover:opacity-90 disabled:opacity-50 text-[#02060D] font-semibold text-xs tracking-normal transition-all shadow-[0_0_12px_rgba(34,211,238,0.3)]"
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

      {/* PROJECT SETTINGS MODAL (Rendered into document.body to prevent clipping by header backdrop-blur) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isSettingsModalOpen && currentProject && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsSettingsModalOpen(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 12 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-md rounded-2xl border border-[rgba(34,211,238,0.3)] bg-[#040C18] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9)] font-sans relative my-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent-cyan/15 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan">
                        <Settings2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Project Settings</h3>
                        <span className="font-mono text-xs text-slate-400">
                          ID: {currentProject.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSettingsModalOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {updateError && (
                    <div className="mt-4 p-2.5 rounded-lg bg-accent-error/15 border border-accent-error/30 text-accent-error text-xs">
                      {updateError}
                    </div>
                  )}

                  <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Project Name <span className="text-accent-cyan">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editProjectName}
                        onChange={(e) => setEditProjectName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#02060D] border border-white/10 focus:border-accent-cyan/60 focus:outline-none text-sm text-white placeholder-slate-600 font-sans transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Description <span className="text-slate-500 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={3}
                        value={editProjectDesc}
                        onChange={(e) => setEditProjectDesc(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#02060D] border border-white/10 focus:border-accent-cyan/60 focus:outline-none text-sm text-white placeholder-slate-600 font-sans transition-colors resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsSettingsModalOpen(false)}
                        className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdating || !editProjectName.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-electricBlue hover:opacity-90 disabled:opacity-50 text-[#02060D] font-semibold text-xs tracking-normal transition-all shadow-[0_0_12px_rgba(34,211,238,0.3)]"
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
