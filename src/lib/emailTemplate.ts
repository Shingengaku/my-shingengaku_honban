
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

export const DEFAULT_TEMPLATE_FREE_ONLINE = {
    subject: '【神言学】お申込み受付完了のお知らせ',
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

オンラインでのご参加、ありがとうございます。
ご視聴に関する詳細につきましては、追ってご連絡させていただきます。`
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

export const DEFAULT_EMAIL_TEMPLATE_NO_PARTICIPATION = {
    subject: '【神言学】ご回答ありがとうございました',
    body: `{{name}} 様

神言学講座について、ご回答誠にありがとうございます。
以下の内容でお知らせを受け付けいたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
--------------------------------

またの機会でのご参加を心よりお待ち申し上げております。
引き続き、どうぞよろしくお願いいたします。`
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

export const DEFAULT_EMAIL_TEMPLATE_MULTIPLE = {
    subject: '【神言学】複数名でのお申し込みを承りました（事務局からの連絡をお待ちください）',
    body: `{{name}} 様

神言学講座へのお申込みありがとうございます。
複数名でのお申し込みとして、以下の内容で受付いたしました。

--------------------------------
お名前: {{name}}
判定属性: {{rank}}
参加会場: {{venue}}
懇親会: {{social_venue}}
合計金額: {{amount}}
--------------------------------

複数名でのお申し込みの場合、合計金額を確認の上、事務局より別途お支払い案内（専用決済リンク等）をメールにてお送りいたします。

お手数をおかけいたしますが、事務局からの次回の連絡をお待ちいただけますようお願い申し上げます。
（本メールでの自動決済は不要です）`
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
