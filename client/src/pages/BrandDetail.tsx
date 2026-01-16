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
import { ArrowLeft, Plus, Trash2, Edit2, TrendingUp } from "lucide-react";
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
  },
};

const statusColors: Record<string, string> = {
  "進行中": "bg-blue-100 text-blue-800",
  "打ち合わせ中": "bg-yellow-100 text-yellow-800",
  "契約済み": "bg-green-100 text-green-800",
  "保留": "bg-gray-100 text-gray-800",
  "終了": "bg-red-100 text-red-800",
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
    remarks: "",
  });
  const [newActivity, setNewActivity] = useState({
    activityDate: new Date().toISOString().split("T")[0],
    activityType: "進行中" as "進行中" | "打ち合わせ" | "完了",
    contactPerson: "",
    nextAction: "",
    content: "",
  });

  const brandId = parseInt(id || "0");

  const { data: brand, isLoading: brandLoading } = trpc.brand.getById.useQuery(
    { id: brandId }
  );

  const { data: products = [] } = trpc.brandProduct.listByBrand.useQuery(
    { brandId }
  );

  const { data: activities = [] } = trpc.brandActivity.listByBrand.useQuery(
    { brandId }
  );

  // レポートスタッフ一覧を取得（対応履歴の担当者選択用）
  const { data: reportStaff = [] } = trpc.reportStaff.listActive.useQuery();

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
        remarks: "",
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
    });
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

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "-";
    return `¥${value.toLocaleString()}`;
  };

  if (brandLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">ブランドが見つかりません</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/brands")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{brand.name}</h1>
            <p className="text-sm text-muted-foreground">{brand.companyName}</p>
          </div>
          <Button
            onClick={() => navigate(`/brands/${id}/edit`)}
            className="bg-red-600 hover:bg-red-700"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            {t.edit}
          </Button>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t.basicInfo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.category}</p>
                  <p className="font-medium">{brand.category || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.phoneNumber}</p>
                  <p className="font-medium">{brand.phoneNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.email}</p>
                  <p className="font-medium">{brand.email || "-"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.status}</p>
                  <Badge className={statusColors[brand.status] || "bg-gray-100"}>
                    {brand.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.contactPerson}</p>
                  <p className="font-medium">{brand.contactPerson || "-"}</p>
                </div>
              </div>
            </div>

            {/* Financial Info */}
            <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t.adBudget}</p>
                <p className="font-medium text-lg">{formatCurrency(brand.adBudget)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.salesTarget}</p>
                <p className="font-medium text-lg">{formatCurrency(brand.salesTarget)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.commissionRate}</p>
                <p className="font-medium text-lg">{brand.commissionRate || "-"}</p>
              </div>
            </div>

            {brand.memo && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">{t.memo}</p>
                <p className="font-medium whitespace-pre-wrap">{brand.memo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t.products}</CardTitle>
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
                    <Label>{t.remarks}</Label>
                    <Textarea
                      value={newProduct.remarks}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, remarks: e.target.value })
                      }
                    />
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
          </CardHeader>
          <CardContent>
            {products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.productName}</TableHead>
                    <TableHead className="text-right">{t.listPrice}</TableHead>
                    <TableHead className="text-right">{t.specialPrice}</TableHead>
                    <TableHead>{t.influencer}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.productName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.listPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.specialPrice)}
                      </TableCell>
                      <TableCell>{product.influencer || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            deleteProductMutation.mutate({ id: product.id })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noProducts}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t.activities}</CardTitle>
            <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700">
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
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.activityDate).toLocaleDateString()}
                        </p>
                        <Badge className="mt-1">{activity.activityType}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          deleteActivityMutation.mutate({ id: activity.id })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    {activity.contactPerson && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">担当者: </span>
                        {activity.contactPerson}
                      </p>
                    )}
                    {activity.content && (
                      <p className="text-sm whitespace-pre-wrap">{activity.content}</p>
                    )}
                    {activity.nextAction && (
                      <p className="text-sm text-blue-600">
                        <span className="text-muted-foreground">次のアクション: </span>
                        {activity.nextAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noActivities}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
