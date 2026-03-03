import { nanoid } from "nanoid";

// Excalidraw element types
export type ExcalidrawElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "freedraw"
  | "image"
  | "frame";

export interface SimplifiedElement {
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  // Style overrides
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  // Line/Arrow-specific
  points?: [number, number][];
  startBinding?: { elementId: string; focus: number; gap: number };
  endBinding?: { elementId: string; focus: number; gap: number };
  // Arrow specific
  startArrowhead?: string | null;
  endArrowhead?: string | null;
}

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  seed: number;
  version: number;
  versionNonce: number;
  updated: number;
  isDeleted: boolean;
  groupIds: string[];
  frameId: null | string;
  roundness: { type: number } | null;
  boundElements: { id: string; type: string }[] | null;
  link: null | string;
  locked: boolean;
  // Text fields
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  originalText?: string;
  autoResize?: boolean;
  lineHeight?: number;
  // Line/Arrow fields
  points?: [number, number][];
  lastCommittedPoint?: [number, number] | null;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  [key: string]: unknown;
}

function randomInt(): number {
  return Math.floor(Math.random() * 2147483647);
}

function baseElement(
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
  return {
    id: nanoid(),
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: randomInt(),
    version: 1,
    versionNonce: randomInt(),
    updated: Date.now(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: type === "line" || type === "arrow" ? { type: 2 } : { type: 3 },
    boundElements: null,
    link: null,
    locked: false,
    ...overrides,
  };
}

function createTextElement(
  text: string,
  x: number,
  y: number,
  overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
  const fontSize = overrides.fontSize ?? 20;
  const lineHeight = overrides.lineHeight ?? 1.25;
  const lines = text.split("\n");
  const estimatedWidth = Math.max(...lines.map((l) => l.length)) * fontSize * 0.6;
  const estimatedHeight = lines.length * fontSize * lineHeight;

  return baseElement("text", x, y, estimatedWidth, estimatedHeight, {
    text,
    originalText: text,
    fontSize,
    fontFamily: overrides.fontFamily ?? 5, // Excalifont (hand-drawn)
    textAlign: overrides.textAlign ?? "left",
    verticalAlign: overrides.verticalAlign ?? "top",
    containerId: null,
    autoResize: true,
    lineHeight,
    roundness: null,
    ...overrides,
  });
}

function createBoundTextElement(
  text: string,
  containerId: string,
  containerX: number,
  containerY: number,
  containerWidth: number,
  containerHeight: number,
  overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
  const fontSize = overrides.fontSize ?? 20;
  const lineHeight = overrides.lineHeight ?? 1.25;
  const lines = text.split("\n");
  const textWidth = Math.max(...lines.map((l) => l.length)) * fontSize * 0.6;
  const textHeight = lines.length * fontSize * lineHeight;

  // Center inside container
  const textX = containerX + (containerWidth - textWidth) / 2;
  const textY = containerY + (containerHeight - textHeight) / 2;

  return baseElement("text", textX, textY, textWidth, textHeight, {
    text,
    originalText: text,
    fontSize,
    fontFamily: overrides.fontFamily ?? 5,
    textAlign: "center",
    verticalAlign: "middle",
    containerId,
    autoResize: true,
    lineHeight,
    roundness: null,
    ...overrides,
  });
}

function createLineOrArrow(
  type: "line" | "arrow",
  x: number,
  y: number,
  points: [number, number][],
  overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
  // Calculate bounding box from points
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  return baseElement(type, x, y, width, height, {
    points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: type === "arrow" ? null : undefined,
    endArrowhead: type === "arrow" ? "arrow" : undefined,
    ...overrides,
  });
}

/**
 * Convert a simplified element description to full Excalidraw element(s).
 * Returns an array because a shape with a label produces both the shape and a bound text element.
 */
export function createElement(input: SimplifiedElement): ExcalidrawElement[] {
  const {
    type,
    x,
    y,
    width = 200,
    height = 100,
    label,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    roughness,
    opacity,
  } = input;

  const styleOverrides: Partial<ExcalidrawElement> = {};
  if (strokeColor) styleOverrides.strokeColor = strokeColor;
  if (backgroundColor) styleOverrides.backgroundColor = backgroundColor;
  if (fillStyle) styleOverrides.fillStyle = fillStyle;
  if (strokeWidth !== undefined) styleOverrides.strokeWidth = strokeWidth;
  if (roughness !== undefined) styleOverrides.roughness = roughness;
  if (opacity !== undefined) styleOverrides.opacity = opacity;

  // Text element
  if (type === "text") {
    const text = input.text ?? label ?? "Text";
    return [
      createTextElement(text, x, y, {
        ...styleOverrides,
        fontSize: input.fontSize,
        fontFamily: input.fontFamily,
        textAlign: input.textAlign as ExcalidrawElement["textAlign"],
      }),
    ];
  }

  // Line or Arrow
  if (type === "line" || type === "arrow") {
    const points = input.points ?? [
      [0, 0],
      [width, height],
    ];
    const overrides: Partial<ExcalidrawElement> = { ...styleOverrides };
    if (input.startBinding) overrides.startBinding = input.startBinding;
    if (input.endBinding) overrides.endBinding = input.endBinding;
    if (input.startArrowhead !== undefined) overrides.startArrowhead = input.startArrowhead;
    if (input.endArrowhead !== undefined) overrides.endArrowhead = input.endArrowhead;
    return [createLineOrArrow(type, x, y, points, overrides)];
  }

  // Shape elements (rectangle, ellipse, diamond, frame)
  const shape = baseElement(type, x, y, width, height, styleOverrides);
  const result: ExcalidrawElement[] = [shape];

  // If label is provided, create a bound text element
  if (label) {
    const textEl = createBoundTextElement(label, shape.id, x, y, width, height, {
      fontSize: input.fontSize,
    });
    shape.boundElements = [{ id: textEl.id, type: "text" }];
    result.push(textEl);
  }

  return result;
}

/**
 * Create a connected arrow between two elements.
 */
export function createConnectedArrow(
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  fromWidth: number,
  fromHeight: number,
  toX: number,
  toY: number,
  toWidth: number,
  toHeight: number,
  overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
  const startCenterX = fromX + fromWidth / 2;
  const startCenterY = fromY + fromHeight / 2;
  const endCenterX = toX + toWidth / 2;
  const endCenterY = toY + toHeight / 2;

  const dx = endCenterX - startCenterX;
  const dy = endCenterY - startCenterY;

  return createLineOrArrow(
    "arrow",
    startCenterX,
    startCenterY,
    [
      [0, 0],
      [dx, dy],
    ],
    {
      startBinding: { elementId: fromId, focus: 0, gap: 1 },
      endBinding: { elementId: toId, focus: 0, gap: 1 },
      endArrowhead: "arrow",
      ...overrides,
    },
  );
}
