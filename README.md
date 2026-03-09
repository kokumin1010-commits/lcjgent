# LCJ Mall (lcjmall.com)

LCJ Mall のソースコードリポジトリです。

## 技術スタック

- **フロントエンド**: React + Vite + TypeScript + TailwindCSS
- **バックエンド**: Express (Node.js)
- **データベース**: TiDB Cloud (Serverless / MySQL互換)
- **ストレージ**: Cloudflare R2
- **ホスティング**: Railway
- **決済**: Stripe

## バックアップ

> **全自動バックアップが稼働中です。**
>
> バックアップリポジトリ: [kyogokuryu/lcjgent-backup](https://github.com/kyogokuryu/lcjgent-backup)

毎日日本時間AM3:00にGitHub Actionsで自動実行されます。

| バックアップ対象 | 保存先 | 方法 |
|---------------|-------|------|
| データベース（136テーブル） | GitHub（lcjgent-backup） | mysqldump → gzip圧縮、7世代保持 |
| R2ストレージ（10.5GB） | Cloudflare R2（prd-kyo-backup バケット） | rclone sync（差分同期） |
| R2ファイル一覧 | GitHub（lcjgent-backup） | テキスト保存、30世代保持 |
| 環境変数（24個） | GitHub（lcjgent-backup） | AES-256暗号化、30世代保持 |

## デプロイ

Railway にデプロイされています。`main` ブランチへのプッシュで自動デプロイが実行されます。
