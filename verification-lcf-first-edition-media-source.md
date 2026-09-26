# 第1回公式映像・配信写真・集合写真 検証メモ

## ユーザー修正指示

現在のMP4は第2回の映像ではなく、**第1回LCFの公式映像**として扱う。動画下の不要な余白をなくし、提供された第1回のライブ配信写真3枚と、人が最も多く写っている集合写真1枚を同じ第1回実績の流れで掲載する。

注釈スクリーンショット`16.56.46`には「ライバーたちが配信してる写真を追加（前回写真使用）」と明記されている。`16.56.53`は「見る展示会から、売る展示会へ。」と企業・ブランド／ライブコマーサー申込CTAの既存構成を示す参考であり、今回も申込導線を保全する。

注釈スクリーンショット`16.57.05`は、提供された配信写真3枚を**動画へ進む流れの周辺**へ追加する指定を示す。`16.57.20`は、ヒーロー情報ブロックと公式映像見出しの間にある黒い空白を赤線で囲み、「ここの余白不要」と明記している。実装では`Hero`下余白と`OfficialMovie`上余白の重複をなくし、セクションを連続させる。

注釈スクリーンショット`16.57.36`には「この辺りにわかりやすく配置したい」「この辺りに1回目の集合写真などを入れる」とあり、`PROOF FROM EDITION 01 / 開催した事実が、第2回の土台。`の導入部付近へ集合写真を大きく置く指定である。`16.57.47`でもヒーロー情報ブロックと映像見出しの間の余白不要が再掲されている。

## 提供画像の確認

| ファイル | 確認した内容 | 掲載用途 |
|---|---|---|
| `pasted_file_TrE8s2_S__62767119_0.jpg` | 1566×1046。2名がスマートフォンとPCを使い、のむシリカ商品を紹介・配信している第1回LCF実景。右下にLCFロゴあり。 | 第1回ライブ配信写真1 |
| `pasted_file_9pygjn_S__62767120_0.jpg` | 1566×1046。2名がスマートフォン前で化粧品を説明・配信している第1回LCF実景。右下にLCFロゴあり。 | 第1回ライブ配信写真2 |
| `pasted_file_oNmH4i_S__62767121_0.jpg` | 1566×1046。2名がスマートフォン前で商品を手に取り、実演しながら配信している第1回LCF実景。右下にLCFロゴあり。 | 第1回ライブ配信写真3 |
| `pasted_file_DN2d9P_DSC00260-opq4998131537(2).webp` | 2048×1367。第1回LCF会場で多数の参加者が一堂に写る集合写真。中央のイベントバックパネルと右下のLCFロゴが確認できる。 | 第1回LCF集合写真 |

3枚のライブ配信写真は横並びまたはレスポンシブなカード列、集合写真は人数と会場の広がりが伝わる大きな横長枠で扱う。人物やイベントロゴが見切れないことを優先し、元画像の情報を保持する。

## Web配信用資産

元画像は`/home/ubuntu/webdev-static-assets/lcf-first-edition-media/originals/`へ保全し、EXIF向き補正、RGB変換、内容を切らないWebP変換を行った。配信写真は元寸法1566×1046、集合写真は縦横比を維持して2000×1335とした。

| 用途 | 容量 | SHA-256 | 公開CDN |
|---|---:|---|---|
| ライブ配信写真1 | 198,944 bytes | `e530f575365a35c1fe6e159993b4a321c2f7ef223f749d3ab3956432ec0891ea` | `https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/OzwIxCrBoqVTRYjO.webp` |
| ライブ配信写真2 | 104,310 bytes | `51fdcb6b29dd17bddf4d1e0c352d430cea4ab0d44eb1cc4a58ab04ab259c3b0a` | `https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FhjXJvENBliUYoML.webp` |
| ライブ配信写真3 | 136,966 bytes | `e3feba94b990baabe1aaec3c81d90ce2eaac1afb1c08408188f9eb87070bfdc2` | `https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/TRjHSeDffLjxseCh.webp` |
| 第1回集合写真 | 289,960 bytes | `05cdf508503b0389f54db559f96eba65775c75972181a5c485a73325ec360a3d` | `https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zWSHOAymGWjysDJu.webp` |

`manus-upload-file --webdev`が返す`/manus-storage/...`は外部Railway本番ドメインではSPA HTMLへフォールバックしたため、画像として配信できる公開CDN URLを実装に使用する。

## ローカル実画面確認

最新ソースを配信するVite開発サーバーで`/2nd`を開き、ヒーロー内リンクが「第1回公式映像を見る」へ変わり、映像説明が「第1回LCFで生まれた会場の熱気」から始まることを確認した。提供されたライブ配信写真3枚と集合写真1枚も、各CDN URLからページ内へ読み込まれている。

PC実画面では、ヒーロー情報ブロックの直後から`EDITION 01 / OFFICIAL MOVIE`が始まり、注釈で囲まれていた大きな黒い空白は解消された。動画の直下には3枚の配信写真が同じ高さで横並びになり、その直後の白い`PROOF FROM EDITION 01`導入部で、見出し・説明に続いて集合写真が大きく表示される。人物、商品、右下LCFロゴ、集合写真の全体に見切れは確認されなかった。

PC幅1280pxでは配信写真3枚が同じ高さの横3列で並び、各キャプションと番号が判読できる。モバイル幅390pxでは1列の縦積みになり、写真は348×232pxで人物、商品、配信スマートフォン、右下LCFロゴを保持した。ドキュメント横幅は390pxで横スクロールはなく、ヒーロー末尾と公式映像セクションの計測上の間隔は`0px`だった。

集合写真はPC幅で最大幅内に大きく表示され、左右端の参加者、中央の人物、会場天井、右下LCFロゴまで全体が保持される。モバイル幅390pxでも横幅350px内へ縦横比を保って縮小され、写真全体、キャプション「第1回 LIVE COMMERCE FESTIVAL 集合写真」、`EDITION 01 / REAL SCENE`が判読でき、黄色のブランドシャドウも右・下だけに収まる。

PC DOM計測では、配信写真3枚は全て`complete: true`、自然寸法1566×1046、表示寸法385×256.656pxだった。集合写真も`complete: true`、自然寸法2000×1335、表示寸法1152×768.953pxで、4枚ともCDNから正常に読まれた。ヒーロー末尾と映像セクションの間隔は`0px`、横スクロールはない。ローカル検証をVite単体で行ったため`festivalAuth.me`のtRPCリクエストだけはHTML応答をJSONとして読めない既知エラーになったが、写真・映像・レイアウトの描画には影響せず、本番ではExpress APIと同一オリジンで提供される。

## 回帰・ビルド

| 検証 | 結果 |
|---|---|
| 専用回帰 | `lcf-second-edition-page.test.ts`と`lcf-top-second-link-spacing.test.ts`、17件成功 |
| LCF/LCM関連回帰 | `server/lcf`・`server/lcm`フィルター、36ファイル239件成功 |
| festival関連回帰 | 申込メール・パスワード再設定・一般申込UX、3ファイル27件成功 |
| 合計 | 39ファイル266件成功 |
| Production build | ViteとExpress/esbuildの成果物生成に成功 |
| DB migration | ローカルDB未起動のため`ECONNREFUSED`だが、既存スクリプトの`Continuing despite error...`でbuildは完了 |
| TypeScript全体 | 8GBヒープで実行し既存768件を確認。`LcfSecondEdition.tsx`と回帰ファイルに診断なし。変更した`server/_core/index.ts`では変更行1914と無関係な既存4件のみ |

最初の関連回帰は`JWT_SECRET`未設定で停止したため、32文字以上のテスト専用値を明示して再実行した。機能失敗ではなく検証環境要因であり、再実行結果は上表のとおり全件成功した。

## 機能コミット・本番確認

機能コミットは、並行してorigin/mainへ追加されたTiDB性能修正`ae3c4809`とHRアーカイブ修正`e5d4d9b0`を順番にrebaseして保全し、`7cd79127`としてpushした。GitHubの`check`はsuccess、Railwayの`lcjagent - lcjgent`も同一SHAで`Success - www.livecommercefestival.com`となった。

本番`https://www.livecommercefestival.com/2nd`で、ヒーローリンク「第1回公式映像を見る」をクリックして`#official-movie`へ遷移した。見出しは`EDITION 01 / OFFICIAL MOVIE`、説明は第1回LCFの会場・出会い・ライブ配信実景として表示され、プレイヤーはページ内HTML5動画のまま維持されている。ヒーロー情報ブロックと映像セクションの間に注釈対象だった大きな黒い空白はない。動画直下に提供された配信写真3枚、`PROOF FROM EDITION 01`見出し直下に提供された集合写真がCDNから正常表示されることを確認した。

本番DOM計測ではヒーロー末尾から映像セクションまで`0px`、横スクロールなし。配信写真3枚は全て自然寸法1566×1046、集合写真は2000×1335で`complete: true`だった。MP4は提供CDNを`currentSrc`としてduration 60.734秒、`readyState: 4`、`networkState: 1`、`error: null`、標準controls・muted・loop有効を維持している。

本番をPC幅1280×900とモバイル幅390×844で再撮影した。PCでは配信写真が390×260pxの3列、集合写真が1152×768.953pxで表示された。モバイルでは配信写真が348×232pxの縦3列、集合写真が350×233.625pxで表示され、ドキュメント横幅390px・横スクロールなしだった。実画像の人物・商品・スマートフォン・右下LCFロゴ、集合写真の全員とキャプション、黄色シャドウに見切れや重なりは確認されなかった。

## TOPページのイベントbanner・portal再配置（2026-09-25追加／本番反映済み）

LCF TOP上部を、大きな2slideイベントbannerと、その下の左main／右sidebar portalへ更新した。mainには第2回申込、最新ニュース、出展企業とライブコマーサーのメリット、sidebarには公式TikTok、第1回公式動画、第1回開催レポート、LCMを配置する。申込は既存の第2回定義`/lcf/apply/company?edition=2`と`/lcf/apply/liver?edition=2`を参照し、公式動画は既存`/2nd#official-movie`、第1回レポート、LCM、マイページも既存routeを維持する。外部TikTokとnewsは別tab＋`rel="noreferrer"`、LCJ公式は`noopener noreferrer`のままにした。

既存SEOのtitle、description、canonical `/`、OGP image、WebSite／Organization JSON-LDは変更していない。第1回の実績数値、公式写真mosaic、全32ページの出展企業archive、media coverage、開催archiveも削除せずbanner／portalの下に残す。carousel前後buttonは44px以上かつ日本語`aria-label`付き、indicatorは32px touch target、focus表示、`aria-pressed`選択状態を持つ。

Vite実画面を1440×1900と390×760で確認し、desktopのmain／sidebar、mobileの縦stack、header、banner、arrow、CTA、申込領域に重なり・横溢れがないことを確認した。最新main `af75914b`統合後、LCF／LCM関連7 test files・64 tests、production build、変更component bundle、diff／secret監査に成功。全体TypeScriptの既存1,163 diagnosticsに対し変更2fileは0件。独立read-only UX reviewは**GO（P0/P1 0件）**で、reviewの非阻断P2／P3もtouch target／ARIAとdestination／responsive回帰testへ反映した。

feature SHA `f617126c993ad2f44e1475ffddf1c05f67b6f77d`のGitHub CIとRailway production deploymentはsuccess。本番rootはHTTP 200、server HTMLに既存SEO title、配信entry `index-KLmYFpjK.js`から参照される`LiveCommerceFestivalTop-0iSfXAAB.js`に「第2回 お申し込み受付中」「新着ニュース」「出展企業のメリット」「ライブコマーサーのメリット」「LCF公式TikTok」「第1回 公式動画」を確認した。本番をdesktop 1440×1900とmobile 390×760で再撮影し、指定portal配置・縦stack・carousel操作・申込CTAに見切れ、重なり、横溢れがないことを目視確認した。

## 第2回ページの運営修正とTOP header整理（2026-09-25追加／本番反映済み）
第2回ページは、提供された第1回ライブ販売実景写真を修正文言の直後へ配置した。LCM紹介は公開LCM画面をclean captureした実画面素材へ切り替えた。完成予想2画像はCONCEPT IMAGE表記を維持し、確認済み実寸2176×1632をHTMLの`width`／`height`へ追加した。実景、実画面、完成予想を文言とaltで混同しない構成にしている。
不要指定のConcept、COMMON SIGN、年号なし看板素材button、最終黄色CTAはsourceから削除した。初心者supportの申込buttonと画面下fixed申込barは既存の第2回申込pathを使用する。浜松町sectionには、東京都立産業貿易センター浜松町館が入る東京ポートシティ竹芝の外観写真を配置した。公開案内元は港区観光協会の[東京ポートシティ竹芝 オフィスタワー](https://visit-minato-city.tokyo/ja-jp/places/2613)を確認した。会場住所、約1,530㎡、天井高5m、無柱空間、フローリングという既存の確認済み情報は維持している。
LCF TOPではheaderの「LCJ公式」buttonのみ削除し、footerのLCJ公式サイトlinkは維持した。TOPと第2回のtitle、description、canonical、Event／WebSite／Organization JSON-LD、既存routeは変更していない。
LCF／LCM関連43 files・306 tests、production build、変更component bundle、diff／secret監査に成功した。全体TypeScript既存1,163 diagnosticsに対し今回変更fileは0件。独立read-only LCF reviewは**GO（P0/P1/P2 0件）**。1440×1100と390×1100のlocal実画面で初心者sectionをprogrammatic scrollして確認し、inline申込CTAがfixed barの上で操作可能で、横溢れや重なりがないことを確認した。本番の申込・送信操作は実施していない。
feature SHA `8874fd41b15d96a599796b9f27d61a19fdcc2c1d`はGitHub CIとRailway production deployment `6655961479`がsuccess。本番rootと`/2nd`はHTTP 200で、配信`LiveCommerceFestivalTop-CV2Mw7RZ.js`と`LcfSecondEdition-DrU7oYs5.js`に修正文言、初心者CTA、完成予想labelを確認した。TOPの実DOMはheaderにLCJ公式buttonがなく、footerのLCJ公式サイトlinkを維持する。本番TOP desktopと第2回初心者section mobileを再撮影し、CTA、header、fixed barに見切れ・重なり・横溢れがないことを確認した。本番acceptanceでは申込mutationを行っていない。

## 第2回ページの実景背景・カラーLCFロゴ・3申込導線（2026-09-25追加／本番反映済み）
第2回ページの`SELLING EXPERIENCE`背景には、ユーザー提供の第1回ライブ販売実景写真を使用した。原画はJPEG 1920×1280で、配信用CDNも`image/jpeg`、HTTP 200を確認した。画像には左から`black/92 → black/72 → black/42`のgradientを重ね、見出しと指定本文を画像上で読めるようにした。背景画像自体は空altと`aria-hidden`を持ち、写真内容は同じcontainer内のscreen reader用textで説明する。

headerは、[共有GigaFile](https://29.gigafile.nu/1025-d7f0941d7f83ac58209869c697efd74f)の`LCF_ロゴ_LP_ロゴ-04.png`を採用した。原画の透明余白をcropして1200×739に縮小し、PNGとして配信する。配信用CDNは`image/png`、HTTP 200を確認した。旧yearless SVGは第2回headerから削除した。

上部とfixed申込barは3導線にした。出展申込は既存`/lcf/apply/company?edition=2`へ遷移する。ライブコマーサー申込と一般来場申込は既存の公式LCF OpenChatへ遷移し、外部linkには`target="_blank"`と`rel="noopener noreferrer"`を付けた。LCM案内は`/lcm`へ進む「事前マッチングはこちらから」だけを残し、「LCMとは？」を削除した。

1440×1900と390×1800のlocal実画面で、カラーlogo、3つの申込button、写真背景、指定copy、LCM単一button、fixed 3導線を確認した。desktop／mobileとも文字の重なり、横溢れ、固定barによる主導線の遮蔽はない。LCF／LCM関連43 files・309 tests、production build、変更file型診断0件、独立review GOを確認した。申込送信やOpenChat投稿は行っていない。

feature SHA `ded1ea6101fd0ace7d1a97bc50c1e6f16ca9e4a9`はGitHub CI run `36133091871`とRailway production deployment `6660311604`がsuccess。本番`/2nd`はHTTP 200で、entry `index-DuFbB8c-.js`が`LcfSecondEdition-B30WuGO3.js`を参照し、新しい背景写真、カラーlogo、3申込導線、「事前マッチングはこちらから」を配信している。「LCMとは？」は同chunkにない。本番desktop／mobileを再撮影し、写真上の指定文言、上部3button、LCM単一button、fixed 3buttonに重なりや横溢れがないことを確認した。本番確認はGET／DOM read-onlyのみで、申込・OpenChat投稿は行っていない。

## 第2回ページ・スマホ上部申込ボタンのコンパクト化（2026-09-25追加／本番反映済み）
上部の3申込導線は、スマホで縦3段にせず`grid-cols-3`の1行表示へ変更した。各buttonは最小48px高を維持し、表示名を「出展申込」「ライバー申込」「一般申込」に短縮する。完全な用途は`aria-label`に保持し、640px以上では従来のicon、矢印、補足文を再表示する。出展申込は既存の内部問い合わせpage、ライブコマーサー申込と一般来場申込は公式LCF OpenChatへ進む。外部linkの`target="_blank"`と`rel="noopener noreferrer"`は維持した。

390×900のlocal実画面で3buttonが約115px幅ずつの1行に収まり、文字切れ、重なり、横溢れがないことを確認した。下部fixed申込barは変更していない。focused 35 tests、全LCF 231 tests、production build、変更file型診断0件、独立review GOを確認した。申込送信・OpenChat投稿は行っていない。

feature SHA `500030220fdc1cc9c214c3720153da99d159ac15`はGitHub CI run `36138669546`とRailway production deployment `6661391106`がsuccess。本番`/2nd`はHTTP 200で、entry `index-BMZL3diX.js`から`LcfSecondEdition-tr246KR1.js`が配信されている。390px本番DOM測定では「出展申込」「ライバー申込」「一般申込」は各約115.3×48px、left 16pxからright 374pxの範囲に収まる。本番screenshotでも1行表示、非重複、文字切れなしを確認した。確認はGET／DOM read-onlyのみで、申込送信・OpenChat投稿は行っていない。

## 第2回完成予想画像の削除とLCM商品検索導線（2026-09-26追加／本番反映済み）
`/2nd`から、完成予想として掲載していた2画像と`VisualStories` sectionを削除した。sourceとrendered DOMの双方で「会場完成予想イメージ」、旧画像asset ID、`LIVE_IMAGE`、`MATCHING_IMAGE`、`VisualStories`が存在しないことを確認した。浜松町館の会場情報、初心者support、申込導線、第1回実績sectionは残している。
LCF mypageの事前マッチングpanelでは、「第2回LCFの出展商品から選ぶ」を`/lcm#products`への明示linkへ変更した。リンク先のLCM商品sectionには`id="products"`とresponsive scroll marginがあり、固定headerの下へ正しく表示される。GMV自己申告、証憑、matching申請、承認済み出展商品のserver queryは変更していない。
LCF／LCM／sample logistics 44 files・324 tests、exact production build、変更component bundle、rendered DOM監査、`git diff --check`に成功した。全体TypeScript既存1,162 diagnosticsに対し今回変更fileは0件。独立review最終結果は**GO（P0/P1 0件）**。本番申込、OpenChat投稿、matching申請、GMV報告、production DB mutationは行っていない。

feature SHA `e64696fc9e950f1f6910ca64cc5c9ae3f01e1c62`はGitHub CI run `36222035732`とRailway production deployment `6675295194`がsuccess。本番`/2nd`はHTTP 200で、配信`LcfSecondEdition-C5gx8et3.js`には「会場完成予想イメージ」、`VisualStories`、`LIVE_IMAGE`、`MATCHING_IMAGE`が存在しない。配信chunkには「第2回LCFの出展商品から選ぶ」と`/lcm#products`を確認した。acceptanceはGET／chunk／DOM read-onlyのみで、申込、matching、GMV、DBの書込みは0件。
