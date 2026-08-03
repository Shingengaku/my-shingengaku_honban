const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(__dirname, 'test_output.xlsx'));
    const ws = wb.getWorksheet('参加者リスト');
    
    console.log('Dumping rows 1 to 40...');
    for (let r = 1; r <= 40; r++) {
        const row = ws.getRow(r);
        const vals = [];
        for (let c = 1; c <= 15; c++) {
            vals.push(row.getCell(c).value);
        }
        // nullを削ぎ落として見やすくする
        const formatted = vals.map(v => v === null ? '' : v);
        console.log(`Row ${String(r).padStart(2)}:`, JSON.stringify(formatted));
    }
}

main().catch(console.error);
