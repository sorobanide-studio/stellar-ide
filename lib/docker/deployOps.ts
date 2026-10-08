/**
 * Docker Deploy Operations
 * 
 * Handles contract deployment to Stellar network
 */

import {
  execAsync,
  getContainerName,
  getIdentityName,
  getWorkspacePath,
} from './utils';

/**
 * Deploy a Soroban contract to the Stellar testnet
 * @param userId The user ID
 * @param publicKey Optional public key for signing
 * @param projectName The project name
 * @returns Deployment result
 */
export async function deployContract(userId: string, publicKey?: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const identity = getIdentityName(userId);
    const workspacePath = getWorkspacePath();
    const projectDir = projectName ? `${workspacePath}/${projectName}` : `${workspacePath}/soroban-hello-world`;

    console.log(`Deploying contract in container: ${containerName}, project: ${projectName || 'default'}`);

    // Build the deployment command with optional publicKey parameter
    // Note: --source-account is always required (the account that pays for deployment)
    // --sign-with-key is optional (the key used to sign the transaction)
    const deployCmd = publicKey
      ? `stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account ${identity} --network testnet --alias hello_world`
      : `stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account ${identity} --network testnet --alias hello_world`;

    const { stdout, stderr } = await execAsync(
      `docker exec -u developer -w ${projectDir} ${containerName} sh -c "stellar contract build && cargo build --target wasm32v1-none --release && ${deployCmd}"`,
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );

    // Log both outputs
    console.log('=== STDOUT ===');
    console.log(stdout || '(empty)');
    console.log('=== STDERR ===');
    console.log(stderr || '(empty)');

    // Combine stdout and stderr for the output
    const output = (stdout || '') + (stderr || '');

    return {
      success: true,
      message: 'Contract deployed successfully',
      output: output, // Send full terminal output
      stdout,
      stderr,
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    console.log('=== ERROR STDOUT ===');
    console.log(error.stdout || '(empty)');
    console.log('=== ERROR STDERR ===');
    console.log(error.stderr || '(empty)');

    return {
      success: false,
      error: error.message || 'Failed to deploy contract',
      output: (error.stdout || '') + (error.stderr || ''),
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

/**
 * Get the deployment status of a contract
 * @param userId The user ID
 * @param projectName The project name
 * @returns Deployment status
 */
export async function getDeploymentStatus(userId: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);

    // Check if contract has been deployed by looking for the contract alias
    const { stdout: contractCheck } = await execAsync(
      `docker exec -u developer ${containerName} sh -c "cd ~/.config && grep -r 'hello_world' . 2>/dev/null | head -1"`,
      { timeout: 10000 }
    );

    const isDeployed = contractCheck.trim().length > 0;

    return {
      success: true,
      isDeployed,
      message: isDeployed
        ? 'Contract has been deployed'
        : 'Contract has not been deployed yet',
    };
  } catch (error: any) {
    console.error('Deployment status check error:', error);
    return {
      success: false,
      error: error.message || 'Failed to check deployment status',
    };
  }
}

/**
 * Build and deploy a contract in one step
 * @param userId The user ID
 * @param publicKey Optional public key for signing
 * @param projectName The project name
 * @returns Build and deploy result
 */
export async function buildAndDeploy(userId: string, publicKey?: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const identity = getIdentityName(userId);
    const workspacePath = getWorkspacePath();
    const projectDir = projectName ? `${workspacePath}/${projectName}` : `${workspacePath}/soroban-hello-world`;

    console.log(`Building and deploying contract in container: ${containerName}, project: ${projectName || 'default'}`);

    const deployCmd = publicKey
      ? `stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account ${identity} --network testnet --alias hello_world`
      : `stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account ${identity} --network testnet --alias hello_world`;

    const { stdout, stderr } = await execAsync(
      `docker exec -u developer -w ${projectDir} ${containerName} sh -c "set -e; echo 'Starting build...'; stellar contract build; echo 'Building WASM...'; cargo build --target wasm32v1-none --release; echo 'Deploying...'; ${deployCmd}"`,
      { timeout: 600000, maxBuffer: 10 * 1024 * 1024 }
    );

    console.log('Build and deploy completed');

    const output = (stdout || '') + (stderr || '');

    return {
      success: true,
      message: 'Contract built and deployed successfully',
      output,
      stdout,
      stderr,
    };
  } catch (error: any) {
    console.error('Build and deploy error:', error);
    return {
      success: false,
      error: error.message || 'Failed to build and deploy contract',
      output: (error.stdout || '') + (error.stderr || ''),
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

