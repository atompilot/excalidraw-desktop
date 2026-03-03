import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "./app-language/LanguageList";
import { getRecentFiles, type RecentFile } from "./tauri-bridge";

export const DesktopMainMenu: React.FC<{
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onLoadFile: (path: string) => void;
}> = React.memo((props) => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    getRecentFiles()
      .then(setRecentFiles)
      .catch(() => setRecentFiles([]));
  }, []);

  return (
    <MainMenu>
      <MainMenu.Item onSelect={props.onOpenFile}>
        Open File... (Ctrl+O)
      </MainMenu.Item>
      <MainMenu.Item onSelect={props.onSaveFile}>Save (Ctrl+S)</MainMenu.Item>
      <MainMenu.Item onSelect={props.onSaveFileAs}>
        Save As... (Ctrl+Shift+S)
      </MainMenu.Item>

      {recentFiles.length > 0 && (
        <>
          <MainMenu.Separator />
          <MainMenu.Group title="Recent Files">
            {recentFiles.map((file) => {
              const dir = file.path
                .replace(/[/\\][^/\\]+$/, "")
                .replace(/^.*[/\\]/, "");
              return (
                <MainMenu.Item
                  key={file.path}
                  onSelect={() => props.onLoadFile(file.path)}
                  title={file.path}
                >
                  {file.name}
                  <span
                    style={{ opacity: 0.5, marginLeft: 6, fontSize: "0.85em" }}
                  >
                    — {dir}
                  </span>
                </MainMenu.Item>
              );
            })}
          </MainMenu.Group>
        </>
      )}

      <MainMenu.Separator />
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Socials />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
