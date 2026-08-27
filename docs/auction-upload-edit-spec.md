# 拍卖记录上传与自行修改修复规范

## 已确认根因

生产只读接口显示`auction_records`现有6条、导入历史1批，拍卖schema与数据库备份均为healthy，说明问题不是Railway数据表缺失。生产Chromium点击既有记录“编辑”后触发`auctionDate?.split is not a function`，因为tRPC/SuperJSON把MySQL日期恢复为`Date`对象，而前端只按字符串处理，导致编辑表单无法打开。主播筛选逻辑还引用了从未声明的`filtered`变量，并漏掉`filterLiver`依赖，点击筛选可能发生运行时回归。

上传入口当前依赖浏览器解析Excel后一次性提交base64，服务端只检查大小与SHA，没有根据扩展名、MIME和文件头验证XLSX/XLS/CSV实质格式；前端也没有文件大小、空workbook和格式的明确预检。上传失败时只显示原始异常，缺少阶段化提示。

## 实施范围

| 范围 | 规则 |
|---|---|
| 页面运行 | 修复主播筛选的未声明变量与memo依赖；所有`roundsJson`读取使用安全解析，损坏旧JSON不使整页白屏 |
| 编辑 | 日期同时兼容`Date`、ISO字符串和`YYYY-MM-DD`；既有记录可编辑商品ID、日/中文名、主播、日期、起拍价、平均/成交价、GMV、订单数、拍卖次数、备注与轮次明细 |
| 轮次 | 每轮可增删改编号、起拍价、成交价、竞拍人数、获胜者、SKU名、SKU ID、开始时间与时长；有轮次时自动同步`roundsJson`、`auctionCount`、首轮起拍价和平均成交价 |
| 新建 | 至少需要商品ID或商品名；日期必须是真实`YYYY-MM-DD`；数字必须有限且非负，计数必须为整数 |
| 上传 | 支持`.xlsx`、`.xls`、`.csv`；浏览器先检查30MB、扩展名、workbook/sheet与可导入记录；服务端再次检查大小、SHA、扩展名、MIME与XLSX ZIP/XLS OLE/CSV文本实质签名后才存储 |
| 保存 | 手工create/update使用固定列白名单和Railway MySQL transaction；update先`FOR UPDATE`确认记录存在并检查`affectedRows=1`；任一错误rollback并返回清晰中日文错误 |
| 权限 | 保持现有`protectedProcedure`认证边界，不放宽为公开接口；不修改其他选品标签或业务模块 |
| 数据安全 | 不连接旧Manus TiDB，不在生产上传测试文件、不创建/修改测试拍卖行；生产只做认证read-only与客户端空表单交互 |

## 回归要求

服务层测试必须覆盖新建、既有记录Date兼容、完整字段更新、轮次重算、最后一轮删除、非法数字/日期拒绝、NOT_FOUND、affectedRows异常与rollback。文件测试必须覆盖真实XLSX、XLS、CSV以及扩展名/文件头不匹配、空文件、超限和SHA不一致。Chromium mock测试必须覆盖：页面有数据不崩溃；点击主播筛选；打开既有记录编辑；修改并保存后刷新与新会话仍保持；选择有效文件显示预检结果；无效文件不发送mutation；上传成功后列表/历史刷新；全程不连接生产数据库。
