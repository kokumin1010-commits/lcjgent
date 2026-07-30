import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock, User, Users, Search, Filter, BarChart3 } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

// Staff color palette
const STAFF_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F1948A", "#82E0AA", "#F8C471", "#AED6F1", "#D2B4DE",
  "#A3E4D7", "#FAD7A0", "#D5F5E3", "#FADBD8", "#D6EAF8",
];

function getStaffColor(staffId: number, index: number): string {
  return STAFF_COLORS[index % STAFF_COLORS.length];
}

// Helper function to get JST date key
function getJSTDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

type StaffScheduleEntry = {
  id: number;
  staffId: number;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  color?: string | null;
  staffName: string;
  country: string;
  avatarUrl?: string | null;
  department?: string | null;
};

type ViewMode = "daily" | "weekly" | "monthly";

export default function StaffSchedule() {
  const [selectedDate, setSelectedDate] = useState<string>(getJSTDateKey(new Date()));
  const [activeTab, setActiveTab] = useState<string>("全部"); // "全部" | "中国" | "日本"
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFollowBroadcast, setFilterFollowBroadcast] = useState(false);
  const [filterShift, setFilterShift] = useState<string>("all"); // "all" | "morning" | "evening"
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [statsMonth, setStatsMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  // Form state
  const [formStaffId, setFormStaffId] = useState<number | null>(null);
  const [formDates, setFormDates] = useState<Date[]>([new Date()]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formNotes, setFormNotes] = useState("");
  const [formShift, setFormShift] = useState<string>("morning"); // morning | evening
  const [formIsFollowBroadcast, setFormIsFollowBroadcast] = useState(false);
  const [formAnchor, setFormAnchor] = useState<string>(""); // 主播名 (required when 跟播)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get date range for fetching based on view mode
  const dateRange = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (viewMode === "daily") {
      // Fetch current month
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0] + " 23:59:59",
      };
    } else if (viewMode === "weekly") {
      // Fetch current week (Mon-Sun)
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: getJSTDateKey(monday),
        endDate: getJSTDateKey(sunday) + " 23:59:59",
      };
    } else {
      // Monthly: fetch entire month
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0] + " 23:59:59",
      };
    }
  }, [selectedDate, viewMode]);

  // Fetch staff list
  const { data: staffList } = trpc.staff.listActive.useQuery();
  // Fetch livers list for anchor selection
  const { data: liversList } = trpc.liverManagement.list.useQuery();

  // Available countries from HR data
  const availableCountries = useMemo(() => {
    if (!staffList) return [];
    const countries = [...new Set(staffList.map((s: any) => s.country).filter(Boolean))];
    return countries;
  }, [staffList]);

  // 跟播部門リスト
  const FOLLOW_BROADCAST_DEPTS = ["運営部", "ライバー部"];

  // Shift presets
  const SHIFT_PRESETS: Record<string, { start: string; end: string; label: string }> = {
    morning: { start: "09:00", end: "18:00", label: "早班" },
    evening: { start: "15:00", end: "23:00", label: "晚班" },
  };

  // Position config
  const POSITION_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
    operations: { label: "运营", color: "#2563EB", dotColor: "bg-blue-500" },
    business: { label: "商务", color: "#F97316", dotColor: "bg-orange-500" },
    onsite: { label: "现场", color: "#22C55E", dotColor: "bg-green-500" },
  };

  // Map HR department to position key
  const getDeptPositionKey = (dept: string): string => {
    if (!dept) return "operations";
    if (dept.includes("営業") || dept.includes("商務") || dept.includes("商务")) return "business";
    if (dept.includes("現場") || dept.includes("動画") || dept.includes("现场") || dept.includes("动画")) return "onsite";
    return "operations";
  };

  // Handle shift change - auto fill time
  const handleShiftChange = (shift: string) => {
    setFormShift(shift);
    const preset = SHIFT_PRESETS[shift];
    if (preset) {
      setFormStartTime(preset.start);
      setFormEndTime(preset.end);
    }
  };

  // Filter staff by selected country tab
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    if (activeTab === "全部") return staffList;
    return staffList.filter((s: any) => s.country === activeTab);
  }, [staffList, activeTab]);

  // Sorted staff for dropdown
  const sortedStaffForDropdown = useMemo(() => {
    if (!filteredStaff) return [];
    if (formIsFollowBroadcast) {
      const followStaff = filteredStaff.filter((s: any) => FOLLOW_BROADCAST_DEPTS.includes(s.department));
      const otherStaff = filteredStaff.filter((s: any) => !FOLLOW_BROADCAST_DEPTS.includes(s.department));
      return [...followStaff, ...otherStaff];
    }
    return filteredStaff;
  }, [filteredStaff, formIsFollowBroadcast]);

  // Fetch schedules
  const countryFilter = activeTab !== "全部" ? activeTab : undefined;
  const { data: schedules, refetch: refetchSchedules } = trpc.staffSchedule.getByDateRange.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    country: countryFilter,
  });

  // Mutations
  const createMutation = trpc.staffSchedule.create.useMutation({
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const deleteMutation = trpc.staffSchedule.delete.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      refetchSchedules();
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const resetForm = () => {
    setFormStaffId(null);
    setFormDates([new Date(selectedDate + 'T12:00:00')]);
    setFormShift("morning");
    setFormStartTime("09:00");
    setFormEndTime("18:00");
    setFormNotes("");
    setFormIsFollowBroadcast(false);
    setFormAnchor("");
    setIsSubmitting(false);
  };

  // Staff color map
  const staffColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (!staffList) return map;
    staffList.forEach((s: any, i: number) => {
      map[s.id] = getStaffColor(s.id, i);
    });
    return map;
  }, [staffList]);

  // Apply search and filter to schedules
  const applyFilters = (entries: StaffScheduleEntry[]): StaffScheduleEntry[] => {
    let result = entries;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s =>
        s.staffName.toLowerCase().includes(q) ||
        (s.department || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q)
      );
    }
    // Follow broadcast filter
    if (filterFollowBroadcast) {
      result = result.filter(s => (s.notes || "").includes("[跟播]"));
    }
    // Shift filter
    if (filterShift === "morning") {
      result = result.filter(s => (s.notes || "").includes("[早班]"));
    } else if (filterShift === "evening") {
      result = result.filter(s => (s.notes || "").includes("[晚班]"));
    }
    return result;
  };

  // Get schedules for selected date (daily view)
  const todaySchedules = useMemo(() => {
    if (!schedules) return [];
    const filtered = (schedules as StaffScheduleEntry[]).filter(s => {
      const dateKey = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      return dateKey === selectedDate;
    });
    return applyFilters(filtered);
  }, [schedules, selectedDate, searchQuery, filterFollowBroadcast, filterShift]);

  // Sort helper: 跟播 entries first
  const sortFollowFirst = (a: StaffScheduleEntry, b: StaffScheduleEntry) => {
    const aIsFollow = a.notes?.includes("[跟播]") ? 1 : 0;
    const bIsFollow = b.notes?.includes("[跟播]") ? 1 : 0;
    return bIsFollow - aIsFollow;
  };

  // Group by country, 跟播 prioritized
  const cnSchedules = todaySchedules.filter(s => s.country === "中国").sort(sortFollowFirst);
  const jpSchedules = todaySchedules.filter(s => s.country === "日本").sort(sortFollowFirst);

  // Weekly view data
  const weekDates = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      dates.push(getJSTDateKey(dd));
    }
    return dates;
  }, [selectedDate]);

  // Get filtered schedules for a specific date
  const getSchedulesForDate = (dateKey: string) => {
    if (!schedules) return [];
    const filtered = (schedules as StaffScheduleEntry[]).filter(s => {
      const dk = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      return dk === dateKey;
    });
    return applyFilters(filtered);
  };

  // Monthly view data
  const monthDates = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const dates: (string | null)[] = [];
    // Fill empty slots before first day
    for (let i = 0; i < startDayOfWeek; i++) dates.push(null);
    // Fill actual dates
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const dd = new Date(d.getFullYear(), d.getMonth(), i);
      dates.push(getJSTDateKey(dd));
    }
    return dates;
  }, [selectedDate]);

  const handleCreateSchedule = async () => {
    if (!formStaffId || formDates.length === 0) {
      toast.error("スタッフと日付を選択してください");
      return;
    }
    if (formIsFollowBroadcast && !formAnchor.trim()) {
      toast.error("跟播モードでは主播を選択してください");
      return;
    }
    const shiftLabel = SHIFT_PRESETS[formShift]?.label || "早班";
    const tags: string[] = [`[${shiftLabel}]`];
    if (formIsFollowBroadcast) {
      tags.push("[跟播]");
      tags.push(`[主播:${formAnchor.trim()}]`);
    }
    const notesStr = [...tags, formNotes].filter(Boolean).join(" ").trim();
    
    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const dateObj of formDates) {
      const dateStr = getJSTDateKey(dateObj);
      try {
        await createMutation.mutateAsync({
          staffId: formStaffId,
          date: dateStr,
          startTime: formStartTime,
          endTime: formEndTime,
          notes: notesStr || undefined,
          color: staffColorMap[formStaffId] || undefined,
        });
        successCount++;
      } catch (e) {
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`${successCount}件のスケジュールを追加しました`);
      refetchSchedules();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount}件の登録に失敗しました`);
    }
    setShowCreateDialog(false);
    resetForm();
  };

  const today = getJSTDateKey(new Date());
  const isToday = selectedDate === today;

  // Date navigation
  const goToPrev = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (viewMode === "daily") d.setDate(d.getDate() - 1);
    else if (viewMode === "weekly") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(getJSTDateKey(d));
  };
  const goToNext = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (viewMode === "daily") d.setDate(d.getDate() + 1);
    else if (viewMode === "weekly") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(getJSTDateKey(d));
  };
  const goToToday = () => setSelectedDate(today);

  // Format date for display
  const displayDate = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    if (viewMode === "daily") {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
    } else if (viewMode === "weekly") {
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
    } else {
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    }
  }, [selectedDate, viewMode]);

  // Get schedule count for a date
  const getScheduleCount = (dateKey: string) => {
    if (!schedules) return 0;
    return (schedules as StaffScheduleEntry[]).filter(s => {
      const dk = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      return dk === dateKey;
    }).length;
  };

  // Weekly summary stats
  const weeklyStats = useMemo(() => {
    if (!schedules || viewMode !== "weekly") return null;
    let totalShifts = 0;
    let followCount = 0;
    let morningCount = 0;
    let eveningCount = 0;
    const staffSet = new Set<number>();
    const allFiltered = applyFilters(schedules as StaffScheduleEntry[]);
    allFiltered.forEach(s => {
      totalShifts++;
      staffSet.add(s.staffId);
      if ((s.notes || "").includes("[跟播]")) followCount++;
      if ((s.notes || "").includes("[早班]")) morningCount++;
      if ((s.notes || "").includes("[晚班]")) eveningCount++;
    });
    return { totalShifts, uniqueStaff: staffSet.size, followCount, morningCount, eveningCount };
  }, [schedules, viewMode, searchQuery, filterFollowBroadcast, filterShift]);

  // Monthly summary stats
  const monthlyStats = useMemo(() => {
    if (!schedules || viewMode !== "monthly") return null;
    let totalShifts = 0;
    let followCount = 0;
    let morningCount = 0;
    let eveningCount = 0;
    const staffSet = new Set<number>();
    const allFiltered = applyFilters(schedules as StaffScheduleEntry[]);
    allFiltered.forEach(s => {
      totalShifts++;
      staffSet.add(s.staffId);
      if ((s.notes || "").includes("[跟播]")) followCount++;
      if ((s.notes || "").includes("[早班]")) morningCount++;
      if ((s.notes || "").includes("[晚班]")) eveningCount++;
    });
    return { totalShifts, uniqueStaff: staffSet.size, followCount, morningCount, eveningCount };
  }, [schedules, viewMode, searchQuery, filterFollowBroadcast, filterShift]);

  // Check if a date is in the past (before today JST)
  const isPastDate = (dateStr: string) => {
    const scheduleDate = new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    return scheduleDate < today;
  };

  // Render a single staff entry row
  const renderStaffRow = (s: StaffScheduleEntry) => {
    const notes = s.notes || "";
    const hasShift = notes.match(/\[(早班|晚班)\]/);
    const hasFollow = notes.includes("[跟播]");
    const anchorMatch = notes.match(/\[主播:(.+?)\]/);
    const cleanNotes = notes.replace(/\[(运营|商务|现场|早班|晚班|跟播)\]/g, "").replace(/\[主播:.+?\]/g, "").trim();
    const dept = s.department || "";
    const posKey = getDeptPositionKey(dept);
    const posConfig = POSITION_CONFIG[posKey];
    return (
      <div key={s.id} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", posConfig?.dotColor || "bg-gray-300")} />
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ml-2"
          style={{ backgroundColor: s.color || staffColorMap[s.staffId] || '#999' }}
        >
          {s.staffName.charAt(0)}
        </div>
        <div className="ml-3 flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {s.department && <span className="text-xs text-gray-500">{s.department} | </span>}
            {s.staffName}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {hasShift && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                hasShift[1] === "早班" ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700"
              )}>{hasShift[1]}</span>
            )}
            {hasFollow && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">📹跟播{anchorMatch ? ` → ${anchorMatch[1]}` : ""}</span>}
            {cleanNotes && <span className="text-[10px] text-gray-400">{cleanNotes}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Clock className="h-3 w-3 text-gray-400" />
            {s.startTime} - {s.endTime}
          </div>
        </div>
        {!isPastDate(s.date) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-300 hover:text-red-500 ml-2 shrink-0"
            onClick={() => {
              if (confirm("このスケジュールを削除しますか？")) {
                deleteMutation.mutate({ id: s.id });
              }
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-lg font-bold">スタッフスケジュール</h1>
                <p className="text-xs text-gray-500">{displayDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowStatsDialog(true)}
                size="sm"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                統計
              </Button>
              <Button
                onClick={() => { setShowCreateDialog(true); setFormDates([new Date(selectedDate + 'T12:00:00')]); }}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
              <Link href="/s">
                <Button variant="outline" size="sm">ライバースケジュール</Button>
              </Link>
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("daily")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  viewMode === "daily" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
                )}
              >日</button>
              <button
                onClick={() => setViewMode("weekly")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  viewMode === "weekly" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
                )}
              >週</button>
              <button
                onClick={() => setViewMode("monthly")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  viewMode === "monthly" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"
                )}
              >月</button>
            </div>

            <div className="flex items-center gap-1 ml-auto">
              <Button onClick={goToPrev} variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={goToToday} variant={isToday ? "default" : "outline"} size="sm" className={cn("h-7 text-xs", isToday ? "bg-blue-600" : "")}>
                今日
              </Button>
              <Button onClick={goToNext} variant="ghost" size="icon" className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week mini-nav (daily view only) */}
          {viewMode === "daily" && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
                {weekDates.map((dateKey, i) => {
                  const d = new Date(dateKey + 'T12:00:00');
                  const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
                  const count = getScheduleCount(dateKey);
                  const isSelected = dateKey === selectedDate;
                  const isTodayDate = dateKey === today;
                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDate(dateKey)}
                      className={cn(
                        "flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[48px] transition-all",
                        isSelected ? "bg-blue-600 text-white shadow-md" : "bg-white hover:bg-gray-100 border",
                        isTodayDate && !isSelected && "border-blue-400"
                      )}
                    >
                      <span className={cn("text-[10px]", isSelected ? "text-blue-100" : "text-gray-500")}>{weekdays[i]}</span>
                      <span className={cn("text-sm font-bold", isSelected ? "text-white" : "")}>{d.getDate()}</span>
                      {count > 0 && (
                        <span className={cn(
                          "text-[9px] rounded-full px-1.5",
                          isSelected ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-600"
                        )}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Date jump picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2 shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarPicker
                    mode="single"
                    selected={new Date(selectedDate + 'T12:00:00')}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(getJSTDateKey(date));
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Country tabs + Search + Filters */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Country tabs */}
            <div className="flex gap-1">
              <Button
                variant={activeTab === "全部" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("全部")}
                className={cn("h-7 text-xs", activeTab === "全部" ? "bg-gray-700 hover:bg-gray-800" : "")}
              >
                全部
              </Button>
              {availableCountries.includes("中国") && (
                <Button
                  variant={activeTab === "中国" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("中国")}
                  className={cn("h-7 text-xs", activeTab === "中国" ? "bg-red-500 hover:bg-red-600" : "")}
                >
                  🇨🇳 中国
                </Button>
              )}
              {availableCountries.includes("日本") && (
                <Button
                  variant={activeTab === "日本" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("日本")}
                  className={cn("h-7 text-xs", activeTab === "日本" ? "bg-blue-500 hover:bg-blue-600" : "")}
                >
                  🇯🇵 日本
                </Button>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前/部門検索..."
                className="h-7 text-xs pl-7 pr-2"
              />
            </div>

            {/* Filters */}
            <Button
              variant={filterFollowBroadcast ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterFollowBroadcast(!filterFollowBroadcast)}
              className={cn("h-7 text-xs", filterFollowBroadcast ? "bg-orange-500 hover:bg-orange-600" : "")}
            >
              📹 跟播
            </Button>
            <Select value={filterShift} onValueChange={setFilterShift}>
              <SelectTrigger className="h-7 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全班次</SelectItem>
                <SelectItem value="morning">☀️ 早班</SelectItem>
                <SelectItem value="evening">🌙 晚班</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Shift time info banner */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border">
          <span className="font-medium text-gray-700">班次：</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
            ☀️ 早班 09:00-18:00
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400"></span>
            🌙 晚班 15:00-23:00
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4">
        {/* ===== DAILY VIEW ===== */}
        {viewMode === "daily" && (
          <>
            {todaySchedules.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">この日のスケジュールはありません</p>
                <p className="text-gray-400 text-sm mt-1">「追加」ボタンからスケジュールを登録してください</p>
                <Button
                  onClick={() => { setShowCreateDialog(true); setFormDates([new Date(selectedDate + 'T12:00:00')]); }}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  スケジュールを追加
                </Button>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-sm text-gray-700">
                      {isToday ? "本日の出勤者" : `出勤者`}
                    </h2>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {todaySchedules.length}名
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(activeTab === "全部" || activeTab === "中国") && cnSchedules.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-2">
                        <div className="text-xs text-red-600 font-medium">🇨🇳 中国 ({cnSchedules.length}名)</div>
                      </div>
                    )}
                    {(activeTab === "全部" || activeTab === "日本") && jpSchedules.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-2">
                        <div className="text-xs text-blue-600 font-medium">🇯🇵 日本 ({jpSchedules.length}名)</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Staff list - China */}
                {(activeTab === "全部" || activeTab === "中国") && cnSchedules.length > 0 && (
                  <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-4 py-2 bg-red-50 border-b flex items-center gap-2">
                      <span className="text-sm">🇨🇳</span>
                      <span className="text-sm font-bold text-red-700">中国チーム</span>
                      <span className="text-xs text-red-500 ml-auto">{cnSchedules.length}名出勤</span>
                    </div>
                    <div className="divide-y">
                      {cnSchedules.map(renderStaffRow)}
                    </div>
                  </div>
                )}

                {/* Staff list - Japan */}
                {(activeTab === "全部" || activeTab === "日本") && jpSchedules.length > 0 && (
                  <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-4 py-2 bg-blue-50 border-b flex items-center gap-2">
                      <span className="text-sm">🇯🇵</span>
                      <span className="text-sm font-bold text-blue-700">日本チーム</span>
                      <span className="text-xs text-blue-500 ml-auto">{jpSchedules.length}名出勤</span>
                    </div>
                    <div className="divide-y">
                      {jpSchedules.map(renderStaffRow)}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ===== WEEKLY VIEW ===== */}
        {viewMode === "weekly" && (
          <>
            {/* Weekly summary cards */}
            {weeklyStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{weeklyStats.totalShifts}</div>
                  <div className="text-[10px] text-gray-500">総シフト数</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{weeklyStats.uniqueStaff}</div>
                  <div className="text-[10px] text-gray-500">出勤人数</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-orange-500">{weeklyStats.followCount}</div>
                  <div className="text-[10px] text-gray-500">跟播</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{weeklyStats.morningCount}</div>
                  <div className="text-[10px] text-gray-500">早班</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-indigo-500">{weeklyStats.eveningCount}</div>
                  <div className="text-[10px] text-gray-500">晚班</div>
                </div>
              </div>
            )}

            {/* Weekly day-by-day list */}
            <div className="space-y-3">
              {weekDates.map((dateKey, i) => {
                const d = new Date(dateKey + 'T12:00:00');
                const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
                const daySchedules = getSchedulesForDate(dateKey).sort(sortFollowFirst);
                const isTodayDate = dateKey === today;
                return (
                  <div key={dateKey} className={cn("bg-white rounded-xl border overflow-hidden", isTodayDate && "ring-2 ring-blue-400")}>
                    <div className={cn("px-4 py-2 border-b flex items-center gap-2", isTodayDate ? "bg-blue-50" : "bg-gray-50")}>
                      <span className={cn("text-xs font-bold", isTodayDate ? "text-blue-600" : "text-gray-500")}>{weekdays[i]}</span>
                      <span className={cn("text-sm font-bold", isTodayDate ? "text-blue-700" : "text-gray-700")}>
                        {d.getMonth() + 1}/{d.getDate()}
                      </span>
                      {isTodayDate && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">今日</span>}
                      <span className="text-xs text-gray-400 ml-auto">{daySchedules.length}名</span>
                    </div>
                    {daySchedules.length > 0 ? (
                      <div className="divide-y">
                        {daySchedules.map(renderStaffRow)}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">スケジュールなし</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ===== MONTHLY VIEW ===== */}
        {viewMode === "monthly" && (
          <>
            {/* Monthly summary cards */}
            {monthlyStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{monthlyStats.totalShifts}</div>
                  <div className="text-[10px] text-gray-500">総シフト数</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{monthlyStats.uniqueStaff}</div>
                  <div className="text-[10px] text-gray-500">出勤人数</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-orange-500">{monthlyStats.followCount}</div>
                  <div className="text-[10px] text-gray-500">跟播</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{monthlyStats.morningCount}</div>
                  <div className="text-[10px] text-gray-500">早班</div>
                </div>
                <div className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-lg font-bold text-indigo-500">{monthlyStats.eveningCount}</div>
                  <div className="text-[10px] text-gray-500">晚班</div>
                </div>
              </div>
            )}

            {/* Monthly calendar grid */}
            <div className="bg-white rounded-xl border overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b">
                {['月', '火', '水', '木', '金', '土', '日'].map(day => (
                  <div key={day} className="text-center py-2 text-xs font-medium text-gray-500 border-r last:border-r-0">{day}</div>
                ))}
              </div>
              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {monthDates.map((dateKey, idx) => {
                  if (!dateKey) {
                    return <div key={`empty-${idx}`} className="min-h-[80px] border-r border-b last:border-r-0 bg-gray-50" />;
                  }
                  const d = new Date(dateKey + 'T12:00:00');
                  const daySchedules = getSchedulesForDate(dateKey);
                  const isTodayDate = dateKey === today;
                  const isSelected = dateKey === selectedDate;
                  const followCount = daySchedules.filter(s => (s.notes || "").includes("[跟播]")).length;
                  return (
                    <div
                      key={dateKey}
                      onClick={() => { setSelectedDate(dateKey); setViewMode("daily"); }}
                      className={cn(
                        "min-h-[80px] border-r border-b last:border-r-0 p-1.5 cursor-pointer hover:bg-blue-50 transition-colors",
                        isTodayDate && "bg-blue-50",
                        isSelected && "ring-2 ring-inset ring-blue-400"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-bold mb-1",
                        isTodayDate ? "text-blue-600" : "text-gray-700"
                      )}>
                        {d.getDate()}
                      </div>
                      {daySchedules.length > 0 && (
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-gray-600 font-medium">{daySchedules.length}名</div>
                          {followCount > 0 && (
                            <div className="text-[9px] bg-orange-100 text-orange-600 rounded px-1 inline-block">跟播{followCount}</div>
                          )}
                          {/* Show first 2 staff names */}
                          {daySchedules.slice(0, 2).map(s => (
                            <div key={s.id} className="text-[9px] text-gray-400 truncate">{s.staffName}</div>
                          ))}
                          {daySchedules.length > 2 && (
                            <div className="text-[9px] text-gray-300">+{daySchedules.length - 2}名</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Schedule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              スケジュール追加
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Shift Type */}
            <div>
              <label className="text-sm font-medium text-gray-700">班次 *</label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={formShift === "morning" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleShiftChange("morning")}
                  className={cn("flex-1", formShift === "morning" ? "bg-blue-600 hover:bg-blue-700" : "")}
                >
                  ☀️ 早班
                </Button>
                <Button
                  type="button"
                  variant={formShift === "evening" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleShiftChange("evening")}
                  className={cn("flex-1", formShift === "evening" ? "bg-indigo-600 hover:bg-indigo-700" : "")}
                >
                  🌙 晚班
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {formShift === "morning" ? "早班 09:00-18:00" : "晚班 15:00-23:00"}
              </p>
            </div>

            {/* Follow Broadcast toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="followBroadcast"
                checked={formIsFollowBroadcast}
                onChange={(e) => setFormIsFollowBroadcast(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="followBroadcast" className="text-sm font-medium text-gray-700">
                📹 跟播
              </label>
              <span className="text-xs text-gray-400">（勾选后运营部/ライバー部优先展示）</span>
            </div>

            {/* Anchor (主播) selection */}
            {formIsFollowBroadcast && (
              <div>
                <label className="text-sm font-medium text-gray-700">主播 *</label>
                <p className="text-xs text-orange-500 mt-0.5 mb-1">跟播対象のライバーを選択してください</p>
                <Select
                  value={formAnchor}
                  onValueChange={(v) => setFormAnchor(v)}
                >
                  <SelectTrigger className="border-orange-300 focus:ring-orange-500">
                    <SelectValue placeholder="主播を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(liversList || []).map((liver: any) => (
                      <SelectItem key={liver.id} value={liver.name}>
                        {liver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Multi-Date Picker */}
            <div>
              <label className="text-sm font-medium text-gray-700">日付 *（複数選択可）</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formDates.length === 0
                      ? "日付を選択..."
                      : formDates.length === 1
                        ? getJSTDateKey(formDates[0])
                        : `${formDates.length}日間選択中`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="multiple"
                    selected={formDates}
                    onSelect={(dates) => setFormDates(dates || [])}
                    disabled={{ before: new Date() }}
                  />
                </PopoverContent>
              </Popover>
              {formDates.length > 1 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formDates
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                        {d.getMonth() + 1}/{d.getDate()}
                        <button
                          type="button"
                          onClick={() => setFormDates(formDates.filter((_, idx) => idx !== i))}
                          className="hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Staff selection */}
            <div>
              <label className="text-sm font-medium text-gray-700">スタッフ *</label>
              {formIsFollowBroadcast && (
                <p className="text-xs text-orange-500 mt-0.5 mb-1">跟播人員（運営部・ライバー部）が優先表示されます</p>
              )}
              <Select
                value={formStaffId?.toString() || ""}
                onValueChange={(v) => setFormStaffId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="スタッフを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedStaffForDropdown.map((s: any, idx: number) => {
                    const isFollowDept = FOLLOW_BROADCAST_DEPTS.includes(s.department);
                    const showDivider = formIsFollowBroadcast && idx > 0 && 
                      isFollowDept !== FOLLOW_BROADCAST_DEPTS.includes(sortedStaffForDropdown[idx - 1]?.department);
                    return (
                      <React.Fragment key={s.id}>
                        {showDivider && <div className="border-t my-1 mx-2" />}
                        <SelectItem value={s.id.toString()}>
                          {formIsFollowBroadcast && isFollowDept && "⭐ "}
                          {s.name} {s.department ? `(${s.department})` : ''}
                        </SelectItem>
                      </React.Fragment>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">開始時間</label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">終了時間</label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700">メモ</label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="備考..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              キャンセル
            </Button>
            <Button onClick={handleCreateSchedule} disabled={isSubmitting || formDates.length === 0}>
              {isSubmitting ? "追加中..." : formDates.length > 1 ? `${formDates.length}日分追加` : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Stats Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              出勤統計
            </DialogTitle>
          </DialogHeader>
          <AttendanceStatsContent
            year={statsMonth.year}
            month={statsMonth.month}
            onChangeMonth={(y, m) => setStatsMonth({ year: y, month: m })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Attendance Stats sub-component
function AttendanceStatsContent({ year, month, onChangeMonth }: { year: number; month: number; onChangeMonth: (y: number, m: number) => void }) {
  const { data: stats, isLoading } = trpc.staffSchedule.getAttendanceStats.useQuery({ year, month });

  // Calculate current week number of the month
  const now = new Date();
  const currentWeekNum = Math.ceil(now.getDate() / 7);
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

  const goPrevMonth = () => {
    if (month === 1) onChangeMonth(year - 1, 12);
    else onChangeMonth(year, month - 1);
  };
  const goNextMonth = () => {
    if (month === 12) onChangeMonth(year + 1, 1);
    else onChangeMonth(year, month + 1);
  };

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-bold text-gray-700">{year}年{month}月</span>
        <Button variant="ghost" size="icon" onClick={goNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">読み込み中...</div>
      ) : !stats || stats.length === 0 ? (
        <div className="text-center py-8 text-gray-400">この月のデータはありません</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{stats.reduce((sum, s) => sum + s.totalDays, 0)}</div>
              <div className="text-[10px] text-gray-500">月間総シフト</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-600">{stats.length}</div>
              <div className="text-[10px] text-gray-500">出勤スタッフ数</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-600">{stats.reduce((sum, s) => sum + s.followCount, 0)}</div>
              <div className="text-[10px] text-gray-500">跟播回数</div>
            </div>
          </div>

          {/* Per-person table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">スタッフ</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-600">月計</th>
                  {isCurrentMonth && (
                    <th className="text-center px-2 py-2 font-medium text-green-600">今週</th>
                  )}
                  <th className="text-center px-2 py-2 font-medium text-blue-600">早班</th>
                  <th className="text-center px-2 py-2 font-medium text-indigo-600">晚班</th>
                  <th className="text-center px-2 py-2 font-medium text-orange-600">跟播</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500">週別</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.map((s: any) => (
                  <tr key={s.staffId} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{s.staffName}</div>
                      <div className="text-[10px] text-gray-400">{s.department}</div>
                    </td>
                    <td className="text-center px-2 py-2">
                      <span className="font-bold text-gray-800">{s.totalDays}</span>
                      <span className="text-gray-400">日</span>
                    </td>
                    {isCurrentMonth && (
                      <td className="text-center px-2 py-2">
                        <span className="font-bold text-green-700">{s.weeklyBreakdown[currentWeekNum] || 0}</span>
                        <span className="text-gray-400">日</span>
                      </td>
                    )}
                    <td className="text-center px-2 py-2 text-blue-600 font-medium">{s.morningCount}</td>
                    <td className="text-center px-2 py-2 text-indigo-600 font-medium">{s.eveningCount}</td>
                    <td className="text-center px-2 py-2 text-orange-600 font-medium">{s.followCount}</td>
                    <td className="text-center px-2 py-2">
                      <div className="flex gap-0.5 justify-center">
                        {[1, 2, 3, 4, 5].map(w => (
                          <span
                            key={w}
                            className={cn(
                              "inline-block w-5 h-5 rounded text-[9px] leading-5 text-center",
                              s.weeklyBreakdown[w]
                                ? isCurrentMonth && w === currentWeekNum
                                  ? "bg-green-100 text-green-700 font-bold"
                                  : "bg-blue-50 text-blue-600"
                                : "bg-gray-50 text-gray-300"
                            )}
                            title={`第${w}週: ${s.weeklyBreakdown[w] || 0}日`}
                          >
                            {s.weeklyBreakdown[w] || 0}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
