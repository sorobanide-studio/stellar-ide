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
 * Normalise and escape a file path for Docker exec.
 *
 * The previous implementation stripped characters
 * (`path.replace(/^\/+/, '').replace(/\.\./g, '')`), which let a bare `..`
 * collapse to an empty string (i.e. the project root, so `deleteFolder` could
 * `rm -rf` the whole project) and turned `a/../b` into `a/b` instead of
 * resolving it. This normalises the path instead: absolute paths and any `..`
 * segment that would escape the project root are rejected, `.` segments are
 * resolved, and the result can never be empty (the project root itself).
 *
 * @param path The relative path to normalise
 * @returns A normalised, non-empty, root-relative path
 * @throws Error when the path is not a string, is absolute, or escapes the root
 */
export function escapeFilePath(path: string): string {
  if (typeof path !== 'string') {
    throw new Error('Invalid file path: expected a string');
  }

  // Reject absolute POSIX, backslash and Windows drive paths outright.
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-zA-Z]:[\\/]/.test(path)
  ) {
    throw new Error(
      `Invalid file path: absolute paths are not allowed (${path})`
    );
  }

  const resolved: string[] = [];
  for (const segment of path.split(/[\\/]+/)) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (resolved.length === 0) {
        throw new Error(
          `Invalid file path: path escapes the project root (${path})`
        );
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  if (resolved.length === 0) {
    throw new Error(
      `Invalid file path: path resolves to the project root (${path})`
    );
  }

  return resolved.join('/');
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

