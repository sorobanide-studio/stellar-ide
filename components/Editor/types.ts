/**
 * Editor Type Definitions
 */

import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import type { LogMessage } from "../Terminal";
import type { OpenFile } from "../TabBar";
import type { DocumentSymbol, CancellationTokenLike } from "../../lib/lsp/requests";

export type MonacoType = Monaco;
export type MonacoEditor = editor.IStandaloneCodeEditor;
export type MonacoTextModel = editor.ITextModel;

export interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
}

export interface EditorPanelProps {
  openFile: FileNode | null;
  containerId?: string;
  projectName?: string;
  openFiles: OpenFile[];
  fileContents: Map<string, string>;
  fontSize: number;
  terminalOpen: boolean;
  terminalHeight: number;
  logs: LogMessage[];
  onFileSelect: (path: string) => void;
  onFileClose: (path: string) => void;
  onFileOpen?: (filePath: string) => Promise<void>; // Open file that's not already open
  onEditorChange: (value: string | undefined) => void;
  onEditorMount: (editorInstance: MonacoEditor, monaco: MonacoType) => void;
  onSave: () => void;
  onTerminalClose: () => void;
  onTerminalHeightChange: (height: number) => void;
}

export interface LSPFunctionsRef {
  requestInlayHints: (
    uri: string,
    range: { startLine: number; endLine: number },
    token?: CancellationTokenLike
  ) => Promise<InlayHint[]>;
  requestCompletion?: (
    uri: string,
    position: { line: number; character: number },
    token?: CancellationTokenLike
  ) => Promise<unknown[]>;
  requestHover?: (
    uri: string,
    position: { line: number; character: number },
    token?: CancellationTokenLike
  ) => Promise<unknown | null>;
  requestDefinition?: (
    uri: string,
    position: { line: number; character: number },
    token?: CancellationTokenLike
  ) => Promise<unknown[]>;
  requestReferences?: (
    uri: string,
    position: { line: number; character: number },
    context?: { includeDeclaration?: boolean },
    token?: CancellationTokenLike
  ) => Promise<unknown[]>;
  requestPrepareRename?: (
    uri: string,
    position: { line: number; character: number },
    token?: CancellationTokenLike
  ) => Promise<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null>;
  requestRename?: (
    uri: string,
    position: { line: number; character: number },
    newName: string,
    token?: CancellationTokenLike
  ) => Promise<unknown>;
  requestFormatting?: (uri: string, token?: CancellationTokenLike) => Promise<unknown[]>;
  requestCodeAction?: (
    uri: string,
    range: { start: { line: number; character: number }; end: { line: number; character: number } },
    context: { diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity: number; code?: string | number }> },
    token?: CancellationTokenLike
  ) => Promise<unknown[]>;
  requestDocumentSymbols?: (uri: string, token?: CancellationTokenLike) => Promise<DocumentSymbol[]>;
  requestDocumentHighlight?: (
    uri: string,
    position: { line: number; character: number },
    token?: CancellationTokenLike
  ) => Promise<unknown[]>;
}

export interface InlayHint {
  position: { line: number; character: number };
  label: string | { value: string }[];
  kind?: number;
  paddingLeft?: boolean;
  paddingRight?: boolean;
}

// Re-export DocumentSymbol from requests for convenience
export type { DocumentSymbol };

export interface InlayHintsCache {
  uri: string;
  hints: InlayHint[];
  timestamp: number;
}

// Window extensions for global state
declare global {
  interface Window {
    monacoInstance?: MonacoType;
    lspFunctions?: LSPFunctionsRef;
    currentEditorInstance?: MonacoEditor;
  }
}
