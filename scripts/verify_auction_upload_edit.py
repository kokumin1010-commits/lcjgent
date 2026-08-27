from pathlib import Path

root = Path(__file__).resolve().parents[1]
client = (root / "client/src/pages/SelectionCenter.tsx").read_text(encoding="utf-8")
router = (root / "server/auctionRouter.ts").read_text(encoding="utf-8")
service = (root / "server/auctionImportService.ts").read_text(encoding="utf-8")
persistence = (root / "server/auctionRecordPersistence.ts").read_text(encoding="utf-8")
shared = (root / "shared/auctionRecordPersistence.ts").read_text(encoding="utf-8")
excel_parser = (root / "shared/auctionExcelParser.ts").read_text(encoding="utf-8")
auction_block = client.split("function AuctionTab()", 1)[1]

checks = {
    "date_split_regression_removed": "auctionDate?.split" not in client,
    "undefined_filtered_removed": "filtered = filtered.filter" not in auction_block,
    "liver_filter_dependency_present": "[listQuery.data, auctionSearch, filterLiver]" in client,
    "superjson_date_normalized": "normalizeAuctionDate(record?.auctionDate)" in client,
    "safe_rounds_rendering": "safeAuctionRounds(r.roundsJson)" in client,
    "manual_save_normalized": "canonicalAuctionRecordInput({" in client and "handleAuctionSave" in client,
    "chinese_name_editable": 'value={form.chineseName}' in client,
    "gmv_editable": 'value={form.totalGmv}' in client,
    "round_add_delete_ui": "+ 空轮次" in client and "删除 / 削除" in client,
    "all_product_skus_ui": "+ 全部SKU登记" in client and "productCatalogQuery" in client,
    "repeat_same_sku_ui": "同SKU再登记 / 同SKUを再登録" in client and "repeatAuctionSku" in client,
    "per_round_promotion_ui": "组合 / 促销" in client and "auction-promotion-types" in client,
    "sku_and_promotion_detail_columns": "<th className=\"px-2 py-1 text-left\">SKU</th>" in client and "round.promotionType" in client,
    "upload_preview": "importPreview.records.length" in client and "importPreview.uniqueSkuCount" in client and "importPreview.headerRowNumber" in client and "handleImportFileChange" in client,
    "invalid_file_blocks_upload": "!importPreview" in client,
    "server_fixed_schema": "manualAuctionRecordSchema" in router and "roundsJson" in router,
    "server_uses_transaction_layer": "createAuctionRecord(pool" in router and "updateAuctionRecord(pool" in router,
    "transaction_begin": "beginTransaction" in persistence,
    "transaction_row_lock": "FOR UPDATE" in persistence,
    "transaction_affected_rows": "result.affectedRows !== 1" in persistence,
    "transaction_rollback": "rollback" in persistence,
    "file_extension_mime_signature": "validateAuctionImportFile" in service and "oleSignature" in service and "isCsvText" in service,
    "server_reparses_original_workbook": "parseAuctionExcelRows(rows, fallbackDate)" in service and "XLSX.utils.sheet_to_json" in service,
    "client_records_not_trusted": "records: z.array" not in router and "sourceRowCount: z.number" not in router,
    "shifted_header_scan": "Math.min(rows.length, 30)" in excel_parser and "headerRowNumber" in excel_parser,
    "standard_position_fallback_guarded": "standard-position" in excel_parser and "looksLikeStandardDataRow" in excel_parser,
    "base64_hash_verified": "compactBase64" in service and "verifiedHash" in service,
    "private_storage_key": "private/auction-imports/" in service,
    "orphan_object_cleanup": "storageDelete" in service and "preserveUploadedFile" in service,
    "rounds_recalculate": "positivePrices" in shared and "data.auctionCount = rounds.length" in shared,
    "promotion_format_validated": "PROMOTION_PATTERN" in shared and "normalizeAuctionPromotionType" in shared,
    "legacy_promotion_inferred": "inferAuctionPromotionType" in shared and "source.bundleLabel" in shared,
    "protected_procedures_preserved": "create: protectedProcedure" in router and "update: protectedProcedure" in router and "importBatch: protectedProcedure" in router,
}

failed = [name for name, passed in checks.items() if not passed]
for name, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'} {name}")
if failed:
    raise SystemExit(f"auction upload/edit verification failed: {', '.join(failed)}")
print(f"auction upload/edit verification passed: {len(checks)}/{len(checks)}")
