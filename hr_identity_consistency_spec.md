# LCJ HR 唯一主档与跨模块联动实施规格

**日期：** 2026-08-27
**适用环境：** Railway MySQL生产
**原则：** 不连接旧TiDB；不按姓名粗暴合并；不物理删除历史；不通过后台定时任务复制状态。

## 1. 身份模型

`staff.id`是所有现行员工的唯一主ID。`report_staff`是日报业务档案，每个`staff`至多关联一条`report_staff`，但历史日报继续引用原`report_staff.id`。所有新业务表和当前人员选择器只使用`staff.id`。

`staff`增加两个身份字段：

| 字段 | 含义 |
|---|---|
| `identityKey` | 经过NFKC、trim、lowercase标准化后的已验证邮箱键，格式`email:<value>`；未验证占位邮箱不生成此键 |
| `mergedIntoStaffId` | 重复副本合并到的主staff ID；主档为NULL |

数据库对非NULL的`identityKey`建立唯一索引，并对`report_staff.linkedStaffId`建立唯一索引。MySQL允许唯一索引存在多条NULL，因此未关联历史档案不会被误限制。

## 2. 当前人员统一条件

> 当前员工 = `staff.isActive='active' AND staff.archivedAt IS NULL AND staff.mergedIntoStaffId IS NULL`

所有“当前人员”“担当者”“参加者”“发放对象”接口统一使用该条件。HR页面以`staff`为起点、LEFT JOIN唯一的`report_staff`，因此没有日报档案的HR员工仍显示一次；不会再以`report_staff`行数决定HR人数。

历史任务、日报、录音、积分流水继续保留原始ID和姓名快照。历史页面可以显示当时姓名，但当前筛选器、当前负责人和活动名单使用主档最新姓名、部门、国家和状态。

## 3. 同名保护和自动判定

只有以下条件同时成立才允许自动判为重复：

1. 两条staff都未合并；
2. 标准化邮箱完全相同，且邮箱不是`@lcj.placeholder`等未验证占位地址；
3. 标准化姓名相同，或存在明确`report_staff.linkedStaffId`/人工审计证据；
4. 迁移前完成所有引用表预览，冲突为0或有确定性合并规则。

仅姓名相同、仅国家相同或姓名相似均不能自动合并。当前与归档目录中的同名人员保持独立，除非邮箱和关联证据也一致。

## 4. 主档选择规则

主档按以下顺序选择：

1. 被现行`report_staff`唯一关联的staff；
2. 有真实业务引用或日报历史的staff；
3. 有明确手工修订证据的staff；
4. 最早创建的staff。

生产三组强重复主档固定如下，均由相同姓名、完全相同邮箱和现行report_staff关联共同确认；提交文档不保存生产姓名或邮箱：

| 证据组 | 主档 | 重复副本 |
|---|---:|---:|
| A | 2 | 48 |
| B | 18 | 42 |
| C | 54 | 45 |

## 5. 合并事务

每次合并必须先创建加密备份，再在单一事务内锁定主档、副本和关联report_staff。事务执行：

1. 再次验证邮箱、姓名、状态和预期主ID；
2. 统计全部引用；
3. 把允许迁移的staff外键从副本改为主档；
4. 对具有逻辑唯一约束的表（同任务、同日排班、同日朗读、同持有人积分等）先检测冲突，无法确定时整笔拒绝；
5. 将副本设为`inactive`、`archivedAt=NOW()`、`mergedIntoStaffId=主ID`、`identityKey=NULL`，保留姓名、邮箱和全部历史；
6. 主档写入唯一`identityKey`；
7. 写`staff_identity_merge_events`和`manual_data_change_events`，记录前后快照、逐表迁移量、操作者和备份ID；
8. 验证所有外键已迁移、当前名单只剩主档后提交。

失败必须全部回滚。重复执行同一合并必须幂等，不得二次移动或叠加积分。

## 6. 引用表分类

| 分类 | 表/字段 | 处理 |
|---|---|---|
| 当前任务 | `tasks.staffId`、`task_staff.staffId` | 迁移到主档；同任务重复指派先去重 |
| 品牌负责人 | `brands.businessManagerId`、`brands.operationsManagerId`、`tsp_contracts.lcjStaffId` | 迁移ID，显示名称从主档读取 |
| 排班 | `staff_schedules.staffId` | 迁移；同日冲突则拒绝自动合并 |
| 招聘 | `recruitment_brands.person_in_charge`、`recruitment_follow_records.staff_id` | 迁移ID |
| LINE | `line_users.staffId` | 迁移；同一LINE用户冲突则拒绝 |
| 早会 | `morning_principle_recitations.staffId`及`targetKey` | 历史快照保留；ID迁移时检测同日记录冲突 |
| 店铺与店铺执行 | `managed_stores.operatorId/operator2Id`、`store_manager_goal_cycles.managerStaffId`、`store_manager_work_items.ownerStaffId` | 迁移ID，当前显示用主档姓名 |
| 问题与聊天 | `issues.assigneeId/helperId`、`chat_room_members.userId`、`chat_messages.senderId` | 当前对象迁移ID；聊天室重复成员先去重，历史姓名快照保留 |
| TikTok竞品日报 | `tiktok_competitor_reports.assignedStaffId` | 迁移ID并继续保留当时姓名快照 |
| 达人BD | `influencer_bd_creators.ownerStaffId`、`influencer_bd_outreach_logs.staffId`、`influencer_bd_ai_analyses.scopeStaffId` | 迁移ID，当前显示用主档姓名 |
| 积分/股权 | 所有`holderType='staff'`的holderId及同事奖励sender/receiver ID | 若主副档同时存在持仓则整组拒绝；无冲突时事务迁移全部余额、流水、奖励和归属ID并核对副本引用为0 |
| 日报业务 | `report_staff`及其reports/followups/chat/AI档案 | 当前三组副本无report_staff，不需迁移；未来重复report_staff需单独合并ID并保持日报引用完整 |
| 历史快照 | 录音姓名、日报姓名、审计姓名等 | 不覆盖，保留当时证据 |

## 7. HR变更传播

新增、编辑、退职、复职、归档均使用现有双表原子服务，并增加身份键检查。传播不依赖定时任务：所有当前模块实时查询唯一主档状态，因此HR变更保存后，刷新任何模块即可同步。

- 改名/部门/国家/职位：当前页面和选择器读取主档最新值；关联`report_staff`同步姓名/国家。
- 退职/归档：立即从所有当前选择器、早会名单、招聘担当者、达人BD和积分发放对象消失；历史记录仍可查看。
- 复职/恢复：staff与report_staff同一事务恢复后重新出现在当前名单，不恢复已合并副本。
- 删除：继续使用可逆归档墓碑，不物理删除有历史引用的员工。

## 8. 迁移和发布门禁

结构升级只创建字段、索引和审计表，不自动选择或合并人员。生产数据修复由管理员确认的预览结果驱动，顺序为：加密备份→dry-run→三组逐一事务合并→引用守恒验证→post-backup。任何一组冲突都只阻止该组，不影响其他组或其他模块。
