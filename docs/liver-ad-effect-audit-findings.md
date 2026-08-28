# 主播直播广告费与效果分析审计结论

## 审计范围

本审计仅覆盖 `/liver/record`、其真实组件 `LiverSelfRecord.tsx`、`liverManagement.createLivestream/getLivestreams`、`brand_livestreams` 与显式关联的 `ad_investment_records`。未连接旧TiDB，未直连Railway MySQL，未执行任何生产mutation。

## 根因

`brand_livestreams` 已有第一类场次字段 `adCost`、`roas`、`cpc`、`acos`；主播历史查询选择整行，因此这些字段原本可以直接返回。另有 `ad_investment_records.livestreamId` 可显式关联一场直播并保存真实广告预算。

用户实际访问的 `/liver/record` 渲染 `LiverSelfRecord.tsx`，不是管理员路径使用的 `LiverRecord.tsx`。`LiverSelfRecord` 的截图AI返回模型已经包含 `rawData.adCost` 与 `rawData.roi`，但表单没有广告费状态，AI结果没有回填广告费，提交payload也没有发送广告费。后端 `liverManagement.createLivestream` 同样不接受或写入 `adCost`。所以广告费在UI/API边界被丢弃，而不是数据库缺列。

## 生产只读证据

审计2026年6月至8月共13名主播、14场唯一直播；所有14场均有GMV/销售字段，13场有观看人数，12场有订单数，但14场的原生 `adCost` 全部为NULL。与这些场次相关品牌的 `ad_investment_records` 为0条，显式 `livestreamId` 关联为0条。因此现有场次不能被推断为“无广告”，只能显示“广告费未登记”；不得把NULL自动转换为0，也不得按品牌/日期猜测归因。

## 安全设计输入

后续保存应把 `adCost` 作为场次第一来源；若未来存在 `ad_investment_records.livestreamId` 显式关联而场次字段为空，可作为第二来源。无显式证据保持NULL。只有明确登记为0的场次才属于“无广告”，大于0属于“有广告”。

效果分析只比较广告状态已知且指标有效的场次，并展示样本数。建议指标为GMV、订单、观看人数、观看转化率、GMV/小时；有广告场次额外计算ROAS、每单广告成本、广告费扣除后销售贡献。该“销售贡献”不是利润，不扣除商品成本、佣金、平台费或退货。
