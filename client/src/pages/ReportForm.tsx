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
import { FileText, Save, ArrowLeft } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ReportForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditMode = !!params.id;

  const [staffId, setStaffId] = useState<string>("");
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [workContent, setWorkContent] = useState<string>("");
  const [issues, setIssues] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Fetch active staff for dropdown
  const { data: activeStaff } = trpc.staff.listActive.useQuery();

  // Fetch existing report for edit mode
  const { data: existingReport, isLoading: reportLoading } = trpc.report.getById.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEditMode }
  );

  // Populate form with existing data in edit mode
  useEffect(() => {
    if (existingReport?.report) {
      setStaffId(existingReport.report.staffId.toString());
      setReportDate(
        new Date(existingReport.report.reportDate).toISOString().split("T")[0]
      );
      setWorkContent(existingReport.report.workContent);
      setIssues(existingReport.report.issues || "");
      setRemarks(existingReport.report.remarks || "");
    }
  }, [existingReport]);

  const createReport = trpc.report.create.useMutation({
    onSuccess: () => {
      toast.success("レポートを作成しました");
      setLocation("/reports");
    },
    onError: (error) => {
      toast.error(`作成に失敗しました: ${error.message}`);
    },
  });

  const updateReport = trpc.report.update.useMutation({
    onSuccess: () => {
      toast.success("レポートを更新しました");
      setLocation("/reports");
    },
    onError: (error) => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!staffId) {
      toast.error("スタッフを選択してください");
      return;
    }

    if (!workContent.trim()) {
      toast.error("業務内容を入力してください");
      return;
    }

    const data = {
      staffId: parseInt(staffId),
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

  const isPending = createReport.isPending || updateReport.isPending;

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
              onClick={() => setLocation("/reports")}
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
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger id="staff">
                    <SelectValue placeholder="スタッフを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStaff?.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>
                        {staff.name}
                        {staff.department && (
                          <span className="text-muted-foreground ml-2">
                            ({staff.department})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                onClick={() => setLocation("/reports")}
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
