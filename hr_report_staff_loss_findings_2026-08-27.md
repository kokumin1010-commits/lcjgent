# 人事管理・報告社員 刷新後消失の初期監査

## 本番保全時点

2026-08-27T03:22:34Zに本番APIを管理者sessionで読み取り専用監査した。Railway MySQL上は`staff` 36件、`report_staff` 49件、統合表示32件、archive表示17件だった。`staff`と`report_staff`のlinked field driftは35件存在する。監査snapshot SHA-256は`0f2b4a3bee2c9e29215c11d7175da4eb49fdbcdf4468573cb03cd18ac3128d94`。

## 確定した上書き時刻

`hr_directory_recovery_runs`の最新成功は2026-08-27T03:02:10Z。pre-backup ID 88、post-backup ID 89。36件の`staff.updatedAt`は03:02:02Z、関連`report_staff.updatedAt`は03:02:03Zへ一斉更新されている。起動directory回復が全証拠行を再upsertした証拠である。

回復実行前は`employmentTypeUnverifiedCount=35`、期待値36と1件だけdriftしていた。この1件の手入力変更を理由に全36件を再upsertし、`name`、`email`、`emailEvidenceStatus`、directory/evidence列、aliases、employmentTypeEvidence、isActive、notes、およびlinked `report_staff`の`name`、`country`、`isActive`を証拠datasetへ戻した。これが「保存したが刷新・再起動後に消える」主要原因である。

## 両マスタの非対称保存

`staff.update`は`staff`だけを更新し、linked `report_staff`のname/countryを更新しない。`reportStaff.update`は`report_staff`だけを更新し、linked `staff`を更新しない。HR画面の刷新queryは`report_staff`を起点に`staff`をleft joinするため、片側だけの変更は刷新後に古い値または不一致として見える。

`reportStaff.create`はlinkedStaffIdがない場合、入力名から`@lcj.placeholder`メールを合成してactive `staff`を作成する。これは証拠のないメール・在職状態を生成するため、恒久修正対象である。

## 安全方針

旧TiDBは使用しない。まず本番snapshot、directory pre/post backup、監査可能なAPI状態から有証拠変更だけを復旧する。推測による氏名・メール・給与・雇用状態の再作成はしない。起動回復は欠損作成・証拠列補完だけに制限し、手入力済み業務列を上書きしない。staff/report_staffの更新は一transactionで両側整合と監査eventを保存する。

## 店舗責任者の追加監査

本番read-only監査では5店舗中、現在責任者が残るのはLCJチャンネルの`王铸`のみ。Dr.Abla、KYOGOKU JAPAN、buzzdrop、labo celleは責任者・副責任者ともNULLで、4店舗の`updatedAt`は2026-08-26T09:28:46Zへ一斉更新されている。現行`store_profile_audit_logs`は0件であり、責任者入力はaudit導入前だったため現行DBの監査表からは復元できない。

Git履歴で、2026-08-26T10:23:33Zの非破壊修正`fbf65025`より前の`gmvHrRecovery.restoreStores`は、既存5店舗を起動回復するたびに`operatorName=?`、`operatorId=NULL`、`operator2Id=NULL`、`operator2Name=NULL`へ強制更新していた。したがって09:28:46Zの一斉更新時に手入力責任者が上書きされたことがコードと本番時刻で一致する。現行コードは空欄だけ補完する方式へ修正済みだが、失われた値そのものは`pre-gmv-hr-recovery`暗号化backupから回復する必要がある。

店舗責任者は、当時の`pre-gmv-hr-recovery` backupを読み取り専用でcurrent stateと比較し、責任者列に証拠値があり、現在値がNULLで、該当行が回復runで一斉更新された場合だけ復元する。氏名を推測しない。
