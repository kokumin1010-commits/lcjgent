import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

// Translations
const translations = {
  ja: {
    title: "名刺管理",
    addNew: "名刺を追加",
    search: "検索",
    searchPlaceholder: "名前、会社名、メールで検索...",
    noCards: "名刺がありません",
    noCardsDesc: "名刺をアップロードして連絡先を管理しましょう",
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
  },
  zh: {
    title: "名片管理",
    addNew: "添加名片",
    search: "搜索",
    searchPlaceholder: "按姓名、公司、邮箱搜索...",
    noCards: "暂无名片",
    noCardsDesc: "上传名片来管理您的联系人",
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
  },
};

export default function BusinessCards() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.ja;
  const utils = trpc.useUtils();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [duplicateCard, setDuplicateCard] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<{ url: string; key: string } | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<any>({});
  const [formData, setFormData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      const errorMessage = error.message || (language === "zh" ? "名片解析失败，请重试" : "名刺解析に失敗しました。再試行してください");
      toast.error(errorMessage);
      console.error("Business card upload error:", error);
    },
  });

  const createMutation = trpc.businessCard.create.useMutation({
    onSuccess: (data) => {
      if (data.duplicate && data.existingCard) {
        setDuplicateCard(data.existingCard);
        setIsDuplicateDialogOpen(true);
      } else {
        toast.success(language === "zh" ? "名片已保存" : "名刺を保存しました");
        setIsConfirmDialogOpen(false);
        resetForm();
        utils.businessCard.list.invalidate();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.businessCard.update.useMutation({
    onSuccess: () => {
      toast.success(language === "zh" ? "名片已更新" : "名刺を更新しました");
      setIsEditDialogOpen(false);
      utils.businessCard.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.businessCard.delete.useMutation({
    onSuccess: () => {
      toast.success(language === "zh" ? "名片已删除" : "名刺を削除しました");
      setIsDeleteDialogOpen(false);
      setSelectedCard(null);
      utils.businessCard.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(language === "zh" ? "文件太大，请选择10MB以下的图片" : "ファイルが大きすぎます。10MB以下の画像を選択してください");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast.error(language === "zh" ? "请选择图片文件" : "画像ファイルを選択してください");
      return;
    }

    setIsAnalyzing(true);
    setIsUploadDialogOpen(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        uploadMutation.mutate({
          imageBase64: base64,
          mimeType: file.type,
        });
      } catch (error) {
        setIsAnalyzing(false);
        setIsUploadDialogOpen(false);
        toast.error(language === "zh" ? "文件读取失败" : "ファイルの読み込みに失敗しました");
        console.error("File read error:", error);
      }
    };
    reader.onerror = () => {
      setIsAnalyzing(false);
      setIsUploadDialogOpen(false);
      toast.error(language === "zh" ? "文件读取失败" : "ファイルの読み込みに失敗しました");
    };
    reader.readAsDataURL(file);
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
    // Force create by adding a timestamp to make it unique
    const uniqueFormData = {
      ...formData,
      notes: `${formData.notes || ""}\n[重複登録: ${new Date().toLocaleString()}]`.trim(),
    };
    // Directly insert without duplicate check
    createMutation.mutate({
      ...uniqueFormData,
      imageUrl: uploadedImage?.url,
      imageKey: uploadedImage?.key,
    });
  };

  const handleUpdate = () => {
    if (!selectedCard) return;
    updateMutation.mutate({
      id: selectedCard.id,
      ...formData,
    });
  };

  const handleDelete = () => {
    if (!selectedCard) return;
    deleteMutation.mutate({ id: selectedCard.id });
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

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{t.title}</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4 mr-2" />
            {t.addNew}
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Cards Grid */}
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
              <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" />
                {t.takePhoto}
              </Button>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {t.selectFile}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{card.name}</CardTitle>
                      {card.position && (
                        <p className="text-sm text-muted-foreground">{card.position}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {card.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{card.company}</span>
                  </div>
                )}
                {card.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${card.email}`} className="text-primary hover:underline">
                      {card.email}
                    </a>
                  </div>
                )}
                {(card.phone || card.mobile) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{card.phone || card.mobile}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedCard(card);
                      setIsDetailDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {t.view}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(card)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {t.edit}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCard(card);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      {/* Confirm Info Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.confirmInfo}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t.confirmInfoDesc}</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {uploadedImage && (
              <div className="flex justify-center">
                <img
                  src={uploadedImage.url}
                  alt="Business card"
                  className="max-h-48 rounded border"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t.name} *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.nameReading}</Label>
                <Input
                  value={formData.nameReading || ""}
                  onChange={(e) => setFormData({ ...formData, nameReading: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.company}</Label>
                <Input
                  value={formData.company || ""}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.department}</Label>
                <Input
                  value={formData.department || ""}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.position}</Label>
                <Input
                  value={formData.position || ""}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.email}</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.phone}</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.mobile}</Label>
                <Input
                  value={formData.mobile || ""}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.fax}</Label>
                <Input
                  value={formData.fax || ""}
                  onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.website}</Label>
                <Input
                  value={formData.website || ""}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t.address}</Label>
              <Input
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              {t.cancel}
            </Button>
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
                  <img
                    src={selectedCard.imageUrl}
                    alt={selectedCard.name}
                    className="max-h-48 rounded border"
                  />
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
                      <a href={`mailto:${selectedCard.email}`} className="text-primary hover:underline">
                        {selectedCard.email}
                      </a>
                    </div>
                  </div>
                )}
                {(selectedCard.phone || selectedCard.mobile) && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t.phone}</p>
                      <p>{selectedCard.phone || selectedCard.mobile}</p>
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
                      <a
                        href={selectedCard.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedCard.website}
                      </a>
                    </div>
                  </div>
                )}
                {selectedCard.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t.notes}</p>
                    <p className="whitespace-pre-wrap">{selectedCard.notes}</p>
                  </div>
                )}
                <div className="text-sm text-muted-foreground pt-2 border-t">
                  {t.registeredAt}: {new Date(selectedCard.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={() => {
              setIsDetailDialogOpen(false);
              openEditDialog(selectedCard);
            }}>
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
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.nameReading}</Label>
                <Input
                  value={formData.nameReading || ""}
                  onChange={(e) => setFormData({ ...formData, nameReading: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.company}</Label>
                <Input
                  value={formData.company || ""}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.department}</Label>
                <Input
                  value={formData.department || ""}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.position}</Label>
                <Input
                  value={formData.position || ""}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.email}</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.phone}</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.mobile}</Label>
                <Input
                  value={formData.mobile || ""}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.fax}</Label>
                <Input
                  value={formData.fax || ""}
                  onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                />
              </div>
              <div>
                <Label>{t.website}</Label>
                <Input
                  value={formData.website || ""}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t.address}</Label>
              <Input
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.notes}</Label>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.name || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.save}
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
