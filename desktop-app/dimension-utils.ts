/**
 * Dimension utilities — pure functions for computing element bounds, gaps,
 * and generating "solidified" dimension annotation elements.
 */

import { randomId } from "@excalidraw/common/random";
import { FONT_FAMILY } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DimensionInfo {
  bounds: Bounds;
  label: string;
}

export interface GapInfo {
  from: Bounds;
  to: Bounds;
  axis: "horizontal" | "vertical";
  gap: number;
  /** Midpoint of the gap line — where to render the label */
  labelX: number;
  labelY: number;
}

// ---------------------------------------------------------------------------
// Bounds helpers
// ---------------------------------------------------------------------------

export function getElementBounds(el: ExcalidrawElement): Bounds {
  return {
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
  };
}

export function getCommonBoundsOfElements(
  elements: readonly ExcalidrawElement[],
): Bounds | null {
  if (elements.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// Dimension info for single & multiple elements
// ---------------------------------------------------------------------------

export function getDimensionInfo(el: ExcalidrawElement): DimensionInfo {
  const b = getElementBounds(el);
  return {
    bounds: b,
    label: `${Math.round(b.width)} × ${Math.round(b.height)}`,
  };
}

// ---------------------------------------------------------------------------
// Gap detection between pairs of selected elements
// ---------------------------------------------------------------------------

export function computeGaps(elements: readonly ExcalidrawElement[]): GapInfo[] {
  if (elements.length < 2) {
    return [];
  }

  const gaps: GapInfo[] = [];
  const sorted = [...elements];

  // Horizontal gaps (sorted by x)
  sorted.sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = getElementBounds(sorted[i]);
    const b = getElementBounds(sorted[i + 1]);
    const gap = b.x - (a.x + a.width);
    if (gap > 0) {
      const overlapTop = Math.max(a.y, b.y);
      const overlapBottom = Math.min(a.y + a.height, b.y + b.height);
      const labelY =
        overlapTop < overlapBottom
          ? (overlapTop + overlapBottom) / 2
          : (a.y + a.height / 2 + (b.y + b.height / 2)) / 2;
      gaps.push({
        from: a,
        to: b,
        axis: "horizontal",
        gap: Math.round(gap),
        labelX: a.x + a.width + gap / 2,
        labelY,
      });
    }
  }

  // Vertical gaps (sorted by y)
  sorted.sort((a, b) => a.y - b.y);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = getElementBounds(sorted[i]);
    const b = getElementBounds(sorted[i + 1]);
    const gap = b.y - (a.y + a.height);
    if (gap > 0) {
      const overlapLeft = Math.max(a.x, b.x);
      const overlapRight = Math.min(a.x + a.width, b.x + b.width);
      const labelX =
        overlapLeft < overlapRight
          ? (overlapLeft + overlapRight) / 2
          : (a.x + a.width / 2 + (b.x + b.width / 2)) / 2;
      gaps.push({
        from: a,
        to: b,
        axis: "vertical",
        gap: Math.round(gap),
        labelX,
        labelY: a.y + a.height + gap / 2,
      });
    }
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// "Solidify" — create real Excalidraw elements from dimension info
// ---------------------------------------------------------------------------

export function solidifyDimension(info: DimensionInfo): ExcalidrawElement[] {
  const groupId = randomId();
  const { bounds, label } = info;

  // Horizontal dimension line below the element
  const lineY = bounds.y + bounds.height + 20;
  const arrowId = randomId();
  const arrow: Record<string, any> = {
    id: arrowId,
    type: "arrow",
    x: bounds.x,
    y: lineY,
    width: bounds.width,
    height: 0,
    points: [
      [0, 0],
      [bounds.width, 0],
    ],
    strokeColor: "#868e96",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: { annotation: true, type: "dimension" },
    startBinding: null,
    endBinding: null,
    isDeleted: false,
  };

  const textId = randomId();
  const text: Record<string, any> = {
    id: textId,
    type: "text",
    x: bounds.x + bounds.width / 2 - 20,
    y: lineY + 6,
    width: 40,
    height: 16,
    text: label,
    fontSize: 12,
    fontFamily: FONT_FAMILY["system-ui"],
    textAlign: "center",
    verticalAlign: "top",
    strokeColor: "#868e96",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: { annotation: true, type: "dimension" },
    isDeleted: false,
  };

  return [arrow, text] as unknown as ExcalidrawElement[];
}

export function solidifyGap(gap: GapInfo): ExcalidrawElement[] {
  const groupId = randomId();

  const isH = gap.axis === "horizontal";
  const startX = isH ? gap.from.x + gap.from.width : gap.labelX;
  const startY = isH ? gap.labelY : gap.from.y + gap.from.height;
  const endX = isH ? gap.to.x : gap.labelX;
  const endY = isH ? gap.labelY : gap.to.y;

  const arrowId = randomId();
  const arrow: Record<string, any> = {
    id: arrowId,
    type: "arrow",
    x: startX,
    y: startY,
    width: endX - startX,
    height: endY - startY,
    points: [
      [0, 0],
      [endX - startX, endY - startY],
    ],
    strokeColor: "#f06595",
    strokeWidth: 1,
    strokeStyle: "dashed",
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: { annotation: true, type: "dimension" },
    startBinding: null,
    endBinding: null,
    isDeleted: false,
  };

  const textId = randomId();
  const text: Record<string, any> = {
    id: textId,
    type: "text",
    x: gap.labelX - 15,
    y: gap.labelY - 8,
    width: 30,
    height: 16,
    text: `${gap.gap}`,
    fontSize: 12,
    fontFamily: FONT_FAMILY["system-ui"],
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: "#f06595",
    backgroundColor: "transparent",
    fillStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [groupId],
    customData: { annotation: true, type: "dimension" },
    isDeleted: false,
  };

  return [arrow, text] as unknown as ExcalidrawElement[];
}
