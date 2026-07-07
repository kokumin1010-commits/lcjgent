# Context Notes for LivestreamRealtimeRecord.tsx modification

## Current Page Structure (top to bottom):
1. Header (sticky) - livestream info + totals (line 256-273)
2. Alert banners (line 276-293)
3. AI商品輪番推薦 button + results (line 295-358)
4. **クイック入力フォーム** (line 360-456) - time slot, product name, price, quantity, cart, notes, 記録する button
5. 時間帯別サマリー (line 458-496)
6. **📸 スクショAI解析** (line 498-712) - upload, snapshot history with products table + "↑ 記録に一括追加" button
7. 福袋画像 (line 714-715)
8. **記録一覧** (line 717-805) - shows all records with edit/delete

## User's Request:
- AI解析した商品情報を「クイック入力フォーム」のエリアに直接表示
- 手動入力不要 - 自動で追加される
- 各商品は修改（編集）・削除可能
- 重複商品は最新データで上書き

## Backend APIs available:
- `realtimeRecord.add` - single product insert (productName, productPrice, quantitySold, cartAddCount, timeSlot, notes)
- `realtimeRecord.update` - edit record (id, productName?, productPrice?, quantitySold?, cartAddCount?, timeSlot?, notes?)
- `realtimeRecord.delete` - delete record (id)
- `realtimeRecord.getByLivestream` - get all records for a livestream
- `realtimeRecord.addSnapshot` - upload screenshot, AI analyze, auto-import products to records
- `realtimeRecord.bulkAddFromSnapshot` - batch import products

## Current auto-import behavior (already implemented):
- addSnapshot already auto-imports products into realtime_records after AI analysis
- Same product+timeSlot = UPDATE (upsert)
- New product = INSERT
- Frontend already refetches records after snapshot success

## What needs to change:
The user wants the 記録一覧 to be displayed right in the form area (not at the bottom), 
so that after uploading a screenshot, the products appear immediately in the same area 
where the form is, and each can be edited/deleted inline.
