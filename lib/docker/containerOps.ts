/**
 * Docker Container Operations
 * 
 * Handles creation, deletion, and health checks for Docker containers
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  getWorkspaceVolumeName,
  sleep,
} from './utils';

/**
 * Build the `docker run` command that creates a wallet's container.
 *
 * Project files live in a per-wallet named volume mounted at the workspace
 * path, so they (and the Stellar home under it) survive container removal and
 * image rebuilds instead of living in the container's writable layer.
 * Exported so the generated command can be asserted in tests.
 * @param walletAddress The Stellar wallet public key
 * @returns The full `docker run` command
 */
export function buildRunContainerCommand(walletAddress: string): string {
  const containerName = getContainerName(walletAddress);
  const volumeName = getWorkspaceVolumeName(walletAddress);
  return `docker run -d --name ${containerName} -e STELLAR_HOME=/home/developer/workspace/.stellar -v ${volumeName}:/home/developer/workspace stellar-sandbox:v1 tail -f /dev/null`;
}

/**
 * Create and initialize a new Docker container
 * @param walletAddress The Stellar wallet public key
 * @returns Container creation result
 */
export async function createAndInitializeContainer(walletAddress: string) {
  try {
    const containerName = getContainerName(walletAddress);
    console.log(`Setting up container: ${containerName}`);

    // Check if container already exists and is running
    let containerExists = false;
    let containerRunning = false;
    try {
      const { stdout: checkExists } = await execAsync(
        `docker ps -a --filter name=^${containerName}$ --format "{{.Names}}"`
      );
      containerExists = checkExists.trim() === containerName;
      
      if (containerExists) {
        // Check if it's running
        const { stdout: statusCheck } = await execAsync(
          `docker inspect -f '{{.State.Running}}' ${containerName}`
        );
        containerRunning = statusCheck.trim() === 'true';
        
        if (containerRunning) {
          console.log(`Container ${containerName} already exists and is running. Reusing it.`);
          
          // Just verify contract exists, don't reinitialize
          const { stdout: verifyDir } = await execAsync(
            `docker exec ${containerName} test -d ${getWorkspacePath()}/soroban-hello-world && echo "exists" || echo "missing"`
          );
          
          if (verifyDir.trim() === 'exists') {
            return {
              success: true,
              containerName,
              message: `Container ${containerName} already exists and is ready`,
            };
          } else {
            console.log(`Contract directory missing, reinitializing...`);
          }
        } else {
          // Container exists but not running, start it
          console.log(`Container ${containerName} exists but is stopped. Starting it...`);
          await execAsync(`docker start ${containerName}`);
          await sleep(2000);
          containerRunning = true;
        }
      }
    } catch (error) {
      console.log('Container check error, will create new one:', error);
      containerExists = false;
    }

    // If container doesn't exist, create it
    if (!containerExists) {
      console.log(`Creating new container: ${containerName}`);
      const { stdout: createOutput } = await execAsync(
        buildRunContainerCommand(walletAddress)
      );
      console.log('Container created:', createOutput.trim());

      // Wait for container to be fully ready
      await sleep(2000);
    }

    // Verify container is running
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName}`
    );

    if (statusCheck.trim() !== 'true') {
      throw new Error('Container failed to start properly');
    }

    // Initialize Soroban contract in the workspace directory
    console.log(`Initializing contract in container: ${containerName}`);

    try {
      const { stdout: initOutput, stderr: initError } = await execAsync(
        `docker exec -u developer ${containerName} sh -c "cd ${getWorkspacePath()} && stellar contract init soroban-hello-world"`,
        { timeout: 30000 } // 30 second timeout
      );
      console.log('Contract initialized:', initOutput);
      if (initError) {
        console.log('Init stderr:', initError);
      }
    } catch (initError: any) {
      console.error('Contract initialization error:', initError.message);
      // Don't fail if contract already exists
      if (!initError.message.includes('already exists')) {
        throw initError;
      }
      console.log('Contract already initialized, continuing...');
    }

    // Verify the directory was created
    const { stdout: verifyDir } = await execAsync(
      `docker exec ${containerName} test -d ${getWorkspacePath()}/soroban-hello-world && echo "exists" || echo "missing"`
    );

    if (verifyDir.trim() !== 'exists') {
      throw new Error('Contract directory was not created');
    }

    return {
      success: true,
      containerName,
      message: `Container ${containerName} ready for use`,
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create container',
    };
  }
}

/**
 * Delete a Docker container
 *
 * The wallet's workspace volume is RETAINED by default: project files and the
 * wallet identity live in the volume, not the container, so removing the
 * container (or rebuilding the image) does not erase them. Pass
 * `{ removeVolume: true }` to permanently delete the workspace as well.
 * @param walletAddress The Stellar wallet public key
 * @param options.removeVolume Delete the workspace volume too (default false)
 * @returns Deletion result
 */
export async function deleteContainer(
  walletAddress: string,
  options: { removeVolume?: boolean } = {}
) {
  try {
    const containerName = getContainerName(walletAddress);
    const volumeName = getWorkspaceVolumeName(walletAddress);
    console.log(`Deleting container: ${containerName}`);

    // Stop container (ignore errors if not running)
    try {
      await execAsync(`docker stop ${containerName}`, { timeout: 10000 });
    } catch (error) {
      console.log('Container may not be running, continuing with removal');
    }

    // Remove container (ignore errors if doesn't exist). The named volume is
    // not attached to the container's lifecycle, so this leaves it intact.
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch (error) {
      console.log('Container may not exist, considering deletion successful');
    }

    let volumeRemoved = false;
    if (options.removeVolume) {
      try {
        await execAsync(`docker volume rm ${volumeName}`);
        volumeRemoved = true;
      } catch (error: any) {
        console.warn(`Could not remove workspace volume ${volumeName}:`, error?.message || error);
      }
    }

    console.log(
      `Container ${containerName} deleted (workspace volume ${volumeName} ${
        volumeRemoved ? 'removed' : 'retained'
      })`
    );
    return {
      success: true,
      containerName,
      volumeName,
      volumeRetained: !volumeRemoved,
      message: volumeRemoved
        ? `Container ${containerName} and workspace volume ${volumeName} deleted`
        : `Container ${containerName} deleted; workspace volume ${volumeName} retained`,
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete container',
    };
  }
}

/**
 * Check if a container is healthy and running
 * @param walletAddress The Stellar wallet public key
 * @returns Health check result
 */
export async function checkContainerHealth(walletAddress: string): Promise<boolean> {
  try {
    const containerName = getContainerName(walletAddress);
    const { stdout: statusCheck } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerName}`
    );
    return statusCheck.trim() === 'true';
  } catch (error) {
    console.error('Health check error:', error);
    return false;
  }
}

/**
 * Ensure a container is running, throw if not
 * @param walletAddress The Stellar wallet public key
 * @throws Error if container is not running
 */
export async function ensureContainerRunning(walletAddress: string): Promise<void> {
  const isRunning = await checkContainerHealth(walletAddress);
  if (!isRunning) {
    throw new Error(`Container for wallet ${walletAddress} is not running`);
  }
}

