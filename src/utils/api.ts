import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type { Config, DayPapers, PaperDetail } from '../types';

export async function openUrl(url: string): Promise<void> {
  await open(url);
}

export async function getConfig(): Promise<Config> {
  return await invoke<Config>('get_config');
}

export async function saveConfig(config: Config): Promise<void> {
  return await invoke('save_config', { config });
}

export async function fetchPapers(date?: string): Promise<string> {
  return await invoke<string>('fetch_papers', { date });
}

export async function getPaperDates(): Promise<string[]> {
  return await invoke<string[]>('get_paper_dates');
}

export async function getDayPapers(date: string): Promise<DayPapers> {
  return await invoke<DayPapers>('get_day_papers', { date });
}

export async function getPaperDetail(date: string, paperId: string): Promise<PaperDetail> {
  const result = await invoke<Record<string, string>>('get_paper_detail', { date, paperId });
  return {
    title: result.title || '',
    authors: result.authors || '',
    summary: result.summary || '',
    published: result.published || '',
    arxiv_url: result.arxiv_url || '',
    analysis: result.analysis,
    pdf_text: result.pdf_text,
  };
}

export async function analyzePaper(date: string, paperId: string): Promise<string> {
  return await invoke<string>('analyze_paper', { date, paperId });
}

export async function generateDailyReview(date: string): Promise<string> {
  return await invoke<string>('generate_daily_review', { date });
}

export async function openPdf(date: string, paperId: string): Promise<void> {
  return await invoke('open_pdf', { date, paperId });
}

export async function parsePdfs(date: string): Promise<string> {
  return await invoke<string>('parse_pdfs', { date });
}
