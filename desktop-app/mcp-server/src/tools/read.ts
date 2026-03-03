import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  readExcalidrawFile,
  summarizeFile,
  describeElements,
} from "../helpers/file-format.js";

export function registerReadTool(server: McpServer) {
  server.tool(
    "read_excalidraw",
    "Read and describe the contents of an .excalidraw file. Returns element details (type, position, text content, bindings) and a summary.",
    {
      filepath: z.string().describe("Path to the .excalidraw file"),
    },
    async ({ filepath }) => {
      try {
        const file = await readExcalidrawFile(filepath);
        const summary = summarizeFile(file);
        const elements = describeElements(file);

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\nElements:\n${JSON.stringify(elements, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
