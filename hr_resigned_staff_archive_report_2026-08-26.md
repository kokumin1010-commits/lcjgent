# HR 離職者の安全削除（可逆アーカイブ）完了報告

**作成者：Manus AI**

**対象：** [`https://lcjmall.com/master/hr`](https://lcjmall.com/master/hr)

**本番コード：** `be1e1a6864f45c417611c73260592b03ae794640`

離職者をHR人物目录から削除できる機能をRailway本番へ反映した。ここでの削除は物理削除ではなく、**履歴を保ったまま通常目录から非表示にする可逆アーカイブ**である。旧TiDBには一切接続していない。[1] [5]

## 本番状態

本番健康確認では、`staff`は44人、通常目录に44人、退職確認済みは7人、アーカイブ済みは0人である。ユーザーが名前を指定していないため、今回こちらから人物を自動削除していない。7人は画面から個別にアーカイブできる状態になった。[1]

| 項目 | 本番値 |
| --- | ---: |
| staff総数 | 44 |
| 通常人物目录 | 44 |
| 退職確認済み・通常目录内 | 7 |
| アーカイブ済み | 0 |
| アーカイブ監査イベント | 0 |
| 初期セットアップ | success |

## 操作方法

`スタッフ一覧`でステータスを`退職確認済`に絞り、対象者を開く。`目录から削除`を押し、必要なら理由を記入して`目录から削除（復元可能）`を実行する。対象者は通常目录と通常統計から消えるが、日報・タスク・給与・Tier・評価・連絡先・退職日・監査IDは保持される。

画面上部の`アーカイブ箱`を押すと非表示にした離職者を確認できる。対象者を開き、`目录へ復元`を押すと通常目录へ戻る。復元しても自動的に在籍中にはせず、退職日と`inactive`状態を維持する。復職させる場合は通常目录へ戻した後に別途`復職`を実行する。[2] [3]

## データ保護

アーカイブ処理は`staff.archivedAt`、`archivedBy`、`archiveReason`だけを更新し、`staff`行、`report_staff`リンク、その他の業務行を削除しない。11種類の参照を個別監査し、11/11で「参照IDを保持」「アーカイブ前に参照件数を監査ログへ記録」を確認した。[3] [4]

| 参照領域 | 保持対象 |
| --- | --- |
| タスク | `tasks.staffId`、`task_staff.staffId` |
| 日報 | `report_staff.linkedStaffId`、`reports.reportStaffId`、`report_followups.reportStaffId` |
| ブランド担当 | `brand_lcj_staff.reportStaffId` |
| AI・チャット | `chat_report_sessions.staffId`、`staff_ai_profiles.staffId` |
| LINE・採用・排期 | `line_users.staffId`、`recruitment_follow_records.staff_id`、`staff_schedules.staffId` |

旧スタッフ管理画面にあった物理削除の本番動作も安全アーカイブへ変更し、退職日のない在籍者には削除ボタンを表示しない。**完全削除はHR画面では提供しない。** 不可逆な完全削除が必要な場合だけ、対象者と影響範囲を指定した上で別途明示確認が必要である。[2] [5]

## バックアップと本番検証

構造変更前後の暗号化バックアップは両方成功した。前置バックアップはID 42（329表、9,405行）、後置バックアップはID 43（330表、9,406行）であり、エラーはない。[1]

| 検証 | 結果 |
| --- | --- |
| HRルート | HTTP 200 |
| 新HR分割JS | HTTP 200、JavaScript MIME、immutable |
| 旧スタッフ管理分割JS | HTTP 200、JavaScript MIME、immutable |
| 存在しないasset | HTTP 404、`no-store` |
| 新UI文字列 | `アーカイブ箱`、`目录から削除`、`目录へ復元`を本番分割JSで確認 |
| 静的完全性 | 全チェックpass、11参照すべて計数 |

認証済み画面の視覚確認はサンドボックスブラウザがログイン画面へ転送されたため、公開健康API、実際の本番分割JS、ルート/asset HTTP検査で検証した。既存HR結合テストはローカルに`DATABASE_URL`がないため実行不能だったが、サービス/画面の対象ビルドは成功し、Railway本番セットアップとDB健康確認も成功している。[1] [2] [3]

> **表示が古い場合：** ブラウザで一度`Ctrl+Shift+R`を実行する。

## References

[1]: ./production_hr_archive_verification_summary.json "Railway本番HRアーカイブ健康・バックアップ検証"
[2]: ./production_hr_archive_verify/marker_snippets.txt "本番HR/スタッフ管理分割JSの新機能文字列"
[3]: ./hr_staff_archive_static_integrity.json "HRアーカイブ静的完全性検証"
[4]: ./hr_staff_archive_reference_integrity.csv "11種類の歴史参照並列監査"
[5]: ./hr_resigned_staff_archive_rules_2026-08-26.md "離職者安全削除・復元ルール"
[6]: https://github.com/kokumin1010-commits/lcjgent/commit/be1e1a6864f45c417611c73260592b03ae794640 "本番デプロイコミット"
