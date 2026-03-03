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

export const navigationTemplates: UITemplate[] = [
  {
    id: "nav-top",
    name: "Top Navigation Bar",
    category: "navigation",
    elements: () => {
      const gid = randomId();
      return [
        {
          id: randomId(),
          type: "rectangle",
          x: 0,
          y: 0,
          width: 600,
          height: 56,
          strokeColor: "#dee2e6",
          backgroundColor: "#ffffff",
          groupIds: [gid],
          customData: { uiComponent: "navbar" },
          ...base,
        },
        {
          id: randomId(),
          type: "text",
          x: 16,
          y: 16,
          width: 60,
          height: 24,
          text: "Logo",
          fontSize: 20,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#212529",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "navbar-logo" },
          ...base,
          fontFamily: FONT_FAMILY["system-ui"],
        },
        {
          id: randomId(),
          type: "text",
          x: 120,
          y: 18,
          width: 40,
          height: 20,
          text: "Home",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#228be6",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "navbar-link", active: true },
          ...base,
        },
        {
          id: randomId(),
          type: "text",
          x: 180,
          y: 18,
          width: 50,
          height: 20,
          text: "About",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#495057",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "navbar-link" },
          ...base,
        },
        {
          id: randomId(),
          type: "text",
          x: 250,
          y: 18,
          width: 60,
          height: 20,
          text: "Contact",
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: "#495057",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: { uiComponent: "navbar-link" },
          ...base,
        },
      ];
    },
  },
  {
    id: "nav-sidebar",
    name: "Sidebar Navigation",
    category: "navigation",
    elements: () => {
      const gid = randomId();
      const items = ["Dashboard", "Projects", "Settings", "Help"];
      const els: any[] = [
        {
          id: randomId(),
          type: "rectangle",
          x: 0,
          y: 0,
          width: 200,
          height: 40 * items.length + 20,
          strokeColor: "#dee2e6",
          backgroundColor: "#f8f9fa",
          groupIds: [gid],
          customData: { uiComponent: "sidebar" },
          ...base,
        },
      ];
      items.forEach((item, i) => {
        els.push({
          id: randomId(),
          type: "text",
          x: 16,
          y: 10 + i * 40,
          width: 160,
          height: 20,
          text: item,
          fontSize: 14,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: i === 0 ? "#228be6" : "#495057",
          backgroundColor: "transparent",
          groupIds: [gid],
          customData: {
            uiComponent: "sidebar-item",
            active: i === 0,
          },
          ...base,
        });
      });
      return els;
    },
  },
];
