import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  TTDDialogTrigger,
  CaptureUpdateAction,
  useEditorInterface,
  exportToCanvas,
} from "@excalidraw/excalidraw";
import { EVENT, THEME, resolvablePromise } from "@excalidraw/common";
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
import CustomStats from "excalidraw-app/CustomStats";
import { updateStaleImageStatuses } from "excalidraw-app/data/FileManager";
import { useHandleAppTheme } from "excalidraw-app/useHandleAppTheme";
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
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { importFromLocalStorage } from "./data/localStorage";
import { DesktopMainMenu } from "./DesktopMainMenu";
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
    const scene: ExcalidrawInitialDataState = {
      elements: restoreElements(localDataState?.elements, null, {
        repairBindings: true,
        deleteInvisibleElements: true,
      }),
      appState: restoreAppState(localDataState?.appState, null),
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.metaKey || e.ctrlKey;
      if (ctrlOrCmd && e.key === "o") {
        e.preventDefault();
        e.stopPropagation();
        openFile();
      } else if (ctrlOrCmd && e.shiftKey && e.key === "s") {
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
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [openFile, saveFile, saveFileAs]);

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
      navigator.clipboard.writeText(currentFilePathRef.current);
      excalidrawAPI?.setToast({
        message: `Path copied: ${currentFilePathRef.current}`,
      });
    } else {
      excalidrawAPI?.setToast({ message: "No file path (unsaved file)" });
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
    navigator.clipboard.writeText(selectedIds.join(", "));
    excalidrawAPI.setToast({
      message: `Copied ${selectedIds.length} element ID(s)`,
    });
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    const nonDeleted = elements.filter((el) => !el.isDeleted);
    const sig = getElementsSignature(nonDeleted);
    if (sig !== savedSignatureRef.current) {
      setIsModified(true);
    }

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
            label: "Copy File Path",
            customAction: () => copyFilePath(),
            predicate: () => !!currentFilePathRef.current,
          });
          if (type === "element") {
            items.push({
              label: "Copy Element IDs",
              customAction: () => copyElementIds(),
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
              label: "Open File",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["open", "load", "file", "import"],
              perform: () => openFile(),
            },
            {
              label: "Save",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["save", "file", "export"],
              perform: () => {
                if (currentFilePath) {
                  saveFile();
                } else {
                  saveFileAs();
                }
              },
            },
            {
              label: "Save As",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["save", "as", "file", "export", "new"],
              perform: () => saveFileAs(),
            },
            {
              label: "Copy File Path",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["copy", "path", "file", "mcp", "claude"],
              perform: () => copyFilePath(),
            },
            {
              label: "Copy Element IDs",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["copy", "id", "element", "mcp", "claude", "selected"],
              perform: () => copyElementIds(),
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
