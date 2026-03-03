import { z } from "zod";
import { exec } from "node:child_process";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function resolvePath(filepath: string): string {
  if (filepath.startsWith("~")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return resolve(home, filepath.slice(2));
  }
  return resolve(filepath);
}

export function registerOpenTool(server: McpServer) {
  server.tool(
    "open_in_app",
    "Open an .excalidraw file in the desktop Excalidraw application (macOS: uses 'open' command).",
    {
      filepath: z.string().describe("Path to the .excalidraw file to open"),
    },
    async ({ filepath }) => {
      try {
        let fullPath = resolvePath(filepath);
        if (!fullPath.endsWith(".excalidraw")) {
          fullPath += ".excalidraw";
        }

        return new Promise((resolvePromise) => {
          exec(`open "${fullPath}"`, (error) => {
            if (error) {
              resolvePromise({
                content: [
                  {
                    type: "text" as const,
                    text: `Error opening file: ${error.message}`,
                  },
                ],
                isError: true,
              });
            } else {
              resolvePromise({
                content: [
                  {
                    type: "text" as const,
                    text: `Opened ${fullPath} in default application.`,
                  },
                ],
              });
            }
          });
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
