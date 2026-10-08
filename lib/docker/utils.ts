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
 * @throws Error when the address is missing or not a 56-character G-address
 */
export function getContainerName(walletAddress: string): string {
  // Reject a missing or malformed address explicitly. Previously a missing
  // address threw `TypeError: Cannot read properties of undefined (reading
  // 'slice')` from deep inside this call and surfaced as a 500.
  if (typeof walletAddress !== 'string' || walletAddress.trim() === '') {
    throw new Error(
      'Invalid wallet address: a Stellar wallet public key is required'
    );
  }
  if (walletAddress.length !== 56 || !walletAddress.startsWith('G')) {
    throw new Error(
      'Invalid wallet address: expected a 56-character Stellar public key starting with G'
    );
  }

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

