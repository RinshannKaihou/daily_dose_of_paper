import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type {
  Config,
  DayPapers,
  PaperDetail,
  Project,
  ImportedPaper,
  ImportedPaperDetail,
  UnifiedPaper,
  ScanMyPapersResult,
} from '../types';

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

// ==================== Project Management ====================

export async function getProjects(): Promise<Project[]> {
  return await invoke<Project[]>('get_projects');
}

export async function createProject(name: string): Promise<Project> {
  return await invoke<Project>('create_project', { name });
}

export async function renameProject(id: string, name: string): Promise<void> {
  return await invoke('rename_project', { id, name });
}

export async function deleteProject(id: string): Promise<void> {
  return await invoke('delete_project', { id });
}

export async function addPaperToProject(paperId: string, projectId: string): Promise<void> {
  return await invoke('add_paper_to_project', { paperId, projectId });
}

export async function removePaperFromProject(paperId: string, projectId: string): Promise<void> {
  return await invoke('remove_paper_from_project', { paperId, projectId });
}

export async function getProjectPapers(projectId: string): Promise<UnifiedPaper[]> {
  return await invoke<UnifiedPaper[]>('get_project_papers', { projectId });
}

export async function analyzeProject(projectId: string): Promise<string> {
  return await invoke<string>('analyze_project', { projectId });
}

export async function getProjectAnalysis(projectId: string): Promise<string | null> {
  return await invoke<string | null>('get_project_analysis', { projectId });
}

// ==================== Paper Import ====================

export async function importPaper(filePath: string): Promise<ImportedPaper> {
  return await invoke<ImportedPaper>('import_paper', { filePath });
}

export async function getAllPapers(): Promise<UnifiedPaper[]> {
  return await invoke<UnifiedPaper[]>('get_all_papers');
}

export async function getImportedPapers(): Promise<ImportedPaper[]> {
  return await invoke<ImportedPaper[]>('get_imported_papers');
}

export async function deleteImportedPaper(id: string): Promise<void> {
  return await invoke('delete_imported_paper', { id });
}

// ==================== My Papers Directory ====================

export async function scanMyPapersDir(): Promise<ScanMyPapersResult> {
  return await invoke<ScanMyPapersResult>('scan_my_papers_dir');
}

// ==================== Imported Paper Detail & Analysis ====================

export async function getImportedPaperDetail(paperId: string): Promise<ImportedPaperDetail> {
  return await invoke<ImportedPaperDetail>('get_imported_paper_detail', { paperId });
}

export async function analyzeImportedPaper(paperId: string): Promise<string> {
  return await invoke<string>('analyze_imported_paper', { paperId });
}

export async function openImportedPdf(paperId: string): Promise<void> {
  return await invoke('open_imported_pdf', { paperId });
}

export async function showImportedPdfInFolder(paperId: string): Promise<void> {
  return await invoke('show_imported_pdf_in_folder', { paperId });
}
