with open('src/app/builder/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

fixed = 0
for i, line in enumerate(lines):
    if '/upload/image' in line:
        lines[i] = line.replace('/upload/image', '/upload-media')
        print(f'Fixed line {i+1}: {lines[i].strip()}')
        fixed += 1

with open('src/app/builder/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'\nDone! Fixed {fixed} line(s)')
