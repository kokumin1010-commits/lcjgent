# ポイント購入時のステータスバグ調査

## 根本原因
`createMallOrder` (db.ts) のロジック:
- `totalAmount` は商品の**円価格** (`product.price`) で計算される
- `pointsToUse` は**ポイント価格** (`product.pointPrice`) で渡される
- `pointsUsed = Math.min(pointsToUse, totalAmount)` → ポイント価格 < 円価格の場合、cashAmount > 0 になる
- 結果: `paymentMethod = "stripe"`, `status = "pending"` になってしまう

## 修正方針
`createMallOrder` に `isFullPointPurchase` フラグを追加。
ポイント全額購入の場合は `cashAmount=0`, `paymentMethod="points"`, `status="paid"` を強制設定。
