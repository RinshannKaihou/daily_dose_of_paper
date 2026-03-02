import { useEffect, useRef, useState } from 'react';
import { usePapers } from '../contexts/PapersContext';
import {
  FileText,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  FileSearch,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { openPdf, openUrl, getProjects, addPaperToProject } from '../utils/api';
import type { Project } from '../types';

interface PaperListProps {
  onPaperSelect: (paperId: string) => void;
}

function PaperList({ onPaperSelect }: PaperListProps) {
  const { dayPapers, selectedDate, loading, analyzePaper, deleteDailyPaper, generateDailyReview, parsePdfs, error, clearError, analyzingPaperId } = usePapers();
  const [generatingReview, setGeneratingReview] = useState(false);
  const [parsingPdfs, setParsingPdfs] = useState(false);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectList = await getProjects();
        setProjects(projectList);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : String(err));
      }
    };

    loadProjects();

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAnalyze = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLocalError(null);
      clearError();
      await analyzePaper(paperId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    }
  };

  const handleGenerateReview = async () => {
    try {
      setGeneratingReview(true);
      setLocalError(null);
      clearError();
      await generateDailyReview();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    } finally {
      setGeneratingReview(false);
    }
  };

  const handleParsePdfs = async () => {
    try {
      setParsingPdfs(true);
      setLocalError(null);
      clearError();
      await parsePdfs();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    } finally {
      setParsingPdfs(false);
    }
  };

  const handleOpenPdf = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedDate) {
      try {
        await openPdf(selectedDate, paperId);
      } catch (err) {
        console.error('Failed to open PDF:', err);
      }
    }
  };

  const handleAddToProject = async (paperId: string, projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const arxivProjectPaperId = `arxiv:${paperId}`;
    try {
      setLocalError(null);
      clearError();
      await addPaperToProject(arxivProjectPaperId, projectId);
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId && !project.paper_ids.includes(arxivProjectPaperId)
            ? { ...project, paper_ids: [...project.paper_ids, arxivProjectPaperId] }
            : project
        )
      );
      setShowProjectMenu(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = confirm(
      'Delete this paper permanently?\n\nThis will remove local metadata, PDF, parsed text, and analysis files.'
    );
    if (!confirmed) return;

    try {
      setDeletingPaperId(paperId);
      setLocalError(null);
      clearError();
      await deleteDailyPaper(paperId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    } finally {
      setDeletingPaperId(null);
    }
  };

  const displayError = localError || error;

  if (!selectedDate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Select a date to view papers</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!dayPapers || dayPapers.papers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 max-w-md">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No papers for this date</p>
          <p className="text-sm mt-2 text-gray-400">
            Click "Fetch Today's Papers" to search for new papers, or select a different date from the sidebar to view previously fetched papers.
          </p>
          <p className="text-xs mt-3 text-gray-400">
            Tip: If no new papers are found, all papers matching your search queries may have already been fetched. Try modifying your search queries in Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Papers for {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            <p className="text-gray-500 mt-1">{dayPapers.papers.length} papers</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleParsePdfs}
              disabled={parsingPdfs}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {parsingPdfs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4" />
              )}
              {parsingPdfs ? 'Parsing...' : 'Parse PDFs'}
            </button>
            <button
              onClick={handleGenerateReview}
              disabled={generatingReview}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {generatingReview ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generatingReview ? 'Generating...' : 'Generate Daily Review'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Operation failed</p>
              <p className="text-red-600 text-sm mt-1">{displayError}</p>
            </div>
            <button
              onClick={() => {
                setLocalError(null);
                clearError();
              }}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Paper List */}
        <div className="space-y-4">
          {dayPapers.papers.map((paper) => {
            const oneLineSummary = paper.one_line_summary?.trim();
            const displaySummary = oneLineSummary
              ? `一句话总结：${oneLineSummary}`
              : paper.summary;

            return (
              <div
                key={paper.id}
                onClick={() => onPaperSelect(paper.id)}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                    {paper.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {paper.authors.slice(0, 3).join(', ')}
                    {paper.authors.length > 3 && ` et al.`}
                  </p>
                  {displaySummary && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {displaySummary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {paper.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => handleOpenPdf(paper.id, e)}
                    className="p-2 hover:bg-gray-100 rounded text-gray-500"
                    title="Open PDF"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (paper.arxiv_url) {
                        openUrl(paper.arxiv_url);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded text-gray-500"
                    title="Open on arXiv"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <div className="relative" ref={showProjectMenu === paper.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProjectMenu(showProjectMenu === paper.id ? null : paper.id);
                      }}
                      className="p-2 hover:bg-gray-100 rounded text-gray-500"
                      title="Add to project"
                    >
                      <FolderPlus className="w-5 h-5" />
                    </button>
                    {showProjectMenu === paper.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                        <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100">
                          Add to project
                        </div>
                        {projects.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">
                            No projects yet
                          </div>
                        ) : (
                          projects.map((project) => (
                            <button
                              key={project.id}
                              onClick={(e) => handleAddToProject(paper.id, project.id, e)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Plus className="w-3 h-3" />
                              {project.name}
                              {(project.paper_ids.includes(`arxiv:${paper.id}`) ||
                                project.paper_ids.includes(paper.id)) && (
                                <span className="text-xs text-green-600 ml-auto">Added</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleAnalyze(paper.id, e)}
                    disabled={analyzingPaperId === paper.id}
                    className={`p-2 hover:bg-primary-50 rounded disabled:opacity-50 ${
                      paper.analysis_path ? 'text-amber-500' : 'text-primary-600'
                    }`}
                    title={paper.analysis_path ? 'Re-analyze with Claude' : 'Analyze with Claude'}
                  >
                    {analyzingPaperId === paper.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles
                        className={`w-5 h-5 ${paper.analysis_path ? '[stroke-width:2.5]' : ''}`}
                      />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleDelete(paper.id, e)}
                    disabled={deletingPaperId === paper.id}
                    className="p-2 hover:bg-red-50 rounded text-red-500 disabled:opacity-50"
                    title="Delete completely"
                  >
                    {deletingPaperId === paper.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PaperList;
