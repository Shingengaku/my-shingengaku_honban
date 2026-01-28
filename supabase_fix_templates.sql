
-- email_templateを適切なデフォルトJSONで更新
UPDATE app_settings
SET value = '{
  "subject": "【神言学】お申込み受付・決済のご案内",
  "body": "{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n合計金額: {{amount}} 円\n--------------------------------\n\n{{payment_link_section}}"
}'::jsonb
WHERE key = 'email_template';

-- email_template_generalを適切なデフォルトJSONで更新
UPDATE app_settings
SET value = '{
  "subject": "【神言学】お申込み受付のお知らせ",
  "body": "{{name}} 様\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n--------------------------------\n\n現在、お客様の条件に合致する自動決済案内が見つかりませんでした（または事務局確認が必要です）。\n事務局より別途、正式なご案内メールをお送りいたしますので、今しばらくお待ちください。"
}'::jsonb
WHERE key = 'email_template_general';

-- email_template_resendを更新
UPDATE app_settings
SET value = '{
  "subject": "【神言学】【再送】お申込み受付・決済のご案内",
  "body": "{{name}} 様\n\n(本メールは管理者による再送です)\n\n神言学講座へのお申込みありがとうございます。\n以下の内容で受付いたしました。\n\n--------------------------------\nお名前: {{name}}\n判定属性: {{rank}}\n参加会場: {{venue}}\n懇親会: {{social_venue}}\n合計金額: {{amount}} 円\n--------------------------------\n\n{{payment_link_section}}"
}'::jsonb
WHERE key = 'email_template_resend';

-- email_template_forgot_passを更新
UPDATE app_settings
SET value = '{
  "subject": "【神言学】パスワードリセットのご案内",
  "body": "{{username}} 様\n\nパスワードリセットのリクエストを受け付けました。\n以下のリンクをクリックして、新しいパスワードを設定してください。\n\n{{reset_link}}\n\n※リンクの有効期限は30分です。"
}'::jsonb
WHERE key = 'email_template_forgot_pass';
