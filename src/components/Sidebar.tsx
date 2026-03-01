import { useState } from 'react';
import {
  Calendar,
  BookOpen,
  MessageSquare,
  Settings,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { usePapers } from '../contexts/PapersContext';

interface SidebarProps {
  currentView: 'papers' | 'review' | 'settings';
  onViewChange: (view: 'papers' | 'review' | 'settings') => void;
  onPaperSelect: (paperId: string | null) => void;
}

function Sidebar({ currentView, onViewChange, onPaperSelect }: SidebarProps) {
  const { dates, selectedDate, setSelectedDate, fetchPapers, dayPapers, analyzePaper, refresh, analyzing, batchProgress, setBatchProgress } = usePapers();
  const [collapsed, setCollapsed] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const getLocalDateString = (date: Date): string => {
    return date.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD in local timezone
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
        {/* Dates */}
        {!collapsed && (
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
        )}

        {/* Menu Items */}
        <div className="p-3 border-t border-gray-200">
          <div className="space-y-1">
            <button
              onClick={() => {
                onViewChange('papers');
                onPaperSelect(null);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                currentView === 'papers'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              {!collapsed && <span className="text-sm">Papers</span>}
            </button>
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
      </nav>
    </aside>
  );
}

export default Sidebar;
