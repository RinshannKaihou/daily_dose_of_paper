import { useState } from 'react';
import Sidebar from './components/Sidebar';
import PaperList from './components/PaperList';
import PaperDetail from './components/PaperDetail';
import DailyReview from './components/DailyReview';
import Settings from './components/Settings';
import AllPapers from './components/AllPapers';
import ProjectDetail from './components/ProjectDetail';
import ImportPaperDetail from './components/ImportPaperDetail';
import { PapersProvider, usePapers } from './contexts/PapersContext';
import { Loader2, Sparkles } from 'lucide-react';
import ProgressBar from './components/ProgressBar';

type ViewType = 'papers' | 'review' | 'settings' | 'all-papers' | 'project' | 'import-detail';

function AnalyzingIndicator() {
  const {
    analyzing,
    dayPapers,
    analyzingPaperId,
    batchProgress,
    importedAnalyzingPaperId,
    importedQueuedPaperIds,
  } = usePapers();
  const importedQueueCount = (importedAnalyzingPaperId ? 1 : 0) + importedQueuedPaperIds.length;

  if (!analyzing && importedQueueCount === 0) return null;

  const currentPaper = dayPapers?.papers.find(p => p.id === analyzingPaperId);
  const paperTitle = currentPaper?.title?.slice(0, 50) + (currentPaper && currentPaper.title.length > 50 ? '...' : '');

  // Calculate progress for batch analysis
  const batchProgressPercent = batchProgress
    ? (batchProgress.current / batchProgress.total) * 100
    : 0;

  // Calculate progress for imported queue
  const totalImportedQueue = importedQueueCount + (importedAnalyzingPaperId ? 0 : 1);
  const processedImported = importedAnalyzingPaperId ? 1 : 0;
  const importedProgressPercent = importedQueueCount > 0
    ? (processedImported / totalImportedQueue) * 100
    : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-xl px-4 py-3 border border-amber-200 z-50 w-80">
      <div className="text-sm space-y-3">
        {analyzing && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-gray-700 font-medium">
                {batchProgress ? 'Batch Analysis' : 'Analyzing Paper'}
              </span>
            </div>
            {batchProgress ? (
              <div className="space-y-2">
                <ProgressBar
                  progress={batchProgressPercent}
                  current={batchProgress.current}
                  total={batchProgress.total}
                  size="sm"
                  color="amber"
                  showPercentage
                  showCounts
                  countLabel="completed"
                />
                <p className="text-xs text-gray-500 truncate">
                  Currently analyzing: {paperTitle || 'Paper...'}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                <span className="text-gray-600 truncate">{paperTitle || 'Paper...'}</span>
              </div>
            )}
          </div>
        )}

        {importedQueueCount > 0 && (
          <div className={`${analyzing ? 'pt-2 border-t border-gray-100' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-gray-700 font-medium">Imported Papers Queue</span>
            </div>
            <ProgressBar
              progress={importedProgressPercent}
              current={importedQueueCount > 0 ? 1 : 0}
              total={importedQueueCount + (importedAnalyzingPaperId ? 1 : 0)}
              size="sm"
              color="blue"
              showPercentage
              showCounts
              countLabel="processed"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('papers');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedImportedPaperId, setSelectedImportedPaperId] = useState<string | null>(null);
  const { setSelectedDate } = usePapers();

  const handleViewChange = (newView: ViewType) => {
    setView(newView);
    if (newView !== 'project') {
      setSelectedProjectId(null);
    }
    if (newView !== 'papers') {
      setSelectedPaperId(null);
    }
    if (newView !== 'import-detail') {
      setSelectedImportedPaperId(null);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setView('project');
  };

  const handlePaperSelect = (paperId: string | null, date?: string) => {
    setSelectedPaperId(paperId);
    if (paperId) {
      // Update the selected date in context when provided (e.g., from AllPapers)
      if (date) {
        setSelectedDate(date);
      }
      setView('papers');
    }
  };

  const handleImportedPaperSelect = (paperId: string) => {
    setSelectedImportedPaperId(paperId);
    setView('import-detail');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={view}
        onViewChange={handleViewChange}
        onPaperSelect={handlePaperSelect}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleProjectSelect}
      />

      <main className="flex-1 overflow-hidden">
        {view === 'papers' && !selectedPaperId && (
          <PaperList onPaperSelect={handlePaperSelect} />
        )}
        {view === 'papers' && selectedPaperId && (
          <PaperDetail
            paperId={selectedPaperId}
            onBack={() => setSelectedPaperId(null)}
          />
        )}
        {view === 'review' && <DailyReview />}
        {view === 'settings' && <Settings />}
        {view === 'all-papers' && (
          <AllPapers
            onPaperSelect={handlePaperSelect}
            onImportedPaperSelect={handleImportedPaperSelect}
          />
        )}
        {view === 'project' && selectedProjectId && (
          <ProjectDetail
            projectId={selectedProjectId}
            onBack={() => {
              setSelectedProjectId(null);
              setView('papers');
            }}
            onPaperSelect={handlePaperSelect}
            onImportedPaperSelect={handleImportedPaperSelect}
          />
        )}
        {view === 'import-detail' && selectedImportedPaperId && (
          <ImportPaperDetail
            paperId={selectedImportedPaperId}
            onBack={() => {
              setSelectedImportedPaperId(null);
              setView('all-papers');
            }}
          />
        )}
      </main>

      <AnalyzingIndicator />
    </div>
  );
}

function App() {
  return (
    <PapersProvider>
      <AppContent />
    </PapersProvider>
  );
}

export default App;
