import { resend } from '../lib/resend';

// 環境変数が読み込まれているか確認
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL;

console.log("--- Resend 設定チェック ---");
console.log(`RESEND_API_KEY: ${apiKey ? "あり" : "なし"}`);
console.log(`FROM_EMAIL: ${fromEmail || "未設定 (デフォルトを使用)"}`);

async function sendTestEmail() {
    if (!apiKey) {
        console.error("エラー: RESEND_API_KEY がありません。処理を中止します。");
        process.exit(1);
    }

    const sender = fromEmail ? `Test <${fromEmail}>` : 'onboarding@resend.dev';
    const recipient = 'delivered@resend.dev'; // 設定が正しい場合に常に成功するResendのテスト用アドレス

    console.log(`\nテストメールの送信を試行中...`);
    console.log(`From: ${sender}`);
    console.log(`To: ${recipient}`);

    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: [recipient],
            subject: 'Resend Test Email',
            html: '<p>これはResendの設定を確認するためのテストメールです。</p>'
        });

        if (error) {
            console.error("\n❌ Failed to send email.");
            console.error("Error details:", error);
        } else {
            console.log("\n✅ Email sent successfully!");
            console.log("Response data:", data);
        }
    } catch (e) {
        console.error("\n❌ 予期せぬエラーが発生しました。");
        console.error(e);
    }
}

sendTestEmail();
