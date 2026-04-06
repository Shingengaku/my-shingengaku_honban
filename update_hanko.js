
const fs = require('fs');
const path = 'c:/Users/pigua/.gemini/antigravity/scratch/shingengaku-app/src/app/receipt/[id]/ReceiptClient.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the HANKO_B64 constant and Replace its value
const b64 = fs.readFileSync('c:/Users/pigua/.gemini/antigravity/scratch/shingengaku-app/hanko_b64_real.txt', 'utf8').trim();
const regex = /const HANKO_B64 = '.*';/;
content = content.replace(regex, `const HANKO_B64 = '${b64}';`);

fs.writeFileSync(path, content);
console.log('Successfully updated ReceiptClient.tsx with new HANKO_B64');
