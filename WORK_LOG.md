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
