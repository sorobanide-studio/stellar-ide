/**
 * Docker Container Operations
 * 
 * Handles creation, deletion, and health checks for Docker containers
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
  sleep,
} from './utils';
import { SANDBOX_IMAGE } from './image';

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
        `docker run -d --name ${containerName} -e STELLAR_HOME=/home/developer/workspace/.stellar ${SANDBOX_IMAGE} tail -f /dev/null`
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
 * @param walletAddress The Stellar wallet public key
 * @returns Deletion result
 */
export async function deleteContainer(walletAddress: string) {
  try {
    const containerName = getContainerName(walletAddress);
    console.log(`Deleting container: ${containerName}`);

    // Stop container (ignore errors if not running)
    try {
      await execAsync(`docker stop ${containerName}`, { timeout: 10000 });
    } catch (error) {
      console.log('Container may not be running, continuing with removal');
    }

    // Remove container (ignore errors if doesn't exist)
    try {
      await execAsync(`docker rm -f ${containerName}`);
    } catch (error) {
      console.log('Container may not exist, considering deletion successful');
    }

    console.log(`Container ${containerName} deleted`);
    return {
      success: true,
      containerName,
      message: `Container ${containerName} deleted`,
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

/**
 * Read the toolchain versions baked into the sandbox image.
 *
 * The Dockerfile records `image`, `rust` and `stellar-cli` in
 * `/home/developer/.stellar-sandbox-versions` at build time; this surfaces them
 * so a health check can report the running toolchain.
 * @param walletAddress The Stellar wallet public key
 * @returns Parsed key/value version manifest
 */
export async function getToolchainVersions(
  walletAddress: string
): Promise<Record<string, string>> {
  const containerName = getContainerName(walletAddress);
  const { stdout } = await execAsync(
    `docker exec ${containerName} cat /home/developer/.stellar-sandbox-versions 2>/dev/null || true`
  );

  const versions: Record<string, string> = {};
  for (const line of stdout.trim().split('\n')) {
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) versions[key] = value;
  }
  return versions;
}

