# LCJ Mall コードベース分析 完全レポート

**作成日**: 2026年3月7日  
**対象リポジトリ**: `kyogokuryu/lcjgent`  
**分析者**: Manus AI

---

## 目次

1. [プロジェクト全体構造の把握](#1-プロジェクト全体構造の把握)
2. [主要ディレクトリ・ファイルの役割一覧](#2-主要ディレクトリファイルの役割一覧)
3. [主要機能ごとの責務整理](#3-主要機能ごとの責務整理)
4. [危険箇所・密結合箇所の洗い出し](#4-危険箇所密結合箇所の洗い出し)
5. [将来の拡張性に関する考察](#5-将来の拡張性に関する考察)
6. [成果物B：改修ポイント一覧](#6-成果物b改修ポイント一覧)
7. [成果物C：次開発実装計画](#7-成果物c次開発実装計画)

---

## 1. プロジェクト全体構造の把握

### 1.1. 技術スタック

LCJ Mallは、フロントエンドとバックエンドが明確に分離されたモダンなWebアプリケーションです。主要な技術スタックは以下の通りです。

| 領域 | 技術 | 役割 |
| :--- | :--- | :--- |
| **フロントエンド** | React, TypeScript, Vite, Tailwind CSS, wouter | 高速でインタラクティブなUIの構築 |
| **バックエンド** | Node.js, Express, TypeScript | サーバーサイドロジックの実行 |
| **API通信** | tRPC | フロントエンド・バックエンド間の型安全なAPI通信 |
| **データベース** | PlanetScale (MySQL互換) | データ永続化 |
| **ORM** | Drizzle ORM | 型安全なデータベース操作 |
| **認証** | LINE Login, Email/Password, JWT | ユーザー認証・セッション管理 |
| **ファイルストレージ** | S3互換ストレージ (Forge経由) | レシート画像・商品画像の保存 |
| **AI/LLM** | Gemini 2.5 Flash (Forge API経由) | レシートOCR審査・AI自動承認 |
| **決済** | Stripe | 商品購入の決済処理 |
| **外部連携** | LINE Messaging API, Beauty Wallet, Aitherhub, Proline | メッセージング・ポイント交換・動画解析 |

### 1.2. アーキテクチャ概要

フロントエンドはReactのSPA（シングルページアプリケーション）として動作し、バックエンドのExpressサーバーと通信します。API通信にはtRPCを採用しており、フロントエンドの `client/src/lib/trpc.ts` が `server/routers.ts` の型を直接参照することで、APIの型安全性が保証されています。データベース操作はDrizzle ORMを通じて行われ、スキーマ定義 (`drizzle/schema.ts`) が単一の信頼できる情報源（Single Source of Truth）となっています。

### 1.3. 主要ファイルのサイズ

コードベースの規模感を把握するため、主要ファイルの行数を以下に示します。

| ファイル | 行数 | 備考 |
| :--- | ---: | :--- |
| `server/routers.ts` | 約 20,281 行 | **全APIエンドポイントを一ファイルに集約** |
| `server/db.ts` | 約 18,150 行 | **全DB操作関数を一ファイルに集約** |
| `drizzle/schema.ts` | 約 3,713 行 | 70以上のテーブルスキーマを定義 |
| `client/src/pages/LineReceiptManagement.tsx` | 約 3,394 行 | レシート管理画面 |
| `client/src/pages/LineMypage.tsx` | 約 2,132 行 | ユーザーマイページ |

---

## 2. 主要ディレクトリ・ファイルの役割一覧

### 2.1. バックエンド (`server/`)

| ファイル/ディレクトリ | 役割 |
| :--- | :--- |
| `server/_core/index.ts` | Expressサーバーの起動、ルーティング設定、各種スケジューラーの初期化 |
| `server/_core/trpc.ts` | tRPCの初期化、`publicProcedure`, `protectedProcedure`, `adminProcedure` の定義 |
| `server/_core/context.ts` | tRPCのコンテキスト生成（リクエストごとのユーザー認証） |
| `server/_core/sdk.ts` | JWT検証によるセッション認証の実装 |
| `server/_core/env.ts` | 全環境変数の一元管理 |
| `server/_core/llm.ts` | Gemini 2.5 Flash (Forge API) への呼び出しラッパー |
| `server/_core/cookies.ts` | セッションCookieのオプション生成（SameSite/Secure設定） |
| `server/routers.ts` | **全tRPCルーターの定義（最重要・最大ファイル）** |
| `server/db.ts` | **全データベース操作関数の定義（最重要・最大ファイル）** |
| `server/line.ts` | LINE Messaging APIのラッパー（メッセージ送信、署名検証など） |
| `server/lineWebhook.ts` | LINE Webhookイベントの処理ロジック |
| `server/storage.ts` | S3互換ストレージへのファイルアップロード/ダウンロードのラッパー |
| `server/stripeWebhook.ts` | Stripe Webhookイベントの処理（決済完了後の注文ステータス更新） |
| `server/pointExpiryScheduler.ts` | ポイント有効期限の自動失効・通知スケジューラー（毎日9:00 JST実行） |
| `server/aiAutoApproveScheduler.ts` | AIによるレシート自動承認のバッチ処理スケジューラー |
| `server/autoPostScheduler.ts` | ブログ記事の自動投稿スケジューラー |

### 2.2. フロントエンド (`client/src/`)

| ディレクトリ/ファイル | 役割 |
| :--- | :--- |
| `client/src/App.tsx` | 全ページのルーティング定義（wouterを使用） |
| `client/src/lib/trpc.ts` | tRPCクライアントの初期化（型はサーバーの `AppRouter` から自動取得） |
| `client/src/pages/MallHome.tsx` | ECモールのトップページ（商品一覧、ランキング、紹介チャレンジ誘導） |
| `client/src/pages/LineLogin.tsx` | ログイン・新規登録ページ（LINE認証とEmail認証の両方を提供） |
| `client/src/pages/Register.tsx` | 紹介コード付き登録ページ（LineLoginのラッパー） |
| `client/src/pages/LineMypage.tsx` | ユーザーマイページ（ポイント残高、注文履歴、レシート履歴） |
| `client/src/pages/ReceiptUpload.tsx` | レシートアップロードページ（確変チャンスのフローを含む） |
| `client/src/pages/MallProductDetail.tsx` | 商品詳細ページ |
| `client/src/pages/MallCart.tsx` | カートページ |
| `client/src/pages/FriendReferralChallenge.tsx` | 友達招待チャレンジページ |
| `client/src/pages/RegistrationBonus.tsx` | 新規登録特典ルーレットページ |
| `client/src/pages/BeautyWallet.tsx` | Beauty Walletポイント交換ページ |
| `client/src/pages/LineReceiptManagement.tsx` | 管理者向けレシート審査画面 |
| `client/src/components/LuxurySpinWheel.tsx` | ルーレット演出コンポーネント（Confetti, Fireworks等のエフェクトを含む） |
| `client/src/components/KakuhenChance.tsx` | 確変チャンスUIコンポーネント |

### 2.3. データベース (`drizzle/`)

| テーブル名 | 役割 |
| :--- | :--- |
| `line_users` | 全ユーザーの基本情報（LINE認証・Email認証両方を管理） |
| `line_point_balances` | ユーザーごとのポイント残高 |
| `line_point_transactions` | 全ポイント変動履歴（獲得・利用・失効・調整） |
| `line_receipts` | ユーザーがアップロードしたレシートの情報と審査状況 |
| `mall_products` | ECモールの商品情報 |
| `mall_orders` | 注文情報（Stripe決済情報を含む） |
| `mall_order_items` | 注文明細（商品ごとの数量・金額） |
| `mall_categories` | 商品カテゴリ（階層構造対応） |
| `referral_codes` | ライバーの紹介コード（4桁数字） |
| `referral_history` | ライバー紹介の履歴とポイント付与記録 |
| `referral_campaigns` | 友達招待チャレンジのキャンペーン設定 |
| `campaign_stages` | キャンペーンのステージ設定（達成条件と報酬） |
| `user_referral_progress` | ユーザーごとの友達招待チャレンジ進捗 |
| `friend_referrals` | 友達招待の記録 |
| `spin_reward_tables` | ルーレットの報酬テーブル（通常・プレミアム） |
| `spin_reward_items` | ルーレットの各報酬アイテム（ポイント数・確率） |
| `user_spin_history` | ルーレット実行履歴 |
| `receipt_kakuhen_results` | 確変チャンスの結果記録 |
| `bw_linked_accounts` | Beauty Wallet連携情報 |
| `point_exchanges` | Beauty Walletへのポイント交換履歴 |

---

## 3. 主要機能ごとの責務整理

### 3.1. ユーザー登録・認証フロー

LCJ Mallは2種類の認証方式を提供しています。**LINEログイン**は、LINEのOAuthフローを通じて認証し、LINEユーザーIDを主キーとして `line_users` テーブルに情報を保存します。**Email/Passwordログイン**は、メールアドレスとパスワードを使った従来型の認証で、パスワードは `bcryptjs` でハッシュ化して保存されます。

認証後のセッション管理は、LINEログインの場合は `line_session` というCookieに、Email認証の場合はJWTを `lcj_session` というCookieに保存します。フロントエンドでは、LINEアプリ内ブラウザからの遷移に対応するため、`localStorage` の `lcj_session_token` もフォールバックとして利用されています。

新規登録時に紹介コードが入力された場合、コードの種類（ライバー紹介コード or 友達招待コード）を判定し、それぞれの紹介フローを実行します。登録完了後は、新規登録特典ルーレット (`/registration-bonus`) へ誘導し、必ず500ptが付与されます。

### 3.2. ポイントシステム

ポイントシステムの中心は `createLinePointTransaction` 関数（`server/db.ts`）です。この関数がポイントの獲得・利用・失効・調整の全操作を担当し、`line_point_balances`（残高）と `line_point_transactions`（履歴）の両テーブルを常に同期させます。

ポイントの有効期限は獲得日から**90日**です。`server/pointExpiryScheduler.ts` が毎日午前9時（JST）に実行され、期限切れポイントの失効処理と、失効30日前・7日前のLINEプッシュ通知を自動的に行います。

### 3.3. レシート処理システム

ユーザーがレシート画像をアップロードすると、以下のフローで処理されます。

まず、画像はS3互換ストレージに保存され、`line_receipts` テーブルに `pending` 状態で記録されます。次に、AIによる自動審査（`aiAutoApproveScheduler.ts`）が実行され、TikTok Shopのレシートであるか、配達完了済みであるか、重複でないかなどを判定します。AIが承認できないと判断した場合は管理者の手動審査に回ります。審査で `approved` になると、`pointsCalculated` の値に基づいてポイントが付与されます。

ポイントの基本還元率は**購入金額の1%**です。ただし、レシート申請時にTikTok動画URLを入力すると「確変チャンス」が発動し、還元率が**1.5%**にブーストされます。さらに、100万分の1の確率で「全額還元ジャックポット」が当選します。

### 3.4. 紹介機能（2種類）

**ライバー紹介コード**は4桁の数字コードで、ライバーが新規ユーザーを招待するために使用します。新規ユーザーが登録時にコードを入力すると、新規ユーザーに500pt、紹介ライバーに200ptが付与されます（ライバーへのポイントは初回購入完了時）。

**友達招待チャレンジ**は英数字のコードで、一般ユーザーが友達を招待するために使用します。招待が成立するとステージが進み、ステージ達成報酬（ポイント・ルーレット回数）が付与されます。被招待者にも招待ボーナス（キャンペーン設定値）が付与されます。進捗はタイトル制（ビギナー〜ダイヤモンド）で可視化されています。

### 3.5. ルーレット（スピン）機能

友達招待チャレンジのステージ達成報酬として付与されるスピン回数を消費して実行します。`spin_reward_items` テーブルに定義された各報酬アイテムの `probability` 値に基づいて確率的に報酬が決定され、ポイントが付与されます。通常スピンとプレミアムスピン（`isSpecial`）でそれぞれ異なる報酬テーブルが使用されます。

### 3.6. 商品・注文管理

商品情報は `mall_products` テーブルで管理され、ステータス（`draft`, `active`, `sold_out`, `archived`）とカテゴリ（`mall_categories`）で分類されます。決済はStripeを利用し、`checkout.session.completed` Webhookイベントを受信することで注文ステータスを `paid` に更新します。ポイントのみでの購入（`paymentMethod: "points"`）も対応しています。

---

## 4. 危険箇所・密結合箇所の洗い出し

### 4.1. 巨大すぎる単一ファイル（最重大リスク）

`server/routers.ts`（約2万行）と `server/db.ts`（約1.8万行）が極端に肥大化しています。これはプロジェクト全体で最も深刻な技術的負債です。可読性の低下、修正時のコンフリクト頻発、デグレ（意図しない副作用）の危険性増大、新規参画者の学習コスト増大といった問題を引き起こしています。

### 4.2. 複雑なセッション管理

LINEユーザーとEmailユーザーの認証ロジックが混在し、複数のCookie（`line_session`, `lcj_session`）とlocalStorage（`lcj_session_token`）を併用しています。特に `lineLoginRouter.me` エンドポイントは、どの認証情報からユーザーを特定するかを判定するロジックが複雑化しており、将来的なバグの温床になりやすい状態です。

### 4.3. 不安定なOCRデータ抽出

レシートの注文番号を `ocrRawText`（OCRの生テキスト）から都度正規表現で抽出するロジックは、OCRの精度やレシートのフォーマット変更に脆弱です。`lineReceipts` テーブルに `orderNumber` カラムが存在せず、審査時に毎回テキストから抽出しているため、データの一貫性が保証されません。

### 4.4. 多数の外部サービス依存

Stripe, LINE, Beauty Wallet, Aitherhub, Prolineなど、多くの外部APIに依存しています。各サービスのAPIキーやシークレットキーの管理（`server/_core/env.ts`）は非常に重要であり、一つでも漏洩・失効すると広範囲に影響が及びます。

### 4.5. 不明点

以下の点については、コードを読んだだけでは確認できなかったため、「不明」とします。確認するには、実際の本番環境の設定や、関連するドキュメントを参照する必要があります。

| 不明点 | 確認すべきファイル |
| :--- | :--- |
| 本番環境でのデータベース接続プール設定 | `server/db.ts` の `getDb()` 関数 |
| Stripe Webhookの署名検証が本番で有効か | `server/stripeWebhook.ts`, 環境変数 `STRIPE_WEBHOOK_SECRET` |
| Beauty Wallet APIの仕様と安定性 | `server/routers.ts` (beautyWalletRouter), BW側のAPIドキュメント |

---

## 5. 将来の拡張性に関する考察

tRPCとDrizzle ORMを基盤とした型安全なアーキテクチャは、拡張性・保守性の観点で非常に優れています。APIの仕様とデータベースのスキーマがコードレベルで同期しているため、安全な機能追加が可能です。

ただし、上記「危険箇所」で指摘した巨大ファイルの存在が、将来の拡張における最大のボトルネックです。機能追加のたびにこれらのファイルがさらに肥大化し、技術的負債が雪だるま式に増加する恐れがあります。

**「TikTok Shop全商品対象のレシートポイント」**については、現在のレシート処理フローのAI審査プロンプト（`server/aiAutoApproveScheduler.ts`）と、管理者向けの審査条件を変更することで対応可能です。ただし、対象商品の範囲が広がることで不正申請も増加するため、不正検知ロジック（`fraudDetection`）の強化も同時に必要です。

**「解放可能ポイント / ミッション構造」**については、現在のポイントシステムとは別に、新しいポイントテーブル（例: `unlockablePoints`）と、ミッション達成状況を管理するテーブル（例: `userMissions`）の追加が必要です。既存の `createLinePointTransaction` 関数を参考に、新しいポイント用の関数を作成することで対応可能です。

**「独自CPS / ASP構造」**は、既存の紹介機能とは別に設計する必要があります。アフィリエイトリンクの生成・管理、クリックトラッキング、成果（コンバージョン）の計測、報酬計算と支払い管理など、複数のテーブルとロジックが必要になる大規模な新機能開発に相当します。

---

## 6. 成果物B：改修ポイント一覧

「この要件ならこのファイルを触る」という一覧表です。

### 6.1. 機能別 改修対象ファイル一覧

| 要件カテゴリ | 要件内容 | 主要な改修対象ファイル |
| :--- | :--- | :--- |
| **紹介制度** | ライバー紹介報酬（ポイント数）の変更 | `server/routers.ts` (emailRegister, liffCallback), `drizzle/schema.ts` (referralHistory.newUserPoints, referrerPoints) |
| | 友達招待チャレンジのステージ達成条件・報酬の変更 | `drizzle/schema.ts` (campaignStages), 管理画面からDB直接更新 |
| | 友達招待チャレンジのキャンペーン設定の変更 | `drizzle/schema.ts` (referralCampaigns), 管理画面からDB直接更新 |
| **レシート** | レシート承認条件の変更（例：注文番号の必須化） | `server/routers.ts` (receiptsRouter内の承認ロジック、約12400行付近) |
| | レシートポイントの基本還元率変更（現在1%） | `server/routers.ts` (submitWebReceipt, submitLineReceipt内のポイント計算) |
| | 確変チャンスの還元率変更（現在1.5%） | `server/routers.ts` (kakuhenRouter.play, `BOOSTED_RATE` 定数) |
| | 確変チャンスのジャックポット確率変更（現在1/1,000,000） | `server/routers.ts` (kakuhenRouter.play, `JACKPOT_ODDS` 定数) |
| | TikTok Shop以外のレシートを対象にする | `server/aiAutoApproveScheduler.ts` (AIプロンプト), `server/routers.ts` (AI審査ロジック) |
| **UI/UX** | トップページ (`/mall`) のUI変更 | `client/src/pages/MallHome.tsx` |
| | マイページ (`/mypage`) のUI変更 | `client/src/pages/LineMypage.tsx` |
| | 商品詳細ページのUI変更 | `client/src/pages/MallProductDetail.tsx` |
| | 友達招待チャレンジページのUI変更 | `client/src/pages/FriendReferralChallenge.tsx` |
| | ルーレット演出の変更 | `client/src/components/LuxurySpinWheel.tsx` |
| | 新規登録特典ルーレットの変更 | `client/src/pages/RegistrationBonus.tsx` |
| **ポイント** | ポイント有効期限の変更（現在90日） | `server/db.ts` (createLinePointTransaction内の `expiresAt` 計算) |
| | ポイント失効通知のタイミング変更 | `server/pointExpiryScheduler.ts` |
| | Beauty Walletへのポイント交換レートの変更 | `server/routers.ts` (beautyWalletRouter.getExchangeRate) |
| **商品・カテゴリ** | 商品カテゴリの追加・編集 | `client/src/pages/MallBrandCategoryManagement.tsx`, `server/routers.ts` (mallRouter) |
| | 商品の表示順ロジックの変更 | `server/db.ts` (getMallProducts), `server/routers.ts` (mallRouter.getProducts) |
| **管理画面** | レシート審査画面の変更 | `client/src/pages/LineReceiptManagement.tsx` |
| | 注文管理画面の変更 | `client/src/pages/OrderManagement.tsx` |
| **認証** | 新規登録フローの変更 | `client/src/pages/LineLogin.tsx`, `server/routers.ts` (emailRegister, liffCallback) |
| | ログインフローの変更 | `client/src/pages/LineLogin.tsx`, `server/routers.ts` (emailLogin, lineLoginRouter.callback) |

---

## 7. 成果物C：次開発実装計画

### 全体方針

新機能開発の前に、まず技術的負債を返済し、開発の土台を安定させます。一度に大規模な変更を加えるのではなく、リスクを管理しながらフェーズを分けて進めます。tRPCとDrizzle ORMが提供する型安全性を最大限に活用し、デグレを防止します。

### Phase 1：巨大ファイルの分割（最優先・軽微修正）

プロジェクト最大の技術的負債である `server/routers.ts` と `server/db.ts` を分割し、見通しを良くし、コンフリクトを減らし、将来の機能追加を容易にします。推定期間は2〜3週間です。

`server/routers/` ディレクトリを作成し、機能ドメインごと（例: `user.router.ts`, `product.router.ts`, `order.router.ts`, `receipt.router.ts`）にファイルを分割します。各ファイルは自身のtRPCルーターを定義・エクスポートし、`server/routers.ts` はこれらをマージして `appRouter` を構築する責務のみを持つようにします。`server/db.ts` も同様に `server/db/` ディレクトリに分割します。この作業は既存のコードの大部分に影響を与えるため、一度に全てを分割するのではなく、例えば `user` 関連から着手するなど、少しずつ進めるのが安全です。

### Phase 2：認証・セッション管理の整理（ロジック修正）

複雑化した認証ロジックを整理し、保守性を向上させます。推定期間は1週間です。

`line_session` と `lcj_session` の2つのCookieを可能な限り統一することを検討します。LINEログイン成功後も `lcj_session` と同じ形式のJWTを発行し、単一のCookieで管理できないか調査します。また、フロントエンドでの `localStorage` (`lcj_session_token`) へのフォールバック依存を減らし、可能な限りHTTP OnlyのCookieで完結するセキュアなセッション管理を目指します。

### Phase 3：レシート処理の堅牢化（ロジック修正）

OCR結果への依存度を下げ、レシート処理の信頼性とデータ整合性を向上させます。推定期間は1週間です。

`drizzle/schema.ts` を編集し、`lineReceipts` テーブルに `orderNumber` (varchar), `approvedOrderAmount` (int) などのカラムを追加します。レシート承認時に、OCRテキストから抽出・確定した注文番号や金額を、新しく追加したカラムに保存するように更新関数を修正します。将来的に、重複チェックはこの新しい `orderNumber` カラムに対して行うように変更します。

### Phase 4：将来拡張に向けた準備（構造改善・将来拡張準備）

Phase 1〜3で安定化したコードベースの上に、将来の拡張機能の基盤を構築します。推定期間は2週間〜です。

「解放可能ポイント / ミッション構造」については、`drizzle/schema.ts` に `userMissions`, `missionProgress`, `unlockablePoints` などの新しいテーブルスキーマを定義します。Phase 1で分割された `server/routers/` と `server/db/` に、ミッションと解放可能ポイントを管理するための新しいルーターとDB関数を作成します。フロントエンドにミッション一覧画面 (`client/src/pages/Missions.tsx`) を作成します。

「独自CPS / ASP構造」については、既存の紹介機能とは独立した新しいアフィリエイトシステムの詳細設計を行います。必要なテーブル（`affiliateLinks`, `affiliateClicks`, `affiliateConversions` など）と、それらを操作するAPIの仕様を定義します。この段階ではまず設計を固めることを優先し、実装は次の大きな開発サイクルで行います。

### フェーズ別サマリー

| フェーズ | 内容 | 推定期間 | 優先度 |
| :--- | :--- | :--- | :--- |
| **Phase 1** | 巨大ファイル（routers.ts, db.ts）の機能別分割 | 2〜3週間 | **最高** |
| **Phase 2** | 認証・セッション管理の整理と単純化 | 1週間 | 高 |
| **Phase 3** | レシート処理の堅牢化（orderNumberカラム追加） | 1週間 | 高 |
| **Phase 4** | ミッション構造・CPS設計の実装 | 2週間〜 | 中 |

---

*本レポートは、実際のコードを読んだ上で作成されています。推測に基づく記述は最小限に抑えており、不明な点は明示的に「不明」と記載しています。*
