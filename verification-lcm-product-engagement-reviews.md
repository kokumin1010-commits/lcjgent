# LCM 商品エンゲージメント・レビュー機能 検証記録

## 対象

LCMの商品カード縮小、興味あり、サンプルカート、開催回別出展実績、正式連携、配信向き情報、実利用確認済みレビュー、ブランド通報、運営審査。

## ローカル画面確認

- 2026-09-16、`http://localhost:4173/lcm` をデスクトップ表示で確認。
- 第1回LCFアーカイブ29商品が保持され、商品カードは従来の4列大型表示から比較しやすい5列表示へ縮小された。
- 各アーカイブ商品に「第1回LCF 出展実績」、ブランド名、商品名、当時の掲載価格、掲載情報リンクが表示された。
- 検索、カテゴリ、新着、配信情報あり、サンプル対応の既存フィルターを保持した。
- 公開商品・公開ブランドが0件の現行データでも、第1回アーカイブを表示して空のマーケットに見せない状態を保持した。
- 390×844および390×3000の固定viewportで確認した。ヒーロー、検索、件数、カテゴリは横にはみ出さず、アーカイブ商品は2列で表示された。
- モバイル商品カードは正方形画像、開催実績タグ、ブランド名、2行の商品名、価格、詳細リンクの順で収まり、従来の大型カードより一画面内で比較できる件数が増えた。

## 自動検証（進行中）

- LCF・LCM関連31ファイル216件成功。
- production build成功。ローカルDB未接続によるmigration `ECONNREFUSED` は従来どおり継続可能として記録され、bundle生成自体は成功。
- 全体TypeScript既存診断768件のうち、今回変更ファイルの新規診断は0件。

## 未完了

- 機能コミット `15d07705` はGitHub mainへpush済み。GitHub CIは成功。
- Railwayは同一SHAで約7分後に `Deployment failed`。RailwayプロジェクトURLを既存ブラウザで開いたが、画面はローディング状態のままでログ本文を取得できなかった。
- 本番主要URLは旧デプロイのままHTTP 200。配信entry `index-C6KrOwFA.js` は旧LCMチャンクを参照しており、新機能はまだ本番反映されていない。
- Railway失敗原因の特定、修正、再デプロイ、本番HTTP・ブラウザ確認。
- 本番データを書き換えない読取確認。

## Railway hotfix・本番再確認

- Railway初回失敗は、新規表・nullable列だけの加算的upgradeでもサーバーlisten前に全DBバックアップ完了を待つ経路へ入り、過去のcreator追加時と同様にデプロイhealth timeoutへ到達したことが原因と判断した。
- `83412a8b` で、新規エンゲージメント表と商品4列だけの追加を専用の加算的upgradeへ分離した。既存表件数、新規表の空状態、追加列、出展実績バックフィルを検証・記録しつつ、長時間の全DBバックアップ待ちは回避する。
- GitHub CI成功、Railway同一SHA成功。主要5 URLはHTTP 200、entryは`index-88VFsEv-.js`へ更新され、新しい`LcmSampleCart`、`LcmMarket`、`LcmProduct`、`LcmManage`、`LcmAdmin`チャンクと主要文言を確認した。
- 本番 `/lcm` で第1回LCFアーカイブ29商品、5列コンパクトカード、開催回実績タグ、当時価格、検索・フィルターを確認した。
- 本番 `/lcm/sample-cart` は未認証状態で初期ローディング表示まで確認。認証判定完了後の共通ログイン案内を引き続き確認する。
- 既存LCF管理者セッションではサンプルカート0商品、興味あり0商品、購入カートではない旨、商品一覧への復帰、ヘッダーの小型カート件数を確認した。サンプル追加・正式申請などの書込みは実施していない。
- 本番 `/lcm/admin?tab=reviews` は社内`/login`へ遷移せずLCF管理者セッションのまま読込みを開始した。レビュー・通報が0件のため、書込み操作は行わず空状態を確認する。
- 読込み完了後、LCM運営の「レビュー」タブ、レビュー審査0件、レビュー通報0件、既存の会員・ブランド所有・ブランド・商品・申請商談・監査タブを確認した。
- 本番 `/lcm/manage?workspace=brand` は初期認証判定のためローディング中。完了後にレビュー確認入口と商品登録画面を読取確認する。
- ブランド管理の読込み完了後、仮連携中のブランドと既存下書き商品を保持したまま、コンパクト商品カード、画像拡大、定価、公開準備100%を確認した。
- 既存商品の「編集」を開き、5ステップ構成、メイン写真・ギャラリー、定価／参考小売価格の公開注記、下書き保存・取消を確認した。保存操作は行っていない。
- 「商品の魅力」ステップで、30秒で伝えるポイント、実演方法、想定視聴者、NG表現・注意事項の4欄と、未入力時は推測せず準備中表示にする説明を確認した。
- DOMの`value`と`placeholder`を分離して確認し、4欄の例文はplaceholderだけで、既存商品へ推測値・架空内容が保存されていないことを確認した。
- 390×3000の本番モバイル撮影で、検索、カテゴリ、2列商品カード、正方形画像、第1回LCF出展実績タグ、ブランド、商品名、当時価格が横溢れなく表示されることを確認した。

## 最終結果

| 項目 | 結果 |
|---|---|
| 機能コミット | `15d07705 feat(lcm): add product engagement and verified reviews` |
| Railway hotfix | `83412a8b fix(lcm): avoid backup timeout for additive upgrade` |
| 関連回帰 | 31ファイル216件成功 |
| TypeScript | 全体既存診断768件、今回変更ファイル0件 |
| production build | 成功 |
| GitHub CI | `83412a8b` 成功 |
| Railway | `83412a8b` 成功 |
| 本番主要URL | `/lcm`、`/lcm/sample-cart`、`/lcm/manage?workspace=brand`、`/lcm/admin?tab=reviews`、第1回出展アーカイブがHTTP 200 |
| 本番書込み | 0件。商品保存、興味登録、カート追加、サンプル申請、レビュー投稿・審査・通報は未実施 |

公開レビューは`published`だけを集計し、表示名を返さず、実利用確認ラベルと会員種別だけを表示する。第1回出展実績、ブランド正式連携、サンプル受取確認、取引確認はサーバー側の実データから派生し、ブランド自由入力では作成できない。第1回アーカイブ商品には現在申請可能と誤認させるCTAを出さない。

## 公開商品からのブランド連絡thread（2026-09-25追加／本番反映済み）
商品詳細の最優先actionとして、sample可否に依存しない「ブランドさんに連絡」を追加した。従来の「サンプル受付なし」などのnegative status表示は外したが、sample申請、sample cart、興味あり、取引条件の既存actionとstate machineは変更していない。
連絡は`lcm_brand_contacts`と`lcm_brand_contact_messages`へ保存する。両tableと索引は既存dataを更新しない加算的runtime upgrade `v5-brand-contacts`で作成し、named lock、required-table確認、件数検証、upgrade auditを既存setupへ接続した。問い合わせ者は自分のaccountに限定された一覧を、brand側はactive brand membershipを持つbrandの受信箱だけを参照・返信できる。self-brand問い合わせは禁止した。thread一覧は`lastMessageAt + id`、message履歴はimmutable `id`のkeyset cursorで継続取得し、固定ページ上限を置いていない。
初回送信と返信はtransaction内でmessage、thread更新、entity auditを保存してからemail通知を行う。送信者ごとの10分5件制限はmembership rowの`FOR UPDATE` lockで並行送信にも原子的に適用する。brand通知先はactive owner roleだけに限定し、owner未連携時はLCM運営受付へfallbackする。このfallbackは送信前案内と送信後toastの双方に明示する。email addressはAPI response、UI、audit metadataへ含めず、通知subjectはcontrol文字を除去する。返信失敗時はdraftを保持する。
関連回帰はLCM contact／marketplace focused 2 files・26 tests、および全LCF／LCM 43 files・306 testsに成功した。exact production build、変更server／UI bundle、diff／secret監査も成功。全体TypeScript既存1,163 diagnosticsに対し今回変更fileは0件。desktop／mobileの実build CSS fixtureで商品CTA、連絡form、thread、reply、load-moreの読みやすさと非重複を確認した。実email送信、production DB書込み、sample／卸取引mutationは行っていない。
feature SHA `8874fd41b15d96a599796b9f27d61a19fdcc2c1d`はGitHub CI success、Railway deployment `6655961479`も同一SHAでproduction success。本番`/lcm`と`/lcm/products/drkozu-cell-peel-crystal`はHTTP 200。配信`LcmProduct-gQwXhH2t.js`に「ブランドさんに連絡」とowner未連携fallback、`LcmManage-2GFDmGQp.js`に双方の履歴画面とthread／messageの追加読込を確認した。「サンプル受付なし」は配信商品chunkにも実DOMにも存在しない。本番商品詳細をdesktop／mobileで再撮影し、contact CTAが補助actionより優先され、通知案内を含めて横溢れ・重なりがないことを確認した。acceptanceはGET／DOM read-onlyだけで、連絡作成、email、返信、sample、卸取引のmutationは行っていない。

## LCM導線簡素化とキャンペーン一時非公開（2026-09-25追加／本番反映済み）
LCM headerは「商品を探す」「ライブコマーサーを探す」だけにした。LCM全画面の共通アカウントmenu枠、商品一覧上部の一般説明、同じ場所の「定価を公開」「サンプル対応」「取引条件は会員限定」を削除した。商品／ブランド／第1回特集の実数、検索、カテゴリ、商品card、利用目的別の`START WITH YOUR ROLE`は別要素のため維持した。desktop 1440pxとmobile 390pxで、2項目が読めること、mobileで1行表示かつ横溢れしないことを確認した。
ブランド検索は検索機能を残し、前置きの`START WITH YOUR BRAND`説明枠だけを削除した。管理中brandの表示は「あなたが管理してるブランド」に統一した。
キャンペーンは単一のshared flagをOFFにし、保存済みdataを削除せず非公開化した。browser routeは登録せず、公開URLは404、`X-Robots-Tag: noindex, nofollow, noarchive`と`Cache-Control: no-store`を返す。robots／sitemap、public footer／market／brand page、会員manage、admin tab／metric／panelから導線とdataを除外した。public list/detail、会員用campaign操作、admin moderationはserverでもfail-closedにし、guardがDBより先に実行される。brand manageとadmin overviewもOFF時はcampaign queryを実行せず空配列を返す。admin再公開を含むruntime testでDB非参照のNOT_FOUNDを確認した。
関連回帰は全LCF／LCM 43 files・308 tests成功、production build成功、変更module bundle成功、diff整合性監査成功。全体TypeScript既存1,163 diagnosticsに対し今回LCM scopeは0件。独立review最終結論は**GO（P0/P1 0件）**。本番書込みを伴う操作は行っていない。
feature SHA `5f4986f88ef9d05fc58328df78f6c7166e4172b6`はGitHub CI success、Railway deployment `6656828492`も同一SHAでproduction success。本番`/lcm`はHTTP 200。`/lcm/campaigns`はHTTP 404で、`X-Robots-Tag: noindex, nofollow, noarchive`と`Cache-Control: no-store`を返す。公開campaign APIのresponseは空配列、robotsはcampaign pathをDisallow。本番assetsでもheaderは2項目だけで、共通アカウント枠、指定hero説明／3表示、brand検索intro、admin campaign管理panelは配信されていない。本番desktop 1440pxとmobile 390pxの再撮影でも、headerとheroに重なり・横溢れはない。確認はGET／DOM read-onlyだけで、campaign、商品、brand、連絡、sample、卸取引の書込みは行っていない。

## 商品詳細「ブランドさんに連絡」のmobile tap修正（2026-09-25追加／本番反映済み）
商品詳細の最優先CTA「ブランドさんに連絡」を、Wouterのclient navigationからnative `<a href>`へ変更した。未login時は既存の共通login URLへ進み、encoded return pathとして`/lcm/manage?contact=<productId>`を保持する。login済み時は同じcontact formへ直接進む。CTAには`touch-manipulation`、明示的な`z-index`、64px以上の高さ、brand名を含む`aria-label`を追加し、mobileでtapを確実に受ける構造へした。

問い合わせthread、履歴、brand owner通知、担当者未連携時のLCM運営fallback、rate limit、認可境界は変更していない。focused contact／marketplace 2 files・26 tests、全LCF／LCM 43 files・309 tests、production build、変更component bundleに成功した。全体TypeScript既存1,163 diagnosticsに対し今回変更fileは0件。独立read-only reviewはGOで、検証中に連絡作成、email通知、返信、production DB書込みは実行していない。

feature SHA `ded1ea6101fd0ace7d1a97bc50c1e6f16ca9e4a9`はGitHub CI run `36133091871`とRailway production deployment `6660311604`がsuccess。本番商品詳細はHTTP 200で、entry `index-DuFbB8c-.js`が`LcmProduct-BI2x6x1h.js`を参照している。390px mobile実画面でCTAは350×64px、`pointer-events:auto`、`z-index:10`のnative anchorとして表示された。CTA中央を実tapすると、`https://www.livecommercefestival.com/lcf/login?return=%2Flcm%2Fmanage%3Fcontact%3D6`へ遷移し、商品6のcontact formへのreturn pathが保持された。検証はlogin画面への遷移までで、連絡送信・email・DB書込みは行っていない。
