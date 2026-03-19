# Finance CSV Data Analysis

## File Info
- Encoding: GB18030
- Total rows: 10,349 (all status: 完了)
- Date range: 2025-10 ~ 2026-01
- 3 creators, 43 shops

## Key Columns to Keep (index)
- 0: 注文ID (order_id)
- 1: サブ注文ID (sub_order_id) 
- 2: クリエイターのユーザー名 (creator_username)
- 3: 商品名 (product_name)
- 6: 価格 (price)
- 7: 数量 (quantity)
- 8: ショップ名 (shop_name)
- 10: 注文状況 (order_status)
- 11: コンテンツタイプ (content_type)
- 13: アフィリエイトパートナー成果報酬率 (partner_commission_rate)
- 14: クリエイター成果報酬率 (creator_commission_rate)
- 19: 推定成果報酬ベース (estimated_base)
- 20: 推定アフィリエイトパートナー手数料額 (estimated_partner_commission)
- 23: 推定クリエイター手数料額 (estimated_creator_commission)
- 26: 実際の手数料ベース (actual_base) = 営業額
- 27: 実際のアフィリエイトパートナー手数料額 (actual_partner_commission)
- 28: クリエイターの実際の手数料額 (actual_creator_commission) = 佣金
- 35: 作成日時 (created_at) DD/MM/YYYY HH:MM:SS
- 36: 注文配達日時 (delivered_at)
- 37: 手数料決済日時 (settled_at)

## Columns to Remove (not needed for dashboard)
- 4: SKU
- 5: 商品ID
- 9: ショップコード
- 12: コンテンツID
- 15-18: Various reward rates (all 0)
- 21-22: Partner/Creator reward estimates (all 0)
- 24-25: Shop ad commission estimates (all 0)
- 29-32: Reward actuals (all 0)
- 33-34: 返品/返金数量
- 38: 支払いID
- 39: 支払い方法
- 40: 支払い口座
- 41: IVA
- 42: ISR
- 43: プラットフォーム
- 44: 要因のタイプ

## Monthly Summary
- 2025-10: ¥10,997,532 revenue, ¥4,087,968 commission, 2770 orders
- 2025-11: ¥10,280,920 revenue, ¥1,027,403 commission, 2447 orders
- 2025-12: ¥17,832,338 revenue, ¥1,602,504 commission, 3169 orders
- 2026-01: ¥11,045,333 revenue, ¥995,765 commission, 1963 orders
