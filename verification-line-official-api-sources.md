# LINE Messaging API 公式仕様・退会同期検証記録

調査・実装日: 2026-09-20

## 公式仕様

LINE Developersの[Webhook受信ガイド](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)では、受信前の`X-Line-Signature`検証、Webhookの非同期処理、同一`webhookEventId`再送への重複対策、`timestamp`に基づく順序判断が案内されている。グループ／複数人トークではmessage、join、leave、memberJoined、memberLeftなどのイベントを受信できる。

[Messaging APIリファレンス](https://developers.line.biz/en/reference/messaging-api/#get-group-summary)では、公式アカウントが参加中のグループについて、`GET /v2/bot/group/{groupId}/summary`でグループ概要を取得し、`POST /v2/bot/group/{groupId}/leave`で退会できる。今回の実装では、概要取得の200を参加中、400/404を退会済み、401/403/429/5xxまたは通信失敗を判定不能として扱い、判定不能時に誤って一覧から消さない。

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
