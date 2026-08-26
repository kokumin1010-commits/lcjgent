#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
page = (ROOT / "client/src/pages/LiverMypage.tsx").read_text(encoding="utf-8")
routers = (ROOT / "server/routers.ts").read_text(encoding="utf-8")
liver_router = (ROOT / "server/liverRouter.ts").read_text(encoding="utf-8")
db = (ROOT / "server/db.ts").read_text(encoding="utf-8")
app = (ROOT / "client/src/App.tsx").read_text(encoding="utf-8")
index_html = (ROOT / "client/index.html").read_text(encoding="utf-8")
main = (ROOT / "client/src/main.tsx").read_text(encoding="utf-8")

ai_start = routers.index("    // ===== LCJ 神コーチ (AI Coach) =====")
ai_end = routers.index("    // Get brand duration stats for a liver", ai_start)
ai = routers[ai_start:ai_end]
product_csv_start = routers.index("    // 商品別CSVインポート")
product_csv_end = routers.index("    // Recalculate brand GMV", product_csv_start)
product_csv = routers[product_csv_start:product_csv_end]

checks = {
    "analytics_placeholder_removed": "%VITE_ANALYTICS_ENDPOINT%" not in index_html and "%VITE_ANALYTICS_WEBSITE_ID%" not in index_html,
    "analytics_conditionally_loaded": all(token in main for token in ["loadAnalyticsIfConfigured", "if (!endpoint || !websiteId) return", "analyticsUrl.protocol !== \"https:\"", "data-lcj-analytics"]),
    "payroll_panel_import_removed": "LiverPayrollBasisPanel" not in page,
    "payroll_panel_render_removed": "<LiverPayrollBasisPanel" not in page,
    "payroll_backend_retained": "payrollBasis:" in liver_router and "getLiverPayrollBasis" in liver_router,
    "payroll_recovery_retained": (ROOT / "server/liverPayrollRecovery.ts").exists(),
    "hardcoded_delete_password_removed": "deletePassword" not in page and "deletePasswordError" not in page and "deletePassword !== 'lcj'" not in page,
    "full_page_reload_removed": "window.location.reload()" not in page,
    "liver_token_helpers_exported": "export function getLiverToken" in liver_router and "export async function verifyLiverToken" in liver_router,
    "shared_auth_helper_present": "async function requireLiverOrAdmin" in routers and "async function requireLivestreamOwnerOrAdmin" in routers,
    "ai_room_auth_helper_present": "async function requireAiCoachRoomOwnerOrAdmin" in routers,
    "livestream_list_owned": re.search(r"getLivestreams: publicProcedure[\s\S]{0,400}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None,
    "livestream_detail_owned": re.search(r"getLivestreamDetail: publicProcedure[\s\S]{0,400}requireLivestreamOwnerOrAdmin\(ctx, input\.id\)", routers) is not None,
    "livestream_create_owned": re.search(r"createLivestream: publicProcedure[\s\S]{0,5000}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None,
    "livestream_update_owned": re.search(r"updateLivestream: publicProcedure[\s\S]{0,1500}requireLivestreamOwnerOrAdmin\(ctx, input\.id\)", routers) is not None,
    "livestream_delete_owned": re.search(r"deleteLivestream: publicProcedure[\s\S]{0,700}requireLivestreamOwnerOrAdmin\(ctx, input\.id\)", routers) is not None,
    "screenshot_upload_owned": re.search(r"uploadScreenshot: publicProcedure[\s\S]{0,900}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None,
    "screenshot_update_owned": re.search(r"updateLivestreamScreenshot: publicProcedure[\s\S]{0,700}requireLivestreamOwnerOrAdmin\(ctx, input\.livestreamId\)", routers) is not None,
    "screenshot_mime_limited": all(token in routers for token in ['jpg: "image/jpeg"', 'png: "image/png"', 'webp: "image/webp"']),
    "screenshot_signature_checked": all(token in routers for token in ["const isJpeg", "const isPng", "const isWebp", "画像の実体と拡張子が一致しません"]),
    "screenshot_size_limited": "8 * 1024 * 1024" in routers and "8 * 1024 * 1024" in page,
    "csv_import_owned": re.search(r"importLivestreams: publicProcedure[\s\S]{0,3000}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None,
    "csv_batch_limited": ")).min(1).max(5000)" in routers,
    "csv_jst_parser_fixed": "const parseTikTokJst" in routers and "Date.UTC(year, month - 1, day, hour - 9" in routers and "const parsedCsvData = input.csvData.map" in routers and "開始日時の形式が不正です" in routers,
    "csv_history_query_owned": re.search(r"getImportHistory: publicProcedure[\s\S]{0,400}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None,
    "csv_history_delete_owned": "getLivestreamCsvImportHistoryById" in routers and re.search(r"deleteImportHistory: publicProcedure[\s\S]{0,700}requireLiverOrAdmin\(ctx, Number\(history\.liverId\)\)", routers) is not None,
    "csv_history_lookup_exists": "export async function getLivestreamCsvImportHistoryById" in db,
    "featured_products_owned": all(re.search(rf"{name}: publicProcedure[\s\S]{{0,500}}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None for name in ["getForLiver", "getUnacknowledged", "acknowledge", "getPenalties", "getPenaltyCount"]),
    "mypage_route_kept": '/liver/mypage' in app,
    "liver_record_route_kept": '/liver/record' in app,
    "liver_schedule_route_kept": '/liver/schedule' in app,
    "liver_by_name_route_protected": re.search(r'<Route path=\{"/livers/by-name/:name"\}>[\s\S]{0,180}<ProtectedLiverRoute>[\s\S]{0,100}<LiverByName />', app) is not None,
    "monthly_products_owned": re.search(r"getMonthlyProductsByLiverId: publicProcedure[\s\S]{0,550}requireLiverOrAdmin\(ctx, input\.liverId\)", routers) is not None,
    "recovered_rows_read_only": "復元CSVの配信記録は読み取り専用です" in page,
    "local_refetch_after_import": "Promise.all([refetchLivestreams(), refetchImportHistory()])" in page,
    "ai_rooms_owned": re.search(r"getRooms: publicProcedure[\s\S]{0,350}requireLiverOrAdmin\(ctx, input\.liverId\)", ai) is not None,
    "ai_create_room_owned": re.search(r"createRoom: publicProcedure[\s\S]{0,450}requireLiverOrAdmin\(ctx, input\.liverId\)", ai) is not None,
    "ai_room_mutations_owned": all(re.search(rf"{name}: publicProcedure[\s\S]{{0,400}}requireAiCoachRoomOwnerOrAdmin\(ctx, input\.roomId", ai) is not None for name in ["updateRoomTitle", "deleteRoom"]),
    "ai_messages_owned": all(re.search(rf"{name}: publicProcedure[\s\S]{{0,850}}requireAiCoachRoomOwnerOrAdmin\(ctx, input\.roomId, input\.liverId\)", ai) is not None for name in ["getMessages", "sendMessage"]),
    "ai_message_and_title_limited": ".trim().min(1).max(4000)" in ai and ai.count(".trim().min(1).max(120)") >= 2,
    "ai_auto_question_owned": re.search(r"generateAutoQuestion: publicProcedure[\s\S]{0,650}requireLiverOrAdmin\(ctx, input\.liverId\)[\s\S]{0,300}requireLivestreamOwnerOrAdmin\(ctx, input\.livestreamId\)", ai) is not None,
    "ai_welcome_owned": re.search(r"getOrCreateWelcome: publicProcedure[\s\S]{0,550}requireAiCoachRoomOwnerOrAdmin\(ctx, input\.roomId, input\.liverId\)", ai) is not None,
    "ai_welcome_scoped_to_room": "input.roomId ? eq(aiCoachMessages.roomId, input.roomId) : isNull(aiCoachMessages.roomId)" in ai,
    "ai_master_endpoints_protected": all(re.search(rf"{name}: protectedProcedure", ai) is not None for name in [
        "getAllLiverUsageStats", "getLiverConversations", "getLiverGrowthData",
        "getRecentAutoMessages", "getMessageTypeCounts", "getDailySendStats",
        "getBrainStatus", "regenerateMasterKnowledge", "getLiverMemory", "triggerMemoryUpdate",
    ]),
    "product_csv_owned": re.search(r"importProductCsv: publicProcedure[\s\S]{0,1800}requireLivestreamOwnerOrAdmin\(ctx, input\.livestreamId\)", product_csv) is not None,
    "product_csv_batch_limited": ").min(1).max(5000)" in product_csv and "productName: z.string().trim().min(1).max(500)" in product_csv,
    "product_csv_file_limited": "fileBuffer.length > 8 * 1024 * 1024" in product_csv and "CSV、XLS、XLSXファイルのみ" in product_csv and "allowedMimes" in product_csv,
    "product_csv_storage_scoped": "csv-imports/livers/${ownerLiverId}/livestreams/${input.livestreamId}/" in product_csv,
    "product_csv_history_owned": re.search(r"getImportHistory: publicProcedure[\s\S]{0,350}requireLivestreamOwnerOrAdmin\(ctx, input\.livestreamId\)", product_csv) is not None,
    "product_csv_history_delete_owned": re.search(r"deleteImportHistory: publicProcedure[\s\S]{0,350}requireLiverOrAdmin\(ctx\)[\s\S]{0,250}getCsvImportHistoryById\(input\.historyId\)[\s\S]{0,400}requireLivestreamOwnerOrAdmin\(ctx, history\.livestreamId\)", product_csv) is not None,
    "product_csv_fileurl_parameterized": "updateCsvImportHistoryFileUrl(history.id, fileUrl)" in product_csv and "db.execute(sql`UPDATE csv_import_history SET fileUrl = ${fileUrl} WHERE id = ${historyId}`)" in db and "SET fileUrl = '${fileUrl}'" not in product_csv,
    "product_csv_history_helpers_exist": "export async function getCsvImportHistoryById" in db and "export async function updateCsvImportHistoryFileUrl" in db,
    "product_csv_atomic_replace": "await db.transaction(async (tx)" in db and "await tx.delete(livestreamProducts)" not in db and re.search(r"await tx\s*\.delete\(livestreamProducts\)[\s\S]{0,500}await tx\.insert\(livestreamProducts\)[\s\S]{0,500}await tx\s*\.update\(brandLivestreams\)", db) is not None,
}

failed = [name for name, ok in checks.items() if not ok]
result = {
    "checked": len(checks),
    "passed": len(checks) - len(failed),
    "failed": failed,
    "checks": checks,
}
(ROOT / "liver_mypage_full_static_integrity.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(result, ensure_ascii=False, indent=2))
if failed:
    raise SystemExit(1)
