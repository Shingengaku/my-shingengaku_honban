const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/dashboard/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// fetchApplications内のデータ正規化と文字化け修正
const fetchRegex = /const formatted = data\.map\(\(d: any\) => \(\{[\s\S]*?participation_type: d\.participation_type \|\| \(d\.venue && \['LIVE視聴', 'アーカイブ視聴'\]\.some\(\(o: string\) => d\.venue\.includes\(o\)\) \? 'online' : 'venue'\)\n\s*\}\)\);/g;

const replacement = `const formatted = data.map((d: any) => ({
                    ...d,
                    input_name: d.input_name || '',
                    input_email: d.input_email || '',
                    input_furigana: d.input_furigana || '',
                    tags: Array.isArray(d.tags) ? d.tags : [],
                    participation_type: d.participation_type || (d.venue && ['LIVE視聴', 'アーカイブ視聴'].some((o) => d.venue.includes(o)) ? 'online' : 'venue')
                }));`;

content = content.replace(fetchRegex, replacement);

// コメントの文字化けもついでに修正
content = content.replace(/\/\/ チE.*タの整形/g, '// データの整形');
content = content.replace(/\/\/ タグから推測する場合.*ロジック/g, '// タグから推測する場合のロジック');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated page.tsx and cleaned up garbled comments.');
