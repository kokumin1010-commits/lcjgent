# 店铺管理升级实施日志

**日期：2026-08-26**

## 根因

店铺列表已有5条Railway记录、主/副负责人字段和仅用于新建店铺的头像输入，但卡片`onEdit`为空函数，后端`update`也不接受头像字段。新建头像使用`FileReader.readAsDataURL`，会尝试把Base64写入有限长度的MySQL列，而不是对象存储。

GMV总览在所选月份等于当前月份且没有数据时，前端额外查询`latestDataPeriod`并用2026年7月摘要替换2026年8月摘要，导致页面选择8月却展示7月¥134,334,533。

## 实施

新增`storeProfileUpgrade.ts`，为`managed_stores`幂等增加`avatarKey`、`contactEmail`、`contactPhone`列，并在首次结构升级前后执行强制加密备份。迁移只增加结构，不修改5店铺或`store_data_uploads`行。

新增需要登录的`/api/store-avatar-upload`，仅允许JPEG、PNG、WebP且最大5MB，文件写入S3/R2的`store-avatars/`目录；MySQL只保存URL和key。未登录、错误MIME和超限文件均返回可读错误。

店铺卡新增始终可见的编辑按钮。创建与编辑共用资料弹窗，支持头像预览/替换/清除、平台、地区、店铺URL、HR在职负责人、自定义负责人、副负责人、联系邮箱、联系电话和备注。店铺卡显示负责人及可用联系方式。

GMV总览、店铺卡、排名、图表与进入详情的年月统一绑定用户所选年月。跨月回退查询与替换逻辑完全移除；无上传月份显示0并明确标注“未上传按0显示”。2026年7月保存行与恢复健康校验保持不变。

## 部署前验证

确定性静态检查20/20通过。`StoreManagement.tsx`、`storeManagementRouter.ts`、`storeProfileUpgrade.ts`和生产服务入口均完成独立esbuild打包。未发现Base64头像写入、跨月回退引用、未认证店铺头像上传或服务监听早于结构迁移。

## 生产部署结果

Git提交`977b416d42587737ecd8fd0335da151d3c9971f6`已部署到Railway。结构升级状态为`success`，缺失列从`avatarKey/contactEmail/contactPhone`变为0，数据行修改数为0；旧TiDB使用标记为`false`。

加密前置备份ID 59（334表、10,617行）和后置备份ID 60（334表、10,618行）均为`success`。行数差异仅来自结构升级运行日志，不是5店铺或GMV数据改写。

生产健康确认活动店铺仍为5，2026年7月恢复总额校验保持正确。2026年8月`shop_stats`上传行数为0，严格零值规则为`true`，跨月回退允许值为`false`。

生产店铺管理路由和当前StoreManagement分块均为HTTP 200。分块包含头像上传、资料编辑、保存修改、负责人、联系方式和“当月数据未上传／不会回退”标记。未登录调用头像上传端点返回401；随机失效静态资源返回404且`Cache-Control: no-store`。

当前5店铺中已有1店配置负责人，头像与联系方式仍为0；本次升级没有替用户猜测或自动填写负责人、头像或联系方式，用户可从页面逐店编辑。
