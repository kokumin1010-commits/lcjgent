#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

checks: list[tuple[str, bool]] = []
def check(name: str, condition: bool) -> None:
    checks.append((name, bool(condition)))

access = read("server/financeAccess.ts")
router = read("server/financeAccessRouter.ts")
trpc = read("server/_core/trpc.ts")
auth = read("server/auth.ts")
cashflow = read("server/cashflowRouter.ts")
invoice = read("server/invoiceRouter.ts")
routers = read("server/routers.ts")
db = read("server/db.ts")
page = read("client/src/pages/FinanceManagement.tsx")
payroll = read("server/payrollAccess.ts")
payroll_test = read("server/payrollAccess.test.ts")
cashflow_page = read("client/src/pages/CashflowTab.tsx")

check("bcrypt digest only", "bcrypt.compare(password, hash)" in access and "INITIAL_FINANCE_PASSWORD_HASH" in access)
check("environment hash override", "process.env.FINANCE_ACCESS_PASSWORD_HASH" in access)
check("eight hour ttl", "8 * 60 * 60" in access)
check("http only signed cookie", "new SignJWT" in access and "ctx.res.cookie" in access and "getSessionCookieOptions" in access)
check("cookie bound to user", 'payload.scope === "finance"' in access and "payload.userId" in access and "ctx.user.id" in access)
check("tamper rejected", "jwtVerify" in access and "catch" in access)
check("five attempt rate limit", "MAX_FAILURES = 5" in access and "BLOCK_MS = 15 * 60 * 1000" in access)
check("status unlock lock router", all(token in router for token in ["status:", "unlock:", "lock:", "verifyAndUnlockFinance", "lockFinanceAccess"]))
check("password never logged", "console." not in router and "metadata: { password" not in router and "actionLabel: password" not in router)
check("finance procedures exported", all(token in trpc for token in ["financeProcedure", "financeAdminProcedure", "brandScopedFinanceProcedure", "financePayrollProcedure", "financePayrollAdminProcedure"]))
check("brand scope protects zero", "brandId <= 0" in trpc and "hasFinanceAccess(ctx)" in trpc)
check("logout clears finance cookie", "clearCookie(FINANCE_ACCESS_COOKIE" in auth)
check("invoice fully guarded", "protectedProcedure" not in invoice and invoice.count("financeProcedure") >= 14)
check("cashflow fully guarded", "protectedProcedure" not in cashflow and cashflow.count("financeProcedure") >= 27)
check("payroll remains double guarded", cashflow.count("financePayrollProcedure") >= 4 and cashflow.count("financePayrollAdminProcedure") >= 4)
check("tiktok shared brand queries conditional", routers.count("brandScopedFinanceProcedure") >= 11)
tiktok_block = routers.split("// ===== TikTok Commission Finance Router =====", 1)[1].split("liverPayroll: router({", 1)[0]
check("tiktok master endpoints guarded", tiktok_block.count(": financeProcedure") == 38)
check("delete import checks stored brand", "getTiktokCsvImportHistoryById(input.importId)" in routers and "requireFinanceAccess(ctx)" in routers)
check("import id lookup exists", "export async function getTiktokCsvImportHistoryById" in db)
check("access router registered", "financeAccess: financeAccessRouter" in routers)
check("parent gate queries only status", "trpc.financeAccess.status.useQuery" in page)
check("content mounted only after unlock", "accessQuery.data?.unlocked !== true" in page and "return <FinanceManagementContent" in page)
check("password input protected", 'type="password"' in page and 'autoComplete="current-password"' in page)
check("lock clears finance caches", all(token in page for token in ["trpcUtils.cashflow.reset()", "trpcUtils.invoice.reset()", "trpcUtils.tiktokFinance.reset()", "重新锁定"]))
check("password not persisted client side", "localStorage" not in page and "sessionStorage" not in page)
check("finance password verifier shared", "export async function verifyFinanceAccessPassword" in access and "verifyFinanceAccessPassword(password)" in payroll)
check("old payroll digest removed", "PAYROLL_ACCESS_PASSWORD_HASH" not in payroll and "INITIAL_PASSWORD_HASH" not in payroll)
check("payroll test uses finance digest", "FINANCE_ACCESS_PASSWORD_HASH" in payroll_test and "PAYROLL_ACCESS_PASSWORD_HASH" not in payroll_test)
check("payroll dialog names finance password", all(token in cashflow_page for token in ["工资明细二次确认", "请输入与财务管理相同的密码后进入", 'aria-label="财务管理密码"', "解锁并进入"]))
check("payroll rejection names finance password", "财务管理密码不正确" in payroll and "请使用财务管理密码解锁工资明细" in trpc)

changed = subprocess.check_output(["git", "diff", "--name-only", "HEAD"], cwd=ROOT, text=True).splitlines()
allowed = {
    "WORK_LOG.md",
    "client/src/pages/FinanceManagement.tsx",
    "client/src/pages/CashflowTab.tsx",
    "finance_access_spec.md",
    "payroll_finance_password_unification_spec.md",
    "server/_core/trpc.ts",
    "server/auth.ts",
    "server/cashflowRouter.ts",
    "server/db.ts",
    "server/financeAccess.test.ts",
    "server/payrollAccess.test.ts",
    "server/payrollAccess.ts",
    "server/financeAccess.ts",
    "server/financeAccessRouter.ts",
    "server/invoiceRouter.ts",
    "server/routers.ts",
    "scripts/verify_finance_access_gate.py",
    "finance_access_visual_regression.py",
    "finance_access_visual_regression.json",
    "finance_access_visual_review.md",
    "payroll_finance_password_visual.py",
    "payroll_finance_password_visual.json",
    "payroll_finance_password_visual_review.md",
}
check("other modules unchanged", set(changed).issubset(allowed))

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")
print(f"{len(checks) - len(failed)}/{len(checks)} checks passed")
if failed:
    raise SystemExit("failed: " + ", ".join(failed))
