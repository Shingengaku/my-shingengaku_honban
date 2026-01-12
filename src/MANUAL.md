# 神言学・集中講座申込み管理システム 完全構築・運用マニュアル

このドキュメントは、本システムをゼロから構築し、運用し、さらに将来的に再構築（AIによる再現）を行うための完全なガイドです。
専門知識がない方でも、手順通りに進めることで環境構築から本番リリースまでを行えるように記述しています。

---

## 0. 本システムで使用するツール・API等の一覧表

本システムを動かすために必要な道具（ツール）と外部サービス（API）の一覧です。これらがないとシステムは動きません。

| ツール・サービス名 | 種類 | 用途（何のために使うのか） | これがないとどうなるか | アクセスURL (ログインはこちら) |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** (ノード・ジェイエス) | 実行環境 | パソコン上でプログラミング言語(JavaScript)を動かすための土台です。 | システム自体が動きません。 | [ダウンロード](https://nodejs.org/ja/) (推奨版LTSを選択) |
| **Visual Studio Code** (VS Code) | 編集ソフト | プログラムコードを書いたり、修正したりするためのエディタです。 | コードの編集が非常に困難になります。 | [ダウンロード](https://code.visualstudio.com/) |
| **Git** (ギット) | 管理ツール | プログラムの変更履歴を保存し、インターネット上の保管場所(GitHub等)とやり取りします。 | 過去の状態に戻したり、コードを保存・共有できなくなります。| [ダウンロード](https://git-scm.com/) |
| **Supabase** (スパベース) | データベース | 申込みデータ、会員情報、マスタ設定などを保存しておく「データの箱」です。 | 申込み情報や会員情報などを保存・管理できません。 | [ログイン画面](https://supabase.com/dashboard) |
| **Resend** (リセンド) | メール配信API | システムから自動で「申込み完了メール」などを送信するためのサービスです。 | 申込み完了メールや決済リンクの案内メールが届きません。 | [ログイン画面](https://resend.com/login) |
| **Vercel** (バーセル) | 公開サーバー | 作ったシステムをインターネット上に公開し、誰でも見られるようにする場所です。 | 世界中の人がWebサイトとしてアクセスできるようになりません（自分のPC内だけで終わります）。 | [ログイン画面](https://vercel.com/login) |

### 0.5. 各ツールの役割と関係（イメージ図）

「なんでこんなにたくさんのツールを使うの？」と思うかもしれません。漫画や小説を書くことに例えると、それぞれの役割は以下のようになります。

1.  **VS Code ＝ 「作業机と原稿用紙」**
    *   ここで実際に文字（プログラム）を書きます。作業をする場所です。
2.  **Git (ギット) ＝ 「セーブ機能付きのカメラ」**
    *   作業の途中で「ここまでOK」という状態でパシャリと写真を撮ります（コミット）。失敗しても、写真を撮った時点まで時間を戻せます。
3.  **GitHub (ギットハブ) ＝ 「インターネット上の書庫・倉庫」**
    *   撮った写真をインターネット上に保存しておく場所です。パソコンが壊れても、ここにデータがあるので安心です。
4.  **Vercel (バーセル) ＝ 「自動で出版してくれる出版社」**
    *   GitHubという「書庫」に新しい原稿が届くと、それを自動で見つけて「本（Webサイト）」として世の中に公開してくれます。

**【作業の流れ】**
1.  **VS Code** で書いて保存する。
2.  **Git** で記録して（コミット）、**GitHub** に送る（プッシュ）。
3.  **Vercel** が勝手にそれを拾って、世界中に公開する。

---

## ① ローカル環境の構築方法と、本番環境への移行手順

あなたのパソコン（ローカル環境）でシステムを動かせるようにし、最終的にインターネット上（本番環境）で使えるようにする手順です。

### 前提条件
*   Windows または Mac のパソコンがあること。
*   インターネットに繋がっていること。

### 手順1: 必要なソフトのインストール
1.  上記の「ダウンロード」リンクから、**Node.js**, **VS Code**, **Git** をダウンロードしてインストールしてください。すべて初期設定のままで大丈夫です。

### 手順2: ソースコードの準備
1.  適当なフォルダ（例: デスクトップに `project` フォルダ）を作ります。
2.  VS Codeを開き、「ファイル」メニューから「フォルダを開く」で、そのフォルダを開きます。
3.  VS Codeの上部メニュー「ターミナル」→「新しいターミナル」を開きます。
4.  以下のコマンドを入力してEnterキーを押します。（※ソースコードがGitHubにある場合）
    `git clone <リポジトリのURL>`
    ※もし手元にzipファイルがある場合は、それを解凍して中身をこのフォルダに置いてください。

### 手順3: 必要な部品（ライブラリ）のダウンロード
ターミナルで以下のコマンドを入力し、Enterキーを押します。
```bash
npm install
```
*   **理由**: `package.json` という設計図に書かれた「必要な部品」をインターネットから全部ダウンロードしてくるためです。

### 手順4: データベースの準備 (Supabase)
**【重要】データベースは「開発用」と「本番用」で2つ作ります**
テストでデータを消そうとして間違って本番データを消す事故を防ぐためです。

| 環境 | プロジェクト名の例（おすすめ） | 役割 | データの場所 |
| :--- | :--- | :--- | :--- |
| **開発用** | **`Shingengaku-Dev`** | テストデータを自由に入れて、機能を作るための実験場。 | Supabase上の「Dev」プロジェクト |
| **本番用** | **`Shingengaku-Prod`** | 実際のお客様が入力する大切なデータを保存する場所。 | Supabase上の「Prod」プロジェクト |

**作業手順 (まずは開発用を作る)**
1.  [Supabaseダッシュボード](https://supabase.com/dashboard) にログインし、「New Project」を押します。
2.  プロジェクト名に **`Shingengaku-Dev`** と入力し、パスワードを決めて「Create new project」を押します。
3.  数分待つと作成完了します。
4.  左メニューの **「Settings (歯車アイコン)」→「API」** を開きます。
5.  ここに表示される以下の2つが、システムを接続するための「鍵」です。
    *   **Project URL** (例: `https://xyz...supabase.co`)
    *   **Project API keys (anon public)** (例: `eyJ...`)

### 手順5: パソコンとデータベースを繋ぐ (.env.local)
1.  VS Codeの左側のファイル一覧で、何もないところを右クリックし「新しいファイル」を選びます。
2.  ファイル名を `.env.local` （ドット・エンブ・ドット・ローカル）にします。
3.  以下の内容をコピーして貼り付け、`***************` の部分を **手順4で取得したURLとキー** に書き換えます。
    ```env
    NEXT_PUBLIC_SUPABASE_URL=*************** (Project URL)
    SUPABASE_SERVICE_ROLE_KEY=*************** (次の行にある service_role secret キー ※注意: anonではなくservice_role推奨ですが、管理者機能を使うためです)
    resend_API_KEY=*************** (ResendのAPI Key)
    ```
    *   ※ `SUPABASE_SERVICE_ROLE_KEY` は、SupabaseのAPI設定画面の `service_role secret` (Revealを押すと見える) を使ってください。管理者権限が必要なためです。

### 手順6: データベースの箱を作る (SQL実行)
1.  Supabaseのダッシュボード左メニューから **「SQL Editor」** を開きます。
2.  以下のSQLを貼り付けて「Run」を押します。これで必要なテーブルが全て作成されます。

    ```sql
    -- 1. 管理者ユーザーテーブル
    create table if not exists admin_users (
      id uuid default gen_random_uuid() primary key,
      username text unique not null,
      password_hash text not null,
      email text
    );
    -- 2. パスワードリセット用
    create table if not exists password_resets (
      id uuid default gen_random_uuid() primary key,
      token text not null,
      expires_at timestamptz not null,
      used boolean default false
    );
    -- 3. 期マスタ
    create table if not exists terms (
      id serial primary key,
      name text not null, sort_order integer default 0, created_at timestamptz default now()
    );
    -- 4. 属性マスタ
    create table if not exists ranks (
      id serial primary key,
      name text not null, base_fee integer default 0, sort_order integer default 0, created_at timestamptz default now()
    );
    -- 5. 会場マスタ
    create table if not exists venues (
      id serial primary key,
      name text not null, type text not null check (type in ('lecture', 'social')), sort_order integer default 0, created_at timestamptz default now()
    );
    -- 6. 会員テーブル
    create table if not exists members (
      id serial primary key,
      name text not null, furigana text, email text, term_id integer references terms(id), rank_id integer references ranks(id), created_at timestamptz default now()
    );
    -- 7. 申込みテーブル
    create table if not exists applications (
      id uuid default gen_random_uuid() primary key,
      created_at timestamptz default now(),
      input_name text, input_furigana text, input_email text, total_amount integer,
      payment_status text check (payment_status in ('unpaid', 'paid', 'cancelled')),
      payment_key text, venue text, social_venue text, applied_rank_name text,
      environment text, remarks text, matched_member_id integer references members(id),
      tags text[], is_duplicate_confirmed boolean default false, cc_email text, bcc_email text
    );
    -- 8. 設定保存用
    create table if not exists app_settings (
      id integer primary key, data jsonb
    );
    insert into app_settings (id, data) values (1, '{}') on conflict do nothing;
    ```

### 手順7: ローカルでの動作確認
1.  VS Codeのターミナルで `npm run dev` と入力してEnterを押します。
2.  ブラウザで `http://localhost:3000` にアクセスし、画面が表示されれば成功です。

---

### 手順8: 本番環境への移行 (Vercel)

いよいよインターネット上に公開します。この作業は少し慎重に行いましょう。

**1. 本番用データベースの準備 (Supabase)**

1.  **新しいプロジェクトを作る**:
    *   [Supabaseダッシュボード](https://supabase.com/dashboard) に行き、緑色の **「New Project」** ボタンを押します。
    *   Organization（組織）を選びます（通常は自分の名前）。
    *   **Name**: **`Shingengaku-Prod`** と入力します。
    *   **Database Password**: 自分で決めた強力なパスワードを入力します（忘れないようにメモしてください）。
    *   **Region**: `Tokyo` (または近い場所) を選びます。
    *   「Create new project」を押して、数分待ちます。

2.  **テーブルを作成する**:
    *   作成された `Shingengaku-Prod` の画面左メニューから **「SQL Editor」** アイコン（紙のようなマーク）をクリックします。
    *   以前、開発環境で実行したのと同じ **手順6のSQL** をすべて貼り付けます。
    *   右下の **「Run」** ボタンを押します。「Success」と出ればOKです。

3.  **本番用の鍵（API Key）を取得する**:
    *   左メニュー下の **「Settings (歯車アイコン)」** を押し、その中の **「API」** を選びます。
    *   以下の3つの情報をメモ帳などにコピーしておきます。
        1.  **Project URL** (`https://...supabase.co` というURL)
        2.  **anon public** キー (`eyJ...` で始まる長い文字列)
        3.  **service_role secret** キー (「Reveal」を押すと表示されます。`eyJ...` で始まるさらに重要な文字列)

**2. Vercelで公開する**

1.  **プロジェクトのインポート**:
    *   [Vercelダッシュボード](https://vercel.com/dashboard) に行き、右上の **「Add New...」** → **「Project」** を選びます。
    *   「Import Git Repository」という画面で、自分のアカウントの横にある **「Adjust GitHub App Permissions」** （または表示されているリポジトリ一覧から `shingengaku-app`）を探し、**「Import」** ボタンを押します。

2.  **環境変数の設定 (一番重要です！)**:
    *   「Configure Project」という画面になります。
    *   **「Environment Variables」** という項目をクリックして開きます。
    *   ここに、先ほどメモした **本番用(Prod)の鍵** などを1つずつ入力して「Add」を押していきます。

    | Key (左側の箱に入力) | Value (右側の箱に入力) |
    | :--- | :--- |
    | `NEXT_PUBLIC_SUPABASE_URL` | 先ほど控えた **本番用(Prod)の Project URL** |
    | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 先ほど控えた **本番用(Prod)の anon public キー** |
    | `SUPABASE_SERVICE_ROLE_KEY` | 先ほど控えた **本番用(Prod)の service_role secret キー** |
    | `RESEND_API_KEY` | `re_` から始まる **ResendのAPIキー** (開発時と同じでOK) |

    *   ※入力間違いがないかよく確認してください。

3.  **デプロイ実行**:
    *   すべての変数を追加したら、下の **「Deploy」** ボタンを押します。
    *   花吹雪が舞ったら成功です！ 表示された画像のリンクをクリックすると、あなたのシステムが世界中に公開されています。

**3. 管理者ユーザーの作成 (最初だけやる作業)**
*   公開された本番サイトにはまだ誰も登録されていません。
*   本番用Supabase (`Shingengaku-Prod`) のSQL Editorで、以下のSQLを実行して、最初の管理者を作ってください（パスワードはハッシュ化されたものが必要です）。
    ```sql
    insert into admin_users (username, password_hash) values ('admin', 'ここにハッシュ化したパスワードを入れる');
    ```
    (※ハッシュ化ツールなどで `password123` をSHA-256変換した文字を入れてください)

---

### 手順9: プログラムの修正が発生した場合の対応手順

システムの運用中に「文字を変えたい」「新機能を追加したい」などが起きた場合の対応手順です。

**1. ローカル環境で修正・テストする**
まずはいきなり本番を変えず、自分のパソコン（ローカル）で直します。

1.  VS Codeで該当のファイルを編集し、保存します。
2.  ターミナルで `npm run dev` が動いていることを確認し、ブラウザ (`http://localhost:3000`) で動作確認します。
    *   エラーが出ないか？
    *   思った通りの修正になっているか？
    *   他の機能が壊れていないか？（最低限の確認）

**2. 本番環境へ反映する（デプロイ）**
テストでOKだったら、本番へ反映します。作業は「保存して送る」だけです。

1.  **コミット**:
    *   VS Code左側の「ソース管理」アイコンをクリック。
    *   メッセージ欄に「〇〇を修正」と入力して「コミット」ボタンを押す。
2.  **プッシュ**:
    *   「同期」または「プッシュ」ボタンを押して、GitHubへ送信する。
3.  **自動反映待ち**:
    *   VercelがGitHubの更新を検知し、数分以内に本番サイトを自動更新してくれます。

**3. 【重要】データベースの変更が発生した場合**
これが一番注意が必要です。
プログラム（コード）だけでなく、**「テーブルに項目を増やした」「新しいテーブルを作った」** などの変更をした場合は、プログラムを反映するだけではエラーになります。

*   **対応手順**:
    *   ローカル(Dev)で実行した「変更用SQL」と同じものを、**本番用Supabase (Shingengaku-Prod)** のSQL Editorでも実行してください。
    *   例：「`members` テーブルに `phone` カラムを追加した」場合
        ```sql
        alter table members add column phone text;
        ```
        これをDev環境で試したあと、Prod環境でも必ず実行します。

> [!WARNING]
> 本番用データベースを触るときは、間違ってデータを消さないように細心の注意を払ってください。

---

## ② システム仕様の完全な一覧化

### 1. 一般ユーザー向け機能（申込みフォーム）
*   **動的フォーム生成**: 管理画面で設定された商品（金額・会場・属性）に基づいて、申込みフォームが動的に変わる。
*   **期・属性の選択**: データベースのマスタに基づき、「期（数字・文字列両対応）」と「属性」を選択できる。
*   **金額自動計算**: 選択された属性、会場（講義・懇親会）の組み合わせから、正しい合計金額を自動計算する。
*   **会員特定ロジック**: 入力された「名前」と「期」をもとに、会員名簿データベースと照合し、既存会員かどうかを特定する。
    *   一致した場合：その会員IDを紐付ける。
    *   一致しない場合：新規またはゲストとして扱う。
*   **重複チェック**: 同じメールアドレスでの申込みがあった場合、警告を表示する（または管理画面でフラグを立てる）。
*   **自動返信メール**: 申込み完了時、ユーザーと管理者（CC/BCC）に確認メールを即時送信する。
    *   メール内には、申込み内容に応じた「決済リンクURL」が自動挿入される。

### 2. 管理者向け機能
*   **ダッシュボード**: 申込み一覧を表示・検索・フィルタリング（決済状況、会場、期などで絞り込み）。
*   **詳細編集**: 申込み内容（金額、会場など）を後から修正できる。修正時、確認メールの再送も可能。
*   **CSVエクスポート**: 申込みデータをCSV形式でダウンロードできる。
    *   **ソート順**: 属性順（特進→...） > 期順 > 五十音順 の優先順位で並び替えられる。
*   **マスタ管理（ドラッグ＆ドロップ対応）**:
    *   **期マスタ**: 期の追加・削除・名称変更・並び替え。
    *   **属性マスタ**: ランクの追加・削除・基本金額設定・並び替え。
    *   **会場マスタ**: 講義/懇親会会場の追加・削除・並び替え。
    *   **商品マスタ**: 決済リンクを含む商品の定義。並び替え対応。
*   **会員管理**: 会員名簿の閲覧、CSVインポート/エクスポートにより一括登録が可能。
*   **管理者ログイン**: ID/パスワードによる認証。セッション管理。

---

## ③ 再構築可能な「言葉によるトランザクション」

このシステムをAI（アンチグラビティ等）を使ってゼロから再構築するための「命令書」です。
新しいAIとのチャットに、以下のTransaction 1から順に貼り付けてください。

### Transaction 1: プロジェクトの初期化
```text
あなたは熟練したNext.jsエンジニアです。以下の構成で新しいWebアプリケーションを作成してください。

【技術スタック】
- フレームワーク: Next.js 14+ (App Router)
- 言語: TypeScript
- スタイリング: Tailwind CSS
- バックエンド/DB: Supabase (JavaScript Client)
- その他のライブラリ: resend (メール送信), @dnd-kit/core (ドラッグアンドドロップ)

まず、`npx create-next-app@latest` を使用してプロジェクトを初期化し、上記のライブラリをインストールしてください。
その後、`.env.local` ファイルを作成し、NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY を設定する準備をしてください（値は空で構いません）。
```

### Transaction 2: データベース設計と構築
```text
Supabaseのデータベーススキーマを設計します。以下のテーブルを作成するSQLを書いてください。

1. `admin_users`: 管理者ログイン用（username, password_hash）
2. `terms`: 期マスタ（name, sort_order）。sort_orderで並び替え可能にする。
3. `ranks`: 属性マスタ（name, base_fee, sort_order）。
4. `venues`: 会場マスタ（name, type='lecture'|'social', sort_order）。
5. `members`: 会員名簿（name, furigana, email, term_id(FK), rank_id(FK)）。
6. `applications`: 申込みデータ（input_name, input_email, total_amount, payment_status, venue, social_venue, applied_rank_name, matched_member_id(FK), tags配列, created_at）。

また、Supabase接続用のクライアントコード (`src/lib/supabaseAdmin.ts`) を作成してください。管理者権限（Service Role）を使用します。
```

### Transaction 3: 管理画面（マスタ管理）の実装
```text
管理者用のマスタ管理画面を実装してください。
以下の4つの画面を作り、それぞれでデータの追加・削除・編集・ドラッグアンドドロップによる並び替えができるようにしてください。

1. `/admin/terms`: 期マスタ管理
2. `/admin/ranks`: 属性マスタ管理
3. `/admin/venues`: 会場マスタ管理
4. `/admin/products`: 商品（決済リンク）設定管理。これはJSONまたはDB推奨。

UIライブラリには `@dnd-kit` を使用し、直感的に「⋮⋮」アイコンをドラッグして順序を入れ替えられるようにしてください。
並び替え後は「保存」ボタンで順序を確定し、API経由で `sort_order` カラムを一括更新してください。
```

### Transaction 4: 申込みフォーム（フロントエンド）の実装
```text
一般ユーザー向けの申込みフォーム (`/`) を実装してください。

【要件】
1. APIから「期」「属性」「会場」のマスタデータを取得し、プルダウンの選択肢として表示する。
    - 並び順はマスタで設定された `sort_order` に従うこと。
2. ユーザーが「名前」「期」を入力した時点で、APIを通じて会員判定を行う。
3. 選択された「属性」「講義会場」「懇親会会場」の組み合わせに基づいて、合計金額をリアルタイムに計算し表示する。
4. 「申込み」ボタン押下時に `/api/apply` へデータを送信する。
```

### Transaction 5: 申込み処理APIとメール送信の実装
```text
バックエンドAPI (`/api/apply`) を実装してください。

【処理フロー】
1. 受け取った「名前」「期」を使って `members` テーブルを検索し、既存会員がいればIDを紐付ける。
2. `applications` テーブルに申込みデータを保存する。
3. 重複チェックを行い（同メアド等）、重複があれば `tags` にフラグを立てる。
4. `Resend` ライブラリを使用して、ユーザーと管理者に完了メールを送信する。
    - メール本文には、マスタ設定に基づいた正しい「決済リンクURL」・「合計金額」・「会場情報」を埋め込むこと。
```

### Transaction 6: 管理者ダッシュボードの実装
```text
管理者が申込み状況を確認できるダッシュボード (`/admin/dashboard`) を作成してください。

【機能】
1. 申込みデータの一覧表示（ページネーション不要、全件表示）。
2. フィルタ機能：未決済/決済済、会場別、期別などで絞り込み可能にする。
3. CSVダウンロード機能：表示中のデータをCSV形式で出力する。
    - ソート順は「属性順（重要度順） > 期順 > 名前順」とすること。
4. 詳細モーダル：各申込みをクリックすると内容を編集できる。メール再送やキャンセル処理もここから行う。
```
