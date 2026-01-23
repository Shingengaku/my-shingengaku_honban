
const fs = require('fs');
const { marked } = require('marked');

// 潜在的な問題を処理するために marked を設定するか、必要に応じて機能を追加します
// 今のところデフォルトで問題ありません。

const inputFile = 'src/MANUAL.md';
const outputFile = 'src/MANUAL.html';

if (!fs.existsSync(inputFile)) {
    console.error(`Error: ${inputFile} not found.`);
    process.exit(1);
}

const md = fs.readFileSync(inputFile, 'utf8');
const htmlContent = marked(md);

const fullHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>神言学システム 完全構築・運用マニュアル</title>
<style>
    body {
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        line-height: 1.7;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px;
        color: #374151; /* グレー 700 */
        background-color: #fbf6e5; /* ウォークスルーアーティファクトのクリーム色背景 */
    }
    h1, h2, h3, h4, h5, h6 {
        color: #111827; /* グレー 900 */
        margin-top: 2em;
        margin-bottom: 0.8em;
        font-weight: 700;
        line-height: 1.3;
    }
    h1 { 
        font-size: 2.25em; 
        border-bottom: 2px solid #e5e7eb; 
        padding-bottom: 0.5em; 
        margin-bottom: 1.5em;
    }
    h2 { 
        font-size: 1.75em; 
        border-bottom: 1px solid #e5e7eb; 
        padding-bottom: 0.3em; 
    }
    h3 { font-size: 1.35em; }
    
    p { margin-bottom: 1.5em; }
    
    strong { font-weight: 600; color: #111827; }

    /* テーブル - ウォークスルースタイル */
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 2em 0;
        background-color: #fcfcfc; /* テーブル内容用のわずかにオフホワイト */
        border: 1px solid #d1d5db; /* グレー 300 */
        border-radius: 6px;
        overflow: hidden;
    }
    th {
        background-color: #e5e7eb; /* グレー 200 ヘッダー */
        color: #1f2937; /* グレー 800 */
        font-weight: 600;
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid #d1d5db;
    }
    td {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        color: #4b5563; /* グレー 600 */
    }
    tr:last-child td { border-bottom: none; }
    tr:hover { background-color: #f3f4f6; }

    /* コードブロック */
    pre {
        background-color: #1f2937; /* 暗い背景 */
        color: #f3f4f6;
        padding: 1.5em;
        border-radius: 8px;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.9em;
        margin: 1.5em 0;
        line-height: 1.5;
        border: 1px solid #374151;
    }
    code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.9em;
        background-color: #e5e7eb; 
        color: #1f2937;
        padding: 0.2em 0.4em;
        border-radius: 4px;
    }
    pre code {
        background-color: transparent;
        color: inherit;
        padding: 0;
    }

    /* リンク */
    a { 
        color: #2563eb; 
        text-decoration: none; 
        font-weight: 500;
    }
    a:hover { text-decoration: underline; }

    /* リスト */
    ul, ol { 
        padding-left: 1.5em; 
        margin-bottom: 1.5em; 
    }
    li { margin-bottom: 0.5em; }

    /* アラート / 引用 */
    blockquote {
        background-color: #fffbeb; /* 明るい黄色のアラート背景 */
        border-left: 4px solid #f59e0b; /* 琥珀色の枠線 */
        padding: 1em;
        margin: 1.5em 0;
        color: #92400e; /* 琥珀色のテキスト */
        border-radius: 0 4px 4px 0;
        font-style: normal; /* 斜体を上書き */
    }
</style>
</head>
<body>
${htmlContent}
</body>
</html>
`;

fs.writeFileSync(outputFile, fullHtml);
console.log(`Generated HTML with Walkthrough styling based on ${inputFile}`);
