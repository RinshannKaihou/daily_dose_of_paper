pub mod commands;

pub use commands::*;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
            delete_daily_paper,
            // Project management
            get_projects,
            create_project,
            rename_project,
            delete_project,
            add_paper_to_project,
            remove_paper_from_project,
            get_project_papers,
            analyze_project,
            get_project_analysis,
            // Paper import
            import_paper,
            get_all_papers,
            get_imported_papers,
            delete_imported_paper,
            scan_my_papers_dir,
            // Imported paper detail & analysis
            get_imported_paper_detail,
            analyze_unified_paper,
            analyze_imported_paper,
            open_imported_pdf,
            show_imported_pdf_in_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
