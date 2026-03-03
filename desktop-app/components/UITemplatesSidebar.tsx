/**
 * UITemplatesSidebar — a sidebar tab showing built-in and custom UI component
 * templates that can be inserted onto the canvas with a single click.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@excalidraw/excalidraw";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { randomId } from "@excalidraw/common/random";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  builtinTemplates,
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  type UITemplate,
} from "../ui-templates/index";
import {
  getCustomTemplates,
  deleteCustomTemplate,
  type CustomTemplate,
} from "../tauri-bridge";

interface UITemplatesSidebarProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export const SIDEBAR_TAB_ID = "ui-templates";

export const UITemplatesSidebar: React.FC<UITemplatesSidebarProps> = ({
  excalidrawAPI,
}) => {
  const [customTemplates, setCustomTemplates] = useState<UITemplate[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("buttons");

  // Load custom templates from DB
  useEffect(() => {
    getCustomTemplates()
      .then((templates: CustomTemplate[]) => {
        setCustomTemplates(
          templates.map(
            (t): UITemplate => ({
              id: t.id,
              name: t.name,
              category: t.category || "custom",
              custom: true,
              elements: () => {
                try {
                  return JSON.parse(t.data);
                } catch {
                  return [];
                }
              },
            }),
          ),
        );
      })
      .catch(() => {
        // DB not available
      });
  }, []);

  const allTemplates = [...builtinTemplates, ...customTemplates];
  const byCategory = getTemplatesByCategory(allTemplates);

  const insertTemplate = useCallback(
    (template: UITemplate) => {
      if (!excalidrawAPI) {
        return;
      }

      const appState = excalidrawAPI.getAppState();
      // Center in viewport
      const cx = -appState.scrollX + appState.width / 2 / appState.zoom.value;
      const cy = -appState.scrollY + appState.height / 2 / appState.zoom.value;

      const elements = template.elements();

      // Offset elements to center
      const newElements = elements.map((el: any) => ({
        ...el,
        id: el.id || randomId(),
        x: (el.x || 0) + cx - 100,
        y: (el.y || 0) + cy - 50,
        seed: Math.floor(Math.random() * 2000000000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2000000000),
      }));

      const existing = excalidrawAPI.getSceneElementsIncludingDeleted();
      excalidrawAPI.updateScene({
        elements: [...existing, ...newElements],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      excalidrawAPI.setToast({ message: `Inserted: ${template.name}` });
    },
    [excalidrawAPI],
  );

  const handleDeleteCustom = useCallback(async (templateId: string) => {
    try {
      await deleteCustomTemplate(templateId);
      setCustomTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }, []);

  const currentTemplates = byCategory.get(activeCategory) || [];

  return (
    <Sidebar name="ui-templates" docked={false}>
      <Sidebar.Header>UI Templates</Sidebar.Header>
      <div style={{ padding: "8px 12px" }}>
        {/* Category tabs */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 12,
          }}
        >
          {TEMPLATE_CATEGORIES.map((cat) => {
            const count = byCategory.get(cat.id)?.length || 0;
            if (count === 0 && cat.id !== "custom") {
              return null;
            }
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  background:
                    activeCategory === cat.id
                      ? "var(--color-primary)"
                      : "var(--color-surface-mid)",
                  color:
                    activeCategory === cat.id
                      ? "#fff"
                      : "var(--color-on-surface)",
                }}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Template list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {currentTemplates.map((template) => (
            <div
              key={template.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: 6,
                background: "var(--color-surface-low)",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onClick={() => insertTemplate(template)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "var(--color-surface-mid)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "var(--color-surface-low)";
              }}
            >
              <span style={{ fontSize: 13 }}>{template.name}</span>
              {template.custom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCustom(template.id);
                  }}
                  title="Delete custom template"
                  style={{
                    border: "none",
                    background: "none",
                    color: "#e03131",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "2px 4px",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {currentTemplates.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                color: "var(--color-on-surface)",
                opacity: 0.5,
                fontSize: 13,
              }}
            >
              No templates in this category
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
};
