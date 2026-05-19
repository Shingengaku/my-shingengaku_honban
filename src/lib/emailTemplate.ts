
interface TemplateVars {
    name: string;
    rank: string;
    venue: string;
    social_venue: string;
    amount: string;
    payment_link_section: string;
    lecture_date?: string;
    viewing_link?: string;
    zoom_id?: string;
    zoom_pass?: string;
    zoom_info?: string;
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

export const DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_PAID = {
    subject: '【神言学】講座開催間近のご案内',
    body: `{{name}} 様

【開催概要】
日時：
{{lecture_date}}
会場：{{venue}}
懇親会：{{social_venue}}

神言学講座へのお申込みありがとうございます。
開催が近づいてまいりましたので、改めてご案内申し上げます。

当日は会場にてお待ちしております。`
};

export const DEFAULT_EMAIL_TEMPLATE_REMINDER_VENUE_UNPAID = {
    subject: '【神言学】講座お申込み内容のご確認と決済のお願い',
    body: `{{name}} 様

【開催概要】
日時：
{{lecture_date}}
会場：{{venue}}
懇親会：{{social_venue}}

神言学講座へのお申込みありがとうございます。
開催が近づいてまいりましたが、受講料のご決済がまだ確認できておりません。

お手数ですが、下記リンクよりお手続きをお願いいたします。

▼ご決済リンク
{{payment_link_section}}

※本状と行き違いでご入金いただいた場合は、何卒ご容赦ください。

当日お会いできることを楽しみにしております。`
};

export const DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_PAID = {
    subject: '【神言学】オンライン視聴URLのご案内',
    body: `{{name}} 様

【開催日時】
{{lecture_date}}

神言学講座へのお申込みありがとうございます。
オンライン視聴用のURLをご案内いたします。

【視聴URL】
{{viewing_link}}

【ZOOM情報】
{{zoom_info}}

※開始10分前からアクセス可能です。
当日は画面越しにお会いできることを楽しみにしております。`
};

export const DEFAULT_EMAIL_TEMPLATE_REMINDER_ONLINE_UNPAID = {
    subject: '【神言学】オンライン視聴お申込み内容のご確認と決済のお願い',
    body: `{{name}} 様

【開催日時】
{{lecture_date}}

神言学講座へのお申込みありがとうございます。
開催が近づいてまいりましたが、受講料のご決済がまだ確認できておりません。

ご決済確認後、視聴URLを順次お送りいたします。
お手数ですが、下記リンクよりお手続きをお願いいたします。

▼ご決済リンク
{{payment_link_section}}

※本状と行き違いでご入金いただいた場合は、何卒ご容赦ください。

当日お会いできることを楽しみにしております。`
};

export function processEmailTemplate(templateBody: string, vars: Record<string, string>): string {
    if (typeof templateBody !== 'string') return '';
    let content = templateBody;
    for (const [key, value] of Object.entries(vars)) {
        // gフラグを使用したreplaceAll相当の処理
        // 正規表現に特殊文字が含まれる可能性を考慮し、簡単なエスケープまたは安全な置換を検討
        try {
            const regex = new RegExp(`{{${key}}}`, 'g');
            content = content.replace(regex, value || '');
        } catch (e) {
            // キーに特殊文字が含まれていてRegExpが失敗した場合のフォールバック
            content = content.split(`{{${key}}}`).join(value || '');
        }
    }
    return content;
}
