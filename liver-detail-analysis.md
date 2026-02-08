# ライバー詳細ページ改善 - データ構造分析

## 利用可能なデータソース

### 1. 売れ筋商品ランキング
- テーブル: `livestream_products` (商品名、GMV、販売数、注文数)
- JOIN: `brand_livestreams` (liverId でフィルタ)
- 既存関数: `getTopSellingProducts(month, limit)` - 全ライバー対象
- 必要: ライバー個別版の商品ランキング関数を新規作成

### 2. 取り扱いブランド一覧
- 既存関数: `getLiverBrandPerformance(liverId)` - ブランド別売上・配信回数
- テーブル: `brand_livestreams` + `brands`
- データ: brandName, totalSales, totalDuration, totalLivestreams, avgSalesPerStream

### 3. 得意カテゴリ分析
- 商品名からカテゴリを推定（美容液、ヘアケア、UV等）
- `livestream_products` の productName をパターンマッチ
- サーバーサイドで集計

## 既存のルーター
- `liverManagement.getLiverBrandPerformance` - ブランド別パフォーマンス ✅ 既存
- 商品ランキング（ライバー個別）- ❌ 未実装、新規作成必要
- カテゴリ分析 - ❌ 未実装、新規作成必要

## formatCurrency修正
- 現在: `¥${amount.toLocaleString()}` → 既にカンマ区切り対応済み
- 確認: toLocaleString()は自動でカンマ区切りするはず → ブラウザ環境依存
- 安全策: `¥${amount.toLocaleString('ja-JP')}` に変更
