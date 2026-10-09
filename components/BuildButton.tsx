"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { sanitizeAnnouncement } from "../lib/a11y";

interface BuildButtonProps {
  onLog: (message: string, type: "log" | "error" | "warn" | "info") => void;
  projectName?: string;
  userId?: string;
}

// Strip ANSI color codes from text
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// Format Rust compiler output for terminal display
function formatRustOutput(
  output: string,
  onLog: (message: string, type: "log" | "error" | "warn" | "info") => void
) {
  const lines = stripAnsi(output).split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect error lines
    if (trimmed.startsWith("error[") || trimmed.startsWith("error:")) {
      onLog(` ${trimmed}`, "error");
    }
    // Detect warning lines
    else if (trimmed.startsWith("warning[") || trimmed.startsWith("warning:")) {
      onLog(`  ${trimmed}`, "warn");
    }
    // Detect note/help lines
    else if (trimmed.startsWith("note:") || trimmed.startsWith("help:")) {
      onLog(`   ${trimmed}`, "info");
    }
    // Detect file location lines (e.g., --> src/lib.rs:10:5)
    else if (trimmed.startsWith("-->")) {
      onLog(`   ${trimmed}`, "info");
    }
    // Detect code snippet lines with line numbers (e.g., 10 |     let x = ...)
    else if (/^\d+\s*\|/.test(trimmed)) {
      onLog(`   ${trimmed}`, "log");
    }
    // Detect pointer lines (e.g., |     ^^^^ expected...)
    else if (trimmed.startsWith("|")) {
      onLog(`   ${trimmed}`, "error");
    }
    // Detect summary lines
    else if (trimmed.startsWith("For more information")) {
      onLog(`\n📚 ${trimmed}`, "info");
    } else if (
      trimmed.includes("could not compile") ||
      trimmed.includes("aborting due to")
    ) {
      onLog(`\n ${trimmed}`, "error");
    }
    // Compiling/Finished messages
    else if (
      trimmed.startsWith("Compiling") ||
      trimmed.startsWith("Finished")
    ) {
      onLog(` ${trimmed}`, "info");
    } else if (trimmed.startsWith("Building")) {
      onLog(` ${trimmed}`, "info");
    }
    // Default: just log the line
    else {
      onLog(`   ${trimmed}`, "log");
    }
  }
}

export function BuildButton({ onLog, projectName, userId }: BuildButtonProps) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const handleBuild = async () => {
    if (!projectName) {
      onLog(" Project name is required to build", "error");
      setAnnouncement("Build failed. A project name is required.");
      return;
    }
    if (!userId) {
      onLog(" Wallet connection required to build", "error");
      setAnnouncement("Build failed. A wallet connection is required.");
      return;
    }

    setIsBuilding(true);
    setAnnouncement(`Building contract ${projectName}.`);
    onLog("", "log"); // Empty line for spacing
    onLog("", "info");
    onLog(" BUILDING CONTRACT", "info");
    onLog("", "info");
    onLog(` Project: ${projectName}`, "info");
    onLog("", "log");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buildContract",
          walletAddress: userId,
          projectName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onLog("", "log");
        onLog("", "log");
        onLog(" BUILD SUCCESSFUL", "log");
        onLog("", "log");
        onLog(` WASM Size: ${(data.wasmSize / 1024).toFixed(2)} KB`, "log");
        onLog("", "log");
        setAnnouncement(
          `Build succeeded. WASM size ${(data.wasmSize / 1024).toFixed(
            2
          )} kilobytes.`
        );
      } else {
        onLog("", "log");
        onLog("", "error");
        onLog(" BUILD FAILED", "error");
        onLog("", "error");
        setAnnouncement("Build failed. See the console for the compiler output.");
        onLog("", "log");

        // Format and display stderr (compiler errors)
        if (data.stderr) {
          formatRustOutput(data.stderr, onLog);
        }

        // Format and display stdout if present
        if (data.stdout) {
          formatRustOutput(data.stdout, onLog);
        }

        // Show the main error message if no detailed output
        if (!data.stderr && !data.stdout && data.error) {
          onLog(` ${data.error}`, "error");
        }

        onLog("", "log");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onLog("", "log");
      onLog("", "error");
      onLog(" BUILD ERROR", "error");
      onLog("", "error");
      onLog(`${errorMessage}`, "error");
      onLog("", "log");
      setAnnouncement(
        sanitizeAnnouncement(`Build failed: ${errorMessage}`)
      );
      console.error("Build error:", error);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </span>
      <button
        onClick={handleBuild}
        disabled={isBuilding}
        aria-busy={isBuilding}
        aria-label={
          isBuilding ? "Building contract, please wait" : "Build contract"
        }
        className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#2a2a2a] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors flex items-center gap-2"
        title="Build contract (compile WASM)"
      >
        <Zap size={14} />
        {isBuilding ? "Building..." : "Build"}
      </button>
    </>
  );
}
