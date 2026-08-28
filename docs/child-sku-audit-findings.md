# 选品中心父子SKU审计结论

## 生产只读数据

2026-08-28通过受保护tRPC只读审计，生产当前返回125个父商品、10个实体子SKU；另有19个父商品包含22个JSON `skuVariants`。实体子SKU与JSON变体没有身份重叠，因此当前需要以独立子行展示的SKU总量为32条，而不是只展示现有10条实体子行。

10个实体子SKU均有`productName`、内部`productId`来源键、`skuName`、品牌、库存、状态和父级关系；其中3条有条码、5条有历史最低价。实体子SKU当前均无价格、中文名、分类、促销或`skuVariants`，这些空值必须保持为空，不能推测或批量补造。备份服务为healthy，scheduler和latest success均正常；生产mutation、Railway直连与旧TiDB连接均为0。

截图对应的`KYOGOKU ケラチンヘアマスクキャップ 5枚セット`真实存在，父级为`KYOGOKU ケラチンヘアマスクキャップ`，实体子SKU代码存于`skuName=KG-KERATIN-MASK-5`；其`productId=kg-child-sku:f690c0c490bf7ebb`是恢复来源身份键，不应在普通子SKU编辑中改写。

## 当前前端缺陷

父商品的JSON `skuVariants`仍被压缩为整行胶囊标签，而不是截图要求的独立表格行；只有实体子SKU能展开成行。父商品表格的状态和套组单元格与表头顺序互换，实体子SKU也把硬编码“已下架”放进套组列，导致列错位。

实体子SKU编辑按钮还调用了未定义的`setShowProductForm`，生产只读点击可稳定复现`ReferenceError: setShowProductForm is not defined`，因此编辑弹窗无法打开。即使移除该调用，通用商品弹窗也没有子SKU专用编号和状态字段，并会把实体子SKU的legacy `skuName`自动转换成JSON `skuVariants`，污染当前实体子SKU模型。

实体子SKU缩略图使用直接`JSON.parse`，遇到损坏JSON可能使列表白屏。解除父级操作使用裸`fetch`后整页reload，没有tRPC类型、错误提示、affectedRows验证或事务保护。

## 当前后端缺陷

`updateProduct`不接受`status`和`parentProductId`；通用事务保存白名单也不含`status`，无法把子SKU名称、代码、库存、价格和状态作为一次原子更新。`getChildProducts`只返回少量价格字段，缺少SKU代码、条码、库存、状态、品牌、促销、图片等完整行字段。

`setParentProduct`和`removeParentProduct`直接执行UPDATE，没有锁、存在检查、禁止自环/环状关系、affectedRows确认或审计错误。JSON SKU变体没有`skuCode`、`stock`和`status`字段，也没有单行并发安全更新procedure；第二次编辑必须重写整个父商品数组，可能覆盖并发更新。

## 兼容改造方向

保留`selection_products`实体子SKU与父商品JSON `skuVariants`两种既有存储，不把22条JSON变体未经业务确认转换成新数据库行。列表层统一将两种来源都渲染为截图式独立子行并标明来源；实体子SKU用专用编辑procedure更新自己的行且保护`productId`与`parentProductId`，JSON变体用父行锁和预期身份更新单个数组元素。两者都支持名称、SKU编号、价格、最低价、库存、状态和促销组合的连续多次编辑，所有更新原子提交并在刷新/重新登录后从Railway重新读取。
