import { describe, expect, it } from "vitest";
import {
  appendTerminalLogs,
  MAX_TERMINAL_LOG_ENTRIES,
} from "../../hooks/useTerminalLogging";
import type { LogMessage } from "../../components/Terminal";

function makeLog(id: number): LogMessage {
  return { id, message: `line ${id}`, timestamp: "00:00:00", type: "log" };
}

describe("appendTerminalLogs", () => {
  it("keeps appending without trimming below the cap", () => {
    const logs = appendTerminalLogs([], [makeLog(1), makeLog(2)]);

    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe(1);
    expect(logs[1].id).toBe(2);
  });

  it("drops the oldest entries once the cap is exceeded", () => {
    let logs: LogMessage[] = [];

    for (let i = 0; i < MAX_TERMINAL_LOG_ENTRIES + 50; i++) {
      logs = appendTerminalLogs(logs, [makeLog(i)]);
    }

    expect(logs).toHaveLength(MAX_TERMINAL_LOG_ENTRIES);
    expect(logs[0].id).toBe(50);
    expect(logs[logs.length - 1].id).toBe(MAX_TERMINAL_LOG_ENTRIES + 49);
  });

  it("trims a single batch that is larger than the cap", () => {
    const batch = Array.from({ length: MAX_TERMINAL_LOG_ENTRIES + 10 }, (_, i) =>
      makeLog(i)
    );

    const logs = appendTerminalLogs([makeLog(-1)], batch);

    expect(logs).toHaveLength(MAX_TERMINAL_LOG_ENTRIES);
    expect(logs[0].id).toBe(10);
    expect(logs[logs.length - 1].id).toBe(MAX_TERMINAL_LOG_ENTRIES + 9);
  });
});
