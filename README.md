# Mirage

[Scramjet](https://github.com/MercuryWorkshop/scramjet) をベースにしたWebプロキシです。

## 起動方法

    npm install
    npm start        # http://localhost:8080

Node 20 以上が必要です。トランスポートは Epoxy over Wisp で、同じサーバーの `/wisp/` から配信します。

## デプロイ

Node と WebSocket のアップグレードに対応したホスティング(Render、Railway、Fly.io、VPS など)が必要です。
Wisp サーバーが必須のため、GitHub Pages では動作しません。

## 操作

- Ctrl+T: 新しいタブ
- Ctrl+W: タブを閉じる
- Ctrl+L: アドレスバーにフォーカス

## 補足

Scramjet の API はバージョンによって変わります。インストール後にプロキシが起動しない場合は、
`public/app.js`、`public/sw.js`、`server.mjs` を公式の MercuryWorkshop/scramjet-app テンプレートと見比べて、
コントローラーやトランスポートの設定を調整してください。
