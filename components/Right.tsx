"use client";

import { useEffect, useCallback } from "react";
import Sidebar from "./Sidebar/index";
import EditorPanel from "./Editor";
import TopBar from "./TopBar";
import ErrorBanner from "./ErrorBanner";
import { useWallet as useWalletContext } from "../context/WalletContext";
import { useFileManager } from "../hooks/useFileManager";
import { useMonacoSetup } from "../hooks/useMonacoSetup";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useContainerManagement } from "../hooks/useContainerManagement";
import {
  useTerminalLogging,
  appendTerminalLogs,
} from "../hooks/useTerminalLogging";
import { useSidebarResize } from "../hooks/useSidebarResize";
import { useTabManagement } from "../hooks/useTabManagement";
import { useEditorState } from "../hooks/useEditorState";
import { useRightState } from "../hooks/useRightState";
import { useRightHandlers } from "../hooks/useRightHandlers";

interface RightProps {
  sidebarVisible?: boolean;
  terminalVisible?: boolean;
  onToggleSidebar?: () => void;
  onToggleTerminal?: () => void;
  onToggleLeftComponent?: () => void;
  leftComponentVisible?: boolean;
  projectName?: string;
}

export default function Right({
  sidebarVisible = true,
  terminalVisible = false,
  onToggleSidebar,
  onToggleTerminal,
  onToggleLeftComponent,
  leftComponentVisible = false,
  projectName,
}: RightProps) {
  // State management
  const {
    fontSize,
    setFontSize,
    containerLoading,
    setContainerLoading,
    error,
    setError,
    terminalOpen,
    setTerminalOpen,
    logs,
    setLogs,
    terminalHeight,
    setTerminalHeight,
    mounted,
    containerRef,
  } = useRightState({ terminalVisible });

  const { logToTerminal } = useTerminalLogging({
    onLogsUpdate: (newLogs) => {
      setLogs((prev) => appendTerminalLogs(prev, newLogs));
    },
  });

  const { sidebarWidth, handleMouseDown } = useSidebarResize({
    initialWidth: 256,
    minWidth: 200,
    maxWidth: 600,
  });

  // Get wallet from global context
  const wallet = useWalletContext();

  // File Manager hook - only initialize if wallet is connected
  const {
    files,
    openFile,
    fileContents,
    expandedFolders,
    creatingItem,
    newItemName,
    isLoading,
    isSaving,
    loadFiles,
    handleFileClick,
    handleSave,
    handleCreateFile,
    handleCreateFolder,
    confirmCreateItem,
    cancelCreateItem,
    handleDeleteFile,
    handleDeleteFolder,
    toggleFolder,
    setNewItemName,
    setOpenFile,
    setFileContents,
    setFiles,
  } = useFileManager(
    wallet.walletAddress || "not-connected",
    logToTerminal,
    setError,
    setTerminalOpen,
    projectName
  );

  // Files auto-load via useFileManager when wallet is connected

  // Monaco Editor Setup hook
  const { editorRef, handleEditorDidMount } = useMonacoSetup({
    onFontSizeChange: setFontSize,
    containerRef,
  });

  // Keyboard Shortcuts hook
  useKeyboardShortcuts({
    onSave: handleSave,
    fontSize,
    onFontSizeChange: setFontSize,
    editorRef,
    onToggleTerminal: () => setTerminalOpen((prev) => !prev),
  });

  // Tab Management hook
  const {
    openFiles,
    addOpenFile,
    handleSelectTab,
    handleCloseTab,
    findFileNode,
  } = useTabManagement({
    files,
    onFileSelect: setOpenFile,
    onOpenFilesChange: () => {}, // Will be updated inline
  });

  // Editor State hook
  const { handleEditorChange } = useEditorState({
    openFile,
    fileContents,
    onFileContentsChange: setFileContents,
    onOpenFilesChange: () => {
      // This will be handled by tab management
    },
  });

  // Container Management hook
  const {
    containerName,
    handleCreateContainer,
    handleDeleteContainer,
    checkAndSetContainerName,
  } = useContainerManagement({
    walletAddress: wallet.walletAddress || "not-connected",
    logToTerminal,
    onContainerLoading: setContainerLoading,
    onError: setError,
    onTerminalOpen: setTerminalOpen,
    onLoadFiles: loadFiles,
    onClearFiles: () => {
      setFiles([]);
      setOpenFile(null);
      setFileContents(new Map());
    },
  });

  // Event handlers
  const {
    handleFileClickWrapper,
    handleCreateFileRoot,
    handleCreateFolderRoot,
  } = useRightHandlers({
    handleFileClick,
    addOpenFile,
    handleCreateFile,
    handleCreateFolder,
  });

  // Handle opening file by path (for diagnostic clicks) - defined after handlers
  const handleFileOpen = useCallback(
    async (filePath: string) => {
      // Check if file is already open
      const isAlreadyOpen = openFiles.some((f) => f.path === filePath);
      if (isAlreadyOpen) {
        // Just select the tab
        handleSelectTab(filePath);
        return;
      }

      // Find file node in the file tree
      const fileNode = findFileNode(filePath);
      if (fileNode && fileNode.type === "file") {
        // Open the file using handleFileClickWrapper
        await handleFileClickWrapper(fileNode);
      } else {
        console.warn(`[Right] File not found in file tree: ${filePath}`);
      }
    },
    [openFiles, handleSelectTab, findFileNode, handleFileClickWrapper]
  );

  // Check for existing container when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.walletAddress) {
      checkAndSetContainerName();
    }
  }, [wallet.isConnected, wallet.walletAddress, checkAndSetContainerName]);

  // Deploy Contract: hooks/archived/useContractDeployment.ts
  // Create Account: hooks/archived/useAccountCreation.ts

  return (
    <div className="flex flex-col h-full bg-[#171717] overflow-hidden">
      {mounted && !wallet.isConnected && (
        <div className="bg-red-900/20 border-b border-red-500/30 p-3 text-red-300 text-sm">
          Please connect your wallet to access the editor
        </div>
      )}
      <TopBar
        userId={wallet.walletAddress || ""}
        connected={wallet.isConnected}
        publicKey={wallet.walletAddress}
        isSaving={isSaving}
        containerLoading={containerLoading}
        openFile={openFile}
        sidebarVisible={sidebarVisible}
        terminalVisible={terminalVisible}
        leftComponentVisible={leftComponentVisible}
        projectName={projectName}
        onConnectWallet={async () => {}}
        onDisconnectWallet={() => wallet.disconnect()}
        onSave={handleSave}
        onCreateContainer={handleCreateContainer}
        onDeleteContainer={handleDeleteContainer}
        onToggleSidebar={() => onToggleSidebar?.()}
        onToggleTerminal={() => onToggleTerminal?.()}
        onToggleLeftComponent={() => onToggleLeftComponent?.()}
        onLog={logToTerminal}
      />

      <ErrorBanner error={error} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Loading overlay when files are loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-3"></div>
              <p className="text-white text-sm">Loading project files...</p>
            </div>
          </div>
        )}

        {/* Sidebar */}
        {sidebarVisible && (
          <Sidebar
            sidebarWidth={sidebarWidth}
            onMouseDown={handleMouseDown}
            files={files}
            isLoading={isLoading}
            expandedFolders={expandedFolders}
            openFile={openFile}
            creatingItem={creatingItem}
            newItemName={newItemName}
            onToggleFolder={toggleFolder}
            onFileClick={handleFileClickWrapper}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onDeleteFolder={handleDeleteFolder}
            onSetNewItemName={setNewItemName}
            onConfirmCreateItem={confirmCreateItem}
            onCancelCreateItem={cancelCreateItem}
            onCreateFileRoot={handleCreateFileRoot}
            onCreateFolderRoot={handleCreateFolderRoot}
            projectName={projectName}
          />
        )}

        {/* Editor */}
        <EditorPanel
          openFile={openFile}
          openFiles={openFiles}
          fileContents={fileContents}
          containerId={containerName || undefined}
          projectName={projectName}
          fontSize={fontSize}
          terminalOpen={terminalOpen}
          terminalHeight={terminalHeight}
          logs={logs}
          onFileSelect={handleSelectTab}
          onFileClose={handleCloseTab}
          onFileOpen={handleFileOpen}
          onEditorChange={handleEditorChange}
          onEditorMount={handleEditorDidMount}
          onSave={handleSave}
          onTerminalClose={() => setTerminalOpen(false)}
          onTerminalHeightChange={setTerminalHeight}
        />
      </div>
    </div>
  );
}
