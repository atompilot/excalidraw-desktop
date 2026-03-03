import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  TTDDialogTrigger,
  CaptureUpdateAction,
  useEditorInterface,
  exportToCanvas,
} from "@excalidraw/excalidraw";
import {
  EVENT,
  FONT_FAMILY,
  THEME,
  resolvablePromise,
} from "@excalidraw/common";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { useHandleLibrary } from "@excalidraw/excalidraw/data/library";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { useCallbackRefState } from "@excalidraw/excalidraw/hooks/useCallbackRefState";
import { t } from "@excalidraw/excalidraw/i18n";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { isElementLink } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import {
  setOnMarkdownRendered,
  elementWithCanvasCache,
} from "@excalidraw/element";
import CustomStats from "excalidraw-app/CustomStats";
import { updateStaleImageStatuses } from "excalidraw-app/data/FileManager";
import { useHandleAppTheme } from "excalidraw-app/useHandleAppTheme";
import { randomId } from "@excalidraw/common/random";
import "excalidraw-app/index.scss";

import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import { Provider, useAtomValue, appJotaiStore } from "./app-jotai";
import { useAppLangCode } from "./app-language/language-state";
import {
  createAnnotation,
  generateAnnotationSummary,
  getAnnotationElementIds,
  syncCounterFromScene,
} from "./annotation-mode";
import { sendToClaudeCode } from "./claude-code-bridge";
import { AnnotationToolbar } from "./components/AnnotationToolbar";
import { DimensionOverlay } from "./components/DimensionOverlay";
import { UITemplatesSidebar } from "./components/UITemplatesSidebar";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { importFromLocalStorage } from "./data/localStorage";
import { DesktopMainMenu } from "./DesktopMainMenu";
import {
  getDimensionInfo,
  computeGaps,
  solidifyDimension,
  solidifyGap,
} from "./dimension-utils";
import {
  readFile,
  writeFile,
  openFileDialog,
  saveFileDialog,
  onFileOpen,
  setWindowTitle,
  addRecentFile,
  onMcpExportRequest,
  mcpExportComplete,
  writeBinaryFile,
  mcpSetCurrentFile,
  getSessionState,
  setSessionState,
  captureInteractive,
  saveCustomTemplate,
  copyToClipboard,
} from "./tauri-bridge";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

const PERIODIC_SAVE_MS = 30000;

const getElementsSignature = (
  elements: readonly { id: string; version: number }[],
) => {
  let hash = elements.length;
  for (const el of elements) {
    hash = hash * 31 + el.version;
  }
  return String(hash);
};

const ExcalidrawWrapper = () => {
  const [errorMessage, setErrorMessage] = useState("");

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();
  const [langCode] = useAppLangCode();
  useEditorInterface();

  // File state
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const currentFilePathRef = useRef<string | null>(null);
  const isModifiedRef = useRef(false);

  const savedSignatureRef = useRef<string>("");

  // Annotation mode state
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationCount, setAnnotationCount] = useState(0);

  // Dimension overlay state
  const [showDimensions, setShowDimensions] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    currentFilePathRef.current = currentFilePath;
  }, [currentFilePath]);
  useEffect(() => {
    isModifiedRef.current = isModified;
  }, [isModified]);

  // initial state
  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  // Update window title
  const updateTitle = useCallback((fileName?: string, modified?: boolean) => {
    const name = fileName || "Untitled";
    const mod = modified ? "* " : "";
    setWindowTitle(`${mod}${name} - Excalidraw`);
  }, []);

  useEffect(() => {
    const name = currentFilePath
      ? currentFilePath.split(/[/\\]/).pop()?.replace(".excalidraw", "") ||
        "Untitled"
      : "Untitled";
    updateTitle(name, isModified);
  }, [currentFilePath, isModified, updateTitle]);

  // Load file from path
  const loadFile = useCallback(
    async (filePath: string) => {
      if (!excalidrawAPI) {
        return;
      }
      try {
        const fileData = await readFile(filePath);
        const blob = new Blob([fileData.content], {
          type: "application/json",
        });
        // loadFromBlob throws for non-excalidraw files, so the result is always scene data
        const data = (await loadFromBlob(
          blob,
          null,
          null,
        )) as RestoredDataState;

        excalidrawAPI.updateScene({
          elements: data.elements || [],
          appState: {
            ...data.appState,
            isLoading: false,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        if (data.files) {
          excalidrawAPI.addFiles(Object.values(data.files));
        }

        setCurrentFilePath(filePath);
        savedSignatureRef.current = getElementsSignature(data.elements || []);
        setIsModified(false);
        await addRecentFile(filePath, fileData.name);
        await setSessionState({ last_file_path: filePath });
      } catch (error: any) {
        console.error("Failed to load file:", error);
        setErrorMessage(
          `Failed to open file: ${error.message || "Unknown error"}`,
        );
      }
    },
    [excalidrawAPI],
  );

  // Save file
  const saveFile = useCallback(async () => {
    if (!excalidrawAPI || !currentFilePathRef.current) {
      return;
    }
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const json = serializeAsJSON(elements, appState, files, "local");
      await writeFile(currentFilePathRef.current, json);
      savedSignatureRef.current = getElementsSignature(elements);
      setIsModified(false);
    } catch (error: any) {
      console.error("Failed to save file:", error);
      setErrorMessage(
        `Failed to save file: ${error.message || "Unknown error"}`,
      );
    }
  }, [excalidrawAPI]);

  // Save As
  const saveFileAs = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    const defaultName = currentFilePathRef.current
      ? currentFilePathRef.current.split(/[/\\]/).pop()
      : "drawing.excalidraw";
    const path = await saveFileDialog(defaultName);
    if (path) {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const json = serializeAsJSON(elements, appState, files, "local");
      try {
        await writeFile(path, json);
        setCurrentFilePath(path);
        savedSignatureRef.current = getElementsSignature(elements);
        setIsModified(false);
        const name =
          path.split(/[/\\]/).pop()?.replace(".excalidraw", "") || "drawing";
        await addRecentFile(path, name);
        await setSessionState({ last_file_path: path });
      } catch (error: any) {
        console.error("Failed to save file:", error);
        setErrorMessage(
          `Failed to save file: ${error.message || "Unknown error"}`,
        );
      }
    }
  }, [excalidrawAPI]);

  // Open file
  const openFile = useCallback(async () => {
    const path = await openFileDialog();
    if (path) {
      await loadFile(path);
    }
  }, [loadFile]);

  // Initialize scene from localStorage
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const localDataState = importFromLocalStorage();
    const restoredAppState = restoreAppState(localDataState?.appState, null);
    const scene: ExcalidrawInitialDataState = {
      elements: restoreElements(localDataState?.elements, null, {
        repairBindings: true,
        deleteInvisibleElements: true,
      }),
      appState: {
        ...restoredAppState,
        // Default to system-ui for desktop app (override old Excalifont default)
        currentItemFontFamily:
          !localDataState?.appState ||
          restoredAppState.currentItemFontFamily === FONT_FAMILY.Excalifont
            ? FONT_FAMILY["system-ui"]
            : restoredAppState.currentItemFontFamily,
      },
    };

    // Load images from IndexedDB
    const fileIds =
      scene.elements?.reduce((acc, element) => {
        if (isInitializedImageElement(element)) {
          return acc.concat(element.fileId);
        }
        return acc;
      }, [] as FileId[]) || [];

    if (fileIds.length) {
      LocalData.fileStorage
        .getFiles(fileIds)
        .then(({ loadedFiles, erroredFiles }) => {
          if (loadedFiles.length) {
            excalidrawAPI.addFiles(loadedFiles);
          }
          updateStaleImageStatuses({
            excalidrawAPI,
            erroredFiles,
            elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
          });
        });
      LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
    }

    initialStatePromiseRef.current.promise.resolve(scene);
  }, [excalidrawAPI]);

  // Listen for file open events from Tauri (file association / single instance)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onFileOpen((filePath) => {
      loadFile(filePath);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [loadFile]);

  // Restore last opened file on startup
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!excalidrawAPI || hasRestoredRef.current) {
      return;
    }
    hasRestoredRef.current = true;

    // Only restore if no file was passed via CLI args (file association)
    // The file-open event fires within ~500ms if a file was passed
    const timer = setTimeout(async () => {
      if (currentFilePathRef.current) {
        return; // Already loaded a file (via CLI args or file association)
      }
      try {
        const session = await getSessionState();
        if (session.last_file_path) {
          await loadFile(session.last_file_path);
        }
      } catch {
        // Session state not available, ignore
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [excalidrawAPI, loadFile]);

  // Periodic save
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        currentFilePathRef.current &&
        isModifiedRef.current &&
        excalidrawAPI
      ) {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const json = serializeAsJSON(elements, appState, files, "local");
        writeFile(currentFilePathRef.current, json).then(() => {
          setIsModified(false);
        });
      }
    }, PERIODIC_SAVE_MS);

    return () => clearInterval(interval);
  }, [excalidrawAPI]);

  // Unload handler
  useEffect(() => {
    const onUnload = () => {
      LocalData.flushSave();
    };
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BEFORE_UNLOAD, onUnload, false);
    return () => {
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BEFORE_UNLOAD, onUnload, false);
    };
  }, []);

  // Connect markdown renderer callback to invalidate canvas cache
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    setOnMarkdownRendered(() => {
      // Invalidate canvas cache for markdown text elements
      const elements = excalidrawAPI.getSceneElements();
      for (const el of elements) {
        if (el.type === "text" && el.customData?.markdown === true) {
          elementWithCanvasCache.delete(el);
        }
      }
      // Trigger a scene update to re-render
      excalidrawAPI.updateScene({
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
    return () => setOnMarkdownRendered(null);
  }, [excalidrawAPI]);

  // Sync current file path to MCP HTTP server
  useEffect(() => {
    mcpSetCurrentFile(currentFilePath).catch(() => {
      // MCP server may not be running, ignore
    });
  }, [currentFilePath]);

  // Handle MCP export requests from the HTTP server
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    let unlisten: (() => void) | undefined;

    onMcpExportRequest(async (request) => {
      try {
        // If the request is for a specific file that's not currently loaded,
        // we need to load it first
        let elements = excalidrawAPI.getSceneElements();
        let appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();

        if (
          request.filepath &&
          currentFilePathRef.current !== request.filepath
        ) {
          // Load the requested file temporarily
          try {
            const fileData = await readFile(request.filepath);
            const parsed = JSON.parse(fileData.content);
            elements = parsed.elements || [];
            appState = {
              ...appState,
              ...parsed.appState,
              exportScale: request.scale || 2,
            };
          } catch (loadErr: any) {
            await mcpExportComplete(
              request.requestId,
              false,
              undefined,
              `Failed to load file: ${loadErr.message}`,
            );
            return;
          }
        }

        const nonDeleted = elements.filter(
          (el: { isDeleted?: boolean }) => !el.isDeleted,
        );

        if (nonDeleted.length === 0) {
          await mcpExportComplete(
            request.requestId,
            false,
            undefined,
            "No elements to export",
          );
          return;
        }

        // Export to canvas
        const canvas = await exportToCanvas(
          nonDeleted,
          { ...appState, exportScale: request.scale || 2 },
          files,
          {
            exportBackground: request.background,
            viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
          },
        );

        // Convert canvas to PNG blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          }, "image/png");
        });

        // Convert to base64 and write via Tauri
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        await writeBinaryFile(request.outputPath, base64);
        await mcpExportComplete(request.requestId, true, request.outputPath);
      } catch (err: any) {
        console.error("MCP export failed:", err);
        await mcpExportComplete(
          request.requestId,
          false,
          undefined,
          err.message || "Unknown export error",
        );
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [excalidrawAPI]);

  // Copy file path to clipboard
  const copyFilePath = useCallback(() => {
    if (currentFilePathRef.current) {
      copyToClipboard(currentFilePathRef.current);
      excalidrawAPI?.setToast({
        message: `Path copied: ${currentFilePathRef.current}`,
      });
    } else {
      excalidrawAPI?.setToast({ message: "No file path (unsaved file)" });
    }
  }, [excalidrawAPI]);

  // Toggle markdown rendering for selected text elements
  const toggleMarkdown = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const state = excalidrawAPI.getAppState();
    const selectedIds = Object.keys(state.selectedElementIds || {}).filter(
      (id) => state.selectedElementIds[id],
    );
    if (selectedIds.length === 0) {
      return;
    }

    const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
    let toggled = 0;
    const updatedElements = elements.map((el) => {
      if (selectedIds.includes(el.id) && el.type === "text") {
        const isMarkdown = el.customData?.markdown === true;
        toggled++;
        return newElementWith(el, {
          customData: { ...el.customData, markdown: !isMarkdown },
        });
      }
      return el;
    });

    if (toggled > 0) {
      excalidrawAPI.updateScene({
        elements: updatedElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidrawAPI.setToast({
        message: `Toggled markdown on ${toggled} element(s)`,
      });
    }
  }, [excalidrawAPI]);

  // Copy selected element IDs to clipboard
  const copyElementIds = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      (id) => appState.selectedElementIds[id],
    );
    if (selectedIds.length === 0) {
      excalidrawAPI.setToast({ message: "No elements selected" });
      return;
    }
    copyToClipboard(selectedIds.join(", "));
    excalidrawAPI.setToast({
      message: `Copied ${selectedIds.length} element ID(s)`,
    });
  }, [excalidrawAPI]);

  // --- Annotation Mode actions ---

  const toggleAnnotationMode = useCallback(() => {
    setAnnotationMode((prev) => {
      if (!prev && excalidrawAPI) {
        // Entering annotation mode — sync counter
        syncCounterFromScene(excalidrawAPI.getSceneElements());
      }
      return !prev;
    });
  }, [excalidrawAPI]);

  const addAnnotation = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const cx = -appState.scrollX + appState.width / 2 / appState.zoom.value;
    const cy = -appState.scrollY + appState.height / 2 / appState.zoom.value;

    syncCounterFromScene(excalidrawAPI.getSceneElements());
    const newElements = createAnnotation(cx, cy);
    const existing = excalidrawAPI.getSceneElementsIncludingDeleted();
    excalidrawAPI.updateScene({
      elements: [...existing, ...newElements],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    // Update count
    setAnnotationCount(
      getAnnotationElementIds([...existing, ...newElements]).length,
    );
  }, [excalidrawAPI]);

  const exportAnnotationSummary = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const elements = excalidrawAPI.getSceneElements();
    const fileName = currentFilePathRef.current
      ? currentFilePathRef.current.split(/[/\\]/).pop()
      : undefined;
    const { markdown, items } = generateAnnotationSummary(elements, fileName);

    if (items.length === 0) {
      excalidrawAPI.setToast({ message: "No annotations found" });
      return;
    }
    copyToClipboard(markdown);
    excalidrawAPI.setToast({
      message: `Copied ${items.length} annotation(s) to clipboard`,
    });
  }, [excalidrawAPI]);

  const clearAnnotations = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
    const ids = getAnnotationElementIds(elements);
    if (ids.length === 0) {
      return;
    }
    const updated = elements.map((el) =>
      ids.includes(el.id) ? newElementWith(el, { isDeleted: true }) : el,
    );
    excalidrawAPI.updateScene({
      elements: updated,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setAnnotationCount(0);
    excalidrawAPI.setToast({ message: `Cleared ${ids.length} annotation(s)` });
  }, [excalidrawAPI]);

  // --- Dimension overlay actions ---

  const toggleDimensions = useCallback(() => {
    setShowDimensions((prev) => !prev);
  }, []);

  const solidifyDimensions = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      (id) => appState.selectedElementIds[id],
    );
    const allElements = excalidrawAPI.getSceneElements();
    const selected = allElements.filter(
      (el) => selectedIds.includes(el.id) && !el.isDeleted,
    );
    if (selected.length === 0) {
      return;
    }

    const newElements: any[] = [];
    for (const el of selected) {
      newElements.push(...solidifyDimension(getDimensionInfo(el)));
    }
    if (selected.length >= 2) {
      for (const gap of computeGaps(selected)) {
        newElements.push(...solidifyGap(gap));
      }
    }

    const existing = excalidrawAPI.getSceneElementsIncludingDeleted();
    excalidrawAPI.updateScene({
      elements: [...existing, ...newElements],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    excalidrawAPI.setToast({
      message: `Solidified ${newElements.length} dimension element(s)`,
    });
  }, [excalidrawAPI]);

  // --- Screenshot & Send to Claude Code ---

  const captureScreenshot = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    try {
      const ts = Date.now();
      const outputPath = `/tmp/excalidraw-capture-${ts}.png`;
      const path = await captureInteractive(outputPath);

      // Read the captured PNG and import as image
      const response = await fetch(`asset://localhost/${path}`).catch(
        () => null,
      );
      if (!response) {
        // Fallback: just notify
        excalidrawAPI.setToast({ message: `Screenshot saved: ${path}` });
        return;
      }
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Create data URL
      let binary = "";
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const dataUrl = `data:image/png;base64,${btoa(binary)}` as any;
      const fileId = randomId() as any;

      // Add file
      excalidrawAPI.addFiles([
        {
          id: fileId,
          dataURL: dataUrl,
          mimeType: "image/png",
          created: Date.now(),
          lastRetrieved: Date.now(),
        },
      ]);

      // Get viewport center
      const appState = excalidrawAPI.getAppState();
      const cx = -appState.scrollX + appState.width / 2 / appState.zoom.value;
      const cy = -appState.scrollY + appState.height / 2 / appState.zoom.value;

      // Create image element
      const imgEl: any = {
        id: randomId(),
        type: "image",
        x: cx - 200,
        y: cy - 150,
        width: 400,
        height: 300,
        fileId,
        status: "saved",
        isDeleted: false,
        roughness: 0,
        opacity: 100,
        customData: { screenshot: true, sourcePath: path },
        seed: Math.floor(Math.random() * 2000000000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2000000000),
      };

      const existing = excalidrawAPI.getSceneElementsIncludingDeleted();
      excalidrawAPI.updateScene({
        elements: [...existing, imgEl],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidrawAPI.setToast({ message: "Screenshot imported to canvas" });
    } catch (err: any) {
      if (err.message?.includes("cancelled")) {
        // User cancelled, do nothing
        return;
      }
      console.error("Screenshot failed:", err);
      excalidrawAPI.setToast({
        message: `Screenshot failed: ${err.message || "Unknown error"}`,
      });
    }
  }, [excalidrawAPI]);

  const handleSendToClaudeCode = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    try {
      const { pngPath } = await sendToClaudeCode(excalidrawAPI);
      excalidrawAPI.setToast({
        message: `Exported to ${pngPath} — prompt copied to clipboard`,
      });
    } catch (err: any) {
      console.error("Send to Claude Code failed:", err);
      excalidrawAPI.setToast({
        message: `Export failed: ${err.message || "Unknown error"}`,
      });
    }
  }, [excalidrawAPI]);

  // --- Copy excalidraw file format guide ---

  const copyExcalidrawGuide = useCallback(() => {
    const guide = `# .excalidraw 文件格式说明

.excalidraw 文件是 JSON 格式，结构如下：

\`\`\`json
{
  "type": "excalidraw",
  "version": 2,
  "source": "...",
  "elements": [...],   // 所有绘图元素
  "appState": {...},    // 编辑器状态（视口、主题等）
  "files": {...}        // 嵌入的图片等二进制资源（base64）
}
\`\`\`

## elements 数组

每个元素是一个对象，常见属性：

| 属性 | 说明 |
|------|------|
| id | 唯一标识符（nanoid） |
| type | 元素类型：rectangle, ellipse, diamond, line, arrow, text, freedraw, image, frame, embeddable |
| x, y | 左上角坐标 |
| width, height | 宽高 |
| angle | 旋转弧度 |
| strokeColor | 边框颜色（如 "#1e1e1e"） |
| backgroundColor | 填充颜色（如 "transparent"） |
| fillStyle | 填充风格：hachure, cross-hatch, solid |
| strokeWidth | 线宽：1（thin）, 2（bold）, 4（extra bold） |
| roughness | 粗糙度：0（精确）, 1（手绘风格）, 2（更粗糙） |
| opacity | 不透明度 0-100 |
| groupIds | 所属分组 ID 数组 |
| boundElements | 绑定的元素（如箭头绑定到矩形） |
| isDeleted | 是否已删除（软删除） |
| customData | 自定义元数据对象，可存放任意键值 |

### text 元素额外属性
- \`text\`: 文字内容
- \`fontSize\`: 字号（默认 20）
- \`fontFamily\`: 字体族 ID（1=Excalifont, 5=system-ui）
- \`textAlign\`: left / center / right
- \`verticalAlign\`: top / middle / bottom
- \`containerId\`: 如果文字绑定在容器内，指向容器元素 id

### line / arrow 额外属性
- \`points\`: 点坐标数组 [[x,y], ...]，相对于元素 (x,y)
- \`startBinding\` / \`endBinding\`: 箭头绑定的目标元素
- \`startArrowhead\` / \`endArrowhead\`: null / "arrow" / "dot" / "bar"

### image 元素额外属性
- \`fileId\`: 对应 files 中的 key
- \`scale\`: [scaleX, scaleY]

## 修改指南

1. **移动元素**：修改 x, y
2. **调整大小**：修改 width, height
3. **改颜色**：修改 strokeColor / backgroundColor
4. **改文字**：修改 text 元素的 text 字段
5. **添加元素**：向 elements 数组追加新对象，id 用 nanoid 生成（20 位字母数字）
6. **删除元素**：设 isDeleted: true 或从数组中移除
7. **分组**：给多个元素设相同的 groupIds
8. **连接箭头**：设置 startBinding/endBinding 指向目标元素 id
9. **version/versionNonce**：每次修改后递增 version，重新随机 versionNonce`;

    copyToClipboard(guide);
    excalidrawAPI?.setToast({ message: "excalidraw 文件说明已复制到剪贴板" });
  }, [excalidrawAPI]);

  // --- Save selection as template ---

  const saveAsTemplate = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(
      (id) => appState.selectedElementIds[id],
    );
    if (selectedIds.length === 0) {
      excalidrawAPI.setToast({ message: "No elements selected" });
      return;
    }
    const elements = excalidrawAPI
      .getSceneElements()
      .filter((el) => selectedIds.includes(el.id));

    // Normalize positions to (0, 0)
    const minX = Math.min(...elements.map((el) => el.x));
    const minY = Math.min(...elements.map((el) => el.y));
    const normalized = elements.map((el) => ({
      ...el,
      x: el.x - minX,
      y: el.y - minY,
    }));

    const name = prompt("Template name:") || "Custom Template";
    const id = randomId();
    await saveCustomTemplate(id, name, "custom", JSON.stringify(normalized));
    excalidrawAPI.setToast({ message: `Saved template: ${name}` });
  }, [excalidrawAPI]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.metaKey || e.ctrlKey;
      if (ctrlOrCmd && e.key === "o") {
        e.preventDefault();
        e.stopPropagation();
        openFile();
      } else if (ctrlOrCmd && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        saveFileAs();
      } else if (ctrlOrCmd && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (currentFilePathRef.current) {
          saveFile();
        } else {
          saveFileAs();
        }
      } else if (ctrlOrCmd && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        e.stopPropagation();
        toggleAnnotationMode();
      } else if (ctrlOrCmd && e.shiftKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        e.stopPropagation();
        toggleDimensions();
      } else if (ctrlOrCmd && e.shiftKey && e.key === "5") {
        e.preventDefault();
        e.stopPropagation();
        captureScreenshot();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    openFile,
    saveFile,
    saveFileAs,
    toggleAnnotationMode,
    toggleDimensions,
    captureScreenshot,
  ]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    // Auto-mark new text elements as markdown
    const unmarkedTexts = elements.filter(
      (el) =>
        el.type === "text" &&
        !el.isDeleted &&
        el.customData?.markdown === undefined,
    );
    if (unmarkedTexts.length > 0 && excalidrawAPI) {
      const allElements = excalidrawAPI
        .getSceneElementsIncludingDeleted()
        .map((el) => {
          if (
            el.type === "text" &&
            !el.isDeleted &&
            el.customData?.markdown === undefined
          ) {
            return newElementWith(el, {
              customData: { ...el.customData, markdown: true },
            });
          }
          return el;
        });
      excalidrawAPI.updateScene({
        elements: allElements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }

    const nonDeleted = elements.filter((el) => !el.isDeleted);
    const sig = getElementsSignature(nonDeleted);
    if (sig !== savedSignatureRef.current) {
      setIsModified(true);
    }

    // Update annotation count
    setAnnotationCount(getAnnotationElementIds(nonDeleted).length);

    // Save to localStorage for crash recovery
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;
          const allElements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements: allElements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  return (
    <div style={{ height: "100%" }} className="excalidraw-app">
      <DimensionOverlay
        excalidrawAPI={excalidrawAPI}
        visible={showDimensions}
      />
      <Excalidraw
        excalidrawAPI={excalidrawRefCallback}
        onChange={onChange}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={false}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend: undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        renderTopRightUI={() => (
          <AnnotationToolbar
            isActive={annotationMode}
            onToggle={toggleAnnotationMode}
            onAddAnnotation={addAnnotation}
            onExportSummary={exportAnnotationSummary}
            onClearAnnotations={clearAnnotations}
            annotationCount={annotationCount}
          />
        )}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        customContextMenuItems={(type) => {
          const items: {
            label: string;
            customAction: () => void;
            predicate?: () => boolean;
          }[] = [];
          items.push({
            label: "复制文件路径",
            customAction: () => copyFilePath(),
            predicate: () => !!currentFilePathRef.current,
          });
          items.push({
            label: annotationMode ? "退出标注模式" : "进入标注模式",
            customAction: () => toggleAnnotationMode(),
          });
          items.push({
            label: "在此添加标注",
            customAction: () => addAnnotation(),
            predicate: () => annotationMode,
          });
          items.push({
            label: "导出标注摘要",
            customAction: () => exportAnnotationSummary(),
            predicate: () => annotationCount > 0,
          });

          items.push({
            label: showDimensions ? "隐藏尺寸标注" : "显示尺寸标注",
            customAction: () => toggleDimensions(),
          });

          items.push({
            label: "截图",
            customAction: () => captureScreenshot(),
          });
          items.push({
            label: "发送给 Claude Code",
            customAction: () => handleSendToClaudeCode(),
          });
          items.push({
            label: "excalidraw 文件说明",
            customAction: () => copyExcalidrawGuide(),
          });

          if (type === "element") {
            items.push({
              label: "复制元素 ID",
              customAction: () => copyElementIds(),
            });
            items.push({
              label: "切换 Markdown",
              customAction: () => toggleMarkdown(),
              predicate: () => {
                if (!excalidrawAPI) {
                  return false;
                }
                const state = excalidrawAPI.getAppState();
                const selectedIds = Object.keys(
                  state.selectedElementIds || {},
                ).filter((id) => state.selectedElementIds[id]);
                return excalidrawAPI
                  .getSceneElements()
                  .some(
                    (el) => selectedIds.includes(el.id) && el.type === "text",
                  );
              },
            });
            items.push({
              label: "固化尺寸",
              customAction: () => solidifyDimensions(),
              predicate: () => {
                if (!excalidrawAPI) {
                  return false;
                }
                const state = excalidrawAPI.getAppState();
                return Object.values(state.selectedElementIds || {}).some(
                  Boolean,
                );
              },
            });
            items.push({
              label: "保存为模板",
              customAction: () => saveAsTemplate(),
            });
          }
          return items;
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <DesktopMainMenu
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          onOpenFile={openFile}
          onSaveFile={() => {
            if (currentFilePath) {
              saveFile();
            } else {
              saveFileAs();
            }
          }}
          onSaveFileAs={saveFileAs}
          onLoadFile={loadFile}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
        </OverwriteConfirmDialog>

        <TTDDialogTrigger />
        <UITemplatesSidebar excalidrawAPI={excalidrawAPI} />
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: "打开文件",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["open", "load", "file", "打开"],
              perform: () => openFile(),
            },
            {
              label: "保存",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["save", "file", "保存"],
              perform: () => {
                if (currentFilePath) {
                  saveFile();
                } else {
                  saveFileAs();
                }
              },
            },
            {
              label: "另存为",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["save", "as", "file", "另存为"],
              perform: () => saveFileAs(),
            },
            {
              label: "复制文件路径",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["copy", "path", "file", "复制", "路径"],
              perform: () => copyFilePath(),
            },
            {
              label: "复制元素 ID",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["copy", "id", "element", "复制", "元素"],
              perform: () => copyElementIds(),
            },
            {
              label: "切换 Markdown",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["markdown", "md", "render", "切换"],
              perform: () => toggleMarkdown(),
            },
            {
              label: "切换标注模式",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["annotate", "annotation", "标注", "模式"],
              perform: () => toggleAnnotationMode(),
            },
            {
              label: "添加标注",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["annotate", "add", "添加", "标注"],
              perform: () => addAnnotation(),
            },
            {
              label: "导出标注摘要",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["export", "annotation", "summary", "导出", "摘要"],
              perform: () => exportAnnotationSummary(),
            },
            {
              label: "清除所有标注",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["clear", "annotation", "清除", "标注"],
              perform: () => clearAnnotations(),
            },
            {
              label: "切换尺寸标注",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["dimension", "size", "measure", "尺寸", "标注"],
              perform: () => toggleDimensions(),
            },
            {
              label: "固化尺寸",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["dimension", "solidify", "固化", "尺寸"],
              perform: () => solidifyDimensions(),
            },
            {
              label: "截图",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["screenshot", "capture", "截图"],
              perform: () => captureScreenshot(),
            },
            {
              label: "发送给 Claude Code",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["claude", "code", "send", "发送"],
              perform: () => handleSendToClaudeCode(),
            },
            {
              label: "保存为模板",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["template", "save", "模板", "保存"],
              perform: () => saveAsTemplate(),
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "feedback",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
          ]}
        />
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
    <Provider store={appJotaiStore}>
      <ExcalidrawWrapper />
    </Provider>
  );
};

export default ExcalidrawApp;
