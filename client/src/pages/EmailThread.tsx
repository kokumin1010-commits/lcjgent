/**
 * メール履歴ページ
 * 特定のメールアドレスとの送受信履歴を時系列で表示し、返信も可能
 */
import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Send,
  MailOpen,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { toast } from "sonner";

type EmailMessage = {
  uid: number;
  folder: string;
  direction: "sent" | "received";
  subject: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  date: string | null;
  flags: string[];
  seen: boolean;
};

type SalesEmailLog = {
  id: number;
  toEmail: string;
  toName: string | null;
  toCompany: string | null;
  subject: string;
  sendType: string;
  attachPdf: boolean | null;
  status: string;
  errorMessage: string | null;
  businessCardId: number | null;
  sentAt: string;
  trackingId: string | null;
  openedAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  pdfDownloadedAt: string | null;
  pdfDownloadCount: number;
  contentPreview?: string | null;
};

// 統合されたタイムラインアイテム
type TimelineItem = {
  type: "imap_sent" | "imap_received" | "sales_log";
  date: Date;
  data: EmailMessage | SalesEmailLog;
};

export default function EmailThread() {
  const [, params] = useRoute("/master/email-thread/:email");
  const [, navigate] = useLocation();
  const email = params?.email ? decodeURIComponent(params.email) : "";

  // 返信フォーム
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // 展開中のメール
  const [expandedUid, setExpandedUid] = useState<number | null>(null);
  const [expandedFolder, setExpandedFolder] = useState<string>("INBOX");

  const bottomRef = useRef<HTMLDivElement>(null);

  // IMAP送受信履歴
  const {
    data: imapData,
    isLoading: imapLoading,
    refetch: refetchImap,
  } = trpc.email.listByAddress.useQuery(
    { emailAddress: email, page: 1, pageSize: 100 },
    { enabled: !!email }
  );

  // 営業メール送信ログ
  const {
    data: salesLogs,
    isLoading: salesLoading,
    refetch: refetchSales,
  } = trpc.businessCard.getSalesEmailLogsByEmail.useQuery(
    { email },
    { enabled: !!email }
  );

  // メール本文取得
  const {
    data: messageDetail,
    isLoading: messageLoading,
  } = trpc.email.getMessage.useQuery(
    { uid: expandedUid!, folder: expandedFolder },
    { enabled: !!expandedUid }
  );

  // メール送信
  const sendEmailMutation = trpc.email.sendEmail.useMutation();

  // タイムラインを構築
  const timeline: TimelineItem[] = [];

  // IMAPメールを追加
  if (imapData?.emails) {
    for (const msg of imapData.emails) {
      timeline.push({
        type: msg.direction === "sent" ? "imap_sent" : "imap_received",
        date: msg.date ? new Date(msg.date) : new Date(0),
        data: msg,
      });
    }
  }

  // 営業メールログを追加（IMAPの送信済みと重複する可能性があるが、トラッキング情報があるので両方表示）
  if (salesLogs) {
    for (const log of salesLogs) {
      // IMAP送信済みと重複チェック（同じ件名・同じ日付なら除外）
      const isDuplicate = timeline.some(item => {
        if (item.type !== "imap_sent") return false;
        const imapMsg = item.data as EmailMessage;
        const logDate = new Date(log.sentAt);
        const timeDiff = Math.abs(item.date.getTime() - logDate.getTime());
        return imapMsg.subject === log.subject && timeDiff < 60000; // 1分以内
      });
      if (!isDuplicate) {
        timeline.push({
          type: "sales_log",
          date: new Date(log.sentAt),
          data: log,
        });
      }
    }
  }

  // 日付昇順ソート（古い順）
  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

  const isLoading = imapLoading || salesLoading;

  // 最新の受信メールを自動展開
  useEffect(() => {
    if (!isLoading && timeline.length > 0 && expandedUid === null) {
      const lastReceived = [...timeline].reverse().find(t => t.type === "imap_received");
      if (lastReceived) {
        const msg = lastReceived.data as EmailMessage;
        setExpandedUid(msg.uid);
        setExpandedFolder(msg.folder || "INBOX");
      }
    }
  }, [isLoading, timeline.length]);

  const handleRefresh = () => {
    refetchImap();
    refetchSales();
  };

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      await sendEmailMutation.mutateAsync({
        to: [email],
        subject: replySubject || `Re: ${email}`,
        text: replyBody,
        html: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${replyBody.replace(/\n/g, "<br>")}</div>`,
      });
      setReplyBody("");
      setReplySubject("");
      setShowReplyForm(false);
      toast.success("メールを送信しました");
      // 少し待ってからリフレッシュ
      setTimeout(() => {
        refetchImap();
        refetchSales();
      }, 2000);
    } catch (err: any) {
      toast.error("送信に失敗しました: " + (err.message || "不明なエラー"));
    } finally {
      setSending(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sendTypeLabel = (type: string) => {
    switch (type) {
      case "test": return "テスト";
      case "bulk_card": return "名刺一括";
      case "bulk_lead": return "リード一括";
      case "bulk_kalodata": return "Kalodata一括";
      case "bulk_unsent": return "未送信一括";
      case "bulk_all": return "全件一括";
      default: return type;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/master/business-cards?tab=email")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              {email}
            </h1>
            <p className="text-sm text-gray-500">
              メール送受信履歴
              {timeline.length > 0 && ` (${timeline.length}件)`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
          </div>
        )}

        {/* タイムライン */}
        {!isLoading && timeline.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">このアドレスとのメール履歴はありません</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && timeline.length > 0 && (
          <div className="space-y-3">
            {timeline.map((item, idx) => {
              if (item.type === "sales_log") {
                const log = item.data as SalesEmailLog;
                return (
                  <div key={`sales-${log.id}`} className="flex justify-end">
                    <Card className="max-w-[85%] border-blue-200 bg-blue-50">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className="text-xs bg-blue-100 text-blue-700">
                            {sendTypeLabel(log.sendType)}
                          </Badge>
                          {log.status === "sent" ? (
                            <Badge className="text-xs bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-0.5" />送信成功
                            </Badge>
                          ) : (
                            <Badge className="text-xs bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3 mr-0.5" />送信失敗
                            </Badge>
                          )}
                          {log.openCount > 0 && (
                            <Badge className="text-xs bg-amber-100 text-amber-700">
                              <MailOpen className="h-3 w-3 mr-0.5" />
                              開封{log.openCount}回
                            </Badge>
                          )}
                          {log.pdfDownloadCount > 0 && (
                            <Badge className="text-xs bg-purple-100 text-purple-700">
                              <Download className="h-3 w-3 mr-0.5" />
                              PDF{log.pdfDownloadCount}回
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{log.subject}</p>
                        {log.contentPreview && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {log.contentPreview}
                          </p>
                        )}
                        {log.attachPdf && (
                          <span className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                            <FileText className="h-3 w-3" /> PDF添付
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {formatDate(item.date)}
                          {log.openedAt && (
                            <span className="ml-2">
                              初回開封: {formatDate(new Date(log.openedAt))}
                            </span>
                          )}
                        </div>
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              }

              if (item.type === "imap_sent") {
                const msg = item.data as EmailMessage;
                return (
                  <div key={`imap-sent-${msg.uid}`} className="flex justify-end">
                    <Card className="max-w-[85%] border-green-200 bg-green-50">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="text-xs bg-green-100 text-green-700">
                            <Send className="h-3 w-3 mr-0.5" />送信
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{msg.subject}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {msg.date ? formatDate(new Date(msg.date)) : "日時不明"}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 text-xs h-6 px-2"
                          onClick={() => {
                            if (expandedUid === msg.uid) { setExpandedUid(null); }
                            else { setExpandedUid(msg.uid); setExpandedFolder(msg.folder || "Sent Messages"); }
                          }}
                        >
                          {expandedUid === msg.uid ? (
                            <><ChevronUp className="h-3 w-3 mr-1" />閉じる</>
                          ) : (
                            <><ChevronDown className="h-3 w-3 mr-1" />本文を表示</>
                          )}
                        </Button>
                        {expandedUid === msg.uid && messageDetail && (
                          <div className="mt-2 p-2 bg-white rounded border text-xs">
                            {messageDetail.html ? (
                              <div dangerouslySetInnerHTML={{ __html: messageDetail.html }} />
                            ) : (
                              <pre className="whitespace-pre-wrap">{messageDetail.text}</pre>
                            )}
                          </div>
                        )}
                        {expandedUid === msg.uid && messageLoading && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                            <Loader2 className="h-3 w-3 animate-spin" />読み込み中...
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              }

              // 受信メール
              const msg = item.data as EmailMessage;
              return (
                <div key={`imap-recv-${msg.uid}`} className="flex justify-start">
                  <Card className="max-w-[85%] border-gray-200 bg-white">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-xs bg-gray-100 text-gray-700">
                          <Mail className="h-3 w-3 mr-0.5" />受信
                        </Badge>
                        {!msg.seen && (
                          <Badge className="text-xs bg-red-100 text-red-700">未読</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">{msg.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        From: {msg.from.name || msg.from.address}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {msg.date ? formatDate(new Date(msg.date)) : "日時不明"}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 text-xs h-6 px-2"
                        onClick={() => {
                          if (expandedUid === msg.uid) { setExpandedUid(null); }
                          else { setExpandedUid(msg.uid); setExpandedFolder(msg.folder || "INBOX"); }
                        }}
                      >
                        {expandedUid === msg.uid ? (
                          <><ChevronUp className="h-3 w-3 mr-1" />閉じる</>
                        ) : (
                          <><ChevronDown className="h-3 w-3 mr-1" />本文を表示</>
                        )}
                      </Button>
                      {expandedUid === msg.uid && messageDetail && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border text-xs">
                          {messageDetail.html ? (
                            <div dangerouslySetInnerHTML={{ __html: messageDetail.html }} />
                          ) : (
                            <pre className="whitespace-pre-wrap">{messageDetail.text}</pre>
                          )}
                        </div>
                      )}
                      {expandedUid === msg.uid && messageLoading && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                          <Loader2 className="h-3 w-3 animate-spin" />読み込み中...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* 返信フォーム */}
        {!isLoading && (
          <Card className="sticky bottom-4">
            <CardContent className="p-3">
              {!showReplyForm ? (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => {
                    setShowReplyForm(true);
                    // 最後の受信メールの件名をRe:付きで設定
                    const lastReceived = [...timeline].reverse().find(t => t.type === "imap_received");
                    if (lastReceived) {
                      const msg = lastReceived.data as EmailMessage;
                      const subj = msg.subject || "";
                      setReplySubject(subj.startsWith("Re:") ? subj : `Re: ${subj}`);
                    } else {
                      setReplySubject(`Re: ${email}`);
                    }
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  返信を作成
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 shrink-0">To:</span>
                    <span className="text-sm font-medium">{email}</span>
                  </div>
                  <Input
                    placeholder="件名"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                  />
                  <Textarea
                    placeholder="メール本文を入力..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowReplyForm(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={sending || !replyBody.trim()}
                    >
                      {sending ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" />送信中...</>
                      ) : (
                        <><Send className="h-4 w-4 mr-1" />送信</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
