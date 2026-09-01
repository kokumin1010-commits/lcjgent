# 短视频矩阵：TikTok账号自动视频同步规格

## 目标

在“短视频矩阵管理 → 账号 → 添加/编辑账号”中，用户登记TikTok Profile URL后，不再需要到另一个页面重复登记。服务器从URL确定性提取`@username`，保存账号并启用已有公开视频监控；服务器在保存后立即尝试第一次同步，之后由现有每小时调度器扫描到期账号。暂停或归档账号不得继续自动抓取。

## 已有能力与本次缺口

仓库和生产已存在TikTok公开视频监控：账号资料、公开视频、视频小时快照、账号小时快照、同步运行历史、手动同步、暂停/恢复及每小时GitHub OIDC定时任务。2026-09-01最近一次生产定时运行成功处理4个账号，并更新25、33、35、34条视频。

现有矩阵`svm.createAccount`/`updateAccount`只保存手工字段，不解析Profile URL、不启用`monitorEnabled`，也不触发首次同步。公开监控面板只挂在短视频日报页，因此矩阵账号管理与监控存在两套入口。

## 保存规则

1. 新增TikTok账号必须提供有效的`https://www.tiktok.com/@username` Profile URL；服务器只接受TikTok HTTP(S)主页URL，不接受任意域名或视频URL。
2. `accountName`由Profile URL提取并标准化；前端显示可自动回填，但服务器结果为权威值。
3. 同一非归档TikTok用户名不能重复创建。编辑改变URL/用户名时再次检查重复。
4. 新增且状态为`active`：保存账号、启用公开监控、状态设为`pending`，服务器在账号持久化后尝试一次`register`同步。外部采集失败不能回滚已经保存的账号，必须显示失败状态与可安全重试提示。
5. 编辑Profile URL或把状态从暂停改为活动：重新启用监控并安排立即同步。编辑其他描述字段不应产生额外API调用。
6. 状态改为`paused`或`archived`：关闭监控并清除下次同步时间。恢复`active`时重新安排。
7. 现有已启用账号保持不变；现有active TikTok账号如果已有有效Profile URL但尚未启用，可在页面点击“开始监控”，不自动猜测无URL账号。

## 数据与展示

自动采集写入既有`tiktok_public_*`表，不覆盖人工`svm_video_posts`或`short_video_daily_entries`。矩阵仪表盘直接显示公开监控组件，包括账号数、粉丝总数、本月视频数、播放/点赞/评论/分享/收藏、每日发布数、账号卡片、视频卡片和最近同步运行。

每个视频以`accountId + externalVideoId`去重；同一小时快照使用唯一键幂等更新。新视频记一次发现，后续同步只更新当前指标并追加/更新小时快照。任何指标只能来自提供器响应；字段缺失显示“不可用”，不得推测。

公开互动数据与商品点击、订单、GMV完全分离。商品点击、订单和GMV只能使用TikTok Shop或经营报表的授权数据源，未授权时显示“未授权/不可用”，不得写0冒充已采集。

## 定时与故障

复用现有GitHub Actions每小时回调。新视频发布后72小时每6小时更新，7天内每12小时，其后每24小时；失败6小时后重试。每次仅串行处理最多6个到期账号，429时停止本轮，所有运行写入`tiktok_public_sync_runs`。

Matrix保存接口先持久化账号，再尝试外部同步；外部同步不参与账号事务。首次同步失败时仍返回“账号已保存”的安全提示，账号保持`pending`/`failed`并由下一次后台任务处理，因此不会因浏览器关闭或第三方暂时故障丢失登记。

## 数据源与费用边界

TikTok官方Display API要求开发者应用审批，并由每个账号完成OAuth授权后才能读取该账号，不能只凭任意Profile URL监控[1][2]。当前LCJ使用RapidAPI Tiktok Scraper（TIKWM）读取公开账号。其公开Basic档为0美元/月、300次/月硬限制，Pro档为59美元/月、3,000,000次/月[3]。本次不订阅、不升级套餐、不写入或显示密钥；继续使用生产现有配置，并在UI明确提供器是否可用及失败状态。

## 权限与安全

账号增删改、立即同步和监控开关沿用短视频矩阵现有登录权限；读取公开视频面板需要现有页面查看权限。Profile URL在客户端和服务器双重校验。提供器错误不得包含API密钥、请求头或内部SQL；前端只显示安全错误分类。

## 验收

必须覆盖：合法/非法URL、账号名自动回填、重复账号、保存成功但外部同步失败、Profile URL变化、暂停/恢复、定时幂等、同小时快照、429、现有账号、手工投稿不被覆盖、商品点击/订单/GMV隔离、管理员/未登录权限、桌面与移动端布局。生产验收不得新增测试账号或测试视频。

## References

[1] TikTok Display API Overview: https://developers.tiktok.com/doc/display-api-overview?enter_method=left_navigation

[2] TikTok Display API Get Started: https://developers.tiktok.com/doc/display-api-get-started/

[3] RapidAPI Tiktok Scraper Pricing: https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7/pricing
