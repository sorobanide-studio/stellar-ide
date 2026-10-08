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

    // First verify the file exists
    const { stdout: fileCheck } = await execAsync(
      scriptCommand('path-exists.sh', containerName, 'f', fullPath)
    );

    if (fileCheck.trim() === 'missing') {
      console.error(`File not found at: ${fullPath}`);
      // Try to show what files exist
      const { stdout: dirContents } = await execAsync(
        `docker exec ${containerName} find ${basePath} -name "lib.rs" 2>/dev/null || true`
      );
      console.log('Found lib.rs at:', dirContents);
      return {
        success: false,
        error: `File not found at ${fullPath}. Try refreshing the file tree.`,
      };
    }

    // Escape content for shell - use base64 encoding to avoid shell escaping issues
    const base64Content = Buffer.from(content).toString('base64');

    // Write file to container using base64 decoding
    await execAsync(
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

    // Create parent directories if needed
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await execAsync(`docker exec -u developer ${containerName} mkdir -p ${dir}`);

    // Create file with content (or empty if no content)
    if (content) {
      const base64Content = Buffer.from(content).toString('base64');
      await execAsync(
        scriptCommand('write-file-content.sh', containerName, fullPath, base64Content)
      );
    } else {
      await execAsync(`docker exec -u developer ${containerName} touch ${fullPath}`);
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

    // Create folder recursively
    await execAsync(`docker exec -u developer ${containerName} mkdir -p ${fullPath}`);

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
