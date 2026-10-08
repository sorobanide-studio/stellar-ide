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

const SALT_LENGTH = 32;

/**
 * Decode a base64 string into a `Uint8Array`. Used instead of Node-only byte
 * helpers so the deploy flow works in the browser, where this module runs.
 * `atob` is available in every browser and in the Next.js client runtime.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Lower-case hex encoding of a byte array, browser-safe. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Generate a 32-byte cryptographically-random salt for contract deployment.
 *
 * Uses the Web Crypto API (`crypto.getRandomValues`) — the same primitive
 * `@stellar/stellar-sdk` uses internally for `Keypair.random()`. Replaces the
 * previous `Date.now()` + `Math.random()` combination, both of which are
 * predictable within a single browser session and therefore
 * attacker-influenceable.
 *
 * Returns a plain `Uint8Array`: this module is client-only, so it must avoid
 * Node-only byte types. The Soroban SDK accepts any byte sequence here.
 *
 * Exported for testability.
 */
export function generateDeploymentSalt(): Uint8Array {
  const bytes = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(bytes);
  return bytes;
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
    const wasmBytes = base64ToBytes(buildData.wasmBase64);
    const account = await server.getAccount(address);

    const uploadTx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        // The SDK accepts a raw byte sequence here; Uint8Array keeps this
        // module free of Node-only byte types.
        StellarSdk.Operation.uploadContractWasm({ wasm: wasmBytes as any })
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
    let uploadTxInfo;
    let attempts = 0;
    logToTerminal(" Waiting for upload confirmation...", "info");
    
    while (attempts < 60) {
      try {
        uploadTxInfo = await server.getTransaction(uploadResult.hash);
        if (uploadTxInfo.status === "SUCCESS") break;
        if (uploadTxInfo.status === "FAILED") {
          throw new Error(`Upload failed: ${uploadTxInfo.resultXdr}`);
        }
      } catch (error) {
        // Transaction not yet available, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      if (attempts % 10 === 0)
        logToTerminal(`   Waiting... (${attempts}s)`, "log");
    }

    if (!uploadTxInfo || uploadTxInfo.status !== "SUCCESS") {
      throw new Error("WASM upload timeout");
    }

    // Extract the WASM hash from the return value
    const wasmHash = uploadTxInfo.returnValue;
    if (!wasmHash) {
      throw new Error("Could not extract WASM hash from transaction");
    }

    // Convert the ScVal return value to raw bytes
    const wasmHashBytes = wasmHash.bytes ? wasmHash.bytes() : (wasmHash as any);

    logToTerminal(
      ` WASM uploaded (hash: ${bytesToHex(wasmHashBytes).slice(0, 16)}...)`,
      "log"
    );
    logToTerminal("", "log");

    // 5. Create contract instance
    const freshAccount = await server.getAccount(address);
    
    // 32-byte cryptographically-random salt (no timestamp prefix, no Math.random()).
    // Both Date.now() and Math.random() are predictable within a single
    // browser session — using crypto.getRandomValues guarantees an
    // attacker-uninfluenceable contract address.
    const saltBytes = generateDeploymentSalt();
    
    const createTx = new StellarSdk.TransactionBuilder(freshAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.createCustomContract({
          wasmHash: wasmHashBytes,
          address: new StellarSdk.Address(address),
          salt: saltBytes as any,
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
    attempts = 0;
    let finalTxInfo;
    logToTerminal(" Waiting for deploy confirmation...", "info");
    
    while (attempts < 60) {
      try {
        finalTxInfo = await server.getTransaction(createResult.hash);
        if (finalTxInfo.status === "SUCCESS") {
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
        }
        if (finalTxInfo.status === "FAILED") {
          throw new Error(
            `Contract creation failed: ${finalTxInfo.resultXdr}`
          );
        }
      } catch (error) {
        // Transaction not yet available, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      if (attempts % 10 === 0)
        logToTerminal(`   Waiting for confirmation... (${attempts}s)`, "log");
    }

    throw new Error("Contract creation timeout");
  } catch (err: any) {
    logToTerminal("", "log");
    logToTerminal(` ${err.message}`, "error");
    return { success: false, error: err.message };
  }
}