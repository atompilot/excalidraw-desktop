mod commands;
mod database;
mod mcp_http;

use commands::clipboard::copy_to_clipboard;
use commands::file_io::{get_auto_save_path, read_file, write_file};
use commands::recent_files::{add_recent_file, clear_recent_files, get_recent_files};
use commands::screenshot::capture_interactive;
use commands::session_state::{get_session_state, set_session_state};
use commands::templates::{delete_custom_template, get_custom_templates, save_custom_template};
use database::Database;
use mcp_http::{mcp_export_complete, mcp_set_current_file, write_binary_file, McpState};
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // When a second instance is launched (e.g. double-clicking a file while app is running),
            // emit the file path to the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                // argv[1] is typically the file path passed via file association
                if argv.len() > 1 {
                    let _ = window.emit("open-file", &argv[1]);
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            get_auto_save_path,
            get_recent_files,
            add_recent_file,
            clear_recent_files,
            mcp_export_complete,
            write_binary_file,
            mcp_set_current_file,
            get_session_state,
            set_session_state,
            capture_interactive,
            save_custom_template,
            get_custom_templates,
            delete_custom_template,
            copy_to_clipboard,
        ])
        .setup(|app| {
            // Initialize SQLite database
            let old_data_dir = app.path().app_data_dir().ok();
            let db = Database::new(old_data_dir)
                .expect("Failed to initialize database");
            app.manage(db);

            // Initialize MCP state
            let mcp_state = Arc::new(McpState::new());
            app.manage(mcp_state.clone());

            // Start MCP HTTP server
            let app_handle = app.handle().clone();
            mcp_http::start_mcp_server(app_handle.clone(), mcp_state);

            // Check if a file was passed as argument (file association)
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = args[1].clone();
                let window = app.get_webview_window("main").unwrap();
                // Emit after a short delay to ensure frontend is ready
                let window_clone = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = window_clone.emit("open-file", &file_path);
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
