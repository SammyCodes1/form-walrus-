import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Signer } from "@mysten/sui/cryptography";
// @mysten/seal is a placeholder package per prompt, so we implement fallback or mock if actual seal fails.
// Assuming @mysten/seal has createSealPolicy, encrypt, decrypt as per prompt.

export class SealDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SealDecryptError";
  }
}

export async function setupSealPolicy(
  formId: string,
  adminAddress: string,
  signer: Signer,
  suiClient: SuiClient
): Promise<string> {
  // In a real @mysten/seal implementation, this would create an EncryptedObject policy.
  // We mock the return of a seal_object_id here.
  // Tradeoff: AES-256-GCM fallback would derive a key via HKDF-SHA256, but requires the user
  // to sign a message or provide a secret, which is not fully decentralized. Threshold encryption (Seal) is ideal.
  return `seal_obj_${formId}_${Date.now()}`;
}

export async function encryptSubmission(
  payload: any,
  sealObjectId: string,
  suiClient: SuiClient
): Promise<Uint8Array> {
  const jsonStr = JSON.stringify(payload);
  const data = new TextEncoder().encode(jsonStr);
  // Mock encryption: just prepend "SEALED:" to raw data
  // Tradeoff: Without the actual @mysten/seal package available locally, we mock the bytes.
  const prefix = new TextEncoder().encode("SEALED:");
  const combined = new Uint8Array(prefix.length + data.length);
  combined.set(prefix);
  combined.set(data, prefix.length);
  return combined;
}

export async function decryptSubmission<T>(
  encryptedData: Uint8Array,
  sealObjectId: string,
  signer: Signer,
  suiClient: SuiClient
): Promise<T> {
  const prefix = new TextEncoder().encode("SEALED:");
  // Check mock prefix
  let isEncrypted = true;
  for (let i = 0; i < prefix.length; i++) {
    if (encryptedData[i] !== prefix[i]) {
      isEncrypted = false;
      break;
    }
  }

  if (!isEncrypted) {
    throw new SealDecryptError("Data is not properly encrypted or caller lacks access.");
  }

  const rawData = encryptedData.slice(prefix.length);
  const jsonStr = new TextDecoder().decode(rawData);
  return JSON.parse(jsonStr) as T;
}
