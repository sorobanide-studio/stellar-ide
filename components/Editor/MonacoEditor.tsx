/**
 * Monaco Editor Wrapper Component
 */

"use client";

import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type {
  MonacoType,
  MonacoEditor as MonacoEditorType,
  FileNode,
  LSPFunctionsRef,
} from "./types";
import { getLanguageFromFilename, getEditorOptions } from "./constants";
import { PROVIDER_REGISTRATIONS } from "./providerCapabilities";
import { useEditorZoom } from "./useEditorZoom";

interface MonacoEditorProps {
  file: FileNode;
  fileUri: string;
  content: string;
  fontSize: number;
  requestInlayHints: LSPFunctionsRef["requestInlayHints"];
  requestCompletion?: LSPFunctionsRef["requestCompletion"];
  requestHover?: LSPFunctionsRef["requestHover"];
  requestDefinition?: LSPFunctionsRef["requestDefinition"];
  requestReferences?: LSPFunctionsRef["requestReferences"];
  requestPrepareRename?: LSPFunctionsRef["requestPrepareRename"];
  requestRename?: LSPFunctionsRef["requestRename"];
  requestFormatting?: LSPFunctionsRef["requestFormatting"];
  requestCodeAction?: LSPFunctionsRef["requestCodeAction"];
  requestDocumentSymbols?: LSPFunctionsRef["requestDocumentSymbols"];
  requestDocumentHighlight?: LSPFunctionsRef["requestDocumentHighlight"];
  onChange: (value: string | undefined) => void;
  onMount: (editor: MonacoEditorType, monaco: MonacoType) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function MonacoEditorWrapper({
  file,
  fileUri,
  content,
  fontSize,
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
  onChange,
  onMount,
  containerRef,
}: MonacoEditorProps) {
  const editorRef = useRef<MonacoEditorType | null>(null);
  const { handleMouseWheel, cleanup } = useEditorZoom(editorRef);

  const handleEditorDidMount = useCallback(
    (editorInstance: MonacoEditorType, monaco: MonacoType) => {
      editorRef.current = editorInstance;
      editorInstance.focus();

      // Store Monaco instance globally for LSP client
      window.monacoInstance = monaco;
      console.log("[MonacoEditor] Monaco instance stored globally");

      // Store LSP functions for providers
      window.lspFunctions = {
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
      };

      // Register language providers from the shared capability registry
      // (only once each) so providers and LSP_CAPABILITIES stay in lockstep.
      for (const { register } of PROVIDER_REGISTRATIONS) {
        register(monaco);
      }

      // Add wheel zoom handler
      if (containerRef.current) {
        containerRef.current.addEventListener("wheel", handleMouseWheel, {
          passive: false,
        });
      }

      // Call parent mount handler
      onMount(editorInstance, monaco);

      // Cleanup function
      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener("wheel", handleMouseWheel);
        }
        cleanup();
      };
    },
    [
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
      onMount,
      containerRef,
      handleMouseWheel,
      cleanup,
    ]
  );

  return (
    <Editor
      height="100%"
      path={fileUri}
      language={getLanguageFromFilename(file.name)}
      theme="vs-dark"
      value={content}
      onChange={onChange}
      onMount={handleEditorDidMount}
      options={getEditorOptions(fontSize)}
    />
  );
}
