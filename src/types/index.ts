export interface Config {
  search_queries: string[];
  max_papers_per_day: number;
  date_range: string;
  categories: string[];
  my_papers_dir: string | null;  // Directory containing user's personal PDFs
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  one_line_summary?: string | null;
  published: string;
  arxiv_url: string;
  pdf_path: string | null;
  analysis_path: string | null;
  categories: string[];
}

export interface DayPapers {
  date: string;
  papers: Paper[];
  daily_review: string | null;
}

export interface PaperDetail {
  title: string;
  authors: string;
  summary: string;
  published: string;
  arxiv_url: string;
  analysis?: string;
  pdf_text?: string;
}

// Project-related types for custom organization
export interface Project {
  id: string;
  name: string;
  paper_ids: string[];  // References to papers (arxiv:* or uuid:*)
  created_at: string;
  analysis_path: string | null;
}

export interface ImportedPaper {
  id: string;           // UUID
  file_path: string;    // Original location on disk
  title: string;        // Extracted or user-provided
  authors: string[];    // Extracted or user-provided
  imported_at: string;
}

export interface ImportedPaperDetail {
  id: string;
  title: string;
  authors: string;
  file_path: string;
  imported_at: string;
  analysis?: string;
  pdf_text?: string;
}

export interface ScanMyPapersResult {
  indexed: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings: string[];
}

export interface ProjectsData {
  projects: Project[];
  imported_papers: ImportedPaper[];
}

// Unified paper type for displaying all papers
export interface UnifiedPaper {
  id: string;           // arxiv:* or uuid:* or file:*
  title: string;
  authors: string[];
  summary: string;
  one_line_summary?: string | null;
  published: string;
  source: 'arxiv' | 'imported';
  arxiv_url?: string;
  pdf_path: string | null;
  analysis_path: string | null;
  categories: string[];
  file_path?: string;   // For imported papers, the original path
  imported_at?: string; // For imported papers
  date_folder?: string; // For arXiv papers: the fetch date folder name
}
