# 财务司令塔与原始上传文件证据链设计

日期：2026-08-29

## 目标

在现有`/master/finance?tab=cashflow`明细核对页旁增加`finance-command`标签。司令塔只回答“现在有多少钱、数据是否新鲜、最近现金变化、当前有哪些风险”，所有指标均可回到现有现金流页核对。现有明细、工资、凭证和恢复数据不删除。

今后财务管理中的导入文件必须保存原始文件本体与批次元数据。数据库只保存文件元数据和私有对象存储Key，不保存文件字节。

## 上传证据覆盖范围

| 类型 | 当前入口 | 本次策略 |
|---|---|---|
| 银行流水 | `cashflow.importBankStatement` | 保存原XLSX/XLS/CSV、SHA-256、上传者、法人、成功/跳过/失败数 |
| 工资表 | `cashflow.importPayroll` | 额外保存原工作簿；下载继续要求工资权限 |
| TikTok订单CSV | `tiktokFinance.uploadCsv` | 保存原CSV并绑定现有导入历史 |
| TikTok入金CSV | `tiktokFinance.uploadPaymentCsv` | 保存原CSV与新批次历史 |
| TAP工作簿 | `tiktokFinance.uploadTapXlsx` | 保存原XLSX/XLS与月份、结果数 |
| CAP Creator工作簿 | `tiktokFinance.uploadCapCreatorXlsx` | 保存原XLSX/XLS与月份、结果数 |
| CAP Product工作簿 | `tiktokFinance.uploadCapProductXlsx` | 保存原XLSX/XLS与月份、结果数 |
| 请求书/发票附件 | 既有上传接口 | 已使用对象存储；保留现状，不重复存储 |

## 证据表

新增`finance_import_documents`：

- `id`、`module`、`entity`、`brandId`、`reportMonth`；
- `sourceFileName`、`sourceFileSha256`、`sourceFileSize`、`sourceMimeType`、`sourceStorageKey`；
- `recordCount`、`importedCount`、`skippedCount`、`errorCount`、`status`、`errorMessage`、`details`；
- `relatedImportId`、`createdBy`、`createdByName`、`createdAt`、`completedAt`；
- 对`module + sourceFileSha256 + entity + brandId + reportMonth`建立索引，用于审计和重复提示，不把重复文件直接静默丢弃。

文件先写入`private/finance-imports/{module}/{yyyy}/{mm}/{hash}-{safeName}`。只有财务二次验证通过的用户可列出或取得一小时签名下载链接；工资表需额外通过工资权限。

失败批次也保留原文件和错误信息，因为失败文件本身是审计证据。只有对象存储写入失败时才停止导入，避免出现“数据写进账本但原文件没保存”。

## 兼容性

旧`cashflow_import_history`继续保留并显示。新增文件批次与旧历史并列返回；旧记录标记`originalFileSaved=false`，绝不伪造文件。现有三条08/26记录只有找到外部原文件后才能补绑。

现有`tiktok_csv_import_history.fileKey/fileUrl`保留兼容，新的通用证据表作为统一下载与审计入口；订单CSV导入同时更新旧表的`fileKey/fileUrl`。

## CEO／财务司令塔数据契约

新增`cashflow.getFinanceCommandCenter`，输出：

- `asOf`与各账户`lastDate/staleDays/currentBalance`；
- 日本JPY、中国CNY余额和参考换算（清楚标记参考汇率）；
- 最近7天与30天的收入、支出、净流量，JPY/CNY分开；
- 基于最近90天平均现金支出的估算跑道，明确标记为估算而非会计预测；
- 最近30天支出类别TOP5；
- 今日行动队列：负余额、账户数据过期、大额支出缺凭证、疑似重复、说明不足、导入失败或未保存原文件；
- 最新导入文件及保存状态。

司令塔不自动写账、不替代财务核对、不混合JPY/CNY原币金额。只有明确标记为“JPY参考”的区域才使用参考汇率。

## 前端结构

`FinanceManagement`新增紧邻“入出金管理”的“财务司令塔”标签。司令塔使用深色摘要头、四个KPI、账户新鲜度、30天现金变化、行动队列、最新导入文件。按钮只做下钻：打开入出金明细、工资中心或导入历史。

`CashflowTab`的导入历史升级为可展开列表，显示文件名、SHA-256短码、上传者、大小、状态、成功/跳过/失败数，并提供“查看/下载原文件”。旧记录显示“旧记录未保存原文件”。

## 不可破坏边界

- 不修改现有现金流金额、余额、订单、工资记录或附件。
- 不为旧批次伪造原文件。
- 不把私有存储Key直接返回给浏览器，只返回短时签名URL。
- 不在日志、测试或页面显示完整SHA-256、个人敏感工资内容或存储凭证。
- 不删除对象存储中的导入原文件；撤销导入只能软作废业务数据并保留证据。
