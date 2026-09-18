# 第2回LCF 会場外部リンク削除 検証記録

## ユーザー指示

第2回LP `/2nd` の会場セクションにある「会場公式情報を見る」から、東京都立産業貿易センター浜松町館の公式料金ページへ遷移させない。公式料金表がそのまま表示されると、LCFの出展価格そのものと誤解され、出展価値が低く見える可能性があるため、会場情報はLP内で完結させる。

## 実装

`client/src/pages/LcfSecondEdition.tsx` の `Venue()` から、外部URL `https://www.sanbo.metro.tokyo.lg.jp/hamamatsucho/facilities/floor/02-05/` とリンク文言「会場公式情報を見る」を含むアンカーを削除した。

一方で、開催会場名「東京都立産業貿易センター浜松町館 2階展示室」、会場説明、約1,530㎡、天井高5m、無柱空間、フローリングのLP内情報は維持した。第1回ページ、企業・ブランド／ライブコマーサー申込、LCF/LCM共通アカウント、QR、受付、SEOには変更していない。

`server/lcf-second-edition-page.test.ts` には、会場名・面積の既存契約に加えて、リンク文言と `sanbo.metro.tokyo.lg.jp` のURLがソースに存在しないことを検証する回帰を追加した。

## 検証

| 検証 | 結果 |
|---|---|
| 差分チェック | `git diff --check` 成功。機能差分は2ファイル、3追加・1削除に限定 |
| 専用回帰 | 2ファイル17件成功 |
| LCF/LCM関連回帰 | 36ファイル239件成功 |
| festival関連回帰 | 3ファイル27件成功 |
| Production build | ViteとExpress/esbuild成果物生成に成功 |
| DB migration | ローカルDB未起動のため既知の `ECONNREFUSED`。既存スクリプトが `Continuing despite error...` で継続し、build成果物は生成済み |
| TypeScript全体 | 8GBヒープで既存768件。今回変更した `LcfSecondEdition.tsx` と専用回帰に診断なし |
| ローカルDOM | `#venue` 内アンカー0件、リンク文言なし、外部会場URLなし、会場名あり、横スクロール0px |
| GitHub Check | commit `9c41d8bd` と同一SHAで `completed/success` |
| Railway | `lcjagent / production` が同一SHAで `success` |
| 本番PC DOM | 1280×1100。`#venue` 内アンカー0件、リンク文言なし、ページ全体にも外部会場URLなし、会場名・説明あり、横スクロール0px |
| 本番モバイルDOM・目視 | 390×844。`#venue` 内アンカー0件、リンク文言・外部会場URLなし、会場名・説明あり、横スクロール0px。リンク削除後の不自然な空白・重なり・見切れなし |

## 本番確認

本番 `https://www.livecommercefestival.com/2nd#venue` は、タイトル「第2回 LIVE COMMERCE FESTIVAL｜2026年12月8日・9日 浜松町館」で表示された。会場セクションには開催会場名と会場説明が残り、「会場公式情報を見る」は表示されず、同セクション内のアンカーは0件だった。ページ全体にも `sanbo.metro.tokyo.lg.jp` へのリンクは存在しない。

モバイル幅390×844では、`05 / HAMAMATSUCHO`、見出し、会場名、説明から会場仕様カードへ自然に続く。削除したリンクの跡に不自然な空白はなく、文字の横切れ、要素の重なり、横スクロールもない。

本番検証はGET-onlyとDOM確認に限定し、申込作成、ログイン情報、会員データ、管理データへの書込みは行っていない。
