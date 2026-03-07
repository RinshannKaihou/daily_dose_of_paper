import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  ExternalLink,
  Trash2,
  FileText,
  Calendar,
} from 'lucide-react';
import {
  getProjectPapers,
  getProjectAnalysis,
  analyzeProject,
  removePaperFromProject,
  getProjects,
} from '../utils/api';
import type { UnifiedPaper, Project } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { open } from '@tauri-apps/plugin-shell';
import StatsCard from './StatsCard';
import CategoryBadge from './CategoryBadge';
import AnalysisStatusBadge from './AnalysisStatusBadge';
import ProgressBar from './ProgressBar';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onPaperSelect?: (paperId: string, date?: string) => void;
  onImportedPaperSelect?: (paperId: string) => void;
}

function ProjectDetail({ projectId, onBack, onPaperSelect, onImportedPaperSelect }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [papers, setPapers] = useState<UnifiedPaper[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load project info
      const projects = await getProjects();
      const proj = projects.find((p) => p.id === projectId);
      if (!proj) {
        setError('Project not found');
        return;
      }
      setProject(proj);

      // Load papers
      const projectPapers = await getProjectPapers(projectId);
      setPapers(projectPapers);

      // Load analysis if exists
      const projectAnalysis = await getProjectAnalysis(projectId);
      setAnalysis(projectAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeProject = async () => {
    if (!project || papers.length === 0) return;

    try {
      setAnalyzing(true);
      setError(null);
      const result = await analyzeProject(projectId);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemovePaper = async (paperId: string) => {
    try {
      await removePaperFromProject(paperId, projectId);
      setPapers(papers.filter((p) => p.id !== paperId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePaperClick = (paper: UnifiedPaper) => {
    if (paper.source === 'arxiv' && onPaperSelect) {
      const rawId = paper.id.replace(/^arxiv:/, '');
      if (paper.date_folder) {
        onPaperSelect(rawId, paper.date_folder);
      } else {
        onPaperSelect(rawId);
      }
    } else if (paper.source === 'imported' && onImportedPaperSelect) {
      onImportedPaperSelect(paper.id);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p>Project not found</p>
          <button
            onClick={onBack}
            className="mt-2 text-primary-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const analyzedCount = papers.filter((p) => p.analysis_path).length;
  const analysisProgress = papers.length > 0 ? (analyzedCount / papers.length) * 100 : 0;

  // Calculate category distribution
  const categoryCount: Record<string, number> = {};
  papers.forEach(paper => {
    paper.categories.forEach(cat => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
  });
  
  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
            <p className="text-sm text-gray-500">
              {papers.length} paper{papers.length !== 1 ? 's' : ''}
              {analyzedCount > 0 && ` · ${analyzedCount} analyzed`}
            </p>
          </div>
          {papers.length > 0 && (
            <button
              onClick={handleAnalyzeProject}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {analyzing ? 'Analyzing...' : 'Analyze Project'}
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      {papers.length > 0 && (
        <div className="mx-4 mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatsCard
                icon={FileText}
                label="Total Papers"
                value={papers.length}
                color="blue"
              />
              <StatsCard
                icon={Sparkles}
                label="Analyzed"
                value={analyzedCount}
                subtext={`${analyzedCount} of ${papers.length} analyzed`}
                color="amber"
              />
              <StatsCard
                icon={FileText}
                label="Pending"
                value={papers.length - analyzedCount}
                color={analysisProgress < 100 ? 'purple' : 'green'}
              />
              <StatsCard
                icon={Sparkles}
                label="Top Category"
                value={topCategories[0]?.[0].split('.')[1] || 'N/A'}
                subtext={topCategories[0] ? `${topCategories[0][1]} papers` : 'No data'}
                color="green"
              />
            </div>
            
            {/* Analysis Progress */}
            <ProgressBar
              progress={analysisProgress}
              current={analyzedCount}
              total={papers.length}
              label="Project Analysis Progress"
              color="amber"
              showPercentage
              showCounts
              countLabel="analyzed"
            />

            {/* Top Categories */}
            {topCategories.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-2">Top Categories</p>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <CategoryBadge category={cat} size="sm" />
                      <span className="text-xs text-gray-500">({count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Analysis Section */}
        {analysis && (
          <div className="mb-4">
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3"
            >
              <Sparkles className="w-5 h-5 text-amber-500" />
              Project Analysis
              <span className="text-xs text-gray-400 font-normal">
                (click to {showAnalysis ? 'hide' : 'show'})
              </span>
            </button>
            {showAnalysis && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <MarkdownRenderer content={analysis} />
              </div>
            )}
          </div>
        )}

        {/* Papers List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Papers
          </h2>
          {papers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
              <p>No papers in this project yet.</p>
              <p className="text-sm mt-1">
                Go to "All Papers" and add papers to this project.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {papers.map((paper) => {
                const oneLineSummary = paper.one_line_summary?.trim();
                const displaySummary = oneLineSummary
                  ? `一句话总结：${oneLineSummary}`
                  : paper.summary;

                return (
                  <div
                    key={paper.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handlePaperClick(paper)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            paper.source === 'arxiv'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {paper.source === 'arxiv' ? 'arXiv' : 'Imported'}
                        </span>
                        <AnalysisStatusBadge
                          status={paper.analysis_path ? 'analyzed' : 'pending'}
                          size="sm"
                        />
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(paper.published)}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                        {paper.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 && ` et al.`}
                      </p>
                      {displaySummary && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-2">
                          {displaySummary}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {paper.arxiv_url && (
                        <button
                          onClick={() => open(paper.arxiv_url!)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="Open arXiv page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemovePaper(paper.id)}
                        className="p-2 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-600"
                        title="Remove from project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
