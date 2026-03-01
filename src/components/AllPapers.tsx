import { useState, useEffect, useRef, type UIEvent } from 'react';
import {
  Search,
  FileText,
  ExternalLink,
  Sparkles,
  Plus,
  FolderPlus,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { getAllPapers, getProjects, addPaperToProject, scanMyPapersDir, getConfig } from '../utils/api';
import type { UnifiedPaper, Project, Config } from '../types';
import { open } from '@tauri-apps/plugin-shell';

interface AllPapersProps {
  onPaperSelect?: (paperId: string, date?: string) => void;
  onImportedPaperSelect?: (paperId: string) => void;
}

type SourceFilter = 'all' | 'arxiv' | 'imported';

interface AllPapersCacheState {
  papers: UnifiedPaper[];
  projects: Project[];
  config: Config | null;
  searchQuery: string;
  sourceFilter: SourceFilter;
  scrollTop: number;
  hasLoaded: boolean;
}

let allPapersCache: AllPapersCacheState = {
  papers: [],
  projects: [],
  config: null,
  searchQuery: '',
  sourceFilter: 'all',
  scrollTop: 0,
  hasLoaded: false,
};

function AllPapers({ onPaperSelect, onImportedPaperSelect }: AllPapersProps) {
  const [papers, setPapers] = useState<UnifiedPaper[]>(allPapersCache.papers);
  const [loading, setLoading] = useState(!allPapersCache.hasLoaded);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(allPapersCache.searchQuery);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(allPapersCache.sourceFilter);
  const [projects, setProjects] = useState<Project[]>(allPapersCache.projects);
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [config, setConfig] = useState<Config | null>(allPapersCache.config);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    if (!allPapersCache.hasLoaded) {
      void loadData();
    }

    // Close menu on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (listRef.current) {
        allPapersCache.scrollTop = listRef.current.scrollTop;
      }
    };
  }, []);

  useEffect(() => {
    allPapersCache = {
      ...allPapersCache,
      papers,
      projects,
      config,
      searchQuery,
      sourceFilter,
      hasLoaded: allPapersCache.hasLoaded || (!loading && !error),
    };
  }, [papers, projects, config, searchQuery, sourceFilter, loading, error]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPapers, projectList, appConfig] = await Promise.all([
        getAllPapers(),
        getProjects(),
        getConfig(),
      ]);
      setPapers(allPapers);
      setProjects(projectList);
      setConfig(appConfig);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const scan = await scanMyPapersDir();
      if (scan.indexed > 0 || scan.updated > 0) {
        await loadData();
      }
      const summary =
        `Indexed ${scan.indexed}, updated ${scan.updated}, skipped ${scan.skipped}, failed ${scan.failed}.`;
      const warningSuffix = scan.warnings.length > 0 ? ` Warning: ${scan.warnings[0]}` : '';
      setError(summary + warningSuffix);
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const handleAddToProject = async (paperId: string, projectId: string) => {
    try {
      await addPaperToProject(paperId, projectId);
      setShowProjectMenu(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const filteredPapers = papers.filter((paper) => {
    const matchesSearch =
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.authors.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSource = sourceFilter === 'all' || paper.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  useEffect(() => {
    if (loading || hasRestoredScrollRef.current || !listRef.current) {
      return;
    }
    listRef.current.scrollTop = allPapersCache.scrollTop;
    hasRestoredScrollRef.current = true;
  }, [loading, filteredPapers.length]);

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

  const handlePaperClick = (paper: UnifiedPaper) => {
    if (paper.source === 'arxiv' && paper.date_folder && onPaperSelect) {
      // For arXiv papers, use the date_folder (fetch date) and strip the arxiv: prefix
      const rawId = paper.id.replace(/^arxiv:/, '');
      onPaperSelect(rawId, paper.date_folder);
    } else if (paper.source === 'imported' && onImportedPaperSelect) {
      // For imported papers, use the imported paper detail view
      // The ID might be a UUID or a file: hash - pass it directly
      onImportedPaperSelect(paper.id);
    }
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    allPapersCache.scrollTop = event.currentTarget.scrollTop;
  };

  const arxivCount = papers.filter((p) => p.source === 'arxiv').length;
  const importedCount = papers.filter((p) => p.source === 'imported').length;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">All Papers</h1>
            <p className="text-sm text-gray-500 mt-1">
              {arxivCount} from arXiv · {importedCount} from your collection
            </p>
          </div>
          <div className="flex items-center gap-2">
            {config?.my_papers_dir && (
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                title="Scan My Papers Directory for new PDFs"
              >
                {scanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {scanning ? 'Scanning...' : 'Scan for New Papers'}
              </button>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search papers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Sources</option>
              <option value="arxiv">arXiv ({arxivCount})</option>
              <option value="imported">My Papers ({importedCount})</option>
            </select>
          </div>
        </div>

        {!config?.my_papers_dir && (
          <div className="mt-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <strong>Tip:</strong> Configure your papers directory in Settings to automatically load your personal PDF collection.
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className={`mx-4 mt-4 p-3 rounded-lg text-sm ${
          error.startsWith('Indexed') && error.includes('failed 0')
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {error}
        </div>
      )}

      {/* Papers List */}
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No papers found.</p>
            <p className="text-sm mt-1">
              {searchQuery || sourceFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Fetch papers from arXiv or configure your papers directory in Settings.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPapers.map((paper) => {
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
                        {paper.source === 'arxiv' ? 'arXiv' : 'My Papers'}
                      </span>
                      {paper.analysis_path && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Analyzed
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDate(paper.published)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                      {paper.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {paper.authors.slice(0, 3).join(', ')}
                      {paper.authors.length > 3 && ` et al. (${paper.authors.length} authors)`}
                    </p>
                    {displaySummary && (
                      <p className="text-sm text-gray-500 line-clamp-2">{displaySummary}</p>
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
                    <div className="relative" ref={showProjectMenu === paper.id ? menuRef : null}>
                      <button
                        onClick={() =>
                          setShowProjectMenu(showProjectMenu === paper.id ? null : paper.id)
                        }
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        title="Add to project"
                      >
                        <FolderPlus className="w-4 h-4" />
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
                                onClick={() => handleAddToProject(paper.id, project.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Plus className="w-3 h-3" />
                                {project.name}
                                {project.paper_ids.includes(paper.id) && (
                                  <span className="text-xs text-green-600 ml-auto">Added</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 text-sm text-gray-500">
        {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''}
        {sourceFilter !== 'all' && ` (${sourceFilter === 'arxiv' ? 'from arXiv' : 'from your collection'})`}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>
    </div>
  );
}

export default AllPapers;
