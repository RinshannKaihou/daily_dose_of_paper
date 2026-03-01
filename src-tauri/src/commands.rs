use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub search_queries: Vec<String>,
    pub max_papers_per_day: u32,
    pub date_range: String,
    pub categories: Vec<String>,
    pub my_papers_dir: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            search_queries: vec![
                "LLM observability".to_string(),
                "LLM training stability".to_string(),
                "LLM interpretability".to_string(),
            ],
            max_papers_per_day: 10,
            date_range: "last7days".to_string(),
            categories: vec![
                "cs.CL".to_string(),
                "cs.LG".to_string(),
                "cs.AI".to_string(),
            ],
            my_papers_dir: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub summary: String,
    pub one_line_summary: Option<String>,
    pub published: String,
    pub arxiv_url: String,
    pub pdf_path: Option<String>,
    pub analysis_path: Option<String>,
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayPapers {
    pub date: String,
    pub papers: Vec<Paper>,
    pub daily_review: Option<String>,
}

fn normalize_heading_marker(line: &str) -> String {
    line.chars()
        .filter(|c| !c.is_whitespace() && !matches!(c, '*' | '#' | '`' | '_' | '-'))
        .collect()
}

fn trim_summary_candidate(line: &str) -> String {
    let mut candidate = line.trim();
    candidate = candidate.trim_start_matches(['-', '*', '>', ' ']);

    if let Some((prefix, rest)) = candidate.split_once(". ") {
        if prefix.chars().all(|c| c.is_ascii_digit()) {
            candidate = rest;
        }
    }

    candidate
        .trim()
        .trim_matches('*')
        .trim_matches('_')
        .trim()
        .to_string()
}

fn extract_one_line_summary(analysis: &str) -> Option<String> {
    let lines: Vec<&str> = analysis.lines().collect();

    for (idx, line) in lines.iter().enumerate() {
        if !line.contains("一句话总结") {
            continue;
        }

        if let Some(pos) = line.find("一句话总结") {
            let inline = trim_summary_candidate(
                line[pos + "一句话总结".len()..]
                    .trim()
                    .trim_start_matches([':', '：', '-', '—', '|']),
            );
            if !inline.is_empty() {
                return Some(inline);
            }
        }

        for next_line in lines.iter().skip(idx + 1) {
            let trimmed = next_line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let normalized = normalize_heading_marker(trimmed);
            if normalized.contains("核心贡献")
                || normalized.contains("方法论")
                || normalized.contains("实验结果")
                || normalized.contains("每日锐评")
                || normalized.contains("推荐指数")
                || normalized.contains("适合人群")
                || normalized.contains("一句话总结")
            {
                break;
            }

            let candidate = trim_summary_candidate(trimmed);
            if !candidate.is_empty() {
                return Some(candidate);
            }
        }
    }

    None
}

fn read_one_line_summary_from_analysis_path(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .and_then(|analysis| extract_one_line_summary(&analysis))
}

fn get_app_dir(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    }
    app_dir
}

fn get_config_path(app: &tauri::AppHandle) -> PathBuf {
    get_app_dir(app).join("config.json")
}

fn get_papers_dir(app: &tauri::AppHandle) -> PathBuf {
    let papers_dir = get_app_dir(app).join("papers");
    if !papers_dir.exists() {
        fs::create_dir_all(&papers_dir).expect("Failed to create papers dir");
    }
    papers_dir
}

fn get_scripts_dir(app: &tauri::AppHandle) -> PathBuf {
    // Get the resource directory for scripts
    // In Tauri 2.0, bundled resources are placed in _up_ folder
    app.path()
        .resource_dir()
        .expect("Failed to get resource dir")
        .join("_up_")
        .join("scripts")
}

#[tauri::command]
pub async fn get_config(app: tauri::AppHandle) -> Result<Config, String> {
    let config_path = get_config_path(&app);

    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        let config: Config =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;
        Ok(config)
    } else {
        let default_config = Config::default();
        save_config_inner(&app, &default_config)?;
        Ok(default_config)
    }
}

#[tauri::command]
pub async fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    save_config_inner(&app, &config)
}

fn save_config_inner(app: &tauri::AppHandle, config: &Config) -> Result<(), String> {
    let config_path = get_config_path(app);
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn fetch_papers(app: tauri::AppHandle, date: Option<String>) -> Result<String, String> {
    let _config = get_config(app.clone()).await?;
    let scripts_dir = get_scripts_dir(&app);
    let papers_dir = get_papers_dir(&app);
    let config_path = get_config_path(&app);

    let target_date = date.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let output_dir = papers_dir.join(&target_date);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Failed to create output dir: {}", e))?;

    let fetch_script = scripts_dir.join("fetch_papers.py");

    // Run fetch script
    let fetch_output = Command::new("python3")
        .arg(&fetch_script)
        .arg("--config")
        .arg(&config_path)
        .arg("--output")
        .arg(&output_dir)
        .arg("--papers-dir")
        .arg(&papers_dir)
        .arg("--date")
        .arg(&target_date)
        .output()
        .map_err(|e| format!("Failed to execute fetch script: {}", e))?;

    if !fetch_output.status.success() {
        return Err(String::from_utf8_lossy(&fetch_output.stderr).to_string());
    }

    // Run parse script to extract text from PDFs
    let parse_script = scripts_dir.join("parse_pdf.py");
    let parse_output = Command::new("python3")
        .arg(&parse_script)
        .arg("--dir")
        .arg(&output_dir)
        .output()
        .map_err(|e| format!("Failed to execute parse script: {}", e))?;

    if !parse_output.status.success() {
        // Log warning but don't fail - papers are still fetched
        eprintln!(
            "Warning: PDF parsing failed: {}",
            String::from_utf8_lossy(&parse_output.stderr)
        );
    }

    Ok(format!(
        "Fetch: {}\nParse: {}",
        String::from_utf8_lossy(&fetch_output.stdout),
        String::from_utf8_lossy(&parse_output.stdout)
    ))
}

#[tauri::command]
pub async fn get_paper_dates(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let papers_dir = get_papers_dir(&app);

    if !papers_dir.exists() {
        return Ok(vec![]);
    }

    let mut dates = vec![];
    for entry in
        fs::read_dir(&papers_dir).map_err(|e| format!("Failed to read papers dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                // Skip non-date directories like 'projects'
                if name == "projects" {
                    continue;
                }
                dates.push(name.to_string());
            }
        }
    }

    dates.sort();
    dates.reverse();
    Ok(dates)
}

#[tauri::command]
pub async fn get_day_papers(app: tauri::AppHandle, date: String) -> Result<DayPapers, String> {
    let papers_dir = get_papers_dir(&app);
    let day_dir = papers_dir.join(&date);

    if !day_dir.exists() {
        return Ok(DayPapers {
            date,
            papers: vec![],
            daily_review: None,
        });
    }

    // Read metadata.json
    let metadata_path = day_dir.join("metadata.json");
    let mut papers: Vec<Paper> = if metadata_path.exists() {
        let content = fs::read_to_string(&metadata_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse metadata: {}", e))?
    } else {
        vec![]
    };

    // Check for analysis files and update analysis_path for each paper
    let analysis_dir = day_dir.join("analysis");
    for paper in &mut papers {
        let analysis_file = analysis_dir.join(format!("{}.md", paper.id));
        if analysis_file.exists() {
            paper.analysis_path = Some(analysis_file.to_string_lossy().to_string());
            paper.one_line_summary = read_one_line_summary_from_analysis_path(&analysis_file);
        } else {
            paper.analysis_path = None;
            paper.one_line_summary = None;
        }
    }

    // Check for daily review
    let daily_review_path = day_dir.join("daily_review.md");
    let daily_review = if daily_review_path.exists() {
        Some(
            fs::read_to_string(&daily_review_path)
                .map_err(|e| format!("Failed to read daily review: {}", e))?,
        )
    } else {
        None
    };

    Ok(DayPapers {
        date,
        papers,
        daily_review,
    })
}

#[tauri::command]
pub async fn get_paper_detail(
    app: tauri::AppHandle,
    date: String,
    paper_id: String,
) -> Result<HashMap<String, String>, String> {
    let papers_dir = get_papers_dir(&app);
    let day_dir = papers_dir.join(&date);

    // Read metadata to find the paper
    let metadata_path = day_dir.join("metadata.json");
    let papers: Vec<Paper> = if metadata_path.exists() {
        let content = fs::read_to_string(&metadata_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse metadata: {}", e))?
    } else {
        return Err("No papers found for this date".to_string());
    };

    let paper = papers
        .iter()
        .find(|p| p.id == paper_id)
        .ok_or_else(|| "Paper not found".to_string())?;

    let mut result = HashMap::new();
    result.insert("title".to_string(), paper.title.clone());
    result.insert("authors".to_string(), paper.authors.join(", "));
    result.insert("summary".to_string(), paper.summary.clone());
    result.insert("published".to_string(), paper.published.clone());
    result.insert("arxiv_url".to_string(), paper.arxiv_url.clone());

    // Read analysis if exists
    let analysis_path = day_dir.join("analysis").join(format!("{}.md", paper_id));
    if analysis_path.exists() {
        let analysis = fs::read_to_string(&analysis_path)
            .map_err(|e| format!("Failed to read analysis: {}", e))?;
        result.insert("analysis".to_string(), analysis);
    }

    // Read PDF text if exists
    let pdf_text_path = day_dir.join("pdf_text").join(format!("{}.txt", paper_id));
    if pdf_text_path.exists() {
        let text = fs::read_to_string(&pdf_text_path)
            .map_err(|e| format!("Failed to read PDF text: {}", e))?;
        result.insert("pdf_text".to_string(), text);
    }

    Ok(result)
}

#[tauri::command]
pub async fn analyze_paper(
    app: tauri::AppHandle,
    date: String,
    paper_id: String,
) -> Result<String, String> {
    let papers_dir = get_papers_dir(&app);
    let day_dir = papers_dir.join(&date);

    // Read metadata to find the paper
    let metadata_path = day_dir.join("metadata.json");
    let papers: Vec<Paper> = if metadata_path.exists() {
        let content = fs::read_to_string(&metadata_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse metadata: {}", e))?
    } else {
        return Err("No papers found for this date".to_string());
    };

    let paper = papers
        .iter()
        .find(|p| p.id == paper_id)
        .ok_or_else(|| "Paper not found".to_string())?;

    // Read PDF text
    let pdf_text_path = day_dir.join("pdf_text").join(format!("{}.txt", paper_id));
    let pdf_text = if pdf_text_path.exists() {
        fs::read_to_string(&pdf_text_path).map_err(|e| format!("Failed to read PDF text: {}", e))?
    } else {
        return Err("PDF text not found. Please parse PDF first.".to_string());
    };

    // Create analysis directory
    let analysis_dir = day_dir.join("analysis");
    fs::create_dir_all(&analysis_dir)
        .map_err(|e| format!("Failed to create analysis dir: {}", e))?;

    // Create prompt file
    let prompt = format!(
        r#"Analyze the following paper and provide a structured analysis in Chinese:

## Paper Information
Title: {}
Authors: {}

## Paper Content
{}

## Please provide:
1. **一句话总结** (One-line summary in 20-30 words)
2. **核心贡献** (Key contributions - 3-5 bullet points)
3. **方法论** (Methodology overview)
4. **实验结果** (Experimental results summary)
5. **每日锐评** (Daily sharp review - critical evaluation with personal insights)
6. **推荐指数** (Rating: 1-5 stars, with explanation)
7. **适合人群** (Target audience - who should read this paper)

Format the response in Markdown."#,
        paper.title,
        paper.authors.join(", "),
        pdf_text
    );

    let prompt_path = analysis_dir.join(format!("{}_prompt.txt", paper_id));
    fs::write(&prompt_path, &prompt).map_err(|e| format!("Failed to write prompt: {}", e))?;

    // Run Claude Code CLI
    let output_path = analysis_dir.join(format!("{}.md", paper_id));

    use std::io::Write;
    let mut child = Command::new("claude")
        .arg("--print")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .current_dir(&analysis_dir)
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to execute Claude CLI: {}. Make sure Claude Code CLI is installed.",
                e
            )
        })?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for Claude CLI: {}", e))?;

    if output.status.success() {
        let analysis = String::from_utf8_lossy(&output.stdout).to_string();
        fs::write(&output_path, &analysis)
            .map_err(|e| format!("Failed to write analysis: {}", e))?;
        Ok(analysis)
    } else {
        Err(format!(
            "Claude CLI failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
pub async fn generate_daily_review(app: tauri::AppHandle, date: String) -> Result<String, String> {
    let day_papers = get_day_papers(app.clone(), date.clone()).await?;

    if day_papers.papers.is_empty() {
        return Err("No papers found for this date".to_string());
    }

    // Collect all analyses
    let papers_dir = get_papers_dir(&app);
    let day_dir = papers_dir.join(&date);
    let analysis_dir = day_dir.join("analysis");

    let mut analyses = Vec::new();
    for paper in &day_papers.papers {
        let analysis_path = analysis_dir.join(format!("{}.md", paper.id));
        if analysis_path.exists() {
            let analysis = fs::read_to_string(&analysis_path)
                .map_err(|e| format!("Failed to read analysis: {}", e))?;
            analyses.push((paper.title.clone(), analysis));
        }
    }

    if analyses.is_empty() {
        return Err("No analyses found. Please analyze papers first.".to_string());
    }

    // Create prompt for daily review
    let analyses_text = analyses
        .iter()
        .map(|(title, analysis)| format!("## {}\n\n{}", title, analysis))
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    let prompt = format!(
        r#"Based on the following paper analyses from today, create a comprehensive daily review (每日锐评总结):

{}

## Please provide:
1. **今日概览** (Today's overview - brief summary of papers reviewed)
2. **热点趋势** (Hot trends - common themes and emerging directions)
3. **推荐必读** (Must read - top 2-3 papers with reasons)
4. **方法论亮点** (Methodology highlights - interesting approaches across papers)
5. **行业影响** (Industry impact - potential applications and implications)
6. **明日关注** (Tomorrow's focus - suggested follow-up topics)

Format the response in Markdown with engaging and insightful commentary."#,
        analyses_text
    );

    // Run Claude Code CLI
    let prompt_path = day_dir.join("daily_review_prompt.txt");
    fs::write(&prompt_path, &prompt).map_err(|e| format!("Failed to write prompt: {}", e))?;

    use std::io::Write;
    let mut child = Command::new("claude")
        .arg("--print")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .current_dir(&day_dir)
        .spawn()
        .map_err(|e| format!("Failed to execute Claude CLI: {}", e))?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for Claude CLI: {}", e))?;

    if output.status.success() {
        let review = String::from_utf8_lossy(&output.stdout).to_string();
        let review_path = day_dir.join("daily_review.md");
        fs::write(&review_path, &review).map_err(|e| format!("Failed to write review: {}", e))?;
        Ok(review)
    } else {
        Err(format!(
            "Claude CLI failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
pub async fn open_pdf(app: tauri::AppHandle, date: String, paper_id: String) -> Result<(), String> {
    let papers_dir = get_papers_dir(&app);
    let pdf_path = papers_dir
        .join(&date)
        .join("pdfs")
        .join(format!("{}.pdf", paper_id));

    if !pdf_path.exists() {
        return Err("PDF file not found".to_string());
    }

    // Open with default system PDF viewer
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&pdf_path)
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", &pdf_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&pdf_path)
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn parse_pdfs(app: tauri::AppHandle, date: String) -> Result<String, String> {
    let scripts_dir = get_scripts_dir(&app);
    let papers_dir = get_papers_dir(&app);
    let day_dir = papers_dir.join(&date);

    if !day_dir.exists() {
        return Err("No papers directory for this date".to_string());
    }

    let parse_script = scripts_dir.join("parse_pdf.py");
    let output = Command::new("python3")
        .arg(&parse_script)
        .arg("--dir")
        .arg(&day_dir)
        .output()
        .map_err(|e| format!("Failed to execute parse script: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// ==================== Project Management ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub paper_ids: Vec<String>,
    pub created_at: String,
    pub analysis_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedPaper {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub authors: Vec<String>,
    pub imported_at: String,
}

// ==================== Content Hash Registry ====================

/// Registry entry for tracking imported papers with content-based identity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRegistryEntry {
    pub uuid: String,
    pub content_hash: String,
    pub original_path: String,
    pub last_seen_path: String,
    pub last_verified: String,
}

/// Registry containing all imported paper identity mappings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ImportRegistry {
    pub entries: Vec<ImportRegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PdfExtractionResult {
    ok: bool,
    title: Option<String>,
    authors: Vec<String>,
    text: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanMyPapersResult {
    pub indexed: usize,
    pub updated: usize,
    pub skipped: usize,
    pub failed: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ScanRecordAction {
    Indexed,
    Updated,
    Skipped,
}

/// Calculate SHA-256 hash of file contents
fn calculate_file_hash(file_path: &str) -> Result<String, String> {
    let content =
        fs::read(file_path).map_err(|e| format!("Failed to read file for hashing: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(&content);
    let hash = hasher.finalize();
    Ok(format!("{:x}", hash))
}

/// Get the path to the imported registry file
fn get_import_registry_path(app: &tauri::AppHandle) -> PathBuf {
    get_projects_dir(app).join("imported_registry.json")
}

/// Load the import registry from disk
fn load_import_registry(app: &tauri::AppHandle) -> Result<ImportRegistry, String> {
    let path = get_import_registry_path(app);
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read import registry: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse import registry: {}", e))
    } else {
        Ok(ImportRegistry::default())
    }
}

/// Save the import registry to disk
fn save_import_registry(app: &tauri::AppHandle, registry: &ImportRegistry) -> Result<(), String> {
    let path = get_import_registry_path(app);
    let content = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("Failed to serialize import registry: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write import registry: {}", e))?;
    Ok(())
}

/// Find or create a UUID for a file based on content hash
/// Returns (uuid, is_new) where is_new indicates if this is a newly created entry
fn find_or_create_uuid_in_registry(
    registry: &mut ImportRegistry,
    file_path: &str,
    content_hash: String,
    preferred_uuid: Option<&str>,
    now: &str,
) -> (String, bool) {
    if let Some(preferred_uuid) = preferred_uuid {
        if let Some(idx) = registry
            .entries
            .iter()
            .position(|e| e.uuid == preferred_uuid)
        {
            registry.entries[idx].content_hash = content_hash;
            registry.entries[idx].last_seen_path = file_path.to_string();
            registry.entries[idx].last_verified = now.to_string();
            return (registry.entries[idx].uuid.clone(), false);
        }
    }

    // 1. Check if hash exists in registry (file was renamed/moved)
    if let Some(idx) = registry
        .entries
        .iter()
        .position(|e| e.content_hash == content_hash)
    {
        registry.entries[idx].last_seen_path = file_path.to_string();
        registry.entries[idx].last_verified = now.to_string();
        return (registry.entries[idx].uuid.clone(), false);
    }

    // 2. Check if path exists with different hash (file was modified/annotated)
    if let Some(idx) = registry
        .entries
        .iter()
        .position(|e| e.last_seen_path == file_path)
    {
        registry.entries[idx].content_hash = content_hash;
        registry.entries[idx].last_verified = now.to_string();
        return (registry.entries[idx].uuid.clone(), false);
    }

    // 3. Create new entry
    let new_uuid = Uuid::new_v4().to_string();
    registry.entries.push(ImportRegistryEntry {
        uuid: new_uuid.clone(),
        content_hash,
        original_path: file_path.to_string(),
        last_seen_path: file_path.to_string(),
        last_verified: now.to_string(),
    });
    (new_uuid, true)
}

fn find_or_create_uuid_for_file(
    app: &tauri::AppHandle,
    file_path: &str,
    preferred_uuid: Option<&str>,
) -> Result<(String, bool), String> {
    let content_hash = calculate_file_hash(file_path)?;
    let mut registry = load_import_registry(app)?;
    let now = chrono::Utc::now().to_rfc3339();
    let (uuid, is_new) = find_or_create_uuid_in_registry(
        &mut registry,
        file_path,
        content_hash,
        preferred_uuid,
        &now,
    );
    save_import_registry(app, &registry)?;
    Ok((uuid, is_new))
}

fn extract_pdf_info(
    app: &tauri::AppHandle,
    file_path: &str,
    include_text: bool,
) -> Result<PdfExtractionResult, String> {
    let script_path = get_scripts_dir(app).join("extract_pdf_info.py");
    let mut command = Command::new("python3");
    command.arg(&script_path).arg("--pdf").arg(file_path);
    if include_text {
        command.arg("--include-text");
    }

    let output = command
        .output()
        .map_err(|e| format!("Failed to run PDF extraction: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let parsed: PdfExtractionResult = serde_json::from_str(stdout.trim()).map_err(|e| {
        format!(
            "Failed to parse PDF extraction output: {} (stdout: {})",
            e, stdout
        )
    })?;

    if !output.status.success() || !parsed.ok {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let reason = parsed
            .error
            .clone()
            .unwrap_or_else(|| stderr.to_string())
            .trim()
            .to_string();
        return Err(format!("PDF extraction failed: {}", reason));
    }

    Ok(parsed)
}

/// Get the analyses directory for imported papers
fn get_imported_analyses_dir(app: &tauri::AppHandle) -> PathBuf {
    let analyses_dir = get_app_dir(app).join("analyses").join("imported");
    if !analyses_dir.exists() {
        fs::create_dir_all(&analyses_dir).expect("Failed to create imported analyses dir");
    }
    analyses_dir
}

fn extract_pdf_text(app: &tauri::AppHandle, file_path: &str) -> Result<String, String> {
    let result = extract_pdf_info(app, file_path, true)?;
    Ok(result.text.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectsData {
    pub projects: Vec<Project>,
    pub imported_papers: Vec<ImportedPaper>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedPaper {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub summary: String,
    pub one_line_summary: Option<String>,
    pub published: String,
    pub source: String,
    pub arxiv_url: Option<String>,
    pub pdf_path: Option<String>,
    pub analysis_path: Option<String>,
    pub categories: Vec<String>,
    pub file_path: Option<String>,
    pub imported_at: Option<String>,
    pub date_folder: Option<String>, // For arXiv papers: the fetch date folder name
}

fn get_projects_dir(app: &tauri::AppHandle) -> PathBuf {
    let projects_dir = get_papers_dir(app).join("projects");
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir).expect("Failed to create projects dir");
    }
    projects_dir
}

fn get_projects_data_path(app: &tauri::AppHandle) -> PathBuf {
    get_projects_dir(app).join("projects.json")
}

fn filename_title_from_path(file_path: &str) -> String {
    PathBuf::from(file_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Untitled".to_string())
}

fn is_legacy_fitz_error_title(title: &str) -> bool {
    title.trim() == "Error: No module named 'fitz'"
        || title.trim() == "Error: No module named \"fitz\""
}

fn resolve_imported_title(title: &str, file_path: &str) -> String {
    if is_legacy_fitz_error_title(title) || title.trim().is_empty() {
        filename_title_from_path(file_path)
    } else {
        title.to_string()
    }
}

fn repair_legacy_imported_titles(data: &mut ProjectsData) -> usize {
    let mut repaired = 0;
    for paper in &mut data.imported_papers {
        let fixed = resolve_imported_title(&paper.title, &paper.file_path);
        if fixed != paper.title {
            paper.title = fixed;
            repaired += 1;
        }
    }
    repaired
}

fn load_projects_data(app: &tauri::AppHandle) -> Result<ProjectsData, String> {
    let path = get_projects_data_path(app);
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read projects data: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse projects data: {}", e))
    } else {
        Ok(ProjectsData {
            projects: vec![],
            imported_papers: vec![],
        })
    }
}

fn save_projects_data(app: &tauri::AppHandle, data: &ProjectsData) -> Result<(), String> {
    let path = get_projects_data_path(app);
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize projects data: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write projects data: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_projects(app: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let data = load_projects_data(&app)?;
    Ok(data.projects)
}

#[tauri::command]
pub async fn create_project(app: tauri::AppHandle, name: String) -> Result<Project, String> {
    let mut data = load_projects_data(&app)?;

    let project = Project {
        id: Uuid::new_v4().to_string(),
        name,
        paper_ids: vec![],
        created_at: chrono::Utc::now().to_rfc3339(),
        analysis_path: None,
    };

    data.projects.push(project.clone());
    save_projects_data(&app, &data)?;

    Ok(project)
}

#[tauri::command]
pub async fn rename_project(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    let mut data = load_projects_data(&app)?;

    let project = data
        .projects
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "Project not found".to_string())?;

    project.name = name;
    save_projects_data(&app, &data)?;

    Ok(())
}

#[tauri::command]
pub async fn delete_project(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut data = load_projects_data(&app)?;

    let idx = data
        .projects
        .iter()
        .position(|p| p.id == id)
        .ok_or_else(|| "Project not found".to_string())?;

    data.projects.remove(idx);
    save_projects_data(&app, &data)?;

    // Optionally remove project analysis directory
    let project_dir = get_projects_dir(&app).join(&id);
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir)
            .map_err(|e| format!("Failed to remove project directory: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn add_paper_to_project(
    app: tauri::AppHandle,
    paper_id: String,
    project_id: String,
) -> Result<(), String> {
    let mut data = load_projects_data(&app)?;

    let project = data
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or_else(|| "Project not found".to_string())?;

    if !project.paper_ids.contains(&paper_id) {
        project.paper_ids.push(paper_id);
        save_projects_data(&app, &data)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn remove_paper_from_project(
    app: tauri::AppHandle,
    paper_id: String,
    project_id: String,
) -> Result<(), String> {
    let mut data = load_projects_data(&app)?;

    let project = data
        .projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or_else(|| "Project not found".to_string())?;

    project.paper_ids.retain(|id| id != &paper_id);
    save_projects_data(&app, &data)?;

    Ok(())
}

#[tauri::command]
pub async fn get_project_papers(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Vec<UnifiedPaper>, String> {
    let data = load_projects_data(&app)?;

    let project = data
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| "Project not found".to_string())?;

    let mut papers = Vec::new();
    let imported_analyses_dir = get_imported_analyses_dir(&app);

    for paper_id in &project.paper_ids {
        if paper_id.starts_with("arxiv:") {
            // Find arxiv paper from date folders
            if let Some(paper) = find_arxiv_paper(&app, paper_id)? {
                papers.push(paper);
            }
        } else {
            // Find imported paper
            if let Some(imported) = data.imported_papers.iter().find(|p| &p.id == paper_id) {
                let analysis_path = imported_analyses_dir.join(format!("{}.md", imported.id));
                let analysis_path_str = if analysis_path.exists() {
                    Some(analysis_path.to_string_lossy().to_string())
                } else {
                    None
                };
                papers.push(UnifiedPaper {
                    id: imported.id.clone(),
                    title: imported.title.clone(),
                    authors: imported.authors.clone(),
                    summary: String::new(),
                    one_line_summary: read_one_line_summary_from_analysis_path(&analysis_path),
                    published: imported.imported_at.clone(),
                    source: "imported".to_string(),
                    arxiv_url: None,
                    pdf_path: Some(imported.file_path.clone()),
                    analysis_path: analysis_path_str,
                    categories: vec![],
                    file_path: Some(imported.file_path.clone()),
                    imported_at: Some(imported.imported_at.clone()),
                    date_folder: None,
                });
            }
        }
    }

    Ok(papers)
}

fn find_arxiv_paper(
    app: &tauri::AppHandle,
    paper_id: &str,
) -> Result<Option<UnifiedPaper>, String> {
    let arxiv_id = paper_id.strip_prefix("arxiv:").unwrap_or(paper_id);
    let papers_dir = get_papers_dir(app);

    if !papers_dir.exists() {
        return Ok(None);
    }

    for entry in
        fs::read_dir(&papers_dir).map_err(|e| format!("Failed to read papers dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        if entry.path().is_dir() {
            let date_name = entry.file_name().to_string_lossy().to_string();
            // Skip projects directory
            if date_name == "projects" {
                continue;
            }

            let day_dir = entry.path();
            let metadata_path = day_dir.join("metadata.json");

            if metadata_path.exists() {
                let content = fs::read_to_string(&metadata_path)
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;
                let papers: Vec<Paper> = serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;

                if let Some(paper) = papers.iter().find(|p| p.id == arxiv_id) {
                    let analysis_dir = day_dir.join("analysis");
                    let analysis_path = if analysis_dir.join(format!("{}.md", paper.id)).exists() {
                        let analysis_file = analysis_dir.join(format!("{}.md", paper.id));
                        Some(analysis_file.to_string_lossy().to_string())
                    } else {
                        None
                    };

                    let one_line_summary = analysis_path
                        .as_ref()
                        .and_then(|path| read_one_line_summary_from_analysis_path(Path::new(path)));

                    return Ok(Some(UnifiedPaper {
                        id: format!("arxiv:{}", paper.id),
                        title: paper.title.clone(),
                        authors: paper.authors.clone(),
                        summary: paper.summary.clone(),
                        one_line_summary,
                        published: paper.published.clone(),
                        source: "arxiv".to_string(),
                        arxiv_url: Some(paper.arxiv_url.clone()),
                        pdf_path: paper.pdf_path.clone(),
                        analysis_path,
                        categories: paper.categories.clone(),
                        file_path: None,
                        imported_at: None,
                        date_folder: Some(date_name.clone()),
                    }));
                }
            }
        }
    }

    Ok(None)
}

// ==================== Paper Import ====================

#[tauri::command]
pub async fn import_paper(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<ImportedPaper, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if path.extension().map(|e| e != "pdf").unwrap_or(true) {
        return Err("Only PDF files are supported".to_string());
    }

    let mut data = load_projects_data(&app)?;

    // Check if already imported
    if data
        .imported_papers
        .iter()
        .any(|p| p.file_path == file_path)
    {
        return Err("Paper already imported".to_string());
    }

    let (paper_uuid, _) = find_or_create_uuid_for_file(&app, &file_path, None)?;
    if data.imported_papers.iter().any(|p| p.id == paper_uuid) {
        return Err("Paper already imported".to_string());
    }

    // Extract title from filename (basic extraction)
    let filename = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled Paper".to_string());

    // Try to extract metadata from PDF
    let (title, authors) = extract_pdf_metadata(&app, &file_path).unwrap_or((None, vec![]));

    let imported = ImportedPaper {
        id: paper_uuid,
        file_path: file_path.clone(),
        title: title.unwrap_or(filename),
        authors,
        imported_at: chrono::Utc::now().to_rfc3339(),
    };

    data.imported_papers.push(imported.clone());
    save_projects_data(&app, &data)?;

    Ok(imported)
}

fn extract_pdf_metadata(
    app: &tauri::AppHandle,
    file_path: &str,
) -> Result<(Option<String>, Vec<String>), String> {
    let result = extract_pdf_info(app, file_path, false)?;
    Ok((result.title, result.authors))
}

#[tauri::command]
pub async fn get_all_papers(app: tauri::AppHandle) -> Result<Vec<UnifiedPaper>, String> {
    let mut all_papers = Vec::new();
    let papers_dir = get_papers_dir(&app);
    let mut data = load_projects_data(&app)?;
    if repair_legacy_imported_titles(&mut data) > 0 {
        save_projects_data(&app, &data)?;
    }

    // Collect arxiv papers from date folders
    if papers_dir.exists() {
        for entry in
            fs::read_dir(&papers_dir).map_err(|e| format!("Failed to read papers dir: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            if entry.path().is_dir() {
                let date_name = entry.file_name().to_string_lossy().to_string();
                // Skip projects directory
                if date_name == "projects" {
                    continue;
                }

                let day_dir = entry.path();
                let metadata_path = day_dir.join("metadata.json");

                if metadata_path.exists() {
                    let content = fs::read_to_string(&metadata_path)
                        .map_err(|e| format!("Failed to read metadata: {}", e))?;
                    let papers: Vec<Paper> = serde_json::from_str(&content)
                        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

                    for paper in papers {
                        let analysis_dir = day_dir.join("analysis");
                        let analysis_file = analysis_dir.join(format!("{}.md", paper.id));
                        let analysis_path = if analysis_file.exists() {
                            Some(analysis_file.to_string_lossy().to_string())
                        } else {
                            None
                        };

                        let one_line_summary =
                            read_one_line_summary_from_analysis_path(&analysis_file);

                        all_papers.push(UnifiedPaper {
                            id: format!("arxiv:{}", paper.id),
                            title: paper.title,
                            authors: paper.authors,
                            summary: paper.summary,
                            one_line_summary,
                            published: paper.published,
                            source: "arxiv".to_string(),
                            arxiv_url: Some(paper.arxiv_url),
                            pdf_path: paper.pdf_path,
                            analysis_path,
                            categories: paper.categories,
                            file_path: None,
                            imported_at: None,
                            date_folder: Some(date_name.clone()),
                        });
                    }
                }
            }
        }
    }

    // Add all imported papers from the index (must be explicitly scanned first)
    for imported in &data.imported_papers {
        // Check if there's an analysis for this paper
        let analyses_dir = get_imported_analyses_dir(&app);
        let analysis_path = analyses_dir.join(format!("{}.md", imported.id));
        let analysis_path_str = if analysis_path.exists() {
            Some(analysis_path.to_string_lossy().to_string())
        } else {
            None
        };

        all_papers.push(UnifiedPaper {
            id: imported.id.clone(),
            title: resolve_imported_title(&imported.title, &imported.file_path),
            authors: imported.authors.clone(),
            summary: String::new(),
            one_line_summary: read_one_line_summary_from_analysis_path(&analysis_path),
            published: imported.imported_at.clone(),
            source: "imported".to_string(),
            arxiv_url: None,
            pdf_path: Some(imported.file_path.clone()),
            analysis_path: analysis_path_str,
            categories: vec![],
            file_path: Some(imported.file_path.clone()),
            imported_at: Some(imported.imported_at.clone()),
            date_folder: None,
        });
    }

    // Sort by date (newest first)
    all_papers.sort_by(|a, b| b.published.cmp(&a.published));

    Ok(all_papers)
}

#[tauri::command]
pub async fn get_imported_papers(app: tauri::AppHandle) -> Result<Vec<ImportedPaper>, String> {
    let mut data = load_projects_data(&app)?;
    if repair_legacy_imported_titles(&mut data) > 0 {
        save_projects_data(&app, &data)?;
    }
    Ok(data.imported_papers)
}

#[tauri::command]
pub async fn delete_imported_paper(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut data = load_projects_data(&app)?;

    let idx = data
        .imported_papers
        .iter()
        .position(|p| p.id == id)
        .ok_or_else(|| "Imported paper not found".to_string())?;

    data.imported_papers.remove(idx);

    // Remove from all projects
    for project in &mut data.projects {
        project.paper_ids.retain(|pid| pid != &id);
    }

    save_projects_data(&app, &data)?;

    Ok(())
}

// ==================== Project Analysis ====================

#[tauri::command]
pub async fn analyze_project(app: tauri::AppHandle, project_id: String) -> Result<String, String> {
    let data = load_projects_data(&app)?;

    let project = data
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| "Project not found".to_string())?;

    if project.paper_ids.is_empty() {
        return Err("No papers in project to analyze".to_string());
    }

    // Collect all paper analyses
    let mut analyses = Vec::new();
    let papers_dir = get_papers_dir(&app);
    let imported_analyses_dir = get_imported_analyses_dir(&app);

    for paper_id in &project.paper_ids {
        if paper_id.starts_with("arxiv:") {
            let arxiv_id = paper_id.strip_prefix("arxiv:").unwrap();

            // Find the paper in date folders
            for entry in fs::read_dir(&papers_dir)
                .map_err(|e| format!("Failed to read papers dir: {}", e))?
            {
                let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
                if entry.path().is_dir() {
                    let day_dir = entry.path();
                    let metadata_path = day_dir.join("metadata.json");

                    if metadata_path.exists() {
                        let content = fs::read_to_string(&metadata_path)
                            .map_err(|e| format!("Failed to read metadata: {}", e))?;
                        let papers: Vec<Paper> = serde_json::from_str(&content)
                            .map_err(|e| format!("Failed to parse metadata: {}", e))?;

                        if let Some(paper) = papers.iter().find(|p| p.id == arxiv_id) {
                            let analysis_path =
                                day_dir.join("analysis").join(format!("{}.md", arxiv_id));
                            if analysis_path.exists() {
                                let analysis = fs::read_to_string(&analysis_path)
                                    .map_err(|e| format!("Failed to read analysis: {}", e))?;
                                analyses.push((paper.title.clone(), analysis));
                            }
                            break;
                        }
                    }
                }
            }
        } else if let Some(imported) = data.imported_papers.iter().find(|p| p.id == *paper_id) {
            let analysis_path = imported_analyses_dir.join(format!("{}.md", paper_id));
            if analysis_path.exists() {
                let analysis = fs::read_to_string(&analysis_path)
                    .map_err(|e| format!("Failed to read imported analysis: {}", e))?;
                analyses.push((imported.title.clone(), analysis));
            }
        }
    }

    if analyses.is_empty() {
        return Err(
            "No analyses found for papers in this project. Please analyze papers first."
                .to_string(),
        );
    }

    // Create project directory
    let project_dir = get_projects_dir(&app).join(&project_id);
    fs::create_dir_all(&project_dir).map_err(|e| format!("Failed to create project dir: {}", e))?;

    // Create prompt for project analysis
    let analyses_text = analyses
        .iter()
        .map(|(title, analysis)| format!("## {}\n\n{}", title, analysis))
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    let prompt = format!(
        r#"Based on the following paper analyses from the project "{}", create a comprehensive project synthesis:

{}

## Please provide:
1. **项目概览** (Project overview - brief summary of papers in this project)
2. **核心主题** (Core themes - common themes and patterns across papers)
3. **方法论总结** (Methodology summary - key approaches and techniques)
4. **关键发现** (Key findings - important results and insights)
5. **研究趋势** (Research trends - emerging directions in this area)
6. **推荐阅读顺序** (Recommended reading order - which papers to read first and why)
7. **实践建议** (Practical recommendations - how to apply these findings)

Format the response in Markdown with engaging and insightful commentary in Chinese."#,
        project.name, analyses_text
    );

    // Run Claude Code CLI
    use std::io::Write;
    let mut child = Command::new("claude")
        .arg("--print")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .current_dir(&project_dir)
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to execute Claude CLI: {}. Make sure Claude Code CLI is installed.",
                e
            )
        })?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for Claude CLI: {}", e))?;

    if output.status.success() {
        let analysis = String::from_utf8_lossy(&output.stdout).to_string();
        let analysis_path = project_dir.join("analysis.md");
        fs::write(&analysis_path, &analysis)
            .map_err(|e| format!("Failed to write analysis: {}", e))?;

        // Update project with analysis path
        let mut data = load_projects_data(&app)?;
        if let Some(proj) = data.projects.iter_mut().find(|p| p.id == project_id) {
            proj.analysis_path = Some(analysis_path.to_string_lossy().to_string());
            save_projects_data(&app, &data)?;
        }

        Ok(analysis)
    } else {
        Err(format!(
            "Claude CLI failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
pub async fn get_project_analysis(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Option<String>, String> {
    let project_dir = get_projects_dir(&app).join(&project_id);
    let analysis_path = project_dir.join("analysis.md");

    if analysis_path.exists() {
        let content = fs::read_to_string(&analysis_path)
            .map_err(|e| format!("Failed to read analysis: {}", e))?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

// ==================== My Papers Directory ====================

fn replace_project_paper_id_references(data: &mut ProjectsData, old_id: &str, new_id: &str) {
    if old_id == new_id {
        return;
    }

    for project in &mut data.projects {
        for paper_id in &mut project.paper_ids {
            if paper_id == old_id {
                *paper_id = new_id.to_string();
            }
        }
        let mut seen = std::collections::HashSet::new();
        project
            .paper_ids
            .retain(|paper_id| seen.insert(paper_id.clone()));
    }
}

fn upsert_imported_paper(
    data: &mut ProjectsData,
    uuid: String,
    file_path: String,
    title: String,
    authors: Vec<String>,
) -> ScanRecordAction {
    if let Some(idx) = data.imported_papers.iter().position(|p| p.id == uuid) {
        let paper = &mut data.imported_papers[idx];
        let changed =
            paper.file_path != file_path || paper.title != title || paper.authors != authors;
        if changed {
            paper.file_path = file_path;
            paper.title = title;
            paper.authors = authors;
            return ScanRecordAction::Updated;
        }
        return ScanRecordAction::Skipped;
    }

    if let Some(idx) = data
        .imported_papers
        .iter()
        .position(|p| p.file_path == file_path)
    {
        let old_id = data.imported_papers[idx].id.clone();
        let paper = &mut data.imported_papers[idx];
        let changed = paper.id != uuid || paper.title != title || paper.authors != authors;
        paper.id = uuid.clone();
        paper.title = title;
        paper.authors = authors;
        replace_project_paper_id_references(data, &old_id, &uuid);
        return if changed {
            ScanRecordAction::Updated
        } else {
            ScanRecordAction::Skipped
        };
    }

    data.imported_papers.push(ImportedPaper {
        id: uuid,
        file_path,
        title,
        authors,
        imported_at: chrono::Utc::now().to_rfc3339(),
    });
    ScanRecordAction::Indexed
}

fn dedupe_imported_papers_by_uuid(data: &mut ProjectsData) -> usize {
    let mut seen = std::collections::HashSet::new();
    let original_len = data.imported_papers.len();
    data.imported_papers
        .retain(|paper| seen.insert(paper.id.clone()));
    original_len.saturating_sub(data.imported_papers.len())
}

fn backfill_import_registry(app: &tauri::AppHandle, data: &ProjectsData) -> Result<(), String> {
    let mut registry = load_import_registry(app)?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut changed = false;

    for paper in &data.imported_papers {
        let path = PathBuf::from(&paper.file_path);
        if !path.exists() {
            continue;
        }

        let content_hash = match calculate_file_hash(&paper.file_path) {
            Ok(hash) => hash,
            Err(_) => continue,
        };

        if let Some(idx) = registry
            .entries
            .iter()
            .position(|entry| entry.uuid == paper.id)
        {
            let entry = &mut registry.entries[idx];
            if entry.content_hash != content_hash || entry.last_seen_path != paper.file_path {
                entry.content_hash = content_hash;
                entry.last_seen_path = paper.file_path.clone();
                entry.last_verified = now.clone();
                changed = true;
            }
            if entry.original_path.is_empty() {
                entry.original_path = paper.file_path.clone();
                changed = true;
            }
            continue;
        }

        registry.entries.push(ImportRegistryEntry {
            uuid: paper.id.clone(),
            content_hash,
            original_path: paper.file_path.clone(),
            last_seen_path: paper.file_path.clone(),
            last_verified: now.clone(),
        });
        changed = true;
    }

    if changed {
        save_import_registry(app, &registry)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn scan_my_papers_dir(app: tauri::AppHandle) -> Result<ScanMyPapersResult, String> {
    let config = get_config(app.clone()).await?;

    let my_papers_dir = match &config.my_papers_dir {
        Some(dir) => dir,
        None => return Err("My papers directory not configured".to_string()),
    };

    let my_dir = PathBuf::from(my_papers_dir);
    if !my_dir.exists() || !my_dir.is_dir() {
        return Err(format!("Directory does not exist: {}", my_papers_dir));
    }

    let mut data = load_projects_data(&app)?;
    let mut result = ScanMyPapersResult::default();
    let mut data_changed = false;
    let repaired_titles = repair_legacy_imported_titles(&mut data);
    if repaired_titles > 0 {
        data_changed = true;
        result.warnings.push(format!(
            "Repaired {} legacy imported titles from previous fitz extraction errors.",
            repaired_titles
        ));
    }
    backfill_import_registry(&app, &data)?;

    let mut pdf_paths = Vec::new();
    for entry in fs::read_dir(&my_dir).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("pdf"))
            .unwrap_or(false)
        {
            pdf_paths.push(path);
        }
    }
    pdf_paths.sort();

    for path in pdf_paths {
        let file_path = path.to_string_lossy().to_string();
        let filename = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Untitled".to_string());
        let existing_uuid_hint = data
            .imported_papers
            .iter()
            .find(|paper| paper.file_path == file_path)
            .map(|paper| paper.id.clone());

        let (uuid, _) =
            match find_or_create_uuid_for_file(&app, &file_path, existing_uuid_hint.as_deref()) {
                Ok(value) => value,
                Err(err) => {
                    result.failed += 1;
                    result
                        .warnings
                        .push(format!("Failed to index '{}': {}", file_path, err));
                    continue;
                }
            };

        let (title, authors) = match extract_pdf_metadata(&app, &file_path) {
            Ok(value) => value,
            Err(err) => {
                result.warnings.push(format!(
                    "Metadata extraction failed for '{}': {}",
                    file_path, err
                ));
                (None, vec![])
            }
        };
        let resolved_title = title.unwrap_or(filename);

        match upsert_imported_paper(&mut data, uuid, file_path, resolved_title, authors) {
            ScanRecordAction::Indexed => {
                result.indexed += 1;
                data_changed = true;
            }
            ScanRecordAction::Updated => {
                result.updated += 1;
                data_changed = true;
            }
            ScanRecordAction::Skipped => {
                result.skipped += 1;
            }
        }
    }

    let deduped = dedupe_imported_papers_by_uuid(&mut data);
    if deduped > 0 {
        data_changed = true;
        result.warnings.push(format!(
            "Removed {} duplicate imported records during scan cleanup.",
            deduped
        ));
    }

    if data_changed {
        save_projects_data(&app, &data)?;
    }

    Ok(result)
}

#[tauri::command]
pub async fn select_folder() -> Result<Option<String>, String> {
    // Use tauri-plugin-dialog for folder selection
    // For now, return None - the frontend will use tauri-plugin-dialog directly
    Ok(None)
}

// ==================== Imported Paper Detail & Analysis ====================

/// Detail response for an imported paper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedPaperDetail {
    pub id: String,
    pub title: String,
    pub authors: String,
    pub file_path: String,
    pub imported_at: String,
    pub analysis: Option<String>,
    pub pdf_text: Option<String>,
}

/// Get detail for an imported paper including analysis and PDF text
#[tauri::command]
pub async fn get_imported_paper_detail(
    app: tauri::AppHandle,
    paper_id: String,
) -> Result<ImportedPaperDetail, String> {
    let mut data = load_projects_data(&app)?;
    if repair_legacy_imported_titles(&mut data) > 0 {
        save_projects_data(&app, &data)?;
    }

    // Find the paper in imported_papers
    let paper = data
        .imported_papers
        .iter()
        .find(|p| p.id == paper_id)
        .ok_or_else(|| "Imported paper not found".to_string())?;

    // Check for analysis file
    let analyses_dir = get_imported_analyses_dir(&app);
    let analysis_path = analyses_dir.join(format!("{}.md", paper_id));
    let analysis = if analysis_path.exists() {
        Some(
            fs::read_to_string(&analysis_path)
                .map_err(|e| format!("Failed to read analysis: {}", e))?,
        )
    } else {
        None
    };

    // Extract PDF text
    let pdf_path = PathBuf::from(&paper.file_path);
    let pdf_text = if pdf_path.exists() {
        extract_pdf_text(&app, &paper.file_path).ok()
    } else {
        None
    };

    Ok(ImportedPaperDetail {
        id: paper.id.clone(),
        title: resolve_imported_title(&paper.title, &paper.file_path),
        authors: paper.authors.join(", "),
        file_path: paper.file_path.clone(),
        imported_at: paper.imported_at.clone(),
        analysis,
        pdf_text,
    })
}

/// Analyze an imported paper with Claude
#[tauri::command]
pub async fn analyze_imported_paper(
    app: tauri::AppHandle,
    paper_id: String,
) -> Result<String, String> {
    let data = load_projects_data(&app)?;

    // Find the paper in imported_papers
    let paper = data
        .imported_papers
        .iter()
        .find(|p| p.id == paper_id)
        .ok_or_else(|| "Imported paper not found".to_string())?;

    // Extract PDF text
    let pdf_text = extract_pdf_text(&app, &paper.file_path)?;

    // Create analysis directory
    let analyses_dir = get_imported_analyses_dir(&app);

    // Create prompt file
    let prompt = format!(
        r#"Analyze the following paper and provide a structured analysis in Chinese:

## Paper Information
Title: {}
Authors: {}

## Paper Content
{}

## Please provide:
1. **一句话总结** (One-line summary in 20-30 words)
2. **核心贡献** (Key contributions - 3-5 bullet points)
3. **方法论** (Methodology overview)
4. **实验结果** (Experimental results summary)
5. **每日锐评** (Daily sharp review - critical evaluation with personal insights)
6. **推荐指数** (Rating: 1-5 stars, with explanation)
7. **适合人群** (Target audience - who should read this paper)

Format the response in Markdown."#,
        paper.title,
        paper.authors.join(", "),
        pdf_text
    );

    let prompt_path = analyses_dir.join(format!("{}_prompt.txt", paper_id));
    fs::write(&prompt_path, &prompt).map_err(|e| format!("Failed to write prompt: {}", e))?;

    // Run Claude Code CLI
    let output_path = analyses_dir.join(format!("{}.md", paper_id));

    use std::io::Write;
    let mut child = Command::new("claude")
        .arg("--print")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .current_dir(&analyses_dir)
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to execute Claude CLI: {}. Make sure Claude Code CLI is installed.",
                e
            )
        })?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for Claude CLI: {}", e))?;

    if output.status.success() {
        let analysis = String::from_utf8_lossy(&output.stdout).to_string();
        fs::write(&output_path, &analysis)
            .map_err(|e| format!("Failed to write analysis: {}", e))?;
        Ok(analysis)
    } else {
        Err(format!(
            "Claude CLI failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

/// Open an imported PDF in the system viewer
#[tauri::command]
pub async fn open_imported_pdf(app: tauri::AppHandle, paper_id: String) -> Result<(), String> {
    let data = load_projects_data(&app)?;

    // Find the paper in imported_papers
    let paper = data
        .imported_papers
        .iter()
        .find(|p| p.id == paper_id)
        .ok_or_else(|| "Imported paper not found".to_string())?;

    let pdf_path = PathBuf::from(&paper.file_path);

    if !pdf_path.exists() {
        return Err("PDF file not found".to_string());
    }

    // Open with default system PDF viewer
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&pdf_path)
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", &pdf_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&pdf_path)
            .spawn()
            .map_err(|e| format!("Failed to open PDF: {}", e))?;
    }

    Ok(())
}

/// Show an imported PDF in the system file manager
#[tauri::command]
pub async fn show_imported_pdf_in_folder(
    app: tauri::AppHandle,
    paper_id: String,
) -> Result<(), String> {
    let data = load_projects_data(&app)?;

    // Find the paper in imported_papers
    let paper = data
        .imported_papers
        .iter()
        .find(|p| p.id == paper_id)
        .ok_or_else(|| "Imported paper not found".to_string())?;

    let pdf_path = PathBuf::from(&paper.file_path);

    if !pdf_path.exists() {
        return Err("PDF file not found".to_string());
    }

    // Show in file manager
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&pdf_path)
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &pdf_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try to get the parent directory since xdg-open doesn't support selection
        let parent = pdf_path.parent().unwrap_or(&pdf_path);
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_project(id: &str, paper_ids: Vec<&str>) -> Project {
        Project {
            id: id.to_string(),
            name: "test".to_string(),
            paper_ids: paper_ids.into_iter().map(String::from).collect(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            analysis_path: None,
        }
    }

    fn test_imported_paper(id: &str, file_path: &str) -> ImportedPaper {
        ImportedPaper {
            id: id.to_string(),
            file_path: file_path.to_string(),
            title: "paper".to_string(),
            authors: vec!["author".to_string()],
            imported_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn registry_reuses_uuid_on_rename() {
        let mut registry = ImportRegistry::default();
        let now = "2026-01-01T00:00:00Z";
        let (uuid1, is_new1) = find_or_create_uuid_in_registry(
            &mut registry,
            "/tmp/a.pdf",
            "hash-a".to_string(),
            None,
            now,
        );
        let (uuid2, is_new2) = find_or_create_uuid_in_registry(
            &mut registry,
            "/tmp/b.pdf",
            "hash-a".to_string(),
            None,
            now,
        );

        assert!(is_new1);
        assert!(!is_new2);
        assert_eq!(uuid1, uuid2);
        assert_eq!(registry.entries.len(), 1);
        assert_eq!(registry.entries[0].last_seen_path, "/tmp/b.pdf");
    }

    #[test]
    fn registry_keeps_preferred_uuid_on_content_change() {
        let mut registry = ImportRegistry::default();
        let now = "2026-01-01T00:00:00Z";
        let (uuid, _) = find_or_create_uuid_in_registry(
            &mut registry,
            "/tmp/a.pdf",
            "hash-a".to_string(),
            None,
            now,
        );

        let (resolved, is_new) = find_or_create_uuid_in_registry(
            &mut registry,
            "/tmp/a.pdf",
            "hash-b".to_string(),
            Some(&uuid),
            "2026-01-02T00:00:00Z",
        );

        assert!(!is_new);
        assert_eq!(resolved, uuid);
        assert_eq!(registry.entries[0].content_hash, "hash-b");
    }

    #[test]
    fn upsert_updates_legacy_path_entry_and_project_references() {
        let mut data = ProjectsData {
            projects: vec![test_project("p1", vec!["legacy-id"])],
            imported_papers: vec![test_imported_paper("legacy-id", "/tmp/a.pdf")],
        };

        let action = upsert_imported_paper(
            &mut data,
            "stable-uuid".to_string(),
            "/tmp/a.pdf".to_string(),
            "new title".to_string(),
            vec!["new author".to_string()],
        );

        assert_eq!(action, ScanRecordAction::Updated);
        assert_eq!(data.imported_papers.len(), 1);
        assert_eq!(data.imported_papers[0].id, "stable-uuid");
        assert_eq!(data.projects[0].paper_ids, vec!["stable-uuid".to_string()]);
    }

    #[test]
    fn dedupe_imported_papers_removes_duplicate_ids() {
        let mut data = ProjectsData {
            projects: vec![],
            imported_papers: vec![
                test_imported_paper("same", "/tmp/a.pdf"),
                test_imported_paper("same", "/tmp/b.pdf"),
                test_imported_paper("other", "/tmp/c.pdf"),
            ],
        };

        let removed = dedupe_imported_papers_by_uuid(&mut data);
        assert_eq!(removed, 1);
        assert_eq!(data.imported_papers.len(), 2);
        assert_eq!(data.imported_papers[0].file_path, "/tmp/a.pdf");
    }

    #[test]
    fn repair_legacy_fitz_titles_uses_filename() {
        let mut data = ProjectsData {
            projects: vec![],
            imported_papers: vec![ImportedPaper {
                id: "id-1".to_string(),
                file_path: "/tmp/Example Paper.pdf".to_string(),
                title: "Error: No module named 'fitz'".to_string(),
                authors: vec![],
                imported_at: "2026-01-01T00:00:00Z".to_string(),
            }],
        };

        let repaired = repair_legacy_imported_titles(&mut data);
        assert_eq!(repaired, 1);
        assert_eq!(data.imported_papers[0].title, "Example Paper");
    }

    #[test]
    fn scan_result_counts_cover_indexed_updated_and_skipped() {
        let mut data = ProjectsData {
            projects: vec![],
            imported_papers: vec![],
        };
        let mut result = ScanMyPapersResult::default();

        match upsert_imported_paper(
            &mut data,
            "id-1".to_string(),
            "/tmp/a.pdf".to_string(),
            "title".to_string(),
            vec!["author".to_string()],
        ) {
            ScanRecordAction::Indexed => result.indexed += 1,
            ScanRecordAction::Updated => result.updated += 1,
            ScanRecordAction::Skipped => result.skipped += 1,
        }
        match upsert_imported_paper(
            &mut data,
            "id-1".to_string(),
            "/tmp/renamed.pdf".to_string(),
            "title".to_string(),
            vec!["author".to_string()],
        ) {
            ScanRecordAction::Indexed => result.indexed += 1,
            ScanRecordAction::Updated => result.updated += 1,
            ScanRecordAction::Skipped => result.skipped += 1,
        }
        match upsert_imported_paper(
            &mut data,
            "id-1".to_string(),
            "/tmp/renamed.pdf".to_string(),
            "title".to_string(),
            vec!["author".to_string()],
        ) {
            ScanRecordAction::Indexed => result.indexed += 1,
            ScanRecordAction::Updated => result.updated += 1,
            ScanRecordAction::Skipped => result.skipped += 1,
        }

        assert_eq!(result.indexed, 1);
        assert_eq!(result.updated, 1);
        assert_eq!(result.skipped, 1);
        assert_eq!(result.failed, 0);
    }
}
