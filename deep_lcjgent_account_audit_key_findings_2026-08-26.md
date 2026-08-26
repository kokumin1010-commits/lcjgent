# lcjgent 深度账号审计关键结论

## 根因

当前`/master/account-management`的142条“平台账号”并非恢复出的真实凭据账号。`server/accountBrandDataRecovery.ts`从`brands`、`livers`社媒字段、`festival_company_applications`和`festival_liver_applications`生成`platform_accounts`投影；插入SQL把`password`固定为`NULL`，并在`notes`写入`recovery_source=...`。因此这些记录是品牌店铺、社媒主页或活动申请资料，不应出现在凭据账号列表。

## 深度审计范围

12个自包含证据包覆盖：当前账号UI/API/schema；Git全部提交历史；77个历史/删除文件版本；183个数据库操作历史；56个账号身份备份表；品牌/Lark同步；Festival账号和申请；主播登录与社媒资料；上传/笔记；33个迁移和seed；账号恢复报告；全仓库账号字段引用。并行审计结果保存在`/home/ubuntu/deep_audit_lcjgent_platform_accounts.json`。

## 可证明的真实登录账号体系

| 体系 | 证据 | 结论 |
|---|---|---|
| `users` | email/password/role及认证代码 | LCJ管理员登录账号 |
| `livers` | email/password、主播登录/重置流程 | LCJ主播登录账号 |
| `line_users` | 部分email/password，另有LINE ID登录 | 邮箱/LINE会员账号，不等同品牌 |
| `festival_accounts` | email/password_hash/role及LCF认证代码 | LCF真实登录账号；申请表另行分类 |
| `credentials`（Git历史） | user_id/password_hash模型 | 旧认证模型，只作历史证据 |

`staff`、`report_staff`、`brands`不含独立密码，属于人员或品牌资料，不应冒充登录账号。

## 确认的误分类类型

| 类型 | 来源 | 正确去向 |
|---|---|---|
| Lark品牌＋TikTok Shop ID | `brands.larkShopId` | 品牌/店铺目录 |
| 主播TikTok/Instagram/YouTube/otherAccount | `livers`社媒字段 | 主播外部主页/绑定信息 |
| Festival企业申请的店铺名 | `festival_company_applications` | 企业/品牌申请目录 |
| Festival主播申请的SNS账号 | `festival_liver_applications` | 申请人/主播候选目录 |
| 品牌担当、商务、运营联系人 | Lark品牌字段 | 联系人信息 |

## 历史模型证据

Git历史和schema一直把`platform_accounts`（平台凭据）与`contact_info`（品牌/客户联系人）分开；误分类来自2026-08-26恢复脚本把CRM数据投影进`platform_accounts`，不是原业务含义。历史DB操作还证明`users`、`livers`、`line_users`是真正密码账号表；旧备份中的`platform_accounts`原始行数为0。

## 修复规则

账号管理默认只显示没有`recovery_source=`标记、且由用户手工录入或有真实凭据字段的`platform_accounts`。所有恢复投影停止新增到账号表；既有投影保留在数据库审计归档中但从账号UI隐藏。品牌店铺数据在品牌/店铺目录显示；联系人继续进入`contact_info`；主播社媒账号在主播资料页显示；Festival申请与LCF登录账号分开。

## 证据文件

- `/home/ubuntu/deep_audit_lcjgent_platform_accounts.json`
- `/home/ubuntu/lcjgent_restore/deep_account_audit_bundle_summary.json`
- `/home/ubuntu/lcjgent_restore/server/accountBrandDataRecovery.ts`
- `/home/ubuntu/lcjgent_restore/server/accountRouter.ts`
- `/home/ubuntu/lcjgent_restore/client/src/pages/AccountManagement.tsx`
