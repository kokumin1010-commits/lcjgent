# 画像表示問題の調査結果

## データベースの状態
- `proposalImageUrl` カラムはすべてNULL
- 画像は `imageUrls` カラムにJSON配列として保存されている
  - 例: `["https://d2xsxph8kpxj0f.cloudfront.net/..."]`

## 問題の原因
フロントエンドのコードは `proposalImageUrl` を参照しているが、
実際のデータは `imageUrls` に保存されている。

## 修正方針
1. `selectedProductForDetail?.proposalImageUrl` の代わりに
   `selectedProductForDetail?.imageUrls?.[0]` を使用する
2. または、APIで `imageUrls[0]` を `proposalImageUrl` として返す
