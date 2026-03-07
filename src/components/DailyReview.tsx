import { useState, useMemo } from 'react';
import { usePapers } from '../contexts/PapersContext';
import { Sparkles, Loader2, MessageSquare, AlertCircle, X, FileText } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import StatsCard from './StatsCard';
import ProgressBar from './ProgressBar';

function DailyReview() {
  const { dayPapers, selectedDate, generateDailyReview, error, clearError } = usePapers();
  const [generating, setGenerating] = useState(false);
  const [localReview, setLocalReview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Calculate stats for the daily summary
  const stats = useMemo(() => {
    if (!dayPapers?.papers.length) return null;
    
    const total = dayPapers.papers.length;
    const analyzed = dayPapers.papers.filter(p => p.analysis_path).length;
    
    // Get category distribution
    const categoryCount: Record<string, number> = {};
    dayPapers.papers.forEach(paper => {
      paper.categories.forEach(cat => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
    });
    
    const topCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      total,
      analyzed,
      progress: total > 0 ? (analyzed / total) * 100 : 0,
      topCategory: topCategory?.[0],
      topCategoryCount: topCategory?.[1],
    };
  }, [dayPapers]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setLocalError(null);
      clearError();
      const result = await generateDailyReview();
      if (result) {
        setLocalReview(result);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const displayError = localError || error;
  const review = localReview || dayPapers?.daily_review;

  if (!selectedDate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Select a date to view daily review</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Daily Review</h1>
            <p className="text-gray-500 mt-1">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : review ? 'Regenerate' : 'Generate Review'}
          </button>
        </div>

        {/* Daily Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard
              icon={FileText}
              label="Today's Papers"
              value={stats.total}
              color="blue"
            />
            <StatsCard
              icon={Sparkles}
              label="Analyzed"
              value={stats.analyzed}
              color="amber"
            />
            <div className="col-span-2 bg-gray-50 rounded-xl border border-gray-200 p-4">
              <ProgressBar
                progress={stats.progress}
                current={stats.analyzed}
                total={stats.total}
                label="Analysis Progress"
                color="amber"
                showPercentage
                showCounts
                countLabel="analyzed"
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {displayError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Failed to generate review</p>
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

        {/* Review Content */}
        {review ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <MarkdownRenderer content={review} />
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">No daily review yet</p>
            <p className="text-sm text-gray-400 mb-6">
              Generate a daily review to get a comprehensive summary of today's papers
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating || !dayPapers?.papers.length}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors mx-auto"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {generating ? 'Generating...' : 'Generate Daily Review'}
            </button>
            {(!dayPapers?.papers.length) && (
              <p className="text-sm text-amber-600 mt-4">
                No papers available. Fetch papers first before generating a review.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyReview;
