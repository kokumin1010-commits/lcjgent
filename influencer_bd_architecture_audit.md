# 达人BD管理与AI改善板块——架构审计记录

日期：2026-08-27 JST

## 现有可复用能力

现有LCJ MALL是React/Vite + Express/tRPC + Railway MySQL。内部管理页面使用`DashboardLayout`、`PermissionGate`和`rbac.myPermissions`。服务端有`protectedProcedure`和`adminProcedure`，所有达人BD读取与写入必须放在受保护procedure中，不能依赖前端传入的操作者姓名。

`drizzle/schema.ts`已有品牌、商品、品牌活动、直播结果、员工、日报AI建议、AI反馈学习、聊天会话、LINE消息与跟进表。品牌商品已有`features`、`catchCopy`、`targetAudience`、`commissionRate`、图片和提案图；可作为达人推广方案的真实卖点来源，但没有独立达人联络、每日BD进度、聊天证据和BD结果分析数据域。

现有对象存储位于`server/storage.ts`，`storagePut`保存对象并返回key/url，`storageGet`可生成1小时签名URL。达人聊天截图应只把key/url/文件名/MIME/大小存入Railway MySQL，图片字节不得存进数据库。

现有`server/storeExecutionUpgrade.ts`提供非破坏生产升级标准：升级run表、required tables检查、升级前强制加密备份、`CREATE TABLE IF NOT EXISTS`、源表行数不变验证、升级后强制加密备份、success/failed健康状态。达人BD结构升级应复用同一模式，并在`server/_core/index.ts`监听端口前执行。

现有`server/storeExecutionRouter.ts`提供actor、transaction、before/after audit、admin确认/归档范例。达人BD写入需要原子事务、createdBy/updatedBy以及审计日志。一般员工只能修改自己创建或分配给自己的BD记录；管理员可查看全员、调整负责人和归档。

## 实时AI模型目录（2026-08-27）

通过当前OpenAI兼容模型目录确认：

| 模型 | 图片 | JSON Schema | 输入/输出费用（美元/100万token） | 输入/输出项目积分（每100万token） | 适用 |
|---|---:|---:|---:|---:|---|
| `gpt-5-mini` | 支持 | 支持 | 0.25 / 2.00 | 37.5 / 300 | 低成本文字总结、分类、话术生成 |
| `gemini-3-flash-preview` | 支持 | 支持 | 0.50 / 3.00 | 75 / 450 | 长聊天记录与截图的多模态分析 |
| `gemini-3.1-pro-preview` | 支持 | 支持 | 2.00 / 12.00 | 300 / 1800 | 高难度复盘，成本较高 |

默认设计采用`gemini-3-flash-preview`处理文字与聊天截图，并使用严格JSON Schema。AI只在服务端调用。按需分析为默认；低回复率/长期无进展规则做成可配置提示，不默认后台消耗积分。

## 建议的数据域

独立创建以下非破坏表，不将达人混入品牌或主播表：

1. `influencer_bd_campaigns`：推广方案、关联品牌/商品、核心卖点、达人利益点、佣金/样品政策、目标达人画像、参考话术、异议处理、状态。
2. `influencer_bd_creators`：达人账号、平台、主页URL、粉丝量、类目、地区、语言、联系方式、负责人、状态、最近联络/回复时间。
3. `influencer_bd_outreach_logs`：每日每位BD针对达人和推广方案的联络渠道、当前阶段、联络次数、是否回复、回复性质、下一步、问题点、使用话术、结果与日期。
4. `influencer_bd_attachments`：聊天截图/文件的对象存储key/url、MIME、大小、上传者、关联outreach。
5. `influencer_bd_ai_analyses`：分析期间、真实输入快照、模型、结构化诊断、问题分类、卖点缺口、话术建议、下一步、置信度和生成者。
6. `influencer_bd_settings`：回复率阈值、无进展天数、自动提示开关、默认分析模式。
7. `influencer_bd_audit_logs`：实体、动作、before/after、操作者、原因、时间。

## KPI口径

管理看板至少显示：联络达人去重数、联络次数、回复达人数、正向回复数、样品推进数、合作达人数、回复率、正向回复率、按员工/渠道/话术/推广方案拆分。分母为所选期间内至少被联络一次的去重达人，防止同一达人多次消息把回复率人为稀释。每日明细保留原始联络次数与全部证据。

## 首版界面范围

新增`/master/influencer-bd`并放入管理侧边栏，页面包含：总览KPI、每日进度、新增/编辑联络记录、达人库、推广方案、证据预览、AI诊断、员工/日期/阶段/渠道筛选、AI建议反馈。内部页面沿用`DashboardLayout`和`PermissionGate`。

## 禁止事项

不得连接旧Manus TiDB；不得生成虚假达人、回复、合作或进度；不得在生产测试时创建残留业务行；不得把聊天截图二进制存入数据库；不得把未验证的AI推断写回为事实；不得把AI key暴露到前端；不得允许普通员工通过传入他人staffId越权查看或修改。
