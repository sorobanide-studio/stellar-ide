/**
 * Docker Utilities
 * 
 * Helper functions for safe Docker command execution
 */

import { exec } from 'child_process';
import path from 'path';
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
 * Absolute path to one of the extracted shell fragments under `scripts/`.
 * The fragments are plain POSIX shell that shellcheck lints in CI.
 */
export function getScriptPath(scriptName: string): string {
  return path.join(process.cwd(), 'scripts', scriptName);
}

/**
 * Build a command that runs one of the extracted `scripts/*.sh` fragments
 * with an explicit `sh`, so the shell executing the fragment is not
 * incidental, and every argument is quoted.
 */
export function scriptCommand(scriptName: string, ...args: string[]): string {
  return ['sh', getScriptPath(scriptName), ...args].map(escapeShellArg).join(' ');
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

