with open('src/routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "process.env.PACKAGE_ID + '::access_control::AdminCap'"
new = "'0x3c3dbf1d4ec58e9d8db80e6fc79164bd84004860378f7a7112a956adbd6f479c::access_control::AdminCap'"

if old in content:
    content = content.replace(old, new)
    with open('src/routes.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed! PACKAGE_ID hardcoded successfully.')
else:
    print('Pattern not found. Showing lines with AdminCap:')
    for i, line in enumerate(content.splitlines()):
        if 'AdminCap' in line:
            print(f'  Line {i+1}: {repr(line)}')
