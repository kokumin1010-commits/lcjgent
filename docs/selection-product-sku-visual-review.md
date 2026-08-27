# 商品・SKU浏览器回归视觉检查

检查截图：`/home/ubuntu/lcjgent_sku_delivery/selection_products_after_relogin.png`

浏览器在新会话（模拟重新登录）后显示两条商品记录。既有商品的日文名已更新为“既存商品A 更新”，中文名已更新为“既有商品A 已更新”，其SKU被全部删除后不再显示SKU行。新建商品“新規商品SKUテスト”及中文名“新上架商品SKU测试”正常显示，表格下方同时显示“新規SKU-10個”和“新規SKU-20個”两项SKU，价格、自动折扣率、最低价以及第二项的`1+1`促销标识均可读，没有遮挡、溢出或错位。

该截图来自本地Vite与内存mock tRPC数据；生产商品、SKU与Railway MySQL写入均为0。
