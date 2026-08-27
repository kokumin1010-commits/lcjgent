#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')

router = read('server/accountRouter.ts')
parser = read('server/accountWorkbookImport.ts')
crypto = read('server/accountCredentialCrypto.ts')
schema = read('drizzle/schema_accounts.ts')
migration = read('server/migrations/upgradeAccountManagementForWorkbookImport.ts')
server_index = read('server/_core/index.ts')
page = read('client/src/pages/AccountManagement.tsx')
preview = json.loads(read('account_workbook_parser_preview.json'))

checks: list[tuple[str, bool]] = []
def check(name: str, condition: bool):
    checks.append((name, bool(condition)))

check('source_sha256', preview.get('fileSha256') == '78c837ae232f76fee8061257906b86af3a36afb19a586f3311065c2bfacecb18')
check('classification_22_accounts', preview.get('counts', {}).get('accounts') == 22)
check('classification_4_contacts', preview.get('counts', {}).get('contacts') == 4)
check('classification_4_references', preview.get('counts', {}).get('references') == 4)
check('classification_11_excluded', preview.get('counts', {}).get('excluded') == 11)
check('lcj_inquiry_rows_merged', any(a.get('sourceRows') == [12, 44] for a in preview.get('accounts', [])))
check('wps_rows_merged', any(a.get('sourceRows') == [4, 8] for a in preview.get('accounts', [])))
check('labo_shop_and_email_separate', {'LABO CELLE TikTok Shop', 'LABO CELLE Email'}.issubset({a.get('accountName') for a in preview.get('accounts', [])}))
check('system_login_not_credential', not any(18 in a.get('sourceRows', []) for a in preview.get('accounts', [])))
check('system_login_reference', any(18 in r.get('sourceRows', []) for r in preview.get('references', [])))

check('xlsx_signature_and_size', 'ACCOUNT_WORKBOOK_MAX_BYTES' in parser and 'buffer[0] === 0x50 && buffer[1] === 0x4b' in parser)
check('formula_urls_parsed', 'HYPERLINK_FORMULA' in parser and 'formula.match(HYPERLINK_FORMULA)' in parser)
check('stable_account_key_excludes_url', 'stableKey("account", platform, accountValue)' in parser)
check('credential_conflict_detection', '同一資格情報に異なるパスワード' in parser)
check('safe_preview_masks_identifier', 'identifierMasked: account.email' in parser and '? `***${account.phone.replace' in parser and 'hasPassword: Boolean(account.password)' in parser)
check('safe_preview_excludes_password', 'password: account.password' not in parser.split('export function safeAccountWorkbookPreview', 1)[1])
check('credential_fragments_scrubbed', 'scrubCredentialFragments' in parser and 'credentialSecrets' in parser and 'REDACTED_CREDENTIAL' in parser)
check('all_non_secret_outputs_scrubbed', all(token in parser for token in ['accountName: !sanitizedName', 'responsible: scrubCredentialFragments', 'companyName: scrubCredentialFragments', 'name: scrubCredentialFragments(reference.name', 'label: scrubCredentialFragments']))

check('aes_256_gcm', 'aes-256-gcm' in crypto and 'enc:v1:' in crypto)
check('authenticated_envelope', 'getAuthTag' in crypto and 'setAuthTag' in crypto)
check('purpose_separated_key', 'lcj-account-credentials:v1:' in crypto)
check('router_encrypts_create', 'password: encryptAccountSecret(input.password)' in router)
check('router_encrypts_import', 'password: encryptAccountSecret(account.password)' in router)
check('router_decrypts_only_presenter', 'decryptAccountSecret(account.password)' in router)
check('no_plain_create_password', 'password: input.password,' not in router)

check('server_rbac_helper', 'requireAccountPermission' in router and 'role_permissions' in router and 'canEdit' in router)
check('all_account_routes_protected', 'publicProcedure' not in router)
check('preview_requires_edit', 'previewWorkbook: protectedProcedure' in router and 'requireAccountPermission(ctx, "edit")' in router)
check('import_requires_edit', 'importWorkbook: protectedProcedure' in router)
check('repair_existing_requires_same_edit_permission', 'repairExisting: z.boolean().optional().default(false)' in router and 'requireAccountPermission(ctx, "edit")' in router)
check('normal_import_remains_idempotent', 'existingRun?.status === "success" && !input.repairExisting' in router)
check('preview_sha_confirmation', 'confirmSha256' in router and 'parsed.fileSha256 !== input.confirmSha256' in router)
check('import_transaction', 'await db.transaction(async transaction =>' in router)
check('pre_import_backup', 'pre-account-workbook-import' in router)
check('post_import_backup', 'post-account-workbook-import' in router)
check('manual_conflict_detection', '既存の手入力資格情報と競合します' in router and '既存の手入力連絡先と競合します' in router)
check('recovery_archive_excluded', 'RECOVERY_PROJECTION_MARKER' in router and 'credentialRecordCondition' in router)

check('account_source_key_unique', 'unique_platform_accounts_source_key' in schema and 'unique_platform_accounts_source_key' in migration)
check('contact_source_key_unique', 'unique_contact_info_source_key' in schema and 'unique_contact_info_source_key' in migration)
check('reference_table_separate', 'accountReferenceLinks' in schema and 'CREATE TABLE IF NOT EXISTS account_reference_links' in migration)
check('import_audit_table', 'accountWorkbookImports' in schema and 'CREATE TABLE IF NOT EXISTS account_workbook_imports' in migration)
check('migration_idempotent', 'hasColumn' in migration and 'hasIndex' in migration and 'ER_DUP_FIELDNAME' in migration and 'ER_DUP_KEYNAME' in migration)
check('migration_registered', 'upgradeAccountManagementForWorkbookImport' in server_index)

check('page_permission_gate', 'PermissionGate pageKey="/master/account-management"' in page)
check('page_import_dialog', 'WorkbookImportDialog' in page and 'previewWorkbook.useMutation' in page and 'importWorkbook.useMutation' in page)
check('page_xlsx_limits', 'nextFile.size > 5 * 1024 * 1024' in page and '/\\.xlsx$/i.test(nextFile.name)' in page)
check('page_preview_masks_password', 'account.hasPassword ? "••••••••"' in page)
check('page_reference_tab', 'ReferencesTab' in page and 'listReferences.useQuery' in page)
check('page_encryption_badge', 'passwordEncryptedAtRest' in page and 'ShieldCheck' in page)
check('workbook_not_embedded', 'pasted_file_06GgiQ_LCJ経営管理表_经营用账户.xlsx' not in router + parser + page + migration + schema)

failed = [name for name, ok in checks if not ok]
report = {
    'checked': len(checks),
    'passed': len(checks) - len(failed),
    'failed': failed,
    'productionWrites': 0,
    'checks': [{'name': name, 'passed': ok} for name, ok in checks],
}
(ROOT / 'account_workbook_import_static_verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if failed else 0)
