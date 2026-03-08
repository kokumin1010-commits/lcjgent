# LCJ Mall システム理解レポート

## 1. はじめに

本レポートは、LCJ Mallの既存コードベースを分析し、その全体構造、主要機能の責務、潜在的な課題、そして将来の拡張性について評価した結果をまとめたものです。この分析は、今後の効率的かつ安全な開発を推進するための土台となることを目的としています。

## 2. プロジェクト全体構造

### 2.1. 技術スタック

LCJ Mallは、フロントエンドとバックエンドが明確に分離されたモダンなWebアプリケーションです。主要な技術スタックは以下の通りです。

| 領域 | 技術 | 役割 |
| :--- | :--- | :--- |
| **フロントエンド** | React, TypeScript, Vite, Tailwind CSS, wouter | 高速でインタラクティブなUIの構築 |
| **バックエンド** | Node.js, Express, TypeScript | サーバーサイドロジックの実行 |
| **API** | tRPC | 型安全なAPI通信の実現 |
| **データベース** | PlanetScale (MySQL互換) | データ永続化 |
| **ORM** | Drizzle ORM | 型安全なデータベース操作 |
| **認証** | LINE Login, Email/Password, JWT | ユーザー認証・セッション管理 |
| **外部連携** | Stripe, LINE API, Beauty Wallet, Aitherhub, Proline | 決済、メッセージング、外部サービス連携 |

### 2.2. ディレクトリ構造

プロジェクトは `client` (フロントエンド) と `server` (バックエンド) に大別されます。主要なディレクトリとその役割は以下の通りです。

| パス | 役割 |
| :--- | :--- |
| `/client/src/` | フロントエンドのソースコード |
| `/client/src/pages/` | 各画面に対応するReactコンポーネント（ルーティング単位） |
| `/client/src/components/` | 複数のページで再利用される共通UIコンポーネント |
| `/client/src/lib/` | tRPCクライアント設定などの共通ライブラリ |
| `/server/` | バックエンドのソースコード |
| `/server/_core/` | サーバー起動、tRPC設定、認証などの中核処理 |
| `/server/routers.ts` | **[重要]** 全てのtRPC APIエンドポイント（ルーター）を定義する巨大ファイル |
| `/server/db.ts` | **[重要]** 全てのデータベース操作（CRUD）関数を定義する巨大ファイル |
| `/drizzle/` | Drizzle ORMのスキーマ定義とマイグレーションファイル |
| `/drizzle/schema.ts` | **[重要]** 全てのデータベーステーブルスキーマを定義するファイル |

## 3. 主要機能ごとの責務整理

### 3.1. 認証フロー

- **担当ファイル**: `server/_core/sdk.ts`, `server/_core/context.ts`, `server/routers.ts` (lineLoginRouter, authRouter), `client/src/pages/LineLogin.tsx`
- **責務**: LINEログインとEmail/Password形式の2種類の認証を提供します。
- **LINEログイン**: LINEのOAuthフローを利用し、認証後にLINEユーザーIDに基づいて `line_users` テーブルにユーザー情報を保存・更新します。セッションは `line_session` というCookieに保存されます。
- **Email/Password**: `authRouter` で登録・ログイン処理を実装。パスワードは `bcryptjs` でハッシュ化されます。認証後、JWTを生成し、`lcj_session` というCookieに保存します。
- **セッション管理**: tRPCのコンテキスト (`server/_core/context.ts`) でリクエストごとにCookieを検証し、ユーザー情報を `ctx.user` にセットします。フロントエンドでは、localStorageの `lcj_session_token` もフォールバックとして利用されており、やや複雑な構成になっています。

### 3.2. ポイントシステム

- **担当ファイル**: `drizzle/schema.ts` (linePointBalances, linePointTransactions), `server/db.ts` (createLinePointTransaction), `server/pointExpiryScheduler.ts`
- **責務**: ユーザーのポイント残高管理、獲得・利用・失効のトランザクション記録、有効期限の管理を行います。
- **ポイントテーブル**: `linePointBalances` でユーザーごとの残高を、`linePointTransactions` で全てのポイント変動履歴を管理します。
- **ポイント付与**: `createLinePointTransaction` 関数がポイント操作の中心的な役割を担います。この関数内で残高の更新とトランザクションの作成が行われます。
- **有効期限**: ポイント獲得（`earn` or `refund`）から90日後に失効 (`expiresAt`) する設定です。`server/pointExpiryScheduler.ts` のスケジュールジョブが毎日実行され、失効処理と失効前通知（7日前、30日前）を自動的に行います。

### 3.3. レシート処理システム

- **担当ファイル**: `drizzle/schema.ts` (lineReceipts), `server/routers.ts` (receiptsRouter), `server/aiAutoApproveScheduler.ts`, `client/src/pages/ReceiptUpload.tsx`
- **責務**: ユーザーからアップロードされたレシート画像をOCRで解析し、ポイントを付与する一連のフローを管理します。
- **処理フロー**:
  1. ユーザーが `ReceiptUpload.tsx` からレシート画像をアップロードします。
  2. バックエンドで画像はS3に保存され、`lineReceipts` テーブルに `pending` 状態で記録されます。
  3. AIによる自動審査 (`aiAutoApproveScheduler.ts`) または管理者による手動審査が行われます。
  4. 審査で `approved` になると、`pointsCalculated` に基づいてポイントが付与されます。
- **注文番号の扱い**: `lineReceipts` テーブルに `orderNumber` のカラムは存在しません。審査時に `ocrRawText` (OCRの生テキスト) から正規表現などで注文番号を抽出し、重複チェックを行っています。これは不安定になる可能性があります。

### 3.4. 紹介機能

- **担当ファイル**: `drizzle/schema.ts` (referralCodes, referralHistory, friendReferrals), `server/routers.ts` (referralRouter, friendReferralRouter)
- **責務**: 2種類の紹介制度（ライバー紹介、友達招待チャレンジ）を管理します。
- **ライバー紹介**: 4桁の数字コード (`referralCodes`) を使用。新規ユーザー登録時にコードが適用されると、紹介者にポイントが付与されます（初回購入完了時）。
- **友達招待チャレンジ**: 英数字のコード (`userReferralProgress.referralCode`) を使用。招待成立で招待者にステージ報酬（ポイント、スピン回数）が付与され、被招待者にもボーナスが付与されます。進捗は `userReferralProgress` で管理されます。

### 3.5. ルーレット（スピン）機能

- **担当ファイル**: `drizzle/schema.ts` (spinRewardTables, spinRewardItems, userSpinHistory), `server/routers.ts` (friendReferralRouter.spin), `client/src/components/LuxurySpinWheel.tsx`
- **責務**: 友達招待チャレンジの報酬として付与されるスピン（ルーレット）の実行と報酬付与を管理します。
- **報酬テーブル**: `spinRewardItems` に各報酬（ポイント数）と出現確率 (`probability`) が定義されています。通常スピンとプレミアムスピンでテーブルが分かれています (`isSpecial`)。
- **実行ロジック**: `friendReferralRouter.spin` ミューテーションが実行されると、確率に基づいて報酬を決定し、ポイントを付与、スピン回数を消費します。

## 4. 危険箇所・密結合箇所の洗い出し

- **巨大すぎる単一ファイル**: `server/routers.ts` (約2万行) と `server/db.ts` (約1.8万行) が極端に肥大化しています。これはプロジェクトで最も大きなリスクです。
  - **影響**: 可読性の低下、修正時のコンフリクト頻発、デグレ（意図しない副作用）の危険性増大、新規参画者の学習コスト増大。
  - **推奨**: 機能ごと（例: `user`, `product`, `order`）にファイルを分割するリファクタリングを強く推奨します。

- **複雑なセッション管理**: LINEユーザーとEmailユーザーの認証ロジックが混在し、複数のCookie (`line_session`, `lcj_session`) とlocalStorage (`lcj_session_token`) を併用しています。特に `lineLoginRouter` の `me` エンドポイントは、どの認証情報からユーザーを特定するか判定するロジックが複雑化しています。

- **不安定なOCRデータ抽出**: レシートの注文番号を `ocrRawText` から都度抽出するロジックは、OCRの精度やレシートのフォーマット変更に弱く、将来的に不整合やバグの原因となる可能性があります。可能であれば、審査確定時に抽出した注文番号を `lineReceipts` テーブルのカラムに保存する方が堅牢です。

- **多数の外部サービス依存**: Stripe, LINE, Beauty Wallet, Aitherhub, Prolineなど、多くの外部APIに依存しています。各サービスのAPIキーやシークレットキーの管理 (`server/_core/env.ts`) は非常に重要であり、一つでも漏洩・失効すると広範囲に影響が及びます。

## 5. 将来の拡張性に関する考察

- **基本設計の優位性**: tRPCとDrizzle ORMを基盤とした型安全なアーキテクチャは、拡張性・保守性の観点で非常に優れています。APIの仕様とデータベースのスキーマがコードレベルで同期しているため、安全な機能追加が可能です。

- **課題**: 上記「危険箇所」で指摘した巨大ファイルの存在が、将来の拡張における最大のボトルネックです。機能追加のたびにこれらのファイルがさらに肥大化し、技術的負債が雪だるま式に増加する恐れがあります。

- **「解放可能ポイント / ミッション構造」への対応**: 現在のポイントシステム (`linePointTransactions`) は有効期限を持つ「通常ポイント」です。「解放可能ポイント」のような異なるライフサイクルを持つポイントを導入する場合、新しいポイントテーブル（例: `unlockablePoints`）と、ミッション達成状況を管理するテーブル（例: `userMissions`）の追加が必要です。既存のポイント付与ロジック (`createLinePointTransaction`) を参考に、新しいポイント用の関数を作成することで対応可能です。

- **「独自CPS / ASP構造」への対応**: アフィリエイト（CPS/ASP）機能は、既存の紹介機能とは別に設計する必要があります。具体的には、アフィリエイトリンクの生成・管理、クリックトラッキング、成果（コンバージョン）の計測、報酬計算と支払い管理など、複数のテーブルとロジックが必要になります。これは大規模な新機能開発に相当します。

## 6. まとめ

LCJ Mallは、モダンな技術スタックで構築された堅牢なアプリケーションですが、急速な機能開発の結果として一部のファイルに技術的負債が集中しています。特に `routers.ts` と `db.ts` の分割は、今後の健全なプロジェクト成長のために不可欠な課題です。

本レポートで特定された構造と課題を理解することが、次の開発フェーズを成功させるための鍵となります。
