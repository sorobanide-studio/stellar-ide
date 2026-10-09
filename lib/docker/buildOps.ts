/**
 * Docker Build Operations
 * 
 * Handles contract building and compilation within Docker containers
 */

import {
  execAsync,
  getContainerName,
  getWorkspacePath,
} from './utils';

/**
 * Decode a base64 WASM payload and return its real size in bytes.
 *
 * `wasmBase64.length` is the length of the base64 *string*, roughly 4/3 of the
 * artifact size plus padding, so reporting it made `wallet-deploy.ts` print a
 * size about a third larger than the WASM actually uploaded.
 *
 * @param wasmBase64 Base64-encoded WASM bytes (may contain newlines)
 * @returns Decoded byte length
 */
export function decodeWasmSize(wasmBase64: string): number {
  return Buffer.from(wasmBase64, 'base64').length;
}

/**
 * Build a Soroban contract
 * @param userId The user ID
 * @param projectName The project name
 * @returns Build result with WASM binary
 */
export async function buildContract(userId: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const workspacePath = getWorkspacePath();
    const projectDir = projectName ? `${workspacePath}/${projectName}` : `${workspacePath}/soroban-hello-world`;
    const wasmPath = `${projectDir}/target/wasm32v1-none/release/hello_world.wasm`;
    const wasmDepsPath = `${projectDir}/target/wasm32v1-none/release/deps/hello_world.wasm`;

    console.log(`Building contract in container: ${containerName}`);
    console.log(`Project name received: ${projectName || '(undefined - using default)'}`);
    console.log(`Project directory: ${projectDir}`);

    // STEP 0: Ensure we don't use stale WASM from a previous build
    console.log('=== STEP 0: Clean previous WASM artifacts (if any) ===');
    try {
      await execAsync(
        `docker exec ${containerName} sh -c "rm -f ${wasmPath} ${wasmDepsPath} 2>/dev/null || true"`
      );
      console.log('Old WASM artifacts (if any) deleted');
    } catch (cleanErr: any) {
      console.warn('Warning: Failed to delete previous WASM artifacts:', cleanErr?.message || cleanErr);
    }

    console.log('=== STEP 1: Verify project directory exists ===');
    const { stdout: dirCheck } = await execAsync(
      `docker exec ${containerName} ls -la ${projectDir}/ 2>/dev/null || echo "Directory not found"`
    );
    console.log('Project directory contents:', dirCheck.substring(0, 500));

    console.log('=== STEP 2: Run stellar contract build ===');
    const stellarBuild = await execAsync(
      `docker exec -u developer -w ${projectDir} ${containerName} sh -c "stellar contract build"`,
      { timeout: 120000 }
    );
    console.log('Stellar build completed');

    console.log('=== STEP 3: Run cargo build ===');
    const cargoBuild = await execAsync(
      `docker exec -u developer -w ${projectDir} ${containerName} sh -c "cargo build --target wasm32v1-none --release"`,
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );
    console.log('Cargo build completed');

    console.log('=== STEP 4: Check build output ===');
    // List target directory to see what was created
    const { stdout: targetList } = await execAsync(
      `docker exec ${containerName} find ${projectDir}/target -name "*.wasm" -o -name "*.rs" 2>/dev/null | head -20 || echo "No build artifacts"`
    );
    console.log('Build artifacts:', targetList);

    // Now check for the specific WASM file
    console.log('Looking for WASM at:', wasmPath);

    const { stdout: wasmCheck } = await execAsync(
      `docker exec ${containerName} ls -la ${wasmPath} 2>/dev/null || echo "WASM file not found"`
    );
    console.log('WASM check result:', wasmCheck);

    if (wasmCheck.includes('not found')) {
      throw new Error(`WASM file not created. Build might have failed. Check: ${wasmPath}`);
    }

    // Read the WASM file as base64
    const { stdout: wasmBase64 } = await execAsync(
      `docker exec ${containerName} cat ${wasmPath} | base64`,
      { maxBuffer: 20 * 1024 * 1024 }
    );

    return {
      success: true,
      wasmBase64: wasmBase64.trim(),
      // wasmSize is the decoded byte length of the artifact (not the base64
      // string length); callers convert it to KB for display.
      wasmSize: decodeWasmSize(wasmBase64),
      buildOutput: 'Build completed successfully',
    };
  } catch (error: any) {
    console.error('Build error:', {
      message: error.message,
      cmd: error.cmd,
      stderr: error.stderr?.substring(0, 500),
    });
    return {
      success: false,
      error: `Build failed: ${error.message}`,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

/**
 * Compile the contract using cargo
 * @param userId The user ID
 * @param projectName The project name
 * @returns Compilation result
 */
export async function compileContract(userId: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const workspacePath = getWorkspacePath();
    const projectDir = projectName ? `${workspacePath}/${projectName}` : `${workspacePath}/soroban-hello-world`;

    console.log(`Compiling contract in container: ${containerName}, project: ${projectName || 'default'}`);

    const { stdout, stderr } = await execAsync(
      `docker exec -u developer -w ${projectDir} ${containerName} sh -c "cargo build --target wasm32v1-none --release"`,
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );

    console.log('Compilation completed');

    return {
      success: true,
      stdout,
      stderr,
      message: 'Contract compiled successfully',
    };
  } catch (error: any) {
    console.error('Compilation error:', error);
    return {
      success: false,
      error: `Compilation failed: ${error.message}`,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

/**
 * Get the build status of a contract
 * @param userId The user ID
 * @param projectName The project name
 * @returns Build status
 */
export async function getContractBuildStatus(userId: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const workspacePath = getWorkspacePath();
    const projectDir = projectName ? `${workspacePath}/${projectName}` : `${workspacePath}/soroban-hello-world`;
    const wasmPath = `${projectDir}/target/wasm32v1-none/release/hello_world.wasm`;

    const { stdout: wasmCheck } = await execAsync(
      `docker exec ${containerName} test -f ${wasmPath} && echo "exists" || echo "missing"`
    );

    const isBuilt = wasmCheck.trim() === 'exists';

    if (isBuilt) {
      const { stdout: wasmSize } = await execAsync(
        `docker exec ${containerName} ls -lh ${wasmPath} | awk '{print $5}'`
      );

      return {
        success: true,
        isBuilt: true,
        wasmSize: wasmSize.trim(),
        message: 'Contract has been built',
      };
    }

    return {
      success: true,
      isBuilt: false,
      message: 'Contract has not been built yet',
    };
  } catch (error: any) {
    console.error('Status check error:', error);
    return {
      success: false,
      error: error.message || 'Failed to check build status',
    };
  }
}

/**
 * Clean build artifacts
 * @param userId The user ID
 * @param projectName The project name
 * @returns Clean result
 */
export async function cleanBuild(userId: string, projectName?: string) {
  try {
    const containerName = getContainerName(userId);
    const workspacePath = getWorkspacePath();
    const projectDir = projectName ? `${workspacePath}/${projectName}` : `${workspacePath}/soroban-hello-world`;

    console.log(`Cleaning build artifacts in container: ${containerName}, project: ${projectName || 'default'}`);

    await execAsync(
      `docker exec -u developer -w ${projectDir} ${containerName} sh -c "cargo clean"`,
      { timeout: 60000 }
    );

    console.log('Build artifacts cleaned');

    return {
      success: true,
      message: 'Build artifacts cleaned successfully',
    };
  } catch (error: any) {
    console.error('Clean error:', error);
    return {
      success: false,
      error: error.message || 'Failed to clean build artifacts',
    };
  }
}

