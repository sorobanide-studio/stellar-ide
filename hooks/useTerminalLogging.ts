"use client";

import { useCallback, useRef, useEffect } from "react";
import type { LogMessage } from "@/components/Terminal";

/**
 * Maximum number of terminal log entries retained in memory.
 *
 * Chosen to comfortably hold a long build session (cargo output for a
 * Soroban contract plus the per-poll deploy progress lines, ~60s of polling
 * at one line per attempt) without letting the array or the DOM grow without
 * bound. Older entries are dropped from the front, keeping the newest ones.
 */
export const MAX_TERMINAL_LOG_ENTRIES = 2000;

/**
 * Append `incoming` to `previous`, keeping at most MAX_TERMINAL_LOG_ENTRIES
 * entries and dropping the oldest first (ring-buffer trim).
 */
export function appendTerminalLogs(
  previous: LogMessage[],
  incoming: LogMessage[]
): LogMessage[] {
  if (incoming.length === 0) {
    return previous;
  }

  const combined =
    incoming.length >= MAX_TERMINAL_LOG_ENTRIES
      ? incoming.slice(incoming.length - MAX_TERMINAL_LOG_ENTRIES)
      : previous.concat(incoming);

  if (combined.length > MAX_TERMINAL_LOG_ENTRIES) {
    return combined.slice(combined.length - MAX_TERMINAL_LOG_ENTRIES);
  }

  return combined;
}

interface UseTerminalLoggingProps {
  onLogsUpdate: (logs: LogMessage[]) => void;
}

export function useTerminalLogging({ onLogsUpdate }: UseTerminalLoggingProps) {
  const messageCountRef = useRef(0);
  const onLogsUpdateRef = useRef(onLogsUpdate);

  // Keep ref updated
  useEffect(() => {
    onLogsUpdateRef.current = onLogsUpdate;
  }, [onLogsUpdate]);

  // Log to terminal - deferred to avoid setState during render
  const logToTerminal = useCallback(
    (message: string, type: "log" | "error" | "warn" | "info" = "log") => {
      // Use setTimeout to defer state update and avoid render conflicts
      setTimeout(() => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
        onLogsUpdateRef.current([
        {
          id: messageCountRef.current++,
          message,
          timestamp,
          type,
        },
      ]);
      }, 0);
    },
    []
  );

  // Intercept console methods - disabled to prevent render conflicts
  // Console logs will only show in browser devtools, not in terminal panel
  // Use logToTerminal explicitly for terminal output

  return {
    logToTerminal,
    messageCountRef,
  };
}
