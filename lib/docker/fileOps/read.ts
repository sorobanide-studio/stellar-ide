/**
 * File Read Operations
 * Reading files and listing directory contents
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  escapeFilePath,
} from '../utils';
import {
  buildFindFilesCommand,
  buildReadFileCommand,
  buildTestDirCommand,
  buildTestFileCommand,
} from './commands';

/**
 * Get all files from container project directory
 * @param walletAddress The Stellar wallet public key
 * @param projectName Optional specific project to filter files from
 * @returns List of files
 */
export async function getContainerFiles(walletAddress: string, projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    console.log(`Getting files from container: ${containerName}, project: ${projectName}`);

    // Verify container is running
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName} 2>/dev/null || echo "false"`
    );

    if (statusCheck.trim() !== 'true') {
      throw new Error('Container is not running');
    }

    const workspacePath = getWorkspacePath();

    // If no projectName, we need one
    if (!projectName) {
      return {
        success: true,
        files: [],
        message: 'Please select a project to open',
      };
    }

    const searchPath = `${workspacePath}/${projectName}`;
    console.log(`Searching for files in: ${searchPath}`);

    // Check if project exists (as the unprivileged `developer` user)
    const { stdout: projectExists } = await execAsync(
      buildTestDirCommand(containerName, searchPath)
    );

    if (projectExists.trim() !== 'exists') {
      return {
        success: true,
        files: [],
        message: `Project ${projectName} not found`,
      };
    }

    // Get files from container - find all files recursively
    const { stdout } = await execAsync(
      buildFindFilesCommand(containerName, searchPath),
      { timeout: 10000 }
    );

    // Parse the output and filter out unwanted paths
    let allFiles = stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
      .map((f) => f.replace(`${searchPath}/`, ''))
      // Filter out build artifacts
      .filter((f) => !f.includes('/target/') && !f.includes('/.git/') && f !== 'Cargo.lock' && f !== 'projects.json');

    console.log(`Found ${allFiles.length} files in ${searchPath}`);
    console.log('Files list:', allFiles);
    return { success: true, files: allFiles };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to get files',
      files: [],
    };
  }
}

/**
 * Get content of a specific file
 * @param walletAddress The Stellar wallet public key
 * @param filePath The relative file path
 * @param projectName Optional specific project
 * @returns File content
 */
export async function getFileContent(walletAddress: string, filePath: string, projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    const safePath = escapeFilePath(filePath);
    console.log(`Reading file: ${safePath} from container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;
    console.log(`Full path for reading: ${fullPath}`);

    // Verify file exists first (as `developer`)
    const { stdout: fileExists } = await execAsync(
      buildTestFileCommand(containerName, fullPath)
    );

    if (fileExists.trim() !== 'exists') {
      console.error(`File not found: ${fullPath}`);
      throw new Error(`File does not exist at ${fullPath}`);
    }

    // Read file from container
    const { stdout } = await execAsync(
      buildReadFileCommand(containerName, fullPath),
      { maxBuffer: 10 * 1024 * 1024 } // 10MB max file size
    );

    return { success: true, content: stdout };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to read file',
      content: '',
    };
  }
}
