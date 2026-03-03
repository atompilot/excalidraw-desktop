import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createElement } from "../helpers/element.js";
import { appendElements } from "../helpers/file-format.js";

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

export function registerModifyTool(server: McpServer) {
  server.tool(
    "add_elements",
    "Add elements to an existing .excalidraw file. The new elements are appended to the existing ones.",
    {
      filepath: z.string().describe("Path to the .excalidraw file"),
      elements: z.array(ElementSchema).describe("Elements to add"),
    },
    async ({ filepath, elements }) => {
      try {
        const newElements = elements.flatMap((el: z.infer<typeof ElementSchema>) =>
          createElement(el),
        );
        const { fullPath, totalElements } = await appendElements(filepath, newElements);

        return {
          content: [
            {
              type: "text" as const,
              text: `Updated ${fullPath}. Added ${newElements.length} elements. Total: ${totalElements}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error modifying file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
