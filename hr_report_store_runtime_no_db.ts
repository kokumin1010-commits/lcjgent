import { writeFileSync } from "node:fs";

process.env.JWT_SECRET ||= "hr-report-store-runtime-regression-2026";
const { appRouter } = await import("./server/routers");

type Result = { name: string; passed: boolean; actual: string };
const results: Result[] = [];
async function expectCode(name: string, expected: string, operation: () => Promise<unknown>) {
  try {
    await operation();
    results.push({ name, passed: false, actual: "SUCCEEDED" });
  } catch (error: any) {
    const actual = String(error?.code || error?.data?.code || "UNKNOWN");
    results.push({ name, passed: actual === expected, actual });
  }
}

const anonymous = appRouter.createCaller({ req: { headers: {} } as any, res: {} as any, user: null });
const normalUser = appRouter.createCaller({
  req: { headers: {} } as any,
  res: {} as any,
  user: { id: 99, email: "user@example.invalid", name: "Regression User", role: "user" } as any,
});
const adminUser = appRouter.createCaller({
  req: { headers: {} } as any,
  res: {} as any,
  user: { id: 1, email: "admin@example.invalid", name: "Regression Admin", role: "admin" } as any,
});

await expectCode("anonymous_staff_create", "UNAUTHORIZED", () => anonymous.staff.create({ name: "x", email: "x@example.invalid" }));
await expectCode("anonymous_staff_update", "UNAUTHORIZED", () => anonymous.staff.update({ id: 1, name: "x" }));
await expectCode("anonymous_report_staff_create", "UNAUTHORIZED", () => anonymous.reportStaff.create({ name: "x", country: "日本" }));
await expectCode("anonymous_report_staff_update", "UNAUTHORIZED", () => anonymous.reportStaff.update({ id: 1, name: "x" }));
await expectCode("anonymous_store_update", "UNAUTHORIZED", () => anonymous.storeManagement.update({ id: 1, operatorName: "x" }));
await expectCode("anonymous_recovery_preview", "UNAUTHORIZED", () => anonymous.staff.manualLossRecoveryPreview());
await expectCode("anonymous_recovery_execute", "UNAUTHORIZED", () => anonymous.staff.manualLossRecoveryExecute({ confirmation: "LCJ_MANUAL_DATA_LOSS_RECOVERY_V1" as any }));
await expectCode("non_admin_recovery_preview", "FORBIDDEN", () => normalUser.staff.manualLossRecoveryPreview());
await expectCode("non_admin_recovery_execute", "FORBIDDEN", () => normalUser.staff.manualLossRecoveryExecute({ confirmation: "RECOVER_MANUAL_HR_REPORT_STORE_2026_08_27" }));
await expectCode("admin_wrong_confirmation", "BAD_REQUEST", () => adminUser.staff.manualLossRecoveryExecute({ confirmation: "wrong" as any }));

const failed = results.filter((result) => !result.passed);
const report = {
  mode: "createCaller/no-database-write",
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.map((result) => result.name),
  productionWrites: 0,
  results,
};
writeFileSync("hr_report_store_runtime_no_db.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exit(1);
