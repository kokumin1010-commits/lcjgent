import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Save,
  ArrowLeft,
  UserPlus,
  Globe,
  ImagePlus,
  X,
  Upload,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Target,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { DAILY_REPORT_PLACEHOLDERS } from "./reportTemplate";

// Available countries
const COUNTRIES = [
  { value: "日本", label: "日本" },
  { value: "中国", label: "中国" },
];

// Image label options
const IMAGE_LABELS = ["LINE截图", "Lark截图"] as const;
type ImageLabel = (typeof IMAGE_LABELS)[number];

interface PendingImage {
  file: File;
  preview: string;
  label: ImageLabel;
}

export default function ReportForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditMode = !!params.id;

  const [reportStaffId, setReportStaffId] = useState<string>("");
  const [isNewStaff, setIsNewStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCountry, setNewStaffCountry] = useState<string>("日本");
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [workContent, setWorkContent] = useState<string>("");
  const [issues, setIssues] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Image upload state
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [currentLabel, setCurrentLabel] = useState<ImageLabel>("LINE截图");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch active report staff for dropdown
  const { data: activeReportStaff, refetch: refetchReportStaff } =
    trpc.reportStaff.listActive.useQuery();

  // Fetch existing report for edit mode
  const { data: existingReport, isLoading: reportLoading } =
    trpc.report.getById.useQuery(
      { id: parseInt(params.id || "0") },
      { enabled: isEditMode }
    );

  // Fetch existing attachments in edit mode
  const { data: existingAttachments, refetch: refetchAttachments } =
    trpc.report.getAttachments.useQuery(
      { reportId: parseInt(params.id || "0") },
      { enabled: isEditMode }
    );

  // Populate form with existing data in edit mode
  useEffect(() => {
    if (existingReport?.report) {
      setReportStaffId(existingReport.report.reportStaffId.toString());
      setReportDate(
        new Date(existingReport.report.reportDate).toISOString().split("T")[0]
      );
      setWorkContent(existingReport.report.workContent);
      setIssues(existingReport.report.issues || "");
      setRemarks(existingReport.report.remarks || "");
    }
  }, [existingReport]);

  // Create new report staff mutation
  const createReportStaff = trpc.reportStaff.create.useMutation({
    onSuccess: () => {
      refetchReportStaff();
    },
  });

  const createReport = trpc.report.create.useMutation({
    onSuccess: async report => {
      // Upload pending images after report creation
      if (pendingImages.length > 0 && report?.id) {
        await uploadPendingImages(report.id);
      }
      toast.success("レポートを作成しました");
      setLocation("/master/reports");
    },
    onError: error => {
      toast.error(`作成に失敗しました: ${error.message}`);
    },
  });

  const updateReport = trpc.report.update.useMutation({
    onSuccess: async () => {
      // Upload pending images after report update
      if (pendingImages.length > 0 && params.id) {
        await uploadPendingImages(parseInt(params.id));
      }
      toast.success("レポートを更新しました");
      setLocation("/master/reports");
    },
    onError: error => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

  const uploadAttachment = trpc.report.uploadAttachment.useMutation();
  const deleteAttachment = trpc.report.deleteAttachment.useMutation({
    onSuccess: () => {
      refetchAttachments();
    },
  });

  const uploadPendingImages = async (reportId: number) => {
    setIsUploading(true);
    try {
      for (const img of pendingImages) {
        const base64 = await fileToBase64(img.file);
        await uploadAttachment.mutateAsync({
          reportId,
          base64,
          filename: img.file.name,
          label: img.label,
        });
      }
      setPendingImages([]);
    } catch (error: any) {
      toast.error(`画像アップロードに失敗: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/xxx;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: PendingImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} は画像ファイルではありません`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} は10MBを超えています`);
        continue;
      }
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        label: currentLabel,
      });
    }
    setPendingImages(prev => [...prev, ...newImages]);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newImages: PendingImage[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > 10 * 1024 * 1024) {
          toast.error("粘贴的图片超过10MB");
          continue;
        }
        newImages.push({
          file,
          preview: URL.createObjectURL(file),
          label: currentLabel,
        });
      }
    }
    if (newImages.length > 0) {
      e.preventDefault();
      setPendingImages(prev => [...prev, ...newImages]);
      toast.success(`已粘贴 ${newImages.length} 张图片`);
    }
  };

  const handleDeleteExistingAttachment = (id: number) => {
    if (confirm("この画像を削除しますか？")) {
      deleteAttachment.mutate({ id });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalReportStaffId = reportStaffId;

    // If creating new report staff, create them first
    if (isNewStaff) {
      if (!newStaffName.trim()) {
        toast.error("スタッフ名を入力してください");
        return;
      }

      try {
        // Create new report staff
        const newReportStaff = await createReportStaff.mutateAsync({
          name: newStaffName.trim(),
          country: newStaffCountry,
        });

        if (!newReportStaff) {
          toast.error("スタッフの作成に失敗しました");
          return;
        }

        finalReportStaffId = newReportStaff.id.toString();
        toast.success(
          `新しいスタッフ「${newStaffName.trim()}」(${newStaffCountry})を登録しました`
        );
      } catch (error: any) {
        toast.error(`スタッフの作成に失敗しました: ${error.message}`);
        return;
      }
    } else if (!reportStaffId) {
      toast.error("スタッフを選択してください");
      return;
    }

    if (!workContent.trim()) {
      toast.error("请填写今日已完成工作");
      return;
    }

    if (!issues.trim()) {
      toast.error("请填写待跟进事项及问题/备注；没有请填写“无”");
      return;
    }

    if (!remarks.trim()) {
      toast.error("请填写明日优先工作；没有请填写“无”");
      return;
    }

    const data = {
      reportStaffId: parseInt(finalReportStaffId),
      reportDate: `${reportDate}T00:00:00`,
      workContent: workContent.trim(),
      issues: issues.trim() || undefined,
      remarks: remarks.trim() || undefined,
    };

    if (isEditMode) {
      updateReport.mutate({ id: parseInt(params.id!), ...data });
    } else {
      createReport.mutate(data);
    }
  };

  const handleStaffSelectionChange = (value: string) => {
    if (value === "new") {
      setIsNewStaff(true);
      setReportStaffId("");
    } else {
      setIsNewStaff(false);
      setReportStaffId(value);
    }
  };

  const isPending =
    createReport.isPending ||
    updateReport.isPending ||
    createReportStaff.isPending ||
    isUploading;

  if (isEditMode && reportLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/master/reports")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isEditMode ? "レポートを編集" : "新規レポートを作成"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Staff Selection */}
              <div className="space-y-2">
                <Label htmlFor="staff">
                  スタッフ <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={isNewStaff ? "new" : reportStaffId}
                  onValueChange={handleStaffSelectionChange}
                >
                  <SelectTrigger id="staff">
                    <SelectValue placeholder="スタッフを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="new"
                      className="text-primary font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        新規スタッフを追加
                      </div>
                    </SelectItem>
                    {activeReportStaff?.map((staff: any) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>
                        {staff.nameCn
                          ? `${staff.name}（${staff.nameCn}）`
                          : staff.name}
                        {staff.country && (
                          <span className="text-muted-foreground ml-2">
                            ({staff.country})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* New Staff Input Fields */}
                {isNewStaff && (
                  <div className="mt-3 p-4 border rounded-lg bg-muted/30 space-y-4">
                    <div>
                      <Label htmlFor="newStaffName" className="text-sm">
                        新規スタッフ名{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="newStaffName"
                        value={newStaffName}
                        onChange={e => setNewStaffName(e.target.value)}
                        placeholder="スタッフ名を入力"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="newStaffCountry"
                        className="text-sm flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" />国{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={newStaffCountry}
                        onValueChange={setNewStaffCountry}
                      >
                        <SelectTrigger id="newStaffCountry" className="mt-1">
                          <SelectValue placeholder="国を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map(country => (
                            <SelectItem
                              key={country.value}
                              value={country.value}
                            >
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      入力した名前と国で新しいレポートスタッフが自動的に登録されます
                    </p>
                  </div>
                )}
              </div>

              {/* Report Date */}
              <div className="space-y-2">
                <Label htmlFor="reportDate">
                  日付 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reportDate"
                  type="date"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {!isEditMode && (
              <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <FileText className="h-4 w-4 text-sky-600" />
                    统一日报填写标准
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    文本框内的灰色内容仅为填写示例，不会随日报保存；点击文本框后直接输入实际内容即可。
                  </p>
                </div>
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    已完成：写清对象、动作、结果
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                    <Clock3 className="h-4 w-4 shrink-0" />
                    待跟进：写清下一步动作
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    问题：写清影响和协助人
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-indigo-800">
                    <Target className="h-4 w-4 shrink-0" />
                    明日重点：最多列3项
                  </div>
                </div>
              </div>
            )}

            {/* Work Content */}
            <div className="space-y-2">
              <Label htmlFor="workContent" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                今日已完成 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="workContent"
                value={workContent}
                onChange={e => setWorkContent(e.target.value)}
                placeholder={DAILY_REPORT_PLACEHOLDERS.workContent}
                className="placeholder:text-slate-400 placeholder:opacity-100"
                rows={10}
                required
              />
              <p className="text-xs text-muted-foreground">
                每条建议使用「【品牌/店铺｜事项】动作 +
                结果/数据」格式，避免只写“协助运营”等笼统描述。
              </p>
            </div>

            {/* Pending items and issues */}
            <div className="space-y-2">
              <Label htmlFor="issues" className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-600" />
                待跟进事项 / 问题与备注{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="issues"
                value={issues}
                onChange={e => setIssues(e.target.value)}
                placeholder={DAILY_REPORT_PLACEHOLDERS.issues}
                className="placeholder:text-slate-400 placeholder:opacity-100"
                rows={9}
                required
              />
              <p className="text-xs text-muted-foreground">
                待跟进事项必须写具体下一步；问题项请说明影响、原因及需要谁协助。
              </p>
            </div>

            {/* Tomorrow priorities */}
            <div className="space-y-2">
              <Label htmlFor="remarks" className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-600" />
                明日优先工作 / 附件说明{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={DAILY_REPORT_PLACEHOLDERS.remarks}
                className="placeholder:text-slate-400 placeholder:opacity-100"
                rows={7}
                required
              />
              <p className="text-xs text-muted-foreground">
                明日重点建议控制在2–3项，并按优先级排序；无附件请填写“无”。
              </p>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-3" onPaste={handlePaste} tabIndex={0}>
              <Label className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                截图上传（LINE / Lark）
              </Label>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Label selector */}
                <Select
                  value={currentLabel}
                  onValueChange={v => setCurrentLabel(v as ImageLabel)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_LABELS.map(label => (
                      <SelectItem key={label} value={label}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Upload button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  选择图片
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <p className="text-xs text-muted-foreground">
                  支持 JPG/PNG，最大10MB | 可直接 Ctrl+V 粘贴截图
                </p>
              </div>

              {/* Existing attachments (edit mode) */}
              {isEditMode &&
                existingAttachments &&
                existingAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      已上传的图片：
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {existingAttachments.map((att: any) => (
                        <div
                          key={att.id}
                          className="relative group border rounded-lg overflow-hidden"
                        >
                          <img
                            src={att.imageUrl}
                            alt={att.label}
                            className="w-full h-24 object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-0.5 flex items-center justify-between">
                            <span>{att.label}</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteExistingAttachment(att.id)
                              }
                              className="text-red-300 hover:text-red-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Pending images preview */}
              {pendingImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    待上传 ({pendingImages.length}张)：
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {pendingImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative group border rounded-lg overflow-hidden border-blue-200 bg-blue-50"
                      >
                        <img
                          src={img.preview}
                          alt={img.label}
                          className="w-full h-24 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-blue-900/70 text-white text-[10px] px-2 py-0.5 flex items-center justify-between">
                          <span>{img.label}</span>
                          <button
                            type="button"
                            onClick={() => removePendingImage(idx)}
                            className="text-red-300 hover:text-red-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/master/reports")}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isPending}>
                <Save className="h-4 w-4 mr-2" />
                {isPending
                  ? isUploading
                    ? "画像アップロード中..."
                    : isEditMode
                      ? "更新中..."
                      : "作成中..."
                  : isEditMode
                    ? "更新"
                    : "作成"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
