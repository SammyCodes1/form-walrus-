import { WalrusFormError } from "./types";

export class WalrusClient {
  publisherUrl: string;
  aggregatorUrl: string;

  constructor(
    publisherUrl?: string,
    aggregatorUrl?: string
  ) {
this.publisherUrl = publisherUrl || process.env.WALRUS_PUBLISHER_URL || "https://publisher.walrus-mainnet.walrus.space";
this.aggregatorUrl = aggregatorUrl || process.env.WALRUS_AGGREGATOR_URL || "https://aggregator.walrus-mainnet.walrus.space";
  }

  private extractBlobId(response: any) {
    if (response.newlyCreated) {
      return {
        blobId: response.newlyCreated.blobObject.blobId,
        suiObjectId: response.newlyCreated.blobObject.id || "",
      };
    }
    if (response.alreadyCertified) {
      return {
        blobId: response.alreadyCertified.blobId,
        suiObjectId: response.alreadyCertified.event?.blobObjectId || "",
      };
    }
    throw new WalrusFormError("Failed to extract blobId from Walrus response", "WALRUS_UPLOAD_ERROR");
  }

  async uploadBlob(data: Uint8Array | Buffer, opts?: { epochs?: number }) {
    const epochs = opts?.epochs || 5;
    const delays = [1000, 2000, 4000];
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${this.publisherUrl}/v1/blobs?epochs=${epochs}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: data as unknown as BodyInit,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Walrus upload failed with status ${res.status}: ${text}`);
        }
        const json = await res.json();
        return this.extractBlobId(json);
      } catch (err: any) {
        if (attempt >= 3) {
          throw new WalrusFormError(`Walrus upload failed after 3 retries: ${err.message}`, "WALRUS_NETWORK_ERROR");
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
    throw new WalrusFormError("Walrus upload failed: Maximum retries exceeded", "WALRUS_NETWORK_ERROR");
  }

  async downloadBlob(blobId: string) {
    const res = await fetch(`${this.aggregatorUrl}/v1/blobs/${blobId}`);
    if (!res.ok) {
      throw new WalrusFormError(`Walrus download failed with status ${res.status}`, "WALRUS_DOWNLOAD_ERROR");
    }
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async uploadJSON(obj: any, opts?: { epochs?: number }) {
    const str = JSON.stringify(obj);
    const data = new TextEncoder().encode(str);
    const result = await this.uploadBlob(data, opts || { epochs: 5 });
    return result.blobId;
  }

  async downloadJSON(blobId: string) {
    const data = await this.downloadBlob(blobId);
    const str = new TextDecoder().decode(data);
    return JSON.parse(str);
  }

  async uploadMedia(file: Uint8Array | Buffer, mimeType: string, onProgress?: (p: number) => void) {
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const chunks: string[] = [];
    const totalSize = file.length;
    let offset = 0;
    while (offset < totalSize) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const res = await this.uploadBlob(chunk, { epochs: 5 });
      chunks.push(res.blobId);
      offset += chunk.length;
      if (onProgress) {
        onProgress(Math.round((offset / totalSize) * 100));
      }
    }
    const manifestBlobId = await this.uploadJSON({ chunks, totalSize, mimeType });
    return { blobId: manifestBlobId, size: totalSize };
  }
}

