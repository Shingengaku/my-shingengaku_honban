const fs = require('fs');
const path = 'src/app/admin/dashboard/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const fixLine = (lineIndex, to) => {
    lines[lineIndex - 1] = to;
};

// Line-by-line fixes based on direct inspection
fixLine(184, "    // 高度なフィルター状態(複数選択)");
fixLine(191, "    // オンライン視聴フィルター");
fixLine(196, "    // 編集モーダルの状態");
fixLine(216, "    // メールテンプレートの状態");
fixLine(217, "    const [emailTemplate, setEmailTemplate] = useState({ subject: '', body: '' }); // マッチした場合");
fixLine(219, "    const [emailTemplateFree, setEmailTemplateFree] = useState({ subject: '', body: '' }); // 0円無料の場合");
fixLine(453, "        fetchRanks(); // ランク情報を取得");
fixLine(454, "        fetchOnlineOptions(); // オンラインマスタ取得");
fixLine(455, "        fetchSettings(false); // 設定をロード（モーダルは開かない）");
fixLine(464, "                // データの整形 (participation_typeの補完など)");
fixLine(467, "                    // タグから推測する場合のロジック (後方互換性)");
fixLine(468, "                    participation_type: d.participation_type || (d.venue && ['LIVE視聴', 'アーカイブ視聴'].some((o: string) => d.venue.includes(o)) ? 'online' : 'venue')");
fixLine(474, "            alert('データ取得に失敗しました');");
fixLine(510, "                // 決済リンクを解析");
fixLine(581, "        // 明示的に定義された商品名マスタリストを使用");

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed encoding errors in page.tsx');
