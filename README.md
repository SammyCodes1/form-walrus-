# FormWalrus

FormWalrus is a fully decentralized form builder and data collection platform. It relies on **Sui** for ownership and access control, and **Walrus** for immutable blob storage. Sensitive forms are end-to-end encrypted using the **Seal** threshold encryption protocol.

## Features
- **No Centralized Database:** All schema and submission data are stored as blobs on Walrus.
- **On-chain Access Control:** Forms are represented as objects on Sui, with an `AdminCap` controlling who can read submissions.
- **Threshold Encryption:** Private forms are encrypted client-side using `@mysten/seal`.
- **Drag-and-Drop Builder:** Fully responsive Next.js frontend with drag-and-drop form building.

## Architecture

```mermaid
graph TD
    User([User/Respondent]) -->|Fills form| Web[Next.js Web App]
    Admin([Admin/Creator]) -->|Builds form| Web
    
    Web -->|Create / Submit| API[Express API Gateway]
    Web <-->|Wallet Connect & Client-side Seal Decrypt| DappKit[@mysten/dapp-kit]
    
    API -->|Store Data / Schema JSON| WalrusPublisher[Walrus Publisher Node]
    API -->|Fetch Data| WalrusAggregator[Walrus Aggregator Node]
    
    API -->|Move Calls: Update Index, Auth| SuiRPC[Sui Fullnode RPC]
    SuiRPC --> MoveContracts[Sui Move Contracts: FormRegistry, AccessControl, SealPolicy]
```

## Local Setup

### 1. Prerequisites
- Node.js 18+
- PNPM (`npm install -g pnpm`)
- Sui CLI (`cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui`)

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Deploy Contracts
Configure your Sui CLI for testnet, ensure you have gas, and deploy:
```bash
cd packages/contracts
./deploy.sh
```
This will automatically generate a `.env.contracts` file. Copy those values into `apps/api/.env`.

### 4. Setup Environment
```bash
cp .env.example .env
```
Update `.env` with your `PACKAGE_ID` and `FORM_REGISTRY_ID`.

### 5. Run the Platform
In the root directory, start the API and Web apps in parallel:
```bash
pnpm dev
```
- API will be running on `http://localhost:4000`
- Web app will be running on `http://localhost:3000`

## Packages
- **apps/web**: The Next.js frontend.
- **apps/api**: The Express backend proxy/gateway.
- **packages/walrus-client**: TypeScript wrapper for Walrus HTTP endpoints + Sui indexing logic.
- **packages/contracts**: Sui Move smart contracts.
