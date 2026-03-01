import { useState } from 'react';
import Sidebar from './components/Sidebar';
import PaperList from './components/PaperList';
import PaperDetail from './components/PaperDetail';
import DailyReview from './components/DailyReview';
import Settings from './components/Settings';
import { PapersProvider, usePapers } from './contexts/PapersContext';
import { Loader2 } from 'lucide-react';

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
  const [view, setView] = useState<'papers' | 'review' | 'settings'>('papers');

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={view}
        onViewChange={setView}
        onPaperSelect={setSelectedPaperId}
      />

      <main className="flex-1 overflow-hidden">
        {view === 'papers' && !selectedPaperId && (
          <PaperList onPaperSelect={setSelectedPaperId} />
        )}
        {view === 'papers' && selectedPaperId && (
          <PaperDetail
            paperId={selectedPaperId}
            onBack={() => setSelectedPaperId(null)}
          />
        )}
        {view === 'review' && <DailyReview />}
        {view === 'settings' && <Settings />}
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
