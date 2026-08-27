# LCJ 财务管理密码门禁实施规格

## 范围

仅保护 `/master/finance` 财务管理工作台及其专属财务数据接口。密码由用户提供，但源码、前端包、URL、日志、数据库和Git历史中不得出现明文。现有Railway MySQL财务数据、发票、合同、工资和导入记录不做任何改写。

## 安全模型

| 项目 | 规则 |
|---|---|
| 身份前置 | 必须先通过现有LCJ账号登录 |
| 密码验证 | 仅在服务端使用bcrypt摘要比较；支持 `FINANCE_ACCESS_PASSWORD_HASH` 环境变量覆盖 |
| 解锁凭证 | 签名JWT写入HttpOnly、Secure、SameSite Cookie，绑定当前用户ID |
| 有效期 | 8小时；用户可主动重新锁定；正常退出登录同时清除 |
| 防爆破 | 同一用户与来源IP连续5次错误后锁定15分钟 |
| 前端 | 未解锁时只挂载密码门禁，不挂载FinanceManagement内部组件，因此不会提前请求财务数据 |
| 审计 | 成功解锁与主动锁定写现有activity log；密码与摘要均不写日志 |

## 后端覆盖

| 数据域 | 保护方式 |
|---|---|
| `invoice` | 整个router改用financeProcedure |
| `cashflow` | 除财务门禁status/unlock/lock外均要求finance cookie；工资明细继续叠加原有payroll二次密码 |
| `tiktokFinance` | `brandId=0`或无brandId的主财务请求要求finance cookie；品牌详情页使用真实brandId，保持现状 |
| `tsp` / `brandContract` | 这些接口也被品牌详情等其他页面复用，不做全局锁定；在`/master/finance`中因父页面未挂载而不会在解锁前调用 |
| 共享品牌/员工列表 | 保持现有认证，不扩大财务密码到其他模块 |

## 前端行为

进入任意`/master/finance?tab=...`地址时，先显示财务密码卡片。错误密码显示明确错误但不暴露校验细节；正确密码后保留原查询参数并加载原财务页面。刷新保持8小时解锁状态；点击“重新锁定”立即清除财务缓存并回到密码卡片。密码输入不保存到localStorage/sessionStorage。

## 验证标准

正确密码解锁，错误密码拒绝，连续错误触发限流，伪造或其他用户Cookie拒绝。未解锁时财务数据procedure返回FORBIDDEN，且浏览器不发送发票、现金流或TikTok主财务查询。解锁后原发票标签、现金流和TikTok财务只读查询正常；原工资二次密码仍保持。财务记录写入0，其他页面与业务模块差分为0。
