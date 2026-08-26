#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIT = Path('/home/ubuntu/reaudit_correct_master_pages_and_tabs.json')
PRODUCTION = ROOT / 'production_full_mall_audit_current.json'
INVENTORY = ROOT / 'master_route_tab_inventory.json'
OUTPUT_JSON = ROOT / 'master_fix_manifest_2026-08-26.json'
OUTPUT_MD = ROOT / 'master_fix_manifest_2026-08-26.md'

with AUDIT.open(encoding='utf-8') as handle:
    audit = json.load(handle)
with PRODUCTION.open(encoding='utf-8') as handle:
    production = json.load(handle)
with INVENTORY.open(encoding='utf-8') as handle:
    inventory = json.load(handle)

all_tables = production['result']['data']['json']['allTableInventory']
production_counts = {
    row['tableName']: int(row['rowCount'])
    for row in all_tables['nonEmptyTables']
}
production_counts.update({name: 0 for name in all_tables['emptyTables']})

route_inventory = {row['route']: row for row in inventory['routes']}

def default_action(status: str) -> str:
    return {
        'A': 'verify_only',
        'B': 'repair_filter_or_mapping',
        'C': 'restore_direct_evidence',
        'D': 'explicit_empty_no_seed',
        'E': 'repair_structure_or_api',
        'F': 'correct_misclassification',
        'MIXED': 'repair_only_evidenced_tabs',
    }.get(status, 'manual_review')

# Human-verified overrides. These supersede model-only classifications.
overrides: dict[str, dict[str, object]] = {
    '/master/account-management': {
        'finalStatus': 'F',
        'action': 'archive_recovery_projections_stop_recreation_filter_credentials',
        'implementationPriority': 'P0',
        'evidence': [
            'platform_accounts=142 in Railway, but saved backup platform_accounts=0',
            'all 142 current rows were created by recovery_source projections',
            'accountRouter is registered at server/routers.ts:29113; route-disconnected audit claim is false',
            'startup recovery and six-hour Feishu sync can recreate the projections',
        ],
        'dataPolicy': 'Never move, overwrite, or delete manual platform accounts; only archive rows marked recovery_source=.',
    },
    '/master/festival': {
        'finalStatus': 'MIXED',
        'action': 'add_line_tab_navigation_only',
        'implementationPriority': 'P0',
        'evidence': [
            'LinePanel and line queries exist',
            'mainTabs omits line while checkin is already present',
            'festival application and ticket tables are non-empty',
        ],
        'dataPolicy': 'Do not duplicate festival applicants into platform credential records.',
    },
    '/master/staff/:staffId/tasks': {
        'action': 'query_task_staff_and_legacy_tasks_staff_id_without_fabrication',
        'implementationPriority': 'P1',
    },
    '/master/tasks/staff/:staffId': {
        'action': 'query_task_staff_and_legacy_tasks_staff_id_without_fabrication',
        'implementationPriority': 'P1',
    },
    '/master/sales-check': {
        'action': 'fallback_to_latest_real_month_and_label_source_period',
        'implementationPriority': 'P1',
    },
    '/master/brands/:id': {
        'action': 'fallback_to_latest_real_month_per_tab_preserve_true_empty_ad_tabs',
        'implementationPriority': 'P1',
    },
    '/master/livers-dashboard/:id': {
        'action': 'fallback_to_latest_real_month_for_performance_tabs',
        'implementationPriority': 'P1',
    },
    '/master/live-suggestions': {
        'action': 'fallback_to_nearest_latest_schedule_do_not_rewrite_dates',
        'implementationPriority': 'P1',
        'dataPolicy': 'Do not shift 2026 schedule facts back to 2024; display the stored source date explicitly.',
    },
    '/master/selection-center': {
        'action': 'fallback_schedules_and_procurement_to_latest_real_period_label_redirect_tabs',
        'implementationPriority': 'P1',
    },
    '/master/sample-requests': {
        'action': 'read_only_credit_fallback_from_brand_livestreams_when_credit_history_empty',
        'implementationPriority': 'P1',
        'dataPolicy': 'Do not persist derived credit rows unless the existing credit formula and identifiers prove the result.',
    },
    '/master/ad-form-submissions': {
        'action': 'fix_plan_enum_write_contract_no_seed',
        'implementationPriority': 'P1',
    },
    '/master/mega-channel': {
        'action': 'implement_missing_router_endpoints_against_existing_empty_tables_no_seed',
        'implementationPriority': 'P1',
    },
    '/master/system-users': {
        'finalStatus': 'MIXED',
        'action': 'verify_existing_rbac_and_improve_user_staff_mapping',
        'implementationPriority': 'P1',
        'evidence': [
            'current Railway system_roles=6',
            'current Railway role_permissions=151',
            'permission_requests and user_role_assignments exist but are empty',
        ],
        'dataPolicy': 'Do not restore duplicate RBAC rows; current production already contains the saved 6 roles and 151 permissions.',
    },
    '/master/issues': {
        'finalStatus': 'D',
        'action': 'verify_empty_schema_and_clear_empty_state_no_seed',
        'implementationPriority': 'P2',
        'evidence': ['issues, issue_comments, issue_knowledge exist in Railway and each has 0 rows'],
    },
    '/master/chat': {
        'finalStatus': 'D',
        'action': 'verify_empty_schema_and_clear_empty_state_no_seed',
        'implementationPriority': 'P2',
        'evidence': ['chat_rooms, chat_room_members, chat_messages exist in Railway and each has 0 rows'],
    },
    '/master/step-email': {
        'finalStatus': 'D',
        'action': 'verify_empty_schema_and_clear_empty_state_no_seed',
        'implementationPriority': 'P2',
        'evidence': ['step_email_templates, step_email_logs, step_email_clicks exist in Railway and each has 0 rows'],
    },
    '/master/step-email/analytics': {
        'finalStatus': 'D',
        'action': 'verify_empty_schema_and_clear_empty_state_no_seed',
        'implementationPriority': 'P2',
    },
    '/master/store-management': {
        'finalStatus': 'A',
        'action': 'verify_only_latest_period_fallback_already_present',
        'implementationPriority': 'P3',
    },
    '/master/featured-products': {
        'finalStatus': 'A',
        'action': 'verify_only_historical_set_fallback_available',
        'implementationPriority': 'P3',
    },
    '/master/finance': {
        'finalStatus': 'D',
        'action': 'explicit_empty_import_required_no_financial_fabrication',
        'implementationPriority': 'P3',
        'dataPolicy': 'Do not infer cashflow, orders, sales, invoices, or settlements from GMV or unrelated evidence.',
    },
}

rows = []
for result in audit['results']:
    output = result.get('output') or {}
    route = output.get('route')
    if not route:
        continue
    row = {
        'route': route,
        'component': output.get('component'),
        'tabs': route_inventory.get(route, {}).get('tabs', []),
        'auditStatus': output.get('overall_status'),
        'finalStatus': output.get('overall_status'),
        'auditPriority': output.get('priority'),
        'implementationPriority': output.get('priority'),
        'confidence': output.get('confidence'),
        'action': default_action(output.get('overall_status', '')),
        'rootCause': output.get('root_cause'),
        'requiredFix': output.get('required_fix'),
        'recoverableEvidence': output.get('recoverable_evidence'),
        'sensitiveBoundary': output.get('sensitive_boundary'),
        'evidence': [],
        'dataPolicy': 'Use direct evidence only; do not seed records when production and saved backup are empty.',
    }
    row.update(overrides.get(route, {}))
    rows.append(row)

priority_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}
rows.sort(key=lambda item: (priority_order.get(str(item['implementationPriority']), 9), item['route']))

manifest = {
    'generatedAt': '2026-08-26',
    'sourceAudit': str(AUDIT),
    'sourceProductionAudit': str(PRODUCTION),
    'routeCount': len(rows),
    'targetCount': inventory['masterTargetCount'],
    'uniqueTabCount': inventory['uniqueTabCount'],
    'productionBaseline': {
        'totalTables': all_tables['totalTables'],
        'nonEmptyTables': all_tables['nonEmptyTableCount'],
        'emptyTables': all_tables['emptyTableCount'],
        'totalRows': all_tables['totalRows'],
        'queryFailures': all_tables['queryFailedTableCount'],
        'criticalCounts': {
            name: production_counts.get(name)
            for name in [
                'platform_accounts', 'contact_info', 'system_roles', 'role_permissions',
                'permission_requests', 'chat_rooms', 'issues', 'step_email_templates',
                'tasks', 'task_staff', 'schedules', 'brand_livestreams',
            ]
        },
    },
    'policy': {
        'legacyTiDB': 'forbidden',
        'productionDatabase': 'Railway MySQL only',
        'unprovenRows': 'never create',
        'credentials': 'never expose in reports or logs',
    },
    'routes': rows,
}
serialized = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
OUTPUT_JSON.write_text(serialized, encoding='utf-8')
manifest_sha = hashlib.sha256(serialized.encode('utf-8')).hexdigest()

summary = {}
for row in rows:
    key = str(row['implementationPriority'])
    summary[key] = summary.get(key, 0) + 1

lines = [
    '# LCJ MALL Master修复清单（2026-08-26）',
    '',
    '本清单将83个真实`/master`路由、191个路由/选项卡目标与最新Railway MySQL全表审计合并。旧TiDB不在任何数据源或实施路径中。',
    '',
    '| 指标 | 数值 |',
    '|---|---:|',
    f"| 路由 | {len(rows)} |",
    f"| 路由/选项卡目标 | {inventory['masterTargetCount']} |",
    f"| 唯一选项卡 | {inventory['uniqueTabCount']} |",
    f"| Railway表 | {all_tables['totalTables']} |",
    f"| Railway行 | {all_tables['totalRows']} |",
    f"| 查询失败 | {all_tables['queryFailedTableCount']} |",
    '',
    '| 优先级 | 路由数 |',
    '|---|---:|',
]
for priority in ['P0', 'P1', 'P2', 'P3']:
    lines.append(f"| {priority} | {summary.get(priority, 0)} |")
lines += [
    '',
    '## 实施队列',
    '',
    '| 优先级 | 路由 | 最终分类 | 实施动作 |',
    '|---|---|---|---|',
]
for row in rows:
    lines.append(f"| {row['implementationPriority']} | `{row['route']}` | {row['finalStatus']} | `{row['action']}` |")
lines += [
    '',
    '## 不可伪造边界',
    '',
    '生产与保存备份均无业务行的页面只修复结构、API和空状态，不插入模拟数据。财务cashflow、订单、销售、工资、账号密码、广告计划、聊天、问题追踪和步骤邮件历史均不得从其他业务表推断。',
    '',
    f'JSON清单SHA-256：`{manifest_sha}`',
    '',
]
OUTPUT_MD.write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps({
    'routeCount': len(rows),
    'priorityCounts': summary,
    'json': str(OUTPUT_JSON),
    'markdown': str(OUTPUT_MD),
    'sha256': manifest_sha,
}, ensure_ascii=False, indent=2))
