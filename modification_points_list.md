# LCJ Mall 改修ポイント一覧

本資料は、LCJ Mallの特定の要件を変更する場合に、どのファイルを修正する必要があるかをまとめた一覧です。コードベースの構造分析に基づいています。

## 主要機能別 改修対象ファイル

| 要件カテゴリ | 要件内容 | 主要な改修対象ファイル |
| :--- | :--- | :--- |
| **紹介制度** | 紹介報酬（ポイント数）の変更 | `drizzle/schema.ts` (referralHistory), `server/routers.ts` (emailRegister, lineLoginRouter) |
| | 友達招待チャレンジのステージ達成条件の変更 | `drizzle/schema.ts` (campaignStages), `server/routers.ts` (friendReferralRouter) |
| | 友達招待チャレンジの報酬（スピン回数など）の変更 | `drizzle/schema.ts` (campaignStages), `server/routers.ts` (friendReferralRouter) |
| **レシート** | レシート承認条件の変更（例：注文番号の必須化） | `server/routers.ts` (receiptsRouter内の承認ロジック) |
| | レシートポイントの還元率変更 | `server/routers.ts` (receiptsRouter内のポイント計算ロジック) |
| | 確変チャンスの還元率変更 | `server/routers.ts` (kakuhenRouter) |
| | TikTok Shop以外のレシートを対象にする | `server/routers.ts` (receiptsRouter, aiAutoApproveScheduler.ts), `server/_core/llm.ts` (AI審査プロンプトの変更) |
| **UI/UX** | トップページ（`/mall`）のUI変更 | `client/src/pages/MallHome.tsx` |
| | マイページ（`/mypage`）のUI変更 | `client/src/pages/LineMypage.tsx` |
| | 商品詳細ページのUI変更 | `client/src/pages/MallProductDetail.tsx` |
| | ヘッダー・フッターなど共通部分の変更 | `client/src/App.tsx` または共通コンポーネント |
| **ポイント** | ポイント有効期限の変更（例：90日→180日） | `server/db.ts` (createLinePointTransaction), `server/pointExpiryScheduler.ts` |
| | ポイント交換レート（対Beauty Wallet）の変更 | `server/routers.ts` (beautyWalletRouter) |
| **商品・カテゴリ** | 商品カテゴリの追加・編集 | `client/src/pages/MallBrandCategoryManagement.tsx`, `server/routers.ts` (mallRouter) |
| | 商品の表示順ロジックの変更 | `server/db.ts` (getMallProducts), `server/routers.ts` (mallRouter.getProducts) |

## 巨大ファイルの分割

**最優先で取り組むべき課題**として、以下の2つの巨大ファイルの分割を推奨します。これを実施しない限り、今後の改修作業は常に高いリスクを伴います。

| 巨大ファイル | 分割案 |
| :--- | :--- |
| `server/routers.ts` | 機能ごとにtRPCルーターを分割します。（例: `userRouter.ts`, `productRouter.ts`, `orderRouter.ts`）。分割したルーターを `server/routers.ts` でマージして `appRouter` を構築します。 |
| `server/db.ts` | こちらも機能ごとにファイルを分割します。（例: `userDb.ts`, `productDb.ts`, `orderDb.ts`）。各ファイルが対応するテーブルのCRUD操作のみ責務を持つようにします。 |

## 注意事項

- 上記リストは主要なファイルを抜粋したものであり、実際の改修ではここに記載されていない関連ファイル（型定義、共通関数など）の修正も必要になる場合があります。
- 特に `server/routers.ts` と `server/db.ts` は多くのロジックが密結合しているため、修正時は広範囲な影響調査（grepなど）が不可欠です。
