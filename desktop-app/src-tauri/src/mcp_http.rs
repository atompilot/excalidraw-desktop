use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tiny_http::{Header, Response, Server};

const MCP_PORT: u16 = 21063;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub filepath: String,
    #[serde(default = "default_output_path")]
    pub output_path: String,
    #[serde(default = "default_true")]
    pub background: bool,
    #[serde(default = "default_scale")]
    pub scale: f64,
}

fn default_output_path() -> String {
    String::new()
}
fn default_true() -> bool {
    true
}
fn default_scale() -> f64 {
    2.0
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    pub success: bool,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub running: bool,
    pub current_file: Option<String>,
}

/// Shared state for MCP communication
pub struct McpState {
    /// Pending export responses keyed by request_id
    pub pending_exports: Mutex<HashMap<String, ExportResponse>>,
    /// Current file path
    pub current_file: Mutex<Option<String>>,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            pending_exports: Mutex::new(HashMap::new()),
            current_file: Mutex::new(None),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpExportEvent {
    pub request_id: String,
    pub filepath: String,
    pub output_path: String,
    pub background: bool,
    pub scale: f64,
}

/// Start the MCP HTTP server in a background thread
pub fn start_mcp_server(app_handle: AppHandle, state: Arc<McpState>) {
    std::thread::spawn(move || {
        let server = match Server::http(format!("127.0.0.1:{}", MCP_PORT)) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("MCP HTTP server failed to start on port {}: {}", MCP_PORT, e);
                eprintln!("Another instance may already be running.");
                return;
            }
        };

        eprintln!("MCP HTTP server listening on 127.0.0.1:{}", MCP_PORT);

        for mut request in server.incoming_requests() {
            let url = request.url().to_string();
            let method = request.method().to_string();

            match (method.as_str(), url.as_str()) {
                ("GET", "/status") => {
                    let current_file = state.current_file.lock().unwrap().clone();
                    let resp = StatusResponse {
                        running: true,
                        current_file,
                    };
                    let body = serde_json::to_string(&resp).unwrap_or_default();
                    let response = Response::from_string(body).with_header(
                        Header::from_bytes("Content-Type", "application/json").unwrap(),
                    );
                    let _ = request.respond(response);
                }

                ("POST", "/export") => {
                    // Read request body
                    let mut body = String::new();
                    if request.as_reader().read_to_string(&mut body).is_err() {
                        let response = Response::from_string("Failed to read request body")
                            .with_status_code(400);
                        let _ = request.respond(response);
                        continue;
                    }

                    let export_req: ExportRequest = match serde_json::from_str(&body) {
                        Ok(r) => r,
                        Err(e) => {
                            let response =
                                Response::from_string(format!("Invalid JSON: {}", e))
                                    .with_status_code(400);
                            let _ = request.respond(response);
                            continue;
                        }
                    };

                    // Generate request ID
                    let request_id = format!("export-{}", std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis());

                    // Emit event to webview
                    let event = McpExportEvent {
                        request_id: request_id.clone(),
                        filepath: export_req.filepath,
                        output_path: export_req.output_path,
                        background: export_req.background,
                        scale: export_req.scale,
                    };

                    if let Err(e) = app_handle.emit("mcp-export-request", event) {
                        let response = Response::from_string(format!("Failed to send to app: {}", e))
                            .with_status_code(500);
                        let _ = request.respond(response);
                        continue;
                    }

                    // Poll for response with timeout (30 seconds)
                    let mut result = None;
                    for _ in 0..300 {
                        std::thread::sleep(Duration::from_millis(100));
                        let mut pending = state.pending_exports.lock().unwrap();
                        if let Some(resp) = pending.remove(&request_id) {
                            result = Some(resp);
                            break;
                        }
                    }

                    match result {
                        Some(resp) => {
                            let status = if resp.success { 200 } else { 500 };
                            let body = serde_json::to_string(&resp).unwrap_or_default();
                            let response = Response::from_string(body)
                                .with_status_code(status)
                                .with_header(
                                    Header::from_bytes("Content-Type", "application/json")
                                        .unwrap(),
                                );
                            let _ = request.respond(response);
                        }
                        None => {
                            let response =
                                Response::from_string("Export timed out (30s)")
                                    .with_status_code(504);
                            let _ = request.respond(response);
                        }
                    }
                }

                _ => {
                    let response =
                        Response::from_string("Not Found").with_status_code(404);
                    let _ = request.respond(response);
                }
            }
        }
    });
}

/// Tauri command: webview calls this to complete an export request
#[tauri::command]
pub fn mcp_export_complete(
    state: tauri::State<'_, Arc<McpState>>,
    request_id: String,
    success: bool,
    output_path: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    let mut pending = state.pending_exports.lock().map_err(|e| e.to_string())?;
    pending.insert(
        request_id,
        ExportResponse {
            success,
            output_path,
            error,
        },
    );
    Ok(())
}

/// Tauri command: webview calls this to write binary (base64) data to a file
#[tauri::command]
pub fn write_binary_file(path: String, data_base64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

/// Tauri command: webview calls this to update current file path for MCP status
#[tauri::command]
pub fn mcp_set_current_file(
    state: tauri::State<'_, Arc<McpState>>,
    filepath: Option<String>,
) -> Result<(), String> {
    let mut current = state.current_file.lock().map_err(|e| e.to_string())?;
    *current = filepath;
    Ok(())
}
