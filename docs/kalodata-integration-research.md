# Kalodata竞品日报接入研究

## 已确认事实

Kalodata官网说明其提供TikTok Shop的商品、创作者、视频、直播、店铺与竞争分析数据，并明确声明数据主要来自公开渠道，经模型处理后形成估算。官网同时提示交易金额、广告支出等字段可能与真实值存在小幅差异，因此本系统应把Kalodata数值标记为“市场情报估算”，不能用于佣金结算或员工绩效考核。[1]

Kalodata官方账号于2026-07-30宣布Open API已经上线，明确支持实时数据同步、构建内部管理系统和自有分析产品，适合品牌、零售商、MCN与数据分析团队。[2]

Kalodata官方LinkedIn公告的置顶评论给出完整API文档入口：`https://www.kalodata.com/open-center/docs`。[3] 官方Facebook公告配图显示Open Center提供API、Skill和Pricing入口，当前宣传口径包括10+ OpenAPI端点、6个核心数据模块、15个TikTok Shop市场和99.9% SLA；具体端点和授权范围仍应以登录后的账号文档为准。[4]

Kalodata公开商品榜单页支持按市场、日期、类目、收入、销量、收入来源、收入增长率、平均单价、达人数量、转化率等条件筛选；表格字段包括商品、收入、收入趋势、增长率、销量、平均单价、达人数量、达人转化率、直播收入、视频收入和商品卡收入。[5]

| 能力 | 当前结论 |
|---|---|
| 自动同步可行性 | 官方已确认Open API可用于内部系统与实时同步 |
| 目标数据 | 官网确认存在实时商品排名、竞争店铺跟踪、热卖商品和价格策略分析 |
| 精度口径 | 属于市场情报估算，不等同于TikTok Shop结算后台实绩 |
| 当前会话连接器 | 未发现已配置的Kalodata连接器或API凭证 |
| API文档入口 | 已确认官方入口为 `https://www.kalodata.com/open-center/docs` |
| 无登录访问结果 | Open Center导航可见，但API文档持续停留在加载状态，未返回端点正文或网络规范文件 |
| 尚待确认 | 认证格式、当前账号是否已开通Open API、Shop/Product榜单端点与字段、调用额度与费用；需通过用户已有Kalodata会话或Open Center权限确认 |

## 接入原则

优先使用Kalodata官方Open API。若用户账号未开通Open API，则使用Kalodata官方导出文件自动导入作为第一备选；不采用未授权抓取、浏览器cookie复制或依赖易变页面DOM的生产方案。每次同步需记录来源、市场、日期范围、查询条件、同步时间、原始响应摘要与错误状态。

## References

[1]: https://www.kalodata.com/ "Kalodata官网与数据准确性说明"
[2]: https://x.com/kalodata/status/2082664306903052483 "Kalodata Open API官方发布公告"
[3]: https://www.linkedin.com/posts/kalodata_kalodata-open-api-3-core-capabilities-activity-7488598029004881920-sJfZ "Kalodata Open API LinkedIn公告与文档链接"
[4]: https://www.facebook.com/kalodata.tt/photos/kalodata-open-api-is-live-built-on-top-of-kalodatas-tiktok-shop-data-infrastruct/971071419326024/ "Kalodata Open Center官方发布配图"
[5]: https://www.kalodata.com/product?tc "Kalodata公开商品榜单页"
