# HR复职状态持久化修复规格

## 已确认根因

生产中并非有人在用户恢复后再次点击退职。`server/migrations/deactivateStaffAccount.ts`把目标邮箱写死，并由`server/_core/index.ts`在每次服务启动时执行。其逻辑是：只要目标`staff`再次为`active`，就把它写回`inactive`、把`resignDate`设为当前时间并把`resignReason`写为“账号注销”。

生产只读证据与该路径完全一致：目标当前档案为`staff.id=57`、`report_staff.id=146`，用户更新发生在2026-08-27 08:40:33 UTC，下一次Railway启动后于08:41:27 UTC写入退职日期和“账号注销”。这不是新的人工作业。

目标姓名还存在一套较早的独立关联档案`staff.id=55`、`report_staff.id=119`，该档案已在08:40:17 UTC由用户30006归档。由于两个档案ID、创建/更新时间和归档状态不同，本修复不自动合并或删除它们。

## 永久规则

1. 删除生产启动对`deactivateStaffAccount`的调用并删除该硬编码迁移文件。以后任何Railway部署或重启都不得按邮箱自动退职人员。
2. “复职”和“从归档箱恢复”都必须经过同一个原子事务，锁定指定`staff`与指定且唯一关联的`report_staff`。
3. 完整恢复同时设置：`staff.isActive=active`、清除`resignDate/resignReason`、清除`staff.archivedAt/archivedBy/archiveReason`；`report_staff.isActive=active`、清除其`archivedAt/archivedBy/archiveReason`。
4. 同一事务分别写入staff与report_staff的手工变更审计，并写入HR归档事件`action=reinstate`或`action=restore`。任一审计写入失败时全部回滚。
5. 用户账号恢复仅在数据库事务成功后按现有邮箱规则执行；账号恢复失败必须报错，不得静默把HR显示成成功。
6. 恢复接口不按姓名查找，必须使用页面传入且服务端再次校验的`staffId/reportStaffId`关联，避免同名档案误操作。
7. 对当前用户明确恢复的档案只修复`57/146`；已归档的旧档案`55/119`保持原状。
8. 不修改早会、店铺、商品、主播、积分或其他业务模块；不连接旧TiDB。

## 验收

隔离事务测试必须覆盖完整恢复、重复恢复幂等、同名不同ID不误改、关联不一致拒绝、审计失败回滚。Chromium mock必须覆盖复职后刷新和重新登录保持活动。生产部署后先只读确认启动迁移不再执行，再在加密备份后按审计证据恢复`57/146`，最后经至少两次Railway重启确认状态不回退。
