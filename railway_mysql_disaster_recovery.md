# lcjgent Railway MySQL バックアップ・障害復旧ランブック

**作成日:** 2026-08-25  
**対象:** Railway project `lcjagent` / environment `production` / services `lcjgent`, `MySQL`  
**本番DB:** Railway MySQL 9.4、Private Network専用  
**作成者:** Manus AI

## 1. 本番構成

lcjgentは、Railway MySQLの内部接続変数 `${{ MySQL.MYSQL_URL }}` を `DATABASE_URL` として参照する。ログイン、店舗登録、LINE、商品、注文、スケジュールなどの書込みは、アプリ操作時にRailway MySQLへリアルタイム保存される。旧TiDBは本番接続にもバックアップ処理にも使用しない。

| 項目 | 最終設定 |
|---|---|
| アプリサービス | `lcjgent` |
| DBサービス | `MySQL` |
| DB内部ホスト | `mysql.railway.internal` |
| DB接続 | `${{ MySQL.MYSQL_URL }}` のサービス間参照 |
| 永続化 | `mysql-volume` |
| 外部Public Access | 削除済み。アプリはPrivate Networkのみを使用 |
| 初回移行 | ローカル復旧バックアップ290テーブル／1,493行との差分0 |
| 追加復旧後 | 294テーブル／2,141行（バックアップ管理行を含む） |
| 一時検証URL | 本番コードから削除済み |
| 一度限り復元URL | 配信サーバー停止・本番コード削除済み |

## 2. 恒久バックアップ設計

Railway Volumeだけに依存せず、アプリ内の決定的なバックアップ処理がRailway MySQLをPrivate Network経由で読み取り、既存オブジェクトストレージへ暗号化保存する。バックアップは毎日 **03:15 JST** に実行され、成功・失敗・件数・チェックサム・保存先キーはRailway MySQLの `db_backup_runs` に記録される。

| レイヤー | 実装 | 保持 |
|---|---|---:|
| 日次 | `private/db-backups/daily/` | 最新14世代 |
| 週次 | 毎週日曜および初回安全スナップショットを `private/db-backups/weekly/` に保存 | 最新8世代 |
| 月次 | 毎月1日および初回安全スナップショットを `private/db-backups/monthly/` に保存 | 最新12世代 |
| 起動時保護 | 直近成功から20時間以上経過、または検証済み初回バックアップ未作成時に実行 | 上記各世代へ統合 |
| 手元の災害復旧ZIP | 2026-08-25復旧時点の全テーブルJSON | Railway外で安全に保管 |

バックアップはJSON化後にgzip圧縮し、**AES-256-GCM**で認証付き暗号化する。鍵はRailwayの秘密変数からscryptで導出し、ファイル内へ保存しない。アップロード前には実際に復号、gzip展開、JSON解析を行い、テーブル数・行数を元データと照合する。アップロード後にはS3互換APIの`HeadObject`で保存サイズを検証し、その後だけ成功記録を確定する。[2]

> **初回検証結果:** 2026-08-25 18:01 JSTに `startup-verified-v2` が成功した。294テーブル、2,141行、暗号化ファイル179,520 bytesを日次・週次・月次の3保存先へ作成し、エラーは0件だった。

## 3. 通常運用

日常のデータ更新はRailway MySQLへリアルタイム保存される。バックアップはデータ更新処理ではなく、障害発生時に過去時点へ戻すための独立した復旧点である。日次バックアップの最大復旧時点目標は通常24時間以内となる。

大型リリース、DBマイグレーション、大量CSV投入、データ一括更新の前には、通常スケジュールを待たず、Railwayサービスを再起動して起動時安全バックアップを作るか、RailwayのVolumeバックアップを追加で作成する。Railway Volumeバックアップを利用する場合、バックアップは同一project・environmentに対して復元されるため、復元前に対象を再確認する。[1]

DBのPublic Accessは常時追加しない。外部ツール接続が必要な場合はRailwayの安全な接続方法を優先し、一時Public Accessを作成した場合は作業直後にTCP Proxyを削除する。[3]

## 4. 暗号化オフサイトバックアップの確認

`db_backup_runs` の最新行で、`status='success'`、`errorMessage IS NULL`、`tableCount`と`rowCount`が妥当であることを確認する。`objectKeys`には日次・週次・月次の保存先が記録される。失敗時はRailwayログの `[DatabaseBackup] failed` を確認する。

バックアップオブジェクトは顧客情報、認証ハッシュ、業務データを含むため、公開URL化しない。暗号化鍵とバックアップファイルは別経路で管理し、鍵をGitHubへコミットしない。

## 5. 暗号化バックアップの復号・完全性検証

安全な作業端末で対象ファイルを取得し、Railway本番と同じ `DB_BACKUP_ENCRYPTION_KEY`、または作成時に使った `JWT_SECRET` を環境変数へ設定する。その後、次を実行する。

```bash
node scripts/database-backup-restore.mjs /secure/path/lcjgent-YYYY-MM-DDTHH-MM-SS.json.gz.enc --verify-only
```

このコマンドは、AES-GCM認証、復号、gzip展開、JSON形式、テーブル数、行数を検証する。`ok: true`が出ないファイルは復元に使わない。

## 6. 新しいRailway MySQLへの復元

復元先は原則として**新規で空のMySQLサービス**を使用する。既存本番DBへ直接上書きしない。

```bash
export DATABASE_URL='mysql://USER:PASSWORD@HOST:PORT/DATABASE'
node scripts/database-backup-restore.mjs /secure/path/lcjgent-YYYY-MM-DDTHH-MM-SS.json.gz.enc --apply
```

復元ツールは、対象DBに既存テーブルがある場合は既定で停止する。`--allow-nonempty`は、重複を無視する必要性を検証済みの場合だけ使用する。復元後は全テーブルを数え、バックアップmanifestの件数と照合する。

## 7. Railway Volumeバックアップからの復元

Railwayネイティブバックアップを併用する場合は、MySQLサービスの **Backups** から対象時刻を選んで復元する。Railwayはバックアップを同一project・environmentへ復元し、新Volumeをstageする。元Volumeは即時削除せず、差分確認後に切り替える。[1]

復元後は、`DATABASE_URL` が `${{ MySQL.MYSQL_URL }}` を参照していることを確認する。旧TiDB URLへ戻してはならない。

## 8. 復元後の検証基準

| 検証対象 | 最低基準 |
|---|---:|
| スキーマ | 294テーブル以上 |
| 管理者ユーザー | `ryuhairartist@gmail.com` が存在 |
| ライバー | 10件 |
| 店舗 | 5件 |
| LINEユーザー | 26件以上 |
| LINEグループ | 39件 |
| LINEポイント残高 | 19件、残高合計9,450 |
| MALL商品 | 20件 |
| スケジュール | 31件 |
| 追加回収タスク | 1件 |
| ブログメタデータ | 10件 |
| バックアップ履歴 | 最新実行が`success`、エラーなし |

本番では `/login`、`/master/store-management`、`/master/line`、`/mall/products`、`/s` を確認する。管理画面は未認証時にログインへ遷移し、Railwayログに `Database not available`、`Failed query`、テーブル不存在エラーがないことを確認する。

## 9. 既知の復元限界

2026-08-25以前の完全バックアップが存在しなかったため、元DB操作履歴に行内容が残っていないタスク、チャット、スタッフ専用レコード、店舗Excelアップロード履歴、ブログ本文、商品画像本体などは再構築できない。Railway MySQL移行後に新規作成されるデータはリアルタイム保存され、以後は本ランブックの暗号化多世代バックアップ対象となる。

## References

[1]: https://docs.railway.com/volumes/backups "Railway Docs — Backups"  
[2]: https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html "Amazon S3 API — HeadObject"  
[3]: https://docs.railway.com/databases/mysql "Railway Docs — MySQL"
