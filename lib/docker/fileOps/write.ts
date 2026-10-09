/**
 * File Write Operations
 * Creating and saving files and folders
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  escapeFilePath,
  scriptCommand,
} from '../utils';
import {
  buildFindByNameCommand,
  buildMkdirCommand,
  buildTestFileCommand,
  buildTouchFileCommand,
  buildWriteFileCommand,
} from './commands';

/**
 * Save content to a file
 * @param walletAddress The Stellar wallet public key
 * @param filePath The relative file path
 * @param content The file content to save
 * @param projectName Optional specific project
 * @returns Save result
 */
export async function saveFileContent(walletAddress: string, filePath: string, content: string, projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    const safePath = escapeFilePath(filePath);
    console.log(`Saving file: ${safePath} to container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;
    console.log(`Full path: ${fullPath}`);

    // First verify the file exists (as `developer`)
    const { stdout: fileCheck } = await execAsync(
      buildTestFileCommand(containerName, fullPath)
      scriptCommand('path-exists.sh', containerName, 'f', fullPath)
    );

    if (fileCheck.trim() === 'missing') {
      console.error(`File not found at: ${fullPath}`);
      // Try to show what files exist
      const { stdout: dirContents } = await execAsync(
        buildFindByNameCommand(containerName, basePath, 'lib.rs')
      );
      console.log('Found lib.rs at:', dirContents);
      return {
        success: false,
        error: `File not found at ${fullPath}. Try refreshing the file tree.`,
      };
    // Ensure the parent directory exists so a save to a path that does not
    // exist yet creates the file (upsert) instead of failing a `test -f` guard.
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (parentDir) {
      await execAsync(`docker exec -u developer ${containerName} mkdir -p ${parentDir}`);
    }

    // Escape content for shell - use base64 encoding to avoid shell escaping issues
    const base64Content = Buffer.from(content).toString('base64');

    // Write file as the unprivileged `developer` user so the build user owns it
    // Write file to container using base64 decoding. `>` creates the file when
    // it is missing and truncates it when it exists.
    await execAsync(
      buildWriteFileCommand(containerName, fullPath, base64Content),
      scriptCommand('write-file-content.sh', containerName, fullPath, base64Content),
      { timeout: 10000 }
    );

    console.log('File saved successfully');
    return { success: true, message: 'File saved' };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to save file',
    };
  }
}

/**
 * Create a new file in the container
 * @param walletAddress The Stellar wallet public key
 * @param filePath The relative file path
 * @param content The initial file content
 * @param projectName Optional specific project
 * @returns Creation result
 */
export async function createFile(walletAddress: string, filePath: string, content: string = '', projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    const safePath = escapeFilePath(filePath);
    console.log(`Creating file: ${safePath} in container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Create parent directories if needed (as `developer`)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await execAsync(buildMkdirCommand(containerName, dir));

    // Create file with content (or empty if no content), as `developer`
    if (content) {
      const base64Content = Buffer.from(content).toString('base64');
      await execAsync(buildWriteFileCommand(containerName, fullPath, base64Content));
      await execAsync(
        scriptCommand('write-file-content.sh', containerName, fullPath, base64Content)
      );
    } else {
      await execAsync(buildTouchFileCommand(containerName, fullPath));
    }

    console.log(`File created: ${fullPath}`);
    return {
      success: true,
      message: `File ${filePath} created`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to create file',
    };
  }
}

/**
 * Create a folder in the container
 * @param walletAddress The Stellar wallet public key
 * @param folderPath The path of the folder to create
 * @param projectName Optional specific project
 * @returns Success or error
 */
export async function createFolder(walletAddress: string, folderPath: string, projectName?: string) {
  try {
    const containerName = getContainerName(walletAddress);
    const safePath = escapeFilePath(folderPath);
    console.log(`Creating folder: ${safePath} in container: ${containerName}`);

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const workspacePath = getWorkspacePath();
    const basePath = `${workspacePath}/${projectName}`;
    const fullPath = `${basePath}/${safePath}`;

    // Create folder recursively (as `developer`)
    await execAsync(buildMkdirCommand(containerName, fullPath));

    console.log(`Folder created: ${fullPath}`);
    return {
      success: true,
      message: `Folder ${folderPath} created`,
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Docker error:', err);
    return {
      success: false,
      error: err.message || 'Failed to create folder',
    };
  }
}
