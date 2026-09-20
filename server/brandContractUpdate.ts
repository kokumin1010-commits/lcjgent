import { z } from "zod";

export const brandContractUpdateInputSchema = z.object({
  id: z.number(),
  serviceType: z.enum([
    "TSP",
    "ライブコマース",
    "広告運用代行",
    "SNS運用代行",
    "その他",
    "単発ライブ契約",
    "期間契約",
    "運用代行型（TSP）",
    "パッケージ／複合契約",
  ]).optional(),
  contractType: z.enum(["月額契約", "年間契約", "単発契約", "広告案件", "その他"]).optional(),
  fixedFee: z.number().nullable().optional(),
  commissionRate: z.string().nullable().optional(),
  startDate: z.union([z.date(), z.string()]).nullable().optional(),
  endDate: z.union([z.date(), z.string()]).nullable().optional(),
  status: z.enum(["契約中", "完了", "保留", "終了"]).optional(),
  memo: z.string().nullable().optional(),
  plannedLivestreamCount: z.number().nullable().optional(),
  tspContractId: z.number().nullable().optional(),
  currency: z.string().optional(),
  kgLiveCondition: z.string().nullable().optional(),
  liverLiveCondition: z.string().nullable().optional(),
  shortVideoCondition: z.string().nullable().optional(),
  kgLiveHoursQuota: z.number().nullable().optional(),
  liverLiveHoursQuota: z.number().nullable().optional(),
  shortVideoCountQuota: z.number().nullable().optional(),
  kgLiveFrequency: z.number().nullable().optional(),
  kgLiveMinutesPerSession: z.number().nullable().optional(),
  liverLiveAssignments: z.array(z.object({ liverName: z.string(), minutesPerMonth: z.number() })).nullable().optional(),
  shortVideoAssignments: z.array(z.object({ liverName: z.string(), countPerMonth: z.number() })).nullable().optional(),
  contractPeriodLabel: z.string().nullable().optional(),
});

export type BrandContractUpdateInput = z.infer<typeof brandContractUpdateInputSchema>;

function normalizeNullableDate(value: Date | string | null | undefined, fieldName: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is not a valid date`);
  }
  return date;
}

export function normalizeBrandContractUpdate(input: BrandContractUpdateInput) {
  const { id, startDate, endDate, ...rest } = input;
  const data: any = { ...rest };
  const normalizedStartDate = normalizeNullableDate(startDate, "startDate");
  const normalizedEndDate = normalizeNullableDate(endDate, "endDate");
  if (startDate !== undefined) data.startDate = normalizedStartDate;
  if (endDate !== undefined) data.endDate = normalizedEndDate;

  return {
    id,
    data,
    startDateProvided: startDate !== undefined,
    endDateProvided: endDate !== undefined,
  };
}

function summarizeSensitiveText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? { present: true, length: text.length } : { present: false, length: 0 };
}

export function sanitizeBrandContractAuditValue(contract: Record<string, unknown>) {
  const {
    memo,
    kgLiveCondition,
    liverLiveCondition,
    shortVideoCondition,
    ...safeFields
  } = contract;
  return {
    ...safeFields,
    memo: summarizeSensitiveText(memo),
    kgLiveCondition: summarizeSensitiveText(kgLiveCondition),
    liverLiveCondition: summarizeSensitiveText(liverLiveCondition),
    shortVideoCondition: summarizeSensitiveText(shortVideoCondition),
  };
}
