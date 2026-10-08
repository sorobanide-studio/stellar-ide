/**
 * File Delete Operations
 * Deleting files and folders
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  escapeFilePath,
} from '../utils';
import {
  buildRemoveFileCommand,
  buildRemoveFolderCommand,
  buildTestDirCommand,
  buildTestFileCommand,
} from './commands';

/**
 * Delete a file from the container
 * @param walletAddress The Stellar wallet public key
 * @param filePath The relative file path
 * @param projectName Optional specific project
 * @returns Deletion result
 */
export async function deleteFile(walletAddress: string, filePath: string, projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    const safePath = escapeFilePath(filePath);
    console.log(`Deleting file: ${safePath} from container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Verify file exists (as `developer`)
    const { stdout: fileCheck } = await execAsync(
      buildTestFileCommand(containerName, fullPath)
    );

    if (fileCheck.trim() !== 'exists') {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    // Delete file (as `developer`)
    await execAsync(buildRemoveFileCommand(containerName, fullPath));

    console.log(`File deleted: ${fullPath}`);
    return {
      success: true,
      message: `File ${filePath} deleted`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to delete file',
    };
  }
}

/**
 * Delete a folder from the container
 * @param walletAddress The Stellar wallet public key
 * @param folderPath The relative folder path
 * @param projectName Optional specific project
 * @returns Deletion result
 */
export async function deleteFolder(walletAddress: string, folderPath: string, projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    const safePath = escapeFilePath(folderPath);
    console.log(`Deleting folder: ${safePath} from container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Verify folder exists (as `developer`)
    const { stdout: folderCheck } = await execAsync(
      buildTestDirCommand(containerName, fullPath)
    );

    if (folderCheck.trim() !== 'exists') {
      throw new Error(`Folder does not exist: ${fullPath}`);
    }

    // Delete folder recursively (as `developer`)
    await execAsync(buildRemoveFolderCommand(containerName, fullPath));

    console.log(`Folder deleted: ${fullPath}`);
    return {
      success: true,
      message: `Folder ${folderPath} deleted`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to delete folder',
    };
  }
}
