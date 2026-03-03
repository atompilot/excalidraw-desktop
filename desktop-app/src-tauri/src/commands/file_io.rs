use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize)]
pub struct FileData {
    pub path: String,
    pub content: String,
    pub name: String,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FileData, String> {
    let file_path = PathBuf::from(&path);
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let name = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();
    Ok(FileData {
        path,
        content,
        name,
    })
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_auto_save_path(app_handle: AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let autosave_dir = app_data_dir.join("autosave");
    fs::create_dir_all(&autosave_dir).map_err(|e| e.to_string())?;
    let autosave_path = autosave_dir.join("autosave.excalidraw");
    Ok(autosave_path.to_string_lossy().to_string())
}
