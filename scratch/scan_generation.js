const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'src');

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            walk(filepath, callback);
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))) {
            callback(filepath);
        }
    }
}

console.log('Scanning files in src for ".generation" references...');
walk(srcDir, (filepath) => {
    const content = fs.readFileSync(filepath, 'utf8');
    if (content.includes('generation')) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (line.includes('generation') && !line.includes('generation_') && !line.includes('generationId')) {
                const relativePath = path.relative(path.resolve(__dirname, '..'), filepath);
                console.log(`${relativePath}:${index + 1}: ${line.trim()}`);
            }
        });
    }
});
