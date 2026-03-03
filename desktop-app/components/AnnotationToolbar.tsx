/**
 * Floating toolbar rendered via `renderTopRightUI` when annotation mode is active.
 */

import React from "react";

interface AnnotationToolbarProps {
  isActive: boolean;
  onToggle: () => void;
  onAddAnnotation: () => void;
  onExportSummary: () => void;
  onClearAnnotations: () => void;
  annotationCount: number;
}

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 4,
  whiteSpace: "nowrap",
};

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  isActive,
  onToggle,
  onAddAnnotation,
  onExportSummary,
  onClearAnnotations,
  annotationCount,
}) => {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        background: isActive ? "rgba(224,49,49,0.08)" : "transparent",
        borderRadius: 8,
        padding: isActive ? "4px 8px" : 0,
        transition: "all 0.2s",
      }}
    >
      <button
        onClick={onToggle}
        title="Toggle Annotation Mode (Cmd+Shift+A)"
        style={{
          ...btnBase,
          background: isActive ? "#e03131" : "var(--color-surface-mid)",
          color: isActive ? "#fff" : "var(--color-on-surface)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            fill={isActive ? "currentColor" : "none"}
          />
          <text
            x="8"
            y="11"
            textAnchor="middle"
            fontSize="8"
            fill={isActive ? (isActive ? "#e03131" : "#fff") : "currentColor"}
            fontWeight="bold"
          >
            A
          </text>
        </svg>
        {isActive ? "标注模式" : "标注"}
      </button>

      {isActive && (
        <>
          <button
            onClick={onAddAnnotation}
            title="Add numbered annotation at canvas center"
            style={{
              ...btnBase,
              background: "#e03131",
              color: "#fff",
            }}
          >
            + 添加标注
          </button>
          <button
            onClick={onExportSummary}
            title="Copy annotation summary to clipboard"
            style={{
              ...btnBase,
              background: "var(--color-surface-mid)",
              color: "var(--color-on-surface)",
            }}
          >
            导出摘要 ({annotationCount})
          </button>
          <button
            onClick={onClearAnnotations}
            title="Remove all annotations"
            style={{
              ...btnBase,
              background: "var(--color-surface-mid)",
              color: "#e03131",
            }}
          >
            清除
          </button>
        </>
      )}
    </div>
  );
};
