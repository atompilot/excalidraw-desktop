import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface FileData {
  path: string;
  content: string;
  name: string;
}

export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
}

// --- File I/O ---

export const readFile = (path: string): Promise<FileData> => {
  return invoke<FileData>("read_file", { path });
};

export const writeFile = (path: string, content: string): Promise<void> => {
  return invoke("write_file", { path, content });
};

export const getAutoSavePath = (): Promise<string> => {
  return invoke<string>("get_auto_save_path");
};

// --- Recent Files ---

export const getRecentFiles = (): Promise<RecentFile[]> => {
  return invoke<RecentFile[]>("get_recent_files");
};

export const addRecentFile = (path: string, name: string): Promise<void> => {
  return invoke("add_recent_file", { path, name });
};

export const clearRecentFiles = (): Promise<void> => {
  return invoke("clear_recent_files");
};

// --- Dialog ---

export const openFileDialog = async (): Promise<string | null> => {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: "Excalidraw",
        extensions: ["excalidraw"],
      },
      {
        name: "All Files",
        extensions: ["*"],
      },
    ],
  });
  if (result) {
    return typeof result === "string" ? result : result.path;
  }
  return null;
};

export const saveFileDialog = async (
  defaultName?: string,
): Promise<string | null> => {
  const result = await save({
    defaultPath: defaultName || "drawing.excalidraw",
    filters: [
      {
        name: "Excalidraw",
        extensions: ["excalidraw"],
      },
    ],
  });
  return result || null;
};

// --- Events ---

export const onFileOpen = (
  callback: (filePath: string) => void,
): Promise<UnlistenFn> => {
  return listen<string>("open-file", (event) => {
    callback(event.payload);
  });
};

// --- Window ---

export const setWindowTitle = (title: string): Promise<void> => {
  return getCurrentWindow().setTitle(title);
};

// --- MCP Integration ---

export interface McpExportRequest {
  requestId: string;
  filepath: string;
  outputPath: string;
  background: boolean;
  scale: number;
}

export const onMcpExportRequest = (
  callback: (request: McpExportRequest) => void,
): Promise<UnlistenFn> => {
  return listen<McpExportRequest>("mcp-export-request", (event) => {
    callback(event.payload);
  });
};

export const mcpExportComplete = (
  requestId: string,
  success: boolean,
  outputPath?: string,
  error?: string,
): Promise<void> => {
  return invoke("mcp_export_complete", {
    requestId,
    success,
    outputPath: outputPath ?? null,
    error: error ?? null,
  });
};

export const writeBinaryFile = (
  path: string,
  dataBase64: string,
): Promise<void> => {
  return invoke("write_binary_file", { path, dataBase64 });
};

export const mcpSetCurrentFile = (filepath: string | null): Promise<void> => {
  return invoke("mcp_set_current_file", { filepath });
};

// --- Session State ---

export interface SessionState {
  last_file_path: string | null;
}

export const getSessionState = (): Promise<SessionState> => {
  return invoke<SessionState>("get_session_state");
};

export const setSessionState = (state: SessionState): Promise<void> => {
  return invoke("set_session_state", { state });
};
