import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { DayPapers } from '../types';
import {
  getPaperDates,
  getDayPapers as getDayPapersApi,
  fetchPapers as fetchPapersApi,
  analyzePaper as analyzePaperApi,
  analyzeImportedPaper as analyzeImportedPaperApi,
  generateDailyReview as generateDailyReviewApi,
  parsePdfs as parsePdfsApi,
  deleteDailyPaper as deleteDailyPaperApi,
} from '../utils/api';

interface PapersContextType {
  dates: string[];
  selectedDate: string | null;
  dayPapers: DayPapers | null;
  loading: boolean;
  analyzing: boolean;
  analyzingPaperId: string | null;
  importedAnalyzingPaperId: string | null;
  importedQueuedPaperIds: string[];
  batchProgress: { current: number; total: number } | null;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;
  error: string | null;
  setSelectedDate: (date: string | null) => void;
  fetchPapers: (date?: string) => Promise<string | undefined>;
  analyzePaper: (paperId: string) => Promise<string | undefined>;
  analyzePaperForDate: (date: string, paperId: string) => Promise<string | undefined>;
  deleteDailyPaper: (paperId: string, date?: string) => Promise<void>;
  analyzeImportedPaper: (paperId: string) => Promise<string | undefined>;
  generateDailyReview: () => Promise<string | undefined>;
  parsePdfs: () => Promise<string | undefined>;
  clearError: () => void;
  refresh: () => Promise<void>;
}

const PapersContext = createContext<PapersContextType | null>(null);

interface ImportedAnalysisTask {
  paperId: string;
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}

export function PapersProvider({ children }: { children: ReactNode }) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayPapers, setDayPapers] = useState<DayPapers | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingPaperId, setAnalyzingPaperId] = useState<string | null>(null);
  const [importedAnalyzingPaperId, setImportedAnalyzingPaperId] = useState<string | null>(null);
  const [importedQueuedPaperIds, setImportedQueuedPaperIds] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importedQueueRef = useRef<ImportedAnalysisTask[]>([]);
  const importedQueueRunningRef = useRef(false);
  const importedTaskPromisesRef = useRef<Map<string, Promise<string>>>(new Map());

  const loadDates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPaperDates();
      setDates(data);
      setSelectedDate((currentDate) => {
        if (data.length === 0) return null;
        if (currentDate && data.includes(currentDate)) return currentDate;
        return data[0];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dates');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDayPapers = useCallback(async (date: string) => {
    try {
      setLoading(true);
      const data = await getDayPapersApi(date);
      setDayPapers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDates();
  }, [loadDates]);

  useEffect(() => {
    if (selectedDate) {
      void loadDayPapers(selectedDate);
    } else {
      setDayPapers(null);
    }
  }, [selectedDate, loadDayPapers]);

  const fetchPapers = useCallback(async (date?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPapersApi(date);
      await loadDates();
      if (date) {
        await loadDayPapers(date);
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch papers';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadDates, loadDayPapers]);

  const analyzePaper = useCallback(async (paperId: string) => {
    if (!selectedDate) {
      setError('No date selected');
      throw new Error('No date selected');
    }
    try {
      setAnalyzing(true);
      setAnalyzingPaperId(paperId);
      setError(null);
      const result = await analyzePaperApi(selectedDate, paperId);
      await loadDayPapers(selectedDate);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze paper';
      setError(errorMsg);
      throw err;
    } finally {
      setAnalyzing(false);
      setAnalyzingPaperId(null);
    }
  }, [selectedDate, loadDayPapers]);

  const analyzePaperForDate = useCallback(async (date: string, paperId: string) => {
    try {
      setAnalyzing(true);
      setAnalyzingPaperId(paperId);
      setError(null);
      const result = await analyzePaperApi(date, paperId);
      if (selectedDate === date) {
        await loadDayPapers(date);
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze paper';
      setError(errorMsg);
      throw err;
    } finally {
      setAnalyzing(false);
      setAnalyzingPaperId(null);
    }
  }, [selectedDate, loadDayPapers]);

  const deleteDailyPaper = useCallback(async (paperId: string, date?: string) => {
    const targetDate = date ?? selectedDate;
    if (!targetDate) {
      setError('No date selected');
      throw new Error('No date selected');
    }

    try {
      setLoading(true);
      setError(null);
      await deleteDailyPaperApi(targetDate, paperId);
      await loadDates();
      if (selectedDate) {
        await loadDayPapers(selectedDate);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete paper';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate, loadDates, loadDayPapers]);

  const processImportedQueue = useCallback(async () => {
    if (importedQueueRunningRef.current) return;
    importedQueueRunningRef.current = true;

    try {
      while (importedQueueRef.current.length > 0) {
        const task = importedQueueRef.current.shift();
        if (!task) continue;

        setImportedQueuedPaperIds((prev) => prev.filter((id) => id !== task.paperId));
        setImportedAnalyzingPaperId(task.paperId);

        try {
          const result = await analyzeImportedPaperApi(task.paperId);
          task.resolve(result);
        } catch (err) {
          task.reject(err);
        } finally {
          importedTaskPromisesRef.current.delete(task.paperId);
          setImportedAnalyzingPaperId((currentId) => (currentId === task.paperId ? null : currentId));
        }
      }
    } finally {
      importedQueueRunningRef.current = false;
    }
  }, []);

  const analyzeImportedPaper = useCallback((paperId: string) => {
    const existingPromise = importedTaskPromisesRef.current.get(paperId);
    if (existingPromise) {
      return existingPromise;
    }

    const taskPromise = new Promise<string>((resolve, reject) => {
      importedQueueRef.current.push({ paperId, resolve, reject });
      setImportedQueuedPaperIds((prev) => (prev.includes(paperId) ? prev : [...prev, paperId]));
    });

    importedTaskPromisesRef.current.set(paperId, taskPromise);
    void processImportedQueue();

    return taskPromise;
  }, [processImportedQueue]);

  const generateDailyReview = useCallback(async () => {
    if (!selectedDate) {
      setError('No date selected');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await generateDailyReviewApi(selectedDate);
      await loadDayPapers(selectedDate);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate daily review';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const parsePdfs = useCallback(async () => {
    if (!selectedDate) {
      setError('No date selected');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await parsePdfsApi(selectedDate);
      await loadDayPapers(selectedDate);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to parse PDFs';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const refresh = useCallback(async () => {
    await loadDates();
    if (selectedDate) {
      await loadDayPapers(selectedDate);
    }
  }, [loadDates, loadDayPapers, selectedDate]);

  return (
    <PapersContext.Provider
      value={{
        dates,
        selectedDate,
        dayPapers,
        loading,
        analyzing,
        analyzingPaperId,
        importedAnalyzingPaperId,
        importedQueuedPaperIds,
        batchProgress,
        setBatchProgress,
        error,
        setSelectedDate,
        fetchPapers,
        analyzePaper,
        analyzePaperForDate,
        deleteDailyPaper,
        analyzeImportedPaper,
        generateDailyReview,
        parsePdfs,
        clearError,
        refresh,
      }}
    >
      {children}
    </PapersContext.Provider>
  );
}

export function usePapers() {
  const context = useContext(PapersContext);
  if (!context) {
    throw new Error('usePapers must be used within a PapersProvider');
  }
  return context;
}
