# LCF管理タブURL・アカウント並べ替え・マイページ第2回申込 検証記録

## 対象

- 本番URL: `https://www.livecommercefestival.com/lcf/admin?tab=accounts`
- 本番URL: `https://www.livecommercefestival.com/lcf/mypage`
- 機能コミット: `a6fc69f7`
- GMVランキングはユーザー指示により今回の対象外。既存GMVデータ・既存社内ランキングは変更していない。

## 実装

- LCF管理の8タブを`/lcf/admin?tab=<key>`のリンクへ変更した。
- 再読込、共有URL、ブラウザの戻る／進むで選択タブを復元する。
- 不正な`tab`値は`dashboard`へ置換し、管理者認証境界は変更しない。
- 申込一覧から対象アカウントを開く場合は`?tab=accounts&email=<encoded>`を使用する。
- アカウント一覧は表示対象825件全体について、新規登録順、古い順、最終ログイン新しい順、最終ログイン古い順、会員種別順を選べる。
- マイページの第2回カードに、会員ロールに応じた企業・ブランド／ライブコマーサー申込CTAを追加した。
- `eventYear='2026-02'`の同種申込がある場合は申込済み状態を表示し、同じ申込CTAを出さない。
- 第1回の申込、QR、受付、VIP、アフターパーティー、ブース予約、開催履歴は変更していない。

## 検証

- 対象回帰4ファイル25件成功。
- LCF・Festival・LCM関連33ファイル238件成功。
- production build成功。ローカルDB未接続によるmigration `ECONNREFUSED`は既存の継続可能な出力で、bundle生成は完了した。
- 全体TypeScriptには既存診断が残るが、今回の新規テストは成功し、変更したマイページに新規診断はなかった。LCF管理画面の抽出診断は変更前から存在する受付／予定更新の既存4種だけだった。
- GitHub Actions CI run `35088940900`はコミット`a6fc69f7`でsuccess。
- Railway status `lcjagent - lcjgent`は同一コミットでsuccess。

## 本番読取確認

- `https://www.livecommercefestival.com/lcf/admin?tab=accounts`がアカウントタブを直接開いた。
- ナビゲーション8項目がそれぞれ`?tab=`リンクとして表示された。
- アカウント一覧は対象825件と表示し、既定の「新規登録順」で最新登録ID `#30552`から降順表示された。
- 表示順コンボボックスに新規登録順などの選択肢が反映された。
- `https://www.livecommercefestival.com/lcf/mypage`は管理者セッションでも通常マイページを表示し、企業・ブランド向け第2回申込CTAを表示した。
- CTAは`/lcf/apply/company?edition=2`へ接続し、共通アカウント情報を引き継ぐ説明を表示した。
- 本番では申込作成、アカウント変更、メール送信などの書込み操作を行っていない。
