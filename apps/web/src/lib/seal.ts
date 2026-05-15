"use client";

// Seal encryption utilities for FormWalrus
// Wraps @mysten/seal for private form submissions
import { SuiClient } from "@mysten/sui/client";
import { getSealClient } from "./sealClient";

let sealModule: any = null;

// Lazy load seal to handle API differences between versions
async function getSealModule() {
  if (sealModule) return sealModule;
  try {
    sealModule = await import("@mysten/seal");
    return sealModule;
  } catch (e) {
    console.error("Failed to load @mysten/seal:", e);
    throw new Error(
      "@mysten/seal could not be loaded. " +
      "Check that it is installed correctly."
    );
  }
}

// Create Seal client with correct API
export async function createSealClientAsync(suiClient: SuiClient) {
  if (!suiClient) {
    throw new Error("suiClient is required for createSealClientAsync");
  }
  return getSealClient(suiClient);
}

// Encrypt submission data for a private form
export async function encryptSubmission(
  data: object,
  allowlistId: string,
  packageId: string,
  suiClient: SuiClient
): Promise<Uint8Array> {
  try {
    const sealClient = await createSealClientAsync(suiClient);
    
    const plaintext = new TextEncoder().encode(
      JSON.stringify(data)
    );

    // Try different encrypt signatures
    let result: any;
    if (typeof sealClient.encrypt === "function") {
      result = await sealClient.encrypt({
        threshold: 2,
        packageId,
        id: allowlistId,
        data: plaintext,
      });
    } else {
      throw new Error(
        "sealClient.encrypt is not a function. " +
        "Available methods: " + 
        Object.keys(sealClient).join(", ")
      );
    }

    // Return the encrypted bytes
    return result.encryptedObject || result.encrypted || result;
  } catch (e: any) {
    console.error("Seal encryption failed:", e);
    throw new Error("Encryption failed: " + e.message);
  }
}

// Create a session key for decryption
export async function createSessionKey(
  address: string,
  allowlistId: string,
  packageId: string,
  signPersonalMessage: (args: any) => Promise<any>
): Promise<any> {
  const seal = await getSealModule();

  const SessionKeyClass = 
    seal.SessionKey || seal.default?.SessionKey;
  
  if (!SessionKeyClass) {
    throw new Error(
      "SessionKey not found in @mysten/seal. " +
      "Available: " + Object.keys(seal).join(", ")
    );
  }

  const sessionKey = new SessionKeyClass({
    address,
    packageId,
    ttlMin: 30, // valid for 30 minutes
  });

  // Get message to sign
  const message = sessionKey.getPersonalMessage();

  // Ask user to sign with their wallet
  const { signature } = await signPersonalMessage({ message });

  // Set the signature on session key
  await sessionKey.setPersonalMessageSignature(signature);

  return sessionKey;
}

// Decrypt an encrypted submission blob
export async function decryptSubmission(
  encryptedBytes: Uint8Array,
  txBytes: Uint8Array,
  sessionKey: any,
  suiClient: SuiClient
): Promise<object> {
  try {
    const sealClient = await createSealClientAsync(suiClient);

    const decrypted = await sealClient.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes,
    });

    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text);
  } catch (e: any) {
    console.error("Seal decryption failed:", e);
    throw new Error(
      "Decryption failed. You may not be authorized " +
      "to view this submission. Error: " + e.message
    );
  }
}

// Check if Seal is available and working
export async function checkSealAvailable(): Promise<{
  available: boolean;
  version: string;
  exports: string[];
  error?: string;
}> {
  try {
    const seal = await getSealModule();
    const exports = Object.keys(seal);
    
    return {
      available: true,
      version: "1.1.1",
      exports,
    };
  } catch (e: any) {
    return {
      available: false,
      version: "none",
      exports: [],
      error: e.message,
    };
  }
}

// Legacy helper for hooks that expect a synchronous creator
// Returns a proxy that lazy-loads the client
export function createSealClient(suiClient: SuiClient) {
  return getSealClient(suiClient);
}
