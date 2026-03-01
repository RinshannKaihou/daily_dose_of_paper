# Daily Dose of Paper

A desktop application that helps you stay up-to-date with the latest research papers on arXiv, powered by Claude AI for intelligent paper analysis and daily reviews.

**Version: 0.1.0**

## Features

- **Paper Discovery**: Search and download papers from arXiv based on configurable research interests
- **AI Analysis**: Leverage Claude CLI to analyze papers and generate structured reviews in Chinese
- **Daily Review (每日锐评)**: Comprehensive daily summaries with trending topics and recommendations
- **Local Storage**: All papers and analyses stored locally for offline access
- **Cross-Platform**: Built with Tauri for lightweight native performance (~10MB)

## Screenshots

*Screenshots will be added after first release*

## Installation

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Rust** (install via [rustup](https://rustup.rs/))
- **Claude Code CLI** (for paper analysis)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/daily-dose-of-paper.git
   cd daily-dose-of-paper
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Install Python dependencies:
   ```bash
   pip install -r scripts/requirements.txt
   ```

4. (Optional) Install Claude Code CLI for AI analysis:
   ```bash
   # Follow instructions at https://docs.anthropic.com/claude-code
   ```

### Development

Run the app in development mode:

```bash
npm run tauri dev
```

This will start both the Vite dev server and the Tauri backend.

### Production Build

Build the app for your current platform:

```bash
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Usage

### Initial Setup

1. Open the app and navigate to **Settings**
2. Configure your research interests (search queries):
   - Default: LLM observability, LLM training stability, LLM interpretability
   - Add/remove topics as needed
3. Select arXiv categories to filter (cs.CL, cs.LG, cs.AI, etc.)
4. Set maximum papers per day and date range

### Fetching Papers

1. Click **"Fetch Today's Papers"** in the sidebar
2. Wait for papers to be downloaded and parsed
3. Papers will appear in the main list

### Analyzing Papers

1. Click on a paper to view details
2. Click the **sparkle icon** or **"Analyze with Claude"** button
3. Claude will generate a structured analysis including:
   - 一句话总结 (One-line summary)
   - 核心贡献 (Key contributions)
   - 方法论 (Methodology)
   - 实验结果 (Experimental results)
   - 每日锐评 (Daily sharp review)
   - 推荐指数 (Rating)
   - 适合人群 (Target audience)

### Daily Review

1. Analyze several papers
2. Navigate to **Daily Review** in the sidebar
3. Click **"Generate Daily Review"**
4. Get a comprehensive summary including:
   - 今日概览 (Today's overview)
   - 热点趋势 (Hot trends)
   - 推荐必读 (Must read papers)
   - 方法论亮点 (Methodology highlights)
   - 行业影响 (Industry impact)
   - 明日关注 (Tomorrow's focus)

## Configuration

Configuration is stored in `~/Library/Application Support/com.dailydose.paper/config.json` on macOS.

Default configuration:

```json
{
  "search_queries": [
    "LLM observability",
    "LLM training stability",
    "LLM interpretability"
  ],
  "max_papers_per_day": 10,
  "date_range": "last7days",
  "categories": ["cs.CL", "cs.LG", "cs.AI"]
}
```

## Data Storage

Papers and analyses are stored in:
- **macOS**: `~/Library/Application Support/com.dailydose.paper/papers/`
- **Windows**: `%APPDATA%/com.dailydose.paper/papers/`
- **Linux**: `~/.config/com.dailydose.paper/papers/`

Structure:
```
papers/
└── YYYY-MM-DD/
    ├── pdfs/              # Downloaded PDFs
    │   └── {paper_id}.pdf
    ├── pdf_text/          # Extracted text
    │   └── {paper_id}.txt
    ├── analysis/          # Claude-generated analyses
    │   └── {paper_id}.md
    ├── metadata.json      # Paper metadata
    └── daily_review.md    # Daily review summary
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Tailwind CSS |
| Desktop Framework | Tauri 2.x (Rust) |
| Paper Scripts | Python 3.10+ (arxiv, PyPDF2) |
| LLM Backend | Claude Code CLI |
| Storage | Local filesystem (JSON + Markdown) |

## Project Structure

```
daily_dose_of_paper/
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── commands.rs          # Tauri IPC commands
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                          # React frontend
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # Entry point
│   ├── components/
│   │   ├── Sidebar.tsx          # Left sidebar with dates
│   │   ├── PaperList.tsx        # Paper list view
│   │   ├── PaperDetail.tsx      # Single paper view
│   │   ├── DailyReview.tsx      # 每日锐评 view
│   │   └── Settings.tsx         # Config settings
│   ├── hooks/
│   │   ├── usePapers.ts         # Paper data hook
│   │   └── useConfig.ts         # Config hook
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   └── utils/
│       └── api.ts               # Tauri invoke wrappers
│
├── scripts/                      # Python scripts
│   ├── fetch_papers.py          # Arxiv search & download
│   ├── parse_pdf.py             # PDF text extraction
│   └── requirements.txt
│
├── config.json                   # Default configuration
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Troubleshooting

### "No papers for this date" after clicking "Fetch Today's Papers"
This happens when all papers matching your search queries have already been fetched. The app tracks seen papers globally to avoid duplicates.

**Solutions:**
- Click on a previous date in the sidebar to view already-fetched papers
- Modify your search queries in Settings to find different papers
- Add more arXiv categories to expand your search scope
- Wait for new papers to be published on arXiv (submissions are typically daily)

### Papers show wrong date (timezone issue)
The app uses your local timezone for date display. If you're in a timezone significantly different from UTC (e.g., UTC+8), papers fetched late at night might appear on the previous day.

### "Failed to execute fetch script"
- Ensure Python 3 is installed and accessible via `python3`
- Install required packages: `pip install -r scripts/requirements.txt`

### "Failed to execute Claude CLI"
- Install Claude Code CLI following official documentation
- Ensure `claude` command is available in your PATH

### PDFs not parsing correctly
- Some PDFs may have complex formatting that PyPDF2 cannot extract properly
- Try opening the PDF directly using the "Open PDF" button

### Empty metadata.json after fetch
This was a bug in versions before 0.1.0. If you encounter this, your PDFs may still exist but metadata is lost. You can manually recover by:
1. Checking the `pdfs/` folder for existing PDFs
2. Re-fetching papers (they will be treated as new since metadata is empty)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [arxiv.py](https://github.com/lukasschwab/arxiv.py) - Python wrapper for arXiv API
- [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop apps
- [Claude](https://www.anthropic.com/claude) - AI assistant for paper analysis
