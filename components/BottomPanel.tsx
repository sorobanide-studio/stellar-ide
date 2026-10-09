/**
 * Bottom Panel Component
 * Tabbed panel for Terminal and Problems (like VS Code)
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { X, Terminal as TerminalIcon, AlertCircle } from "lucide-react";
import { type LogMessage } from "./Terminal";
import ProblemsPanel from "./ProblemsPanel";
import type { DiagnosticItem } from "../hooks/useDiagnosticsStore";
import type React from "react";

type TabType = "terminal" | "problems";

interface BottomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  height: number;
  onHeightChange: (height: number) => void;
  // Terminal props
  terminalLogs: LogMessage[];
  // Problems props
  diagnostics: DiagnosticItem[];
  onDiagnosticClick: (uri: string, line: number, column: number) => void;
  onFileOpen?: (filePath: string) => Promise<void>; // Open file that's not already open
  projectName?: string;
}

export default function BottomPanel({
  isOpen,
  onClose,
  height,
  onHeightChange,
  terminalLogs,
  diagnostics,
  onDiagnosticClick,
  onFileOpen,
  projectName,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("terminal");
  const [isDragging, setIsDragging] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const prevDiagnosticsCountRef = useRef(0);

  // Calculate counts for Problems tab badge
  const problemsCount = diagnostics.length;
  const errorsCount = diagnostics.filter((d) => d.severity === 1).length;

  // Handle resize
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  // Auto-switch to Problems tab when new diagnostics appear
  useEffect(() => {
    if (
      isOpen &&
      problemsCount > 0 &&
      problemsCount > prevDiagnosticsCountRef.current &&
      activeTab === "terminal"
    ) {
      // Defer state update to avoid cascading renders
      const timeoutId = setTimeout(() => {
        setActiveTab("problems");
      }, 0);
      prevDiagnosticsCountRef.current = problemsCount;
      return () => clearTimeout(timeoutId);
    }
    prevDiagnosticsCountRef.current = problemsCount;
  }, [problemsCount, activeTab, isOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const topBarHeight = 50;
      const minEditorHeight = 50;
      const maxPanelHeight =
        window.innerHeight - topBarHeight - minEditorHeight;

      const newHeight = Math.max(
        0,
        Math.min(maxPanelHeight, window.innerHeight - e.clientY - topBarHeight)
      );

      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "auto";
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "auto";
    };
  }, [isDragging, onHeightChange]);

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col bg-[#171717] border-t border-[#252525] shrink-0"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 bg-[#252525] hover:bg-[#3a3a3a] cursor-row-resize transition-colors ${
          isDragging ? "bg-[#3a3a3a]" : ""
        }`}
        title="Drag to resize"
        style={{ userSelect: "none" }}
      />

      {/* Tab Bar */}
      <div className="h-10 bg-[#171717] flex items-center justify-between border-b border-[#252525] shrink-0">
        <div className="flex items-center gap-0">
          {/* Terminal Tab */}
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-2 px-3 h-full transition-colors border-r border-[#252525] ${
              activeTab === "terminal"
                ? "bg-[#1e1e1e] text-gray-300"
                : "text-gray-500 hover:bg-[#252525] hover:text-gray-300"
            }`}
            title="Terminal"
          >
            <TerminalIcon className="w-4 h-4" />
            <span className="text-xs">Terminal</span>
            {terminalLogs.length > 0 && (
              <span className="text-xs text-gray-500">
                ({terminalLogs.length})
              </span>
            )}
          </button>

          {/* Problems Tab */}
          <button
            onClick={() => setActiveTab("problems")}
            className={`flex items-center gap-2 px-3 h-full transition-colors border-r border-[#252525] ${
              activeTab === "problems"
                ? "bg-[#1e1e1e] text-gray-300"
                : "text-gray-500 hover:bg-[#252525] hover:text-gray-300"
            }`}
            title="Problems"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Problems</span>
            {problemsCount > 0 && (
              <span
                className={`text-xs ${
                  errorsCount > 0 ? "text-red-400" : "text-yellow-400"
                }`}
              >
                ({problemsCount})
              </span>
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1 mx-2 hover:bg-[#252525] rounded transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "terminal" ? (
          <TerminalContent logs={terminalLogs} terminalRef={terminalRef} />
        ) : (
          <ProblemsPanel
            diagnostics={diagnostics}
            onDiagnosticClick={onDiagnosticClick}
            onFileOpen={onFileOpen}
            projectName={projectName}
          />
        )}
      </div>
    </div>
  );
}

// Only the newest entries are mounted. The retained history can be much
// larger, so windowing keeps the DOM node count bounded independently of
// MAX_TERMINAL_LOG_ENTRIES.
const TERMINAL_LOG_RENDER_LIMIT = 500;

// Terminal Content Component (extracted from Terminal.tsx)
function TerminalContent({
  logs,
  terminalRef,
}: {
  logs: LogMessage[];
  terminalRef: React.RefObject<HTMLDivElement | null>;
}) {
  const visibleLogs =
    logs.length > TERMINAL_LOG_RENDER_LIMIT
      ? logs.slice(logs.length - TERMINAL_LOG_RENDER_LIMIT)
      : logs;

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, terminalRef]);

  const getLogColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-300";
      case "warn":
        return "text-gray-100";
      case "info":
        return "text-gray-100";
      default:
        return "text-gray-100";
    }
  };

  const renderMessageWithLinks = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline transition-colors"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      ref={terminalRef}
      role="log"
      aria-label="Console output"
      className="h-full overflow-y-auto bg-[#171717] font-mono text-sm p-4 space-y-1 sidebar-scrollbar"
    >
      {visibleLogs.length === 0 ? (
        <div className="text-gray-500 text-sm">
          Waiting for console output...
        </div>
      ) : (
        visibleLogs.map((log) => (
          <div key={log.id} className="flex gap-3 leading-5">
            <span className="text-gray-600 text-xs whitespace-nowrap select-none w-20 shrink-0">
              {log.timestamp}
            </span>
            <pre
              className={`${getLogColor(
                log.type
              )} text-sm flex-1 whitespace-pre-wrap font-mono m-0`}
              style={{ overflowWrap: "break-word" }}
            >
              {renderMessageWithLinks(log.message)}
            </pre>
          </div>
        ))
      )}
    </div>
  );
}
