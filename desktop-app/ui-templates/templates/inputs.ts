import { FONT_FAMILY } from "@excalidraw/common";

import { randomId } from "@excalidraw/common/random";

import type { UITemplate } from "../index";

const base = {
  roughness: 0,
  fillStyle: "solid" as const,
  opacity: 100,
  isDeleted: false,
  locked: false,
  fontFamily: FONT_FAMILY["system-ui"],
};

export const inputsTemplates: UITemplate[] = [
  {
    id: "input-text",
    name: "Text Input",
    category: "inputs",
    elements: () => {
      const gid = randomId();
      const rectId = randomId();
      const labelId = randomId();
      const placeholderId = randomId();
      return [
        {
          id: labelId,
          type: "text",
          x: 0,
          y: 0,
          width: 60,
          height: 16,
          text: "Label",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#495057",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "input-label" },
          ...base,
        },
        {
          id: rectId,
          type: "rectangle",
          x: 0,
          y: 24,
          width: 240,
          height: 40,
          strokeColor: "#ced4da",
          backgroundColor: "#ffffff",
          roundness: { type: 3 },
          boundElements: [{ id: placeholderId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "input" },
          ...base,
        },
        {
          id: placeholderId,
          type: "text",
          x: 12,
          y: 34,
          width: 100,
          height: 20,
          text: "Placeholder...",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "middle",
          strokeColor: "#adb5bd",
          backgroundColor: "transparent",
          containerId: rectId,
          groupIds: [gid],
          customData: { uiComponent: "input-placeholder" },
          ...base,
        },
      ];
    },
  },
  {
    id: "input-search",
    name: "Search Bar",
    category: "inputs",
    elements: () => {
      const gid = randomId();
      const rectId = randomId();
      const textId = randomId();
      return [
        {
          id: rectId,
          type: "rectangle",
          x: 0,
          y: 0,
          width: 300,
          height: 40,
          strokeColor: "#ced4da",
          backgroundColor: "#f8f9fa",
          roundness: { type: 3 },
          boundElements: [{ id: textId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "search-bar" },
          ...base,
        },
        {
          id: textId,
          type: "text",
          x: 36,
          y: 10,
          width: 80,
          height: 20,
          text: "Search...",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "middle",
          strokeColor: "#adb5bd",
          backgroundColor: "transparent",
          containerId: rectId,
          groupIds: [gid],
          customData: { uiComponent: "search-placeholder" },
          ...base,
        },
      ];
    },
  },
];
