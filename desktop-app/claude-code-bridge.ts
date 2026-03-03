/**
 * Claude Code Bridge — handles "Send to Claude Code" workflow:
 * 1. Export annotated canvas to PNG
 * 2. Save .excalidraw source alongside
 * 3. Copy a prompt to clipboard for pasting into Claude Code
 */

import { exportToCanvas } from "@excalidraw/excalidraw";

import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { copyToClipboard, writeBinaryFile, writeFile } from "./tauri-bridge";

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(
    2,
    "0",
  )}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(
    2,
    "0",
  )}`;
}

export async function sendToClaudeCode(
  excalidrawAPI: ExcalidrawImperativeAPI,
): Promise<{ pngPath: string; excalidrawPath: string; prompt: string }> {
  const ts = timestamp();
  const pngPath = `/tmp/excalidraw-annotated-${ts}.png`;
  const excalidrawPath = `/tmp/excalidraw-annotated-${ts}.excalidraw`;

  const elements = excalidrawAPI.getSceneElements();
  const appState = excalidrawAPI.getAppState();
  const files = excalidrawAPI.getFiles();

  // 1. Export PNG
  const nonDeleted = elements.filter((el) => !el.isDeleted);
  const canvas = await exportToCanvas(
    nonDeleted,
    { ...appState, exportScale: 2 },
    files,
    {
      exportBackground: true,
      viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
    },
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
      } else {
        reject(new Error("Canvas toBlob failed"));
      }
    }, "image/png");
  });

  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  await writeBinaryFile(pngPath, btoa(binary));

  // 2. Save .excalidraw
  const json = serializeAsJSON(elements, appState, files, "local");
  await writeFile(excalidrawPath, json);

  // 3. Build prompt — just file paths, user fills in the rest
  const prompt = `截图: ${pngPath}\n源文件: ${excalidrawPath}\n`;

  // 5. Copy to clipboard (use Tauri command to avoid user-gesture restrictions)
  await copyToClipboard(prompt);

  return { pngPath, excalidrawPath, prompt };
}
