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

export const buttonsTemplates: UITemplate[] = [
  {
    id: "btn-primary",
    name: "Primary Button",
    category: "buttons",
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
          width: 120,
          height: 40,
          strokeColor: "#228be6",
          backgroundColor: "#228be6",
          roundness: { type: 3 },
          boundElements: [{ id: textId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "button", variant: "primary" },
          ...base,
        },
        {
          id: textId,
          type: "text",
          x: 30,
          y: 10,
          width: 60,
          height: 20,
          text: "Button",
          fontSize: 16,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#ffffff",
          backgroundColor: "transparent",
          containerId: rectId,
          groupIds: [gid],
          customData: { uiComponent: "button-label" },
          ...base,
        },
      ];
    },
  },
  {
    id: "btn-secondary",
    name: "Secondary Button",
    category: "buttons",
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
          width: 120,
          height: 40,
          strokeColor: "#868e96",
          backgroundColor: "#f1f3f5",
          roundness: { type: 3 },
          boundElements: [{ id: textId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "button", variant: "secondary" },
          ...base,
        },
        {
          id: textId,
          type: "text",
          x: 30,
          y: 10,
          width: 60,
          height: 20,
          text: "Button",
          fontSize: 16,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#495057",
          backgroundColor: "transparent",
          containerId: rectId,
          groupIds: [gid],
          customData: { uiComponent: "button-label" },
          ...base,
        },
      ];
    },
  },
  {
    id: "btn-danger",
    name: "Danger Button",
    category: "buttons",
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
          width: 120,
          height: 40,
          strokeColor: "#e03131",
          backgroundColor: "#e03131",
          roundness: { type: 3 },
          boundElements: [{ id: textId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "button", variant: "danger" },
          ...base,
        },
        {
          id: textId,
          type: "text",
          x: 30,
          y: 10,
          width: 60,
          height: 20,
          text: "Delete",
          fontSize: 16,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#ffffff",
          backgroundColor: "transparent",
          containerId: rectId,
          groupIds: [gid],
          customData: { uiComponent: "button-label" },
          ...base,
        },
      ];
    },
  },
];
