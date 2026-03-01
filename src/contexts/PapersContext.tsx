import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { DayPapers } from '../types';
import {
  getPaperDates,
  getDayPapers as getDayPapersApi,
  fetchPapers as fetchPapersApi,
  analyzePaper as analyzePaperApi,
  generateDailyReview as generateDailyReviewApi,
  parsePdfs as parsePdfsApi,
} from '../utils/api';

interface PapersContextType {
  dates: string[];
  selectedDate: string | null;
  dayPapers: DayPapers | null;
  loading: boolean;
  analyzing: boolean;
  analyzingPaperId: string | null;
  batchProgress: { current: number; total: number } | null;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;
  error: string | null;
  setSelectedDate: (date: string | null) => void;
  fetchPapers: (date?: string) => Promise<string | undefined>;
  analyzePaper: (paperId: string) => Promise<string | undefined>;
  generateDailyReview: () => Promise<string | undefined>;
  parsePdfs: () => Promise<string | undefined>;
  clearError: () => void;
  refresh: () => Promise<void>;
}

const PapersContext = createContext<PapersContextType | null>(null);

export function PapersProvider({ children }: { children: ReactNode }) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayPapers, setDayPapers] = useState<DayPapers | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingPaperId, setAnalyzingPaperId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDates();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadDayPapers(selectedDate);
    }
  }, [selectedDate]);

  const loadDates = async () => {
    try {
      setLoading(true);
      const data = await getPaperDates();
      setDates(data);
      if (data.length > 0 && !selectedDate) {
        setSelectedDate(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dates');
    } finally {
      setLoading(false);
    }
  };

  const loadDayPapers = async (date: string) => {
    try {
      setLoading(true);
      const data = await getDayPapersApi(date);
      setDayPapers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  };

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
  }, []);

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
  }, [selectedDate]);

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

  const refresh = useCallback(() => loadDates(), []);

  return (
    <PapersContext.Provider
      value={{
        dates,
        selectedDate,
        dayPapers,
        loading,
        analyzing,
        analyzingPaperId,
        batchProgress,
        setBatchProgress,
        error,
        setSelectedDate,
        fetchPapers,
        analyzePaper,
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
