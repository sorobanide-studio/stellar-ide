/**
 * Docker Utilities
 * 
 * Helper functions for safe Docker command execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

/**
 * Escape shell arguments safely to prevent injection
 * @param arg The argument to escape
 * @returns Properly escaped argument
 */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escape file paths for Docker exec
 * Removes leading slashes and prevents path traversal
 * @param path The path to escape
 * @returns Sanitized path
 */
export function escapeFilePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\.\./g, '');
}

/**
 * Get container name from wallet address (public key)
 * @param walletAddress The Stellar wallet public key
 * @returns Formatted container name
 */
export function getContainerName(walletAddress: string): string {
  // Use first 10 characters of wallet address and convert to lowercase
  // Format: soroban-GBUQWP3K... -> soroban-gbuqwp3k
  const prefix = walletAddress.slice(0, 10).toLowerCase();
  return `soroban-${prefix}`;
}

/**
 * Get the base project path in container
 * @returns The project directory path
 */
export function getProjectPath(): string {
  return '/home/developer/workspace/soroban-hello-world';
}

/**
 * Get the workspace base path in container
 * @returns The workspace directory path
 */
export function getWorkspacePath(): string {
  return '/home/developer/workspace';
}

/**
 * Default Soroban project used when no project name is supplied.
 */
export const DEFAULT_PROJECT_NAME = 'soroban-hello-world';

/**
 * Resolve the absolute container directory for a project.
 * @param projectName Optional project name (defaults to the hello-world project)
 * @returns Absolute project directory inside the container
 */
export function resolveProjectDirectory(projectName?: string): string {
  const name = (projectName || DEFAULT_PROJECT_NAME)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!name || name.split('/').some((segment) => segment === '' || segment === '..')) {
    throw new Error(`Invalid project name: ${projectName}`);
  }
  return `${getWorkspacePath()}/${name}`;
}

/**
 * Derive the WASM artifact file name produced for a project.
 *
 * `stellar contract init <name>` / cargo name the artifact after the crate,
 * normalising `-` to `_` in the file name, e.g. `my-contract` ->
 * `my_contract.wasm`. The previous code hard-coded `hello_world.wasm`, so every
 * project with any other name reported "WASM file not created" after a
 * successful build.
 *
 * @param projectName Optional project name (defaults to the hello-world project)
 * @returns The WASM file name
 */
export function getWasmFileName(projectName?: string): string {
  const name = (projectName || DEFAULT_PROJECT_NAME).trim().replace(/\/+$/, '');
  const base = name.split('/').filter(Boolean).pop() || '';
  if (!base) {
    throw new Error('A project name is required to locate the built WASM');
  }
  return `${base.replace(/-/g, '_')}.wasm`;
}

/**
 * Path of a project's built WASM, relative to the project directory.
 * @param projectName Optional project name
 * @returns Relative WASM path used by `stellar contract deploy --wasm`
 */
export function getWasmRelativePath(projectName?: string): string {
  return `target/wasm32v1-none/release/${getWasmFileName(projectName)}`;
}

/**
 * Absolute container path of a project's built WASM.
 * @param projectDir Absolute project directory
 * @param projectName Optional project name
 * @returns Absolute WASM path
 */
export function getWasmPath(projectDir: string, projectName?: string): string {
  return `${projectDir}/${getWasmRelativePath(projectName)}`;
}

/**
 * Absolute container path of the WASM copy cargo writes under deps/.
 * @param projectDir Absolute project directory
 * @param projectName Optional project name
 * @returns Absolute deps WASM path
 */
export function getWasmDepsPath(projectDir: string, projectName?: string): string {
  return `${projectDir}/target/wasm32v1-none/release/deps/${getWasmFileName(projectName)}`;
}

/**
 * Format error output from Docker commands
 * @param output The error output
 * @returns Formatted error message
 */
export function formatDockerError(output: string): string {
  return output.trim() || 'Unknown Docker error';
}

/**
 * Sleep for a given duration
 * @param ms Duration in milliseconds
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

