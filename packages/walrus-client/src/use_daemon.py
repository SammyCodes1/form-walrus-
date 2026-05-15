with open('walrus.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Try all possible current values and replace with daemon URL
for old in [
    'this.publisherUrl = publisherUrl || "https://publisher.walrus.space";',
    'this.publisherUrl = publisherUrl || "https://publisher.walrus-testnet.walrus.space";',
    'this.publisherUrl = publisherUrl || "http://127.0.0.1:31416";',
]:
    if old in content:
        content = content.replace(old, 'this.publisherUrl = publisherUrl || "http://127.0.0.1:31416";')
        print(f'Fixed publisher URL')

for old in [
    'this.aggregatorUrl = aggregatorUrl || "https://aggregator.walrus.space";',
    'this.aggregatorUrl = aggregatorUrl || "https://aggregator.walrus-testnet.walrus.space";',
    'this.aggregatorUrl = aggregatorUrl || "http://127.0.0.1:31416";',
]:
    if old in content:
        content = content.replace(old, 'this.aggregatorUrl = aggregatorUrl || "http://127.0.0.1:31416";')
        print(f'Fixed aggregator URL')

with open('walrus.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('\nCurrent URLs:')
for i, line in enumerate(content.splitlines()):
    if 'this.publisherUrl' in line or 'this.aggregatorUrl' in line:
        print(f'  Line {i+1}: {line.strip()}')
