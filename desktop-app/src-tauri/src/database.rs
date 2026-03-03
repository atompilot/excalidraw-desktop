use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database(pub Mutex<Connection>);

impl Database {
    pub fn new(old_data_dir: Option<PathBuf>) -> Result<Self, String> {
        let db_dir = dirs::home_dir()
            .ok_or("Cannot determine home directory")?
            .join(".excalidraw");
        fs::create_dir_all(&db_dir).map_err(|e| format!("Failed to create db dir: {e}"))?;

        let db_path = db_dir.join("excalidraw.db");
        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {e}"))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS session_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );
            CREATE TABLE IF NOT EXISTS recent_files (
                path TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );",
        )
        .map_err(|e| format!("Failed to create tables: {e}"))?;

        let db = Self(Mutex::new(conn));

        // Migrate old JSON data if present
        if let Some(old_dir) = old_data_dir {
            db.migrate_old_data(&old_dir);
        }

        Ok(db)
    }

    fn migrate_old_data(&self, old_dir: &PathBuf) {
        self.migrate_session_state(old_dir);
        self.migrate_recent_files(old_dir);
    }

    fn migrate_session_state(&self, old_dir: &PathBuf) {
        let path = old_dir.join("session-state.json");
        if !path.exists() {
            return;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            return;
        };
        let Ok(state) = serde_json::from_str::<serde_json::Value>(&content) else {
            return;
        };

        let conn = self.0.lock().unwrap();
        if let Some(last_file_path) = state.get("last_file_path").and_then(|v| v.as_str()) {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO session_state (key, value, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))",
                rusqlite::params![&"last_file_path", last_file_path],
            );
        }
        drop(conn);

        let _ = fs::remove_file(&path);
    }

    fn migrate_recent_files(&self, old_dir: &PathBuf) {
        let path = old_dir.join("recent-files.json");
        if !path.exists() {
            return;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            return;
        };

        #[derive(serde::Deserialize)]
        struct OldRecentFile {
            path: String,
            name: String,
            timestamp: u64,
        }

        let Ok(files) = serde_json::from_str::<Vec<OldRecentFile>>(&content) else {
            return;
        };

        let conn = self.0.lock().unwrap();
        for f in &files {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO recent_files (path, name, timestamp) VALUES (?1, ?2, ?3)",
                rusqlite::params![&f.path, &f.name, f.timestamp],
            );
        }
        drop(conn);

        let _ = fs::remove_file(&path);
    }
}
