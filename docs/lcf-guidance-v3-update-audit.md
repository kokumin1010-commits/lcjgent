# LCF Guidance v3 更新审计

## 权威来源与范围

本次网页更新以用户提供的《LCF2026ライバー向けガイダンス v3》为最新内容来源。公开地址、页面名称、现有黑金视觉、八章节导航、主页入口、マイページ和LIVE配信ブース预约链接均保持不变；本次不新增数据库、接口、依赖或环境变量。

## 相对现有网页的主要更新

| 区域 | v3权威内容 | 网页处理 |
|---|---|---|
| DAY2全体日程 | 11:30〜17:30ステージ、17:30〜18:00自由时间与交流、18:00结束及完全撤收 | 替换旧11:00〜17:00日程 |
| DAY2节目 | 八个环节，包含TikTok Shop成功幕后对谈、平台最前线、AI動画制作、TOPコマーサー对谈等 | 逐项使用v3时间、标题、主题和出演者 |
| 摄影与SNS | DAY1特別配信番組禁止；DAY2ステージコンテンツ允许摄影与SNS投稿 | 同步修正首屏提示、配信规则和来场注意事项，删除“DAY2也禁止”的旧文案 |
| GMV提交 | 截图并计算对象商品GMV，以文本提交 | 删除v3未指定的“公式LINEへ提出”文案 |
| 会场配置 | 5F、6Fブース配置均有新版图面 | 替换为v3原图；同时明确T1〜T4仍不是LIVE配信预约对象 |
| 其他会场资料 | 会场图面、会场イメージ和交通图内容与旧版一致，但v3分辨率更高 | 升级为v3高分辨率原图 |

## v3视觉资产

| 网页资产 | v3生产URL |
|---|---|
| 5F会场図面 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/GkAKXWBDKXMhckZQ.jpg |
| 6F会场図面 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/jxoJVDHRMhRenfFV.jpg |
| 5F会场イメージ | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DvKCGFATZVSoclFp.jpg |
| 6F会场イメージ | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/YYQvIKQzWXpxgwOg.jpg |
| 5Fブース配置図 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/hEODvMuHSCeAggGr.jpg |
| 6Fブース配置図 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/AYaZLmXukFQiHVUI.jpg |
| 八芳園交通图 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/PwePwPmAwZRcGesu.jpg |

六张GMV操作截图与v3视觉内容一致，继续使用现有生产资产，避免无意义替换。

## 既有业务保护

v3图面中出现T1〜T4不代表恢复预约资格。网页继续明确T1〜T4不是LIVE配信专用设备、不可预约，实际预约系统仍只允许T13〜T24。v3中“ランキングへ反映”的纸面表述不恢复已经永久删除的公开排行榜页面或API；网页继续以“運営側の集計結果に反映”表达提交后的运营处理。

## 本地预览检查

本地`/lcf/guidance`已加载更新后的黑金页面，首屏明确显示“DAY1番組は撮影・配信禁止”及“DAY2ステージは撮影・SNS投稿OK”。DAY2全体日程为11:00开场、11:30〜17:30ステージ、17:30〜18:00自由时间与交流、18:00完全撤收；节目表包含v3的八个环节、出演者和时间。

七张v3会场素材均已进入页面，5F/6F配置图链接指向新版原图，并在配置图下明确保留“T13〜T24可预约、T1〜T4预约对象外”的生产规则。GMV提出段落不再指定官方LINE，也没有恢复已下线的排行榜入口或API文案。

390×844手机视口检查确认：顶部マイページ与LIVE配信ブース予約按钮完整显示，八章节导航保持横向滚动，LCF Guidance标题、副标题、日期、会场和主办方信息均未遮挡或横向溢出；原有黑金首屏视觉保持不变。

本地运行时检查确认页面15张图片全部加载、失败0张，八个章节锚点全部存在，页面无横向溢出。DAY2新日程、TikTok Shop成功幕后对谈、AI動画制作、DAY2摄影与SNS投稿许可均已出现；旧11:00〜17:00日程、DAY2摄影禁止和公式LINE提交文案均不存在。浏览器控制台没有页面运行时错误。

## 生产验收

功能提交`e3a54a5`的GitHub CI成功，Railway提交状态为`Success - www.livecommercefestival.com`。正式`/lcf/guidance`已加载新版本，页面标题、黑金首屏、八章节导航和既有顶部操作入口保持正常。

生产全文确认DAY2 11:30〜17:30舞台与八个新环节、DAY1禁止和DAY2摄影/SNS投稿许可、v3高分辨率会场素材、T13〜T24预约边界及不指定官方LINE的GMV提交文字均已上线；旧11:00〜17:00节目与DAY2摄影禁止内容不存在。

生产运行时检查确认15张图片全部加载、失败0张，八个章节完整，页面无横向溢出；页面不存在旧DAY2时间、旧摄影禁止文案、官方LINE提交文字或排行榜链接。390×844生产手机截图确认顶部操作按钮、横向章节导航、LCF Guidance标题、日期、会场和主办方信息完整可读。浏览器控制台没有本次页面或素材错误，验收仅浏览公开页面，没有业务写入。
