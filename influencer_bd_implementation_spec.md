# LCJ MALL 达人BD管理与AI改善板块实现规格

日期：2026-08-27 JST
作者：Manus AI

## 目标与边界

本板块用于记录LCJ达人部门每天实际联络的达人、BD推进阶段、回复与问题、所用话术、下一步动作、聊天文字和聊天截图，并把真实记录汇总成可追溯的AI诊断。系统不得自动生成达人、回复、合作、成交或进度事实；AI推断必须与事实字段分离。

首版入口为`/master/influencer-bd`，沿用现有LCJ后台侧边栏、语言切换、认证和页面权限。数据只写入Railway MySQL；文件只写入现有对象存储；不连接旧Manus TiDB。

## 使用角色与权限

| 角色 | 查看范围 | 可执行操作 |
|---|---|---|
| 管理员 | 全部BD、全部达人、全部推广方案、全部AI分析 | 新建/编辑全部数据、调整负责人、归档、查看审计、配置分析规则 |
| 普通BD员工 | 自己创建或分配给自己的达人与联络记录 | 新建达人、登记和修改自己的进度、上传自己的聊天证据、对自己的数据发起AI分析 |
| 未认证用户 | 无 | 直接返回未认证错误，前端进入登录页 |

服务端以`ctx.user.id/email/role`确定操作者，并通过staff邮箱匹配staff.id。前端传入的负责人ID不能扩大当前用户权限。所有写入使用事务并记录before/after审计。删除采用带原因的软归档；首版不提供普通员工硬删除。

## 业务流程

每天BD先选择或新建达人，再选择推广方案，登记渠道、联络次数、使用话术、当前阶段、回复状态、问题点与下一步日期。聊天文字直接保存为证据文本；截图上传后保存对象存储key与元数据。主管可按日期、员工、渠道、阶段和推广方案查看漏斗。达到低回复率或长期无推进规则时只显示提示，默认不自动消耗AI积分；用户点击“AI分析”后才生成并保存建议。

## 状态与字典

| 字段 | 允许值 |
|---|---|
| 平台 | TikTok、Instagram、YouTube、X、LINE、WeChat、其他 |
| 达人状态 | 潜在、联络中、已回复、感兴趣、样品中、商谈中、合作、暂缓、拒绝、归档 |
| 联络渠道 | TikTok私信、Instagram私信、邮件、LINE、WeChat、电话、其他 |
| 推进阶段 | 初次接触、二次跟进、已回复、需求确认、样品提案、寄样、商务洽谈、合作确定、拒绝、暂缓 |
| 回复性质 | 未回复、中性、积极、拒绝、需要跟进 |
| 推广方案状态 | 草稿、有效、暂停、归档 |
| AI反馈 | 有帮助、无帮助 |

## 数据模型

### `influencer_bd_campaigns`

保存推广方案，而不是把话术和卖点散落在每日记录中。字段包括：id、name、brandId、productId、productNameSnapshot、coreSellingPoints、creatorBenefits、commissionPolicy、samplePolicy、targetCreatorProfile、referenceOpeningScript、referenceFollowUpScript、objectionHandling、status、created/updated actor、deletedAt和时间戳。

### `influencer_bd_creators`

字段包括：id、displayName、platform、handle、profileUrl、followerCount、category、country、language、contactInfo、ownerStaffId/Name、status、notes、lastContactAt、lastReplyAt、created/updated actor、deletedAt和时间戳。`platform + handle`使用归一化唯一键，避免重复达人；不要求填写无法验证的数据。

### `influencer_bd_outreach_logs`

字段包括：id、creatorId、campaignId、staffId/Name、activityDate、channel、stage、contactCount、responseType、replyReceived、positiveReply、sampleAdvanced、cooperationConfirmed、pitchText、chatText、issues、nextAction、nextFollowUpDate、outcomeNotes、created/updated actor、deletedAt和时间戳。回复、正向回复、样品推进和合作为明确布尔事实，不能由AI自动回写。

### `influencer_bd_attachments`

字段包括：id、outreachId、creatorId、storageKey、fileUrl、fileName、mimeType、fileSize、sha256、uploadedBy、createdAt、deletedAt。允许JPEG、PNG、WEBP，每个文件最大10MB，每条记录最多10张；服务端验证实际文件签名和MIME，不能只信扩展名。

### `influencer_bd_ai_analyses`

字段包括：id、scopeType、scopeStaffId、periodStart/End、campaignId、model、promptVersion、inputSnapshotJson、resultJson、summary、confidence、status、errorCode、errorMessage、requestedBy、createdAt。失败记录独立保存结构化错误，且不覆盖旧的成功建议。

### `influencer_bd_analysis_feedback`

字段包括：id、analysisId、rating、comment、implementedActionsJson、resultNote、userId、createdAt。反馈在后续分析中作为上下文，但模型不能把反馈当作新的业务事实。

### `influencer_bd_settings`

单例设置保存：lowReplyRatePercent默认5、stagnationDays默认3、minimumContactedCreators默认20、autoAnalysisEnabled默认false、updated actor和时间戳。

### `influencer_bd_audit_logs`

保存entityType、entityId、action、beforeJson、afterJson、actorId/Name、reason、createdAt。聊天正文和截图URL不在普通列表审计响应中全文展开，避免不必要暴露。

## KPI定义

| 指标 | 定义 |
|---|---|
| 联络达人数 | 期间内至少有一条有效联络记录的去重creatorId数 |
| 联络次数 | 期间内`contactCount`之和 |
| 回复达人数 | 期间内至少一条`replyReceived=true`的去重creatorId数 |
| 正向回复数 | 期间内至少一条`positiveReply=true`的去重creatorId数 |
| 样品推进数 | 期间内至少一条`sampleAdvanced=true`的去重creatorId数 |
| 合作达人数 | 期间内至少一条`cooperationConfirmed=true`的去重creatorId数 |
| 回复率 | 回复达人数 ÷ 联络达人数 × 100% |
| 正向回复率 | 正向回复数 ÷ 联络达人数 × 100% |
| 联络效率 | 回复达人数 ÷ 联络次数 × 100%，作为辅助指标，不能替代达人去重回复率 |

看板同时按员工、渠道、推进阶段、推广方案和日期拆分。分母为0时返回null而不是伪造0%。

## AI分析契约

默认模型为`gemini-3-flash-preview`。服务端将选择期间的KPI、推广方案卖点、达人画像、话术、问题、聊天文字、最多8张聊天截图和最近有效反馈组成证据包。必须使用严格JSON Schema，输出：

- `executiveSummary`：结论摘要；
- `dataQuality`：样本量、缺失字段和是否足以判断；
- `funnelDiagnosis`：联络、回复、正向、样品、合作各阶段问题；
- `rootCauses[]`：方式、话术、卖点、达人匹配、跟进节奏、证据不足等分类，附证据、影响、置信度；
- `sellingPointGaps[]`：未表达或表达不清的卖点/达人利益；
- `recommendedActions[]`：负责人、优先级、动作、原因、完成标准；
- `messageScripts`：初次联络、二次跟进、异议回应三类建议话术；
- `creatorSegmentAdvice[]`：适合优先联络的达人类型及理由；
- `experiments[]`：可A/B测试的单变量实验、成功指标和样本量建议；
- `warnings[]`：数据不足、隐私、无法验证等警告。

AI system prompt必须明确：只依据输入证据；不知道时写“证据不足”；不捏造达人回复或产品功能；把事实与假设分开；建议必须可执行且适合日本/中文商务沟通；不能输出密码、访问令牌或与BD无关的个人敏感信息。

## 页面结构

页面顶部为日期范围、员工和推广方案筛选。第一行是联络达人、回复、正向回复、样品、合作和回复率KPI卡。其下为漏斗与低回复提示。主内容使用五个标签页：

| 标签页 | 内容 |
|---|---|
| 今日进度 | 每日记录表、新增/编辑记录、下一步与超期提示 |
| 达人库 | 达人资料、负责人、最近联络、状态和历史 |
| 推广方案 | Q咕咕等产品卖点、达人利益点、佣金/样品政策和标准话术 |
| AI改善 | 选择范围后发起分析、展示诊断、建议话术、行动项和反馈 |
| 管理视图 | 员工/渠道/方案表现、设置和审计；管理员显示 |

移动端采用卡片，桌面端采用表格；上传时显示进度、单文件错误码和可删除预览。所有空状态明确说明“尚无真实数据”，不提供演示假数据。

## 非破坏发布与回归

上线前必须先验证加密备份成功，再创建新表；检查现有核心表行数不变；创建后再备份。升级可重复执行且不会改写既有员工、品牌、商品、日报或店铺数据。测试使用mock API或事务回滚，不在生产创建测试达人。

回归至少覆盖：未认证拒绝、普通员工只能看本人、管理员全局、事务回滚、软归档、KPI去重口径、分母0、文件类型/大小/签名、10张上限、AI严格Schema、AI失败不覆盖旧结果、无证据时不捏造、刷新/重登/重启后数据保留、既有页面路由不受影响、旧TiDB字符串0件。
