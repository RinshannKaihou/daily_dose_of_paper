import { usePaperDetail } from '../hooks/usePapers';
import { usePapers } from '../contexts/PapersContext';
import { ArrowLeft, ExternalLink, FileText, Sparkles, Loader2, AlertCircle, X, Trash2 } from 'lucide-react';
import { openPdf, openUrl } from '../utils/api';
import { useState, useMemo } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import CategoryBadge from './CategoryBadge';
import RatingDisplay from './RatingDisplay';

interface PaperDetailProps {
  paperId: string;
  onBack: () => void;
}

function PaperDetail({ paperId, onBack }: PaperDetailProps) {
  const { selectedDate, dayPapers, analyzePaper, deleteDailyPaper, error: contextError, clearError, analyzingPaperId } = usePapers();
  const { detail, loading, error } = usePaperDetail(selectedDate, paperId);
  const [localAnalysis, setLocalAnalysis] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Parse rating from analysis text
  const parsedRating = useMemo(() => {
    const analysis = localAnalysis || detail?.analysis;
    if (!analysis) return null;

    // Look for patterns like "推荐指数: 4.5/5" or "推荐指数：4/5" or "Rating: 8/10"
    const ratingMatch = analysis.match(/推荐指数[:：]\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
    if (ratingMatch) {
      return {
        value: parseFloat(ratingMatch[1]),
        max: parseInt(ratingMatch[2], 10),
      };
    }

    // Alternative pattern: "推荐指数 4.5/5"
    const altMatch = analysis.match(/推荐指数\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
    if (altMatch) {
      return {
        value: parseFloat(altMatch[1]),
        max: parseInt(altMatch[2], 10),
      };
    }

    return null;
  }, [detail?.analysis, localAnalysis]);

  const paper = dayPapers?.papers.find((p) => p.id === paperId);
  const isAnalyzingThis = analyzingPaperId === paperId;

  const handleAnalyze = async () => {
    try {
      setLocalError(null);
      clearError();
      const result = await analyzePaper(paperId);
      if (result) {
        setLocalAnalysis(result);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    }
  };

  const handleOpenPdf = async () => {
    if (!selectedDate) {
      setLocalError('No date selected');
      return;
    }
    try {
      await openPdf(selectedDate, paperId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(
      'Delete this paper permanently?\n\nThis will remove local metadata, PDF, parsed text, and analysis files.'
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      setLocalError(null);
      clearError();
      await deleteDailyPaper(paperId);
      onBack();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const displayError = localError || contextError;

  const clearAllErrors = () => {
    setLocalError(null);
    clearError();
  };

  // Show message if no date is selected
  if (!selectedDate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-300" />
          <p className="text-lg">No date selected</p>
          <p className="text-sm mt-2">Please select a date from the sidebar first</p>
          <button
            onClick={onBack}
            className="mt-4 text-primary-600 hover:text-primary-700"
          >
            Go back
          </button>
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

  if (error || !detail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg">{error || 'Paper not found'}</p>
          <button
            onClick={onBack}
            className="mt-4 text-primary-600 hover:text-primary-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const analysis = localAnalysis || detail.analysis;

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky Back Button */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to papers
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{detail.title}</h1>

          <p className="text-gray-600 mb-3">{detail.authors}</p>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>Published: {new Date(detail.published).toLocaleDateString()}</span>
            {paper?.categories.map((cat) => (
              <CategoryBadge key={cat} category={cat} size="sm" />
            ))}
          </div>

          {/* Rating Display */}
          {parsedRating && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  AI Recommendation
                </span>
              </div>
              <RatingDisplay
                rating={parsedRating.value}
                maxRating={parsedRating.max}
                size="md"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Open PDF
            </button>
            <button
              onClick={() => {
                if (detail.arxiv_url) {
                  openUrl(detail.arxiv_url);
                } else {
                  setLocalError('arXiv URL not available');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on arXiv
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzingThis}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isAnalyzingThis ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isAnalyzingThis ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Analyze with Claude'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {deleting ? 'Deleting...' : 'Delete Completely'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{displayError}</p>
            </div>
            <button
              onClick={clearAllErrors}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Abstract */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Abstract</h2>
          <p className="text-gray-700 leading-relaxed">{detail.summary}</p>
        </div>

        {/* Analysis */}
        {analysis && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Analysis</h2>
            <MarkdownRenderer content={analysis} />
          </div>
        )}

        {/* PDF Text Preview */}
        {detail.pdf_text && !analysis && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">PDF Content Preview</h2>
            <div className="max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                {detail.pdf_text.slice(0, 5000)}
                {detail.pdf_text.length > 5000 && '...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaperDetail;
