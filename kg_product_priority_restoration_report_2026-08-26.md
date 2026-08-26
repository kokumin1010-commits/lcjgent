# KG／KYOGOKU商品优先恢复最终报告

**作者：Manus AI**

**日期：2026-08-26**

**生产页面：[LCJ MALL 选品中心／商品管理][4]**

## 完成结论

KG／KYOGOKU商品第三轮专项恢复已经写入Railway MySQL并上线。生产健康状态为`healthy=true`，商品表从83行增至96行，其中父商品86行、真实子SKU 10行。本批恢复3个新父商品和10个子SKU，全部保持`offline`，没有自动改成在售，也没有推测当前价格、库存或佣金。

| 生产验证项 | 最终结果 |
|---|---:|
| `selection_products`可见总行数 | 96 |
| 父商品行数 | 86 |
| 本批父商品 | 3 |
| 本批子SKU | 10 |
| 本批可见证据商品 | 13 |
| KG／KYOGOKU可见商品（含子SKU） | 52 |
| KG历史目录证据 | 40 |
| 商品来源证据 | 13 |
| 图片审计记录 | 6（5个唯一文件） |
| 保存历史价格 | 5 |
| 身份或父子关系不一致 | 0 |

证据SHA为`e2a16baa9df16e0fcca1e4dcf70e1244e05e7dc413dff26f12a65e788948b250`。全过程没有连接、查询或回滚旧Manus管理TiDB。

## 新增父商品

新增父商品来自保存的KG收据／直播证据，官方页面只用于确认正式名称、品牌和完全同款图片。面膜、颜色洗发水和ラオイル均能在KYOGOKU官方商品页或官方店铺确认。[1] [2] [3]

| 商品 | 来源键 | 图片 | 当前价格 |
|---|---|---|---|
| KYOGOKU クリスタルスキン ハイドロテックブライトマスク5枚 | `kg-receipt-product:b8e0b77556be5dc6` | 官方无价格特写 | 未恢复 |
| KYOGOKU カラーシャンプー ハイトーン | `kg-receipt-product:defdb27a9ae27e9a` | 官方蓝紫商品图 | 未恢复 |
| KYOGOKU ラオイル ボディ ウォッシュ ボディケアタイム | `kg-receipt-product:0245e40dc89562d0` | 官方无价格特写 | 未恢复 |

> 网页当前价格没有写入数据库。包含折扣或价格文字的促销主图已经人工拒绝，并由同一官方相册的无价格同款图片替换。

## 恢复的真实子SKU

颜色洗发水三色使用KYOGOKU官方目录核验；MEGAガチャ袋A/B/C/D/S、5枚セット和2本セット来自保存的本地直播／收据证据。只有MEGA五个变体具有可直接证明的保存历史价格，该价格写入`historicalLowestPrice`与`selection_price_history`，但不会冒充当前售价。

| 父商品 | 子SKU | SKU代码 | 保存历史价格 |
|---|---|---|---:|
| KYOGOKU カラーシャンプー ハイトーン | ブルーパープル | `KG-COLOR-SHAMPOO-BP` | 无直接证据 |
| KYOGOKU カラーシャンプー ハイトーン | ピンクパープル | `KG-COLOR-SHAMPOO-PP` | 无直接证据 |
| KYOGOKU カラーシャンプー ハイトーン | ブロンド | `KG-COLOR-SHAMPOO-BL` | 无直接证据 |
| KYOGOKU MEGAガチャ袋 | Aタイプ | `KG-MEGA-A` | ¥2,980 |
| KYOGOKU MEGAガチャ袋 | Bタイプ | `KG-MEGA-B` | ¥4,950 |
| KYOGOKU MEGAガチャ袋 | Cタイプ | `KG-MEGA-C` | ¥9,900 |
| KYOGOKU MEGAガチャ袋 | Dタイプ | `KG-MEGA-D` | ¥13,500 |
| KYOGOKU MEGAガチャ袋 | Sタイプ | `KG-MEGA-S` | ¥1,500 |
| KYOGOKU ケラチンヘアマスクキャップ | 5枚セット | `KG-KERATIN-MASK-5` | 无直接证据 |
| KYOGOKU ステムセル フェイシャルオイル | 2本セット | `KG-STEMCELL-OIL-2` | 无直接证据 |

## 页面显示修复

截图中的大量“子SKUなし（商品編集で親SKUを設定してください）”并不是数据，而是前端在所有无子SKU父商品后强制输出空行。现已从生产分块彻底移除，该旧字符串计数为0。

商品API现在只按父商品分页，再附带当前页父商品的真实子SKU。子SKU不再占用父商品分页。商品名、SKU代码或条码均可搜索；只有真实子SKU存在时才显示“子SKU N件を表示”，点击后在对应父商品下展开，点击“子SKUを閉じる”即可收起。

## 图片与静态资源验证

5个最终唯一图片文件全部返回HTTP 200，MIME分别为`image/jpeg`或`image/webp`，生产SHA与本地SHA完全一致。生产`SelectionCenter`分块返回HTTP 200，并包含KG恢复横幅、健康端点和子SKU折叠逻辑。随机失效JS继续返回HTTP 404与`Cache-Control: no-store`，不会恢复旧chunk伪200白屏问题。

| 静态图片 | 结果 |
|---|---|
| カラーシャンプー ブロンド | HTTP 200／SHA一致 |
| カラーシャンプー ブルーパープル | HTTP 200／SHA一致 |
| カラーシャンプー ピンクパープル | HTTP 200／SHA一致 |
| ハイドロテックブライトニングマスク | HTTP 200／SHA一致 |
| ラオイル ボディセラムウォッシュ | HTTP 200／SHA一致 |

## Railway备份与事务安全

成功恢复前的加密备份ID 57为333表、10,519行；成功恢复后的加密备份ID 58为333表、10,597行。两次状态均为`success`。前几次部署暴露了可选SQL参数和子SKU来源分类问题，但所有写入均在事务内完整回滚，生产一直保持83件、0条本批部分数据，直到最终分类清单通过后才一次性写入13个父子商品。

| 备份 | ID | 表数 | 行数 | 状态 |
|---|---:|---:|---:|---|
| 恢复前 | 57 | 333 | 10,519 | success |
| 恢复后 | 58 | 333 | 10,597 | success |

后续再次读取健康端点仍保持96／86、13条本批商品、40条历史、6条图片审计、5条价格历史和0不一致，且没有生成新备份，证明恢复模块已进入幂等只读状态。

## 使用方法

进入[商品管理][4]后搜索`KYOGOKU`或`KG`。父商品旁出现“子SKU N件を表示”时可以点击展开。恢复商品默认为已下架／`offline`，运营确认价格、库存、佣金和销售条件后再手动上线；没有直接价格证据的商品继续显示“証拠なし”。

如果浏览器仍显示旧的重复空行，请执行一次`Ctrl+Shift+R`强制刷新当前生产分块。

## References

[1]: https://kyogokupro.com/products/detail/1950 "KYOGOKU クリスタルスキン ハイドロテックブライトニングマスク"
[2]: https://store.shopping.yahoo.co.jp/kyogokupro/kg4.html "KYOGOKU カラーシャンプー 官方店铺页面"
[3]: https://store.shopping.yahoo.co.jp/kyogokupro/kg022.html "KYOGOKU ラオイル ボディセラムウォッシュ 官方店铺页面"
[4]: https://lcjmall.com/master/selection-center?tab=products "LCJ MALL 选品中心／商品管理"
