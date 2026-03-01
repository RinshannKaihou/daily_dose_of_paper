use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub search_queries: Vec<String>,
    pub max_papers_per_day: u32,
    pub date_range: String,
    pub categories: Vec<String>,
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
            categories: vec!["cs.CL".to_string(), "cs.LG".to_string(), "cs.AI".to_string()],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub summary: String,
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

fn get_app_dir(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
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
    app.path().resource_dir()
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
        let config: Config = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))?;
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
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn fetch_papers(app: tauri::AppHandle, date: Option<String>) -> Result<String, String> {
    let _config = get_config(app.clone()).await?;
    let scripts_dir = get_scripts_dir(&app);
    let papers_dir = get_papers_dir(&app);
    let config_path = get_config_path(&app);

    let target_date = date.unwrap_or_else(|| {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    });

    let output_dir = papers_dir.join(&target_date);
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output dir: {}", e))?;

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
        eprintln!("Warning: PDF parsing failed: {}", String::from_utf8_lossy(&parse_output.stderr));
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
    for entry in fs::read_dir(&papers_dir)
        .map_err(|e| format!("Failed to read papers dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
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
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse metadata: {}", e))?
    } else {
        vec![]
    };

    // Check for analysis files and update analysis_path for each paper
    let analysis_dir = day_dir.join("analysis");
    for paper in &mut papers {
        let analysis_file = analysis_dir.join(format!("{}.md", paper.id));
        if analysis_file.exists() {
            paper.analysis_path = Some(analysis_file.to_string_lossy().to_string());
        }
    }

    // Check for daily review
    let daily_review_path = day_dir.join("daily_review.md");
    let daily_review = if daily_review_path.exists() {
        Some(fs::read_to_string(&daily_review_path)
            .map_err(|e| format!("Failed to read daily review: {}", e))?)
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
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse metadata: {}", e))?
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
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse metadata: {}", e))?
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
        fs::read_to_string(&pdf_text_path)
            .map_err(|e| format!("Failed to read PDF text: {}", e))?
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
        paper.title, paper.authors.join(", "), pdf_text
    );

    let prompt_path = analysis_dir.join(format!("{}_prompt.txt", paper_id));
    fs::write(&prompt_path, &prompt)
        .map_err(|e| format!("Failed to write prompt: {}", e))?;

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
        .map_err(|e| format!("Failed to execute Claude CLI: {}. Make sure Claude Code CLI is installed.", e))?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child.wait_with_output()
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
pub async fn generate_daily_review(
    app: tauri::AppHandle,
    date: String,
) -> Result<String, String> {
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
    fs::write(&prompt_path, &prompt)
        .map_err(|e| format!("Failed to write prompt: {}", e))?;

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
        stdin.write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for Claude CLI: {}", e))?;

    if output.status.success() {
        let review = String::from_utf8_lossy(&output.stdout).to_string();
        let review_path = day_dir.join("daily_review.md");
        fs::write(&review_path, &review)
            .map_err(|e| format!("Failed to write review: {}", e))?;
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
    let pdf_path = papers_dir.join(&date).join("pdfs").join(format!("{}.pdf", paper_id));

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
