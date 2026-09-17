# LCF TOP第2回リンク・CTA帯・公式MP4 検証記録

## 対象

- 本番サイト: `https://www.livecommercefestival.com/`
- 第2回ページ: `https://www.livecommercefestival.com/2nd`
- 機能コミット: `dff3fd3c`
- 検証日: 2026-09-17

## 実装内容

| 項目 | 実装 |
|---|---|
| TOPの第2回導線 | 「第2回開催情報を見る」を旧ページ内アンカー`#next`から内部ページ`/2nd`へ変更 |
| ヒーローCTA帯 | 白いCTA帯を全幅化し、企業・ブランド申込とライブコマーサー申込を均等配置 |
| 公式映像 | YouTube iframeを廃止し、ユーザー提供MP4をHTML5 `<video>`でページ内再生 |
| プレイヤー設定 | `autoPlay`、`muted`、`loop`、`playsInline`、`controls`、`preload="metadata"` |

## 提供MP4

- 公開URL: `https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/QHYaTbQAzawNOpYI.mp4`
- 最適化後: H.264/AAC、1920×1080、約33MB、約60.7秒、faststart対応
- 外部YouTubeリンク、YouTube iframe、YouTubeロゴは使用しない。

## 自動テスト・ビルド

| 確認 | 結果 |
|---|---|
| 専用回帰2ファイル | 18テスト成功 |
| LCF/LCM関連39ファイル | 265テスト成功 |
| production build | 成功 |

production build時のDB migrationはローカルDB未起動のため`ECONNREFUSED`となったが、既存スクリプトの仕様どおり`Continuing despite error`で継続し、Vite production buildと成果物生成は成功した。既存の`sharp` warningは今回変更に起因する新規エラーではない。

## CI・デプロイ

| 対象SHA | GitHub check | Railway |
|---|---|---|
| `dff3fd3c` | success | success（`www.livecommercefestival.com`） |

## 本番確認

1. 本番TOPの「第2回開催情報を見る」を実際にクリックし、`https://www.livecommercefestival.com/2nd`へ遷移することを確認した。
2. 第2回ページのヒーローに、既存の黄色LCFロゴ、実際にクリックできる2つの申込CTA、その下の完成キービジュアルが表示されることを確認した。
3. `#official-movie video`が存在し、`currentSrc`は上記CDN MP4、`duration`は`60.734`秒、`readyState`は`4`、`networkState`は`1`、`error`は`null`だった。
4. `autoplay`、`muted`、`loop`、`controls`はいずれも`true`だった。初回確認時点ではブラウザの自動再生ポリシーにより`paused: true`だったが、公式映像セクションへ移動後は`paused: false`となり、2秒の観測で再生位置が`15.039476`秒から`17.040131`秒へ進み、`readyState: 4`、`error: null`を維持した。
5. 標準プレイヤー上に再生・停止、シーク、音量、全画面のブラウザ標準コントロールが表示されることを画面で確認した。自動再生の開始可否は端末・ブラウザポリシーに依存するため保証事項とせず、手動操作できるプレイヤーを正とする。
6. PC幅`1280×900`で、白いCTA帯内の2ボタンが同幅で横並びになり、帯の左右・上下に不自然な空白や重なりがなく、直下の完成キービジュアルへ連続して表示されることを確認した。
7. モバイル幅`390×844`で、2つのCTAが1列ずつ縦並びになり、ボタン文言・矢印・画像に横切れがなく、キービジュアルと次セクションに不自然な余白や重なりがないことを確認した。
8. PC幅`1280×900`で公式映像を計測し、プレイヤーは`1198×673px`（比率`1.7801`）、左右位置は`41–1239px`、ドキュメント横幅は`1280px`で、横スクロール・横切れ・見出しとの重なりはなかった。
9. モバイル幅`390×844`で公式映像を計測し、プレイヤーは`348×194.875px`（比率`1.7858`）、左右位置は`21–369px`、ドキュメント横幅は`390px`で、横スクロール・横切れ・次セクションとの重なりはなかった。PC・モバイルとも`controls: true`、`readyState: 4`、`error: null`だった。

## GET-only疎通確認

| URL | HTTP | Content-Type |
|---|---:|---|
| `/2026` | 200 | `text/html; charset=utf-8` |
| `/livecommercefestival/2026` | 200 | `text/html; charset=utf-8` |
| `/2nd` | 200 | `text/html; charset=utf-8` |
| `/lcf/apply/company?edition=2` | 200 | `text/html; charset=utf-8` |
| `/lcf/apply/liver?edition=2` | 200 | `text/html; charset=utf-8` |

MP4は通常GETでHTTP 200、`content-type: video/mp4`、`content-length: 34421983`、`accept-ranges: bytes`、`cache-control: max-age=31536000`だった。`Range: bytes=0-1023`にはHTTP 206、`content-range: bytes 0-1023/34421983`、`content-length: 1024`で応答した。`content-disposition: attachment`は付与されているが、Chromiumの`<video>`ではメタデータ読込・再生・シーク用Range応答が正常に機能した。

## 保全事項

- 第1回ページ、SEO、企業・ブランド申込、ライブコマーサー申込、LCF/LCM共通アカウント、QR、受付、VIP、アフターパーティー、メール関連の既存機能は変更対象外。
- 第2回申込URLは既存の`/lcf/apply/company?edition=2`および`/lcf/apply/liver?edition=2`を維持。
