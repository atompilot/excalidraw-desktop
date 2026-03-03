import { z } from "zod";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DESKTOP_APP_PORT = 21063;

async function callDesktopApp(
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data: string }> {
  const url = `http://127.0.0.1:${DESKTOP_APP_PORT}${endpoint}`;
  const options: RequestInit = {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();
  return { ok: response.ok, data: text };
}

function resolvePath(filepath: string): string {
  if (filepath.startsWith("~")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return resolve(home, filepath.slice(2));
  }
  return resolve(filepath);
}

export function registerExportTool(server: McpServer) {
  server.tool(
    "export_to_image",
    "Export an .excalidraw file to a PNG image. The desktop Excalidraw app must be running. The exported image is saved to /tmp so Claude Code can read it. Returns the image path.",
    {
      filepath: z.string().describe("Path to the .excalidraw file to export"),
      outputPath: z
        .string()
        .optional()
        .describe("Output PNG path (default: /tmp/excalidraw-export-<timestamp>.png)"),
      background: z
        .boolean()
        .optional()
        .describe("Include background color (default: true)"),
      scale: z
        .number()
        .optional()
        .describe("Export scale factor (default: 2)"),
    },
    async ({ filepath, outputPath, background, scale }) => {
      try {
        let fullInputPath = resolvePath(filepath);
        if (!fullInputPath.endsWith(".excalidraw")) {
          fullInputPath += ".excalidraw";
        }

        const outputFile =
          outputPath ??
          resolve(tmpdir(), `excalidraw-export-${Date.now()}.png`);

        const result = await callDesktopApp("/export", {
          filepath: fullInputPath,
          outputPath: outputFile,
          background: background ?? true,
          scale: scale ?? 2,
        });

        if (!result.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Export failed: ${result.data}. Make sure the Excalidraw desktop app is running.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Exported to ${outputFile}. You can read this image file to view the drawing.`,
            },
          ],
        };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error);
        if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Cannot connect to Excalidraw desktop app (port ${DESKTOP_APP_PORT}). Please start the desktop app first, then retry. Use open_in_app to open the file.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Error exporting: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
