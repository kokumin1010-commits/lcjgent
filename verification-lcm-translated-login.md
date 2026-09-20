# LCM共通ログイン・ブラウザ翻訳DOM競合 修正記録

## ユーザー報告

2026-09-20、`https://www.livecommercefestival.com/lcm` からLCF / LCM共通ログインへ進み、ブラウザ翻訳で日本語画面を中国語表示した状態でログインすると、LCMマイページへ進まず「画面の描画中にエラーが発生しました」と表示される事象が報告された。

提供された録画では、ログイン送信後に `Node.insertBefore` の `NotFoundError` が表示され、再読込後は共通ログインへ戻っていた。録画にはアドレスバーが映っていないため、誤った外部URLまたは社内`/master`へ移動した事実は確認されていない。

## 根本原因

共通ログインの送信ボタンは、認証mutationの状態に応じて「ログイン」要素と「ログイン中...」要素を条件分岐で差し替えていた。ブラウザ翻訳は表示中のテキストノードを独自の`font`要素で包むため、Reactが保持する仮想DOMと実DOMの親子関係が一致しなくなる。その状態でmutationがpendingへ切り替わると、Reactの`insertBefore`処理が存在しない参照ノードを使い、画面全体のError Boundaryへ到達していた。

本番画面へ実アカウントを送信しない再現試験では、`festivalAuth.login`を固定の認証失敗レスポンスで置き換え、ログイン文字を翻訳拡張と同じネスト要素で包んだ。修正前の配信画面で `ERR_LCJ_UI_RENDER` と同じ `insertBefore` NotFoundErrorを安定再現した。URLは `/lcf/login?return=%2Flcm%2Fmanage` のままであり、直接原因はreturn先ではなくDOM競合だった。

## 修正

ログイン、パスワード再設定メール、新規登録、パスワード更新の各送信ボタンは、待機中と通常時の両方のラベルDOMを最初から固定して描画し、mutation中は`visibility`と`aria-hidden`だけを切り替える共通`StableMutationLabel`を利用する。非表示側も同じgridセルで幅を保持するため、ラベル変更による横揺れも発生しない。翻訳拡張が内部テキストを包んでも、Reactはその子ノードを削除・挿入しない。

認証成功時の安全なreturn処理は変更していない。LCMトップからのログインは引き続き同一originで検証された `/lcm/manage` をreturnとして渡し、成功後は `window.location.replace(safeReturn)` でLCM管理画面へ進む。外部URL、`//`、バックスラッシュ、制御文字は従来どおり拒否する。

Error Boundaryには中立的な `ERR_LCJ_DOM_MUTATION_CONFLICT` を追加した。`NotFoundError`で`insertBefore`または`removeChild`を含む場合だけこのコードを表示し、それ以外の描画障害は従来の`ERR_LCJ_UI_RENDER`を維持する。本番画面からJavaScript stackを除去し、開発モードだけで表示する。ログイン、パスワード再設定メール、新規登録、パスワード更新のAPIエラーはtRPCコードの許可リストから固定文言へ変換し、無効リンクと成功メッセージも固定文言で表示する。未知のサーバー文言を直接表示せず、入力メール、パスワード、契約・商品・会員データはエラーコードや画面ログへ含めない。

共通ログインの各入力欄は`label`と`id`を明示的に関連付け、パスワード表示ボタンへ状態別`aria-label`を追加した。非同期エラーは`role="alert"`、成功通知は`role="status"`として読み上げ可能にした。

## 検証

LCF / LCM関連11ファイル101件の回帰テストは全件成功し、production buildも成功した。全量TypeScript検査は既存721件で終了コード2だが、今回変更したログイン、パスワード更新、Error Boundary、認証エラー許可リストhelper、DOMエラー分類helper、回帰テストの診断は0件だった。production bundleでは新しいDOM競合コードと認証固定文言を確認し、Error Boundaryのstack描画分岐が`false`へ除去されていることも確認した。

最終buildへ翻訳DOM包装を再適用したブラウザ試験では、固定の認証失敗は共通ログイン上にエラーを表示し、Error Boundaryへ移動しなかった。固定の認証成功は `/lcm/manage` へ遷移し、`insertBefore`エラーは発生しなかった。1280×900と390×844の両方で共通ログインを確認し、横方向のはみ出し、ページエラー、ボタン欠落はなかった。

本番の実アカウントログイン、会員作成、申込、ブランド・商品更新、管理操作などの書込みは行っていない。
