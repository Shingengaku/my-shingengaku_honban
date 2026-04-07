import os

path = 'src/app/admin/dashboard/page.tsx'
if not os.path.exists(path):
    print(f"File not found: {path}")
    exit(1)

with open(path, 'rb') as f:
    raw = f.read()

# Try to decode with utf-8, ignore errors to handle corrupt characters
content = raw.decode('utf-8', 'ignore')

# Replacement 1: Update the handler
old_handler = 'onClick={handleTruncate}'
new_handler = 'onClick={(e) => handleTruncate(e)}'
content = content.replace(old_handler, new_handler)

# Replacement 2: Update the title (more flexible match)
import re
# Match any title starting with Ctrl
pattern = r'title="Ctrlキーを押しながらクリチ.+?"'
replacement = 'title="【重要】Ctrlキー（MacはCommand）を押しながらクリックして、全ての申込データを一括削除します"'
content = re.sub(pattern, replacement, content)

# Also handle the specific broken one observed in grep
pattern2 = r'title="Ctrlキーを押しながらクリチE.*?"'
content = re.sub(pattern2, replacement, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated dashboard/page.tsx")
