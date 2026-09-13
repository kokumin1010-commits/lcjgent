# ブランドデー完全原生迁入 LCJ 设计

## 目标与边界

LCJ 将在内部管理系统的「運営部 → 店舗管理」下方新增「ブランドデー一覧」，统一管理 KGDAY 及未来其他品牌的 Brand Day。页面、数据库、截图对象、AI 识别、异常审核、排行榜和审计全部运行在 LCJ 内部，不使用 iframe，也不以 Manus 外链作为正式管理功能。

迁移期间，现有 `kgdayreco-2kqllucq.manus.space` 保持可回退状态。LCJ 数据与功能完成生产验收前，不删除独立站数据、不修改独立站域名，也不启动双写。切换后 LCJ 数据库成为唯一主数据源，独立站改为只读回退，避免两个系统继续写入造成分叉。

## 页面与路由

| 页面 | LCJ 路由 | 权限与用途 |
|---|---|---|
| ブランドデー一覧 | `/master/brand-days` | 管理员默认可见；员工须取得页面权限。展示品牌、期间、状态、报名、成绩、待审核和快捷入口 |
| 品牌日详情 | `/master/brand-days/:eventId` | 集中显示活动设置、报名、账号、成绩、AI截图、异常审核、排行榜和审计 |
| 品牌日公开主页 | `/brand-day/:slug` | 公共活动主页；KGDAY slug 为 `kgday-2026` |
| 报名 | `/brand-day/:slug/entry` | 公共报名，字段和验证规则按活动配置 |
| 创作者登录 | `/brand-day/:slug/creator/login` | 独立的品牌日创作者安全会话，不复用 LCJ 员工会话 |
| 创作者 Dashboard | `/brand-day/:slug/creator` | 上传直播大屏、AI确认、多场记录和历史修正 |
| 排行榜 | `/brand-day/:slug/ranking` | 只显示已自动反映或经管理员批准的有效成绩 |

## 数据模型

品牌日使用 `brand_day_` 前缀，与商城、店铺和已有品牌销售表隔离。`brand_day_events.brandId` 关联 LCJ 现有 `brands.id`，品牌主资料继续由现有品牌表维护，不复制品牌名称、公司、Logo 或负责人资料。

| 表 | 主要职责 | 关键约束 |
|---|---|---|
| `brand_day_events` | 活动、品牌、时区、起止时间、状态、最低场次分钟、视觉配置 | `slug` 唯一；所有业务表必须带 `eventId` |
| `brand_day_entries` | 报名姓名、TikTok、LINE、电话、邮箱、报名状态 | `eventId+tiktokId`、`eventId+email` 唯一；保留 `sourceEntryId` |
| `brand_day_creator_accounts` | 创作者登录、密码哈希、账号状态 | `eventId+tiktokId` 唯一；保留原密码哈希与 `sourceAccountId` |
| `brand_day_performances` | DAY/场次、JST起止、有效分钟、GMV、截图、AI与审核状态 | `eventId+creatorAccountId+day+session` 与 `eventId+creatorAccountId+screenshotHash` 唯一 |
| `brand_day_performance_products` | 每场商品、GMV、KG标记、选择状态与置信度 | 级联绑定 performance；金额只存整数日元 |
| `brand_day_audit_logs` | 自动反映、历史修正、待审核、批准、强制批准、拒绝、导入等操作 | 保存 LCJ 操作者、来源实体ID与结构化 detail；不记录明文密码 |
| `brand_day_migration_runs` | 迁移批次、来源/目标计数、校验和、状态和错误摘要 | `sourceSystem+migrationKey` 唯一，保证重复执行幂等 |

## 权限模型

页面权限键统一为 `/master/brand-days`，沿用 LCJ `role_permissions`。管理员始终可访问；普通员工必须有 `canView` 才能查看，必须有 `canEdit` 才能修正数据。强制批准范围外成绩、删除单条成绩、导入历史数据和修改活动规则仅管理员可执行。

列表和详情接口不会向无权用户返回报名电话、邮箱、LINE、密码哈希、截图 key 或审计详情。创作者的密码哈希仅用于服务器验证，永远不返回前端。所有写操作写入 LCJ 审计表。

## AI、截图与时间规则

直播大屏由 LCJ 服务端上传到现有 R2/S3 存储，数据库只保存对象 key、可派生 URL 和 SHA-256。相同创作者重复图片由 `eventId+creatorAccountId+screenshotHash` 唯一约束拦截；同一 DAY 的不同图片可生成多场成绩。

视觉识别迁入现有双模型、严格 JSON Schema 与一致性质量门。AI 读取直播起止、总 GMV、商品明细和商品 GMV。KGDAY 使用 JST 2026-09-08 09:00 至 2026-09-10 23:59：时间有效时自动反映；时间缺失、异常或范围外时保存为待审核且不计榜；管理员修正批准或填写理由强制批准后才计榜。

## 迁移方式

源数据规模基线为26条报名、26个创作者账号、42场成绩/截图、81条商品明细和164条审计。迁移使用一次性受保护的 JSON manifest，不把个人资料、密码哈希或签名 URL 提交到 Git。manifest 包含来源 ID、数据字段、截图 SHA-256 和短时签名下载地址。

LCJ 管理员导入接口在事务中执行：先按 `sourceEventId/source*Id` 建立或复用目标记录；再下载截图，校验哈希后写入 LCJ R2；最后核对各表计数和排行榜汇总。任一步骤失败则回滚数据库批次并保留失败摘要。重复提交同一 `migrationKey` 必须返回既有结果，不重复创建记录或对象。

## 切换与回退

上线分四步完成。第一步仅发布 LCJ schema、菜单、页面和空数据功能；第二步执行 dry-run 并核对26/26/42/81/164与42张原图；第三步正式导入并验证账号登录、AI截图、审核和排行榜；第四步冻结独立站写入并将业务入口切换到 LCJ。

回退只需恢复业务入口并解除独立站只读，不删除 LCJ 数据。迁移批次、源 ID、哈希和审计可用于重新核对。任何阶段发现数量、金额、图片或权限不一致，都不得切换主数据源。

## 环境隔离记录

2026-09-13 首次在克隆工作区运行 LCJ 构建时，沙箱继承的 `DATABASE_URL` 指向 KGDAY 开发数据库，LCJ 既有 fallback 迁移器误建了 `platform_accounts` 与 `contact_info` 两个零行空表。经用户明确授权后已仅删除这两个本次创建的空表，并通过 `information_schema` 验证两表均已不存在。任何 KGDAY 业务表与数据均未修改。后续 LCJ 本地类型检查和构建必须移除继承的 `DATABASE_URL`，数据库迁移仅在确认 LCJ 生产连接后执行。
