import mysql, { type RowDataPacket } from "mysql2/promise";
import {
  buildStoreKpiSnapshot,
  currentJapanDate,
} from "./storeExecutionRouter";
import {
  monthDateRange,
  normalizeStoreDailyReportPayload,
} from "../shared/storeBusiness";
import {
  buildImportedStoreDailyRows,
  importedStoreDailyCoverage,
  resolveStorePeriodAdMetrics,
  summarizeImportedStoreDailyRows,
  type StoreDataUploadSnapshot,
} from "./storeImportedDailyTrend";
import { resolveStoreUploadData } from "./storeUploadReadModel";

let poolInstance: mysql.Pool | null = null;

function pool() {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    poolInstance = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return poolInstance;
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function reportStatusPriority(status: string) {
  return status === "confirmed"
    ? 4
    : status === "submitted"
      ? 3
      : status === "reopened"
        ? 2
        : status === "draft"
          ? 1
          : 0;
}

function latestReportStatus(master: any | undefined, legacy: any[]) {
  if (master) return "submitted";
  return legacy.reduce(
    (best, row) =>
      reportStatusPriority(String(row.status || "")) >
      reportStatusPriority(best)
        ? String(row.status)
        : best,
    "missing"
  );
}

export type StoreBusinessMetric = {
  value: number | null;
  status: "actual" | "missing";
  source: string;
  sourceLabel: string;
  updatedAt: string | null;
};

export type StoreBusinessOverview = Awaited<
  ReturnType<typeof getStoreBusinessOverview>
>;

export async function getStoreBusinessOverview(input: { month: string }) {
  const { start, end } = monthDateRange(input.month);
  const [periodYear, periodMonth] = input.month.split("-").map(Number);
  const today = currentJapanDate();
  const p = pool();
  const [
    storeRows,
    adRows,
    outreachRows,
    masterReportRows,
    legacyReportRows,
    workRows,
  ] = await Promise.all([
    p.query<RowDataPacket[]>(
      `SELECT ms.*,b.name AS brandName,b.nameJa AS brandNameJa
         FROM managed_stores ms
         LEFT JOIN brands b ON b.id=ms.brandId AND b.deletedAt IS NULL
        WHERE ms.isActive=1
        ORDER BY COALESCE(NULLIF(b.nameJa,''),b.name,ms.name),ms.name`
    ),
    p.query<RowDataPacket[]>(
      `SELECT brandId,storeId,
              COALESCE(SUM(actualSpend),0) AS adSpend,
              COALESCE(SUM(actualGmv),0) AS adAttributedGmv,
              MAX(updatedAt) AS updatedAt
         FROM ad_monthly_plans
        WHERE month=? AND planType='shop'
        GROUP BY brandId,storeId`,
      [input.month]
    ),
    p.query<RowDataPacket[]>(
      `SELECT campaign.brandId,campaign.storeId,
              COUNT(DISTINCT outreach.creatorId) AS creatorOutreach,
              COALESCE(SUM(outreach.contactCount),0) AS creatorContactCount,
              COUNT(DISTINCT CASE WHEN outreach.replyReceived=1 THEN outreach.creatorId END) AS creatorReplies,
              COUNT(DISTINCT CASE WHEN outreach.cooperationConfirmed=1 THEN outreach.creatorId END) AS creatorCollaborations,
              MAX(outreach.updatedAt) AS updatedAt
         FROM influencer_bd_outreach_logs outreach
         JOIN influencer_bd_campaigns campaign ON campaign.id=outreach.campaignId AND campaign.deletedAt IS NULL
        WHERE outreach.deletedAt IS NULL AND outreach.activityDate>=? AND outreach.activityDate<=?
        GROUP BY campaign.brandId,campaign.storeId`,
      [start, end]
    ),
    p.query<RowDataPacket[]>(
      `SELECT * FROM store_daily_master_reports WHERE reportDate=? AND deletedAt IS NULL`,
      [today]
    ),
    p.query<RowDataPacket[]>(
      `SELECT storeId,status,submitterName,createdByName,createdAt
         FROM store_operation_reports
        WHERE reportType='daily' AND periodStart=? AND isCurrent=1 AND deletedAt IS NULL`,
      [today]
    ),
    p.query<RowDataPacket[]>(
      `SELECT storeId,
              SUM(status='blocked') AS blockedCount,
              SUM(status IN ('todo','in_progress','blocked') AND dueDate<CURDATE()) AS overdueCount,
              SUM(status='done') AS doneCount
         FROM store_manager_work_items
        WHERE deletedAt IS NULL
        GROUP BY storeId`
    ),
  ]);

  const stores = storeRows[0] as any[];
  const adPlans = adRows[0] as any[];
  const outreach = outreachRows[0] as any[];
  const masterReports = masterReportRows[0] as any[];
  const legacyReports = legacyReportRows[0] as any[];
  const work = workRows[0] as any[];
  const snapshotRows = await Promise.all(
    stores.map(async store => {
      const [snapshot, uploadResult] = await Promise.all([
        buildStoreKpiSnapshot(Number(store.id), start, end),
        p.query<RowDataPacket[]>(
          `SELECT id,dataType,year,month,fileName,recordCount,versionNumber,isCurrent,uploadedAt,dataJson,fileSha256,originalFileKey
             FROM store_data_uploads
            WHERE storeId=? AND dataType='ads' AND year=? AND month=?
              AND isCurrent=1 AND deletedAt IS NULL
            ORDER BY versionNumber,id`,
          [Number(store.id), periodYear, periodMonth]
        ),
      ]);
      const importedUploads = await Promise.all(
        (uploadResult[0] as StoreDataUploadSnapshot[]).map(async upload => {
          const resolved = await resolveStoreUploadData(upload);
          return { ...upload, dataJson: resolved.data };
        })
      );
      const importedRows = buildImportedStoreDailyRows(
        importedUploads,
        start,
        end
      );
      return {
        store,
        snapshot,
        importedAdSummary: summarizeImportedStoreDailyRows(importedRows),
        importedAdCoverage: importedStoreDailyCoverage(importedRows).ads,
        importedAdUpdatedAt: importedUploads.at(-1)?.uploadedAt || null,
      };
    })
  );

  const storesByBrand = new Map<string, any[]>();
  for (const store of stores) {
    const key = store.brandId
      ? `brand:${Number(store.brandId)}`
      : `store:${Number(store.id)}`;
    const rows = storesByBrand.get(key) || [];
    rows.push(store);
    storesByBrand.set(key, rows);
  }

  const storeCards = snapshotRows.map(
    ({
      store,
      snapshot,
      importedAdSummary,
      importedAdCoverage,
      importedAdUpdatedAt,
    }) => {
    const brandStores = storesByBrand.get(
      store.brandId
        ? `brand:${Number(store.brandId)}`
        : `store:${Number(store.id)}`
    ) || [store];
    const storePlanRows = adPlans.filter(
      row => Number(row.storeId || 0) === Number(store.id)
    );
    const brandPlanRows = adPlans.filter(
      row =>
        !row.storeId && Number(row.brandId || 0) === Number(store.brandId || 0)
    );
    const selectedPlanRows = storePlanRows.length
      ? storePlanRows
      : brandStores.length === 1
        ? brandPlanRows
        : [];
    const periodAds = resolveStorePeriodAdMetrics({
      importedDayCount: Number(importedAdCoverage.count || 0),
      importedAdCost: importedAdSummary.adCost,
      importedAdGmv: importedAdSummary.adGmv,
      planRows: selectedPlanRows,
    });
    const adSpend = periodAds.adSpend;
    const adAttributedGmv = periodAds.adGmv;
    const adSource = periodAds.source;
    const adSourceLabel =
      adSource === "store_ads_upload"
        ? "期间广告数据合计"
        : adSource === "ad_monthly_plans"
          ? "广告月度实绩"
          : "未接入";
    const adUpdatedAt =
      adSource === "store_ads_upload"
        ? importedAdUpdatedAt
        : selectedPlanRows.at(-1)?.updatedAt || null;
    const storeOutreachRows = outreach.filter(
      row => Number(row.storeId || 0) === Number(store.id)
    );
    const brandOutreachRows = outreach.filter(
      row =>
        !row.storeId && Number(row.brandId || 0) === Number(store.brandId || 0)
    );
    const selectedOutreachRows = storeOutreachRows.length
      ? storeOutreachRows
      : brandStores.length === 1
        ? brandOutreachRows
        : [];
    const master = masterReports.find(
      row => Number(row.storeId) === Number(store.id)
    );
    const legacy = legacyReports.filter(
      row => Number(row.storeId) === Number(store.id)
    );
    const reportPayload = master
      ? normalizeStoreDailyReportPayload(parseJson(master.payloadJson, {}))
      : null;
    const task = work.find(row => Number(row.storeId) === Number(store.id));
    const shopEvidence = snapshot.evidence.filter(
      (item: any) =>
        item.dataType === "shop_stats" && Number(item.usedRows || 0) > 0
    );
    const storeGmv = shopEvidence.length
      ? number(snapshot.metrics.storeGmv)
      : null;
    const refundAmount = shopEvidence.length
      ? number(snapshot.metrics.refundAmount)
      : null;
    return {
      id: Number(store.id),
      brandId: store.brandId ? Number(store.brandId) : null,
      brandName: store.brandName || null,
      brandNameJa: store.brandNameJa || null,
      name: String(store.name),
      platform: String(store.platform || ""),
      country: String(store.country || ""),
      avatarUrl: store.avatarUrl || null,
      operatorId: store.operatorId ? Number(store.operatorId) : null,
      operatorName: store.operatorName || null,
      operator2Id: store.operator2Id ? Number(store.operator2Id) : null,
      operator2Name: store.operator2Name || null,
      metrics: {
        storeGmv: {
          value: storeGmv,
          status: storeGmv === null ? "missing" : "actual",
          source: shopEvidence.length ? "store_shop_upload" : "missing",
          sourceLabel: shopEvidence.length ? "店铺经营数据" : "未上传",
          updatedAt: shopEvidence.at(-1)?.uploadedAt || null,
        } as StoreBusinessMetric,
        refundAmount: {
          value: refundAmount,
          status: refundAmount === null ? "missing" : "actual",
          source: shopEvidence.length ? "store_shop_upload" : "missing",
          sourceLabel: shopEvidence.length ? "店铺经营数据" : "未上传",
          updatedAt: shopEvidence.at(-1)?.uploadedAt || null,
        } as StoreBusinessMetric,
        actualSales: {
          value:
            storeGmv === null || refundAmount === null
              ? null
              : Math.max(0, storeGmv - refundAmount),
          status:
            storeGmv === null || refundAmount === null ? "missing" : "actual",
          source: shopEvidence.length ? "calculated" : "missing",
          sourceLabel: shopEvidence.length ? "GMV－退款" : "未上传",
          updatedAt: shopEvidence.at(-1)?.uploadedAt || null,
        } as StoreBusinessMetric,
        adSpend: {
          value: adSpend,
          status: adSpend === null ? "missing" : "actual",
          source: adSource,
          sourceLabel: adSourceLabel,
          updatedAt: adUpdatedAt,
        } as StoreBusinessMetric,
        adAttributedGmv: {
          value: adAttributedGmv,
          status: adAttributedGmv === null ? "missing" : "actual",
          source: adSource,
          sourceLabel: adSourceLabel,
          updatedAt: adUpdatedAt,
        } as StoreBusinessMetric,
        adRoas: {
          value:
            adSpend && adAttributedGmv !== null
              ? adAttributedGmv / adSpend
              : null,
          status: adSpend && adAttributedGmv !== null ? "actual" : "missing",
          source: adSource,
          sourceLabel: adSpend ? "广告归因GMV÷广告消费" : "未接入",
          updatedAt: adUpdatedAt,
        } as StoreBusinessMetric,
        creatorOutreach: selectedOutreachRows.length
          ? selectedOutreachRows.reduce(
              (sum, row) => sum + number(row.creatorOutreach),
              0
            )
          : null,
        creatorContactCount: selectedOutreachRows.length
          ? selectedOutreachRows.reduce(
              (sum, row) => sum + number(row.creatorContactCount),
              0
            )
          : null,
        creatorReplies: selectedOutreachRows.length
          ? selectedOutreachRows.reduce(
              (sum, row) => sum + number(row.creatorReplies),
              0
            )
          : null,
        creatorCollaborations: selectedOutreachRows.length
          ? selectedOutreachRows.reduce(
              (sum, row) => sum + number(row.creatorCollaborations),
              0
            )
          : null,
      },
      todayReport: {
        status: latestReportStatus(master, legacy),
        updatedByName:
          master?.updatedByName ||
          master?.createdByName ||
          legacy[0]?.submitterName ||
          legacy[0]?.createdByName ||
          null,
        updatedAt: master?.updatedAt || legacy[0]?.createdAt || null,
        versionNumber: master ? number(master.versionNumber) : null,
        completedCount: reportPayload?.execution.completedItems.length || 0,
        hasRisk: Boolean(
          reportPayload?.execution.issuesRisks.trim() ||
            reportPayload?.supply.riskSkus.length
        ),
        tomorrowCount: reportPayload?.execution.tomorrowItems.length || 0,
        supportCount: reportPayload?.execution.supportItems.length || 0,
      },
      execution: {
        blockedCount: number(task?.blockedCount),
        overdueCount: number(task?.overdueCount),
        doneCount: number(task?.doneCount),
      },
    };
  });

  const brandCards = Array.from(storesByBrand.entries()).map(
    ([key, brandStores]) => {
      const cards = storeCards.filter(card =>
        brandStores.some(store => Number(store.id) === card.id)
      );
      const brandId = brandStores[0]?.brandId
        ? Number(brandStores[0].brandId)
        : null;
      const hasAnyStoreAdUpload = cards.some(
        card => card.metrics.adSpend.source === "store_ads_upload"
      );
      const unallocatedBrandPlans = brandId
        ? adPlans.filter(
            row => !row.storeId && Number(row.brandId || 0) === brandId
          )
        : [];
      const cardAdSpend = cards.reduce(
        (sum, card) => sum + (card.metrics.adSpend.value || 0),
        0
      );
      const cardAdGmv = cards.reduce(
        (sum, card) => sum + (card.metrics.adAttributedGmv.value || 0),
        0
      );
      const brandPlanSpend = unallocatedBrandPlans.reduce(
        (sum, row) => sum + number(row.adSpend),
        0
      );
      const brandPlanGmv = unallocatedBrandPlans.reduce(
        (sum, row) => sum + number(row.adAttributedGmv),
        0
      );
      const adSpend = hasAnyStoreAdUpload
        ? cardAdSpend
        : Math.max(cardAdSpend, brandPlanSpend);
      const adAttributedGmv = hasAnyStoreAdUpload
        ? cardAdGmv
        : Math.max(cardAdGmv, brandPlanGmv);
      const brandOutreach = brandId
        ? outreach.filter(row => Number(row.brandId || 0) === brandId)
        : [];
      const reportStatuses = cards.map(card => card.todayReport.status);
      const todayReportStatus = reportStatuses.every(
        status => status === "confirmed"
      )
        ? "confirmed"
        : reportStatuses.some(
              status => status === "submitted" || status === "confirmed"
            )
          ? "submitted"
          : reportStatuses.some(
                status => status === "draft" || status === "reopened"
              )
            ? "draft"
            : "missing";
      return {
        key,
        brandId,
        name:
          brandStores[0]?.brandNameJa ||
          brandStores[0]?.brandName ||
          brandStores[0]?.name ||
          "未命名品牌",
        isLinkedBrand: Boolean(brandId),
        stores: cards,
        metrics: {
          storeGmv: cards.some(card => card.metrics.storeGmv.value !== null)
            ? cards.reduce(
                (sum, card) => sum + (card.metrics.storeGmv.value || 0),
                0
              )
            : null,
          actualSales: cards.some(
            card => card.metrics.actualSales.value !== null
          )
            ? cards.reduce(
                (sum, card) => sum + (card.metrics.actualSales.value || 0),
                0
              )
            : null,
          refundAmount: cards.some(
            card => card.metrics.refundAmount.value !== null
          )
            ? cards.reduce(
                (sum, card) => sum + (card.metrics.refundAmount.value || 0),
                0
              )
            : null,
          adSpend:
            hasAnyStoreAdUpload ||
            adPlans.some(row => Number(row.brandId || 0) === brandId)
              ? adSpend
              : null,
          adAttributedGmv:
            hasAnyStoreAdUpload ||
            adPlans.some(row => Number(row.brandId || 0) === brandId)
              ? adAttributedGmv
              : null,
          adRoas: adSpend > 0 ? adAttributedGmv / adSpend : null,
          creatorOutreach: brandOutreach.length
            ? brandOutreach.reduce(
                (sum, row) => sum + number(row.creatorOutreach),
                0
              )
            : null,
          creatorContactCount: brandOutreach.length
            ? brandOutreach.reduce(
                (sum, row) => sum + number(row.creatorContactCount),
                0
              )
            : null,
          creatorReplies: brandOutreach.length
            ? brandOutreach.reduce(
                (sum, row) => sum + number(row.creatorReplies),
                0
              )
            : null,
          creatorCollaborations: brandOutreach.length
            ? brandOutreach.reduce(
                (sum, row) => sum + number(row.creatorCollaborations),
                0
              )
            : null,
        },
        todayReportStatus,
        reportSummary: {
          submittedStores: cards.filter(card =>
            ["submitted", "confirmed"].includes(card.todayReport.status)
          ).length,
          missingStores: cards.filter(
            card => card.todayReport.status === "missing"
          ).length,
          completedCount: cards.reduce(
            (sum, card) => sum + card.todayReport.completedCount,
            0
          ),
          riskCount: cards.filter(card => card.todayReport.hasRisk).length,
          tomorrowCount: cards.reduce(
            (sum, card) => sum + card.todayReport.tomorrowCount,
            0
          ),
          supportCount: cards.reduce(
            (sum, card) => sum + card.todayReport.supportCount,
            0
          ),
        },
        execution: {
          blockedCount: cards.reduce(
            (sum, card) => sum + card.execution.blockedCount,
            0
          ),
          overdueCount: cards.reduce(
            (sum, card) => sum + card.execution.overdueCount,
            0
          ),
        },
      };
    }
  );

  const totals = {
    storeGmv: brandCards.some(card => card.metrics.storeGmv !== null)
      ? brandCards.reduce((sum, card) => sum + (card.metrics.storeGmv || 0), 0)
      : null,
    actualSales: brandCards.some(card => card.metrics.actualSales !== null)
      ? brandCards.reduce(
          (sum, card) => sum + (card.metrics.actualSales || 0),
          0
        )
      : null,
    refundAmount: brandCards.some(card => card.metrics.refundAmount !== null)
      ? brandCards.reduce(
          (sum, card) => sum + (card.metrics.refundAmount || 0),
          0
        )
      : null,
    adSpend: brandCards.some(card => card.metrics.adSpend !== null)
      ? brandCards.reduce((sum, card) => sum + (card.metrics.adSpend || 0), 0)
      : null,
    adAttributedGmv: brandCards.some(
      card => card.metrics.adAttributedGmv !== null
    )
      ? brandCards.reduce(
          (sum, card) => sum + (card.metrics.adAttributedGmv || 0),
          0
        )
      : null,
    creatorOutreach: brandCards.some(
      card => card.metrics.creatorOutreach !== null
    )
      ? brandCards.reduce(
          (sum, card) => sum + (card.metrics.creatorOutreach || 0),
          0
        )
      : null,
    blockedCount: brandCards.reduce(
      (sum, card) => sum + card.execution.blockedCount,
      0
    ),
    overdueCount: brandCards.reduce(
      (sum, card) => sum + card.execution.overdueCount,
      0
    ),
  };

  return {
    period: { month: input.month, start, end },
    today,
    totals: {
      ...totals,
      adRoas:
        totals.adSpend && totals.adAttributedGmv !== null
          ? totals.adAttributedGmv / totals.adSpend
          : null,
    },
    brands: brandCards,
    stores: storeCards,
  };
}
