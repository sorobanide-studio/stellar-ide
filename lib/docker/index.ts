/**
 * Docker Operations - Barrel Export
 * 
 * This file re-exports all Docker operations for backward compatibility.
 * The actual implementations are split across multiple focused modules:
 * - containerOps.ts: Container creation, deletion, health checks
 * - fileOps.ts: File operations (read, write, delete)
 * - buildOps.ts: Contract building and compilation
 * - deployOps.ts: Contract deployment
 * - accountOps.ts: Account management
 * - utils.ts: Utility functions
 */

// Export utilities
export {
  execAsync,
  escapeShellArg,
  escapeFilePath,
  getContainerName,
  isValidStellarAddress,
  getIdentityName,
  getCredentialBackupPath,
  getProjectPath,
  getWorkspacePath,
  getWorkspaceVolumeName,
  formatDockerError,
  sleep,
} from './utils';

// Export container operations
export {
  createAndInitializeContainer,
  deleteContainer,
  checkContainerHealth,
  ensureContainerRunning,
} from './containerOps';

// Export file operations
export {
  getContainerFiles,
  getFileContent,
  saveFileContent,
  deleteFile,
  deleteFolder,
  createFile,
  createFolder,
} from './fileOps';

// Export build operations
export {
  buildContract,
  compileContract,
  getContractBuildStatus,
  cleanBuild,
} from './buildOps';

// Export deploy operations
export {
  deployContract,
  getDeploymentStatus,
  buildAndDeploy,
} from './deployOps';

// Export account operations
export {
  createAccount,
  generateKeys,
  getAccountStatus,
  backupCredentials,
} from './accountOps';

