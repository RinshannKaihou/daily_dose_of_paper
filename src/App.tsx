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
import { Loader2 } from 'lucide-react';

type ViewType = 'papers' | 'review' | 'settings' | 'all-papers' | 'project' | 'import-detail';

function AnalyzingIndicator() {
  const { analyzing, dayPapers, analyzingPaperId, batchProgress } = usePapers();

  if (!analyzing) return null;

  const currentPaper = dayPapers?.papers.find(p => p.id === analyzingPaperId);
  const paperTitle = currentPaper?.title?.slice(0, 50) + (currentPaper && currentPaper.title.length > 50 ? '...' : '');

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 border border-amber-200 z-50">
      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
      <div className="text-sm">
        {batchProgress ? (
          <>
            <span className="text-gray-700">Batch analysis: </span>
            <span className="text-gray-900 font-medium">{batchProgress.current}/{batchProgress.total}</span>
            <span className="text-gray-500 ml-2">- {paperTitle || 'Paper...'}</span>
          </>
        ) : (
          <>
            <span className="text-gray-700">Analyzing: </span>
            <span className="text-gray-900 font-medium">{paperTitle || 'Paper...'}</span>
          </>
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
