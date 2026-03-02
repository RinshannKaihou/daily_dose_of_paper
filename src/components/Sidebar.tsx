import { useState, useEffect } from 'react';
import {
  Calendar,
  BookOpen,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FolderOpen,
  Layers,
  FileText,
  Trash2,
  Edit2,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { usePapers } from '../contexts/PapersContext';
import { getProjects, createProject, deleteProject, renameProject } from '../utils/api';
import type { Project } from '../types';

type SidebarViewType = 'papers' | 'review' | 'settings' | 'all-papers' | 'project';

interface SidebarProps {
  currentView: SidebarViewType | 'import-detail';
  onViewChange: (view: SidebarViewType) => void;
  onPaperSelect: (paperId: string | null) => void;
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
}

function Sidebar({ currentView, onViewChange, onPaperSelect, selectedProjectId, onSelectProject }: SidebarProps) {
  const { dates, selectedDate, setSelectedDate, fetchPapers, dayPapers, analyzePaper, refresh, analyzing, batchProgress, setBatchProgress } = usePapers();
  const [collapsed, setCollapsed] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const projectList = await getProjects();
      setProjects(projectList);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      setError(null);
      await createProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project? Papers will not be deleted.')) return;

    try {
      await deleteProject(projectId);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRenameProject = async (projectId: string) => {
    if (!editingProjectName.trim()) return;

    try {
      await renameProject(projectId, editingProjectName.trim());
      setEditingProjectId(null);
      setEditingProjectName('');
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startEditing = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleFetchPapers = async () => {
    try {
      setError(null);
      setInfo(null);
      setFetching(true);
      const today = getLocalDateString(new Date());
      const result = await fetchPapers(today);

      // Check if no new papers were found
      if (result && result.includes('Fetched 0 new papers')) {
        setInfo('No new papers found. All matching papers have already been fetched.');
      }
    } catch (err) {
      console.error('Failed to fetch papers:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!dayPapers || !selectedDate) return;

    const unreviewedPapers = dayPapers.papers.filter(p => !p.analysis_path);
    if (unreviewedPapers.length === 0) return;

    try {
      setError(null);
      setAnalyzingAll(true);
      setBatchProgress({ current: 0, total: unreviewedPapers.length });

      for (let i = 0; i < unreviewedPapers.length; i++) {
        const paper = unreviewedPapers[i];
        setBatchProgress({ current: i + 1, total: unreviewedPapers.length });
        await analyzePaper(paper.id);
      }

      await refresh();
    } catch (err) {
      console.error('Failed to analyze papers:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzingAll(false);
      setBatchProgress(null);
    }
  };

  const unreviewedCount = dayPapers?.papers.filter(p => !p.analysis_path).length ?? 0;

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    onPaperSelect(null);
    onViewChange('papers');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00'); // Parse as local date to avoid timezone shifts
    const todayStr = getLocalDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === yesterdayStr) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-600" />
              Daily Dose
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Sync Button */}
      {!collapsed && (
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={handleFetchPapers}
            disabled={fetching}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fetching ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {fetching ? 'Fetching...' : 'Fetch Today\'s Papers'}
          </button>

          {/* Analyze All Unreviewed Button */}
          <button
            onClick={handleAnalyzeAll}
            disabled={analyzingAll || analyzing || unreviewedCount === 0 || !selectedDate}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {analyzingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {analyzingAll && batchProgress
              ? `Analyzing ${batchProgress.current}/${batchProgress.total}...`
              : `Analyze All (${unreviewedCount})`
            }
          </button>

          {error && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 text-xs rounded-lg">
              Error: {error}
            </div>
          )}

          {info && (
            <div className="mt-2 p-2 bg-blue-100 text-blue-700 text-xs rounded-lg">
              {info}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {!collapsed && (
          <>
            {/* Projects Section */}
            <div className="p-3 border-b border-gray-200">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer"
                onClick={() => setProjectsCollapsed(!projectsCollapsed)}
              >
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Projects
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNewProject(true);
                    }}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500"
                    title="New Project"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <ChevronRight
                    className={`w-3 h-3 text-gray-400 transition-transform ${
                      projectsCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </div>
              </div>

              {/* New Project Input */}
              {showNewProject && (
                <div className="mb-2 flex gap-1">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProject();
                      if (e.key === 'Escape') {
                        setShowNewProject(false);
                        setNewProjectName('');
                      }
                    }}
                    placeholder="Project name..."
                    className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateProject}
                    className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Projects List */}
              {!projectsCollapsed && (
                <div className="space-y-1">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => {
                        if (onSelectProject) {
                          onSelectProject(project.id);
                          onViewChange('project');
                        }
                      }}
                      className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        selectedProjectId === project.id
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FolderOpen className="w-4 h-4 flex-shrink-0" />
                      {editingProjectId === project.id ? (
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleRenameProject(project.id);
                            if (e.key === 'Escape') {
                              setEditingProjectId(null);
                            }
                          }}
                          onBlur={() => handleRenameProject(project.id)}
                          className="flex-1 text-sm bg-transparent border-b border-primary-500 focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="flex-1 text-sm truncate">{project.name}</span>
                          <span className="text-xs text-gray-400 mr-1">
                            {project.paper_ids.length}
                          </span>
                        </>
                      )}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={(e) => startEditing(e, project)}
                          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(e, project.id)}
                          className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && !showNewProject && (
                    <p className="text-xs text-gray-400 px-2 py-1">
                      No projects yet. Click + to create one.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* All Papers Entry */}
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={() => onViewChange('all-papers')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                  currentView === 'all-papers'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">All Papers</span>
              </button>
            </div>

            {/* Dates */}
            <div className="p-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Dates
              </h2>
              <div className="space-y-1">
                {dates.map((date) => (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedDate === date
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">{formatDate(date)}</span>
                  </button>
                ))}
                {dates.length === 0 && (
                  <p className="text-sm text-gray-400 px-3 py-2">
                    No papers yet. Click "Fetch Today's Papers" to start.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Bottom Menu - Always visible */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        <div className="p-3 space-y-1">
          <button
            onClick={() => onViewChange('review')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
              currentView === 'review'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {!collapsed && <span className="text-sm">Daily Review</span>}
          </button>
          <button
            onClick={() => onViewChange('settings')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
              currentView === 'settings'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            {!collapsed && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
