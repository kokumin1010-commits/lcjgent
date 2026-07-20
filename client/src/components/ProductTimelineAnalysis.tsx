import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Zap, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface SnapshotProduct {
  productName: string;
  attributedGmv: number;
  salesCount: number;
  skuOrderCount?: number;
  cartAddCount: number;
  impressionCount?: number;
  clickCount?: number;
  clickRate?: string;
  clickConversionRate?: string;
  skuConversionRate?: string;
  perThousandViewGmv?: number;
}

interface Snapshot {
  id: number;
  timeSlot: string;
  gmv?: number;
  orderCount?: number;
  impressions?: number;
  viewerCount?: number;
  products?: SnapshotProduct[];
}

interface ProductTimeline {
  productName: string;
  firstSeen: string; // timeSlot when first appeared
  lastSeen: string; // timeSlot when last had activity
  totalDurationMinutes: number;
  finalGmv: number;
  finalOrders: number;
  finalCartAdds: number;
  gmvPerMinute: number; // ¥/min efficiency
  // Time segments showing incremental growth
  segments: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    gmvIncrement: number;
    ordersIncrement: number;
    cartIncrement: number;
    impressionsIncrement: number;
    // Derived
    gmvPerMinute: number;
    isExplosion: boolean; // high growth rate
    isStagnant: boolean; // no growth
  }[];
  // Peak performance
  peakSegment: {
    startTime: string;
    endTime: string;
    gmvPerMinute: number;
  } | null;
  // Conversion funnel (final)
  finalImpressions: number;
  finalClicks: number;
  finalClickRate: string;
  finalConversionRate: string;
  finalGpm: number; // per thousand view GMV
}

function timeToMinutes(timeSlot: string): number {
  const [h, m] = timeSlot.split(":").map(Number);
  return h * 60 + m;
}

function minutesToDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function formatGmv(value: number): string {
  if (value >= 10000000) return `¥${(value / 10000000).toFixed(1)}千万`;
  if (value >= 10000) return `¥${(value / 10000).toFixed(0)}万`;
  return `¥${value.toLocaleString()}`;
}

export function analyzeProductTimelines(snapshots: Snapshot[]): ProductTimeline[] {
  if (!snapshots || snapshots.length < 2) return [];

  // Sort snapshots by time
  const sorted = [...snapshots].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  // Collect all product names across all snapshots
  const allProductNames = new Set<string>();
  sorted.forEach(snap => {
    snap.products?.forEach(p => allProductNames.add(p.productName));
  });

  const timelines: ProductTimeline[] = [];

  for (const productName of Array.from(allProductNames)) {
    // Get this product's data at each time point
    const dataPoints: { timeSlot: string; gmv: number; orders: number; carts: number; impressions: number; clicks: number; clickRate: string; convRate: string; gpm: number }[] = [];

    for (const snap of sorted) {
      const product = snap.products?.find(p => p.productName === productName);
      if (product) {
        dataPoints.push({
          timeSlot: snap.timeSlot,
          gmv: product.attributedGmv || 0,
          orders: product.salesCount || 0,
          carts: product.cartAddCount || 0,
          impressions: product.impressionCount || 0,
          clicks: product.clickCount || 0,
          clickRate: product.clickRate || "0%",
          convRate: product.skuConversionRate || "0%",
          gpm: product.perThousandViewGmv || 0,
        });
      }
    }

    if (dataPoints.length < 1) continue;

    // Find first and last time with actual activity (orders > 0 or cart > 0)
    const firstSeen = dataPoints[0].timeSlot;
    const lastActive = [...dataPoints].reverse().find(d => d.orders > 0 || d.carts > 0);
    const lastSeen = lastActive ? lastActive.timeSlot : dataPoints[dataPoints.length - 1].timeSlot;

    const totalDurationMinutes = Math.max(1, timeToMinutes(lastSeen) - timeToMinutes(firstSeen));
    const finalData = dataPoints[dataPoints.length - 1];

    // Build segments (incremental between consecutive time points)
    const segments: ProductTimeline["segments"] = [];
    for (let i = 1; i < dataPoints.length; i++) {
      const prev = dataPoints[i - 1];
      const curr = dataPoints[i];
      const durationMinutes = Math.max(1, timeToMinutes(curr.timeSlot) - timeToMinutes(prev.timeSlot));
      const gmvIncrement = curr.gmv - prev.gmv;
      const ordersIncrement = curr.orders - prev.orders;
      const cartIncrement = curr.carts - prev.carts;
      const impressionsIncrement = curr.impressions - prev.impressions;
      const gmvPerMinute = durationMinutes > 0 ? gmvIncrement / durationMinutes : 0;

      segments.push({
        startTime: prev.timeSlot,
        endTime: curr.timeSlot,
        durationMinutes,
        gmvIncrement,
        ordersIncrement,
        cartIncrement,
        impressionsIncrement,
        gmvPerMinute,
        isExplosion: gmvPerMinute > 0 && ordersIncrement >= 3, // 3+ orders in a segment
        isStagnant: gmvIncrement === 0 && ordersIncrement === 0,
      });
    }

    // Find peak segment
    const activeSeg = segments.filter(s => s.gmvIncrement > 0);
    const peakSegment = activeSeg.length > 0
      ? activeSeg.reduce((best, s) => s.gmvPerMinute > best.gmvPerMinute ? s : best)
      : null;

    timelines.push({
      productName,
      firstSeen,
      lastSeen,
      totalDurationMinutes,
      finalGmv: finalData.gmv,
      finalOrders: finalData.orders,
      finalCartAdds: finalData.carts,
      gmvPerMinute: totalDurationMinutes > 0 ? finalData.gmv / totalDurationMinutes : 0,
      segments,
      peakSegment: peakSegment ? {
        startTime: peakSegment.startTime,
        endTime: peakSegment.endTime,
        gmvPerMinute: peakSegment.gmvPerMinute,
      } : null,
      finalImpressions: finalData.impressions,
      finalClicks: finalData.clicks,
      finalClickRate: finalData.clickRate,
      finalConversionRate: finalData.convRate,
      finalGpm: finalData.gpm,
    });
  }

  // Sort by GMV descending
  timelines.sort((a, b) => b.finalGmv - a.finalGmv);
  return timelines;
}

// Progress bar component for time segments
function TimeSegmentBar({ segments, totalDuration }: { segments: ProductTimeline["segments"]; totalDuration: number }) {
  if (segments.length === 0) return null;

  const maxGmvPerMin = Math.max(...segments.map(s => s.gmvPerMinute), 1);

  return (
    <div className="flex w-full h-6 rounded overflow-hidden bg-gray-800/50 gap-px">
      {segments.map((seg, idx) => {
        const widthPercent = Math.max(2, (seg.durationMinutes / totalDuration) * 100);
        const intensity = seg.gmvPerMinute / maxGmvPerMin;
        let bgColor = "bg-gray-700"; // stagnant
        if (seg.isExplosion) {
          bgColor = "bg-green-500";
        } else if (seg.gmvIncrement > 0) {
          bgColor = intensity > 0.5 ? "bg-emerald-600" : "bg-emerald-800";
        } else if (seg.isStagnant) {
          bgColor = "bg-gray-700";
        }

        return (
          <div
            key={idx}
            className={`${bgColor} relative group transition-all hover:brightness-125 cursor-default`}
            style={{ width: `${widthPercent}%` }}
            title={`${seg.startTime}→${seg.endTime} | GMV+¥${seg.gmvIncrement.toLocaleString()} | +${seg.ordersIncrement}件 | ${seg.durationMinutes}分`}
          >
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
                <div>{seg.startTime}→{seg.endTime} ({seg.durationMinutes}分)</div>
                <div className="text-green-400">+¥{seg.gmvIncrement.toLocaleString()} / +{seg.ordersIncrement}件</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Single product timeline card
function ProductTimelineCard({ timeline, rank, totalLiveGmv }: { timeline: ProductTimeline; rank: number; totalLiveGmv: number }) {
  const [expanded, setExpanded] = useState(false);
  const gmvShare = totalLiveGmv > 0 ? ((timeline.finalGmv / totalLiveGmv) * 100).toFixed(1) : "0";

  // Determine status badge
  const getStatusBadge = () => {
    if (timeline.finalGmv === 0 && timeline.finalOrders === 0) {
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 font-medium">転化ゼロ</span>;
    }
    if (timeline.gmvPerMinute > 20000) {
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-medium">🔥 高効率</span>;
    }
    return null;
  };

  // Stagnation warning
  const stagnantSegments = timeline.segments.filter(s => s.isStagnant);
  const stagnantMinutes = stagnantSegments.reduce((sum, s) => sum + s.durationMinutes, 0);
  const hasStagnation = stagnantMinutes > 15 && timeline.totalDurationMinutes > 30;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <div
        className="px-4 py-3 cursor-pointer hover:bg-gray-800/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-lg font-bold w-6 text-center ${rank <= 3 ? 'text-amber-400' : 'text-gray-500'}`}>
                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
              </span>
              <span className="text-sm font-bold text-white truncate">{timeline.productName}</span>
              {getStatusBadge()}
            </div>

            {/* Key metrics row */}
            <div className="flex items-center gap-3 ml-8 flex-wrap">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-400" />
                <span className="text-xs text-gray-300">
                  {timeline.firstSeen}→{timeline.lastSeen}
                  <span className="text-blue-400 font-medium ml-1">({minutesToDuration(timeline.totalDurationMinutes)})</span>
                </span>
              </div>
              <span className="text-xs text-green-400 font-bold">GMV {formatGmv(timeline.finalGmv)}</span>
              <span className="text-xs text-yellow-400">{timeline.finalOrders}件</span>
              <span className="text-[10px] text-gray-500">{gmvShare}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Efficiency metric */}
            <div className="text-right">
              <p className="text-[10px] text-gray-500">¥/分</p>
              <p className={`text-sm font-bold ${timeline.gmvPerMinute > 10000 ? 'text-green-400' : timeline.gmvPerMinute > 5000 ? 'text-yellow-400' : 'text-gray-400'}`}>
                ¥{Math.round(timeline.gmvPerMinute).toLocaleString()}
              </p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </div>
        </div>

        {/* Time segment bar - always visible */}
        {timeline.segments.length > 0 && timeline.finalGmv > 0 && (
          <div className="mt-2 ml-8">
            <TimeSegmentBar segments={timeline.segments} totalDuration={timeline.totalDurationMinutes} />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gray-600">{timeline.firstSeen}</span>
              <span className="text-[9px] text-gray-600">{timeline.lastSeen}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-700/50 pt-3 space-y-3">
          {/* Segment details */}
          {timeline.segments.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1.5">⏱ 時間帯別パフォーマンス</p>
              <div className="space-y-1">
                {timeline.segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between rounded px-2.5 py-1.5 text-[11px] ${
                      seg.isExplosion ? 'bg-green-900/30 border border-green-700/50' :
                      seg.isStagnant ? 'bg-gray-800/50 border border-gray-700/30' :
                      'bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-300 w-[100px]">{seg.startTime}→{seg.endTime}</span>
                      <span className="text-gray-500">({seg.durationMinutes}分)</span>
                      {seg.isExplosion && <Zap className="h-3 w-3 text-yellow-400" />}
                      {seg.isStagnant && <AlertTriangle className="h-3 w-3 text-gray-600" />}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={seg.gmvIncrement > 0 ? 'text-green-400' : 'text-gray-600'}>
                        +¥{seg.gmvIncrement.toLocaleString()}
                      </span>
                      <span className={seg.ordersIncrement > 0 ? 'text-yellow-400' : 'text-gray-600'}>
                        +{seg.ordersIncrement}件
                      </span>
                      <span className={seg.cartIncrement > 0 ? 'text-amber-400' : 'text-gray-600'}>
                        🛒+{seg.cartIncrement}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peak & insights */}
          <div className="grid grid-cols-2 gap-2">
            {timeline.peakSegment && (
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-2.5">
                <p className="text-[10px] text-green-500 font-bold mb-1">🏆 ピーク時間帯</p>
                <p className="text-xs text-white font-medium">{timeline.peakSegment.startTime}→{timeline.peakSegment.endTime}</p>
                <p className="text-[10px] text-green-400">¥{Math.round(timeline.peakSegment.gmvPerMinute).toLocaleString()}/分</p>
              </div>
            )}
            {hasStagnation && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-2.5">
                <p className="text-[10px] text-yellow-500 font-bold mb-1">⚠️ 停滞時間</p>
                <p className="text-xs text-white font-medium">{minutesToDuration(stagnantMinutes)}</p>
                <p className="text-[10px] text-yellow-400">次回は早めに切替推奨</p>
              </div>
            )}
          </div>

          {/* Conversion funnel */}
          {timeline.finalImpressions > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500 font-bold mb-1.5">📊 転化ファネル</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-gray-500">曝光</p>
                  <p className="text-xs text-white font-medium">{(timeline.finalImpressions / 1000).toFixed(1)}K</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">クリック</p>
                  <p className="text-xs text-white font-medium">{timeline.finalClicks.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">クリック率</p>
                  <p className="text-xs text-cyan-400 font-medium">{timeline.finalClickRate}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">転化率</p>
                  <p className="text-xs text-purple-400 font-medium">{timeline.finalConversionRate}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main component
export default function ProductTimelineAnalysis({ snapshots }: { snapshots: Snapshot[] }) {
  const timelines = useMemo(() => analyzeProductTimelines(snapshots), [snapshots]);

  if (timelines.length === 0) return null;

  const totalLiveGmv = timelines.reduce((sum, t) => sum + t.finalGmv, 0);
  const totalOrders = timelines.reduce((sum, t) => sum + t.finalOrders, 0);
  const liveStartTime = timelines.length > 0 ? timelines.reduce((min, t) => t.firstSeen < min ? t.firstSeen : min, "99:99") : "";
  const liveEndTime = timelines.length > 0 ? timelines.reduce((max, t) => t.lastSeen > max ? t.lastSeen : max, "00:00") : "";
  const liveDurationMinutes = timeToMinutes(liveEndTime) - timeToMinutes(liveStartTime);

  // Top performer
  const topProduct = timelines[0];
  // Most efficient (by ¥/min, excluding zero GMV)
  const activeTimelines = timelines.filter(t => t.finalGmv > 0);
  const mostEfficient = activeTimelines.length > 0
    ? activeTimelines.reduce((best, t) => t.gmvPerMinute > best.gmvPerMinute ? t : best)
    : null;

  return (
    <Card className="bg-gray-900 border-indigo-700/50">
      <CardContent className="p-4">
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            📊 商品タイムライン分析
          </h3>
          <span className="text-[10px] text-gray-500">TikTokでは見れないデータ</span>
        </div>

        {/* Overall summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500">総GMV</p>
            <p className="text-sm font-bold text-green-400">{formatGmv(totalLiveGmv)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500">総出単</p>
            <p className="text-sm font-bold text-yellow-400">{totalOrders}件</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500">配信時間</p>
            <p className="text-sm font-bold text-blue-400">{minutesToDuration(liveDurationMinutes)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500">平均¥/分</p>
            <p className="text-sm font-bold text-purple-400">¥{liveDurationMinutes > 0 ? Math.round(totalLiveGmv / liveDurationMinutes).toLocaleString() : '0'}</p>
          </div>
        </div>

        {/* Key insights */}
        {(topProduct || mostEfficient) && (
          <div className="bg-indigo-950/30 border border-indigo-700/30 rounded-lg p-2.5 mb-4">
            <p className="text-[10px] text-indigo-400 font-bold mb-1">💡 キーインサイト</p>
            <div className="space-y-0.5 text-[11px] text-gray-300">
              {topProduct && topProduct.finalGmv > 0 && (
                <p>• <span className="text-white font-medium">{topProduct.productName.substring(0, 20)}</span> が売上{gmvShareText(topProduct.finalGmv, totalLiveGmv)}を占める（{minutesToDuration(topProduct.totalDurationMinutes)}）</p>
              )}
              {mostEfficient && mostEfficient !== topProduct && (
                <p>• 時間効率No.1: <span className="text-white font-medium">{mostEfficient.productName.substring(0, 20)}</span> (¥{Math.round(mostEfficient.gmvPerMinute).toLocaleString()}/分)</p>
              )}
              {activeTimelines.length > 0 && (() => {
                const zeroProducts = timelines.filter(t => t.finalGmv === 0);
                if (zeroProducts.length > 0) {
                  return <p>• <span className="text-red-400">{zeroProducts.length}商品</span>が転化ゼロ → 次回見直し推奨</p>;
                }
                return null;
              })()}
            </div>
          </div>
        )}

        {/* Product timeline cards */}
        <div className="space-y-2">
          {timelines.map((timeline, idx) => (
            <ProductTimelineCard
              key={timeline.productName}
              timeline={timeline}
              rank={idx + 1}
              totalLiveGmv={totalLiveGmv}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-3 text-[9px] text-gray-600">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-500 rounded-sm inline-block"></span>爆発</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-700 rounded-sm inline-block"></span>成長</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-gray-700 rounded-sm inline-block"></span>停滞</span>
          <span className="ml-auto">※ バーの幅=時間、色=成長速度</span>
        </div>
      </CardContent>
    </Card>
  );
}

function gmvShareText(gmv: number, total: number): string {
  if (total === 0) return "0%";
  return `${((gmv / total) * 100).toFixed(0)}%`;
}
