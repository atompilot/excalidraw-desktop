import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readExcalidrawFile, writeExcalidrawFile } from "../helpers/file-format.js";

const EditSchema = z.object({
  id: z.string().describe("Element ID to edit"),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  strokeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fillStyle: z.string().optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional(),
  opacity: z.number().optional(),
  text: z.string().optional().describe("For text elements: update the text content"),
  fontSize: z.number().optional(),
  label: z.string().optional().describe("Update the bound text label of a shape"),
});

export function registerEditTool(server: McpServer) {
  server.tool(
    "edit_elements",
    "Edit existing elements in an .excalidraw file by their IDs. Use read_excalidraw first to get element IDs. Supports changing position, size, style, and text content.",
    {
      filepath: z.string().describe("Path to the .excalidraw file"),
      edits: z.array(EditSchema).describe("Array of edits, each with an element ID and properties to change"),
    },
    async ({ filepath, edits }) => {
      try {
        const file = await readExcalidrawFile(filepath);
        const editedIds: string[] = [];
        const notFoundIds: string[] = [];

        for (const edit of edits) {
          const { id, label, ...props } = edit;
          const element = file.elements.find((e) => e.id === id);

          if (!element) {
            notFoundIds.push(id);
            continue;
          }

          // Apply property updates
          for (const [key, value] of Object.entries(props)) {
            if (value !== undefined) {
              (element as Record<string, unknown>)[key] = value;

              // If updating text, also update originalText
              if (key === "text") {
                element.originalText = value as string;
              }
            }
          }

          // Update version
          element.version = (element.version || 1) + 1;
          element.versionNonce = Math.floor(Math.random() * 2147483647);
          element.updated = Date.now();

          // Handle label update: find bound text element and update it
          if (label !== undefined && element.boundElements) {
            const boundText = element.boundElements.find((b) => b.type === "text");
            if (boundText) {
              const textEl = file.elements.find((e) => e.id === boundText.id);
              if (textEl) {
                textEl.text = label;
                textEl.originalText = label;
                textEl.version = (textEl.version || 1) + 1;
                textEl.versionNonce = Math.floor(Math.random() * 2147483647);
                textEl.updated = Date.now();
              }
            }
          }

          editedIds.push(id);
        }

        await writeExcalidrawFile(filepath, file.elements, file.appState);

        let message = `Edited ${editedIds.length} element(s) in ${filepath}.`;
        if (notFoundIds.length > 0) {
          message += ` Not found: ${notFoundIds.join(", ")}.`;
        }

        return {
          content: [{ type: "text" as const, text: message }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error editing elements: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
