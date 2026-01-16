import { useState, useMemo } from "react";
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
} from "@/components/ui/dialog";
import { FileText, Plus, Search, X, Pencil, Trash2, Globe, Clock, AlertTriangle, CheckCircle, Link } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// Available countries for filtering
const COUNTRIES = [
  { value: "日本", label: "日本" },
  { value: "中国", label: "中国" },
];

export default function Reports() {
  const [, setLocation] = useLocation();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);
  const { t, language } = useLanguage();

  // Fetch staff statistics for header cards
  const { data: staffStats, isLoading: statsLoading } = trpc.report.staffStatistics.useQuery();
  
  // Fetch active report staff for filter dropdown
  const { data: activeReportStaff } = trpc.reportStaff.listActive.useQuery();

  // Fetch reports with filters
  const { data: reports, isLoading: reportsLoading, refetch } = trpc.report.list.useQuery(
    {
      reportStaffId: selectedStaffId !== "all" ? parseInt(selectedStaffId) : undefined,
      startDate: selectedDate ? `${selectedDate}T00:00:00` : undefined,
      endDate: selectedDate ? `${selectedDate}T23:59:59` : undefined,
    }
  );

  // Filter staff stats by country
  const filteredStaffStats = useMemo(() => {
    if (!staffStats) return [];
    if (selectedCountry === "all") return staffStats;
    return staffStats.filter(staff => staff.country === selectedCountry);
  }, [staffStats, selectedCountry]);

  // Filter reports by country (client-side filtering since we have staff info)
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (selectedCountry === "all") return reports;
    return reports.filter(({ staff }) => staff?.country === selectedCountry);
  }, [reports, selectedCountry]);

  // Get unique countries from report staff
  const availableCountries = useMemo(() => {
    if (!activeReportStaff) return COUNTRIES;
    const countries = new Set<string>();
    activeReportStaff.forEach(staff => {
      if (staff.country) countries.add(staff.country);
    });
    // Merge with default countries
    COUNTRIES.forEach(c => countries.add(c.value));
    return Array.from(countries).map(c => ({ value: c, label: c }));
  }, [activeReportStaff]);

  const deleteReport = trpc.report.delete.useMutation({
    onSuccess: () => {
      toast.success(t("reports.deleted"));
      refetch();
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    },
    onError: (error) => {
      toast.error(`${t("common.error")}: ${error.message}`);
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
    setSelectedCountry("all");
    setSelectedDate("");
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString(language === "ja" ? "ja-JP" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString(language === "ja" ? "ja-JP" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Country Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground mr-2">{t("reports.country")}:</span>
        <Button
          variant={selectedCountry === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCountry("all")}
        >
          {t("reports.allCountries")}
        </Button>
        {availableCountries.map((country) => (
          <Button
            key={country.value}
            variant={selectedCountry === country.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCountry(country.value)}
          >
            {country.label}
          </Button>
        ))}
      </div>

      {/* Staff Statistics Cards - WordPress style header */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {statsLoading ? (
            <div className="flex gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="w-36 animate-pulse">
                  <CardContent className="p-4 text-center">
                    <div className="h-4 bg-muted rounded w-16 mx-auto mb-2"></div>
                    <div className="h-8 bg-muted rounded w-8 mx-auto mb-2"></div>
                    <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredStaffStats.length === 0 ? (
            <Card className="w-full">
              <CardContent className="p-4 text-center text-muted-foreground">
                {t("reports.noStaffInCountry")}
              </CardContent>
            </Card>
          ) : (
            filteredStaffStats.map((staff) => (
              <Card
                key={staff.id}
                className="w-36 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedStaffId(staff.id.toString())}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    {staff.name}
                  </p>
                  {staff.country && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {staff.country}
                    </Badge>
                  )}
                  <p className="text-3xl font-bold text-primary mt-1">
                    {staff.monthlyCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("reports.lastMonth")}: {staff.totalCount}{t("reports.items")} ({staff.daysInMonth}{t("reports.days")})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("reports.thisMonth")}: {staff.monthlyCount}{t("reports.items")} ({staff.dayOfMonth}{t("reports.days")})
                  </p>
                  {/* Task progress badges for linked staff */}
                  {staff.linkedStaffId && (
                    <StaffTaskProgress staffId={staff.linkedStaffId} />
                  )}
                  {!staff.linkedStaffId && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <Link className="h-3 w-3" />
                      {t("reports.notLinked")}
                    </p>
                  )}
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
              {t("reports.list")}
            </h2>
            <Button onClick={() => setLocation("/reports/new")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("reports.create")}
            </Button>
          </div>

          {/* Filters - WordPress style */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            <div className="space-y-2">
              <Label>{t("reports.staff")}:</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("reports.allStaff")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("reports.allStaff")}</SelectItem>
                  {activeReportStaff?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.name}
                      {staff.country && (
                        <span className="text-muted-foreground ml-1">
                          ({staff.country})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("reports.date")}:</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
            </div>

            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              {t("reports.clearFilter")}
            </Button>
          </div>

          {/* Results count */}
          <div className="mb-4">
            <Badge variant="secondary" className="text-sm">
              <Search className="h-3 w-3 mr-1" />
              {t("reports.searchResults")}: {filteredReports.length}{t("reports.items")}
            </Badge>
          </div>

          {/* Reports Table - WordPress style */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-24">{t("reports.staff")}</TableHead>
                  <TableHead className="w-28">{t("reports.date")}</TableHead>
                  <TableHead>{t("reports.workContent")}</TableHead>
                  <TableHead>{t("reports.issues")}</TableHead>
                  <TableHead className="w-32">{t("reports.remarks")}</TableHead>
                  <TableHead className="w-36">{t("reports.updatedAt")}</TableHead>
                  <TableHead className="w-20 text-center">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        {t("common.loading")}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("reports.noReports")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map(({ report, staff }) => (
                    <TableRow key={report.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {staff?.name?.charAt(0) || "?"}
                            </div>
                            <span className="font-medium text-sm">{staff?.name || "-"}</span>
                          </div>
                          {staff?.country && (
                            <Badge variant="outline" className="text-xs ml-10">
                              {staff.country}
                            </Badge>
                          )}
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
            <DialogTitle>{t("reports.deleteConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t("reports.deleteWarning")}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteReport.isPending}
            >
              {deleteReport.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Task progress component for linked staff
function StaffTaskProgress({ staffId }: { staffId: number }) {
  const { data: taskCounts, isLoading } = trpc.staff.getTaskCounts.useQuery({ staffId });
  const { t } = useLanguage();

  if (isLoading) {
    return <p className="text-xs text-muted-foreground mt-2">{t("common.loading")}</p>;
  }

  if (!taskCounts) {
    return null;
  }

  const hasAnyTasks = taskCounts.inProgressCount > 0 || taskCounts.overdueCount > 0 || taskCounts.completedCount > 0;

  if (!hasAnyTasks) {
    return (
      <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
        <CheckCircle className="h-3 w-3 text-green-500" />
        {t("reports.noTasks")}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
      {taskCounts.inProgressCount > 0 && (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Clock className="h-3 w-3 mr-0.5" />
          {taskCounts.inProgressCount}
        </Badge>
      )}
      {taskCounts.overdueCount > 0 && (
        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-0.5" />
          {taskCounts.overdueCount}
        </Badge>
      )}
      {taskCounts.completedCount > 0 && (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-0.5" />
          {taskCounts.completedCount}
        </Badge>
      )}
    </div>
  );
}
