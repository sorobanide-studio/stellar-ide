# Soroban Smart Contract Code Editor

A modern, web-based code editor specifically designed for developing Soroban smart contracts on the Stellar blockchain. Built with Next.js, Monaco Editor, and Docker for a seamless development experience.

## Features

- **Monaco Editor Integration** - Professional code editing with syntax highlighting and IntelliSense
- **Docker Container Support** - Isolated development environments for each project
- **File Management** - Create, edit, and manage project files in a visual file tree
- **Terminal Integration** - Built-in terminal for running commands and viewing output
- **Wallet Integration** - Connect Stellar wallet (Freighter) to manage blockchain interactions
- **Multi-Tab Support** - Work on multiple files simultaneously with an intuitive tab system
- **Project Management** - Create, delete, and organize multiple Soroban projects
- **Real-Time Logging** - View build output, compilation errors, and runtime logs
- **Smart Contract Deployment** - Deploy contracts to the Stellar blockchain directly from the editor

## Screenshots

### Editor Interface

![Soroban Code Editor Interface](/public/editor-interface.png)

The screenshot above shows the main editor interface with the code editor, file explorer, and integrated terminal.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [User Guide](#user-guide)
- [Features Guide](#features-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Docker Setup](#docker-setup)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager
- Docker (for container-based development)

### Setup Steps

1. **Clone the repository**

   ```bash
   cd code-editor
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables** (if needed)

   ```bash
   # Create a .env.local file for any required configuration
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `https://localhost:3000`
   - The application uses experimental HTTPS for wallet integration


## Docker Image

The editor compiles Soroban contracts inside an isolated Docker container. The image is **not** published — every contributor builds it locally from the repository root `Dockerfile`. The version of the image the app expects is defined once in `lib/docker/image.ts` (`SANDBOX_IMAGE`, currently **`stellar-sandbox:1.0.0`**) and is also tagged with the floating alias `stellar-sandbox:v1` for convenience. If you change the Dockerfile or want to use a different tag, update the build command and `lib/docker/image.ts` together, or the editor will fail to spawn containers.

### Pinned toolchain

The `Dockerfile` pins the following versions (verified against the build on 2026-10-08):

| Tool | Version | Source |
| --- | --- | --- |
| Ubuntu | `22.04`, pinned by manifest digest `sha256:5ec03bb3441e…` | `FROM ubuntu:22.04@sha256:5ec03bb3441e8b0bf3b4f9cd4629a1ae763010dc3035bb8da3ae6cf026486401` |
| Rust | **`1.99.0`** (pinned via `ARG RUST_VERSION`) | `rustup` minimal profile |
| `wasm32v1-none` target | added to the pinned `1.99.0` toolchain | `rustup target add wasm32v1-none` |
| `rust-analyzer` | pinned component of toolchain `1.99.0` | `rustup component add rust-analyzer` |
| Stellar CLI | **`v23.3.0`** (pinned via `ARG STELLAR_CLI_VERSION`) | `https://github.com/stellar/stellar-cli/releases/download/v23.3.0/stellar-cli-23.3.0-<arch>-unknown-linux-gnu.tar.gz` |

### Multi-architecture support

The Dockerfile detects the build host architecture with `dpkg --print-architecture` and downloads the matching `stellar-cli` release asset:

- `amd64` → `stellar-cli-23.3.0-x86_64-unknown-linux-gnu.tar.gz`
- `arm64` → `stellar-cli-23.3.0-aarch64-unknown-linux-gnu.tar.gz`

To build for a different architecture on a single host, use Docker's `--platform` flag:

```bash
# Build for arm64 on an amd64 host (uses QEMU emulation)
docker build --platform linux/arm64 -t stellar-sandbox:1.0.0 -t stellar-sandbox:v1 .

# Build for amd64 (the default on x86_64 hosts)
docker build -t stellar-sandbox:1.0.0 -t stellar-sandbox:v1 .
```

### Build command

```bash
docker build -t stellar-sandbox:1.0.0 -t stellar-sandbox:v1 .
```

The build runs as the `developer` user (UID 1000) created inside the image — it does not run as root. The final `WORKDIR` is `/home/developer/workspace`, and the default `CMD` is `/bin/bash`.

### Verification step

The Dockerfile ends with a verification step:

```text
RUN rustc --version && stellar --version && rust-analyzer --version
```

If any of these fail, the build fails. The image is tagged `stellar-sandbox:1.0.0` (immutable — the tag `lib/docker/image.ts` launches containers from) and `stellar-sandbox:v1` (floating alias). The resolved toolchain is also written to `/home/developer/.stellar-sandbox-versions` inside the image and surfaced by the app's health action.

### When to rebuild

Rebuild the image (`docker build -t stellar-sandbox:1.0.0 -t stellar-sandbox:v1 .`) whenever:

1. **The Dockerfile changes** — any change to the pinned versions, the `apt-get install` list, the `rustup` invocations, or the `stellar-cli` release URL requires a rebuild.
2. **A Rust target is added or removed** — `rustup target add` is baked into the image; the host `rustup` is not used at runtime.
3. **A `stellar-cli` upgrade is desired** — bump the version in the `curl` URL AND the matching release asset name, then rebuild.

All toolchain pins live in the `ARG` block at the top of the `Dockerfile`, so moving to a new release is a deliberate edit to that one file; the image tag the app launches lives in `lib/docker/image.ts`. Rebuild and retag the image (see the build commands above) after either change. The `Docker image` CI workflow rebuilds the image from the same commit and prints `rustc`, `stellar` and `rust-analyzer` versions.

## Getting Started

### Quick Start (5 minutes)

1. **Open the Application**

   - Go to `https://localhost:3000`
   - You'll see the Home page with project management

2. **Create Your First Project**

   - Click the **"+ New Project"** button
   - Enter a project name (e.g., "Hello Soroban")
   - Optionally add a project description
   - Click **"Create Project"**
   - A Docker container will be created automatically with the Soroban contract template

3. **Open the Project in Editor**

   - Click on the project card or the **"Open in Editor"** button
   - The editor will load with your project files

4. **Connect Your Wallet**

   - Click the **"Connect Wallet"** button in the top right
   - Approve the connection in your Freighter wallet extension
   - Your wallet address and balance will appear at the top

5. **Start Editing**

   - Browse files in the left sidebar
   - Click any file to open it in the editor
   - Write or modify your Soroban contract code
   - Changes are automatically saved

6. **Build and Deploy**
   - Use the **"Build"** button to compile your contract
   - View build output in the **Terminal** panel
   - Once successful, click **"Deploy"** to deploy to the Stellar network
   - Confirm the transaction in your Freighter wallet

## User Guide

### Main Interface Overview

The editor interface is divided into four main sections:

```
┌─────────────────────────────────────────┐
│          Top Bar (Menu & Wallet)        │
├────────────────────────────────────────┤
│ Left Panel │      Editor Panel      │   │
│  (Chat)    │    (Code Editor)       │   │
│           │      Main Area          │   │
├────────────────────────────────────────┤
│        Terminal/Output Panel            │
└────────────────────────────────────────┘
```

### Top Bar

**Left Side:**

- Project name and breadcrumb navigation
- Toggle buttons for different panel views

**Right Side:**

- **Connect Wallet** - Connect your Stellar wallet (Freighter)
- Wallet address display (when connected)
- Wallet balance in XLM
- **Build** button - Compile your contract
- **Deploy** button - Deploy to Stellar network

### Left Panel

The **Chat/Assistant Panel** provides:

- AI-powered development assistance
- Code suggestions and explanations
- Real-time feedback on your code
- Message history with previous interactions

**How to use:**

1. Type your question or request in the text area at the bottom
2. Press **Enter** or click **Send**
3. View the AI response and any suggested actions
4. Click on suggested actions to implement recommendations

### File Explorer (Sidebar)

Located on the left side of the editor panel:

**File Operations:**

- **Click a file** to open it in the editor
- **Right-click** for context menu (create, rename, delete)
- **Drag to resize** - Adjust sidebar width by dragging the divider

**Folder Structure:**

- Navigate through project directories
- Expand/collapse folders to view contents
- Current file is highlighted in the tree

### Editor Panel (Center)

**Tab Management:**

- Open files appear as tabs at the top
- Click tabs to switch between files
- Click **×** on a tab to close the file
- Unsaved files show a dot indicator

**Code Editing:**

- Full Monaco Editor with syntax highlighting
- IntelliSense for Rust/Soroban SDK
- Code formatting and linting
- Line numbers and code folding
- Minimap on the right side (toggle with Ctrl+B)

**Font and Appearance:**

- Adjust editor font size with mouse wheel (Ctrl/Cmd + scroll)
- Light and dark mode support
- Customizable theme

### Terminal Panel (Bottom)

**Features:**

- Real-time build output
- Compilation errors and warnings
- Runtime logs and debug information
- Auto-scroll to latest messages

**Controls:**

- **Resize** - Drag the top edge to adjust height
- **Close** - Click the × button to hide
- **Clear** - Click "Clear Logs" to remove all messages
- **Filter** - Toggle log types (Logs, Errors, Warnings)

### Right Panel

**Additional Tools:**

- Quick access buttons for common operations
- Status indicators
- Additional file/project information

## Features Guide

### Project Management

#### Creating a New Project

1. From the Home page, click **"+ New Project"**
2. Fill in the project details:
   - **Project Name** (required): Unique identifier for your project
   - **Description** (optional): Brief description of the project
   - **Contract Type**: Select "Soroban" (default)
3. Click **"Create Project"**
4. The system will:
   - Create a Docker container for isolated development
   - Initialize a Soroban contract template
   - Set up necessary dependencies

#### Opening a Project

- Click on any project card to open it in the editor
- Or click the folder icon and select a project
- The editor loads with all project files ready to edit

#### Deleting a Project

- From the Home page, hover over a project and click the trash icon
- Confirm the deletion
- The Docker container and all project files will be removed

### File Management

#### Creating New Files

1. Right-click in the file explorer sidebar
2. Select **"New File"**
3. Enter the filename (e.g., `helper.rs`)
4. Press Enter
5. The file is created and automatically opened

#### Editing Files

1. Click on a file in the sidebar to open it
2. Edit the content in the main editor area
3. Your changes are automatically saved to the Docker container

#### Deleting Files

1. Right-click on a file in the sidebar
2. Select **"Delete"**
3. Confirm the deletion
4. The file is removed from the project

#### Viewing File Content

- Click any file to preview its content
- The file opens in a new tab
- Switch between open files using the tab bar

### Building Your Contract

1. Click the **"Build"** button in the top right
2. The system will:
   - Compile your Soroban contract
   - Run any tests
   - Generate a `.wasm` file
3. View build output in the **Terminal** panel:
   - Green messages: Successful compilation steps
   - Red messages: Errors that need fixing
   - Yellow messages: Warnings to review

**Troubleshooting Build Errors:**

- Check the error message in the terminal
- Review the line number indicated in the error
- Common issues:
  - Missing dependencies in `Cargo.toml`
  - Syntax errors in your contract code
  - Type mismatches

### Deploying Contracts

#### Prerequisites for Deployment

1. **Wallet Connected** - Connect your Freighter wallet
2. **Build Successful** - Build your contract without errors
3. **Funded Wallet** - Have at least 1 XLM for transaction fees

#### Deployment Steps

1. Click the **"Deploy"** button in the top bar
2. A deployment dialog will appear showing:
   - Network selection (Testnet/Mainnet)
   - Contract details
   - Estimated fees
3. Review and confirm the deployment details
4. Click **"Confirm Deployment"**
5. Approve the transaction in your Freighter wallet
6. Wait for confirmation (usually 5-30 seconds)
7. View deployment logs in the Terminal panel
8. The contract address will be displayed upon success

### Wallet Integration

#### Connecting Your Wallet

1. Click **"Connect Wallet"** button in the top right corner
2. Choose **Freighter** wallet from the available options
3. Approve the connection request in your Freighter extension
4. Your wallet address will appear in the top bar

#### Viewing Wallet Information

- **Address**: Truncated wallet address with copy button
- **Balance**: Current XLM balance in the wallet
- **Network**: Current Stellar network (Testnet/Mainnet)

#### Managing Wallet

- Click on wallet address to copy it to clipboard
- Click the wallet icon to view full address and options
- Use the network selector to switch between Testnet and Mainnet

### Terminal and Logging

#### Understanding Log Levels

**Log** (Blue) - Informational messages

- Build progress
- File operations
- General status updates

**Error** (Red) - Errors that require attention

- Compilation failures
- Runtime exceptions
- Failed transactions

**Warn** (Yellow) - Warnings for review

- Deprecation notices
- Potential issues
- Best practice suggestions

**Info** (Green) - Success messages

- Build completed
- File saved
- Deployment successful

#### Using Terminal Logs

1. Monitor the terminal during builds and deployments
2. Scroll through logs to find specific messages
3. Click **"Clear Logs"** to start fresh
4. Use filter buttons to show only specific log types

## Keyboard Shortcuts

The table below splits bindings into **app-level** (registered in
[`hooks/useKeyboardShortcuts.ts`](hooks/useKeyboardShortcuts.ts)) and
**editor-level** (Monaco defaults that [`components/Editor/constants.ts`](components/Editor/constants.ts)'s
`getEditorOptions` does not disable). Rows that no code implements have been
removed; the previous table listed `Open File`, `New File`, `Close Tab`,
`Next Tab`, `Previous Tab`, and `Duplicate Line` — none of those are registered
in `useKeyboardShortcuts.ts` or surfaced through the editor options.

### App-level shortcuts (registered in `hooks/useKeyboardShortcuts.ts`)

| Action           | Windows/Linux | macOS  | Source                                            |
| ---------------- | ------------- | ------ | ------------------------------------------------- |
| Save File        | Ctrl + S      | Cmd + S | `useKeyboardShortcuts.ts` → `if ((e.metaKey \|\| e.ctrlKey) && e.key === "s")` |
| Toggle Terminal  | Ctrl + J      | Cmd + J | `useKeyboardShortcuts.ts` → `if ((e.metaKey \|\| e.ctrlKey) && e.key === "j")` |
| Zoom In          | Ctrl + =      | Cmd + = | `useKeyboardShortcuts.ts` (also `Ctrl + Shift + I`) |
| Zoom Out         | Ctrl + -      | Cmd + - | `useKeyboardShortcuts.ts` (also `Ctrl + Shift + -`) |
| Reset Zoom       | Ctrl + 0      | Cmd + 0 | `useKeyboardShortcuts.ts`                          |

### Editor-level shortcuts (Monaco defaults, not disabled in `getEditorOptions`)

| Action         | Windows/Linux        | macOS               |
| -------------- | -------------------- | ------------------- |
| Find           | Ctrl + F             | Cmd + F             |
| Find & Replace | Ctrl + H             | Cmd + H             |
| Format Code    | Ctrl + Shift + F     | Cmd + Shift + F     |
| Comment Line   | Ctrl + /             | Cmd + /             |
| Undo           | Ctrl + Z             | Cmd + Z             |
| Redo            | Ctrl + Y             | Cmd + Shift + Z     |
| Copy Line      | Ctrl + C             | Cmd + C             |
| Paste          | Ctrl + V             | Cmd + V             |
| Delete Line    | Ctrl + Shift + K     | Cmd + Shift + K     |

### Removed rows (no binding implements these)

The following rows appeared in the previous table but are NOT registered in
`hooks/useKeyboardShortcuts.ts` and are NOT Monaco defaults surfaced by
`getEditorOptions`. They have been removed:

| Removed action  | Reason                                              |
| --------------- | --------------------------------------------------- |
| Open File       | Not registered in `useKeyboardShortcuts.ts`. The file tree click handler does not bind a keyboard shortcut. |
| New File        | Not registered. New files are created through the file-tree UI button. |
| Close Tab       | Not registered. The Monaco tab strip handles close via mouse click; no `Ctrl + W` binding is registered. |
| Next Tab        | Not registered. Tab switching is mouse-only. |
| Previous Tab    | Not registered. Same reason as `Next Tab`. |
| Duplicate Line | Not a registered Monaco default for the editor configuration in `getEditorOptions`. |

### Notes

- The **minimap toggle** (`Ctrl + B`) was never in the table; `getEditorOptions`
  enables `minimap: { enabled: true }` so the minimap is always on (no toggle
  needed). If a `Ctrl + B` toggle is desired in future, add a binding in
  `useKeyboardShortcuts.ts` and re-add the row here.
- macOS and Windows/Linux columns both match the registered bindings — the
  `e.metaKey || e.ctrlKey` check in `useKeyboardShortcuts.ts` registers the
  same shortcut for both modifiers.

## Docker Setup

### Architecture

The application uses Docker containers to provide isolated development environments:

- **One container per project** - Each project runs in its own Docker container
- **Soroban template initialized** - Every new project comes with a working contract template
- **File persistence** - Files are stored within the container and synced with the UI

### Container Management

#### Automatic Creation

When you create a new project:

1. A Docker container is created with a unique name (`project-{id}`)
2. The Soroban contract template is automatically initialized
3. Dependencies are installed (`cargo build`)

#### Container Operations via API

The backend provides API endpoints for container management:

```
POST /api/docker
```

**Available Actions:**

- `createProject` - Create and initialize a new container
- `deleteProject` - Stop and remove a container
- `getFiles` - List all files in a project
- `getFileContent` - Read file content
- `saveFileContent` - Write file content
- `buildProject` - Build the contract
- `deployProject` - Deploy the contract

### Manual Docker Commands (Advanced)

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# View container logs
docker logs <container-name>

# Execute command in container
docker exec <container-name> <command>

# Remove a project container
docker stop <container-name>
docker rm <container-name>
```

### Docker Requirements

- **Docker installed** on your system
- **Docker daemon running** and accessible
- **stellar-sandbox image** available (pre-built or pulled automatically)
- Sufficient disk space for container images and project files

For detailed Docker setup instructions, see [DOCKER_SETUP.md](./DOCKER_SETUP.md)

## API Reference

### Project Management

#### Create Project

```
POST /api/docker
Content-Type: application/json

{
  "action": "createProject",
  "userId": "1",
  "projectName": "My Contract",
  "description": "A sample contract"
}

Response:
{
  "success": true,
  "projectId": "project-123",
  "message": "Project created successfully"
}
```

#### Delete Project

```
POST /api/docker
Content-Type: application/json

{
  "action": "deleteProject",
  "projectId": "project-123"
}

Response:
{
  "success": true,
  "message": "Project deleted successfully"
}
```

#### Get All Projects

```
POST /api/docker
Content-Type: application/json

{
  "action": "getAllProjects",
  "userId": "1"
}

Response:
{
  "success": true,
  "projects": [
    {
      "id": "project-123",
      "name": "My Contract",
      "createdAt": "2024-01-15T10:30:00Z",
      "description": "A sample contract"
    }
  ]
}
```

### File Operations

#### Get Files

```
POST /api/docker
{
  "action": "getFiles",
  "projectId": "project-123",
  "path": "/src"
}

Response:
{
  "success": true,
  "files": [
    { "name": "lib.rs", "type": "file", "path": "/src/lib.rs" },
    { "name": "config", "type": "directory", "path": "/src/config" }
  ]
}
```

#### Get File Content

```
POST /api/docker
{
  "action": "getFileContent",
  "projectId": "project-123",
  "filePath": "/src/lib.rs"
}

Response:
{
  "success": true,
  "content": "// Your contract code here\n..."
}
```

#### Save File Content

```
POST /api/docker
{
  "action": "saveFileContent",
  "projectId": "project-123",
  "filePath": "/src/lib.rs",
  "content": "// Updated code here\n..."
}

Response:
{
  "success": true,
  "message": "File saved successfully"
}
```

### Build & Deploy

#### Build Contract

```
POST /api/docker
{
  "action": "buildProject",
  "projectId": "project-123"
}

Response:
  "success": true,
  "wasmPath": "/path/to/contract.wasm",
  "output": "Build output logs..."
}
```

#### Deploy Contract

```
POST /api/docker
{
  "action": "deployProject",
  "projectId": "project-123",
  "walletAddress": "G...",
  "network": "testnet"
}

Response:
{
  "success": true,
  "contractId": "C...",
  "transactionHash": "tx-hash-...",
  "message": "Contract deployed successfully"
}
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Container not found"

**Problem:** The Docker container for your project is not running or has been deleted.

**Solutions:**

1. Verify Docker is installed and running: `docker ps`
2. Check if the container exists: `docker ps -a`
3. Delete and recreate the project from the Home page

#### Issue: "Build failed" or "Compilation error"

**Problem:** Your contract code has syntax errors or missing dependencies.

**Solutions:**

1. Check the error message in the Terminal panel
2. Review the line number indicated in the error
3. Verify all imports are correct: `use soroban_sdk::...`
4. Check `Cargo.toml` for required dependencies
5. Fix the code and click Build again

#### Issue: "Wallet not connecting"

**Problem:** Cannot connect to Freighter wallet.

**Solutions:**

1. Ensure Freighter extension is installed in your browser
2. Verify the extension is enabled
3. Try refreshing the page (Ctrl + R / Cmd + R)
4. Clear browser cache and cookies
5. Try a different browser or device

#### Issue: "Deploy failed" or insufficient balance

**Problem:** Cannot deploy contract due to insufficient funds.

**Solutions:**

1. Check your wallet balance in the top right corner
2. Ensure you have at least 1 XLM for transaction fees
3. Get testnet XLM from the [Stellar Testnet Faucet](https://stellar.expert/)
4. Wait a few seconds and try deploying again

#### Issue: "Files not saving"

**Problem:** Changes to files are not being persisted.

**Solutions:**

1. Check the Terminal for any error messages
2. Verify the Docker container is still running: `docker ps`
3. Try closing and reopening the file
4. Refresh the page and open the file again
5. Check available disk space on your system

#### Issue: Slow Performance

**Problem:** Editor is running slow or unresponsive.

**Solutions:**

1. Close unnecessary tabs to reduce memory usage
2. Clear browser cache and restart
3. Reduce terminal log history (clear logs)
4. Check available system memory and CPU
5. Try a different browser

### Getting Help

If you encounter issues not listed above:

1. **Check the Terminal panel** for detailed error messages
2. **Review the console** (F12 → Console tab) for JavaScript errors
3. **Check Docker logs** for container-related issues:
   ```bash
   docker logs <container-name>
   ```
4. **Restart the application**:
   - Stop the dev server (Ctrl + C)
   - Clear node cache: `rm -rf .next`
   - Restart: `npm run dev`

## Additional Resources

- **Soroban Documentation**: [soroban.stellar.org](https://soroban.stellar.org)
- **Stellar SDK**: [js-stellar-sdk](https://github.com/stellar/js-stellar-sdk)
- **Freighter Wallet**: [freighter.app](https://www.freighter.app)
- **Monaco Editor**: [microsoft.github.io/monaco-editor](https://microsoft.github.io/monaco-editor/)

## Security

- **Private containers** - Each project runs in an isolated Docker container
- **Wallet security** - Private keys never leave your Freighter wallet
- **HTTPS only** - All connections use secure HTTPS
- **No data collection** - Your code and wallet information remain private

## License

This project is built with Next.js, React, and Monaco Editor.

## Development

### Quickstart for Contributors

A fresh contributor can go from cloning the repository to passing local checks with the following steps:

```bash
# 1. Clone the repository
git clone https://github.com/sorobanide-studio/stellar-ide.git
cd stellar-ide

# 2. Install dependencies
npm install

# 3. Verify local linting
npm run lint

# 4. Verify local production build
npm run build
```

### Available Scripts (`package.json`)

Every script defined in `package.json` is documented below:

| Script | Command | Description | Corresponding CI Job |
| --- | --- | --- | --- |
| `dev` | `next dev --experimental-https` | Starts the local Next.js development server with experimental HTTPS enabled at `https://localhost:3000`. | Local Development |
| `build` | `next build` | Compiles the TypeScript application and creates the optimized Next.js production build. | `build` CI job |
| `start` | `next start` | Runs the compiled Next.js production server locally (requires running `npm run build` first). | Production Serving |
| `lint` | `eslint` | Executes ESLint to check for code quality, syntax issues, and formatting conformance. | `lint` CI job |
| `test` | `npm test` | Runs the test suite when test files are present. | `test` CI job |

### HTTPS & Self-Signed Certificate Behavior

The development script uses `next dev --experimental-https` to run on `https://localhost:3000`. 

- **Why HTTPS is Required:** The Freighter wallet API (`@stellar/freighter-api`) and web cryptographic APIs require a secure context (HTTPS) to interact with browser extensions and sign transactions securely.
- **Browser Certificate Warning:** Because Next.js generates a self-signed TLS certificate during local development, your browser will display a security warning (e.g., *"Your connection is not private"* or *"Potential Security Risk Ahead"*).
- **How to Proceed:** Click **"Advanced"** and select **"Proceed to localhost (unsafe)"** (or **"Accept the Risk and Continue"** in Firefox). This is expected behavior exclusively for local development.

### Matching Local Commands to CI Checks

Pull requests must pass all continuous integration checks. You can run the exact commands locally before pushing your branch:

1. **Lint Check (CI `lint` job):**
   ```bash
   npm run lint
   ```
2. **Build Check (CI `build` job):**
   ```bash
   npm run build
   ```
3. **Test Suite (CI `test` job):**
   ```bash
   npm test --if-present
   ```

---

**Happy Coding! **

Start building your Soroban smart contracts today with a modern, intuitive development environment.
