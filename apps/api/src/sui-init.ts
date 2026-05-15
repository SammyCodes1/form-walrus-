let suiClientInstance = null;

async function getSuiClient() {
  if (suiClientInstance) return suiClientInstance;

  const mod = await import("@mysten/sui/client");

  // In @mysten/sui v2+, SuiClient was renamed to CoreClient
  const ClientClass = mod.SuiClient || mod.CoreClient || mod.BaseClient;

  if (!ClientClass) {
    throw new Error(
      "Cannot find SUI client class. Available exports: " + Object.keys(mod).join(", ")
    );
  }

  suiClientInstance = new ClientClass({
    url: process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
  });

  return suiClientInstance;
}

module.exports = { getSuiClient };
