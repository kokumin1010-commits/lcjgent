# LCF排行榜整套下线审计

## 2026-09-02｜实施前状态

排行榜完整链路位于`LiveCommerceFestival.tsx`首页入口、`LcfMypage.tsx`的GMV AWARD上传区、`LcfAdmin.tsx`管理面板、`LcfRanking.tsx`公开页面、`App.tsx`路由、`server/rankingRouter.ts`及`server/routers.ts`挂载。数据表为`lcf_ranking_submissions`，截图对象键位于`ranking-screenshots/`前缀；提交接口会调用图片AI识别并写入对象存储。

Railway生产MySQL备份页已打开，但现有Railway登录会话已失效，页面仅显示Login。此时尚未创建本次排行榜删除前备份，尚未读取个人明细、删除排行榜数据、删除截图或修改生产。

用户表示已登录后再次检查，Railway仍返回公开首页并显示Sign in登录层，没有进入`lcjagent`项目；当前浏览器登录状态仍不可用。因此继续保持生产零删除，不能在没有新回滚点的情况下清理排行榜。

## 不依赖Railway登录的执行设计

用户明确要求最终**不能保留排行榜**。实施采用两阶段部署：第一阶段先从首页、MyPage、管理后台和客户端路由移除所有入口，并从主tRPC Router移除原`rankingRouter`，使旧客户端也不能继续上传、查询或调用AI解析；同一阶段仅挂载管理员专用、确认短语保护的一次性维护Router。

维护Router会读取现有`lcf_ranking_submissions`并为本次失败恢复生成临时AES-256-GCM加密副本；截图原件逐项下载、计算SHA-256、加密上传到临时私密前缀并回读校验。所有临时副本确认完整后，才删除原截图对象并删除数据库表。生产验证完成后，维护Router再删除临时加密记录、截图副本和清单；第二阶段从代码和主Router中删除维护接口本身。最终状态要求：零页面、零入口、零原API、零数据库表、零原截图、零临时备份和零维护接口。

第一阶段代码实现完成：`/lcf/ranking`客户端路由与页面、首页桌面/移动入口、MyPage GMV AWARD上传区、管理后台GMV RANKING标签及面板均已删除；原`rankingRouter`及其公开、用户和管理员API全部从主Router移除并删除。临时`rankingRetirementRouter`仅允许LCF管理员访问，并要求固定确认短语；它会列出完整`ranking-screenshots/`前缀，因此数据库未引用的孤立截图也纳入临时加密校验和最终删除。

专项回归2个测试文件、18项测试全部通过；生产Vite和服务端打包成功。构建末尾本地迁移因沙箱没有生产数据库连接而按仓库既有逻辑跳过，未接触生产数据。仓库既有Sharp命名空间警告仍存在，与本次排行榜下线无关。
