# LCM TikTokプロフィールURL入力修正 検証記録

## ユーザー報告

LCMライブコマーサー公式プロフィールの「公式SNS・実績」で、TikTok URLだけは何度入力してもエラーになり、Instagram、YouTube等は保存できる状態だった。

## 原因

TikTok欄はブラウザ側で `input type="url"`、サーバー側で「`https://`かつ`tiktok.com`ドメイン」の完全URLを必須としていた。そのため、利用者が実際に入力しやすい次の形式は、TikTokとして正しい情報でも保存前または保存時に弾かれていた。

| 入力形式 | 旧挙動 | 新挙動 |
|---|---|---|
| `@username` | ブラウザ標準URLエラー | `https://www.tiktok.com/@username`へ自動整形 |
| `username` | ブラウザ標準URLエラー | `https://www.tiktok.com/@username`へ自動整形 |
| `www.tiktok.com/@username` | `https://`不足でエラー | 公式HTTPS URLへ自動整形 |
| 全角で入力したURL | URLとして解析できずエラー | NFKC正規化後に公式HTTPS URLへ整形 |
| TikTokアプリの共有文＋短縮URL | 共有文全体がURLではないためエラー | 文中の`vt.tiktok.com`または`vm.tiktok.com` URLを抽出 |
| `http://`のTikTok URL | HTTPS条件でエラー | 公式TikTokドメインに限ってHTTPSへ変更 |

## 実装

共通ロジック `shared/lcmSocialUrls.ts` を追加し、フロントとサーバーが同じ `normalizeLcmTikTokUrl` を利用するようにした。プロフィールURLは公式 `https://www.tiktok.com/@username` へ統一する。TikTok公式ドメインの短縮共有URLも許可する。

ブラウザ入力は `type="url"` から `type="text"` と `inputMode="url"` の組み合わせへ変更し、ブラウザ標準エラーが正規化より先に送信を止めないようにした。入力欄からフォーカスを外した時と保存payload作成時の両方で正規化する。説明文として「@ユーザー名、tiktok.comから始まるURL、アプリの共有リンクも入力できます」を追加した。

サーバーは保存前に同じ正規化を実行した後、`https:`かつTikTok公式ドメインであることを再検証する。`example.com`、`tiktok.com.example.com`、JavaScript URL等は許可しない。無効値は別ドメインへ書き換えず、明確なエラーとして拒否する。

## 検証

| 検証 | 結果 |
|---|---|
| 専用回帰 | 2 files / 18 tests success |
| LCF・LCM回帰 | 38 files / 259 tests success |
| Production build | Vite・Expressとも成功。既存sharp namespace warningと、ローカルDB未起動によるmigration `ECONNREFUSED`のみ。既存スクリプトは継続し成果物生成済み。 |
| TypeScript全体 | 8GBヒープで既存765診断。今回変更5ファイルの新規診断なし。 |
| GitHub Check | commit `5d99df69`、success |
| Railway | deployment `6525114232`、環境 `lcjagent / production`、success |
| 本番URL | `https://www.livecommercefestival.com/lcm/manage?workspace=creator` HTTP 200 |
| 本番バンドル | `LcmManage-DBiTRshf.js`で新しい入力説明文を確認 |
| 本番データ書込み | 未実施。既存プロフィール・会員データは変更していない。 |

本番ブラウザの現在ログイン中アカウントにはライブコマーサー権限がないため、他人のプロフィールを使った保存試験は行っていない。入力正規化は決定論的な実動関数テスト、サーバー契約テスト、本番配信バンドル確認で検証した。

## 直接リンク

- LCMトップ：<https://www.livecommercefestival.com/lcm>
- LCMライブコマーサーマイページ：<https://www.livecommercefestival.com/lcm/manage?workspace=creator>
