const fs = require('fs');
const file = 'src/app/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');
const regex = /label="[^"]*"\s*\n(\s*)options=\{uniqueVenueSocialOptions\}/g;
if (regex.test(content)) {
    content = content.replace(regex, 'label="全ての懇親会の回答"\n$1options={uniqueVenueSocialOptions}');
    fs.writeFileSync(file, content);
    console.log('Fixed successfully');
} else {
    console.log('Regex did not match');
}
