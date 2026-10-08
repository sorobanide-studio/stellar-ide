/**
 * Editor Panel Component
 * Main editor container with tabs, Monaco editor, terminal, and status bar
 */

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import TabBar from "../TabBar";
import BottomBar from "../BottomBar";
import BottomPanel from "../BottomPanel";
import MonacoEditorWrapper from "./MonacoEditor";
import EmptyState from "./EmptyState";
import { useLSPSync } from "./useLSPSync";
import {
  useLSPClient,
  type OnDiagnosticsUpdate,
} from "../../lib/lsp/useLSPClient";
import { useDiagnosticsStore } from "../../hooks/useDiagnosticsStore";
import type { Diagnostic } from "../../lib/lsp/types";
import type { EditorPanelProps, MonacoEditor, MonacoType } from "./types";

export default function EditorPanel({
  openFile,
  openFiles,
  fileContents,
  containerId,
  projectName,
  fontSize,
  terminalOpen,
  terminalHeight,
  logs,
  onFileSelect,
  onFileClose,
  onFileOpen,
  onEditorChange,
  onEditorMount,
  onTerminalClose,
  onTerminalHeightChange,
}: EditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<MonacoEditor | null>(null);

  // Cursor position state
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Diagnostics store
  const diagnosticsStore = useDiagnosticsStore();
  const diagnosticsStoreRef = useRef(diagnosticsStore);

  // Keep ref in sync
  useEffect(() => {
    diagnosticsStoreRef.current = diagnosticsStore;
  }, [diagnosticsStore]);

  // Handle diagnostics update callback - stable reference using ref
  const handleDiagnosticsUpdate = useCallback<OnDiagnosticsUpdate>(
    (uri: string, diagnostics: Diagnostic[]) => {
      diagnosticsStoreRef.current.addDiagnostics(uri, diagnostics);
    },
    [] // Empty deps - callback is stable
  );

  // Build file URI for LSP
  const effectiveProjectName = projectName || "soroban-hello-world";
  const fileUri = openFile
    ? `file:///home/developer/workspace/${effectiveProjectName}/${openFile.path}`
    : "";

  // LSP client connection
  const {
    isConnected,
    connectionError,
    diagnosticsCount,
    openTextDocument,
    changeTextDocument,
    requestInlayHints,
    requestCompletion,
    requestHover,
    requestDefinition,
    requestReferences,
    requestPrepareRename,
    requestRename,
    requestFormatting,
    requestCodeAction,
    requestDocumentSymbols,
    requestDocumentHighlight,
  } = useLSPClient(containerId, fileUri, handleDiagnosticsUpdate);

  // Debug logging
  useEffect(() => {
    console.log(
      `[EditorPanel] LSP Status - Connected: ${isConnected}, Container: ${containerId}`
    );
    if (connectionError) {
      console.error(`[EditorPanel] Connection Error: ${connectionError}`);
    }
  }, [isConnected, containerId, connectionError]);

  // LSP sync hook
  useLSPSync({
    isConnected,
    openFile,
    fileUri,
    fileContents,
    openTextDocument,
    changeTextDocument,
  });

  // Clear diagnostics when file closes
  useEffect(() => {
    if (!openFile && fileUri) {
      // File was closed - clear diagnostics for that URI after a delay
      const timer = setTimeout(() => {
        diagnosticsStore.clearDiagnostics(fileUri);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [openFile, fileUri, diagnosticsStore]);

  // Get file content
  const getFileContent = (path: string): string => {
    return fileContents.get(path) ?? "";
  };

  // Handle editor mount - store editor instance for navigation
  const handleEditorMount = useCallback(
    (editor: MonacoEditor, monaco: MonacoType) => {
      editorInstanceRef.current = editor;

      // Store editor instance globally for OutlineView navigation.
      // Temporary allowlist: this global is frozen until the editor state moves
      // into React context (the window-globals follow-up).
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-restricted-syntax -- editor state still lives on window; follow-up moves it to React context.
        window.currentEditorInstance = editor;
      }

      // Track cursor position changes
      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });

      // Initialize cursor position
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({
          line: position.lineNumber,
          column: position.column,
        });
      }

      onEditorMount(editor, monaco);
    },
    [onEditorMount]
  );

  return (
    <div className="flex-1 bg-[#171717] flex flex-col" ref={containerRef}>
      {/* Tab Bar */}
      <TabBar
        openFiles={openFiles}
        activeFile={openFile?.path || null}
        onSelectFile={onFileSelect}
        onCloseFile={onFileClose}
      />

      {/* Editor Area with Terminal */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden">
          {openFile ? (
            <MonacoEditorWrapper
              file={openFile}
              fileUri={fileUri}
              content={getFileContent(openFile.path)}
              fontSize={fontSize}
              requestInlayHints={requestInlayHints}
              requestCompletion={requestCompletion}
              requestHover={requestHover}
              requestDefinition={requestDefinition}
              requestReferences={requestReferences}
              requestPrepareRename={requestPrepareRename}
              requestRename={requestRename}
              requestFormatting={requestFormatting}
              requestCodeAction={requestCodeAction}
              requestDocumentSymbols={requestDocumentSymbols}
              requestDocumentHighlight={requestDocumentHighlight}
              onChange={onEditorChange}
              onMount={handleEditorMount}
              containerRef={containerRef}
            />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Bottom Panel (Terminal + Problems) */}
        {terminalOpen && (
          <BottomPanel
            isOpen={terminalOpen}
            onClose={onTerminalClose}
            height={terminalHeight}
            onHeightChange={onTerminalHeightChange}
            terminalLogs={logs}
            diagnostics={diagnosticsStore.diagnostics}
            onDiagnosticClick={async (uri, line, column) => {
              // Extract file path from URI
              const workspacePath = `/home/developer/workspace/${effectiveProjectName}/`;
              const filePath = uri
                .replace("file://", "")
                .replace(workspacePath, "");

              // Navigate to location (file opening is handled in ProblemsPanel)
              if (editorInstanceRef.current) {
                // Check if this is the currently open file, or wait a bit if file was just opened
                const isCurrentFile = openFile?.path === filePath;

                if (isCurrentFile) {
                  // File is already open - navigate immediately
                  editorInstanceRef.current.setPosition({
                    lineNumber: line,
                    column,
                  });
                  editorInstanceRef.current.revealLineInCenter(line);
                  editorInstanceRef.current.focus();
                } else {
                  // File might be opening - wait a bit then navigate
                  setTimeout(() => {
                    if (editorInstanceRef.current) {
                      editorInstanceRef.current.setPosition({
                        lineNumber: line,
                        column,
                      });
                      editorInstanceRef.current.revealLineInCenter(line);
                      editorInstanceRef.current.focus();
                    }
                  }, 200);
                }
              }
            }}
            onFileOpen={onFileOpen}
            projectName={projectName}
          />
        )}
      </div>

      <BottomBar
        openFile={openFile}
        lspConnected={isConnected}
        lspError={connectionError}
        diagnosticsCount={diagnosticsCount}
        problemsCount={diagnosticsStore.totalCount}
        errorsCount={diagnosticsStore.errorCount}
        cursorPosition={cursorPosition}
      />
    </div>
  );
}
