use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SessionState {
    pub last_file_path: Option<String>,
}

#[tauri::command]
pub fn get_session_state(db: State<Database>) -> Result<SessionState, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let last_file_path: Option<String> = conn
        .query_row(
            "SELECT value FROM session_state WHERE key = ?1",
            rusqlite::params!["last_file_path"],
            |row| row.get(0),
        )
        .ok();
    Ok(SessionState { last_file_path })
}

#[tauri::command]
pub fn set_session_state(db: State<Database>, state: SessionState) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref path) = state.last_file_path {
        conn.execute(
            "INSERT OR REPLACE INTO session_state (key, value, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))",
            rusqlite::params!["last_file_path", path],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "DELETE FROM session_state WHERE key = ?1",
            rusqlite::params!["last_file_path"],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
