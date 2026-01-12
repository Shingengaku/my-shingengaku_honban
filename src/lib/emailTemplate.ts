
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

export function processEmailTemplate(templateBody: string, vars: TemplateVars): string {
    let content = templateBody;
    content = content.replace(/{{name}}/g, vars.name);
    content = content.replace(/{{rank}}/g, vars.rank);
    content = content.replace(/{{venue}}/g, vars.venue);
    content = content.replace(/{{social_venue}}/g, vars.social_venue);
    content = content.replace(/{{amount}}/g, vars.amount);
    content = content.replace(/{{payment_link_section}}/g, vars.payment_link_section);
    return content;
}
