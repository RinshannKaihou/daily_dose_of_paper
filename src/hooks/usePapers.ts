import { useState, useEffect, useCallback } from 'react';
import type { DayPapers, PaperDetail } from '../types';
import {
  getPaperDates,
  getDayPapers as getDayPapersApi,
  getPaperDetail as getPaperDetailApi,
  fetchPapers as fetchPapersApi,
  analyzePaper as analyzePaperApi,
  generateDailyReview as generateDailyReviewApi,
} from '../utils/api';

export function usePapers() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayPapers, setDayPapers] = useState<DayPapers | null>(null);
  const [loading, setLoading] = useState(false);
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
      const result = await fetchPapersApi(date);
      await loadDates();
      if (date) {
        await loadDayPapers(date);
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch papers');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzePaper = useCallback(async (paperId: string) => {
    if (!selectedDate) return;
    try {
      setLoading(true);
      const result = await analyzePaperApi(selectedDate, paperId);
      await loadDayPapers(selectedDate);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze paper');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const generateDailyReview = useCallback(async () => {
    if (!selectedDate) return;
    try {
      setLoading(true);
      const result = await generateDailyReviewApi(selectedDate);
      await loadDayPapers(selectedDate);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate daily review');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  return {
    dates,
    selectedDate,
    dayPapers,
    loading,
    error,
    setSelectedDate,
    fetchPapers,
    analyzePaper,
    generateDailyReview,
    refresh: loadDates,
  };
}

export function usePaperDetail(date: string | null, paperId: string | null) {
  const [detail, setDetail] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (date && paperId) {
      loadDetail(date, paperId);
    }
  }, [date, paperId]);

  const loadDetail = async (d: string, id: string) => {
    try {
      setLoading(true);
      const data = await getPaperDetailApi(d, id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load paper detail');
    } finally {
      setLoading(false);
    }
  };

  return { detail, loading, error };
}
