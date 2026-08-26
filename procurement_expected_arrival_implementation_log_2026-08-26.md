# 采购`liveRoom`修复与预计到货实施日志

**日期：2026-08-26**

## 问题根因

截图中的`Unknown column 'liveRoom' in 'field list'`来自`createBatchProcurementOrders`：用户点击提交后，代码临时执行`ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS ...`，并吞掉迁移异常后继续INSERT。Railway现有`procurement_orders`缺少`liveRoom`，因此批量发注失败。初始建表定义同样未包含批量采购扩展列，存在持续复发风险。

## 恒久修复

新增`procurementSchemaUpgrade.ts`，在服务监听前检查并补齐9列：`liveRoom`、`shopName`、`productLink`、`orderStatus`、`pendingPaymentQty`、`pendingShipQty`、`qtyPerOrder`、`bundleId`、`expectedArrivalDate`。迁移前后执行强制加密备份，并比较订单行数、最大ID、总数量与总金额，禁止结构迁移意外修改业务数据。

采购路由不再包含任何`ALTER TABLE procurement_orders`。普通创建、批量创建、福袋创建、普通编辑与福袋编辑均支持可空预计到货日期；日期不得早于发注日，编辑时允许清空。公开健康状态通过`EXPLAIN INSERT`无写入验证全部INSERT列可绑定。

## 前端升级

采购列表新增“预计到货”列、待到货统计与逾期提示。普通采购和福袋采购的创建/编辑弹窗均增加预计到货日期输入；福袋详情显示发注日和预计到货。页面显示结构健康横幅，明确直播间和预计到货是否可以正常保存。

## 部署前验证

确定性静态检查共22项，22/22通过。SelectionCenter浏览器入口、采购路由、迁移模块、初始建表和生产服务入口的目标构建均通过。路由中`ALTER TABLE procurement_orders`计数为0；前端“预计到货”标记共12处。

## 安全边界

既有采购订单的`expectedArrivalDate`保持NULL，不推测历史到货日期。迁移不删除或改写既有订单、商品、品牌、数量、金额、状态或福袋关联。旧TiDB未连接、未使用。

## 部署后待回填

部署后回填Railway迁移运行、前后备份ID、既有订单快照、写入兼容状态、生产分块标记与静态资源验证。
