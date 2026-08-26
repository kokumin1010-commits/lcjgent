# LCJ MALL `/master` 全站账号分类与数据可见性修复报告

**作者：Manus AI**

**完成日期：2026-08-26**

## 结论

本次修复已在Railway生产环境完成。全过程**未连接、未恢复、未回滚旧Manus管理TiDB**；数据判断只使用保存的本地恢复资产、Git历史、数据库操作历史、用户截图和Railway MySQL只读审计。

`/master/account-management`此前显示的147条记录已被证明确认为品牌、TikTok Shop ID、主播SNS与Festival申请资料的错误投影，而不是登录凭据。生产迁移在加密前置备份成功后，将147条记录完整迁入只读归档表，并从活动凭据表移除。当前`platform_accounts=0`、`platform_account_projection_archive=147`，与旧保存备份中`platform_accounts=0`的直接证据一致；没有删除任何人工确认的登录凭据。[1] [2] [3]

| 生产指标 | 修复后结果 |
|---|---:|
| Railway表 | 320 |
| 非空表 | 101 |
| 真实空表 | 219 |
| 总行数 | 4,427 |
| 查询失败表 | 0 |
| 品牌 | 186 |
| CRM联系人 | 521 |
| 活动平台凭据 | 0 |
| 错误投影只读归档 | 147 |
| 主播 | 12 |
| 直播记录 | 106 |
| 排期 | 31 |

## 账号管理的恒久修复

修复不只是前端隐藏。服务端已删除品牌Shop ID、主播SNS和Festival申请向`platform_accounts`生成种子的全部代码路径；启动同步与每6小时Lark同步只更新品牌实体和CRM联系人，平台账号插入/更新固定为0。账号API的列表、详情、更新、删除与平台过滤也永久排除恢复投影记录。[1]

`/master/account-management`现在明确分为**“已确认的平台登录凭据”**与**“品牌・店铺・联系人（CRM）”**，并提供LCJ系统用户、品牌、主播和Festival专用页面入口。真实LCJ登录继续由`users`、`livers`、`line_users`和`festival_accounts`等专用认证模型管理，不复制到平台凭据CRUD。[1] [3]

| 分类 | 正确存放位置 |
|---|---|
| LCJ后台登录 | `/master/system-users`与`users` |
| 主播登录 | 主播专用页面与`livers` |
| LINE用户认证 | `line_users` |
| Festival认证 | `festival_accounts` |
| 品牌与Shop ID | 品牌/店铺业务页面 |
| 主播SNS主页 | 主播资料页面 |
| 联系人 | `contact_info` CRM标签页 |
| 错误恢复投影 | `platform_account_projection_archive`只读归档 |

## 已修复的数据可见性与断线

在83个真实`/master`基础路由、191个页面/选项卡目标和91个唯一选项卡的人工复核基础上，本批修复了有直接证据的数据隐藏或入口断线；没有用其他业务数据填充空页。

| 页面/功能 | 修复内容 |
|---|---|
| Festival | 补上已有LINE数据面板的主选项卡入口，Check-in保持正常。[4] |
| 销售检查 | 初次打开自动显示数据库最新真实月份并标注来源，不改写历史日期。[5] |
| 主播详情（两套路由） | 按主播ID自动选择最新真实实绩月，避免当前月无数据时多个统计区块空白。 |
| 主播信用历史 | `liver_credits`无持久记录时，从最新6个真实直播月份按既有公式只读计算；不写入推导行。 |
| 直播建议 | 今日无排期时可跳转查看最近真实排期；历史排期只读，AI生成和LINE发送仍仅允许当天，防止误发送。 |
| 品牌排期 | 查询范围扩大为过去2年至未来1年，显示已保存排期但不修改日期。 |
| 广告表单 | API与MySQL计划枚举已对齐，使TikTok广告和直播SaaS真实提交可以保存；没有生成模拟申请。 |

## 真实空项边界

并行审计中部分候选经源码和Railway精确计数复核后被判定为误报。员工任务已直接按`tasks.staffId`查询；Mega Channel端点完整存在；产品补货请求端点连接正确业务表。采购订单、聊天、问题、权限申请、步骤邮件、广告申请等表当前真实为空，保存备份也没有可恢复的直接行证据。

> **证据原则：** 真实为空的页面保留明确空状态，等待真实业务操作产生数据。不得用品牌资料冒充账号，不得用GMV冒充现金流，不得推测工资、订单、员工或资格信息。

## 加密备份与无损迁移证明

迁移前后均由现有AES-256-GCM备份系统强制创建快照。前置备份`pre-acct-class-v2`成功，包含320表、4,403行；后置备份`post-acct-class-v2`成功，包含320表、4,405行。归档迁移结果为`before=147`、`archived=147`、`removed=147`、`remainingManual=0`。

首次部署时，新的备份原因字符串超过数据库列长度，恢复在任何归档写入前以`Data too long for column 'reason' at row 1`失败。随后热修复为短键并重新部署；前后备份、归档、联系人同步和健康验证全部成功。该首次失败没有修改活动业务数据。[2]

| 备份 | 状态 | 表数 | 行数 | 时间（UTC） |
|---|---|---:|---:|---|
| `pre-acct-class-v2` | success | 320 | 4,403 | 03:48:16–03:48:18 |
| `post-acct-class-v2` | success | 320 | 4,405 | 03:48:28–03:48:30 |

## 全量上线验证

所有83个基础路由展开后的191个页面/选项卡URL均返回HTTP 200。当前生产HTML和主入口引用的208个JS/CSS资源全部返回HTTP 200和正确Content-Type；随机失效asset继续返回HTTP 404、`Cache-Control: no-store`和`text/plain`，没有恢复旧chunk的SPA HTML伪200问题。

| 验证项 | 结果 |
|---|---:|
| master页面/选项卡URL | 191/191通过 |
| 当前JS资源 | 206/206通过 |
| 当前CSS资源 | 2/2通过 |
| 数据库表查询 | 320/320通过 |
| 查询失败 | 0 |
| 账号分类恢复 | success |
| Lark品牌同步错误 | 0 |
| 平台账号再生成 | 0 |

本地全量TypeScript与Vite分块渲染在3.8 GiB沙箱内存上限下发生OOM，但Vite已完成8,240模块转换；全部修改入口的目标级转译和完整服务端生产bundle均通过。Railway生产构建成功后，实际页面chunk、191个URL和208个静态资源均已在线验证，因此上线产物完整。

## 部署版本

主修复提交为`62a2b08bce660bacd6d37872979f0f6620ea9809`，备份键热修复提交为`df2be8afbc93bc8a347939290506863011a80623`。[1] [2]

如浏览器仍持有部署前旧chunk，只需执行一次**Ctrl+Shift+R**强制刷新；服务端已对失效资源配置404/no-store并包含自动chunk恢复逻辑。

## References

[1]: https://github.com/kokumin1010-commits/lcjgent/commit/62a2b08bce660bacd6d37872979f0f6620ea9809 "Fix: classify account credentials and restore master views"
[2]: https://github.com/kokumin1010-commits/lcjgent/commit/df2be8afbc93bc8a347939290506863011a80623 "Fix: shorten account backup reason keys"
[3]: https://lcjmall.com/master/account-management "LCJ MALL Account Management"
[4]: https://lcjmall.com/master/festival "LCJ MALL Festival Administration"
[5]: https://lcjmall.com/master/sales-check "LCJ MALL Sales Check"
