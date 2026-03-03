import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createElement } from "../helpers/element.js";
import { writeExcalidrawFile } from "../helpers/file-format.js";

const ElementSchema = z.object({
  type: z.enum([
    "rectangle",
    "ellipse",
    "diamond",
    "line",
    "arrow",
    "text",
    "freedraw",
    "image",
    "frame",
  ]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  label: z.string().optional(),
  text: z.string().optional(),
  strokeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fillStyle: z.string().optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional(),
  opacity: z.number().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.number().optional(),
  textAlign: z.string().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
  startArrowhead: z.string().nullable().optional(),
  endArrowhead: z.string().nullable().optional(),
});

export function registerCreateTool(server: McpServer) {
  server.tool(
    "create_excalidraw",
    "Create a new .excalidraw file with specified elements. Elements can be shapes (rectangle, ellipse, diamond), lines, arrows, or text. Shapes can have a 'label' property to automatically create bound text inside them.",
    {
      filepath: z.string().describe("Path for the new .excalidraw file"),
      elements: z.array(ElementSchema).describe("Array of elements to create"),
      viewBackgroundColor: z
        .string()
        .optional()
        .describe("Background color (default: #ffffff)"),
    },
    async ({ filepath, elements, viewBackgroundColor }) => {
      try {
        const allElements = elements.flatMap((el) => createElement(el));
        const appState = viewBackgroundColor ? { viewBackgroundColor } : undefined;
        const fullPath = await writeExcalidrawFile(filepath, allElements, appState);

        return {
          content: [
            {
              type: "text" as const,
              text: `Created ${fullPath} with ${allElements.length} elements (${elements.length} shapes).`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
