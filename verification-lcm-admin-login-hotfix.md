# LCM運営ログイン誤遷移・商品画像拡大 hotfix 検証記録

## ユーザー報告

- 報告日時：2026-09-16
- 起点：`https://www.livecommercefestival.com/lcf/admin` の「LCM運営」
- 実際の遷移先：`https://www.livecommercefestival.com/login`
- 表示された画面：社内業務自動化システム用ログイン。メール、パスワード、スタッフ登録、旧「ライバーログイン」を表示しており、LCF・LCM顧客／イベント管理者へ見せてはならない。
- ユーザー提供画像：`/home/ubuntu/upload/スクリーンショット2026-09-1614.17.55.webp`

第2回企業・ブランド申込では既存会員メール入力後に同じパスワードを要求し、誤入力時は同画面内にエラーと「パスワードをお忘れの方」を表示していた。再設定APIのメールURLはコード上`/lcf/reset-password`であり、顧客向け再設定自体は社内`/login`を生成していない。ユーザー提供画像：`/home/ubuntu/upload/スクリーンショット2026-09-1614.18.05.webp`。

## 原因分析

現行コードと本番を確認した結果、`/lcm/admin`は`DashboardLayout`で包まれておらず、HTTPリダイレクトも発生していない。LCM管理APIの`lcmAdminProcedure`は`verifyFestivalAdminRequest`を使い、`lcf_token`の`role=admin`を受理できる。修正前の現行本番でも、同じLCF管理者セッションから`/lcf/admin`の「LCM運営」を押すと`/lcm/admin?tab=claims`へ入り、管理APIも成功した。

したがって、スクリーンショットで確認された社内`/login`は、現行LCM管理APIの権限不足ではなく、古い配信物・旧導線・遷移途中の認証状態消失などによりLCF導線の情報を失って汎用`/login`へ到達したケースと判断した。履歴上のどの条件で発生したかまでは現行本番で再現できなかったが、構造上の残存リスクは明確だった。汎用`Login`は到達元がLCF管理画面であることを識別できず、そのまま社内スタッフ登録UIを描画していた。

## 実装した防御

| 対象 | 実装 |
|---|---|
| LCF管理画面 | 「LCM運営」を押す直前に、`/lcm/admin?tab=claims`だけを許可した同一タブの短期return情報を保存してから遷移する。 |
| LCM運営 | `festivalAuth.me`でLCF管理者を先に確認し、確認後だけLCM管理APIを実行する。未認証・非管理者には安全return付き`/lcf/login`だけを表示する。 |
| 社内`/login` | LCF管理画面からの短期return情報が残っている場合、社内フォームを一切描画せず`/lcf/login?return=%2Flcm%2Fadmin%3Ftab%3Dclaims`へ自動回復する。 |
| return検証 | 同一origin相対URL、かつ`/lcm/admin`だけを許可し、外部URL、`//`、バックスラッシュ、制御文字を拒否する。 |

社内管理者・スタッフ用`/login`自体は削除していない。LCF・LCM顧客／LCF管理者の導線と社内認証を混在させない防御だけを追加した。

## 商品画像の追加要件

- 起点：`/lcm/manage?workspace=brand`の商品管理一覧
- 対象：各商品のメイン画像サムネイル
- 要件：タップ、クリック、Enterで大きく表示。閉じるボタン、背景タップ、Escキー、モバイル表示、代替テキストへ対応する。
- ユーザー提供画像：`/home/ubuntu/upload/スクリーンショット2026-09-1614.51.42.webp`

## 商品画像プレビュー実装

商品メイン画像を`button`へ変更し、商品名を含む`aria-label`と`alt`を付与した。Radix Dialogを利用し、自然比率を保つ`object-contain`の大画像、明示的な「閉じる」ボタン、Esc終了、背景タップ終了、モバイル向け`100dvh`上限、画像読込失敗時の状態表示を追加した。画像がない商品は従来どおり「画像なし」を表示し、商品編集・提出・仮連携権限には変更を加えていない。

## 完了条件

LCF管理者が`/lcf/admin`の「LCM運営」から社内`/login`を見ずに仮連携審査へ入れること。未認証者はLCF管理者ログインへ案内され、社内スタッフ認証と混在しないこと。商品メイン画像をデスクトップ・モバイルの両方で拡大・終了できること。本番データを書き換えず、回帰テスト、production build、GitHub CI、Railway、本番導線を確認する。

## 検証結果

| 検証 | 結果 |
|---|---|
| 専用回帰 | `lcf-lcm-common-portal.test.ts` 7/7件成功。安全return、社内ログイン分離、画像Dialog構造を含む。 |
| LCF・Festival・LCM全関連 | 最新main取込後、31ファイル210/210件成功。第1回・第2回、申込、共通アカウント、受付、QR、ガイダンス、媒体アーカイブ、LCM連携・マーケットを含む。 |
| TypeScript | 全量は既存83ファイル781件の負債でexit 2。今回変更の`LcmAdmin`、`LcmManage`、`Login`、`festivalPortal`、専用テストの新規エラーは0件。`LcfAdmin`の既存受付・日程機能6件だけは今回差分外。 |
| production build | 成功。既存`sharp` import warningと、ローカルDB未接続のmigration継続ログのみ。 |
| GitHub CI | 機能コミット`fc871f1d`、run `35062832932`成功。 |
| Railway | 同一SHA `fc871f1d7f1f2ed8a02fdde608c286152d1662f7`、`Success - www.livecommercefestival.com`。 |
| HTTP | `/lcf/admin`、`/lcm/admin?tab=claims`、`/lcm/manage?workspace=brand`、`/lcf/login`、`/lcf/reset-password`は200。 |
| 本番bundle | LCF管理者回復、社内ログイン分離、商品画像拡大、失敗表示の主要文言を確認。 |
| 本番ブラウザ | `LCF管理画面 → LCM運営 → ブランド所有`へ直接表示。社内`/login`は表示されない。商品画像は拡大し、明示的な閉じる、Esc、背景タップで終了。 |
| 誤到達回復 | 同一タブにLCF管理returnを保存したうえで`/login`へ遷移すると、社内フォームを描画せず`/lcf/login?return=%2Flcm%2Fadmin%3Ftab%3Dclaims`へ回復。 |

本番検証は読取専用と画面遷移だけで実施した。正式承認、却下、権限停止、ブランド・商品編集、申込、会員更新、QR発行、メール送信などの本番書込みは行っていない。
