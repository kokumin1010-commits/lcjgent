import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "../server/routers";

const makeContext = (user: any = null) => ({
  req: { headers: {} } as any,
  res: {} as any,
  user,
});

const anonymous = appRouter.createCaller(makeContext());
const admin = appRouter.createCaller(makeContext({
  id: 999999,
  name: "Static Regression Admin",
  email: "static-regression@example.invalid",
  role: "admin",
}));

type TestResult = {
  name: string;
  expectedCode: string;
  actualCode: string;
  passed: boolean;
  message: string;
};

const results: TestResult[] = [];

async function expectCode(name: string, expectedCode: string, operation: () => Promise<unknown>) {
  try {
    await operation();
    results.push({ name, expectedCode, actualCode: "NO_ERROR", passed: false, message: "Expected an error but the call succeeded" });
  } catch (error: any) {
    const actualCode = String(error?.code || error?.data?.code || "UNKNOWN");
    results.push({
      name,
      expectedCode,
      actualCode,
      passed: actualCode === expectedCode,
      message: String(error?.message || error),
    });
  }
}

const oneProduct = {
  productName: "安全な回帰試験（DB書込前に認証拒否）",
  directGmv: 0,
};

const csvRow = {
  livestream: "regression",
  startTime: "2026-02-30 10:00",
  duration: 60,
  grossRevenue: 0,
  directGmv: 0,
  itemsSold: 0,
  customers: 0,
  avgPrice: 0,
  ordersPaidFor: 0,
  gmvPer1kShows: "0",
  gmvPer1kViews: "0",
  views: 0,
  viewers: 0,
  peakViewers: 0,
  newFollowers: 0,
  avgViewDuration: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  productImpressions: 0,
  productClicks: 0,
  ctr: "0",
  ctor: "0",
};

await expectCode("anonymous_livestream_list", "UNAUTHORIZED", () =>
  anonymous.liverManagement.getLivestreams({ liverId: 1 })
);
await expectCode("anonymous_screenshot_upload", "UNAUTHORIZED", () =>
  anonymous.liverManagement.uploadScreenshot({ base64: "dGVzdA==", filename: "test.png", liverId: 1 })
);
await expectCode("anonymous_ai_rooms", "UNAUTHORIZED", () =>
  anonymous.liverManagement.aiCoach.getRooms({ liverId: 1 })
);
await expectCode("anonymous_ai_auto_question", "UNAUTHORIZED", () =>
  anonymous.liverManagement.aiCoach.generateAutoQuestion({ liverId: 1, livestreamId: 1 })
);
await expectCode("anonymous_product_csv_import", "UNAUTHORIZED", () =>
  anonymous.brandLivestream.importProductCsv({ livestreamId: 1, products: [oneProduct] })
);
await expectCode("anonymous_product_csv_history", "UNAUTHORIZED", () =>
  anonymous.brandLivestream.getImportHistory({ livestreamId: 1 })
);
await expectCode("anonymous_product_csv_history_delete", "UNAUTHORIZED", () =>
  anonymous.brandLivestream.deleteImportHistory({ historyId: 1 })
);
await expectCode("anonymous_monthly_products", "UNAUTHORIZED", () =>
  anonymous.liverManagement.getMonthlyProductsByLiverId({ liverId: 1, year: 2026, month: 8 })
);
await expectCode("anonymous_ai_master_stats", "UNAUTHORIZED", () =>
  anonymous.liverManagement.aiCoach.getAllLiverUsageStats()
);
await expectCode("screenshot_invalid_extension", "BAD_REQUEST", () =>
  admin.liverManagement.uploadScreenshot({ base64: "dGVzdA==", filename: "test.gif" })
);
await expectCode("screenshot_invalid_base64", "BAD_REQUEST", () =>
  admin.liverManagement.uploadScreenshot({ base64: "%%%not-base64%%%", filename: "test.png" })
);
await expectCode("screenshot_signature_mismatch", "BAD_REQUEST", () =>
  admin.liverManagement.uploadScreenshot({ base64: "dGVzdA==", filename: "test.png" })
);
await expectCode("product_csv_row_limit", "BAD_REQUEST", () =>
  admin.brandLivestream.importProductCsv({
    livestreamId: 1,
    products: Array.from({ length: 5001 }, () => oneProduct),
  })
);
await expectCode("ai_room_blank_title", "BAD_REQUEST", () =>
  admin.liverManagement.aiCoach.createRoom({ liverId: 1, title: "   " })
);
await expectCode("ai_message_length_limit", "BAD_REQUEST", () =>
  admin.liverManagement.aiCoach.sendMessage({ liverId: 1, message: "x".repeat(4001) })
);
await expectCode("csv_impossible_jst_date", "BAD_REQUEST", () =>
  admin.csvImport.importLivestreams({ brandId: 1, liverId: 1, csvData: [csvRow] })
);
await expectCode("monthly_product_month_limit", "BAD_REQUEST", () =>
  admin.liverManagement.getMonthlyProductsByLiverId({ liverId: 1, year: 2026, month: 13 })
);

const failed = results.filter((item) => !item.passed);
const report = {
  mode: "createCaller/no-browser/no-database-write",
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.map((item) => item.name),
  results,
};

const outputPath = resolve(process.cwd(), "liver_mypage_audit/runtime_no_db_regression.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length > 0) process.exit(1);
