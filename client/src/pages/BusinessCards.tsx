import { useSearch, useLocation } from "wouter";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  ArrowDown,
  ArrowUp,
  History,
  CheckCircle,
  AlertCircle,
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
  // Tab state synced with URL params
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const validTabs = useMemo(() => ["cards", "sales", "leads", "kalodata", "email"], []);
  const activeTab = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    return tab && validTabs.includes(tab) ? tab : "cards";
  }, [searchString, validTabs]);
  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchString);
    if (tab === "cards") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    navigate(`/master/business-cards${qs ? "?" + qs : ""}`, { replace: true });
  };

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
  const [attachPdf, setAttachPdf] = useState(true); // PDF提案書添付デフォルトON
  // Phone state
  const [phoneMemo, setPhoneMemo] = useState("");
  const [phoneResult, setPhoneResult] = useState<string>("answered");
  const [phoneNextFollowUp, setPhoneNextFollowUp] = useState<string>("");
  const [isCallLogDialogOpen, setIsCallLogDialogOpen] = useState(false);

  // Image zoom state
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // 送信済み件数取得（staleTimeを5秒に短縮してリアルタイム更新）
  const emailStatsQuery = trpc.businessCard.getSalesEmailStats.useQuery(undefined, {
    staleTime: 5000,
  });
  // 未返信通知
  const { data: unrepliedData } = trpc.replyTracking.getUnrepliedCount.useQuery(undefined, { refetchOnWindowFocus: false, refetchInterval: 60000 });
  const emailStats = emailStatsQuery.data;

  // Lead collection state
  const [leadStats, setLeadStats] = useState<any>(null);
  const [leadKeyword, setLeadKeyword] = useState("美容 ディーラー");
  const [leadPrefecture, setLeadPrefecture] = useState("東京都");
  const [isCollecting, setIsCollecting] = useState<string | null>(null);
  const [leadMessage, setLeadMessage] = useState<string | null>(null);
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [leadViewTab, setLeadViewTab] = useState<"active" | "rejected">("active");
  const [leadDetailData, setLeadDetailData] = useState<any>(null);
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
  const [kalodataFilter, setKalodataFilter] = useState<"all" | "withEmail" | "withPhone" | "contacted" | "sent" | "unsent">("all");
  const [kalodataSentEmails, setKalodataSentEmails] = useState<Set<string>>(new Set());
  // Contact search state
  const [contactSearchRunning, setContactSearchRunning] = useState(false);
  const [contactSearchStatus, setContactSearchStatus] = useState<{isRunning: boolean; processed: number; total: number; successCount: number; errorCount: number; lastRun?: string} | null>(null);

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

  // テスト送信mutation
  const sendTestEmailMutation = trpc.businessCard.sendTestEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`テストメールを ${data.sentTo} に送信しました`);
    },
    onError: (error) => toast.error(error.message),
  });

  // メールあり全件送信mutation（バックグラウンド方式）
  const sendBatchMutation = trpc.businessCard.sendEmailBatch.useMutation();
  const startBgBatchMutation = trpc.businessCard.startBackgroundBatchSend.useMutation();
  const stopBgBatchMutation = trpc.businessCard.stopBackgroundBatchSend.useMutation();
  const [testEmailAddress, setTestEmailAddress] = useState("");

  // バッチ送信用state
  const [batchSize, setBatchSize] = useState<number>(50);
  const [skipSent, setSkipSent] = useState<boolean>(true);
  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    currentOffset: number;
    totalSent: number;
    totalErrors: number;
    totalRecipients: number;
    skippedSent: number;
    currentBatch?: number;
    totalBatches?: number;
  } | null>(null);
  const batchAbortRef = useRef(false);

  // バックグラウンド送信の進捗ポーリング
  const bgProgressQuery = trpc.businessCard.getBackgroundBatchProgress.useQuery(undefined, {
    refetchInterval: batchProgress?.isRunning ? 2000 : false,
    enabled: batchProgress?.isRunning || false,
  });

  // バックグラウンド進捗をUIに反映
  useEffect(() => {
    if (bgProgressQuery.data && batchProgress?.isRunning) {
      const bg = bgProgressQuery.data;
      setBatchProgress({
        isRunning: bg.isRunning,
        currentOffset: bg.sentCount + bg.errorCount,
        totalSent: bg.sentCount,
        totalErrors: bg.errorCount,
        totalRecipients: bg.totalRecipients,
        skippedSent: bg.skippedSent,
        currentBatch: bg.currentBatch,
        totalBatches: bg.totalBatches,
      });
      // 送信中はポーリングごとに統計と履歴を更新
      emailStatsQuery.refetch();
      // 送信完了時 or 5バッチごとに履歴もリフレッシュ
      if (!bg.isRunning || (bg.currentBatch && bg.currentBatch % 5 === 0)) {
        utils.businessCard.getSalesEmailLogs.invalidate();
      }
      if (!bg.isRunning && bg.sentCount > 0) {
        toast.success(`バックグラウンド送信完了！${bg.sentCount}件送信（エラー${bg.errorCount}件）`);
        utils.businessCard.getSalesEmailLogs.invalidate();
      }
    }
  }, [bgProgressQuery.data]);

  // ページロード時にバックグラウンド送信が実行中かチェック
  const bgInitialCheck = trpc.businessCard.getBackgroundBatchProgress.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (bgInitialCheck.data?.isRunning) {
      setBatchProgress({
        isRunning: true,
        currentOffset: bgInitialCheck.data.sentCount + bgInitialCheck.data.errorCount,
        totalSent: bgInitialCheck.data.sentCount,
        totalErrors: bgInitialCheck.data.errorCount,
        totalRecipients: bgInitialCheck.data.totalRecipients,
        skippedSent: bgInitialCheck.data.skippedSent,
        currentBatch: bgInitialCheck.data.currentBatch,
        totalBatches: bgInitialCheck.data.totalBatches,
      });
    }
  }, [bgInitialCheck.data]);

  const startBatchSend = async () => {
    if (!emailSubject || !emailContent) {
      toast.error("件名と本文を入力してください");
      return;
    }
    const totalEstimate = (cardsWithEmail.length || 0) + (leadStats?.withEmail || 0);
    const sentAlready = emailStats?.uniqueEmails || 0;
    const unsent = skipSent ? Math.max(0, totalEstimate - sentAlready) : totalEstimate;
    if (!confirm(`バックグラウンドでメールあり全件に送信します。\n送信対象: 約${unsent}件${skipSent ? `（全体${totalEstimate}件 - 送信済${sentAlready}件）` : `（全体${totalEstimate}件）`}\n※ページを離れても送信は継続されます\nよろしいですか？`)) return;

    try {
      const result = await startBgBatchMutation.mutateAsync({
        subject: emailSubject,
        content: emailContent,
        attachPdf,
        includeCards: true,
        includeLeads: true,
        skipSent,
        batchSize,
      });
      if (result.success) {
        toast.success("バックグラウンド送信を開始しました！ページを離れても送信は継続されます。");
        setBatchProgress({
          isRunning: true,
          currentOffset: 0,
          totalSent: 0,
          totalErrors: 0,
          totalRecipients: 0,
          skippedSent: 0,
        });
      } else {
        toast.error(result.message || "送信開始に失敗しました");
      }
    } catch (e: any) {
      toast.error(`送信開始エラー: ${e.message}`);
    }
  };

  const stopBatchSend = async () => {
    try {
      const result = await stopBgBatchMutation.mutateAsync();
      if (result.success) {
        toast.info("バックグラウンド送信を中断しました");
        setBatchProgress(prev => prev ? { ...prev, isRunning: false } : null);
      }
    } catch (e: any) {
      toast.error(`中断エラー: ${e.message}`);
    }
  };

  const handleSendToLeads = () => {
    if (!emailSubject || !emailContent) return;
    const leadsWithEmail = leadResults.filter(l => l.email);
    if (leadsWithEmail.length === 0) return;
    sendToLeadsMutation.mutate({
      emails: leadsWithEmail.map(l => ({ email: l.email!, displayName: l.companyName || "" })),
      subject: emailSubject,
      content: emailContent,
      attachPdf,
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
      attachPdf,
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
      contactName: selectedCard.name || selectedCard.displayName || undefined,
      contactCompany: selectedCard.company || selectedCard.category || undefined,
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

  // Contact search functions
  const triggerContactSearch = async () => {
    setContactSearchRunning(true);
    try {
      const res = await fetch("/api/trpc/contactSearch.trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: { batchSize: 50 } }),
      });
      const data = await res.json();
      if (data?.result?.data?.json) {
        const r = data.result.data.json;
        toast.success(`連絡先検索完了: ${r.processed}件処理, ${r.updated}件更新, 残り${r.remaining}件`);
      }
    } catch (err) {
      toast.error("連絡先検索の開始に失敗しました");
    }
    setContactSearchRunning(false);
    loadContactSearchStatus();
  };

  const loadContactSearchStatus = async () => {
    try {
      const res = await fetch("/api/trpc/contactSearch.status", { credentials: "include" });
      const data = await res.json();
      if (data?.result?.data?.json) {
        const s = data.result.data.json;
        // Map server response to our UI state
        setContactSearchStatus({
          isRunning: s.isRunning,
          processed: s.lastRunStats?.processed || 0,
          total: s.lastRunStats?.processed || 0,
          successCount: s.lastRunStats?.updated || 0,
          errorCount: s.lastRunStats?.errors || 0,
          lastRun: s.lastRunStats?.lastRunAt || undefined,
        });
      }
    } catch (err) {
      console.error("Failed to load contact search status", err);
    }
  };

  useEffect(() => {
    if (activeTab === "kalodata") {
      loadContactSearchStatus();
    }
  }, [activeTab]);

  // Kalodata leads loader
  const loadKalodataLeads = useCallback(async () => {
    setKalodataLoading(true);
    try {
      const filter: any = { source: "kalodata_tiktok", limit: 5000 };
      if (kalodataSearch) filter.search = kalodataSearch;
      const params = encodeURIComponent(JSON.stringify({ json: filter }));
      const [res, sentRes] = await Promise.all([
        fetch(`https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeads?input=${params}`),
        fetch(`/api/trpc/businessCard.getSentEmailAddressList`, { credentials: "include" }),
      ]);
      const data = await res.json();
      // 送信済みメールアドレスセットを構築
      let sentSet = new Set<string>();
      try {
        const sentData = await sentRes.json();
        const sentEmails = sentData?.result?.data?.json?.emails || [];
        sentSet = new Set(sentEmails.map((e: string) => e.toLowerCase()));
        setKalodataSentEmails(sentSet);
      } catch (e) {
        console.error("Failed to load sent emails:", e);
      }
      if (data?.result?.data?.json?.rows) {
        const rows = data.result.data.json.rows;
        setKalodataLeads(rows);
        setKalodataTotal(rows.length);
        // Calculate stats
        const withEmail = rows.filter((r: any) => r.email && r.email.trim());
        const sentCount = withEmail.filter((r: any) => sentSet.has(r.email.toLowerCase())).length;
        setKalodataStats({
          total: rows.length,
          withEmail: withEmail.length,
          withPhone: rows.filter((r: any) => r.phone && r.phone.trim()).length,
          contacted: sentCount,
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
    // メール配信タブでもリードデータをロード（送信先件数表示のため）
    if (activeTab === "email" && leadResults.length === 0) {
      loadLeads("new");
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
        const leadsCount = result.leadsFound || result.newLeads || result.collected || 0;
        if (result.background) {
          setLeadMessage(result.message || "バックグラウンドで収集を開始しました。数分後にリストを更新してください。");
        } else if (leadsCount > 0) {
          setLeadMessage(`収集完了: ${leadsCount}件の新規リード`);
        } else {
          setLeadMessage("収集完了: 新規リードは見つかりませんでした（既に収集済みの可能性があります）");
        }

        // Record collection history
        try {
          await fetch("/api/trpc/leadHistory.create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ json: {
              keyword: leadKeyword,
              prefecture: leadPrefecture,
              pipeline: source,
              leadsFound: leadsCount,
              batchId: result.batchId || null,
              status: result.background ? "running" : "completed",
            }}),
          });
        } catch (e) {
          console.error("Failed to record lead collection history", e);
        }

        // Refresh stats
        const statsRes = await fetch("https://salesdash.buzzdrop.co.jp/api/trpc/btobLeadProspector.getLeadStats");
        const statsData = await statsRes.json();
        if (statsData?.result?.data?.json) setLeadStats(statsData.result.data.json);
      } else {
        setLeadMessage("バックグラウンドで収集を開始しました");
        // Record as running
        try {
          await fetch("/api/trpc/leadHistory.create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ json: {
              keyword: leadKeyword,
              prefecture: leadPrefecture,
              pipeline: source,
              leadsFound: 0,
              status: "running",
            }}),
          });
        } catch (e) {
          console.error("Failed to record lead collection history", e);
        }
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
      contactName: currentLead.companyName || currentLead.name || currentLead.displayName || undefined,
      contactCompany: currentLead.category || currentLead.company || undefined,
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
            {unrepliedData?.count ? <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{unrepliedData.count}</span> : null}
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
                            <a href={`/master/business-cards/${card.id}`} className="break-all text-blue-600 hover:underline">{card.name}</a>
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
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <span>← 横スクロールで全列表示 →</span>
                </div>
                <div className="overflow-auto max-h-[500px] border rounded-md" style={{ scrollbarWidth: 'auto' }}>
                  <Table className="min-w-[1100px]">
                    <TableHeader className="sticky top-0 z-10 bg-white">
                      <TableRow>
                        <TableHead className="min-w-[140px]">会社名</TableHead>
                        <TableHead className="w-[36px]">HP</TableHead>
                        <TableHead className="min-w-[160px]">メール</TableHead>
                        <TableHead className="min-w-[110px]">電話</TableHead>
                        <TableHead className="min-w-[60px]">県</TableHead>
                        <TableHead className="min-w-[60px]">状態</TableHead>
                        <TableHead className="min-w-[100px]">キーワード</TableHead>
                        <TableHead className="min-w-[60px]">カテゴリ</TableHead>
                        <TableHead className="min-w-[60px]">収集元</TableHead>
                        <TableHead className="min-w-[80px]">対応</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadResults.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium text-sm">
                            <button
                              className="text-blue-600 hover:underline text-left cursor-pointer"
                              onClick={() => setLeadDetailData(lead)}
                            >
                              {lead.companyName}
                            </button>
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.website ? (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700" title={lead.website}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email) && !/\.(avif|webp|png|jpg|jpeg|gif|svg|bmp|ico)$/i.test(lead.email) && lead.email.length < 100 ? (
                              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                                {lead.email}
                              </a>
                            ) : lead.email ? (
                              <span className="text-orange-400 text-xs" title="不正なメールアドレス">⚠ 無効</span>
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
                            {lead.searchKeyword ? (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {lead.searchKeyword}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {lead.category || "—"}
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
                </div>
              </CardContent>
            </Card>

          {/* Lead Detail Dialog */}
          {leadDetailData && (
            <Dialog open={!!leadDetailData} onOpenChange={(open) => !open && setLeadDetailData(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    {leadDetailData.companyName}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">担当者:</span>
                      <p className="font-medium">{leadDetailData.personName || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">都道府県:</span>
                      <p className="font-medium">{leadDetailData.prefecture || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">業種:</span>
                      <p className="font-medium">{leadDetailData.category || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">収集元:</span>
                      <p className="font-medium">
                        {leadDetailData.source === "google_maps" ? "Google Maps" :
                         leadDetailData.source === "google_search" ? "Google検索" :
                         leadDetailData.source === "portals" ? "ポータル" :
                         leadDetailData.source || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ステータス:</span>
                      <p className="font-medium">
                        <Badge variant="secondary" className="text-xs">
                          {leadDetailData.status === "new" ? "新規" :
                           leadDetailData.status === "contacted" ? "連絡済" :
                           leadDetailData.status === "responded" ? "返信あり" :
                           leadDetailData.status === "converted" ? "成約" :
                           leadDetailData.status === "rejected" ? "見送り" :
                           leadDetailData.status}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">収集日:</span>
                      <p className="font-medium">{leadDetailData.createdAt ? new Date(leadDetailData.createdAt).toLocaleDateString('ja-JP') : "—"}</p>
                    </div>
                  </div>
                  {/* 連絡先 */}
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="text-sm font-semibold">連絡先</h4>
                    {leadDetailData.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-blue-500" />
                        <a href={`mailto:${leadDetailData.email}`} className="text-blue-600 hover:underline">{leadDetailData.email}</a>
                      </div>
                    )}
                    {leadDetailData.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-green-500" />
                        <a href={`tel:${leadDetailData.phone}`} className="text-green-600 hover:underline">{leadDetailData.phone}</a>
                      </div>
                    )}
                    {leadDetailData.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-indigo-500" />
                        <a href={leadDetailData.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate max-w-[300px]">
                          {leadDetailData.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      </div>
                    )}
                    {leadDetailData.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-orange-500" />
                        <span>{leadDetailData.address}</span>
                      </div>
                    )}
                  </div>
                  {/* Google評価 */}
                  {leadDetailData.googleRating && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold mb-1">Google評価</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-yellow-500">★</span>
                        <span>{leadDetailData.googleRating}</span>
                        <span className="text-muted-foreground">({leadDetailData.googleReviewCount || 0}件のレビュー)</span>
                      </div>
                    </div>
                  )}
                  {/* メモ */}
                  {leadDetailData.memo && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold mb-1">メモ</h4>
                      <p className="text-sm text-muted-foreground">{leadDetailData.memo}</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex gap-2">
                  {leadDetailData.website && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={leadDetailData.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-3 w-3 mr-1" />
                        HPを開く
                      </a>
                    </Button>
                  )}
                  {leadDetailData.sourceUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={leadDetailData.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        収集元
                      </a>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => {
                    const cardLike = {
                      id: leadDetailData.id,
                      name: leadDetailData.companyName || "不明",
                      company: leadDetailData.companyName,
                      phone: leadDetailData.phone,
                      mobile: "",
                      email: leadDetailData.email,
                      _isLead: true,
                      _leadId: leadDetailData.id,
                    };
                    setSelectedCard(cardLike);
                    setPhoneMemo("");
                    setPhoneResult("answered");
                    setPhoneNextFollowUp("");
                    setIsPhoneDialogOpen(true);
                    setLeadDetailData(null);
                  }}>
                    <PhoneCall className="h-3 w-3 mr-1" />
                    対応登録
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

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

          {/* Lead Collection History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                収集履歴
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeadCollectionHistoryTable />
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
          {/* Stats Cards - clickable filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className={`bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer transition-all hover:shadow-md ${kalodataFilter === "all" ? "ring-2 ring-purple-500 shadow-md" : ""}`} onClick={() => { setKalodataFilter("all"); setKalodataPage(0); }}>
              <CardContent className="p-3">
                <p className="text-xs text-purple-600 font-medium">TikTok Shop 総数</p>
                <p className="text-xl font-bold text-purple-700">{kalodataStats.total}</p>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer transition-all hover:shadow-md ${kalodataFilter === "withEmail" ? "ring-2 ring-green-500 shadow-md" : ""}`} onClick={() => { setKalodataFilter("withEmail"); setKalodataPage(0); }}>
              <CardContent className="p-3">
                <p className="text-xs text-green-600 font-medium">メールあり</p>
                <p className="text-xl font-bold text-green-700">{kalodataStats.withEmail}</p>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 cursor-pointer transition-all hover:shadow-md ${kalodataFilter === "withPhone" ? "ring-2 ring-blue-500 shadow-md" : ""}`} onClick={() => { setKalodataFilter("withPhone"); setKalodataPage(0); }}>
              <CardContent className="p-3">
                <p className="text-xs text-blue-600 font-medium">電話あり</p>
                <p className="text-xl font-bold text-blue-700">{kalodataStats.withPhone}</p>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 cursor-pointer transition-all hover:shadow-md ${kalodataFilter === "sent" ? "ring-2 ring-amber-500 shadow-md" : ""}`} onClick={() => { setKalodataFilter("sent"); setKalodataPage(0); }}>
              <CardContent className="p-3">
                <p className="text-xs text-amber-600 font-medium">メール送信済み</p>
                <p className="text-xl font-bold text-amber-700">{kalodataStats.contacted}</p>
              </CardContent>
            </Card>
          </div>
          {kalodataStats.contacted > 0 && kalodataStats.withEmail > kalodataStats.contacted && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                送信済み: {kalodataStats.contacted}件
              </Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                未送信: {kalodataStats.withEmail - kalodataStats.contacted}件
              </Badge>
            </div>
          )}

          {/* Search & Actions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4 text-purple-500" />
                  TikTok Shop 日本ランキング TOP500（Kalodata）
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                    onClick={triggerContactSearch}
                    disabled={contactSearchRunning}
                  >
                    {contactSearchRunning ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3 mr-1" />
                    )}
                    連絡先自動検索
                  </Button>
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
              </div>
              {/* Contact Search Status */}
              {contactSearchStatus && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span className={contactSearchStatus.isRunning ? "text-green-600 font-medium" : "text-blue-600"}>
                    {contactSearchStatus.isRunning ? "🔄 検索実行中..." : "✓ 待機中（5分毎に自動実行）"}
                  </span>
                  {contactSearchStatus.processed > 0 && (
                    <span>前回処理: {contactSearchStatus.processed}件</span>
                  )}
                  {contactSearchStatus.successCount > 0 && (
                    <span className="text-green-600">成功: {contactSearchStatus.successCount}件</span>
                  )}
                  {contactSearchStatus.errorCount > 0 && (
                    <span className="text-red-600">エラー: {contactSearchStatus.errorCount}件</span>
                  )}
                  {contactSearchStatus.lastRun && (
                    <span>最終: {new Date(contactSearchStatus.lastRun).toLocaleString("ja-JP")}</span>
                  )}
                  <span className="text-orange-600 font-medium">未検索: {kalodataStats.total - kalodataStats.withEmail - kalodataStats.withPhone + kalodataStats.contacted}件</span>
                </div>
              )}
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
                  <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead className="min-w-[140px]">店舗名</TableHead>
                        <TableHead className="min-w-[70px]">カテゴリ</TableHead>
                        <TableHead className="min-w-[160px]">メール</TableHead>
                        <TableHead className="min-w-[120px]">電話</TableHead>
                        <TableHead className="min-w-[180px]">ホームページ</TableHead>
                        <TableHead className="min-w-[70px]">ステータス</TableHead>
                        <TableHead className="min-w-[80px]">リンク</TableHead>
                        <TableHead className="min-w-[70px]">対応</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filteredLeads = kalodataFilter === "all" ? kalodataLeads
                          : kalodataFilter === "withEmail" ? kalodataLeads.filter((l: any) => l.email)
                          : kalodataFilter === "withPhone" ? kalodataLeads.filter((l: any) => l.phone)
                          : kalodataFilter === "sent" ? kalodataLeads.filter((l: any) => l.email && kalodataSentEmails.has(l.email.toLowerCase()))
                          : kalodataFilter === "unsent" ? kalodataLeads.filter((l: any) => l.email && !kalodataSentEmails.has(l.email.toLowerCase()))
                          : kalodataLeads.filter((l: any) => l.status === "contacted");
                        return filteredLeads.slice(kalodataPage * 50, (kalodataPage + 1) * 50).map((lead, idx) => (
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
                            {lead.email && lead.email.trim() ? (
                              <div className="flex flex-col gap-0.5">
                                <a href={`/master/email-thread/${encodeURIComponent(lead.email)}`} className="text-blue-600 hover:underline">
                                  {lead.email}
                                </a>
                                {kalodataSentEmails.has(lead.email.toLowerCase()) && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                                    <CheckCircle2 className="h-2.5 w-2.5" />送信済み
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">未取得</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.phone && lead.phone.trim() ? (
                              <a href={`tel:${lead.phone}`} className="text-green-600 hover:underline flex items-center gap-1">
                                <PhoneCall className="h-3 w-3" />
                                {lead.phone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">未取得</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.website && lead.website.trim() ? (
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
                      ));
                      })()}
                    </TableBody>
                  </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}

              {/* Pagination */}
              {(() => {
                const filteredTotal = kalodataFilter === "all" ? kalodataTotal
                  : kalodataFilter === "withEmail" ? kalodataStats.withEmail
                  : kalodataFilter === "withPhone" ? kalodataStats.withPhone
                  : kalodataFilter === "sent" ? kalodataStats.contacted
                  : kalodataFilter === "unsent" ? (kalodataStats.withEmail - kalodataStats.contacted)
                  : kalodataStats.contacted;
                return filteredTotal > 50 ? (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      {filteredTotal}件中 {kalodataPage * 50 + 1}〜{Math.min((kalodataPage + 1) * 50, filteredTotal)}件表示
                      {kalodataFilter !== "all" && (
                        <span className="ml-2 text-purple-600">(フィルター適用中)</span>
                      )}
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
                        disabled={(kalodataPage + 1) * 50 >= filteredTotal}
                        onClick={() => setKalodataPage(p => p + 1)}
                      >
                        次へ
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {/* Kalodata バッチ送信セクション */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="h-4 w-4 text-purple-500" />
                Kalodata TikTok Shop 営業メール一括送信
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                メールアドレスが取得済みのKalodataリード全件に営業メールを一括送信します（送信済みはスキップ）
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-purple-700">メールあり: <span className="font-bold">{kalodataStats.withEmail}件</span></span>
                <span className="text-green-600">送信済: <span className="font-bold">{kalodataStats.contacted}件</span></span>
                <span className="text-orange-600">未送信: <span className="font-bold">{Math.max(0, kalodataStats.withEmail - kalodataStats.contacted)}件</span></span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="kalodataAttachPdf"
                    checked={attachPdf}
                    onCheckedChange={(checked: boolean | "indeterminate") => setAttachPdf(checked === true)}
                  />
                  <label htmlFor="kalodataAttachPdf" className="text-xs text-purple-700 cursor-pointer">
                    LCJ提案書（PDF）を添付
                  </label>
                </div>
              </div>

              {/* Kalodata バッチ進捗（共通batchProgressを使用） */}
              {batchProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-purple-700">
                    <span>
                      {batchProgress.isRunning ? "送信中..." : "完了"}
                      {batchProgress.skippedSent > 0 && ` (送信済${batchProgress.skippedSent}件スキップ)`}
                    </span>
                    <span>
                      {batchProgress.totalSent}件送信 / {batchProgress.totalRecipients}件中
                      {batchProgress.totalErrors > 0 && ` (エラー${batchProgress.totalErrors}件)`}
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${batchProgress.totalRecipients > 0 ? ((batchProgress.totalSent + batchProgress.totalErrors) / batchProgress.totalRecipients) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-purple-600">
                    バッチ {batchProgress.currentBatch || 0} / {batchProgress.totalBatches || 0}
                    {batchProgress.isRunning && " ※ページを離れても送信は継続されます"}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 flex-1"
                  disabled={
                    !emailSubject ||
                    !emailContent ||
                    kalodataStats.withEmail === 0 ||
                    (batchProgress?.isRunning || false)
                  }
                  onClick={async () => {
                    if (!emailSubject || !emailContent) {
                      toast.error("メール配信タブで件名と本文を設定してください");
                      return;
                    }
                    if (!confirm(`Kalodata TikTok Shopリード（メールあり${kalodataStats.withEmail}件）に営業メールを送信します。\n送信済みはスキップされます。\n※ページを離れても送信は継続されます\nよろしいですか？`)) return;
                    try {
                      const result = await startBgBatchMutation.mutateAsync({
                        subject: emailSubject,
                        content: emailContent,
                        attachPdf,
                        includeCards: false,
                        includeLeads: true,
                        leadSource: "kalodata_tiktok",
                        skipSent: true,
                        batchSize: 50,
                      });
                      if (result.success) {
                        toast.success("Kalodataリードへのバックグラウンド送信を開始しました！");
                        setBatchProgress({
                          isRunning: true,
                          currentOffset: 0,
                          totalSent: 0,
                          totalErrors: 0,
                          totalRecipients: 0,
                          skippedSent: 0,
                        });
                      } else {
                        toast.error(result.message || "送信開始に失敗しました");
                      }
                    } catch (e: any) {
                      toast.error(`送信開始エラー: ${e.message}`);
                    }
                  }}
                >
                  {(batchProgress?.isRunning) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {batchProgress?.isRunning ? "送信中..." : `Kalodata ${kalodataStats.withEmail}件に営業メール送信`}
                </Button>
                {batchProgress?.isRunning && (
                  <Button
                    variant="destructive"
                    className="shrink-0"
                    onClick={stopBatchSend}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    中断
                  </Button>
                )}
              </div>
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

              {/* テスト送信 */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium mb-2 text-gray-800 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  テスト送信
                </p>
                <p className="text-xs text-gray-500 mb-2">現在のテンプレート内容を指定メールアドレスに1通送信して確認できます</p>
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-xs flex-1"
                    placeholder="送信先メールアドレス（空欄の場合は自分のメールに送信）"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    type="email"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs whitespace-nowrap"
                    disabled={
                      !emailSubject ||
                      !emailContent ||
                      sendTestEmailMutation.isPending
                    }
                    onClick={() => {
                      sendTestEmailMutation.mutate({
                        subject: emailSubject,
                        content: emailContent,
                        attachPdf,
                        testEmail: testEmailAddress || undefined,
                      });
                    }}
                  >
                    {sendTestEmailMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    テスト送信
                  </Button>
                </div>
              </div>

              {/* PDF添付オプション */}
              <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <Checkbox
                  id="attachPdf"
                  checked={attachPdf}
                  onCheckedChange={(checked: boolean | "indeterminate") => setAttachPdf(checked === true)}
                />
                <label htmlFor="attachPdf" className="text-sm font-medium text-purple-800 cursor-pointer">
                  LCJ提案書（PDF）を添付する
                </label>
                <span className="text-xs text-purple-600 ml-auto">2.5MB</span>
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

              {/* バッチ送信セクション */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                <p className="text-sm font-bold text-purple-800 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  メールあり全件バッチ送信
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-purple-700">全体: <span className="font-bold">{cardsWithEmail.length + (leadStats?.withEmail || 0)}件</span></span>
                  <span className="text-green-600">送信済: <span className="font-bold">{emailStats?.uniqueEmails || 0}件</span></span>
                  <span className="text-orange-600">未送信: <span className="font-bold">{Math.max(0, (cardsWithEmail.length + (leadStats?.withEmail || 0)) - (emailStats?.uniqueEmails || 0))}件</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-purple-700 whitespace-nowrap">バッチサイズ:</label>
                    <Select value={String(batchSize)} onValueChange={(v) => setBatchSize(Number(v))}>
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10件</SelectItem>
                        <SelectItem value="20">20件</SelectItem>
                        <SelectItem value="50">50件</SelectItem>
                        <SelectItem value="100">100件</SelectItem>
                        <SelectItem value="10000">全件</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skipSent"
                      checked={skipSent}
                      onCheckedChange={(checked: boolean | "indeterminate") => setSkipSent(checked === true)}
                    />
                    <label htmlFor="skipSent" className="text-xs text-purple-700 cursor-pointer">
                      未送信のみに送信（送信済スキップ）
                    </label>
                  </div>
                </div>

                {/* 進捗表示 */}
                {batchProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-purple-700">
                      <span>
                        {batchProgress.isRunning ? "送信中..." : "完了"}
                        {batchProgress.skippedSent > 0 && ` (送信済${batchProgress.skippedSent}件スキップ)`}
                      </span>
                      <span>
                        {batchProgress.totalSent}件送信 / {batchProgress.totalRecipients}件中
                        {batchProgress.totalErrors > 0 && ` (エラー${batchProgress.totalErrors}件)`}
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${batchProgress.totalRecipients > 0 ? (batchProgress.currentOffset / batchProgress.totalRecipients) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-purple-600">
                      バッチ {batchProgress.currentBatch || Math.ceil(batchProgress.currentOffset / batchSize)} / {batchProgress.totalBatches || Math.ceil(batchProgress.totalRecipients / batchSize)}
                      {batchProgress.isRunning && " ※ページを離れても送信は継続されます"}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 flex-1"
                    disabled={
                      !emailSubject ||
                      !emailContent ||
                      (batchProgress?.isRunning || false)
                    }
                    onClick={startBatchSend}
                  >
                    {(batchProgress?.isRunning) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {batchProgress?.isRunning ? "送信中..." : "バッチ送信開始"}
                  </Button>
                  {batchProgress?.isRunning && (
                    <Button
                      variant="destructive"
                      className="shrink-0"
                      onClick={stopBatchSend}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      中断
                    </Button>
                  )}
                </div>
              </div>

              {/* 送信履歴インラインセクション */}
            </CardContent>
          </Card>
          {/* 送信履歴一覧（同ページ内表示） */}
          <SalesEmailHistorySection />
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
              {/* メール送信履歴セクション */}
              {selectedCard.email && (
                <EmailHistorySection email={selectedCard.email} businessCardId={selectedCard.id} />
              )}
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
// Lead Collection History Sub-Component
// ============================================================
function LeadCollectionHistoryTable() {
  const { data: history, isLoading } = trpc.leadHistory.list.useQuery({ limit: 30 });

  const pipelineLabels: Record<string, string> = {
    google_maps: "Google Maps",
    google_search: "Google検索",
    portals: "ポータル",
    full_pipeline: "全パイプライン",
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-100 text-green-700 text-xs">完了</Badge>;
      case "running": return <Badge className="bg-blue-100 text-blue-700 text-xs">実行中</Badge>;
      case "failed": return <Badge className="bg-red-100 text-red-700 text-xs">失敗</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-xs text-muted-foreground text-center py-4">読み込み中...</div>;
  }

  if (!history || history.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-4">収集履歴はまだありません</div>;
  }

  return (
    <ScrollArea className="h-[250px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>実行日時</TableHead>
            <TableHead>キーワード</TableHead>
            <TableHead>都道府県</TableHead>
            <TableHead>パイプライン</TableHead>
            <TableHead>収集数</TableHead>
            <TableHead>ステータス</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((h: any) => (
            <TableRow key={h.id}>
              <TableCell className="text-xs">
                {h.executedAt ? new Date(h.executedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "—"}
              </TableCell>
              <TableCell className="text-xs font-medium">{h.keyword}</TableCell>
              <TableCell className="text-xs">{h.prefecture || "—"}</TableCell>
              <TableCell className="text-xs">
                <Badge variant="outline" className="text-xs">
                  {pipelineLabels[h.pipeline] || h.pipeline}
                </Badge>
              </TableCell>
              <TableCell className="text-xs font-medium">{h.leadsFound || 0}件</TableCell>
              <TableCell>{statusBadge(h.status || "completed")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ============================================================
// Sales Dashboard Sub-Component
// ============================================================
function SalesDashboard({ cards, statusOptions, getCardStatus, onStatusClick }: { cards: any[]; statusOptions: any[]; getCardStatus: (card: any) => string; onStatusClick?: (status: string) => void }) {
  const utils = trpc.useUtils();
  const [kpiPeriod, setKpiPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  
  // Calculate date range based on selected period
  const kpiDateRange = useMemo(() => {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const jstTodayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
    const todayStartUTC = new Date(jstTodayStart.getTime() - jstOffset);
    
    switch (kpiPeriod) {
      case 'today':
        return { startDate: todayStartUTC.toISOString(), endDate: now.toISOString() };
      case 'week': {
        const dayOfWeek = jstNow.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(jstTodayStart.getTime() - mondayOffset * 24 * 60 * 60 * 1000 - jstOffset);
        return { startDate: weekStart.toISOString(), endDate: now.toISOString() };
      }
      case 'month': {
        const monthStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), 1);
        const monthStartUTC = new Date(monthStart.getTime() - jstOffset);
        return { startDate: monthStartUTC.toISOString(), endDate: now.toISOString() };
      }
      case 'all':
        return { allTime: true };
    }
  }, [kpiPeriod]);
  
  const { data: salesKpi } = trpc.businessCard.getSalesKpi.useQuery(kpiDateRange, { refetchInterval: 30000 });
  const { data: staffKpi = [] } = trpc.businessCard.getSalesKpiByStaff.useQuery(kpiDateRange, { refetchInterval: 30000 });
  const { data: recentCallLogs = [] } = trpc.businessCard.getRecentCallLogs.useQuery(undefined, { refetchInterval: 30000 });
  const { data: dailyStats = [] } = trpc.businessCard.getCallLogsDailyStats.useQuery(undefined);
  const { data: upcomingFollowUps = [] } = trpc.businessCard.getUpcomingFollowUps.useQuery(undefined);
  const { data: overdueFollowUps = [] } = trpc.businessCard.getOverdueFollowUps.useQuery(undefined);

  // Aggregate daily stats
  const dailyAggregated = useMemo(() => {
    const map: Record<string, { date: string; total: number; answered: number; noAnswer: number; busy: number; callback: number; meetingSet: number; rejected: number }> = {};
    for (const row of dailyStats) {
      if (!map[row.date]) map[row.date] = { date: row.date, total: 0, answered: 0, noAnswer: 0, busy: 0, callback: 0, meetingSet: 0, rejected: 0 };
      const count = Number(row.count);
      map[row.date].total += count;
      switch (row.result) {
        case "answered": map[row.date].answered += count; break;
        case "no_answer": map[row.date].noAnswer += count; break;
        case "busy": map[row.date].busy += count; break;
        case "callback": map[row.date].callback += count; break;
        case "meeting_set": map[row.date].meetingSet += count; break;
        case "rejected": map[row.date].rejected += count; break;
      }
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyStats]);

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
      {/* Period Filter + KPI Cards */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-600">期間:</span>
        {(['today', 'week', 'month', 'all'] as const).map((period) => (
          <Button
            key={period}
            variant={kpiPeriod === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKpiPeriod(period)}
            className="text-xs h-7"
          >
            {period === 'today' ? '本日' : period === 'week' ? '今週' : period === 'month' ? '今月' : '全期間'}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">{kpiPeriod === 'today' ? '本日' : kpiPeriod === 'week' ? '今週' : kpiPeriod === 'month' ? '今月' : '全期間'}架電数</p>
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

      {/* Staff KPI Table */}
      {staffKpi.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              スタッフ別実績
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>担当者</TableHead>
                  <TableHead className="text-center">架電数</TableHead>
                  <TableHead className="text-center">応答</TableHead>
                  <TableHead className="text-center">不在</TableHead>
                  <TableHead className="text-center">話し中</TableHead>
                  <TableHead className="text-center">折返し</TableHead>
                  <TableHead className="text-center">アポ確定</TableHead>
                  <TableHead className="text-center">見送り</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffKpi.map((staff: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell className="text-center font-bold text-blue-700">{staff.totalCalls}</TableCell>
                    <TableCell className="text-center text-green-700">{staff.answered || "-"}</TableCell>
                    <TableCell className="text-center text-gray-600">{staff.noAnswer || "-"}</TableCell>
                    <TableCell className="text-center text-yellow-700">{staff.busy || "-"}</TableCell>
                    <TableCell className="text-center text-indigo-700">{staff.callback || "-"}</TableCell>
                    <TableCell className="text-center text-purple-700">{staff.meetingsSet || "-"}</TableCell>
                    <TableCell className="text-center text-red-700">{staff.rejected || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

      {/* Daily Stats Table */}
      {dailyAggregated.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              日別架電実績
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead className="text-center">合計</TableHead>
                    <TableHead className="text-center">応答</TableHead>
                    <TableHead className="text-center">不在</TableHead>
                    <TableHead className="text-center">話し中</TableHead>
                    <TableHead className="text-center">折返し</TableHead>
                    <TableHead className="text-center">アポ</TableHead>
                    <TableHead className="text-center">見送り</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyAggregated.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="text-sm font-medium">{day.date}</TableCell>
                      <TableCell className="text-center font-bold text-blue-700">{day.total}</TableCell>
                      <TableCell className="text-center text-green-700">{day.answered || "-"}</TableCell>
                      <TableCell className="text-center text-gray-600">{day.noAnswer || "-"}</TableCell>
                      <TableCell className="text-center text-yellow-700">{day.busy || "-"}</TableCell>
                      <TableCell className="text-center text-indigo-700">{day.callback || "-"}</TableCell>
                      <TableCell className="text-center text-purple-700">{day.meetingSet || "-"}</TableCell>
                      <TableCell className="text-center text-red-700">{day.rejected || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recent Call History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            架電履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCallLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">履歴なし</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日時</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>相手先</TableHead>
                    <TableHead>会社</TableHead>
                    <TableHead>結果</TableHead>
                    <TableHead>メモ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCallLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {log.calledAt ? new Date(log.calledAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-indigo-700">{log.callerName || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.businessCardId ? (
                          <a href={`/master/business-cards/${log.businessCardId}`} className="text-blue-600 hover:underline cursor-pointer">{log.contactName || "—"}</a>
                        ) : (log.contactName || "—")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.contactCompany || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${
                          log.result === "answered" ? "bg-green-50 text-green-700 border-green-200" :
                          log.result === "no_answer" ? "bg-gray-50 text-gray-700 border-gray-200" :
                          log.result === "busy" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          log.result === "callback" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          log.result === "meeting_set" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          log.result === "rejected" ? "bg-red-50 text-red-700 border-red-200" : ""
                        }`}>
                          {log.result === "answered" ? "応答" :
                           log.result === "no_answer" ? "不在" :
                           log.result === "busy" ? "話し中" :
                           log.result === "callback" ? "折返し" :
                           log.result === "meeting_set" ? "アポ確定" :
                           log.result === "rejected" ? "見送り" : log.result}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{log.memo || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

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


// ============================================================
// メール送信履歴セクション（名刺詳細ダイアログ内で使用）
// ============================================================
function EmailHistorySection({ email, businessCardId }: { email: string; businessCardId: number }) {
  const { data: emailLogs, isLoading } = trpc.businessCard.getSalesEmailLogsByEmail.useQuery(
    { email },
    { enabled: !!email }
  );

  if (isLoading) {
    return (
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          メール送信履歴を読み込み中...
        </div>
      </div>
    );
  }

  if (!emailLogs || emailLogs.length === 0) {
    return (
      <div className="pt-3 border-t">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" />
          メール送信履歴なし
        </p>
      </div>
    );
  }

    const sendTypeLabel = (type: string) => {
    switch (type) {
      case "test": return "テスト";
      case "bulk_card": return "名刺一括";
      case "bulk_lead": return "リード一括";
      case "bulk_unsent": return "未送信一括";
      case "bulk_all": return "全件一括";
      case "bulk_kalodata": return "Kalodata";
      default: return type;
    }
  };
  return (
    <div className="pt-3 border-t space-y-2">
      <p className="text-sm font-medium flex items-center gap-2">
        <History className="h-4 w-4 text-blue-600" />
        メール送信履歴（{emailLogs.length}件）
      </p>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {emailLogs.map((log: any) => (
          <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs">
            {log.status === "sent" ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {sendTypeLabel(log.sendType)}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(log.sentAt).toLocaleString("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="truncate mt-0.5 text-foreground">{log.subject}</p>
              {log.attachPdf && (
                <span className="text-purple-600">📎 PDF添付</span>
              )}
              {log.errorMessage && (
                <p className="text-red-500 mt-0.5 truncate">{log.errorMessage}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================================
// 営業メール送信履歴セクション（emailタブ内にインライン表示）
// 開封トラッキング + PDFダウンロードトラッキング表示
// ============================================================
function SalesEmailHistorySection() {
  const [search, setSearch] = useState("");
  const [sendTypeFilter, setSendTypeFilter] = useState<string>("_all");
  const [statusFilter, setStatusFilter] = useState<string>("_all");
  const [sortBy, setSortBy] = useState<string>("sentAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const limit = 20;
  const [, navigate] = useLocation();
  const [replyCheckDone, setReplyCheckDone] = useState(false);

  // 返信チェック mutation
  const checkRepliesMutation = trpc.replyTracking.checkReplies.useMutation({
    onSuccess: (result) => {
      setReplyCheckDone(true);
      if (result.newReplies > 0) {
        toast.success(`${result.newReplies}件の新しい返信を検出しました`, {
          description: `チェック: ${result.checked}件 / スキャン: ${result.scannedInbox}件`,
        });
        refetch();
      } else {
        toast.info("新しい返信はありませんでした", {
          description: `チェック: ${result.checked}件 / スキャン: ${result.scannedInbox}件`,
        });
      }
    },
    onError: (err) => {
      setReplyCheckDone(true);
      toast.error("返信チェックに失敗しました", {
        description: err.message,
      });
      console.error("[Reply Check]", err.message);
    },
  });

  // ページ読み込み時に自動で返信チェック実行（1回のみ）
  useEffect(() => {
    if (!replyCheckDone && !checkRepliesMutation.isPending) {
      checkRepliesMutation.mutate();
    }
  }, []);

  const { data, isLoading, refetch } = trpc.businessCard.getSalesEmailLogs.useQuery(
    {
      search: search || undefined,
      sendType: sendTypeFilter === "_all" ? undefined : sendTypeFilter,
      statusFilter: statusFilter === "_all" ? undefined : statusFilter,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    },
    { refetchOnWindowFocus: false, staleTime: 30_000, placeholderData: (prev: any) => prev }
  );

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-30" />;
    return sortOrder === "desc" 
      ? <ArrowDown className="h-3 w-3 ml-0.5 text-blue-600" />
      : <ArrowUp className="h-3 w-3 ml-0.5 text-blue-600" />;
  };

  const sendTypeLabel = (type: string) => {
    switch (type) {
      case "test": return "テスト";
      case "bulk_card": return "名刺一括";
      case "bulk_lead": return "リード一括";
      case "bulk_unsent": return "未送信一括";
      case "bulk_all": return "全件一括";
      case "bulk_kalodata": return "Kalodata";
      default: return type;
    }
  };

  const sendTypeBadgeColor = (type: string) => {
    switch (type) {
      case "test": return "bg-gray-100 text-gray-700 border-gray-300";
      case "bulk_card": return "bg-green-50 text-green-700 border-green-300";
      case "bulk_lead": return "bg-blue-50 text-blue-700 border-blue-300";
      case "bulk_all": return "bg-purple-50 text-purple-700 border-purple-300";
      case "bulk_kalodata": return "bg-amber-50 text-amber-700 border-amber-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-blue-600" />
          営業メール送信履歴
          {data && (
            <Badge variant="outline" className="ml-2 text-xs">
              全{data.total}件
            </Badge>
          )}
        </CardTitle>
        {/* フィルター */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Input
            placeholder="メール/名前/会社で検索..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-8 w-48 text-sm"
          />
          <Select value={sendTypeFilter} onValueChange={(v) => { setSendTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="種別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全種別</SelectItem>
              <SelectItem value="test">テスト</SelectItem>
              <SelectItem value="bulk_card">名刺一括</SelectItem>
              <SelectItem value="bulk_lead">リード一括</SelectItem>
              <SelectItem value="bulk_all">全件一括</SelectItem>
              <SelectItem value="bulk_kalodata">Kalodata</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="状態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全状態</SelectItem>
              <SelectItem value="opened">開封済</SelectItem>
              <SelectItem value="replied">返信あり</SelectItem>
              <SelectItem value="pdf_downloaded">PDFダウンロード済</SelectItem>
              <SelectItem value="sent">送信成功</SelectItem>
              <SelectItem value="failed">失敗</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8" title="履歴を更新">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => checkRepliesMutation.mutate()} 
            disabled={checkRepliesMutation.isPending}
            className="h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
            title="IMAP受信トレイをスキャンして返信を検出"
          >
            {checkRepliesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
            返信チェック
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
          </div>
        ) : !data?.rows || data.rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            送信履歴がありません
          </div>
        ) : (
          <>
            {/* テーブル */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[140px]">宛先</TableHead>
                    <TableHead className="text-xs w-[100px]">会社</TableHead>
                    <TableHead className="text-xs">件名</TableHead>
                    <TableHead className="text-xs w-[70px]">種別</TableHead>
                    <TableHead className="text-xs w-[60px]">状態</TableHead>
                    <TableHead className="text-xs w-[80px] cursor-pointer select-none" onClick={() => handleSort("openCount")}>
                      <span className="flex items-center">開封<SortIcon field="openCount" /></span>
                    </TableHead>
                    <TableHead className="text-xs w-[60px] cursor-pointer select-none" onClick={() => handleSort("replyReceived")}>
                      <span className="flex items-center">返信<SortIcon field="replyReceived" /></span>
                    </TableHead>
                    <TableHead className="text-xs w-[80px]">PDF</TableHead>
                    <TableHead className="text-xs w-[100px] cursor-pointer select-none" onClick={() => handleSort("sentAt")}>
                      <span className="flex items-center">送信日時<SortIcon field="sentAt" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs">
                        <button
                          className="text-blue-600 hover:underline cursor-pointer font-medium text-left"
                          onClick={() => {
                            if (log.businessCardId) {
                              navigate(`/master/business-cards/${log.businessCardId}`);
                            }
                          }}
                          disabled={!log.businessCardId}
                          title={log.businessCardId ? "個人ページを開く" : "名刺未紐付け"}
                        >
                          {log.toName || log.toEmail}
                        </button>
                        <a href={`/master/email-thread/${encodeURIComponent(log.toEmail)}`} className="text-[10px] text-blue-500 hover:underline truncate max-w-[130px] block">{log.toEmail}</a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {log.toCompany || "—"}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]" title={log.subject}>
                        {log.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sendTypeBadgeColor(log.sendType)}`}>
                          {sendTypeLabel(log.sendType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.status === "sent" ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-300" variant="outline">成功</Badge>
                        ) : log.status === "failed" ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-300" variant="outline">失敗</Badge>
                        ) : (
                          <Badge className="text-[10px] px-1.5 py-0 bg-yellow-50 text-yellow-700 border-yellow-300" variant="outline">{log.status || "不明"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.openCount > 0 ? (
                          <div className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">{log.openCount}回</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未開封</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.replyReceived ? (
                          <button
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate(`/master/email-thread/${encodeURIComponent(log.toEmail)}`)}
                            title="返信スレッドを表示"
                          >
                            <Badge className="text-[10px] px-1.5 py-0 bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100" variant="outline">
                              ✉️ あり
                            </Badge>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.pdfDownloadCount > 0 ? (
                          <div className="flex items-center gap-1">
                            <Download className="h-3.5 w-3.5 text-purple-600" />
                            <span className="text-xs text-purple-700 font-medium">{log.pdfDownloadCount}回</span>
                          </div>
                        ) : log.attachPdf ? (
                          <span className="text-xs text-muted-foreground">未DL</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString("ja-JP", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  {page * limit + 1}〜{Math.min((page + 1) * limit, data.total)}件 / 全{data.total}件
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 0}
                    onClick={() => setPage(p => p - 1)}
                    className="h-7 px-2"
                  >
                    ←
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="h-7 px-2"
                  >
                    →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
