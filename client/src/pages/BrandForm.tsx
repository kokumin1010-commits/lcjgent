import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const translations = {
  ja: {
    newTitle: "ブランド登録",
    editTitle: "ブランド編集",
    brandName: "ブランド名",
    brandNameJa: "日本語読みブランド名",
    brandNameJaHint: "ライブ配信時に使用する日本語の読み方を入力してください",
    companyName: "会社名",
    category: "カテゴリー",
    phoneNumber: "電話番号",
    status: "ステータス",
    materialCategory: "素材カテゴリ",
    email: "メールアドレス",
    contactPerson: "担当者名",
    adBudget: "広告費",
    salesTarget: "売上目標",
    commissionRate: "成果報酬",
    shopId: "店舗ID",
    shopCode: "ショップコード",
    businessCard: "名刺",
    businessCardHint: "名刺に登録できるのは2枚のみです。ドラッグ＆ドロップで登録・差し替え可能です。",
    logo: "画像情報（ロゴ）",
    logoHint: "ロゴ画像に登録できるのは1枚のみです。ドラッグ＆ドロップで登録・差し替え可能です。",
    memo: "メモ",
    save: "登録",
    update: "更新",
    cancel: "キャンセル",
    inProgress: "進行中",
    meeting: "打ち合わせ中",
    contracted: "契約済み",
    onHold: "保留",
    ended: "終了",
    selectCategory: "サービス業",
    success: "保存しました",
    error: "エラーが発生しました",
    uploading: "アップロード中...",
    customStatus: "出品したい項目入力",
  },
  zh: {
    newTitle: "品牌注册",
    editTitle: "品牌编辑",
    brandName: "品牌名",
    brandNameJa: "日语读音品牌名",
    brandNameJaHint: "请输入直播时使用的日语读音",
    companyName: "公司名",
    category: "类别",
    phoneNumber: "电话号码",
    status: "状态",
    materialCategory: "素材类别",
    email: "邮箱地址",
    contactPerson: "负责人",
    adBudget: "广告费",
    salesTarget: "销售目标",
    commissionRate: "成果报酬",
    shopId: "店铺ID",
    shopCode: "店铺代码",
    businessCard: "名片",
    businessCardHint: "名片最多可上传2张。可拖拽上传或替换。",
    logo: "图片信息（Logo）",
    logoHint: "Logo图片最多可上传1张。可拖拽上传或替换。",
    memo: "备注",
    save: "注册",
    update: "更新",
    cancel: "取消",
    inProgress: "进行中",
    meeting: "洽谈中",
    contracted: "已签约",
    onHold: "保留",
    ended: "结束",
    selectCategory: "服务业",
    success: "保存成功",
    error: "发生错误",
    uploading: "上传中...",
    customStatus: "输入想要上架的项目",
  },
};

const categoryKeys = [
  "service",
  "manufacturing",
  "retail",
  "it",
  "food",
  "beauty",
  "fashion",
  "other",
] as const;

const categoryTranslations = {
  ja: {
    service: "サービス業",
    manufacturing: "製造業",
    retail: "小売業",
    it: "IT・通信",
    food: "飲食業",
    beauty: "美容・健康",
    fashion: "ファッション",
    other: "その他",
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
  },
};

export default function BrandForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const t = translations[language];
  const isEdit = !!id && id !== "new";

  const [formData, setFormData] = useState({
    name: "",
    nameJa: "",
    companyName: "",
    category: "service",
    phoneNumber: "",
    status: "進行中" as "進行中" | "打ち合わせ中" | "契約済み" | "保留" | "終了",
    materialCategory: "",
    email: "",
    contactPerson: "",
    adBudget: "",
    salesTarget: "",
    commissionRate: "",
    shopId: "",
    shopCode: "",
    memo: "",
  });

  const [businessCards, setBusinessCards] = useState<{ url: string; key: string }[]>([]);
  const [logo, setLogo] = useState<{ url: string; key: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const businessCardInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: brand, isLoading } = trpc.brand.getById.useQuery(
    { id: parseInt(id || "0") },
    { enabled: isEdit }
  );

  const createMutation = trpc.brand.create.useMutation();
  const updateMutation = trpc.brand.update.useMutation();
  const uploadMutation = trpc.brand.uploadImage.useMutation();

  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name,
        nameJa: brand.nameJa || "",
        companyName: brand.companyName || "",
        category: brand.category || "service",
        phoneNumber: brand.phoneNumber || "",
        status: brand.status as any,
        materialCategory: brand.materialCategory || "",
        email: brand.email || "",
        contactPerson: brand.contactPerson || "",
        adBudget: brand.adBudget?.toString() || "",
        salesTarget: brand.salesTarget?.toString() || "",
        commissionRate: brand.commissionRate || "",
        shopId: (brand as any).shopId || "",
        shopCode: (brand as any).shopCode || "",
        memo: brand.memo || "",
      });
      
      if (brand.businessCardUrls && brand.businessCardKeys) {
        const cards = brand.businessCardUrls.map((url: string, i: number) => ({
          url,
          key: brand.businessCardKeys?.[i] || "",
        }));
        setBusinessCards(cards);
      }
      
      if (brand.logoUrl) {
        setLogo({ url: brand.logoUrl, key: brand.logoKey || "" });
      }
    }
  }, [brand]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (
    file: File,
    type: "logo" | "businessCard"
  ) => {
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({
          base64,
          filename: file.name,
          type,
        });

        if (type === "logo") {
          setLogo(result);
        } else {
          if (businessCards.length < 2) {
            setBusinessCards((prev) => [...prev, result]);
          }
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      toast.error(t.error);
    }
  };

  const handleRemoveBusinessCard = (index: number) => {
    setBusinessCards((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveLogo = () => {
    setLogo(null);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        name: formData.name,
        nameJa: formData.nameJa,
        companyName: formData.companyName || undefined,
        category: formData.category || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        status: formData.status,
        materialCategory: formData.materialCategory || undefined,
        email: formData.email || undefined,
        contactPerson: formData.contactPerson || undefined,
        adBudget: formData.adBudget ? parseFloat(formData.adBudget) : undefined,
        salesTarget: formData.salesTarget ? parseFloat(formData.salesTarget) : undefined,
        commissionRate: formData.commissionRate || undefined,
        shopId: formData.shopId || undefined,
        shopCode: formData.shopCode || undefined,
        businessCardUrls: businessCards.map((c) => c.url),
        businessCardKeys: businessCards.map((c) => c.key),
        logoUrl: logo?.url || undefined,
        logoKey: logo?.key || undefined,
        memo: formData.memo || undefined,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: parseInt(id!), ...data });
      } else {
        await createMutation.mutateAsync(data);
      }

      toast.success(t.success);
      navigate("/master/brands");
    } catch (error) {
      toast.error(t.error);
    }
  };

  if (isEdit && isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/master/brands")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{isEdit ? t.editTitle : t.newTitle}</h1>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.brandName} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.brandNameJa} *</Label>
                <Input
                  value={formData.nameJa}
                  onChange={(e) => handleInputChange("nameJa", e.target.value)}
                  placeholder={t.brandNameJaHint}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.companyName}</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => handleInputChange("companyName", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.category}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => handleInputChange("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {categoryTranslations[language][key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.phoneNumber}</Label>
                <Input
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.status}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleInputChange("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="進行中">{t.inProgress}</SelectItem>
                    <SelectItem value="打ち合わせ中">{t.meeting}</SelectItem>
                    <SelectItem value="契約済み">{t.contracted}</SelectItem>
                    <SelectItem value="保留">{t.onHold}</SelectItem>
                    <SelectItem value="終了">{t.ended}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.email}</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.contactPerson}</Label>
                <Input
                  value={formData.contactPerson}
                  onChange={(e) => handleInputChange("contactPerson", e.target.value)}
                />
              </div>
            </div>


            {/* Shop ID & Shop Code */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.shopId}</Label>
                <Input
                  value={formData.shopId}
                  onChange={(e) => handleInputChange("shopId", e.target.value)}
                  placeholder="例: 12345"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.shopCode}</Label>
                <Input
                  value={formData.shopCode}
                  onChange={(e) => handleInputChange("shopCode", e.target.value)}
                  placeholder="例: SHOP-001"
                />
              </div>
            </div>

            {/* Business Cards */}
            <div className="space-y-2">
              <Label>{t.businessCard}</Label>
              <p className="text-sm text-muted-foreground">{t.businessCardHint}</p>
              <div className="flex gap-4">
                {businessCards.map((card, index) => (
                  <div key={index} className="relative">
                    <img
                      src={card.url}
                      alt={`Business card ${index + 1}`}
                      className="w-32 h-20 object-cover rounded border"
                    />
                    <button
                      onClick={() => handleRemoveBusinessCard(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {businessCards.length < 2 && (
                  <div
                    onClick={() => businessCardInputRef.current?.click()}
                    className="w-32 h-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <input
                  ref={businessCardInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "businessCard");
                  }}
                />
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label>{t.logo}</Label>
              <p className="text-sm text-muted-foreground">{t.logoHint}</p>
              <div className="flex gap-4">
                {logo ? (
                  <div className="relative">
                    <img
                      src={logo.url}
                      alt="Logo"
                      className="w-32 h-32 object-contain rounded border"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="w-32 h-32 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted/50"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "logo");
                  }}
                />
              </div>
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label>{t.memo}</Label>
              <Textarea
                value={formData.memo}
                onChange={(e) => handleInputChange("memo", e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || isUploading || createMutation.isPending || updateMutation.isPending}
                className="bg-red-600 hover:bg-red-700 px-8"
              >
                {isUploading ? t.uploading : isEdit ? t.update : t.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
