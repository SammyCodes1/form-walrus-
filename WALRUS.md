# Walrus storage — setup & operations

This app pays for Walrus storage **server-side** with a single keypair. End users never see WAL. They sign SUI gas for on-chain bits (`create_form`, `seal_approve`, allowlist mgmt) but storage is funded by the operator.

## How payment works

| Cost | Who pays | How |
|---|---|---|
| WAL for blob storage | The operator (you) | `WALRUS_SIGNER_PRIVKEY` keypair, called from the API via `@mysten/walrus` SDK |
| SUI gas for `writeBlob` tx (register + certify) | Same keypair | Same keypair signs both |
| SUI gas for `create_form`, `seal_approve`, etc. | End user | Wallet popup via `@mysten/dapp-kit` |

The keypair is loaded once per process from `process.env.WALRUS_SIGNER_PRIVKEY` and reused for every upload. There is no publisher daemon; the SDK talks to Walrus storage nodes directly (optionally via an upload relay).

## Setup

### 1. Install

```bash
pnpm install
```

This pulls `@mysten/walrus` and its WASM module into `packages/walrus-client/node_modules`.

### 2. Create a Sui keypair for the server

```bash
sui keytool generate ed25519
# or, to use an existing one:
sui keytool export --key-identity <alias>
```

You want the `suiprivkey1...` (Bech32) format. That's what `Ed25519Keypair.fromSecretKey` expects.

### 3. Fund the address

The keypair needs **both** tokens on mainnet:

- **SUI** for transaction gas. Roughly ~0.01 SUI per blob written (one tx for `register_blob`, one for `certify_blob`). 1 SUI covers the first ~100 uploads.
- **WAL** for storage fees. Cost scales with `size × epochs`. WAL is available on most Sui DEXes (Cetus, Aftermath, etc.).

Check balance:
```bash
sui client balance --address <your-address>
```

### 4. Set env vars

In `apps/api/.env`:

```
WALRUS_SIGNER_PRIVKEY=suiprivkey1...
# Optional — speeds up writes by offloading sliver fan-out
WALRUS_UPLOAD_RELAY=https://upload-relay.mainnet.walrus.space
```

`.env` is gitignored. **Never commit a real privkey.**

### 5. Smoke-test before wiring through the API

Save this as `apps/api/smoke.ts`:

```ts
import "dotenv/config";
const { WalrusClient } = require("@form-walrus/client");

(async () => {
  const w = new WalrusClient();
  const id = await w.uploadJSON({ hello: "world", ts: Date.now() });
  console.log("wrote blob:", id);
  const back = await w.downloadJSON(id);
  console.log("read back:", back);
})().catch((e) => { console.error(e); process.exit(1); });
```

Run:
```bash
cd apps/api && pnpm exec ts-node smoke.ts
```

Should print a blob ID and the JSON back. If this works, the API routes will work — they call the same `WalrusClient` methods.

## Operational considerations

### Epochs = real money

`opts.epochs` is the storage lifetime in Walrus epochs. **One epoch ≈ 2 weeks** on mainnet. Cost scales linearly with epochs. Current defaults in this codebase:

| Call site | Epochs | Storage duration | Notes |
|---|---|---|---|
| Default (`walrus.ts`) | 5 | ~10 weeks | Form schemas, submissions, indexes |
| `apps/api/src/routes.ts:235` (image upload) | **52** | **~2 years** | Audit this — usually overkill |
| `uploadMedia` chunks | 5 | ~10 weeks | Manifest also at 5 |

Dial epochs down for anything ephemeral. Forms that get a few responses and are then archived don't need 2-year storage.

### Throughput is serialized per keypair

Sui sequence numbers serialize transactions per address. **One keypair = one upload at a time.** Concurrent requests will queue at the SDK / RPC layer and slow each other down.

If you need throughput:
- Use the upload relay (`WALRUS_UPLOAD_RELAY`) — distributes the sliver fan-out so the bottleneck is just the on-chain tx.
- Or run multiple sub-keypairs, round-robin between them. (The `walrus-publisher` daemon does this with `--n-clients=8` by default.) Not implemented in this codebase yet.

### Monitor the balance

When SUI or WAL runs out, every upload starts failing with `WALRUS_NETWORK_ERROR` and a vague underlying message. Bake in a balance check:

```bash
sui client balance --address <your-address> | grep -E "SUI|WAL"
```

Alert when either drops below a threshold you choose. There is no automatic top-up.

### Hot-wallet hygiene

The privkey in `WALRUS_SIGNER_PRIVKEY` is a hot wallet on a server. If it leaks, attacker drains SUI + WAL. Minimum precautions:

- Env var only, never in source or committed files.
- Restrict who can read the deploy environment (`apps/api/.env` on the server, secrets manager in cloud setups).
- Keep balances low — fund what you need for ~1 month of expected uploads, top up rather than pre-loading.
- For production, move to a KMS-backed signer (AWS KMS, GCP Cloud KMS) so the private key never lives in process memory. The SDK accepts any `Signer` — implementing a KMS signer is ~50 lines.
- Rotate periodically: generate a new keypair, drain the old one to the new one, swap env vars.

## Using the upload relay

The relay (`upload-relay.mainnet.walrus.space`) does the heavy sliver distribution so the API doesn't have to fan out to ~1000 storage nodes per blob. Tradeoffs:

- **Pro**: dramatically fewer outbound HTTP calls per upload (small handful vs ~2200). Lower latency. Less likely to hit rate limits.
- **Pro**: you still hold the keypair; relay never sees your privkey.
- **Con**: requires a tiny SUI tip per upload to the relay operator (current default `sendTip: { max: 1_000 }` MIST = 0.000001 SUI, negligible).
- **Con**: the relay is a dependency. If it goes down, you can fall back to direct-to-storage-nodes by removing the env var.

Recommended on by default for any serious deployment.

## Troubleshooting

### `WALRUS_SIGNER_PRIVKEY not set`
You haven't set the env var in `apps/api/.env`, or the API was started before the env file existed. Restart `pnpm dev`.

### `Walrus write failed: insufficient balance`
The signer address ran out of WAL or SUI. Top up.

### `Walrus write failed: Equivocation` or sequence number errors
You're sending concurrent uploads from the same keypair faster than the RPC can sequence them. Use the upload relay, or queue uploads at the application layer.

### Long delay then `Walrus write failed: timeout`
Without the upload relay, browser-fast networks can be marginal for sliver fan-out from a single server. Set `WALRUS_UPLOAD_RELAY`.

### WASM error on first call
`@mysten/walrus` loads a WASM module on first use. With `ts-node-dev --transpile-only` (the dev script) this should just work. If you're running through a bundler (webpack, esbuild, etc.) and it strips WASM, that's the issue — exclude `@mysten/walrus-wasm` from bundling or use the native Node loader.

### Reads work but writes fail
Almost always means the keypair is unfunded (writes need balance, reads don't) or `WALRUS_SIGNER_PRIVKEY` is wrong.

## What this replaced

Previously this codebase PUT blobs to a public HTTP publisher (`walrus-mainnet-publisher-1.staketab.org`). That publisher is offline (`HTTP 502`) and the hardcoded fallback in older versions of `walrus.ts` (`publisher.walrus-mainnet.walrus.space`) no longer resolves in DNS at all. The SDK path replaces both. See the commit history on the `walrus-sdk-migration` branch for the full diff.
