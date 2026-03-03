import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readExcalidrawFile } from "../helpers/file-format.js";

interface AnnotationItem {
  number: number;
  x: number;
  y: number;
  description: string;
  pointsTo?: {
    type: string;
    id: string;
    x: number;
    y: number;
    text?: string;
  };
}

export function registerAnnotationsTool(server: McpServer) {
  server.tool(
    "read_annotations",
    "Read annotation markers from an .excalidraw file and return a structured summary. Annotations are elements with customData.annotation = true.",
    {
      filepath: z.string().describe("Path to the .excalidraw file"),
    },
    async ({ filepath }) => {
      try {
        const file = await readExcalidrawFile(filepath);

        const elements = file.elements.filter((e: any) => !e.isDeleted);
        const annotationMap = new Map<
          number,
          { x: number; y: number; description: string }
        >();

        // Collect annotation elements
        for (const el of elements) {
          const cd = el.customData as any;
          if (!cd?.annotation) {
            continue;
          }
          const num: number = cd.annotationNumber;
          if (!num) {
            continue;
          }

          if (cd.role === "description") {
            const existing = annotationMap.get(num) || {
              x: 0,
              y: 0,
              description: "",
            };
            existing.description = (el as any).text || "";
            annotationMap.set(num, existing);
          } else if (!cd.role) {
            annotationMap.set(num, {
              x: Math.round(el.x + el.width / 2),
              y: Math.round(el.y + el.height / 2),
              description: annotationMap.get(num)?.description || "",
            });
          }
        }

        // Find nearest regular elements
        const regularElements = elements.filter(
          (el: any) => !(el.customData as any)?.annotation,
        );

        const items: AnnotationItem[] = [];
        for (const [num, { x, y, description }] of [
          ...annotationMap.entries(),
        ].sort((a, b) => a[0] - b[0])) {
          const item: AnnotationItem = { number: num, x, y, description };

          let bestDist = Infinity;
          for (const el of regularElements) {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            const dist = Math.hypot(cx - x, cy - y);
            if (dist < bestDist && dist < 300) {
              bestDist = dist;
              item.pointsTo = {
                type: el.type,
                id: el.id,
                x: Math.round(el.x),
                y: Math.round(el.y),
                text: (el as any).text,
              };
            }
          }

          items.push(item);
        }

        if (items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No annotations found in this file.",
              },
            ],
          };
        }

        // Build markdown summary
        const fileName = filepath.split(/[/\\]/).pop() || filepath;
        const lines = [`# 标注摘要 - ${fileName}`, ""];
        for (const item of items) {
          lines.push(`## #${item.number} (x:${item.x}, y:${item.y})`);
          lines.push(`文字: "${item.description}"`);
          if (item.pointsTo) {
            const ptText = item.pointsTo.text
              ? ` "${item.pointsTo.text}"`
              : "";
            lines.push(
              `指向: 位于 (${item.pointsTo.x}, ${item.pointsTo.y}) 的 ${item.pointsTo.type} 元素${ptText}`,
            );
          }
          lines.push("");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error reading annotations: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
