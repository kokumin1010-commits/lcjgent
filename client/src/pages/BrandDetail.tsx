import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ArrowLeft, Plus, Trash2, Edit2, TrendingUp, ImageIcon, X, Package, Calendar, DollarSign, Percent, Users, Video, Clock, Eye, ShoppingCart, Tag, Sparkles, FileText, Truck, MessageSquare, CheckCircle2, AlertCircle, PauseCircle, XCircle, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const translations = {
  ja: {
    title: "ブランド詳細",
    basicInfo: "基本情報",
    brandName: "ブランド名",
    companyName: "会社名",
    category: "カテゴリー",
    phoneNumber: "電話番号",
    email: "メールアドレス",
    contactPerson: "担当者名",
    status: "ステータス",
    adBudget: "広告費",
    salesTarget: "売上目標",
    commissionRate: "成果報酬",
    memo: "メモ",
    products: "商品一覧",
    addProduct: "商品追加",
    productName: "商品名",
    listPrice: "定価",
    specialPrice: "特価",
    discountRate: "割引率",
    sampleProduct: "サンプル商品",
    productCode: "商品コード",
    influencer: "インフルエンサー",
    purchasePrice: "仕入価格",
    remarks: "備考",
    activities: "対応履歴",
    addActivity: "対応履歴追加",
    activityDate: "対応日",
    activityType: "対応内容",
    nextAction: "次のアクション",
    content: "内容",
    noProducts: "商品がありません",
    noActivities: "対応履歴がありません",
    edit: "編集",
    delete: "削除",
    save: "保存",
    cancel: "キャンセル",
    inProgress: "進行中",
    meeting: "打ち合わせ中",
    completed: "完了",
    success: "保存しました",
    error: "エラーが発生しました",
    selectStaff: "スタッフを選択",
    // Livestream
    livestreams: "直播履歴",
    addLivestream: "直播履歴追加",
    livestreamDate: "直播日",
    streamerName: "直播達人",
    salesAmount: "営業額",
    duration: "直播時間（分）",
    viewerCount: "視聴者数",
    orderCount: "注文数",
    platform: "プラットフォーム",
    noLivestreams: "直播履歴がありません",
    totalSales: "総売上",
    totalStreams: "総配信数",
    avgSales: "平均売上",
    // 追加メトリクス
    productClicks: "商品クリック数",
    impressions: "インプレッション数",
    salesCount: "販売件数",
    gmv: "GMV",
    cartAddCount: "カート追加回数",
    productImages: "商品画像",
    uploadImages: "画像をアップロード（最大2枚）",
    uploading: "アップロード中...",
    lcjStaff: "LCJ担当者",
    addLcjStaff: "LCJ担当者を追加",
    noLcjStaff: "LCJ担当者が設定されていません",
    selectLcjStaff: "LCJ担当者を選択",
    // Contract
    contracts: "契約中のサービス",
    addContract: "契約を追加",
    serviceType: "サービスタイプ",
    contractType: "契約タイプ",
    tsp: "TSP（店舗運営代行）",
    liveCommerce: "ライブコマース",
    adManagement: "広告運用代行",
    snsManagement: "SNS運用代行",
    otherService: "その他",
    fixedFee: "固定費",
    commissionRateContract: "成果報酬",
    contractPeriod: "契約期間",
    contractStatus: "ステータス",
    contractMemo: "メモ",
    noContracts: "契約がありません",
    startDate: "開始日",
    endDate: "終了日",
    monthlyContract: "月額契約",
    annualContract: "年間契約",
    oneTimeContract: "単発契約",
    adCampaign: "広告案件",
    otherContract: "その他",
    contractActive: "契約中",
    contractCompleted: "完了",
    contractOnHold: "保留",
    contractEnded: "終了",
    perMonth: "/月",
    // AI商品登録
    aiProductRegister: "AI画像から商品登録",
    uploadProposalImage: "提案書画像をアップロード",
    analyzing: "AI解析中...",
    extractedInfo: "抽出された情報",
    confirmAndRegister: "確認して登録",
    releaseDate: "発売日",
    stock: "在庫数",
    catchCopy: "キャッチコピー",
    productDetails: "商品詳細",
    shippingInfo: "配送情報",
    aiExtractFailed: "AI解析に失敗しました",
    noImageSelected: "画像を選択してください",
    // 商品詳細ダイアログ
    productDetail: "商品詳細",
    proposalImage: "提案書画像",
    noProposalImage: "提案書画像なし",
    close: "閉じる",
  },
  zh: {
    title: "品牌详情",
    basicInfo: "基本信息",
    brandName: "品牌名",
    companyName: "公司名",
    category: "类别",
    phoneNumber: "电话号码",
    email: "邮箱地址",
    contactPerson: "负责人",
    status: "状态",
    adBudget: "广告费",
    salesTarget: "销售目标",
    commissionRate: "成果报酬",
    memo: "备注",
    products: "商品列表",
    addProduct: "添加商品",
    productName: "商品名",
    listPrice: "定价",
    specialPrice: "特价",
    discountRate: "折扣率",
    sampleProduct: "样品商品",
    productCode: "商品代码",
    influencer: "网红",
    purchasePrice: "进价",
    remarks: "备注",
    activities: "对应历史",
    addActivity: "添加对应历史",
    activityDate: "对应日期",
    activityType: "对应内容",
    nextAction: "下一步行动",
    content: "内容",
    noProducts: "没有商品",
    noActivities: "没有对应历史",
    edit: "编辑",
    delete: "删除",
    save: "保存",
    cancel: "取消",
    inProgress: "进行中",
    meeting: "洽谈中",
    completed: "完成",
    success: "保存成功",
    error: "发生错误",
    selectStaff: "选择员工",
    // Livestream
    livestreams: "直播历史",
    addLivestream: "添加直播记录",
    livestreamDate: "直播日期",
    streamerName: "直播达人",
    salesAmount: "营业额",
    duration: "直播时长（分钟）",
    viewerCount: "观看人数",
    orderCount: "订单数",
    platform: "平台",
    noLivestreams: "没有直播记录",
    totalSales: "总销售额",
    totalStreams: "总直播数",
    avgSales: "平均销售额",
    // 追加指标
    productClicks: "商品点击数",
    impressions: "商品曝光数",
    salesCount: "销售件数",
    gmv: "GMV",
    cartAddCount: "加购物车次数",
    productImages: "商品图片",
    uploadImages: "上传图片（最多2张）",
    uploading: "上传中...",
    lcjStaff: "LCJ负责人",
    addLcjStaff: "添加LCJ负责人",
    noLcjStaff: "未设置LCJ负责人",
    selectLcjStaff: "选择LCJ负责人",
    // Contract
    contracts: "合同中的服务",
    addContract: "添加合同",
    serviceType: "服务类型",
    contractType: "合同类型",
    tsp: "TSP（店铺运营代理）",
    liveCommerce: "直播电商",
    adManagement: "广告运营代理",
    snsManagement: "SNS运营代理",
    otherService: "其他",
    fixedFee: "固定费用",
    commissionRateContract: "成果报酬",
    contractPeriod: "合同期限",
    contractStatus: "状态",
    contractMemo: "备注",
    noContracts: "没有合同",
    startDate: "开始日期",
    endDate: "结束日期",
    monthlyContract: "月度合同",
    annualContract: "年度合同",
    oneTimeContract: "单次合同",
    adCampaign: "广告项目",
    otherContract: "其他",
    contractActive: "合同中",
    contractCompleted: "已完成",
    contractOnHold: "暂停",
    contractEnded: "已结束",
    perMonth: "/月",
    // AI商品登録
    aiProductRegister: "AI图片商品登记",
    uploadProposalImage: "上传提案图片",
    analyzing: "AI分析中...",
    extractedInfo: "提取的信息",
    confirmAndRegister: "确认并登记",
    releaseDate: "发售日",
    stock: "库存数",
    catchCopy: "宣传语",
    productDetails: "商品详情",
    shippingInfo: "配送信息",
    aiExtractFailed: "AI分析失败",
    noImageSelected: "请选择图片",
    // 商品詳細ダイアログ
    productDetail: "商品详情",
    proposalImage: "提案图片",
    noProposalImage: "无提案图片",
    close: "关闭",
  },
};

const statusColors: Record<string, string> = {
  "進行中": "bg-blue-100 text-blue-800",
  "打ち合わせ中": "bg-yellow-100 text-yellow-800",
  "契約済み": "bg-green-100 text-green-800",
  "保留": "bg-gray-100 text-gray-800",
  "終了": "bg-red-100 text-red-800",
};

// カテゴリーの翻訳マッピング（キーから表示名へ）
const categoryTranslations: Record<string, Record<string, string>> = {
  ja: {
    service: "サービス業",
    manufacturing: "製造業",
    retail: "小売業",
    it: "IT・通信",
    food: "飲食業",
    beauty: "美容・健康",
    fashion: "ファッション",
    other: "その他",
    // 後方互換性（旧データ用）
    "サービス業": "サービス業",
    "製造業": "製造業",
    "小売業": "小売業",
    "IT・通信": "IT・通信",
    "飲食業": "飲食業",
    "美容・健康": "美容・健康",
    "ファッション": "ファッション",
    "その他": "その他",
  },
  zh: {
    service: "服务业",
    manufacturing: "制造业",
    retail: "零售业",
    it: "IT・通信",
    food: "餐饮业",
    beauty: "美容・健康",
    fashion: "时尚",
    other: "其他",
    // 後方互換性（旧データ用）
    "サービス業": "服务业",
    "製造業": "制造业",
    "小売業": "零售业",
    "IT・通信": "IT・通信",
    "飲食業": "餐饮业",
    "美容・健康": "美容・健康",
    "ファッション": "时尚",
    "その他": "其他",
  },
};

// ステータスの翻訳マッピング
const statusTranslations: Record<string, Record<string, string>> = {
  ja: {
    "進行中": "進行中",
    "打ち合わせ中": "打ち合わせ中",
    "契約済み": "契約済み",
    "保留": "保留",
    "終了": "終了",
  },
  zh: {
    "進行中": "进行中",
    "打ち合わせ中": "洽谈中",
    "契約済み": "已签约",
    "保留": "保留",
    "終了": "结束",
  },
};

// 備考テキストをセクション別に解析するヘルパー関数
const parseRemarksText = (remarks: string) => {
  const sections: { type: string; icon: string; title: string; content: string }[] = [];
  
  // キャッチコピーを抽出
  const catchCopyMatch = remarks.match(/キャッチコピー[:：]\s*([^\n]+(?:\n(?!商品詳細|配送情報|発売日|在庫)[^\n]+)*)/i);
  if (catchCopyMatch) {
    sections.push({
      type: 'catchCopy',
      icon: '⭐',
      title: 'キャッチコピー',
      content: catchCopyMatch[1].trim()
    });
  }
  
  // 商品詳細を抽出
  const productDetailsMatch = remarks.match(/商品詳細[:：]\s*([^]*?)(?=配送情報[:：]|発売日[:：]|在庫[:：]|$)/i);
  if (productDetailsMatch) {
    const content = productDetailsMatch[1].trim();
    // 特徴、使用方法などのサブセクションを分割
    const subSections = content.split(/[■●★※]/).filter(s => s.trim());
    if (subSections.length > 0) {
      sections.push({
        type: 'productDetails',
        icon: '📦',
        title: '商品詳細',
        content: subSections.map(s => s.trim()).join('\n\n')
      });
    }
  }
  
  // 配送情報を抽出
  const shippingMatch = remarks.match(/配送情報[:：]\s*([^\n]+(?:\n(?!発売日|在庫)[^\n]+)*)/i);
  if (shippingMatch) {
    sections.push({
      type: 'shipping',
      icon: '🚚',
      title: '配送情報',
      content: shippingMatch[1].trim()
    });
  }
  
  // 発売日を抽出
  const releaseDateMatch = remarks.match(/発売日[:：]\s*([^\n]+)/i);
  if (releaseDateMatch) {
    sections.push({
      type: 'releaseDate',
      icon: '📅',
      title: '発売日',
      content: releaseDateMatch[1].trim()
    });
  }
  
  // 在庫を抽出
  const stockMatch = remarks.match(/在庫[:：]\s*([^\n]+)/i);
  if (stockMatch) {
    sections.push({
      type: 'stock',
      icon: '📊',
      title: '在庫',
      content: stockMatch[1].trim()
    });
  }
  
  // セクションに分類されなかったテキストがあれば「その他」として追加
  let remainingText = remarks;
  const patterns = [
    /キャッチコピー[:：]\s*[^]*?(?=商品詳細[:：]|配送情報[:：]|発売日[:：]|在庫[:：]|$)/gi,
    /商品詳細[:：]\s*[^]*?(?=配送情報[:：]|発売日[:：]|在庫[:：]|$)/gi,
    /配送情報[:：]\s*[^]*?(?=発売日[:：]|在庫[:：]|$)/gi,
    /発売日[:：]\s*[^\n]+/gi,
    /在庫[:：]\s*[^\n]+/gi,
  ];
  patterns.forEach(pattern => {
    remainingText = remainingText.replace(pattern, '');
  });
  remainingText = remainingText.trim();
  if (remainingText && sections.length === 0) {
    // セクションが全くない場合は、テキスト全体を表示
    sections.push({
      type: 'other',
      icon: '📝',
      title: '備考',
      content: remarks
    });
  } else if (remainingText) {
    sections.push({
      type: 'other',
      icon: '📝',
      title: 'その他',
      content: remainingText
    });
  }
  
  return sections;
};

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const t = translations[language];

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productName: "",
    listPrice: "",
    specialPrice: "",
    discountRate: "",
    sampleProduct: "",
    productCode: "",
    influencer: "",
    purchasePrice: "",
    commissionRate: "",
    remarks: "",
    imageUrls: [] as string[],
    imageKeys: [] as string[],
  });
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);
  const [newActivity, setNewActivity] = useState({
    activityDate: new Date().toISOString().split("T")[0],
    activityType: "進行中" as "進行中" | "打ち合わせ" | "完了",
    contactPerson: "",
    nextAction: "",
    content: "",
  });
  const [isLivestreamDialogOpen, setIsLivestreamDialogOpen] = useState(false);
  const [newLivestream, setNewLivestream] = useState({
    livestreamDate: new Date().toISOString().split("T")[0],
    streamerName: "",
    salesAmount: "",
    duration: "",
    viewerCount: "",
    orderCount: "",
    platform: "",
    remarks: "",
    // 追加メトリクス
    productClicks: "",
    impressions: "",
    salesCount: "",
    gmv: "",
    cartAddCount: "",
  });
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [newContract, setNewContract] = useState({
    serviceType: "TSP" as "TSP" | "ライブコマース" | "広告運用代行" | "SNS運用代行" | "その他",
    contractType: "月額契約" as "月額契約" | "年間契約" | "単発契約" | "広告案件" | "その他",
    fixedFee: "",
    commissionRate: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    status: "契約中" as "契約中" | "完了" | "保留" | "終了",
    memo: "",
  });

  // 商品詳細ダイアログ用のstate
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductDetailDialogOpen, setIsProductDetailDialogOpen] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  // 商品カードのカルーセル用state（商品IDごとに現在の画像インデックスを管理）
  const [productImageIndexes, setProductImageIndexes] = useState<Record<number, number>>({});

  // 契約編集用のstate
  const [editingContract, setEditingContract] = useState<any>(null);
  const [isEditContractDialogOpen, setIsEditContractDialogOpen] = useState(false);

  // 直播商品別GMV用のstate
  const [selectedLivestream, setSelectedLivestream] = useState<any>(null);
  const [isLivestreamProductDialogOpen, setIsLivestreamProductDialogOpen] = useState(false);
  const [newLivestreamProduct, setNewLivestreamProduct] = useState({
    productName: "",
    gmv: "",
    quantity: "",
    unitPrice: "",
  });
  // 直播に追加する商品リスト（新規作成時）
  const [livestreamProductsToAdd, setLivestreamProductsToAdd] = useState<Array<{
    productId: number;
    productName: string;
    gmv: string;
    quantity: string;
    unitPrice: string;
  }>>([]);
  // 直播編集用のstate
  const [editingLivestream, setEditingLivestream] = useState<any>(null);
  const [isEditLivestreamDialogOpen, setIsEditLivestreamDialogOpen] = useState(false);

  // AI商品登録用のstate
  const [isAiProductDialogOpen, setIsAiProductDialogOpen] = useState(false);
  const [aiProposalImageUrl, setAiProposalImageUrl] = useState("");
  const [aiProposalImageKey, setAiProposalImageKey] = useState("");
  const [isUploadingProposalImage, setIsUploadingProposalImage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedProductData, setExtractedProductData] = useState<{
    productName: string | null;
    listPrice: number | null;
    specialPrice: number | null;
    discountRate: string | null;
    releaseDate: string | null;
    stock: number | null;
    productCode: string | null;
    catchCopy: string | null;
    productDetails: string | null;
    shippingInfo: string | null;
    remarks: string | null;
  } | null>(null);

  const brandId = parseInt(id || "0");

  const { data: brand, isLoading: brandLoading } = trpc.brand.getById.useQuery(
    { id: brandId }
  );

  // ブランド一覧を取得（ブランド選択用）
  const { data: allBrands = [] } = trpc.brand.list.useQuery();

  const { data: products = [] } = trpc.brandProduct.listByBrand.useQuery(
    { brandId }
  );

  const { data: activities = [] } = trpc.brandActivity.listByBrand.useQuery(
    { brandId }
  );

  // レポートスタッフ一覧を取得（対応履歴の担当者選択用）
  const { data: reportStaff = [] } = trpc.reportStaff.listActive.useQuery();

  // LCJ担当者を取得
  const { data: lcjStaff = [], refetch: refetchLcjStaff } = trpc.brand.getLcjStaff.useQuery(
    { brandId },
    { enabled: brandId > 0 }
  );

  // 直播履歴を取得
  const { data: livestreams = [] } = trpc.brandLivestream.listByBrand.useQuery(
    { brandId }
  );
  const { data: livestreamStats } = trpc.brandLivestream.stats.useQuery(
    { brandId }
  );
  // 月別GMV集計を取得
  const { data: monthlyGmvSummary = [] } = trpc.brandLivestream.monthlyGmvSummary.useQuery(
    { brandId }
  );

  // 契約情報を取得
  const { data: contracts = [] } = trpc.brandContract.listByBrand.useQuery(
    { brandId },
    { enabled: brandId > 0 }
  );

  const uploadImageMutation = trpc.brand.uploadImage.useMutation();

  // AI商品情報抽出mutation
  const extractProductMutation = trpc.brandProduct.extractFromImage.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setExtractedProductData(result.data);
        toast.success("商品情報を抽出しました");
      }
    },
    onError: () => {
      toast.error(t.aiExtractFailed);
    },
  });

  const createProductMutation = trpc.brandProduct.create.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      setIsProductDialogOpen(false);
      setNewProduct({
        productName: "",
        listPrice: "",
        specialPrice: "",
        discountRate: "",
        sampleProduct: "",
        productCode: "",
        influencer: "",
        purchasePrice: "",
        commissionRate: "",
        remarks: "",
        imageUrls: [],
        imageKeys: [],
      });
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const createActivityMutation = trpc.brandActivity.create.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      setIsActivityDialogOpen(false);
      setNewActivity({
        activityDate: new Date().toISOString().split("T")[0],
        activityType: "進行中" as "進行中" | "打ち合わせ" | "完了",
        contactPerson: "",
        nextAction: "",
        content: "",
      });
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const deleteProductMutation = trpc.brandProduct.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const deleteActivityMutation = trpc.brandActivity.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const createLivestreamMutation = trpc.brandLivestream.create.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      setIsLivestreamDialogOpen(false);
      setNewLivestream({
        livestreamDate: new Date().toISOString().split("T")[0],
        streamerName: "",
        salesAmount: "",
        duration: "",
        viewerCount: "",
        orderCount: "",
        platform: "",
        remarks: "",
        productClicks: "",
        impressions: "",
        salesCount: "",
        gmv: "",
        cartAddCount: "",
      });
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const deleteLivestreamMutation = trpc.brandLivestream.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const updateLivestreamMutation = trpc.brandLivestream.update.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      setIsEditLivestreamDialogOpen(false);
      setEditingLivestream(null);
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  // 直播商品別GMVの操作
  const { data: livestreamProducts, refetch: refetchLivestreamProducts } = trpc.brandLivestream.listProducts.useQuery(
    { livestreamId: selectedLivestream?.id || 0 },
    { enabled: !!selectedLivestream?.id }
  );

  const addLivestreamProductMutation = trpc.brandLivestream.addProduct.useMutation({
    onSuccess: () => {
      toast.success("商品を追加しました");
      setNewLivestreamProduct({ productName: "", gmv: "", quantity: "", unitPrice: "" });
      refetchLivestreamProducts();
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const deleteLivestreamProductMutation = trpc.brandLivestream.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      refetchLivestreamProducts();
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  // LCJ担当者の追加・削除
  const assignLcjStaffMutation = trpc.brand.assignLcjStaff.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      refetchLcjStaff();
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const removeLcjStaffMutation = trpc.brand.removeLcjStaff.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      refetchLcjStaff();
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  // 契約の追加・削除
  const createContractMutation = trpc.brandContract.create.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      setIsContractDialogOpen(false);
      setNewContract({
        serviceType: "TSP" as "TSP" | "ライブコマース" | "広告運用代行" | "SNS運用代行" | "その他",
        contractType: "月額契約" as "月額契約" | "年間契約" | "単発契約" | "広告案件" | "その他",
        fixedFee: "",
        commissionRate: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        status: "契約中" as "契約中" | "完了" | "保留" | "終了",
        memo: "",
      });
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const deleteContractMutation = trpc.brandContract.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const updateContractMutation = trpc.brandContract.update.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      setIsEditContractDialogOpen(false);
      setEditingContract(null);
    },
    onError: () => {
      toast.error(t.error);
    },
  });

  const handleAddProduct = async () => {
    if (!newProduct.productName) {
      toast.error("商品名を入力してください");
      return;
    }

    await createProductMutation.mutateAsync({
      brandId,
      ...newProduct,
      listPrice: newProduct.listPrice ? parseFloat(newProduct.listPrice) : undefined,
      specialPrice: newProduct.specialPrice ? parseFloat(newProduct.specialPrice) : undefined,
      purchasePrice: newProduct.purchasePrice ? parseFloat(newProduct.purchasePrice) : undefined,
      imageUrls: newProduct.imageUrls.length > 0 ? newProduct.imageUrls : undefined,
      imageKeys: newProduct.imageKeys.length > 0 ? newProduct.imageKeys : undefined,
    });
  };

  // 商品画像アップロードハンドラー
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 最大2枚まで
    const remainingSlots = 2 - newProduct.imageUrls.length;
    if (remainingSlots <= 0) {
      toast.error("画像は最大2枚までです");
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploadingProductImage(true);

    try {
      const uploadedUrls: string[] = [];
      const uploadedKeys: string[] = [];

      for (const file of filesToUpload) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const result = await uploadImageMutation.mutateAsync({
          base64: base64.split(",")[1],
          filename: file.name,
          type: "product" as const,
        });

        uploadedUrls.push(result.url);
        uploadedKeys.push(result.key);
      }

      setNewProduct({
        ...newProduct,
        imageUrls: [...newProduct.imageUrls, ...uploadedUrls],
        imageKeys: [...newProduct.imageKeys, ...uploadedKeys],
      });
    } catch (error) {
      toast.error("画像のアップロードに失敗しました");
    } finally {
      setIsUploadingProductImage(false);
    }
  };

  // 商品画像削除ハンドラー
  const handleRemoveProductImage = (index: number) => {
    setNewProduct({
      ...newProduct,
      imageUrls: newProduct.imageUrls.filter((_, i) => i !== index),
      imageKeys: newProduct.imageKeys.filter((_, i) => i !== index),
    });
  };

  // AI提案書画像アップロードハンドラー
  const handleProposalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploadingProposalImage(true);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const result = await uploadImageMutation.mutateAsync({
        base64: base64.split(",")[1],
        filename: file.name,
        type: "product" as const,
      });

      setAiProposalImageUrl(result.url);
      setAiProposalImageKey(result.key);
    } catch (error) {
      toast.error("画像のアップロードに失敗しました");
    } finally {
      setIsUploadingProposalImage(false);
    }
  };

  // AI解析実行ハンドラー
  const handleAnalyzeProposalImage = async () => {
    if (!aiProposalImageUrl) {
      toast.error(t.noImageSelected);
      return;
    }

    setIsAnalyzing(true);
    try {
      await extractProductMutation.mutateAsync({
        imageUrl: aiProposalImageUrl,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // AI抽出データを商品として登録
  const handleRegisterExtractedProduct = async () => {
    if (!extractedProductData || !extractedProductData.productName) {
      toast.error("商品名が必要です");
      return;
    }

    try {
      // 備考に商品詳細、配送情報、キャッチコピーなどをまとめる
      const remarksArray: string[] = [];
      if (extractedProductData.catchCopy) remarksArray.push(`キャッチコピー: ${extractedProductData.catchCopy}`);
      if (extractedProductData.productDetails) remarksArray.push(`商品詳細: ${extractedProductData.productDetails}`);
      if (extractedProductData.shippingInfo) remarksArray.push(`配送情報: ${extractedProductData.shippingInfo}`);
      if (extractedProductData.releaseDate) remarksArray.push(`発売日: ${extractedProductData.releaseDate}`);
      if (extractedProductData.stock) remarksArray.push(`在庫: ${extractedProductData.stock}`);
      if (extractedProductData.remarks) remarksArray.push(extractedProductData.remarks);

      await createProductMutation.mutateAsync({
        brandId,
        productName: extractedProductData.productName,
        listPrice: extractedProductData.listPrice || undefined,
        specialPrice: extractedProductData.specialPrice || undefined,
        discountRate: extractedProductData.discountRate || undefined,
        productCode: extractedProductData.productCode || undefined,
        remarks: remarksArray.length > 0 ? remarksArray.join("\n") : undefined,
        proposalImageUrl: aiProposalImageUrl || undefined, // 提案書画像を保存
        proposalImageKey: aiProposalImageKey || undefined, // 提案書画像S3 keyを保存
      });

      // ダイアログを閉じてリセット
      setIsAiProductDialogOpen(false);
      setAiProposalImageUrl("");
      setAiProposalImageKey("");
      setExtractedProductData(null);
    } catch (error) {
      toast.error(t.error);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.activityDate) {
      toast.error("対応日を選択してください");
      return;
    }

    await createActivityMutation.mutateAsync({
      brandId,
      ...newActivity,
    });
  };

  const handleAddLivestream = async () => {
    if (!newLivestream.streamerName) {
      toast.error("直播達人を入力してください");
      return;
    }

    const result = await createLivestreamMutation.mutateAsync({
      brandId,
      livestreamDate: newLivestream.livestreamDate,
      streamerName: newLivestream.streamerName,
      salesAmount: newLivestream.salesAmount ? parseFloat(newLivestream.salesAmount) : undefined,
      duration: newLivestream.duration ? parseInt(newLivestream.duration) : undefined,
      viewerCount: newLivestream.viewerCount ? parseInt(newLivestream.viewerCount) : undefined,
      orderCount: newLivestream.orderCount ? parseInt(newLivestream.orderCount) : undefined,
      platform: newLivestream.platform || undefined,
      remarks: newLivestream.remarks || undefined,
      // 追加メトリクス
      productClicks: newLivestream.productClicks ? parseInt(newLivestream.productClicks) : undefined,
      impressions: newLivestream.impressions ? parseInt(newLivestream.impressions) : undefined,
      salesCount: newLivestream.salesCount ? parseInt(newLivestream.salesCount) : undefined,
      gmv: newLivestream.gmv ? parseFloat(newLivestream.gmv) : undefined,
      cartAddCount: newLivestream.cartAddCount ? parseInt(newLivestream.cartAddCount) : undefined,
    });

    // 商品も追加
    if (result && livestreamProductsToAdd.length > 0) {
      for (const product of livestreamProductsToAdd) {
        await addLivestreamProductMutation.mutateAsync({
          livestreamId: result.id,
          productName: product.productName,
          gmv: product.gmv ? parseFloat(product.gmv) : undefined,
          quantity: product.quantity ? parseInt(product.quantity) : undefined,
          unitPrice: product.unitPrice ? parseFloat(product.unitPrice) : undefined,
        });
      }
    }
    
    // フォームリセット
    setLivestreamProductsToAdd([]);
    setNewLivestream({
      livestreamDate: new Date().toISOString().split("T")[0],
      streamerName: "",
      salesAmount: "",
      duration: "",
      viewerCount: "",
      orderCount: "",
      platform: "",
      remarks: "",
      productClicks: "",
      impressions: "",
      salesCount: "",
      gmv: "",
      cartAddCount: "",
    });
    setIsLivestreamDialogOpen(false);
  };

  const handleAddLivestreamProduct = async () => {
    if (!selectedLivestream || !newLivestreamProduct.productName) {
      toast.error("商品名を入力してください");
      return;
    }

    await addLivestreamProductMutation.mutateAsync({
      livestreamId: selectedLivestream.id,
      productName: newLivestreamProduct.productName,
      gmv: newLivestreamProduct.gmv ? parseFloat(newLivestreamProduct.gmv) : undefined,
      quantity: newLivestreamProduct.quantity ? parseInt(newLivestreamProduct.quantity) : undefined,
      unitPrice: newLivestreamProduct.unitPrice ? parseFloat(newLivestreamProduct.unitPrice) : undefined,
    });
  };

  const openLivestreamProductDialog = (livestream: any) => {
    setSelectedLivestream(livestream);
    setIsLivestreamProductDialogOpen(true);
  };

  // 直播編集ダイアログを開く
  const openEditLivestreamDialog = (livestream: any) => {
    setSelectedLivestream(livestream);
    setEditingLivestream({
      id: livestream.id,
      livestreamDate: livestream.livestreamDate ? new Date(livestream.livestreamDate).toISOString().split("T")[0] : "",
      streamerName: livestream.streamerName || "",
      salesAmount: livestream.salesAmount?.toString() || "",
      duration: livestream.duration?.toString() || "",
      viewerCount: livestream.viewerCount?.toString() || "",
      orderCount: livestream.orderCount?.toString() || "",
      platform: livestream.platform || "",
      remarks: livestream.remarks || "",
      productClicks: livestream.productClicks?.toString() || "",
      impressions: livestream.impressions?.toString() || "",
      salesCount: livestream.salesCount?.toString() || "",
      gmv: livestream.gmv?.toString() || "",
      cartAddCount: livestream.cartAddCount?.toString() || "",
    });
    setIsEditLivestreamDialogOpen(true);
  };

  // 直播更新ハンドラー
  const handleUpdateLivestream = async () => {
    if (!editingLivestream) return;
    await updateLivestreamMutation.mutateAsync({
      id: editingLivestream.id,
      livestreamDate: editingLivestream.livestreamDate,
      streamerName: editingLivestream.streamerName,
      salesAmount: editingLivestream.salesAmount ? parseFloat(editingLivestream.salesAmount) : undefined,
      duration: editingLivestream.duration ? parseInt(editingLivestream.duration) : undefined,
      viewerCount: editingLivestream.viewerCount ? parseInt(editingLivestream.viewerCount) : undefined,
      orderCount: editingLivestream.orderCount ? parseInt(editingLivestream.orderCount) : undefined,
      platform: editingLivestream.platform || undefined,
      remarks: editingLivestream.remarks || undefined,
      productClicks: editingLivestream.productClicks ? parseInt(editingLivestream.productClicks) : undefined,
      impressions: editingLivestream.impressions ? parseInt(editingLivestream.impressions) : undefined,
      salesCount: editingLivestream.salesCount ? parseInt(editingLivestream.salesCount) : undefined,
      gmv: editingLivestream.gmv ? parseFloat(editingLivestream.gmv) : undefined,
      cartAddCount: editingLivestream.cartAddCount ? parseInt(editingLivestream.cartAddCount) : undefined,
    });
  };

  const handleAddContract = async () => {
    await createContractMutation.mutateAsync({
      brandId,
      serviceType: newContract.serviceType,
      contractType: newContract.contractType,
      fixedFee: newContract.fixedFee ? parseFloat(newContract.fixedFee) : undefined,
      commissionRate: newContract.commissionRate || undefined,
      startDate: newContract.startDate ? new Date(newContract.startDate) : undefined,
      endDate: newContract.endDate ? new Date(newContract.endDate) : undefined,
      status: newContract.status,
      memo: newContract.memo || undefined,
    });
  };

  const handleUpdateContract = async () => {
    if (!editingContract) return;
    await updateContractMutation.mutateAsync({
      id: editingContract.id,
      serviceType: editingContract.serviceType,
      contractType: editingContract.contractType,
      fixedFee: editingContract.fixedFee ? parseFloat(editingContract.fixedFee.toString()) : undefined,
      commissionRate: editingContract.commissionRate || undefined,
      startDate: editingContract.startDate ? new Date(editingContract.startDate) : undefined,
      endDate: editingContract.endDate ? new Date(editingContract.endDate) : undefined,
      status: editingContract.status,
      memo: editingContract.memo || undefined,
    });
  };

  const openEditContractDialog = (contract: any) => {
    setEditingContract({
      ...contract,
      fixedFee: contract.fixedFee?.toString() || "",
      commissionRate: contract.commissionRate || "",
      startDate: contract.startDate ? new Date(contract.startDate).toISOString().split("T")[0] : "",
      endDate: contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : "",
      memo: contract.memo || "",
    });
    setIsEditContractDialogOpen(true);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "-";
    return `¥${value.toLocaleString()}`;
  };

  const contractStatusColors: Record<string, string> = {
    "契約中": "bg-green-100 text-green-800",
    "完了": "bg-blue-100 text-blue-800",
    "保留": "bg-yellow-100 text-yellow-800",
    "終了": "bg-gray-100 text-gray-800",
  };

  const serviceTypeLabels: Record<string, string> = {
    "TSP": t.tsp,
    "ライブコマース": t.liveCommerce,
    "広告運用代行": t.adManagement,
    "SNS運用代行": t.snsManagement,
    "その他": t.otherService,
  };

  const serviceTypeIcons: Record<string, string> = {
    "TSP": "🏠",
    "ライブコマース": "📺",
    "広告運用代行": "📢",
    "SNS運用代行": "📱",
    "その他": "📄",
  };

  const contractTypeLabels: Record<string, string> = {
    "月額契約": t.monthlyContract,
    "年間契約": t.annualContract,
    "単発契約": t.oneTimeContract,
    "広告案件": t.adCampaign,
    "その他": t.otherContract,
  };

  const contractStatusLabels: Record<string, string> = {
    "契約中": t.contractActive,
    "完了": t.contractCompleted,
    "保留": t.contractOnHold,
    "終了": t.contractEnded,
  };

  if (brandLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center py-8 text-gray-400">ブランドが見つかりません</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden">
      {/* フルスクリーンコンテナ */}
      <div className="relative">
        {/* 背景グラデーション */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-[#0a0a0f] to-orange-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.1),transparent_50%)] pointer-events-none" />
        
        {/* グリッドパターン */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(rgba(239, 68, 68, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239, 68, 68, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }} />
        
        {/* メインコンテンツ */}
        <div className="relative z-10 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
        {/* ヘッダー - 広告司令塔スタイル */}
        <div className="bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/brands")}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm">戻る</span>
              </button>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                <span className="text-2xl">🏢</span>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">ブランド司令塔</h1>
                  {/* ブランド選択ドロップダウン */}
                  <Select
                    value={brandId.toString()}
                    onValueChange={(value) => navigate(`/brands/${value}`)}
                  >
                    <SelectTrigger className="w-[200px] bg-slate-800/50 border-white/10 text-white">
                      <SelectValue placeholder="ブランドを選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10 max-h-[300px]">
                      {allBrands.map((b) => (
                        <SelectItem 
                          key={b.id} 
                          value={b.id.toString()}
                          className="text-white hover:bg-slate-700"
                        >
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{brand.name} - {brand.companyName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={`px-4 py-1.5 text-sm font-medium rounded-full ${brand.status === '契約済み' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : brand.status === '打ち合わせ中' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
                {statusTranslations[language][brand.status] || brand.status}
              </Badge>
              <Button
                onClick={() => navigate(`/brands/${id}/edit`)}
                className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-6 py-2 rounded-xl shadow-lg shadow-red-500/30 transition-all hover:shadow-red-500/50"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t.edit}
              </Button>
            </div>
          </div>
        </div>

        {/* メインKPIカード - GMV実績を大きく表示 */}
        <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-8 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-300" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-emerald-400" />
              </div>
              <span className="text-emerald-400 text-lg font-medium">GMV実績（全期間）</span>
            </div>
            <p className="text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {monthlyGmvSummary.length > 0 
                ? formatCurrency(monthlyGmvSummary.reduce((sum, m) => sum + (m.gmv || 0), 0))
                : <span className="text-gray-500">-</span>
              }
            </p>
            {monthlyGmvSummary.length > 0 && (
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-gray-400">直播回数: <span className="text-emerald-400 font-bold">{livestreams.length}回</span></span>
                <span className="text-gray-400">商品数: <span className="text-cyan-400 font-bold">{products.length}品</span></span>
              </div>
            )}
          </div>
        </div>

        {/* サブKPIカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">{t.commissionRate}</span>
            </div>
            <p className="text-2xl font-bold text-purple-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {brand.commissionRate || "-"}
            </p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-cyan-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">{t.products}</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {products.length}
            </p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-4 w-4 text-pink-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">{t.livestreams}</span>
            </div>
            <p className="text-2xl font-bold text-pink-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {livestreams.length}
            </p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">{t.contracts}</span>
            </div>
            <p className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {contracts.length}
            </p>
          </div>
        </div>

        {/* 基本情報 - 広告司令塔スタイル */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
            {t.basicInfo}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.category}</p>
                <p className="text-white font-medium">{brand.category ? (categoryTranslations[language][brand.category] || brand.category) : "-"}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.phoneNumber}</p>
                <p className="text-white font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{brand.phoneNumber || "-"}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.email}</p>
                <p className="text-white font-medium">{brand.email || "-"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.status}</p>
                <Badge className={`px-3 py-1 text-sm font-medium rounded-lg ${brand.status === '契約済み' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : brand.status === '打ち合わせ中' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
                  {statusTranslations[language][brand.status] || brand.status}
                </Badge>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t.contactPerson}</p>
                <p className="text-white font-medium">{brand.contactPerson || "-"}</p>
              </div>
            </div>
          </div>

          {brand.memo && (
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.memo}</p>
              <p className="text-gray-300 whitespace-pre-wrap">{brand.memo}</p>
            </div>
          )}

          {/* LCJ担当者セクション */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-gray-400">{t.lcjStaff}</p>
              <Select
                onValueChange={(value) => {
                  const staffId = parseInt(value);
                  if (staffId > 0) {
                    assignLcjStaffMutation.mutate({ brandId, reportStaffId: staffId });
                  }
                }}
              >
                <SelectTrigger className="w-[200px] bg-slate-800/80 border-white/10 text-white rounded-xl">
                  <SelectValue placeholder={t.selectLcjStaff} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10 rounded-xl">
                  {reportStaff
                    .filter((staff: any) => !lcjStaff.some((assigned: any) => assigned.reportStaffId === staff.id))
                    .map((staff: any) => (
                      <SelectItem key={staff.id} value={staff.id.toString()} className="text-gray-200 hover:bg-slate-700">
                        {staff.name} ({staff.country})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {lcjStaff.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lcjStaff.map((staff: any) => (
                  <Badge
                    key={staff.id}
                    className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  >
                    <span>{staff.staffName}</span>
                    <span className="text-xs opacity-70">({staff.staffCountry})</span>
                    <button
                      onClick={() => removeLcjStaffMutation.mutate({ brandId, reportStaffId: staff.reportStaffId })}
                      className="ml-1 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t.noLcjStaff}</p>
            )}
          </div>
        </div>

        {/* 契約セクション - 広告司令塔スタイル */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <div className="flex flex-row items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
              <FileText className="h-5 w-5 text-amber-400" />
              {t.contracts}
              {contracts.length > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 ml-2 px-2 py-0.5 rounded-lg">{contracts.length}</Badge>
              )}
            </h2>
            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-4 py-2 rounded-xl shadow-lg shadow-red-500/30">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.addContract}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.addContract}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t.serviceType}</Label>
                    <Select
                      value={newContract.serviceType}
                      onValueChange={(value) =>
                        setNewContract({ ...newContract, serviceType: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TSP">{t.tsp}</SelectItem>
                        <SelectItem value="ライブコマース">{t.liveCommerce}</SelectItem>
                        <SelectItem value="広告運用代行">{t.adManagement}</SelectItem>
                        <SelectItem value="SNS運用代行">{t.snsManagement}</SelectItem>
                        <SelectItem value="その他">{t.otherService}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.contractType}</Label>
                    <Select
                      value={newContract.contractType}
                      onValueChange={(value) =>
                        setNewContract({ ...newContract, contractType: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="月額契約">{t.monthlyContract}</SelectItem>
                        <SelectItem value="年間契約">{t.annualContract}</SelectItem>
                        <SelectItem value="単発契約">{t.oneTimeContract}</SelectItem>
                        <SelectItem value="広告案件">{t.adCampaign}</SelectItem>
                        <SelectItem value="その他">{t.otherContract}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t.fixedFee}</Label>
                      <Input
                        type="number"
                        value={newContract.fixedFee}
                        onChange={(e) =>
                          setNewContract({ ...newContract, fixedFee: e.target.value })
                        }
                        placeholder="500000"
                      />
                    </div>
                    <div>
                      <Label>{t.commissionRateContract}</Label>
                      <Input
                        value={newContract.commissionRate}
                        onChange={(e) =>
                          setNewContract({ ...newContract, commissionRate: e.target.value })
                        }
                        placeholder="10%"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t.startDate}</Label>
                      <Input
                        type="date"
                        value={newContract.startDate}
                        onChange={(e) =>
                          setNewContract({ ...newContract, startDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>{t.endDate}</Label>
                      <Input
                        type="date"
                        value={newContract.endDate}
                        onChange={(e) =>
                          setNewContract({ ...newContract, endDate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t.contractStatus}</Label>
                    <Select
                      value={newContract.status}
                      onValueChange={(value) =>
                        setNewContract({ ...newContract, status: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="契約中">{t.contractActive}</SelectItem>
                        <SelectItem value="完了">{t.contractCompleted}</SelectItem>
                        <SelectItem value="保留">{t.contractOnHold}</SelectItem>
                        <SelectItem value="終了">{t.contractEnded}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.contractMemo}</Label>
                    <Textarea
                      value={newContract.memo}
                      onChange={(e) =>
                        setNewContract({ ...newContract, memo: e.target.value })
                      }
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsContractDialogOpen(false)}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      onClick={handleAddContract}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={createContractMutation.isPending}
                    >
                      {t.save}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            {contracts.length > 0 ? (
              <div className="space-y-4">
                {contracts.map((contract: any) => (
                  <div
                    key={contract.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => openEditContractDialog(contract)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{serviceTypeIcons[contract.serviceType] || "📄"}</span>
                        <div>
                          <p className="font-semibold text-base">
                            {serviceTypeLabels[contract.serviceType] || contract.serviceType || "未設定"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {contractTypeLabels[contract.contractType] || contract.contractType}
                            </Badge>
                            <Badge className={`text-xs ${contractStatusColors[contract.status] || "bg-gray-100"}`}>
                              {contractStatusLabels[contract.status] || contract.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditContractDialog(contract);
                          }}
                        >
                          <Edit2 className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteContractMutation.mutate({ id: contract.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pl-10">
                      <div>
                        <p className="text-muted-foreground text-xs">{t.fixedFee}</p>
                        <p className="font-medium">
                          {contract.fixedFee ? `¥${contract.fixedFee.toLocaleString()}${contract.contractType === "月額契約" ? t.perMonth : ""}` : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t.commissionRateContract}</p>
                        <p className="font-medium">{contract.commissionRate || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t.startDate}</p>
                        <p className="font-medium">
                          {contract.startDate ? new Date(contract.startDate).toLocaleDateString() : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t.endDate}</p>
                        <p className="font-medium">
                          {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "-"}
                        </p>
                      </div>
                    </div>
                    {contract.memo && (
                      <div className="text-sm pl-10">
                        <p className="text-muted-foreground text-xs">{t.contractMemo}</p>
                        <p className="font-medium">{contract.memo}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noContracts}
              </div>
            )}
          </div>
        </div>

        {/* 契約編集ダイアログ */}
        <Dialog open={isEditContractDialogOpen} onOpenChange={setIsEditContractDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.edit}</DialogTitle>
            </DialogHeader>
            {editingContract && (
              <div className="space-y-4">
                <div>
                  <Label>{t.serviceType}</Label>
                  <Select
                    value={editingContract.serviceType}
                    onValueChange={(value) =>
                      setEditingContract({ ...editingContract, serviceType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TSP">{t.tsp}</SelectItem>
                      <SelectItem value="ライブコマース">{t.liveCommerce}</SelectItem>
                      <SelectItem value="広告運用代行">{t.adManagement}</SelectItem>
                      <SelectItem value="SNS運用代行">{t.snsManagement}</SelectItem>
                      <SelectItem value="その他">{t.otherService}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.contractType}</Label>
                  <Select
                    value={editingContract.contractType}
                    onValueChange={(value) =>
                      setEditingContract({ ...editingContract, contractType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="月額契約">{t.monthlyContract}</SelectItem>
                      <SelectItem value="年間契約">{t.annualContract}</SelectItem>
                      <SelectItem value="単発契約">{t.oneTimeContract}</SelectItem>
                      <SelectItem value="広告案件">{t.adCampaign}</SelectItem>
                      <SelectItem value="その他">{t.otherContract}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t.fixedFee}</Label>
                    <Input
                      type="number"
                      value={editingContract.fixedFee}
                      onChange={(e) =>
                        setEditingContract({ ...editingContract, fixedFee: e.target.value })
                      }
                      placeholder="500000"
                    />
                  </div>
                  <div>
                    <Label>{t.commissionRateContract}</Label>
                    <Input
                      value={editingContract.commissionRate}
                      onChange={(e) =>
                        setEditingContract({ ...editingContract, commissionRate: e.target.value })
                      }
                      placeholder="10%"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t.startDate}</Label>
                    <Input
                      type="date"
                      value={editingContract.startDate}
                      onChange={(e) =>
                        setEditingContract({ ...editingContract, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t.endDate}</Label>
                    <Input
                      type="date"
                      value={editingContract.endDate}
                      onChange={(e) =>
                        setEditingContract({ ...editingContract, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>{t.contractStatus}</Label>
                  <Select
                    value={editingContract.status}
                    onValueChange={(value) =>
                      setEditingContract({ ...editingContract, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="契約中">{t.contractActive}</SelectItem>
                      <SelectItem value="完了">{t.contractCompleted}</SelectItem>
                      <SelectItem value="保留">{t.contractOnHold}</SelectItem>
                      <SelectItem value="終了">{t.contractEnded}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.contractMemo}</Label>
                  <Textarea
                    value={editingContract.memo}
                    onChange={(e) =>
                      setEditingContract({ ...editingContract, memo: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditContractDialogOpen(false);
                      setEditingContract(null);
                    }}
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    onClick={handleUpdateContract}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={updateContractMutation.isPending}
                  >
                    {t.save}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 商品セクション - 広告司令塔スタイル */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <div className="flex flex-row items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded-full" />
              <Package className="h-5 w-5 text-cyan-400" />
              {t.products}
              {products.length > 0 && (
                <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 ml-2 px-2 py-0.5 rounded-lg">{products.length}</Badge>
              )}
            </h2>
            <div className="flex gap-2">
              {/* AI商品登録ボタン */}
              <Dialog open={isAiProductDialogOpen} onOpenChange={(open) => {
                setIsAiProductDialogOpen(open);
                if (!open) {
                  setAiProposalImageUrl("");
                  setAiProposalImageKey("");
                  setExtractedProductData(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {t.aiProductRegister}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t.aiProductRegister}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* 提案書画像アップロード */}
                    <div>
                      <Label>{t.uploadProposalImage}</Label>
                      <div className="mt-2">
                        {aiProposalImageUrl ? (
                          <div className="relative">
                            <img
                              src={aiProposalImageUrl}
                              alt="提案書画像"
                              className="w-full max-h-64 object-contain rounded border"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setAiProposalImageUrl("");
                                setAiProposalImageKey("");
                                setExtractedProductData(null);
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg hover:bg-gray-50">
                              {isUploadingProposalImage ? (
                                <span className="text-sm text-gray-500">{t.uploading}</span>
                              ) : (
                                <>
                                  <ImageIcon className="h-10 w-10 text-gray-400" />
                                  <span className="text-sm text-gray-500">{t.uploadProposalImage}</span>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleProposalImageUpload}
                              disabled={isUploadingProposalImage}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* AI解析ボタン */}
                    {aiProposalImageUrl && !extractedProductData && (
                      <Button
                        onClick={handleAnalyzeProposalImage}
                        disabled={isAnalyzing}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {isAnalyzing ? t.analyzing : "AIで商品情報を抽出"}
                      </Button>
                    )}

                    {/* 抽出結果表示 */}
                    {extractedProductData && (
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-semibold text-lg">{t.extractedInfo}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t.productName}</Label>
                            <Input
                              value={extractedProductData.productName || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  productName: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>{t.productCode}</Label>
                            <Input
                              value={extractedProductData.productCode || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  productCode: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>{t.listPrice}</Label>
                            <Input
                              type="number"
                              value={extractedProductData.listPrice || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  listPrice: e.target.value ? parseInt(e.target.value) : null,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>{t.specialPrice}</Label>
                            <Input
                              type="number"
                              value={extractedProductData.specialPrice || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  specialPrice: e.target.value ? parseInt(e.target.value) : null,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>{t.discountRate}</Label>
                            <Input
                              value={extractedProductData.discountRate || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  discountRate: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t.releaseDate}</Label>
                            <Input
                              value={extractedProductData.releaseDate || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  releaseDate: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>{t.stock}</Label>
                            <Input
                              type="number"
                              value={extractedProductData.stock || ""}
                              onChange={(e) =>
                                setExtractedProductData({
                                  ...extractedProductData,
                                  stock: e.target.value ? parseInt(e.target.value) : null,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t.catchCopy}</Label>
                          <Textarea
                            value={extractedProductData.catchCopy || ""}
                            onChange={(e) =>
                              setExtractedProductData({
                                ...extractedProductData,
                                catchCopy: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>{t.productDetails}</Label>
                          <Textarea
                            value={extractedProductData.productDetails || ""}
                            onChange={(e) =>
                              setExtractedProductData({
                                ...extractedProductData,
                                productDetails: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>{t.shippingInfo}</Label>
                          <Textarea
                            value={extractedProductData.shippingInfo || ""}
                            onChange={(e) =>
                              setExtractedProductData({
                                ...extractedProductData,
                                shippingInfo: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>{t.remarks}</Label>
                          <Textarea
                            value={extractedProductData.remarks || ""}
                            onChange={(e) =>
                              setExtractedProductData({
                                ...extractedProductData,
                                remarks: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsAiProductDialogOpen(false);
                              setAiProposalImageUrl("");
                              setAiProposalImageKey("");
                              setExtractedProductData(null);
                            }}
                          >
                            {t.cancel}
                          </Button>
                          <Button
                            onClick={handleRegisterExtractedProduct}
                            disabled={createProductMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {t.confirmAndRegister}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* 通常の商品追加ボタン */}
              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="h-4 w-4 mr-2" />
                    {t.addProduct}
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.addProduct}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t.productName} *</Label>
                    <Input
                      value={newProduct.productName}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, productName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t.listPrice}</Label>
                      <Input
                        type="number"
                        value={newProduct.listPrice}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, listPrice: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>{t.specialPrice}</Label>
                      <Input
                        type="number"
                        value={newProduct.specialPrice}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, specialPrice: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t.discountRate}</Label>
                      <Input
                        value={newProduct.discountRate}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, discountRate: e.target.value })
                        }
                        placeholder="10%"
                      />
                    </div>
                    <div>
                      <Label>{t.purchasePrice}</Label>
                      <Input
                        type="number"
                        value={newProduct.purchasePrice}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, purchasePrice: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t.productCode}</Label>
                    <Input
                      value={newProduct.productCode}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, productCode: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t.influencer}</Label>
                    <Input
                      value={newProduct.influencer}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, influencer: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t.commissionRate}</Label>
                    <Input
                      value={newProduct.commissionRate}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, commissionRate: e.target.value })
                      }
                      placeholder="例: 15%, 20%"
                    />
                  </div>
                  <div>
                    <Label>{t.remarks}</Label>
                    <Textarea
                      value={newProduct.remarks}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, remarks: e.target.value })
                      }
                    />
                  </div>
                  {/* 商品画像アップロード */}
                  <div>
                    <Label>{t.productImages}</Label>
                    <div className="mt-2 space-y-2">
                      {/* アップロード済み画像のプレビュー */}
                      {newProduct.imageUrls.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {newProduct.imageUrls.map((url, index) => (
                            <div key={index} className="relative">
                              <img
                                src={url}
                                alt={`商品画像 ${index + 1}`}
                                className="w-20 h-20 object-cover rounded border"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveProductImage(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* アップロードボタン */}
                      {newProduct.imageUrls.length < 2 && (
                        <div>
                          <label className="cursor-pointer">
                            <div className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg hover:bg-gray-50">
                              {isUploadingProductImage ? (
                                <span className="text-sm text-gray-500">{t.uploading}</span>
                              ) : (
                                <>
                                  <ImageIcon className="h-5 w-5 text-gray-400" />
                                  <span className="text-sm text-gray-500">{t.uploadImages}</span>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleProductImageUpload}
                              disabled={isUploadingProductImage}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsProductDialogOpen(false)}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      onClick={handleAddProduct}
                      disabled={createProductMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {t.save}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
          <div>
            {products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="group relative tech-card p-4 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsProductDetailDialogOpen(true);
                    }}
                  >
                    {/* 削除ボタン */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProductMutation.mutate({ id: product.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>

                    {/* 提案書画像と商品画像のカルーセル */}
                    {(() => {
                      // 全ての画像を配列にまとめる
                      const allImages: string[] = [];
                      if (product.proposalImageUrl) allImages.push(product.proposalImageUrl);
                      if (product.imageUrls && product.imageUrls.length > 0) {
                        allImages.push(...product.imageUrls);
                      }
                      
                      if (allImages.length === 0) return null;
                      
                      const currentIndex = productImageIndexes[product.id] || 0;
                      
                      return (
                        <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 relative group">
                          <img
                            src={allImages[currentIndex]}
                            alt={product.productName}
                            className="w-full h-40 object-contain"
                          />
                          
                          {/* 画像が複数ある場合のナビゲーション */}
                          {allImages.length > 1 && (
                            <>
                              {/* 左矢印 */}
                              <button
                                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductImageIndexes(prev => ({
                                    ...prev,
                                    [product.id]: currentIndex === 0 ? allImages.length - 1 : currentIndex - 1
                                  }));
                                }}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              
                              {/* 右矢印 */}
                              <button
                                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductImageIndexes(prev => ({
                                    ...prev,
                                    [product.id]: currentIndex === allImages.length - 1 ? 0 : currentIndex + 1
                                  }));
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              
                              {/* インジケータードット */}
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                {allImages.map((_, idx) => (
                                  <button
                                    key={idx}
                                    className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-cyan-400 scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProductImageIndexes(prev => ({
                                        ...prev,
                                        [product.id]: idx
                                      }));
                                    }}
                                  />
                                ))}
                              </div>
                              
                              {/* 画像カウントバッジ */}
                              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                                {currentIndex + 1}/{allImages.length}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* 商品名とコード */}
                    <div className="mb-3">
                      <h4 className="font-semibold text-sm line-clamp-2 mb-1 text-gray-200">{product.productName}</h4>
                      {product.productCode && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {product.productCode}
                        </p>
                      )}
                    </div>

                    {/* 価格情報 - Tech Style */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {t.listPrice}
                        </span>
                        <span className="font-medium text-sm text-gray-300">{formatCurrency(product.listPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-cyan-500" />
                          {t.specialPrice}
                        </span>
                        <span className="font-bold text-sm text-cyan-400 neon-text-cyan">{formatCurrency(product.specialPrice)}</span>
                      </div>
                      {product.discountRate && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Percent className="h-3 w-3 text-green-500" />
                            {t.discountRate}
                          </span>
                          <Badge className="tech-badge-green">
                            {product.discountRate}
                          </Badge>
                        </div>
                      )}
                      {product.commissionRate && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-500/20">
                          <span className="text-xs text-purple-400 flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {t.commissionRate}
                          </span>
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            {product.commissionRate}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* インフルエンサー */}
                    {product.influencer && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-purple-500" />
                          <span className="text-xs text-muted-foreground">{t.influencer}:</span>
                          <span className="text-xs font-medium">{product.influencer}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>{t.noProducts}</p>
              </div>
            )}
          </div>
        </div>

        {/* 商品詳細ポップアップ - 画像中心のフルスクリーン表示 */}
        {isProductDetailDialogOpen && selectedProduct && (
          <div 
            className="fixed inset-0 z-50 bg-black/95 overflow-y-auto"
            onClick={() => setIsProductDetailDialogOpen(false)}
          >
            {/* 閉じるボタン */}
            <button
              className="fixed top-4 right-4 z-[60] text-white bg-white/20 hover:bg-white/30 rounded-full p-3 backdrop-blur-sm transition-all"
              onClick={() => setIsProductDetailDialogOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>

            {/* メインコンテンツ */}
            <div 
              className="min-h-screen flex flex-col items-center py-8 px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 商品名ヘッダー */}
              <div className="text-center mb-6 max-w-4xl">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {selectedProduct.productName}
                </h1>
                {selectedProduct.productCode && (
                  <p className="text-white/60 font-mono text-sm">
                    {selectedProduct.productCode}
                  </p>
                )}
              </div>

              {/* 提案書画像 - 大きくポップ表示 */}
              {selectedProduct.proposalImageUrl && (
                <div className="w-full max-w-5xl mb-8">
                  <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <img
                      src={selectedProduct.proposalImageUrl}
                      alt={selectedProduct.productName}
                      className="w-full h-auto object-contain"
                      style={{ maxHeight: '70vh' }}
                    />
                  </div>
                </div>
              )}

              {/* 価格情報バッジ */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
                  <p className="text-white/60 text-xs mb-1">定価</p>
                  <p className="text-white text-lg line-through">{formatCurrency(selectedProduct.listPrice)}</p>
                </div>
                <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl px-8 py-4 text-center shadow-lg">
                  <p className="text-white/80 text-xs mb-1">特価</p>
                  <p className="text-white text-3xl font-bold">{formatCurrency(selectedProduct.specialPrice)}</p>
                </div>
                {selectedProduct.discountRate && (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl px-6 py-3 text-center">
                    <p className="text-white text-2xl font-bold">{selectedProduct.discountRate}</p>
                  </div>
                )}
              </div>

              {/* 詳細情報カード */}
              <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* 基本情報 */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-400" />
                    基本情報
                  </h3>
                  <div className="space-y-3">
                    {selectedProduct.releaseDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-sm">発売日</span>
                        <span className="text-white font-medium">{selectedProduct.releaseDate}</span>
                      </div>
                    )}
                    {selectedProduct.stock !== null && selectedProduct.stock !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-sm">在庫</span>
                        <span className="text-white font-medium">{selectedProduct.stock} 個</span>
                      </div>
                    )}
                    {selectedProduct.influencer && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-sm">インフルエンサー</span>
                        <span className="text-white font-medium">{selectedProduct.influencer}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 配送情報 */}
                {selectedProduct.shippingInfo && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-cyan-400" />
                      配送情報
                    </h3>
                    <p className="text-white/80 text-sm leading-relaxed">{selectedProduct.shippingInfo}</p>
                  </div>
                )}
              </div>

              {/* キャッチコピー */}
              {selectedProduct.catchCopy && (
                <div className="w-full max-w-4xl mb-6">
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-5 border border-yellow-500/30">
                    <h3 className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      キャッチコピー
                    </h3>
                    <p className="text-white text-lg leading-relaxed">{selectedProduct.catchCopy}</p>
                  </div>
                </div>
              )}

              {/* 商品詳細 */}
              {selectedProduct.productDetails && (
                <div className="w-full max-w-4xl mb-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-400" />
                      商品詳細
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {selectedProduct.productDetails.split(/[■●★※]/).filter((s: string) => s.trim()).map((section: string, idx: number) => (
                        <div key={idx} className="bg-white/5 rounded-lg p-3 border-l-3 border-purple-400">
                          <p className="text-white/90 text-sm leading-relaxed">{section.trim()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 備考 - セクション別に解析して表示 */}
              {selectedProduct.remarks && (
                <div className="w-full max-w-4xl mb-8">
                  <div className="space-y-4">
                    {parseRemarksText(selectedProduct.remarks).map((section, idx) => {
                      const sectionColors: Record<string, string> = {
                        catchCopy: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
                        productDetails: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30',
                        shipping: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
                        releaseDate: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
                        stock: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
                        other: 'from-gray-500/20 to-slate-500/20 border-gray-500/30',
                      };
                      const colorClass = sectionColors[section.type] || sectionColors.other;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`bg-gradient-to-r ${colorClass} backdrop-blur-sm rounded-xl p-5 border`}
                        >
                          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                            <span className="text-xl">{section.icon}</span>
                            {section.title}
                          </h3>
                          {section.type === 'productDetails' ? (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                              {section.content.split('\n\n').map((paragraph, pIdx) => (
                                <div key={pIdx} className="bg-white/5 rounded-lg p-3 border-l-2 border-purple-400">
                                  <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{paragraph}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 閉じるボタン（下部） */}
              <button
                className="bg-white/20 hover:bg-white/30 text-white px-8 py-3 rounded-full font-medium transition-all backdrop-blur-sm"
                onClick={() => setIsProductDetailDialogOpen(false)}
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        {/* 対応履歴セクション - 広告司令塔スタイル */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <div className="flex flex-row items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
              <MessageSquare className="h-5 w-5 text-purple-400" />
              {t.activities}
              {activities.length > 0 && (
                <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 ml-2 px-2 py-0.5 rounded-lg">{activities.length}</Badge>
              )}
            </h2>
            <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-4 py-2 rounded-xl shadow-lg shadow-red-500/30">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.addActivity}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.addActivity}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t.activityDate} *</Label>
                    <Input
                      type="date"
                      value={newActivity.activityDate}
                      onChange={(e) =>
                        setNewActivity({ ...newActivity, activityDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t.activityType}</Label>
                    <Select
                      value={newActivity.activityType}
                      onValueChange={(v) =>
                        setNewActivity({ ...newActivity, activityType: v as "進行中" | "打ち合わせ" | "完了" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="進行中">{t.inProgress}</SelectItem>
                        <SelectItem value="打ち合わせ">{t.meeting}</SelectItem>
                        <SelectItem value="完了">{t.completed}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.contactPerson}</Label>
                    <Select
                      value={newActivity.contactPerson}
                      onValueChange={(v) =>
                        setNewActivity({ ...newActivity, contactPerson: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.selectStaff} />
                      </SelectTrigger>
                      <SelectContent>
                        {reportStaff.map((staff) => (
                          <SelectItem key={staff.id} value={staff.name}>
                            {staff.name}
                            {staff.country && (
                              <span className="text-muted-foreground ml-1">({staff.country})</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.nextAction}</Label>
                    <Input
                      value={newActivity.nextAction}
                      onChange={(e) =>
                        setNewActivity({ ...newActivity, nextAction: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t.content}</Label>
                    <Textarea
                      value={newActivity.content}
                      onChange={(e) =>
                        setNewActivity({ ...newActivity, content: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsActivityDialogOpen(false)}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      onClick={handleAddActivity}
                      disabled={createActivityMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {t.save}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            {activities.length > 0 ? (
              <div className="relative">
                {/* タイムラインの縦線 */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />
                
                <div className="space-y-4">
                  {activities.map((activity, index) => {
                    const statusConfig = {
                      "進行中": { icon: AlertCircle, color: "bg-blue-500", textColor: "text-blue-400" },
                      "打ち合わせ": { icon: MessageSquare, color: "bg-purple-500", textColor: "text-purple-400" },
                      "完了": { icon: CheckCircle2, color: "bg-green-500", textColor: "text-green-400" },
                    };
                    const config = statusConfig[activity.activityType as keyof typeof statusConfig] || statusConfig["進行中"];
                    const IconComponent = config.icon;
                    
                    return (
                      <div key={activity.id} className="relative pl-10">
                        {/* タイムラインのドット */}
                        <div className={`absolute left-2 w-5 h-5 rounded-full ${config.color} flex items-center justify-center ring-4 ring-slate-900`}>
                          <IconComponent className="h-3 w-3 text-white" />
                        </div>
                        
                        <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4 hover:bg-slate-800/70 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-300">
                                  {new Date(activity.activityDate).toLocaleDateString()}
                                </span>
                              </div>
                              <Badge className={`${config.textColor} bg-white/5 border border-white/10`}>
                                {activity.activityType}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-50 hover:opacity-100"
                              onClick={() => deleteActivityMutation.mutate({ id: activity.id })}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                          
                          {activity.contactPerson && (
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-4 w-4 text-purple-400" />
                              <span className="text-sm text-gray-300">{activity.contactPerson}</span>
                            </div>
                          )}
                          
                          {activity.content && (
                            <p className="text-sm text-gray-400 whitespace-pre-wrap mb-2">
                              {activity.content}
                            </p>
                          )}
                          
                          {activity.nextAction && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                              <ArrowLeft className="h-4 w-4 text-blue-400 rotate-180" />
                              <span className="text-sm font-medium text-blue-400">{activity.nextAction}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-500">{t.noActivities}</p>
              </div>
            )}
          </div>
        </div>

        {/* 直播履歴セクション - 広告司令塔スタイル */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <div className="flex flex-row items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-pink-400 to-pink-600 rounded-full" />
                <Video className="h-5 w-5 text-pink-400" />
                {t.livestreams}
                {livestreams.length > 0 && (
                  <Badge className="bg-pink-500/20 text-pink-400 border border-pink-500/30 ml-2 px-2 py-0.5 rounded-lg">{livestreams.length}</Badge>
                )}
              </h2>
              {livestreamStats && livestreamStats.totalStreams > 0 && (
                <div className="hidden md:flex gap-3">
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                    <DollarSign className="h-3 w-3 text-green-400" />
                    <span className="text-xs font-medium text-green-400">
                      {formatCurrency(livestreamStats.totalSales)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full">
                    <Video className="h-3 w-3 text-cyan-400" />
                    <span className="text-xs font-medium text-cyan-400">
                      {livestreamStats.totalStreams}回
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full">
                    <TrendingUp className="h-3 w-3 text-purple-400" />
                    <span className="text-xs font-medium text-purple-400">
                      平均 {formatCurrency(livestreamStats.avgSales)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Dialog open={isLivestreamDialogOpen} onOpenChange={setIsLivestreamDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-4 py-2 rounded-xl shadow-lg shadow-red-500/30">
                  <Plus className="h-4 w-4 mr-1" />
                  {t.addLivestream}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t.addLivestream}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t.livestreamDate} *</Label>
                      <Input
                        type="date"
                        value={newLivestream.livestreamDate}
                        onChange={(e) =>
                          setNewLivestream({ ...newLivestream, livestreamDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>{t.streamerName} *</Label>
                      <Input
                        value={newLivestream.streamerName}
                        onChange={(e) =>
                          setNewLivestream({ ...newLivestream, streamerName: e.target.value })
                        }
                        placeholder="直播達人名"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t.duration}</Label>
                    <Input
                      type="number"
                      value={newLivestream.duration}
                      onChange={(e) =>
                        setNewLivestream({ ...newLivestream, duration: e.target.value })
                      }
                      placeholder="分"
                    />
                  </div>
                  <div>
                    <Label>{t.platform}</Label>
                    <Select
                      value={newLivestream.platform}
                      onValueChange={(value) =>
                        setNewLivestream({ ...newLivestream, platform: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="プラットフォームを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="抖音">抖音</SelectItem>
                        <SelectItem value="淘宝">淘宝</SelectItem>
                        <SelectItem value="快手">快手</SelectItem>
                        <SelectItem value="TikTok">TikTok</SelectItem>
                        <SelectItem value="小红书">小红书</SelectItem>
                        <SelectItem value="その他">その他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.remarks}</Label>
                    <Textarea
                      value={newLivestream.remarks}
                      onChange={(e) =>
                        setNewLivestream({ ...newLivestream, remarks: e.target.value })
                      }
                    />
                  </div>
                  {/* 追加メトリクスフィールド */}
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">商品メトリクス</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t.productClicks}</Label>
                        <Input
                          type="number"
                          value={newLivestream.productClicks}
                          onChange={(e) =>
                            setNewLivestream({ ...newLivestream, productClicks: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>{t.impressions}</Label>
                        <Input
                          type="number"
                          value={newLivestream.impressions}
                          onChange={(e) =>
                            setNewLivestream({ ...newLivestream, impressions: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <Label>{t.salesCount}</Label>
                        <Input
                          type="number"
                          value={newLivestream.salesCount}
                          onChange={(e) =>
                            setNewLivestream({ ...newLivestream, salesCount: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>{t.gmv}</Label>
                        <Input
                          type="number"
                          value={newLivestream.gmv}
                          onChange={(e) =>
                            setNewLivestream({ ...newLivestream, gmv: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label>{t.cartAddCount}</Label>
                        <Input
                          type="number"
                          value={newLivestream.cartAddCount}
                          onChange={(e) =>
                            setNewLivestream({ ...newLivestream, cartAddCount: e.target.value })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* 商品選択セクション */}
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      商品別GMV（任意）
                    </Label>
                    
                    {/* 追加済み商品リスト */}
                    {livestreamProductsToAdd.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {livestreamProductsToAdd.map((product, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <span className="font-medium text-sm">{product.productName}</span>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                <span>GMV: {product.gmv ? `¥${parseInt(product.gmv).toLocaleString()}` : "-"}</span>
                                <span>数量: {product.quantity || "-"}</span>
                                <span>単価: {product.unitPrice ? `¥${parseInt(product.unitPrice).toLocaleString()}` : "-"}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLivestreamProductsToAdd(livestreamProductsToAdd.filter((_, i) => i !== index));
                              }}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 商品選択ドロップダウン */}
                    <div className="flex gap-2">
                      <Select
                        value=""
                        onValueChange={(value) => {
                          const product = products.find((p) => p.id === parseInt(value));
                          if (product) {
                            setLivestreamProductsToAdd([
                              ...livestreamProductsToAdd,
                              {
                                productId: product.id,
                                productName: product.productName,
                                gmv: "",
                                quantity: "",
                                unitPrice: product.specialPrice?.toString() || product.listPrice?.toString() || "",
                              },
                            ]);
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="商品を選択して追加" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.length > 0 ? (
                            products.map((product) => (
                              <SelectItem key={product.id} value={product.id.toString()}>
                                {product.productName}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>商品が登録されていません</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* 選択した商品のGMV入力 */}
                    {livestreamProductsToAdd.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {livestreamProductsToAdd.map((product, index) => (
                          <div key={index} className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-pink-700 dark:text-pink-400 mb-2">{product.productName}</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">GMV</Label>
                                <Input
                                  type="number"
                                  value={product.gmv}
                                  onChange={(e) => {
                                    const updated = [...livestreamProductsToAdd];
                                    updated[index].gmv = e.target.value;
                                    setLivestreamProductsToAdd(updated);
                                  }}
                                  placeholder="0"
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">数量</Label>
                                <Input
                                  type="number"
                                  value={product.quantity}
                                  onChange={(e) => {
                                    const updated = [...livestreamProductsToAdd];
                                    updated[index].quantity = e.target.value;
                                    setLivestreamProductsToAdd(updated);
                                  }}
                                  placeholder="0"
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">単価</Label>
                                <Input
                                  type="number"
                                  value={product.unitPrice}
                                  onChange={(e) => {
                                    const updated = [...livestreamProductsToAdd];
                                    updated[index].unitPrice = e.target.value;
                                    setLivestreamProductsToAdd(updated);
                                  }}
                                  placeholder="0"
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsLivestreamDialogOpen(false);
                        setLivestreamProductsToAdd([]);
                      }}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      onClick={handleAddLivestream}
                      disabled={createLivestreamMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {t.save}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            {/* 月別GMVサマリー */}
            {monthlyGmvSummary.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  月別GMV集計
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {monthlyGmvSummary.map((summary) => (
                    <div
                      key={summary.month}
                      className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 border border-purple-500/30 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-purple-400">
                          {summary.year}年{summary.monthNum}月
                        </span>
                        <Badge className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          {summary.livestreamCount}回
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">商品数</span>
                          <span className="text-sm font-medium text-pink-400">
                            {summary.productCount}品
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">GMV合計</span>
                          <span className="text-sm font-bold text-green-400">
                            {formatCurrency(summary.gmv)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {livestreams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {livestreams.map((ls) => {
                  const platformColors: Record<string, string> = {
                    "抖音": "border-pink-500/50 shadow-pink-500/20",
                    "淘宝": "border-orange-500/50 shadow-orange-500/20",
                    "快手": "border-yellow-500/50 shadow-yellow-500/20",
                    "TikTok": "border-cyan-500/50 shadow-cyan-500/20",
                    "小红书": "border-red-500/50 shadow-red-500/20",
                  };
                  const platformBadgeColors: Record<string, string> = {
                    "抖音": "bg-pink-500/20 text-pink-400 border-pink-500/30",
                    "淘宝": "bg-orange-500/20 text-orange-400 border-orange-500/30",
                    "快手": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                    "TikTok": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
                    "小红书": "bg-red-500/20 text-red-400 border-red-500/30",
                  };
                  const borderClass = platformColors[ls.platform || ""] || "border-gray-500/50 shadow-gray-500/20";
                  const badgeClass = platformBadgeColors[ls.platform || ""] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
                  
                  return (
                    <div
                      key={ls.id}
                      className={`group relative bg-gray-900/80 backdrop-blur-sm rounded-xl border ${borderClass} overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer`}
                      onClick={() => openEditLivestreamDialog(ls)}
                    >
                      {/* テクノロジー風グローエフェクト */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-pink-500 to-purple-500 opacity-60" />
                      
                      {/* 削除ボタン */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLivestreamMutation.mutate({ id: ls.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                      
                      <div className="p-4">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center">
                              <Video className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-gray-200">@{ls.streamerName}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(ls.livestreamDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {ls.platform && (
                            <Badge className={`${badgeClass} border`}>
                              {ls.platform}
                            </Badge>
                          )}
                        </div>
                        
                        {/* GMVメイン表示 - 大きく目立たせる */}
                        <div className="bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 border border-green-500/30 rounded-xl p-4 mb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-green-400" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">GMV</p>
                                <p className="text-2xl font-bold text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                                  {formatCurrency((ls as any).productGmvTotal || 0)}
                                </p>
                              </div>
                            </div>
                            {(ls as any).productCount > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-gray-400">商品数</p>
                                <p className="text-lg font-bold text-green-300">{(ls as any).productCount}品</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* サブメトリクス */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                              <Clock className="h-3 w-3 text-cyan-400" />
                              {t.duration}
                            </div>
                            <p className="font-bold text-cyan-400">
                              {ls.duration ? `${ls.duration}分` : "-"}
                            </p>
                          </div>
                          {ls.viewerCount && (
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                              <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                <Eye className="h-3 w-3 text-purple-400" />
                                {t.viewerCount}
                              </div>
                              <p className="font-bold text-purple-400">
                                {ls.viewerCount.toLocaleString()}
                              </p>
                            </div>
                          )}
                          {ls.orderCount && (
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                              <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                <ShoppingCart className="h-3 w-3 text-orange-400" />
                                {t.orderCount}
                              </div>
                              <p className="font-bold text-orange-400">
                                {ls.orderCount.toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* 編集ヒント */}
                        <div className="mt-3 pt-3 border-t border-gray-700/50">
                          <p className="text-xs text-center text-gray-500">
                            クリックして編集
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Video className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-500">{t.noLivestreams}</p>
              </div>
            )}
          </div>
        </div>

      {/* 直播商品別GMVダイアログ */}
      <Dialog open={isLivestreamProductDialogOpen} onOpenChange={setIsLivestreamProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-pink-500" />
              商品別GMV管理
              {selectedLivestream && (
                <Badge variant="outline" className="ml-2">
                  {selectedLivestream.streamerName} - {new Date(selectedLivestream.livestreamDate).toLocaleDateString()}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* 商品追加フォーム */}
            <div className="bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900/20 dark:to-red-900/20 rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新しい商品を追加
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>商品名 *</Label>
                  <Input
                    value={newLivestreamProduct.productName}
                    onChange={(e) => setNewLivestreamProduct({ ...newLivestreamProduct, productName: e.target.value })}
                    placeholder="商品名を入力"
                  />
                </div>
                <div>
                  <Label>GMV（売上）</Label>
                  <Input
                    type="number"
                    value={newLivestreamProduct.gmv}
                    onChange={(e) => setNewLivestreamProduct({ ...newLivestreamProduct, gmv: e.target.value })}
                    placeholder="例: 100000"
                  />
                </div>
                <div>
                  <Label>販売数量</Label>
                  <Input
                    type="number"
                    value={newLivestreamProduct.quantity}
                    onChange={(e) => setNewLivestreamProduct({ ...newLivestreamProduct, quantity: e.target.value })}
                    placeholder="例: 50"
                  />
                </div>
                <div>
                  <Label>単価</Label>
                  <Input
                    type="number"
                    value={newLivestreamProduct.unitPrice}
                    onChange={(e) => setNewLivestreamProduct({ ...newLivestreamProduct, unitPrice: e.target.value })}
                    placeholder="例: 2000"
                  />
                </div>
              </div>
              <Button
                className="mt-3 bg-pink-600 hover:bg-pink-700"
                onClick={handleAddLivestreamProduct}
                disabled={addLivestreamProductMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                商品を追加
              </Button>
            </div>

            {/* 商品リスト */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                登録済み商品
                {livestreamProducts && livestreamProducts.length > 0 && (
                  <Badge variant="secondary">{livestreamProducts.length}件</Badge>
                )}
              </h4>
              
              {livestreamProducts && livestreamProducts.length > 0 ? (
                <div className="space-y-2">
                  {/* 合計GMV */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">商品別GMV合計</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(livestreamProducts.reduce((sum, p) => sum + (p.gmv || 0), 0))}
                      </span>
                    </div>
                  </div>
                  
                  {livestreamProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product.productName}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-green-500" />
                            GMV: {formatCurrency(product.gmv)}
                          </span>
                          {product.quantity && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-blue-500" />
                              数量: {product.quantity}
                            </span>
                          )}
                          {product.unitPrice && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3 text-purple-500" />
                              単価: {formatCurrency(product.unitPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLivestreamProductMutation.mutate({ id: product.id })}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">まだ商品が登録されていません</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 直播編集ダイアログ */}
      <Dialog open={isEditLivestreamDialogOpen} onOpenChange={(open) => {
        setIsEditLivestreamDialogOpen(open);
        if (!open) {
          setEditingLivestream(null);
          setSelectedLivestream(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-pink-500" />
              直播記録を編集
            </DialogTitle>
          </DialogHeader>
          {editingLivestream && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t.livestreamDate} *</Label>
                  <Input
                    type="date"
                    value={editingLivestream.livestreamDate}
                    onChange={(e) =>
                      setEditingLivestream({ ...editingLivestream, livestreamDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t.streamerName} *</Label>
                  <Input
                    value={editingLivestream.streamerName}
                    onChange={(e) =>
                      setEditingLivestream({ ...editingLivestream, streamerName: e.target.value })
                    }
                    placeholder="直播達人名"
                  />
                </div>
              </div>
              <div>
                <Label>{t.duration}</Label>
                <Input
                  type="number"
                  value={editingLivestream.duration}
                  onChange={(e) =>
                    setEditingLivestream({ ...editingLivestream, duration: e.target.value })
                  }
                  placeholder="分"
                />
              </div>
              <div>
                <Label>{t.platform}</Label>
                <Select
                  value={editingLivestream.platform || ""}
                  onValueChange={(value) =>
                    setEditingLivestream({ ...editingLivestream, platform: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="プラットフォームを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="抖音">抖音</SelectItem>
                    <SelectItem value="淘宝">淘宝</SelectItem>
                    <SelectItem value="快手">快手</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="小红书">小红书</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.remarks}</Label>
                <Textarea
                  value={editingLivestream.remarks || ""}
                  onChange={(e) =>
                    setEditingLivestream({ ...editingLivestream, remarks: e.target.value })
                  }
                  placeholder="備考"
                />
              </div>
              
              {/* 商品メトリクス */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  商品メトリクス
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t.productClicks}</Label>
                    <Input
                      type="number"
                      value={editingLivestream.productClicks}
                      onChange={(e) =>
                        setEditingLivestream({ ...editingLivestream, productClicks: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>{t.impressions}</Label>
                    <Input
                      type="number"
                      value={editingLivestream.impressions}
                      onChange={(e) =>
                        setEditingLivestream({ ...editingLivestream, impressions: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>{t.salesCount}</Label>
                    <Input
                      type="number"
                      value={editingLivestream.salesCount}
                      onChange={(e) =>
                        setEditingLivestream({ ...editingLivestream, salesCount: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>GMV</Label>
                    <Input
                      type="number"
                      value={editingLivestream.gmv}
                      onChange={(e) =>
                        setEditingLivestream({ ...editingLivestream, gmv: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>{t.cartAddCount}</Label>
                    <Input
                      type="number"
                      value={editingLivestream.cartAddCount}
                      onChange={(e) =>
                        setEditingLivestream({ ...editingLivestream, cartAddCount: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              
              {/* 商品別GMV管理セクション */}
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  商品別GMV
                </Label>
                
                {/* 既存の商品リスト */}
                {livestreamProducts && livestreamProducts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {livestreamProducts.map((product) => (
                      <div key={product.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{product.productName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLivestreamProductMutation.mutate({ id: product.id })}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>GMV: {formatCurrency(product.gmv)}</span>
                          <span>数量: {product.quantity || "-"}</span>
                          <span>単価: {formatCurrency(product.unitPrice)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 商品追加 */}
                <div className="flex gap-2 mb-3">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const product = products.find((p) => p.id === parseInt(value));
                      if (product && selectedLivestream) {
                        addLivestreamProductMutation.mutate({
                          livestreamId: selectedLivestream.id,
                          productName: product.productName,
                          gmv: undefined,
                          quantity: undefined,
                          unitPrice: product.specialPrice || product.listPrice || undefined,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="商品を選択して追加" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.length > 0 ? (
                        products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.productName}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>商品が登録されていません</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditLivestreamDialogOpen(false);
                    setEditingLivestream(null);
                  }}
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleUpdateLivestream}
                  disabled={updateLivestreamMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {t.save}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
