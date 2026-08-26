# LCJ MALL Master修复清单（2026-08-26）

本清单将83个真实`/master`路由、191个路由/选项卡目标与最新Railway MySQL全表审计合并。旧TiDB不在任何数据源或实施路径中。

| 指标 | 数值 |
|---|---:|
| 路由 | 83 |
| 路由/选项卡目标 | 191 |
| 唯一选项卡 | 91 |
| Railway表 | 319 |
| Railway行 | 4254 |
| 查询失败 | 0 |

| 优先级 | 路由数 |
|---|---:|
| P0 | 2 |
| P1 | 22 |
| P2 | 15 |
| P3 | 44 |

## 实施队列

| 优先级 | 路由 | 最终分类 | 实施动作 |
|---|---|---|---|
| P0 | `/master/account-management` | F | `archive_recovery_projections_stop_recreation_filter_credentials` |
| P0 | `/master/festival` | MIXED | `add_line_tab_navigation_only` |
| P1 | `/master` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/ad-dashboard` | B | `repair_filter_or_mapping` |
| P1 | `/master/ad-form-submissions` | D | `fix_plan_enum_write_contract_no_seed` |
| P1 | `/master/ai-learning` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/brand-portal` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/brands/:id` | MIXED | `fallback_to_latest_real_month_per_tab_preserve_true_empty_ad_tabs` |
| P1 | `/master/business-cards/:id` | D | `explicit_empty_no_seed` |
| P1 | `/master/lcj-coin` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/live-suggestions` | B | `fallback_to_nearest_latest_schedule_do_not_rewrite_dates` |
| P1 | `/master/livers-dashboard` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/livers-dashboard/:id` | MIXED | `fallback_to_latest_real_month_for_performance_tabs` |
| P1 | `/master/mega-channel` | MIXED | `implement_missing_router_endpoints_against_existing_empty_tables_no_seed` |
| P1 | `/master/product-requests` | E | `repair_structure_or_api` |
| P1 | `/master/receipts` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/report-analysis` | MIXED | `repair_only_evidenced_tabs` |
| P1 | `/master/sales-check` | B | `fallback_to_latest_real_month_and_label_source_period` |
| P1 | `/master/sample-requests` | MIXED | `read_only_credit_fallback_from_brand_livestreams_when_credit_history_empty` |
| P1 | `/master/selection-center` | MIXED | `fallback_schedules_and_procurement_to_latest_real_period_label_redirect_tabs` |
| P1 | `/master/set-suggestions` | E | `repair_structure_or_api` |
| P1 | `/master/staff/:staffId/tasks` | B | `query_task_staff_and_legacy_tasks_staff_id_without_fabrication` |
| P1 | `/master/system-users` | MIXED | `verify_existing_rbac_and_improve_user_staff_mapping` |
| P1 | `/master/tasks/staff/:staffId` | B | `query_task_staff_and_legacy_tasks_staff_id_without_fabrication` |
| P2 | `/master/ai-coach` | MIXED | `repair_only_evidenced_tabs` |
| P2 | `/master/business-cards` | MIXED | `repair_only_evidenced_tabs` |
| P2 | `/master/chat` | D | `verify_empty_schema_and_clear_empty_state_no_seed` |
| P2 | `/master/email-thread/:email` | B | `repair_filter_or_mapping` |
| P2 | `/master/hr` | A | `verify_only` |
| P2 | `/master/issues` | D | `verify_empty_schema_and_clear_empty_state_no_seed` |
| P2 | `/master/lcj-brain` | MIXED | `repair_only_evidenced_tabs` |
| P2 | `/master/line` | MIXED | `repair_only_evidenced_tabs` |
| P2 | `/master/livers` | A | `verify_only` |
| P2 | `/master/point-requests` | MIXED | `repair_only_evidenced_tabs` |
| P2 | `/master/recruitment` | B | `repair_filter_or_mapping` |
| P2 | `/master/reports/chat` | D | `explicit_empty_no_seed` |
| P2 | `/master/schedule-groups` | D | `explicit_empty_no_seed` |
| P2 | `/master/step-email` | D | `verify_empty_schema_and_clear_empty_state_no_seed` |
| P2 | `/master/step-email/analytics` | D | `verify_empty_schema_and_clear_empty_state_no_seed` |
| P3 | `/master/ab-test` | D | `explicit_empty_no_seed` |
| P3 | `/master/agencies` | D | `explicit_empty_no_seed` |
| P3 | `/master/blog` | A | `verify_only` |
| P3 | `/master/blog/edit/:id` | A | `verify_only` |
| P3 | `/master/blog/new` | A | `verify_only` |
| P3 | `/master/brand-addition-logs` | D | `explicit_empty_no_seed` |
| P3 | `/master/brand-applications` | D | `explicit_empty_no_seed` |
| P3 | `/master/brands` | A | `verify_only` |
| P3 | `/master/brands/:id/edit` | A | `verify_only` |
| P3 | `/master/brands/:id/finance` | A | `verify_only` |
| P3 | `/master/brands/new` | A | `verify_only` |
| P3 | `/master/buyback` | D | `explicit_empty_no_seed` |
| P3 | `/master/featured-products` | A | `verify_only_historical_set_fallback_available` |
| P3 | `/master/finance` | D | `explicit_empty_import_required_no_financial_fabrication` |
| P3 | `/master/line/follow-ups` | E | `repair_structure_or_api` |
| P3 | `/master/line/pending` | E | `repair_structure_or_api` |
| P3 | `/master/livers/:id` | A | `verify_only` |
| P3 | `/master/livers/:id/record` | A | `verify_only` |
| P3 | `/master/livers/livestream/:id/edit` | A | `verify_only` |
| P3 | `/master/livestreams/:id` | A | `verify_only` |
| P3 | `/master/livestreams/:id/realtime` | D | `explicit_empty_no_seed` |
| P3 | `/master/mall` | A | `verify_only` |
| P3 | `/master/mall/member/:id` | A | `verify_only` |
| P3 | `/master/mall/print` | A | `verify_only` |
| P3 | `/master/morning-meeting` | A | `verify_only` |
| P3 | `/master/product-lab` | D | `explicit_empty_no_seed` |
| P3 | `/master/products` | E | `repair_structure_or_api` |
| P3 | `/master/receipt-analytics` | A | `verify_only` |
| P3 | `/master/referral` | A | `verify_only` |
| P3 | `/master/report-staff` | A | `verify_only` |
| P3 | `/master/reports` | A | `verify_only` |
| P3 | `/master/reports/edit/:id` | A | `verify_only` |
| P3 | `/master/reports/new` | A | `verify_only` |
| P3 | `/master/rundown` | A | `verify_only` |
| P3 | `/master/set-applications` | D | `explicit_empty_no_seed` |
| P3 | `/master/set-image-generator` | D | `explicit_empty_no_seed` |
| P3 | `/master/short-video` | D | `explicit_empty_no_seed` |
| P3 | `/master/simulator` | D | `explicit_empty_no_seed` |
| P3 | `/master/staff` | A | `verify_only` |
| P3 | `/master/step-email/logs` | D | `explicit_empty_no_seed` |
| P3 | `/master/store-management` | A | `verify_only_latest_period_fallback_already_present` |
| P3 | `/master/tasks` | A | `verify_only` |
| P3 | `/master/tasks/:id` | A | `verify_only` |
| P3 | `/master/tasks/create` | A | `verify_only` |

## 不可伪造边界

生产与保存备份均无业务行的页面只修复结构、API和空状态，不插入模拟数据。财务cashflow、订单、销售、工资、账号密码、广告计划、聊天、问题追踪和步骤邮件历史均不得从其他业务表推断。

JSON清单SHA-256：`4fd3227652cdee368a26b45afa1178c50791fd5b5e2bbaf11d507d6969cebd8c`
