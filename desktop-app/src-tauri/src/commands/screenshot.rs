use std::process::Command;

/// Capture an interactive screenshot on macOS using the built-in `screencapture` tool.
/// Returns the path to the saved PNG file.
#[tauri::command]
pub fn capture_interactive(output_path: String) -> Result<String, String> {
    // -i  : interactive (user selects region)
    // -x  : no sound
    let status = Command::new("screencapture")
        .args(["-i", "-x", &output_path])
        .status()
        .map_err(|e| format!("Failed to run screencapture: {e}"))?;

    if status.success() {
        // Check if file actually exists (user might have cancelled with Esc)
        if std::path::Path::new(&output_path).exists() {
            Ok(output_path)
        } else {
            Err("Screenshot cancelled by user".to_string())
        }
    } else {
        Err(format!(
            "screencapture exited with code: {:?}",
            status.code()
        ))
    }
}
