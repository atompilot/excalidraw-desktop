import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ExcalidrawElement } from "./element.js";

export interface ExcalidrawFile {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: string;
    [key: string]: unknown;
  };
  files: Record<string, unknown>;
}

function createEmptyFile(): ExcalidrawFile {
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-mcp-server",
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  };
}

function resolvePath(filepath: string): string {
  if (filepath.startsWith("~")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return resolve(home, filepath.slice(2));
  }
  return resolve(filepath);
}

function ensureExtension(filepath: string): string {
  if (!filepath.endsWith(".excalidraw")) {
    return filepath + ".excalidraw";
  }
  return filepath;
}

export async function readExcalidrawFile(filepath: string): Promise<ExcalidrawFile> {
  const fullPath = resolvePath(ensureExtension(filepath));
  const content = await readFile(fullPath, "utf-8");
  const data = JSON.parse(content) as ExcalidrawFile;

  if (data.type !== "excalidraw") {
    throw new Error(`Invalid file: expected type "excalidraw", got "${data.type}"`);
  }

  return data;
}

export async function writeExcalidrawFile(
  filepath: string,
  elements: ExcalidrawElement[],
  appState?: Partial<ExcalidrawFile["appState"]>,
): Promise<string> {
  const fullPath = resolvePath(ensureExtension(filepath));

  const file = createEmptyFile();
  file.elements = elements;
  if (appState) {
    file.appState = { ...file.appState, ...appState };
  }

  await writeFile(fullPath, JSON.stringify(file, null, 2), "utf-8");
  return fullPath;
}

export async function appendElements(
  filepath: string,
  newElements: ExcalidrawElement[],
): Promise<{ fullPath: string; totalElements: number }> {
  const fullPath = resolvePath(ensureExtension(filepath));
  const existing = await readExcalidrawFile(filepath);

  // Add arrow bindings: update existing elements' boundElements if arrows reference them
  for (const el of newElements) {
    if ((el.type === "arrow" || el.type === "line") && el.startBinding) {
      const target = existing.elements.find((e) => e.id === el.startBinding!.elementId);
      if (target) {
        target.boundElements = target.boundElements ?? [];
        target.boundElements.push({ id: el.id, type: "arrow" });
      }
    }
    if ((el.type === "arrow" || el.type === "line") && el.endBinding) {
      const target = existing.elements.find((e) => e.id === el.endBinding!.elementId);
      if (target) {
        target.boundElements = target.boundElements ?? [];
        target.boundElements.push({ id: el.id, type: "arrow" });
      }
    }
  }

  existing.elements.push(...newElements);
  await writeFile(fullPath, JSON.stringify(existing, null, 2), "utf-8");

  return { fullPath, totalElements: existing.elements.length };
}

export function summarizeFile(file: ExcalidrawFile): string {
  const elements = file.elements.filter((e) => !e.isDeleted);
  const typeCounts = new Map<string, number>();
  const textContents: string[] = [];

  for (const el of elements) {
    typeCounts.set(el.type, (typeCounts.get(el.type) ?? 0) + 1);
    if (el.type === "text" && el.text) {
      textContents.push(el.text);
    }
  }

  const lines: string[] = [];
  lines.push(`Total elements: ${elements.length}`);
  lines.push("Types:");
  for (const [type, count] of typeCounts) {
    lines.push(`  - ${type}: ${count}`);
  }

  if (textContents.length > 0) {
    lines.push("Text contents:");
    for (const text of textContents) {
      lines.push(`  - "${text}"`);
    }
  }

  lines.push(`Background: ${file.appState.viewBackgroundColor}`);
  return lines.join("\n");
}

export function describeElements(file: ExcalidrawFile): object[] {
  return file.elements
    .filter((e) => !e.isDeleted)
    .map((el) => {
      const desc: Record<string, unknown> = {
        id: el.id,
        type: el.type,
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
      };

      if (el.type === "text" && el.text) {
        desc.text = el.text;
        if (el.containerId) desc.containerId = el.containerId;
      }

      if (el.boundElements && el.boundElements.length > 0) {
        desc.boundElements = el.boundElements;
      }

      if ((el.type === "arrow" || el.type === "line") && el.points) {
        desc.points = el.points;
        if (el.startBinding) desc.startBinding = el.startBinding;
        if (el.endBinding) desc.endBinding = el.endBinding;
      }

      if (el.backgroundColor !== "transparent") {
        desc.backgroundColor = el.backgroundColor;
      }

      return desc;
    });
}
