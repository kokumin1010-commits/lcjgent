import { useState, useEffect } from "react";
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
import { FileText, Save, ArrowLeft, UserPlus, Globe } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

// Available countries
const COUNTRIES = [
  { value: "日本", label: "日本" },
  { value: "中国", label: "中国" },
];

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

  // Fetch active report staff for dropdown
  const { data: activeReportStaff, refetch: refetchReportStaff } = trpc.reportStaff.listActive.useQuery();

  // Fetch existing report for edit mode
  const { data: existingReport, isLoading: reportLoading } = trpc.report.getById.useQuery(
    { id: parseInt(params.id || "0") },
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
    onSuccess: () => {
      toast.success("レポートを作成しました");
      setLocation("/master/reports");
    },
    onError: (error) => {
      toast.error(`作成に失敗しました: ${error.message}`);
    },
  });

  const updateReport = trpc.report.update.useMutation({
    onSuccess: () => {
      toast.success("レポートを更新しました");
      setLocation("/master/reports");
    },
    onError: (error) => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

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
        toast.success(`新しいスタッフ「${newStaffName.trim()}」(${newStaffCountry})を登録しました`);
      } catch (error: any) {
        toast.error(`スタッフの作成に失敗しました: ${error.message}`);
        return;
      }
    } else if (!reportStaffId) {
      toast.error("スタッフを選択してください");
      return;
    }

    if (!workContent.trim()) {
      toast.error("業務内容を入力してください");
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

  const isPending = createReport.isPending || updateReport.isPending || createReportStaff.isPending;

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
                    <SelectItem value="new" className="text-primary font-medium">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        新規スタッフを追加
                      </div>
                    </SelectItem>
                    {activeReportStaff?.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>
                        {staff.name}
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
                        新規スタッフ名 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="newStaffName"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        placeholder="スタッフ名を入力"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newStaffCountry" className="text-sm flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        国 <span className="text-destructive">*</span>
                      </Label>
                      <Select 
                        value={newStaffCountry} 
                        onValueChange={setNewStaffCountry}
                      >
                        <SelectTrigger id="newStaffCountry" className="mt-1">
                          <SelectValue placeholder="国を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
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
                  onChange={(e) => setReportDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Work Content */}
            <div className="space-y-2">
              <Label htmlFor="workContent">
                業務内容 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="workContent"
                value={workContent}
                onChange={(e) => setWorkContent(e.target.value)}
                placeholder="今日行った業務内容を入力してください..."
                rows={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                複数の項目がある場合は、番号を付けて記載してください（例: 1. ○○の対応、2. △△の確認）
              </p>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              <Label htmlFor="issues">気付き・問題・理由</Label>
              <Textarea
                id="issues"
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                placeholder="業務中に気づいたこと、問題点、その理由などを入力してください..."
                rows={5}
              />
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="remarks">備考</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="その他の備考があれば入力してください..."
                rows={3}
              />
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
                  ? isEditMode
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
