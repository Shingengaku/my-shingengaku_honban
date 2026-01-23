import { resend } from '../lib/resend';

// 環境変数が読み込まれているか確認
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL;

console.log("--- Resend Configuration Check ---");
console.log(`RESEND_API_KEY: ${apiKey ? "Present" : "MISSING"}`);
console.log(`FROM_EMAIL: ${fromEmail || "Not set (will use default)"}`);

async function sendTestEmail() {
    if (!apiKey) {
        console.error("Error: RESEND_API_KEY is missing. Cannot proceed.");
        process.exit(1);
    }

    const sender = fromEmail ? `Test <${fromEmail}>` : 'onboarding@resend.dev';
    const recipient = 'delivered@resend.dev'; // 設定が正しい場合に常に成功するResendのテスト用アドレス

    console.log(`\nAttempting to send test email...`);
    console.log(`From: ${sender}`);
    console.log(`To: ${recipient}`);

    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: [recipient],
            subject: 'Resend Test Email',
            html: '<p>This is a test email to verify your Resend configuration.</p>'
        });

        if (error) {
            console.error("\n❌ Failed to send email.");
            console.error("Error details:", error);
        } else {
            console.log("\n✅ Email sent successfully!");
            console.log("Response data:", data);
        }
    } catch (e) {
        console.error("\n❌ Unexpected error occurred.");
        console.error(e);
    }
}

sendTestEmail();
