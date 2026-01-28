
interface TemplateVars {
    name: string;
    rank: string;
    venue: string;
    social_venue: string;
    amount: string;
    payment_link_section: string;
}

export const DEFAULT_EMAIL_TEMPLATE = {
    subject: '【神言学】お申込み受付・決済のご案内',
    body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

{{payment_link_section}}`
};

export const DEFAULT_EMAIL_TEMPLATE_GENERAL = {
    subject: '【神言学】お申込み受付のお知らせ',
    body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

現在、お客様の条件に合致する自動決済案内が見つかりませんでした（または事務局確認が必要です）。
事務局より別途、正式なご案内メールをお送りいたしますので、今しばらくお待ちください。`
};

export const DEFAULT_EMAIL_TEMPLATE_RESEND = {
    subject: '【神言学】【再送】お申込み受付・決済のご案内',
    body: `{{name}} 様

(本メールは管理者による再送です)

神言学講座へのお申込みありがとうございます。
以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}} 円
--------------------------------

{{payment_link_section}}`
};

export const DEFAULT_EMAIL_TEMPLATE_FORGOT_PASS = {
    subject: '【神言学】パスワードリセットのご案内',
    body: `{{username}} 様

パスワードリセットのリクエストを受け付けました。
以下のリンクをクリックして、新しいパスワードを設定してください。

{{reset_link}}

※リンクの有効期限は30分です。`
};

export function processEmailTemplate(templateBody: string, vars: Record<string, string>): string {
    let content = templateBody;
    for (const [key, value] of Object.entries(vars)) {
        // gフラグを使用したreplaceAll相当の処理
        // 自動エスケープはここでは完全ではありませんが、既知のキーには十分です
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value || '');
    }
    return content;
}
