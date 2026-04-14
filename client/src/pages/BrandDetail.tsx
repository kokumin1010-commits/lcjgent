import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { ArrowLeft, Plus, Trash2, Edit2, Package, Calendar, DollarSign, Percent, Users, Video, Clock, Eye, FileText, ChevronDown, ChevronUp, MessageSquare, Send, User, Sparkles, Image, Loader2, Upload, Globe, X, ZoomIn, Info, History, ChevronLeft, ChevronRight, Download, FolderOpen, Link, ExternalLink, TrendingUp, CheckCircle, FileDown, Save, BarChart3, Target, MousePointerClick, CreditCard } from "lucide-react";
import ProductCardTemplate from "@/components/ProductCard";
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
    livestreamPerformance: "ライブコマース",
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
    lcjReward: "LCJ報酬",
    lcjRewardAllTime: "LCJ報酬（全期間）",
    lcjRewardByProduct: "商品別内訳",
    // Ad Investment Records
    adInvestmentRecords: "広告投入実績",
    addInvestmentRecord: "実績を追加",
    investmentDate: "投入日",
    adType: "広告タイプ",
    liveAd: "ライブ広告",
    clipAd: "切り抜き広告",
    mixedAd: "混合",
    totalBudget: "総予算",
    actualGmv: "実績GMV",
    actualImpressions: "実績インプレッション",
    actualClicks: "実績クリック",
    actualConversions: "実績コンバージョン",
    actualRoas: "実績ROAS",
    predictedGmv: "予測GMV",
    predictionAccuracy: "予測精度",
    campaignName: "キャンペーン名",
    noInvestmentRecords: "広告投入実績はありません",
    addActualResults: "実績を入力",
    learnedStats: "学習データ",
    avgRoas: "平均ROAS",
    avgCpm: "平均CPM",
    avgCpc: "平均CPC",
    optimalAllocation: "最適配分",
    totalRecordsCount: "総レコード数",
    // Liver GMV Stats
    liverGmvStats: "ライバー別GMV実績",
    liverName: "ライバー名",
    totalGmvByLiver: "総GMV",
    livestreamCount: "配信回数",
    avgGmvPerLivestream: "平均GMV/配信",
    noLiverStats: "ライバー別の売上データはありません",
    gmvShare: "GMVシェア",
    // Ad Campaign Performance Section
    adCampaignPerformance: "広告キャンペーン実績",
    totalAdSpend: "総広告費",
    totalAdImpressions: "総インプレッション",
    avgAdRoas: "平均ROAS",
    campaignCount: "キャンペーン数",
    noAdCampaigns: "広告キャンペーンデータはありません",
    adObjective: "目的",
    adBudget: "予算",
    adSpendLabel: "広告費",
    adClicks: "クリック",
    adGmv: "GMV",
    adPeriod: "期間",
    viewDetails: "詳細を表示",
    mallProducts: "MALL商品",
    mallProductsDesc: "このブランドのLCJ MALL商品",
    noMallProducts: "MALL商品はまだ登録されていません",
    liverProductLink: "ライバー商品選択リンク",
    copyLink: "リンクをコピー",
    linkCopied: "リンクをコピーしました",
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
    livestreamPerformance: "直播带货",
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
    lcjReward: "LCJ报酬",
    lcjRewardAllTime: "LCJ报酬（全期间）",
    lcjRewardByProduct: "商品别明细",
    // Ad Investment Records
    adInvestmentRecords: "广告投入实绩",
    addInvestmentRecord: "添加实绩",
    investmentDate: "投入日期",
    adType: "广告类型",
    liveAd: "直播广告",
    clipAd: "切片广告",
    mixedAd: "混合",
    totalBudget: "总预算",
    actualGmv: "实际GMV",
    actualImpressions: "实际曝光",
    actualClicks: "实际点击",
    actualConversions: "实际转化",
    actualRoas: "实际ROAS",
    predictedGmv: "预测GMV",
    predictionAccuracy: "预测精度",
    campaignName: "活动名称",
    noInvestmentRecords: "没有广告投入实绩",
    addActualResults: "输入实绩",
    learnedStats: "学习数据",
    avgRoas: "平均ROAS",
    avgCpm: "平均CPM",
    avgCpc: "平均CPC",
    optimalAllocation: "最优分配",
    totalRecordsCount: "总记录数",
    // Liver GMV Stats
    liverGmvStats: "主播别GMV实绩",
    liverName: "主播名",
    totalGmvByLiver: "总GMV",
    livestreamCount: "直播次数",
    avgGmvPerLivestream: "平均GMV/直播",
    noLiverStats: "没有主播别的销售数据",
    gmvShare: "GMV占比",
    // Ad Campaign Performance Section
    adCampaignPerformance: "广告活动实绩",
    totalAdSpend: "总广告费",
    totalAdImpressions: "总曝光",
    avgAdRoas: "平均ROAS",
    campaignCount: "活动数",
    noAdCampaigns: "没有广告活动数据",
    adObjective: "目的",
    adBudget: "预算",
    adSpendLabel: "广告费",
    adClicks: "点击",
    adGmv: "GMV",
    adPeriod: "期间",
    viewDetails: "查看详情",
    mallProducts: "MALL商品",
    mallProductsDesc: "该品牌的LCJ MALL商品",
    noMallProducts: "尚未注册MALL商品",
    liverProductLink: "主播商品选择链接",
    copyLink: "复制链接",
    linkCopied: "链接已复制",
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

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `¥${Number(value).toLocaleString()}`;
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" });
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

// 商品に紐付いたライバーを表示するコンポーネント
function ProductLiversCell({ productId }: { productId: number }) {
  const { data: livers = [], isLoading } = trpc.brandProduct.getLivers.useQuery({ productId });
  
  if (isLoading) {
    return <span className="text-gray-500 text-xs">...</span>;
  }
  
  if (livers.length === 0) {
    return <span className="text-gray-500 text-xs">-</span>;
  }
  
  // ライバーごとに色を割り当て
  const colors = [
    'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  ];
  
  return (
    <div className="flex flex-wrap gap-1">
      {livers.map((liver, index) => (
        <span
          key={liver.id}
          className={`text-xs px-2 py-0.5 rounded-full border ${colors[index % colors.length]}`}
          title={liver.name}
        >
          {liver.name}
        </span>
      ))}
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
  const [newProduct, setNewProduct] = useState({ productName: "", listPrice: 0, specialPrice: 0, commissionRate: "", remarks: "", liverIds: [] as number[] });
  const [newLivestream, setNewLivestream] = useState({ livestreamDate: "", livestreamStartTime: "", streamerName: "", liverId: null as number | null, platform: "TikTok", duration: 0, gmv: 0, remarks: "", productClicks: 0, impressions: 0, salesCount: 0, cartAddCount: 0, productId: null as number | null, productCommission: "", adCost: 0, ctr: "", cvr: "", cpc: 0, acos: "", roas: "" });
  const [newContract, setNewContract] = useState({ serviceType: "単発ライブ契約" as "単発ライブ契約" | "期間契約" | "運用代行型（TSP）" | "パッケージ／複合契約", fixedFee: 0, status: "契約中" as "契約中" | "完了" | "保留" | "終了", startDate: "", endDate: "", memo: "", linkedLivestreamIds: [] as number[], plannedLivestreamCount: undefined as number | undefined, tspContractId: null as number | null, createNewTsp: false });
  // Delete states
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false);
  const [deleteLivestreamDialogOpen, setDeleteLivestreamDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState(false);
  const [deleteContractDialogOpen, setDeleteContractDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [livestreamToDelete, setLivestreamToDelete] = useState<any>(null);
  const [contractToDelete, setContractToDelete] = useState<any>(null);
  // Product Detail Popup states
  const [productDetailDialogOpen, setProductDetailDialogOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<any>(null);
  // 手卡（商品紹介カード）ダイアログ
  const [tekaDialogOpen, setTekaDialogOpen] = useState(false);
  const [tekaProduct, setTekaProduct] = useState<any>(null);
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
  
  // AI Ad Proposal states
  const [adProposalDialogOpen, setAdProposalDialogOpen] = useState(false);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [adProposalData, setAdProposalData] = useState<any>(null);
  const [proposalHistoryOpen, setProposalHistoryOpen] = useState(false);
  const [selectedHistoryProposal, setSelectedHistoryProposal] = useState<any>(null);

  // Ad Alert states
  const [adAlertDialogOpen, setAdAlertDialogOpen] = useState(false);
  const [isGeneratingAlert, setIsGeneratingAlert] = useState(false);
  const [adAlertData, setAdAlertData] = useState<any>(null);
  const [adAlertHistoryDialogOpen, setAdAlertHistoryDialogOpen] = useState(false);
  const [selectedHistoryAlert, setSelectedHistoryAlert] = useState<any>(null);

  // Ad Investment Records states
  const [adInvestmentDialogOpen, setAdInvestmentDialogOpen] = useState(false);
  const [addInvestmentDialogOpen, setAddInvestmentDialogOpen] = useState(false);
  const [editInvestmentDialogOpen, setEditInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [newInvestment, setNewInvestment] = useState({
    investmentDate: new Date().toISOString().split('T')[0],
    adType: 'mixed' as 'live' | 'clip' | 'mixed',
    totalBudget: 0,
    liveBudget: 0,
    clipBudget: 0,
    actualGmv: 0,
    actualImpressions: 0,
    actualClicks: 0,
    actualConversions: 0,
    predictedGmv: 0,
    predictedRoas: 0,
    campaignName: '',
    notes: '',
  });
  const [investmentPdfFile, setInvestmentPdfFile] = useState<File | null>(null);
  const [investmentAnalyzing, setInvestmentAnalyzing] = useState(false);
  const [investmentAnalysisResult, setInvestmentAnalysisResult] = useState<any>(null);
  const investmentFileInputRef = useRef<HTMLInputElement>(null);

  // Ad Campaign Analysis states
  const [adCampaignDialogOpen, setAdCampaignDialogOpen] = useState(false);
  const [adCampaignAnalyzing, setAdCampaignAnalyzing] = useState(false);
  const [adCampaignFile, setAdCampaignFile] = useState<File | null>(null);
  const [adCampaignAnalysisResult, setAdCampaignAnalysisResult] = useState<any>(null);
  const adCampaignFileInputRef = useRef<HTMLInputElement>(null);

  // File preview state
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewFileType, setPreviewFileType] = useState<string>('');
  const [previewFileAnalysis, setPreviewFileAnalysis] = useState<Record<string, any> | null>(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // AI Image Add states
  const [aiImageAddDialogOpen, setAiImageAddDialogOpen] = useState(false);
  const [aiImageFile, setAiImageFile] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [extractedProductData, setExtractedProductData] = useState<any>(null);
  const [aiSelectedLiverIds, setAiSelectedLiverIds] = useState<number[]>([]);
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
  const { data: proposalHistory = [], refetch: refetchProposalHistory } = trpc.brand.getAdProposalHistory.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: adInvestmentRecords = [], refetch: refetchInvestmentRecords } = trpc.brand.getAdInvestmentRecords.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: brandAdStats } = trpc.brand.getBrandAdPerformanceStats.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: allLivers = [] } = trpc.liverManagement.list.useQuery();
  const { data: liverSalesStats = [] } = trpc.brand.getLiverSalesStats.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: adCampaigns = [], refetch: refetchAdCampaigns } = trpc.brand.getAdCampaigns.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: adCampaignStats } = trpc.brand.getAdCampaignStats.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: reportFileHistory = [], refetch: refetchReportFileHistory } = trpc.brand.getReportFileHistory.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: campaignDetail, isLoading: campaignDetailLoading } = trpc.brand.getAdCampaignDetail.useQuery({ id: selectedCampaignId! }, { enabled: !!selectedCampaignId });
  const deleteReportFileMutation = trpc.brand.deleteReportFile.useMutation();

  // MALL商品データ取得
  const { data: mallProductsList = [], refetch: refetchMallProducts } = trpc.mall.getProductsByBrandId.useQuery({ brandId }, { enabled: brandId > 0 });
  const { data: tspContracts = [] } = trpc.tsp.listContracts.useQuery({ status: "all" });
  const createTspContractMutation = trpc.tsp.createContract.useMutation({
    onSuccess: () => { toast.success(language === 'ja' ? 'TSP契約を作成しました' : 'TSP合同已创建'); },
    onError: (err: any) => { toast.error(language === 'ja' ? 'TSP契約作成に失敗: ' + err.message : 'TSP合同创建失败: ' + err.message); },
  });
  const updateMallProductMutation = trpc.mall.updateProduct.useMutation({
    onSuccess: () => { refetchMallProducts(); toast.success(language === 'ja' ? '成果報酬を更新しました' : '成果报酬已更新'); },
    onError: () => { toast.error(language === 'ja' ? '更新に失敗しました' : '更新失败'); },
  });
  const [editingMallCommission, setEditingMallCommission] = useState<{ id: number; value: string } | null>(null);

  // 同じ日の配信は1回としてカウント（ユニークな日付の数）
  const uniqueLivestreamDays = useMemo(() => {
    const uniqueDates = new Set<string>();
    livestreams.forEach((ls) => {
      if (ls.livestreamDate) {
        const dateStr = new Date(ls.livestreamDate).toISOString().split('T')[0];
        uniqueDates.add(dateStr);
      }
    });
    return uniqueDates.size;
  }, [livestreams]);

  // 商品リンクを一括取得（商品パフォーマンステーブル用）
  const productIds = products.map((p) => p.id);
  const { data: allProductLinks = [] } = trpc.productLinks.listForProducts.useQuery(
    { productIds },
    { enabled: productIds.length > 0 }
  );

  // Mutations
  // Ad Proposal mutation
  const generateAdProposalMutation = trpc.brand.generateAdProposal.useMutation({
    onSuccess: (data) => {
      setAdProposalData(data);
      setIsGeneratingProposal(false);
      toast.success(language === 'ja' ? "広告提案を生成しました" : "已生成广告提案");
    },
    onError: (error) => {
      setIsGeneratingProposal(false);
      toast.error(language === 'ja' ? "提案の生成に失敗しました" : "提案生成失败");
      console.error("Ad proposal generation error:", error);
    },
  });

  const handleGenerateAdProposal = () => {
    setAdProposalDialogOpen(true);
    setIsGeneratingProposal(true);
    setAdProposalData(null);
    generateAdProposalMutation.mutate({ brandId, language: language as 'ja' | 'zh' });
  };

  // Ad Alert mutation
  const generateAdAlertMutation = trpc.brand.generateAdAlert.useMutation({
    onSuccess: (data) => {
      setAdAlertData(data);
      setIsGeneratingAlert(false);
      toast.success(language === 'ja' ? "広告アラートを生成しました" : "已生成广告警报");
    },
    onError: (error) => {
      setIsGeneratingAlert(false);
      toast.error(language === 'ja' ? "アラートの生成に失敗しました" : "警报生成失败");
      console.error("Ad alert generation error:", error);
    },
  });

  const handleGenerateAdAlert = () => {
    setAdAlertDialogOpen(true);
    setIsGeneratingAlert(true);
    setAdAlertData(null);
    generateAdAlertMutation.mutate({ brandId, language: language as 'ja' | 'zh' });
  };

  // Ad Alert PDF mutation
  const generateAdAlertPdfMutation = trpc.brand.generateAdAlertPdf.useMutation({
    onSuccess: (data) => {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(data.html);
        newWindow.document.close();
      }
      toast.success(language === 'ja' ? "PDFを生成しました" : "已生成PDF");
    },
    onError: () => {
      toast.error(language === 'ja' ? "PDFの生成に失敗しました" : "PDF生成失败");
    },
  });

  const handleDownloadAdAlertPdf = () => {
    if (!adAlertData || !brand) return;
    generateAdAlertPdfMutation.mutate({
      brandName: brand.name,
      brandNameJa: brand.nameJa || undefined,
      language: language as 'ja' | 'zh',
      currentMetrics: {
        totalGmv: adAlertData.currentMetrics.totalGmv,
        totalImpressions: adAlertData.currentMetrics.totalImpressions,
        avgConversionRate: adAlertData.currentMetrics.avgConversionRate,
        totalLivestreams: adAlertData.currentMetrics.totalLivestreams,
        avgGmvPerLive: adAlertData.currentMetrics.avgGmvPerLive,
        performanceScore: adAlertData.currentMetrics.performanceScore,
      },
      opportunityCost: {
        missedImpressions: adAlertData.opportunityCost.missedImpressions,
        missedGmv: adAlertData.opportunityCost.missedGmv,
      },
      scenarios: {
        small: {
          budget: adAlertData.scenarios.small.budget,
          projectedGmv: adAlertData.scenarios.small.projectedGmv,
          roas: adAlertData.scenarios.small.roas,
          allocation: adAlertData.scenarios.small.allocation ? {
            liveBudget: adAlertData.scenarios.small.allocation.liveBudget,
            clipBudget: adAlertData.scenarios.small.allocation.clipBudget,
          } : undefined,
        },
        medium: {
          budget: adAlertData.scenarios.medium.budget,
          projectedGmv: adAlertData.scenarios.medium.projectedGmv,
          roas: adAlertData.scenarios.medium.roas,
          allocation: adAlertData.scenarios.medium.allocation ? {
            liveBudget: adAlertData.scenarios.medium.allocation.liveBudget,
            clipBudget: adAlertData.scenarios.medium.allocation.clipBudget,
          } : undefined,
        },
        large: {
          budget: adAlertData.scenarios.large.budget,
          projectedGmv: adAlertData.scenarios.large.projectedGmv,
          roas: adAlertData.scenarios.large.roas,
          allocation: adAlertData.scenarios.large.allocation ? {
            liveBudget: adAlertData.scenarios.large.allocation.liveBudget,
            clipBudget: adAlertData.scenarios.large.allocation.clipBudget,
          } : undefined,
        },
      },
      allocationRecommendation: adAlertData.allocationRecommendation ? {
        liveRatio: adAlertData.allocationRecommendation.liveRatio,
        clipRatio: adAlertData.allocationRecommendation.clipRatio,
        reason: adAlertData.allocationRecommendation.reason,
      } : undefined,
      urgency: {
        level: adAlertData.urgency.level,
      },
      aiAnalysis: adAlertData.aiAnalysis,
    });
  };

  // Ad Alert History query
  const { data: adAlertHistory, refetch: refetchAdAlertHistory } = trpc.brand.getAdAlertHistory.useQuery(
    { brandId },
    { enabled: !!brandId }
  );

  // Save ad alert mutation
  const saveAdAlertMutation = trpc.brand.saveAdAlert.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ja' ? `アラートを保存しました (v${data.version})` : `已保存警报 (v${data.version})`);
      refetchAdAlertHistory();
    },
    onError: () => {
      toast.error(language === 'ja' ? "保存に失敗しました" : "保存失败");
    },
  });

  // Delete ad alert mutation
  const deleteAdAlertMutation = trpc.brand.deleteAdAlert.useMutation({
    onSuccess: () => {
      toast.success(language === 'ja' ? "アラートを削除しました" : "已删除警报");
      refetchAdAlertHistory();
      setSelectedHistoryAlert(null);
    },
    onError: () => {
      toast.error(language === 'ja' ? "削除に失敗しました" : "删除失败");
    },
  });

  const handleSaveAdAlert = () => {
    if (!adAlertData) return;
    saveAdAlertMutation.mutate({
      brandId,
      aiAnalysis: adAlertData.aiAnalysis,
      currentMetrics: {
        totalGmv: adAlertData.currentMetrics.totalGmv,
        totalImpressions: adAlertData.currentMetrics.totalImpressions,
        avgConversionRate: adAlertData.currentMetrics.avgConversionRate,
        totalLivestreams: adAlertData.currentMetrics.totalLivestreams,
        avgGmvPerLive: adAlertData.currentMetrics.avgGmvPerLive,
        performanceScore: adAlertData.currentMetrics.performanceScore,
      },
      opportunityCost: {
        missedImpressions: adAlertData.opportunityCost.missedImpressions,
        missedGmv: adAlertData.opportunityCost.missedGmv,
      },
      scenarios: {
        small: { budget: adAlertData.scenarios.small.budget, projectedGmv: adAlertData.scenarios.small.projectedGmv, roas: adAlertData.scenarios.small.roas },
        medium: { budget: adAlertData.scenarios.medium.budget, projectedGmv: adAlertData.scenarios.medium.projectedGmv, roas: adAlertData.scenarios.medium.roas },
        large: { budget: adAlertData.scenarios.large.budget, projectedGmv: adAlertData.scenarios.large.projectedGmv, roas: adAlertData.scenarios.large.roas },
      },
      allocationRecommendation: adAlertData.allocationRecommendation ? {
        liveRatio: adAlertData.allocationRecommendation.liveRatio,
        clipRatio: adAlertData.allocationRecommendation.clipRatio,
        reason: adAlertData.allocationRecommendation.reason,
      } : undefined,
      urgency: {
        level: adAlertData.urgency.level,
      },
    });
  };

  // Ad Investment Records mutations
  const createInvestmentMutation = trpc.brand.createAdInvestmentRecord.useMutation({
    onSuccess: () => {
      toast.success(language === 'ja' ? "広告投入実績を追加しました" : "已添加广告投入实绩");
      refetchInvestmentRecords();
      setAddInvestmentDialogOpen(false);
      setNewInvestment({
        investmentDate: new Date().toISOString().split('T')[0],
        adType: 'mixed',
        totalBudget: 0,
        liveBudget: 0,
        clipBudget: 0,
        actualGmv: 0,
        actualImpressions: 0,
        actualClicks: 0,
        actualConversions: 0,
        predictedGmv: 0,
        predictedRoas: 0,
        campaignName: '',
        notes: '',
      });
    },
    onError: () => {
      toast.error(language === 'ja' ? "追加に失敗しました" : "添加失败");
    },
  });

  const updateInvestmentMutation = trpc.brand.updateAdInvestmentRecord.useMutation({
    onSuccess: () => {
      toast.success(language === 'ja' ? "実績を更新しました" : "已更新实绩");
      refetchInvestmentRecords();
      setEditInvestmentDialogOpen(false);
      setEditingInvestment(null);
    },
    onError: () => {
      toast.error(language === 'ja' ? "更新に失敗しました" : "更新失败");
    },
  });

  const deleteInvestmentMutation = trpc.brand.deleteAdInvestmentRecord.useMutation({
    onSuccess: () => {
      toast.success(language === 'ja' ? "実績を削除しました" : "已删除实绩");
      refetchInvestmentRecords();
    },
    onError: () => {
      toast.error(language === 'ja' ? "削除に失敗しました" : "删除失败");
    },
  });

  // Ad Campaign mutations
  const analyzeAdReportMutation = trpc.brand.analyzeAdReport.useMutation();
  
  const createAdCampaignMutation = trpc.brand.createAdCampaign.useMutation({
    onSuccess: () => {
      refetchAdCampaigns();
    },
    onError: (error) => {
      console.error('createAdCampaign error:', error);
    },
  });
  
  const deleteAdCampaignMutation = trpc.brand.deleteAdCampaign.useMutation({
    onSuccess: () => {
      refetchAdCampaigns();
    },
  });

  const handleCreateInvestment = () => {
    createInvestmentMutation.mutate({
      brandId,
      investmentDate: newInvestment.investmentDate,
      adType: newInvestment.adType,
      totalBudget: newInvestment.totalBudget,
      liveBudget: newInvestment.liveBudget,
      clipBudget: newInvestment.clipBudget,
      actualGmv: newInvestment.actualGmv,
      actualImpressions: newInvestment.actualImpressions,
      actualClicks: newInvestment.actualClicks,
      actualConversions: newInvestment.actualConversions,
      predictedGmv: newInvestment.predictedGmv,
      predictedRoas: newInvestment.predictedRoas,
      campaignName: newInvestment.campaignName || undefined,
      notes: newInvestment.notes || undefined,
    });
  };

  const handleUpdateInvestment = () => {
    if (!editingInvestment) return;
    updateInvestmentMutation.mutate({
      id: editingInvestment.id,
      actualGmv: editingInvestment.actualGmv,
      actualImpressions: editingInvestment.actualImpressions,
      actualClicks: editingInvestment.actualClicks,
      actualConversions: editingInvestment.actualConversions,
      notes: editingInvestment.notes,
    });
  };

  // Save ad proposal mutation
  const saveAdProposalMutation = trpc.brand.saveAdProposal.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ja' ? `提案を保存しました (v${data.version})` : `已保存提案 (v${data.version})`);
      refetchProposalHistory();
    },
    onError: (error) => {
      toast.error(language === 'ja' ? "提案の保存に失敗しました" : "保存提案失败");
      console.error("Save proposal error:", error);
    },
  });

  // Delete ad proposal mutation
  const deleteAdProposalMutation = trpc.brand.deleteAdProposal.useMutation({
    onSuccess: () => {
      toast.success(language === 'ja' ? "提案を削除しました" : "已删除提案");
      refetchProposalHistory();
      setSelectedHistoryProposal(null);
    },
    onError: () => {
      toast.error(language === 'ja' ? "削除に失敗しました" : "删除失败");
    },
  });

  const handleSaveProposal = () => {
    if (!adProposalData) return;
    saveAdProposalMutation.mutate({
      brandId,
      proposalContent: adProposalData.proposal,
      metrics: {
        totalGmv: adProposalData.metrics?.totalGmv || 0,
        totalImpressions: adProposalData.metrics?.totalImpressions || 0,
        adValue: adProposalData.metrics?.adValue || 0,
        totalValue: adProposalData.metrics?.totalValue || 0,
        totalAdCost: adProposalData.metrics?.totalAdCost || 0,
        avgRoas: adProposalData.metrics?.avgRoas || 0,
        totalLivestreams: adProposalData.metrics?.totalLivestreams || 0,
        avgSalesPerLive: adProposalData.metrics?.avgSalesPerLive || 0,
        avgDuration: adProposalData.metrics?.avgDuration || 0,
        topProducts: adProposalData.metrics?.topProducts || [],
        activeContractsCount: adProposalData.metrics?.activeContractsCount || 0,
        productsCount: adProposalData.metrics?.productsCount || 0,
      },
    });
  };

  // PDF generation mutation
  const generatePdfMutation = trpc.brand.generateAdProposalPdf.useMutation({
    onSuccess: async (data) => {
      try {
        // Create a new window with the HTML content
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          
          // Wait for fonts to load then trigger print
          setTimeout(() => {
            printWindow.print();
          }, 1000);
          
          toast.success(language === 'ja' ? 'PDFを生成しました。印刷ダイアログからPDFとして保存してください。' : '已生成PDF。请从打印对话框保存为PDF。');
        } else {
          toast.error(language === 'ja' ? 'ポップアップがブロックされました' : '弹出窗口被阻止');
        }
      } catch (error) {
        toast.error(language === 'ja' ? 'PDF生成に失敗しました' : 'PDF生成失败');
      }
    },
    onError: () => {
      toast.error(language === 'ja' ? 'PDF生成に失敗しました' : 'PDF生成失败');
    },
  });

  // Handle PDF download for current proposal
  const handleDownloadPdf = () => {
    if (!adProposalData || !brand) return;
    
    generatePdfMutation.mutate({
      brandId,
      brandName: brand.name,
      brandNameJa: brand.nameJa || undefined,
      language: language as 'ja' | 'zh',
      proposalContent: adProposalData.proposal,
      metrics: {
        totalGmv: adProposalData.metrics?.totalGmv || 0,
        totalImpressions: adProposalData.metrics?.totalImpressions || 0,
        adValue: adProposalData.metrics?.adValue || 0,
        totalValue: adProposalData.metrics?.totalValue || 0,
        totalAdCost: adProposalData.metrics?.totalAdCost || 0,
        avgRoas: adProposalData.metrics?.avgRoas || 0,
        totalLivestreams: adProposalData.metrics?.totalLivestreams || 0,
        avgSalesPerLive: adProposalData.metrics?.avgSalesPerLive || 0,
        avgDuration: adProposalData.metrics?.avgDuration || 0,
        topProducts: adProposalData.metrics?.topProducts || [],
        activeContractsCount: adProposalData.metrics?.activeContractsCount || 0,
        productsCount: adProposalData.metrics?.productsCount || 0,
      },
      generatedAt: adProposalData.generatedAt || new Date().toISOString(),
    });
  };

  // Handle PDF download for history proposal
  const handleDownloadHistoryPdf = (proposal: any) => {
    if (!brand) return;
    
    generatePdfMutation.mutate({
      brandId,
      brandName: brand.name,
      brandNameJa: brand.nameJa || undefined,
      language: language as 'ja' | 'zh',
      proposalContent: proposal.proposalContent,
      metrics: {
        totalGmv: proposal.totalGmv || 0,
        totalImpressions: proposal.totalImpressions || 0,
        adValue: proposal.adValue || 0,
        totalValue: proposal.totalValue || 0,
        totalAdCost: proposal.totalAdCost || 0,
        avgRoas: Number(proposal.avgRoas) || 0,
        totalLivestreams: proposal.totalLivestreams || 0,
        avgSalesPerLive: proposal.avgSalesPerLive || 0,
        avgDuration: proposal.avgDuration || 0,
        topProducts: proposal.topProducts || [],
        activeContractsCount: proposal.activeContractsCount || 0,
        productsCount: proposal.productsCount || 0,
      },
      generatedAt: proposal.createdAt || new Date().toISOString(),
    });
  };

  // Markdown export function (legacy)
  const handleExportPdf = async (proposal: any) => {
    try {
      const isJa = language === 'ja';
      const content = `
# ${isJa ? 'TikTok広告提案' : 'TikTok广告提案'}: ${brand?.name || ''}

## ${isJa ? '生成日時' : '生成时间'}
${new Date(proposal.createdAt).toLocaleString(isJa ? 'ja-JP' : 'zh-CN')}

## ${isJa ? 'メトリクスサマリー' : '指标摘要'}
- ${isJa ? '総GMV' : '总GMV'}: ¥${(proposal.totalGmv || 0).toLocaleString()}
- ${isJa ? '総インプレッション' : '总印象数'}: ${(proposal.totalImpressions || 0).toLocaleString()}
- ${isJa ? '広告換算費用' : '广告换算费用'}: ¥${(proposal.adValue || 0).toLocaleString()}
- ${isJa ? '総価値' : '总价值'}: ¥${(proposal.totalValue || 0).toLocaleString()}
- ${isJa ? '契約金額' : '合同金额'}: ¥${(proposal.totalAdCost || 0).toLocaleString()}
- ${isJa ? '広告効果ROAS' : '广告效果ROAS'}: ${Number(proposal.avgRoas || 0).toFixed(2)}${isJa ? '倍' : '倍'}
- ${isJa ? '配信回数' : '直播次数'}: ${proposal.totalLivestreams || 0}${isJa ? '回' : '次'}

## ${isJa ? 'AI広告提案' : 'AI广告提案'}
${proposal.proposalContent}
      `.trim();
      
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-proposal-${brand?.name || 'brand'}-v${proposal.version}-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(isJa ? "提案をダウンロードしました" : "已下载提案");
    } catch (error) {
      toast.error(language === 'ja' ? "エクスポートに失敗しました" : "导出失败");
    }
  };

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
      setNewProduct({ productName: "", listPrice: 0, specialPrice: 0, commissionRate: "", remarks: "", liverIds: [] });
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
      setNewLivestream({ livestreamDate: "", livestreamStartTime: "", streamerName: "", liverId: null, platform: "TikTok", duration: 0, gmv: 0, remarks: "", productClicks: 0, impressions: 0, salesCount: 0, cartAddCount: 0, productId: null, productCommission: "", adCost: 0, ctr: "", cvr: "", cpc: 0, acos: "", roas: "" });
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
      setNewContract({ serviceType: "単発ライブ契約", fixedFee: 0, status: "契約中", startDate: "", endDate: "", memo: "", linkedLivestreamIds: [], plannedLivestreamCount: undefined });
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

  // 商品画像PDFダウンロード
  const handleDownloadProductImagesPdf = async () => {
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
            backgroundImage: 'url(https://files.manuscdn.com/user_upload_by_module/session_file/310519663045992616/LbRtSJoZUyhkjBzE.jpeg)',
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
                onClick={() => navigate("/master/brands")}
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
                    onValueChange={(value) => navigate(`/master/brands/${value}`)}
                  >
                    <SelectTrigger className="w-[180px] bg-black/60 border-red-900/50 text-white hover:border-red-500/50 transition-colors">
                      <SelectValue placeholder="ブランドを選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50 backdrop-blur-xl text-white">
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
                onClick={() => navigate(`/master/brands/${id}/edit`)}
                className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-500/30"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t.edit}
              </Button>
              <Button
                onClick={handleGenerateAdProposal}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {language === 'ja' ? '広告提案' : '广告提案'}
              </Button>
              <Button
                onClick={handleGenerateAdAlert}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/30"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {language === 'ja' ? '広告アラート' : '广告警报'}
              </Button>
              <Button
                onClick={() => window.location.href = `/master/brands/${brandId}/finance`}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {language === 'ja' ? 'ファイナンス管理' : '财务管理'}
              </Button>
              <Button
                onClick={() => setAdCampaignDialogOpen(true)}
                className="bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500 text-white shadow-lg shadow-green-500/30"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {language === 'ja' ? '広告実績・分析' : '广告实绩・分析'}
                {(adInvestmentRecords.length + adCampaigns.length) > 0 && (
                  <Badge className="ml-2 bg-green-500/30 text-green-300 border border-green-400/50 text-xs">
                    {adInvestmentRecords.length + adCampaigns.length}
                  </Badge>
                )}
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

          {/* LCJ報酬カード - GMV×商品別成果報酬率の合計 */}
          {(() => {
            // 商品ごとのGMVと成果報酬率からLCJ報酬を計算
            const productRewards = products.map(product => {
              const productGmv = (product as any).totalGmv || 0;
              const commissionRateStr = product.commissionRate || '';
              const commissionRate = parseFloat(commissionRateStr.replace(/[^0-9.]/g, '')) || 0;
              const reward = productGmv * (commissionRate / 100);
              return {
                productName: product.productName,
                gmv: productGmv,
                commissionRate,
                reward
              };
            }).filter(p => p.reward > 0);
            
            const totalLcjReward = productRewards.reduce((sum, p) => sum + p.reward, 0);
            
            // LCJ報酬が0の場合は表示しない
            if (totalLcjReward <= 0) return null;
            
            return (
              <div className="relative overflow-hidden rounded-xl p-6 mt-4 group transition-all duration-500 hover:scale-[1.01]" style={{
                background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(50,20,80,0.8) 50%, rgba(0,0,0,0.9) 100%)',
                border: '2px solid rgba(180, 100, 255, 0.6)',
                boxShadow: '0 0 40px rgba(180, 100, 255, 0.3), inset 0 0 40px rgba(180, 100, 255, 0.1)',
              }}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600/20 rounded-full blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-purple-500/5" />
                <div className="relative text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-4xl">💎</span>
                    <span className="text-purple-300 text-lg font-bold uppercase tracking-widest">{t.lcjRewardAllTime}</span>
                  </div>
                  <p 
                    className="text-6xl md:text-8xl font-black tracking-tight"
                    style={{ 
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#bb66ff',
                      textShadow: '0 0 20px rgba(180, 100, 255, 1), 0 0 40px rgba(180, 100, 255, 0.8), 0 0 60px rgba(180, 100, 255, 0.6), 0 0 80px rgba(180, 100, 255, 0.4)',
                    }}
                  >
                    {formatCurrency(totalLcjReward)}
                  </p>
                  {/* 商品別内訳 */}
                  {productRewards.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20">
                      <div className="text-xs text-purple-300/70 mb-2">{t.lcjRewardByProduct}</div>
                      <div className="flex flex-wrap justify-center gap-3 text-sm">
                        {productRewards.slice(0, 5).map((p, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-black/40 rounded-lg px-3 py-1.5">
                            <span className="text-gray-400 truncate max-w-[100px]" title={p.productName}>{p.productName}</span>
                            <span className="text-purple-400 font-mono font-bold">{formatCurrency(p.reward)}</span>
                            <span className="text-gray-500 text-xs">({p.commissionRate}%)</span>
                          </div>
                        ))}
                        {productRewards.length > 5 && (
                          <div className="text-gray-500 text-xs self-center">
                            +{productRewards.length - 5}{language === 'ja' ? '商品' : '个商品'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          
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
              {uniqueLivestreamDays}<span className="text-sm text-pink-300 ml-1">{t.times}</span>
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
                  <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span>{t.startDate}:</span>
                      <span className="text-white font-mono">{formatDate(contract.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{t.endDate}:</span>
                      <span className="text-white font-mono">{formatDate(contract.endDate)}</span>
                    </div>
                    {contract.plannedLivestreamCount && (
                      <div className="flex items-center gap-2">
                        <span>{language === 'ja' ? '予定配信:' : '计划直播:'}</span>
                        <span className="text-cyan-400 font-mono">{contract.plannedLivestreamCount}{language === 'ja' ? '回' : '次'}</span>
                      </div>
                    )}
                    {contract.commissionRate && (
                      <div className="flex items-center gap-2">
                        <span>{t.commissionRate}:</span>
                        <span className="text-purple-400 font-mono">{contract.commissionRate.replace(/[^0-9.]/g, '')}%</span>
                      </div>
                    )}
                    {(contract as any).tspContractId && (
                      <a 
                        href="/master/finance" 
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>TSP契約 #{(contract as any).tspContractId}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
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
                    livestreams.map((ls) => (
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
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? 'ライバー' : '主播'}</th>
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
                      <td colSpan={8} className="text-center text-gray-500 py-8">{t.noData}</td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr 
                        key={product.id} 
                        className="border-b border-red-900/20 hover:bg-red-900/10 transition-colors group cursor-pointer"
                        onClick={(e) => {
                          // アクションボタンのクリックは除外
                          if ((e.target as HTMLElement).closest('button')) return;
                          setSelectedProductForDetail(product);
                          setProductDetailDialogOpen(true);
                        }}
                      >
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
                              <div 
                                className="w-12 h-12 bg-red-900/20 rounded-lg border border-red-900/30 flex items-center justify-center cursor-pointer hover:border-pink-400 hover:bg-gray-700 transition-all"
                                onClick={() => {
                                  setSelectedProductForDetail(product);
                                  setProductDetailDialogOpen(true);
                                }}
                              >
                                <Package className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 max-w-[200px]">
                          <div className="flex flex-col gap-1">
                            <span 
                              className="text-white font-medium block truncate cursor-help" 
                              title={product.productName}
                            >
                              {product.productName}
                            </span>
                            {/* 商品リンクを表示 */}
                            {(() => {
                              const links = allProductLinks.filter((link: any) => link.productId === product.id);
                              if (links.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {links.map((link: any) => (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 hover:text-cyan-100 rounded-full border border-cyan-700/50 transition-all"
                                      title={link.url}
                                    >
                                      <Link className="w-3 h-3" />
                                      <span className="truncate max-w-[80px]">{link.title}</span>
                                      <ExternalLink className="w-3 h-3 opacity-60" />
                                    </a>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <ProductLiversCell productId={product.id} />
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
                            {/* 手卤（商品紹介カード）ボタン */}
                            <button
                              onClick={() => {
                                setTekaProduct(product);
                                setTekaDialogOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-orange-400 transition-all"
                              title={language === 'ja' ? '手卤を見る' : '查看手卡'}
                            >
                              <CreditCard className="h-4 w-4" />
                            </button>
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

        {/* MALL商品セクション */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-emerald-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(0,255,128,0.1)] mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full" />
              🛍️ {t.mallProducts}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/liver/products/${brandId}`;
                  navigator.clipboard.writeText(url);
                  toast.success(t.linkCopied);
                }}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20"
              >
                <Link className="h-4 w-4 mr-1" />
                {t.copyLink}
              </Button>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-4">{t.mallProductsDesc}</p>
          {mallProductsList.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t.noMallProducts}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-emerald-900/30">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-16">{language === 'ja' ? '画像' : '图片'}</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? '商品名' : '商品名'}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? '価格' : '价格'}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? 'ポイント価格' : '积分价格'}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? '成果報酬' : '成果报酬'}</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? '在庫' : '库存'}</th>
                    <th className="text-center text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{language === 'ja' ? 'ステータス' : '状态'}</th>
                  </tr>
                </thead>
                <tbody>
                  {mallProductsList.map((mp: any) => (
                    <tr key={mp.id} className="border-b border-emerald-900/20 hover:bg-emerald-900/10 transition-colors">
                      <td className="py-3 px-2">
                        {mp.imageUrl ? (
                          <img src={mp.imageUrl} alt={mp.name} className="w-12 h-12 object-cover rounded-lg" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-600" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-white font-medium text-sm">{mp.name}</span>
                        {mp.categoryName && (
                          <span className="block text-xs text-gray-500 mt-0.5">{mp.categoryName}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-emerald-400 font-mono text-sm">¥{mp.price?.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {mp.pointPrice ? (
                          <span className="text-yellow-400 font-mono text-sm">{mp.pointPrice?.toLocaleString()}pt</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {editingMallCommission?.id === mp.id ? (
                          <input
                            type="text"
                            autoFocus
                            className="w-20 bg-gray-900 border border-orange-500/50 rounded px-2 py-1 text-orange-400 font-mono text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={editingMallCommission.value}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9.]/g, '');
                              setEditingMallCommission({ id: mp.id, value: v });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = editingMallCommission.value.trim();
                                updateMallProductMutation.mutate({ id: mp.id, commissionRate: val || null });
                                setEditingMallCommission(null);
                              }
                              if (e.key === 'Escape') setEditingMallCommission(null);
                            }}
                            onBlur={() => {
                              const val = editingMallCommission.value.trim();
                              updateMallProductMutation.mutate({ id: mp.id, commissionRate: val || null });
                              setEditingMallCommission(null);
                            }}
                            placeholder="%"
                          />
                        ) : (
                          <span
                            className={`font-mono text-sm cursor-pointer hover:underline ${mp.commissionRate ? 'text-orange-400' : 'text-gray-600 hover:text-orange-400/60'}`}
                            onClick={() => setEditingMallCommission({ id: mp.id, value: mp.commissionRate?.toString() || '' })}
                            title={language === 'ja' ? 'クリックして編集' : '点击编辑'}
                          >
                            {mp.commissionRate ? `${mp.commissionRate}%` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-mono text-sm ${mp.stock > 0 ? 'text-white' : 'text-red-400'}`}>{mp.stock}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge className={`text-xs ${
                          mp.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          mp.status === 'draft' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                          mp.status === 'sold_out' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {mp.status === 'active' ? (language === 'ja' ? '販売中' : '在售') :
                           mp.status === 'draft' ? (language === 'ja' ? '下書き' : '草稿') :
                           mp.status === 'sold_out' ? (language === 'ja' ? '売り切れ' : '已售罄') :
                           (language === 'ja' ? 'アーカイブ' : '已归档')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* ライバー向け商品選択リンク */}
          <div className="mt-4 p-3 bg-emerald-900/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-emerald-400" />
              <span className="text-gray-400">{t.liverProductLink}:</span>
              <code className="text-emerald-300 bg-black/40 px-2 py-0.5 rounded text-xs">
                {window.location.origin}/liver/products/{brandId}
              </code>
            </div>
          </div>
        </div>

        {/* Liver GMV Stats Section */}
        <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-red-900/30 p-4 md:p-6 shadow-[0_0_30px_rgba(255,0,0,0.1)] mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
            {t.liverGmvStats}
          </h2>
          
          {liverSalesStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t.noLiverStats}</p>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 rounded-lg p-4 border border-purple-500/20">
                  <p className="text-gray-400 text-sm">総GMV</p>
                  <p className="text-2xl font-bold text-purple-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatCurrency(liverSalesStats.reduce((sum, s) => sum + (s.totalGmv || 0), 0))}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-cyan-900/40 to-cyan-800/20 rounded-lg p-4 border border-cyan-500/20">
                  <p className="text-gray-400 text-sm">ライバー数</p>
                  <p className="text-2xl font-bold text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {liverSalesStats.length}名
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 rounded-lg p-4 border border-green-500/20">
                  <p className="text-gray-400 text-sm">総配信回数</p>
                  <p className="text-2xl font-bold text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {liverSalesStats.reduce((sum, s) => sum + (s.livestreamCount || 0), 0)}回
                  </p>
                </div>
                <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 rounded-lg p-4 border border-yellow-500/20">
                  <p className="text-gray-400 text-sm">平均GMV/配信</p>
                  <p className="text-2xl font-bold text-yellow-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatCurrency(
                      liverSalesStats.reduce((sum, s) => sum + (s.totalGmv || 0), 0) /
                      Math.max(liverSalesStats.reduce((sum, s) => sum + (s.livestreamCount || 0), 0), 1)
                    )}
                  </p>
                </div>
              </div>
              
              {/* Liver Rankings Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-red-900/30">
                      <th className="py-3 px-2 text-left text-gray-400 font-medium">#</th>
                      <th className="py-3 px-2 text-left text-gray-400 font-medium">{t.liverName}</th>
                      <th className="py-3 px-2 text-right text-gray-400 font-medium">{t.totalGmvByLiver}</th>
                      <th className="py-3 px-2 text-right text-gray-400 font-medium">{t.livestreamCount}</th>
                      <th className="py-3 px-2 text-right text-gray-400 font-medium">{t.avgGmvPerLivestream}</th>
                      <th className="py-3 px-2 text-right text-gray-400 font-medium">{t.gmvShare}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...liverSalesStats]
                      .sort((a, b) => (b.totalGmv || 0) - (a.totalGmv || 0))
                      .map((stat, index) => {
                        const totalGmv = liverSalesStats.reduce((sum, s) => sum + (s.totalGmv || 0), 0);
                        const share = totalGmv > 0 ? ((stat.totalGmv || 0) / totalGmv) * 100 : 0;
                        const avgGmv = stat.livestreamCount > 0 ? (stat.totalGmv || 0) / stat.livestreamCount : 0;
                        
                        return (
                          <tr key={stat.id} className="border-b border-red-900/20 hover:bg-red-900/10 transition-colors">
                            <td className="py-3 px-2">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                                index === 0 ? 'bg-yellow-500 text-black' :
                                index === 1 ? 'bg-gray-400 text-black' :
                                index === 2 ? 'bg-amber-700 text-white' :
                                'bg-gray-800 text-gray-400'
                              }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-3">
                                {stat.avatarUrl ? (
                                  <img src={stat.avatarUrl} alt={stat.name} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                                    {stat.name?.charAt(0) || '?'}
                                  </div>
                                )}
                                <span className="text-white font-medium">{stat.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right text-purple-400 font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              {formatCurrency(stat.totalGmv || 0)}
                            </td>
                            <td className="py-3 px-2 text-right text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              {stat.livestreamCount || 0}回
                            </td>
                            <td className="py-3 px-2 text-right text-yellow-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              {formatCurrency(avgGmv)}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                    style={{ width: `${Math.min(share, 100)}%` }}
                                  />
                                </div>
                                <span className="text-gray-400 text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                                  {share.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Ad Campaign Performance Section - レポートベースのキャンペーン実績 */}
        {adCampaigns.length > 0 && (() => {
          // サマリー計算
          const totalAdSpend = adCampaignStats?.totalSpend || 0;
          const totalAdImpressions = adCampaignStats?.totalImpressions || 0;
          const totalAdGmv = adCampaignStats?.totalGmv || 0;
          const avgRoas = totalAdSpend > 0 ? totalAdGmv / totalAdSpend : 0;
          const campaignCountVal = adCampaignStats?.campaignCount || adCampaigns.length;

          return (
            <div className="space-y-4 mb-6">
              {/* Ad Performance Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
                  background: 'linear-gradient(135deg, rgba(0,40,30,0.9) 0%, rgba(0,60,50,0.7) 100%)',
                  border: '1px solid rgba(0, 255, 180, 0.5)',
                  boxShadow: '0 0 25px rgba(0, 255, 180, 0.3), inset 0 0 20px rgba(0, 255, 180, 0.1)',
                }}>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-emerald-300" />
                    <span className="text-xs text-emerald-200 uppercase tracking-wider font-bold">{t.totalAdSpend}</span>
                  </div>
                  <p className="text-2xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00ffb4', textShadow: '0 0 10px rgba(0, 255, 180, 0.8)' }}>
                    {formatCurrency(totalAdSpend)}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
                  background: 'linear-gradient(135deg, rgba(0,20,50,0.9) 0%, rgba(0,40,80,0.7) 100%)',
                  border: '1px solid rgba(100, 180, 255, 0.5)',
                  boxShadow: '0 0 25px rgba(100, 180, 255, 0.3), inset 0 0 20px rgba(100, 180, 255, 0.1)',
                }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-5 w-5 text-blue-300" />
                    <span className="text-xs text-blue-200 uppercase tracking-wider font-bold">{t.totalAdImpressions}</span>
                  </div>
                  <p className="text-2xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64b4ff', textShadow: '0 0 10px rgba(100, 180, 255, 0.8)' }}>
                    {totalAdImpressions.toLocaleString()}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
                  background: 'linear-gradient(135deg, rgba(50,30,0,0.9) 0%, rgba(80,50,0,0.7) 100%)',
                  border: '1px solid rgba(255, 200, 50, 0.5)',
                  boxShadow: '0 0 25px rgba(255, 200, 50, 0.3), inset 0 0 20px rgba(255, 200, 50, 0.1)',
                }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-amber-300" />
                    <span className="text-xs text-amber-200 uppercase tracking-wider font-bold">{t.avgAdRoas}</span>
                  </div>
                  <p className="text-2xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ffcc33', textShadow: '0 0 10px rgba(255, 200, 50, 0.8)' }}>
                    {avgRoas.toFixed(2)}<span className="text-sm text-amber-300 ml-1">{language === 'ja' ? '倍' : '倍'}</span>
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105" style={{
                  background: 'linear-gradient(135deg, rgba(40,0,50,0.9) 0%, rgba(60,0,80,0.7) 100%)',
                  border: '1px solid rgba(200, 100, 255, 0.5)',
                  boxShadow: '0 0 25px rgba(200, 100, 255, 0.3), inset 0 0 20px rgba(200, 100, 255, 0.1)',
                }}>
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-5 w-5 text-purple-300" />
                    <span className="text-xs text-purple-200 uppercase tracking-wider font-bold">{t.campaignCount}</span>
                  </div>
                  <p className="text-2xl font-black" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#c864ff', textShadow: '0 0 10px rgba(200, 100, 255, 0.8)' }}>
                    {campaignCountVal}<span className="text-sm text-purple-300 ml-1">{t.cases}</span>
                  </p>
                </div>
              </div>

              {/* Ad Campaign Table */}
              <div className="bg-black/85 backdrop-blur-xl rounded-xl border border-cyan-900/40 p-4 md:p-6 shadow-[0_0_30px_rgba(0,200,255,0.1)]">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-teal-500 rounded-full" />
                  {t.adCampaignPerformance}
                  <Badge className="ml-1 bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs">
                    {language === 'ja' ? '📄 レポート' : '📄 报告'}
                  </Badge>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-cyan-900/30">
                        <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.campaignName}</th>
                        <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.platform}</th>
                        <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.adObjective}</th>
                        <th className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.adPeriod}</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.adBudget}</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.impressions}</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.adClicks}</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.adGmv}</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2">{t.roas}</th>
                        <th className="text-right text-xs text-gray-500 uppercase tracking-wider py-3 px-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {adCampaigns.slice(0, 10).map((campaign) => {
                        const objectiveLabels: Record<string, Record<string, string>> = {
                          ja: { impression: 'インプレッション', click: 'クリック', conversion: 'コンバージョン', engagement: 'エンゲージメント', other: 'その他' },
                          zh: { impression: '曝光', click: '点击', conversion: '转化', engagement: '互动', other: '其他' },
                        };
                        return (
                          <tr 
                            key={campaign.id} 
                            className="border-b border-cyan-900/20 hover:bg-cyan-900/10 transition-colors cursor-pointer group"
                            onClick={() => setSelectedCampaignId(campaign.id)}
                          >
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-sm">{campaign.campaignName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <Badge className={`text-xs ${campaign.platform === 'tiktok' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                {campaign.platform.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-gray-400 text-sm">
                                {objectiveLabels[language]?.[campaign.objective] || campaign.objective}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-gray-400 text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                              {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) : '?'}
                              〜
                              {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) : '?'}
                            </td>
                            <td className="py-3 px-2 text-right text-emerald-400 font-mono text-sm">
                              {formatCurrency(campaign.budget)}
                            </td>
                            <td className="py-3 px-2 text-right text-blue-400 font-mono text-sm">
                              {(campaign as any).impressions?.toLocaleString() || '-'}
                            </td>
                            <td className="py-3 px-2 text-right text-orange-400 font-mono text-sm">
                              {(campaign as any).clicks?.toLocaleString() || '-'}
                            </td>
                            <td className="py-3 px-2 text-right text-cyan-400 font-mono text-sm font-bold">
                              {(campaign as any).gmv ? formatCurrency((campaign as any).gmv) : '-'}
                            </td>
                            <td className="py-3 px-2 text-right">
                              {(campaign as any).roas ? (
                                <span className={`font-mono text-sm font-bold ${
                                  Number((campaign as any).roas) >= 3 ? 'text-green-400' :
                                  Number((campaign as any).roas) >= 1 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  {Number((campaign as any).roas).toFixed(2)}x
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan-400 transition-all"
                                title={t.viewDetails}
                                onClick={(e) => { e.stopPropagation(); setSelectedCampaignId(campaign.id); }}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {adCampaigns.length > 10 && (
                  <div className="text-center mt-3">
                    <span className="text-gray-500 text-sm">
                      {language === 'ja' ? `他 ${adCampaigns.length - 10} 件のキャンペーン` : `其他 ${adCampaigns.length - 10} 个活动`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
                  <Select
                    value={editingLivestream.liverId ? String(editingLivestream.liverId) : "manual"}
                    onValueChange={(value) => {
                      if (value === "manual") {
                        setEditingLivestream({ ...editingLivestream, liverId: null });
                      } else {
                        const selectedLiver = allLivers.find(l => l.id === Number(value));
                        setEditingLivestream({
                          ...editingLivestream,
                          liverId: Number(value),
                          streamerName: selectedLiver?.tiktokAccount || selectedLiver?.name || editingLivestream.streamerName,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                      <SelectValue placeholder={language === 'ja' ? 'ライバーを選択' : '选择主播'} />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-red-900/50 text-white">
                      <SelectItem value="manual">
                        <span className="text-gray-400">{language === 'ja' ? '手入力（ライバー未選択）' : '手动输入'}</span>
                      </SelectItem>
                      {allLivers.filter(l => l.isActive).map((liver) => (
                        <SelectItem key={liver.id} value={String(liver.id)} className="text-white focus:text-white">
                          <span className="flex items-center gap-2">
                            {liver.avatarUrl ? (
                              <img src={liver.avatarUrl} alt={liver.name} className="w-5 h-5 rounded-full object-cover inline-block" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 inline-flex items-center justify-center text-white text-xs font-bold">
                                {liver.name?.charAt(0) || '?'}
                              </span>
                            )}
                            <span className="text-white">{liver.name}{liver.tiktokAccount ? ` (${liver.tiktokAccount})` : ''}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!editingLivestream.liverId && (
                    <Input
                      value={editingLivestream.streamerName || ""}
                      onChange={(e) => setEditingLivestream({ ...editingLivestream, streamerName: e.target.value })}
                      placeholder={language === 'ja' ? 'アカウント名を入力' : '输入账号名'}
                      className="bg-black/60 border-red-900/50 text-white mt-2"
                    />
                  )}
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
                    <SelectContent className="bg-black/95 border-red-900/50 text-white">
                      <SelectItem value="TikTok" className="text-white focus:text-white">TikTok</SelectItem>
                      <SelectItem value="Instagram" className="text-white focus:text-white">Instagram</SelectItem>
                      <SelectItem value="YouTube" className="text-white focus:text-white">YouTube</SelectItem>
                      <SelectItem value="その他" className="text-white focus:text-white">その他</SelectItem>
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
                  // liverIdを送信（nullの場合も送信して紐付け解除を可能に）
                  if (editingLivestream.liverId !== undefined) updateData.liverId = editingLivestream.liverId;
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
              <div>
                <Label className="text-gray-400">{language === 'ja' ? '予定配信回数' : '计划直播次数'}</Label>
                <Input
                  type="number"
                  value={editingContract.plannedLivestreamCount || ""}
                  onChange={(e) => setEditingContract({ ...editingContract, plannedLivestreamCount: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder={language === 'ja' ? '例: 6' : '例: 6'}
                  className="bg-black/60 border-red-900/50 text-white mt-1"
                  min={1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ja' ? '契約期間中に予定している配信回数を入力してください' : '请输入合同期内计划的直播次数'}
                </p>
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
                      plannedLivestreamCount: editingContract.plannedLivestreamCount ? Number(editingContract.plannedLivestreamCount) : null,
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
            {/* ライバー選択 */}
            <div>
              <Label className="text-gray-400">{language === 'ja' ? '担当ライバー' : '负责主播'}</Label>
              <div className="mt-2 max-h-40 overflow-y-auto bg-black/40 border border-red-900/30 rounded-md p-2">
                {allLivers.length === 0 ? (
                  <p className="text-gray-500 text-sm">{language === 'ja' ? 'ライバーが登録されていません' : '没有注册的主播'}</p>
                ) : (
                  <div className="space-y-1">
                    {allLivers.map((liver) => (
                      <label key={liver.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={newProduct.liverIds.includes(liver.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewProduct({ ...newProduct, liverIds: [...newProduct.liverIds, liver.id] });
                            } else {
                              setNewProduct({ ...newProduct, liverIds: newProduct.liverIds.filter(id => id !== liver.id) });
                            }
                          }}
                          className="rounded border-gray-600 bg-black/60 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="text-sm text-gray-200">{liver.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {newProduct.liverIds.length > 0 && (
                <p className="text-xs text-cyan-400 mt-1">
                  {newProduct.liverIds.length}{language === 'ja' ? '名選択中' : '人已选择'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAddProductDialogOpen(false); setNewProduct({ productName: "", listPrice: 0, specialPrice: 0, commissionRate: "", remarks: "", liverIds: [] }); }}
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
                    liverIds: newProduct.liverIds,
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
                <Select
                  value={newLivestream.liverId ? String(newLivestream.liverId) : ""}
                  onValueChange={(value) => {
                    const selectedLiver = allLivers.find(l => l.id === Number(value));
                    setNewLivestream({
                      ...newLivestream,
                      liverId: Number(value),
                      streamerName: selectedLiver?.tiktokAccount || selectedLiver?.name || '',
                    });
                  }}
                >
                  <SelectTrigger className="bg-black/60 border-red-900/50 text-white mt-1">
                    <SelectValue placeholder={language === 'ja' ? 'ライバーを選択' : '选择主播'} />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-red-900/50 text-white">
                    {allLivers.filter(l => l.isActive).map((liver) => (
                      <SelectItem key={liver.id} value={String(liver.id)} className="text-white focus:text-white">
                        <span className="flex items-center gap-2">
                          {liver.avatarUrl ? (
                            <img src={liver.avatarUrl} alt={liver.name} className="w-5 h-5 rounded-full object-cover inline-block" />
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 inline-flex items-center justify-center text-white text-xs font-bold">
                              {liver.name?.charAt(0) || '?'}
                            </span>
                          )}
                          <span className="text-white">{liver.name}{liver.tiktokAccount ? ` (${liver.tiktokAccount})` : ''}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <SelectContent className="bg-black/95 border-red-900/50 text-white">
                    <SelectItem value="TikTok" className="text-white focus:text-white">TikTok</SelectItem>
                    <SelectItem value="Instagram" className="text-white focus:text-white">Instagram</SelectItem>
                    <SelectItem value="YouTube" className="text-white focus:text-white">YouTube</SelectItem>
                    <SelectItem value="その他" className="text-white focus:text-white">{language === 'ja' ? 'その他' : '其他'}</SelectItem>
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
              onClick={() => { setAddLivestreamDialogOpen(false); setNewLivestream({ livestreamDate: "", livestreamStartTime: "", streamerName: "", liverId: null, platform: "TikTok", duration: 0, gmv: 0, remarks: "", productClicks: 0, impressions: 0, salesCount: 0, cartAddCount: 0, productId: null, productCommission: "", adCost: 0, ctr: "", cvr: "", cpc: 0, acos: "", roas: "" }); }}
              className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (newLivestream.livestreamDate && (newLivestream.liverId || newLivestream.streamerName.trim())) {
                  createLivestreamMutation.mutate({
                    brandId,
                    livestreamDate: newLivestream.livestreamDate,
                    streamerName: newLivestream.streamerName || undefined,
                    liverId: newLivestream.liverId || undefined,
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
              disabled={!newLivestream.livestreamDate || !(newLivestream.liverId || newLivestream.streamerName.trim())}
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

      {/* Delete Livestream Confirmation Dialog - 二重確認+パスワード */}
      <AlertDialog open={deleteLivestreamDialogOpen} onOpenChange={(open) => { setDeleteLivestreamDialogOpen(open); if (!open) { setDeletePassword(''); setDeletePasswordError(false); } }}>
        <AlertDialogContent className="bg-black/95 border-red-900/50 text-white backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {language === 'ja' ? '⚠️ 直播を削除' : '⚠️ 删除直播'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {language === 'ja' 
                ? `${formatDate(livestreamToDelete?.livestreamDate)}の直播（${livestreamToDelete?.streamerName}）を削除しますか？この操作は取り消せません。`
                : `确定要删除${formatDate(livestreamToDelete?.livestreamDate)}的直播（${livestreamToDelete?.streamerName}）吗？此操作无法撤消。`
              }
            </AlertDialogDescription>
            <div className="mt-3">
              <label className="text-sm text-gray-300 mb-1 block">{language === 'ja' ? '削除パスワードを入力してください' : '请输入删除密码'}</label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(false); }}
                placeholder={language === 'ja' ? 'パスワード' : '密码'}
                className="bg-gray-800 border-gray-600 text-white"
              />
              {deletePasswordError && <p className="text-red-400 text-xs mt-1">{language === 'ja' ? 'パスワードが間違っています' : '密码错误'}</p>}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-red-500/50 bg-red-950/50 text-gray-200 hover:bg-red-900/40 hover:text-white hover:border-red-400/70">
              {t.cancel}
            </AlertDialogCancel>
            <button
              onClick={() => {
                if (deletePassword !== 'lcj') {
                  setDeletePasswordError(true);
                  return;
                }
                if (livestreamToDelete) {
                  deleteLivestreamMutation.mutate({ id: livestreamToDelete.id });
                  setDeleteLivestreamDialogOpen(false);
                  setDeletePassword('');
                  setDeletePasswordError(false);
                }
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-red-600 hover:bg-red-500 text-white"
            >
              {language === 'ja' ? '削除' : '删除'}
            </button>
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
            <div>
              <Label className="text-gray-400">{language === 'ja' ? '予定配信回数' : '计划直播次数'}</Label>
              <Input
                type="number"
                value={newContract.plannedLivestreamCount || ""}
                onChange={(e) => setNewContract({ ...newContract, plannedLivestreamCount: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder={language === 'ja' ? '例: 6' : '例: 6'}
                className="bg-black/60 border-red-900/50 text-white mt-1"
                min={1}
              />
              <p className="text-xs text-gray-500 mt-1">
                {language === 'ja' ? '契約期間中に予定している配信回数を入力してください' : '请输入合同期内计划的直播次数'}
              </p>
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

            {/* TSP契約連携セクション */}
            {(newContract.serviceType === '運用代行型（TSP）' || newContract.serviceType === '期間契約') && (
              <div className="border-t border-red-900/30 pt-4">
                <Label className="text-gray-400 flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  {language === 'zh' ? 'TSP合同关联' : 'TSP契約連携'}
                </Label>
                <div className="space-y-2">
                  <Select
                    value={newContract.tspContractId ? String(newContract.tspContractId) : "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        setNewContract({ ...newContract, tspContractId: null, createNewTsp: false });
                      } else if (value === "new") {
                        setNewContract({ ...newContract, tspContractId: null, createNewTsp: true });
                      } else {
                        setNewContract({ ...newContract, tspContractId: parseInt(value), createNewTsp: false });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-black/60 border-red-900/50 text-white">
                      <SelectValue placeholder={language === 'ja' ? 'TSP契約を選択...' : '选择TSP合同...'} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-red-900/50">
                      <SelectItem value="none" className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">
                        {language === 'ja' ? '連携なし' : '不关联'}
                      </SelectItem>
                      <SelectItem value="new" className="text-amber-400 hover:bg-red-900/30 focus:bg-red-900/30 focus:text-amber-400">
                        {language === 'ja' ? '➕ 新規TSP契約も同時作成' : '➕ 同时创建TSP合同'}
                      </SelectItem>
                      {tspContracts.filter((tc: any) => tc.brandId === brandId || !tc.brandId).map((tc: any) => (
                        <SelectItem key={tc.id} value={String(tc.id)} className="text-white hover:bg-red-900/30 focus:bg-red-900/30 focus:text-white">
                          #{tc.id} {tc.shopName} - ¥{(tc.monthlyAmount || 0).toLocaleString()}/月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newContract.createNewTsp && (
                    <p className="text-xs text-amber-400">
                      {language === 'ja' ? '※ 契約保存時にファイナンス管理のTSP契約も自動作成されます' : '※ 保存时将自动创建财务管理的TSP合同'}
                    </p>
                  )}
                  {newContract.tspContractId && (
                    <a 
                      href="/master/finance" 
                      target="_blank"
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                    >
                      TSP契約 #{newContract.tspContractId} をファイナンス管理で確認 <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            
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
                          {ls.livestreamDate ? new Date(ls.livestreamDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''} - {ls.streamerName || (language === 'zh' ? '未知主播' : '不明')}
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
                try {
                  let tspId = newContract.tspContractId;
                  
                  // TSP契約自動作成
                  if (newContract.createNewTsp && brand) {
                    const tspResult = await createTspContractMutation.mutateAsync({
                      brandId,
                      shopName: brand.name || `Brand #${brandId}`,
                      contactEmail: (brand as any).email || 'info@lcjmall.com',
                      monthlyAmount: newContract.fixedFee || 0,
                      contractStartDate: newContract.startDate || new Date().toISOString().split('T')[0],
                      contractEndDate: newContract.endDate || undefined,
                      description: `ブランド契約から自動作成 - ${brand.name}`,
                    });
                    if (tspResult?.id) {
                      tspId = tspResult.id;
                    }
                  }

                  const result = await createContractMutation.mutateAsync({
                    brandId,
                    serviceType: newContract.serviceType,
                    fixedFee: newContract.fixedFee,
                    status: newContract.status,
                    startDate: newContract.startDate ? new Date(newContract.startDate) : undefined,
                    endDate: newContract.endDate ? new Date(newContract.endDate) : undefined,
                    memo: newContract.memo || undefined,
                    plannedLivestreamCount: newContract.plannedLivestreamCount,
                    tspContractId: tspId,
                  });
                  // ライブ紐付けがあれば実行
                  if (newContract.linkedLivestreamIds.length > 0 && result.contractId) {
                    bulkLinkLivestreamsMutation.mutate({
                      contractId: result.contractId,
                      livestreamIds: newContract.linkedLivestreamIds,
                    });
                  }
                } catch (err: any) {
                  toast.error(err.message || '契約作成に失敗しました');
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
          setAiSelectedLiverIds([]);
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
                    
                    {/* 担当ライバー選択 */}
                    <div>
                      <Label className="text-gray-400">{language === 'ja' ? '担当ライバー' : '负责主播'}</Label>
                      <div className="mt-2 max-h-40 overflow-y-auto border border-purple-500/30 rounded-lg p-3 bg-black/40">
                        {allLivers.length === 0 ? (
                          <p className="text-gray-500 text-sm">{language === 'ja' ? 'ライバーが登録されていません' : '没有注册的主播'}</p>
                        ) : (
                          <div className="space-y-2">
                            {allLivers.map((liver) => (
                              <label key={liver.id} className="flex items-center gap-3 cursor-pointer hover:bg-purple-900/20 p-2 rounded-lg transition-colors">
                                <input
                                  type="checkbox"
                                  checked={aiSelectedLiverIds.includes(liver.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAiSelectedLiverIds([...aiSelectedLiverIds, liver.id]);
                                    } else {
                                      setAiSelectedLiverIds(aiSelectedLiverIds.filter(id => id !== liver.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-purple-500/50 bg-black/60 text-purple-500 focus:ring-purple-500"
                                />
                                <div className="flex items-center gap-2">
                                  {liver.avatarUrl ? (
                                    <img src={liver.avatarUrl} alt={liver.name} className="w-6 h-6 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                                      {liver.name?.charAt(0) || '?'}
                                    </div>
                                  )}
                                  <span className="text-white text-sm">{liver.name}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {aiSelectedLiverIds.length > 0 && (
                        <p className="text-purple-400 text-xs mt-1">
                          {aiSelectedLiverIds.length}{language === 'ja' ? '名選択中' : '人已选择'}
                        </p>
                      )}
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
                setAiSelectedLiverIds([]);
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
                      liverIds: aiSelectedLiverIds,
                    });
                    setAiImageAddDialogOpen(false);
                    setAiImageFile(null);
                    setAiImagePreview(null);
                    setExtractedProductData(null);
                    setAiSelectedLiverIds([]);
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
                    setTekaProduct(selectedProductForDetail);
                    setProductDetailDialogOpen(false);
                    setTekaDialogOpen(true);
                  }}
                  className="border-2 border-orange-400/60 bg-orange-950/50 text-orange-200 hover:bg-orange-500/30 hover:text-white hover:border-orange-300 hover:shadow-[0_0_20px_rgba(251,146,60,0.4)] text-xl px-8 py-3 transition-all duration-300"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  {language === 'ja' ? '手卤' : '手卡'}
                </Button>
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
                        onClick={handleDownloadProductImagesPdf}
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

      {/* AI Ad Proposal Dialog */}
      <Dialog open={adProposalDialogOpen} onOpenChange={setAdProposalDialogOpen}>
        <DialogContent className="bg-black/95 border-purple-900/50 text-white max-w-4xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-pink-600 rounded-full" />
              <Sparkles className="h-5 w-5 text-purple-400" />
              {language === 'ja' ? 'TikTok広告提案' : 'TikTok广告提案'}
            </DialogTitle>
          </DialogHeader>
          
          {isGeneratingProposal ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-purple-500/30 rounded-full animate-spin border-t-purple-500" />
                <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-purple-400 animate-pulse" />
              </div>
              <p className="text-gray-400 text-sm">{language === 'ja' ? 'AIがデータを分析中...' : 'AI正在分析数据...'}</p>
              <p className="text-gray-500 text-xs">{language === 'ja' ? '広告戦略を生成しています' : '正在生成广告策略'}</p>
            </div>
          ) : adProposalData ? (
            <div className="space-y-6 py-4">
              {/* Metrics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-cyan-950/50 to-cyan-900/30 rounded-lg p-3 border border-cyan-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '総GMV' : '总GMV'}</p>
                  <p className="text-lg font-bold text-cyan-400">¥{(adProposalData.metrics?.totalGmv || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-pink-950/50 to-pink-900/30 rounded-lg p-3 border border-pink-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '広告換算費用' : '广告换算费用'}</p>
                  <p className="text-lg font-bold text-pink-400">¥{(adProposalData.metrics?.adValue || 0).toLocaleString()}</p>
                  <p className="text-[9px] text-gray-500">CPM ¥15,000</p>
                </div>
                <div className="bg-gradient-to-br from-amber-950/50 to-amber-900/30 rounded-lg p-3 border border-amber-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '広告効果ROAS' : '广告效果ROAS'}</p>
                  <p className="text-lg font-bold text-amber-400">{(adProposalData.metrics?.avgRoas || 0).toFixed(2)}{language === 'ja' ? '倍' : '倍'}</p>
                  <p className="text-[9px] text-gray-500">{language === 'ja' ? '総価値÷契約金額' : '总价值÷合同金额'}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-950/50 to-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '配信回数' : '直播次数'}</p>
                  <p className="text-lg font-bold text-purple-400">{adProposalData.metrics?.totalLivestreams || 0}{language === 'ja' ? '回' : '次'}</p>
                </div>
              </div>
              {/* Additional Metrics Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-green-950/50 to-green-900/30 rounded-lg p-3 border border-green-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '総インプレッション' : '总印象数'}</p>
                  <p className="text-lg font-bold text-green-400">{(adProposalData.metrics?.totalImpressions || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-950/50 to-indigo-900/30 rounded-lg p-3 border border-indigo-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '総価値' : '总价值'}</p>
                  <p className="text-lg font-bold text-indigo-400">¥{(adProposalData.metrics?.totalValue || 0).toLocaleString()}</p>
                  <p className="text-[9px] text-gray-500">{language === 'ja' ? 'GMV+広告換算' : 'GMV+广告换算'}</p>
                </div>
                <div className="bg-gradient-to-br from-rose-950/50 to-rose-900/30 rounded-lg p-3 border border-rose-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '契約金額' : '合同金额'}</p>
                  <p className="text-lg font-bold text-rose-400">¥{(adProposalData.metrics?.totalAdCost || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* 契約ステータス別メトリクス */}
              {adProposalData.metrics?.activeContractMetrics && adProposalData.metrics.activeContractMetrics.length > 0 && (
                <div className="bg-gradient-to-br from-blue-950/30 to-cyan-950/20 rounded-lg p-4 border border-blue-500/30">
                  <h4 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    {language === 'ja' ? '進行中契約の配信進捗' : '进行中合同的直播进度'}
                  </h4>
                  <div className="space-y-3">
                    {adProposalData.metrics.activeContractMetrics.map((contract: any, index: number) => (
                      <div key={index} className="bg-black/30 rounded-lg p-3 border border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{contract.serviceType}</span>
                            <span className="text-xs text-gray-400">¥{(contract.fixedFee || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 font-mono text-sm">
                              {contract.livestreamCount}/{contract.plannedLivestreamCount || contract.estimatedTotalLivestreams}
                              {language === 'ja' ? '回' : '次'}
                            </span>
                            {contract.plannedLivestreamCount && (
                              <span className="text-xs text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                                {language === 'ja' ? '予定設定済' : '已设定'}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* 進捗バー */}
                        <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                          <div 
                            className="absolute h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (contract.progressRate || 0) * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            {language === 'ja' ? '進捗: ' : '进度: '}
                            <span className="text-blue-400 font-mono">{((contract.progressRate || 0) * 100).toFixed(0)}%</span>
                          </span>
                          <span className="text-gray-400">
                            {language === 'ja' ? '現在ROAS: ' : '当前ROAS: '}
                            <span className="text-amber-400 font-mono">{(contract.roas || 0).toFixed(2)}倍</span>
                          </span>
                          <span className="text-gray-400">
                            {language === 'ja' ? '予測ROAS: ' : '预测ROAS: '}
                            <span className="text-green-400 font-mono">{(contract.projectedRoas || 0).toFixed(2)}倍</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 完了契約のサマリー */}
              {adProposalData.metrics?.completedContractMetrics && adProposalData.metrics.completedContractMetrics.length > 0 && (
                <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-lg p-4 border border-gray-600/30">
                  <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    {language === 'ja' ? '完了契約の実績' : '已完成合同的业绩'}
                    <span className="text-xs text-gray-500 ml-2">
                      ({adProposalData.metrics.completedContractMetrics.length}{language === 'ja' ? '件' : '件'})
                    </span>
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">{language === 'ja' ? '合計GMV' : '总GMV'}</p>
                      <p className="text-lg font-bold text-cyan-400">
                        ¥{adProposalData.metrics.completedContractMetrics.reduce((sum: number, c: any) => sum + (c.gmv || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">{language === 'ja' ? '平均ROAS' : '平均ROAS'}</p>
                      <p className="text-lg font-bold text-amber-400">
                        {(() => {
                          const totalValue = adProposalData.metrics.completedContractMetrics.reduce((sum: number, c: any) => sum + (c.totalValue || 0), 0);
                          const totalFee = adProposalData.metrics.completedContractMetrics.reduce((sum: number, c: any) => sum + (c.fixedFee || 0), 0);
                          return totalFee > 0 ? (totalValue / totalFee).toFixed(2) : '0.00';
                        })()}倍
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">{language === 'ja' ? '総配信回数' : '总直播次数'}</p>
                      <p className="text-lg font-bold text-purple-400">
                        {adProposalData.metrics.completedContractMetrics.reduce((sum: number, c: any) => sum + (c.livestreamCount || 0), 0)}{language === 'ja' ? '回' : '次'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Products */}
              {adProposalData.metrics?.topProducts && adProposalData.metrics.topProducts.length > 0 && (
                <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                  <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-cyan-400" />
                    {language === 'ja' ? '売れ筋商品TOP5' : '热销商品TOP5'}
                  </h4>
                  <div className="space-y-2">
                    {adProposalData.metrics.topProducts.map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">
                          <span className="text-purple-400 font-bold mr-2">#{index + 1}</span>
                          {product.name}
                        </span>
                        <span className="text-cyan-400 font-mono">¥{product.gmv.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Proposal Content */}
              <div className="bg-gradient-to-br from-purple-950/30 to-pink-950/20 rounded-lg p-4 border border-purple-500/30">
                <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  {language === 'ja' ? 'AI広告提案' : 'AI广告提案'}
                </h4>
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                    {typeof adProposalData.proposal === 'string' ? adProposalData.proposal : JSON.stringify(adProposalData.proposal)}
                  </div>
                </div>
              </div>

              {/* Generation Info */}
              <div className="text-xs text-gray-500 text-right">
                {language === 'ja' ? '生成日時: ' : '生成时间: '}
                {adProposalData.generatedAt ? new Date(adProposalData.generatedAt).toLocaleString('ja-JP') : '-'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <p className="text-gray-400">{language === 'ja' ? '提案データがありません' : '没有提案数据'}</p>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setProposalHistoryOpen(true)}
                className="border-blue-500/50 bg-blue-950/50 text-gray-200 hover:bg-blue-900/40 hover:text-white"
              >
                <History className="h-4 w-4 mr-2" />
                {language === 'ja' ? '履歴' : '历史'}
                {proposalHistory.length > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white text-xs">{proposalHistory.length}</Badge>
                )}
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => setAdProposalDialogOpen(false)}
                className="border-purple-500/50 bg-purple-950/50 text-gray-200 hover:bg-purple-900/40 hover:text-white"
              >
                {t.close}
              </Button>
              {adProposalData && (
                <>
                  <Button
                    onClick={handleDownloadPdf}
                    disabled={generatePdfMutation.isPending}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
                  >
                    {generatePdfMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    {language === 'ja' ? 'PDF' : 'PDF'}
                  </Button>
                  <Button
                    onClick={handleSaveProposal}
                    disabled={saveAdProposalMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
                  >
                    {saveAdProposalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {language === 'ja' ? '保存' : '保存'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsGeneratingProposal(true);
                      setAdProposalData(null);
                      generateAdProposalMutation.mutate({ brandId, language: language as 'ja' | 'zh' });
                    }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {language === 'ja' ? '再生成' : '重新生成'}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal History Dialog */}
      <Dialog open={proposalHistoryOpen} onOpenChange={setProposalHistoryOpen}>
        <DialogContent className="bg-black/95 border-blue-900/50 text-white max-w-5xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-400 to-cyan-600 rounded-full" />
              <History className="h-5 w-5 text-blue-400" />
              {language === 'ja' ? '広告提案履歴' : '广告提案历史'}
            </DialogTitle>
          </DialogHeader>
          
          {proposalHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <History className="h-12 w-12 text-gray-600" />
              <p className="text-gray-400">{language === 'ja' ? '保存された提案はありません' : '没有保存的提案'}</p>
              <p className="text-gray-500 text-sm">{language === 'ja' ? '提案を生成して保存してください' : '请生成并保存提案'}</p>
            </div>
          ) : selectedHistoryProposal ? (
            <div className="space-y-6 py-4">
              {/* Back button */}
              <Button
                variant="ghost"
                onClick={() => setSelectedHistoryProposal(null)}
                className="text-gray-400 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {language === 'ja' ? '一覧に戻る' : '返回列表'}
              </Button>
              
              {/* Version header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-600 text-white">v{selectedHistoryProposal.version}</Badge>
                  <span className="text-gray-400 text-sm">
                    {new Date(selectedHistoryProposal.createdAt).toLocaleString('ja-JP')}
                  </span>
                  <span className="text-gray-500 text-xs">
                    by {selectedHistoryProposal.createdByName}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadHistoryPdf(selectedHistoryProposal)}
                    disabled={generatePdfMutation.isPending}
                    className="border-cyan-500/50 bg-cyan-950/50 text-cyan-300 hover:bg-cyan-900/40"
                  >
                    {generatePdfMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportPdf(selectedHistoryProposal)}
                    className="border-green-500/50 bg-green-950/50 text-green-300 hover:bg-green-900/40"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'ja' ? 'MD' : 'MD'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm(language === 'ja' ? 'この提案を削除しますか？' : '确定要删除这个提案吗？')) {
                        deleteAdProposalMutation.mutate({ id: selectedHistoryProposal.id });
                      }
                    }}
                    className="border-red-500/50 bg-red-950/50 text-red-300 hover:bg-red-900/40"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {language === 'ja' ? '削除' : '删除'}
                  </Button>
                </div>
              </div>

              {/* Metrics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-cyan-950/50 to-cyan-900/30 rounded-lg p-3 border border-cyan-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '総GMV' : '总GMV'}</p>
                  <p className="text-lg font-bold text-cyan-400">¥{(selectedHistoryProposal.totalGmv || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-pink-950/50 to-pink-900/30 rounded-lg p-3 border border-pink-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '広告換算費用' : '广告换算费用'}</p>
                  <p className="text-lg font-bold text-pink-400">¥{(selectedHistoryProposal.adValue || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-950/50 to-amber-900/30 rounded-lg p-3 border border-amber-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '広告効果ROAS' : '广告效果ROAS'}</p>
                  <p className="text-lg font-bold text-amber-400">{Number(selectedHistoryProposal.avgRoas || 0).toFixed(2)}倍</p>
                </div>
                <div className="bg-gradient-to-br from-purple-950/50 to-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                  <p className="text-xs text-gray-400">{language === 'ja' ? '配信回数' : '直播次数'}</p>
                  <p className="text-lg font-bold text-purple-400">{selectedHistoryProposal.totalLivestreams || 0}回</p>
                </div>
              </div>

              {/* AI Proposal Content */}
              <div className="bg-gradient-to-br from-purple-950/30 to-pink-950/20 rounded-lg p-4 border border-purple-500/30">
                <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  {language === 'ja' ? 'AI広告提案' : 'AI广告提案'}
                </h4>
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                    {selectedHistoryProposal.proposalContent}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* History list */}
              {proposalHistory.map((proposal: any) => (
                <div
                  key={proposal.id}
                  onClick={() => setSelectedHistoryProposal(proposal)}
                  className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/50 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600 text-white">v{proposal.version}</Badge>
                      <div>
                        <p className="text-gray-300 text-sm">
                          {new Date(proposal.createdAt).toLocaleString('ja-JP')}
                        </p>
                        <p className="text-gray-500 text-xs">
                          by {proposal.createdByName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-cyan-400 font-mono">¥{(proposal.totalGmv || 0).toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">GMV</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-mono">{Number(proposal.avgRoas || 0).toFixed(2)}倍</p>
                        <p className="text-gray-500 text-xs">ROAS</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setProposalHistoryOpen(false);
                setSelectedHistoryProposal(null);
              }}
              className="border-blue-500/50 bg-blue-950/50 text-gray-200 hover:bg-blue-900/40 hover:text-white"
            >
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ad Alert Dialog */}
      <Dialog open={adAlertDialogOpen} onOpenChange={setAdAlertDialogOpen}>
        <DialogContent className="bg-black/95 border-amber-900/50 text-white max-w-4xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-orange-600 rounded-full" />
              <TrendingUp className="h-5 w-5 text-amber-400" />
              {language === 'ja' ? '広告費投入アラート' : '广告费投入警报'}
            </DialogTitle>
            <p className="text-gray-400 text-sm mt-1">
              {language === 'ja' 
                ? 'ライブ成績に基づく広告費投入の機会分析' 
                : '基于直播成绩的广告费投入机会分析'}
            </p>
          </DialogHeader>
          
          {isGeneratingAlert ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-amber-500/30 rounded-full animate-spin border-t-amber-500" />
                <TrendingUp className="absolute inset-0 m-auto h-6 w-6 text-amber-400 animate-pulse" />
              </div>
              <p className="text-gray-400 text-sm">{language === 'ja' ? 'AIがデータを分析中...' : 'AI正在分析数据...'}</p>
              <p className="text-gray-500 text-xs">{language === 'ja' ? '広告投入の機会を計算しています' : '正在计算广告投入机会'}</p>
            </div>
          ) : adAlertData ? (
            <div className="space-y-6 py-4">
              {/* Urgency Banner */}
              <div className={`rounded-lg p-4 border ${
                adAlertData.urgency.level === 'high' 
                  ? 'bg-gradient-to-r from-red-950/50 to-orange-950/50 border-red-500/50' 
                  : adAlertData.urgency.level === 'medium'
                  ? 'bg-gradient-to-r from-amber-950/50 to-yellow-950/50 border-amber-500/50'
                  : 'bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-500/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    adAlertData.urgency.level === 'high' ? 'bg-red-500' 
                    : adAlertData.urgency.level === 'medium' ? 'bg-amber-500' 
                    : 'bg-gray-500'
                  }`} />
                  <span className={`font-bold ${
                    adAlertData.urgency.level === 'high' ? 'text-red-400' 
                    : adAlertData.urgency.level === 'medium' ? 'text-amber-400' 
                    : 'text-gray-400'
                  }`}>
                    {adAlertData.urgency.level === 'high' 
                      ? (language === 'ja' ? '🚨 緊急度: 高' : '🚨 紧急程度: 高')
                      : adAlertData.urgency.level === 'medium'
                      ? (language === 'ja' ? '⚠️ 緊急度: 中' : '⚠️ 紧急程度: 中')
                      : (language === 'ja' ? 'ℹ️ 緊急度: 低' : 'ℹ️ 紧急程度: 低')}
                  </span>
                </div>
                <p className="text-gray-300 mt-2">{adAlertData.urgency.reason}</p>
              </div>

              {/* Current Performance */}
              <div className="bg-gradient-to-br from-cyan-950/30 to-blue-950/30 rounded-lg p-4 border border-cyan-500/30">
                <h4 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {language === 'ja' ? '現在のライブ成績（広告費なし）' : '当前直播成绩（无广告费）'}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{language === 'ja' ? '総GMV' : '总GMV'}</p>
                    <p className="text-lg font-bold text-cyan-400">¥{(adAlertData.currentMetrics.totalGmv || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{language === 'ja' ? '配信回数' : '直播次数'}</p>
                    <p className="text-lg font-bold text-purple-400">{adAlertData.currentMetrics.totalLivestreams}{language === 'ja' ? '回' : '次'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{language === 'ja' ? '平均GMV/配信' : '平均GMV/直播'}</p>
                    <p className="text-lg font-bold text-green-400">¥{Math.round(adAlertData.currentMetrics.avgGmvPerLive || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{language === 'ja' ? 'パフォーマンス' : '表现分数'}</p>
                    <p className="text-lg font-bold text-amber-400">{adAlertData.currentMetrics.performanceScore}/100</p>
                  </div>
                </div>
              </div>

              {/* Opportunity Cost */}
              <div className="bg-gradient-to-br from-red-950/30 to-orange-950/30 rounded-lg p-4 border border-red-500/30">
                <h4 className="text-sm font-bold text-red-300 mb-3 flex items-center gap-2">
                  <span className="text-lg">💸</span>
                  {language === 'ja' ? '機会損失（広告をかけないと損する金額）' : '机会成本（不投广告会亏损的金额）'}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center bg-black/30 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{language === 'ja' ? '逃している推定インプレッション' : '错失的估计印象数'}</p>
                    <p className="text-2xl font-bold text-red-400">{Math.round(adAlertData.opportunityCost.missedImpressions || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center bg-black/30 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{language === 'ja' ? '機会損失額（推定GMV）' : '机会成本（估计GMV）'}</p>
                    <p className="text-2xl font-bold text-red-400">¥{Math.round(adAlertData.opportunityCost.missedGmv || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Allocation Recommendation */}
              {adAlertData.allocationRecommendation && (
                <div className="bg-gradient-to-br from-purple-950/30 to-indigo-950/30 rounded-lg p-4 border border-purple-500/30">
                  <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    {language === 'ja' ? 'おすすめ広告配分' : '推荐广告分配'}
                    {adAlertData.allocationRecommendation.isLearningBased && (
                      <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        🧠 {language === 'ja' ? '学習済み' : '已学习'}
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center bg-black/30 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">📺 {language === 'ja' ? 'ライブ広告' : '直播广告'}</p>
                      <p className="text-2xl font-bold text-cyan-400">{Math.round((adAlertData.allocationRecommendation.liveRatio || 0) * 100)}%</p>
                      <p className="text-xs text-gray-500 mt-1">{language === 'ja' ? '配信中に視聴者を増やし即時購入を促進' : '直播期间增加观众促进即时购买'}</p>
                    </div>
                    <div className="text-center bg-black/30 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">🎬 {language === 'ja' ? '切り抜き広告' : '切片广告'}</p>
                      <p className="text-2xl font-bold text-pink-400">{Math.round((adAlertData.allocationRecommendation.clipRatio || 0) * 100)}%</p>
                      <p className="text-xs text-gray-500 mt-1">{language === 'ja' ? '配信後も継続的にリーチし認知度向上' : '直播后继续触达提高知名度'}</p>
                    </div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-sm text-purple-200">💡 {adAlertData.allocationRecommendation.reason}</p>
                  </div>
                </div>
              )}

              {/* Learning Data Info */}
              {adAlertData.learningData && (
                <div className={`rounded-lg p-3 border ${adAlertData.learningData.hasData ? 'bg-gradient-to-br from-green-950/20 to-emerald-950/20 border-green-500/30' : 'bg-gradient-to-br from-gray-950/20 to-slate-950/20 border-gray-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{adAlertData.learningData.hasData ? '🧠' : '📊'}</span>
                      <span className={`text-sm font-medium ${adAlertData.learningData.hasData ? 'text-green-300' : 'text-gray-400'}`}>
                        {language === 'ja' ? '予測精度' : '预测精度'}
                      </span>
                    </div>
                    {adAlertData.learningData.hasData ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {language === 'ja' ? `${adAlertData.learningData.recordCount}件の実績データ` : `${adAlertData.learningData.recordCount}条实绩数据`}
                        </span>
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          {language === 'ja' ? '高精度' : '高精度'}
                        </span>
                        {adAlertData.learningData.learnedAvgRoas && (
                          <span className="text-xs text-amber-400">
                            {language === 'ja' ? '学習ROAS: ' : '学习ROAS: '}{adAlertData.learningData.learnedAvgRoas.toFixed(2)}{language === 'ja' ? '倍' : '倍'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {language === 'ja' ? '業界平均値で予測（広告実績を記録すると精度向上）' : '以行业平均值预测（记录广告实绩可提高精度）'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Ad Investment Scenarios */}
              <div className="bg-gradient-to-br from-green-950/30 to-emerald-950/30 rounded-lg p-4 border border-green-500/30">
                <h4 className="text-sm font-bold text-green-300 mb-3 flex items-center gap-2">
                  <span className="text-lg">📈</span>
                  {language === 'ja' ? '広告費投入シナリオ（かけるとこれだけ伸びる）' : '广告费投入方案（投入后可以增长这么多）'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Small Budget */}
                  <div className="bg-black/30 rounded-lg p-4 border border-gray-700/50 hover:border-green-500/50 transition-all">
                    <div className="text-center mb-3">
                      <Badge className="bg-gray-600 text-white">{language === 'ja' ? '小規模' : '小规模'}</Badge>
                      <p className="text-xl font-bold text-white mt-2">¥{(adAlertData.scenarios.small.budget || 0).toLocaleString()}</p>
                    </div>
                    {adAlertData.scenarios.small.allocation && (
                      <div className="bg-black/20 rounded p-2 mb-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-300">📺 ¥{(adAlertData.scenarios.small.allocation.liveBudget || 0).toLocaleString()}</span>
                          <span className="text-pink-300">🎬 ¥{(adAlertData.scenarios.small.allocation.clipBudget || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{language === 'ja' ? '予測追加GMV' : '预测增加GMV'}</span>
                        <span className="text-green-400">+¥{Math.round(adAlertData.scenarios.small.projectedGmv || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ROAS</span>
                        <span className="text-amber-400">{(adAlertData.scenarios.small.roas || 0).toFixed(2)}{language === 'ja' ? '倍' : '倍'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Medium Budget - Recommended */}
                  <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-lg p-4 border-2 border-green-500/70 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-green-500 text-white">{language === 'ja' ? 'おすすめ' : '推荐'}</Badge>
                    </div>
                    <div className="text-center mb-3 mt-2">
                      <Badge className="bg-green-600 text-white">{language === 'ja' ? '中規模' : '中规模'}</Badge>
                      <p className="text-xl font-bold text-white mt-2">¥{(adAlertData.scenarios.medium.budget || 0).toLocaleString()}</p>
                    </div>
                    {adAlertData.scenarios.medium.allocation && (
                      <div className="bg-black/20 rounded p-2 mb-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-300">📺 ¥{(adAlertData.scenarios.medium.allocation.liveBudget || 0).toLocaleString()}</span>
                          <span className="text-pink-300">🎬 ¥{(adAlertData.scenarios.medium.allocation.clipBudget || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{language === 'ja' ? '予測追加GMV' : '预测增加GMV'}</span>
                        <span className="text-green-400">+¥{Math.round(adAlertData.scenarios.medium.projectedGmv || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ROAS</span>
                        <span className="text-amber-400">{(adAlertData.scenarios.medium.roas || 0).toFixed(2)}{language === 'ja' ? '倍' : '倍'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Large Budget */}
                  <div className="bg-black/30 rounded-lg p-4 border border-gray-700/50 hover:border-green-500/50 transition-all">
                    <div className="text-center mb-3">
                      <Badge className="bg-purple-600 text-white">{language === 'ja' ? '大規模' : '大规模'}</Badge>
                      <p className="text-xl font-bold text-white mt-2">¥{(adAlertData.scenarios.large.budget || 0).toLocaleString()}</p>
                    </div>
                    {adAlertData.scenarios.large.allocation && (
                      <div className="bg-black/20 rounded p-2 mb-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-300">📺 ¥{(adAlertData.scenarios.large.allocation.liveBudget || 0).toLocaleString()}</span>
                          <span className="text-pink-300">🎬 ¥{(adAlertData.scenarios.large.allocation.clipBudget || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{language === 'ja' ? '予測追加GMV' : '预测增加GMV'}</span>
                        <span className="text-green-400">+¥{Math.round(adAlertData.scenarios.large.projectedGmv || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ROAS</span>
                        <span className="text-amber-400">{(adAlertData.scenarios.large.roas || 0).toFixed(2)}{language === 'ja' ? '倍' : '倍'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div className="bg-gradient-to-br from-amber-950/30 to-orange-950/20 rounded-lg p-4 border border-amber-500/30">
                <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  {language === 'ja' ? 'AI分析レポート' : 'AI分析报告'}
                </h4>
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                    {adAlertData.aiAnalysis}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <p className="text-gray-400">{language === 'ja' ? 'データがありません' : '没有数据'}</p>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => setAdAlertDialogOpen(false)}
                className="border-amber-500/50 bg-amber-950/50 text-gray-200 hover:bg-amber-900/40 hover:text-white"
              >
                {t.close}
              </Button>
              {adAlertHistory && adAlertHistory.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setAdAlertHistoryDialogOpen(true)}
                  className="border-purple-500/50 bg-purple-950/50 text-gray-200 hover:bg-purple-900/40 hover:text-white"
                >
                  <History className="h-4 w-4 mr-2" />
                  {language === 'ja' ? `履歴 (${adAlertHistory.length})` : `历史 (${adAlertHistory.length})`}
                </Button>
              )}
              {adAlertData && (
                <>
                  <Button
                    onClick={handleSaveAdAlert}
                    disabled={saveAdAlertMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveAdAlertMutation.isPending ? (language === 'ja' ? '保存中...' : '保存中...') : (language === 'ja' ? '保存' : '保存')}
                  </Button>
                  <Button
                    onClick={handleDownloadAdAlertPdf}
                    disabled={generateAdAlertPdfMutation.isPending}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {generateAdAlertPdfMutation.isPending ? (language === 'ja' ? '生成中...' : '生成中...') : 'PDF'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsGeneratingAlert(true);
                      setAdAlertData(null);
                      generateAdAlertMutation.mutate({ brandId, language: language as 'ja' | 'zh' });
                    }}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {language === 'ja' ? '再生成' : '重新生成'}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ad Alert History Dialog */}
      <Dialog open={adAlertHistoryDialogOpen} onOpenChange={setAdAlertHistoryDialogOpen}>
        <DialogContent className="bg-black/95 border-purple-900/50 text-white max-w-4xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-pink-600 rounded-full" />
              <History className="h-5 w-5 text-purple-400" />
              {language === 'ja' ? '広告アラート履歴' : '广告警报历史'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {adAlertHistory && adAlertHistory.length > 0 ? (
              <div className="space-y-3">
                {adAlertHistory.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedHistoryAlert?.id === alert.id
                        ? 'border-purple-500 bg-purple-950/50'
                        : 'border-gray-700 bg-gray-900/50 hover:border-purple-500/50'
                    }`}
                    onClick={() => setSelectedHistoryAlert(alert)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-semibold">v{alert.version}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          alert.urgency.level === 'high' ? 'bg-red-500/20 text-red-400' :
                          alert.urgency.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {alert.urgency.level === 'high' ? (language === 'ja' ? '緊急度:高' : '紧急度:高') :
                           alert.urgency.level === 'medium' ? (language === 'ja' ? '緊急度:中' : '紧急度:中') :
                           (language === 'ja' ? '緊急度:低' : '紧急度:低')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.createdAt).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'zh-CN')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">{language === 'ja' ? '総GMV' : '总GMV'}: </span>
                        <span className="text-cyan-400">¥{alert.currentMetrics.totalGmv.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ja' ? '機会損失' : '机会损失'}: </span>
                        <span className="text-red-400">¥{Math.round(alert.opportunityCost.missedGmv).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{language === 'ja' ? 'スコア' : '分数'}: </span>
                        <span className="text-green-400">{alert.currentMetrics.performanceScore}/100</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {language === 'ja' ? '作成者' : '创建者'}: {alert.createdByName}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {language === 'ja' ? '履歴がありません' : '没有历史记录'}
              </div>
            )}

            {selectedHistoryAlert && (
              <div className="mt-4 p-4 rounded-lg border border-purple-500/50 bg-purple-950/30">
                <h4 className="text-lg font-semibold text-purple-400 mb-3">
                  {language === 'ja' ? `v${selectedHistoryAlert.version} 詳細` : `v${selectedHistoryAlert.version} 详情`}
                </h4>
                
                {/* Scenarios */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded bg-gray-900/50 border border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">{language === 'ja' ? '小規模' : '小规模'}</div>
                    <div className="text-lg font-bold text-white">¥{selectedHistoryAlert.scenarios.small.budget.toLocaleString()}</div>
                    <div className="text-xs text-green-400">+¥{Math.round(selectedHistoryAlert.scenarios.small.projectedGmv).toLocaleString()}</div>
                    <div className="text-xs text-cyan-400">ROAS: {selectedHistoryAlert.scenarios.small.roas.toFixed(2)}{language === 'ja' ? '倍' : '倍'}</div>
                  </div>
                  <div className="p-3 rounded bg-gray-900/50 border border-green-500/50">
                    <div className="text-xs text-green-400 mb-1">{language === 'ja' ? '中規模（おすすめ）' : '中规模（推荐）'}</div>
                    <div className="text-lg font-bold text-white">¥{selectedHistoryAlert.scenarios.medium.budget.toLocaleString()}</div>
                    <div className="text-xs text-green-400">+¥{Math.round(selectedHistoryAlert.scenarios.medium.projectedGmv).toLocaleString()}</div>
                    <div className="text-xs text-cyan-400">ROAS: {selectedHistoryAlert.scenarios.medium.roas.toFixed(2)}{language === 'ja' ? '倍' : '倍'}</div>
                  </div>
                  <div className="p-3 rounded bg-gray-900/50 border border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">{language === 'ja' ? '大規模' : '大规模'}</div>
                    <div className="text-lg font-bold text-white">¥{selectedHistoryAlert.scenarios.large.budget.toLocaleString()}</div>
                    <div className="text-xs text-green-400">+¥{Math.round(selectedHistoryAlert.scenarios.large.projectedGmv).toLocaleString()}</div>
                    <div className="text-xs text-cyan-400">ROAS: {selectedHistoryAlert.scenarios.large.roas.toFixed(2)}{language === 'ja' ? '倍' : '倍'}</div>
                  </div>
                </div>

                {/* AI Analysis */}
                <div className="p-3 rounded bg-gray-900/50 border border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">{language === 'ja' ? 'AI分析レポート' : 'AI分析报告'}</div>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedHistoryAlert.aiAnalysis}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setAdAlertHistoryDialogOpen(false);
                  setSelectedHistoryAlert(null);
                }}
                className="border-purple-500/50 bg-purple-950/50 text-gray-200 hover:bg-purple-900/40 hover:text-white"
              >
                {t.close}
              </Button>
              {selectedHistoryAlert && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm(language === 'ja' ? 'このアラートを削除しますか？' : '确定要删除此警报吗？')) {
                      deleteAdAlertMutation.mutate({ alertId: selectedHistoryAlert.id });
                    }
                  }}
                  disabled={deleteAdAlertMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {language === 'ja' ? '削除' : '删除'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ad Investment Records Dialog */}
      <Dialog open={adInvestmentDialogOpen} onOpenChange={setAdInvestmentDialogOpen}>
        <DialogContent className="bg-black/95 border-green-900/50 text-white max-w-5xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-green-400 to-emerald-600 rounded-full" />
              <TrendingUp className="h-5 w-5 text-green-400" />
              {t.adInvestmentRecords}
            </DialogTitle>
          </DialogHeader>

          {/* Learned Stats Summary */}
          {brandAdStats && (
            <div className="bg-gradient-to-r from-green-950/50 to-emerald-950/50 rounded-lg p-4 border border-green-500/30 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-green-400" />
                <span className="text-sm font-bold text-green-300">{t.learnedStats}</span>
                <Badge className="bg-green-500/30 text-green-300 border border-green-400/50 text-xs">
                  {brandAdStats.totalRecords} {language === 'ja' ? 'レコード' : '条记录'}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-400">{t.avgRoas}</div>
                  <div className="text-lg font-bold text-green-300">{parseFloat(brandAdStats.avgRoas || '0').toFixed(2)}{language === 'ja' ? '倍' : '倍'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">{t.avgCpm}</div>
                  <div className="text-lg font-bold text-cyan-300">¥{Math.round(parseFloat(brandAdStats.avgCpm || '0')).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">{t.avgCpc}</div>
                  <div className="text-lg font-bold text-purple-300">¥{Math.round(parseFloat(brandAdStats.avgCpc || '0')).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">{t.optimalAllocation}</div>
                  <div className="text-sm font-bold">
                    <span className="text-amber-300">📺 {Math.round(parseFloat(brandAdStats.optimalLiveRatio || '0.5') * 100)}%</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-pink-300">🎬 {Math.round(parseFloat(brandAdStats.optimalClipRatio || '0.5') * 100)}%</span>
                  </div>
                </div>
              </div>
              {parseFloat(brandAdStats.avgPredictionAccuracy || '0') > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  {t.predictionAccuracy}: <span className="text-green-400">{(parseFloat(brandAdStats.avgPredictionAccuracy || '0') * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Records List */}
          <div className="space-y-3">
            {adInvestmentRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t.noInvestmentRecords}
              </div>
            ) : (
              adInvestmentRecords.map((record: any) => (
                <div key={record.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 hover:border-green-500/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge className={`${
                        record.adType === 'live' ? 'bg-amber-500/30 text-amber-300 border-amber-400/50' :
                        record.adType === 'clip' ? 'bg-pink-500/30 text-pink-300 border-pink-400/50' :
                        'bg-purple-500/30 text-purple-300 border-purple-400/50'
                      } border`}>
                        {record.adType === 'live' ? t.liveAd : record.adType === 'clip' ? t.clipAd : t.mixedAd}
                      </Badge>
                      <span className="text-sm text-gray-400">
                        {new Date(record.investmentDate).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'zh-CN')}
                      </span>
                      {record.campaignName && (
                        <span className="text-sm text-gray-300">{record.campaignName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingInvestment(record);
                          setEditInvestmentDialogOpen(true);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(language === 'ja' ? 'この実績を削除しますか？' : '确定要删除此实绩吗？')) {
                            deleteInvestmentMutation.mutate({ id: record.id });
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">{t.totalBudget}</div>
                      <div className="text-lg font-bold text-white">¥{record.totalBudget.toLocaleString()}</div>
                      {record.liveBudget > 0 || record.clipBudget > 0 ? (
                        <div className="text-xs text-gray-400">
                          📺¥{record.liveBudget.toLocaleString()} / 🎬¥{record.clipBudget.toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{t.actualGmv}</div>
                      <div className="text-lg font-bold text-green-300">¥{(record.actualGmv || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{t.actualRoas}</div>
                      <div className="text-lg font-bold text-cyan-300">{parseFloat(record.actualRoas || '0').toFixed(2)}{language === 'ja' ? '倍' : '倍'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{t.actualImpressions}</div>
                      <div className="text-lg font-bold text-purple-300">{(record.actualImpressions || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{t.predictionAccuracy}</div>
                      <div className={`text-lg font-bold ${
                        parseFloat(record.predictionAccuracy || '0') >= 0.8 ? 'text-green-300' :
                        parseFloat(record.predictionAccuracy || '0') >= 0.5 ? 'text-yellow-300' : 'text-red-300'
                      }`}>
                        {record.predictionAccuracy ? `${(parseFloat(record.predictionAccuracy) * 100).toFixed(1)}%` : '-'}
                      </div>
                    </div>
                  </div>
                  {record.notes && (
                    <div className="mt-2 text-xs text-gray-400 border-t border-gray-700 pt-2">
                      {record.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              onClick={() => setAddInvestmentDialogOpen(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.addInvestmentRecord}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAdInvestmentDialogOpen(false)}
              className="border-green-500/50 bg-green-950/50 text-gray-200 hover:bg-green-900/40 hover:text-white"
            >
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Investment Record Dialog */}
      <Dialog open={addInvestmentDialogOpen} onOpenChange={setAddInvestmentDialogOpen}>
        <DialogContent className="bg-black/95 border-green-900/50 text-white max-w-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <Plus className="h-5 w-5 text-green-400" />
              {t.addInvestmentRecord}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* PDF Upload Section */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Upload className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">
                  {language === 'ja' ? 'PDF/Excelで自動入力' : '通过PDF/Excel自动输入'}
                </span>
              </div>
              <input
                ref={investmentFileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setInvestmentPdfFile(file);
                  setInvestmentAnalyzing(true);
                  try {
                    // Upload file to S3
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('brandId', String(brandId));
                    const uploadResponse = await fetch('/api/brand-file-upload', {
                      method: 'POST',
                      body: formData,
                    });
                    if (!uploadResponse.ok) throw new Error('Upload failed');
                    const uploadResult = await uploadResponse.json();
                    
                    // Analyze with AI
                    const result = await analyzeAdReportMutation.mutateAsync({
                      brandId,
                      fileUrl: uploadResult.url,
                      fileKey: uploadResult.key,
                      fileName: file.name,
                    });
                    
                    setInvestmentAnalysisResult(result);
                    
                    // Auto-fill form with analysis result
                    if (result) {
                      setNewInvestment(prev => ({
                        ...prev,
                        campaignName: result.campaignName || prev.campaignName,
                        totalBudget: result.budget || prev.totalBudget,
                        actualImpressions: result.impressions || prev.actualImpressions,
                        actualClicks: result.clicks || prev.actualClicks,
                        actualGmv: result.gmv || prev.actualGmv,
                        actualConversions: result.conversions || prev.actualConversions,
                      }));
                      toast.success(language === 'ja' ? 'AI分析完了！フォームに自動入力しました' : 'AI分析完成！已自动填写表单');
                    }
                  } catch (error) {
                    console.error('Analysis error:', error);
                    toast.error(language === 'ja' ? '分析に失敗しました' : '分析失败');
                  } finally {
                    setInvestmentAnalyzing(false);
                  }
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => investmentFileInputRef.current?.click()}
                disabled={investmentAnalyzing}
                className="w-full border-blue-500/50 text-blue-300 hover:bg-blue-500/20"
              >
                {investmentAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'ja' ? 'AI分析中...' : 'AI分析中...'}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    {language === 'ja' ? 'ファイルを選択' : '选择文件'}
                  </>
                )}
              </Button>
              {investmentPdfFile && (
                <div className="mt-2 text-xs text-gray-400">
                  {investmentPdfFile.name}
                </div>
              )}
              {investmentAnalysisResult && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{language === 'ja' ? '検出言語:' : '检测语言:'}</span>
                    <span className="text-xs text-white bg-gray-700 px-2 py-0.5 rounded">
                      {investmentAnalysisResult.detectedLanguage === 'ja' ? '日本語' : 
                       investmentAnalysisResult.detectedLanguage === 'zh' ? '中文' : 
                       investmentAnalysisResult.detectedLanguage === 'en' ? 'English' : 
                       investmentAnalysisResult.detectedLanguage}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{language === 'ja' ? '広告目的:' : '广告目的:'}</span>
                    <span className="text-xs text-white bg-purple-700/50 px-2 py-0.5 rounded">
                      {investmentAnalysisResult.objective === 'impression' ? (language === 'ja' ? 'インプレッション' : '曝光') :
                       investmentAnalysisResult.objective === 'click' ? (language === 'ja' ? 'クリック' : '点击') :
                       investmentAnalysisResult.objective === 'conversion' ? (language === 'ja' ? 'コンバージョン' : '转化') :
                       investmentAnalysisResult.objective}
                    </span>
                    {investmentAnalysisResult.objectiveConfidence && (
                      <span className="text-xs text-gray-500">
                        ({Math.round(investmentAnalysisResult.objectiveConfidence * 100)}%)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-2 text-gray-500">
                  {language === 'ja' ? 'または手動入力' : '或手动输入'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">{t.investmentDate}</Label>
                <Input
                  type="date"
                  value={newInvestment.investmentDate}
                  onChange={(e) => setNewInvestment({ ...newInvestment, investmentDate: e.target.value })}
                  className="bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t.adType}</Label>
                <Select
                  value={newInvestment.adType}
                  onValueChange={(value: 'live' | 'clip' | 'mixed') => setNewInvestment({ ...newInvestment, adType: value })}
                >
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="live">{t.liveAd}</SelectItem>
                    <SelectItem value="clip">{t.clipAd}</SelectItem>
                    <SelectItem value="mixed">{t.mixedAd}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">{t.totalBudget}</Label>
                <Input
                  type="number"
                  value={newInvestment.totalBudget}
                  onChange={(e) => setNewInvestment({ ...newInvestment, totalBudget: parseInt(e.target.value) || 0 })}
                  className="bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t.liveAd} (¥)</Label>
                <Input
                  type="number"
                  value={newInvestment.liveBudget}
                  onChange={(e) => setNewInvestment({ ...newInvestment, liveBudget: parseInt(e.target.value) || 0 })}
                  className="bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t.clipAd} (¥)</Label>
                <Input
                  type="number"
                  value={newInvestment.clipBudget}
                  onChange={(e) => setNewInvestment({ ...newInvestment, clipBudget: parseInt(e.target.value) || 0 })}
                  className="bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300">{t.campaignName}</Label>
              <Input
                value={newInvestment.campaignName}
                onChange={(e) => setNewInvestment({ ...newInvestment, campaignName: e.target.value })}
                placeholder={language === 'ja' ? 'キャンペーン名を入力...' : '输入活动名称...'}
                className="bg-gray-900/50 border-gray-700 text-white"
              />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm text-gray-400 mb-2">{language === 'ja' ? '実績データ（後から入力可）' : '实绩数据（可稍后输入）'}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">{t.actualGmv}</Label>
                  <Input
                    type="number"
                    value={newInvestment.actualGmv}
                    onChange={(e) => setNewInvestment({ ...newInvestment, actualGmv: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t.actualImpressions}</Label>
                  <Input
                    type="number"
                    value={newInvestment.actualImpressions}
                    onChange={(e) => setNewInvestment({ ...newInvestment, actualImpressions: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t.actualClicks}</Label>
                  <Input
                    type="number"
                    value={newInvestment.actualClicks}
                    onChange={(e) => setNewInvestment({ ...newInvestment, actualClicks: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t.actualConversions}</Label>
                  <Input
                    type="number"
                    value={newInvestment.actualConversions}
                    onChange={(e) => setNewInvestment({ ...newInvestment, actualConversions: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm text-gray-400 mb-2">{language === 'ja' ? '予測データ（広告アラートから転記）' : '预测数据（从广告警报转录）'}</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">{t.predictedGmv}</Label>
                  <Input
                    type="number"
                    value={newInvestment.predictedGmv}
                    onChange={(e) => setNewInvestment({ ...newInvestment, predictedGmv: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{language === 'ja' ? '予測ROAS' : '预测ROAS'}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newInvestment.predictedRoas}
                    onChange={(e) => setNewInvestment({ ...newInvestment, predictedRoas: parseFloat(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">{language === 'ja' ? 'メモ' : '备注'}</Label>
              <Textarea
                value={newInvestment.notes}
                onChange={(e) => setNewInvestment({ ...newInvestment, notes: e.target.value })}
                placeholder={language === 'ja' ? 'メモを入力...' : '输入备注...'}
                className="bg-gray-900/50 border-gray-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddInvestmentDialogOpen(false)}
              className="border-gray-600"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleCreateInvestment}
              disabled={createInvestmentMutation.isPending || newInvestment.totalBudget <= 0}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
            >
              {createInvestmentMutation.isPending ? (language === 'ja' ? '追加中...' : '添加中...') : t.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Investment Record Dialog */}
      <Dialog open={editInvestmentDialogOpen} onOpenChange={setEditInvestmentDialogOpen}>
        <DialogContent className="bg-black/95 border-green-900/50 text-white max-w-lg backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <Edit2 className="h-5 w-5 text-green-400" />
              {t.addActualResults}
            </DialogTitle>
          </DialogHeader>

          {editingInvestment && (
            <div className="space-y-4">
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">{t.totalBudget}</div>
                <div className="text-xl font-bold text-white">¥{editingInvestment.totalBudget.toLocaleString()}</div>
                <div className="text-xs text-gray-500">
                  {new Date(editingInvestment.investmentDate).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'zh-CN')}
                  {editingInvestment.campaignName && ` - ${editingInvestment.campaignName}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">{t.actualGmv}</Label>
                  <Input
                    type="number"
                    value={editingInvestment.actualGmv || 0}
                    onChange={(e) => setEditingInvestment({ ...editingInvestment, actualGmv: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t.actualImpressions}</Label>
                  <Input
                    type="number"
                    value={editingInvestment.actualImpressions || 0}
                    onChange={(e) => setEditingInvestment({ ...editingInvestment, actualImpressions: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t.actualClicks}</Label>
                  <Input
                    type="number"
                    value={editingInvestment.actualClicks || 0}
                    onChange={(e) => setEditingInvestment({ ...editingInvestment, actualClicks: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t.actualConversions}</Label>
                  <Input
                    type="number"
                    value={editingInvestment.actualConversions || 0}
                    onChange={(e) => setEditingInvestment({ ...editingInvestment, actualConversions: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900/50 border-gray-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">{language === 'ja' ? 'メモ' : '备注'}</Label>
                <Textarea
                  value={editingInvestment.notes || ''}
                  onChange={(e) => setEditingInvestment({ ...editingInvestment, notes: e.target.value })}
                  className="bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditInvestmentDialogOpen(false);
                setEditingInvestment(null);
              }}
              className="border-gray-600"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleUpdateInvestment}
              disabled={updateInvestmentMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
            >
              {updateInvestmentMutation.isPending ? (language === 'ja' ? '更新中...' : '更新中...') : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ad Campaign Analysis Dialog */}
      <Dialog open={adCampaignDialogOpen} onOpenChange={setAdCampaignDialogOpen}>
        <DialogContent className="bg-black/95 border-blue-900/50 text-white max-w-4xl backdrop-blur-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-blue-400" />
              {language === 'ja' ? '広告実績・分析' : '广告实绩・分析'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stats Summary */}
            {adCampaignStats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-950/30 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-blue-300 text-sm">{language === 'ja' ? 'キャンペーン数' : '投放数'}</div>
                  <div className="text-2xl font-bold text-white">{adCampaignStats.campaignCount}</div>
                </div>
                <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-4">
                  <div className="text-green-300 text-sm">{language === 'ja' ? '総広告費' : '总广告费'}</div>
                  <div className="text-2xl font-bold text-white">¥{(adCampaignStats.totalSpend || 0).toLocaleString()}</div>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/30 rounded-lg p-4">
                  <div className="text-purple-300 text-sm">{language === 'ja' ? '総インプレッション' : '总曝光'}</div>
                  <div className="text-2xl font-bold text-white">{(adCampaignStats.totalImpressions || 0).toLocaleString()}</div>
                </div>
              </div>
            )}

            {/* File Upload Section */}
            <div className="border-2 border-dashed border-blue-500/50 rounded-xl p-6 text-center hover:border-blue-400/70 transition-colors">
              <input
                ref={adCampaignFileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setAdCampaignFile(file);
                  setAdCampaignAnalyzing(true);
                  setAdCampaignAnalysisResult(null);
                  
                  try {
                    // Upload file first
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('brandId', String(brandId));
                    const uploadResponse = await fetch('/api/brand-file-upload', {
                      method: 'POST',
                      body: formData,
                    });
                    const uploadResult = await uploadResponse.json();
                    
                    if (!uploadResult.url) {
                      throw new Error('File upload failed');
                    }
                    
                    // Analyze with AI
                    const result = await analyzeAdReportMutation.mutateAsync({
                      brandId,
                      fileUrl: uploadResult.url,
                      fileKey: uploadResult.key,
                      fileName: file.name,
                    });
                    
                    setAdCampaignAnalysisResult(result);
                    toast.success(language === 'ja' ? '分析完了' : '分析完成');
                  } catch (error) {
                    console.error('Analysis error:', error);
                    toast.error(language === 'ja' ? '分析に失敗しました' : '分析失败');
                  } finally {
                    setAdCampaignAnalyzing(false);
                  }
                }}
              />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-white">
                    {language === 'ja' ? '広告レポートをアップロード' : '上传广告报告'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {language === 'ja' ? 'PDF, Excel, CSV対応（日本語・中国語・英語）' : '支持PDF, Excel, CSV（日语・中文・英语）'}
                  </p>
                </div>
                <Button
                  onClick={() => adCampaignFileInputRef.current?.click()}
                  disabled={adCampaignAnalyzing}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {adCampaignAnalyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{language === 'ja' ? '分析中...' : '分析中...'}</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />{language === 'ja' ? 'ファイルを選択' : '选择文件'}</>
                  )}
                </Button>
              </div>
            </div>

            {/* Analysis Result */}
            {adCampaignAnalysisResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                    {language === 'ja' ? 'AI分析結果（確認・編集）' : 'AI分析结果（确认・编辑）'}
                  </h3>
                  <Badge className={`${adCampaignAnalysisResult.detectedLanguage === 'ja' ? 'bg-red-500/30 text-red-300' : adCampaignAnalysisResult.detectedLanguage === 'zh' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-blue-500/30 text-blue-300'}`}>
                    {adCampaignAnalysisResult.detectedLanguage === 'ja' ? '日本語' : adCampaignAnalysisResult.detectedLanguage === 'zh' ? '中文' : 'English'}
                  </Badge>
                </div>

                {/* Source Texts - AI読み取り原文 */}
                {adCampaignAnalysisResult.sourceTexts && adCampaignAnalysisResult.sourceTexts.length > 0 && (
                  <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-yellow-400 mb-2 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {language === 'ja' ? 'AIがレポートから読み取った原文' : 'AI从报告中读取的原文'}
                    </h4>
                    <div className="space-y-1">
                      {adCampaignAnalysisResult.sourceTexts.map((text: any, i: number) => (
                        <p key={i} className="text-xs text-yellow-200/70 font-mono">• {typeof text === 'string' ? text : `${text.label}: ${text.value}${text.mappedTo ? ` → ${text.mappedTo}` : ''}`}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Core Metrics - 核心指標（大きく表示） */}
                <div className="bg-gradient-to-br from-blue-950/40 to-purple-950/40 border border-blue-800/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {language === 'ja' ? '核心指標' : '核心指标'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-950/50 rounded-lg p-3">
                      <div className="text-xs text-blue-300 mb-1">{language === 'ja' ? '動画露出回数（インプレッション）' : '视频曝光次数'}</div>
                      <Input
                        type="number"
                        value={adCampaignAnalysisResult.impressions || 0}
                        onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, impressions: Number(e.target.value)})}
                        className="bg-transparent border-blue-700/50 text-white text-xl font-bold h-10"
                      />
                    </div>
                    <div className="bg-green-950/50 rounded-lg p-3">
                      <div className="text-xs text-green-300 mb-1">{language === 'ja' ? '広告費（実費）' : '广告费（实际）'}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-green-300 text-xl">¥</span>
                        <Input
                          type="number"
                          value={adCampaignAnalysisResult.actualSpend || 0}
                          onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, actualSpend: Number(e.target.value)})}
                          className="bg-transparent border-green-700/50 text-white text-xl font-bold h-10"
                        />
                      </div>
                    </div>
                    <div className="bg-cyan-950/50 rounded-lg p-3">
                      <div className="text-xs text-cyan-300 mb-1">{language === 'ja' ? '集中視聴数（6秒以上）' : '集中观看数（6秒以上）'}</div>
                      <Input
                        type="number"
                        value={adCampaignAnalysisResult.views6s || 0}
                        onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, views6s: Number(e.target.value)})}
                        className="bg-transparent border-cyan-700/50 text-white text-xl font-bold h-10"
                      />
                    </div>
                    <div className="bg-purple-950/50 rounded-lg p-3">
                      <div className="text-xs text-purple-300 mb-1">{language === 'ja' ? '単回露出コスト（CPM）' : '单次曝光成本'}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-purple-300 text-xl">¥</span>
                        <Input
                          type="number"
                          step="0.001"
                          value={adCampaignAnalysisResult.costPerUnit || (adCampaignAnalysisResult.impressions > 0 ? (adCampaignAnalysisResult.actualSpend / adCampaignAnalysisResult.impressions).toFixed(3) : 0)}
                          onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, costPerUnit: Number(e.target.value)})}
                          className="bg-transparent border-purple-700/50 text-white text-xl font-bold h-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campaign Info */}
                <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">{language === 'ja' ? 'キャンペーン情報' : '投放信息'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 text-xs">{language === 'ja' ? 'キャンペーン名' : '投放名称'}</Label>
                      <Input
                        value={adCampaignAnalysisResult.campaignName || ''}
                        onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, campaignName: e.target.value})}
                        className="bg-gray-800/50 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">{language === 'ja' ? 'プラットフォーム' : '平台'}</Label>
                      <Select
                        value={adCampaignAnalysisResult.platform || 'tiktok'}
                        onValueChange={(value) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, platform: value})}
                      >
                        <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="other">{language === 'ja' ? 'その他' : '其他'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 text-xs">
                        {language === 'ja' ? '広告目的' : '广告目标'}
                        <span className="ml-2 text-xs text-blue-400">
                          (AI信頼度: {adCampaignAnalysisResult.objectiveConfidence || 0}%)
                        </span>
                      </Label>
                      <Select
                        value={adCampaignAnalysisResult.objective || 'impressions'}
                        onValueChange={(value) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, objective: value})}
                      >
                        <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="impressions">{language === 'ja' ? 'インプレッション（認知拡大）' : '曝光（认知扩大）'}</SelectItem>
                          <SelectItem value="clicks">{language === 'ja' ? 'クリック（サイト誘導）' : '点击（网站引流）'}</SelectItem>
                          <SelectItem value="conversions">{language === 'ja' ? 'コンバージョン（購入促進）' : '转化（购买促进）'}</SelectItem>
                          <SelectItem value="awareness">{language === 'ja' ? 'ブランド認知' : '品牌认知'}</SelectItem>
                          <SelectItem value="engagement">{language === 'ja' ? 'エンゲージメント' : '互动'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">{language === 'ja' ? '期間' : '期间'}</Label>
                      <div className="text-sm text-white bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2">
                        {adCampaignAnalysisResult.startDate || '?'} ~ {adCampaignAnalysisResult.endDate || '?'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Metrics - 詳細指標（編集可能） */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">{language === 'ja' ? '詳細パフォーマンス指標（編集可能）' : '详细性能指标（可编辑）'}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <Label className="text-xs text-blue-300">{language === 'ja' ? '視聴数' : '观看数'}</Label>
                      <Input type="number" value={adCampaignAnalysisResult.views || 0} onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, views: Number(e.target.value)})} className="bg-transparent border-gray-700 text-white text-sm h-8" />
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <Label className="text-xs text-green-300">{language === 'ja' ? 'クリック' : '点击'}</Label>
                      <Input type="number" value={adCampaignAnalysisResult.clicks || 0} onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, clicks: Number(e.target.value)})} className="bg-transparent border-gray-700 text-white text-sm h-8" />
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <Label className="text-xs text-amber-300">GMV</Label>
                      <Input type="number" value={adCampaignAnalysisResult.gmv || 0} onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, gmv: Number(e.target.value)})} className="bg-transparent border-gray-700 text-white text-sm h-8" />
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <Label className="text-xs text-orange-300">{language === 'ja' ? 'コンバージョン' : '转化'}</Label>
                      <Input type="number" value={adCampaignAnalysisResult.conversions || 0} onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, conversions: Number(e.target.value)})} className="bg-transparent border-gray-700 text-white text-sm h-8" />
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <Label className="text-xs text-pink-300">{language === 'ja' ? '注文数' : '订单数'}</Label>
                      <Input type="number" value={adCampaignAnalysisResult.orderCount || 0} onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, orderCount: Number(e.target.value)})} className="bg-transparent border-gray-700 text-white text-sm h-8" />
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <Label className="text-xs text-rose-300">{language === 'ja' ? 'カート追加' : '加购物车'}</Label>
                      <Input type="number" value={adCampaignAnalysisResult.cartAdds || 0} onChange={(e) => setAdCampaignAnalysisResult({...adCampaignAnalysisResult, cartAdds: Number(e.target.value)})} className="bg-transparent border-gray-700 text-white text-sm h-8" />
                    </div>
                  </div>
                </div>

                {/* Country Breakdown */}
                {adCampaignAnalysisResult.countryBreakdown && adCampaignAnalysisResult.countryBreakdown.length > 0 && (
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">{language === 'ja' ? '国別パフォーマンス' : '国家分布'}</h4>
                    <div className="space-y-2">
                      {adCampaignAnalysisResult.countryBreakdown.map((country: any, index: number) => {
                        const totalImpressions = adCampaignAnalysisResult.impressions || 0;
                        const totalClicks = adCampaignAnalysisResult.clicks || 0;
                        const totalGmv = adCampaignAnalysisResult.gmv || 0;
                        const countryImpressions = Math.round(totalImpressions * (country.percentage / 100));
                        const countryClicks = Math.round(totalClicks * (country.percentage / 100));
                        const countryGmv = Math.round(totalGmv * (country.percentage / 100));
                        return (
                        <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {country.countryCode === 'ID' ? '🇮🇩' :
                                 country.countryCode === 'TH' ? '🇹🇭' :
                                 country.countryCode === 'PH' ? '🇵🇭' :
                                 country.countryCode === 'VN' ? '🇻🇳' :
                                 country.countryCode === 'MY' ? '🇲🇾' :
                                 country.countryCode === 'KH' ? '🇰🇭' : '🌏'}
                              </span>
                              <span className="text-white text-sm font-medium">{country.countryName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-gray-700 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${country.percentage}%` }} />
                              </div>
                              <span className="text-blue-300 font-bold text-sm w-10 text-right">{country.percentage}%</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 ml-7 text-xs">
                            <span className="text-gray-500">{language === 'ja' ? '露出' : '曝光'}: <span className="text-blue-300">{countryImpressions.toLocaleString()}</span></span>
                            <span className="text-gray-500">{language === 'ja' ? 'クリック' : '点击'}: <span className="text-green-300">{countryClicks.toLocaleString()}</span></span>
                            <span className="text-gray-500">GMV: <span className="text-amber-300">¥{countryGmv.toLocaleString()}</span></span>
                          </div>
                        </div>
                      );})}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  {/* Auto-fill to Ad Investment Form Button */}
                  <Button
                    onClick={() => {
                      const r = adCampaignAnalysisResult;
                      setNewInvestment(prev => ({
                        ...prev,
                        investmentDate: r?.startDate ? new Date(r.startDate).toISOString().split('T')[0] : prev.investmentDate,
                        totalBudget: r?.actualSpend || r?.budget || prev.totalBudget,
                        campaignName: r?.campaignName || prev.campaignName,
                        actualGmv: r?.gmv || prev.actualGmv,
                        actualImpressions: r?.impressions || prev.actualImpressions,
                        actualClicks: r?.clicks || prev.actualClicks,
                        actualConversions: r?.conversions || prev.actualConversions,
                        predictedRoas: (r?.gmv && (r?.actualSpend || r?.budget)) ? Math.round((r.gmv / (r?.actualSpend || r?.budget)) * 100) / 100 : prev.predictedRoas,
                        notes: `${r?.campaignName || ''} (${r?.platform || ''}) ${r?.startDate || ''} ~ ${r?.endDate || ''}`.trim(),
                      }));
                      setAdCampaignDialogOpen(false);
                      setAddInvestmentDialogOpen(true);
                      toast.success(language === 'ja' ? 'AI分析結果を広告実績フォームに自動入力しました' : 'AI分析结果已自动填写到广告实绩表单');
                    }}
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium py-3"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {language === 'ja' ? '広告実績フォームに自動入力' : '自动填写到广告实绩表单'}
                  </Button>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAdCampaignAnalysisResult(null);
                        setAdCampaignFile(null);
                      }}
                      className="border-gray-600"
                    >
                      {language === 'ja' ? 'クリア' : '清除'}
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          // Map objective values from AI analysis to DB enum values
                          const objectiveMap: Record<string, 'impression' | 'click' | 'conversion' | 'engagement' | 'other'> = {
                            'impressions': 'impression',
                            'clicks': 'click',
                            'conversions': 'conversion',
                            'awareness': 'other',
                            'engagement': 'engagement',
                            'impression': 'impression',
                            'click': 'click',
                            'conversion': 'conversion',
                            'other': 'other',
                          };
                          const mappedObjective = objectiveMap[adCampaignAnalysisResult.objective] || 'impression';
                          
                          await createAdCampaignMutation.mutateAsync({
                            brandId,
                            campaignName: adCampaignAnalysisResult.campaignName || adCampaignAnalysisResult.name || 'キャンペーン',
                            platform: adCampaignAnalysisResult.platform || 'tiktok',
                            objective: mappedObjective,
                            objectiveConfidence: adCampaignAnalysisResult.objectiveConfidence,
                            startDate: adCampaignAnalysisResult.startDate,
                            endDate: adCampaignAnalysisResult.endDate,
                            budget: Number(adCampaignAnalysisResult.budget) || undefined,
                            adSpend: Number(adCampaignAnalysisResult.actualSpend) || undefined,
                            status: 'completed',
                            reportLanguage: (adCampaignAnalysisResult.detectedLanguage as 'ja' | 'zh' | 'en') || 'ja',
                            reportFileUrl: adCampaignAnalysisResult.sourceFileUrl,
                            reportFileKey: adCampaignAnalysisResult.sourceFileKey,
                            impressions: Number(adCampaignAnalysisResult.impressions) || undefined,
                            views: Number(adCampaignAnalysisResult.views) || undefined,
                            views6sPlus: Number(adCampaignAnalysisResult.views6s) || undefined,
                            clicks: Number(adCampaignAnalysisResult.clicks) || undefined,
                            salesCount: Number(adCampaignAnalysisResult.orderCount) || undefined,
                            gmv: Number(adCampaignAnalysisResult.gmv) || undefined,
                            cartAdds: Number(adCampaignAnalysisResult.cartAdds) || undefined,
                            countryBreakdown: adCampaignAnalysisResult.countryBreakdown,
                          });
                          toast.success(language === 'ja' ? 'キャンペーンを保存しました' : '已保存投放');
                          setAdCampaignAnalysisResult(null);
                          setAdCampaignFile(null);
                          refetchAdCampaigns();
                        } catch (error: any) {
                          console.error('Campaign save error:', error);
                          const errorMsg = error?.message || '';
                          toast.error(language === 'ja' ? `保存に失敗しました: ${errorMsg.slice(0, 100)}` : `保存失败: ${errorMsg.slice(0, 100)}`);
                        }
                      }}
                      disabled={createAdCampaignMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                    >
                      {createAdCampaignMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{language === 'ja' ? '保存中...' : '保存中...'}</>
                      ) : (
                        <><Save className="h-4 w-4 mr-2" />{language === 'ja' ? 'キャンペーンを保存' : '保存投放'}</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Campaigns List */}
            {adCampaigns.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white">{language === 'ja' ? '保存済みキャンペーン' : '已保存的投放'}</h3>
                <div className="space-y-2">
                  {adCampaigns.map((campaign: any) => (
                    <div
                      key={campaign.id}
                      className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800/70 hover:border-cyan-500/50 transition-all group"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge className={`${campaign.platform === 'tiktok' ? 'bg-pink-500/30 text-pink-300' : 'bg-blue-500/30 text-blue-300'}`}>
                            {campaign.platform.toUpperCase()}
                          </Badge>
                          <span className="font-medium text-white truncate">{campaign.campaignName}</span>
                          <Badge className={`${campaign.objective === 'impression' ? 'bg-blue-500/20 text-blue-300' : campaign.objective === 'click' ? 'bg-green-500/20 text-green-300' : 'bg-purple-500/20 text-purple-300'}`}>
                            {campaign.objective === 'impression' ? (language === 'ja' ? 'インプレッション' : '曝光') :
                             campaign.objective === 'click' ? (language === 'ja' ? 'クリック' : '点击') :
                             campaign.objective === 'conversion' ? (language === 'ja' ? 'コンバージョン' : '转化') :
                             campaign.objective}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-green-400 font-medium">¥{(campaign.budget || 0).toLocaleString()}</span>
                          <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(language === 'ja' ? 'このキャンペーンを削除しますか？' : '确定删除此投放？')) {
                                await deleteAdCampaignMutation.mutateAsync({ id: campaign.id });
                                refetchAdCampaigns();
                                toast.success(language === 'ja' ? '削除しました' : '已删除');
                              }
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload History */}
            {reportFileHistory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  {language === 'ja' ? 'アップロード履歴' : '上传历史'}
                  <Badge className="bg-gray-700 text-gray-300 text-xs">{reportFileHistory.length}</Badge>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {reportFileHistory.map((file: any) => (
                    <div
                      key={file.id}
                      className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-800/70 hover:border-blue-500/50 transition-all group"
                      onClick={() => {
                        if (file.fileUrl) {
                          const ft = file.fileType?.toLowerCase() || '';
                          if (ft === 'pdf' || ft === 'png' || ft === 'jpg' || ft === 'jpeg' || ft === 'webp') {
                            setPreviewFileUrl(file.fileUrl);
                            setPreviewFileName(file.fileName);
                            setPreviewFileType(ft);
                            setPreviewFileAnalysis(file.analysisResult || null);
                            setShowAnalysisPanel(true);
                          } else {
                            window.open(file.fileUrl, '_blank');
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            file.fileType === 'pdf' ? 'bg-red-500/20 text-red-400' :
                            file.fileType === 'xlsx' || file.fileType === 'xls' ? 'bg-green-500/20 text-green-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {file.fileType?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate group-hover:text-blue-300 transition-colors">{file.fileName}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{new Date(file.createdAt).toLocaleDateString('ja-JP')}</span>
                              <span>・</span>
                              <span>{file.uploadedByName}</span>
                              {file.fileSize && (
                                <><span>・</span><span>{file.fileSize > 1048576 ? `${(file.fileSize / 1048576).toFixed(1)}MB` : `${Math.round(file.fileSize / 1024)}KB`}</span></>
                              )}
                              {file.analysisStatus === 'completed' && (
                                <Badge className="bg-green-500/20 text-green-400 text-xs">分析済み</Badge>
                              )}
                              {file.analysisStatus === 'failed' && (
                                <Badge className="bg-red-500/20 text-red-400 text-xs">失敗</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {file.fileUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); window.open(file.fileUrl, '_blank'); }}
                              className="text-blue-400 hover:text-blue-300"
                              title={language === 'ja' ? '新しいタブで開く' : '在新标签页中打开'}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(language === 'ja' ? 'このファイル履歴を削除しますか？' : '确定删除此文件记录？')) {
                                await deleteReportFileMutation.mutateAsync({ id: file.id });
                                refetchReportFileHistory();
                                toast.success(language === 'ja' ? '削除しました' : '已删除');
                              }
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdCampaignDialogOpen(false)}
              className="border-blue-500/50 bg-blue-950/50 text-gray-200 hover:bg-blue-900/40 hover:text-white"
            >
              {language === 'ja' ? '閉じる' : '关闭'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFileUrl} onOpenChange={(open) => { if (!open) { setPreviewFileUrl(null); setPreviewFileName(''); setPreviewFileType(''); setPreviewFileAnalysis(null); } }}>
        <DialogContent className="bg-black/95 border-blue-900/50 text-white max-w-6xl h-[90vh] backdrop-blur-xl p-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                previewFileType === 'pdf' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {previewFileType?.toUpperCase()}
              </div>
              <p className="text-sm text-white truncate">{previewFileName}</p>
            </div>
            <div className="flex items-center gap-2">
              {previewFileAnalysis && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
                  className={showAnalysisPanel ? 'text-cyan-400 hover:text-cyan-300' : 'text-gray-400 hover:text-gray-300'}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {language === 'ja' ? 'AI分析' : 'AI分析'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => previewFileUrl && window.open(previewFileUrl, '_blank')}
                className="text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {language === 'ja' ? '新しいタブで開く' : '在新标签页中打开'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (previewFileUrl) {
                    const a = document.createElement('a');
                    a.href = previewFileUrl;
                    a.download = previewFileName;
                    a.click();
                  }
                }}
                className="text-green-400 hover:text-green-300"
              >
                <Download className="h-4 w-4 mr-1" />
                {language === 'ja' ? 'ダウンロード' : '下载'}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex">
            {/* File Preview */}
            <div className={`${previewFileAnalysis && showAnalysisPanel ? 'flex-1' : 'w-full'} overflow-hidden`}>
              {previewFileType === 'pdf' ? (
                <iframe
                  src={previewFileUrl || ''}
                  className="w-full h-full border-0"
                  title={previewFileName}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={previewFileUrl || ''}
                    alt={previewFileName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </div>

            {/* AI Analysis Panel */}
            {previewFileAnalysis && showAnalysisPanel && (
              <div className="w-80 border-l border-gray-800 overflow-y-auto bg-gray-950/50">
                <div className="p-4 space-y-4">
                  <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI分析結果
                  </h3>

                  {/* キャンペーン名 */}
                  {previewFileAnalysis.campaignName && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">キャンペーン名</p>
                      <p className="text-sm text-white font-medium">{previewFileAnalysis.campaignName}</p>
                    </div>
                  )}

                  {/* プラットフォーム・目的 */}
                  <div className="flex gap-2">
                    {previewFileAnalysis.platform && (
                      <Badge className="bg-purple-500/20 text-purple-300 text-xs">{previewFileAnalysis.platform}</Badge>
                    )}
                    {previewFileAnalysis.objective && (
                      <Badge className="bg-blue-500/20 text-blue-300 text-xs">{previewFileAnalysis.objective}</Badge>
                    )}
                  </div>

                  {/* 期間 */}
                  {(previewFileAnalysis.startDate || previewFileAnalysis.endDate) && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">期間</p>
                      <p className="text-sm text-gray-300">
                        {previewFileAnalysis.startDate || '?'} 〜 {previewFileAnalysis.endDate || '?'}
                      </p>
                    </div>
                  )}

                  {/* 主要指標 */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">主要指標</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(previewFileAnalysis.actualSpend || previewFileAnalysis.budget) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">広告費</p>
                          <p className="text-sm font-bold text-white">¥{Number(previewFileAnalysis.actualSpend || previewFileAnalysis.budget || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.impressions || previewFileAnalysis.impressions) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">インプレッション</p>
                          <p className="text-sm font-bold text-white">{Number(previewFileAnalysis.metrics?.impressions || previewFileAnalysis.impressions || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.clicks || previewFileAnalysis.clicks) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">クリック</p>
                          <p className="text-sm font-bold text-white">{Number(previewFileAnalysis.metrics?.clicks || previewFileAnalysis.clicks || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.views || previewFileAnalysis.views) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">視聴数</p>
                          <p className="text-sm font-bold text-white">{Number(previewFileAnalysis.metrics?.views || previewFileAnalysis.views || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.conversions || previewFileAnalysis.conversions) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">CV</p>
                          <p className="text-sm font-bold text-white">{Number(previewFileAnalysis.metrics?.conversions || previewFileAnalysis.conversions || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.gmv || previewFileAnalysis.gmv) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">GMV</p>
                          <p className="text-sm font-bold text-white">¥{Number(previewFileAnalysis.metrics?.gmv || previewFileAnalysis.gmv || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.orderCount || previewFileAnalysis.orderCount) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">注文数</p>
                          <p className="text-sm font-bold text-white">{Number(previewFileAnalysis.metrics?.orderCount || previewFileAnalysis.orderCount || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {(previewFileAnalysis.metrics?.cartAdds || previewFileAnalysis.cartAdds) ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">カート追加</p>
                          <p className="text-sm font-bold text-white">{Number(previewFileAnalysis.metrics?.cartAdds || previewFileAnalysis.cartAdds || 0).toLocaleString()}</p>
                        </div>
                      ) : null}
                      {previewFileAnalysis.costPerUnit ? (
                        <div className="bg-gray-900/80 rounded-lg p-2">
                          <p className="text-xs text-gray-500">単価</p>
                          <p className="text-sm font-bold text-white">¥{Number(previewFileAnalysis.costPerUnit).toLocaleString()}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* 国別内訳 */}
                  {previewFileAnalysis.countryBreakdown && previewFileAnalysis.countryBreakdown.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">国別内訳</p>
                      <div className="space-y-1">
                        {previewFileAnalysis.countryBreakdown.map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-gray-900/60 rounded px-2 py-1">
                            <span className="text-gray-300">{c.country || c.name}</span>
                            <span className="text-white font-medium">
                              {c.spend ? `¥${Number(c.spend).toLocaleString()}` : ''}
                              {c.impressions ? ` / ${Number(c.impressions).toLocaleString()} imp` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 検出言語 */}
                  {previewFileAnalysis.detectedLanguage && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">検出言語</p>
                      <Badge className="bg-gray-700 text-gray-300 text-xs">
                        {previewFileAnalysis.detectedLanguage === 'ja' ? '日本語' : previewFileAnalysis.detectedLanguage === 'zh' ? '中国語' : previewFileAnalysis.detectedLanguage === 'en' ? '英語' : previewFileAnalysis.detectedLanguage}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={!!selectedCampaignId} onOpenChange={(open) => { if (!open) setSelectedCampaignId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-950 border-gray-700">
          {campaignDetailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <span className="ml-3 text-gray-400">{language === 'ja' ? '読み込み中...' : '加载中...'}</span>
            </div>
          ) : campaignDetail ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={`text-sm ${campaignDetail.platform === 'tiktok' ? 'bg-pink-500/30 text-pink-300' : 'bg-blue-500/30 text-blue-300'}`}>
                    {campaignDetail.platform.toUpperCase()}
                  </Badge>
                  <h2 className="text-xl font-bold text-white">{campaignDetail.campaignName}</h2>
                  <Badge className={`${campaignDetail.objective === 'impression' ? 'bg-blue-500/20 text-blue-300' : campaignDetail.objective === 'click' ? 'bg-green-500/20 text-green-300' : 'bg-purple-500/20 text-purple-300'}`}>
                    {campaignDetail.objective === 'impression' ? (language === 'ja' ? 'インプレッション' : '曝光') :
                     campaignDetail.objective === 'click' ? (language === 'ja' ? 'クリック' : '点击') :
                     campaignDetail.objective === 'conversion' ? (language === 'ja' ? 'コンバージョン' : '转化') :
                     campaignDetail.objective}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {campaignDetail.startDate ? new Date(campaignDetail.startDate).toLocaleDateString() : '?'} 〜 {campaignDetail.endDate ? new Date(campaignDetail.endDate).toLocaleDateString() : '?'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    {campaignDetail.reportLanguage === 'ja' ? '日本語' : campaignDetail.reportLanguage === 'zh' ? '中国語' : '英語'}
                  </span>
                </div>
              </div>

              {/* Budget & Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-xs text-green-400 mb-1">{language === 'ja' ? '予算' : '预算'}</p>
                  <p className="text-lg font-bold text-white">¥{(campaignDetail.budget || 0).toLocaleString()}</p>
                </div>
                {campaignDetail.metrics && (
                  <>
                    {campaignDetail.metrics.adSpend != null && (
                      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                        <p className="text-xs text-cyan-400 mb-1">{language === 'ja' ? '広告費' : '广告费'}</p>
                        <p className="text-lg font-bold text-white">¥{Number(campaignDetail.metrics.adSpend).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.impressions != null && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <p className="text-xs text-blue-400 mb-1">{language === 'ja' ? 'インプレッション' : '曝光'}</p>
                        <p className="text-lg font-bold text-white">{Number(campaignDetail.metrics.impressions).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.clicks != null && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                        <p className="text-xs text-purple-400 mb-1">{language === 'ja' ? 'クリック' : '点击'}</p>
                        <p className="text-lg font-bold text-white">{Number(campaignDetail.metrics.clicks).toLocaleString()}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Detailed Metrics */}
              {campaignDetail.metrics && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{language === 'ja' ? '詳細指標' : '详细指标'}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {campaignDetail.metrics.views != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{language === 'ja' ? '視聴数' : '观看数'}</p>
                        <p className="text-sm font-bold text-white">{Number(campaignDetail.metrics.views).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.views6sPlus != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">6s+{language === 'ja' ? '視聴' : '观看'}</p>
                        <p className="text-sm font-bold text-white">{Number(campaignDetail.metrics.views6sPlus).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.productClicks != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{language === 'ja' ? '商品クリック' : '商品点击'}</p>
                        <p className="text-sm font-bold text-white">{Number(campaignDetail.metrics.productClicks).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.cartAdds != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{language === 'ja' ? 'カート追加' : '加购'}</p>
                        <p className="text-sm font-bold text-white">{Number(campaignDetail.metrics.cartAdds).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.salesCount != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{language === 'ja' ? '販売数' : '销量'}</p>
                        <p className="text-sm font-bold text-white">{Number(campaignDetail.metrics.salesCount).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.gmv != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">GMV</p>
                        <p className="text-sm font-bold text-white">¥{Number(campaignDetail.metrics.gmv).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.cpm != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">CPM</p>
                        <p className="text-sm font-bold text-white">¥{Number(campaignDetail.metrics.cpm).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.cpc != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">CPC</p>
                        <p className="text-sm font-bold text-white">¥{Number(campaignDetail.metrics.cpc).toLocaleString()}</p>
                      </div>
                    )}
                    {campaignDetail.metrics.roas != null && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">ROAS</p>
                        <p className="text-sm font-bold text-white">{Number(campaignDetail.metrics.roas).toFixed(2)}x</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Country Breakdown */}
              {campaignDetail.countryBreakdown && campaignDetail.countryBreakdown.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {language === 'ja' ? '国別内訳' : '国家分布'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {campaignDetail.countryBreakdown.map((cb: any, i: number) => (
                      <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cb.countryCode === 'ID' ? '🇮🇩' : cb.countryCode === 'TH' ? '🇹🇭' : cb.countryCode === 'PH' ? '🇵🇭' : cb.countryCode === 'VN' ? '🇻🇳' : cb.countryCode === 'MY' ? '🇲🇾' : cb.countryCode === 'SG' ? '🇸🇬' : cb.countryCode === 'JP' ? '🇯🇵' : '🌏'}</span>
                          <span className="text-sm font-medium text-white">{cb.countryCode}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {cb.percentage != null && <span className="text-gray-400">{Number(cb.percentage).toFixed(1)}%</span>}
                          {cb.impressions != null && <span className="text-blue-400">{Number(cb.impressions).toLocaleString()} imp</span>}
                          {cb.gmv != null && <span className="text-green-400">¥{Number(cb.gmv).toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Report PDF */}
              {campaignDetail.reportFileUrl && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {language === 'ja' ? 'レポートファイル' : '报告文件'}
                  </h3>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden">
                    <iframe
                      src={campaignDetail.reportFileUrl}
                      className="w-full h-[400px]"
                      title="Campaign Report"
                    />
                    <div className="flex items-center justify-end gap-2 p-2 border-t border-gray-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(campaignDetail.reportFileUrl || '', '_blank')}
                        className="text-gray-300 border-gray-600 hover:bg-gray-800"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {language === 'ja' ? '新しいタブで開く' : '新标签打开'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = campaignDetail.reportFileUrl || '';
                          a.download = `${campaignDetail.campaignName}_report`;
                          a.click();
                        }}
                        className="text-gray-300 border-gray-600 hover:bg-gray-800"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {language === 'ja' ? 'ダウンロード' : '下载'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* No metrics message */}
              {!campaignDetail.metrics && (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>{language === 'ja' ? '詳細指標データはまだありません' : '暂无详细指标数据'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <p>{language === 'ja' ? 'キャンペーンが見つかりません' : '未找到投放'}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 手卤（商品紹介カード）ダイアログ */}
      <Dialog open={tekaDialogOpen} onOpenChange={setTekaDialogOpen}>
        <DialogContent className="bg-white border-2 border-orange-300 w-[98vw] !max-w-[1400px] h-[95vh] overflow-hidden p-0 shadow-xl" showCloseButton={false}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
              <DialogTitle className="text-gray-900 flex items-center gap-3 text-xl font-bold">
                <CreditCard className="h-6 w-6 text-orange-500" />
                {language === 'ja' ? '商品紹介カード（手卤）' : '商品介绍卡（手卡）'}
                {tekaProduct && <span className="text-orange-600">- {tekaProduct.productName}</span>}
              </DialogTitle>
              <Button
                variant="outline"
                onClick={() => setTekaDialogOpen(false)}
                className="border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4 mr-1" />
                {language === 'ja' ? '閉じる' : '关闭'}
              </Button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {tekaProduct && (
                <ProductCardTemplate
                  product={tekaProduct}
                  brand={brand ? { name: brand.name, nameJa: brand.nameJa, logoUrl: brand.logoUrl } : null}
                  showDownload={true}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
