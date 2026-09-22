import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ScanSearch } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function InfluencerBdDedupe() {
  const [confirmCount, setConfirmCount] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);
  const preview = trpc.influencerBd.previewCreatorDedupe.useQuery();
  const dedupe = trpc.influencerBd.dedupeCreators.useMutation();
  const data = preview.data;
  const expectedCount = Number(data?.duplicateRecordCount || 0);
  const hasWork = Boolean(data?.duplicateGroupCount || data?.normalizationPendingCount);
  const confirmed = confirmCount === String(expectedCount);

  const runDedupe = async () => {
    if (!data || !confirmed) return;
    try {
      const result = await dedupe.mutateAsync({
        reason: "按平台与账号ID去重，优先保留有TikTok名称的数据",
        expectedFingerprint: data.fingerprint,
        expectedDuplicateGroupCount: data.duplicateGroupCount,
        expectedDuplicateRecordCount: data.duplicateRecordCount,
        expectedNormalizationPendingCount: data.normalizationPendingCount,
      });
      setLastResult(result);
      setConfirmCount("");
      await preview.refetch();
    } catch (error: any) {
      if (String(error?.message || "").includes("BD-CREATOR-DEDUPE-PREVIEW-STALE")) {
        setConfirmCount("");
        await preview.refetch();
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">达人账号ID查重</h1>
          <p className="mt-1 text-sm text-slate-500">只加载聚合结果，不读取整页达人卡片。</p>
        </div>
        <Button variant="outline" onClick={() => { window.location.href = "/master/influencer-bd"; }}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回达人BD
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>检测结果</CardTitle>
          <CardDescription>同一平台＋同一规范化账号ID才会被视为重复。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.isLoading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在检测…</div>}
          {preview.error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>检测失败</AlertTitle><AlertDescription>{preview.error.message}</AlertDescription></Alert>}
          {data && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-4"><div className="text-xs text-slate-500">重复账号组</div><div className="mt-1 text-2xl font-bold">{data.duplicateGroupCount}</div></div>
                <div className="rounded-xl border p-4"><div className="text-xs text-slate-500">待移除重复资料</div><div className="mt-1 text-2xl font-bold text-rose-600">{data.duplicateRecordCount}</div></div>
                <div className="rounded-xl border p-4"><div className="text-xs text-slate-500">待规范化账号</div><div className="mt-1 text-2xl font-bold">{data.normalizationPendingCount}</div></div>
              </div>

              {!hasWork ? (
                <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-700" /><AlertTitle>无需处理</AlertTitle><AlertDescription>当前没有重复账号或待规范化账号。</AlertDescription></Alert>
              ) : (
                <>
                  <Alert><ScanSearch className="h-4 w-4" /><AlertTitle>安全规则</AlertTitle><AlertDescription>优先保留未删除且有真实TikTok名称的资料；进度和截图会转移到保留资料，重复资料仅软删除并留下审计记录。</AlertDescription></Alert>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">请输入待移除数量 {expectedCount} 进行确认</span>
                    <Input type="number" min={0} value={confirmCount} onChange={event => setConfirmCount(event.target.value)} />
                  </label>
                  <Button className="w-full" onClick={runDedupe} disabled={!confirmed || dedupe.isPending}>
                    {dedupe.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
                    {dedupe.isPending ? "正在执行…" : "执行去重"}
                  </Button>
                </>
              )}
            </>
          )}
          {dedupe.error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>执行失败</AlertTitle><AlertDescription>{dedupe.error.message}</AlertDescription></Alert>}
          {lastResult && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-700" /><AlertTitle>执行完成</AlertTitle><AlertDescription>已合并{lastResult.duplicateGroupCount}组，软删除{lastResult.mergedRecordCount}条重复资料，保留并迁移{lastResult.movedOutreachCount}条进度及{lastResult.movedAttachmentCount}个附件。</AlertDescription></Alert>}
        </CardContent>
      </Card>
    </div>
  );
}
