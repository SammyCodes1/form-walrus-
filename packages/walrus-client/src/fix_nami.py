publisher = "https://walrus-mainnet-publisher.nami.cloud/c29Zs5cKHtYL4cMIvReFsC4sdExf3B3Uow6JAi4sMRkAuop4fMseaUG0de6yWhBsHQG8b8pi7zmIEfA"
aggregator = "https://aggregator.walrus-mainnet.walrus.space"

content = open("walrus.ts", "r", encoding="utf-8").read()

# Replace whatever the current publisher/aggregator defaults are
import re
content = re.sub(
    r'this\.publisherUrl = publisherUrl \|\| "[^"]*";',
    f'this.publisherUrl = publisherUrl || "{publisher}";',
    content
)
content = re.sub(
    r'this\.aggregatorUrl = aggregatorUrl \|\| "[^"]*";',
    f'this.aggregatorUrl = aggregatorUrl || "{aggregator}";',
    content
)

open("walrus.ts", "w", encoding="utf-8").write(content)
print("Done! URLs updated:")
print("  Publisher:", publisher[:60] + "...")
print("  Aggregator:", aggregator)
