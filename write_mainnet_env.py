import os

env_content = """# ── Sui Mainnet ──────────────────────────────────────
PACKAGE_ID=0x21e7032ae20cbb5cdbd9f44994d7a1a983e5d48318e9b89dbc195595e548c823
FORM_REGISTRY_ID=0x1167a7e00faeab479f9572b68e8fa521d553a6f42b864500f09bc0773f39c8af
UPGRADE_CAP_ID=0x2a4390e9cef9c8d741ed78e8f8f9384269089587893e518cdb54a99faff0b24f
DEPLOYER_ADDRESS=0xf86d6e1d448e52c46285bf3e404168ca9d6bac822574e66d78932363e4a381cc
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
SUI_NETWORK=mainnet

# ── Walrus Mainnet ───────────────────────────────────
WALRUS_PUBLISHER_URL=https://walrus-mainnet-publisher-1.staketab.org:443
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-mainnet.walrus.space
WALRUS_EPOCHS=26

# ── API Gateway ──────────────────────────────────────
API_PORT=4000
API_URL=http://localhost:4000

# ── Frontend ─────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_PACKAGE_ID=0x21e7032ae20cbb5cdbd9f44994d7a1a983e5d48318e9b89dbc195595e548c823
NEXT_PUBLIC_FORM_REGISTRY_ID=0x1167a7e00faeab479f9572b68e8fa521d553a6f42b864500f09bc0773f39c8af
"""

# Write root .env
with open('.env', 'w', encoding='utf-8') as f:
    f.write(env_content)
print('Written: .env')

# Write API .env
os.makedirs('apps/api', exist_ok=True)
with open('apps/api/.env', 'w', encoding='utf-8') as f:
    f.write(env_content)
print('Written: apps/api/.env')

# Write frontend .env.local
os.makedirs('apps/web', exist_ok=True)
with open('apps/web/.env.local', 'w', encoding='utf-8') as f:
    f.write(env_content)
print('Written: apps/web/.env.local')

print('\nAll env files updated for Mainnet!')
