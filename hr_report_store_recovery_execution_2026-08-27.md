# 人事・報告社員・店舗責任者の証拠復旧実行記録

## 実行日時と対象

2026-08-27 04:03 UTC、本番Railway MySQLに対して、管理者限定`staff.manualLossRecoveryExecute`を実行した。旧TiDBへの接続は0件である。復旧候補は、成功済み暗号化backup、破壊的起動回復の実行window、現在行の`updatedAt`を三者照合して自動抽出した。

| 領域 | 安全候補 | 実行結果 |
|---|---:|---|
| 人事社員 | 1件 | 復旧済み |
| 報告社員 | 0件 | 変更なし |
| 店舗責任者 | 0件 | 変更なし |
| 曖昧差分 | 0件 | 自動復元なし |

安全候補は`staff.id=14`（王铸）の`employmentType`と`employmentTypeEvidence`で、破壊的HR36起動回復直前の暗号化backup **run 88 / reason `pre-hr-dir-v2`** に存在したverified値へ戻した。復旧は1 transactionで行い、`manualRevisionAt`と`manualRevisionBy`を設定して以後の起動回復から保護した。

復旧前後に暗号化DB backupを実行し、復旧後backupは **run 91 / reason `post-manual-loss-recovery` / tableCount 363 / rowCount 95,569**、backup healthは`healthy=true`、schedulerは稼働中である。復旧直後のread-only監査でも`staff.id=14`の`manualRevisionAt=2026-08-27T04:03:40Z`と操作者markerを確認した。

## 店舗責任者について

Git履歴と本番時刻から、2026-08-26 09:28 UTCの旧`gmvHrRecovery`が既存店舗profileを上書きしたことは確認できた。一方、その実行直前の`managed_stores`を含む読み取り可能な暗号化backup objectは現在の保持objectから取得できず、`store_profile_audit_logs`も0件だった。このため、責任者名を推測して自動復元することは行っていない。

現行GMV回復SQLは既に責任者・連絡先・画像・notesを更新しない非破壊方式であり、今回さらに`managed_stores.manualRevisionAt/manualRevisionBy`、更新行1件検証、既存profile auditを追加した。今後の手入力は刷新・再ログイン・デプロイ再起動後も保護される。

## 冪等性

復旧後の再previewは安全候補0件となり、二度目の実行は書込みを行わず終了した。根拠のない社員情報、責任者名、給与、売上は作成していない。
