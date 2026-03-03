/**
 * UI Template registry — loads built-in templates and manages custom templates.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { buttonsTemplates } from "./templates/buttons";
import { inputsTemplates } from "./templates/inputs";
import { cardsTemplates } from "./templates/cards";
import { navigationTemplates } from "./templates/navigation";
import { modalsTemplates } from "./templates/modals";
import { layoutsTemplates } from "./templates/layouts";

export interface UITemplate {
  id: string;
  name: string;
  category: string;
  /** Factory that returns elements positioned at (0, 0) */
  elements: () => Partial<ExcalidrawElement>[];
  /** Whether this is a user-created template */
  custom?: boolean;
}

export const TEMPLATE_CATEGORIES = [
  { id: "buttons", label: "按钮" },
  { id: "inputs", label: "输入框" },
  { id: "cards", label: "卡片" },
  { id: "navigation", label: "导航" },
  { id: "modals", label: "弹窗" },
  { id: "layouts", label: "布局" },
  { id: "custom", label: "自定义" },
] as const;

export const builtinTemplates: UITemplate[] = [
  ...buttonsTemplates,
  ...inputsTemplates,
  ...cardsTemplates,
  ...navigationTemplates,
  ...modalsTemplates,
  ...layoutsTemplates,
];

export function getTemplatesByCategory(
  templates: UITemplate[],
): Map<string, UITemplate[]> {
  const map = new Map<string, UITemplate[]>();
  for (const t of templates) {
    const list = map.get(t.category) || [];
    list.push(t);
    map.set(t.category, list);
  }
  return map;
}
