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
import { FileText, Plus, Search, X, Pencil, Trash2, Globe, Clock, AlertTriangle, CheckCircle, Link, Sparkles, Check, XCircle, RefreshCw, ThumbsUp, ThumbsDown, Bot, Loader2, MessageSquare } from "lucide-react";
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
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  
  // Report detail dialog state
  const [reportDetailDialogOpen, setReportDetailDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  
  // Result dialog state
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<{
    id: number;
    extractedItem: string;
    category: string;
    staffName: string;
  } | null>(null);
  const [selectedResultCategory, setSelectedResultCategory] = useState<string>("");
  const [resultNote, setResultNote] = useState<string>("");
  const [nextActionSuggestion, setNextActionSuggestion] = useState<{
    item: string;
    category: string;
    dueDate: Date;
  } | null>(null);
  const [createNextAction, setCreateNextAction] = useState(false);
  
  // Followup filter state
  const [followupStaffFilter, setFollowupStaffFilter] = useState<string>("all");
  const [followupTab, setFollowupTab] = useState<"pending" | "completed">("pending");
  
  // AI Advice state
  const [generatingAdviceForReport, setGeneratingAdviceForReport] = useState<number | null>(null);
  const [adviceCache, setAdviceCache] = useState<Record<number, { id: number; adviceText: string; userFeedback?: "good" | "bad" }>>({});
  
  const { t, language } = useLanguage();

  // Fetch staff statistics for header cards
  const { data: staffStats, isLoading: statsLoading } = trpc.report.staffStatistics.useQuery();
  
  // Fetch active report staff for filter dropdown
  const { data: activeReportStaff } = trpc.reportStaff.listActive.useQuery();

  // Fetch overdue followups with staff filter
  const staffIdFilter = followupStaffFilter === "all" ? undefined : parseInt(followupStaffFilter);
  const { data: overdueFollowups, isLoading: followupsLoading, refetch: refetchFollowups } = trpc.report.overdueFollowups.useQuery(
    { staffId: staffIdFilter },
    { enabled: followupTab === "pending" }
  );

  // Fetch completed followups with staff filter
  const { data: completedFollowups, isLoading: completedLoading, refetch: refetchCompleted } = trpc.report.completedFollowups.useQuery(
    { staffId: staffIdFilter },
    { enabled: followupTab === "completed" }
  );

  // Fetch report detail for dialog
  const { data: reportDetail, isLoading: reportDetailLoading } = trpc.report.getById.useQuery(
    { id: selectedReportId! },
    { enabled: !!selectedReportId && reportDetailDialogOpen }
  );

  // Batch extract mutation
  const batchExtract = trpc.report.batchExtractFollowups.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${t("followups.extracted")}: ${result.totalCreated}${t("reports.items")}`);
        refetchFollowups();
      }
    },
    onError: (error) => {
      toast.error(`${t("common.error")}: ${error.message}`);
    },
  });

  // Update followup status mutation
  const updateFollowupStatus = trpc.report.updateFollowupStatus.useMutation({
    onSuccess: () => {
      toast.success(t("common.save"));
      refetchFollowups();
    },
    onError: (error) => {
      toast.error(`${t("common.error")}: ${error.message}`);
    },
  });

  // Complete with result mutation
  const completeWithResult = trpc.report.completeWithResult.useMutation({
    onSuccess: (result) => {
      toast.success(t("followups.completed"));
      if (result.nextActionId) {
        toast.success(t("followups.nextActionCreated"));
      }
      setResultDialogOpen(false);
      resetResultDialog();
      refetchFollowups();
    },
    onError: (error) => {
      toast.error(`${t("common.error")}: ${error.message}`);
    },
  });

  // Suggest next action mutation
  const suggestNextAction = trpc.report.suggestNextAction.useMutation({
    onSuccess: (result) => {
      if (result.suggestion) {
        setNextActionSuggestion({
          item: result.suggestion.item,
          category: result.suggestion.category,
          dueDate: new Date(result.suggestion.dueDate),
        });
        setCreateNextAction(true);
      }
    },
  });

  // AI Advice mutations
  const generateAdvice = trpc.aiAdvice.generate.useMutation({
    onSuccess: (advice, variables) => {
      setAdviceCache(prev => ({
        ...prev,
        [variables.reportId]: { id: advice.id, adviceText: advice.adviceText }
      }));
      setGeneratingAdviceForReport(null);
      toast.success(language === "ja" ? "AIアドバイスを生成しました" : "AI建议已生成");
    },
    onError: (error) => {
      setGeneratingAdviceForReport(null);
      toast.error(`${t("common.error")}: ${error.message}`);
    },
  });

  const submitFeedback = trpc.aiAdvice.submitFeedback.useMutation({
    onSuccess: (_, variables) => {
      // Update local cache with feedback
      setAdviceCache(prev => {
        const adviceId = variables.adviceId;
        const reportId = Object.keys(prev).find(key => prev[parseInt(key)]?.id === adviceId);
        if (reportId) {
          return {
            ...prev,
            [parseInt(reportId)]: { ...prev[parseInt(reportId)], userFeedback: variables.rating }
          };
        }
        return prev;
      });
      toast.success(language === "ja" ? "フィードバックありがとうございます！" : "感谢您的反馈！");
    },
    onError: (error) => {
      toast.error(`${t("common.error")}: ${error.message}`);
    },
  });

  // Handle generate AI advice
  const handleGenerateAdvice = (reportId: number, workContent: string, staffName: string, reportDate: string) => {
    setGeneratingAdviceForReport(reportId);
    generateAdvice.mutate({
      reportId,
      reportContent: workContent,
      staffName,
      reportDate,
    });
  };

  // Handle feedback submission
  const handleFeedback = (adviceId: number, rating: "good" | "bad") => {
    submitFeedback.mutate({ adviceId, rating });
  };

  // Reset result dialog state
  const resetResultDialog = () => {
    setSelectedFollowup(null);
    setSelectedResultCategory("");
    setResultNote("");
    setNextActionSuggestion(null);
    setCreateNextAction(false);
  };

  // Handle opening result dialog
  const handleOpenResultDialog = (followup: {
    id: number;
    extractedItem: string;
    category: string;
  }, staffName: string) => {
    setSelectedFollowup({
      id: followup.id,
      extractedItem: followup.extractedItem,
      category: followup.category,
      staffName,
    });
    setResultDialogOpen(true);
  };

  // Handle result category change
  const handleResultCategoryChange = (category: string) => {
    setSelectedResultCategory(category);
    // Auto-suggest next action for "継続" or "保留"
    if ((category === "継続" || category === "保留") && selectedFollowup) {
      suggestNextAction.mutate({
        followupId: selectedFollowup.id,
        resultCategory: category as "成約" | "継続" | "保留" | "失注" | "完了",
        language: language as "ja" | "zh",
      });
    } else {
      setNextActionSuggestion(null);
      setCreateNextAction(false);
    }
  };

  // Handle submit result
  const handleSubmitResult = () => {
    if (!selectedFollowup || !selectedResultCategory) return;
    
    completeWithResult.mutate({
      id: selectedFollowup.id,
      resultCategory: selectedResultCategory as "成約" | "継続" | "保留" | "失注" | "完了",
      resultNote: resultNote || undefined,
      createNextAction: createNextAction && !!nextActionSuggestion,
      nextActionItem: nextActionSuggestion?.item,
      nextActionCategory: nextActionSuggestion?.category as "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他" | undefined,
      nextActionDueDate: nextActionSuggestion?.dueDate,
    });
  };

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

  // Check if followup is overdue (more than 2 days past due date)
  const isOverdue = (dueDate: Date | string | null) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    return now > due;
  };

  // Format due date with overdue indicator
  const formatDueDate = (dueDate: Date | string | null) => {
    if (!dueDate) return "-";
    const d = new Date(dueDate);
    return d.toLocaleDateString(language === "ja" ? "ja-JP" : "zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Followups Section with tabs and staff filter */}
      <Card className={followupTab === "pending" && overdueFollowups && overdueFollowups.length > 0 ? "border-red-300 bg-red-50/50" : "border-blue-200 bg-blue-50/50"}>
        <CardContent className="p-6">
          {/* Header with title and extract button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold flex items-center gap-2 ${followupTab === "pending" && overdueFollowups && overdueFollowups.length > 0 ? "text-red-700" : "text-blue-700"}`}>
              {followupTab === "pending" && overdueFollowups && overdueFollowups.length > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Clock className="h-5 w-5" />
              )}
              {t("followups.title")}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchExtract.mutate({ days: 7, language })}
              disabled={batchExtract.isPending}
            >
              {batchExtract.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t("followups.batchExtract")}
            </Button>
          </div>

          {/* Tab buttons and staff filter */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex gap-1">
              <Button
                variant={followupTab === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFollowupTab("pending")}
                className={followupTab === "pending" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                {t("followups.pending")} ({overdueFollowups?.length || 0})
              </Button>
              <Button
                variant={followupTab === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFollowupTab("completed")}
                className={followupTab === "completed" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {t("followups.completedTab")} ({completedFollowups?.length || 0})
              </Button>
            </div>
            <Select value={followupStaffFilter} onValueChange={setFollowupStaffFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder={t("followups.allStaff")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("followups.allStaff")}</SelectItem>
                {activeReportStaff?.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id.toString()}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pending followups list */}
          {followupTab === "pending" && (
            <>
              {overdueFollowups && overdueFollowups.length > 0 ? (
                <>
                  <p className="text-sm text-red-600 mb-4">
                    {t("followups.overdueWarning")}
                  </p>
                  <div className="space-y-2">
                    {overdueFollowups.map(({ followup, staff, report }) => (
                      <div
                        key={followup.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200 cursor-pointer hover:bg-red-50 transition-colors"
                        onClick={() => {
                          setSelectedReportId(followup.reportId);
                          setReportDetailDialogOpen(true);
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300">
                              {followup.category}
                            </Badge>
                            <span className="text-sm font-medium">{staff?.name || "-"}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDueDate(followup.dueDate)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{followup.extractedItem}</p>
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {t("followups.viewReport")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenResultDialog(followup, staff?.name || "-");
                            }}
                            title={t("followups.markComplete")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateFollowupStatus.mutate({ id: followup.id, status: "cancelled" });
                            }}
                            title={t("followups.markCancelled")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("followups.noOverdue")}
                </p>
              )}
            </>
          )}

          {/* Completed followups list */}
          {followupTab === "completed" && (
            <>
              {completedFollowups && completedFollowups.length > 0 ? (
                <div className="space-y-2">
                  {completedFollowups.map(({ followup, staff, report }) => (
                    <div
                      key={followup.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200 cursor-pointer hover:bg-green-50 transition-colors"
                      onClick={() => {
                        setSelectedReportId(followup.reportId);
                        setReportDetailDialogOpen(true);
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              followup.resultCategory === "成約" ? "bg-green-100 text-green-700 border-green-300" :
                              followup.resultCategory === "失注" ? "bg-red-100 text-red-700 border-red-300" :
                              followup.resultCategory === "継続" ? "bg-blue-100 text-blue-700 border-blue-300" :
                              followup.resultCategory === "保留" ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                              "bg-gray-100 text-gray-700 border-gray-300"
                            }`}
                            title={followup.resultCategory === "成約" ? t("followups.result.closedDesc") :
                              followup.resultCategory === "失注" ? t("followups.result.lostDesc") :
                              followup.resultCategory === "継続" ? t("followups.result.continuedDesc") :
                              followup.resultCategory === "保留" ? t("followups.result.pendingDesc") :
                              t("followups.result.doneDesc")}
                          >
                            {followup.resultCategory === "成約" ? t("followups.result.closed") :
                              followup.resultCategory === "失注" ? t("followups.result.lost") :
                              followup.resultCategory === "継続" ? t("followups.result.continued") :
                              followup.resultCategory === "保留" ? t("followups.result.pending") :
                              followup.resultCategory === "完了" ? t("followups.result.done") :
                              t("followups.completed")}
                          </Badge>
                          <span className="text-sm font-medium">{staff?.name || "-"}</span>
                          <span className="text-xs text-muted-foreground">
                            {followup.completedAt ? formatDueDate(followup.completedAt) : "-"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{followup.extractedItem}</p>
                        {followup.resultNote && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            {t("followups.note")}: {followup.resultNote}
                          </p>
                        )}
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {t("followups.viewReport")}
                        </p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600 ml-4" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("followups.noCompleted")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLocation("/master/reports/chat")}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {t("reports.chatCreate")}
              </Button>
              <Button onClick={() => setLocation("/master/reports/new")}>
                <Plus className="h-4 w-4 mr-2" />
                {t("reports.create")}
              </Button>
            </div>
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

          {/* Reports List - Card style */}
          <div className="space-y-4">
            {reportsLoading ? (
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  {t("common.loading")}
                </div>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("reports.noReports")}
              </div>
            ) : (
              filteredReports.map(({ report, staff }) => (
                <div 
                  key={report.id} 
                  className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  {/* Header: Staff info, date, actions */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {staff?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="font-medium">{staff?.name || "-"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {staff?.country && (
                            <Badge variant="outline" className="text-xs">
                              {staff.country}
                            </Badge>
                          )}
                          <span>{formatDate(report.reportDate)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
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
                  </div>
                  
                  {/* Content sections */}
                  <div className="space-y-3">
                    {/* Work Content */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t("reports.workContent")}</Label>
                      <p className="text-sm whitespace-pre-wrap">{report.workContent}</p>
                    </div>
                    
                    {/* Issues */}
                    {report.issues && (
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t("reports.issues")}</Label>
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{report.issues}</p>
                      </div>
                    )}
                    
                    {/* Remarks */}
                    {report.remarks && (
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">{t("reports.remarks")}</Label>
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{report.remarks}</p>
                      </div>
                    )}
                    
                    {/* AI Advice Section */}
                    <div className="mt-4 pt-4 border-t border-dashed">
                      {adviceCache[report.id] ? (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start gap-2">
                            <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <Label className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 block">
                                {language === "ja" ? "AIアドバイス" : "AI建议"}
                              </Label>
                              <p className="text-sm text-blue-900 dark:text-blue-100">{adviceCache[report.id].adviceText}</p>
                              
                              {/* Feedback buttons */}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {language === "ja" ? "このアドバイスは役に立ちましたか？" : "这个建议有用吗？"}
                                </span>
                                <Button
                                  variant={adviceCache[report.id].userFeedback === "good" ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleFeedback(adviceCache[report.id].id, "good")}
                                  disabled={submitFeedback.isPending}
                                >
                                  <ThumbsUp className="h-3 w-3 mr-1" />
                                  {language === "ja" ? "はい" : "是"}
                                </Button>
                                <Button
                                  variant={adviceCache[report.id].userFeedback === "bad" ? "destructive" : "outline"}
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleFeedback(adviceCache[report.id].id, "bad")}
                                  disabled={submitFeedback.isPending}
                                >
                                  <ThumbsDown className="h-3 w-3 mr-1" />
                                  {language === "ja" ? "いいえ" : "否"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-950/50 dark:hover:to-purple-950/50"
                          onClick={() => handleGenerateAdvice(
                            report.id,
                            report.workContent,
                            staff?.name || "",
                            formatDate(report.reportDate)
                          )}
                          disabled={generatingAdviceForReport === report.id}
                        >
                          {generatingAdviceForReport === report.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {language === "ja" ? "AIアドバイスを生成中..." : "正在生成AI建议..."}
                            </>
                          ) : (
                            <>
                              <Bot className="h-4 w-4 mr-2 text-blue-600" />
                              {language === "ja" ? "AIアドバイスを取得" : "获取AI建议"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer: Updated time */}
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      {t("reports.updatedAt")}: {formatDateTime(report.updatedAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
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

      {/* Result Input Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetResultDialog();
        }
        setResultDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("followups.resultTitle")}</DialogTitle>
          </DialogHeader>
          {selectedFollowup && (
            <div className="space-y-4">
              {/* Followup info */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {selectedFollowup.category}
                  </Badge>
                  <span className="text-sm font-medium">{selectedFollowup.staffName}</span>
                </div>
                <p className="text-sm">{selectedFollowup.extractedItem}</p>
              </div>

              {/* Result category selection - buttons for quick tap */}
              <div>
                <Label className="text-sm font-medium mb-2 block">{t("followups.resultCategory")}</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "closed", ja: "成約", color: "green" },
                    { key: "continued", ja: "継続", color: "blue" },
                    { key: "pending", ja: "保留", color: "yellow" },
                    { key: "lost", ja: "失注", color: "red" },
                    { key: "done", ja: "完了", color: "gray" },
                  ].map((cat) => (
                    <div key={cat.key} className="relative group">
                      <Button
                        variant={selectedResultCategory === cat.ja ? "default" : "outline"}
                        size="sm"
                        className={`w-full text-xs ${
                          cat.color === "green" ? "hover:bg-green-100 hover:text-green-700" :
                          cat.color === "red" ? "hover:bg-red-100 hover:text-red-700" :
                          ""
                        } ${
                          selectedResultCategory === cat.ja && cat.color === "green" ? "bg-green-600" :
                          selectedResultCategory === cat.ja && cat.color === "red" ? "bg-red-600" :
                          ""
                        }`}
                        onClick={() => handleResultCategoryChange(cat.ja)}
                      >
                        {t(`followups.result.${cat.key}`)}
                      </Button>
                      {/* Tooltip with description */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                        {t(`followups.result.${cat.key}Desc`)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional note */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t("followups.resultNote")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span>
                </Label>
                <Input
                  placeholder={t("followups.resultNotePlaceholder")}
                  value={resultNote}
                  onChange={(e) => setResultNote(e.target.value)}
                />
              </div>

              {/* Next action suggestion (auto-appears for 継続/保留) */}
              {nextActionSuggestion && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium text-blue-700">{t("followups.nextActionSuggestion")}</Label>
                    <Button
                      variant={createNextAction ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setCreateNextAction(!createNextAction)}
                    >
                      {createNextAction ? t("followups.willCreate") : t("followups.skip")}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-white">
                      {nextActionSuggestion.category}
                    </Badge>
                    <span className="text-sm">{nextActionSuggestion.item}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("followups.dueDate")}: {nextActionSuggestion.dueDate.toLocaleDateString(language === "ja" ? "ja-JP" : "zh-CN")}
                  </p>
                </div>
              )}

              {suggestNextAction.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t("followups.suggestingNextAction")}
                </div>
              )}

              {/* Submit button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setResultDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSubmitResult}
                  disabled={!selectedResultCategory || completeWithResult.isPending}
                >
                  {completeWithResult.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {t("followups.complete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Detail Dialog */}
      <Dialog open={reportDetailDialogOpen} onOpenChange={setReportDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("reports.reportDetail")}
            </DialogTitle>
          </DialogHeader>
          {reportDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reportDetail ? (
            <div className="space-y-4">
              {/* Report header info */}
              <div className="flex items-center gap-4 pb-3 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.staff")}</p>
                  <p className="font-medium">{reportDetail.staff?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("reports.date")}</p>
                  <p className="font-medium">{formatDate(reportDetail.report.reportDate)}</p>
                </div>
                {reportDetail.staff?.country && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t("reports.country")}</p>
                    <p className="font-medium">{reportDetail.staff.country}</p>
                  </div>
                )}
              </div>

              {/* Work content */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t("reports.workContent")}</p>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="whitespace-pre-wrap text-sm">{reportDetail.report.workContent}</p>
                </div>
              </div>

              {/* Issues */}
              {reportDetail.report.issues && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t("reports.observations")}</p>
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <p className="whitespace-pre-wrap text-sm">{reportDetail.report.issues}</p>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {reportDetail.report.remarks && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t("reports.notes")}</p>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="whitespace-pre-wrap text-sm">{reportDetail.report.remarks}</p>
                  </div>
                </div>
              )}

              {/* Updated at */}
              <p className="text-xs text-muted-foreground text-right">
                {t("reports.updatedAt")}: {formatDateTime(reportDetail.report.updatedAt)}
              </p>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">{t("reports.notFound")}</p>
          )}
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
