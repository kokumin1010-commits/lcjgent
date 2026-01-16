import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Plus, Search, X, Pencil, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Reports() {
  const [, setLocation] = useLocation();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);

  // Fetch staff statistics for header cards
  const { data: staffStats, isLoading: statsLoading } = trpc.report.staffStatistics.useQuery();
  
  // Fetch active staff for filter dropdown
  const { data: activeStaff } = trpc.staff.listActive.useQuery();

  // Fetch reports with filters
  const { data: reports, isLoading: reportsLoading, refetch } = trpc.report.list.useQuery(
    {
      staffId: selectedStaffId !== "all" ? parseInt(selectedStaffId) : undefined,
      startDate: selectedDate ? `${selectedDate}T00:00:00` : undefined,
      endDate: selectedDate ? `${selectedDate}T23:59:59` : undefined,
    }
  );

  const deleteReport = trpc.report.delete.useMutation({
    onSuccess: () => {
      toast.success("レポートを削除しました");
      refetch();
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  const handleDeleteClick = (reportId: number) => {
    setReportToDelete(reportId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (reportToDelete) {
      deleteReport.mutate({ id: reportToDelete });
    }
  };

  const clearFilters = () => {
    setSelectedStaffId("all");
    setSelectedDate("");
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Staff Statistics Cards - WordPress style header */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {statsLoading ? (
            <div className="flex gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="w-32 animate-pulse">
                  <CardContent className="p-4 text-center">
                    <div className="h-4 bg-muted rounded w-16 mx-auto mb-2"></div>
                    <div className="h-8 bg-muted rounded w-8 mx-auto mb-2"></div>
                    <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            staffStats?.map((staff) => (
              <Card
                key={staff.id}
                className="w-32 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedStaffId(staff.id.toString())}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    {staff.name}
                  </p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {staff.monthlyCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    前月: {staff.totalCount}件 ({staff.daysInMonth}日中)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    今月: {staff.monthlyCount}件 ({staff.dayOfMonth}日中)
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Report List Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              レポート一覧
            </h2>
            <Button onClick={() => setLocation("/reports/new")}>
              <Plus className="h-4 w-4 mr-2" />
              新規レポートを作成
            </Button>
          </div>

          {/* Filters - WordPress style */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            <div className="space-y-2">
              <Label>スタッフ:</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="全員" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全員</SelectItem>
                  {activeStaff?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>日付:</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
            </div>

            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              フィルターをクリア
            </Button>
          </div>

          {/* Results count */}
          <div className="mb-4">
            <Badge variant="secondary" className="text-sm">
              <Search className="h-3 w-3 mr-1" />
              検索結果: {reports?.length || 0}件が該当しました
            </Badge>
          </div>

          {/* Reports Table - WordPress style */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-20">スタッフ</TableHead>
                  <TableHead className="w-28">日付</TableHead>
                  <TableHead>業務内容</TableHead>
                  <TableHead>気付き・問題・理由</TableHead>
                  <TableHead className="w-32">備考</TableHead>
                  <TableHead className="w-40">更新日時</TableHead>
                  <TableHead className="w-20 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        読み込み中...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : reports?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      レポートがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  reports?.map(({ report, staff }) => (
                    <TableRow key={report.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                            {staff?.name?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium text-sm">{staff?.name || "不明"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(report.reportDate)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm whitespace-pre-wrap line-clamp-3">
                            {report.workContent}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-sm">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                            {report.issues || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {report.remarks || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(report.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setLocation(`/reports/edit/${report.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>レポートを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            この操作は取り消せません。本当に削除しますか？
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteReport.isPending}
            >
              {deleteReport.isPending ? "削除中..." : "削除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
