/**
 * 招商管理メールクライアント
 * 受信トレイ・送信済み・メール作成・テンプレート管理・署名管理・一括送信・送信ログを一体化したUI
 */
import { useState, useMemo, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FileText,
  Pen,
  Users,
  CheckCircle2,
  Clock,
  Eye,
  MailPlus,
  History,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// ===== テンプレート変数置換 =====
function replaceTemplateVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

// ===== カテゴリラベル =====
const CATEGORY_LABELS: Record<string, string> = {
  general: "一般",
  first_contact: "初回連絡",
  follow_up: "フォローアップ",
  proposal: "提案",
  thank_you: "お礼",
  contract: "契約",
};

// ===== ステータスラベル =====
const STATUS_LABELS: Record<string, string> = {
  registered: "登録済み",
  email_sent: "メール送信済み",
  replied: "返信あり",
  agreed: "合意",
  cooperating: "協力中",
  rejected: "拒否",
};

// ===== エクスポート用: ブランドからのメール送信ダイアログを開くためのprops型 =====
export interface ComposeEmailProps {
  to?: string;
  brandName?: string;
  brandId?: number;
}

// ===== メインコンポーネント =====
export default function RecruitmentEmail({ initialCompose }: { initialCompose?: ComposeEmailProps }) {
  const [mainTab, setMainTab] = useState<"mailbox" | "templates" | "signatures">("mailbox");
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
  const [composeBrandId, setComposeBrandId] = useState<number | undefined>(undefined);
  const [composeBrandName, setComposeBrandName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [useSignature, setUseSignature] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  // 一括送信
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>("none");
  const [bulkBrandIds, setBulkBrandIds] = useState<number[]>([]);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkStatusFilter, setBulkStatusFilter] = useState<string>("_all");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // テンプレート管理
  const [templateEditOpen, setTemplateEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("general");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplVariables, setTplVariables] = useState("");
  const [tplPreviewOpen, setTplPreviewOpen] = useState(false);
  const [tplPreviewData, setTplPreviewData] = useState<any>(null);

  // 署名管理
  const [sigEditOpen, setSigEditOpen] = useState(false);
  const [editingSig, setEditingSig] = useState<any>(null);
  const [sigName, setSigName] = useState("");
  const [sigContent, setSigContent] = useState("");
  const [sigIsDefault, setSigIsDefault] = useState(false);

  // 送信ログ
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsPage, setLogsPage] = useState(1);

  const utils = trpc.useUtils();

  // ===== テンプレート・署名クエリ =====
  const { data: templates } = trpc.email.listTemplates.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: signatures } = trpc.email.listSignatures.useQuery(undefined, { refetchOnWindowFocus: false });
  const defaultSignature = useMemo(() => signatures?.find((s: any) => s.isDefault) || signatures?.[0], [signatures]);

  // ===== 受信メール一覧 =====
  const { data: inboxData, isLoading: inboxLoading, refetch: refetchInbox } = trpc.email.listInbox.useQuery(
    { page, pageSize: 20, folder: "INBOX" },
    { enabled: mainTab === "mailbox" && activeTab === "inbox", refetchOnWindowFocus: false }
  );

  // ===== 送信済みメール一覧 =====
  const { data: sentData, isLoading: sentLoading, refetch: refetchSent } = trpc.email.listSent.useQuery(
    { page, pageSize: 20 },
    { enabled: mainTab === "mailbox" && activeTab === "sent", refetchOnWindowFocus: false }
  );

  // ===== メール詳細 =====
  const { data: messageData, isLoading: messageLoading } = trpc.email.getMessage.useQuery(
    { uid: selectedUid!, folder: activeTab === "inbox" ? "INBOX" : "Sent Messages" },
    { enabled: !!selectedUid, refetchOnWindowFocus: false }
  );

  // ===== ブランド一覧（一括送信用 - メールアドレス付きのみ） =====
  const { data: brandsData } = trpc.email.getBrandsForBulkSend.useQuery(
    { status: bulkStatusFilter === "_all" ? undefined : bulkStatusFilter, page: 1, pageSize: 500 },
    { enabled: bulkOpen, refetchOnWindowFocus: false }
  );

  // ===== 送信ログ =====
  const { data: logsData, isLoading: logsLoading } = trpc.email.getAllEmailLogs.useQuery(
    { page: logsPage, pageSize: 50 },
    { enabled: logsOpen, refetchOnWindowFocus: false }
  );

  // ===== Mutations =====
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

  const sendRecruitmentMutation = trpc.email.sendRecruitmentEmail.useMutation({
    onSuccess: () => {
      toast.success("招商メール送信完了（ステータス自動更新済み）");
      setComposeOpen(false);
      resetCompose();
      refetchInbox();
      refetchSent();
    },
    onError: (err) => toast.error("送信失敗: " + err.message),
  });

  const bulkSendMutation = trpc.email.sendBulkRecruitmentEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`一括送信完了: ${data.sent}件成功 / ${data.failed}件失敗`);
      if (data.errors.length > 0) {
        data.errors.forEach(e => toast.error(e));
      }
      setBulkOpen(false);
      setBulkBrandIds([]);
      setBulkConfirmOpen(false);
    },
    onError: (err) => { toast.error("一括送信失敗: " + err.message); setBulkConfirmOpen(false); },
  });

  const deleteMutation = trpc.email.deleteEmail.useMutation({
    onSuccess: () => {
      toast.success("メール削除完了");
      setSelectedUid(null);
      refetchInbox();
    },
    onError: (err) => toast.error("削除失敗: " + err.message),
  });

  // テンプレートCRUD
  const createTemplateMutation = trpc.email.createTemplate.useMutation({
    onSuccess: () => { toast.success("テンプレート作成完了"); setTemplateEditOpen(false); utils.email.listTemplates.invalidate(); },
    onError: (err) => toast.error("作成失敗: " + err.message),
  });
  const updateTemplateMutation = trpc.email.updateTemplate.useMutation({
    onSuccess: () => { toast.success("テンプレート更新完了"); setTemplateEditOpen(false); utils.email.listTemplates.invalidate(); },
    onError: (err) => toast.error("更新失敗: " + err.message),
  });
  const deleteTemplateMutation = trpc.email.deleteTemplate.useMutation({
    onSuccess: () => { toast.success("テンプレート削除完了"); utils.email.listTemplates.invalidate(); },
    onError: (err) => toast.error("削除失敗: " + err.message),
  });

  // 署名CRUD
  const upsertSignatureMutation = trpc.email.upsertSignature.useMutation({
    onSuccess: () => { toast.success("署名保存完了"); setSigEditOpen(false); utils.email.listSignatures.invalidate(); },
    onError: (err) => toast.error("保存失敗: " + err.message),
  });
  const deleteSignatureMutation = trpc.email.deleteSignature.useMutation({
    onSuccess: () => { toast.success("署名削除完了"); utils.email.listSignatures.invalidate(); },
    onError: (err) => toast.error("削除失敗: " + err.message),
  });

  // ===== initialCompose対応 =====
  useEffect(() => {
    if (initialCompose) {
      resetCompose();
      setComposeTo(initialCompose.to || "");
      setComposeBrandId(initialCompose.brandId);
      setComposeBrandName(initialCompose.brandName || "");
      setComposeOpen(true);
    }
  }, [initialCompose]);

  const resetCompose = () => {
    setComposeTo("");
    setComposeCc("");
    setComposeSubject("");
    setComposeBody("");
    setComposeBrandId(undefined);
    setComposeBrandName("");
    setSelectedTemplateId("none");
    setReplyMode(false);
    setPreviewMode(false);
  };

  // ===== テンプレート選択時の処理 =====
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") return;
    const tpl = templates?.find((t: any) => t.id === Number(templateId));
    if (!tpl) return;
    const vars: Record<string, string> = {
      brandName: composeBrandName || "{{brandName}}",
      senderName: "LCJ招商チーム",
      contactPerson: "ご担当者",
      companyName: "Live Commerce Japan",
    };
    setComposeSubject(replaceTemplateVars(tpl.subject, vars));
    let body = replaceTemplateVars(tpl.body, vars);
    if (useSignature && defaultSignature) {
      body += "\n\n" + defaultSignature.content;
    }
    setComposeBody(body);
  };

  // ===== 一括送信テンプレート選択 =====
  const handleBulkTemplateSelect = (templateId: string) => {
    setBulkTemplateId(templateId);
    if (templateId === "none") return;
    const tpl = templates?.find((t: any) => t.id === Number(templateId));
    if (!tpl) return;
    setBulkSubject(tpl.subject);
    let body = tpl.body;
    if (useSignature && defaultSignature) {
      body += "\n\n" + defaultSignature.content;
    }
    setBulkBody(body);
  };

  const handleSend = () => {
    if (!composeTo.trim()) { toast.error("宛先を入力してください"); return; }
    if (!composeSubject.trim()) { toast.error("件名を入力してください"); return; }

    const toList = composeTo.split(/[,;，；\s]+/).filter(Boolean).map(s => s.trim());
    const ccList = composeCc ? composeCc.split(/[,;，；\s]+/).filter(Boolean).map(s => s.trim()) : undefined;

    // brandIdがある場合は招商メール送信APIを使用（ステータス自動更新+ログ記録）
    if (composeBrandId) {
      sendRecruitmentMutation.mutate({
        brandId: composeBrandId,
        to: toList,
        cc: ccList,
        subject: composeSubject,
        html: composeBody.replace(/\n/g, "<br>"),
        templateId: selectedTemplateId !== "none" ? Number(selectedTemplateId) : undefined,
        sentBy: "manual",
        autoUpdateStatus: true,
      });
    } else {
      sendMutation.mutate({
        to: toList,
        cc: ccList,
        subject: composeSubject,
        text: composeBody,
        html: composeBody.replace(/\n/g, "<br>"),
      });
    }
  };

  const handleBulkSend = () => {
    if (bulkBrandIds.length === 0) { toast.error("送信先ブランドを選択してください"); return; }
    if (!bulkSubject.trim()) { toast.error("件名を入力してください"); return; }
    if (!bulkBody.trim()) { toast.error("本文を入力してください"); return; }
    // 確認ダイアログを表示
    setBulkConfirmOpen(true);
  };

  const executeBulkSend = () => {
    bulkSendMutation.mutate({
      brandIds: bulkBrandIds,
      subject: bulkSubject,
      bodyTemplate: bulkBody,
      templateId: bulkTemplateId !== "none" ? Number(bulkTemplateId) : undefined,
      autoUpdateStatus: true,
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

  // テンプレート保存
  const handleSaveTemplate = () => {
    if (!tplName.trim() || !tplSubject.trim() || !tplBody.trim()) {
      toast.error("名前・件名・本文は必須です");
      return;
    }
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        name: tplName,
        category: tplCategory,
        subject: tplSubject,
        body: tplBody,
        variables: tplVariables || undefined,
      });
    } else {
      createTemplateMutation.mutate({
        name: tplName,
        category: tplCategory,
        subject: tplSubject,
        body: tplBody,
        variables: tplVariables || undefined,
      });
    }
  };

  // 署名保存
  const handleSaveSignature = () => {
    if (!sigName.trim() || !sigContent.trim()) {
      toast.error("名前・内容は必須です");
      return;
    }
    upsertSignatureMutation.mutate({
      id: editingSig?.id,
      name: sigName,
      content: sigContent,
      isDefault: sigIsDefault,
    });
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

  // 一括送信: サーバーサイドでメールアドレス付きブランドのみ取得済み
  const filteredBulkBrands = useMemo(() => {
    if (!brandsData?.items) return [];
    return brandsData.items;
  }, [brandsData]);

  const isSending = sendMutation.isPending || sendRecruitmentMutation.isPending;

  // ===== プレビューHTML生成 =====
  const previewHtml = useMemo(() => {
    return composeBody.replace(/\n/g, "<br>");
  }, [composeBody]);

  // ===== メール詳細ビュー =====
  if (selectedUid && messageData) {
    return (
      <div className="min-h-[600px] bg-gray-900/50 rounded-xl">
        <div className="flex items-center gap-2 p-4 border-b border-gray-800">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUid(null)} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => {
            resetCompose();
            setComposeTo(messageData.from.address);
            setComposeOpen(true);
          }} className="text-green-400 hover:text-green-300">
            <MailPlus className="w-4 h-4 mr-1" /> 新規メール
          </Button>
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
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">{messageData.subject}</h2>
          <div className="flex items-start gap-4 mb-4 text-sm">
            <div className="flex-1">
              <div className="text-gray-300">
                <span className="text-gray-500">差出人: </span>
                <span className="font-medium">{messageData.from.name || messageData.from.address}</span>
                {messageData.from.name && <span className="text-gray-500 ml-1">&lt;{messageData.from.address}&gt;</span>}
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
          <div className="border-t border-gray-800 pt-4">
            {messageData.html ? (
              <div className="prose prose-invert max-w-none text-gray-300 [&_a]:text-blue-400 [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: messageData.html }} />
            ) : (
              <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">{messageData.text}</pre>
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

  // ===== メインレイアウト =====
  return (
    <div className="min-h-[600px]">
      {/* メインタブ: メールボックス / テンプレート管理 / 署名管理 */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <div className="flex items-center gap-2 mb-4">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="mailbox" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Mail className="w-4 h-4 mr-1" /> メールボックス
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-1" /> テンプレート
            </TabsTrigger>
            <TabsTrigger value="signatures" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Pen className="w-4 h-4 mr-1" /> 署名管理
            </TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          {/* 送信ログボタン */}
          <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:text-white" onClick={() => { setLogsOpen(true); setLogsPage(1); }}>
            <History className="w-4 h-4 mr-1" /> 送信ログ
          </Button>
          {mainTab === "mailbox" && (
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setBulkOpen(true)}>
              <Users className="w-4 h-4 mr-1" /> 一括送信
            </Button>
          )}
        </div>

        {/* ===== メールボックスタブ ===== */}
        <TabsContent value="mailbox" className="mt-0">
          <div className="bg-gray-900/50 rounded-xl">
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
                  className="pl-9 bg-gray-800 border-gray-700 text-white h-8"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                )}
              </div>

              <div className="flex-1" />

              <Button variant="ghost" size="sm" onClick={() => { activeTab === "inbox" ? refetchInbox() : refetchSent(); }} className="text-gray-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { resetCompose(); setComposeOpen(true); }}>
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
                        {email.hasAttachments && <Paperclip className="w-3 h-3 text-gray-500 flex-shrink-0" />}
                      </div>
                      <div className={`text-sm truncate ${!email.seen && activeTab === "inbox" ? "text-gray-200" : "text-gray-400"}`}>
                        {email.subject}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 flex-shrink-0">{formatEmailDate(email.date)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-800">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-gray-400">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-400">{page} / {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="text-gray-400">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== テンプレート管理タブ ===== */}
        <TabsContent value="templates" className="mt-0">
          <div className="bg-gray-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">メールテンプレート</h3>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                setEditingTemplate(null);
                setTplName(""); setTplCategory("general"); setTplSubject(""); setTplBody(""); setTplVariables("");
                setTemplateEditOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-1" /> 新規テンプレート
              </Button>
            </div>

            {!templates || templates.length === 0 ? (
              <div className="text-center py-10 text-gray-500">テンプレートがありません</div>
            ) : (
              <div className="space-y-3">
                {templates.map((tpl: any) => (
                  <div key={tpl.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{tpl.name}</span>
                        <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                          {CATEGORY_LABELS[tpl.category] || tpl.category}
                        </Badge>
                        {tpl.isDefault && <Badge className="bg-blue-600 text-xs">デフォルト</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-7 w-7 p-0" onClick={() => {
                          setTplPreviewData(tpl);
                          setTplPreviewOpen(true);
                        }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-7 w-7 p-0" onClick={() => {
                          setEditingTemplate(tpl);
                          setTplName(tpl.name); setTplCategory(tpl.category); setTplSubject(tpl.subject); setTplBody(tpl.body);
                          setTplVariables(tpl.variables || "");
                          setTemplateEditOpen(true);
                        }}>
                          <Pen className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-7 w-7 p-0" onClick={() => {
                          if (confirm(`テンプレート「${tpl.name}」を削除しますか？`)) deleteTemplateMutation.mutate({ id: tpl.id });
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400 mb-1">件名: {tpl.subject}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{tpl.body}</div>
                    {tpl.variables && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {(() => {
                          try {
                            const vars = typeof tpl.variables === 'string' ? JSON.parse(tpl.variables) : tpl.variables;
                            return Array.isArray(vars) ? vars.map((v: string) => (
                              <Badge key={v} variant="outline" className="border-purple-500/30 text-purple-400 text-xs">{`{{${v}}}`}</Badge>
                            )) : null;
                          } catch { return null; }
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== 署名管理タブ ===== */}
        <TabsContent value="signatures" className="mt-0">
          <div className="bg-gray-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">メール署名</h3>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                setEditingSig(null);
                setSigName(""); setSigContent(""); setSigIsDefault(false);
                setSigEditOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-1" /> 新規署名
              </Button>
            </div>

            {!signatures || signatures.length === 0 ? (
              <div className="text-center py-10 text-gray-500">署名がありません</div>
            ) : (
              <div className="space-y-3">
                {signatures.map((sig: any) => (
                  <div key={sig.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{sig.name}</span>
                        {sig.isDefault && <Badge className="bg-green-600 text-xs">デフォルト</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-7 w-7 p-0" onClick={() => {
                          setEditingSig(sig);
                          setSigName(sig.name); setSigContent(sig.content); setSigIsDefault(sig.isDefault);
                          setSigEditOpen(true);
                        }}>
                          <Pen className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-7 w-7 p-0" onClick={() => {
                          if (confirm(`署名「${sig.name}」を削除しますか？`)) deleteSignatureMutation.mutate({ id: sig.id });
                        }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{sig.content}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== 新規メール作成ダイアログ ===== */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              {replyMode ? "返信" : composeBrandId ? `${composeBrandName}へメール送信` : "新規メール作成"}
              {composeBrandId && (
                <Badge className="bg-green-600 text-xs">招商メール（ステータス自動更新）</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* テンプレート選択 */}
            {!replyMode && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">テンプレート</label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="テンプレートを選択..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="none" className="text-gray-300">テンプレートなし（手動入力）</SelectItem>
                    {templates?.map((tpl: any) => (
                      <SelectItem key={tpl.id} value={String(tpl.id)} className="text-gray-300">
                        <div className="flex items-center gap-2">
                          <span>{tpl.name}</span>
                          <span className="text-xs text-gray-500">({CATEGORY_LABELS[tpl.category] || tpl.category})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">本文</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSignature}
                      onChange={e => setUseSignature(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    署名を自動挿入
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 px-2 text-xs ${previewMode ? "text-blue-400" : "text-gray-400"}`}
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    <Eye className="w-3 h-3 mr-1" /> プレビュー
                  </Button>
                </div>
              </div>
              {previewMode ? (
                <div className="bg-gray-800 border border-gray-700 rounded-md p-4 min-h-[200px]">
                  <div className="prose prose-invert max-w-none text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              ) : (
                <Textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder="メール本文を入力..."
                  rows={12}
                  className="bg-gray-800 border-gray-700 text-white resize-none"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} className="border-gray-600 text-gray-300">
              キャンセル
            </Button>
            <Button onClick={handleSend} disabled={isSending} className="bg-blue-600 hover:bg-blue-700">
              {isSending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> 送信中...</>
              ) : (
                <><Send className="w-4 h-4 mr-1" /> 送信</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 一括送信ダイアログ ===== */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              一括メール送信
              <Badge className="bg-purple-600 text-xs ml-2">ステータス自動更新</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* テンプレート選択 */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">テンプレート選択</label>
              <Select value={bulkTemplateId} onValueChange={handleBulkTemplateSelect}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="テンプレートを選択..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-300">テンプレートなし（手動入力）</SelectItem>
                  {templates?.map((tpl: any) => (
                    <SelectItem key={tpl.id} value={String(tpl.id)} className="text-gray-300">
                      {tpl.name} ({CATEGORY_LABELS[tpl.category] || tpl.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                変数 {"{{brandName}}"} {"{{contactPerson}}"} は各ブランドの情報に自動置換されます
              </p>
            </div>

            {/* ブランド選択 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">送信先ブランド（{bulkBrandIds.length}件選択中）</label>
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-gray-500" />
                  <Select value={bulkStatusFilter} onValueChange={setBulkStatusFilter}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-7 text-xs w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="_all" className="text-gray-300 text-xs">全ステータス</SelectItem>
                      <SelectItem value="registered" className="text-gray-300 text-xs">登録済み</SelectItem>
                      <SelectItem value="email_sent" className="text-gray-300 text-xs">メール送信済み</SelectItem>
                      <SelectItem value="replied" className="text-gray-300 text-xs">返信あり</SelectItem>
                      <SelectItem value="agreed" className="text-gray-300 text-xs">合意</SelectItem>
                      <SelectItem value="cooperating" className="text-gray-300 text-xs">協力中</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-md max-h-[200px] overflow-y-auto p-2 space-y-1">
                {filteredBulkBrands.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">該当するブランドがありません</div>
                ) : (
                  filteredBulkBrands.map((brand: any) => {
                    const email = brand.contactInfo?.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0];
                    const isSelected = bulkBrandIds.includes(brand.id);
                    return (
                      <label key={brand.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${isSelected ? "bg-purple-600/20 text-white" : "text-gray-300 hover:bg-gray-700/50"}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setBulkBrandIds(prev => isSelected ? prev.filter(id => id !== brand.id) : [...prev, brand.id]);
                          }}
                          className="rounded border-gray-600"
                        />
                        <span className="truncate">{brand.brandName}</span>
                        <Badge variant="outline" className="border-gray-600 text-gray-500 text-[10px] ml-auto mr-1">
                          {STATUS_LABELS[brand.status] || brand.status}
                        </Badge>
                        <span className="text-xs text-gray-500">{email}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" size="sm" className="text-xs text-blue-400 h-6" onClick={() => {
                  const allIds = filteredBulkBrands.map((b: any) => b.id);
                  setBulkBrandIds(allIds);
                }}>全選択</Button>
                <Button variant="ghost" size="sm" className="text-xs text-gray-400 h-6" onClick={() => setBulkBrandIds([])}>全解除</Button>
                <span className="text-xs text-gray-500 ml-auto mt-1">メールアドレスのあるブランド: {filteredBulkBrands.length}件</span>
              </div>
            </div>

            {/* 件名 */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">件名 *</label>
              <Input
                value={bulkSubject}
                onChange={e => setBulkSubject(e.target.value)}
                placeholder="件名を入力（{{brandName}}で変数置換可能）"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">本文 *</label>
              <Textarea
                value={bulkBody}
                onChange={e => setBulkBody(e.target.value)}
                placeholder="メール本文を入力...（{{brandName}}、{{contactPerson}}で変数置換可能）"
                rows={10}
                className="bg-gray-800 border-gray-700 text-white resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} className="border-gray-600 text-gray-300">
              キャンセル
            </Button>
            <Button onClick={handleBulkSend} disabled={bulkSendMutation.isPending || bulkBrandIds.length === 0} className="bg-purple-600 hover:bg-purple-700">
              {bulkSendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> 送信中...</>
              ) : (
                <><Send className="w-4 h-4 mr-1" /> {bulkBrandIds.length}件に一括送信</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 一括送信確認ダイアログ ===== */}
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              一括送信の確認
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-gray-300">
              以下の内容で<span className="text-yellow-400 font-bold">{bulkBrandIds.length}件</span>のブランドにメールを送信します。
            </p>
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
              <div><span className="text-gray-500">件名:</span> <span className="text-white">{bulkSubject}</span></div>
              <div><span className="text-gray-500">送信先:</span> <span className="text-white">{bulkBrandIds.length}件のブランド</span></div>
              <div><span className="text-gray-500">ステータス更新:</span> <span className="text-green-400">自動（registered → email_sent）</span></div>
            </div>
            <p className="text-xs text-gray-500">
              送信後はキャンセルできません。送信間隔は2秒です。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} className="border-gray-600 text-gray-300">
              キャンセル
            </Button>
            <Button onClick={executeBulkSend} disabled={bulkSendMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {bulkSendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> 送信中...</>
              ) : (
                <><Send className="w-4 h-4 mr-1" /> 送信実行</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== テンプレート編集ダイアログ ===== */}
      <Dialog open={templateEditOpen} onOpenChange={setTemplateEditOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "テンプレート編集" : "新規テンプレート作成"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">テンプレート名 *</label>
                <Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="例: 初回連絡" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">カテゴリ</label>
                <Select value={tplCategory} onValueChange={setTplCategory}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="general" className="text-gray-300">一般</SelectItem>
                    <SelectItem value="first_contact" className="text-gray-300">初回連絡</SelectItem>
                    <SelectItem value="follow_up" className="text-gray-300">フォローアップ</SelectItem>
                    <SelectItem value="proposal" className="text-gray-300">提案</SelectItem>
                    <SelectItem value="thank_you" className="text-gray-300">お礼</SelectItem>
                    <SelectItem value="contract" className="text-gray-300">契約</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">件名 *</label>
              <Input value={tplSubject} onChange={e => setTplSubject(e.target.value)} placeholder="例: 【LCJ MALL】{{brandName}}様へのご提案" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">本文 *</label>
              <Textarea value={tplBody} onChange={e => setTplBody(e.target.value)} placeholder="メール本文テンプレート..." rows={10} className="bg-gray-800 border-gray-700 text-white resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">変数（JSON配列）</label>
              <Input value={tplVariables} onChange={e => setTplVariables(e.target.value)} placeholder='["brandName","senderName","contactPerson"]' className="bg-gray-800 border-gray-700 text-white" />
              <p className="text-xs text-gray-500 mt-1">本文中で {"{{変数名}}"} として使用可能</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateEditOpen(false)} className="border-gray-600 text-gray-300">キャンセル</Button>
            <Button onClick={handleSaveTemplate} disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== テンプレートプレビューダイアログ ===== */}
      <Dialog open={tplPreviewOpen} onOpenChange={setTplPreviewOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              テンプレートプレビュー: {tplPreviewData?.name}
            </DialogTitle>
          </DialogHeader>
          {tplPreviewData && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                    {CATEGORY_LABELS[tplPreviewData.category] || tplPreviewData.category}
                  </Badge>
                  {tplPreviewData.isDefault && <Badge className="bg-blue-600 text-xs">デフォルト</Badge>}
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">件名: </span>
                  <span className="text-white font-medium">{tplPreviewData.subject}</span>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">本文プレビュー（変数はサンプル値で表示）:</div>
                <div className="prose prose-invert max-w-none text-sm text-gray-300" dangerouslySetInnerHTML={{
                  __html: replaceTemplateVars(tplPreviewData.body, {
                    brandName: "サンプルブランド株式会社",
                    senderName: "LCJ招商チーム",
                    contactPerson: "田中太郎",
                    companyName: "Live Commerce Japan",
                  }).replace(/\n/g, "<br>")
                }} />
                {defaultSignature && (
                  <>
                    <div className="border-t border-gray-700 mt-4 pt-3">
                      <div className="text-xs text-gray-500 mb-1">署名（デフォルト）:</div>
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{defaultSignature.content}</pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplPreviewOpen(false)} className="border-gray-600 text-gray-300">閉じる</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
              if (tplPreviewData) {
                resetCompose();
                handleTemplateSelect(String(tplPreviewData.id));
                setSelectedTemplateId(String(tplPreviewData.id));
                setComposeOpen(true);
                setTplPreviewOpen(false);
              }
            }}>
              <MailPlus className="w-4 h-4 mr-1" /> このテンプレートでメール作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 署名編集ダイアログ ===== */}
      <Dialog open={sigEditOpen} onOpenChange={setSigEditOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSig ? "署名編集" : "新規署名作成"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">署名名 *</label>
              <Input value={sigName} onChange={e => setSigName(e.target.value)} placeholder="例: 標準署名" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">署名内容 *</label>
              <Textarea value={sigContent} onChange={e => setSigContent(e.target.value)} placeholder="署名内容..." rows={6} className="bg-gray-800 border-gray-700 text-white resize-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={sigIsDefault} onChange={e => setSigIsDefault(e.target.checked)} className="rounded border-gray-600" />
              デフォルト署名に設定
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigEditOpen(false)} className="border-gray-600 text-gray-300">キャンセル</Button>
            <Button onClick={handleSaveSignature} disabled={upsertSignatureMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {upsertSignatureMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 送信ログダイアログ ===== */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              招商メール送信ログ
              {logsData && <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs ml-2">全{logsData.total}件</Badge>}
            </DialogTitle>
          </DialogHeader>
          {logsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : !logsData?.logs || logsData.logs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">送信ログがありません</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1.5fr_2fr_100px_80px] gap-2 px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-800">
                <div>ブランド</div>
                <div>宛先</div>
                <div>件名</div>
                <div>送信日時</div>
                <div>種別</div>
              </div>
              {logsData.logs.map((log: any) => (
                <div key={log.id} className="grid grid-cols-[1fr_1.5fr_2fr_100px_80px] gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-800/50 items-center">
                  <div className="text-white truncate font-medium">{log.brandName || `ID:${log.brandId}`}</div>
                  <div className="text-gray-400 truncate">{log.toAddress}</div>
                  <div className="text-gray-300 truncate">{log.subject}</div>
                  <div className="text-gray-500 text-xs">{formatEmailDate(log.sentAt)}</div>
                  <div>
                    {log.isBulk ? (
                      <Badge className="bg-purple-600/20 text-purple-400 text-[10px]">一括</Badge>
                    ) : (
                      <Badge className="bg-blue-600/20 text-blue-400 text-[10px]">個別</Badge>
                    )}
                  </div>
                </div>
              ))}
              {/* ページネーション */}
              {logsData.total > 50 && (
                <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-800">
                  <Button variant="ghost" size="sm" disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)} className="text-gray-400">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-400">{logsPage} / {Math.ceil(logsData.total / 50)}</span>
                  <Button variant="ghost" size="sm" disabled={logsPage >= Math.ceil(logsData.total / 50)} onClick={() => setLogsPage(p => p + 1)} className="text-gray-400">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsOpen(false)} className="border-gray-600 text-gray-300">閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
