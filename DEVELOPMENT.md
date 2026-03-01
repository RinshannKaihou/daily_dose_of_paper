# Development Guide

This document provides technical details for developers working on Daily Dose of Paper.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tauri Desktop App                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────────────────────────────────────────┐  │
│  │   Sidebar    │  │           Main Content Area            │  │
│  │              │  │                                        │  │
│  │  - Dates     │  │  ┌──────────────────────────────────┐  │  │
│  │  - Settings  │  │  │      Paper List / Detail View    │  │  │
│  │  - Search    │  │  │                                  │  │  │
│  │  - Sync      │  │  │  - Paper summaries               │  │  │
│  │              │  │  │  - Categories                     │  │  │
│  │              │  │  │  - 每日锐评 (Daily Reviews)       │  │  │
│  │              │  │  └──────────────────────────────────┘  │  │
│  └──────────────┘  └────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Tauri Backend (Rust)                         │
│  - File system operations                                       │
│  - Command execution (Python scripts, Claude CLI)               │
│  - State management                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Python Scripts │ │   Claude Code   │ │  Local Storage  │
│                 │ │      CLI        │ │                 │
│ - arxiv search  │ │                 │ │ - papers/       │
│ - PDF download  │ │ - Paper analysis│ │   YYYY-MM-DD/   │
│ - PDF parsing   │ │ - Summaries     │ │   - *.pdf       │
│                 │ │ - Categorization│ │   - analysis.md │
└─────────────────┘ └─────────────────┘ │ - config.json   │
                                        └─────────────────┘
```

## Tauri Commands (IPC)

The following commands are available for frontend-backend communication:

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_config` | - | `Config` | Get current configuration |
| `save_config` | `config: Config` | - | Save configuration |
| `fetch_papers` | `date?: string` | `string` | Fetch papers from arXiv |
| `parse_pdfs` | `date: string` | `string` | Extract text from PDFs |
| `get_paper_dates` | - | `string[]` | List available dates |
| `get_day_papers` | `date: string` | `DayPapers` | Get papers for a date |
| `get_paper_detail` | `date, paper_id` | `HashMap<String, String>` | Get paper details |
| `analyze_paper` | `date, paper_id` | `string` | Analyze paper with Claude |
| `generate_daily_review` | `date` | `string` | Generate daily summary |
| `open_pdf` | `date, paper_id` | - | Open PDF in system viewer |

## Data Types

### Config
```typescript
interface Config {
  search_queries: string[];      // Topics to search
  max_papers_per_day: number;    // Max papers to fetch
  date_range: string;            // "last1day" | "last3days" | "last7days" | "last30days"
  categories: string[];          // arXiv categories
}
```

### Paper
```typescript
interface Paper {
  id: string;           // arXiv paper ID
  title: string;
  authors: string[];
  summary: string;      // Abstract
  published: string;    // ISO date string
  arxiv_url: string;
  pdf_path: string | null;
  analysis_path: string | null;
  categories: string[];
}
```

### DayPapers
```typescript
interface DayPapers {
  date: string;         // YYYY-MM-DD
  papers: Paper[];
  daily_review: string | null;  // Markdown content
}
```

## Python Scripts

### fetch_papers.py

Searches arXiv and downloads papers.

**Usage:**
```bash
python3 scripts/fetch_papers.py \
  --config /path/to/config.json \
  --output /path/to/output/dir \
  --date 2024-01-15
```

**Output:**
- `pdfs/{paper_id}.pdf` - Downloaded PDFs
- `metadata.json` - Paper metadata

### parse_pdf.py

Extracts text from PDFs using PyPDF2.

**Usage:**
```bash
python3 scripts/parse_pdf.py --dir /path/to/papers/YYYY-MM-DD
```

**Output:**
- `pdf_text/{paper_id}.txt` - Extracted text

## Claude Integration

### Analysis Prompt Template

```
Analyze the following paper and provide a structured analysis in Chinese:

## Paper Information
Title: {title}
Authors: {authors}

## Paper Content
{pdf_text}

## Please provide:
1. **一句话总结** (One-line summary in 20-30 words)
2. **核心贡献** (Key contributions - 3-5 bullet points)
3. **方法论** (Methodology overview)
4. **实验结果** (Experimental results summary)
5. **每日锐评** (Daily sharp review - critical evaluation with personal insights)
6. **推荐指数** (Rating: 1-5 stars, with explanation)
7. **适合人群** (Target audience - who should read this paper)

Format the response in Markdown.
```

### Daily Review Prompt Template

```
Based on the following paper analyses from today, create a comprehensive daily review:

{analyses}

## Please provide:
1. **今日概览** (Today's overview)
2. **热点趋势** (Hot trends)
3. **推荐必读** (Must read)
4. **方法论亮点** (Methodology highlights)
5. **行业影响** (Industry impact)
6. **明日关注** (Tomorrow's focus)
```

## File System Layout

### Application Data Directory

- **macOS**: `~/Library/Application Support/com.dailydose.paper/`
- **Windows**: `%APPDATA%/com.dailydose.paper/`
- **Linux**: `~/.config/com.dailydose.paper/`

### Contents

```
app_data_dir/
├── config.json           # User configuration
└── papers/               # All papers
    └── 2024-01-15/       # Organized by date
        ├── pdfs/
        │   └── 2401.12345.pdf
        ├── pdf_text/
        │   └── 2401.12345.txt
        ├── analysis/
        │   ├── 2401.12345.md
        │   └── 2401.12345_prompt.txt
        ├── metadata.json
        ├── daily_review.md
        └── daily_review_prompt.txt
```

## Development Workflow

### 1. Start Development Server

```bash
npm run tauri dev
```

This runs:
- Vite dev server on `http://localhost:1420`
- Tauri backend with hot reload

### 2. Build for Production

```bash
npm run tauri build
```

Output location: `src-tauri/target/release/bundle/`

### 3. Debug Mode

For Rust debugging, set environment variable:
```bash
RUST_BACKTRACE=1 npm run tauri dev
```

For frontend debugging, use browser DevTools (Cmd+Option+I on macOS).

## Common Tasks

### Adding a New Tauri Command

1. Add command function in `src-tauri/src/commands.rs`:
```rust
#[tauri::command]
pub async fn my_new_command(param: String) -> Result<String, String> {
    // Implementation
    Ok("result".to_string())
}
```

2. Register in `src-tauri/src/main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    daily_dose_of_paper_lib::my_new_command,
])
```

3. Add wrapper in `src/utils/api.ts`:
```typescript
export async function myNewCommand(param: string): Promise<string> {
  return await invoke<string>('my_new_command', { param });
}
```

### Adding a New React Component

1. Create component in `src/components/`
2. Import and use in `src/App.tsx` or other components
3. Use hooks from `src/hooks/` for data access

### Modifying the Sidebar

Edit `src/components/Sidebar.tsx` to:
- Add new navigation items
- Change date formatting
- Modify sync behavior

## Testing

### Manual Testing Checklist

- [ ] Fetch papers for today
- [ ] View paper list
- [ ] Open PDF in system viewer
- [ ] Analyze a paper with Claude
- [ ] Generate daily review
- [ ] Modify settings and save
- [ ] Navigate between dates
- [ ] Build production app

### Python Scripts Testing

```bash
# Test fetch_papers.py
python3 scripts/fetch_papers.py \
  --config config.json \
  --output ./test_output \
  --date 2024-01-15

# Test parse_pdf.py
python3 scripts/parse_pdf.py --dir ./test_output
```

## Troubleshooting

### Build Errors

**Rust compilation error:**
- Check Rust version: `rustc --version`
- Update Rust: `rustup update`
- Clean build: `cd src-tauri && cargo clean`

**Frontend build error:**
- Check Node version: `node --version`
- Clear cache: `rm -rf node_modules && npm install`

### Runtime Errors

**"Failed to execute Python script":**
- Verify Python path: `which python3`
- Check script permissions: `chmod +x scripts/*.py`
- Test script manually

**"Claude CLI not found":**
- Verify installation: `which claude`
- Add to PATH if needed

## Release Process

1. Update version in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. Build release:
   ```bash
   npm run tauri build
   ```

3. Test the built application

4. Create git tag and release
