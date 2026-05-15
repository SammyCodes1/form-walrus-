with open('src/routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''    const blobId = await walrus.uploadBlob(uint8Array);
    res.json({ blob_id: blobId });'''

new = '''    const result = await walrus.uploadBlob(uint8Array);
    const blobId = typeof result === 'string' ? result : (result.blobId || result);
    res.json({ blob_id: blobId });'''

if old in content:
    content = content.replace(old, new)
    print('Fixed upload-media route!')
else:
    print('Pattern not found - showing current upload-media section:')
    start = content.find('/upload-media')
    print(content[start:start+400])

with open('src/routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
