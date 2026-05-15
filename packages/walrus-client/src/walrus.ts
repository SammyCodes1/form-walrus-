import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { WalrusClient as MystenWalrusClient } from "@mysten/walrus";
import { WalrusFormError } from "./types";

export class WalrusClient {
  private walrus: MystenWalrusClient | null = null;
  private signer: Ed25519Keypair | null = null;
  private suiClient: SuiClient;

  constructor() {
    this.suiClient = new SuiClient({
      url: process.env.SUI_RPC_URL || getFullnodeUrl("mainnet"),
    });
  }

  private getWalrus(): MystenWalrusClient {
    if (this.walrus) return this.walrus;
    const relay = process.env.WALRUS_UPLOAD_RELAY;
    this.walrus = new MystenWalrusClient({
      network: "mainnet",
      suiClient: this.suiClient as any,
      ...(relay
        ? { uploadRelay: { host: relay, sendTip: { max: 1_000 } } }
        : {}),
    });
    return this.walrus;
  }

  private getSigner(): Ed25519Keypair {
    if (this.signer) return this.signer;
    const key = process.env.WALRUS_SIGNER_PRIVKEY;
    if (!key) {
      throw new WalrusFormError(
        "WALRUS_SIGNER_PRIVKEY not set — server keypair required to pay WAL/SUI",
        "WALRUS_CONFIG_ERROR"
      );
    }
    this.signer = Ed25519Keypair.fromSecretKey(key);
    return this.signer;
  }

  async uploadBlob(data: Uint8Array | Buffer, opts?: { epochs?: number }) {
    const blob = data instanceof Uint8Array ? data : new Uint8Array(data);
    try {
      const result: any = await this.getWalrus().writeBlob({
        blob,
        deletable: false,
        epochs: opts?.epochs ?? 5,
        signer: this.getSigner(),
      });
      const blobId =
        result.blobId || result.blobObject?.blobId || result.id;
      if (!blobId) {
        throw new Error(
          `unexpected writeBlob response shape: ${Object.keys(result).join(",")}`
        );
      }
      return {
        blobId,
        suiObjectId:
          result.blobObject?.id?.id || result.blobObject?.id || "",
      };
    } catch (err: any) {
      if (err instanceof WalrusFormError) throw err;
      throw new WalrusFormError(
        `Walrus write failed: ${err.message}`,
        "WALRUS_NETWORK_ERROR"
      );
    }
  }

  async downloadBlob(blobId: string): Promise<Uint8Array> {
    try {
      return await this.getWalrus().readBlob({ blobId });
    } catch (err: any) {
      throw new WalrusFormError(
        `Walrus read failed: ${err.message}`,
        "WALRUS_DOWNLOAD_ERROR"
      );
    }
  }

  async uploadJSON(obj: any, opts?: { epochs?: number }) {
    const str = JSON.stringify(obj);
    const data = new TextEncoder().encode(str);
    const result = await this.uploadBlob(data, opts);
    return result.blobId;
  }

  async downloadJSON(blobId: string) {
    const data = await this.downloadBlob(blobId);
    const str = new TextDecoder().decode(data);
    return JSON.parse(str);
  }

  async uploadMedia(
    file: Uint8Array | Buffer,
    mimeType: string,
    onProgress?: (p: number) => void
  ) {
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const chunks: string[] = [];
    const totalSize = file.length;
    let offset = 0;
    while (offset < totalSize) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const { blobId } = await this.uploadBlob(chunk, { epochs: 5 });
      chunks.push(blobId);
      offset += chunk.length;
      if (onProgress) {
        onProgress(Math.round((offset / totalSize) * 100));
      }
    }
    const manifestBlobId = await this.uploadJSON({
      chunks,
      totalSize,
      mimeType,
    });
    return { blobId: manifestBlobId, size: totalSize };
  }
}
