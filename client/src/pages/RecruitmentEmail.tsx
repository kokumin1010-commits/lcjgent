/**
 * 招商管理メールクライアント
 * 受信トレイ・送信済み・メール作成を一体化したUI
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Inbox,
  Send,
  RefreshCw,
  Mail,
  MailOpen,
  Paperclip,
  ArrowLeft,
  Reply,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ===== 日付フォーマット =====
function formatEmailDate(d: string | null) {
  if (!d) return "-";
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function formatFullDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ===== メインコンポーネント =====
export default function RecruitmentEmail() {
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [page, setPage] = useState(1);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // 新規メール作成フォーム
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const utils = trpc.useUtils();

  // ===== 受信メール一覧 =====
  const { data: inboxData, isLoading: inboxLoading, refetch: refetchInbox } = trpc.email.listInbox.useQuery(
    { page, pageSize: 20, folder: "INBOX" },
    { enabled: activeTab === "inbox", refetchOnWindowFocus: false }
  );

  // ===== 送信済みメール一覧 =====
  const { data: sentData, isLoading: sentLoading, refetch: refetchSent } = trpc.email.listSent.useQuery(
    { page, pageSize: 20 },
    { enabled: activeTab === "sent", refetchOnWindowFocus: false }
  );

  // ===== メール詳細 =====
  const { data: messageData, isLoading: messageLoading } = trpc.email.getMessage.useQuery(
    { uid: selectedUid!, folder: activeTab === "inbox" ? "INBOX" : "Sent Messages" },
    { enabled: !!selectedUid, refetchOnWindowFocus: false }
  );

  // ===== メール送信 =====
  const sendMutation = trpc.email.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("メール送信完了");
      setComposeOpen(false);
      resetCompose();
      refetchInbox();
      refetchSent();
    },
    onError: (err) => toast.error("送信失敗: " + err.message),
  });

  // ===== メール削除 =====
  const deleteMutation = trpc.email.deleteEmail.useMutation({
    onSuccess: () => {
      toast.success("メール削除完了");
      setSelectedUid(null);
      refetchInbox();
    },
    onError: (err) => toast.error("削除失敗: " + err.message),
  });

  const resetCompose = () => {
    setComposeTo("");
    setComposeCc("");
    setComposeSubject("");
    setComposeBody("");
    setReplyMode(false);
  };

  const handleSend = () => {
    if (!composeTo.trim()) {
      toast.error("宛先を入力してください");
      return;
    }
    if (!composeSubject.trim()) {
      toast.error("件名を入力してください");
      return;
    }

    const toList = composeTo.split(/[,;，；\s]+/).filter(Boolean).map(s => s.trim());
    const ccList = composeCc ? composeCc.split(/[,;，；\s]+/).filter(Boolean).map(s => s.trim()) : undefined;

    sendMutation.mutate({
      to: toList,
      cc: ccList,
      subject: composeSubject,
      text: composeBody,
      html: composeBody.replace(/\n/g, "<br>"),
    });
  };

  const handleReply = () => {
    if (!messageData) return;
    setComposeTo(messageData.from.address);
    setComposeSubject(`Re: ${messageData.subject.replace(/^Re:\s*/i, "")}`);
    setComposeBody(`\n\n---\n${formatFullDate(messageData.date)} ${messageData.from.name} <${messageData.from.address}>:\n${messageData.text}`);
    setReplyMode(true);
    setComposeOpen(true);
  };

  const currentEmails = activeTab === "inbox" ? inboxData?.emails : sentData?.emails;
  const currentTotal = activeTab === "inbox" ? inboxData?.total : sentData?.total;
  const isLoading = activeTab === "inbox" ? inboxLoading : sentLoading;

  // 検索フィルタ
  const filteredEmails = useMemo(() => {
    if (!currentEmails || !searchTerm) return currentEmails || [];
    const term = searchTerm.toLowerCase();
    return currentEmails.filter((e: any) =>
      e.subject?.toLowerCase().includes(term) ||
      e.from?.address?.toLowerCase().includes(term) ||
      e.from?.name?.toLowerCase().includes(term) ||
      e.to?.some((t: any) => t.address?.toLowerCase().includes(term) || t.name?.toLowerCase().includes(term))
    );
  }, [currentEmails, searchTerm]);

  const totalPages = Math.ceil((currentTotal || 0) / 20);

  // ===== メール詳細ビュー =====
  if (selectedUid && messageData) {
    return (
      <div className="min-h-[600px] bg-gray-900/50 rounded-xl">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-800">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUid(null)} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={handleReply} className="text-blue-400 hover:text-blue-300">
            <Reply className="w-4 h-4 mr-1" /> 返信
          </Button>
          {activeTab === "inbox" && (
            <Button variant="ghost" size="sm"
              onClick={() => { if (confirm("このメールを削除しますか？")) deleteMutation.mutate({ uid: selectedUid }); }}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-1" /> 削除
            </Button>
          )}
        </div>

        {/* メール本文 */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">{messageData.subject}</h2>
          <div className="flex items-start gap-4 mb-4 text-sm">
            <div className="flex-1">
              <div className="text-gray-300">
                <span className="text-gray-500">差出人: </span>
                <span className="font-medium">{messageData.from.name || messageData.from.address}</span>
                {messageData.from.name && (
                  <span className="text-gray-500 ml-1">&lt;{messageData.from.address}&gt;</span>
                )}
              </div>
              <div className="text-gray-300 mt-1">
                <span className="text-gray-500">宛先: </span>
                {messageData.to.map((t: any, i: number) => (
                  <span key={i}>{i > 0 ? ", " : ""}{t.name || t.address}</span>
                ))}
              </div>
              {messageData.cc && messageData.cc.length > 0 && (
                <div className="text-gray-300 mt-1">
                  <span className="text-gray-500">CC: </span>
                  {messageData.cc.map((t: any, i: number) => (
                    <span key={i}>{i > 0 ? ", " : ""}{t.name || t.address}</span>
                  ))}
                </div>
              )}
              <div className="text-gray-500 mt-1">{formatFullDate(messageData.date)}</div>
            </div>
          </div>

          {/* 添付ファイル */}
          {messageData.attachments && messageData.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-800/50 rounded-lg">
              <Paperclip className="w-4 h-4 text-gray-400 mt-0.5" />
              {messageData.attachments.map((att: any, i: number) => (
                <Badge key={i} variant="outline" className="border-gray-600 text-gray-300">
                  {att.filename} ({(att.size / 1024).toFixed(1)}KB)
                </Badge>
              ))}
            </div>
          )}

          {/* 本文 */}
          <div className="border-t border-gray-800 pt-4">
            {messageData.html ? (
              <div
                className="prose prose-invert max-w-none text-gray-300 [&_a]:text-blue-400 [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: messageData.html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">
                {messageData.text}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== メール詳細ローディング =====
  if (selectedUid && messageLoading) {
    return (
      <div className="min-h-[600px] bg-gray-900/50 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ===== メール一覧ビュー =====
  return (
    <div className="min-h-[600px] bg-gray-900/50 rounded-xl">
      {/* タブ & ツールバー */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-800">
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => { setActiveTab("inbox"); setPage(1); setSelectedUid(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "inbox" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <Inbox className="w-4 h-4" /> 受信トレイ
          </button>
          <button
            onClick={() => { setActiveTab("sent"); setPage(1); setSelectedUid(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "sent" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <Send className="w-4 h-4" /> 送信済み
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="メール検索..."
            className="pl-9 bg-gray-800 border-gray-700 text-white h-8 text-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => { activeTab === "inbox" ? refetchInbox() : refetchSent(); }}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => { resetCompose(); setComposeOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-1" /> 新規メール
        </Button>
      </div>

      {/* メール一覧 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">読み込み中...</span>
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Mail className="w-12 h-12 mb-3 opacity-30" />
          <p>メールがありません</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/50">
          {filteredEmails.map((email: any) => (
            <div
              key={email.uid}
              onClick={() => setSelectedUid(email.uid)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-800/50 ${
                !email.seen && activeTab === "inbox" ? "bg-gray-800/20" : ""
              }`}
            >
              <div className="flex-shrink-0">
                {!email.seen && activeTab === "inbox" ? (
                  <Mail className="w-4 h-4 text-blue-400" />
                ) : (
                  <MailOpen className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate ${!email.seen && activeTab === "inbox" ? "font-bold text-white" : "text-gray-300"}`}>
                    {activeTab === "inbox"
                      ? (email.from?.name || email.from?.address || "不明")
                      : (email.to?.[0]?.name || email.to?.[0]?.address || "不明")
                    }
                  </span>
                  {email.hasAttachments && (
                    <Paperclip className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  )}
                </div>
                <div className={`text-sm truncate ${!email.seen && activeTab === "inbox" ? "text-gray-200" : "text-gray-400"}`}>
                  {email.subject}
                </div>
              </div>
              <div className="text-xs text-gray-500 flex-shrink-0">
                {formatEmailDate(email.date)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-800">
          <Button
            variant="ghost" size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="text-gray-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-400">{page} / {totalPages}</span>
          <Button
            variant="ghost" size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="text-gray-400"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 新規メール作成ダイアログ */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              {replyMode ? "返信" : "新規メール作成"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">宛先 *</label>
              <Input
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                placeholder="example@email.com（複数はカンマ区切り）"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">CC</label>
              <Input
                value={composeCc}
                onChange={e => setComposeCc(e.target.value)}
                placeholder="cc@email.com"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">件名 *</label>
              <Input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="件名を入力"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">本文</label>
              <Textarea
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="メール本文を入力..."
                rows={12}
                className="bg-gray-800 border-gray-700 text-white resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} className="border-gray-600 text-gray-300">
              キャンセル
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> 送信中...</>
              ) : (
                <><Send className="w-4 h-4 mr-1" /> 送信</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
