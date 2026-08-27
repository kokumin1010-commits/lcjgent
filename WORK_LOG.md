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
