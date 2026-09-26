# 第2回LCF キービジュアル・公式映像・第1回写真 検証記録

## 対象

- 本番予定URL: `https://www.livecommercefestival.com/2nd`
- 指定キービジュアル: `LCF_ロゴ_LP-08.webp`
- 指定映像: YouTube `UtbivO04Cp8`（株式会社NAC公開「LIVE COMMERCE FESTIVAL2026」）
- 第1回公式写真: `/livecommercefestival/2026/report`で使用中のCDN画像

## 実装前監査

第1回公式レポートには48枚の選抜公式写真と、確認済み実績として来場ライバー750名以上、参加企業50社、GMV8,000万円、販売数23,958点、DAY2全セミナープログラム満席が掲載されている。第2回ページでは、この既存データ定義と同一CDN URLを参照し、推測値や新しい実績は追加しない。

## ローカル確認

| 確認項目 | 結果 |
|---|---|
| デスクトップ・ファーストビュー | 指定キービジュアルを上部基準の16:9で表示し、LCFロゴ、3名の人物、日程、主要コピーが表示された |
| モバイル・ファーストビュー | 390×844pxで指定画像を縦横比どおり全体表示し、画像内ロゴ・人物・日程・下部写真に横切れや重なりなし |
| 申込CTA | 指定画像直下の独立操作帯に、企業・ブランド申込、ライブコマーサー申込、LCM、開催情報を配置し、画像内デザインと重複操作を分離した |
| 公式動画 | `youtube-nocookie.com`で読み込み、ミュート自動再生状態の「Tap to unmute」を確認。YouTube外部視聴リンクと手動操作を保持した |
| 第1回開催実績 | 公式映像直後に第1回公式写真4枚と確認済み実績を表示し、ページ前半で開催実績を確認できる |
| 写真の分散 | 来場・配信・商品体験・商談・セミナーに対応する公式写真10枚を重複なしで各関連セクションへ配置した |
| 画像最適化 | ファーストビュー以外の公式写真は寸法属性と`loading="lazy"`を指定した |
| クライアントエラー | ブラウザコンソールにReact・画像・iframe関連エラーなし |
| 指定画像CDN | HTTP 200、`image/webp`、303,444 bytesを確認 |
| 第1回写真の重複 | 選定した10枚の写真IDが各1回だけ参照され、同じ写真の使い回しなし |

デスクトップの公式映像直後を目視し、白背景の開催実績セクションに、会場全景を大きく、来場風景・ライブ配信・ステージを非対称に組み合わせた写真グリッドが表示されることを確認した。見出し、説明、写真の順に視線が流れ、黒背景の動画セクションとの境界も明確である。

## 回帰

- 第2回ページ専用回帰: 15件成功
- LCF・LCM関連全回帰: 42ファイル・295件成功
- クライアント単体esbuild: 成功
- `pnpm run check`: 既存の`server/_core/index.ts`等の既知エラーでexit 2。今回変更した`LcfSecondEdition.tsx`・専用回帰には新規エラーなし。`server/_core/index.ts`で報告された既存4件は今回変更した画像URL行とは無関係
- production build: 成功（クライアント・サーバーbundle生成完了。ローカルDB非起動によるmigrationsの`ECONNREFUSED`は継続可能扱い）

## 本番確認方針

本番ではGET-onlyでファーストビュー、動画、公式写真、申込CTA、LCMリンク、OG画像、画像サイトマップを確認する。申込送信やアカウントへの書込み操作は行わない。

## 本番GET-only確認

機能コミット`7412609f`に対するGitHub checkとRailwayデプロイは成功した。本番`/2nd`はHTTP 200を返し、次を確認した。

| 確認項目 | 本番結果 |
|---|---|
| 指定キービジュアル | DOM上の画像URLは`AnPNzcemGiRReCxl.webp`、読込完了、natural size 2048×1747 |
| 公式動画 | `youtube-nocookie.com/embed/UtbivO04Cp8`を、ミュート・自動再生・インライン再生・ループ指定で読込 |
| 第1回公式写真 | DOM上に公開許可済み公式写真10枚を確認 |
| 実績 | 750名以上、GMV8,000万円、販売数23,958点、参加企業50社、DAY2セミナー満席を確認 |
| 既存導線 | 企業・ブランド申込、ライブコマーサー申込、LCM、初心者支援、会場、第1回レポートを保持 |
| SEO | bot向けHTMLで指定OG画像、GMV8,000万円、販売数23,958点を確認 |

本番の申込送信やアカウントへの書込み操作は実行していない。

## 指定版 LP_TOP_v2 への差し替え（2026-09-26／本番反映済み）
- 提供原本: `/home/ubuntu/upload/pasted_file_YefmGT_LP_TOP_v2(3).webp`
- 実寸／形式: 2048×1745、WebP RGB、308,242 bytes
- SHA-256: `68de5309131783ff4b008e84dd7895f63722b3566ef9586d9e39a7558b171155`
- 本番CDN: `https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/MMteMRKpTWljOHRT.webp`
- client hero、`/2nd` OGP/Event JSON-LD、sitemap imageを新URLへ統一。旧`AnPNzcemGiRReCxl.webp`はactive code・production page chunkから除去。
- 実サイトの申込buttonをクリック可能なまま残すため、完成画像内の上部button帯は従来の7.1% cropで重複表示を回避。
- 検証: focused 3 files・29 tests、LCF 36 files・246 tests、production build、CDN MIME／dimension／binary一致、1280×900・390×844 visual、GitHub CI、Railway deploymentすべて成功。
- Release: feature SHA `636b4b518050849f1835b1d4fdf15ae3421c602b`、CI `36242956932`、Railway deployment `6678994098`。
- Production: `/2nd` HTTP 200、entry `index-D0M27IW2.js`、page chunk `LcfSecondEdition-cNMlrquY.js`、bot OGP、sitemapで新URLを確認。外部action、申込、DB mutationは実施していない。
