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
| グループ | LINE公式の`mention.mentionees[].isSelf=true`または`@LCJ`／`＠LCJ`／`@714isnih`だけを明示メンションとして判定し、AIサービスにも検証済みフラグを渡す。「エージェントさん」等の曖昧文では起動しない。メンションなしはプロフィール取得・DB保存・AI処理を行わず即時無視する。連携本人のメンションだけを永続キューへ登録し、返信先と履歴には元の`lineGroupId`を使う。DM履歴、売上、内部メモ、個人情報はグループ用プロンプトへ渡さない。ポイント履歴・リマインダー等はグループで照会・更新せず1対1トークへ案内する |
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
