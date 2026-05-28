import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Search,
  Upload,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Loader2,
  Trash2,
  Edit,
  Eye,
  Camera,
  AlertTriangle,
  FileSpreadsheet,
  Send,
  PhoneCall,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Download,
  Filter,
  Users,
  Rocket,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
interface BusinessCardData {
  id: number;
  name: string;
  nameReading?: string | null;
  company?: string | null;
  department?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  address?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  imageKey?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  registeredBy: number;
  createdAt: string;
  updatedAt: string;
}

interface CsvRow {
  name: string;
  nameReading?: string;
  company?: string;
  department?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  address?: string;
  website?: string;
}

// ============================================================
// Translations
// ============================================================
const translations = {
  ja: {
    title: "名刺管理",
    subtitle: "名刺・リード管理・営業ツール",
    tabCards: "名刺一覧",
    tabLeads: "リード収集",
    tabEmail: "メール配信",
    addNew: "名刺を追加",
    csvImport: "CSVインポート",
    search: "検索",
    searchPlaceholder: "名前、会社名、メールで検索...",
    noCards: "名刺がありません",
    noCardsDesc: "名刺をアップロードまたはCSVインポートで追加しましょう",
    uploadTitle: "名刺をアップロード",
    uploadDesc: "名刺の写真を撮影またはファイルを選択",
    takePhoto: "写真を撮影",
    selectFile: "ファイルを選択",
    analyzing: "AIが名刺を解析中...",
    confirmInfo: "情報を確認",
    confirmInfoDesc: "AIが抽出した情報を確認・修正してください",
    name: "氏名",
    nameReading: "読み仮名",
    company: "会社名",
    department: "部署",
    position: "役職",
    email: "メールアドレス",
    phone: "電話番号",
    mobile: "携帯電話",
    fax: "FAX",
    address: "住所",
    website: "ウェブサイト",
    notes: "メモ",
    save: "保存",
    cancel: "キャンセル",
    delete: "削除",
    edit: "編集",
    view: "詳細",
    registeredBy: "登録者",
    registeredAt: "登録日",
    duplicateWarning: "重複の可能性",
    duplicateDesc: "同じ名前と会社名の名刺が既に登録されています。それでも登録しますか？",
    forceRegister: "登録する",
    viewExisting: "既存の名刺を見る",
    deleteConfirm: "この名刺を削除しますか？",
    deleteDesc: "この操作は取り消せません。",
    // CSV Import
    csvImportTitle: "CSVインポート（Eight形式対応）",
    csvImportDesc: "EightからエクスポートしたCSVファイルを選択してください",
    csvSelectFile: "CSVファイルを選択",
    csvPreview: "プレビュー",
    csvImporting: "インポート中...",
    csvImportResult: "インポート結果",
    csvImported: "件インポート",
    csvSkipped: "件スキップ（重複）",
    csvTotal: "件中",
    // Email
    emailTitle: "メール一括配信",
    emailSubject: "件名",
    emailContent: "本文",
    emailSend: "送信",
    emailSending: "送信中...",
    emailSelectCards: "送信先を選択してください",
    emailNoEmail: "メールアドレスなし",
    emailSentSuccess: "メール送信完了",
    emailSelectedCount: "件選択中",
    // Phone
    phoneCall: "電話",
    phoneMemo: "通話メモ",
    phoneSaveMemo: "メモを保存",
    // Lead Collection
    leadTitle: "リード自動収集",
    leadDesc: "Google Maps・Google検索から美容ブランド等のリードを自動収集",
    leadTotal: "総リード数",
    leadWithEmail: "メールあり",
    leadSent: "送信済み",
    leadUnsent: "未送信",
    leadPrefectures: "都道府県数",
    leadCollecting: "収集中...",
    leadKeyword: "キーワード",
    leadPrefecture: "都道府県",
    leadGoogleMaps: "Google Maps",
    leadGoogleSearch: "Google検索",
    leadPortal: "ポータル",
    leadFullPipeline: "全パイプライン",
    // Status
    statusNew: "新規",
    statusContacted: "連絡済",
    statusResponded: "返信あり",
    statusConverted: "成約",
    statusRejected: "不成立",
  },
  zh: {
    title: "名片管理",
    subtitle: "名片・线索管理・营销工具",
    tabCards: "名片列表",
    tabLeads: "线索收集",
    tabEmail: "邮件群发",
    addNew: "添加名片",
    csvImport: "CSV导入",
    search: "搜索",
    searchPlaceholder: "按姓名、公司、邮箱搜索...",
    noCards: "暂无名片",
    noCardsDesc: "通过上传或CSV导入添加名片",
    uploadTitle: "上传名片",
    uploadDesc: "拍摄名片照片或选择文件",
    takePhoto: "拍照",
    selectFile: "选择文件",
    analyzing: "AI正在分析名片...",
    confirmInfo: "确认信息",
    confirmInfoDesc: "请确认并修正AI提取的信息",
    name: "姓名",
    nameReading: "读音",
    company: "公司名称",
    department: "部门",
    position: "职位",
    email: "邮箱",
    phone: "电话",
    mobile: "手机",
    fax: "传真",
    address: "地址",
    website: "网站",
    notes: "备注",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    view: "详情",
    registeredBy: "登记人",
    registeredAt: "登记日期",
    duplicateWarning: "可能重复",
    duplicateDesc: "已存在相同姓名和公司的名片。是否仍要登记？",
    forceRegister: "继续登记",
    viewExisting: "查看现有名片",
    deleteConfirm: "确定要删除这张名片吗？",
    deleteDesc: "此操作无法撤销。",
    csvImportTitle: "CSV导入（Eight格式）",
    csvImportDesc: "请选择从Eight导出的CSV文件",
    csvSelectFile: "选择CSV文件",
    csvPreview: "预览",
    csvImporting: "导入中...",
    csvImportResult: "导入结果",
    csvImported: "条已导入",
    csvSkipped: "条跳过（重复）",
    csvTotal: "条中",
    emailTitle: "邮件群发",
    emailSubject: "主题",
    emailContent: "正文",
    emailSend: "发送",
    emailSending: "发送中...",
    emailSelectCards: "请选择收件人",
    emailNoEmail: "无邮箱",
    emailSentSuccess: "邮件发送成功",
    emailSelectedCount: "条已选",
    phoneCall: "电话",
    phoneMemo: "通话备注",
    phoneSaveMemo: "保存备注",
    leadTitle: "线索自动收集",
    leadDesc: "从Google Maps/搜索自动收集美容品牌等线索",
    leadTotal: "总线索数",
    leadWithEmail: "有邮箱",
    leadSent: "已发送",
    leadUnsent: "未发送",
    leadPrefectures: "都道府县数",
    leadCollecting: "收集中...",
    leadKeyword: "关键词",
    leadPrefecture: "都道府县",
    leadGoogleMaps: "Google Maps",
    leadGoogleSearch: "Google搜索",
    leadPortal: "门户",
    leadFullPipeline: "全流程",
    statusNew: "新",
    statusContacted: "已联系",
    statusResponded: "已回复",
    statusConverted: "成交",
    statusRejected: "未成交",
  },
};

// ============================================================
// Prefectures list
// ============================================================
const PREFECTURES = [
  "全国", "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// ============================================================
// CSV Parser for Eight format
// ============================================================
function parseEightCsv(csvText: string): CsvRow[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Remove BOM if present
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(headerLine);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 4) continue;

    const getVal = (headerName: string) => {
      const idx = headers.findIndex((h) => h.trim() === headerName);
      return idx >= 0 ? values[idx]?.trim() || "" : "";
    };

    const lastName = getVal("姓");
    const firstName = getVal("名");
    const name = `${lastName} ${firstName}`.trim();
    if (!name) continue;

    // Phone priority: TEL直通 > TEL会社 > TEL部門
    const phoneDirect = getVal("TEL直通");
    const phoneCompany = getVal("TEL会社");
    const phoneDept = getVal("TEL部門");
    const phone = phoneDirect || phoneCompany || phoneDept;

    rows.push({
      name,
      company: getVal("会社名"),
      department: getVal("部署名"),
      position: getVal("役職"),
      email: getVal("e-mail"),
      phone,
      mobile: getVal("携帯電話"),
      fax: getVal("Fax"),
      address: getVal("住所"),
      website: getVal("URL"),
    });
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ============================================================
// Main Component
// ============================================================
export default function BusinessCards() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.ja;
  const utils = trpc.useUtils();

  // Tab state
  const [activeTab, setActiveTab] = useState("cards");

  // Card list state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [duplicateCard, setDuplicateCard] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<{ url: string; key: string } | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<any>({});
  const [formData, setFormData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // CSV Import state
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number; duplicates: string[] } | null>(null);

  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");

  // Phone state
  const [phoneMemo, setPhoneMemo] = useState("");

  // Lead collection state
  const [leadStats, setLeadStats] = useState<any>(null);
  const [leadKeyword, setLeadKeyword] = useState("美容 ディーラー");
  const [leadPrefecture, setLeadPrefecture] = useState("東京都");
  const [isCollecting, setIsCollecting] = useState<string | null>(null);
  const [leadMessage, setLeadMessage] = useState<string | null>(null);
  const [leadResults, setLeadResults] = useState<any[]>([]);

  // Queries
  const { data: cards = [], isLoading } = trpc.businessCard.list.useQuery({
    search: searchQuery || undefined,
  });

  // Mutations
  const uploadMutation = trpc.businessCard.upload.useMutation({
    onSuccess: (data) => {
      setUploadedImage({ url: data.imageUrl, key: data.imageKey });
      setExtractedInfo(data.extractedInfo);
      setFormData(data.extractedInfo);
      setIsAnalyzing(false);
      setIsUploadDialogOpen(false);
      setIsConfirmDialogOpen(true);
    },
    onError: (error) => {
      setIsAnalyzing(false);
      setIsUploadDialogOpen(false);
      toast.error(error.message || "名刺解析に失敗しました");
    },
  });

  const createMutation = trpc.businessCard.create.useMutation({
    onSuccess: (data) => {
      if (data.duplicate && data.existingCard) {
        setDuplicateCard(data.existingCard);
        setIsDuplicateDialogOpen(true);
      } else {
        toast.success("名刺を保存しました");
        setIsConfirmDialogOpen(false);
        resetForm();
        utils.businessCard.list.invalidate();
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.businessCard.update.useMutation({
    onSuccess: () => {
      toast.success("名刺を更新しました");
      setIsEditDialogOpen(false);
      utils.businessCard.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.businessCard.delete.useMutation({
    onSuccess: () => {
      toast.success("名刺を削除しました");
      setIsDeleteDialogOpen(false);
      setSelectedCard(null);
      utils.businessCard.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const importCsvMutation = trpc.businessCard.importCsv.useMutation({
    onSuccess: (data) => {
      setCsvImporting(false);
      setCsvResult(data);
      toast.success(`${data.imported}件インポート完了`);
      utils.businessCard.list.invalidate();
    },
    onError: (error) => {
      setCsvImporting(false);
      toast.error(error.message);
    },
  });

  const sendBulkEmailMutation = trpc.businessCard.sendBulkEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sentCount}件にメール送信完了`);
      setIsEmailDialogOpen(false);
      setEmailSubject("");
      setEmailContent("");
      setSelectedCardIds(new Set());
    },
    onError: (error) => toast.error(error.message),
  });

  // Load lead stats from Sales Dash API
  useEffect(() => {
    fetch("https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeadStats")
      .then((r) => r.json())
      .then((d) => {
        if (d?.result?.data?.json) {
          setLeadStats(d.result.data.json);
        }
      })
      .catch(() => {});
  }, []);

  // Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("ファイルが大きすぎます。10MB以下の画像を選択してください");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    setIsAnalyzing(true);
    setIsUploadDialogOpen(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        uploadMutation.mutate({ imageBase64: base64, mimeType: file.type });
      } catch {
        setIsAnalyzing(false);
        setIsUploadDialogOpen(false);
        toast.error("ファイルの読み込みに失敗しました");
      }
    };
    reader.onerror = () => {
      setIsAnalyzing(false);
      setIsUploadDialogOpen(false);
      toast.error("ファイルの読み込みに失敗しました");
    };
    reader.readAsDataURL(file);
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseEightCsv(text);
      setCsvRows(rows);
      setCsvResult(null);
      setIsCsvDialogOpen(true);
    };
    reader.readAsText(file, "UTF-8");
    // Reset input
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const handleCsvImport = () => {
    if (csvRows.length === 0) return;
    setCsvImporting(true);
    importCsvMutation.mutate({ cards: csvRows });
  };

  const handleSave = () => {
    createMutation.mutate({
      ...formData,
      imageUrl: uploadedImage?.url,
      imageKey: uploadedImage?.key,
    });
  };

  const handleForceRegister = () => {
    setIsDuplicateDialogOpen(false);
    const uniqueFormData = {
      ...formData,
      notes: `${formData.notes || ""}\n[重複登録: ${new Date().toLocaleString()}]`.trim(),
    };
    createMutation.mutate({
      ...uniqueFormData,
      imageUrl: uploadedImage?.url,
      imageKey: uploadedImage?.key,
    });
  };

  const handleUpdate = () => {
    if (!selectedCard) return;
    updateMutation.mutate({ id: selectedCard.id, ...formData });
  };

  const handleDelete = () => {
    if (!selectedCard) return;
    deleteMutation.mutate({ id: selectedCard.id });
  };

  const handleSendBulkEmail = () => {
    if (selectedCardIds.size === 0 || !emailSubject || !emailContent) return;
    sendBulkEmailMutation.mutate({
      cardIds: Array.from(selectedCardIds),
      subject: emailSubject,
      content: emailContent,
    });
  };

  const handlePhoneCall = (card: any) => {
    const phoneNumber = card.phone || card.mobile;
    if (phoneNumber) {
      window.open(`tel:${phoneNumber.replace(/[-\s]/g, "")}`, "_self");
    }
    setSelectedCard(card);
    setPhoneMemo("");
    setIsPhoneDialogOpen(true);
  };

  const handleSavePhoneMemo = () => {
    if (!selectedCard || !phoneMemo) return;
    const existingNotes = selectedCard.notes || "";
    const newNotes = `${existingNotes}\n[通話メモ ${new Date().toLocaleString()}] ${phoneMemo}`.trim();
    updateMutation.mutate({ id: selectedCard.id, notes: newNotes });
    setIsPhoneDialogOpen(false);
    setPhoneMemo("");
  };

  const handleLeadCollect = async (source: string) => {
    setIsCollecting(source);
    setLeadMessage(null);
    try {
      let endpoint = "";
      const params: any = { keyword: leadKeyword, prefecture: leadPrefecture };
      switch (source) {
        case "google_maps":
          endpoint = "btobLeadProspector.collectGoogleMaps";
          break;
        case "google_search":
          endpoint = "btobLeadProspector.collectGoogleSearch";
          break;
        case "portals":
          endpoint = "btobLeadProspector.collectPortals";
          break;
        case "full_pipeline":
          endpoint = "btobLeadProspector.runFullPipeline";
          break;
      }
      const res = await fetch(`https://salesdash.buzzdrop.co.jp/api/trpc/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: params }),
      });
      const data = await res.json();
      if (data?.result?.data?.json) {
        const result = data.result.data.json;
        setLeadMessage(`収集完了: ${result.newLeads || result.collected || 0}件の新規リード`);
        // Refresh stats
        const statsRes = await fetch("https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeadStats");
        const statsData = await statsRes.json();
        if (statsData?.result?.data?.json) setLeadStats(statsData.result.data.json);
      } else {
        setLeadMessage("バックグラウンドで収集を開始しました");
      }
    } catch (err: any) {
      setLeadMessage(`エラー: ${err.message}`);
    }
    setIsCollecting(null);
  };

  // Load leads from Sales Dash
  const loadLeads = useCallback(async () => {
    try {
      const params = encodeURIComponent(JSON.stringify({ json: { limit: 50, hasEmail: true } }));
      const res = await fetch(`https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeads?input=${params}`);
      const data = await res.json();
      if (data?.result?.data?.json?.rows) {
        setLeadResults(data.result.data.json.rows);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === "leads") {
      loadLeads();
    }
  }, [activeTab, loadLeads]);

  const resetForm = () => {
    setUploadedImage(null);
    setExtractedInfo({});
    setFormData({});
    setSelectedCard(null);
    setDuplicateCard(null);
  };

  const openEditDialog = (card: any) => {
    setSelectedCard(card);
    setFormData({
      name: card.name,
      nameReading: card.nameReading,
      company: card.company,
      department: card.department,
      position: card.position,
      email: card.email,
      phone: card.phone,
      mobile: card.mobile,
      fax: card.fax,
      address: card.address,
      website: card.website,
      notes: card.notes,
    });
    setIsEditDialogOpen(true);
  };

  const toggleCardSelection = (id: number) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCardIds.size === cards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(cards.map((c) => c.id)));
    }
  };

  const cardsWithEmail = useMemo(() => cards.filter((c) => c.email), [cards]);
  const selectedCardsWithEmail = useMemo(
    () => cards.filter((c) => selectedCardIds.has(c.id) && c.email),
    [cards, selectedCardIds]
  );

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">名刺数</p>
                <p className="text-2xl font-bold text-blue-700">{cards.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">メールあり</p>
                <p className="text-2xl font-bold text-green-700">{cardsWithEmail.length}</p>
              </div>
              <Mail className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-medium">電話あり</p>
                <p className="text-2xl font-bold text-orange-700">
                  {cards.filter((c) => c.phone || c.mobile).length}
                </p>
              </div>
              <Phone className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">リード数</p>
                <p className="text-2xl font-bold text-purple-700">
                  {leadStats?.total?.toLocaleString() || "—"}
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-pink-600 font-medium">選択中</p>
                <p className="text-2xl font-bold text-pink-700">{selectedCardIds.size}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-pink-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cards" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t.tabCards}
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {t.tabLeads}
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t.tabEmail}
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB: 名刺一覧 */}
        {/* ============================================================ */}
        <TabsContent value="cards" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              {t.csvImport}
            </Button>
            <Button size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()}>
              <Camera className="h-4 w-4 mr-1" />
              {t.takePhoto}
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-4 w-4 mr-1" />
              {t.addNew}
            </Button>
            {selectedCardIds.size > 0 && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setIsEmailDialogOpen(true)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  メール送信 ({selectedCardsWithEmail.length})
                </Button>
              </>
            )}
          </div>

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvSelect} />

          {/* Cards Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cards.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <CreditCard className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t.noCards}</h3>
                <p className="text-muted-foreground mb-4">{t.noCardsDesc}</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {t.csvImport}
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    {t.selectFile}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedCardIds.size === cards.length && cards.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>{t.name}</TableHead>
                      <TableHead>{t.company}</TableHead>
                      <TableHead>{t.position}</TableHead>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.phone}</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((card) => (
                      <TableRow key={card.id} className={selectedCardIds.has(card.id) ? "bg-blue-50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCardIds.has(card.id)}
                            onCheckedChange={() => toggleCardSelection(card.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {card.imageUrl ? (
                              <img src={card.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="break-all">{card.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{card.company || "—"}</TableCell>
                        <TableCell className="text-sm">{card.position || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {card.email ? (
                            <a href={`mailto:${card.email}`} className="text-blue-600 hover:underline text-xs">
                              {card.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(card.phone || card.mobile) ? (
                            <button
                              onClick={() => handlePhoneCall(card)}
                              className="text-green-600 hover:underline flex items-center gap-1 text-xs"
                            >
                              <PhoneCall className="h-3 w-3" />
                              {card.phone || card.mobile}
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setSelectedCard(card); setIsDetailDialogOpen(true); }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(card)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => { setSelectedCard(card); setIsDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: リード収集 */}
        {/* ============================================================ */}
        <TabsContent value="leads" className="space-y-4">
          {/* Lead Stats */}
          {leadStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-600 font-medium">{t.leadTotal}</p>
                  <p className="text-xl font-bold text-blue-700">{leadStats.total?.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-3">
                  <p className="text-xs text-green-600 font-medium">{t.leadWithEmail}</p>
                  <p className="text-xl font-bold text-green-700">{leadStats.withEmail?.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <CardContent className="p-3">
                  <p className="text-xs text-emerald-600 font-medium">{t.leadSent}</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {leadStats.byStatus?.find((s: any) => s.status === "contacted")?.count || 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
                <CardContent className="p-3">
                  <p className="text-xs text-pink-600 font-medium">{t.leadUnsent}</p>
                  <p className="text-xl font-bold text-pink-700">
                    {(leadStats.withEmail || 0) - (leadStats.byStatus?.find((s: any) => s.status === "contacted")?.count || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-3">
                  <p className="text-xs text-purple-600 font-medium">{t.leadPrefectures}</p>
                  <p className="text-xl font-bold text-purple-700">
                    {leadStats.bySource?.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lead Collection Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Rocket className="h-4 w-4 text-orange-500" />
                {t.leadTitle}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t.leadDesc}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Select value={leadPrefecture} onValueChange={setLeadPrefecture}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREFECTURES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-48 h-8 text-xs"
                  placeholder={t.leadKeyword}
                  value={leadKeyword}
                  onChange={(e) => setLeadKeyword(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  size="sm"
                  className="h-9 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={!!isCollecting}
                  onClick={() => handleLeadCollect("google_maps")}
                >
                  {isCollecting === "google_maps" ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <MapPin className="h-3 w-3 mr-1" />
                  )}
                  {t.leadGoogleMaps}
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-green-600 hover:bg-green-700"
                  disabled={!!isCollecting}
                  onClick={() => handleLeadCollect("google_search")}
                >
                  {isCollecting === "google_search" ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Globe className="h-3 w-3 mr-1" />
                  )}
                  {t.leadGoogleSearch}
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-purple-600 hover:bg-purple-700"
                  disabled={!!isCollecting}
                  onClick={() => handleLeadCollect("portals")}
                >
                  {isCollecting === "portals" ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Building2 className="h-3 w-3 mr-1" />
                  )}
                  {t.leadPortal}
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                  disabled={!!isCollecting}
                  onClick={() => handleLeadCollect("full_pipeline")}
                >
                  {isCollecting === "full_pipeline" ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Rocket className="h-3 w-3 mr-1" />
                  )}
                  {t.leadFullPipeline}
                </Button>
              </div>
              {leadMessage && (
                <div className="text-xs p-2 bg-blue-50 rounded border border-blue-200 text-blue-700">
                  {leadMessage}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Results Table */}
          {leadResults.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">最新リード一覧（メールあり・上位50件）</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>会社名</TableHead>
                        <TableHead>メール</TableHead>
                        <TableHead>電話</TableHead>
                        <TableHead>都道府県</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead>収集元</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadResults.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium text-sm">
                            {lead.website ? (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {lead.companyName}
                              </a>
                            ) : (
                              lead.companyName
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.email ? (
                              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                                {lead.email}
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.phone ? (
                              <a href={`tel:${lead.phone}`} className="text-green-600 hover:underline flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" />
                                {lead.phone}
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{lead.prefecture || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={lead.status === "contacted" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {lead.status === "new" ? t.statusNew :
                               lead.status === "contacted" ? t.statusContacted :
                               lead.status === "responded" ? t.statusResponded :
                               lead.status === "converted" ? t.statusConverted :
                               lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {lead.source === "google_maps" ? "Maps" :
                               lead.source === "manual" ? "手動" :
                               lead.source === "google_search" ? "検索" :
                               lead.source}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground text-center">
            ※ リードデータは <a href="https://salesdash.buzzdrop.co.jp/command-center/japan/eccube?store=KYOGOKU+%E8%87%AA%E7%A4%BEEC&tab=btob&subtab=leads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sales Dash BtoB営業司令塔</a> と連携しています
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: メール配信 */}
        {/* ============================================================ */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-green-600" />
                {t.emailTitle}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                名刺一覧タブでチェックボックスを使って送信先を選択してから、メールを作成・送信できます
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected recipients */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">
                  送信先: {selectedCardsWithEmail.length}件
                  {selectedCardIds.size > 0 && selectedCardIds.size !== selectedCardsWithEmail.length && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({selectedCardIds.size - selectedCardsWithEmail.length}件はメールアドレスなし)
                    </span>
                  )}
                </p>
                {selectedCardsWithEmail.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedCardsWithEmail.slice(0, 10).map((card) => (
                      <Badge key={card.id} variant="secondary" className="text-xs">
                        {card.name} &lt;{card.email}&gt;
                      </Badge>
                    ))}
                    {selectedCardsWithEmail.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedCardsWithEmail.length - 10}件
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    「名刺一覧」タブで送信先を選択してください
                  </p>
                )}
              </div>

              {/* Email form */}
              <div className="space-y-3">
                <div>
                  <Label>{t.emailSubject}</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="メールの件名を入力..."
                  />
                </div>
                <div>
                  <Label>{t.emailContent}</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="メール本文を入力..."
                    rows={10}
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={
                    selectedCardsWithEmail.length === 0 ||
                    !emailSubject ||
                    !emailContent ||
                    sendBulkEmailMutation.isPending
                  }
                  onClick={handleSendBulkEmail}
                >
                  {sendBulkEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {selectedCardsWithEmail.length}件に送信
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOGS */}
      {/* ============================================================ */}

      {/* Upload/Analyzing Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.uploadTitle}</DialogTitle>
          </DialogHeader>
          {isAnalyzing && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">{t.analyzing}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Info Dialog (after OCR) */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.confirmInfo}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t.confirmInfoDesc}</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {uploadedImage && (
              <div className="flex justify-center">
                <img src={uploadedImage.url} alt="Business card" className="max-h-48 rounded border" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.name} *</Label>
                <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>{t.nameReading}</Label>
                <Input value={formData.nameReading || ""} onChange={(e) => setFormData({ ...formData, nameReading: e.target.value })} />
              </div>
              <div>
                <Label>{t.company}</Label>
                <Input value={formData.company || ""} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
              </div>
              <div>
                <Label>{t.department}</Label>
                <Input value={formData.department || ""} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
              </div>
              <div>
                <Label>{t.position}</Label>
                <Input value={formData.position || ""} onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
              </div>
              <div>
                <Label>{t.email}</Label>
                <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>{t.phone}</Label>
                <Input value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <Label>{t.mobile}</Label>
                <Input value={formData.mobile || ""} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} />
              </div>
              <div>
                <Label>{t.fax}</Label>
                <Input value={formData.fax || ""} onChange={(e) => setFormData({ ...formData, fax: e.target.value })} />
              </div>
              <div>
                <Label>{t.website}</Label>
                <Input value={formData.website || ""} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t.address}</Label>
              <Input value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Textarea value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleSave} disabled={!formData.name || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedCard?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              {selectedCard.imageUrl && (
                <div className="flex justify-center">
                  <img src={selectedCard.imageUrl} alt={selectedCard.name} className="max-h-48 rounded border" />
                </div>
              )}
              <div className="grid gap-3">
                {selectedCard.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.company}</p>
                      <p>{selectedCard.company}</p>
                    </div>
                  </div>
                )}
                {selectedCard.department && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.department}</p>
                      <p>{selectedCard.department}</p>
                    </div>
                  </div>
                )}
                {selectedCard.position && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.position}</p>
                      <p>{selectedCard.position}</p>
                    </div>
                  </div>
                )}
                {selectedCard.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.email}</p>
                      <a href={`mailto:${selectedCard.email}`} className="text-primary hover:underline">{selectedCard.email}</a>
                    </div>
                  </div>
                )}
                {(selectedCard.phone || selectedCard.mobile) && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.phone}</p>
                      <button
                        onClick={() => handlePhoneCall(selectedCard)}
                        className="text-green-600 hover:underline flex items-center gap-1"
                      >
                        <PhoneCall className="h-4 w-4" />
                        {selectedCard.phone || selectedCard.mobile}
                      </button>
                    </div>
                  </div>
                )}
                {selectedCard.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.address}</p>
                      <p>{selectedCard.address}</p>
                    </div>
                  </div>
                )}
                {selectedCard.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.website}</p>
                      <a href={selectedCard.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {selectedCard.website}
                      </a>
                    </div>
                  </div>
                )}
                {selectedCard.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.notes}</p>
                    <p className="whitespace-pre-wrap text-sm">{selectedCard.notes}</p>
                  </div>
                )}
                <div className="text-sm text-muted-foreground pt-2 border-t">
                  {t.registeredAt}: {new Date(selectedCard.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={() => { setIsDetailDialogOpen(false); openEditDialog(selectedCard); }}>
              <Edit className="h-4 w-4 mr-2" />
              {t.edit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.name} *</Label>
                <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>{t.nameReading}</Label>
                <Input value={formData.nameReading || ""} onChange={(e) => setFormData({ ...formData, nameReading: e.target.value })} />
              </div>
              <div>
                <Label>{t.company}</Label>
                <Input value={formData.company || ""} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
              </div>
              <div>
                <Label>{t.department}</Label>
                <Input value={formData.department || ""} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
              </div>
              <div>
                <Label>{t.position}</Label>
                <Input value={formData.position || ""} onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
              </div>
              <div>
                <Label>{t.email}</Label>
                <Input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>{t.phone}</Label>
                <Input value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <Label>{t.mobile}</Label>
                <Input value={formData.mobile || ""} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} />
              </div>
              <div>
                <Label>{t.fax}</Label>
                <Input value={formData.fax || ""} onChange={(e) => setFormData({ ...formData, fax: e.target.value })} />
              </div>
              <div>
                <Label>{t.website}</Label>
                <Input value={formData.website || ""} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t.address}</Label>
              <Input value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Textarea value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleUpdate} disabled={!formData.name || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              {t.csvImportTitle}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{t.csvImportDesc}</p>
          </DialogHeader>

          {csvResult ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">{t.csvImportResult}</p>
                  <p className="text-sm text-green-700">
                    {csvRows.length}{t.csvTotal} {csvResult.imported}{t.csvImported} / {csvResult.skipped}{t.csvSkipped}
                  </p>
                </div>
              </div>
              {csvResult.duplicates.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">スキップされた名刺:</p>
                  {csvResult.duplicates.map((d, i) => (
                    <span key={i} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-yellow-50 rounded text-yellow-700">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {csvRows.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t.csvPreview}: {csvRows.length}件</p>
                  </div>
                  <ScrollArea className="h-[300px] border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">{t.name}</TableHead>
                          <TableHead className="text-xs">{t.company}</TableHead>
                          <TableHead className="text-xs">{t.position}</TableHead>
                          <TableHead className="text-xs">{t.email}</TableHead>
                          <TableHead className="text-xs">{t.phone}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvRows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{i + 1}</TableCell>
                            <TableCell className="text-xs font-medium">{row.name}</TableCell>
                            <TableCell className="text-xs">{row.company || "—"}</TableCell>
                            <TableCell className="text-xs">{row.position || "—"}</TableCell>
                            <TableCell className="text-xs">{row.email || "—"}</TableCell>
                            <TableCell className="text-xs">{row.phone || row.mobile || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCsvDialogOpen(false); setCsvRows([]); setCsvResult(null); }}>
              {csvResult ? "閉じる" : t.cancel}
            </Button>
            {!csvResult && csvRows.length > 0 && (
              <Button onClick={handleCsvImport} disabled={csvImporting}>
                {csvImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {csvImporting ? t.csvImporting : `${csvRows.length}件をインポート`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Call Dialog */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-600" />
              {t.phoneCall}: {selectedCard?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-green-700" />
                  <span className="text-sm font-medium text-green-800">{selectedCard.company || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-700" />
                  <a
                    href={`tel:${(selectedCard.phone || selectedCard.mobile || "").replace(/[-\s]/g, "")}`}
                    className="text-lg font-bold text-green-700 hover:underline"
                  >
                    {selectedCard.phone || selectedCard.mobile}
                  </a>
                </div>
                {selectedCard.mobile && selectedCard.phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-green-600" />
                    <a
                      href={`tel:${selectedCard.mobile.replace(/[-\s]/g, "")}`}
                      className="text-sm text-green-600 hover:underline"
                    >
                      携帯: {selectedCard.mobile}
                    </a>
                  </div>
                )}
              </div>
              <div>
                <Label>{t.phoneMemo}</Label>
                <Textarea
                  value={phoneMemo}
                  onChange={(e) => setPhoneMemo(e.target.value)}
                  placeholder="通話内容をメモ..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPhoneDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleSavePhoneMemo} disabled={!phoneMemo || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <MessageSquare className="h-4 w-4 mr-2" />
              {t.phoneSaveMemo}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog (quick send from card list) */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              メール一括送信
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">送信先: {selectedCardsWithEmail.length}件</p>
              <div className="flex flex-wrap gap-1">
                {selectedCardsWithEmail.slice(0, 5).map((card) => (
                  <Badge key={card.id} variant="secondary" className="text-xs">
                    {card.name}
                  </Badge>
                ))}
                {selectedCardsWithEmail.length > 5 && (
                  <Badge variant="outline" className="text-xs">+{selectedCardsWithEmail.length - 5}件</Badge>
                )}
              </div>
            </div>
            <div>
              <Label>{t.emailSubject}</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="件名を入力..."
              />
            </div>
            <div>
              <Label>{t.emailContent}</Label>
              <Textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder="本文を入力..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>{t.cancel}</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSendBulkEmail}
              disabled={!emailSubject || !emailContent || sendBulkEmailMutation.isPending}
            >
              {sendBulkEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {selectedCardsWithEmail.length}件に送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t.duplicateWarning}
            </AlertDialogTitle>
            <AlertDialogDescription>{t.duplicateDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          {duplicateCard && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p><strong>{duplicateCard.name}</strong></p>
              <p>{duplicateCard.company}</p>
              <p className="text-muted-foreground">{duplicateCard.email}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDuplicateDialogOpen(false);
              if (duplicateCard) {
                setSelectedCard(duplicateCard);
                setIsDetailDialogOpen(true);
              }
            }}>
              {t.viewExisting}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleForceRegister}>
              {t.forceRegister}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
