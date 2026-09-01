# Work Log

## 2026-05-20: 商品管理機能改善 - 多級カテゴリ + バリアント管理

### 実施内容
1. **スキーマ修正** (`drizzle/schema.ts`)
   - `mallProducts`テーブルに `subcategoryId`, `videoUrl`, `videoKey` カラム追加
   - `mallProductVariants`テーブル新規作成（SKU/バリアント管理用）

2. **API追加** (`server/routers.ts`, `server/db.ts`)
   - `mall.getSubcategories` - 親カテゴリIDでサブカテゴリを取得
   - `mall.getVariants` - 商品IDでバリアント一覧を取得
   - `mall.createVariant` - バリアント作成
   - `mall.updateVariant` - バリアント更新
   - `mall.deleteVariant` - バリアント削除
   - `mall.createProduct` / `mall.updateProduct` に `subcategoryId`, `videoUrl`, `videoKey` 対応追加

3. **フロントエンドUI** (`client/src/pages/ProductManagement.tsx`)
   - 2段階カテゴリ選択UI（親カテゴリ → サブカテゴリ）
   - バリアント管理セクション（VariantSection コンポーネント）
   - バリアントの追加・編集・削除UI

4. **DBマイグレーション**（手動SQL実行）
   - `mall_product_variants`テーブル作成
   - `mall_products`に`subcategoryId`, `videoUrl`, `videoKey`カラム追加
   - カラム名はDrizzleスキーマに合わせてcamelCase

### 検証結果
- ✅ 本番API（lcjmall.com）で全エンドポイント動作確認済み
- ✅ 既存機能（getProducts: 227件）に影響なし
- ✅ バリアントCRUD操作正常動作
- ✅ フロントエンド正常アクセス（HTTP 200）

### 注意事項
- `mall_categories`テーブルには元々`parentId`カラムが存在していた
- isActiveカラムはENUM('yes','no')型（BOOLEANではない）

## 2026-08-27: `/liver/mypage` 全登録・権限・保存フロー監査（本番反映前）

### 根本原因と修正内容

本人マイページに不要な「給与反映用データ」パネルが表示されていた一方、配信CRUD、配信CSV、スクリーンショット、重点商品、AI Coach、商品CSVの一部procedureが任意の`liverId`・`livestreamId`・`roomId`を受け取り、主播JWT本人または管理画面セッションとの所有権照合を十分に行っていなかった。また、商品CSVは既存商品削除と新規挿入が非トランザクションで、S3 URL保存は文字列SQLと「最新履歴」検索に依存していた。これらを、共通の本人／管理者認証、配信所有権、AI Coachルーム所有権に統一した。

本人画面から給与パネルだけを除去し、`server/liverRouter.ts`の`payrollBasis`、`server/liverPayrollRecovery.ts`、管理側給与・監査経路は保持した。配信削除のクライアント固定パスワード`lcj`は廃止し、JWT本人確認と明示確認へ置換した。CSV取込後の全画面reloadは局所refetchへ変更した。

AI Coachは、ルーム、タイトル、削除、メッセージ、送信、歓迎メッセージ、自動質問を本人または管理者に限定し、roomIdとliverIdの一致も検査する。管理統計、会話、成長、送信集計、Brain状態、知識再生成、個別メモリ操作は管理画面認証を必須化した。歓迎メッセージの既存判定は全ルーム横断からルーム単位へ修正した。

商品CSVは配信所有者または管理者だけに限定し、1〜5,000行、商品名500文字、CSV/XLS/XLSX、base64形式、8MB、Excel実体シグネチャを検査する。S3キーは`csv-imports/livers/<owner>/livestreams/<stream>/...`へ分離した。商品置換はDBトランザクション化し、履歴fileUrlは作成直後の正確なhistoryIdへパラメータ化SQLで保存する。履歴の読取・削除も配信所有権を検証する。旧`/livers/by-name/:name`は認証ルートへ変更し、月度商品明細APIも本人または管理者に限定した。

スクリーンショットはJPEG/PNG/WebP、正しいbase64、8MB以下に加え、JPEG/PNG/WebPの実体シグネチャと拡張子の一致を検査する。配信CSVの日付は全行をDB処理前にJSTとして厳密検証し、2月30日などの不可能日付を`BAD_REQUEST`で拒否する。

### 本番前検証

| 検証項目 | 結果 |
|---|---|
| 静的完全性監査 | 51/51合格 |
| DB非接続createCaller回帰 | 17/17合格 |
| 未認証の本人・商品CSV・AI Coach・月度商品API | すべて`UNAUTHORIZED` |
| 不正画像拡張子・base64・実体偽装 | すべて`BAD_REQUEST` |
| 商品CSV 5,001行、AIタイトル空、AIメッセージ4,001文字 | すべて`BAD_REQUEST` |
| 配信CSVの不可能JST日付 | `BAD_REQUEST` |
| 対象フロント5エントリおよびサーバーentryのesbuild | 成功 |
| `git diff --check` | 合格 |
| `pnpm check` | 150秒で既存大規模型検査が終了せずSIGTERM。対象esbuildと実行回帰で代替確認 |

この段階では本番DBへの試験行作成、削除、売上・給与・商品データの捏造は一切行っていない。旧Manus TiDBへの接続も行っていない。

### 追加発見: 未展開の分析URLプレースホルダー

初回デプロイ後の実ブラウザ回帰で、`client/index.html`の`%VITE_ANALYTICS_ENDPOINT%/umami`がRailway環境で置換されず、深いルートでは`/liver/%VITE_ANALYTICS_ENDPOINT%/umami`等の相対URLとして要求され、502とconsole errorを発生させていることを確認した。静的scriptを削除し、`client/src/main.tsx`で`VITE_ANALYTICS_ENDPOINT`と`VITE_ANALYTICS_WEBSITE_ID`が両方存在し、URLがHTTPS（localhostのみHTTP許可）の場合だけUmami scriptを絶対URLで一度追加する方式へ変更した。

環境変数を未設定にしたVite開発サーバーで`/liver/mypage`、`/liver/profile`、`/liver/record`、`/liver/schedule`、`/livers/by-name/:name`をChromiumで描画し、5/5でログイン画面へ誘導、root描画、分析URL通信0件、page error 0件を確認した。フルVite buildは既知の大規模プロジェクトSIGTERMとなったため、main.tsx定向esbuild、Vite HTML変換、Chromium実描画で代替検証した。

### 2026-08-27 `/master/morning-meeting` LCJ 9条鉄律・日中朗読対応

朝会ページの既存`SpeechRecognition`言語state（`ja-JP` / `zh-CN`）を再利用し、LCJ 9条鉄律を朝会録音の前に表示する朗読カードを追加した。日本語選択時は承認済みの短い朗読版「LCJ 9つの行動原則」9項目、中文選択時はユーザー提供の中国語原文「LCJ 9条铁律」9項目だけを表示する。選択言語はページ見出し、録音開始、録音中、文字起こし、処理中、当日サマリー、履歴、主要操作ラベルにも連動し、録音中の切替は既存音声認識engineの`lang`更新とrestartを維持した。

静的回帰は17/17合格。MorningMeetingとAppの定向esbuildに成功。Chromium実画面回帰では日本語9件、中文9件、各選択状態、録音開始文言、旧言語の非表示を確認し、console error・page error・failed requestはすべて0件だった。画面回帰のtRPCは読み取り専用mockを使用し、本番データへの書込みは行っていない。

### 2026-08-27 朝会「個人9条朗読＋チーム早会」二段階録音

`/master/morning-meeting`を、全員が自分のアカウントで9条を個別朗読して本人別音声を登録するSTEP 1と、その後に既存の業務共有・文字起こし・AI要約を行うSTEP 2へ拡張した。個人朗読は`morning_principle_recitations`へ日付×認証userで1日1件、S3 keyは日付/user IDで分離して保存する。任意user IDは入力で受けず、氏名・email・职位は認証userと在職staffの一致から記録する。個人音声の再生は本人またはadminだけに限定した。

チーム朝会は既存`morning_meetings`を保持し、個人朗読とは別記録のままとした。従来のWeb Speech要約経路でも録音BlobをS3保存し、ブラウザ文字認識が空の場合は保存済み音声をWhisperへ送るフォールバックを追加した。更新・削除は作成者またはadminへ限定し、音声はMIME、base64、WebM/Ogg/MP4実体signature、個人20MB・チーム60MB上限を検証する。

画面は折り畳みを使わず、個人朗読とチーム早会の録音ボタンを9条より上へ並べ、9条は3列×3行で常時全表示する。管理者の当日一覧では在職者名の横に职位を表示し、例示確認では柴芳妮の横に「库存」を表示した。静的30/30、DB非接続tRPC 9/9、主要6エントリesbuild、日中Chromium回帰が合格。全体tscは既知の高メモリ制約でSIGTERMとなったため、定向ビルドと実行回帰で検証した。ローカル画面試験は読み取りmockのみで、本番DBやS3へのテスト書込みは行っていない。

### 2026-08-27 朝会録音 Permissions-Policy hotfix

個人朗読＋チーム早会の本番HTTP検証で、共通レスポンスヘッダーが`Permissions-Policy: camera=(self), microphone=(), geolocation=()`となり、画面上の録音ボタンは見えてもブラウザがマイク取得を拒否する根本原因を発見した。`microphone=(self)`へ最小変更し、同一オリジンのLCJ MALLだけマイク利用を許可した。cameraはself限定、geolocationは無効、X-Frame-Options・CSP・COOP等の既存制限は維持した。静的回帰は32/32、server定向ビルド、差分検査を通過した。

### 2026-08-27 日報カードの氏名横职位表示

`/master/reports`の日報カードで、氏名横に職種・担当が表示されない問題を修正した。`report.list`の全一覧経路（全件、スタッフ別、条件検索）でlinked HR staffの`position`と`department`を返し、画面はposition→departmentの順で既存登録値を表示する。HRリンクや职位が未登録でも、ユーザーが明示した柴芳妮の担当「库存」は証拠付きfallbackとして表示する。他の氏名へは適用しない。

ローカルChromiumで柴芳妮（柴芳妮）の直横に小型の「库存」バッジが表示され、国籍、日付、業務内容、編集、削除、AIアドバイスの既存導線がすべて残ることを確認した。console error、page error、failed requestは0で、全tRPCを読み取りmockしたためDBへのテスト書込みは0件だった。Reports、db、routerの定向esbuildと`git diff --check`も合格した。

### 2026-08-27 朝会を全員必須の本人別2録音へ変更
ユーザー確認により、従来の`STEP 1 / STEP 2`という順序表現と共有チーム録音の前提を撤廃した。全社員が毎日それぞれ完了する並列2項目として、`9条朗読録音`と`早会録音`を本人別に保存する。既存`morning_principle_recitations`は非破壊upgradeし、`recordingType`、`targetKey`、代理操作者監査、文字起こし、AI要約、失敗理由を追加した。一意制約は日付×対象者×録音種別へ変更し、既存朗読行はstaffIdがあれば`staff:<id>`、なければ`user:<id>`として`principles`記録へ引き継ぐ。旧`morning_meetings`履歴は削除せず保持した。
一般社員はログインemailに紐づく本人staffへ固定し、管理者だけ在職社員名をタップして代理登録できる。保存時は対象者と実際の操作者を分離し、`operatorUserId/name/email`を監査記録へ残す。音声再生は対象本人または管理者だけに限定した。本人別早会録音はS3へ対象者・日付・種別ごとに分離保存し、Web Speech文字列があれば補正、なければ保存音声をWhisperへ送り、その後AI要約を生成する。処理失敗はfailedとして記録し、同日再試行できる。
画面から`STEP 1 / STEP 2`を完全に除去し、両カードを「全員必須」と表示した。左上へ現在のスタッフ名・职位・全員の2項目完了数を表示し、管理者は社員名タップで対象者を切り替えられる。各氏名の横に9条・朝会それぞれの完了状態を表示し、録音中は対象者切替をロックする。3秒未満は停止ボタンを無効化して録音を継続し、「3秒以上録音してください / 请至少录音3秒」と表示する。Zod内部JSONは利用者へ表示しない。
検証は静的43/43、DB非接続createCaller 14/14、対象4ファイルTypeScript抽出エラー0、主要5エントリesbuild、日中Chromium視覚回帰、fake microphone UI回帰がすべて合格した。fake microphoneでは両録音とも開始直後の停止無効、3秒後の停止有効、2つの保存mutation、内部JSON非表示、console/page/request error 0を確認した。すべての画面・マイク試験はtRPC mockを使用し、本番DB・S3へのテスト書込みは0件だった。

## 2026-08-27 — 朝会を「本人別9条＋1日1チーム早会＋3履歴」へ最終統合

- ユーザーの最終判断により、9条朗読は社員本人ごとに個別保存し、チーム早会は全員が同じ会議を重複録音せず、主持人が参加者を選択して1日1会議・1音声・1文字起こし・1AI要約として保存する運用へ変更した。
- `morning_meetings`へ旧行を変更しないnullable `dailyKey`、`recordingKind`、`participantCount`、`participantSnapshot`を追加し、`dailyKey` uniqueで新しいチーム早会だけ1日1件を保証する非破壊migrationを追加した。旧共有朝会は`recordingKind=legacy`、`dailyKey=NULL`のまま保持する。
- 新API `saveDailyTeamMeeting`は、1〜200名の重複しない在職staffだけを許可し、主持人本人を自動参加、音声MIME・実体・60MB・3秒を検証し、S3を`morning-team-meetings/<date>/...`へ分離保存する。文字起こし、語義修正、AI要約、失敗status、主持人auditを維持した。
- 当日APIは本人別9条完了とチーム朝会参加snapshotを別々に返す。一般社員の個人朗読状態は本人だけ、管理者は全員の9条完了を確認・代理登録できる。チーム朝会参加者候補は在職staff一覧から選択する。
- 履歴は`9条朗読記録`、`チーム朝会記録`、`旧朝会記録`の3タブへ完全分離した。個人9条履歴は一般社員本人または管理者、チーム早会履歴は新`daily_team`だけ、旧履歴は旧共有朝会と移行期間の旧本人別早会を保持する。氏名・日付・内容検索、時長、音声、参加者、文字起こし、AI要約を表示する。
- UIではSTEP表記を使わず、個人9条と1日1チーム早会を並列表示。主持人は全員選択・選択解除・氏名タップで参加者を設定し、チーム早会を1回だけ録音する。9条9件は常時表示し、日中切替を維持した。
- 回帰結果: 静的49/49、DB非接続createCaller 17/17、日中Chromium、参加者選択、3履歴、個人朗読01:03表示、fake microphone両録音、3秒制御、主要6エントリbuildが成功。ブラウザconsole/page/request errorは0、テストによる本番DB/S3書込みは0。

## 2026-08-27 — LCJ経営管理表 Excel → アカウント管理の証拠分類・安全取込

ユーザー提供XLSX（SHA-256 `78c837ae232f76fee8061257906b86af3a36afb19a586f3311065c2bfacecb18`）を、秘密値をログへ出さずに全48行監査した。HYPERLINK 20件を解決し、資格情報22件、住所・連絡先4件、資格情報なし参照リンク4件、見出し・空関係行等11件へ決定論的に分類した。WPS 4/8行とInquiryメール12/44行は同一資格情報として統合し、LABO CELLEのTikTok Shop資格情報とメール資格情報は別管理、LCJシステムログイン行はsystem user重複を避け参照リンクへ分離した。

本番事前read-only照合では`platform_accounts=0`、`contact_info=542`、今回4住所候補との正規化一致0件、管理者RBAC full accessを確認した。`platform_accounts`/`contact_info`へsource key・原本hash・source rowsを追加し、資格情報なしURL用`account_reference_links`、取込監査用`account_workbook_imports`を冪等migrationで追加する。passwordはAES-256-GCM versioned envelopeでDB暗号化し、一覧返却時だけ復号する。既存147件recovery projectionは引き続き資格情報一覧から除外する。

UIへ管理者用「Excel取込」を追加し、5MB以下XLSX、ZIP実体、SHA preview確認後だけ取込む。previewはIDをmaskし、password値を返さない。取込は事前暗号化DB backup、1 transaction、source key uniqueによる冪等upsert、事後backupを行い、参照リンクは第三tabに分離する。server-sideでも`/master/account-management`のRBAC view/editを強制した。

検証結果: static 46/46、DB非接続runtime 22/22、Chromium UI pass（console/page/request error 0、import mutation 0、本番書込0）、今回対象TypeScript error 0、主要6エントリesbuild成功。原本XLSXはGitへ追加しない。

### 本番取込結果

コミット`4c6b3b0f`のRailwayデプロイ成功後、Excel原本SHAを再確認して本番Railway MySQLへ取込んだ。初回は資格情報22件、住所・連絡先4件、参照リンク4件をinsertし、excluded 11行を監査記録へ保存した。取込前後で暗号化DB backupを実行し、最新成功理由は`post-account-workbook-import`、schedulerStarted=true、retentionはdaily 14 / weekly 8 / monthly 12、latest failureなしだった。

同じ原本を再実行すると`alreadyImported=true`でデータ件数は変化せず、account 22、source contact 4、reference 4を維持した。passwordあり20件は全20件がDB暗号化済み、passwordなし2件は認証コード方式等の原本どおりである。本番認証済みChromiumではaccount row 22、暗号化badge 20、4住所、4参照リンク、password値非表示、console/page/request error 0を確認した。未認証のlistAccounts/listContacts/listReferences/listWorkbookImports/preview/importはすべて401 `UNAUTHORIZED`。旧TiDBは使用していない。

## 2026-08-27 — 人事・報告社員・店舗責任者の刷新後消失を恒久修正

本番read-only監査とGit履歴から、`hr36DirectoryRecovery`が起動時drift判定により36人の既存`staff`/`report_staff`を再upsertし、手入力済みfieldを復旧datasetへ戻していたことを確認した。2026-08-27 03:02 UTCの本番directory recoveryでは、少なくとも手入力済み`employmentTypeEvidence=verified`が`unverified`へ戻り、報告社員側も起動同期値で上書きされていた。店舗責任者は旧`gmvHrRecovery`が既存5店舗をupsertする際に責任者・連絡先・profileをNULL/復旧値へ戻す実装だったことをGit履歴で確認した。現行GMV回復SQLは既に非破壊化済みだが、昨日入力分は保護導入前に消失していた可能性が高く、現在のprofile auditは0件だったため現行DBだけでは責任者名を推測復元しない。

`staff`、`report_staff`、`managed_stores`へ`manualRevisionAt/manualRevisionBy`を非破壊migrationで追加し、手動変更を永続保護する。人事・報告社員のcreate/update、退職、復職、avatar、tier/給与、紐付け、reportStaff→staff作成はDrizzle transactionと共通serviceへ統一し、両tableをatomicに保存、0件/複数linkを拒否、変更前後を`manual_data_change_events`へ記録する。店舗作成・更新・soft deleteは既存`store_profile_audit_logs`を維持しつつmanual markerとaffectedRows=1検証を追加した。

`hr36DirectoryRecovery`はmanualRevision済み行の氏名・email・国・雇用区分・状態・notes等を一切上書きせず、証拠lineage metadataと欠損linkだけを維持する。暗号化backup readerは成功run、S3/R2 object key、暗号化checksumを検証し、日次objectがprune済みなら同runの週次/月次copyへfallbackする。`manualDataLossRecovery`は管理者限定preview/execute、明示confirmation、GET_LOCK、pre/post暗号化backup、1 transaction、before/after eventを持ち、verified backupに存在し破壊的起動windowで変化した安全候補だけを復旧し、曖昧な国・status・linkは報告のみで自動復元しない。

検証は静的40/40、DB非接続createCaller 10/10、主要11エントリesbuild 11/11、`git diff --check`合格。TypeScript全体検査は既知の高メモリ終了（exit 134）となったが、対象fileの抽出errorは0件。旧TiDB接続、本番テストデータ作成、根拠のない社員・責任者名生成は実施していない。

本番previewでは暗号化backup run 88（`pre-hr-dir-v2`）と03:02 UTCの破壊的回復windowが一致した安全候補1件（staff.id 14、employmentType/evidence）のみを抽出した。管理者限定confirmationで1 transaction復旧し、manual markerを設定、復旧後backup run 91（`post-manual-loss-recovery`、363 tables / 95,569 rows、healthy=true）を取得した。再previewは候補0件で、二重書込みはない。店舗責任者は旧GMV回復による上書き時刻を確定したが、直前の`managed_stores`を含む読み取り可能backup objectとprofile auditが残っていないため、責任者名を推測復元しなかった。

## 2026-08-27 — account workbook表示fieldのcredential断片をsanitize

取込証拠ZIP作成前の秘密値scanで、Excel行26のpassword値がparserの列ずれにより`accountName`の部分文字列へ入る可能性を検出した。password field自体はDBでAES-256-GCM暗号化され画面でもmaskedだったが、名称などの非機密fieldにcredential断片を残さないため、parser最終出力で全password集合を用いてaccountName、URL、responsible、tags、notes、contact、reference、excluded labelをsanitizeする恒久修正を追加した。安全な名称を復元できない場合はplatform名＋`アカウント`へ置換する。

通常取込の同一SHA冪等動作は維持し、管理者edit権限・SHA一致・pre/post backupを必須とする明示`repairExisting`だけを追加した。本番で既存22資格情報、4 source contact、4 referenceを1 transactionで再upsertし、insert 0 / account update 22 / contact update 4 / reference update 4を確認した。再実行は`alreadyImported=true`で無変更。passwordあり20件は全件暗号化を維持し、repair後backup run 93（`post-account-workbook-import`、363 tables / 95,834 rows、healthy=true）を取得した。

回帰は静的50/50、DB非接続runtime 24/24、parser preview 22/4/4/11、証拠14ファイルのcredential値scan 0件、認証済み本番画面22 rows・20暗号化badge・4 references・password表示0、console/page/request error 0を確認した。旧TiDB、本番テスト行、平文credentialログは使用していない。

## 2026-08-27 — staff-scheduleで当日休息者を在職名簿へ常時表示

`/staff-schedule`の日次一覧が`staffSchedule.getByDateRange`の保存済み`staff_schedules`行だけを描画していたため、在職中でも当日の排班が未登録の社員は一覧から消えていた。`staff.listActive`の在職名簿と選択日の保存済み排班をstaffIdでunionし、排班がない社員を画面内だけのread-only行（負のsynthetic id、`isRestDay=true`、`[休息]`）として表示するよう修正した。synthetic休息行はcreate/update/delete APIへ渡さず、削除buttonも表示しないため、Railway MySQLへ偽の休息排班を書き込まない。既存の保存済み`[请假]`行は赤い请假表示、実勤務は従来の早班・晚班表示を維持し、休息はslate表示と`☕ 休息`で区別した。

日次見出しは「本日の在職スタッフ」とし、中国・日本・その他/国未設定の全groupで出勤・请假・休息の人数を分けて表示する。既存の名前/部門検索、国tab、跟播、早班・晚班・请假filterに加えて休息filterを追加し、追加dialogと保存済み排班の削除操作は維持した。週次・月次は従来どおり保存済み排班の集計・表示のみで、今回のactive名簿unionはユーザーが休息者を確認する日次一覧に限定した。

回帰は静的20/20、`git diff --check`、StaffSchedule target esbuild、Chromium mock画面で出勤・请假・休息・国未設定の全4名表示、休息行の削除button 0、请假/休息の色分け、休息filter、请假filter、名前検索、国tab、追加dialog、console/page/request error 0、mutation request 0を確認した。本番read-only監査では2026-08-27 JSTの在職26名、保存済み排班7名、请假0名、予定未登録の派生休息19名を確認し、production writeは0件。旧TiDB接続、本番テスト行、synthetic行のDB保存は実施していない。

初回deploy後の未認証Chromium確認で、tRPCは401保護されてデータは返さない一方、standalone routeの外枠と追加buttonが表示される既存guard不足を検出した。`useAuth`のloading/認証guardを追加し、未認証時は元のpath/queryを`redirect`へ保持して`/login`へ遷移する。在職名簿、RBAC、ライバー一覧、排班queryは認証user確定まで`enabled=false`とし、未認証local Chromiumでは`auth.me`以外のstaff/排班query 0、元URL付きlogin redirect、console/page/request error 0を確認した。

## 2026-08-27 — 达人BD管理与AI改善系统（本番反映前）

达人部门过去主要依靠每天零散进度表和聊天截图管理联络，无法把同一达人的多次联络、实际话术、未回复原因、产品卖点、达人利益和下一步动作形成统一证据链。回复率低时也缺少确定性的漏斗口径，容易把“100次发送”与“100位去重达人”混在一起，AI更没有可靠的真实记录可分析。为解决根本问题，新增`/master/influencer-bd`独立业务域，不把达人混入品牌、主播或员工主数据，也不创建任何虚假达人、虚假回复或虚假合作结果。

系统新增推广方案、达人库、每日联络进度、聊天截图、AI分析、分析反馈、设置和不可变审计共8张Railway MySQL表。结构升级在server listen前执行，缺表时必须先完成`pre-influencer-bd-v1`加密备份，创建表后验证users、staff、brands、brand_products、reports、managed_stores计数完全不变，再完成`post-influencer-bd-v1`备份；自动AI默认关闭，默认设置使用幂等insert，不覆盖管理员已修改值。旧Manus TiDB未连接、未恢复、未引用。

一般BD只能读取和修改当前分配给本人（或未分配且由本人创建）的达人与进度，前端提交的staffId/ownerStaffId不能覆盖服务端从登录email解析的员工身份。管理员可查看团队拆分、管理推广方案与阈值，并执行需要明确理由的软归档。所有新增、修改、截图、AI运行、反馈和设置变更均写审计；审计快照不展开聊天正文、联系方式、对象存储URL或storage key。

聊天截图采用独立强认证上传入口，只接受JPEG/PNG/WEBP且同时验证MIME与真实文件魔数，单张10MB、每条进度最多10张，保存SHA-256。文件字节进入对象存储，Railway MySQL仅保存对象引用和元数据；上传后若DB登记失败会清理对象。截图必须绑定到当前用户可访问的进度记录，删除采用软归档。

AI采用实时模型目录中支持长上下文、图片和严格JSON Schema的`gemini-3-flash-preview`，默认仅由员工点击执行。证据包包含系统确定性去重漏斗、真实推广卖点、最多500条本人/团队范围内进度、聊天文字和最多8张已授权截图；达人名称、handle和联系方式不发送给模型。模型被明确禁止捏造回复、产品功能、佣金、样品政策或合作结果，证据不足必须降低置信度。每次运行先写`processing`历史，再更新为`success`或`failed`并保留稳定错误码；员工反馈和实际执行结果会成为本人后续分析的参考，但AI不会自动改写真实BD记录。

| 验证项目 | 结果 |
|---|---|
| 生产升级静态回归 | 16/16合格 |
| 后端权限、事务、审计、KPI回归 | 23/23合格 |
| 文件上传安全回归 | 22/22合格 |
| AI证据、结构、历史与反馈回归 | 28/28合格 |
| 前端路由、工作区、角色与证据UI回归 | 30/30合格 |
| 主要server/schema/UI entry定向esbuild | 全部成功 |
| Gemini真实结构化契约测试 | 合格；确定性2位/1回复保持，中日话术返回，production read/write均0 |
| Chromium管理员视觉回归 | KPI、4条mock进度、达人库、推广方案、AI结果、管理设置、审计全部合格 |
| Chromium普通BD角色回归 | 管理视图、推广方案管理操作、audit query均不可见/不发起 |
| Chromium未认证回归 | 仅`auth.me`，随后保留原URL跳转登录；达人BD query 0 |
| 浏览器错误与写入 | console/page/request error 0，mutation request 0，production write 0 |
| `git diff --check` | 合格 |
| 全量`tsc` | 3.8GB沙箱内存限制下exit 143/134；服务端定向检查只出现既有`server/db.ts` 26件历史错误，达人BD文件抽取错误0，前端以定向esbuild和Chromium实际运行代替 |

本阶段仅完成代码、隔离模型契约和mock浏览器验证，尚未向Railway生产创建测试行。部署后将使用启动时备份门控创建空业务表，并以生产read-only方式验证升级健康、空数据状态、未认证保护、备份scheduler和后续代码兼容性。

### 本番反映・Railway MySQL検証

commit `19a41c9a`を最新mainへfast-forward pushし、Railway deployは2026-08-27 06:36 UTCにsuccessとなった。起動時`influencer-bd-v1` upgradeは8/8 tableを作成し、`pre-influencer-bd-v1`と`post-influencer-bd-v1`の両方がsuccess。users、staff、brands、brand_products、reports、managed_storesの前後件数は一致し、`existingBusinessRowsModified=0`、missing table 0を確認した。

本番Railway MySQLの达人BD业务数据は、初回リリース時点でcampaign 0、creator 0、outreach 0、analysis 0、audit 0である。これは過去記録を推測生成しなかった意図した空状態であり、画面は联络达人/次数/回复/积极回复/样品/合作をすべて0、回复率を`—`として表示し、「所选期间还没有真实BD进度」「尚未登记达人」を案内する。autoAnalysisEnabledは0のままで、自動AI消費は開始していない。

本番認証済みChromiumでは`/master/influencer-bd?verify=19a41c9a`がHTTP 200で表示され、console error、page error、failed request、达人BD POST requestはいずれも0。未認証のhealth/bootstrap/dashboard/listCreators/listOutreach/listAnalysesは401、admin auditは403で全件blockされた。全確認はread-onlyで、达人・联络・截图・分析等のproduction业务行を作成せず、旧TiDB接続も行っていない。全体backup healthはhealthy=true、schedulerStarted=true、latestFailure=nullを維持した。

## 2026-08-27 — HR・报告员工删除持久化与旧历史恢复冻结

用户确认过去的数据恢复只允许作为一次性历史恢复；从现在开始，Railway MySQL中的新增、修改、停用、归档和删除是最高权威，任何旧证据不得再在部署或重启时回写。生产只读审计确认，`runHr36DirectoryRecovery()`在2026-08-27 07:29:03–07:29:18 UTC再次运行，使用`pre-hr-dir-v2`备份124与`post-hr-dir-v2`备份125，并把证据目录关联的多条`report_staff.updatedAt`统一刷新到07:29:13 UTC。报告员工生产删除此前直接执行物理`DELETE`，没有墓碑、操作者或删除前快照；HR删除则只归档`staff`，而报告员工列表未排除所关联HR已归档的行，因此两个页面均可能出现“刚删除/归档后又回来”的表现。

按用户“其他模块不要动”的明确要求，本修复只从`server/_core/index.ts`移除`runHr36DirectoryRecovery`的生产启动调用；`runGmvHrRecoveryOnce`继续保留五店/GMV恢复，但删除其中`restoreStaff`调用和active staff成功条件，避免它创建或激活`staff/report_staff`。选品、主播、工资、LCJ Brain、账号品牌、商品、KG、积分会员及其他启动逻辑全部保持最新main原状。加密数据库备份scheduler、schema-only升级和正常业务scheduler继续运行。

`report_staff`新增`archivedAt`、`archivedBy`、`archiveReason`；升级版本为`manual-persistence-protection-v2-2026-08-27`，必须先完成`pre-manual-persistence-v2`加密备份，新增字段后完成`post-manual-persistence-v2`备份。报告员工“删除”改为事务内软删除：保存删除前快照，写入归档墓碑、操作者、理由、`isActive='inactive'`和manual revision，再向`manual_data_change_events`写`archive`事件；任一审计步骤失败则整个事务回滚。物理删除仅保留给`NODE_ENV=test`的隔离清理。显式恢复仅管理员可执行并写`restore`事件。

报告员工全部列表、active列表、国别列表、统计、HR统一人物目录、自动关联、从报告员工建HR档案和本人日报身份解析均排除报告员工墓碑；关联HR的`staff.archivedAt`存在时，报告员工页和当前统计也同步隐藏。HR历史日报、任务、排班、工资和审计引用不删除，ID保持不变。界面确认文案明确为“既存の日報は保持され、再起動後も自動復活しません”。

| 部署前验证 | 结果 |
|---|---|
| HR人员恢复冻结 | HR36启动调用0；GMV恢复中的`restoreStaff`调用0；其余11个非HR启动恢复保持 |
| 静态规则 | 35/35合格 |
| 事务隔离测试 | archive commit、重复删除幂等、审计失败回滚全部合格；production DB连接0 |
| Chromium回归 | 2行→归档1行；刷新后隐藏；新登录上下文仍隐藏；保留员工始终可见 |
| 浏览器错误 | console/page/request error 0 |
| 定向esbuild | schema、migration、persistence、db、HR混合恢复、router、index、报告员工UI全部成功 |
| `git diff --check` | 合格 |
| 旧TiDB | 连接、读取、恢复均0 |

生产只读基线为report staff 51、可见HR staff 30、HR统一可见26、归档统一25、`hr_staff_archive_events` 28件。现有物理删除接口没有删除事件，因此无法仅凭当前列表猜测用户刚才点击删除的所有名字；本修复不会据此推测删除任何人。部署后会先由“关联HR已归档同步隐藏”恢复两个页面一致性，再仅依据可验证归档事件或后续明确删除操作写墓碑。

用户截图中的早会布局来自已上线的既有提交`b87a7413`（中国/日本团队早会拆分）和`7c576cf8`（个人朗读最低时长），不来自本次员工修复。本次提交清单不包含`MorningMeeting.tsx`、`morningMeetingRouter.ts`、早会migration、早会schema或早会测试。

### 生产反映与只读验证

员工修复commit `5093efe9`于2026-08-27部署成功。`manual-persistence-v2`在server listen前完成，数据库备份health为`healthy=true`、schedulerStarted=true、latestFailure=null；最新成功备份为id 127、reason `post-manual-persistence-v2`、tableCount 390、rowCount 101623。HR36最近一次运行仍停留在本修复部署前的2026-08-27 07:29:03–07:29:18 UTC，部署重启没有再次执行。

生产认证只读API与Chromium均确认：`/master/report-staff`当前可见26名，`/master/hr`人物目录当前可见26名，报告员工与HR归档状态已经一致；HR归档箱仍保留历史人员，既有历史数据没有物理删除。两个页面HTTP 200，console/page/request error 0，mutation request 0，production业务写入0。生产截图目视确认报告员工表格和HR卡片布局正常，早会及其他模块未由本commit修改。

## 2026-08-27 — 早会录音取消时长限制、旧团队记录归类与可审计删除
生产只读审计确认，`morning_meeting_settings.minimumTeamDurationSeconds=60`于2026-08-27 07:08:53 UTC写入。当天14条个人9条朗读均已保存为`completed`，时长为3–63秒；后续代码用当前60秒规则追溯重算，导致其中13条在上午已完成后变为“时长不足”。用户明确说明熟悉9条后可在1分钟内读完，因此个人朗读与团队早会均取消最低秒数：上传仍验证登录、日期、音频非空、文件签名、大小和处理状态，但完成只看`status='completed'`。旧设置查询固定返回`minimumDurationSeconds=0, disabled=true`，旧设置mutation不再写数据库；前端移除最低时长输入、60秒提示、停止按钮禁用和不足重录状态。

同日另有1条280秒、12人参加的真实团队录音，创建于中国/日本团队拆分前，保存为`recordingKind='daily_team'`、`teamCode='legacy'`。参与者快照与当前在职员工对应结果为中国团队12/12，因此新增严格无歧义归类：仅当快照全部成员均能识别且属于同一团队时才映射为中国或日本；混合团队或未知成员不猜测。该归类统一用于今日卡片、参加人数、重复录制阻止、团队统计和缺会提醒。生产数据本身不复制、不改写。

新增统一`morningMeeting.deleteRecording`接口。个人记录仅本人/对应staff账号或管理员可删除；团队记录仅创建主持人或管理员可删除。删除在单一数据库事务中完成：服务端重验权限，先向`manual_data_change_events`写`delete`事件和脱敏前快照，再删除业务行并释放重录资格；审计失败时整笔回滚。审计不保存音频URL、对象key、转写全文或AI摘要。旧`morningMeeting.delete`也改为调用相同审计删除服务。前端仅在服务端返回`canDelete=true`时，于今日个人卡片、今日团队卡片和三类历史列表显示删除按钮；删除前二次确认，成功后同时刷新今日状态与历史。

| 部署前验证 | 结果 |
|---|---|
| 静态规则 | 40/40合格；执行路径无60秒限制、`too_short`或最低时长UI |
| 运行时policy | 3秒、52秒`completed`均有效；`failed`仍不完成 |
| 旧团队归类 | 全中国→china；中日混合→null；未知成员→null |
| 删除事务 | 本人、关联staff、主持人、管理员成功；他人403；审计失败回滚；不存在记录404 |
| Chromium回归 | 52秒个人录音完成；280秒旧中国团队完成；个人删除后refetch与整页刷新均消失；团队记录不受影响 |
| 页面错误 | console/page/request error均0 |
| 定向esbuild与`git diff --check` | 合格 |
| 生产写入 | 审计阶段0；未自动删除任何现有录音 |

本次差分限定为早会页面、早会router、早会policy、早会删除服务和专项验证/记录；HR、报告员工、店铺、商品、主播、积分等其他业务模块不修改。

## 2026-08-27 — LCJ MALL 与 Master 主屏幕网页 App 启动入口分离

用户在 iPhone Safari 从 `https://lcjmall.com/master` 添加到主屏幕后，图标仍启动到商城根目录。根因是全站共用 `/site.webmanifest`，其 `start_url` 固定为 `/`。本次修复不增加重定向、不修改前端路由、登录、权限、数据库、商城、订单或支付逻辑，只按请求路径选择网页清单：商城及普通页面继续使用 `/site.webmanifest`（`id`、`start_url`、`scope` 均为 `/`）；`/master` 与其子路径使用新增 `/master.webmanifest`（`id`、`start_url` 为 `/master`，`scope` 保持 `/`，确保仍可在同一网页 App 内返回商城）。

| 验证项目 | 结果 |
|---|---|
| 路径选择单元测试 | 4/4 通过：`/`、`/master`、Master 子路径与普通商城路径 |
| Master 服务端模块定向打包 | esbuild 成功 |
| manifest 关键字段检查 | 商城启动 `/`；Master 启动 `/master`；两者范围均为 `/` |
| `git diff --check` | 合格 |
| 完整 Vite 生产构建 | 8251 个模块转换后受沙箱内存限制终止；非代码错误，后续以 CI/Railway 构建结果为准 |

部署后，已有 iPhone 桌面图标不会自动变更启动地址，需要用户删除旧图标，并分别从商城主页和 `/master` 页面重新“添加到主屏幕”。

## 2026-08-27 — HR复职后被启动迁移再次退职的永久修复

生产只读审计确认，这次状态回退不是新的人工操作。历史commit `14471c91`加入`server/migrations/deactivateStaffAccount.ts`，把邮箱`j2914113930@163.com`硬编码为注销对象，并由`server/_core/index.ts`在每次服务启动时调用。用户恢复后，只要对应staff再次为`active`，下一次Railway部署/重启就会写回`inactive`、`resignDate=NOW()`和`resignReason='账号注销'`。目标当前档案`staff.id=57/report_staff.id=146`在2026-08-27 08:40:33 UTC发生用户更新，随后08:41:27 UTC被该启动迁移写入退职状态，时间与逻辑完全吻合。

同名还存在另一套独立历史档案`staff.id=55/report_staff.id=119`，已在08:40:17 UTC由用户30006归档。本修复不按姓名合并、不删除同名档案；生产修复只允许以服务端验证的ID关联操作当前57/146，旧55/119保持原状。

永久修复删除硬编码迁移文件及生产启动调用。`staff.reinstate`与`staff.restoreArchived`统一走`restoreArchivedStaffWithPool`原子事务：锁定指定staff/report_staff并验证唯一关联；staff设为active并清除resignDate/resignReason及归档墓碑；report_staff设为active并清除归档墓碑；在同一事务恢复被前缀化的账号邮箱，分别向`manual_data_change_events`写staff/report_staff恢复前后快照，并向`hr_staff_archive_events`写reinstate或restore事件。任一审计失败时全部回滚。未关联的report_staff复职兼容路径保留。

| 部署前验证 | 结果 |
|---|---|
| 静态规则 | 31/31合格；启动入口及server源码无硬编码退职邮箱 |
| 事务测试 | 完整恢复、重复幂等、同名历史档案隔离、关联不一致拒绝、审计失败回滚全部通过 |
| Chromium回归 | 复职后立即、整页刷新后、新登录上下文后均为当前活动，退职标签不再出现 |
| 同名隔离 | 当前57/146恢复，历史55/119保持归档 |
| 页面错误 | 新增功能console/page/request error 0；现有DialogTitle无障碍提示单独记录 |
| 定向构建与`git diff --check` | HR页面、router、archive服务、生产入口全部合格 |
| 生产诊断写入 | 0；本阶段只读查询，没有再次恢复或退职任何人员 |

本次差分仅涉及HR页面、HR归档/复职服务、HR路由、生产入口中该错误迁移调用及专项验证。早会、店铺、商品、主播、积分等其他模块不修改。旧TiDB连接、读取、恢复均为0。

### 生产部署与目标状态恢复

主修复commit `6ffbc865`和schema字段hotfix `7e2676f2`均通过GitHub check并由Railway成功发布。第一次生产复职请求暴露`report_staff`实际schema没有`email`列；请求返回400且原子事务完整回滚，只读复查确认57/146仍保持原状态、没有部分写入。hotfix移除不存在字段后重新通过31/31静态、事务和定向构建验证。

执行复职前的加密备份health为`healthy=true`、schedulerStarted=true、activeRun=null；最新成功备份id 149、reason `post-point-product-recovery-v1`、完成于09:37:13 UTC，晚于此前中断的id 146。随后只对审计已确认的57/146调用一次`staff.reinstate`。返回`restored=true`，staff与report_staff在09:47:15 UTC同步写为active，退职日期/原因及归档墓碑全部清空，并写入双表手工恢复审计和HR reinstate事件；账号本来无需恢复，因此`userAccountRestored=false`。旧同名55/119的归档时间与状态不变。

生产API只读复查和实际Chromium页面均合格：目标在“现在活动确认”分类出现，详情显示当前活动，不显示“退职确认済”或“复职”按钮；HTTP 200、console/page/request error 0、浏览器mutation 0。下一步以本记录的docs-only部署触发第二次Railway重启，重启后再次只读确认目标不会被旧迁移写回退职。

## 2026-08-27 — 财务管理二次密码门禁

按用户要求，仅为`/master/finance`增加独立二次密码。源码、前端包、URL、日志、数据库和Git历史均不保存密码明文；服务端只保留bcrypt摘要，并允许未来通过`FINANCE_ACCESS_PASSWORD_HASH`环境变量覆盖。正确验证后签发绑定当前用户ID、8小时有效的HttpOnly/Secure/SameSite签名Cookie；连续5次错误按用户与来源IP锁定15分钟。主动“重新锁定”及正常账号退出都会清除财务Cookie。

财务页面使用父级门禁：未解锁时不挂载原`FinanceManagement`组件，因此不会预取TikTok主财务、发票、现金流、合同或工资数据。后端并非只保护页面外壳：`invoice`全部procedure和`cashflow`全部procedure改为财务门禁；工资接口继续叠加原有工资二次密码；TikTok主财务`brandId=0`与独占接口要求财务密码，真实品牌详情`brandId>0`维持原访问；导入删除依据数据库内真实brandId决定是否要求财务密码，避免破坏品牌详情。TSP/品牌合同接口因同时被品牌详情复用而不做全局锁定，但在财务页面解锁前不会挂载调用。

| 验证项目 | 结果 |
|---|---|
| 静态安全规则 | 26/26通过 |
| 财务与原工资单元测试 | 13/13通过；错误密码、用户绑定Cookie、篡改拒绝、限流、brandId范围、主动锁定均合格 |
| 用户提供密码摘要一致性 | 本地一次性校验通过；临时脚本和摘要文件已删除，明文未进入repo |
| Chromium回归 | 错误密码拒绝、正确解锁、刷新保持、主动重新锁定全部通过 |
| 解锁前财务数据请求 | 0 |
| 浏览器业务mutation | 0；仅模拟一次unlock与一次lock |
| 页面错误 | 非预期console/page/request error均为0 |
| 定向构建与差分格式 | 客户端和关键服务端文件esbuild成功，`git diff --check`合格 |
| 其他模块 | 早会、HR、报告员工、店铺、商品、主播等业务文件零改动 |

本阶段未读取、修改、创建或删除任何生产财务记录。旧TiDB连接、读取、恢复均为0；生产仍仅使用Railway MySQL。

## 2026-08-27 — HR唯一主档与跨模块状态联动
用户要求HR页面和所有使用HR人员的模块不重复，并在新增、修改、退职、恢复、归档后同步变化。生产只读关系图确认：`staff`有28条当前活动记录，但HR统一目录与报告员工仅24人；其中3组可由完全相同的规范化邮箱与姓名共同确认是重复主档。招聘、个人/团队早会和达人BD均因此显示28条；积分持有人还会把现档与旧归档档案同时列出。报告员工的`linkedStaffId`当前没有一对多重复，另有1条唯一确认的活动staff缺少report_staff关联。

新增中央HR身份一致性层：`staff.identityKey`只接受证据状态为verified的规范化真实邮箱，placeholder或未验证邮箱不参与自动判定；`staff.mergedIntoStaffId`作为不可复活的软合并墓碑。schema升级在监听前执行，先后生成加密备份，只创建字段、唯一索引和审计表，`autoMergedRows=0`，绝不在启动时自动合并。人工新增/编辑会阻止相同验证邮箱再次建档，并在一个事务中同时创建或同步staff与report_staff。

管理员合并必须显式给出主档ID、副本ID、预览返回的identityKey、成功备份ID和确认短语。事务会锁定两条staff，要求规范化姓名和验证邮箱完全相同、主档恰有1条report_staff关联且副本为0条；排班/早会/账号/积分冲突会拒绝。任务、品牌负责人、店铺负责人、招聘、排班、早会、问题追踪、聊天、TikTok日报、达人BD、LINE、TSP和积分引用全部迁移，聊天室成员与任务分配会先去重；迁移后副本变为inactive＋archived并写`mergedIntoStaffId`，主副档、移动计数和操作者均写入审计。历史日报、录音、交易名称快照不删除。

所有当前人员入口已统一为`isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL`：HR、报告员工、任务、排班、早会、招聘、积分当前候选与排行榜、店铺负责人、问题通知、聊天搜索、TikTok竞品日报、达人BD和员工账号同步均跟随HR状态；历史记录继续可追溯。姓名回退关联已移除，同名不同邮箱员工明确拒绝合并。

| 部署前验证 | 结果 |
|---|---|
| 静态唯一性与跨模块规则 | 60/60通过 |
| 隔离事务测试 | 成功合并、重复幂等、同名不同邮箱拒绝、审计失败回滚、漏档report_staff只创建一次均通过 |
| 关键服务端定向构建 | 18/18通过 |
| 差分格式 | `git diff --check`通过 |
| 生产业务写入 | 0；本阶段仅只读关系图 |
| 旧TiDB | 连接、读取、恢复均为0 |

当前尚未部署或合并生产重复数据。下一步仅提交HR一致性代码，Railway schema升级成功后再次预览三组重复引用；只有预览无冲突且加密备份成功时才逐组事务迁移，并为唯一漏档主档补齐report_staff关联。

首次commit `c6c9c1dd`的GitHub检查成功，但Railway约6分钟后判定deploy failed且生产没有切换，新`staffIdentity.health`路由不存在。生产只读备份健康仍为`healthy=true`，最新成功备份保持id 149，未出现HR身份迁移成功或业务合并记录，说明失败版本没有接管流量、人员数据写入为0。启动升级原设计在`server.listen`前执行两次全库加密备份，耗时会占满Railway release健康窗口；修正为启动时只验证26小时内已成功加密备份后快速建schema，绝不自动合并。真正合并前由管理员接口显式生成`pre-staff-identity-merge`备份，事务只接受2小时内该专用成功备份ID；全部合并后再显式生成post备份。活动report_staff一对一约束改为基于`archivedAt IS NULL`的生成列唯一索引，允许历史归档档案保留。

hotfix后的60/60静态规则、隔离合并事务、schema/router定向构建和差分检查再次通过。

hotfix重放到财务page-session并行commit后形成`c3ff01a4`，Railway发布成功。生产`staffIdentity.health`显示schema升级success、`autoMergedRows=0`，三组只读预览均eligible且conflict 0。管理员显式生成合并前加密备份id 150（394表、113,958行、checksum存在），随后三组事务合并均success：第一组无业务引用；第二组把1条早会朗读引用从副本迁到主档；第三组把1个店铺负责人和5条排班引用迁到主档。主档保留、副本软合并归档，3条合并审计均绑定backup 150。随后生成合并后备份id 151（394表、113,970行）。

合并后所有直接读取staff的模块已统一为25人；生产验证同时发现唯一漏档staff 51已有一条归档report_staff，因此原`ensureReportProfile`按linkedStaffId找到记录后返回no-op，报告员工、HR统一目录和积分当前员工仍为24。没有创建重复report_staff。修复为：发现已归档关联时，在单一事务恢复原report_staff的active/归档状态、同步staff当前姓名/国家并写前后审计；只有完全不存在关联时才新建。61/61静态规则、隔离新建一次/幂等/归档原档恢复不重复、合并事务与定向构建均通过。

精准hotfix commit `585e3b4f`经Railway成功发布。生产收尾前备份id 152完成后，仅对staff 51执行一次`ensureReportProfile`；结果`created=false/restored=true`，证明恢复的是既有归档report_staff而非新建重复行。收尾后备份id 153成功且checksum存在。生产API与Chromium只读回归一致：`staff.listActive`、`reportStaff.listActive`、HR统一目录、招聘担当、个人早会成员、团队早会成员、达人BD员工、积分当前员工均为25；HR页面人物目录25/现在活动25，报告员工页面25行且姓名行唯一；三组主档ID存在、三组副本ID不再出现在任何当前名单。HTTP 200，console/page/request错误0，mutation 0。旧TiDB连接、读取、恢复均为0。

生产证据commit `9de007d5`为docs-only并触发Railway完整重启；发布success后再次执行API与Chromium只读回归，HR、报告员工、招聘、两类早会、达人BD、积分仍全部25，报告页面姓名行唯一，schema/backup均healthy，latest backup仍为post-merge id 153，3条合并审计仍为success，生产业务写入0。

## 2026-08-27 财务管理与工资明细统一密码

现金流中的工资明细弹窗仍使用旧工资专用bcrypt摘要，导致用户通过外层财务密码后，在内层继续输入同一密码会被错误拒绝。修复后`financeAccess`提供唯一密码比较函数，`payrollAccess`复用同一财务bcrypt摘要，旧`PAYROLL_ACCESS_PASSWORD_HASH`与内置工资摘要均删除。外层财务page-session Cookie和内层工资HttpOnly Cookie仍分别存在，工资接口继续要求两层会话都有效，只统一用户输入的密码，不降低服务端保护。

前端弹窗改为“工资明细二次确认”，明确输入与财务管理相同的密码，成功后立即关闭弹窗并显示工资明细已解锁。用户提供密码与唯一bcrypt摘要本地一致性验证通过，明文未写入源码、日志、数据库或Git。

| 部署前验证 | 结果 |
|---|---|
| 财务门禁静态回归 | 31/31通过 |
| 财务、工资和page-session单元测试 | 19/19通过 |
| Chromium同一密码完整流程 | 外层与工资均成功、错误密码拒绝、重新锁定成功 |
| 未解锁数据请求 | 财务0、工资对账0 |
| 业务数据mutation | 0 |
| console/page/request错误 | 0 |
| 前后端定向构建与差分格式 | 通过 |
| 其他业务模块 | 零差分 |


## 2026-08-28 — 選品中心の商品名・タグ・複数SKU保存を恒久修正（本番反映前）

`/master/selection-center?tab=products` の既存商品編集では、Railway MySQLのJSON列`tags`が文字列として返る場合にフォームが配列へ変換せず、そのまま`updateProduct`へ送っていた。後端Zodは配列のみを要求していたため、`Expected array, received string`で更新全体が拒否され、商品名・中文名とSKUも同時に保存できなかった。さらに新規`createProduct`は`skuVariants`とSKU関連列をinput/INSERTへ含めておらず、画面でSKUを追加しても新上架商品へ永続化できない設計欠陥があった。

商品フォームを開く時点で`tags`、`skuVariants`、images、detailImages、videos、exclusiveLiverIdsを安全に配列化し、送信直前にもタグとSKUをcanonical化する。タグはtrim・空文字除去・重複排除、SKUは空白行除外、名称必須、価格/最低価の有限非負数、割引率0〜100、NFKC・空白・大文字小文字を統一した名称重複検査を行う。1行だけのSKUにも削除buttonを表示し、空配列とlegacy SKU列のNULLを明示送信するため、最後のSKUも削除できる。既存の`skuName`、`skuPrice`、`skuLowestPrice`、`skuDiscountRate`だけを持つ商品は1行SKUへ互換表示し、保存時は複数SKU JSONの先頭行をlegacy列にも同期する。

後端は新規・更新の両方で配列または旧JSON文字列のタグ/SKUを互換受理し、同じ正規化を再実行する。保存先は既存`selection_products.skuVariants` JSON列であり、MALL用`mall_product_variants`やKG復元処理へ切り替えていない。商品列は固定ホワイトリストだけをINSERT/UPDATEし、新規作成は商品＋価格/割引履歴、更新は`FOR UPDATE`存在確認＋商品＋価格/割引履歴をそれぞれ単一MySQL transactionでcommitする。更新件数1件を確認し、商品本体・履歴の途中失敗、対象なし、同時削除はrollbackする。schema ensureはtransaction外かつプロセス内1回へ集約した。

| 検証項目 | 結果 |
|---|---|
| SKU正規化・新規INSERT・既存UPDATE・最後のSKU削除・重複/不正数値拒否・rollback | Vitest 12/12合格 |
| 静的永続化守衛 | 17/17合格 |
| Chromium純mock操作 | 既存商品名/中文名変更、旧文字列tags、SKU追加/編集/全削除、新商品2SKU作成、重複阻止、刷新、新会话再登录を確認 |
| 浏览器错误 | console/page/request error 0 |
| 定向TypeScript | 新增shared/server helper无错误 |
| 前端SelectionCenter与server entry定向esbuild | 成功 |
| 全量Vite build | 8,254 modules transform後に沙箱内存限制でSIGTERM；定向构建与Chromium实际运行で代替 |
| `git diff --check` | 合格 |
| 本番业务写入 | 商品/SKU作成・更新とも0件 |
| 旧Manus TiDB | 接続・読取・復元すべて0件 |

浏览器回归使用本地Vite与内存mock tRPC数据，`productionWrites=0`。本番反映後も、ユーザーが実際に登録する商品内容を提供しない限り真实商品/SKUは作成せず、認証済みread-only画面、chunk、接口保护、Railway部署、数据库备份healthのみを確認する。

### 本番反映・Railway MySQL只读验收

commit `9260e71f`を最新mainへpushし、GitHub CIとRailway deployはいずれもsuccessとなった。生产认证只读`selectionCenter.getProducts`は当前页51件／総数98件を返し、`tags`と`skuVariants`列が存在した。51件中10件の`tags`は実際に旧JSON文字列形式で返っており、今回の互换路径が生产真实数据に必要であることも確認した。既有商品编辑dialogは商品名・中文名を正常加载し、既有SKUが0行の商品でも`+ SKU追加`で1行追加、削除で0行へ戻せた。新规商品dialogではSKUを1行→2行へ追加し、2行目と最后1行を順に削除して空状態へ戻せた。作成buttonは正しく`作成`を表示した。

生产验收は既有商品值を変更せず、空白フォーム行をクライアントstate内で追加・削除しただけで、`selectionCenter.createProduct`／`updateProduct` POSTは0件、production商品/SKU写入は0件だった。未认证`getProducts`は401、mutation procedureはGETでは実行不可で、既存のprotected tRPC境界を維持した。HTTP 200、console error 0、page error 0、关键失败请求0。旧CloudFront商品画像8件がChromium ORBで拒否された既存静的資産問題は別記録とし、商品画像fallbackが表示され、今回の名称/tags/SKU保存には影響しない。

数据库备份healthは`healthy=true`、`schedulerStarted=true`、最新成功备份あり、age約0.22時間だった。healthには後続成功备份ですでに置換された過去の中断failure 1件が履歴として残るが、現在のoverall healthy判定はtrue。旧Manus TiDB接続・读取・恢复は0件のまま、Railway MySQLだけを生产保存先としている。

## 2026-08-28 — 选品中心拍卖上传与自行修改恒久修复（生产反映前）

`/master/selection-center?tab=auction`的生产只读审计确认Railway MySQL已有6条拍卖记录、5批成功导入历史，`auction_records`与`auction_import_batches` schema均ready，数据库备份`healthy=true`。故障不在数据表：tRPC通过SuperJSON把MySQL日期恢复为JavaScript `Date`对象，旧编辑按钮却调用`r.auctionDate?.split("T")`，点击“編集”立即产生`split is not a function`并无法打开弹窗；主播筛选还使用了未声明的`filtered`变量，点击筛选会使AuctionTab运行时报错。生产交互探针只读执行，mutation POST与业务写入均为0。

前端改为同时兼容`Date`、ISO字符串和`YYYY-MM-DD`，列表和编辑弹窗对损坏的旧`roundsJson`安全回退。完整编辑范围包括商品ID、日/中文商品名、主播、起拍价、平均/最终成交价、GMV、成交件数、拍卖次数、日期、备注，以及每轮的编号、起拍价、成交价、竞拍人数、获胜者、SKU名称、SKU ID、开始时间和时长；轮次可新增、逐条修改、删除到0条。有轮次时保存会从轮次原子同步次数、首轮起拍价和平均成交价；无轮次时保留合法的手工汇总值。

Excel导入现支持`.xlsx`、`.xls`与`.csv`，选择文件后先在浏览器显示商品数、原始行数和跳过行数。服务端再次验证扩展名、允许MIME、严格base64、声明大小、SHA-256、XLSX ZIP内部Excel结构、XLS OLE签名或CSV文本内容，并用XLSX parser实际打开工作簿；伪装文件、损坏文件、科学计数法商品ID和不可能日期都会在写入前拒绝。有效元文件继续保存到私有对象存储key，Railway MySQL只保存审计引用；若对象已上传但MySQL连批次记录都无法建立，会删除孤立对象，已有failed批次则保留元文件并更新可追溯引用。

手工create/update不再直接执行无事务动态SQL，而使用固定列白名单：create为单一MySQL transaction；update先`SELECT ... FOR UPDATE`锁定并确认记录存在，再检查`affectedRows=1`后commit，任一失败rollback。protected tRPC权限保持，未登录list/create/update返回`UNAUTHORIZED`，schema health仍限admin。批量导入的对象存储、hash、import batch、所有记录和完成状态路径维持原有冪等设计，并新增运行时测试证明记录插入失败时全部Railway行rollback且批次标记failed。

| 验证项目 | 结果 |
|---|---|
| 静态回归守卫 | 23/23通过 |
| Date、字段/轮次规范化、手工create/update事务 | 11项通过 |
| Excel解析、真实XLSX/XLS/CSV与伪装文件拒绝 | 6项通过 |
| 上传对象存储、SHA/base64、commit/rollback、孤立对象清理 | 5项通过 |
| 未认证与admin权限 | 3项通过 |
| 总Vitest | 25/25通过 |
| Chromium纯mock | Date对象编辑、主播筛选、轮次增删改、有效XLSX预检/上传、无效文件阻断、刷新与重新登录全部通过 |
| 浏览器错误 | console/page/request error均0 |
| 前后端目标esbuild、定向TypeScript与`git diff --check` | 通过；拍卖任务文件TypeScript error 0 |
| 本番业务写入 | 拍卖创建、修改、删除、上传均0件 |
| 旧Manus TiDB | 连接、读取、恢复均0件 |

生产验证阶段不会上传测试文件或修改真实拍卖记录。部署后仅使用认证只读API与页面，打开既有编辑弹窗但不保存、选择本地文件做客户端预检但不执行上传，并再次检查未认证保护、Railway部署和加密备份health；只有用户实际操作真实业务内容时才允许产生拍卖写入。

### 本番反映・Railway MySQL只读验收

commit `8abf9e5d`を最新`main`へfast-forward pushし、GitHub checkとRailway deployはいずれもsuccessとなった。生产只读API确认`auction_records`前后均为6条、ID顺序未变化，`auction_import_batches`最近履历前后均为1条；本次验收没有执行真实上传、创建、修改或删除。

认证生产页面`/master/selection-center?tab=auction`はHTTP 200。点击主播筛选后页面保持正常，不再触发未定义`filtered`错误。点击既有记录“編集”后，编辑弹窗正常打开，`auctionDate`显示为`YYYY-MM-DD`格式（实测`2026-08-25`），证明SuperJSON `Date`对象不再触发`split is not a function`。弹窗内商品ID、商品名、中文名、主播、起拍价、平均/最终成交价、GMV、成交件数、拍卖次数、日期、备注和轮次明细均可见；只读验收只在前端状态中新增1个空轮次再删除回原数量，没有点击更新。

上传链路的生产只读验收仅选择本地XLSX进行浏览器端预检，页面显示`1商品、原始1行、跳过0行`，上传按钮进入可执行状态但未点击。脚本对`auction.create/update/delete/importBatch` POST设置拦截，最终业务POST 0、blocked POST 0、productionWrites 0。未认证`auction.list`返回401，mutation用GET访问返回405，protected tRPC边界保持。schema health为`healthy=true`、missingColumns为空、importBatchesReady=true；数据库备份health为`healthy=true`、schedulerStarted=true、latestSuccess存在。浏览器console error、page error、failed request均为0。旧Manus TiDB连接、读取、恢复继续为0。

## 2026-08-28 拍卖每SKU・1+1/1+2组合・多次修改与Excel兼容修复

用户补充指出拍卖仍存在Excel导入失败，且拍卖和商品侧需要每个SKU分别登记`1+1`、`1+2`等组合，同一个SKU可登记第2次、第3次拍卖并可反复修改。生产只读审计确认Railway中拍卖表与成功导入批次健康，最近成功原文件为标准14列格式；拍卖轮次已有SKU名称/ID但缺少组合字段，商品侧SKU JSON已有`promotionType`能力，故沿用既有`roundsJson`与`skuVariants`，不新增拍卖业务表、不重写既有6条拍卖或10轮历史。

本次建立共享拍卖Excel解析器，客户端预检与服务器从原始XLSX/XLS/CSV二进制重解析使用同一规则。解析器扫描前30行寻找表头，兼容中日英别名和标准14列位置回退，只把商品ID/PID与成交价作为核心列，统计SKU、轮次、表头位置和跳过行，并限制最多10万数据行/5000商品。后端不再信任客户端提交的`records`或行数，继续验证base64、SHA-256、扩展名、MIME和真实工作簿结构后重建记录；批次、记录和对象存储失败清理仍保持事务、幂等和审计语义。

拍卖轮次现在规范化保存`promotionType`，支持`1+1`、`1+2`、`1+4`等`数字+数字`组合，并兼容旧`bundleLabel`或从旧SKU名称推断；“なし/none/-”视为空。编辑弹窗可从商品管理选择商品并读取其SKU，每个SKU可单独加入轮次，一次加入全部SKU，或用“同SKU再登记”生成第2次、第3次拍卖；每轮均可独立修改SKU名称、SKU ID、组合、起拍价、成交价、竞拍人数、获胜者、开始时间和时长。详情展开表也显示SKU与组合。商品编辑器原固定促销下拉改为带建议的可输入字段，每个SKU可分别登记不限于固定三项的数字组合。

验证使用纯本地/mock和生产成功批次原文件的只读副本，不连接Railway MySQL、不发送生产mutation。Vitest共46/46通过，覆盖真实成功工作簿、偏移中文表头、改名表头、标准14列位置、服务器重解析、伪造文件拒绝、每SKU组合、同SKU重复轮次、同一拍卖记录连续第2/第3次事务更新、商品每SKU组合第二次更新、权限与rollback。静态守卫33/33通过，前后端目标打包与`git diff --check`通过；全仓库TypeScript仍有既有其他模块错误，但本次拍卖文件错误为0。两套Chromium纯mock回归均通过：拍卖侧`10個セット/1+1`、`20個セット/1+2`和同SKU再次登记保存后连续修改至`1+4`，刷新/重新登录保持；商品侧3个SKU分别`1+1/1+2/1+4`，第二次修改后保持。console/page/request error均为0，生产业务写入为0，旧Manus TiDB连接/读取/恢复为0。

### 拍卖SKU组合生产只读验收（commit c293b462）

GitHub check和Railway deploy均为success。认证只读API确认拍卖记录前后均6条且ID顺序不变，导入履历前后均1条；schema `healthy=true`、缺失列为空、import batch ready，数据库备份`healthy=true`、scheduler运行且有最新成功备份。未认证list仍返回401，mutation的GET探针返回不可写状态。

生产真实拍卖编辑弹窗可从122个商品中读取SKU目录（16个主商品含SKU）。只读验收选择其中1个真实已有SKU的商品，在浏览器本地状态中把原轮次清空、用“全部SKU登记”恢复1个SKU，再用“同SKU再登记”生成第2轮，并在本地输入`1+4`；没有点击更新。偏移中文表头XLSX在生产页面成功预检为`1商品、2个SKU、2次拍卖、表头第3行、原始2行、跳过0行`，上传按钮仅进入可执行状态，没有点击。`auction.create/update/delete/importBatch`和商品create/update POST均被拦截，业务POST 0、blocked POST 0、生产写入0；拍卖记录和导入历史前后计数一致。浏览器console/page error均0。旧Manus TiDB连接、读取、恢复继续为0。

## 2026-08-28 选品中心父子SKU独立行展示与单独编辑修复

用户要求`/master/selection-center?tab=products`中所有子SKU按父商品下的独立行展示，并能分别修改。生产只读审计确认Railway MySQL当前有153个主商品、14条实体子SKU和22条商品内JSON SKU；实体子SKU以`parentProductId`关联并保留`kg-child-sku:*`恢复来源键，商品内SKU存于父商品`skuVariants` JSON。旧页面只把JSON SKU压缩为胶囊，不能单独编辑；实体子SKU的编辑按钮调用未定义`setShowProductForm`，点击会运行时报错。旧子行还把状态和套组列错位，状态固定显示非公开，并使用非事务raw fetch解除父级。

本次保留两种既有存储，不迁移、不合并、不重写恢复数据。共享SKU模型新增可选稳定`variantId`、`skuCode`、`stock`和`status`；父商品新建或整单更新时为缺少身份的JSON SKU生成UUID并校验重复名称/编号。商品内SKU与实体子SKU现在都在父商品下按同一13列独立显示名称、编号、条码、品牌/类目、定价、历史最低、保护期、佣金、库存、状态、促销组合和操作。专用编辑弹窗可修改名称、SKU编号、价格、最低价、折扣、库存、状态与促销；实体子SKU另可修改条码。父商品原SKU编辑器也增加编号、库存和状态字段。

后端增加受保护的实体子SKU更新、JSON SKU更新/删除和安全解除父级procedure。所有写入使用Railway MySQL事务、`FOR UPDATE`、父级/旧身份检查、`affectedRows`验证和rollback。实体子SKU只更新业务字段，明确不改`productId`和`parentProductId`，价格、最低价、折扣同步主列与legacy SKU列，价格/折扣历史与商品行同事务提交。JSON SKU按稳定ID定位；旧记录首次修改时回填ID，并同步父商品legacy首SKU列；同一SKU已验证连续第1、第2、第3次修改保持同一ID，兄弟SKU不丢失。

验证全部使用本地fake pool与纯mock Chromium，不连接Railway MySQL、不创建或修改生产商品。Vitest 25/25通过，覆盖未登录拒绝、实体/JSON两类SKU、稳定ID、连续三次编辑、重复编号阻断、旧身份冲突、价格历史失败回滚、删除、解除父级和`affectedRows`异常；静态守卫22/22通过，定向TypeScript、前后端目标打包和`git diff --check`通过。两套Chromium回归均通过：父子SKU独立行、专用弹窗、实体SKU字段、JSON SKU连续三次修改、刷新/重新登录、删除/解除，以及原商品创建、多SKU、组合和删除流程均无console/page/request错误。生产业务写入0；旧Manus TiDB连接、读取、恢复继续为0。

### 父子SKU生产只读验收（commit 1484feb9）

GitHub CI与Railway deploy均为success。认证只读API前后均返回125个父商品、135条商品行、10条实体子SKU和22条商品内SKU；关键业务字段规范化后的SHA-256前后均为`bbafb72231ed7c6738e85b951c99aef7b00b0727020084232dd2492067d88f63`。数据库备份`healthy=true`、scheduler已启动且存在最新成功备份。

生产真实页面已展开KG实体子SKU为独立表格行，SKU编号、品牌、类目、库存、状态、编辑和解除父级操作按正确列显示。实体子SKU专用弹窗完整显示名称、SKU编号、条码、价格、最低价、折扣、库存、状态和促销；商品内JSON SKU弹窗显示相同适用字段并隐藏不适用的条码。两类弹窗均只在浏览器本地临时改名后点击取消，没有点击保存。selectionCenter业务POST 0、blocked POST 0、生产mutation 0，console/page/关键request错误均为0。旧Manus TiDB连接、读取、恢复继续为0。
## 2026-08-28 TikTok竞品日报同日多文件追加与对比修复

用户反馈`/tiktok-competitor-daily?date=2026-08-28`上传第一份Kalodata文件后，第二份会覆盖第一份，无法做时段或版本对比。生产只读审计确认Railway MySQL当时有1个成功排名快照、1条sync log、7份日报和105条日报商品；旧`commitImport`在同一事务内把当天旧快照设为非当前、把新快照设为当前，并对当天每个运营日报执行`rankingSnapshotId`更新及删除/重建report shops/products，因此第二次导入虽然保留旧快照行，却实际覆盖了已填写日报内容，也没有保存快照级商品明细和文件哈希，前端也只有单一preview状态。

本次将Kalodata文件改为不可变追加批次。每份CSV/XLSX/XLS保存独立原文件、服务端SHA-256、大小、导入人、时间、店铺排名和快照商品明细；同日相同文件由`(snapshotDate,market,sourceFileSha256)`唯一索引及事务前检查去重，不创建重复批次。新批次只在日报不存在时创建日报；已存在的日报、店铺、商品、状态和人工填写内容全部保留，不再UPDATE或DELETE。批次保存使用Railway MySQL事务、`FOR UPDATE`、affectedRows检查、失败rollback和sync log/audit；文件上传收据通过JWT_SECRET HMAC绑定日期、文件hash、大小、对象key和服务端原文件重解析行摘要，客户端不能把另一份rows伪装成该文件。

页面支持一次选择多份文件，每份独立预览、独立保存和独立错误状态。当天批次卡片可查看原文件与该批次店铺/商品明细，可勾选2至4份比较店铺和商品的排名、销量、GMV、原价/成交价及首份到末份变化；批次缺失的指标显示无数据，不按0捏造。刷新与重新登录后批次历史和比较仍从Railway读取，第一份不会被第二份替换。

验证全部使用本地fake pool与纯mock Chromium，不连接或写入Railway MySQL。Vitest 36/36通过，覆盖不可覆盖既有日报、同日追加、哈希去重、服务端CSV/XLS/XLSX实质解析、签名收据和rows篡改阻断、未登录拒绝、2至4批次比较、缺失值、连接/中途失败rollback及schema表/列/索引健康；静态守卫25/25通过，定向TypeScript、服务端生产入口和前端页面目标打包、`git diff --check`通过。全量Vite在8264模块转换后因沙箱SIGTERM终止，但无编译错误；随后服务端入口与本次页面目标构建均成功。Chromium回归验证同日两文件、独立批次、重复文件不新增、单批次查看、店铺/商品对比、刷新/重新登录和控制台无错误，生产业务写入0；旧Manus TiDB连接、读取、恢复继续为0。
### TikTok竞品日报多文件生产只读验收（commit 14988fac）

GitHub check与Railway deploy均为success。认证只读API确认新增快照商品明细表、文件hash/大小列和重复文件唯一索引全部存在，`upgradeHealth.healthy=true`且missing tables/columns/indexes均为空；数据库备份`healthy=true`、scheduler运行并存在最新成功备份。未认证批次列表返回401。

2026-08-28当时生产无已保存日报、排名批次或同日sync log，因此没有为了测试而创建业务记录。生产真实页面一次选择两份只读CSV，两次仅调用不写数据库的`previewImport`，页面同时显示两张完整预览卡、各自5家店铺和独立“保存为独立批次”按钮，并显示“2份互不覆盖”与批次历史区域；没有点击保存。`uploadRankingFile`、`commitImport`及其他竞品写入POST为0，日报/批次/sync log规范化SHA-256前后相同。最终console error、page error和关键请求失败均为0。第一次页面请求曾出现一次跨境入口`ERR_CONNECTION_CLOSED`，源站curl随后HTTP 200，有限重试后完整验收通过；该现象属于另行跟踪的中国访问线路问题，不是多文件代码或数据库错误。旧Manus TiDB连接、读取、恢复继续为0。
## 2026-08-28 主播直播记录广告费与有无广告效果分析
用户要求`/liver/record`按场次显示实际广告费，并比较有广告与无广告直播的差异，判断广告是否有效。代码与生产只读审计确认`brand_livestreams.adCost`列早已存在，截图AI也能识别`rawData.adCost`，但主播创建procedure未接受/写入该字段，主播自助页面没有广告状态或金额输入，AI识别金额也未回填保存。生产当时14场直播的`adCost`全部为NULL，`ad_investment_records`为0条，因此不能把既有场次虚构成无广告或有广告。

本次在主播本人受保护页面增加三态广告登记：未登记（NULL）、无广告（0）、有广告（正整数日元）。新场次可手动选择状态与金额，AI截图识别到广告费时自动回填；`liverManagement.createLivestream`将验证后的`adCost`写入既有直播行。按本人和月份查询的广告效果服务优先使用直播行已确认金额；仅在其缺失时使用`ad_investment_records.livestreamId`显式关联的直播预算，绝不按相近日期/主播名猜测归因。主播可逐场补录或二次修改广告费，更新使用Railway MySQL事务、行锁、本人归属检查、软删除过滤、affectedRows=1和失败rollback。

效果面板按有广告/无广告分别显示场次数、广告费合计、平均GMV、订单、真实销量、观看人数、观看转化率和每小时GMV；有广告组额外显示ROAS=GMV/广告费、每单广告成本=广告费/订单、广告后销售贡献=GMV-广告费。NULL场次明确显示未登记并排除比较；每个指标保留自己的有效样本数，样本不足会警告，相关性比较不表述为广告因果效果。

验证全部使用本地fake pool与纯mock Chromium，不连接或写入Railway MySQL。Vitest 17/17通过，覆盖三态、显式广告关联、冲突、缺失值、ROAS、每单成本、净贡献、真实销量、同场第二次修改、本人越权拒绝、NOT_FOUND、affectedRows与rollback；静态守卫28/28通过，定向TypeScript、前后端目标打包和`git diff --check`通过。Chromium回归验证新场次保存`adCost=3200`、同场依次修改为2500与3000、有无广告对比、刷新和重新登录保持、控制台无错误，生产写入0；旧Manus TiDB连接、读取、恢复继续为0。
### 主播广告效果生产只读验收（commit aade06bf）
GitHub check与Railway deploy均为success。管理端认证只读API在部署前后均返回13名主播、2026-08共14场直播；14场`adCost`全部为NULL，相关品牌`ad_investment_records`为0条，说明当前没有可据实恢复的历史广告金额。直播关键字段规范化SHA-256前后均为`78cb9be54ba3ea7bedd71c0c6f4b3ffe895b77c66340b274a07b1c85998f90b0`，生产业务行变化0。未登录广告分析查询返回401；一次未登录更新权限探针同样返回401并在任何数据库工作前拒绝，成功生产写入0。

生产前端`/liver/record`已显示“本场广告费”三态输入、金额、说明、保存前核对，以及按月的有广告/无广告/未登记分组、GMV、订单、销量、观看、转化、每小时GMV、ROAS、每单广告成本、广告后销售贡献和每场登记入口。浏览器仅加载生产HTML/JS，所有tRPC请求均在页面本地拦截；纯mock创建`adCost=3200`和同场依次修改2500、3000后，汇总、刷新与重新登录保持，console/page/request错误为0，没有向生产发送已认证mutation。数据库备份`healthy=true`、scheduler运行且存在最新成功备份；旧Manus TiDB连接、读取、恢复继续为0。

## 2026-08-29 — LCF全账号密码恢复与邮件投递恒久修复（本番反映前）

複数ユーザーの「再設定メールが届かない」「マイページでパスワードを変更したが通知がない」という報告を、個別PW手動変更ではなく企業・ライバー・一般・管理者に共通する認証経路の問題として修正した。既存の1時間・1回限定SHA-256ハッシュ化トークンを維持し、阿里企業SMTPを優先、認証・接続・DNS・タイムアウト時だけGmail予備経路へ切り替える。宛先拒否時は二重送信しない。SMTP未設定・失敗時も旧パスワードは変更せず、発行トークンを無効化する。公開応答はアカウント列挙防止のため統一した。

マイページ変更とリンク再設定完了後に確認通知を追加したが、通知失敗は完了済みパスワード変更を失敗扱いにせず、画面へ「新パスワードは有効」と正確に返す。管理画面の旧明文「PWリセット」は廃止し、本人が完了するまで現在PWを変えない個別ワンタイムリンク送信へ置換した。送信前確認を必須とし、一括リセット・一括メールは追加していない。

`festival_email_delivery_logs`とmigration `0127_lcf_email_delivery_audit`を追加し、完全な宛先は保存せず、account ID、宛先SHA-256、domain、用途、起点、SMTP受付/失敗、provider、message ID、安全なerror codeを記録する。アカウント画面には阿里/Gmail設定状態、直近100件の受付/失敗、各accountの最新状態、詳細配信ログを表示する。操作履歴にも再設定リンク送信、再設定完了、PW変更、通知失敗を追加した。

| 本番前検証 | 結果 |
|---|---|
| LCF密码・メール・予約・一般申込回帰 | 32/32合格 |
| SMTP動作mock | 阿里優先、EAUTH時Gmail fallback、宛先拒否時二重送信なし、未設定安全失敗 |
| server/UI定向esbuild | 認証、メール、管理画面、マイページ、再設定画面すべて成功 |
| migration journal・`git diff --check` | 合格 |
| 実メール・実PW変更 | 0件 |
| 全体tsc | 3.8GB沙箱制約でSIGTERM、対象ファイル抽出TypeScript errorは0、定向buildで代替 |

公開DNSでは`livecommercejapan.jp`のMX/SPFが阿里企業メールと一致し、DMARCは未公開だった。DKIMは既知の一般selectorでは確認できないため、アプリ修復とは別に企業メール/DNS管理画面で確認が必要。既存LCF申込、予約、GMV、Ticket、アカウントデータは変更していない。

## 2026-08-29 — 管理侧边菜单部门顺序统一调整（本番反映前）

根据用户最终确认，仅调整管理后台侧边菜单的部门显示顺序为：运营部、商务部、达人部、广告投流部、IT部、设计部、财务部、人事部、短视频运营部；“我的工作”继续固定在部门列表之前。实现只移动`client/src/lib/adminMenuConfig.ts`中九个部门对象的完整代码块，不修改任何对象内的id、中文/日文标签、图标、颜色、子菜单、路由、`adminOnly`、badge或权限定义。

审计确认`DepartmentSidebarMenu`是桌面和移动布局共用的唯一部门菜单组件，并直接以`ADMIN_MENU_GROUPS.map(...).filter(...)`生成可见菜单，没有额外sort。权限过滤只删除不可见子项与空部门，因此管理员和受限员工均保持目标相对顺序。中文、日文、繁中回退和英文回退使用同一组数组顺序。

| 验证项目 | 结果 |
|---|---|
| 修改前后完整菜单组内容比较 | 10/10对象逐字一致，仅数组位置变化 |
| 中文目标顺序 | 运营、商务、达人、广告投流、IT、设计、财务、人事、短视频运营 |
| 日文目标顺序 | 運営、商務、達人、広告運用、IT、デザイン、財務、人事、短動画運営 |
| TypeScript目标打包 | 成功 |
| Chromium实际组件回归 | 中文桌面、日文移动、繁中、英文、受限员工共5/5通过 |
| 权限过滤后相对顺序 | 通过 |
| 浏览器页面错误 | 0 |
| `git diff --check` | 通过 |
| 数据库、API、员工部门归属、业务数据 | 无修改 |
| 本地浏览器回归 | 所有tRPC请求本地拦截，生产请求0、生产写入0 |
| 旧Manus TiDB | 连接、读取、恢复均0 |

本次没有schema、migration、server、tRPC、权限表、路由或业务页面变更；Railway MySQL中的员工、部门和其他业务数据均未读取或写入。生产部署后仅做页面与静态资源的只读确认。

### 管理侧边菜单顺序生产反映与只读验收

业务提交`b7a51cb7`已推送至`main`，GitHub状态与Railway部署均为success。生产`/master`与当前JavaScript资源均返回HTTP 200；生产bundle中的唯一菜单组定义按字节位置确认依次为`my-work → operations → business → influencer → ads → it → design → finance → hr → short-video`，与用户确认顺序一致。所有九个部门id在生产bundle中各出现1次，没有重复配置。

生产公开系统health返回`ok=true`；数据库备份health为`healthy=true`、`schedulerStarted=true`，最近成功备份为scheduled run 168。未登录`rbac.myPermissions`继续返回HTTP 401。生产验收只下载HTML/JavaScript和调用公开只读health/未认证权限查询，没有发送任何mutation，没有创建或修改员工、部门、路由权限及其他业务数据，旧Manus TiDB连接、读取、恢复为0。

## 2026-08-29 — 侧边菜单业务归类重组与采购部新增（本番反映前）

根据用户截图标注，将`LCJ Brain（BD引擎）`从商务部移入“我的工作”，将`TikTok竞品日报`从短视频运营部移入运营部，将博客管理、推荐码管理、步骤邮件、发送记录、邮件分析从短视频运营部移入商务部。推荐码管理原有`adminOnly`限制、全部既有路径、图标与中日文标签保持不变；短视频运营部保留短视频矩阵。

新增独立`采购部 / 調達部`，放在运营部之后、商务部之前。采购部包含库存管理`/master/selection-center?tab=products`、样品管理`/master/sample-requests`、成本管理`/master/selection-center?tab=cost-management`、到货需求`/master/product-requests`。库存与成本入口复用SelectionCenter现有商品库存和成本管理tab，没有新建重复页面、API或数据表。为确保在同一页面连续点击库存/成本也能正确切换，Dashboard菜单活动项与SelectionCenter activeTab改为响应Wouter search；基础`/master/selection-center`页面权限继续覆盖两个tab入口，带查询参数的专属权限不会反向扩大到其他tab。

| 本番前验证 | 结果 |
|---|---|
| 管理菜单Vitest | 6/6通过 |
| 查询参数高亮与权限边界 | 通过 |
| 目标esbuild | adminMenuConfig、DashboardLayout、SelectionCenter全部通过 |
| Chromium真实组件回归 | 中文桌面、日文移动、繁中、英文、采购深链接、受限员工共6/6通过 |
| 采购深链接 | 库存→成本→库存连续切换，URL、活动菜单、活动tab一致 |
| 浏览器页面错误 | 0 |
| `git diff --check` | 通过 |
| 数据库、schema、migration、server、tRPC、员工部门归属 | 无修改 |
| 本地浏览器回归 | 所有tRPC请求本地拦截，生产请求0、生产写入0 |
| 旧Manus TiDB | 连接、读取、恢复均0 |

本次仅修改共享菜单配置、Dashboard查询参数传递、SelectionCenter tab同步及对应单元测试；业务数据和权限记录均未创建、删除或更新。

### 菜单业务归类生产部署与只读验收

业务提交`87102f93`已推送至`main`，GitHub状态与Railway部署均为success。生产`/master`与JavaScript资源返回HTTP 200，生产bundle内分组顺序为`my-work → operations → procurement → business → influencer → ads → it → design → finance → hr → short-video`。按分组字节边界逐项检查12个关键菜单归属全部通过：LCJ Brain在我的工作，TikTok竞品日报在运营部，库存/样品/成本/到货需求在采购部，博客/推荐码/步骤邮件/发送记录/邮件分析在商务部，短视频矩阵在短视频运营部；库存与成本深链接均存在。

生产系统health为true，数据库备份`healthy=true`且`schedulerStarted=true`，未登录权限接口继续返回HTTP 401。生产验收只读取HTML、JavaScript和公开只读health，没有发送mutation、没有写入任何员工、部门、权限或业务数据；旧Manus TiDB连接、读取、恢复为0。

## 2026-08-29 — 拍卖市场测试止损与重复获胜风险控制（本番反映前）

根据实际业务场景，低价拍卖继续允许用于市场测试和直播引流，但新增每轮可审计的拍卖目的、拍卖数量、单件成本、最大允许亏损和同买家限胜次数。系统实时计算总成本、安全成交底线、实际损益和已知亏损；例如单件成本¥1,400、数量100、成交¥10,000时，总成本为¥140,000、实际亏损为¥130,000。市场测试只有在明确填写允许亏损预算且实际亏损未超过预算时才显示警告；正常销售低于成本、未设置预算却亏损、或亏损超过预算时均显示高风险并要求停止确认。

重复买家规则按“同商品、同SKU、同一天”统计，经NFKC、空白压缩和大小写规范化后的同一平台显示名达到2次即预警，超过该轮限胜次数时要求主管复核。平台显示名不等同于实名身份，内部系统无法直接控制TikTok竞拍资格，也不会自动取消订单或阻止发货；本次实现为内部操作预警和复盘控制，避免虚假承诺平台级拦截。

风控字段保存在现有`auction_records.roundsJson`轮次快照中，没有新增数据库表、schema或migration。旧记录和旧Excel导入缺失风控字段时保持`auctionPurpose=unknown`以及数量、成本、预算、限胜次数为NULL，不回填、不猜测，也不把未知成本按0计算。选择现有选品商品或子SKU时，只将当前`purchasePrice`作为新轮次成本建议快照；不会反向修改商品资料，也不会改写历史拍卖。

| 本番前验证 | 结果 |
|---|---|
| 拍卖相关Vitest | 35/35通过 |
| 1400×100、成交10000 | 总成本140000、亏损130000、安全底线130000、高风险 |
| 重复获胜 | 同商品/同SKU/同日规范化名称3次，集中度100%、超过限胜1次 |
| 历史兼容 | 缺少成本的旧记录与Excel保持未知，不产生虚假利润 |
| 新增与单轮编辑 | 纯mock实际提交`auction.create`与`auction.updateRound`，五个风控字段均进入载荷 |
| Chromium真实组件回归 | 中文桌面与390×844移动端通过，页面错误0 |
| 目标esbuild | 共享风控、风控UI、SelectionCenter、auctionRouter全部通过 |
| 轻量TypeScript检查 | 新共享风控与UI组件通过；全量/SelectionCenter依赖图因既有仓库规模在内存限制下终止，未重复运行 |
| `git diff --check` | 通过 |
| 数据库schema/migration | 无修改 |
| 本地浏览器回归 | 全部tRPC请求本地拦截，生产请求0、生产写入0 |
| 旧Manus TiDB | 连接、读取、恢复均0 |

本次生产部署后只进行页面、静态资源、公开系统health、备份health和未登录认证保护的只读确认。不得在生产创建测试拍卖、修改现有获胜者、补猜历史成本或发送任何业务mutation。

## 2026-08-29 店铺营业额增长司令塔 V1
在店铺详情新增默认标签“增长司令塔”，完整保留业绩概览、店长经营、商品管理、推广活动和数据上传。新增服务端CSV导入管道，支持商品/SKU表现、订单、退款/退货、直播、达人、短视频六类数据，原文件进入对象存储，数据库保存SHA-256、不可变世代、解析质量和标准化经营行；同店铺、同数据类型、同期间只使用当前世代，避免重复计算。
新增备份门控且幂等的 `storeCommandCenterUpgrade`，在 `storeExecutionUpgrade` 后、服务监听前创建司令塔批次、标准行、SKU异常、任务详情、任务事件、SOP与规则表。升级前后均执行经验证数据库备份，不改写现有店铺、上传、任务、日报或TikTok订单数据。
规则引擎以SKU为最小对象，统一计算GMV、退款损失、净GMV、退货率、曝光、CTR、CVR与客单价；当前规则覆盖SKU退货损失异常、高曝光低点击、高点击低成交、高转化低曝光。异常按“预计净GMV影响×置信度”排序，每个负责人每天最多自动新增3项增长指令。任务必须按SOP执行并提交证据，完成动作后进入观察期，不直接算成功；后续CSV导入自动按目标指标判断有效、无效或数据不足，并保存不可变事件与执行审计。
权限在服务端执行：管理员可访问全部店铺；店铺第一/第二负责人可访问自己的店铺；其余员工必须具有店铺管理页面查看或编辑权限。CSV导入、刷新指令、任务操作与证据上传均要求编辑权限。上传限制为CSV/XLS/XLSX、单文件30MB、最多50,000行，先预览质量后人工确认导入；重复文件按SHA-256拒绝重复写入。
验证：`server/storeCommandCenter.test.ts` 8项和 `server/storeExecutionSystem.test.ts` 37项全部通过；店铺页面和完整服务端路由生产打包通过；大型既有文件只保留21行最小接入差异，新增实现均位于独立模块。

### 拍卖止损与重复获胜控制生产部署及只读验收

业务提交`d6362c6e`已推送至`main`，GitHub检查与Railway部署均为success。随后并行店铺升级提交`60a3a738`上线，拍卖提交仍是最新main的祖先且功能未回退。生产`lcjmall.com/master/selection-center?tab=auction`返回HTTP 200，当前主资源为`index-DKokN9NX.js`，动态拍卖页面资源为`SelectionCenter-CYTF5vCh.js`；16/16项风控标记均存在，包括拍卖目的、数量、单件成本、允许亏损、限胜次数、累计亏损、成本未登记、预算超限和重复获胜规则。

生产系统health为true，数据库备份`healthy=true`且`schedulerStarted=true`。未登录`auction.list`和`rbac.myPermissions`均继续返回HTTP 401，确认拍卖记录与权限接口未公开。生产验收只下载HTML、JavaScript和调用公开只读health及未登录认证检查；没有发送mutation，没有创建或修改拍卖、获胜者、成本、员工或其他业务数据。旧Manus TiDB连接、读取、恢复为0。

## 2026-08-29 — 司令塔现有三类数据桥接与真实0值行动

司令塔正式读取既有 `store_data_uploads` 的店铺数据（`shop_stats`）、商品数据（`products`）和广告数据（`ads`），不要求运营重复上传相同文件。页面显示每类来源的版本、记录数、月份及已反映指标；商品数据用于SKU经营雷达与漏斗机会，店铺数据用于总GMV/退款汇总参考，广告数据用于花费、广告GMV和ROI。订单/退款只有店铺汇总而没有SKU明细时标记为“部分可用”，不再错误显示为完全缺失，也不把缺失伪装成0。

新增真实0值规则：当曝光达到1,000以上且订单、GMV确实为0时，生成“有流量但0成交”异常和SOP；退款为0继续视为健康结果，不生成退货异常。规则明确区分真实0、字段缺失和不适用。协作执行入口从司令塔底部移动到店铺详情顶部第二行，保留直播司令塔、达人BD、短视频矩阵和商品管理四个入口，避免重复。

回归验证：司令塔与店长经营共46项Vitest通过；店铺页面与完整服务端路由生产打包通过；未新增依赖、环境变量或数据库迁移，未改写既有上传与业务数据。

## 2026-08-31 — “问题处理”从IT部移入“我的工作”（本番反映前）

根据用户指定，将共享管理菜单中的`问题处理 / 問題処理`完整对象从IT部移入`我的工作 / マイワーク`，排列在任务列表之后。路径仍为`/master/issues`，图标、中文标签、日文标签和原有路径权限语义逐字保持不变；IT部继续保留账号管理、员工账号管理和系统控制。

桌面端与移动端共用`ADMIN_MENU_GROUPS`和同一权限过滤逻辑，因此无需修改DashboardLayout、路由或问题页面。`client/src/App.tsx`中的`/master/issues`路由保持不变，没有修改问题记录API、问题数据、员工权限记录、数据库schema或migration。

| 本番前验证 | 结果 |
|---|---|
| 管理菜单Vitest | 6/6通过 |
| 菜单总数与路径唯一性 | 59项、无重复 |
| 低内存esbuild | adminMenuConfig通过 |
| 中文桌面 | 问题处理在我的工作，IT部不再包含 |
| 日文移动 | 問題処理在マイワーク，IT部不再包含 |
| 繁中/英文回退 | 分组与日文标签顺序通过 |
| 直接访问`/master/issues` | 页面渲染、菜单高亮和我的工作归属通过 |
| 受限员工 | 仅授予`/master/issues`时，只显示我的工作与问题处理 |
| 浏览器页面错误 | 0 |
| `git diff --check` | 通过 |
| 数据库、问题记录、员工权限、其他业务模块 | 无修改 |
| 本地浏览器回归 | 全部tRPC响应本地拦截，生产请求0、生产写入0 |
| 旧Manus TiDB | 连接、读取、恢复均0 |

生产部署后仅检查静态资源分组边界、页面HTTP、公开系统/备份health及未登录接口保护，不发送问题创建、编辑、删除或任何业务mutation。

### 问题处理菜单换组生产部署与只读验收

业务提交`ce15b9c1`已推送至`main`，GitHub检查与Railway部署均为success。随后并行品牌移动端修复提交`cef6a582`上线，问题处理菜单提交仍是最新main的祖先且功能未回退。生产`/master/issues`与当前JavaScript资源均返回HTTP 200；按生产bundle的菜单分组字节边界检查，`/master/issues`菜单定义只出现于`my-work`与下一个`operations`之间，在`it`与`design`之间为0。中文`问题处理`和日文`問題処理`标签均存在，独立问题页面路由注册继续保留。

生产系统health为true，Railway MySQL备份`healthy=true`且`schedulerStarted=true`。未登录`issueTracker.list`与`rbac.myPermissions`均返回HTTP 401，确认菜单换组没有放宽问题数据或权限接口。生产验收没有发送创建、编辑、状态变更、删除等mutation，没有修改任何问题记录、权限、员工或其他业务数据；旧Manus TiDB连接、读取和恢复为0。

## 2026-08-31 — LCFブース预约管理后台实时同步修复（本番反映前）

用户反馈LCF管理后台看起来没有同步最新预约。只读核对生产公开占用矩阵、用户截图和代码后确认，个人页、公开占用接口与管理后台均读取同一张`lcf_booth_reservations`表，不存在旧表或数据库分叉。当前生产有16个有效占用枠，和截图中的16条绿色有效预约逐项一致。T22是合法展位；正式16个编号为T1–T4与T13–T24。

根因是后台同步体验而非数据丢失：旧页面30秒轮询、没有最后同步时间或错误提示、没有手动刷新、默认混合有效和已取消历史，并按活动时间排序，导致新预约不会出现在列表顶部。修复后管理后台每5秒自动刷新且后台标签页继续刷新，窗口重新聚焦时强制更新，提供“今すぐ同期”、最后同步时间与明确错误状态；默认只显示有效预约，并可切换结束/取消或全部历史；默认按最新受付顺序显示，也可切换利用时间顺序。后台新增UTC毫秒受付时间，避免MySQL时间字符串的浏览器时区差异。所有`boothReservation.*`接口统一返回`no-store/private/max-age=0`及兼容的禁止缓存头。

本次未修改、删除、取消或迁移任何预约数据，未新增依赖、环境变量或数据库迁移。预约策略、二维码安全、密码恢复和报名体验共41项Vitest全部通过；LCF管理后台页面和完整服务器入口分块生产打包通过。现有服务器打包仍报告与本次无关的`receiptMaskingService.ts`旧`sharp`导入警告，未在本任务越界修改。

## 2026-08-31 — 短视频日报（日链接・互动・转化・GMV）新增（本番反映前）

在短视频运营部新增`短视频日报 / 短動画日報`，路径`/master/short-video?tab=daily`。日报与短视频矩阵共享`/master/short-video`角色权限，但使用独立`short_video_daily_entries`、审计日志和升级状态表；既有`svm_video_posts`不迁移、不改写，也不被伪装为日报。每条链接保存一行，发布条数由有效链接数计算；默认东京时间昨天，允许补录今天和过去日期，服务端拒绝未来日期。字段包括日期、链接、账号、HR在职制作人、播放、点赞、评论、分享、收藏、商品点击、订单、GMV币种/金额及备注。

互动率=`(点赞+评论+分享+收藏)/播放`，点击率=`商品点击/播放`，点击转化率=`订单/商品点击`；点击为0时不虚构点击转化率。月度GMV按JPY与CNY分别汇总，不无依据相加；发布、播放和订单可跨币种合计。页面支持月、制作人、账号、币种和关键词筛选，以及日别、制作人别汇总。

服务端查看需要`canView`或`canEdit`，新增、编辑、软删除必须`canEdit`；管理员旁路。制作人保存`staffId+姓名快照`，链接规范化后以数据库有效链接唯一键防止并发重复；软删除保留行和不可变审计并释放URL。Railway MySQL升级在监听前执行，包含独立状态、业务行指纹核对及`pre/post-short-video-daily-v1`加密备份门控，异常时拒绝服务就绪。旧TiDB禁止连接。

| 本番前验证 | 结果 |
|---|---|
| 业务规则、RBAC、schema健康、菜单Vitest | 18/18通过 |
| 多链接新增 | 2条链接及互动/转化/GMV完整进入`createBatch` |
| 单条编辑/软删除 | `update`与`delete`通过；点赞80→88准确 |
| 月汇总 | 2条、1,500播放、5订单、JPY 15,500 |
| 中文桌面/日文移动 | 通过；390px横向溢出0 |
| 只读员工 | 无新增、编辑、删除控件 |
| 低内存打包 | 共享规则、路由、升级、完整server与页面通过 |
| 浏览器页面错误 | 0 |
| 本地tRPC | 全部拦截；生产请求/写入0/0 |
| 旧TiDB | 连接、读取、恢复0 |

生产部署只创建空表，不创建虚构视频、员工、互动、订单或GMV。上线后只读核对资源、schema、行数、审计、备份和401，不调用日报mutation。

### 短视频日报生产部署与只读验收

业务提交`0fa6ed53`已推送到`main`，GitHub检查和Railway部署均成功。生产入口`/master/short-video?tab=daily`返回HTTP 200；入口bundle与`ShortVideoMatrix`动态chunk的菜单、中文/日文标签、次日填写说明、多链接、制作人、点击转化、JPY/CNY和月度汇总等16/16标记全部存在。已登录生产页面成功读取新表并显示空历史：发布0、播放0、订单0、JPY/CNY GMV均0，证明升级完成且没有伪造历史记录；验收未点击填写、保存、编辑或删除。

生产`system.health.ok=true`。Railway MySQL备份健康且调度已启动，最近成功备份为`post-short-video-daily-v1`，完成时间`2026-08-31T03:02:36Z`，覆盖420张表、218,600行；部署前后业务指纹门控通过。未登录`shortVideoDaily.list`、`shortVideoDaily.access`和`rbac.myPermissions`均返回401，确认页面上线没有放宽数据或角色权限。生产日报mutation 0、业务写入0，旧TiDB连接/读取/恢复0。

## 2026-08-31 — 短视频账号每日销售与视频互动完全分区（本番反映前）

根据用户反馈，单条视频次日采集到的播放与互动会继续变化，账号整日订单和GMV也无法准确归因到某一条视频。页面因此拆成两个独立事实分区：上方`账号每日GMV、订单数 / アカウント日次GMV・注文件数`是积分和绩效的唯一销售来源；下方`视频互动次日快照 / 動画エンゲージ翌日スナップショット`只记录链接、制作人、账号及播放、点赞、评论、分享、收藏、商品点击。

新增`short_video_account_daily_sales`及不可变审计表，保存日期、账号与负责人ID/姓名快照、订单、GMV、JPY/CNY和数据来源备注。数据库唯一键`uq_short_video_account_sales_active_day`确保同一有效账号同一天只有一条记录，升级健康门禁也验证该索引；缺失时拒绝服务就绪。月度销售按日期、账号、负责人分拆，JPY与CNY分别显示，不换算、不混加。

旧`short_video_daily_entries.orders/gmv/currency`列与已有值不删除、不清零、不迁移。视频新建/编辑接口不再接受这三个字段，视频月汇总不查询旧销售列，页面不展示旧销售值；因此保留旧证据但不会重复计入绩效。账号销售新表从空数据开始，只允许依据真实账号后台填写。

Railway MySQL v2升级使用`pre-short-video-account-daily-v2`与`post-short-video-acct-daily-v2`独立加密备份、幂等建表、双分区迁移前后业务指纹和结构/唯一索引健康门禁。业务规则、RBAC、schema、唯一索引和菜单测试21/21通过；共享指标严格TypeScript与6个目标模块低内存打包通过。纯mock浏览器覆盖账号销售create/update/delete及视频createBatch，确认视频载荷不含`orders/gmv/currency`；中文桌面、日文390px移动、只读权限均通过，页面错误0、横向溢出0。mock旧视频`¥12,000/¥3,500`未显示、未计入绩效。全仓库类型图在768MB堆上因仓库规模OOM，未重复触发，以定向严格类型、打包、单元与真实React交互回归替代。

本番前生产请求0、业务写入0，旧TiDB连接/读取/恢复0。上线后只执行资源、schema、唯一索引、空表或现存数据指纹、备份与401只读验收，不调用任何日报mutation。

### 首次Railway部署失败、备份标签与服务就绪修复

业务提交`4bc44131`首次Railway部署在约7分钟后标记失败。只读证据显示生产仍由旧版本正常服务：`system.health.ok=true`、新账号销售资源标记0、新未登录接口为404；Railway MySQL已经成功完成`pre-short-video-account-daily-v2`备份run 177（420表、218,687行），但没有迁移后备份。进一步核对发现旧迁移后reason `post-short-video-account-daily-v2`为33字符，而`db_backup_runs.reason`仅允许32字符；MySQL严格模式会在备份run写入时拒绝该值，启动升级因此失败，Railway随后在健康时限结束时标记部署失败。旧生产没有中断，也未产生日报业务写入。

修复后继续将迁移前备份、schema/唯一索引健康和双分区业务指纹作为服务监听前硬门禁；迁移后全库备份改为门禁通过后立即异步执行，成功ID/完成时间或失败原因回写迁移审计，公开备份健康继续监控。迁移后reason缩短为30字符的`post-short-video-acct-daily-v2`，并新增前后reason均不超过32字符的回归测试。重试复用已成功的迁移前备份，幂等创建表并核对业务指纹，不重新修改旧视频行。修复后22/22测试、升级模块与完整服务器入口低内存打包、差异检查通过；完整服务器打包仅保留与本任务无关的既有`receiptMaskingService.ts` sharp导入警告。

### 账号每日销售双分区生产验收

补丁提交`e74c96a9`于`2026-08-31T04:17:09Z`Railway成功，最终备份标签提交`edfefb84`于`2026-08-31T04:26:11Z`Railway成功。生产`ShortVideoMatrix`动态资源包含12/12账号销售与视频互动分区标记，`system.health.ok=true`；未登录`shortVideoAccountDaily.list`、`shortVideoDaily.list`和`rbac.myPermissions`均返回401，页面上线没有放宽数据或角色权限。

迁移后加密备份run 178以`post-short-video-acct-daily-v2`成功完成，时间`2026-08-31T04:26:20Z`，覆盖422张表、218,731行并有SHA-256校验；备份health为`healthy=true`、调度已启动且`backupRunning=false`。生产验收仅下载HTML/JavaScript、调用公开health和未登录认证检查，没有发送日报mutation；账号销售、视频互动及其他生产业务写入0，旧TiDB连接/读取/恢复0。认证浏览器页面数据查询超时，因此没有把超时误报为空表或推断真实行数。

## 2026-08-31 — 店铺退款损失/退货率缺失误显示为0修复（本番反映前）

用户指出`/master/store-management`中商品/SKU经营雷达的退款损失与退货率全部显示0。审计确认：KYOGOKU JAPAN 2026年7月的高可信历史证据只有店铺GMV `¥98,372,339`与店铺退款总额`¥35,217,297`，没有商品/SKU退款金额、退款件数或原因；旧商品CSV只有GMV、成交件数、订单、曝光与点击。规范化层此前把“退款列不存在”与“退款列存在且值为0”都转成数值0，前端因此错误显示`¥0 / 0.0%`。

修复在`storeCommandCenterPolicy`增加原始字段存在性标记，并贯穿Railway MySQL统一行、SKU聚合与dashboard返回。商品/SKU只有在退款金额或件数列真实存在时显示数值；列不存在、空白或`—`时分别显示“未匹配”和“数据不足”。原始列明确为0时仍显示`¥0 / 0.0%`。退货件数率只在退款件数证据覆盖且分母存在时计算，自动任务验证也不再把`null`转成0。

新增店铺退款对账：店铺退款总额、稳定商品ID/SKU ID已归属金额、未分配金额、覆盖率及明细高于店铺汇总的口径冲突。店铺退款金额率定义为`退款金额 ÷ GMV`，KYOGOKU JAPAN证据值为`35.8%`；不再把该金额比率称为退货件数率。没有稳定商品/SKU ID时禁止仅凭商品名称模糊归因，店铺总额也绝不按GMV、销量或订单比例平均分摊。页面提供“补充退款明细”入口，只切换到现有退款CSV导入类型，不自动写入数据。

兼容旧店铺汇总时，服务端优先使用有证据的店铺GMV/退款总额，商品明细仅用于归属对账，不再以商品缺失字段的0覆盖店铺真实退款。店铺详情移动端同时修复不换行头部和CSS Grid默认最小宽度造成的整页476px溢出，390px视口最终页面宽度为390px；商品表保留容器内横向滚动。

店铺相关测试58/58通过，其中退款策略13项覆盖缺失/真实0、35.8%金额率、部分匹配、过度归属、无稳定ID拒绝归属与数据不足验证；四个目标模块低内存打包、差异卫生通过。纯mock真实React桌面/移动回归确认未分配退款`¥35,217,297`、SKU未知与真实0显示差异、补充明细按钮和移动无溢出；页面错误0。生产请求0、生产业务写入0、旧TiDB连接/读取/恢复0。本次不新增数据库表、不修改schema、不改历史店铺、商品、退款或导入数据。

### 店铺退款率生产部署与只读验收

业务提交`7b0baa0f`已推送到`main`，GitHub/Railway状态成功。生产`/master/store-management`返回HTTP 200，入口bundle指向`StoreManagement-BjuOJDGq.js`；动态资源中的退款明细归属、退款金额率、退货件数率、未分配到SKU、数据不足、补充退款明细、导入定位和对账模型8/8标记存在。

生产`system.health.ok=true`，Railway MySQL备份健康、调度已启动且当前无备份运行，最近成功备份仍为run 178 `post-short-video-acct-daily-v2`。未登录`storeCommandCenter.dashboard`与`rbac.myPermissions`均返回401，确认上线没有放宽店铺数据或角色权限。认证浏览器的数据加载在25秒内超时，因此没有把超时误报为空数据；生产验收以静态资源和GET只读接口为证据，没有执行上传、导入、编辑或任何mutation。生产业务写入0，旧TiDB连接/读取/恢复0。

## 2026-08-31 — 品牌司令塔电脑版宽屏比例调整（本番反映前）

用户指出`/master/brands`在电脑版内容区偏窄、左右留白过大，顶部按钮和品牌卡比例失衡。根因是移动端优化后外层仍固定`max-w-7xl`约1280px，顶部在`xl`切为flex但四个子按钮继续使用`w-full`，七张KPI却使用八列网格，品牌卡在所有大屏均固定三列。

本次仅修改`BrandList.tsx`响应式Tailwind类：外层最大宽度调整为1760px；1920px视口内容实测1760px、利用率91.7%，顶部四个操作在760px区域内等宽四列，七张KPI单行七列，品牌卡四列。1440px保持三列品牌卡及单行四操作/七KPI；1024px采用2×2顶部操作、四列KPI和两列品牌卡，避免长品牌名与GMV被三列压缩；390px继续2×2操作、两列KPI和单列卡片。筛选区在宽屏采用`200px + 200px + 自适应搜索 + 操作`网格，卡片链接和内容统一全高。

静态布局与品牌排序测试15/15通过，低内存BrandList打包通过。纯mock真实React回归覆盖1920、1440、1024和390四个视口，documentWidth均等于viewportWidth，页面错误0；生产请求0、生产业务写入0、旧TiDB连接/读取/恢复0。修改文件仅`BrandList.tsx`和对应布局测试，不改品牌查询、排序、GMV、合同、飞书同步、合并、删除、路由、权限、schema或任何数据库数据。

## 2026-08-31：直播福袋图片（创建、编辑、替换、删除）

`/liver/record` 的每个福袋/套组现在支持独立 JPEG、PNG、WebP 图片，单张最大 8MB；保存前复用现有安全对象存储上传，数据库仅保存 `imageUrl` 与 `imageKey`。`livestream_sets` 新增两个可空字段，历史记录无需内容回填；启动前由 `livestreamSetImageUpgrade` 执行幂等检查、前后备份、行数/最大ID/总套组销售额指纹核对与失败记录。

创建接口和后续套组编辑接口同时校验图片 URL/Key 必须成对出现，且 Key 必须属于该直播主播的 `livestreams/{liverId}/` 路径。后续编辑支持查看、替换、删除图片，只读直播详情显示福袋图片。套组批量编辑已改为数据库事务，并新增直播所有权校验，避免删除旧套组后写入失败造成数据丢失或越权修改。关联修复：空销售数量回退为 1，用户明确输入 0 时仍保留 0。

回归覆盖8个直播相关测试文件，共72项通过；创建页、详情页和服务端生产级打包通过。全项目 `tsc` 在沙箱中被资源限制终止，未输出代码类型错误；相关入口已用专项测试与生产打包覆盖。

### 品牌司令塔电脑版比例生产部署与只读验收

业务提交`89fac82b`已推送到`main`并由Railway成功部署。其后并行直播套组图片提交`aab3d729`再次成功部署；该提交未改动`BrandList.tsx`，最新生产入口`index-icsDhW56.js`引用`BrandList-5N46mFTc.js`，动态资源中的1760px容器、760px四操作、七列KPI、宽屏筛选、1024两列/1440三列/1920四列品牌卡和等高卡片8/8标记仍全部存在，确认后续部署没有覆盖本修复。

生产`/master/brands`和不可变动态资源均返回HTTP 200，`system.health.ok=true`，Railway MySQL备份健康且调度已启动。既有公开只读`brand.list`保持HTTP 200，未登录`rbac.myPermissions`保持401；本次样式修改没有接触任何路由或权限代码。生产验收只下载HTML/JavaScript、调用公开只读health和未登录认证检查，没有点击同步、创建、合并、删除或发送任何mutation；品牌、GMV、合同及其他生产业务写入0，旧TiDB连接/读取/恢复0。

## 2026-08-31 — 朝会麦克风权限恢复（本番反映前）

用户在`/master/morning-meeting`点击个人朗读录音后看到原始`Permission denied`且无法继续。生产HTTPS响应已确认包含`Permissions-Policy: microphone=(self)`，服务器没有禁止同源麦克风；根因是浏览器或操作系统拒绝/占用麦克风时，前端`friendlyRecordingError()`直接显示原始错误文字，无法告诉员工应该修改网站权限、系统权限还是检查设备。

本次新增共享麦克风诊断模块和中日文恢复卡，个人朗读与团队早会均统一执行安全上下文、`getUserMedia`和`MediaRecorder`预检；区分权限拒绝、无设备、设备占用、约束不兼容、请求中断、浏览器不支持及未知错误，并显示稳定诊断代码。权限拒绝不会自动循环弹窗，员工按三步说明修改网站/系统权限后，点击“重新检测并录音”才再次请求；优化音频约束不兼容时仅自动退回一次基础`audio:true`。成功后沿用原有MediaRecorder、个人/团队上传、S3、参会人员和历史记录流程。同步修正一项已过期测试，使其符合此前用户明确取消最低录音时长的现行业务规则；生产逻辑未改。

麦克风与朝会测试26/26通过，共享模块严格TypeScript检查和三个目标低内存打包通过。纯mock真实React浏览器回归覆盖中文权限拒绝后用户重试并完成1秒个人录音保存、日文390px设备占用、无麦克风和约束自动回退；个人保存tRPC载荷在本地被拦截，页面错误0、横向溢出0、生产请求0、生产业务写入0、旧TiDB连接/读取/恢复0。此次不修改server路由、权限、schema、数据库、已有录音或朝会参与数据。

### 朝会麦克风恢复生产部署与只读验收

业务提交`501f6ece`已推送到`main`，GitHub检查与Railway部署均成功。生产`/master/morning-meeting`返回HTTP 200，响应头为`Permissions-Policy: camera=(self), microphone=(self), geolocation=()`；同源麦克风被允许，地理位置仍禁用。当前入口`index-C2jmL1-K.js`加载`MorningMeeting-jNdYfCnL.js`，权限拒绝、设备占用、无设备、中日文重新检测与稳定诊断属性8/8标记存在，原始`Permission denied`不再出现在朝会动态资源中。

生产`system.health.ok=true`，Railway MySQL备份健康、调度已启动且无备份运行，最近成功备份为run 180 `post-livestream-set-image-v1`。未登录`morningMeeting.getTodayDailyRecordings`与`rbac.myPermissions`均返回401，确认修复没有放宽朝会或角色权限。验收仅下载HTML/JavaScript、读取公开健康和未登录认证结果，没有请求麦克风、点击录音、上传音频或发送任何mutation；生产业务写入0，旧TiDB连接/读取/恢复0。

## 2026-08-31 — TikTok竞品日报空白模板移除点击率与转化率

用户要求保留`/tiktok-competitor-daily`的“下载空白模板”按钮，但从新下载的Kalodata模板中删除`点击率`和`转化率`两列。本次将空白模板表头提取为共享常量，新模板固定为13列：店铺排名、店铺ID、店铺名称、店铺链接、商品排名、商品ID、商品名称、商品链接、原价、直播成交价、销量、销售额、热度表现。文件名`Kalodata_日本区竞品日报_日期.xlsx`、工作表名`Kalodata排名`和按钮行为不变。

旧Kalodata文件解析器及数据库字段未删除，已包含点击率或转化率的历史文件仍按原逻辑解析；新模板缺少两列时两个指标保持`null/无数据`，不按0评价。实际XLSX内存生成、写盘与回读确认13个表头且两列不存在；新模板和旧模板解析兼容、同日多批次与比较回归共18/18通过，页面低内存打包和差异卫生通过。此次不修改tRPC、schema、数据库、历史日报、页面手工编辑或既有点击率/转化率数据；生产业务写入0，旧TiDB连接/读取/恢复0。

### TikTok竞品日报模板生产部署与只读验收

业务提交`b6198134`已推送到`main`，GitHub检查与Railway部署均成功。生产`/tiktok-competitor-daily`返回HTTP 200，当前入口`index-C6W6VQNY.js`加载`TiktokCompetitorDaily-D5XG5qC5.js`；动态资源中“下载空白模板”仍存在，新13列表头完整存在，旧`销售额→点击率→转化率→热度表现`模板序列不存在。实际下载结构已由同一表头常量生成并回读验证。

生产`system.health.ok=true`，Railway MySQL备份健康、调度已启动且无备份运行，最近成功备份为run 180 `post-livestream-set-image-v1`。未登录`tiktokCompetitorDaily.taskStatus`与`rbac.myPermissions`均返回401。验收只下载HTML/JavaScript并读取公开健康和未登录认证结果，没有上传文件、保存日报或发送任何mutation；生产业务写入0，旧TiDB连接/读取/恢复0。

## 2026-08-31 — 短视频日报：公开TikTok多账号自动监控（本番反映前）
在`/master/short-video?tab=daily`新增与人工销售日报完全分离的“公开TikTok账号自动监控”。管理员或具有短视频日报编辑权限的员工可批量粘贴最多100个`@用户名`或TikTok主页链接，暂停/恢复单账号监控并立即同步；页面展示公开头像、简介、粉丝、关注、总获赞、视频数、最后成功时间、下次同步、错误状态，以及当月自动发现视频的封面、链接、发布时间、时长、播放、点赞、评论、分享、收藏和相较首次小时快照的增长。公开指标只写入新建的账号/视频/小时快照/同步运行表，绝不写入`short_video_daily_entries`或`short_video_account_daily_sales`，订单、GMV、商品点击仍只由原人工区域维护。

服务端仅从`RAPIDAPI_KEY`读取RapidAPI TikTok Scraper（固定host `tiktok-scraper7.p.rapidapi.com`），密钥不进入前端、Git、URL、数据库或日志。同步按顺序请求公开账号与最近35条视频，再短事务UPSERT；外部网络等待期间不占数据库连接，视频采用`(accountId, externalVideoId)`唯一约束和`LAST_INSERT_ID`避免逐条二次SELECT。自动频率为新视频72小时内6小时、7天内12小时、之后24小时，失败6小时重试；唯一GitHub Actions工作流每小时唤醒一次并通过数据库到期时间筛选（实际账号仍按6/12/24小时动态间隔调用RapidAPI），重复回调使用原子领取避免同账号并发抓取。定时端点仅接受GitHub签发的短期OIDC令牌，并严格验证当前仓库、主分支、指定工作流和受众；不新增静态密钥，现有本地用户登录流程完全不变。

数据库升级采用幂等健康检查与前/后强制备份门控；前备份未成功前不执行建表或ALTER。专项和回归测试39/39通过，覆盖账号解析/去重、非TikTok链接拒绝、字段别名、动态频率、provider成功/失败和密钥脱敏、GitHub OIDC仓库/分支/工作流claims、迁移健康/备份顺序/账号内唯一、网络与事务顺序、订单GMV隔离、原短视频日报及并行竞品模板。短视频日报前端入口与服务器入口低内存esbuild均通过，`git diff --check`通过；全量`tsc`和Vite在大型仓库8279模块转换后受当前沙箱资源/时限终止且未输出代码错误，待Railway生产构建继续复核。尚未登记或同步任何真实TikTok账号，生产公开数据写入0。

### 公开TikTok监控首次部署回滚与根因修复
首次功能提交`d1a8625`由Railway构建成功后，线上已登录只读验收发现`TikTokPublicMonitor`读取`data?.access.canEdit`时，dashboard响应尚未包含`access`，触发`ERR_LCJ_UI_RENDER`并影响整个短视频日报。按重大故障规则立即提交`e6a964b`完整revert并推送，Railway回滚成功后复核原账号日销售与人工视频快照页面恢复正常，期间未进行任何生产mutation或真实TikTok采集。

根因修复为双重保护：dashboard路由现在显式返回复用的短视频日报`access`对象，前端改用`data?.access?.canEdit`空值安全读取，即使旧缓存或异常响应缺少权限对象也不会导致整页崩溃；新增永久回归测试锁定这两项契约。修复并切换OIDC调度后专项及相关回归39/39通过，前端日报入口、服务器入口打包和差异检查通过。后续重新部署已完成线上已登录视觉验收；持久调度改为当前仓库唯一GitHub Actions OIDC工作流，避免依赖该Railway旧项目没有的平台Heartbeat配置。

### 公开TikTok首次真实采集的429保护修复
用户明确授权启用`bbrigldkdvb`、`itoryuichi`、`wwraauajt2u`、`yamatass11`四个现有账号。四个账号均已从暂停切换为监控启用；在只对第一个账号执行首次采集时，RapidAPI返回HTTP 429，系统按设计记录失败并将该账号安排到6小时后重试，其他三个账号未继续手动采集。为避免自动调度在修复前重复消耗请求，已临时禁用唯一的`TikTok Public Monitor`工作流。

根因是单账号资料与视频接口原先通过`Promise.all`同时发起，而且到期账号以3个并发批次同步，容易触发RapidAPI瞬时限流。修复后所有RapidAPI请求经过全进程串行队列且间隔至少1250毫秒；资料与视频接口、多个到期账号均严格顺序执行，首次遇到HTTP 429立即终止该轮账号队列。只有provider明确返回不超过20秒的`Retry-After`时才重试一次；429错误会区分`rate limited`与`request quota exhausted`，不会记录响应体、请求头或密钥。专项及相关回归41/41通过，服务器入口低内存打包和差异检查通过。待Railway部署完成后将只重试一个账号，根据真实结果决定是否继续其余账号并恢复调度。
## 2026-08-31 — Android LINEログイン `LINE-STATE-EXPIRED`・会員セッション修復

Android利用者がLINE認証後に`/line-callback`で`LINE-STATE-EXPIRED`となり、メールログインで別の会員行へ入ると従来ポイントが表示されない事象を調査した。根本原因は、Expressに`cookie-parser` middlewareがない構成であるにもかかわらず、LINE stateと`line_session`を`ctx.req.cookies`だけから読んでいたことだった。本番read-onlyプローブでも、`getLoginUrl`が正しいHttpOnly state Cookieを返している一方、同じCookieとstateをcallbackへ返しても外部token交換前に「有効期限切れ」と誤判定されることを再現した。

`server/requestCookies.ts`を追加し、既存`cookie`パッケージで生の`Cookie` headerを安全に解析する共通関数を実装した。LINE callbackの`line_login_state`と、LINE／メール共通の`line_session`をこの関数で読むよう修正し、既存の事前解析済み`req.cookies`互換と署名Bearer fallbackも保持した。state不一致は引き続き外部LINE API呼出前に拒否する。一次性のLINEログインURLには`Cache-Control: no-store, private, max-age=0`と`Pragma: no-cache`を付与し、Androidで古いstateを再利用しないようにした。クライアントはLINE認証開始を`window.location.replace`へ変更し、戻る操作で古いcallbackへ再進入する経路を除いた。

今回の修復は、元のLINE user IDで既存会員行・ポイントキー・履歴へ再接続するものであり、パスワード一斉再送、メール会員との自動merge、ポイント移転・再付与、新規会員作成は行わない。メールで新しく入ったアカウントの残高が0でも、元LINEアカウントのポイントが消えた証拠にはならないため、本人確認なしの合算はしない。

回帰は、Cookie header decode、state一致／不一致、外部交換前拒否、no-store、署名token、メール認証、会員identity claim、LINE link、point key・履歴・restrictionを含む13ファイル124件が合格した。Android相当390×844のChromiumでLINE／メール入口、同じLINEでポイント・履歴へ再接続する案内、`LINE-STATE-EXPIRED`再試行画面、横overflowなしを確認した。対象client/serverのesbuildにも成功した。本番DB・S3へのテスト書込み、会員・ポイント・注文・履歴の変更は0件で、旧Manus TiDBには接続していない。

### 公开TikTok四账号首次采集与自动调度生产验收
限流修复提交`c2c0f41`已推送并由Railway成功部署。部署后先单独重试`bbrigldkdvb`，确认资料与视频请求成功，再依次采集`itoryuichi`、`wwraauajt2u`、`yamatass11`；四个账号均显示“正常”，限流修复后没有再次出现HTTP 429。首次账号快照分别为：`bbrigldkdvb`粉丝26/关注11/总赞87/公开视频23，`itoryuichi`粉丝27/关注5/总赞406/公开视频92，`wwraauajt2u`粉丝65/关注17/总赞453/公开视频83，`yamatass11`粉丝32/关注9/总赞290/公开视频69。2026-08页面共展示91条自动发现公开视频、当前播放合计74,825，头像、简介、封面、链接、发布时间、时长、播放、点赞、评论、分享、收藏和首次快照增长均已实际显示；初次采集增长为0符合基线语义。

唯一`TikTok Public Monitor` GitHub Actions工作流已恢复启用；OIDC手动验收run `33378329197`成功，因四账号均未到期，回调返回`processed:0, results:[]`，确认不会在未到期时重复调用RapidAPI。最终复核发现固定每6小时cron会因执行相位与账号完成时间不一致，使6小时动态到期最多额外延后近6小时；因此将工作流改为每小时23分唤醒，数据库`nextPublicSyncAt`仍是唯一抓取门控，未到期账号保持零RapidAPI调用，已到期账号最迟约1小时内执行。原人工账号日销售区域仍为4个账号日、58单、JPY 197,700，分账号订单与GMV均保持原值，确认公开监控没有写入或重算订单、GMV、商品点击。生产页面无渲染错误，四账号下一次同步时间均为日本时间2026-09-01 00:31至00:33。

## 2026-08-31 — TikTok竞品日报：系统空白模板填数后重新上传识别一致性修复
用户确认问题文件正是页面“下载空白模板”生成后填入的数据。根因不是字段填写错误，而是该工作簿用合并单元格表示同一店铺的多条商品：SheetJS默认只读取合并区域左上角，导致后续商品行丢失店铺ID、名称与链接，15条数据被误判为“识别7行/排除8行”。同时浏览器使用空字符串、服务器使用null生成行摘要，存在预览数据与上传凭证不一致的潜在保存故障。

新增前后端共用的合并单元格展开器，只在工作簿明确声明的merge范围内复制左上角值，不盲目向下填充，因此不会把独立的BIOAESTECH行误归到トキバナ。浏览器预览和服务器文件校验统一使用同一解析器与null空值，行SHA-256一致；预览新增13列逐行明细，完整显示店铺排名、店铺ID、店铺名称、店铺链接、商品排名、商品ID、商品名称、商品链接、原价、直播成交价、销量、销售额、热度表现，缺失值显示“无数据”而不是0。针对Excel长数字ID优先从Kalodata链接的`id`参数恢复精确值，避免单元格显示精度导致ID尾数错误。

使用用户原文件`Kalodata_日本区竞品日报_2026-08-31.xlsx`只读验证：前后端均得到15行且摘要一致，识别15行、排除0行、6家实际店铺、15件商品；トキバナ2件与BIOAESTECH1件仍按文件中的不同店铺名称分开，未错误合并。8个竞品相关测试文件共43/43通过，覆盖模板merge展开、独立行保护、浏览器/服务器往返摘要、13字段预览、长ID恢复、旧模板兼容、批次追加/回滚/权限；竞品前端页面和服务器入口esbuild均通过。Railway部署后在生产页面上传用户同一文件仅执行预览，实际显示识别15行、排除0行、13列共15条；未点击“保存为独立批次”，页面仍为0个已保存批次、0份日报，生产数据写入0。

## 2026-08-31 — 选品中心商品表智能识别与安全批量导入（本番反映前）

根据用户提供的Kalodata商品XLSX，在`/master/selection-center?tab=products`既有「AI識別」按钮中增加双入口：原图片AI识别保持不变，新建「表格智能识别 / 商品表を認識（無料）」支持CSV、XLSX、XLS。表格流程使用服务端确定性表头别名映射，不调用LLM或任何付费AI；限制单文件10MB、最多2,000个源数据行、单次确认最多500件。文件仅在当前请求内解析，不上传S3、不永久保存原表，也不写入日志。

用户提供的真实Kalodata样本工作簿离线验证得到`LIST_PRODUCT`工作表、200个源行与200个商品候选，200个TikTok商品ID均从证据列/链接稳定恢复。179件为单一价格，21件为价格区间；区间不选择最低价或最高价，商品价格保持空白。源文件品牌、SKU、条码、库存列均为0，因此系统不会从商品名猜品牌、不会生成SKU/条码，库存以0且状态为草稿保存；用户必须在预览中逐行或批量指定品牌后才能确认。销量、GMV、评分只作预览参考，不冒充商品主档、库存或价格数据。

预览按商品ID优先、商品名+品牌其次核对现有商品，已存在项目默认禁选；同名但品牌未确定时仅提示人工确认。确认导入携带原文件SHA-256与行键，服务端重新解析原文件并拒绝哈希或行键不一致，事务内再次锁定读取现有商品以防并发重复。新商品统一写入`draft`，整批插入失败即回滚；无SKU证据时`skuVariants`保持空数组。既有165件商品不会在预览或识别阶段被修改、覆盖或删除。

商品创建/编辑、子SKU、权限与新导入测试共6个文件44/44通过；真实200行文件离线映射断言通过；选品中心页面、导入组件、服务和路由的低内存esbuild均通过。完整Vite构建在当前3.8GB沙箱转换8,282个模块后被资源限制终止，未输出代码错误，改用目标模块打包、单元、路由和真实React浏览器回归覆盖。浏览器回归确认AI图片/表格双入口、200候选、200件缺品牌、统一品牌补齐、确认按钮状态与移动弹窗可见性；只调用本地mock预览，未点击确认。生产API请求0、生产商品写入0、现有商品变更0，旧Manus TiDB连接/读取/恢复0。

### 商品表智能识别生产部署与只读验收

业务提交`b8100203`已正常快进推送到`main`，GitHub检查与Railway部署状态均为success。生产`/master/selection-center?tab=products`返回HTTP 200，当前入口加载`SelectionCenter-jCH9fdus.js`；动态资源中的表格智能识别、日文商品表入口、免费无LLM说明、预览接口、确认接口和零品牌猜测6/6标记均存在。公开`system.health`返回HTTP 200且`ok=true`；未登录`selectionCenter.previewProductWorkbook`与`selectionCenter.commitProductWorkbook`均返回HTTP 401，确认新入口没有放宽商品数据或导入权限。

生产验收只下载HTML/JavaScript、读取公开健康并发送未登录权限探针；没有上传用户工作簿、没有点击确认导入、没有创建或修改任何商品/SKU/库存/价格/品牌。生产商品写入0、现有商品变更0、付费AI调用0；生产数据库仍仅为Railway MySQL，旧Manus TiDB连接/读取/恢复0。

## 2026-09-01 — 现金流水32项日文分类主数据、AI可修正与自定义字段

- **需求**：`/master/finance?tab=cashflow` 按用户截图中的日文原文字段更新分类；管理员可手动添加、修改、停用分类；AI识别结果不准确时可逐笔人工修正。
- **分类主数据**：新增 `cashflow_category_definitions`，按截图顺序预置32项系统分类：交通費、家賃・オフィス、その他経費、保険・社会保険、本社送金、従業員経費精算、利息・その他収入、手数料、税金・公租公課、通信・光熱費、外注費、物流・配送、飲食・接待、中国人工費、日本人工費、ブランド枠代収入、TikTok 越境 EC 売上、TikTok・越境 EC、越境 EC 商品売上、商品仕入、広告アカウントチャージ、広告・マーケティング、総務費、ソフトウェア・ツール、口座間振替、資本金、借入金、モデル・タレント、ライブ・配信、採用費、設備・備品、支払利息。
- **手动管理**：普通财务用户读取动态分类；仅财务管理员可新增自定义分类、改名、调整适用收支类型、停用/恢复。32项系统字段不可改名或停用；停用自定义分类不会删除或改写历史流水。
- **AI与人工纠正**：银行导入和批量AI分类统一使用一套规则；逐笔人工改分类后写入 `cashflow_category_corrections`，流水标记 `categorySource=manual`、`categoryLockedByUser=1`，以后批量AI跳过；相同取引先和说明会优先采用最近人工纠正。未命中规则时不会覆盖已有明确分类。
- **数据迁移**：备份门控升级先将所有现有流水分类保存到 `cashflow_category_migration_backup_v1`，校验备份行数后才执行一次性映射；`給与・人件費` 按法人/币种拆为中国人工費或日本人工費，`TikTok・越境EC` 迁移为 `TikTok・越境 EC`，`振込` 迁移为口座間振替。工资导入、工资隐私、工资对账及财务司令塔均兼容旧分类和中日新分类。
- **前端**：顶部和分类分析区新增“分类管理”；主流水表、分类下钻、新增/编辑表单三个入口均使用动态主数据。每笔流水显示“AI識別／AI・人工学習／人工修正／給与表／字段迁移／历史数据”等来源。
- **验证**：现金流分类、工资隐私、工资结算、对账、财务司令塔和凭证删除共7个测试文件、63项测试全部通过；分类服务、现金流路由、分类管理组件和现金流页面的定向esbuild通过，完整 `pnpm build`（Vite前端＋服务器bundle）成功。全仓库 `tsc --noEmit` 仍有797个既有历史错误，但本次涉及文件为0错误。
- **生产边界**：当前日志记录时尚未部署；未点击生产AI分类、未新增自定义分类、未手动修改任何生产流水。上线后只验证界面与安全管理流程；任何会改变真实流水分类的操作需单独明确记录。

### 2026-09-01 生产部署与验收

提交 `62e8b32` 已由GitHub推送触发Railway成功部署，线上健康接口返回 `ok: true`。财务二次验证后，现金流页面正常加载且分类管理弹窗准确显示32项系统字段，顺序、收支类型与用户截图一致；自定义分类名称、收支类型选择和添加入口可用，系统字段没有改名、停用或删除操作。

备份门控迁移已完成预定的历史标签转换，分类来源显示“字段迁移”或“历史数据”。中国法人迁移后仍为265条流水（可见199条、工资个人明细隐藏66条），入金24件/¥1,756,895.97 RMB、出金241件/¥1,854,525.48 RMB、净现金流¥-97,629.51 RMB，金额和记录数未因分类迁移改变。新聚合已显示中国人工費63件、TikTok・越境 EC 4件、口座間振替2件等。

线上验收只打开分类管理和读取动态下拉，未点击“AI自動分類”，未新增或停用自定义分类，也未人工修改任何真实流水；除部署时经过备份门控的既有分类标签迁移外，没有创建测试流水或额外业务数据。

## 2026-09-01：中国团队朝会转写失败恢复

- 生产只读调查确认今日中国团队朝会记录ID 6（JST 10:56开始、236秒、15人）状态为`failed`，精确错误为`Voice transcription service is not configured: BUILT_IN_FORGE_API_URL is not set`。失败发生在转写环境检查，录音质量、时长和参与人数不是原因。
- 原始`audio/webm`已在失败前成功保存到对象存储，大小3,804,649字节（3.63 MiB），低于转写16 MiB限制，无需重录。
- 根因修复：`server/_core/voiceTranscription.ts`与现有LLM调用统一环境兼容策略；配置Forge地址时继续调用Forge，地址缺失但服务端AI密钥可用时回退到`https://api.openai.com/v1/audio/transcriptions`，不新增环境变量、不把密钥暴露到前端或日志。
- 新增`morningMeeting.retryDailyTeamMeetingProcessing`：只允许失败的`daily_team`记录，且仅记录创建者或管理员可执行；通过`status=failed`条件更新原子领取，防止并发重复转写；直接使用已有`audioKey`生成新签名URL，不重复上传、不新建记录；成功后依次写入文字稿、摘要和`completed`，失败则恢复`failed`并保留精确错误。
- 重新处理开始、成功、失败均写入`activity_logs`审计；已完成记录重复调用按幂等成功返回，处理中记录返回冲突。
- 朝会页面失败卡新增错误原因与“使用原录音重新处理 / 元音声から再処理”按钮，明确提示原录音仍保存；保留原有删除重录能力作为人工兜底。
- 验证：朝会恢复、团队规则、语音转写和麦克风共41项回归全部通过；新增真实multipart模拟覆盖OpenAI端点回退；前端页面、朝会路由和语音模块定向打包通过；完整`pnpm build`生产构建成功。生产恢复动作需在本提交部署后对记录ID 6执行一次。

### 2026-09-01 生产恢复验收

提交`574f2dd`经GitHub推送后由Railway成功部署。线上已使用新入口对原失败记录ID 6执行一次幂等重新处理，没有重新上传或创建替代记录。原3.63 MiB WebM转写成功，数据库状态依次经过`transcribing`、`summarizing`并最终变为`completed`；生成文字稿1,303字符、结构化摘要和行动事项，`errorMessage`清空，原10:56开始时间、236秒时长和15名参与者保持不变。

恢复后页面将中国团队显示为完成，原录音可播放，文字稿与摘要可展开；15名参与者的朝会参加状态生效。只读回归确认今天个人9条朗读仍为7条且7条全部完成，日本团队仍为未开始，没有被自动创建或修改；团队朝会历史仍为4条，最新记录仍是同一个ID 6而非新增重复行。活动日志已记录本次重新处理的开始和成功。

## 2026-09-01 — TikTok竞品上传待确认草稿持久化

修复 `https://lcjmall.com/tiktok-competitor-daily` 上传文件后返回或刷新即消失的问题。根因是识别结果只保存在 `TiktokCompetitorDaily.tsx` 的 React 内存状态中，点击“保存为独立批次”前既没有服务端草稿记录，也没有可恢复的文件引用，因此页面重载后必然丢失，同时正式批次仍为0。

新增 `tiktok_competitor_import_drafts` 待确认草稿表。文件识别成功后，原始文件保存到对象存储，数据库只保存S3引用、文件摘要、完整解析行、识别统计、上传人和状态，不保存Excel二进制。待确认草稿持续保留到用户确认或主动放弃；返回、刷新或切换日期后可自动恢复完整13列预览。草稿不属于正式批次，不生成运营日报，也不会覆盖同日已有批次。

新增草稿列表、主动放弃和幂等正式提交接口。普通员工只能处理本人草稿，管理员可查看和处理同日草稿；正式提交使用原子状态领取、解析行SHA-256复核、正式批次文件摘要去重和15分钟中断恢复，避免并发双提交。提交失败时草稿回到待确认状态，可稍后重试；只有确认成功后才生成正式快照与日报任务。

验证结果：使用用户原 `Kalodata_日本区竞品日报_2026-08-31.xlsx` 在修复前线上复现“识别15行、排除0行、前5店5家、13列完整，但刷新后待确认文件消失且正式批次0”的问题。修复后本地竞品专项、升级、权限、工作簿、模板、上传凭证、正式批次和对比共48项测试全部通过；前端页面、后端路由定向打包与完整 `pnpm build` 均通过。待部署后需用同一文件做线上草稿恢复验收，且不点击正式确认，避免创建生产批次。

### 2026-09-01 线上草稿恢复验收

提交 `249da9e` 经Railway构建部署成功后，使用用户同一文件 `Kalodata_日本区竞品日报_2026-08-31.xlsx` 在2026-08-31页面创建待确认草稿。首次上传显示1份可恢复草稿、识别15行、排除0行、前5店5家及完整13列明细；页面刷新后草稿和明细仍从服务端恢复。随后离开竞品日报进入LCJ首页，再返回同一日期，草稿、15行和13列仍完整存在。

线上验收期间没有点击“确认并保存为正式批次”。同日正式批次保持0、运营日报保持0、排名快照保持未导入；生产仅新增用户明确上传文件对应的1份待确认草稿及对象存储引用。该草稿会持续保留，等待用户确认入库或主动放弃，不会自动消失或自动生成日报。

## 2026-09-01 现金流分类双向选择与完整CRUD修复

- 用户反馈 `/master/finance?tab=cashflow` 中分类并非全部可用于入金和出金，且截图中的预设分类无法新增、修改或删除。根因是首版把分类写死为 `income` / `expense`，每次启动把预设项重新标记为 `isSystem=1`，服务端拒绝系统项变更，前端也只给自定义项显示保存/停用按钮；系统同时没有删除接口。
- 按用户最新截图将预设清单更新为34项，并保持截图顺序；新增 `雑収入`、`差入保証金`，将旧品牌/TikTok/越境EC收入字段替换为 `売上高-ライブ枠料収入`、`売上高-販売手数料収入`、`売上高-商品販売売上`、`売上高-代理営業務売上`。所有预设与后续手动新增分类统一为 `both`，可同时用于入金和出金。
- 新增一次性 `cashflow_categories_v2_editable_both` 备份门控迁移：先把现有分类定义完整备份到 `cashflow_category_definition_backup_v2`，再将有效定义转换为双向可编辑，应用最新34项清单，并软删除4个旧收入预设。迁移只执行一次，后续管理员改名或删除不会在服务重启时被重新创建。
- 分类管理现在对所有正常定义显示改名保存和删除按钮；新增也固定为“入金・出金”。删除采用分类主数据软删除，只从新增/修改的可选列表移除，不删除、不改写任何历史流水或金额；同名再次添加可安全恢复。AI分类规则同步指向新收入字段，已删除分类也不会被人工纠正学习重新写回。
- 分类新增、改名、删除继续要求管理员身份及财务二次验证；普通财务用户只读取有效分类。逐笔AI分类结果人工修正和人工锁定逻辑保持不变。
- 验证：现金流分类、工资隐私、工资对账、财务司令塔等6个测试文件共60项全部通过；新增可执行测试覆盖新增强制双向、删除同名恢复、原系统项改名和软删除不触碰历史流水。`pnpm build` 完整生产构建通过，前后端专项打包和 `git diff --check` 通过。
