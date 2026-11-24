# Mirage

[Scramjet](https://github.com/MercuryWorkshop/scramjet) をベースにした、Chrome風UIのWebプロキシです。

## 起動方法

    npm install
    npm start        # http://localhost:8080

Node 20 以上が必要です。トランスポートは libcurl over Wisp で、同じサーバーの `/wisp/` から配信します。

## 機能

- タブ、アドレスバー(編集中は書き換えられません)、Google検索
- ブックマーク(アドレスバーの星ボタン)と、右側のサイドバー(開いたままタブ操作ができます)
- 履歴(サイドバーの History。個別削除と全削除)
- 設定: テーマ、アクセントカラー、ページフィルター(10種類、強さ調整。Alt+P で切り替え)
- アカウント(Supabase): ブックマーク、アイコン画像、ユーザーネーム、設定、履歴を保存

アカウントなしでも、ブックマークと設定はこのブラウザに保存されます。履歴はログイン中のみ保存されます。

## Supabase のセットアップ

1. [Supabase](https://supabase.com) でプロジェクトを作成します。
2. SQL Editor で `supabase/schema.sql` の中身をすべて実行します。テーブル、RLS、アイコン用ストレージが作られます。
3. 「Project Settings」→「API」から、Project URL と anon (public) キーを控えます。service_role キーは絶対に使わないでください。
4. 起動するサーバーに環境変数を設定します(Render なら「Environment」)。

        SUPABASE_URL=https://xxxxxxxx.supabase.co
        SUPABASE_ANON_KEY=eyJ...

5. メール確認が不要なら、Supabase の「Authentication」→「Providers」→「Email」で「Confirm email」をオフにします。オンのままなら、登録後に確認メールのリンクを開いてからログインしてください。

環境変数が未設定の場合、アカウント機能は無効になり、ローカル保存だけで動きます。

## デプロイ

Node と WebSocket のアップグレードに対応したホスティング(Render、Railway、Fly.io、VPS など)が必要です。
Wisp サーバーが必須のため、GitHub Pages では動作しません。

## 操作

- Ctrl+T: 新しいタブ
- Ctrl+W: タブを閉じる
- Ctrl+L: アドレスバーにフォーカス
- Alt+P: ページフィルターの切り替え
- Esc: アドレスバーの編集を取り消し

## 補足

- Scramjet の API はバージョンによって変わります。起動しない場合は、公式の MercuryWorkshop/scramjet-app と見比べてください。
- プロキシ経由のサイトは Mirage と同じオリジンで動きます。ログイン情報(セッション)がブラウザに保存されるため、不特定多数に公開する場合はこの点に注意してください。
- ページフィルターは見た目を見づらくする機能で、物理的なプライバシーフィルムのように「視野角で見えなくなる」ものではありません。
