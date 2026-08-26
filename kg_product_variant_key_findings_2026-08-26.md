# KG／KYOGOKU 变体与子SKU直接证据要点

## MEGAガチャ袋

保存的`livestream_products`历史聚合行完整商品名为：

> `KYOGOKU MEGAガチャ袋　　【KG MEGA ガチャ袋 Aタイプ2980円】【KG MEGA ガチャ袋 Bタイプ 4950円】【KG MEGA ガチャ袋 Cタイプ9900円】【KG MEGA ガチャ袋 Dタイプ13500円】【KG MEGA ガチャ袋 Sタイプ1500円】 福袋`

该行保存旧GMV `¥43,731,665`、销售数`8,333`，已作为第二轮只读历史目录证据，但当前主列表中的父商品是`KYOGOKU MEGAガチャ袋`（`historical-master:30001`），没有结构化子SKU。

保存的`receipt_products`聚合还包含独立名称`KYOGOKU MEGAガチャ袋 【KG MEGA ガチャ袋 Aタイプ2980円】`（出现1次）。保存的`line_receipts.ocrRawText`包含`variant: "Aタイプ/Bタイプ/Cタイプ/Dタイプ/Sタイプ"`，但斜线字符串本身不能单独证明买家选择了五个独立SKU；五种类型与各价格由完整直播商品名直接证明。

因此可证实的子SKU为：

| 子SKU | 历史价格 | 证据性质 |
| --- | ---: | --- |
| Aタイプ | ¥2,980 | 完整直播商品名；另有独立收据商品名 |
| Bタイプ | ¥4,950 | 完整直播商品名 |
| Cタイプ | ¥9,900 | 完整直播商品名 |
| Dタイプ | ¥13,500 | 完整直播商品名 |
| Sタイプ | ¥1,500 | 完整直播商品名 |

这些价格只能标为保存的历史变体价格，不代表当前售价。恢复时应在现有`KYOGOKU MEGAガチャ袋`父商品下创建5个离线子SKU，并保留来源键与历史价格证据，不改写人工当前价格或库存。

## 无变体商品

保存的收据明细中，`KG KYOGOKU PROFESSIONAL クリスタルスキン ブライトニング マスク 洗い流す美容パック`与`KYOGOKU ラオイル ボディ ウォッシュ ボディケアタイム`的`variant`均为`null`，不得生成“子SKUなし”占位行或虚构子SKU。

## 直接来源

- `selection_recovery_bundles/livestream_products.json`
- `reports_accounts_products_content_bundles/10_product_db_history_evidence.md`
- `auction_liver_recovery_bundles/04_livestream_set_items.txt`（保存`receipt_products`聚合）
- `auction_liver_recovery_bundles/14_liver_goals.txt`（保存`line_receipts.ocrRawText`）
- `server/selectionProductDeepRecoveryEvidence.json`
