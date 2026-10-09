"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface LogMessage {
  id: number;
  message: string;
  timestamp: string;
  type: "log" | "error" | "warn" | "info";
}

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogMessage[];
  height?: number;
  onHeightChange?: (height: number) => void;
}

export default function Terminal({
  isOpen,
  onClose,
  logs,
  height: initialHeight = 250,
  onHeightChange,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initialHeight); // Initial height in pixels
  const [isDragging, setIsDragging] = useState(false);

  // Notify parent when height changes
  useEffect(() => {
    onHeightChange?.(height);
  }, [height, onHeightChange]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      // Calculate new height: full screen - cursor position
      // Subtract top bar height (50px) and editor area minimum
      const topBarHeight = 50;
      const minEditorHeight = 50; // Minimum height for editor to show
      const maxTerminalHeight =
        window.innerHeight - topBarHeight - minEditorHeight;

      const newHeight = Math.max(
        0,
        window.innerHeight - e.clientY - topBarHeight
      );

      // Allow any height from 0 to near full screen
      if (newHeight >= 0 && newHeight <= maxTerminalHeight) {
        setHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none"; // Prevent text selection while dragging
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "auto";
    };
  }, [isDragging]);

  const getLogColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-300";
      case "warn":
        return "text-gray-100";
      case "info":
        // Terminal-style green for normal info
        return "text-gray-100";
      default:
        // Default console text
        return "text-gray-100";
    }
  };

  // Parse message for URLs and return JSX with links
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

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col bg-[#171717]"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 bg-[#252525] hover:bg-[#3a3a3a] cursor-row-resize transition-colors ${
          isDragging ? "bg-[#3a3a3a]" : ""
        }`}
        title="Drag to resize"
      />

      {/* Terminal Header */}
      <div className="h-10 bg-[#171717] flex items-center justify-between px-4 shrink-0 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-semibold uppercase">
            Console
          </span>
          <span className="text-xs text-gray-500">
            ({logs.length} messages)
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#3e3e42] rounded transition-colors"
          title="Close Terminal"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        role="log"
        aria-label="Console output"
        className="flex-1 overflow-y-auto bg-[#171717] font-mono text-sm p-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-[#171717]"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#4b5563 #171717",
        }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-sm">
            Waiting for console output...
          </div>
        ) : (
          logs.map((log) => (
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

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: #171717;
        }
        div::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}
