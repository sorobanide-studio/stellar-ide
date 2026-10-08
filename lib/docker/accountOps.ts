/**
 * Docker Account Operations
 * 
 * Handles Stellar account creation and management within Docker containers
 */

import {
  execAsync,
  getContainerName,
  getIdentityName,
  getProjectPath,
} from './utils';

/**
 * Create a Stellar account and fund it
 * @param userId The user ID
 * @returns Account creation result
 */
export async function createAccount(userId: string) {
  try {
    const containerName = getContainerName(userId);
    const identity = getIdentityName(userId);
    const projectPath = getProjectPath();

    console.log(`Creating account in container: ${containerName} (identity: ${identity})`);

    const { stdout, stderr } = await execAsync(
      `docker exec -u developer ${containerName} sh -c "stellar keys generate ${identity} --network testnet --fund"`,
      { timeout: 30000 }
    );

    console.log('Account created:', stdout);
    if (stderr) {
      console.error('Account creation error:', stderr);
    }

    // Copy .config folder to workspace after account creation
    console.log(`Copying .config folder to workspace...`);
    try {
      await execAsync(
        `docker exec ${containerName} cp -r /home/developer/.config ${projectPath}/.config`,
        { timeout: 10000 }
      );
      console.log('.config folder copied to workspace');
    } catch (copyError: any) {
      console.error('Warning: Failed to copy .config folder:', copyError.message);
      // Don't fail the account creation if copy fails
    }

    return {
      success: true,
      stdout,
      stderr,
      message: 'Account created and credentials backed up',
    };
  } catch (error: any) {
    console.error('Docker error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create account',
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

/**
 * Generate cryptographic keys for a Stellar account
 * @param userId The user ID
 * @param keyName The wallet-derived identity name to generate (required so
 *   every caller must pick the identity belonging to its wallet)
 * @returns Key generation result
 */
export async function generateKeys(userId: string, keyName: string) {
  try {
    const containerName = getContainerName(userId);

    console.log(`Generating keys in container: ${containerName}`);

    const { stdout, stderr } = await execAsync(
      `docker exec -u developer ${containerName} sh -c "stellar keys generate ${keyName} --network testnet --fund"`,
      { timeout: 30000 }
    );

    console.log('Keys generated:', stdout);
    if (stderr) {
      console.error('Key generation stderr:', stderr);
    }

    return {
      success: true,
      stdout,
      stderr,
      message: `Keys generated for ${keyName}`,
    };
  } catch (error: any) {
    console.error('Key generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate keys',
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

/**
 * Get account information
 * @param userId The user ID
 * @param accountName The wallet-derived identity name (required so every
 *   caller must ask about the identity belonging to its wallet)
 * @returns Account information
 */
export async function getAccountStatus(userId: string, accountName: string) {
  try {
    const containerName = getContainerName(userId);

    // Check if account credentials exist in .config
    const { stdout: configCheck } = await execAsync(
      `docker exec ${containerName} test -f /home/developer/.config/soroban/identities/${accountName} && echo "exists" || echo "missing"`,
      { timeout: 10000 }
    );

    const accountExists = configCheck.trim() === 'exists';

    if (accountExists) {
      // Try to get balance
      try {
        const { stdout: balance } = await execAsync(
          `docker exec -u developer ${containerName} sh -c "stellar account info ${accountName} 2>/dev/null || echo 'balance unknown'"`,
          { timeout: 10000 }
        );

        return {
          success: true,
          accountExists: true,
          balance: balance.trim(),
          message: `Account ${accountName} exists`,
        };
      } catch {
        return {
          success: true,
          accountExists: true,
          message: `Account ${accountName} exists but balance is unavailable`,
        };
      }
    }

    return {
      success: true,
      accountExists: false,
      message: `Account ${accountName} does not exist`,
    };
  } catch (error: any) {
    console.error('Account status check error:', error);
    return {
      success: false,
      error: error.message || 'Failed to check account status',
    };
  }
}

/**
 * Backup account credentials to workspace
 * @param userId The user ID
 * @returns Backup result
 */
export async function backupCredentials(userId: string) {
  try {
    const containerName = getContainerName(userId);
    const projectPath = getProjectPath();

    console.log(`Backing up credentials in container: ${containerName}`);

    // Copy .config folder to workspace
    await execAsync(
      `docker exec ${containerName} cp -r /home/developer/.config ${projectPath}/.config`,
      { timeout: 10000 }
    );

    console.log('Credentials backed up to workspace');

    return {
      success: true,
      message: 'Credentials backed up successfully',
    };
  } catch (error: any) {
    console.error('Backup error:', error);
    return {
      success: false,
      error: error.message || 'Failed to backup credentials',
    };
  }
}

