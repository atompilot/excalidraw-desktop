/**
 * DimensionOverlay — an absolutely-positioned canvas that draws dimension
 * labels (width × height) and gap distances for selected elements.
 *
 * It subscribes to the Excalidraw `onChange` callback (via props) and redraws
 * whenever selection or viewport changes.
 */

import React, { useCallback, useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  getDimensionInfo,
  computeGaps,
  type GapInfo,
} from "../dimension-utils";

interface DimensionOverlayProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Coordinate conversion helpers
// ---------------------------------------------------------------------------

function sceneToScreen(
  sceneX: number,
  sceneY: number,
  scrollX: number,
  scrollY: number,
  zoom: number,
): [number, number] {
  return [(sceneX + scrollX) * zoom, (sceneY + scrollY) * zoom];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DimensionOverlay: React.FC<DimensionOverlayProps> = ({
  excalidrawAPI,
  visible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !excalidrawAPI || !visible) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const appState = excalidrawAPI.getAppState();
    const { scrollX, scrollY } = appState;
    const zoom = appState.zoom.value;

    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      (id) => appState.selectedElementIds[id],
    );
    if (selectedIds.length === 0) {
      return;
    }

    const allElements = excalidrawAPI.getSceneElements();
    const selected = allElements.filter(
      (el) => selectedIds.includes(el.id) && !el.isDeleted,
    );
    if (selected.length === 0) {
      return;
    }

    // --- Draw per-element dimensions ---
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";

    for (const el of selected) {
      const dim = getDimensionInfo(el);
      const b = dim.bounds;

      // Bottom-center of element in screen coords
      const [sx, sy] = sceneToScreen(
        b.x + b.width / 2,
        b.y + b.height + 14,
        scrollX,
        scrollY,
        zoom,
      );

      // Background pill
      const textWidth = ctx.measureText(dim.label).width;
      const pillW = textWidth + 10;
      const pillH = 18;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      roundRect(ctx, sx - pillW / 2, sy - pillH / 2, pillW, pillH, 4);
      ctx.fill();

      // Text
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(dim.label, sx, sy);
    }

    // --- Draw gaps ---
    if (selected.length >= 2) {
      const gaps = computeGaps(selected);
      for (const gap of gaps) {
        drawGap(ctx, gap, scrollX, scrollY, zoom);
      }
    }
  }, [excalidrawAPI, visible]);

  // Schedule a redraw whenever scene changes
  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Listen for scene changes via a MutationObserver on the container
  // and window resize
  useEffect(() => {
    if (!visible) {
      return;
    }
    // Also redraw on pointer-up and scroll (viewport changes)
    const events = ["pointerup", "wheel", "scroll", "resize"];
    for (const evt of events) {
      window.addEventListener(evt, scheduleRedraw, { passive: true });
    }
    // Initial draw
    scheduleRedraw();
    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, scheduleRedraw);
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, [visible, scheduleRedraw]);

  if (!visible) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawGap(
  ctx: CanvasRenderingContext2D,
  gap: GapInfo,
  scrollX: number,
  scrollY: number,
  zoom: number,
) {
  const [lx, ly] = sceneToScreen(
    gap.labelX,
    gap.labelY,
    scrollX,
    scrollY,
    zoom,
  );

  // Dashed line
  const isH = gap.axis === "horizontal";
  const [sx, sy] = sceneToScreen(
    isH ? gap.from.x + gap.from.width : gap.labelX,
    isH ? gap.labelY : gap.from.y + gap.from.height,
    scrollX,
    scrollY,
    zoom,
  );
  const [ex, ey] = sceneToScreen(
    isH ? gap.to.x : gap.labelX,
    isH ? gap.labelY : gap.to.y,
    scrollX,
    scrollY,
    zoom,
  );

  ctx.strokeStyle = "#f06595";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label pill
  const label = `${gap.gap}`;
  const textWidth = ctx.measureText(label).width;
  const pillW = textWidth + 10;
  const pillH = 16;
  ctx.fillStyle = "rgba(240,101,149,0.9)";
  roundRect(ctx, lx - pillW / 2, ly - pillH / 2, pillW, pillH, 3);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, lx, ly);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
