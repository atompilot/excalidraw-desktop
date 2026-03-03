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

export const layoutsTemplates: UITemplate[] = [
  {
    id: "layout-two-col",
    name: "Two Column Layout",
    category: "layouts",
    elements: () => {
      const gid = randomId();
      return [
        // Left column
        {
          id: randomId(),
          type: "rectangle",
          x: 0,
          y: 0,
          width: 280,
          height: 400,
          strokeColor: "#dee2e6",
          backgroundColor: "#f8f9fa",
          strokeStyle: "dashed",
          groupIds: [gid],
          customData: { uiComponent: "layout-column", column: 1 },
          ...base,
        },
        {
          id: randomId(),
          type: "text",
          x: 100,
          y: 180,
          width: 80,
          height: 20,
          text: "Column 1",
          fontSize: 14,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#adb5bd",
          backgroundColor: "transparent",
          groupIds: [gid],
          ...base,
        },
        // Right column
        {
          id: randomId(),
          type: "rectangle",
          x: 300,
          y: 0,
          width: 280,
          height: 400,
          strokeColor: "#dee2e6",
          backgroundColor: "#f8f9fa",
          strokeStyle: "dashed",
          groupIds: [gid],
          customData: { uiComponent: "layout-column", column: 2 },
          ...base,
        },
        {
          id: randomId(),
          type: "text",
          x: 400,
          y: 180,
          width: 80,
          height: 20,
          text: "Column 2",
          fontSize: 14,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#adb5bd",
          backgroundColor: "transparent",
          groupIds: [gid],
          ...base,
        },
      ];
    },
  },
  {
    id: "layout-form",
    name: "Form Layout",
    category: "layouts",
    elements: () => {
      const gid = randomId();
      const fields = ["Name", "Email", "Password"];
      const els: any[] = [
        {
          id: randomId(),
          type: "rectangle",
          x: 0,
          y: 0,
          width: 340,
          height: fields.length * 80 + 80,
          strokeColor: "#dee2e6",
          backgroundColor: "#ffffff",
          roundness: { type: 3 },
          groupIds: [gid],
          customData: { uiComponent: "form" },
          ...base,
        },
        {
          id: randomId(),
          type: "text",
          x: 20,
          y: 16,
          width: 120,
          height: 24,
          text: "Sign Up",
          fontSize: 20,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#212529",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "form-title" },
          ...base,
        },
      ];

      fields.forEach((field, i) => {
        const yOffset = 56 + i * 80;
        const inputId = randomId();
        els.push(
          {
            id: randomId(),
            type: "text",
            x: 20,
            y: yOffset,
            width: 80,
            height: 16,
            text: field,
            fontSize: 13,
            textAlign: "left",
            verticalAlign: "top",
            strokeColor: "#495057",
            backgroundColor: "transparent",
            groupIds: [gid],
            ...base,
          },
          {
            id: inputId,
            type: "rectangle",
            x: 20,
            y: yOffset + 22,
            width: 300,
            height: 38,
            strokeColor: "#ced4da",
            backgroundColor: "#ffffff",
            roundness: { type: 3 },
            groupIds: [gid],
            customData: { uiComponent: "input", field: field.toLowerCase() },
            ...base,
          },
        );
      });

      // Submit button
      const btnId = randomId();
      const btnTextId = randomId();
      const btnY = 56 + fields.length * 80;
      els.push(
        {
          id: btnId,
          type: "rectangle",
          x: 20,
          y: btnY,
          width: 300,
          height: 40,
          strokeColor: "#228be6",
          backgroundColor: "#228be6",
          roundness: { type: 3 },
          boundElements: [{ id: btnTextId, type: "text" }],
          groupIds: [gid],
          customData: { uiComponent: "button", variant: "primary" },
          ...base,
        },
        {
          id: btnTextId,
          type: "text",
          x: 130,
          y: btnY + 10,
          width: 80,
          height: 20,
          text: "Submit",
          fontSize: 16,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#ffffff",
          backgroundColor: "transparent",
          containerId: btnId,
          groupIds: [gid],
          ...base,
        },
      );

      return els;
    },
  },
];
