# 采购订单结构与预计到货规则

**日期：2026-08-26**

## 结构规则

`procurement_orders`必须在服务监听前由单一幂等迁移补齐`liveRoom`、`shopName`、`productLink`、`orderStatus`、`pendingPaymentQty`、`pendingShipQty`、`qtyPerOrder`、`bundleId`和`expectedArrivalDate`。采购mutation不得在用户点击提交后临时执行`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，也不得吞掉迁移失败后继续INSERT。

`expectedArrivalDate`使用可空`DATE`。既有订单保持NULL，不从发注日、状态或其他订单推测。普通单件创建、批量创建、福袋创建、普通编辑和福袋编辑必须使用同一字段语义。

## 输入与业务规则

预计到货为可选字段。填写时必须为有效`YYYY-MM-DD`，且不得早于发注日。未填写时保存NULL；编辑时允许清空。状态改为入荷済み、处理完成或取消后，计划日期仍保留作为审计记录，不自动改写为实际到货日。

列表显示发注日与预计到货日。预计到货已过、但状态仍为发注待ち或发注済み时可显示“逾期”提示；不得自动更改订单状态。

## 无损迁移与备份

首次结构升级前后执行Railway MySQL加密备份。迁移仅增加缺失列和索引，不修改或删除既有采购订单、商品明细、品牌、数量、金额、状态或bundle关系。旧TiDB不得连接或使用。

## 验证标准

生产健康必须确认所有9个兼容列存在、迁移运行成功、前后备份成功且旧订单行数不变。创建流程应在独立的事务/回滚验证端点中写入测试订单并立即回滚，以证明`liveRoom`和`expectedArrivalDate`可绑定且不会留下测试数据。
