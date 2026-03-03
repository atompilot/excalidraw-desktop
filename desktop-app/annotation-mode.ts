/**
 * Annotation Mode — state management, element creation, and summary generation.
 *
 * All annotation elements carry `customData.annotation = true` so they can be
 * filtered, exported, or stripped independently from the regular design content.
 */

import { randomId } from "@excalidraw/common/random";
import { FONT_FAMILY } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANNOTATION_COLOR = "#e03131";
const BADGE_RADIUS = 16;
const ARROW_LENGTH = 60;
const TEXT_OFFSET = 20;

// ---------------------------------------------------------------------------
// Counter (auto-incrementing per session)
// ---------------------------------------------------------------------------

let annotationCounter = 0;

export const resetAnnotationCounter = () => {
  annotationCounter = 0;
};

export const getNextAnnotationNumber = () => ++annotationCounter;

/** Re-sync counter from existing scene elements so we don't collide. */
export const syncCounterFromScene = (
  elements: readonly ExcalidrawElement[],
) => {
  let max = 0;
  for (const el of elements) {
    const num = (el.customData as any)?.annotationNumber;
    if (typeof num === "number" && num > max) {
      max = num;
    }
  }
  annotationCounter = max;
};

// ---------------------------------------------------------------------------
// Element factories
// ---------------------------------------------------------------------------

function baseMeta(annotationNumber: number) {
  return {
    annotation: true,
    annotationNumber,
  };
}

/** Create a numbered badge (ellipse + text), an arrow, and a description text. */
export function createAnnotation(
  x: number,
  y: number,
  description: string = "",
): ExcalidrawElement[] {
  const num = getNextAnnotationNumber();
  const groupId = randomId();

  // Badge circle
  const circleId = randomId();
  const circle: Record<string, any> = {
    id: circleId,
    type: "ellipse",
    x: x - BADGE_RADIUS,
    y: y - BADGE_RADIUS,
    width: BADGE_RADIUS * 2,
    height: BADGE_RADIUS * 2,
    strokeColor: ANNOTATION_COLOR,
    backgroundColor: ANNOTATION_COLOR,
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: baseMeta(num),
    boundElements: [],
    isDeleted: false,
    locked: false,
  };

  // Number label inside the badge
  const labelId = randomId();
  const label: Record<string, any> = {
    id: labelId,
    type: "text",
    x: x - 5,
    y: y - 8,
    width: 10,
    height: 16,
    text: String(num),
    fontSize: 14,
    fontFamily: FONT_FAMILY["system-ui"],
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: "#ffffff",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    opacity: 100,
    containerId: circleId,
    groupIds: [groupId],
    customData: { ...baseMeta(num), role: "label" },
    isDeleted: false,
    locked: false,
  };

  // Add bound text to circle
  (circle as any).boundElements = [{ id: labelId, type: "text" }];

  // Arrow pointing away from badge
  const arrowId = randomId();
  const arrow: Record<string, any> = {
    id: arrowId,
    type: "arrow",
    x: x + BADGE_RADIUS,
    y,
    width: ARROW_LENGTH,
    height: 0,
    points: [
      [0, 0],
      [ARROW_LENGTH, 0],
    ],
    strokeColor: ANNOTATION_COLOR,
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: { ...baseMeta(num), role: "arrow" },
    startBinding: null,
    endBinding: null,
    isDeleted: false,
    locked: false,
  };

  // Description text at the end of the arrow
  const descId = randomId();
  const descText: Record<string, any> = {
    id: descId,
    type: "text",
    x: x + BADGE_RADIUS + ARROW_LENGTH + TEXT_OFFSET,
    y: y - 10,
    width: 200,
    height: 20,
    text: description || `标注 #${num}`,
    fontSize: 16,
    fontFamily: FONT_FAMILY["system-ui"],
    textAlign: "left",
    verticalAlign: "top",
    strokeColor: ANNOTATION_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: { ...baseMeta(num), role: "description" },
    isDeleted: false,
    locked: false,
  };

  return [circle, label, arrow, descText] as unknown as ExcalidrawElement[];
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

export interface AnnotationSummaryItem {
  number: number;
  x: number;
  y: number;
  description: string;
  /** Info about the nearest non-annotation element, if any. */
  pointsTo?: {
    type: string;
    id: string;
    x: number;
    y: number;
    text?: string;
  };
}

/** Scan all elements and produce a structured annotation summary. */
export function generateAnnotationSummary(
  elements: readonly ExcalidrawElement[],
  fileName?: string,
): { items: AnnotationSummaryItem[]; markdown: string } {
  const annotations = new Map<
    number,
    { x: number; y: number; description: string }
  >();

  for (const el of elements) {
    const cd = el.customData as any;
    if (!cd?.annotation || el.isDeleted) {
      continue;
    }
    const num: number = cd.annotationNumber;
    if (!num) {
      continue;
    }

    if (cd.role === "description") {
      const existing = annotations.get(num) || { x: 0, y: 0, description: "" };
      existing.description = (el as any).text || "";
      annotations.set(num, existing);
    } else if (!cd.role || cd.role === undefined) {
      // The badge circle — use its center as position
      annotations.set(num, {
        x: Math.round(el.x + el.width / 2),
        y: Math.round(el.y + el.height / 2),
        description: annotations.get(num)?.description || "",
      });
    }
  }

  // Non-annotation elements for "points to" matching
  const regularElements = elements.filter(
    (el) => !(el.customData as any)?.annotation && !el.isDeleted,
  );

  const items: AnnotationSummaryItem[] = [];

  for (const [num, { x, y, description }] of [...annotations.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const item: AnnotationSummaryItem = { number: num, x, y, description };

    // Find nearest regular element
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

  // Build markdown
  const title = fileName ? `# 标注摘要 - ${fileName}` : "# 标注摘要";
  const lines = [title, ""];
  for (const item of items) {
    lines.push(`## #${item.number} (x:${item.x}, y:${item.y})`);
    lines.push(`文字: "${item.description}"`);
    if (item.pointsTo) {
      const ptText = item.pointsTo.text ? ` "${item.pointsTo.text}"` : "";
      lines.push(
        `指向: 位于 (${item.pointsTo.x}, ${item.pointsTo.y}) 的 ${item.pointsTo.type} 元素${ptText}`,
      );
    }
    lines.push("");
  }

  return { items, markdown: lines.join("\n") };
}

/** Delete all annotation elements from the scene. */
export function getAnnotationElementIds(
  elements: readonly ExcalidrawElement[],
): string[] {
  return elements
    .filter((el) => (el.customData as any)?.annotation && !el.isDeleted)
    .map((el) => el.id);
}
