# LCFトップ第2回CTA優先・第2回ヘッダーLCM追加 検証記録

## 対応内容

LCF公式トップのヒーローでは、黄色の主ボタンを「第1回イベントページを見る」から「第2回開催情報を見る」へ変更し、遷移先を `/2nd` とした。第1回イベントページへのリンクは主CTAの下へ移動し、遷移先 `/2026` を維持した。第1回開催レポート `/livecommercefestival/2026/report` は既存のまま維持した。

第2回特別ページ `/2nd` の上部固定ヘッダーには、`LCM`リンクを追加し、`/lcm`へ直接移動できるようにした。既存の「第1回実績」とログイン／マイページ導線は維持した。

## 検証結果

| 検証 | 結果 |
|---|---|
| 専用回帰 | 2 files / 21 tests success |
| LCF・LCM回帰 | 38 files / 259 tests success |
| Production build | Vite・Expressとも成功。既存sharp namespace warningとローカルDB未起動によるmigration `ECONNREFUSED`のみ。既存スクリプトは継続し成果物生成済み。 |
| 機能コミット | `7c9567d5` |
| GitHub Check | success |
| Railway | deployment `6526669640`、success |
| 本番トップDOM | 黄色CTAは `/2nd`、背景 `rgb(242, 203, 60)`、文字色black。第1回リンク `/2026` はその下。横溢れ0px。 |
| 本番第2回DOM | 上部ヘッダーに `LCM` → `/lcm` が1件。第1回実績・マイページを維持。PC横溢れ0px。 |
| 本番モバイル | 390×844で両ページを確認。CTA、LCM、第1回実績、ログイン、申込ボタンに見切れ・重なりなし。 |

## 本番URL

- LCF公式トップ：<https://www.livecommercefestival.com/>
- 第2回特別ページ：<https://www.livecommercefestival.com/2nd>
- LCM：<https://www.livecommercefestival.com/lcm>
