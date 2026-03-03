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

export const modalsTemplates: UITemplate[] = [
  {
    id: "modal-confirm",
    name: "Confirm Dialog",
    category: "modals",
    elements: () => {
      const gid = randomId();
      const cancelId = randomId();
      const cancelTextId = randomId();
      const confirmId = randomId();
      const confirmTextId = randomId();
      return [
        // Backdrop
        {
          id: randomId(),
          type: "rectangle",
          x: -40,
          y: -40,
          width: 480,
          height: 280,
          strokeColor: "transparent",
          backgroundColor: "#00000033",
          groupIds: [gid],
          customData: { uiComponent: "modal-backdrop" },
          ...base,
          fillStyle: "solid",
        },
        // Modal body
        {
          id: randomId(),
          type: "rectangle",
          x: 0,
          y: 0,
          width: 400,
          height: 200,
          strokeColor: "#dee2e6",
          backgroundColor: "#ffffff",
          roundness: { type: 3 },
          groupIds: [gid],
          customData: { uiComponent: "modal" },
          ...base,
        },
        // Title
        {
          id: randomId(),
          type: "text",
          x: 24,
          y: 20,
          width: 180,
          height: 24,
          text: "Confirm Action",
          fontSize: 20,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#212529",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "modal-title" },
          ...base,
        },
        // Description
        {
          id: randomId(),
          type: "text",
          x: 24,
          y: 56,
          width: 352,
          height: 40,
          text: "Are you sure you want to proceed?\nThis action cannot be undone.",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#868e96",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "modal-body" },
          ...base,
        },
        // Cancel button
        {
          id: cancelId,
          type: "rectangle",
          x: 180,
          y: 140,
          width: 100,
          height: 36,
          strokeColor: "#ced4da",
          backgroundColor: "#f1f3f5",
          roundness: { type: 3 },
          boundElements: [{ id: cancelTextId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "button", variant: "secondary" },
          ...base,
        },
        {
          id: cancelTextId,
          type: "text",
          x: 200,
          y: 148,
          width: 60,
          height: 20,
          text: "Cancel",
          fontSize: 14,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#495057",
          backgroundColor: "transparent",
          containerId: cancelId,
          groupIds: [gid],
          ...base,
        },
        // Confirm button
        {
          id: confirmId,
          type: "rectangle",
          x: 292,
          y: 140,
          width: 100,
          height: 36,
          strokeColor: "#228be6",
          backgroundColor: "#228be6",
          roundness: { type: 3 },
          boundElements: [{ id: confirmTextId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "button", variant: "primary" },
          ...base,
        },
        {
          id: confirmTextId,
          type: "text",
          x: 312,
          y: 148,
          width: 60,
          height: 20,
          text: "Confirm",
          fontSize: 14,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#ffffff",
          backgroundColor: "transparent",
          containerId: confirmId,
          groupIds: [gid],
          ...base,
        },
      ];
    },
  },
];
