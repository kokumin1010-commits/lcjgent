import type { AuctionRound } from "@shared/auctionRecordPersistence";
import {
  calculateAuctionRoundEconomics,
  type AuctionEventRisk,
  type AuctionRiskAnalysis,
  type AuctionRiskLevel,
} from "@shared/auctionRisk";

const PURPOSE_LABELS = {
  unknown: "未分类 / 未分類",
  market_test: "市场测试 / 市場テスト",
  traffic: "引流活动 / 集客施策",
  normal_sale: "正常销售 / 通常販売",
} as const;

function money(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function nullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function riskTone(level: AuctionRiskLevel): string {
  if (level === "critical") return "border-red-300 bg-red-50 text-red-800";
  if (level === "warning") return "border-amber-300 bg-amber-50 text-amber-800";
  if (level === "safe")
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function riskLabel(level: AuctionRiskLevel): string {
  if (level === "critical") return "高风险 / 要停止确认";
  if (level === "warning") return "注意 / 预算内监控";
  if (level === "safe") return "安全范围";
  return "成本未登记";
}

export function AuctionRiskFields({
  round,
  onChange,
}: {
  round: AuctionRound;
  onChange: (field: keyof AuctionRound, value: string | number | null) => void;
}) {
  const risk = calculateAuctionRoundEconomics(round);
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-slate-800">
            拍卖止损设置 / 拍卖損失管理
          </div>
          <div className="text-[10px] text-slate-500">
            低价引流可以继续，但先确认成本、预算和同买家限胜次数。
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${riskTone(risk.level)}`}
        >
          {riskLabel(risk.level)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div>
          <label className="text-[11px] text-gray-500">拍卖目的</label>
          <select
            className="w-full rounded border px-2 py-1 text-xs"
            value={round.auctionPurpose}
            onChange={event => onChange("auctionPurpose", event.target.value)}
          >
            {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500">拍卖数量 *</label>
          <input
            aria-label="拍卖数量"
            className="w-full rounded border px-2 py-1 text-xs"
            type="number"
            min="1"
            step="1"
            value={round.lotQuantity ?? ""}
            onChange={event =>
              onChange("lotQuantity", nullableNumber(event.target.value))
            }
            placeholder="例：100"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">单件成本 *</label>
          <input
            aria-label="单件成本"
            className="w-full rounded border px-2 py-1 text-xs"
            type="number"
            min="0"
            step="0.01"
            value={round.unitCost ?? ""}
            onChange={event =>
              onChange("unitCost", nullableNumber(event.target.value))
            }
            placeholder="例：1400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">最大允许亏损</label>
          <input
            aria-label="最大允许亏损"
            className="w-full rounded border px-2 py-1 text-xs"
            type="number"
            min="0"
            step="0.01"
            value={round.maxLossBudget ?? ""}
            onChange={event =>
              onChange("maxLossBudget", nullableNumber(event.target.value))
            }
            placeholder="未设则空白"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">同买家限胜次数</label>
          <input
            aria-label="同买家限胜次数"
            className="w-full rounded border px-2 py-1 text-xs"
            type="number"
            min="1"
            step="1"
            value={round.winnerLimit ?? ""}
            onChange={event =>
              onChange("winnerLimit", nullableNumber(event.target.value))
            }
            placeholder="建议：1"
          />
        </div>
      </div>
      <div
        className={`mt-2 rounded-md border px-3 py-2 text-xs ${riskTone(risk.level)}`}
      >
        {!risk.costKnown ? (
          <span>
            请填写数量与单件成本后再确认起拍价；系统不会把未知成本当作0。
          </span>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>
              总成本：<strong>{money(risk.totalCost || 0)}</strong>
            </span>
            <span>
              安全成交底线：<strong>{money(risk.safeSaleFloor || 0)}</strong>
            </span>
            {risk.profitLoss !== null ? (
              <span>
                实际损益：
                <strong>
                  {risk.profitLoss >= 0 ? "+" : "−"}
                  {money(Math.abs(risk.profitLoss))}
                </strong>
              </span>
            ) : (
              <span>等待成交价</span>
            )}
            {risk.maxLossBudget !== null && (
              <span>允许亏损：{money(risk.maxLossBudget)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuctionRiskOverview({
  analysis,
}: {
  analysis: AuctionRiskAnalysis;
}) {
  const { summary } = analysis;
  const cards = [
    [
      "已知总亏损",
      money(summary.totalKnownLoss),
      summary.totalKnownLoss > 0 ? "text-red-700" : "text-emerald-700",
    ],
    [
      "超预算场次",
      String(summary.overBudgetCount),
      summary.overBudgetCount > 0 ? "text-red-700" : "text-emerald-700",
    ],
    [
      "重复获胜场次",
      String(summary.repeatWinnerRoundCount),
      summary.repeatWinnerRoundCount > 0
        ? "text-amber-700"
        : "text-emerald-700",
    ],
    [
      "成本未登记",
      String(summary.unknownCostRoundCount),
      summary.unknownCostRoundCount > 0 ? "text-slate-700" : "text-emerald-700",
    ],
  ] as const;
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-slate-900">拍卖止损与买家集中风险</h4>
          <p className="mt-1 text-xs text-slate-600">
            低价测试不禁止，但亏损必须在预算内；同买家同商品同SKU同日重复获胜会自动预警。
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
          共 {summary.totalRoundCount} 场
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([label, value, tone]) => (
          <div
            key={label}
            className="rounded-lg border border-white bg-white/80 px-3 py-2 shadow-sm"
          >
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        获胜者按平台显示名规范化匹配，只用于内部预警，不等同于平台实名身份；系统不会自动取消订单。
      </p>
    </div>
  );
}

export function AuctionRiskBadge({ risk }: { risk: AuctionEventRisk }) {
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskTone(risk.combinedLevel)}`}
      >
        {riskLabel(risk.combinedLevel)}
      </span>
      {risk.repeatWinner && (
        <div
          className={`text-[10px] font-medium ${risk.repeatWinnerOverLimit ? "text-red-700" : "text-amber-700"}`}
        >
          同买家同日获胜 {risk.winnerWinCount} 次
          {risk.winnerWinSharePercent !== null
            ? `（${risk.winnerWinSharePercent}%）`
            : ""}
        </div>
      )}
      {risk.repeatWinnerOverLimit && (
        <div className="text-[10px] font-semibold text-red-700">
          超过限胜次数，请主管复核
        </div>
      )}
    </div>
  );
}

export function AuctionEconomicsCell({ risk }: { risk: AuctionEventRisk }) {
  if (!risk.costKnown)
    return <span className="text-[11px] text-slate-400">成本未登记</span>;
  return (
    <div className="text-right text-[11px]">
      <div>
        {risk.lotQuantity}件 × {money(risk.unitCost || 0)}
      </div>
      <div className="font-semibold text-slate-700">
        总成本 {money(risk.totalCost || 0)}
      </div>
      {risk.profitLoss !== null && (
        <div
          className={
            risk.profitLoss < 0
              ? "font-bold text-red-700"
              : "font-bold text-emerald-700"
          }
        >
          {risk.profitLoss < 0 ? "亏损" : "盈利"}{" "}
          {money(Math.abs(risk.profitLoss))}
        </div>
      )}
      {risk.safeSaleFloor !== null && (
        <div className="text-[10px] text-slate-500">
          底线 {money(risk.safeSaleFloor)}
        </div>
      )}
    </div>
  );
}
