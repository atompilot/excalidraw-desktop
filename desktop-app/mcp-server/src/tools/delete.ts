import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readExcalidrawFile, writeExcalidrawFile } from "../helpers/file-format.js";

export function registerDeleteTool(server: McpServer) {
  server.tool(
    "delete_elements",
    "Delete elements from an .excalidraw file by their IDs. Also removes bound text elements and clears binding references.",
    {
      filepath: z.string().describe("Path to the .excalidraw file"),
      elementIds: z.array(z.string()).describe("IDs of elements to delete"),
    },
    async ({ filepath, elementIds }) => {
      try {
        const file = await readExcalidrawFile(filepath);
        const idsToDelete = new Set(elementIds);
        let deletedCount = 0;

        // First pass: collect IDs of bound text elements that should also be deleted
        for (const id of idsToDelete) {
          const element = file.elements.find((e) => e.id === id);
          if (element?.boundElements) {
            for (const bound of element.boundElements) {
              if (bound.type === "text") {
                idsToDelete.add(bound.id);
              }
            }
          }
        }

        // Second pass: mark elements as deleted and clean up bindings
        for (const element of file.elements) {
          if (idsToDelete.has(element.id)) {
            element.isDeleted = true;
            element.version = (element.version || 1) + 1;
            element.versionNonce = Math.floor(Math.random() * 2147483647);
            element.updated = Date.now();
            deletedCount++;
          } else if (element.boundElements) {
            // Remove deleted elements from boundElements arrays
            element.boundElements = element.boundElements.filter(
              (b) => !idsToDelete.has(b.id),
            );
            if (element.boundElements.length === 0) {
              element.boundElements = null;
            }
          }
        }

        await writeExcalidrawFile(filepath, file.elements, file.appState);

        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted ${deletedCount} element(s) from ${filepath}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting elements: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
