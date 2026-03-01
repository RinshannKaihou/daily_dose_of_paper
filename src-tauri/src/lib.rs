pub mod commands;

pub use commands::*;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            fetch_papers,
            get_paper_dates,
            get_day_papers,
            get_paper_detail,
            analyze_paper,
            generate_daily_review,
            open_pdf,
            parse_pdfs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
