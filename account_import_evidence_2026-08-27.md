# LCJ アカウント管理 Excel 取込証拠

## 原本

- ファイル: `pasted_file_06GgiQ_LCJ経営管理表_经营用账户.xlsx`
- SHA-256: `78c837ae232f76fee8061257906b86af3a36afb19a586f3311065c2bfacecb18`
- Sheet: `经营用账户`
- 物理行数: 48
- HYPERLINKセル: 20件、20件すべてURL解決済み
- 非表示列: なし

## 証拠分類

決定論的parserで、見出し・空行・親子関係・URL・ID・パスワード有無・備考を検査した。パスワードおよび完全な識別子は本証拠ファイルに記載しない。

| 分類 | 件数 | 保存先 |
|---|---:|---|
| 真のプラットフォーム資格情報 | 22 | `platform_accounts` |
| オフィス・倉庫の住所連絡先 | 4 | `contact_info` |
| 資格情報を持たない参照リンク | 4 | `account_reference_links` |
| 見出し・空関係行等 | 11 | DBへ登録しない（previewに理由表示） |

同一資格情報として統合した行は、WPSの4/8行とLCJ Inquiryメールの12/44行。日本オフィス30/31行、杭州オフィス32/33行は日中表記を一つの連絡先へ統合した。LCJシステムログイン行18は`platform_accounts`へ重複登録せず、システムユーザー管理への参照リンクとして保持する。ブランド資料・Shop ID・SNSプロフィールは資格情報として生成しない。

## 本番事前照合

`https://lcjmall.com`へExcel内の既存LCJ管理者資格情報をメモリ内だけで使用してread-only照合した。

| 項目 | 事前値 |
|---|---:|
| `platform_accounts`表示件数 | 0 |
| `contact_info`表示件数 | 542 |
| 今回の4住所候補と既存連絡先の正規化一致 | 0 |

監査JSON: `account_import_production_state.json`、parser preview: `account_workbook_parser_preview.json`。

## 保存・権限方針

- 新規・更新passwordはAES-256-GCM versioned envelope（`enc:v1:`）として保存し、DBへ平文保存しない。
- 暗号鍵は`ACCOUNT_CREDENTIAL_ENCRYPTION_KEY`、未設定時は既存`JWT_SECRET`から用途分離SHA-256で導出する。
- APIは`/master/account-management`のRBAC view/editをサーバー側でも強制する。
- Excelは5MB以下のXLSX、ZIP signature、列構成を検証する。
- previewのSHA-256とimport時SHA-256が一致した場合だけ書込む。
- source keyのunique indexで再取込を冪等化する。
- import前後に暗号化DB backupを実行する。
- Excel原本やpasswordをGitへcommitしない。
