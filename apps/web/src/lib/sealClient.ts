"use client";
import { SealClient, getAllowlistedKeyServers } from "@mysten/seal";
import { SuiClient } from "@mysten/sui/client";

// Singleton — reuse across the app (Seal docs recommend this)
let sealClientInstance: SealClient | null = null;

export function getSealClient(suiClient: SuiClient): SealClient {
  if (sealClientInstance) return sealClientInstance;
  
  // getAllowlistedKeyServers returns mainnet key server object IDs
  // from Ruby Nodes, NodeInfra, Studio Mirai, Overclock, H2O Nodes,
  // Triton One, Enoki by Mysten Labs
  const serverIds = getAllowlistedKeyServers("mainnet");
  
  sealClientInstance = new SealClient({
    suiClient,
    serverConfigs: serverIds.map((id: string) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false, // Saves latency — safe for production
  });
  
  return sealClientInstance;
}
