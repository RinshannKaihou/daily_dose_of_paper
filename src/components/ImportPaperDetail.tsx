import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Sparkles, Loader2, AlertCircle, X, FolderOpen } from 'lucide-react';
import {
  getImportedPaperDetail,
  openImportedPdf,
  showImportedPdfInFolder,
} from '../utils/api';
import type { ImportedPaperDetail } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { usePapers } from '../contexts/PapersContext';

interface ImportPaperDetailProps {
  paperId: string;
  onBack: () => void;
}

function ImportPaperDetail({ paperId, onBack }: ImportPaperDetailProps) {
  const { analyzeImportedPaper, importedAnalyzingPaperId, importedQueuedPaperIds } = usePapers();
  const [detail, setDetail] = useState<ImportedPaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localAnalysis, setLocalAnalysis] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, [paperId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getImportedPaperDetail(paperId);
      setDetail(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!detail) return;

    try {
      setError(null);
      const result = await analyzeImportedPaper(paperId);
      if (result) {
        setLocalAnalysis(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenPdf = async () => {
    try {
      await openImportedPdf(paperId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleShowInFolder = async () => {
    try {
      await showImportedPdfInFolder(paperId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const clearError = () => {
    setError(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-300" />
          <p className="text-lg">{error}</p>
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

  if (!detail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg">Paper not found</p>
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
  const isQueuedOrAnalyzing =
    importedAnalyzingPaperId === paperId || importedQueuedPaperIds.includes(paperId);

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky Back Button */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Papers
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
              My Papers
            </span>
            {analysis && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Analyzed
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{detail.title}</h1>

          {detail.authors && (
            <p className="text-gray-600 mb-3">{detail.authors}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>Imported: {new Date(detail.imported_at).toLocaleDateString()}</span>
          </div>

          <div className="text-sm text-gray-400 mb-4 truncate" title={detail.file_path}>
            <span className="font-mono">{detail.file_path}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Open PDF
            </button>
            <button
              onClick={handleShowInFolder}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Show in Folder
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isQueuedOrAnalyzing}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isQueuedOrAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isQueuedOrAnalyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Analyze with Claude'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Analysis */}
        {analysis && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
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

        {/* No content message */}
        {!analysis && !detail.pdf_text && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No PDF content available.</p>
            <p className="text-sm mt-1">
              Click "Analyze with Claude" to extract and analyze the paper.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportPaperDetail;
