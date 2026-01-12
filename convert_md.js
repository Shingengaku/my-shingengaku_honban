const fs = require('fs');
const { marked } = require('marked');

const md = fs.readFileSync('SYSTEM_FULL_SPECS.md', 'utf8');
const htmlContent = marked(md);

const fullHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>システム詳細仕様書兼マニュアル</title>
<style>
    body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1d4ed8; margin-top: 30px; border-left: 5px solid #1d4ed8; padding-left: 10px; }
    h3 { color: #1e40af; margin-top: 25px; }
    code { background: #f3f4f6; padding: 2px 5px; rounded: 3px; font-family: monospace; }
    pre { background: #1f2937; color: white; padding: 15px; overflow-x: auto; border-radius: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f3f4f6; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
    .alert { padding: 10px; border-radius: 5px; margin: 10px 0; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>
`;

fs.writeFileSync('SYSTEM_FULL_SPECS.html', fullHtml);
console.log('HTML file generated.');
