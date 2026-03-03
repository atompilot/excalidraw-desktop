use std::io::Write;
use std::process::Command;

/// Write text to the system clipboard using macOS `pbcopy`.
#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    let mut child = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run pbcopy: {e}"))?;

    child
        .stdin
        .take()
        .ok_or("Failed to open pbcopy stdin")?
        .write_all(text.as_bytes())
        .map_err(|e| format!("Failed to write to pbcopy: {e}"))?;

    child.wait().map_err(|e| format!("pbcopy failed: {e}"))?;
    Ok(())
}
