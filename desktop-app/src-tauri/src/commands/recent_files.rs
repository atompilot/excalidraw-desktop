use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub timestamp: u64,
}

#[tauri::command]
pub fn get_recent_files(db: State<Database>) -> Result<Vec<RecentFile>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT path, name, timestamp FROM recent_files ORDER BY timestamp DESC LIMIT 10")
        .map_err(|e| e.to_string())?;
    let files = stmt
        .query_map([], |row| {
            Ok(RecentFile {
                path: row.get(0)?,
                name: row.get(1)?,
                timestamp: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(files)
}

#[tauri::command]
pub fn add_recent_file(db: State<Database>, path: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    conn.execute(
        "INSERT OR REPLACE INTO recent_files (path, name, timestamp) VALUES (?1, ?2, ?3)",
        rusqlite::params![&path, &name, timestamp],
    )
    .map_err(|e| e.to_string())?;

    // Keep only 10 most recent entries
    conn.execute(
        "DELETE FROM recent_files WHERE path NOT IN (SELECT path FROM recent_files ORDER BY timestamp DESC LIMIT 10)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn clear_recent_files(db: State<Database>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM recent_files", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}
