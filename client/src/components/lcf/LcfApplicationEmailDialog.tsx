import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, RefreshCw, Reply, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type LcfApplicationEmailTarget = {
  eventYear: "2026" | "2026-02";
  applicantType: "company" | "liver" | "general";
  applicationId: number;
  email: string;
  name: string;
  company?: string;
};

type ThreadItem = {
  id: string;
  source: "database" | "imap";
  direction: "sent" | "received";
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  subject: string;
  body: string;
  fromName: string;
  fromAddress: string;
  to: Array<{ name: string; address: string }>;
  date: string | null;
  status: string;
  hasAttachments: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "日時不明";
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEditionLabel(eventYear: LcfApplicationEmailTarget["eventYear"]): string {
  return eventYear === "2026-02" ? "第2回｜2026年12月" : "第1回｜2026年9月";
}

function defaultSubject(target: LcfApplicationEmailTarget): string {
  return `【LIVE COMMERCE FESTIVAL】${target.name}様へのご連絡`;
}

function defaultBody(target: LcfApplicationEmailTarget): string {
  return `${target.name} 様\n\nLIVE COMMERCE FESTIVAL運営事務局です。\n\n（こちらに具体的なご用件をご入力ください）`;
}

export function LcfApplicationEmailDialog({
  target,
  onOpenChange,
}: {
  target: LcfApplicationEmailTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [syncedItems, setSyncedItems] = useState<ThreadItem[] | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [inReplyTo, setInReplyTo] = useState<string | null>(null);
  const [references, setReferences] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const lastSyncedTarget = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const open = Boolean(target);
  const queryInput = target ? {
    eventYear: target.eventYear,
    applicantType: target.applicantType,
    applicationId: target.applicationId,
  } : null;

  const snapshotQuery = trpc.festival.lcfEmailThread.useQuery(queryInput!, {
    enabled: open,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const syncMutation = trpc.festival.syncLcfEmailThread.useMutation({
    onSuccess: (data) => {
      setSyncedItems(data.items as ThreadItem[]);
      setSyncWarning(data.warning || null);
      window.setTimeout(() => threadEndRef.current?.scrollIntoView({ block: "end" }), 30);
    },
    onError: (error) => setSyncWarning(error.message),
  });
  const sendMutation = trpc.festival.sendLcfApplicationEmail.useMutation({
    onSuccess: (data) => {
      setSendResult({ status: "success", message: data.message });
      setBody("");
      setInReplyTo(null);
      setReferences(null);
      if (target) setSubject(defaultSubject(target));
      void snapshotQuery.refetch();
      if (queryInput) syncMutation.mutate({ ...queryInput, forceRefresh: true });
    },
    onError: (error) => setSendResult({ status: "error", message: error.message }),
  });

  useEffect(() => {
    if (!target) return;
    const key = `${target.eventYear}:${target.applicantType}:${target.applicationId}`;
    setSubject(defaultSubject(target));
    setBody(defaultBody(target));
    setCc("");
    setInReplyTo(null);
    setReferences(null);
    setSendResult(null);
    setSyncedItems(null);
    setSyncWarning(null);
    if (lastSyncedTarget.current !== key) {
      lastSyncedTarget.current = key;
      syncMutation.mutate({
        eventYear: target.eventYear,
        applicantType: target.applicantType,
        applicationId: target.applicationId,
      });
    }
  }, [target?.eventYear, target?.applicantType, target?.applicationId]);

  useEffect(() => {
    if (!open) lastSyncedTarget.current = null;
  }, [open]);

  const items = useMemo(
    () => syncedItems || ((snapshotQuery.data?.items || []) as ThreadItem[]),
    [snapshotQuery.data?.items, syncedItems],
  );

  if (!target || !queryInput) return null;

  const handleRefresh = () => {
    setSyncWarning(null);
    syncMutation.mutate({ ...queryInput, forceRefresh: true });
  };

  const handleReply = (item: ThreadItem) => {
    setSubject(`Re: ${item.subject.replace(/^Re:\s*/i, "")}`);
    setBody(`${target.name} 様\n\n`);
    setInReplyTo(item.messageId);
    setReferences([item.references, item.messageId].filter(Boolean).join(" ") || null);
    setSendResult(null);
    window.setTimeout(() => document.getElementById("lcf-email-body")?.focus(), 30);
  };

  const handleSend = () => {
    setSendResult(null);
    const ccList = cc.split(/[,;，；\s]+/).map((value) => value.trim()).filter(Boolean);
    sendMutation.mutate({
      ...queryInput,
      subject,
      body,
      cc: ccList.length ? ccList : undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-24px)] max-w-none flex-col overflow-hidden border-amber-400/25 bg-[#101015] p-0 text-white sm:max-w-[1100px]">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <Mail className="h-5 w-5 text-amber-300" />
            LCFメール
            <Badge className="bg-amber-400/15 text-amber-200">{getEditionLabel(target.eventYear)}</Badge>
          </DialogTitle>
          <div className="min-w-0 text-xs text-gray-400">
            <span className="font-medium text-white">{target.name}</span>
            {target.company ? <span>／{target.company}</span> : null}
            <span className="ml-2 break-all">{target.email}</span>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
          <section className="flex min-h-[260px] min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-bold">メールのやり取り</p>
                <p className="text-[11px] text-gray-500">保存済み履歴を先に表示し、受信・送信メールをアドレス指定で同期します</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh} disabled={syncMutation.isPending} className="border-white/15 text-gray-300 hover:bg-white/10 hover:text-white">
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                更新
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {snapshotQuery.isLoading && items.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-300" />保存済み履歴を読み込み中...
                </div>
              ) : null}
              {items.length === 0 && !snapshotQuery.isLoading ? (
                <div className="rounded-xl border border-dashed border-white/15 px-5 py-10 text-center text-sm text-gray-500">
                  まだメール履歴がありません。右側から最初のメールを送れます。
                </div>
              ) : null}
              {items.map((item) => (
                <article key={item.id} className={`flex ${item.direction === "sent" ? "justify-end" : "justify-start"}`}>
                  <div className={`min-w-0 max-w-[92%] rounded-xl border px-4 py-3 sm:max-w-[82%] ${item.direction === "sent" ? "border-amber-400/30 bg-amber-400/10" : "border-cyan-400/20 bg-cyan-400/[0.07]"}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                      <Badge className={item.direction === "sent" ? "bg-amber-300 text-black" : "bg-cyan-400/20 text-cyan-200"}>{item.direction === "sent" ? "送信" : "受信"}</Badge>
                      <span className="text-gray-500">{formatDate(item.date)}</span>
                      {item.status === "failed" ? <span className="font-bold text-red-400">送信失敗</span> : null}
                      {item.hasAttachments ? <span className="text-gray-400">添付あり</span> : null}
                    </div>
                    <p className="mt-2 break-words text-sm font-bold text-white">{item.subject}</p>
                    <p className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-gray-300">{item.body || "本文はメールボックス側で確認してください"}</p>
                    {item.direction === "received" ? (
                      <button type="button" onClick={() => handleReply(item)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-100">
                        <Reply className="h-3.5 w-3.5" />このメールに返信
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              <div ref={threadEndRef} />
            </div>

            {syncMutation.isPending ? (
              <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-[11px] text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />最新メールをバックグラウンド同期中。画面はそのまま操作できます。
              </div>
            ) : null}
            {syncWarning ? (
              <div className="flex items-start gap-2 border-t border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{syncWarning}
              </div>
            ) : null}
          </section>

          <section className="min-w-0 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold">{inReplyTo ? "返信を作成" : "新規メールを作成"}</p>
                <p className="mt-1 text-xs text-gray-500">送信元：LIVE COMMERCE FESTIVAL &lt;LCF@livecommercejapan.jp&gt;</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">宛先</label>
                <div className="break-all rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200">{target.email}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">CC（任意）</label>
                <Input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="複数の場合はカンマ区切り" className="border-white/10 bg-white/5 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">件名</label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} className="border-white/10 bg-white/5 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">本文</label>
                <Textarea id="lcf-email-body" value={body} onChange={(event) => setBody(event.target.value)} rows={12} className="resize-y border-white/10 bg-white/5 text-white" />
                <p className="mt-1 text-[11px] leading-5 text-gray-500">迷惑メール判定を避けるため、数字だけの件名や短すぎる本文は送信できません。LCF署名は送信時に自動で付きます。</p>
              </div>
              {sendResult ? (
                <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${sendResult.status === "success" ? "border-green-400/25 bg-green-400/10 text-green-200" : "border-red-400/25 bg-red-400/10 text-red-200"}`}>
                  {sendResult.status === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                  <span className="whitespace-pre-wrap">{sendResult.message}</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-white/10 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-white/15 text-gray-300 hover:bg-white/10 hover:text-white">閉じる</Button>
          <Button type="button" onClick={handleSend} disabled={sendMutation.isPending} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
            {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {sendMutation.isPending ? "送信中..." : "LCFメールを送信"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
