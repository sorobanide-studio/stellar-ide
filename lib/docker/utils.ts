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
 * Matches a Stellar ed25519 public key (StrKey): 56 base32 characters starting
 * with `G`. Equivalent to `StrKey.isValidEd25519PublicKey`.
 */
export const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Validate a Stellar public key.
 * @param walletAddress Value to check
 * @returns true when it is a well-formed Stellar ed25519 public key
 */
export function isValidStellarAddress(walletAddress: unknown): walletAddress is string {
  return (
    typeof walletAddress === 'string' &&
    STELLAR_PUBLIC_KEY_REGEX.test(walletAddress)
  );
}

/**
 * Get container name from wallet address (public key)
 * @param walletAddress The Stellar wallet public key
 * @returns Formatted container name
 * @throws Error when the address is not a valid Stellar public key
 */
export function getContainerName(walletAddress: string): string {
  // The value is interpolated into `docker run --name soroban-<prefix>`,
  // `docker exec ${containerName}` and `docker rm -f ${containerName}`, so a
  // caller-supplied address containing shell metacharacters (e.g.
  // `abc; rm -rf /`) must be rejected before any command is built.
  if (!isValidStellarAddress(walletAddress)) {
    throw new Error(
      'Invalid wallet address: expected a Stellar ed25519 public key (56 base32 characters starting with G)'
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
 * Get the Docker named volume that backs a wallet's workspace.
 *
 * Mounted at `getWorkspacePath()` so project files and the Stellar home
 * survive `docker rm` and image rebuilds. Named per wallet so two wallets never
 * share a workspace. Retained by default when a container is deleted (see
 * `deleteContainer`).
 * @param walletAddress The Stellar wallet public key
 * @returns Volume name
 */
export function getWorkspaceVolumeName(walletAddress: string): string {
  return `${getContainerName(walletAddress)}-workspace`;
 * Get the Stellar CLI identity name for a wallet.
 *
 * Derived from the wallet address using the same 10-character prefix as
 * `getContainerName`, so every wallet gets its own funded Stellar key instead
 * of sharing one hard-coded identity.
 * Format: stellar-GBUQWP3K... -> stellar-gbuqwp3k
 * @param walletAddress The Stellar wallet public key
 * @returns Formatted identity name
 */
export function getIdentityName(walletAddress: string): string {
  const prefix = walletAddress.slice(0, 10).toLowerCase();
  return `stellar-${prefix}`;
 * Get the on-container path where a wallet's Stellar credentials are backed up.
 *
 * Deliberately kept outside the workspace (`getWorkspacePath()`) so deleting a
 * project can never remove the wallet identity, and named after the wallet
 * rather than the project.
 * @param walletAddress The Stellar wallet public key
 * @returns Backup directory path (does NOT sit under the workspace)
 */
export function getCredentialBackupPath(walletAddress: string): string {
  return `/home/developer/.stellar-backups/${getContainerName(walletAddress)}`;
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

