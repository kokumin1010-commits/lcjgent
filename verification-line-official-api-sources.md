# LINE Messaging API 公式仕様・退会同期検証記録

調査・実装日: 2026-09-20

## 公式仕様

LINE Developersの[Webhook受信ガイド](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)では、受信前の`X-Line-Signature`検証、Webhookの非同期処理、同一`webhookEventId`再送への重複対策、`timestamp`に基づく順序判断が案内されている。グループ／複数人トークではmessage、join、leave、memberJoined、memberLeftなどのイベントを受信できる。

[Messaging APIリファレンス](https://developers.line.biz/en/reference/messaging-api/#get-group-summary)では、公式アカウントが参加中のグループについて、`GET /v2/bot/group/{groupId}/summary`でグループ概要を取得し、`POST /v2/bot/group/{groupId}/leave`で退会できる。今回の実装では、概要取得の200を参加中、400/404を退会済み、401/403/429/5xxまたは通信失敗を判定不能として扱い、判定不能時に誤って一覧から消さない。

同リファレンスの[グループ参加人数取得API](https://developers.line.biz/en/reference/messaging-api/#get-members-group-count)では、公式アカウントが参加中のグループに対して`GET /v2/bot/group/{groupId}/members/count`を呼び、現在のユーザー数を`count`で取得できる。管理画面ではグループタブ表示・更新時だけ、退会同期後のアクティブグループを最大5並列・5秒timeoutで取得する。失敗・レート制限・不正応答は0人と誤表示せず「参加人数を取得できません」とする。

LINE Developersの[メッセージ送信ガイド](https://developers.line.biz/en/docs/messaging-api/sending-messages/)では、Webhook応答は`replyToken`、任意タイミングの個別送信はpush messageを使用する。月間配信上限と部分配信の制御があるため、将来のAI自動応答でも送信履歴、重複抑止、レート制御を必須とする。

## 退会バグの原因と修正

| 項目 | 修正前 | 修正後 |
|---|---|---|
| 管理画面 | tRPC mutation自体が完了すると、返却された`success:false`を確認せず成功トーストを表示 | LINE側で成功または既退会を確認した場合だけ成功。失敗は例外として表示 |
| 一覧表示 | DBの`isActive=true`だけを表示し、LINE側で既に退会した古い行を再照合しない | グループタブ初回表示と管理者の更新操作で明示同期し、400/404のグループだけ`isActive=false`へ更新。通常の一覧読取ではLINE APIを走査しない |
| 画面反映 | 成功後のrefetch待ちでカードが残り得る | 対象カードを即時キャッシュから除外し、失敗時だけ元に戻す |
| 再参加 | 既存DB行の名前・画像だけを更新し、`isActive=false`を戻さない | 新しいjoin Webhookで既存行も`isActive=true`へ戻し、最新イベント時刻より古いleave再送は無視する |
| 障害時 | LINE API失敗でもmutationは正常終了 | 認証、レート制限、通信、LINEサーバー障害ではDBを変更せずエラーを返す |
| 権限 | ログインユーザーなら任意IDを退会APIへ渡せた | 管理者だけに限定し、形式検証済みかつDBに存在するアクティブグループだけを対象にする |

既存Webhookの`leave`イベント処理は同じ`updateLineGroupActive(groupId, false)`を使うため、管理画面からの退会、LINE側からの削除、管理者同期の三経路が同じ論理状態へ収束する。join/leaveの`timestamp`と`webhookEventId`は独立した`line_group_lifecycle_states`表へ保存し、既存`line_groups`へ列を追加しない。Webhook Event IDが欠落した場合も`webhook:`識別子を決定的に生成し、ローカルイベントへ誤分類しない。更新は対象グループ行をロックしたトランザクション内で行い、時刻を優先し、同一ミリ秒はイベントIDを決定的タイブレーカーにする。同一時刻ではLINE Webhookをローカル処理より優先する。管理者同期の非参加判定と手動退会にはAPI応答完了時ではなく各リクエスト開始時刻を使用するため、その後に発生したjoinを上書きしない。同一ID再送、古いイベント、順序競合は適用0件として扱う。DB行とメッセージ履歴は物理削除しない。LINE側の退会後にDB更新だけ失敗または競合した場合は「LINE退会済み・管理画面同期保留」としてカードを隠したまま再同期し、再度の退会を促さない。

## 検証

退会成功、既退会、LINE一時障害、認証障害、LINE成功後のDB同期保留、適用0件競合、明示同期、DB更新失敗、画面キャッシュ除外・対象単位の復元、管理者権限、入力形式、再参加、古いイベント、同一ID再送、同一ミリ秒の異なるイベント順序、照合中／手動退会中に発生したjoinとの競合、Webhook ID欠落を回帰テスト化した。LINE関連10ファイル98テストは成功した。migrationはMySQL/TiDB双方で利用できる`CREATE TABLE IF NOT EXISTS`だけを使用し、追加表が作成できない場合も既存`line_groups`の通常一覧列を参照し続けられる。初回デプロイではRailway build時に本番DBへ接続できず追加表が未作成となり、専用healthが503を返した。この実測に基づき、同じ冪等DDLと全列SELECT検証をアプリ起動前へ追加し、失敗時は新デプロイをfail-closedにした。`GET /api/health/line-group-lifecycle`は追加表の全必須列をread-only SELECTし、初期化成功時だけHTTP 200と`lifecycleStateTable: ready`を返す本番ゲートである。最新main統合後のproduction buildも成功し、既存の`sharp`警告とローカルDB接続不可による継続ログ以外に今回起因の問題はない。全量TypeScriptには既存748件の診断が残るが、今回の新規ファイル、LINE API、管理画面、変更行付近の新規診断は0件だった。

## 本番確認

実装SHA `28bfe08dfb95cdc96198cbde17b8908043a06d1a`はGitHub Check、Railwayともにsuccessとなった。本番の`GET https://lcjmall.com/api/health/line-group-lifecycle`はHTTP 200と`{"ok":true,"lifecycleStateTable":"ready"}`を返し、`line_group_lifecycle_states`と全必須列のread-only SELECTが成功した。`GET https://lcjmall.com/master/line`もHTTP 200だった。本番業務データへの人工書込みおよびテスト目的の実グループ退会は行っていない。

## LCJ公式・専属AIマネージャー

同じ`/master/line`に「AIマネージャー」タブを追加した。対象は**有効なライバー情報とLINE IDが実際に紐付く本人**に限定する。本人DMには専属AIが自動返信し、公式LINEが参加中のグループでは、その本人が毎回ボットへ明示的にメンションした投稿だけを処理する。一般顧客向けの汎用AI自動返信は停止したままである。返信は常に「LCJ公式AIマネージャー」と名乗り、人間・恋人・担当者を装わない。DMでは会話履歴、登録済みTikTok公開情報、公開済みLCM商品、配信実績を必要最小限で使い、メールアドレス・電話番号・長い識別番号はLLM送信前にマスキングする。

| 項目 | 実装 |
|---|---|
| 受信返信 | LINEメッセージ保存、受信活動記録、重複不能なイベント登録を1つのDB transactionで確定し、LLM生成と送信はバックグラウンドワーカーへ移す。確定失敗時はWebhookを5xxとしてLINE再送に委ねる |
| グループ | LINE公式の`mention.mentionees[].isSelf=true`または`@LCJ`／`＠LCJ`／`@714isnih`だけを明示メンションとして判定し、AIサービスにも検証済みフラグを渡す。「エージェントさん」等の曖昧文では起動しない。すべてのテキスト投稿はグループ履歴・分析材料として`needsResponse=false`で重複不能に保存するが、メンションなしでは返信・AI返信event登録・要返信化を一切行わない。連携本人の明示メンションだけを永続キューへ登録し、返信先と履歴には元の`lineGroupId`を使う。グループ返信にはDM履歴、売上、内部メモ、個別プロフィール、TikTok情報、個人情報を渡さず、保存済みのサニタイズ済み要約インサイトと公開LCM商品のみを使う。ポイント履歴・リマインダー等はグループで照会・更新せず1対1トークへ案内する |
| 個別履歴 | 各AIマネージャーカードから「連絡履歴」と「AI実行履歴」を開ける。受信・送信、DM・グループ名、日時、本文、AI状態、生成文、意図、次アクション、試行回数、モデル、トークン、エラーコードを最大200件ずつ管理者だけが確認できる。LINE管理の一覧・履歴・送信・設定API全体も共通admin認可で保護する |
| 配送状態 | `queued → processing → ready → sending → sent`を永続化。生成・送信ごとにランダムなlease tokenを持たせ、古いワーカーの更新を拒否する。LINE送信前に決定的message IDの`line_messages`監査意図を`pending`で保存し、決定的`X-Line-Retry-Key`付きpushの成功／受付済み確認後に監査を`responded`、イベントを`sent`へ確定する。送信前後のクラッシュは同じretry keyで安全に再試行し、監査確定だけ失敗した場合は`outbound_audit_pending`を再照合する。上限まで確認できなければ履歴とAIイベントを「送信確認不能」とする |
| 再送 | 同じLINE message IDから同じevent keyを作る。受信保存後・イベント登録前に落ちてもWebhook再送で欠落イベントだけを作成できる |
| 継続フォロー | 初期値OFF。管理画面で個別に有効化後、平日10:00–18:00 JST、指定日数経過、連続最大2回で自動化。送信直前に新着DMと最新設定を再確認する |
| 本人停止 | LINEで「AI停止／AI再開」「フォロー停止／フォロー再開」と送るだけで本人が変更できる。確認応答も設定変更と同一transactionで作る決定的イベントから通常の永続配送・監査経路を通す |
| 送信取消 | `unsend` Webhookで本文を`[送信取消済み]`へ置換し、未送信のAIイベントを中止して将来のプロンプトから除外する。送信lease取得後にも最終確認し、送信中取消は監査コードを残す |
| TikTok | 登録済みTikTok IDから公開プロフィールと人気投稿だけをData APIで取得。7日間キャッシュし、失敗時は6時間再試行しない |
| 商品 | `published`のLCMブランド・商品だけを候補にし、対象視聴者、30秒訴求、実演方法、禁止表現を含める |
| 運用停止 | `LINE_AI_MANAGER_ENABLED=false`で全返信、`LINE_AI_MANAGER_PROACTIVE_ENABLED=false`で継続フォローを緊急停止できる |

[Webhook受信ガイド](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)の非同期処理・重複イベント対策に合わせ、30秒間隔の永続キューワーカーと一意event keyを使用する。専属AIの返信・設定変更確認は、返信tokenを永続化せず、すべて決定的`X-Line-Retry-Key`付きpushへ統一した。送信応答が途切れても同じキーで再試行し、LINE側の受付済み応答を成功として監査確定する。上限まで受付を確認できない場合だけ管理画面で「送信確認不能」として可視化する。Webhook起点のfollow・ライバー連携・Mall連携pushにもイベントID＋用途から生成する決定的UUIDを渡し、再送・複数インスタンスでの重複配送を抑止する。

同ガイドでは、ボット自身へのメンション時に`mention.mentionees[].type=user`、ボットの`userId`、`isSelf=true`が設定されると明記されている。この公式metadataを最優先し、過去互換は明示的な`@LCJ`／`＠LCJ`／`@714isnih`だけに限定した。

AI対象DMは外部プロフィール取得より先にtransactional outboxへ渡す。Webhook内の複数イベントは並列処理し、共通helperと`lineAgent`独自のプロフィール取得はいずれも2秒、LINE reply/pushは10秒で打ち切る。ポイント・リマインダー・連携コード・画像・動画など既存の直接返信経路でも、ライバー本人の受信活動を返信処理より先に記録し、会話直後の誤った継続フォローを抑止する。生成・送信・skip・unknown・sentを含むすべてのterminal遷移は、現在statusと取得済みlease tokenを必須条件にして古いworkerの上書きを拒否する。

`gpt-5-mini`の構造化JSON応答はテスト入力で実測し、`reply`、`intent`、`nextAction`の3項目を取得できた。呼び出しは1,200 completion tokens、1回45秒timeoutに制限した。AIイベント内の返信本文は180日後に消去する。専用healthは設定表・イベント表の必須列、全状態enum、2つの一意index、4つの補助indexを検証し、不完全またはDB未接続ならHTTP 503を返す。

最終回帰は、AI専属処理、transactional outbox、lease fencing、停止コマンド、送信取消、retry key、既存一般AI停止、グループ退会・参加人数を含む11ファイル83件が成功した。production buildと変更ファイル個別bundleも成功した。実LINE認証を要求する既存`line.test.ts` 3件はローカルにsecret/tokenがないため実行不能で、実メッセージは送信していない。

正式機能commit `349314a20ce6504fcf09bdee720cc29adc700fb8`はGitHub CIとRailway productionが同一SHAでsuccess。本番`GET https://lcjmall.com/api/health/line-ai-manager`はHTTP 200・`{"ok":true,"aiManagerStorage":"ready"}`、`GET https://lcjmall.com/api/health/line-group-lifecycle`はHTTP 200・ready、`GET https://lcjmall.com/master/line`はHTTP 200を返した。すべてGET/read-only確認であり、実LINE送信、グループ退会、会員・ライバーデータ更新は実施していない。

個別履歴・@LCJ限定グループ対応の機能commit `fd902a22c4d70ebd5acb994524e6111438a03126`もGitHub CheckとRailway productionがsuccess。本番`GET https://lcjmall.com/api/health/line-ai-manager`と`GET https://lcjmall.com/master/line`はいずれもHTTP 200だった。ログイン済み管理者画面でNANAの「連絡・AI実行履歴」を開き、「連絡履歴」「AI実行履歴」の両タブと0件時の空状態を確認した。既存履歴を作るための実LINE送信や本番データ更新は行っていない。

## グループ名称同期・会話インサイト（2026-09-20追加）

LINE Messaging APIにはグループ名変更専用Webhookを前提にできないため、公式のグループ概要APIをjoin時だけでなく、グループメッセージ受信時（テキスト・非テキスト）と管理者の明示同期時にも再取得する。概要取得には2秒timeoutを設定し、成功して`groupName`を取得できた場合だけ`line_groups.groupName`と`pictureUrl`を更新する。timeout、認証障害、レート制限、通信障害では既存名称・画像をNULLや仮値で上書きしない。管理画面は同期完了後、退会件数が0でも一覧queryを再取得するため、LINE側で変更された名称・画像を同じ`/master/line`へ反映する。

グループ会話分析は既存LINE基盤へ追加し、別システムは作成していない。テキスト投稿は明示メンションの有無にかかわらず、外部LINE APIを呼ぶ前にLINE message IDを一意キーとして`line_messages`へ先行保存する。メンションなし投稿は返信せず、AI返信eventを作らず、要返信にも設定しない。投稿者プロフィール・グループ名称のenrichmentはWebhook応答後のbest-effort処理へ分離し、グループsummaryは1分debounceする。重複再配信ではenrichmentを再実行しない。投稿者プロフィールは既存キャッシュを優先し、未取得時だけ2秒timeoutのグループメンバープロフィールAPIを使い、取得後に保存済みメッセージへ送信者名を追記する。グループ最終活動日時はLINE event timestampが既存値より新しい場合だけ更新し、Webhook再配信・順序逆転で巻き戻さない。

会話分析はWebhook内でLLMを呼ばず、5分ごとの永続ワーカーで最大1グループずつ行う。対象は会話分析がONで、連携済み・有効なライブコマーサーが実際に発言し、保存済みテキストが3件以上あるアクティブグループに限定する。1回の分析は直近40件、同一グループの更新間隔は15分以上とする。LLM payloadでは実グループ名を固定名へ置換し、各送信者を`参加者1`等のbatch内aliasへ変換する。登録済み送信者名、メール、電話、handle、郵便番号、短い業務IDをマスクし、住所・生年月日・口座・カード等の高リスク語を含む発言は全文を分析対象から省略する。会話内の命令は信頼しないデータとして扱い、センシティブ属性・性格・親密度の推測を禁止する。複数replica・手動更新競合はDB上の5分lease tokenで排他し、同じ会話versionは既存結果を再利用する。分析中に新着投稿があれば古いworkerの保存を拒否する。結果は話題、明示ニーズ、関係構築機会、公開済みLCM商品の適合候補、リスク、推奨次アクション、送信前ドラフト、信頼度、対象件数・期間からなる構造化JSONで保存する。商品候補は`published`のブランド・商品だけで、商品名は公開商品一覧との完全一致を再検証する。

グループでの返信境界は従来より厳格なままである。`@LCJ`等の明示メンションかつ連携本人の場合だけ専属AI返信キューへ渡し、グループ別`@LCJ返信`設定がOFFまたは設定読取失敗なら送信しない。グループ返信用promptには生のグループ履歴を再送せず、保存済み要約インサイトだけを渡す。即時@LCJ受信文にも分析用と同じ強化PII除去を適用し、ライバー実名は`グループ参加者`、実グループ名は`対象LINEグループ`へ置換する。DM履歴、売上、内部メモ、個別bio、TikTok account/insightはNULLに固定する。`unsend`受信時は原文を既存仕様どおり`[送信取消済み]`へ置換すると同時に、派生インサイトを無効化して次回分析から取消内容を除外する。

管理画面のグループカードと詳細Dialogには、会話分析、`@LCJ`返信、AI提案送信の各状態を分離表示する。詳細では要約、話題・ニーズ、関係構築機会、公開LCM商品候補、次アクション、信頼度、分析範囲、送信前ドラフトを確認できる。ドラフトの「入力欄へコピー」は自動送信せず、管理者が確認して従来の送信操作を行う。**2026-09-20時点の初回リリースでは**、会話分析・AI提案送信・自動追いを既定OFFとしていた。この旧既定値は、後述する2026-09-21の全グループ自動ON更新で置き換えた。分析OFF時にAI提案送信も強制OFFとなる依存関係は維持している。

対象回帰はPII匿名化、即時@LCJ返信の実名・private profile除去、グループ無返信先行保存、重複enrichment停止、厳格メンション、個人情報コマンド拒否、名称・画像同期・画像削除、概要APIのAbortSignal、概要失敗時の既存値保持、admin認可、migration、分析lease・送信初期値、取消無効化、同一LINE画面UIを含む5ファイル53件が成功した。LINEテスト一式では29ファイル345件が成功した。失敗は固定された別リポジトリ絶対path、Stripe secret未設定、LINE Login／Messaging API secret・token・APP_URL未設定を前提とする既存環境依存の5ファイル10件だけだった。production buildは成功し、既存`sharp`警告とローカルDB接続不可によるmigration継続ログ以外に今回起因のbuild失敗はない。全量`tsc`は完走し、721件の既存診断は残るが、今回変更した`LineManagement.tsx`、`lineAgent.ts`、`lineAiManager.ts`、`lineGroupLifecycle.ts`、`groupFollowUpScheduler.ts`、新規テスト・migrationには新規診断0件だった。

## グループAIフォロー・送信監査・会話履歴（2026-09-21追加）

公式LINEを既存グループへ招待しただけで一般投稿へ無差別返信する仕様にはしていない。返信は連携済み・有効なライブコマーサー本人からの明示的な`@LCJ`／bot self mentionだけを既存専属AI経路へ渡す。管理画面の「まとめてON」はグループ別の@LCJ返信、匿名化会話分析、分析結果によるAI提案、自動追いを一度に選べる操作だが、送信条件はサーバーで再検証する。AIフォローは会話分析・AI提案・自動追いがすべてON、グループがアクティブ、平日9〜18時JST、設定無活動日数到達という既存境界内だけで動く。

明示メンション後も、グループ別@LCJ返信設定、連携済み・有効なライブコマーサー、本人reply設定を返信前に再確認する。既存の「新規グループは@LCJ返信ON」という製品動作は維持するが、最初の明示メンション時に既定設定行を永続化する。未連携、設定OFF、DB読取障害、専属AI処理中の資格変更は無返信で、旧一般返信へfallbackしない。ポイント履歴・リマインダー等の個人情報コマンド警告も同じ資格確認後だけ返す。設定DBを読めない場合は`LINE_GROUP_AI_REPLY_SETTINGS_UNAVAILABLE`をdurable handoff失敗としてWebhook側へ伝播し、勝手な返信やsilentな処理成功にしない。キュー配送直前にもsource message、グループactive状態、永続化した@LCJ返信設定、本人reply設定を再読し、キュー投入後に退会・OFF・取消となった場合はpushしない。

送信直前に保存済み会話の最新versionを再分析または再利用し、分析結果の`latestMessageAt`と現在の会話終端が一致する場合だけ提案文を採用する。AI設定をDBから読めない場合は`LINE_GROUP_AI_SETTINGS_UNAVAILABLE`として処理を止める。AI提案を生成できない場合、古い提案・固定文面へ切り替えず送信しない。固定文面はAI提案送信がOFFの既存自動追いにだけ残す。

管理画面手動送信とグループ自動フォローは、LINE push前に決定的message IDで`line_messages`へ不変の送信監査予約を作る。管理画面はクライアント生成UUIDをAPI必須にし、同一UUIDの再試行では宛先・本文が完全一致する場合だけ同じ`X-Line-Retry-Key`を再利用する。異なるpayloadは`LINE_OUTBOUND_IDEMPOTENCY_CONFLICT`で拒否する。Dialogを閉じても未確定の本文・UUIDを保持し、同じ内容を再開した時は同じretry keyを使う。監査確定は`pending → responded`のみを条件付き更新し、同時取消された`cancelled`／`none`を復活させない。自動フォローもグループIDと対象会話versionから決定的retry keyを作る。LINE成功後は監査を確定してから`lastAutoFollowUpAt`を更新するため、監査確定障害では送信候補を消さず、同じretry keyで再試行・復旧できる。送信確認前の監査行は管理画面に「送信未確認」と表示する。

自動フォローは送信直前に`line_groups`行を`FOR UPDATE`し、active、opt-in、最新活動時刻、無活動閾値、active reminder、AI／固定modeをtransaction内で再確認する。受信グループ投稿側も同じ行を先にlockし、受信履歴挿入と`lastMessageAt`更新を同一transactionで確定する。グループ向け手動リマインダーの作成・active化も同じ親`line_groups`行を先にlockするため、資格snapshotまでの新着・opt-out・deactivate・active reminder作成・mode変更raceでは送信しない。資格snapshotをcommitして親row lockを解放した後に、送信前監査、決定的retry key付きLINE push、監査確定を行い、成功時だけ`lastAutoFollowUpAt`を更新する。LINE APIの最大10秒待機中に受信・退会・設定変更transactionをblockせず、並行workerは同じretry keyで重複を抑止する。監査が`cancelled`／`none`ならterminalとして再送せず、`responded`ならLINEへ再送せず抑止日時だけ整合させる。

グループ詳細の「会話・送信」は受信、LCJ運営手動送信、LCJ公式AIフォローを最大200件表示する。DBは`COALESCE(lineTimestamp, createdAt)`、`createdAt`、`id`の決定的な新着順で対象windowを選び、UIは同じイベント時刻を用いて古い順に並べる。遅延・順序逆転Webhookがあっても表示順と最新200件の選択をDB到着順へ依存させない。

対象回帰は10ファイル88件成功し、LINE関連全体は37ファイル424件成功した。残る5ファイル10件は固定された別リポジトリpath、Stripe secret、LINE Login／Messaging API secret・token・APP_URLがローカルにない既存環境依存である。production buildは成功し、全量TypeScriptの既存721件のうち今回変更ファイル・変更行は新規診断0件。network I/Oをtransaction外へ出した最終版は独立再レビューでGO（release blockerなし）となった。本検証では実LINEメッセージ送信、グループ設定ON、会員・グループデータ更新は行っていない。

本体commit `813a8936a522d710ccf6eb8b05970392a49aa7d6`はGitHub `main`へpush済みで、同一SHAのRailway statusは`Success - www.livecommercefestival.com`となった。read-only本番確認では`https://lcjmall.com/master/line`がHTTP 200、配信中`LineManagement` chunkに新しいグループAIフォロー・会話履歴・送信状態UI文言が存在した。`/api/health/line-ai-manager`は`aiManagerStorage: ready`、`/api/health/line-group-lifecycle`は`lifecycleStateTable: ready`をHTTP 200で返した。実送信・設定ON・会員／グループ変更を伴う確認は行っていない。

## グループ会話からの確認用AI文案（2026-09-21追加）

管理画面のグループ「会話・送信」Dialogに、新規文案を作る「AI文案を作る」と、入力済み文の意図を安全な文案へ変換する「安全なAI文案にする」を追加した。これは送信機能ではない。生成結果を入力欄へ返すだけで、管理者が「内容を確認しました」を明示操作するまで送信buttonとEnter handlerの双方で拒否する。確認後に編集した場合も未確認へ戻り、再確認が必要になる。通常の手入力文はこのgateの対象外である。確認済みの文案を管理者が既存送信buttonから送った場合だけ、既存の送信前監査、決定的retry key、LINE push、監査確定経路へ進む。生成APIとLINE push APIは分離され、生成のruntime testでも`pushMessage`が呼ばれないことを確認した。

グループ会話分析自体も外部LLMへ会話本文を渡さず、保存済み履歴をサーバー内で日程・準備・実演・商品・振り返り等の有限シグナルへ決定的に縮約する。LLM処理はグループ別会話分析が現在ONで、最新の有限シグナル型インサイトが保存されている場合だけ許可する。LLMへは生会話、実グループ名、参加者名、DM、売上、内部メモ、TikTok個人情報、既存下書き、商品名・説明を渡さない。インサイトから導いた有限のID／件数／confidenceと、現在公開中かつ候補に一致する商品IDだけを渡し、出力も`empathyStyle`、`nextAction`、許可商品IDだけのJSON schemaに拘束する。最終文面はサーバー側の承認済み定型部品と生成後に再確認した公開商品名だけで決定的に組み立てる。既存下書きは本文を再利用せず、日程・準備・実演・商品・課題の有限意図分類にだけ使う。これにより、入力中の個人情報、非公開商品、誇大表現、prompt injectionは送信文面へ複製されない。質問最大1つ、末尾の「LCJ公式AIマネージャー」明示を固定する。

生成APIはadmin限定・アクティブグループ限定で、分析OFF・履歴0件・インサイト未作成・会話revisionと不一致の古いインサイトでは実行しない。`line_groups.conversationRevision`は、親group rowを先にlockする同一transaction内で、グループmessageの一意insertまたは実際のunsend時だけ1回加算する。duplicate webhook／retry、二重unsendでは増えず、順不同受信でも必ず増える。会話分析も取得時revisionをJSONへ保存し、保存直前に親rowを再lockして完全一致を確認する。他workerがanalysis leaseを保持している場合も、revision一致の既存insightだけを再利用する。

生成前の親group row locking readと有限message window選択で原子的snapshotを取得する。LLM後は同一transactionで親group、`line_group_settings`、選択された公開商品rowをこの順に`FOR UPDATE`し、会話revision・active状態・group更新、設定・insight、商品／ブランド内容が開始時と完全一致する場合だけ文案を返す。これにより、処理中の設定OFF→ON、退会→再参加、新着／順不同会話、unsend、インサイト更新、商品変更、非公開→再公開を含む変更raceを拒否する。`line_group_ai_draft_audit`（migration `0151`）へ本文も本文hashも保存せず、管理者ID、グループID、既存下書き有無、状態、モデル、token数、latency、採用商品ID、固定分類error codeだけを記録する。グループ別・管理者別30秒bucketのunique indexで複数replica間の同時生成も抑止する。

最終focused回帰は8ファイル73件成功。LINE-prefix＋group follow-up回帰は29ファイル297件成功し、残る5ファイル10件は本番DB、LINE Login／Messaging API secret・token・APP_URLがローカルにない既存環境依存だった。production buildは成功し、全量TypeScriptの既存721件のうち今回変更対象・revision実装範囲の新規診断は0件。独立再reviewは**GO（release blocker 0件）**。本検証では実LINEメッセージ送信、グループ設定ON、会員・グループデータ変更を行っていない。

機能commit `ca49c60e9fc822e16c52aabbbdd4fe31d9c55631`はGitHub CI success、Railway `Success - www.livecommercefestival.com`を同一SHAで確認した。read-only本番確認では`https://lcjmall.com/api/health/line-ai-manager`がHTTP 200で`{"ok":true,"aiManagerStorage":"ready"}`、`https://lcjmall.com/master/line`がHTTP 200を返した。配信中`LineManagement-DR8Lg53y.js`にAI文案作成、安全化、明示確認、未確認時送信拒否の各UI文言が含まれることを確認した。実LINE送信、設定変更、会員・グループデータ更新は実施していない。

## グループ履歴保存・全グループ自動ON（2026-09-21追加）

`/master/line`の全アクティブグループについて、`@LCJ返信`、会話分析、分析結果によるAI提案、自動追いを既定ONへ変更した。既存グループは`line_group_automation_rollouts`の一意な`rolloutKey`をclaimするtransactionで一度だけまとめてONにし、新規・再招待グループはgroup rowとAI設定rowを同一transactionでON初期化する。rollout markerが残るため、配備後に管理者が個別OFFへ変更しても再起動では上書きしない。各設定は引き続きグループ別にOFFへ戻せる。

自動ONの配備で古い会話に対する即時一斉送信が発生しないよう、`line_groups.autoFollowUpEnabledAt`を追加した。既存active groupのrollout、新規group作成、再招待、OFFからONへの変更時刻を保存し、follow-up候補抽出と送信直前claimの双方で、`lastMessageAt`、`createdAt`、`autoFollowUpEnabledAt`のうち最も新しい日時を無活動期間の起点にする。したがって、既存履歴が古くてもON直後から設定日数（既定2日）が経過するまで自動追い候補にはならない。送信時のactive確認、設定再確認、平日9〜18時JST、連携済み・有効なライブコマーサー、最新conversation revision、重複監査、決定的retry key等の既存guardは維持する。通常のgroup投稿への即時AI返信は、設定がONでも連携本人による明示的`@LCJ`／bot self mentionが必須であり、無差別返信には変更していない。

グループtext messageは`@LCJ`の有無に関係なく、LINE message IDを一意キーとして返信判定より先に保存する。管理画面には「履歴保存: 有効」を表示し、会話Dialogで最大200件を確認できる。ただしLINE Messaging APIはbot参加前の過去会話を遡及取得できないため、保存・表示できるのは公式LINEをグループへ招待した後にWebhookで受信した会話だけである。この制約はgroup一覧と会話Dialogの両方へ明記した。

検証は自動ON rolloutの単一claim、再起動時no-op、ON時刻によるgrace、candidateと送信直前claimの同一activity anchor、group message一意保存、transaction lock順、設定更新、厳格`@LCJ`返信、一般AI無差別返信停止、lifecycleを含むfocused 9ファイル120件が成功した。LINE関連全体は29ファイル300件成功し、残る5ファイル10件は固定された別repository path、Stripe secret、LINE Login／Messaging API secret・token・APP_URLがローカルにない既存環境依存だった。production buildは成功し、既存`sharp` warningとローカルDB接続不可によるmigration継続ログ以外に今回起因のbuild failureはない。全量TypeScriptは既存診断でexit 2だが、今回変更した`LineManagement.tsx`、`lineAiManager.ts`、`groupFollowUpScheduler.ts`、`drizzle/schema.ts`、migration helperおよび`db.ts`／`routers.ts`の変更範囲に新規診断はない。本検証では実LINE送信および本番DBの直接更新を行っていない。

独立release reviewでは、初回にcandidate側と送信直前claim側で`autoFollowUpEnabledAt`を含むactivity anchorが一致しないP1を検出した。候補payloadへ`followUpActivityAt`を追加し、schedulerがその同一値をlocked claimへ渡すよう修正した後、境界時刻testと全LINE回帰を再実行した。最終再レビューは**GO（release blocker 0件）**である。
