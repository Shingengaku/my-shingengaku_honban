# システム詳細仕様書兼マニュアル (SYSTEM_FULL_SPECS.md)

このドキュメントは、エンジニアではない方でも、このシステムの全てを理解し、運用し、もし壊れてもゼロから作り直せるように書かれた「完全ガイド」です。

---

# 1. 製品仕様書（これはどんな機械か？）

## 製品の目的
このシステムは、**「神言学（しんげんがく）集中講座」のその場の事務作業を自動化するロボット**です。

これまで人間が手作業でやっていた以下の仕事を、全部自動でやってくれます。
- 「誰が申し込んだか」をリストにする。
- 「お金は払われたか」をチェックする。
- 「申込完了メール」を一人ひとりに送る。
- 「同じ人が2回申し込んでいないか」を見張る。

## 全体像
- **申込者（ユーザー）ができること**:
    - スマホやパソコンから専用の画面を開き、名前やメールアドレスを入れて「申し込む」ボタンを押すだけで、手続きが完了します。
- **管理者（運営）ができること**:
    - 管理専用の画面（ダッシュボード）を見て、今何人集まっているか、誰が入金済みかを一目で確認できます。
    - 申込画面に「ただいま満席です！」のようなお知らせポップアップを出すことができます。

---

# 2. 機能一覧と挙動（何ができるか？）

## クライアント側（申込画面）
誰でも見れる、申し込み用のページです。

- **画面構成**:
    - **お知らせボタン**: 管理者がメッセージを設定していると、タイトル下に「集中講座詳細はこちら」ボタンが表示されます。
    - **お知らせポップアップ**: ボタンを押すと、重要なお知らせが表示されます。
    - **入力フォーム**:
        - **お名前・ふりがな**: 入力必須です。
        - **メールアドレス**: 「@」がないなど、形がおかしいと「正しく入力してね」と注意してくれます。
        - **参加会場**: 東京、福岡、両方、不参加 から選べるラジオボタンです。
        - **懇親会**: 会場に合わせて、参加できる懇親会だけが選べるようになっています（例えば「福岡だけ参加」の人は「東京懇親会」を選べません）。
- **ボタンを押した時の動き**:
    - 「申し込む」を押すと、入力漏れがないかチェックします。
    - 送信中はボタンが「送信中...」に変わり、連打できないようになります。
    - 無事にデータが届くと画面が切り替わり、「受付完了」と表示されます。同時に、申込者のメールアドレスに確認メールが届きます。

## 管理画面側（データ確認）
パスワードを知っている運営メンバーだけが入れる秘密の部屋です。

- **ログイン機能**:
    - `ADMIN_PASSWORD` という「合い言葉」を知っている人だけがログインできます。
- **データ確認**:
    - エクセルのような表で、申込者がズラリと並んでいます。
    - **検索・絞り込み**: 「東京会場の人だけ」「未決済の人だけ」を表示できます。
    - **CSV出力**: ボタン一つで、全データをエクセルで開けるファイルとしてダウンロードできます。

---

# 3. データベース設計と紐付け（中身の仕組み）

データは「Supabase（スパベース）」という、インターネット上の巨大な「名簿ノート（データベース）」に書き込まれます。

## テーブル構成図
名簿ノートには、以下の2種類のページ（テーブル）があります。

### 1. `applications` テーブル（申込者リスト）
ここにお客さんの情報が1行ずつ増えていきます。

| 項目名 (カラム) | データの種類 | 何の情報？ |
| :--- | :--- | :--- |
| `id` | 記号 | 背番号。システムが勝手につけます（例: a1b2...）。 |
| `created_at` | 日時 | 申し込んだ日時。「2024/01/01 10:00」のように記録されます。 |
| `input_name` | 文字 | **お名前**。画面で入力された漢字の名前です。 |
| `input_email` | 文字 | **メールアドレス**。連絡先です。 |
| `venue` | 文字 | **参加会場**。「tokyo」などのローマ字で記録されます。 |
| `social_venue` | 文字 | **懇親会**。こちらもローマ字で記録されます。 |
| `payment_status` | 文字 | **支払状況**。「unpaid（未払い）」「paid（支払い済み）」などが入ります。 |
| `is_duplicate_confirmed` | 真偽値 | **同姓確認**。同姓同名のチェックが済んだかどうかの旗（フラグ）です。 |
| `tags` | 文字の列 | **タグ**。「重複を無視する」などの目印シールです。 |

### 2. `app_settings` テーブル（設定メモ）
システムの設定をメモしておく場所です。

| 項目名 (カラム) | 何の情報？ |
| :--- | :--- |
| `key` | 設定の名前（例：`application_text` ＝ 申込画面の文章）。 |
| `value` | 設定の中身（例：ポップアップに表示する実際のメッセージ）。 |

### 3. `admin_users` テーブル（管理者リスト）
管理画面にログインできる人のリストです。

| 項目名 (カラム) | 何の情報？ |
| :--- | :--- |
| `username` | ログインID（ユーザー名）。 |
| `email` | **メールアドレス**。パスワードを忘れた時に使います。 |
| `password_hash` | 暗号化されたパスワード。 |
| `created_at` | 作成日時。 |
| `reset_token` | パスワード再設定用の一時的なカギ。 |
| `reset_token_expires` | カギの有効期限。 |

## 画面との紐付け（データフロー）
画面に入力された文字が、どうやって名簿ノートに書かれるかを説明します。

1. **入力 (`page.tsx`)**:
    - あなたが画面の「**お名前**」欄に「**山田太郎**」と入力します。
    - プログラム内の `formData.name` という箱に「山田太郎」が入ります。

2. **送信 (`route.ts`)**:
    - 「申し込む」ボタンを押すと、`src/app/api/apply/route.ts` という「受付係のプログラム」にデータが渡されます。
    - この受付係が、Supabase（名簿ノート）に向かって「これ書いて！」と命令します。

3. **記録 (Database)**:
    - データベースの `applications` テーブルにある `input_name` という欄に「**山田太郎**」と書き込まれます。

**図解イメージ**:
[画面:お名前] ➡ (formData) ➡ [受付係プログラム] ➡ (input_name) ➡ [名簿ノート:applications表]

---

# 4. ユーザーマニュアル（使い方）

## 申込手順（お客さん用）
1. 教えてもらった **URL** をクリックします。
2. タイトル下にある「**集中講座詳細はこちら**」ボタンを押し、内容を確認して閉じます（ボタンがない場合はお知らせはありません）。
3. **お名前、ふりがな、メールアドレス** を入力します。
4. **参加する会場** をポチッと選びます。
5. **懇親会** に出る場合はチェックを入れます。
6. 最下部の「**申し込む**」ボタンを押します。
7. 「受付完了」と出たら終わりです。メールを確認してください。

## 管理手順（運営用）
1. 管理画面のURL（`/admin/login`）を開きます。
2. パスワードを入れて **ログイン** します。
3. **データの確認**:
    - リストを見て、入金があった人のステータスを「**決済済**」に変えます。
    - 名前の横に黄色い「**⚠ 同姓あり**」が出ていたら、同じ人か確認して、問題なければクリックして「**確認済**」にします。
4. **お知らせの変更**:
    - 画面下の「設定」ボタン（歯車）を押します。
    - 「マスタ管理へのリンク」にある「**申込画面お知らせ設定へ**」をクリックします。
    - 文章を入力して「保存」すると、申込画面にすぐ反映されます。
5. **管理者の管理**:
    - 「管理者設定」メニューから、ログインできるユーザー（ID/PASS）を追加・削除できます。

---

# 5. 【実録】世界中に公開する手順（本番環境への移行）

自分のパソコンで作ったこのシステムを、世界中の人が見れるように「インターネット上に公開」する手順です。
難しいサーバー設定は不要です。「**GitHub（ギットハブ）**」と「**Vercel（バーセル）**」という無料サービスを使います。

### ステップ1：ソースコードの保管（GitHub）
1. [GitHub](https://github.com/) でアカウントを作ります（無料）。
2. このエディタ（Antigravity）の左側にある「**ソース管理**（枝のようなアイコン）」をクリックします。
3. メッセージ欄に「完成」と入力して「**コミット**」ボタンを押します。
4. 「**ブランチの発行**（Publish Branch）」ボタンを押します。これでコードがGitHubという倉庫に保存されます。

### ステップ2：データベースの完全構築（Supabase）
本番環境の箱（データベース）を用意します。以下の手順で**一発で完了**するように準備しました。

1. Supabaseの管理画面を開き、左メニューから **SQL Editor** を開きます。
2. 以下の「完全構築用SQL」を全てコピーして貼り付け、「Run」を押します。

```sql
-- 1. 申込者テーブル
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  input_name TEXT NOT NULL,
  input_email TEXT NOT NULL,
  venue TEXT NOT NULL,
  social_venue TEXT DEFAULT 'none',
  payment_status TEXT DEFAULT 'unpaid',
  is_duplicate_confirmed BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. 設定テーブル
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

-- 3. 管理者テーブル
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 初期管理者 (ID: admin, Pass: admin123)
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON CONFLICT (username) DO NOTHING;

-- 4. 会場マスタ
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 5. ランク（属性）マスタ
CREATE TABLE IF NOT EXISTS ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  base_fee INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- 6. 受講生マスタ
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  furigana TEXT NOT NULL,
  email TEXT,
  rank_id UUID REFERENCES ranks(id),
  generation INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

3. 画面下に「Success」と出れば成功です。
4. これで **ID: `admin`, Password: `admin123`** でログインできるようになります。
   **重要**: ログイン後、すぐに「管理者設定」から自分のメールアドレスを登録してください。（これをしないとパスワードリセットができません）

### ステップ3：公開ボタンを押す（Vercel）
1. [Vercel](https://vercel.com/) に行き、「Sign Up」から **GitHubアカウントでログイン** します。
2. ダッシュボードの「**Add New...**」ボタンを押し、「Project」を選びます。
3. 左側にさっきGitHubに保存した「shingengaku-app」が出てくるので、「**Import**」ボタンを押します。
4. **【最重要】秘密の鍵の引っ越し**:
    - 画面にある「**Environment Variables**（環境変数）」という項目を開きます。
    - ここに、自分のパソコンの `.env` ファイルに書いてある「秘密の鍵」をコピペします。これがないと動きません。
    - 設定する項目：
        - `NEXT_PUBLIC_SUPABASE_URL`: SupabaseのURL
        - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: SupabaseのAPIキー
        - `SUPABASE_SERVICE_ROLE_KEY`: Supabaseの管理者キー
        - `RESEND_API_KEY`: ResendのAPIキー

5. 全て入れたら、下の「**Deploy**（デプロイ）」ボタンを押します。
6. 1〜2分待つと、画面に花吹雪が舞います。これで完了です！

### ステップ3：完成
- 画面に表示された `https://shingengaku-app.vercel.app` のようなURLが、世界中からアクセスできる「本番の住所」です。これを参加者に配ってください。

---

# 6. 【最重要】メールを確実に届ける設定（DNS設定）

システムを公開して「さあ本番！」となった時、何もしないと**申込完了メールが「迷惑メール」に入ったり、そもそも届かなかったりします。**
これはインターネットの世界で「なりすまし」を防ぐためのルールが厳しいためです。

これを防ぐには、**「DNS（ディーエヌエス）」** という「インターネット上の住所録」に、「このシステムは偽メール送信者ではありません」という証明書を書き込む必要があります。

## DNSとは？
インターネット上の住所録です。「shingengaku.com はどこのサーバーにあるか？」といった情報が書かれています。ここに「メールを送る許可」も書き込みます。

## 設定すべき3つのレコード
以下の3つの「おまじない（レコード）」を設定します。

1. **SPF（エスピーエフ）**
    - **意味**: 「このメールサーバーから送るのは、私（ドメインの持ち主）が許可しました」という証明書。
2. **DKIM（ディーキム）**
    - **意味**: 「メールの中身は途中で書き換えられていません」という封印シール。
3. **DMARC（ディーマーク）**
    - **意味**: 「もしSPFやDKIMの証明がない偽メールが届いたら、ゴミ箱に捨ててください」という受信側への指示書。

## 具体的な設定手順

### 1. レコードの情報を入手する
あなたが使っているメール配信サービス（**Resend** や **SendGrid** など）の管理画面を開きます。
「Domain Verification（ドメイン認証）」や「DNS Records」というページに行くと、以下のような情報が表示されます。

- `TXT` レコード: `v=spf1 include:resend.com...`
- `CNAME` レコード: `resend._domainkey...`

これらの文字をコピーします。

### 2. 住所録（DNS設定）を開く
あなたがドメインを買った会社（**お名前.com**、**Xserver**、**GoDaddy**、**Google Domains** など）の管理画面にログインします。
「DNSレコード設定」「ネームサーバー設定」といった項目を探して開きます。

### 3. コピーした文字を貼り付ける
手順1で入手した文字を、住所録の１行として追加します。
- **Type（種類）**: `TXT` や `CNAME` を選びます。
- **Host（ホスト名）**: `@` や `resend` などを入力します。
- **Value（値）**: 手順1の長い文字列を貼り付けます。

これをSPF、DKIM、DMARCすべて分行います。

> [!IMPORTANT]
> **この作業を忘れると、メールはほぼ届きません！** 
> システムが壊れているわけではなく、「怪しいメール」としてブロックされてしまうからです。
> 本番公開前には、必ずこのDNS設定を行ってください。

---

# 7. ゼロからの再構築手順（もし消えてしまったら）

もしパソコンが壊れてデータが消えても、以下の「呪文（プロンプト）」をAIに唱えれば、全く同じシステムを一瞬で作れます。

## AIへの命令履歴（プロンプト集）

新しいAIチャットを開き、以下の 1〜6 を順番にコピペして命令してください。

### 1. 箱を作る
> Next.js (App Router), TypeScript, Tailwind CSS を使って、新しいWebアプリのプロジェクトを作成して。

### 2. データベースの準備
> Supabaseを使ってデータベースを作りたい。`supabase-js` をインストールして、`.env` ファイルで鍵を設定して、接続用のプログラム (`lib/supabaseClient.ts`) を作って。

### 3. 名簿ノート（テーブル）を作る
> Supabaseで以下のSQLを実行してテーブルを作りたいから、SQL文を書いて。
> - `applications` テーブル:
>   - id (uuid), created_at (日時), input_name, input_email, venue, social_venue
>   - payment_status, is_duplicate_confirmed, tags
> - `app_settings` テーブル: key, value
> - `admin_users` テーブル: username, email, password_hash, reset_token, reset_token_expires
> - `venues` テーブル: name, type, sort_order
> - `ranks` テーブル: name, base_fee, sort_order
> - `members` テーブル: name, furigana, email, rank_id (FK), generation

### 4. 申込画面を作る

### 4. 申込画面を作る
> `src/app/page.tsx` に申込フォームを作って。
> - 項目: 名前、メール、会場（ラジオボタン）、懇親会（チェックボックス）。
> - デザイン: スマホでも見やすく、きれいな白ベースで。
> - 機能: 送信ボタンを押したら `/api/apply` にデータを送る。
> - 追加機能: ページを開いた時 `/api/settings` から文章を取ってきて、ボタンを押すとポップアップでお知らせを表示する（文章がない時はボタンも出さない）。

### 5. 裏方のプログラムを作る
> `src/app/api/apply/route.ts` を作って。送られてきたデータを `applications` テーブルに保存して、完了メールを送る処理を書いて。
> `src/app/api/settings/route.ts` を作って。`app_settings` テーブルからお知らせ文章を読み込む処理を書いて。

### 6. 管理画面を作る
> `src/app/admin/dashboard/page.tsx` を作って。
> - `applications` テーブルのデータを一覧表示する。
> - 各行に「編集」ボタンをつけて、データを修正できるようにする。
> - 「CSV出力」ボタンをつける。
> - `src/middleware.ts` を作成して、`/admin` 以下のページをクッキーで保護して（パスワードは環境変数 `ADMIN_PASSWORD`）。ログイン画面 `/admin/login` も作って（`admin_users` テーブル認証）。
> - 名前が同じ人がいたら黄色いアラートを出して、ボタンで「確認済（緑色）」に変えられるようにする。
> - 別のページ `/admin/popup` を作って、お知らせ文章を編集できるようにして。
> - 別のページ `/admin/users` を作って、管理者ユーザーを追加・削除できるようにして。

この通りに命令すれば、魔法のように元通りになります。

---

# 6. バージョン管理と複数環境での開発方針

このシステムでは、複数環境（ローカル開発環境、テスト環境、本番環境など）で開発および運用を行う際、バージョン表示の不整合や混乱を防ぐため、以下の自動管理の仕組みを採用しています。

## バージョンの一元管理 (`package.json`)
- システム全体の公式なバージョン番号は、[package.json](file:///c:/Users/taro/Documents/my-shingengaku-project/shingengaku-app/package.json) の `"version"` プロパティで一元管理されています。
- バージョンを更新する際は、`package.json` のバージョン番号のみを書き換えてコミット・プッシュしてください。ソースコード内の表示用文字列を手動で書き換える必要はありません。

## 環境別の表示自動切替 (ビルドタイムスタンプ)
管理画面（ダッシュボード）の設定モーダル内に表示されるバージョンは、ビルドされた環境に応じて動的に生成されます。

- **ローカル開発環境 (`npm run dev`)**:
  - 表示形式: `v[package.jsonのバージョン] (Build: dev-local)` （例: `v1.0.0 (Build: dev-local)`)
  - ローカル開発中のビルド日時の無駄なズレや更新を防ぎ、ローカル環境で動いていることを明示します。
- **本番・ビルド環境 (`npm run build`)**:
  - 表示形式: `v[package.jsonのバージョン] (Build: YYYY-MM-DD-hhmm)` （例: `v1.0.0 (Build: 2026-06-28-1845)`)
  - ビルド完了時点の日本時間 (JST) のタイムスタンプが自動的に埋め込まれます。これにより、本番環境に適用されているビルドがいつデプロイされたものかを一目で確認できます。

## 開発時の注意点
- バージョン変更時には必ず `package.json` を更新してください。
- `tsconfig.json` にて `resolveJsonModule: true` が有効になっているため、プログラム内で `package.json` からのバージョン値のインポートが型安全に保たれます。

