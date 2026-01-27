import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ArrowLeft, Plus, Trash2, Edit2, Package, Calendar, DollarSign, Percent, Users, Video, Clock, Eye, FileText, ChevronDown, ChevronUp, MessageSquare, Send, User, Sparkles, Image, Loader2, Upload, Globe, X, ZoomIn, Info, History, ChevronLeft, ChevronRight, Download, FolderOpen, Link, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const translations = {
  ja: {
    title: "ブランド詳細",
    back: "戻る",
    details: "詳細",
    edit: "編集",
    // KPI
    totalGmv: "GMV実績",
    monthlyGmv: "今月GMV",
    products: "商品",
    livestreams: "直播",
    contracts: "契約",
    commissionRate: "成果報酬",
    manager: "負責人",
    // Tables
    productPerformance: "商品パフォーマンス",
    productName: "商品名",
    listPrice: "定価",
    specialPrice: "特価",
    gmv: "GMV",
    livestreamPerformance: "直播パフォーマンス",
    date: "日付",
    account: "アカウント",
    platform: "プラットフォーム",
    duration: "時間",
    productClicks: "商品クリック",
    impressions: "インプレッション",
    salesCount: "販売件数",
    cartAddCount: "カート追加",
    ctr: "CTR",
    cvr: "CVR",
    cpc: "CPC",
    acos: "ACOS",
    roas: "ROAS",
    adCost: "広告費",
    aiImageAdd: "AI画像追加",
    // Contract
    contractInfo: "契約情報",
    serviceType: "サービス種類",
    contractType: "契約形態",
    fixedFee: "固定費",
    startDate: "開始日",
    endDate: "終了日",
    status: "ステータス",
    // Memo
    activityMemos: "活動メモ",
    addMemo: "メモを追加",
    memoPlaceholder: "メモを入力...",
    noMemos: "メモがありません",
    // Basic info dialog
    basicInfo: "基本情報",
    brandName: "ブランド名",
    brandNameJa: "日本語読み",
    companyName: "会社名",
    category: "カテゴリー",
    phoneNumber: "電話番号",
    email: "メールアドレス",
    contactPerson: "担当者名",
    memo: "メモ",
    close: "閉じる",
    save: "保存",
    cancel: "キャンセル",
    // Status
    inProgress: "進行中",
    meeting: "打ち合わせ中",
    contracted: "契約済み",
    onHold: "保留",
    ended: "終了",
    // Contract status
    contractActive: "契約中",
    contractCompleted: "完了",
    contractOnHold: "保留",
    contractEnded: "終了",
    // Service types
    tsp: "TSP",
    liveCommerce: "ライブコマース",
    adManagement: "広告運用代行",
    snsManagement: "SNS運用代行",
    otherService: "その他",
    // Contract types
    monthlyContract: "月額契約",
    annualContract: "年間契約",
    oneTimeContract: "単発契約",
    adCampaign: "広告案件",
    otherContract: "その他",
    noData: "-",
    items: "品",
    times: "回",
    cases: "件",
    add: "追加",
    editLog: "編集ログ",
    noEditLogs: "編集履歴はありません",
    // Brand Files
    brandFiles: "ブランドファイル",
    uploadFile: "ファイルをアップロード",
    noFiles: "ファイルはありません",
    deleteFile: "削除",
    uploading: "アップロード中...",
  },
  zh: {
    title: "品牌详情",
    back: "返回",
    details: "详情",
    edit: "编辑",
    // KPI
    totalGmv: "GMV实绩",
    monthlyGmv: "本月GMV",
    products: "商品",
    livestreams: "直播",
    contracts: "合同",
    commissionRate: "成果报酬",
    manager: "负责人",
    // Tables
    productPerformance: "商品表现",
    productName: "商品名",
    listPrice: "定价",
    specialPrice: "特价",
    gmv: "GMV",
    livestreamPerformance: "直播表现",
    date: "日期",
    account: "账号",
    platform: "平台",
    duration: "时长",
    productClicks: "商品点击",
    impressions: "商品曝光",
    salesCount: "销售件数",
    cartAddCount: "加购数",
    ctr: "CTR",
    cvr: "CVR",
    cpc: "CPC",
    acos: "ACOS",
    roas: "ROAS",
    adCost: "广告费",
    aiImageAdd: "AI图片添加",
    // Contract
    contractInfo: "合同信息",
    serviceType: "服务类型",
    contractType: "合同类型",
    fixedFee: "固定费用",
    startDate: "开始日期",
    endDate: "结束日期",
    status: "状态",
    // Memo
    activityMemos: "活动备忘",
    addMemo: "添加备忘",
    memoPlaceholder: "输入备忘...",
    noMemos: "没有备忘",
    // Basic info dialog
    basicInfo: "基本信息",
    brandName: "品牌名",
    brandNameJa: "日语读音",
    companyName: "公司名",
    category: "类别",
    phoneNumber: "电话号码",
    email: "邮箱地址",
    contactPerson: "负责人",
    memo: "备注",
    close: "关闭",
    save: "保存",
    cancel: "取消",
    // Status
    inProgress: "进行中",
    meeting: "洽谈中",
    contracted: "已签约",
    onHold: "保留",
    ended: "结束",
    // Contract status
    contractActive: "合同中",
    contractCompleted: "已完成",
    contractOnHold: "暂停",
    contractEnded: "已结束",
    // Service types
    tsp: "TSP",
    liveCommerce: "直播电商",
    adManagement: "广告运营代理",
    snsManagement: "SNS运营代理",
    otherService: "其他",
    // Contract types
    monthlyContract: "月度合同",
    annualContract: "年度合同",
    oneTimeContract: "单次合同",
    adCampaign: "广告项目",
    otherContract: "其他",
    noData: "-",
    items: "品",
    times: "回",
    cases: "件",
    add: "添加",
    editLog: "编辑日志",
    noEditLogs: "没有编辑历史",
    // Brand Files
    brandFiles: "品牌文件",
    uploadFile: "上传文件",
    noFiles: "没有文件",
    deleteFile: "删除",
    uploading: "上传中...",
  },
};

const statusTranslations: Record<string, Record<string, string>> = {
  ja: {
    "進行中": "進行中",
    "打ち合わせ中": "打ち合わせ中",
    "契約済み": "契約済み",
    "保留": "保留",
    "終了": "終了",
    "契約中": "契約中",
    "完了": "完了",
  },
  zh: {
    "進行中": "进行中",
    "打ち合わせ中": "洽谈中",
    "契約済み": "已签约",
    "保留": "保留",
    "終了": "结束",
    "契約中": "合同中",
    "完了": "已完成",
  },
};

const serviceTypeTranslations: Record<string, Record<string, string>> = {
  ja: {
    "TSP": "TSP",
    "ライブコマース": "ライブコマース",
    "広告運用代行": "広告運用代行",
    "SNS運用代行": "SNS運用代行",
    "その他": "その他",
  },
  zh: {
    "TSP": "TSP",
    "ライブコマース": "直播电商",
    "広告運用代行": "广告运营代理",
    "SNS運用代行": "SNS运营代理",
    "その他": "其他",
  },
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `¥${value.toLocaleString()}`;
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
};

// 編集ログセクションコンポーネント
function EditLogSection({ brandId, language, noEditLogsText }: { brandId: number; language: string; noEditLogsText: string }) {
  const { data: editLogs = [] } = trpc.brand.getEditLogs.useQuery(
    { brandId, limit: 50 },
    { enabled: brandId > 0 }
  );

  const actionTypeLabels: Record<string, Record<string, string>> = {
    ja: {
      create: "追加",
      update: "編集",
      delete: "削除",
    },
    zh: {
      create: "添加",
      update: "编辑",
      delete: "删除",
    },
  };

  const entityTypeLabels: Record<string, Record<string, string>> = {
    ja: {
      product: "商品",
      livestream: "ライブ配信",
      contract: "契約",
    },
    zh: {
      product: "商品",
      livestream: "直播",
      contract: "合同",
    },
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case "create": return "text-green-400 bg-green-500/20";
      case "update": return "text-amber-400 bg-amber-500/20";
      case "delete": return "text-red-400 bg-red-500/20";
      default: return "text-gray-400 bg-gray-500/20";
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "product": return <Package className="h-3 w-3" />;
      case "livestream": return <Video className="h-3 w-3" />;
      case "contract": return <FileText className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  if (editLogs.length === 0) {
    return <p className="text-gray-500 text-center py-8">{noEditLogsText}</p>;
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {editLogs.map((log: any, index: number) => (
        <div key={log.id} className="relative pl-6 pb-2">
          {/* Timeline line */}
          {index < editLogs.length - 1 && (
            <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-purple-900/30" />
          )}
          {/* Timeline dot */}
          <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-purple-900/50 border-2 border-purple-500/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          {/* Content */}
          <div className="bg-black/50 rounded-lg border border-purple-900/20 p-3 hover:border-purple-500/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.actionType)}`}>
                    {actionTypeLabels[language]?.[log.actionType] || log.actionType}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    {getEntityIcon(log.entityType)}
                    {entityTypeLabels[language]?.[log.entityType] || log.entityType}
                  </span>
                </div>
                <div className="text-white text-sm">
                  {log.changeDescription.split('\n').map((line: string, i: number) => (
                    <p key={i} className={i === 0 ? '' : 'text-gray-400 text-xs ml-2 mt-0.5'}>{line}</p>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {log.userName || '不明'}
                  </span>
                  <span>
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ブランドファイルセクションコンポーネント
function BrandFilesSection({ brandId, t }: { brandId: number; t: any }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { data: files = [], refetch } = trpc.brandFiles.list.useQuery(
    { brandId },
    { enabled: brandId > 0 }
  );
  
  const createFileMutation = trpc.brandFiles.create.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  const deleteFileMutation = trpc.brandFiles.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brandId", brandId.toString());
      
      const response = await fetch("/api/brand-file-upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      const result = await response.json();
      
      await createFileMutation.mutateAsync({
        brandId,
        fileName: result.fileName,
        fileUrl: result.url,
        fileKey: result.key,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileText className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4 text-red-400" />;
    if (mimeType.includes("image")) return <Image className="h-4 w-4 text-blue-400" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileText className="h-4 w-4 text-green-400" />;
    if (mimeType.includes("zip") || mimeType.includes("compressed")) return <FolderOpen className="h-4 w-4 text-amber-400" />;
    return <FileText className="h-4 w-4" />;
  };
  
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white"
          size="sm"
        >
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.uploading}</>
          ) : (
            <><Plus className="h-4 w-4 mr-2" />{t.uploadFile}</>
          )}
        </Button>
      </div>
      
      {files.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{t.noFiles}</p>
      ) : (
        <div className="space-y-2">
          {files.map((file: any) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-black/50 rounded-lg border border-red-900/20 p-3 hover:border-red-500/30 transition-colors group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(file.mimeType)}
                <div className="flex-1 min-w-0">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-cyan-400 transition-colors truncate block"
                  >
                    {file.fileName}
                  </a>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>{new Date(file.createdAt).toLocaleDateString("ja-JP")}</span>
                    <span>{file.uploadedByName}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteFileMutation.mutate({ fileId: file.id, brandId })}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 契約ROAS表示コンポーネント
const INDUSTRY_AVG_ROAS = 0.8; // 業界平均ROAS

function ContractRoasDisplay({ contractId, fixedFee, onLinkClick, onViewDetails }: { contractId: number; fixedFee: number; onLinkClick?: () => void; onViewDetails?: (livestreams: any[]) => void }) {
  const { data: linkedLivestreams = [] } = trpc.brandContract.getLinkedLivestreams.useQuery(
    { contractId },
    { enabled: contractId > 0 }
  );

  // 紐付けがない場合は紐付けボタンを表示
  if (linkedLivestreams.length === 0) {
    return (
      <div className="mt-1 bg-black/40 rounded-lg p-2 border border-dashed border-amber-500/30">
        <button
          onClick={onLinkClick}
          className="w-full flex items-center justify-center gap-2 text-amber-400/70 hover:text-amber-400 transition-colors py-1"
        >
          <Video className="h-4 w-4" />
          <span className="text-sm">ライブを紐付けてROASを計算</span>
        </button>
      </div>
    );
  }

  if (fixedFee <= 0) {
    return null;
  }

  const totalGmv = linkedLivestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
  const totalImpressions = linkedLivestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
  const adValue = totalImpressions * 15; // CPM ¥15,000
  // 総価値 = GMV + 広告換算費用（節約できた価値）
  const totalValue = totalGmv + adValue;
  // ROAS = (GMV + 広告換算費用) ÷ 固定費
  const roas = fixedFee > 0 ? totalValue / fixedFee : 0;
  const vsIndustry = roas / INDUSTRY_AVG_ROAS;

  return (
    <div 
      className="mt-1 bg-gradient-to-r from-amber-950/40 via-pink-950/30 to-purple-950/40 rounded-lg p-1.5 border border-amber-500/30 cursor-pointer hover:border-amber-400/50 transition-all"
      onClick={() => onViewDetails?.(linkedLivestreams)}
    >
      {/* メイン数値とROASを横並びにコンパクト配置 */}
      <div className="flex items-center justify-between gap-2">
        {/* 左側: 数値グリッド */}
        <div className="grid grid-cols-4 gap-2 flex-1">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Video className="h-2.5 w-2.5 text-amber-400" />
              <span className="text-[9px] text-gray-500">紐付け</span>
            </div>
            <span className="text-sm font-black text-amber-400">{linkedLivestreams.length}<span className="text-[10px]">件</span></span>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-500">GMV</div>
            <span className="text-sm font-black text-cyan-400 font-mono">{formatCurrency(totalGmv)}</span>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-500">曝光</div>
            <span className="text-sm font-black text-pink-400 font-mono">{totalImpressions.toLocaleString()}</span>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-500">広告換算</div>
            <span className="text-sm font-black text-purple-400 font-mono">{formatCurrency(adValue)}</span>
          </div>
        </div>
        {/* 右側: ROAS */}
        <div className="text-right border-l border-amber-500/20 pl-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">📊 広告効果ROAS</span>
            <span className="text-xl font-black bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              {roas.toFixed(2)}倍
            </span>
          </div>
          <div className="text-[10px] text-emerald-400 font-medium">
            → 業界平均の {vsIndustry.toFixed(1)}倍（{vsIndustry > 1 ? '显著高于基准' : '基准以下'}）
          </div>
          <div className="text-[7px] text-gray-600">
            ※ (GMV{formatCurrency(totalGmv)}+広告換算{formatCurrency(adValue)})÷固定費{formatCurrency(fixedFee)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { language, setLanguage } = useLanguage();

  const t = translations[language as keyof typeof translations] || translations.ja;

  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isContractExpanded, setIsContractExpanded] = useState(false);
  const [newMemo, setNewMemo] = useState("");

  // Edit modal states
  const [editProductDialogOpen, setEditProductDialogOpen] = useState(false);
  const [editLivestreamDialogOpen, setEditLivestreamDialogOpen] = useState(false);
  const [editContractDialogOpen, setEditContractDialogOpen] = useState(false);
  const [editMemoDialogOpen, setEditMemoDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingLivestream, setEditingLivestream] = useState<any>(null);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [editingMemo, setEditingMemo] = useState<any>(null);
  const [aiAnalysisDialogOpen, setAiAnalysisDialogOpen] = useState(false);
  const [selectedProductForAi, setSelectedProductForAi] = useState<any>(null);
  const [selectedImageForAi, setSelectedImageForAi] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingProductId, setUploadingProductId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [addLivestreamDialogOpen, setAddLivestreamDialogOpen] = useState(false);
  const [addContractDialogOpen, setAddContractDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ productName: "", listPrice: 0, specialPrice: 0, commissionRate: "", remarks: "" });
  const [newLivestream, setNewLivestream] = useState({ livestreamDate: "", livestreamStartTime: "", streamerName: "", platform: "TikTok", duration: 0, gmv: 0, remarks: "", productClicks: 0, impressions: 0, salesCount: 0, cartAddCount: 0, productId: null as number | null, productCommission: "", adCost: 0, ctr: "", cvr: "", cpc: 0, acos: "", roas: "" });
  const [newContract, setNewContract] = useState({ serviceType: "単発ライブ契約" as "単発ライブ契約" | "期間契約" | "運用代行型（TSP）" | "パッケージ／複合契約", fixedFee: 0, status: "契約中" as "契約中" | "完了" | "保留" | "終了", startDate: "", endDate: "", memo: "", linkedLivestreamIds: [] as number[] });
  // Delete states
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false);
  const [deleteLivestreamDialogOpen, setDeleteLivestreamDialogOpen] = useState(false);
  const [deleteContractDialogOpen, setDeleteContractDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [livestreamToDelete, setLivestreamToDelete] = useState<any>(null);
  const [contractToDelete, setContractToDelete] = useState<any>(null);
  // Product Detail Popup states
  const [productDetailDialogOpen, setProductDetailDialogOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<any>(null);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [expandedImageIndex, setExpandedImageIndex] = useState<number>(0);
  // 商品画像ギャラリー用state
  const [productImages, setProductImages] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  // 商品リンク管理用state
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  // 紐付けライブ詳細ダイアログ
  const [linkedLivestreamDetailDialogOpen, setLinkedLivestreamDetailDialogOpen] = useState(false);
  const [linkedLivestreamDetailData, setLinkedLivestreamDetailData] = useState<any[]>([]);
  const [linkedLivestreamContractInfo, setLinkedLivestreamContractInfo] = useState<any>(null);
  
  // AI Image Add states
  const [aiImageAddDialogOpen, setAiImageAddDialogOpen] = useState(false);
  const [aiImageFile, setAiImageFile] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [extractedProductData, setExtractedProductData] = useState<any>(null);
  const aiImageInputRef = useRef<HTMLInputElement>(null);

  const brandId = parseInt(id || "0");

  // Data fetching
  const { data: brand, isLoading: brandLoading } = trpc.brand.getById.useQuery({ id: brandId });
  const { data: allBrands = [] } = trpc.brand.list.useQuery();
  const { data: products = [], refetch: refetchProducts } = trpc.brandProduct.listByBrand.useQuery({ brandId });
  const { data: livestreams = [], refetch: refetchLivestreams } = trpc.brandLivestream.listByBrand.useQuery({ brandId });
  const { data: contracts = [], refetch: refetchContracts } = trpc.brandContract.listByBrand.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: memos = [], refetch: refetchMemos } = trpc.brandMemo.listByBrand.useQuery({ brandId });
  const { data: monthlyGmvSummary = [] } = trpc.brandLivestream.monthlyGmvSummary.useQuery({ brandId });
  const { data: lcjStaff = [] } = trpc.brand.getLcjStaff.useQuery({ brandId }, { enabled: brandId > 0 });

  // Mutations
  const createMemoMutation = trpc.brandMemo.create.useMutation({
    onSuccess: () => {
      setNewMemo("");
      refetchMemos();
      toast.success("メモを追加しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const deleteMemoMutation = trpc.brandMemo.delete.useMutation({
    onSuccess: () => {
      refetchMemos();
      toast.success("削除しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  // Create mutations
  const createProductMutation = trpc.brandProduct.create.useMutation({
    onSuccess: () => {
      refetchProducts();
      setAddProductDialogOpen(false);
      setNewProduct({ productName: "", listPrice: 0, specialPrice: 0, commissionRate: "", remarks: "" });
      toast.success("商品を追加しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const createLivestreamMutation = trpc.brandLivestream.create.useMutation({
    onSuccess: () => {
      refetchLivestreams();
      setAddLivestreamDialogOpen(false);
      setNewLivestream({ livestreamDate: "", livestreamStartTime: "", streamerName: "", platform: "TikTok", duration: 0, gmv: 0, remarks: "", productClicks: 0, impressions: 0, salesCount: 0, cartAddCount: 0, productId: null, productCommission: "", adCost: 0, ctr: "", cvr: "", cpc: 0, acos: "", roas: "" });
      toast.success("直播を追加しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const createContractMutation = trpc.brandContract.create.useMutation({
    onSuccess: () => {
      refetchContracts();
      setAddContractDialogOpen(false);
      setNewContract({ serviceType: "単発ライブ契約", fixedFee: 0, status: "契約中", startDate: "", endDate: "", memo: "", linkedLivestreamIds: [] });
      toast.success(language === 'zh' ? '合同已添加' : '契約を追加しました');
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  // Product Image mutations
  const addProductImageMutation = trpc.brandProduct.addImage.useMutation({
    onSuccess: () => {
      if (selectedProductForDetail) {
        loadProductImages(selectedProductForDetail.id);
      }
      toast.success(language === 'ja' ? '画像を追加しました' : '图片已添加');
    },
    onError: () => {
      toast.error(language === 'ja' ? 'エラーが発生しました' : '发生错误');
    },
  });

  const deleteProductImageMutation = trpc.brandProduct.deleteImage.useMutation({
    onSuccess: () => {
      if (selectedProductForDetail) {
        loadProductImages(selectedProductForDetail.id);
      }
      toast.success(language === 'ja' ? '画像を削除しました' : '图片已删除');
    },
    onError: () => {
      toast.error(language === 'ja' ? 'エラーが発生しました' : '发生错误');
    },
  });

  // Delete mutations
  const deleteProductMutation = trpc.brandProduct.delete.useMutation({
    onSuccess: () => {
      refetchProducts();
      setDeleteProductDialogOpen(false);
      setProductToDelete(null);
      toast.success("商品を削除しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const deleteLivestreamMutation = trpc.brandLivestream.delete.useMutation({
    onSuccess: () => {
      refetchLivestreams();
      setDeleteLivestreamDialogOpen(false);
      setLivestreamToDelete(null);
      toast.success("直播を削除しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const deleteContractMutation = trpc.brandContract.delete.useMutation({
    onSuccess: () => {
      refetchContracts();
      setDeleteContractDialogOpen(false);
      setContractToDelete(null);
      toast.success(language === 'zh' ? '合同已删除' : '契約を削除しました');
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  // Edit mutations
  const updateProductMutation = trpc.brandProduct.update.useMutation({
    onSuccess: () => {
      refetchProducts();
      setEditProductDialogOpen(false);
      setEditingProduct(null);
      toast.success("商品を更新しました");
    },
    onError: (error) => {
      console.error("商品更新エラー:", error);
      toast.error("エラーが発生しました");
    },
  });

  const updateLivestreamMutation = trpc.brandLivestream.update.useMutation({
    onSuccess: () => {
      refetchLivestreams();
      setEditLivestreamDialogOpen(false);
      setEditingLivestream(null);
      toast.success("直播を更新しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  const updateContractMutation = trpc.brandContract.update.useMutation({
    onSuccess: () => {
      refetchContracts();
      setEditContractDialogOpen(false);
      setEditingContract(null);
      toast.success("契約を更新しました");
    },
    onError: (error: any) => {
      console.error("契約更新エラー:", error);
      console.error("エラー詳細:", JSON.stringify(error, null, 2));
      console.error("エラーメッセージ:", error?.message);
      console.error("エラーデータ:", error?.data);
      toast.error("エラーが発生しました: " + (error?.message || "不明なエラー"));
    },
  });

  // ライブ紐付けミューテーション
  const bulkLinkLivestreamsMutation = trpc.brandContract.bulkLinkLivestreams.useMutation({
    onSuccess: () => {
      refetchContracts();
    },
    onError: (error) => {
      console.error('ライブ紐付けエラー:', error);
    },
  });

  const updateMemoMutation = trpc.brandMemo.update.useMutation({
    onSuccess: () => {
      refetchMemos();
      setEditMemoDialogOpen(false);
      setEditingMemo(null);
      toast.success("メモを更新しました");
    },
    onError: () => {
      toast.error("エラーが発生しました");
    },
  });

  // 画像アップロードミューテーション
  const uploadImageMutation = trpc.brand.uploadImage.useMutation();

  // 商品画像を読み込む関数
  const { data: productImagesData, refetch: refetchProductImages } = trpc.brandProduct.getImages.useQuery(
    { productId: selectedProductForDetail?.id || 0 },
    { enabled: !!selectedProductForDetail?.id }
  );

  // 商品リンクを取得
  const { data: productLinksData = [], refetch: refetchProductLinks } = trpc.productLinks.list.useQuery(
    { productId: selectedProductForDetail?.id || 0 },
    { enabled: !!selectedProductForDetail?.id }
  );

  // 商品リンク追加ミューテーション
  const addProductLinkMutation = trpc.productLinks.add.useMutation({
    onSuccess: () => {
      refetchProductLinks();
      setNewLinkTitle('');
      setNewLinkUrl('');
      setIsAddingLink(false);
      toast.success(language === 'ja' ? 'リンクを追加しました' : '链接已添加');
    },
    onError: (error) => {
      toast.error(language === 'ja' ? 'リンクの追加に失敗しました' : '添加链接失败');
    },
  });

  // 商品リンク削除ミューテーション
  const deleteProductLinkMutation = trpc.productLinks.delete.useMutation({
    onSuccess: () => {
      refetchProductLinks();
      toast.success(language === 'ja' ? 'リンクを削除しました' : '链接已删除');
    },
    onError: () => {
      toast.error(language === 'ja' ? 'リンクの削除に失敗しました' : '删除链接失败');
    },
  });

  // 商品画像を読み込む
  const loadProductImages = async (productId: number) => {
    refetchProductImages();
  };

  // 商品画像データが更新されたらstateを更新
  React.useEffect(() => {
    // 既存の商品画像を含めて画像リストを作成
    const existingImages: any[] = [];
    
    // imageUrlsから画像を取得（proposalImageUrlの代わりに）
    const productImageUrls = selectedProductForDetail?.imageUrls || [];
    if (productImageUrls.length > 0) {
      productImageUrls.forEach((url: string, index: number) => {
        existingImages.push({
          id: -index - 1, // 負のIDで既存画像を識別
          imageUrl: url,
          isProposalImage: index === 0, // 最初の画像をメイン画像として扱う
        });
      });
    }
    
    // 追加でアップロードされた画像
    const additionalImages = productImagesData || [];
    setProductImages([...existingImages, ...additionalImages]);
    setCurrentImageIndex(0);
  }, [productImagesData, selectedProductForDetail?.imageUrls, selectedProductForDetail?.id]);

  // キーボードで画像を切り替え
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!productDetailDialogOpen || productImages.length <= 1) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : productImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentImageIndex((prev) => (prev < productImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productDetailDialogOpen, productImages.length]);

  // 商品画像をアップロード
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProductForDetail) return;

    setIsAddingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // ファイルをアップロード
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await uploadImageMutation.mutateAsync({
          base64: base64,
          filename: file.name,
          type: 'product' as const,
        });

        // 画像をデータベースに保存
        await addProductImageMutation.mutateAsync({
          productId: selectedProductForDetail.id,
          imageUrl: result.url,
          imageKey: result.key,
        });

        setIsAddingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(language === 'ja' ? '画像のアップロードに失敗しました' : '图片上传失败');
      setIsAddingImage(false);
    }
  };

  // PDFダウンロード
  const handleDownloadPdf = async () => {
    if (productImages.length === 0 || !selectedProductForDetail) {
      toast.error(language === 'ja' ? 'ダウンロードする画像がありません' : '没有可下载的图片');
      return;
    }

    toast.info(language === 'ja' ? 'PDFを生成中...' : '正在生成PDF...');

    try {
      // jspdfを動的にインポート
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      for (let i = 0; i < productImages.length; i++) {
        if (i > 0) pdf.addPage();

        const img = productImages[i];
        const imageUrl = img.imageUrl;

        // 画像を読み込んでPDFに追加（プロキシAPI経由でCORS回避）
        try {
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          const response = await fetch(proxyUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          // 画像のアスペクト比を維持してページに収まるように計算
          const imgProps = pdf.getImageProperties(base64);
          const maxWidth = pageWidth - margin * 2;
          const maxHeight = pageHeight - margin * 2;
          let imgWidth = imgProps.width;
          let imgHeight = imgProps.height;

          const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
          imgWidth *= ratio;
          imgHeight *= ratio;

          const x = (pageWidth - imgWidth) / 2;
          const y = (pageHeight - imgHeight) / 2;

          pdf.addImage(base64, 'JPEG', x, y, imgWidth, imgHeight);
        } catch (imgError) {
          console.error('Error loading image:', imgError);
          pdf.text(`Image ${i + 1} could not be loaded`, margin, margin + 10);
        }
      }

      // ダウンロード
      const fileName = `${selectedProductForDetail.productName || 'product'}_images.pdf`;
      pdf.save(fileName);
      toast.success(language === 'ja' ? 'PDFをダウンロードしました' : 'PDF已下载');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(language === 'ja' ? 'PDFの生成に失敗しました' : 'PDF生成失败');
    }
  };

  // AI分析ミューテーション
  const aiExtractMutation = trpc.brandProduct.extractFromImage.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data && selectedProductForAi) {
        // 既存の備考を保持しつつ、AI分析結果を追記
        const existingRemarks = selectedProductForAi.remarks || "";
        const aiInfo = formatAiResult(result.data);
        const newRemarks = existingRemarks 
          ? `${existingRemarks}\n\n--- AI分析結果 (${new Date().toLocaleDateString('ja-JP')}) ---\n${aiInfo}`
          : `--- AI分析結果 (${new Date().toLocaleDateString('ja-JP')}) ---\n${aiInfo}`;
        
        // 商品の備考を更新
        updateProductMutation.mutate({
          id: selectedProductForAi.id,
          remarks: newRemarks,
        });
        
        toast.success("AI分析が完了しました");
      }
      setIsAnalyzing(false);
      setAiAnalysisDialogOpen(false);
      setSelectedProductForAi(null);
      setSelectedImageForAi(null);
    },
    onError: (error) => {
      toast.error(`AI分析に失敗しました: ${error.message}`);
      setIsAnalyzing(false);
    },
  });

  // AI分析結果をフォーマット
  const formatAiResult = (data: any) => {
    const lines: string[] = [];
    if (data.catchCopy) lines.push(`【キャッチコピー】${data.catchCopy}`);
    if (data.productDetails) lines.push(`【商品詳細】${data.productDetails}`);
    if (data.listPrice) lines.push(`【定価】¥${data.listPrice.toLocaleString()}`);
    if (data.specialPrice) lines.push(`【特価】¥${data.specialPrice.toLocaleString()}`);
    if (data.discountRate) lines.push(`【割引率】${data.discountRate}`);
    if (data.shippingInfo) lines.push(`【配送情報】${data.shippingInfo}`);
    if (data.stock) lines.push(`【在庫】${data.stock}`);
    if (data.releaseDate) lines.push(`【発売日】${data.releaseDate}`);
    if (data.productCode) lines.push(`【品番】${data.productCode}`);
    if (data.remarks) lines.push(`【その他】${data.remarks}`);
    return lines.join('\n');
  };

  // AI分析を実行
  const handleAiAnalysis = () => {
    if (!selectedImageForAi) {
      toast.error("画像を選択してください");
      return;
    }
    setIsAnalyzing(true);
    aiExtractMutation.mutate({ imageUrl: selectedImageForAi });
  };

  // Calculate GMV totals from livestreams data
  const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.gmv || ls.salesAmount || 0), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthData = monthlyGmvSummary.find(m => m.month === currentMonth);
  const monthlyGmvValue = currentMonthData?.gmv || 0;

  // Get primary LCJ staff
  const primaryManager = lcjStaff.length > 0 ? lcjStaff[0].staffName : "-";

  // Get active contract commission rate
  const activeContract = contracts.find(c => c.status === "契約中");
  
  // 商品の成果報酬を集計（範囲表記）
  const calculateCommissionRateRange = () => {
    const validProducts = products.filter(p => {
      if (!p.commissionRate) return false;
      const numericValue = parseFloat(p.commissionRate.replace(/[^0-9.]/g, ''));
      return !isNaN(numericValue) && numericValue > 0;
    });
    
    if (validProducts.length === 0) return null;
    
    const rates = validProducts.map(p => {
      return parseFloat(p.commissionRate!.replace(/[^0-9.]/g, ''));
    });
    
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    
    return { min: minRate, max: maxRate };
  };
  
  const commissionRateRange = calculateCommissionRateRange();
  const commissionRateValue = commissionRateRange !== null 
    ? (commissionRateRange.min === commissionRateRange.max 
        ? `${Math.round(commissionRateRange.min)}%` 
        : `${Math.round(commissionRateRange.min)}-${Math.round(commissionRateRange.max)}%`)
    : (activeContract?.commissionRate || brand?.commissionRate || "-");

  const handleAddMemo = () => {
    if (!newMemo.trim()) return;
    createMemoMutation.mutate({
      brandId,
      content: newMemo.trim(),
      authorName: "User",
    });
  };

  // 契約編集ハンドラ（紐付けられたライブを取得）
  const trpcUtils = trpc.useUtils();
  const handleEditContract = async (contract: any) => {
    try {
      // 紐付けられたライブを取得
      const linkedLivestreams = await trpcUtils.brandContract.getLinkedLivestreams.fetch({ contractId: contract.id });
      setEditingContract({ 
        ...contract, 
        linkedLivestreams: linkedLivestreams || [] 
      });
      setEditContractDialogOpen(true);
    } catch (error) {
      console.error('紐付けライブ取得エラー:', error);
      setEditingContract({ ...contract, linkedLivestreams: [] });
      setEditContractDialogOpen(true);
    }
  };

  if (brandLoading || !brand) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-red-500 animate-pulse text-2xl font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #0a0008 0%, #1a0010 25%, #0d0005 50%, #150012 75%, #0a0008 100%)' }}>
      {/* CYBERPUNK RED MATRIX BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main binary code background image */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: 'url(/digital-bg.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(1.5) contrast(1.2)',
          }}
        />
        {/* Animated gradient overlay */}
        <div 
          className="absolute inset-0 animate-pulse"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, rgba(255, 0, 50, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, rgba(200, 0, 80, 0.25) 0%, transparent 45%),
              radial-gradient(ellipse at 100% 100%, rgba(255, 30, 30, 0.2) 0%, transparent 50%),
              radial-gradient(ellipse at 0% 100%, rgba(180, 0, 60, 0.25) 0%, transparent 45%)
            `,
            animationDuration: '4s',
          }}
        />
        {/* Neon red glow spots */}
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(circle at 15% 20%, rgba(255, 0, 0, 0.4) 0%, transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(255, 50, 50, 0.3) 0%, transparent 20%),
            radial-gradient(circle at 50% 80%, rgba(200, 0, 50, 0.35) 0%, transparent 30%),
            radial-gradient(circle at 70% 60%, rgba(255, 0, 80, 0.2) 0%, transparent 25%)
          `,
        }} />
        {/* Grid overlay for cyber effect */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            linear-gradient(rgba(255, 0, 0, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 0, 0, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
        {/* Scanline effect */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 0, 0, 0.3) 2px, rgba(255, 0, 0, 0.3) 4px)',
        }} />
        {/* Vignette effect */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
        }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-black/90 via-red-950/20 to-black/90 backdrop-blur-xl rounded-xl border border-red-500/50 p-4 md:p-6 shadow-[0_0_50px_rgba(255,0,0,0.3),inset_0_1px_0_rgba(255,100,100,0.1)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/brands")}
                className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm hidden sm:inline">{t.back}</span>
              </button>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.5)] animate-pulse">
                <span className="text-xl">🏢</span>
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,0,0,0.3)]">
                    {t.title}
                  </h1>
                  <Select
                    value={brandId.toString()}
                    onValueChange={(value) => navigate(`/brands/${value}`)}
                  >
                    <SelectTrigger className="w-[180px] bg-black/60 border-red-900/50 text-white hover:border-red-500/50 transition-colors">
                      <SelectValue placeholder="ブランドを選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50 backdrop-blur-xl">
                      {allBrands.map((b) => (
                        <SelectItem 
                          key={b.id} 
                          value={b.id.toString()}
                          className="text-white hover:bg-red-900/30 focus:bg-red-900/30"
                        >
                          {b.name}{b.nameJa && <span className="text-red-400 ml-1">({b.nameJa})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-gray-500 text-sm mt-0.5">
                  {brand.nameJa && <span className="text-red-400 mr-2">({brand.nameJa})</span>}
                  {brand.companyName || brand.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`px-3 py-1 text-sm font-medium rounded-lg ${
                brand.status === '契約済み' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : brand.status === '打ち合わせ中' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {statusTranslations[language][brand.status] || brand.status}
              </Badge>
              <Button
                variant="outline"
                onClick={() => setIsDetailsDialogOpen(true)}
                className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
              >
                {t.details}
              </Button>
              <Button
                onClick={() => navigate(`/brands/${id}/edit`)}
                className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-500/30"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t.edit}
              </Button>
              {/* Language Toggle */}
              <Button
                variant="outline"
                onClick={() => setLanguage(language === 'ja' ? 'zh' : 'ja')}
                className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
              >
                <Globe className="h-4 w-4 mr-2" />
                {language === 'ja' ? '中文' : '日本語'}
              </Button>
            </div>
          </div>
        </div>

        {/* Main KPI Card */}
        <div className="grid grid-cols-1 gap-4">
          {/* Total GMV - Large card with fire icon */}
          <div className="relative overflow-hidden rounded-xl p-6 group transition-all duration-500 hover:scale-[1.02]" style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(50,0,0,0.8) 50%, rgba(0,0,0,0.9) 100%)',
            border: '2px solid rgba(255, 50, 50, 0.6)',
            boxShadow: '0 0 60px rgba(255, 0, 0, 0.4), inset 0 0 60px rgba(255, 0, 0, 0.1)',
          }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-600/20 rounded-full blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-red-500/5" />
            <div className="relative text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-4xl animate-bounce">🔥</span>
                <span className="text-red-300 text-lg font-bold uppercase tracking-widest">{t.totalGmv}（全期間）</span>
              </div>
              <p 
                className="text-6xl md:text-8xl font-black tracking-tight"
                style={{ 
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#ff2222',
                  textShadow: '0 0 20px rgba(255, 0, 0, 1), 0 0 40px rgba(255, 0, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.6), 0 0 80px rgba(255, 0, 0, 0.4)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                {formatCurrency(totalGmv)}
              </p>
            </div>
          </div>
          
          {/* 品牌投入（ブランド投入）- 契約がある場合のみ表示 */}
          {contracts.length > 0 && (
            <div className="relative overflow-hidden rounded-xl p-6 mt-4 group transition-all duration-500 hover:scale-[1.01]" style={{
              background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(50,30,0,0.8) 50%, rgba(0,0,0,0.9) 100%)',
              border: '2px solid rgba(255, 180, 50, 0.6)',
              boxShadow: '0 0 40px rgba(255, 180, 0, 0.3), inset 0 0 40px rgba(255, 180, 0, 0.1)',
            }}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-600/15 rounded-full blur-2xl" />
              <div className="relative text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-3xl">💰</span>
                  <span className="text-amber-300 text-base font-bold uppercase tracking-widest">
                    {language === 'zh' ? '品牌投入' : 'ブランド投入'}
                  </span>
                  <button
                    className="text-gray-400 hover:text-amber-400 transition-colors"
                    title={language === 'zh' ? '查看合同明细' : '契約内訳を表示'}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
                <p 
                  className="text-5xl md:text-6xl font-black tracking-tight"
                  style={{ 
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#ffbb00',
                    textShadow: '0 0 15px rgba(255, 180, 0, 0.8), 0 0 30px rgba(255, 180, 0, 0.6), 0 0 45px rgba(255, 180, 0, 0.4)',
                  }}
                >
                  {formatCurrency(contracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0))}
                </p>
                {/* 契約タイプ別内訳 */}
                <div className="mt-4 pt-4 border-t border-amber-500/20">
                  <div className="flex flex-wrap justify-center gap-4 text-sm">
                    {Object.entries(
                      contracts.reduce((acc, c) => {
                        const type = c.serviceType || 'その他';
                        acc[type] = (acc[type] || 0) + (c.fixedFee || 0);
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([type, amount]) => (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-gray-400">{type}:</span>
                        <span className="text-amber-400 font-mono font-bold">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sub KPI Cards - Neon Style */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(0,30,50,0.9) 0%, rgba(0,50,80,0.7) 100%)',
            border: '1px solid rgba(0, 255, 255, 0.5)',
            boxShadow: '0 0 25px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-cyan-300" />
              <span className="text-xs text-cyan-200 uppercase tracking-wider font-bold">{t.products}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00ffff', textShadow: '0 0 10px rgba(0, 255, 255, 0.8)' }}>
              {products.length}<span className="text-sm text-cyan-300 ml-1">{t.items}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(50,0,50,0.9) 0%, rgba(80,0,80,0.7) 100%)',
            border: '1px solid rgba(255, 100, 200, 0.5)',
            boxShadow: '0 0 25px rgba(255, 100, 200, 0.3), inset 0 0 20px rgba(255, 100, 200, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-5 w-5 text-pink-300" />
              <span className="text-xs text-pink-200 uppercase tracking-wider font-bold">{t.livestreams}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ff66cc', textShadow: '0 0 10px rgba(255, 100, 200, 0.8)' }}>
              {livestreams.length}<span className="text-sm text-pink-300 ml-1">{t.times}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(50,40,0,0.9) 0%, rgba(80,60,0,0.7) 100%)',
            border: '1px solid rgba(255, 200, 50, 0.5)',
            boxShadow: '0 0 25px rgba(255, 200, 50, 0.3), inset 0 0 20px rgba(255, 200, 50, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-amber-300" />
              <span className="text-xs text-amber-200 uppercase tracking-wider font-bold">{t.contracts}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ffcc33', textShadow: '0 0 10px rgba(255, 200, 50, 0.8)' }}>
              {contracts.length}<span className="text-sm text-amber-300 ml-1">{t.cases}</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
            background: 'linear-gradient(135deg, rgba(40,0,60,0.9) 0%, rgba(60,0,90,0.7) 100%)',
            border: '1px solid rgba(180, 100, 255, 0.5)',
            boxShadow: '0 0 25px rgba(180, 100, 255, 0.3), inset 0 0 20px rgba(180, 100, 255, 0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-5 w-5 text-purple-300" />
              <span className="text-xs text-purple-200 uppercase tracking-wider font-bold">{t.commissionRate}</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#bb66ff', textShadow: '0 0 10px rgba(180, 100, 255, 0.8)' }}>
              {commissionRateValue}
            </p>
          </div>
          <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 hover:border-red-500/50 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t.manager}</span>
            </div>
            <p className="text-lg font-bold text-green-400 truncate">
              {primaryManager}
            </p>
          </div>
        </div>

        {/* Contract Section - 大きく目立つデザイン */}
        <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 backdrop-blur-xl rounded-2xl border-2 border-amber-500/40 p-4 md:p-5 shadow-[0_0_50px_rgba(255,180,0,0.2)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
              <div className="w-1.5 h-8 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
              <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                {t.contractInfo}
              </span>
              <Badge className="ml-1 bg-amber-500/30 text-amber-300 border border-amber-400/50 text-base px-2 py-0.5">
                {contracts.length}
              </Badge>
            </h2>
            <Button
              onClick={() => setAddContractDialogOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold shadow-lg shadow-amber-500/30"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              {language === 'zh' ? '添加合同' : '契約追加'}
            </Button>
          </div>
          {contracts.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-lg">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((contract) => (
                <div key={contract.id} className="bg-black/60 rounded-xl border border-amber-500/30 p-3 group hover:border-amber-400/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500/30 text-amber-300 border border-amber-400/50 text-sm px-2 py-0.5">
                        {serviceTypeTranslations[language][contract.serviceType] || contract.serviceType}
                      </Badge>
                      <Badge className={`text-sm px-2 py-0.5 ${
                        contract.status === '契約中' 
                          ? 'bg-green-500/30 text-green-300 border border-green-400/50'
                          : 'bg-gray-500/30 text-gray-300 border border-gray-400/50'
                      }`}>
                        {statusTranslations[language][contract.status] || contract.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditContract(contract)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-amber-400 transition-all"
                        title={language === 'ja' ? '編集' : '编辑'}
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => { setContractToDelete(contract); setDeleteContractDialogOpen(true); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all"
                        title={language === 'ja' ? '削除' : '删除'}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  {/* 固定費を大きく表示 */}
                  <div className="mb-1">
                    <p className="text-gray-400 text-[10px] uppercase tracking-wider">{t.fixedFee}</p>
                    <p className="text-3xl font-black text-amber-300" style={{ fontFamily: 'JetBrains Mono, monospace', textShadow: '0 0 30px rgba(255, 180, 0, 0.6)' }}>
                      {formatCurrency(contract.fixedFee)}
                    </p>
                  </div>
                  {/* 日付を小さく表示 */}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>{t.startDate}:</span>
                      <span className="text-white font-mono">{formatDate(contract.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{t.endDate}:</span>
                      <span className="text-white font-mono">{formatDate(contract.endDate)}</span>
                    </div>
                    {contract.commissionRate && (
                      <div className="flex items-center gap-2">
                        <span>{t.commissionRate}:</span>
                        <span className="text-purple-400 font-mono">{contract.commissionRate.replace(/[^0-9.]/g, '')}%</span>
                      </div>
                    )}
                  </div>
                  {/* ROAS表示コンポーネント */}
                  <ContractRoasDisplay 
                    contractId={contract.id} 
                    fixedFee={contract.fixedFee || 0}
                    onLinkClick={() => handleEditContract(contract)}
                    onViewDetails={(livestreams) => {
                      setLinkedLivestreamDetailData(livestreams);
                      setLinkedLivestreamContractInfo(contract);
                      setLinkedLivestreamDetailDialogOpen(true);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Livestream Performance Table - 全幅表示 */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-pink-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,100,0.15)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-1.5 h-8 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
              {t.livestreamPerformance}
            </h2>
              <Button
                size="sm"
                onClick={() => setAddLivestreamDialogOpen(true)}
                className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t.add}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-900/30">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.date}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? '開始時間' : '开始时间'}</th>
                    <th className="text-center text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-16">{language === 'ja' ? '画像' : '图片'}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2 max-w-[120px]">{language === 'ja' ? '商品' : '商品'}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? '手数料' : '手续费'}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.account}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.platform}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.productClicks}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.impressions}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.salesCount}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.gmv}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.cartAddCount}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.duration}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {livestreams.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center text-gray-500 py-8">{t.noData}</td>
                    </tr>
                  ) : (
                    livestreams.slice(0, 10).map((ls) => (
                      <tr key={ls.id} className="border-b border-red-900/20 hover:bg-red-900/10 transition-colors group">
                        <td className="py-3 px-2 text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatDate(ls.livestreamDate)}
                        </td>
                        <td className="py-3 px-2 text-yellow-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {(ls as any).livestreamStartTime || '-'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {(() => {
                            const product = (ls as any).productId ? products.find(p => p.id === (ls as any).productId) : null;
                            const imageUrl = product?.imageUrls ? (Array.isArray(product.imageUrls) ? product.imageUrls[0] : (typeof product.imageUrls === 'string' ? JSON.parse(product.imageUrls)[0] : null)) : null;
                            if (imageUrl) {
                              return (
                                <img 
                                  src={imageUrl} 
                                  alt={product?.productName || ''}
                                  className="w-10 h-10 object-cover rounded-md border border-red-900/30 mx-auto cursor-pointer hover:border-pink-400 hover:scale-110 transition-all"
                                  onClick={() => {
                                    if (product) {
                                      setSelectedProductForDetail(product);
                                      setProductDetailDialogOpen(true);
                                    }
                                  }}
                                />
                              );
                            }
                            return (
                              <div 
                                className="w-10 h-10 bg-gray-800 rounded-md border border-red-900/30 flex items-center justify-center mx-auto cursor-pointer hover:border-pink-400 hover:bg-gray-700 transition-all"
                                onClick={() => {
                                  if (product) {
                                    setSelectedProductForDetail(product);
                                    setProductDetailDialogOpen(true);
                                  }
                                }}
                              >
                                <Package className="w-4 h-4 text-gray-600" />
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-2 text-cyan-400 font-medium max-w-[120px]">
                          <span 
                            className="block truncate cursor-help" 
                            title={(ls as any).productId ? products.find(p => p.id === (ls as any).productId)?.productName || '-' : '-'}
                          >
                            {(ls as any).productId ? products.find(p => p.id === (ls as any).productId)?.productName || '-' : '-'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-purple-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {(ls as any).productCommission || '-'}
                        </td>
                        <td className="py-3 px-2 text-white font-medium">{ls.streamerName}</td>
                        <td className="py-3 px-2 text-gray-400">{ls.platform || "-"}</td>
                        <td className="py-3 px-2 text-right text-blue-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {ls.productClicks?.toLocaleString() || "-"}
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {ls.impressions?.toLocaleString() || "-"}
                        </td>
                        <td className="py-3 px-2 text-right text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {ls.salesCount?.toLocaleString() || "-"}
                        </td>
                        <td className="py-3 px-2 text-right text-pink-400 font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatCurrency(ls.gmv || ls.salesAmount)}
                        </td>
                        <td className="py-3 px-2 text-right text-orange-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {ls.cartAddCount?.toLocaleString() || "-"}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {ls.duration ? `${ls.duration}分` : "-"}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setEditingLivestream(ls); setEditLivestreamDialogOpen(true); }}
                              className="text-pink-400/70 hover:text-pink-400 transition-all"
                              title={language === 'ja' ? '編集' : '编辑'}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setLivestreamToDelete(ls); setDeleteLivestreamDialogOpen(true); }}
                              className="text-red-400/70 hover:text-red-400 transition-all"
                              title={language === 'ja' ? '削除' : '删除'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>

        {/* Content Grid - 商品テーブル */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          {/* Product Performance Table */}
          <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
                {t.productPerformance}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setAiImageAddDialogOpen(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {t.aiImageAdd}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddProductDialogOpen(true)}
                  className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t.add}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-900/30">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-16"></th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2 max-w-[150px]">{t.productName}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.listPrice}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.specialPrice}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.gmv}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.commissionRate}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-500 py-8">{t.noData}</td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-b border-red-900/20 hover:bg-red-900/10 transition-colors group">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            {/* 登録日表示 */}
                            <div className="flex flex-col items-center min-w-[50px]">
                              <span className="text-[9px] text-gray-400">{language === 'ja' ? '登録日' : '登记日'}</span>
                              <span className="text-[11px] text-white font-mono">
                                {product.createdAt ? new Date(product.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit' }).replace('/', '/') : '-'}
                              </span>
                            </div>
                            {/* 商品画像 */}
                            {product.imageUrls && product.imageUrls.length > 0 ? (
                              <img 
                                src={product.imageUrls[0]} 
                                alt={product.productName} 
                                className="w-12 h-12 object-cover rounded-lg border border-red-900/30 cursor-pointer hover:border-pink-400 hover:scale-110 transition-all" 
                                onClick={() => {
                                  setSelectedProductForDetail(product);
                                  setProductDetailDialogOpen(true);
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-red-900/20 rounded-lg border border-red-900/30 flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 max-w-[150px]">
                          <span 
                            className="text-white font-medium block truncate cursor-help" 
                            title={product.productName}
                          >
                            {product.productName}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-gray-400 text-lg" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatCurrency(product.listPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-red-400 text-lg font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatCurrency(product.specialPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyan-400 text-lg font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {(product as any).totalGmv ? formatCurrency((product as any).totalGmv) : '-'}
                        </td>
                        <td className="py-3 px-2 text-right text-purple-400 text-lg" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {product.commissionRate ? `${product.commissionRate.replace(/[^0-9.]/g, '')}%` : "-"}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* AI学習ボタン - 全商品に表示 */}
                            <button
                              onClick={() => { 
                                setSelectedProductForAi(product); 
                                setSelectedImageForAi(null);
                                setAiAnalysisDialogOpen(true); 
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-400 transition-all"
                              title={language === 'ja' ? 'AI学習' : 'AI学习'}
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setEditingProduct(product); setEditProductDialogOpen(true); }}
                              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan-400 transition-all"
                              title={language === 'ja' ? '編集' : '编辑'}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setProductToDelete(product); setDeleteProductDialogOpen(true); }}
                              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                              title={language === 'ja' ? '削除' : '删除'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Activity Memos - Timeline */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
            {t.activityMemos}
          </h2>

          {/* Add memo input */}
          <div className="flex gap-3 mb-6">
            <Input
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              placeholder={t.memoPlaceholder}
              className="flex-1 bg-black/50 border-red-900/30 text-white placeholder:text-gray-600 focus:border-red-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddMemo();
                }
              }}
            />
            <Button
              onClick={handleAddMemo}
              disabled={!newMemo.trim() || createMemoMutation.isPending}
              className="bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white shadow-lg shadow-green-500/30"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Memos timeline */}
          <div className="space-y-4">
            {memos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t.noMemos}</p>
            ) : (
              memos.map((memo, index) => (
                <div key={memo.id} className="relative pl-6 pb-4">
                  {/* Timeline line */}
                  {index < memos.length - 1 && (
                    <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-red-900/30" />
                  )}
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-red-900/50 border-2 border-red-500/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                  </div>
                  {/* Content */}
                  <div className="bg-black/50 rounded-lg border border-red-900/20 p-4 hover:border-red-500/30 transition-colors group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white whitespace-pre-wrap">{memo.content}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {memo.authorName}
                          </span>
                          <span>
                            {new Date(memo.createdAt).toLocaleString("ja-JP")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingMemo(memo); setEditMemoDialogOpen(true); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-green-400 transition-all"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMemoMutation.mutate({ id: memo.id })}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Brand Files Section */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
            <FolderOpen className="h-5 w-5 text-cyan-400" />
            {t.brandFiles}
          </h2>
          <BrandFilesSection brandId={brand.id} t={t} />
        </div>

        {/* Edit Log Section */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
            <History className="h-5 w-5 text-purple-400" />
            {t.editLog}
          </h2>

          {/* Edit logs timeline */}
          <EditLogSection brandId={brand.id} language={language} noEditLogsText={t.noEditLogs} />
        </div>
      </div>

      {/* Product Edit Dialog */}
      <Dialog open={editProductDialogOpen} onOpenChange={setEditProductDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
              商品編集
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 py-4">
              {/* 商品画像表示 */}
              {editingProduct.imageUrls && editingProduct.imageUrls.length > 0 && (
                <div className="border border-cyan-900/30 rounded-lg p-3 bg-cyan-950/20">
                  <Label className="text-cyan-400 text-sm font-medium mb-2 block">商品画像</Label>
                  <div className="flex gap-2 flex-wrap">
                    {editingProduct.imageUrls.map((url: string, idx: number) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`商品画像 ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-lg border border-cyan-900/50 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '登録日' : '登记日期'}</Label>
                  <Input
                    type="date"
                    value={editingProduct.createdAt ? new Date(editingProduct.createdAt).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, createdAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '商品名' : '商品名'}</Label>
                  <Input
                    value={editingProduct.productName || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, productName: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">定価</Label>
                  <Input
                    type="number"
                    value={editingProduct.listPrice || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, listPrice: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">特価</Label>
                  <Input
                    type="number"
                    value={editingProduct.specialPrice || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, specialPrice: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              {/* 発売日・商品コード */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '発売日' : '发售日'}</Label>
                  <Input
                    value={editingProduct.releaseDate || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, releaseDate: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '商品コード' : '商品编码'}</Label>
                  <Input
                    value={editingProduct.productCode || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, productCode: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              {/* 成果報酬 */}
              <div>
                <Label className="text-gray-400">成果報酬</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={(editingProduct.commissionRate || "").replace(/[^0-9.]/g, '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                        setEditingProduct({ ...editingProduct, commissionRate: value });
                      }
                    }}
                    placeholder="例: 15"
                    className="bg-black/60 border-red-900/50 text-white mt-1 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 mt-0.5">%</span>
                </div>
              </div>
              {/* キャッチコピー・広告語 */}
              <div>
                <Label className="text-gray-400">{language === 'ja' ? 'キャッチコピー・広告語' : '广告语'}</Label>
                <Textarea
                  value={editingProduct.catchCopy || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, catchCopy: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                  rows={2}
                />
              </div>
              {/* 商品の特徴・セールスポイント */}
              <div>
                <Label className="text-gray-400">{language === 'ja' ? '商品の特徴・セールスポイント' : '商品特点/卖点'}</Label>
                <Textarea
                  value={editingProduct.features || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, features: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                  rows={3}
                />
              </div>
              {/* 商品詳細（内容量・容量等） */}
              <div>
                <Label className="text-gray-400">{language === 'ja' ? '商品詳細（内容量・容量等）' : '商品详情（内容量/容量等）'}</Label>
                <Textarea
                  value={editingProduct.productDetails || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, productDetails: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                  rows={2}
                />
              </div>
              {/* 付属品・セット内容 */}
              <div>
                <Label className="text-gray-400">{language === 'ja' ? '付属品・セット内容' : '附件/套装内容'}</Label>
                <Textarea
                  value={editingProduct.accessories || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, accessories: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                  rows={2}
                />
              </div>
              {/* 配送情報 */}
              <div>
                <Label className="text-gray-400">{language === 'ja' ? '配送情報' : '配送信息'}</Label>
                <Textarea
                  value={editingProduct.shippingInfo || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, shippingInfo: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                  rows={2}
                />
              </div>
              {/* ターゲット層・使用方法 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? 'ターゲット層' : '目标人群'}</Label>
                  <Input
                    value={editingProduct.targetAudience || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, targetAudience: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '使用方法' : '使用方法'}</Label>
                  <Input
                    value={editingProduct.usageMethod || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, usageMethod: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              {/* 備考 */}
              <div>
                <Label className="text-gray-400">備考</Label>
                <Textarea
                  value={editingProduct.remarks || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, remarks: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1 min-h-[100px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditProductDialogOpen(false); setEditingProduct(null); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingProduct) {
                  // createdAtを文字列に変換（Dateオブジェクトの場合はISO文字列に）
                  let createdAtValue: string | undefined = undefined;
                  if (editingProduct.createdAt) {
                    if (typeof editingProduct.createdAt === 'string') {
                      createdAtValue = editingProduct.createdAt;
                    } else if (editingProduct.createdAt instanceof Date) {
                      createdAtValue = editingProduct.createdAt.toISOString();
                    } else {
                      createdAtValue = new Date(editingProduct.createdAt).toISOString();
                    }
                  }
                  console.log("Updating product with data:", {
                    id: editingProduct.id,
                    commissionRate: editingProduct.commissionRate,
                    createdAt: createdAtValue,
                  });
                  updateProductMutation.mutate({
                    id: editingProduct.id,
                    productName: editingProduct.productName || undefined,
                    listPrice: editingProduct.listPrice || undefined,
                    specialPrice: editingProduct.specialPrice || undefined,
                    discountRate: editingProduct.commissionRate || undefined,
                    remarks: editingProduct.remarks || undefined,
                    commissionRate: editingProduct.commissionRate || undefined,
                    productCode: editingProduct.productCode || undefined,
                    releaseDate: editingProduct.releaseDate || undefined,
                    catchCopy: editingProduct.catchCopy || undefined,
                    features: editingProduct.features || undefined,
                    productDetails: editingProduct.productDetails || undefined,
                    accessories: editingProduct.accessories || undefined,
                    shippingInfo: editingProduct.shippingInfo || undefined,
                    targetAudience: editingProduct.targetAudience || undefined,
                    usageMethod: editingProduct.usageMethod || undefined,
                    createdAt: createdAtValue,
                  });
                }
              }}
              className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Livestream Edit Dialog */}
      <Dialog open={editLivestreamDialogOpen} onOpenChange={setEditLivestreamDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
              直播編集
            </DialogTitle>
          </DialogHeader>
          {editingLivestream && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">日付</Label>
                  <Input
                    type="date"
                    value={editingLivestream.livestreamDate ? (typeof editingLivestream.livestreamDate === 'string' && editingLivestream.livestreamDate.includes('-') ? editingLivestream.livestreamDate.split('T')[0] : (editingLivestream.livestreamDate instanceof Date ? editingLivestream.livestreamDate.toISOString().split('T')[0] : new Date(editingLivestream.livestreamDate).toISOString().split('T')[0])) : ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, livestreamDate: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">開始時間</Label>
                  <Input
                    type="time"
                    value={editingLivestream.livestreamStartTime || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, livestreamStartTime: e.target.value })}
                    placeholder="14:30"
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">アカウント</Label>
                  <Input
                    value={editingLivestream.streamerName || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, streamerName: e.target.value })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">プラットフォーム</Label>
                  <Select
                    value={editingLivestream.platform || ""}
                    onValueChange={(value) => setEditingLivestream({ ...editingLivestream, platform: value })}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50">
                      <SelectItem value="TikTok">TikTok</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="YouTube">YouTube</SelectItem>
                      <SelectItem value="その他">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">時間（分）</Label>
                  <Input
                    type="number"
                    value={editingLivestream.duration || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, duration: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '商品クリック' : '商品点击'}</Label>
                  <Input
                    type="number"
                    value={(editingLivestream as any).productClicks || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, productClicks: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? 'インプレッション' : '商品曝光'}</Label>
                  <Input
                    type="number"
                    value={(editingLivestream as any).impressions || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, impressions: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '販売件数' : '销售件数'}</Label>
                  <Input
                    type="number"
                    value={(editingLivestream as any).salesCount || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, salesCount: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">GMV</Label>
                  <Input
                    type="number"
                    value={editingLivestream.gmv || editingLivestream.salesAmount || ""}
                    onChange={(e) => setEditingLivestream({ ...editingLivestream, gmv: parseInt(e.target.value) || 0 })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">{language === 'ja' ? 'カート追加数' : '加购数'}</Label>
                <Input
                  type="number"
                  value={(editingLivestream as any).cartAddCount || ""}
                  onChange={(e) => setEditingLivestream({ ...editingLivestream, cartAddCount: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              {/* 商品選択と手数料 */}
              <div className="border-t border-red-900/30 pt-4 mt-4">
                <p className="text-sm text-pink-400 mb-3 font-medium">{language === 'ja' ? '商品紐付け' : '商品关联'}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">{language === 'ja' ? '商品' : '商品'}</Label>
                    <Select
                      value={editingLivestream.productId?.toString() || ""}
                      onValueChange={(value) => {
                        const selectedProduct = products.find(p => p.id.toString() === value);
                        setEditingLivestream({ 
                          ...editingLivestream, 
                          productId: value ? parseInt(value) : null,
                          productCommission: selectedProduct?.commissionRate || ""
                        });
                      }}
                    >
                      <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                        <SelectValue placeholder={language === 'ja' ? '商品を選択' : '选择商品'} />
                      </SelectTrigger>
                      <SelectContent className="bg-black/95 border-red-900/50 text-white">
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()} className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">
                            {product.productName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">{language === 'ja' ? '成果報酬' : '成果报酬'}</Label>
                    <div className="bg-black/60 border border-red-900/50 rounded-md px-3 py-2 mt-1 text-cyan-400 font-medium">
                      {(() => {
                        const selectedProduct = editingLivestream.productId ? products.find(p => p.id === editingLivestream.productId) : null;
                        const rate = selectedProduct?.commissionRate;
                        return rate ? `${rate.replace(/[^0-9.]/g, '')}%` : '-';
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-gray-400">備考</Label>
                <Textarea
                  value={editingLivestream.remarks || ""}
                  onChange={(e) => setEditingLivestream({ ...editingLivestream, remarks: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditLivestreamDialogOpen(false); setEditingLivestream(null); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingLivestream) {
                  // 日付をstring形式に変換（YYYY-MM-DD）
                  let dateStr = editingLivestream.livestreamDate;
                  if (dateStr) {
                    if (typeof dateStr !== 'string') {
                      dateStr = new Date(dateStr).toISOString().split('T')[0];
                    } else if (dateStr.includes('T')) {
                      dateStr = dateStr.split('T')[0];
                    }
                  }
                  // undefinedやnullの値をフィルタリング
                  const updateData: Record<string, any> = {
                    id: editingLivestream.id,
                  };
                  if (dateStr) updateData.livestreamDate = dateStr;
                  if (editingLivestream.streamerName) updateData.streamerName = editingLivestream.streamerName;
                  if (editingLivestream.platform) updateData.platform = editingLivestream.platform;
                  if (editingLivestream.duration !== undefined && editingLivestream.duration !== null) updateData.duration = editingLivestream.duration;
                  if (editingLivestream.gmv !== undefined && editingLivestream.gmv !== null) updateData.gmv = editingLivestream.gmv;
                  if (editingLivestream.remarks) updateData.remarks = editingLivestream.remarks;
                  if ((editingLivestream as any).productClicks !== undefined && (editingLivestream as any).productClicks !== null) updateData.productClicks = (editingLivestream as any).productClicks;
                  if ((editingLivestream as any).impressions !== undefined && (editingLivestream as any).impressions !== null) updateData.impressions = (editingLivestream as any).impressions;
                  if ((editingLivestream as any).salesCount !== undefined && (editingLivestream as any).salesCount !== null) updateData.salesCount = (editingLivestream as any).salesCount;
                  if ((editingLivestream as any).cartAddCount !== undefined && (editingLivestream as any).cartAddCount !== null) updateData.cartAddCount = (editingLivestream as any).cartAddCount;
                  if (editingLivestream.productId !== undefined) updateData.productId = editingLivestream.productId;
                  if (editingLivestream.productCommission) updateData.productCommission = editingLivestream.productCommission;
                  if (editingLivestream.adCost !== undefined && editingLivestream.adCost !== null) updateData.adCost = editingLivestream.adCost;
                  if (editingLivestream.ctr) updateData.ctr = editingLivestream.ctr;
                  if (editingLivestream.cvr) updateData.cvr = editingLivestream.cvr;
                  if (editingLivestream.cpc !== undefined && editingLivestream.cpc !== null) updateData.cpc = editingLivestream.cpc;
                  if (editingLivestream.acos) updateData.acos = editingLivestream.acos;
                  if (editingLivestream.roas) updateData.roas = editingLivestream.roas;
                  if (editingLivestream.livestreamStartTime) updateData.livestreamStartTime = editingLivestream.livestreamStartTime;
                  
                  updateLivestreamMutation.mutate(updateData as any);
                }
              }}
              className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Edit Dialog */}
      <Dialog open={editContractDialogOpen} onOpenChange={setEditContractDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-3xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
              契約編集
            </DialogTitle>
          </DialogHeader>
          {editingContract && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '契約タイプ' : '合同类型'}</Label>
                  <Select
                    value={editingContract.serviceType || ""}
                    onValueChange={(value) => setEditingContract({ ...editingContract, serviceType: value })}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-red-900/50">
                      <SelectItem value="単発ライブ契約" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '单次直播合同' : '単発ライブ契約'}</SelectItem>
                      <SelectItem value="期間契約" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '期限合同（月付/年付）' : '期間契約（月額 or 年額）'}</SelectItem>
                      <SelectItem value="運用代行型（TSP）" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '运营代理型（TSP）' : '運用代行型（TSP）'}</SelectItem>
                      <SelectItem value="パッケージ／複合契約" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '套餐/复合合同' : 'パッケージ／複合契約'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">{t.status}</Label>
                  <Select
                    value={editingContract.status || ""}
                    onValueChange={(value) => setEditingContract({ ...editingContract, status: value })}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-red-900/50">
                      <SelectItem value="契約中" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '合同中' : '契約中'}</SelectItem>
                      <SelectItem value="完了" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '已完成' : '完了'}</SelectItem>
                      <SelectItem value="保留" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '暂停' : '保留'}</SelectItem>
                      <SelectItem value="終了" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '结束' : '終了'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-gray-400">{t.fixedFee}</Label>
                <Input
                  type="number"
                  value={editingContract.fixedFee || ""}
                  onChange={(e) => setEditingContract({ ...editingContract, fixedFee: parseInt(e.target.value) || 0 })}
                  placeholder="例: 1000000"
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{t.startDate}</Label>
                  <Input
                    type="date"
                    value={editingContract.startDate ? new Date(editingContract.startDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => setEditingContract({ ...editingContract, startDate: new Date(e.target.value) })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">{t.endDate}</Label>
                  <Input
                    type="date"
                    value={editingContract.endDate ? new Date(editingContract.endDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => setEditingContract({ ...editingContract, endDate: new Date(e.target.value) })}
                    className="bg-black/60 border-red-900/50 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">{t.memo}</Label>
                <Textarea
                  value={editingContract.memo || ""}
                  onChange={(e) => setEditingContract({ ...editingContract, memo: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>

              {/* ライブ紐付けセクション */}
              <div className="border-t border-amber-500/30 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    関連ライブ配信
                  </p>
                  <Badge className="bg-pink-500/20 text-pink-400 border border-pink-500/30">
                    CPM: ¥15,000
                  </Badge>
                </div>
                
                {/* 紐付けられたライブ一覧 */}
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {editingContract.linkedLivestreams && editingContract.linkedLivestreams.length > 0 ? (
                    editingContract.linkedLivestreams.map((ls: any) => (
                      <div key={ls.id} className="flex items-center justify-between bg-black/40 rounded-lg p-3 border border-amber-500/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{formatDate(ls.livestreamDate)}</span>
                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">{ls.platform}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            <span>{ls.streamerName}</span>
                            <span className="text-cyan-400">GMV: {formatCurrency(ls.gmv)}</span>
                            <span className="text-pink-400">曝光: {(ls.impressions || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newLinked = editingContract.linkedLivestreams.filter((l: any) => l.id !== ls.id);
                            setEditingContract({ ...editingContract, linkedLivestreams: newLinked });
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">紐付けられたライブがありません</p>
                  )}
                </div>

                {/* ライブ追加ドロップダウン */}
                <div className="flex gap-2">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const selectedLs = livestreams.find(ls => ls.id.toString() === value);
                      if (selectedLs && !editingContract.linkedLivestreams?.find((l: any) => l.id === selectedLs.id)) {
                        setEditingContract({
                          ...editingContract,
                          linkedLivestreams: [...(editingContract.linkedLivestreams || []), selectedLs]
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-black/60 border-amber-500/50 text-white flex-1">
                      <SelectValue placeholder="ライブを追加..." />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-amber-500/50 max-h-60">
                      {livestreams
                        .filter(ls => !editingContract.linkedLivestreams?.find((l: any) => l.id === ls.id))
                        .map((ls) => (
                          <SelectItem key={ls.id} value={ls.id.toString()} className="text-white hover:bg-amber-900/30 focus:bg-amber-900/30 focus:text-white">
                            <div className="flex items-center gap-2">
                              <span>{formatDate(ls.livestreamDate)}</span>
                              <span className="text-gray-400">-</span>
                              <span className="text-gray-300">{ls.streamerName}</span>
                              <span className="text-cyan-400 ml-2">{formatCurrency(ls.gmv)}</span>
                            </div>
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                {/* ROAS計算結果（コンパクトフォーマット） */}
                {editingContract.linkedLivestreams && editingContract.linkedLivestreams.length > 0 && editingContract.fixedFee > 0 && (
                  <div className="mt-2 bg-gradient-to-r from-amber-950/50 via-pink-950/30 to-purple-950/50 rounded-lg p-2 border border-amber-500/30">
                    <div className="grid grid-cols-4 gap-1 mb-1 text-center">
                      <div>
                        <p className="text-[10px] text-gray-500">GMV合計</p>
                        <p className="text-sm font-bold text-cyan-400">
                          {formatCurrency(editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.gmv || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">曝光合計</p>
                        <p className="text-sm font-bold text-pink-400">
                          {editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.impressions || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">広告換算</p>
                        <p className="text-sm font-bold text-purple-400">
                          {formatCurrency(editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.impressions || 0), 0) * 15)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">固定費</p>
                        <p className="text-sm font-bold text-amber-400">
                          {formatCurrency(editingContract.fixedFee)}
                        </p>
                      </div>
                    </div>
                    {/* ROAS（右側に大きく、注釈はその下に小さく） */}
                    <div className="flex items-end justify-end pt-1 border-t border-amber-500/20">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">📊 広告効果ROAS</span>
                          <span className="text-xl font-black bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                            {(() => {
                              const totalGmv = editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.gmv || 0), 0);
                              const totalImpressions = editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.impressions || 0), 0);
                              const adValue = totalImpressions * 15;
                              const totalValue = totalGmv + adValue;
                              const fixedFee = editingContract.fixedFee || 0;
                              const roas = fixedFee > 0 ? totalValue / fixedFee : 0;
                              return roas.toFixed(2) + '倍';
                            })()}
                          </span>
                        </div>
                        <div className="text-xs text-emerald-400 font-medium">
                          {(() => {
                            const totalGmv = editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.gmv || 0), 0);
                            const totalImpressions = editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.impressions || 0), 0);
                            const adValue = totalImpressions * 15;
                            const totalValue = totalGmv + adValue;
                            const fixedFee = editingContract.fixedFee || 0;
                            const roas = fixedFee > 0 ? totalValue / fixedFee : 0;
                            const vsIndustry = roas / INDUSTRY_AVG_ROAS;
                            return `→ 業界平均の ${vsIndustry.toFixed(1)}倍（${vsIndustry > 1 ? '显著高于基准' : '基准以下'}）`;
                          })()}
                        </div>
                        <div className="text-[8px] text-gray-600 mt-0.5">
                          {(() => {
                            const totalGmv = editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.gmv || 0), 0);
                            const totalImpressions = editingContract.linkedLivestreams.reduce((sum: number, ls: any) => sum + (ls.impressions || 0), 0);
                            const adValue = totalImpressions * 15;
                            return `※ (GMV${formatCurrency(totalGmv)}+広告換算${formatCurrency(adValue)})÷固定費${formatCurrency(editingContract.fixedFee || 0)}`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditContractDialogOpen(false); setEditingContract(null); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={async () => {
                if (editingContract) {
                  try {
                    // 契約情報を更新
                    // 日付をISO文字列に変換して送信（無効な日付はundefinedに）
                    let startDateStr: string | undefined = undefined;
                    let endDateStr: string | undefined = undefined;
                    
                    if (editingContract.startDate) {
                      try {
                        const startDate = editingContract.startDate instanceof Date 
                          ? editingContract.startDate 
                          : new Date(editingContract.startDate);
                        if (!isNaN(startDate.getTime())) {
                          startDateStr = startDate.toISOString();
                        }
                      } catch (e) {
                        console.warn('開始日の変換に失敗:', e);
                      }
                    }
                    
                    if (editingContract.endDate) {
                      try {
                        const endDate = editingContract.endDate instanceof Date 
                          ? editingContract.endDate 
                          : new Date(editingContract.endDate);
                        if (!isNaN(endDate.getTime())) {
                          endDateStr = endDate.toISOString();
                        }
                      } catch (e) {
                        console.warn('終了日の変換に失敗:', e);
                      }
                    }
                    
                    const contractData = {
                      id: editingContract.id,
                      serviceType: editingContract.serviceType,
                      status: editingContract.status,
                      fixedFee: editingContract.fixedFee ? Number(editingContract.fixedFee) : undefined,
                      commissionRate: editingContract.commissionRate || undefined,
                      startDate: startDateStr,
                      endDate: endDateStr,
                      memo: editingContract.memo || undefined,
                    };
                    console.log("契約更新データ:", JSON.stringify(contractData, null, 2));
                    
                    // 契約更新を実行
                    await updateContractMutation.mutateAsync(contractData);
                    
                    // ライブ紐付けを更新
                    const linkedIds = (editingContract.linkedLivestreams || []).map((ls: any) => ls.id);
                    console.log("ライブ紐付けデータ:", { contractId: editingContract.id, livestreamIds: linkedIds });
                    
                    await bulkLinkLivestreamsMutation.mutateAsync({
                      contractId: editingContract.id,
                      livestreamIds: linkedIds,
                    });
                  } catch (error: any) {
                    console.error('契約保存エラー:', error);
                    console.error('エラー詳細:', JSON.stringify(error, null, 2));
                    // エラーはonErrorで処理されるので、ここでは追加のトーストは不要
                  }
                }
              }}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Memo Edit Dialog */}
      <Dialog open={editMemoDialogOpen} onOpenChange={setEditMemoDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
              メモ編集
            </DialogTitle>
          </DialogHeader>
          {editingMemo && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-400">メモ内容</Label>
                <Textarea
                  value={editingMemo.content || ""}
                  onChange={(e) => setEditingMemo({ ...editingMemo, content: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1 min-h-[120px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditMemoDialogOpen(false); setEditingMemo(null); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingMemo) {
                  updateMemoMutation.mutate({
                    id: editingMemo.id,
                    content: editingMemo.content,
                  });
                }
              }}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white"
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-red-400 to-red-600 rounded-full" />
              {t.basicInfo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.brandName}</p>
                <p className="text-white font-medium">{brand.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.brandNameJa}</p>
                <p className="text-white font-medium text-red-400">{brand.nameJa || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.companyName}</p>
                <p className="text-white font-medium">{brand.companyName || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.category}</p>
                <p className="text-white font-medium">{brand.category || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.status}</p>
                <Badge className={`${
                  brand.status === '契約済み' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : brand.status === '打ち合わせ中' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {statusTranslations[language][brand.status] || brand.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.phoneNumber}</p>
                <p className="text-white font-mono">{brand.phoneNumber || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.email}</p>
                <p className="text-white">{brand.email || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.contactPerson}</p>
                <p className="text-white font-medium">{brand.contactPerson || "-"}</p>
              </div>
            </div>
            {brand.memo && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.memo}</p>
                <p className="text-gray-300 whitespace-pre-wrap bg-black/50 rounded-lg p-3 border border-red-900/20">
                  {brand.memo}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailsDialogOpen(false)}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog open={aiAnalysisDialogOpen} onOpenChange={setAiAnalysisDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full" />
              AI学習 - 商品情報抽出
            </DialogTitle>
          </DialogHeader>
          {selectedProductForAi && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-gray-400 text-sm mb-2">商品名: <span className="text-white font-medium">{selectedProductForAi.productName}</span></p>
              </div>
              
              {/* 画像選択または新規アップロード */}
              <div>
                <Label className="text-gray-400 mb-2 block">{language === 'ja' ? '分析する画像を選択またはアップロード' : '选择或上传要分析的图片'}</Label>
                
                {/* 新規アップロードボタン */}
                <div className="mb-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !selectedProductForAi) return;
                      
                      setIsUploading(true);
                      try {
                        // Convert to base64
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = (reader.result as string).split(',')[1];
                          
                          // Upload image
                          const result = await uploadImageMutation.mutateAsync({
                            base64,
                            filename: file.name,
                            type: 'product',
                          });
                          
                          // Set as selected image for AI analysis
                          setSelectedImageForAi(result.url);
                          
                          // Also add to product's imageUrls
                          const currentUrls = selectedProductForAi.imageUrls || [];
                          await updateProductMutation.mutateAsync({
                            id: selectedProductForAi.id,
                            imageUrls: [...currentUrls, result.url],
                          });
                          
                          toast.success(language === 'ja' ? '画像をアップロードしました' : '图片上传成功');
                          setIsUploading(false);
                        };
                        reader.readAsDataURL(file);
                      } catch (error) {
                        toast.error(language === 'ja' ? 'アップロードに失敗しました' : '上传失败');
                        setIsUploading(false);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full border-dashed border-2 border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 h-20"
                  >
                    {isUploading ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> {language === 'ja' ? 'アップロード中...' : '上传中...'}</>
                    ) : (
                      <><Upload className="h-5 w-5 mr-2" /> {language === 'ja' ? '新しいスクショをアップロード' : '上传新截图'}</>
                    )}
                  </Button>
                </div>
                
                {/* 既存画像一覧 */}
                {selectedProductForAi.imageUrls && selectedProductForAi.imageUrls.length > 0 && (
                  <>
                    <p className="text-gray-500 text-xs mb-2">{language === 'ja' ? 'または既存の画像を選択:' : '或选择已有图片:'}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedProductForAi.imageUrls?.map((url: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageForAi(url)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageForAi === url 
                              ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]' 
                              : 'border-red-900/30 hover:border-red-500/50'
                          }`}
                        >
                          <img 
                            src={url} 
                            alt={`商品画像 ${index + 1}`} 
                            className="w-full h-32 object-cover"
                          />
                          {selectedImageForAi === url && (
                            <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                              <Sparkles className="h-8 w-8 text-yellow-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 選択された画像のプレビュー */}
              {selectedImageForAi && (
                <div className="bg-black/50 rounded-lg border border-red-900/20 p-4">
                  <p className="text-gray-400 text-sm mb-2">選択された画像:</p>
                  <img 
                    src={selectedImageForAi} 
                    alt="選択された画像" 
                    className="max-h-64 mx-auto rounded-lg"
                  />
                </div>
              )}

              {/* 既存の備考表示 */}
              {selectedProductForAi.remarks && (
                <div className="bg-black/50 rounded-lg border border-red-900/20 p-4">
                  <p className="text-gray-400 text-sm mb-2">現在の備考 (保持されます):</p>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedProductForAi.remarks}</p>
                </div>
              )}

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  ℹ️ AIが画像から商品情報（キャッチコピー、詳細、価格、配送情報など）を抽出し、備考欄に追記します。既存の備考は削除されません。
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { 
                setAiAnalysisDialogOpen(false); 
                setSelectedProductForAi(null); 
                setSelectedImageForAi(null);
              }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
              disabled={isAnalyzing}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleAiAnalysis}
              disabled={!selectedImageForAi || isAnalyzing}
              className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI分析を実行
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
              {language === 'ja' ? '商品追加' : '添加商品'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400">{t.productName}</Label>
              <Input
                value={newProduct.productName}
                onChange={(e) => setNewProduct({ ...newProduct, productName: e.target.value })}
                placeholder={language === 'ja' ? '商品名を入力' : '输入商品名'}
                className="bg-black/60 border-red-900/50 text-white mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{t.listPrice}</Label>
                <Input
                  type="number"
                  value={newProduct.listPrice || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, listPrice: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">{t.specialPrice}</Label>
                <Input
                  type="number"
                  value={newProduct.specialPrice || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, specialPrice: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">{t.commissionRate}</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newProduct.commissionRate.replace(/[^0-9.]/g, '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                      setNewProduct({ ...newProduct, commissionRate: value });
                    }
                  }}
                  placeholder={language === 'ja' ? '例: 15' : '例: 15'}
                  className="bg-black/60 border-red-900/50 text-white mt-1 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 mt-0.5">%</span>
              </div>
            </div>
            <div>
              <Label className="text-gray-400">{language === 'ja' ? '備考' : '备注'}</Label>
              <Textarea
                value={newProduct.remarks}
                onChange={(e) => setNewProduct({ ...newProduct, remarks: e.target.value })}
                className="bg-black/60 border-red-900/50 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddProductDialogOpen(false); setNewProduct({ productName: "", listPrice: 0, specialPrice: 0, commissionRate: "", remarks: "" }); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (newProduct.productName.trim()) {
                  createProductMutation.mutate({
                    brandId,
                    productName: newProduct.productName,
                    listPrice: newProduct.listPrice,
                    specialPrice: newProduct.specialPrice,
                    discountRate: newProduct.commissionRate,
                    remarks: newProduct.remarks,
                  });
                }
              }}
              disabled={!newProduct.productName.trim()}
              className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white"
            >
              {t.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Livestream Dialog */}
      <Dialog open={addLivestreamDialogOpen} onOpenChange={setAddLivestreamDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
              {language === 'ja' ? '直播追加' : '添加直播'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{t.date}</Label>
                <Input
                  type="date"
                  value={newLivestream.livestreamDate}
                  onChange={(e) => setNewLivestream({ ...newLivestream, livestreamDate: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">{language === 'ja' ? '開始時間' : '开始时间'}</Label>
                <Input
                  type="time"
                  value={newLivestream.livestreamStartTime}
                  onChange={(e) => setNewLivestream({ ...newLivestream, livestreamStartTime: e.target.value })}
                  placeholder="14:30"
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{t.account}</Label>
                <Input
                  value={newLivestream.streamerName}
                  onChange={(e) => setNewLivestream({ ...newLivestream, streamerName: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">{t.platform}</Label>
                <Select
                  value={newLivestream.platform}
                  onValueChange={(value) => setNewLivestream({ ...newLivestream, platform: value })}
                >
                  <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                    <SelectValue placeholder={language === 'ja' ? '選択' : '选择'} />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-red-900/50">
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="YouTube">YouTube</SelectItem>
                    <SelectItem value="その他">{language === 'ja' ? 'その他' : '其他'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">{t.duration}{language === 'ja' ? '（分）' : '（分钟）'}</Label>
                <Input
                  type="number"
                  value={newLivestream.duration || ""}
                  onChange={(e) => setNewLivestream({ ...newLivestream, duration: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{t.productClicks}</Label>
                <Input
                  type="number"
                  value={newLivestream.productClicks || ""}
                  onChange={(e) => setNewLivestream({ ...newLivestream, productClicks: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">{t.impressions}</Label>
                <Input
                  type="number"
                  value={newLivestream.impressions || ""}
                  onChange={(e) => setNewLivestream({ ...newLivestream, impressions: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{t.salesCount}</Label>
                <Input
                  type="number"
                  value={newLivestream.salesCount || ""}
                  onChange={(e) => setNewLivestream({ ...newLivestream, salesCount: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">{t.gmv}</Label>
                <Input
                  type="number"
                  value={newLivestream.gmv || ""}
                  onChange={(e) => setNewLivestream({ ...newLivestream, gmv: parseInt(e.target.value) || 0 })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">{t.cartAddCount}</Label>
              <Input
                type="number"
                value={newLivestream.cartAddCount || ""}
                onChange={(e) => setNewLivestream({ ...newLivestream, cartAddCount: parseInt(e.target.value) || 0 })}
                className="bg-black/60 border-red-900/50 text-white mt-1"
              />
            </div>
            {/* 商品選択と手数料 */}
            <div className="border-t border-red-900/30 pt-4 mt-4">
              <p className="text-sm text-pink-400 mb-3 font-medium">{language === 'ja' ? '商品紐付け' : '商品关联'}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '商品' : '商品'}</Label>
                  <Select
                    value={newLivestream.productId?.toString() || ""}
                    onValueChange={(value) => {
                      const selectedProduct = products.find(p => p.id.toString() === value);
                      setNewLivestream({ 
                        ...newLivestream, 
                        productId: value ? parseInt(value) : null,
                        productCommission: selectedProduct?.commissionRate || ""
                      });
                    }}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder={language === 'ja' ? '商品を選択' : '选择商品'} />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50 text-white">
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()} className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">
                          {product.productName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">{language === 'ja' ? '成果報酬' : '成果报酬'}</Label>
                  <div className="bg-black/60 border border-red-900/50 rounded-md px-3 py-2 mt-1 text-cyan-400 font-medium">
                    {(() => {
                      const selectedProduct = newLivestream.productId ? products.find(p => p.id === newLivestream.productId) : null;
                      const rate = selectedProduct?.commissionRate;
                      return rate ? `${rate.replace(/[^0-9.]/g, '')}%` : '-';
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-gray-400">{language === 'ja' ? '備考' : '备注'}</Label>
              <Textarea
                value={newLivestream.remarks}
                onChange={(e) => setNewLivestream({ ...newLivestream, remarks: e.target.value })}
                className="bg-black/60 border-red-900/50 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddLivestreamDialogOpen(false); setNewLivestream({ livestreamDate: "", livestreamStartTime: "", streamerName: "", platform: "TikTok", duration: 0, gmv: 0, remarks: "", productClicks: 0, impressions: 0, salesCount: 0, cartAddCount: 0, productId: null, productCommission: "", adCost: 0, ctr: "", cvr: "", cpc: 0, acos: "", roas: "" }); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (newLivestream.livestreamDate && newLivestream.streamerName.trim()) {
                  createLivestreamMutation.mutate({
                    brandId,
                    livestreamDate: newLivestream.livestreamDate,
                    streamerName: newLivestream.streamerName,
                    platform: newLivestream.platform,
                    duration: newLivestream.duration,
                    gmv: newLivestream.gmv,
                    remarks: newLivestream.remarks,
                    productClicks: newLivestream.productClicks,
                    impressions: newLivestream.impressions,
                    salesCount: newLivestream.salesCount,
                    cartAddCount: newLivestream.cartAddCount,
                    productId: newLivestream.productId || undefined,
                    productCommission: newLivestream.productCommission || undefined,
                    adCost: newLivestream.adCost || undefined,
                    ctr: newLivestream.ctr || undefined,
                    cvr: newLivestream.cvr || undefined,
                    cpc: newLivestream.cpc || undefined,
                    acos: newLivestream.acos || undefined,
                    roas: newLivestream.roas || undefined,
                    livestreamStartTime: newLivestream.livestreamStartTime || undefined,
                  });
                }
              }}
              disabled={!newLivestream.livestreamDate || !newLivestream.streamerName.trim()}
              className="bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white"
            >
              {t.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation Dialog */}
      <AlertDialog open={deleteProductDialogOpen} onOpenChange={setDeleteProductDialogOpen}>
        <AlertDialogContent className="bg-black/95 border-red-900/50 text-white backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {language === 'ja' ? '商品を削除' : '删除商品'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {language === 'ja' 
                ? `「${productToDelete?.productName}」を削除しますか？この操作は取り消せません。`
                : `确定要删除「${productToDelete?.productName}」吗？此操作无法撤消。`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70">
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation.mutate({ id: productToDelete.id });
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {language === 'ja' ? '削除' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Livestream Confirmation Dialog */}
      <AlertDialog open={deleteLivestreamDialogOpen} onOpenChange={setDeleteLivestreamDialogOpen}>
        <AlertDialogContent className="bg-black/95 border-red-900/50 text-white backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {language === 'ja' ? '直播を削除' : '删除直播'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {language === 'ja' 
                ? `${formatDate(livestreamToDelete?.livestreamDate)}の直播（${livestreamToDelete?.streamerName}）を削除しますか？この操作は取り消せません。`
                : `确定要删除${formatDate(livestreamToDelete?.livestreamDate)}的直播（${livestreamToDelete?.streamerName}）吗？此操作无法撤消。`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70">
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (livestreamToDelete) {
                  deleteLivestreamMutation.mutate({ id: livestreamToDelete.id });
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {language === 'ja' ? '削除' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Contract Confirmation Dialog */}
      <AlertDialog open={deleteContractDialogOpen} onOpenChange={setDeleteContractDialogOpen}>
        <AlertDialogContent className="bg-black/95 border-red-900/50 text-white backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {language === 'ja' ? '契約を削除' : '删除合同'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {language === 'ja' 
                ? `${serviceTypeTranslations[language][contractToDelete?.serviceType] || contractToDelete?.serviceType}（固定費: ${formatCurrency(contractToDelete?.fixedFee)}）を削除しますか？紐付けられたライブとの関連も削除されます。この操作は取り消せません。`
                : `确定要删除${serviceTypeTranslations[language][contractToDelete?.serviceType] || contractToDelete?.serviceType}（固定费: ${formatCurrency(contractToDelete?.fixedFee)}）吗？与直播的关联也将被删除。此操作无法撤消。`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70">
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (contractToDelete) {
                  deleteContractMutation.mutate({ id: contractToDelete.id });
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {language === 'ja' ? '削除' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Contract Dialog */}
      <Dialog open={addContractDialogOpen} onOpenChange={setAddContractDialogOpen}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
              {language === 'zh' ? '添加合同' : '契約追加'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400">{language === 'ja' ? '契約タイプ' : '合同类型'}</Label>
              <Select
                value={newContract.serviceType}
                onValueChange={(value) => setNewContract({ ...newContract, serviceType: value as "単発ライブ契約" | "期間契約" | "運用代行型（TSP）" | "パッケージ／複合契約" })}
              >
                <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-red-900/50">
                  <SelectItem value="単発ライブ契約" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '单次直播合同' : '単発ライブ契約'}</SelectItem>
                  <SelectItem value="期間契約" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '期限合同（月付/年付）' : '期間契約（月額 or 年額）'}</SelectItem>
                  <SelectItem value="運用代行型（TSP）" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '运营代理型（TSP）' : '運用代行型（TSP）'}</SelectItem>
                  <SelectItem value="パッケージ／複合契約" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '套餐/复合合同' : 'パッケージ／複合契約'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">{t.fixedFee}</Label>
              <Input
                type="number"
                value={newContract.fixedFee || ""}
                onChange={(e) => setNewContract({ ...newContract, fixedFee: parseInt(e.target.value) || 0 })}
                placeholder="例: 1000000"
                className="bg-black/60 border-red-900/50 text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-400">{t.status}</Label>
              <Select
                value={newContract.status}
                onValueChange={(value) => setNewContract({ ...newContract, status: value as "契約中" | "完了" | "保留" | "終了" })}
              >
                <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-red-900/50">
                  <SelectItem value="契約中" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '合同中' : '契約中'}</SelectItem>
                  <SelectItem value="完了" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '已完成' : '完了'}</SelectItem>
                  <SelectItem value="保留" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '暂停' : '保留'}</SelectItem>
                  <SelectItem value="終了" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">{language === 'zh' ? '结束' : '終了'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">{t.startDate}</Label>
                <Input
                  type="date"
                  value={newContract.startDate}
                  onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-400">{t.endDate}</Label>
                <Input
                  type="date"
                  value={newContract.endDate}
                  onChange={(e) => setNewContract({ ...newContract, endDate: e.target.value })}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">{t.memo}</Label>
              <Textarea
                value={newContract.memo}
                onChange={(e) => setNewContract({ ...newContract, memo: e.target.value })}
                className="bg-black/60 border-red-900/50 text-white mt-1"
                rows={3}
              />
            </div>
            
            {/* ライブ選択セクション */}
            <div className="border-t border-red-900/30 pt-4">
              <Label className="text-gray-400 flex items-center gap-2">
                <Video className="h-4 w-4" />
                {language === 'zh' ? '关联直播' : 'ライブ紐付け'}
              </Label>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-2">
                {livestreams && livestreams.length > 0 ? (
                  livestreams.map((ls) => (
                    <label
                      key={ls.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-black/40 hover:bg-red-900/20 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newContract.linkedLivestreamIds.includes(ls.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewContract({
                              ...newContract,
                              linkedLivestreamIds: [...newContract.linkedLivestreamIds, ls.id],
                            });
                          } else {
                            setNewContract({
                              ...newContract,
                              linkedLivestreamIds: newContract.linkedLivestreamIds.filter((id) => id !== ls.id),
                            });
                          }
                        }}
                        className="w-4 h-4 rounded border-red-900/50 bg-black/60 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {ls.livestreamDate ? new Date(ls.livestreamDate).toLocaleDateString('ja-JP') : ''} - {ls.streamerName || (language === 'zh' ? '未知主播' : '不明')}
                        </div>
                        <div className="text-xs text-gray-500">
                          GMV: ¥{(ls.gmv || ls.salesAmount || 0).toLocaleString()}
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm py-2">
                    {language === 'zh' ? '暂无直播记录' : 'ライブ履歴がありません'}
                  </div>
                )}
              </div>
              {newContract.linkedLivestreamIds.length > 0 && (
                <div className="mt-2 text-xs text-amber-400">
                  {language === 'zh' ? `已选择 ${newContract.linkedLivestreamIds.length} 个直播` : `${newContract.linkedLivestreamIds.length}件のライブを選択中`}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddContractDialogOpen(false)}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={async () => {
                const result = await createContractMutation.mutateAsync({
                  brandId,
                  serviceType: newContract.serviceType,
                  fixedFee: newContract.fixedFee,
                  status: newContract.status,
                  startDate: newContract.startDate ? new Date(newContract.startDate) : undefined,
                  endDate: newContract.endDate ? new Date(newContract.endDate) : undefined,
                  memo: newContract.memo || undefined,
                });
                // ライブ紐付けがあれば実行
                if (newContract.linkedLivestreamIds.length > 0 && result.contractId) {
                  bulkLinkLivestreamsMutation.mutate({
                    contractId: result.contractId,
                    livestreamIds: newContract.linkedLivestreamIds,
                  });
                }
              }}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
            >
              {t.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Image Add Dialog */}
      <Dialog open={aiImageAddDialogOpen} onOpenChange={(open) => {
        setAiImageAddDialogOpen(open);
        if (!open) {
          setAiImageFile(null);
          setAiImagePreview(null);
          setExtractedProductData(null);
        }
      }}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white backdrop-blur-xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
              {t.aiImageAdd}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Hidden file input */}
            <input
              type="file"
              ref={aiImageInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setAiImageFile(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setAiImagePreview(ev.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                  setExtractedProductData(null);
                }
              }}
            />
            
            {/* Upload area */}
            {!aiImagePreview ? (
              <div
                onClick={() => aiImageInputRef.current?.click()}
                className="border-2 border-dashed border-purple-500/50 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-900/10 transition-all"
              >
                <Upload className="h-12 w-12 mx-auto text-purple-400 mb-4" />
                <p className="text-gray-300">
                  {language === 'ja' ? 'クリックしてスクショをアップロード' : '点击上传截图'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {language === 'ja' ? 'AIが商品情報を自動抽出します' : 'AI将自动提取商品信息'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image preview */}
                <div className="relative">
                  <img
                    src={aiImagePreview}
                    alt="Preview"
                    className="w-full max-h-64 object-contain rounded-lg border border-purple-500/30"
                  />
                  <button
                    onClick={() => {
                      setAiImageFile(null);
                      setAiImagePreview(null);
                      setExtractedProductData(null);
                    }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* AI Analysis button */}
                {!extractedProductData && (
                  <Button
                    onClick={async () => {
                      if (!aiImageFile) return;
                      setIsAiProcessing(true);
                      try {
                        // Upload image first
                        const base64 = aiImagePreview?.split(',')[1] || '';
                        const uploadResult = await uploadImageMutation.mutateAsync({
                          base64: base64,
                          filename: aiImageFile.name,
                          type: 'product',
                        });
                        
                        // Extract product info from image
                        const extractResult = await aiExtractMutation.mutateAsync({
                          imageUrl: uploadResult.url,
                        });
                        
                        if (extractResult.success && extractResult.data) {
                          setExtractedProductData({
                            ...extractResult.data,
                            imageUrl: uploadResult.url,
                          });
                          toast.success(language === 'ja' ? '商品情報を抽出しました' : '已提取商品信息');
                        } else {
                          throw new Error('AI解析に失敗しました');
                        }
                      } catch (error: any) {
                        console.error('AI analysis error:', error);
                        toast.error(language === 'ja' ? `AI分析に失敗しました: ${error.message || '不明なエラー'}` : `AI分析失败: ${error.message || '未知错误'}`);
                      } finally {
                        setIsAiProcessing(false);
                      }
                    }}
                    disabled={isAiProcessing}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white"
                  >
                    {isAiProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'ja' ? 'AI分析中...' : 'AI分析中...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {language === 'ja' ? 'AIで商品情報を抽出' : 'AI提取商品信息'}
                      </>
                    )}
                  </Button>
                )}

                {/* Extracted data preview and edit */}
                {extractedProductData && (
                  <div className="space-y-4 border border-purple-500/30 rounded-lg p-4 bg-purple-900/10 max-h-[60vh] overflow-y-auto">
                    <h4 className="text-sm font-bold text-purple-300 sticky top-0 bg-purple-900/90 py-2 -mt-2 -mx-4 px-4">
                      {language === 'ja' ? '抽出された商品情報' : '提取的商品信息'}
                    </h4>
                    
                    {/* 商品名 */}
                    <div>
                      <Label className="text-gray-400">{t.productName}</Label>
                      <Input
                        value={extractedProductData.productName || ''}
                        onChange={(e) => setExtractedProductData({ ...extractedProductData, productName: e.target.value })}
                        className="bg-black/60 border-purple-500/50 text-white mt-1"
                      />
                    </div>
                    
                    {/* 価格情報 */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-gray-400">{t.listPrice}</Label>
                        <Input
                          type="number"
                          value={extractedProductData.listPrice || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, listPrice: parseInt(e.target.value) || 0 })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">{t.specialPrice}</Label>
                        <Input
                          type="number"
                          value={extractedProductData.specialPrice || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, specialPrice: parseInt(e.target.value) || 0 })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? '割引率' : '折扣率'}</Label>
                        <Input
                          value={extractedProductData.discountRate || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, discountRate: e.target.value })}
                          placeholder="例: 20%"
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* 発売日・在庫・商品コード */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? '発売日' : '发售日'}</Label>
                        <Input
                          value={extractedProductData.releaseDate || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, releaseDate: e.target.value })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? '在庫数' : '库存'}</Label>
                        <Input
                          type="number"
                          value={extractedProductData.stock || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, stock: parseInt(e.target.value) || 0 })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? '商品コード' : '商品编码'}</Label>
                        <Input
                          value={extractedProductData.productCode || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, productCode: e.target.value })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* キャッチコピー */}
                    <div>
                      <Label className="text-gray-400">{language === 'ja' ? 'キャッチコピー' : '广告语'}</Label>
                      <Textarea
                        value={extractedProductData.catchCopy || ''}
                        onChange={(e) => setExtractedProductData({ ...extractedProductData, catchCopy: e.target.value })}
                        className="bg-black/60 border-purple-500/50 text-white mt-1"
                        rows={2}
                      />
                    </div>
                    
                    {/* 商品の特徴・セールスポイント */}
                    <div>
                      <Label className="text-gray-400">{language === 'ja' ? '商品の特徴・セールスポイント' : '商品特点/卖点'}</Label>
                      <Textarea
                        value={extractedProductData.features || ''}
                        onChange={(e) => setExtractedProductData({ ...extractedProductData, features: e.target.value })}
                        className="bg-black/60 border-purple-500/50 text-white mt-1"
                        rows={4}
                      />
                    </div>
                    
                    {/* 商品詳細 */}
                    <div>
                      <Label className="text-gray-400">{language === 'ja' ? '商品詳細（内容量・容量等）' : '商品详情（内容量/容量等）'}</Label>
                      <Textarea
                        value={extractedProductData.productDetails || ''}
                        onChange={(e) => setExtractedProductData({ ...extractedProductData, productDetails: e.target.value })}
                        className="bg-black/60 border-purple-500/50 text-white mt-1"
                        rows={3}
                      />
                    </div>
                    
                    {/* 付属品・セット内容 */}
                    <div>
                      <Label className="text-gray-400">{language === 'ja' ? '付属品・セット内容' : '附件/套装内容'}</Label>
                      <Textarea
                        value={extractedProductData.accessories || ''}
                        onChange={(e) => setExtractedProductData({ ...extractedProductData, accessories: e.target.value })}
                        className="bg-black/60 border-purple-500/50 text-white mt-1"
                        rows={2}
                      />
                    </div>
                    
                    {/* 配送情報・成果報酬 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? '配送情報' : '配送信息'}</Label>
                        <Textarea
                          value={extractedProductData.shippingInfo || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, shippingInfo: e.target.value })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">{t.commissionRate}</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={(extractedProductData.commissionRate || '').replace(/[^0-9.]/g, '')}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                                setExtractedProductData({ ...extractedProductData, commissionRate: value });
                              }
                            }}
                            placeholder="例: 15"
                            className="bg-black/60 border-purple-500/50 text-white mt-1 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 mt-0.5">%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* ターゲット層・使用方法 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? 'ターゲット層' : '目标人群'}</Label>
                        <Input
                          value={extractedProductData.targetAudience || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, targetAudience: e.target.value })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">{language === 'ja' ? '使用方法' : '使用方法'}</Label>
                        <Input
                          value={extractedProductData.usageMethod || ''}
                          onChange={(e) => setExtractedProductData({ ...extractedProductData, usageMethod: e.target.value })}
                          className="bg-black/60 border-purple-500/50 text-white mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* 備考 */}
                    <div>
                      <Label className="text-gray-400">{language === 'ja' ? '備考・その他' : '备注/其他'}</Label>
                      <Textarea
                        value={extractedProductData.remarks || ''}
                        onChange={(e) => setExtractedProductData({ ...extractedProductData, remarks: e.target.value })}
                        className="bg-black/60 border-purple-500/50 text-white mt-1"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAiImageAddDialogOpen(false);
                setAiImageFile(null);
                setAiImagePreview(null);
                setExtractedProductData(null);
              }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            {extractedProductData && (
              <Button
                onClick={() => {
                  if (extractedProductData.productName) {
                    createProductMutation.mutate({
                      brandId,
                      productName: extractedProductData.productName,
                      listPrice: extractedProductData.listPrice || 0,
                      specialPrice: extractedProductData.specialPrice || 0,
                      commissionRate: extractedProductData.commissionRate || '',
                      remarks: extractedProductData.remarks || '',
                      productCode: extractedProductData.productCode || '',
                      releaseDate: extractedProductData.releaseDate || '',
                      catchCopy: extractedProductData.catchCopy || '',
                      features: extractedProductData.features || '',
                      productDetails: extractedProductData.productDetails || '',
                      accessories: extractedProductData.accessories || '',
                      shippingInfo: extractedProductData.shippingInfo || '',
                      targetAudience: extractedProductData.targetAudience || '',
                      usageMethod: extractedProductData.usageMethod || '',
                      imageUrls: extractedProductData.imageUrl ? [extractedProductData.imageUrl] : [],
                    });
                    setAiImageAddDialogOpen(false);
                    setAiImageFile(null);
                    setAiImagePreview(null);
                    setExtractedProductData(null);
                  }
                }}
                disabled={!extractedProductData.productName}
                className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white"
              >
                {t.add}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Detail Popup Dialog - Exciting Design */}
      <Dialog open={productDetailDialogOpen} onOpenChange={setProductDetailDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-950 via-black to-gray-950 border-2 border-pink-500/40 text-white backdrop-blur-xl w-[98vw] !max-w-[1600px] h-[95vh] overflow-hidden p-0 shadow-[0_0_60px_rgba(236,72,153,0.3)]" showCloseButton={false}>
          <div className="flex flex-col h-full relative">
            {/* Animated Background Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-pink-500/5 to-transparent rounded-full" />
            </div>
            
            {/* Header */}
            <div className="relative flex items-center justify-between px-10 py-6 border-b border-pink-500/30 bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-pink-950/40">
              <DialogTitle className="text-white flex items-center gap-5 text-4xl font-bold">
                <div className="p-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl shadow-lg shadow-pink-500/30">
                  <Package className="h-10 w-10 text-white" />
                </div>
                <span className="bg-gradient-to-r from-pink-300 via-white to-purple-300 bg-clip-text text-transparent">
                  {language === 'ja' ? '商品詳細' : '商品详情'}
                </span>
              </DialogTitle>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingProduct(selectedProductForDetail);
                    setProductDetailDialogOpen(false);
                    setEditProductDialogOpen(true);
                  }}
                  className="border-2 border-cyan-400/60 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-500/30 hover:text-white hover:border-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] text-xl px-8 py-3 transition-all duration-300"
                >
                  <Edit2 className="w-5 h-5 mr-2" />
                  {language === 'ja' ? '編集' : '编辑'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setProductDetailDialogOpen(false)}
                  className="border-2 border-gray-500/60 bg-gray-900/50 text-gray-200 hover:bg-gray-700/50 hover:text-white hover:border-gray-400 text-xl px-8 py-3 transition-all duration-300"
                >
                  <X className="w-5 h-5 mr-2" />
                  {language === 'ja' ? '閉じる' : '关闭'}
                </Button>
              </div>
            </div>
            
            {/* Content - Side by Side Layout */}
            {selectedProductForDetail && (
              <div className="flex flex-1 overflow-hidden relative">
                {/* Left Side - Image Gallery with Glow Effect */}
                <div className="w-[48%] bg-gradient-to-br from-gray-900/90 via-black to-gray-900/90 p-6 flex flex-col border-r border-pink-500/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-purple-500/5" />
                  
                  {/* Main Image Display */}
                  <div className="flex-1 flex items-center justify-center relative">
                    {productImages.length > 0 ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {/* Navigation Arrows */}
                        {productImages.length > 1 && (
                          <>
                            <button
                              onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : productImages.length - 1))}
                              className="absolute left-2 z-20 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all"
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                              onClick={() => setCurrentImageIndex((prev) => (prev < productImages.length - 1 ? prev + 1 : 0))}
                              className="absolute right-2 z-20 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all"
                            >
                              <ChevronRight className="w-6 h-6" />
                            </button>
                          </>
                        )}
                        
                        {/* Main Image */}
                        <div 
                          className="group cursor-pointer relative"
                          onClick={() => {
                            setExpandedImageIndex(currentImageIndex);
                            setExpandedImageUrl(productImages[currentImageIndex]?.imageUrl);
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <img 
                            src={productImages[currentImageIndex]?.imageUrl} 
                            alt={selectedProductForDetail.productName || ''}
                            className="max-w-full max-h-[50vh] object-contain rounded-2xl border-4 border-pink-500/40 cursor-pointer hover:scale-[1.02] transition-all duration-500 shadow-[0_0_40px_rgba(236,72,153,0.3)] hover:shadow-[0_0_60px_rgba(236,72,153,0.5)] relative z-10"
                          />
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                            <ZoomIn className="w-4 h-4" />
                            {language === 'ja' ? 'クリックで拡大' : '点击放大'}
                          </div>
                        </div>
                        
                        {/* Page Indicator */}
                        {productImages.length > 1 && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-20">
                            {currentImageIndex + 1} / {productImages.length}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-64 h-64 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 border-pink-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.2)]">
                        <Package className="w-24 h-24 text-gray-600" />
                      </div>
                    )}
                  </div>
                  
                  {/* Thumbnail Strip + Actions */}
                  <div className="relative z-10 mt-4 space-y-3">
                    {/* Thumbnails */}
                    {productImages.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {productImages.map((img, idx) => (
                          <button
                            key={img.id || idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                              idx === currentImageIndex 
                                ? 'border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' 
                                : 'border-gray-600 hover:border-gray-400'
                            }`}
                          >
                            <img 
                              src={img.imageUrl} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                            {/* Delete button for non-proposal images */}
                            {!img.isProposalImage && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProductImageMutation.mutate({ imageId: img.id });
                                }}
                                className="absolute top-0 right-0 p-0.5 bg-red-500/80 hover:bg-red-500 rounded-bl text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {/* Add Image Button */}
                      <input
                        type="file"
                        ref={productImageInputRef}
                        onChange={handleProductImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => productImageInputRef.current?.click()}
                        disabled={isAddingImage}
                        className="flex-1 border-pink-500/50 text-pink-300 hover:bg-pink-500/20"
                      >
                        {isAddingImage ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        {language === 'ja' ? '画像を追加' : '添加图片'}
                      </Button>
                      
                      {/* PDF Download Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPdf}
                        disabled={productImages.length === 0}
                        className="flex-1 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {language === 'ja' ? 'PDFダウンロード' : '下载PDF'}
                      </Button>
                    </div>
                    
                    {/* Keyboard hint */}
                    {productImages.length > 1 && (
                      <p className="text-xs text-gray-500 text-center">
                        {language === 'ja' ? '← → キーで画像を切り替え' : '使用 ← → 键切换图片'}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Right Side - Info with Enhanced Styling */}
                <div className="w-[52%] overflow-y-auto p-10 space-y-8 relative">
                  {/* Product Name - Hero Style */}
                  <div className="pb-6 border-b border-pink-500/20">
                    <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
                      {selectedProductForDetail.productName}
                    </h2>
                  </div>
                  
                  {/* Price Info - Glowing Cards */}
                  <div className="grid grid-cols-3 gap-5">
                    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-6 border-2 border-gray-600/40 hover:border-white/40 transition-all duration-300 group">
                      <Label className="text-gray-400 text-lg font-medium">{language === 'ja' ? '定価' : '定价'}</Label>
                      <p className="text-white font-black text-4xl mt-3 group-hover:scale-105 transition-transform">
                        {selectedProductForDetail.listPrice ? `¥${selectedProductForDetail.listPrice.toLocaleString()}` : '-'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-950/60 to-pink-900/30 rounded-2xl p-6 border-2 border-pink-500/50 hover:border-pink-400 hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] transition-all duration-300 group">
                      <Label className="text-pink-300 text-lg font-medium">{language === 'ja' ? '特価' : '特价'}</Label>
                      <p className="text-pink-300 font-black text-4xl mt-3 group-hover:scale-105 transition-transform" style={{ textShadow: '0 0 20px rgba(236,72,153,0.6)' }}>
                        {selectedProductForDetail.specialPrice ? `¥${selectedProductForDetail.specialPrice.toLocaleString()}` : '-'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-950/60 to-cyan-900/30 rounded-2xl p-6 border-2 border-cyan-500/50 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] transition-all duration-300 group">
                      <Label className="text-cyan-300 text-lg font-medium">{language === 'ja' ? '成果報酬' : '成果报酬'}</Label>
                      <p className="text-cyan-300 font-black text-4xl mt-3 group-hover:scale-105 transition-transform" style={{ textShadow: '0 0 20px rgba(34,211,238,0.6)' }}>
                        {selectedProductForDetail.commissionRate ? `${selectedProductForDetail.commissionRate.replace(/[^0-9.]/g, '')}%` : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Basic Info - Modern Cards */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-gray-900/60 rounded-2xl p-6 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300">
                      <Label className="text-gray-400 text-lg">{language === 'ja' ? '発売日' : '发售日'}</Label>
                      <p className="text-white font-bold text-2xl mt-3">
                        {selectedProductForDetail.releaseDate || '-'}
                      </p>
                    </div>
                    <div className="bg-gray-900/60 rounded-2xl p-6 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300">
                      <Label className="text-gray-400 text-lg">{language === 'ja' ? '商品コード' : '商品编码'}</Label>
                      <p className="text-white font-bold text-2xl mt-3">
                        {selectedProductForDetail.productCode || '-'}
                      </p>
                    </div>
                  </div>

                  {/* AI Extracted Info - Exciting Section */}
                  {(selectedProductForDetail.catchCopy || selectedProductForDetail.features || selectedProductForDetail.productDetails || selectedProductForDetail.accessories || selectedProductForDetail.shippingInfo || selectedProductForDetail.targetAudience || selectedProductForDetail.usageMethod) && (
                    <div className="space-y-6 pt-4">
                      <h3 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent border-b-2 border-purple-500/30 pb-4 flex items-center gap-4">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                          <Sparkles className="h-7 w-7 text-white" />
                        </div>
                        {language === 'ja' ? 'AI抽出情報' : 'AI提取信息'}
                      </h3>
                      
                      {selectedProductForDetail.catchCopy && (
                        <div className="bg-gradient-to-r from-yellow-950/50 via-orange-950/40 to-yellow-950/50 rounded-2xl p-8 border-2 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)] hover:shadow-[0_0_40px_rgba(234,179,8,0.25)] transition-all duration-300">
                          <Label className="text-yellow-400 text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">✨</span> {language === 'ja' ? 'キャッチコピー・広告語' : '广告语'}
                          </Label>
                          <p className="text-yellow-100 mt-4 whitespace-pre-wrap text-2xl font-bold leading-relaxed" style={{ textShadow: '0 0 10px rgba(234,179,8,0.3)' }}>{selectedProductForDetail.catchCopy}</p>
                        </div>
                      )}
                      
                      {selectedProductForDetail.features && (
                        <div className="bg-gray-900/70 rounded-2xl p-7 border border-gray-600/50 hover:border-pink-500/40 transition-all duration-300">
                          <Label className="text-pink-300 text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🎯</span> {language === 'ja' ? '商品の特徴・セールスポイント' : '商品特点/卖点'}
                          </Label>
                          <p className="text-gray-100 mt-4 whitespace-pre-wrap text-xl leading-relaxed">{selectedProductForDetail.features}</p>
                        </div>
                      )}
                      
                      {selectedProductForDetail.productDetails && (
                        <div className="bg-gray-900/70 rounded-2xl p-7 border border-gray-600/50 hover:border-cyan-500/40 transition-all duration-300">
                          <Label className="text-cyan-300 text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">📦</span> {language === 'ja' ? '商品詳細（内容量・容量等）' : '商品详情（内容量/容量等）'}
                          </Label>
                          <p className="text-gray-100 mt-4 whitespace-pre-wrap text-xl leading-relaxed">{selectedProductForDetail.productDetails}</p>
                        </div>
                      )}
                      
                      {selectedProductForDetail.accessories && (
                        <div className="bg-gray-900/70 rounded-2xl p-7 border border-gray-600/50 hover:border-purple-500/40 transition-all duration-300">
                          <Label className="text-purple-300 text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🎁</span> {language === 'ja' ? '付属品・セット内容' : '附件/套装内容'}
                          </Label>
                          <p className="text-gray-100 mt-4 whitespace-pre-wrap text-xl leading-relaxed">{selectedProductForDetail.accessories}</p>
                        </div>
                      )}
                      
                      {selectedProductForDetail.shippingInfo && (
                        <div className="bg-gray-900/70 rounded-2xl p-7 border border-gray-600/50 hover:border-green-500/40 transition-all duration-300">
                          <Label className="text-green-300 text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">🚚</span> {language === 'ja' ? '配送情報' : '配送信息'}
                          </Label>
                          <p className="text-gray-100 mt-4 whitespace-pre-wrap text-xl leading-relaxed">{selectedProductForDetail.shippingInfo}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-5">
                        {selectedProductForDetail.targetAudience && (
                          <div className="bg-gray-900/70 rounded-2xl p-6 border border-gray-600/50 hover:border-orange-500/40 transition-all duration-300">
                            <Label className="text-orange-300 text-lg font-bold flex items-center gap-2">
                              <span className="text-xl">👥</span> {language === 'ja' ? 'ターゲット層' : '目标人群'}
                            </Label>
                            <p className="text-gray-100 mt-3 text-xl">{selectedProductForDetail.targetAudience}</p>
                          </div>
                        )}
                        {selectedProductForDetail.usageMethod && (
                          <div className="bg-gray-900/70 rounded-2xl p-6 border border-gray-600/50 hover:border-blue-500/40 transition-all duration-300">
                            <Label className="text-blue-300 text-lg font-bold flex items-center gap-2">
                              <span className="text-xl">📋</span> {language === 'ja' ? '使用方法' : '使用方法'}
                            </Label>
                            <p className="text-gray-100 mt-3 text-xl">{selectedProductForDetail.usageMethod}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Remarks */}
                  {selectedProductForDetail.remarks && (
                    <div className="bg-gray-900/50 rounded-2xl p-7 border border-gray-700/50 hover:border-gray-500/50 transition-all duration-300">
                      <Label className="text-gray-300 text-xl font-bold flex items-center gap-2">
                        <span className="text-xl">📝</span> {language === 'ja' ? '備考' : '备注'}
                      </Label>
                      <p className="text-gray-200 mt-4 whitespace-pre-wrap text-xl leading-relaxed">{selectedProductForDetail.remarks}</p>
                    </div>
                  )}

                  {/* Product Links Section */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent border-b-2 border-blue-500/30 pb-3 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                        <Link className="h-6 w-6 text-white" />
                      </div>
                      {language === 'ja' ? '商品リンク' : '商品链接'}
                    </h3>
                    
                    {/* Existing Links */}
                    {productLinksData.length > 0 && (
                      <div className="space-y-3">
                        {productLinksData.map((link: any) => (
                          <div 
                            key={link.id} 
                            className="flex items-center gap-3 bg-gray-900/60 rounded-xl p-4 border border-gray-600/40 hover:border-blue-500/40 transition-all duration-300 group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-300 font-semibold text-lg">{link.title}</span>
                              </div>
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-gray-400 text-sm hover:text-blue-400 truncate block mt-1 transition-colors"
                              >
                                {link.url}
                              </a>
                            </div>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-300 hover:text-white transition-all duration-200"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </a>
                            <button
                              onClick={() => deleteProductLinkMutation.mutate({ linkId: link.id, productId: selectedProductForDetail.id })}
                              className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-300 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Link Form */}
                    {isAddingLink ? (
                      <div className="bg-gray-900/60 rounded-xl p-5 border border-blue-500/40 space-y-4">
                        <div>
                          <Label className="text-gray-300 text-sm">{language === 'ja' ? 'タイトル' : '标题'}</Label>
                          <Input
                            value={newLinkTitle}
                            onChange={(e) => setNewLinkTitle(e.target.value)}
                            placeholder={language === 'ja' ? '例: TikTok Shop, 楽天, 公式サイト' : '例: TikTok Shop, 乐天, 官网'}
                            className="mt-2 bg-gray-800/50 border-gray-600 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-sm">URL</Label>
                          <Input
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                            placeholder="https://..."
                            className="mt-2 bg-gray-800/50 border-gray-600 text-white"
                          />
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              if (newLinkTitle && newLinkUrl) {
                                addProductLinkMutation.mutate({
                                  productId: selectedProductForDetail.id,
                                  title: newLinkTitle,
                                  url: newLinkUrl,
                                });
                              }
                            }}
                            disabled={!newLinkTitle || !newLinkUrl || addProductLinkMutation.isPending}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            {addProductLinkMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4 mr-2" />
                            )}
                            {language === 'ja' ? '追加' : '添加'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsAddingLink(false);
                              setNewLinkTitle('');
                              setNewLinkUrl('');
                            }}
                            className="border-gray-600 text-gray-300 hover:bg-gray-800"
                          >
                            {language === 'ja' ? 'キャンセル' : '取消'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setIsAddingLink(true)}
                        className="w-full border-dashed border-2 border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/60 py-4"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        {language === 'ja' ? 'リンクを追加' : '添加链接'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Image Expanded Overlay */}
            {expandedImageUrl && (
              <div 
                className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center animate-in fade-in duration-200"
                onClick={() => setExpandedImageUrl(null)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setExpandedImageUrl(null);
                  } else if (e.key === 'ArrowLeft' && productImages.length > 1) {
                    const newIndex = expandedImageIndex > 0 ? expandedImageIndex - 1 : productImages.length - 1;
                    setExpandedImageIndex(newIndex);
                    setExpandedImageUrl(productImages[newIndex]?.imageUrl || null);
                  } else if (e.key === 'ArrowRight' && productImages.length > 1) {
                    const newIndex = expandedImageIndex < productImages.length - 1 ? expandedImageIndex + 1 : 0;
                    setExpandedImageIndex(newIndex);
                    setExpandedImageUrl(productImages[newIndex]?.imageUrl || null);
                  }
                }}
                ref={(el) => el?.focus()}
              >
                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedImageUrl(null);
                  }}
                  className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all duration-200 hover:scale-110 z-10"
                >
                  <X className="w-8 h-8" />
                </button>
                
                {/* Left arrow button */}
                {productImages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newIndex = expandedImageIndex > 0 ? expandedImageIndex - 1 : productImages.length - 1;
                      setExpandedImageIndex(newIndex);
                      setExpandedImageUrl(productImages[newIndex]?.imageUrl || null);
                    }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all duration-200 hover:scale-110 z-10"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                )}
                
                {/* Image */}
                <img 
                  src={expandedImageUrl} 
                  alt="拡大画像"
                  className="max-w-[85%] max-h-[85%] object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
                
                {/* Right arrow button */}
                {productImages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newIndex = expandedImageIndex < productImages.length - 1 ? expandedImageIndex + 1 : 0;
                      setExpandedImageIndex(newIndex);
                      setExpandedImageUrl(productImages[newIndex]?.imageUrl || null);
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all duration-200 hover:scale-110 z-10"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                )}
                
                {/* Image indicator */}
                {productImages.length > 1 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm z-10">
                    {expandedImageIndex + 1} / {productImages.length}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 紐付けライブ詳細ダイアログ */}
      <Dialog open={linkedLivestreamDetailDialogOpen} onOpenChange={setLinkedLivestreamDetailDialogOpen}>
        <DialogContent className="bg-black/95 border-amber-500/30 text-white max-w-4xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-pink-600 rounded-full" />
              {language === 'ja' ? '紐付けライブ詳細' : '关联直播详情'}
            </DialogTitle>
          </DialogHeader>
          {linkedLivestreamContractInfo && (
            <div className="space-y-4 py-4">
              {/* 契約情報サマリー */}
              <div className="bg-gradient-to-r from-amber-950/50 to-pink-950/50 rounded-lg p-4 border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/30 text-amber-300 border border-amber-400/50">
                      {serviceTypeTranslations[language][linkedLivestreamContractInfo.serviceType] || linkedLivestreamContractInfo.serviceType}
                    </Badge>
                    <Badge className={`${linkedLivestreamContractInfo.status === '契約中' ? 'bg-green-500/30 text-green-300 border border-green-400/50' : 'bg-gray-500/30 text-gray-300 border border-gray-400/50'}`}>
                      {statusTranslations[language][linkedLivestreamContractInfo.status] || linkedLivestreamContractInfo.status}
                    </Badge>
                  </div>
                  <span className="text-2xl font-black text-amber-300">{formatCurrency(linkedLivestreamContractInfo.fixedFee)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {t.startDate}: {formatDate(linkedLivestreamContractInfo.startDate)} ～ {t.endDate}: {formatDate(linkedLivestreamContractInfo.endDate)}
                </div>
              </div>

              {/* ROASサマリー */}
              {linkedLivestreamDetailData.length > 0 && linkedLivestreamContractInfo.fixedFee > 0 && (() => {
                const totalGmv = linkedLivestreamDetailData.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
                const totalImpressions = linkedLivestreamDetailData.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
                const adValue = totalImpressions * 15;
                const fixedFee = linkedLivestreamContractInfo.fixedFee || 0;
                // 総価値 = GMV + 広告換算費用
                const totalValue = totalGmv + adValue;
                // ROAS = (GMV + 広告換算費用) ÷ 固定費
                const roas = fixedFee > 0 ? totalValue / fixedFee : 0;
                const vsIndustry = roas / INDUSTRY_AVG_ROAS;
                return (
                  <div className="grid grid-cols-5 gap-3 bg-black/60 rounded-lg p-3 border border-pink-500/30">
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500">紐付け</div>
                      <div className="text-lg font-black text-amber-400">{linkedLivestreamDetailData.length}<span className="text-xs">件</span></div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500">GMV合計</div>
                      <div className="text-lg font-black text-cyan-400 font-mono">{formatCurrency(totalGmv)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500">曝光合計</div>
                      <div className="text-lg font-black text-pink-400 font-mono">{totalImpressions.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500">総価値</div>
                      <div className="text-lg font-black text-purple-400 font-mono">{formatCurrency(totalValue)}</div>
                      <div className="text-[8px] text-gray-500">GMV+広告換算{formatCurrency(adValue)}</div>
                    </div>
                    <div className="text-center border-l border-pink-500/30">
                      <div className="text-[10px] text-gray-500">広告効果ROAS</div>
                      <div className="text-xl font-black bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">{roas.toFixed(2)}倍</div>
                      <div className="text-[9px] text-emerald-400">業界平均の{vsIndustry.toFixed(1)}倍</div>
                      <div className="text-[7px] text-gray-500">÷固定費{formatCurrency(fixedFee)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* ライブ一覧 */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Video className="h-5 w-5 text-pink-400" />
                  {language === 'ja' ? '紐付けライブ一覧' : '关联直播列表'}
                </h3>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {linkedLivestreamDetailData.map((ls: any) => (
                    <div key={ls.id} className="bg-black/60 rounded-lg p-3 border border-pink-500/20 hover:border-pink-500/40 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-bold">{formatDate(ls.livestreamDate)}</span>
                          <Badge className="bg-purple-500/20 text-purple-400 text-xs">{ls.platform}</Badge>
                          <span className="text-gray-400">{ls.streamerName}</span>
                        </div>
                        {ls.duration && <span className="text-xs text-gray-500">{ls.duration}分</span>}
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">GMV:</span>
                          <span className="text-cyan-400 font-bold ml-2">{formatCurrency(ls.gmv)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">曝光:</span>
                          <span className="text-pink-400 font-bold ml-2">{(ls.impressions || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">クリック:</span>
                          <span className="text-amber-400 font-bold ml-2">{(ls.productClicks || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">販売数:</span>
                          <span className="text-green-400 font-bold ml-2">{(ls.salesCount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {ls.remarks && (
                        <div className="mt-2 text-xs text-gray-500 truncate">
                          {ls.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkedLivestreamDetailDialogOpen(false)}
              className="border-amber-500/50 bg-amber-950/50 text-gray-200 hover:bg-amber-900/40 hover:text-white"
            >
              {t.close}
            </Button>
            <Button
              onClick={() => {
                setLinkedLivestreamDetailDialogOpen(false);
                if (linkedLivestreamContractInfo) {
                  handleEditContract(linkedLivestreamContractInfo);
                }
              }}
              className="bg-gradient-to-r from-amber-600 to-pink-600 hover:from-amber-500 hover:to-pink-500 text-white"
            >
              {language === 'ja' ? '紐付けを編集' : '编辑关联'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
