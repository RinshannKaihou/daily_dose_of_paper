export interface Config {
  search_queries: string[];
  max_papers_per_day: number;
  date_range: string;
  categories: string[];
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
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
