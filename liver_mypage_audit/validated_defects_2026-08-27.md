# ライバーマイページ検証済み欠陥

## 確定した事実

「給与反映用データ」は `client/src/pages/LiverMypage.tsx` だけで `LiverPayrollBasisPanel` を import／render している。`server/liverRouter.ts` の `payrollBasis` と `server/liverPayrollRecovery.ts` は本人確認済みトークンに限定され、管理側の給与・監査基礎として保持する。本人ページからは import と render のみ削除する。

並列監査の「payrollBasis API が存在しない」「generateLineLinkCode が存在しない」は誤報である。両方とも `server/liverRouter.ts` に存在し、liver JWT を検証している。

一方、以下は現行コードで直接確認できた実欠陥である。

| 優先度 | 欠陥 | 直接証拠 | 修正原則 |
|---|---|---|---|
| P0 | 配信履歴削除が publicProcedure で、認証・所有権確認なし | `server/routers.ts` `liverManagement.deleteLivestream` | 管理者または当該ライバー本人だけを許可し、対象配信の `liverId` とJWTを照合する |
| P0 | CSV配信インポートが任意の `liverId` を受け付け、認証・所有権確認なし | `server/routers.ts` `csvImport.importLivestreams` | 管理者またはJWT本人だけを許可し、保存 `liverId` はJWTから確定する |
| P0 | CSVインポート履歴取得／削除が任意IDでpublic | `csvImport.getImportHistory`, `deleteImportHistory` | 本人所有履歴または管理者だけに限定する |
| P0 | 配信スクショアップロード／URL更新がpublicで、所有権・MIME・サイズ検証が不足 | `liverManagement.uploadScreenshot`, `updateLivestreamScreenshot` | JWT本人／管理者認証、対象配信所有権、8MB以下JPEG/PNG/WebP、base64実サイズを検証する |
| P1 | UI削除パスワードがクライアントに `lcj` とハードコード | `LiverMypage.tsx` 削除確認dialog | 偽の秘密を削除し、本人JWT＋所有権＋明示確認に置き換える |
| P1 | 一部mutation成功後に `window.location.reload()` を使用 | CSV import/history | 対象query invalidate/refetchに置き換え、入力・結果を保持してエラーを個別表示する |

## 保持すべきもの

管理側の給与基礎、給与監査、契約率、時給、締日、配信DB、TikTok実績、対照証拠は削除しない。復元CSV由来の読み取り専用配信も削除対象にしない。管理者画面からの正規操作は維持し、ライバー本人操作だけをJWTと所有権で厳密化する。

## データ原則

旧TiDBは使用しない。実データを作成しない。書き込みテストはtransaction rollbackまたはEXPLAIN／静的契約検証で行い、本番にテスト行を残さない。
