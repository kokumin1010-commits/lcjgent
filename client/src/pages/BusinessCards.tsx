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
  PlayCircle,
  SkipForward,
  SkipBack,
  PhoneOff,
  RefreshCw,
  TrendingUp,
  Store,
  ExternalLink,
  ArrowUpDown,
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
    title: "名刺管理(TO B 営業)",
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
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    const [emailSubject, setEmailSubject] = useState("{{displayName}}へ ― 無料ライブコマース診断のご案内｜即売上につながる新チャネル");
  const [emailContent, setEmailContent] = useState("突然のご連絡失礼いたします。\n株式会社ライブコマースジャパンの大久保と申します。\n\n貴社のことを拝見し、ぜひ一度お話しさせていただきたくご連絡いたしました。\n\n弊社は日本最大級のライブコマース専門企業として、\nこれまで数百社以上のブランド様のライブ販売を支援してまいりました。\n\n■ なぜ今、ライブコマースなのか？\n\n・配信初日から売上が立つ即効性\n・広告費ゼロでも顧客と直接つながれる\n・ECの「カゴ落ち率」を大幅に改善\n・ファン化による高いリピート率\n\n実際に導入企業様からは、\n「初回配信で月商の10%を1時間で達成した」\n「広告CPAが従来の1/3になった」\nといったお声を多数いただいております。\n\n■ 無料ライブコマース診断のご提案\n\n貴社の商品・ブランドに最適なライブコマース戦略を、\n完全無料で診断させていただきます。\n\n・貴社に合った配信プラットフォームのご提案\n・想定売上シミュレーション\n・競合のライブコマース活用状況の分析\n・最短で成果を出すためのロードマップ\n\n■ 15分のオンラインご紹介\n\nお忙しいところ恐縮ですが、\nZoomまたはGoogle Meetにて15分ほどお時間をいただき、\n貴社に合ったライブコマース活用法をご紹介させていただけないでしょうか。\n\nまた、弊社では広告運用代行も承っており、\nライブコマース×広告の相乗効果で最短での売上最大化が可能です。\n\nご都合の良い日時を2〜3候補いただければ、\nこちらで調整いたします。\n\nご多忙のところ恐れ入りますが、\nご検討いただけますと幸いです。")
  const [emailTemplateMode, setEmailTemplateMode] = useState<"edit" | "preview">("edit");
  // Phone state
  const [phoneMemo, setPhoneMemo] = useState("");
  const [phoneResult, setPhoneResult] = useState<string>("answered");
  const [phoneNextFollowUp, setPhoneNextFollowUp] = useState<string>("");
  const [isCallLogDialogOpen, setIsCallLogDialogOpen] = useState(false);

  // Image zoom state
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Lead collection state
  const [leadStats, setLeadStats] = useState<any>(null);
  const [leadKeyword, setLeadKeyword] = useState("美容 ディーラー");
  const [leadPrefecture, setLeadPrefecture] = useState("東京都");
  const [isCollecting, setIsCollecting] = useState<string | null>(null);
  const [leadMessage, setLeadMessage] = useState<string | null>(null);
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [leadViewTab, setLeadViewTab] = useState<"active" | "rejected">("active");
  const [isCallListMode, setIsCallListMode] = useState(false);
  const [callListIndex, setCallListIndex] = useState(0);
  const [callListLeads, setCallListLeads] = useState<any[]>([]);
  const [bdBrands, setBdBrands] = useState<any[]>([]);
  const [bdBrandFilter, setBdBrandFilter] = useState<string>("all");
  const [unsentLeads, setUnsentLeads] = useState<any[]>([]);
  const [unsentTotal, setUnsentTotal] = useState(0);
  const [isLoadingUnsent, setIsLoadingUnsent] = useState(false);

  // Kalodata tab state
  const [kalodataLeads, setKalodataLeads] = useState<any[]>([]);
  const [kalodataLoading, setKalodataLoading] = useState(false);
  const [kalodataSearch, setKalodataSearch] = useState("");
  const [kalodataSort, setKalodataSort] = useState<"name" | "revenue" | "status">("name");
  const [kalodataPage, setKalodataPage] = useState(0);
  const [kalodataTotal, setKalodataTotal] = useState(0);
  const [kalodataStats, setKalodataStats] = useState<{total: number; withEmail: number; withPhone: number; contacted: number}>({total: 0, withEmail: 0, withPhone: 0, contacted: 0});

  // Queries
  const { data: cards = [], isLoading } = trpc.businessCard.list.useQuery({
    search: searchQuery || undefined,
    limit: 2500,
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

  // Send email to leads mutation
  const sendToLeadsMutation = trpc.businessCard.sendEmailToLeads.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sentCount}件のリードにメール送信完了`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSendToLeads = () => {
    if (!emailSubject || !emailContent) return;
    const leadsWithEmail = leadResults.filter(l => l.email);
    if (leadsWithEmail.length === 0) return;
    sendToLeadsMutation.mutate({
      emails: leadsWithEmail.map(l => ({ email: l.email!, displayName: l.companyName || "" })),
      subject: emailSubject,
      content: emailContent,
    });
  };

  // 未送信リード全件取得
  const loadUnsentLeads = useCallback(async () => {
    setIsLoadingUnsent(true);
    try {
      const filter = { notSent: true, hasEmail: true, status: "new", limit: 5000 };
      const params = encodeURIComponent(JSON.stringify({ json: filter }));
      const res = await fetch(`https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeads?input=${params}`);
      const data = await res.json();
      if (data?.result?.data?.json?.rows) {
        setUnsentLeads(data.result.data.json.rows);
        setUnsentTotal(data.result.data.json.total);
      }
    } catch (e) {
      console.error("Failed to load unsent leads:", e);
    } finally {
      setIsLoadingUnsent(false);
    }
  }, []);

  // 未送信リードに一括送信
  const handleSendToUnsentLeads = () => {
    if (!emailSubject || !emailContent) return;
    const leadsWithEmail = unsentLeads.filter(l => l.email);
    if (leadsWithEmail.length === 0) return;
    sendToLeadsMutation.mutate({
      emails: leadsWithEmail.map(l => ({ email: l.email!, displayName: l.companyName || "" })),
      subject: emailSubject,
      content: emailContent,
    });
  };

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
    // Load BD brands from lcjmall
    fetch("https://lcjmall.com/api/trpc/brand.list")
      .then((r) => r.json())
      .then((d) => {
        if (d?.result?.data?.json) {
          setBdBrands(d.result.data.json.filter((b: any) => b.name));
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

    // CRM Call Log mutation
  const createCallLogMutation = trpc.businessCard.createCallLog.useMutation({
    onSuccess: () => {
      toast.success("通話記録を保存しました");
      setIsPhoneDialogOpen(false);
      setPhoneMemo("");
      setPhoneResult("answered");
      setPhoneNextFollowUp("");
      utils.businessCard.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handlePhoneCall = (card: any) => {
    const phoneNumber = card.phone || card.mobile;
    if (phoneNumber) {
      window.open(`tel:${phoneNumber.replace(/[-\s]/g, "")}`, "_self");
    }
    setSelectedCard(card);
    setPhoneMemo("");
    setPhoneResult("answered");
    setPhoneNextFollowUp("");
    setIsPhoneDialogOpen(true);
  };
  const handleSavePhoneMemo = async () => {
    if (!selectedCard) return;
    // If this is a lead from salesdash, update its status there too
    if (selectedCard._isLead && selectedCard._leadId) {
      const statusMap: Record<string, string> = {
        "answered": "contacted",
        "meeting_set": "converted",
        "rejected": "rejected",
        "no_answer": "contacted",
        "busy": "new",
        "callback": "new",
      };
      const newStatus = statusMap[phoneResult] || "contacted";
      await updateLeadStatus(selectedCard._leadId, newStatus);
      // Remove from current list
      setLeadResults(prev => prev.filter(l => l.id !== selectedCard._leadId));
    }
    createCallLogMutation.mutate({
      businessCardId: selectedCard.id,
      result: phoneResult as any,
      memo: phoneMemo || undefined,
      nextFollowUpAt: phoneNextFollowUp || undefined,
    });
  };

  const loadLeads = useCallback(async (statusFilter?: string) => {
    try {
      const filter: any = { limit: 200, hasEmail: true };
      if (statusFilter) filter.status = statusFilter;
      const params = encodeURIComponent(JSON.stringify({ json: filter }));
      const res = await fetch(`https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeads?input=${params}`);
      const data = await res.json();
      if (data?.result?.data?.json?.rows) {
        setLeadResults(data.result.data.json.rows);
      }
    } catch {}
  }, []);

  // Kalodata leads loader
  const loadKalodataLeads = useCallback(async () => {
    setKalodataLoading(true);
    try {
      const filter: any = { source: "kalodata_tiktok", limit: 5000 };
      if (kalodataSearch) filter.search = kalodataSearch;
      const params = encodeURIComponent(JSON.stringify({ json: filter }));
      const res = await fetch(`https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeads?input=${params}`);
      const data = await res.json();
      if (data?.result?.data?.json?.rows) {
        const rows = data.result.data.json.rows;
        setKalodataLeads(rows);
        setKalodataTotal(rows.length);
        // Calculate stats
        setKalodataStats({
          total: rows.length,
          withEmail: rows.filter((r: any) => r.email).length,
          withPhone: rows.filter((r: any) => r.phone).length,
          contacted: rows.filter((r: any) => r.status === "contacted").length,
        });
      }
    } catch (err) {
      console.error("Failed to load Kalodata leads:", err);
    }
    setKalodataLoading(false);
  }, [kalodataSearch]);

  useEffect(() => {
    if (activeTab === "kalodata") {
      loadKalodataLeads();
    }
  }, [activeTab, loadKalodataLeads]);
  useEffect(() => {
    if (activeTab === "leads") {
      if (leadViewTab === "rejected") {
        loadLeads("rejected");
      } else {
        loadLeads("new");
      }
    }
  }, [activeTab, loadLeads, leadViewTab]);
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
    // Auto-refresh leads after collection
    setTimeout(() => loadLeads(leadViewTab === "rejected" ? "rejected" : "new"), 3000);
    setTimeout(() => loadLeads(leadViewTab === "rejected" ? "rejected" : "new"), 8000);
    setTimeout(() => loadLeads(leadViewTab === "rejected" ? "rejected" : "new"), 15000);
  };

  // Update lead status on salesdash when marking as handled
  const updateLeadStatus = async (leadId: number, status: string) => {
    try {
      await fetch("https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.updateLead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { id: leadId, data: { status } } }),
      });
    } catch (e) {
      console.error("[Lead] Failed to update status:", e);
    }
  };

  // Start call list mode
  const startCallListMode = () => {
    const activeLeads = leadResults.filter(l => l.phone);
    if (activeLeads.length === 0) {
      toast.error("電話番号のあるリードがありません");
      return;
    }
    setCallListLeads(activeLeads);
    setCallListIndex(0);
    setIsCallListMode(true);
  };

  // Handle call list save and advance
  const handleCallListSave = async () => {
    const currentLead = callListLeads[callListIndex];
    if (!currentLead) return;
    // Update status on salesdash
    const statusMap: Record<string, string> = {
      "answered": "contacted",
      "meeting_set": "converted",
      "rejected": "rejected",
      "no_answer": "contacted",
      "busy": "new",
      "callback": "new",
    };
    const newStatus = statusMap[phoneResult] || "contacted";
    await updateLeadStatus(currentLead.id, newStatus);
    // Save call log locally
    createCallLogMutation.mutate({
      businessCardId: currentLead.id,
      result: phoneResult as any,
      memo: phoneMemo || undefined,
      nextFollowUpAt: phoneNextFollowUp || undefined,
    });
    // Advance to next
    if (callListIndex < callListLeads.length - 1) {
      setCallListIndex(callListIndex + 1);
      setPhoneMemo("");
      setPhoneResult("answered");
      setPhoneNextFollowUp("");
    } else {
      toast.success("全件対応完了！");
      setIsCallListMode(false);
      loadLeads("new");
    }
  };


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

  // Derived data: unique companies for filter
  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    cards.forEach((c) => { if (c.company) companies.add(c.company); });
    return Array.from(companies).sort();
  }, [cards]);

  const getCardStatus = useCallback((card: any): string => {
    // salesStatusカラム優先、なければtagsから後方互換
    if (card.salesStatus) return card.salesStatus;
    return card.tags?.find((t: string) => t.startsWith("status:"))?.replace("status:", "") || "new";
  }, []);

  // Filtered cards by company and status
  const filteredCards = useMemo(() => {
    let result = cards;
    if (companyFilter !== "all") {
      result = result.filter((c) => c.company === companyFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => {
        const cardStatus = getCardStatus(c);
        return cardStatus === statusFilter;
      });
    }
    return result;
  }, [cards, companyFilter, statusFilter, getCardStatus]);

  const cardsWithEmail = useMemo(() => cards.filter((c) => c.email), [cards]);
  const selectedCardsWithEmail = useMemo(
    () => cards.filter((c) => selectedCardIds.has(c.id) && c.email),
    [cards, selectedCardIds]
  );

  // Status change handler (CRM API)
  const updateStatusMutation = trpc.businessCard.updateSalesStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      utils.businessCard.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleStatusChange = (cardId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: cardId, salesStatus: newStatus as any });
  };

  const statusOptions = [
    { value: "new", label: "新規", color: "bg-gray-100 text-gray-700" },
    { value: "contacted", label: "架電済", color: "bg-blue-100 text-blue-700" },
    { value: "negotiating", label: "進行中", color: "bg-yellow-100 text-yellow-700" },
    { value: "meeting", label: "打ち合わせ", color: "bg-purple-100 text-purple-700" },
    { value: "contracted", label: "契約済", color: "bg-green-100 text-green-700" },
    { value: "rejected", label: "見送り", color: "bg-red-100 text-red-700" },
  ];

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="cards" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t.tabCards}
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            営業ダッシュボード
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {t.tabLeads}
          </TabsTrigger>
          <TabsTrigger value="kalodata" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Kalodata
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
            {/* Company Filter */}
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="会社で絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ての会社 ({cards.length})</SelectItem>
                {uniqueCompanies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company} ({cards.filter(c => c.company === company).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ステータス</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {/* Active Filters Display */}
          {(companyFilter !== "all" || statusFilter !== "all") && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">フィルター:</span>
              {companyFilter !== "all" && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setCompanyFilter("all")}>
                  <Building2 className="h-3 w-3 mr-1" />
                  {companyFilter} ×
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setStatusFilter("all")}>
                  {statusOptions.find(s => s.value === statusFilter)?.label} ×
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setCompanyFilter("all"); setStatusFilter("all"); }}>
                クリア
              </Button>
              <span className="text-muted-foreground ml-auto">{filteredCards.length}件表示中</span>
            </div>
          )}

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
                      <TableHead>ステータス</TableHead>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.phone}</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCards.map((card) => (
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
                              <img
                                src={card.imageUrl}
                                alt=""
                                className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setZoomedImageUrl(card.imageUrl!); }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="break-all">{card.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {card.company ? (
                            <button
                              onClick={() => setCompanyFilter(card.company!)}
                              className="text-left hover:underline hover:text-blue-600 transition-colors"
                            >
                              {card.company}
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{card.position || "—"}</TableCell>
                        <TableCell className="text-sm">
                          <Select
                            value={getCardStatus(card)}
                            onValueChange={(val) => handleStatusChange(card.id, val)}
                          >
                            <SelectTrigger className={`h-7 w-[100px] text-xs border-0 ${statusOptions.find(s => s.value === getCardStatus(card))?.color || ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${s.color}`}>{s.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
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
        {/* TAB: 営業ダッシュボード */}
        {/* ============================================================ */}
        <TabsContent value="sales" className="space-y-4">
          <SalesDashboard cards={cards} statusOptions={statusOptions} getCardStatus={getCardStatus} onStatusClick={(status) => { setStatusFilter(status); setActiveTab("cards"); }} />
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

          {/* Lead Results Table with Tabs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">リード一覧</CardTitle>
                  <div className="flex gap-1 ml-4">
                    <Button
                      size="sm"
                      variant={leadViewTab === "active" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setLeadViewTab("active")}
                    >
                      未対応 ({leadResults.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={leadViewTab === "rejected" ? "default" : "outline"}
                      className="h-7 text-xs bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                      onClick={() => setLeadViewTab("rejected")}
                    >
                      <PhoneOff className="h-3 w-3 mr-1" />
                      見送り
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => loadLeads(leadViewTab === "rejected" ? "rejected" : "new")}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    更新
                  </Button>
                  {leadViewTab === "active" && leadResults.length > 0 && (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      onClick={startCallListMode}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      電話営業開始
                    </Button>
                  )}
                </div>
              </div>
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
                        <TableHead>対応</TableHead>
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
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                // リードデータをbusinessCard形式に変換して対応登録ダイアログを開く
                                const cardLike = {
                                  id: lead.id,
                                  name: lead.companyName || "不明",
                                  company: lead.companyName,
                                  phone: lead.phone,
                                  mobile: "",
                                  email: lead.email,
                                  _isLead: true,
                                  _leadId: lead.id,
                                };
                                setSelectedCard(cardLike);
                                setPhoneMemo("");
                                setPhoneResult("answered");
                                setPhoneNextFollowUp("");
                                setIsPhoneDialogOpen(true);
                              }}
                            >
                              <PhoneCall className="h-3 w-3 mr-1" />
                              対応登録
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

          {/* Call List Mode Dialog */}
          {isCallListMode && callListLeads.length > 0 && (
            <Card className="border-green-300 bg-green-50/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-green-600" />
                    電話営業モード ({callListIndex + 1}/{callListLeads.length}件)
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setIsCallListMode(false); loadLeads("new"); }}>
                    <XCircle className="h-3 w-3 mr-1" />
                    終了
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Lead Info */}
                  <div className="space-y-3">
                    <div className="p-4 bg-white rounded-lg border shadow-sm">
                      <h3 className="font-bold text-lg text-gray-900">{callListLeads[callListIndex]?.companyName}</h3>
                      {callListLeads[callListIndex]?.personName && (
                        <p className="text-sm text-gray-600 mt-1">{callListLeads[callListIndex].personName}</p>
                      )}
                      <div className="mt-3 space-y-2">
                        <a
                          href={`tel:${(callListLeads[callListIndex]?.phone || "").replace(/[-\s]/g, "")}`}
                          className="flex items-center gap-2 text-lg font-bold text-green-700 hover:underline"
                        >
                          <Phone className="h-5 w-5" />
                          {callListLeads[callListIndex]?.phone}
                        </a>
                        {callListLeads[callListIndex]?.email && (
                          <p className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            {callListLeads[callListIndex].email}
                          </p>
                        )}
                        {callListLeads[callListIndex]?.website && (
                          <a href={callListLeads[callListIndex].website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                            <Globe className="h-4 w-4" />
                            {callListLeads[callListIndex].website}
                          </a>
                        )}
                        <p className="flex items-center gap-2 text-sm text-gray-500">
                          <MapPin className="h-4 w-4" />
                          {callListLeads[callListIndex]?.prefecture || "—"} {callListLeads[callListIndex]?.address || ""}
                        </p>
                      </div>
                    </div>
                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={callListIndex === 0}
                        onClick={() => { setCallListIndex(Math.max(0, callListIndex - 1)); setPhoneMemo(""); setPhoneResult("answered"); }}
                      >
                        <SkipBack className="h-4 w-4 mr-1" />
                        前へ
                      </Button>
                      <span className="text-sm text-muted-foreground">{callListIndex + 1} / {callListLeads.length}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={callListIndex >= callListLeads.length - 1}
                        onClick={() => { setCallListIndex(Math.min(callListLeads.length - 1, callListIndex + 1)); setPhoneMemo(""); setPhoneResult("answered"); }}
                      >
                        次へ
                        <SkipForward className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                  {/* Right: Call Record Panel */}
                  <div className="space-y-3 p-4 bg-white rounded-lg border shadow-sm">
                    <div className="flex items-center justify-center">
                      <a
                        href={`tel:${(callListLeads[callListIndex]?.phone || "").replace(/[-\s]/g, "")}`}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold text-lg transition-colors"
                      >
                        <Phone className="h-5 w-5" />
                        電話開始
                      </a>
                    </div>
                    {/* Status Selection */}
                    <div>
                      <Label className="mb-2 block font-medium text-sm">ステータス</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { value: "answered", label: "応答", color: "text-green-600 border-green-300 bg-green-50" },
                          { value: "no_answer", label: "不在", color: "text-gray-600 border-gray-300 bg-gray-50" },
                          { value: "busy", label: "話し中", color: "text-yellow-600 border-yellow-300 bg-yellow-50" },
                          { value: "callback", label: "折返し", color: "text-blue-600 border-blue-300 bg-blue-50" },
                          { value: "meeting_set", label: "アポ確定", color: "text-purple-600 border-purple-300 bg-purple-50" },
                          { value: "rejected", label: "見送り", color: "text-red-600 border-red-300 bg-red-50" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all text-xs ${
                              phoneResult === opt.value ? opt.color + " ring-2 ring-offset-1" : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => setPhoneResult(opt.value)}
                          >
                            <span className="font-medium">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Memo */}
                    <div>
                      <Label className="mb-1 block text-sm">対応メモ</Label>
                      <Textarea
                        value={phoneMemo}
                        onChange={(e) => setPhoneMemo(e.target.value)}
                        placeholder="通話内容をメモ..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    {/* Next Follow-up */}
                    <div>
                      <Label className="mb-1 block text-sm">次回フォロー</Label>
                      <Input
                        type="datetime-local"
                        value={phoneNextFollowUp}
                        onChange={(e) => setPhoneNextFollowUp(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    {/* Save Button */}
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleCallListSave}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      対応記録を保存 → 次へ
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BD Brand List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                BD対象ブランドリスト
              </CardTitle>
              <p className="text-xs text-muted-foreground">LCJでBDできるブランド一覧（{bdBrands.length}件）</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Brand Status Filter */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={bdBrandFilter === "all" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setBdBrandFilter("all")}
                >
                  全て ({bdBrands.length})
                </Button>
                <Button
                  size="sm"
                  variant={bdBrandFilter === "進行中" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setBdBrandFilter("進行中")}
                >
                  進行中 ({bdBrands.filter(b => b.status === "進行中").length})
                </Button>
                <Button
                  size="sm"
                  variant={bdBrandFilter === "契約済み" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setBdBrandFilter("契約済み")}
                >
                  契約済み ({bdBrands.filter(b => b.status === "契約済み").length})
                </Button>
                <Button
                  size="sm"
                  variant={bdBrandFilter === "打ち合わせ中" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setBdBrandFilter("打ち合わせ中")}
                >
                  打ち合わせ中 ({bdBrands.filter(b => b.status === "打ち合わせ中").length})
                </Button>
                <Button
                  size="sm"
                  variant={bdBrandFilter === "保留" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setBdBrandFilter("保留")}
                >
                  保留 ({bdBrands.filter(b => b.status === "保留").length})
                </Button>
                <Button
                  size="sm"
                  variant={bdBrandFilter === "終了" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setBdBrandFilter("終了")}
                >
                  終了 ({bdBrands.filter(b => b.status === "終了").length})
                </Button>
              </div>
              {/* Brand Table */}
              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ブランド名</TableHead>
                      <TableHead>会社名</TableHead>
                      <TableHead>カテゴリ</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>GMV</TableHead>
                      <TableHead>広告予算</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bdBrands
                      .filter(b => bdBrandFilter === "all" || b.status === bdBrandFilter)
                      .map((brand) => (
                        <TableRow key={brand.id}>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              {brand.logoUrl && (
                                <img src={brand.logoUrl} alt="" className="w-6 h-6 rounded object-cover" />
                              )}
                              {brand.name}
                              {brand.nameJa && brand.nameJa !== brand.name && (
                                <span className="text-xs text-muted-foreground">({brand.nameJa})</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{brand.companyName || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {brand.category === "beauty" ? "美容" :
                               brand.category === "health" ? "健康" :
                               brand.category === "food" ? "食品" :
                               brand.category === "fashion" ? "ファッション" :
                               brand.category === "electronics" ? "家電" :
                               brand.category || "その他"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs ${
                                brand.status === "契約済み" ? "bg-green-100 text-green-700" :
                                brand.status === "進行中" ? "bg-blue-100 text-blue-700" :
                                brand.status === "打ち合わせ中" ? "bg-yellow-100 text-yellow-700" :
                                brand.status === "保留" ? "bg-gray-100 text-gray-700" :
                                brand.status === "終了" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-700"
                              }`}
                              variant="secondary"
                            >
                              {brand.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {brand.totalGmv ? `¥${(brand.totalGmv / 10000).toFixed(1)}万` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {brand.totalAdBudget ? `¥${(brand.totalAdBudget / 10000).toFixed(0)}万` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            ※ リードデータは <a href="https://salesdash.buzzdrop.co.jp/command-center/japan/eccube?store=KYOGOKU+%E8%87%AA%E7%A4%BEEC&tab=btob&subtab=leads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sales Dash BtoB営業司令塔</a> と連携しています
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: Kalodata TikTok Shop */}
        {/* ============================================================ */}
        <TabsContent value="kalodata" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-3">
                <p className="text-xs text-purple-600 font-medium">TikTok Shop 総数</p>
                <p className="text-xl font-bold text-purple-700">{kalodataStats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-3">
                <p className="text-xs text-green-600 font-medium">メールあり</p>
                <p className="text-xl font-bold text-green-700">{kalodataStats.withEmail}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-3">
                <p className="text-xs text-blue-600 font-medium">電話あり</p>
                <p className="text-xl font-bold text-blue-700">{kalodataStats.withPhone}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-3">
                <p className="text-xs text-amber-600 font-medium">連絡済み</p>
                <p className="text-xl font-bold text-amber-700">{kalodataStats.contacted}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Actions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4 text-purple-500" />
                  TikTok Shop 日本ランキング TOP500（Kalodata）
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={loadKalodataLeads}
                  disabled={kalodataLoading}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${kalodataLoading ? "animate-spin" : ""}`} />
                  更新
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder="店舗名で検索..."
                  value={kalodataSearch}
                  onChange={(e) => setKalodataSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadKalodataLeads()}
                />
                <Button size="sm" className="h-8 text-xs" onClick={loadKalodataLeads}>
                  <Search className="h-3 w-3 mr-1" />
                  検索
                </Button>
              </div>

              {kalodataLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>店舗名</TableHead>
                        <TableHead>カテゴリ</TableHead>
                        <TableHead>メール</TableHead>
                        <TableHead>電話</TableHead>
                        <TableHead>ホームページ</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead>リンク</TableHead>
                        <TableHead>対応</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kalodataLeads.slice(kalodataPage * 50, (kalodataPage + 1) * 50).map((lead, idx) => (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {kalodataPage * 50 + idx + 1}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {lead.companyName}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {lead.category || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.email ? (
                              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                                {lead.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">未取得</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.phone ? (
                              <a href={`tel:${lead.phone}`} className="text-green-600 hover:underline flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" />
                                {lead.phone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">未取得</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.website ? (
                              lead.website.includes('tiktok.com') ? (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-pink-500 hover:underline flex items-center gap-1"
                                  title={lead.website}
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                  <span>TikTok Shop</span>
                                </a>
                              ) : (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline flex items-center gap-1 max-w-[180px]"
                                  title={lead.website}
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')}</span>
                                </a>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={lead.status === "contacted" ? "default" : lead.status === "converted" ? "default" : "secondary"}
                              className={`text-xs ${lead.status === "converted" ? "bg-green-600" : ""}`}
                            >
                              {lead.status === "new" ? "新規" :
                               lead.status === "contacted" ? "連絡済" :
                               lead.status === "responded" ? "返信あり" :
                               lead.status === "converted" ? "成約" :
                               lead.status === "rejected" ? "見送り" :
                               lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.sourceUrl && (
                              <a
                                href={lead.sourceUrl.includes('/shop/detail?') ? lead.sourceUrl : lead.sourceUrl.replace('/shop/', '/shop/detail?id=')}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={lead.sourceUrl}
                                className="text-purple-600 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Kalodata</span>
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                const cardLike = {
                                  id: lead.id,
                                  name: lead.companyName || "不明",
                                  company: lead.companyName,
                                  phone: lead.phone,
                                  mobile: "",
                                  email: lead.email,
                                  _isLead: true,
                                  _leadId: lead.id,
                                };
                                setSelectedCard(cardLike);
                                setPhoneMemo("");
                                setPhoneResult("answered");
                                setPhoneNextFollowUp("");
                                setIsPhoneDialogOpen(true);
                              }}
                            >
                              <PhoneCall className="h-3 w-3 mr-1" />
                              対応
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {/* Pagination */}
              {kalodataTotal > 50 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    {kalodataTotal}件中 {kalodataPage * 50 + 1}〜{Math.min((kalodataPage + 1) * 50, kalodataTotal)}件表示
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={kalodataPage === 0}
                      onClick={() => setKalodataPage(p => p - 1)}
                    >
                      前へ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={(kalodataPage + 1) * 50 >= kalodataTotal}
                      onClick={() => setKalodataPage(p => p + 1)}
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            ※ データソース: <a href="https://www.kalodata.com/shop" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Kalodata</a> TikTok Shop 日本ランキング
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB: メール配信 */}
        {/* ============================================================ */}
        <TabsContent value="email" className="space-y-4">
          {/* 営業メール テンプレート設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                営業メール テンプレート設定
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                リード収集で集めたリードに送信する営業メールの内容を設定します
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* テンプレート編集/プレビュー切り替え */}
              <div className="flex gap-2">
                <Button
                  variant={emailTemplateMode === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEmailTemplateMode("edit")}
                >
                  編集
                </Button>
                <Button
                  variant={emailTemplateMode === "preview" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEmailTemplateMode("preview")}
                >
                  プレビュー
                </Button>
              </div>

              {emailTemplateMode === "edit" ? (
                <div className="space-y-3">
                  <div>
                    <Label>件名テンプレート</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="{{displayName}}へ — HYDE起用ブランドのお取引のご相談"
                    />
                    <p className="text-xs text-blue-600 mt-1">{'{{displayName}}'} は「会社名 氏名様」に自動置換されます</p>
                  </div>
                  <div>
                    <Label>メール本文</Label>
                    <Textarea
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      placeholder="突然のご連絡失礼いたします。\nKYOGOKU PROFESSIONALの大久保と申します。\n\n貴社のことを拝見し、ぜひ一度弊社製品のご紹介をさせていただきたくご連絡いたしました。"
                      rows={12}
                    />
                    <p className="text-xs text-blue-600 mt-1">空行で段落を区切ります。■で始まる段落は提案ボックスとして表示されます。宛名と署名は自動で付加されます。</p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-white">
                  <div className="border-b pb-2 mb-3">
                    <p className="text-sm text-muted-foreground">件名:</p>
                    <p className="font-medium">{emailSubject.replace(/\{\{displayName\}\}/g, "株式会社○○ ○○様")}</p>
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    <p className="text-muted-foreground mb-2">株式会社○○ ○○様</p>
                    {emailContent.split("\n\n").map((para, i) => (
                      <div key={i} className={`mb-3 ${para.startsWith("■") ? "bg-blue-50 border border-blue-200 rounded p-2" : ""}`}>
                        {para}
                      </div>
                    ))}
                    <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                      <p>---</p>
                      <p>KYOGOKU PROFESSIONAL</p>
                      <p>大久保</p>
                      <p>info@kyogokupro.com</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 送信先選択＆一斉送信 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-green-600" />
                一斉送信
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                名刺一覧タブでチェックボックスを使って送信先を選択、またはリード収集のメールありリードに一斉送信できます
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 名刺一覧からの選択済み送信先 */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">
                  名刺一覧からの送信先: {selectedCardsWithEmail.length}件
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

              {/* 未送信リード一括送信 */}
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-orange-800">
                    未送信リード: {unsentTotal > 0 ? `${unsentLeads.length}件取得済み（全${unsentTotal}件）` : "未取得"}
                  </p>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-100" onClick={loadUnsentLeads} disabled={isLoadingUnsent}>
                    {isLoadingUnsent ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    未送信リード取得
                  </Button>
                </div>
                <p className="text-xs text-orange-600">
                  まだ一度もメールを送っていないリード（emailSentCount=0）全件に一括送信
                </p>
              </div>
              {/* リード一覧からの一斉送信 */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium mb-2 text-blue-800">
                  リード収集からの送信先: {leadResults.filter(l => l.email).length}件（メールあり）
                </p>
                <p className="text-xs text-blue-600">
                  リード収集タブのメールありリード全件にテンプレートで一斉送信します
                </p>
              </div>

              {/* 送信ボタン群 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  className="bg-green-600 hover:bg-green-700"
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
                  名刺選択分 {selectedCardsWithEmail.length}件に送信
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={
                    leadResults.filter(l => l.email).length === 0 ||
                    !emailSubject ||
                    !emailContent ||
                    sendToLeadsMutation.isPending
                  }
                  onClick={handleSendToLeads}
                >
                  {sendToLeadsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  リード全件 {leadResults.filter(l => l.email).length}件に送信
                </Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={
                    unsentLeads.length === 0 ||
                    !emailSubject ||
                    !emailContent ||
                    sendToLeadsMutation.isPending
                  }
                  onClick={handleSendToUnsentLeads}
                >
                  {sendToLeadsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  未送信 {unsentLeads.length}件に一括送信
                </Button>
              </div>
              {/* 送信履歴確認ボタン */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                  onClick={() => window.location.href = '/master/recruitment'}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  送信履歴を確認（招商管理メール） →
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

      {/* Phone Call Dialog - CRM Enhanced */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-600" />
              通話記録: {selectedCard?.name}
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
              {/* 通話結果選択 */}
              <div>
                <Label className="mb-2 block font-medium">通話結果</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "answered", label: "応答あり", icon: CheckCircle2, color: "text-green-600 border-green-300 bg-green-50" },
                    { value: "no_answer", label: "不在", icon: XCircle, color: "text-gray-600 border-gray-300 bg-gray-50" },
                    { value: "busy", label: "話し中", icon: Phone, color: "text-yellow-600 border-yellow-300 bg-yellow-50" },
                    { value: "callback", label: "折返し", icon: Clock, color: "text-blue-600 border-blue-300 bg-blue-50" },
                    { value: "meeting_set", label: "アポ確定", icon: Target, color: "text-purple-600 border-purple-300 bg-purple-50" },
                    { value: "rejected", label: "見送り", icon: XCircle, color: "text-red-600 border-red-300 bg-red-50" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                        phoneResult === opt.value ? opt.color + " ring-2 ring-offset-1" : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setPhoneResult(opt.value)}
                    >
                      <opt.icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* 次回フォローアップ日時 */}
              <div>
                <Label className="mb-1 block">次回フォローアップ</Label>
                <Input
                  type="datetime-local"
                  value={phoneNextFollowUp}
                  onChange={(e) => setPhoneNextFollowUp(e.target.value)}
                />
              </div>
              {/* メモ */}
              <div>
                <Label className="mb-1 block">通話メモ</Label>
                <Textarea
                  value={phoneMemo}
                  onChange={(e) => setPhoneMemo(e.target.value)}
                  placeholder="通話内容をメモ..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPhoneDialogOpen(false)}>{t.cancel}</Button>
            <Button onClick={handleSavePhoneMemo} disabled={createCallLogMutation.isPending}>
              {createCallLogMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              記録を保存
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

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomedImageUrl} onOpenChange={() => setZoomedImageUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader>
            <DialogTitle className="sr-only">名刺画像</DialogTitle>
          </DialogHeader>
          {zoomedImageUrl && (
            <div className="flex justify-center items-center">
              <img
                src={zoomedImageUrl}
                alt="名刺"
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ============================================================
// Sales Dashboard Sub-Component
// ============================================================
function SalesDashboard({ cards, statusOptions, getCardStatus, onStatusClick }: { cards: any[]; statusOptions: any[]; getCardStatus: (card: any) => string; onStatusClick?: (status: string) => void }) {
  const utils = trpc.useUtils();
  const { data: salesKpi } = trpc.businessCard.getSalesKpi.useQuery(undefined, { refetchInterval: 30000 });
  const { data: upcomingFollowUps = [] } = trpc.businessCard.getUpcomingFollowUps.useQuery(undefined);
  const { data: overdueFollowUps = [] } = trpc.businessCard.getOverdueFollowUps.useQuery(undefined);

  // CRM Migration trigger (run once on first load)
  const migrateMutation = trpc.businessCard.runCrmMigration.useMutation({
    onSuccess: () => console.log("[CRM] Migration completed"),
    onError: (e) => console.warn("[CRM] Migration error:", e.message),
  });

  useEffect(() => {
    // Run migration on first load (idempotent)
    migrateMutation.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusOptions.forEach((s) => { counts[s.value] = 0; });
    cards.forEach((card) => {
      const status = getCardStatus(card);
      if (counts[status] !== undefined) counts[status]++;
      else counts["new"] = (counts["new"] || 0) + 1;
    });
    return counts;
  }, [cards, statusOptions, getCardStatus]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">本日架電数</p>
            <p className="text-2xl font-bold text-blue-800">{salesKpi?.totalCalls || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-green-600 font-medium">応答</p>
            <p className="text-2xl font-bold text-green-800">{salesKpi?.answered || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-600 font-medium">不在</p>
            <p className="text-2xl font-bold text-gray-800">{salesKpi?.noAnswer || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-yellow-600 font-medium">話し中</p>
            <p className="text-2xl font-bold text-yellow-800">{salesKpi?.busy || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-indigo-600 font-medium">折返し</p>
            <p className="text-2xl font-bold text-indigo-800">{salesKpi?.callback || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-purple-600 font-medium">アポ確定</p>
            <p className="text-2xl font-bold text-purple-800">{salesKpi?.meetingsSet || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-red-600 font-medium">見送り</p>
            <p className="text-2xl font-bold text-red-800">{salesKpi?.rejected || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            営業パイプライン
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((s) => (
              <div
                key={s.value}
                className={`flex-1 min-w-[100px] p-3 rounded-lg text-center cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${s.color}`}
                onClick={() => onStatusClick?.(s.value)}
              >
                <p className="text-xs font-medium">{s.label}</p>
                <p className="text-xl font-bold">{pipelineCounts[s.value] || 0}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Follow-ups */}
      {overdueFollowUps.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              期限超過フォローアップ ({overdueFollowUps.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueFollowUps.slice(0, 10).map((card: any) => (
                <div key={card.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <span className="font-medium text-sm">{card.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{card.company || ""}</span>
                  </div>
                  <div className="text-xs text-red-600">
                    {card.nextFollowUpAt ? new Date(card.nextFollowUpAt).toLocaleDateString("ja-JP") : ""}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Follow-ups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            今後のフォローアップ予定
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">予定なし</p>
          ) : (
            <div className="space-y-2">
              {upcomingFollowUps.slice(0, 15).map((card: any) => (
                <div key={card.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{card.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{card.company || ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {card.nextFollowUpAt ? new Date(card.nextFollowUpAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
