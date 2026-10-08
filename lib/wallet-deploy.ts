import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc as StellarRpc } from "@stellar/stellar-sdk";
import {
  signTransaction,
  isConnected,
  setAllowed,
  getAddress,
} from "@stellar/freighter-api";

// Explicitly use the testnet passphrase to ensure consistency
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SOROBAN_URL = "https://soroban-testnet.stellar.org";

// Initialize server using the RPC module
const server = new StellarRpc.Server(SOROBAN_URL);

/**
 * Generate a 32-byte cryptographically-random salt for contract deployment.
 *
 * Uses the Web Crypto API (`crypto.getRandomValues`) — the same primitive
 * `@stellar/stellar-sdk` uses internally for `Keypair.random()`. Replaces the
 * previous `Date.now()` + `Math.random()` combination, both of which are
 * predictable within a single browser session and therefore
 * attacker-influenceable.
 *
 * Returns a `Buffer` only because the Soroban SDK expects one at the
 * `createCustomContract` boundary; the source of randomness is the typed
 * array from `getRandomValues`, not a Buffer-based PRNG.
 *
 * Exported for testability.
 */
export function generateDeploymentSalt(): Buffer {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

/**
 * The transaction info a polling loop cares about. `@stellar/stellar-sdk`'s
 * `rpc.Server` satisfies `TransactionStatusSource` structurally.
 */
export interface TransactionResult {
  status: string;
  resultXdr?: any;
  returnValue?: any;
}

/**
 * The subset of the Soroban RPC client the polling helper needs.
 */
export interface TransactionStatusSource {
  getTransaction(hash: string): Promise<TransactionResult>;
}

/**
 * Poll a Soroban RPC server until a transaction reaches a terminal status.
 *
 * - `SUCCESS` resolves with the transaction info.
 * - `FAILED` throws immediately with the `resultXdr` — a terminal failure must
 *   never be re-polled.
 * - `NOT_FOUND` (or a rejected `getTransaction`) means the ledger has not
 *   included the transaction yet, so polling continues until `maxAttempts`.
 *
 * Previously a `FAILED` status was thrown from inside a `try` whose `catch`
 * swallowed it, so the loop kept polling until timeout and reported a generic
 * "timeout" instead of the real failure.
 *
 * Exported for testability.
 */
export async function waitForTerminalTransaction(
  server: TransactionStatusSource,
  hash: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    failLabel?: string;
    timeoutMessage?: string;
    onProgress?: (attempt: number) => void;
  } = {}
): Promise<TransactionResult> {
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 1000;
  const failLabel = options.failLabel ?? "Transaction";
  const timeoutMessage = options.timeoutMessage ?? "Transaction timeout";

  let info: TransactionResult | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      info = await server.getTransaction(hash);
    } catch {
      // `getTransaction` rejects (e.g. NOT_FOUND) while the transaction is not
      // yet available — continue polling.
      info = undefined;
    }

    if (info?.status === "SUCCESS") {
      return info;
    }
    if (info?.status === "FAILED") {
      // Terminal failure: stop polling now and surface the resultXdr.
      throw new Error(`${failLabel} failed: ${info.resultXdr}`);
    }

    // NOT_FOUND / any other non-terminal status: keep waiting.
    options.onProgress?.(attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(timeoutMessage);
}

export async function deployWithWallet(
  walletAddress: string,
  logToTerminal: (msg: string, type: string) => void,
  projectName?: string
) {
  try {
    logToTerminal(" Building contract...", "info");

    // 1. Build contract
    const buildResponse = await fetch("/api/docker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buildContract", walletAddress, projectName }),
    });

    const buildData = await buildResponse.json();
    if (!buildData.success) {
      throw new Error(`Build failed: ${buildData.error}`);
    }

    logToTerminal(` Contract built (${(buildData.wasmSize / 1024).toFixed(2)} KB)`, "log");

    // 2. Connect wallet
    logToTerminal(" Checking Freighter connection...", "info");
    
    let connectionStatus;
    try {
      connectionStatus = await isConnected();
      console.log("[Deploy] Freighter isConnected:", connectionStatus);
    } catch (e) {
      throw new Error("Freighter extension not found. Please install Freighter wallet.");
    }
    
    if (!connectionStatus.isConnected) {
      logToTerminal("  Requesting wallet access...", "warn");
      try {
        const access = await setAllowed();
        console.log("[Deploy] setAllowed result:", access);
        if (!access.isAllowed) {
          throw new Error("Wallet access denied by user. Please approve the Freighter popup.");
        }
      } catch (e: any) {
        throw new Error(`Wallet access request failed: ${e.message}`);
      }
    }

    logToTerminal(" Getting wallet address...", "info");
    let addressData;
    try {
      addressData = await getAddress();
      console.log("[Deploy] getAddress result:", addressData);
    } catch (e: any) {
      throw new Error(`Failed to get address from Freighter: ${e.message}. Make sure Freighter is unlocked.`);
    }
    
    if (!addressData || !addressData.address) {
      throw new Error("Could not get wallet address. Please unlock Freighter and try again.");
    }
    const { address } = addressData;

    logToTerminal(
      ` Using wallet: ${address.slice(0, 6)}...${address.slice(-4)}`,
      "log"
    );
    logToTerminal("", "log");

    // 3. Upload WASM
    const wasmBuffer = Buffer.from(buildData.wasmBase64, "base64");
    const account = await server.getAccount(address);

    const uploadTx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer })
      )
      .setTimeout(30)
      .build();

    const preparedUploadTx = await server.prepareTransaction(uploadTx);
    logToTerminal(" Sign WASM upload in wallet popup...", "warn");

    const signedUploadTx = await signTransaction(
      preparedUploadTx.toXDR(),
      {
        networkPassphrase: NETWORK_PASSPHRASE,
      }
    );

    const uploadResult = await server.sendTransaction(
      StellarSdk.TransactionBuilder.fromXDR(
        signedUploadTx.signedTxXdr,
        NETWORK_PASSPHRASE
      )
    );

    logToTerminal(` Upload TX: ${uploadResult.hash.slice(0, 16)}...`, "info");
    logToTerminal(
      `   → https://stellar.expert/explorer/testnet/tx/${uploadResult.hash}`,
      "info"
    );

    // 4. Wait for upload confirmation
    logToTerminal(" Waiting for upload confirmation...", "info");

    // A FAILED status now propagates immediately (with its resultXdr) instead
    // of being swallowed by the polling loop.
    const uploadTxInfo = await waitForTerminalTransaction(server, uploadResult.hash, {
      failLabel: "Upload",
      timeoutMessage: "WASM upload timeout",
      onProgress: (attempt) => {
        if (attempt % 10 === 0)
          logToTerminal(`   Waiting... (${attempt}s)`, "log");
      },
    });

    // Extract the WASM hash from the return value
    const wasmHash = uploadTxInfo.returnValue;
    if (!wasmHash) {
      throw new Error("Could not extract WASM hash from transaction");
    }

    // Convert ScVal to Buffer - the returnValue is a ScVal object
    const wasmHashBytes = wasmHash.bytes ? wasmHash.bytes() : (wasmHash as any);

    logToTerminal(
      ` WASM uploaded (hash: ${Buffer.from(wasmHashBytes as any).toString('hex').slice(0, 16)}...)`,
      "log"
    );
    logToTerminal("", "log");

    // 5. Create contract instance
    const freshAccount = await server.getAccount(address);
    
    // 32-byte cryptographically-random salt (no timestamp prefix, no Math.random()).
    // Both Date.now() and Math.random() are predictable within a single
    // browser session — using crypto.getRandomValues guarantees an
    // attacker-uninfluenceable contract address.
    const saltBuffer = generateDeploymentSalt();
    
    const createTx = new StellarSdk.TransactionBuilder(freshAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.createCustomContract({
          wasmHash: wasmHashBytes,
          address: new StellarSdk.Address(address),
          salt: saltBuffer,
        })
      )
      .setTimeout(30)
      .build();

    const preparedCreateTx = await server.prepareTransaction(createTx);
    logToTerminal(" Sign contract creation in wallet popup...", "warn");

    const signedCreateTx = await signTransaction(
      preparedCreateTx.toXDR(),
      {
        networkPassphrase: NETWORK_PASSPHRASE,
      }
    );

    const createResult = await server.sendTransaction(
      StellarSdk.TransactionBuilder.fromXDR(
        signedCreateTx.signedTxXdr,
        NETWORK_PASSPHRASE
      )
    );

    logToTerminal(` Deploy TX: ${createResult.hash.slice(0, 16)}...`, "info");
    logToTerminal(
      `   → https://stellar.expert/explorer/testnet/tx/${createResult.hash}`,
      "info"
    );

    // 6. Wait for final confirmation
    logToTerminal(" Waiting for deploy confirmation...", "info");

    // A FAILED status now propagates immediately (with its resultXdr) instead
    // of being swallowed by the polling loop.
    const finalTxInfo = await waitForTerminalTransaction(server, createResult.hash, {
      failLabel: "Contract creation",
      timeoutMessage: "Contract creation timeout",
      onProgress: (attempt) => {
        if (attempt % 10 === 0)
          logToTerminal(`   Waiting for confirmation... (${attempt}s)`, "log");
      },
    });

    // Extract contract ID from transaction result
    const contractIdScVal = finalTxInfo.returnValue;

    // Convert ScVal address to string
    let contractIdStr = "unknown";
    if (contractIdScVal) {
      try {
        // Try to convert Address ScVal to string
        if (typeof contractIdScVal.address === 'function') {
          contractIdStr = StellarSdk.Address.fromScAddress(contractIdScVal.address()).toString();
        } else if (contractIdScVal.toString) {
          contractIdStr = contractIdScVal.toString();
        }
      } catch (e) {
        logToTerminal(`Warning: Could not parse contract ID: ${e}`, "warn");
      }
    }

    logToTerminal("", "log");
    logToTerminal(" Contract Deployed Successfully!", "log");
    logToTerminal("", "log");
    logToTerminal(` Contract ID:`, "info");
    logToTerminal(`   ${contractIdStr}`, "log");
    logToTerminal("", "log");
    logToTerminal(` Explorer Links:`, "info");
    logToTerminal(
      `   → https://stellar.expert/explorer/testnet/contract/${contractIdStr}`,
      "info"
    );
    logToTerminal(
      `   → https://lab.stellar.org/r/testnet/contract/${contractIdStr}`,
      "info"
    );

    return {
      success: true,
      contractId: contractIdStr,
      transactionHash: createResult.hash,
    };
  } catch (err: any) {
    logToTerminal("", "log");
    logToTerminal(` ${err.message}`, "error");
    return { success: false, error: err.message };
  }
}