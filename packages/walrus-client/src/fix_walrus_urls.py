with open('walrus.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix line 8 - publisher URL fallback
content = content.replace(
    'this.publisherUrl = publisherUrl || "https://publisher.walrus-testnet.walrus.space";',
    'this.publisherUrl = publisherUrl || process.env.WALRUS_PUBLISHER_URL || "http://127.0.0.1:31416";'
)

# Fix line 9 - aggregator URL fallback  
content = content.replace(
    'this.aggregatorUrl = aggregatorUrl || "https://aggregator.walrus-testnet.walrus.space";',
    'this.aggregatorUrl = aggregatorUrl || process.env.WALRUS_AGGREGATOR_URL || "http://127.0.0.1:31416";'
)

with open('walrus.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done! Verify:')
for i, line in enumerate(content.splitlines()):
    if 'publisherUrl' in line or 'aggregatorUrl' in line:
        if 'this.' in line:
            print(f'  Line {i+1}: {line.strip()}')
