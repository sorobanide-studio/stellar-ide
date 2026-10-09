// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Sidebar from "../../components/Sidebar";
import type { CreationState, FileNode } from "../../components/Sidebar/types";

const FIXTURE_TREE: FileNode[] = [
  {
    name: "src",
    type: "folder",
    path: "src",
    children: [
      { name: "main.rs", type: "file", path: "src/main.rs", content: "fn main() {}" },
      { name: "lib.rs", type: "file", path: "src/lib.rs", content: "" },
    ],
  },
  { name: "Cargo.toml", type: "file", path: "Cargo.toml", content: "[package]" },
];

interface HarnessProps {
  files?: FileNode[];
  isLoading?: boolean;
}

// Wires the real Sidebar to local state so every interaction goes through the
// component's own callbacks instead of reaching into handlers directly.
function SidebarHarness({ files = FIXTURE_TREE, isLoading = false }: HarnessProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openFile, setOpenFile] = useState<FileNode | null>(null);
  const [creatingItem, setCreatingItem] = useState<CreationState>(null);
  const [newItemName, setNewItemName] = useState("");

  const toggleFolder = (path: string) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const startCreating = (parentPath: string, type: "file" | "folder") => {
    setCreatingItem({ parentPath, type });
    setNewItemName("");
  };

  return (
    <Sidebar
      sidebarWidth={240}
      onMouseDown={() => {}}
      files={files}
      isLoading={isLoading}
      expandedFolders={expandedFolders}
      openFile={openFile}
      creatingItem={creatingItem}
      newItemName={newItemName}
      onToggleFolder={toggleFolder}
      onFileClick={setOpenFile}
      onCreateFile={(parentPath) => startCreating(parentPath, "file")}
      onCreateFolder={(parentPath) => startCreating(parentPath, "folder")}
      onDeleteFile={() => {}}
      onDeleteFolder={() => {}}
      onSetNewItemName={setNewItemName}
      onConfirmCreateItem={() => setCreatingItem(null)}
      onCancelCreateItem={() => setCreatingItem(null)}
      onCreateFileRoot={() => startCreating("", "file")}
      onCreateFolderRoot={() => startCreating("", "folder")}
      projectName="demo"
    />
  );
}

const headerCreateButton = (title: "New File" | "New Folder") =>
  within(screen.getByText("Explorer").parentElement as HTMLElement).getByTitle(title);

const fileRow = (name: string) =>
  screen.getByText(name).closest("div") as HTMLElement;

afterEach(cleanup);

describe("Sidebar file tree", () => {
  it("expands a folder on click and collapses it again on the second click", async () => {
    const user = userEvent.setup();
    render(<SidebarHarness />);

    expect(screen.queryByText("main.rs")).toBeNull();

    await user.click(screen.getByText("src"));
    expect(screen.getByText("main.rs")).toBeTruthy();
    expect(screen.getByText("lib.rs")).toBeTruthy();

    await user.click(screen.getByText("src"));
    expect(screen.queryByText("main.rs")).toBeNull();
    expect(screen.queryByText("lib.rs")).toBeNull();
  });

  it("marks the clicked file active and moves the marker to the next file", async () => {
    const user = userEvent.setup();
    render(<SidebarHarness />);

    await user.click(screen.getByText("src"));
    expect(fileRow("main.rs").classList.contains("bg-[#252525]")).toBe(false);

    await user.click(screen.getByText("main.rs"));
    expect(fileRow("main.rs").classList.contains("bg-[#252525]")).toBe(true);
    expect(fileRow("Cargo.toml").classList.contains("bg-[#252525]")).toBe(false);

    await user.click(screen.getByText("Cargo.toml"));
    expect(fileRow("main.rs").classList.contains("bg-[#252525]")).toBe(false);
    expect(fileRow("Cargo.toml").classList.contains("bg-[#252525]")).toBe(true);
  });

  it("submits a new file name with Enter", async () => {
    const user = userEvent.setup();
    render(<SidebarHarness />);

    await user.click(headerCreateButton("New File"));
    const input = screen.getByPlaceholderText("filename.rs") as HTMLInputElement;
    await user.type(input, "lib.rs");
    expect(input.value).toBe("lib.rs");

    await user.keyboard("{Enter}");
    expect(screen.queryByPlaceholderText("filename.rs")).toBeNull();
  });

  it("cancels creation with Escape", async () => {
    const user = userEvent.setup();
    render(<SidebarHarness />);

    await user.click(headerCreateButton("New Folder"));
    const input = screen.getByPlaceholderText("foldername") as HTMLInputElement;
    await user.type(input, "assets");
    expect(input.value).toBe("assets");

    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText("foldername")).toBeNull();
  });

  it("renders the empty state and disables the create buttons when there are no files", () => {
    render(<SidebarHarness files={[]} />);

    expect(screen.getByText("No files. Create a container first.")).toBeTruthy();
    expect((headerCreateButton("New File") as HTMLButtonElement).disabled).toBe(true);
    expect((headerCreateButton("New Folder") as HTMLButtonElement).disabled).toBe(true);
  });
});
