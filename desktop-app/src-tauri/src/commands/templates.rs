use crate::database::Database;
use tauri::State;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CustomTemplate {
    pub id: String,
    pub name: String,
    pub category: String,
    pub data: String, // JSON-serialized element array
    pub created_at: i64,
}

#[tauri::command]
pub fn save_custom_template(
    id: String,
    name: String,
    category: String,
    data: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO custom_templates (id, name, category, data, created_at) VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))",
        rusqlite::params![id, name, category, data],
    )
    .map_err(|e| format!("Failed to save template: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_custom_templates(db: State<'_, Database>) -> Result<Vec<CustomTemplate>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, category, data, created_at FROM custom_templates ORDER BY created_at DESC")
        .map_err(|e| format!("Failed to query templates: {e}"))?;

    let templates = stmt
        .query_map([], |row| {
            Ok(CustomTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                data: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to read templates: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect templates: {e}"))?;

    Ok(templates)
}

#[tauri::command]
pub fn delete_custom_template(id: String, db: State<'_, Database>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM custom_templates WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Failed to delete template: {e}"))?;
    Ok(())
}
