import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, User, Users } from "lucide-react";
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

export default function StaffSchedule() {
  const [selectedDate, setSelectedDate] = useState<string>(getJSTDateKey(new Date()));
  const [activeTab, setActiveTab] = useState<string>("全部"); // "全部" | "中国" | "日本"
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"today" | "calendar">("today");

  // Form state
  const [formStaffId, setFormStaffId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState<string>(getJSTDateKey(new Date()));
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formNotes, setFormNotes] = useState("");
  const [formShift, setFormShift] = useState<string>("morning"); // morning | evening
  const [formIsFollowBroadcast, setFormIsFollowBroadcast] = useState(false);
  const [formAnchor, setFormAnchor] = useState<string>(""); // 主播名 (required when 跟播)

  // Get date range for fetching (current month + buffer)
  const dateRange = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0] + " 23:59:59",
    };
  }, [selectedDate]);

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

  // 跟播部門リスト（跟播人員として優先表示する部門）
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
    // Default: 運営部, 経理部, 技術部, ライバー部 etc → operations
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

  // Sorted staff for dropdown: 跟播 staff first when followBroadcast is checked
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
    onSuccess: () => {
      toast.success("スケジュールを追加しました");
      refetchSchedules();
      setShowCreateDialog(false);
      resetForm();
    },
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
    setFormDate(selectedDate);
    setFormShift("morning");
    setFormStartTime("09:00");
    setFormEndTime("18:00");
    setFormNotes("");
    setFormIsFollowBroadcast(false);
    setFormAnchor("");
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

  // Get schedules for selected date
  const todaySchedules = useMemo(() => {
    if (!schedules) return [];
    return (schedules as StaffScheduleEntry[]).filter(s => {
      const dateKey = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      return dateKey === selectedDate;
    });
  }, [schedules, selectedDate]);

  // Sort helper: 跟播 entries first
  const sortFollowFirst = (a: StaffScheduleEntry, b: StaffScheduleEntry) => {
    const aIsFollow = a.notes?.includes("[跟播]") ? 1 : 0;
    const bIsFollow = b.notes?.includes("[跟播]") ? 1 : 0;
    return bIsFollow - aIsFollow; // 跟播 first
  };

  // Group by country, 跟播 prioritized
  const cnSchedules = todaySchedules.filter(s => s.country === "中国").sort(sortFollowFirst);
  const jpSchedules = todaySchedules.filter(s => s.country === "日本").sort(sortFollowFirst);

  const handleCreateSchedule = () => {
    if (!formStaffId || !formDate) {
      toast.error("スタッフと日付を選択してください");
      return;
    }
    if (formIsFollowBroadcast && !formAnchor.trim()) {
      toast.error("跟播模式では主播を選択してください");
      return;
    }
    // Build notes with metadata tags (shift + follow broadcast only; position comes from HR)
    const shiftLabel = SHIFT_PRESETS[formShift]?.label || "早班";
    const tags: string[] = [`[${shiftLabel}]`];
    if (formIsFollowBroadcast) {
      tags.push("[跟播]");
      tags.push(`[主播:${formAnchor.trim()}]`);
    }
    const notesStr = [...tags, formNotes].filter(Boolean).join(" ").trim();
    
    createMutation.mutate({
      staffId: formStaffId,
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      notes: notesStr || undefined,
      color: staffColorMap[formStaffId] || undefined,
    });
  };

  const today = getJSTDateKey(new Date());
  const isToday = selectedDate === today;

  // Date navigation
  const goToPrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(getJSTDateKey(d));
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(getJSTDateKey(d));
  };
  const goToToday = () => setSelectedDate(today);

  // Format date for display
  const displayDate = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  }, [selectedDate]);

  // Week view dates (7 days centered around selected date)
  const weekDates = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // Monday = 0
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

  // Get schedule count for a date
  const getScheduleCount = (dateKey: string) => {
    if (!schedules) return 0;
    return (schedules as StaffScheduleEntry[]).filter(s => {
      const dk = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      return dk === dateKey;
    }).length;
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
                <h1 className="text-lg font-bold">
                  {isToday ? "今日の値班" : displayDate}
                </h1>
                {isToday && <p className="text-xs text-gray-500">{displayDate}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => { setShowCreateDialog(true); setFormDate(selectedDate); }}
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

          {/* Date navigation */}
          <div className="flex items-center gap-2 mt-3">
            <Button onClick={goToPrevDay} variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={goToToday} variant={isToday ? "default" : "outline"} size="sm" className={isToday ? "bg-blue-600" : ""}>
              今日
            </Button>
            <Button onClick={goToNextDay} variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week mini-nav */}
          <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
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

          {/* Country tabs - switch mode with 全部 */}
          <div className="flex gap-2 mt-2">
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

      {/* Main content - Today's staff */}
      <div className="p-4 space-y-4">
        {todaySchedules.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">この日のスケジュールはありません</p>
            <p className="text-gray-400 text-sm mt-1">「追加」ボタンからスケジュールを登録してください</p>
            <Button
              onClick={() => { setShowCreateDialog(true); setFormDate(selectedDate); }}
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
                  {isToday ? "本日の出勤者" : `${displayDate} の出勤者`}
                </h2>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {todaySchedules.length}名
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(activeTab === "全部" || activeTab === "中国") && cnSchedules.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-xs text-red-600 font-medium mb-1">🇨🇳 中国 ({cnSchedules.length}名)</div>
                  </div>
                )}
                {(activeTab === "全部" || activeTab === "日本") && jpSchedules.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-xs text-blue-600 font-medium mb-1">🇯🇵 日本 ({jpSchedules.length}名)</div>
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
                  {cnSchedules.map((s) => {
                    const notes = s.notes || "";
                    const hasShift = notes.match(/\[(早班|晚班)\]/);
                    const hasFollow = notes.includes("[跟播]");
                    const anchorMatch = notes.match(/\[主播:(.+?)\]/);
                    const cleanNotes = notes.replace(/\[(运营|商务|现场|早班|晚班|跟播)\]/g, "").replace(/\[主播:.+?\]/g, "").trim();
                    // Derive position from staff's HR department
                    const dept = s.department || "";
                    const posKey = getDeptPositionKey(dept);
                    const posConfig = POSITION_CONFIG[posKey];
                    return (
                      <div key={s.id} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                        {/* Position dot from HR department */}
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
                      </div>
                    );
                  })}
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
                  {jpSchedules.map((s) => {
                    const notes = s.notes || "";
                    const hasShift = notes.match(/\[(早班|晚班)\]/);
                    const hasFollow = notes.includes("[跟播]");
                    const anchorMatch = notes.match(/\[主播:(.+?)\]/);
                    const cleanNotes = notes.replace(/\[(运营|商务|现场|早班|晚班|跟播)\]/g, "").replace(/\[主播:.+?\]/g, "").trim();
                    // Derive position from staff's HR department
                    const dept = s.department || "";
                    const posKey = getDeptPositionKey(dept);
                    const posConfig = POSITION_CONFIG[posKey];
                    return (
                      <div key={s.id} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                        {/* Position dot from HR department */}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

            {/* Anchor (主播) selection - required when 跟播 */}
            {formIsFollowBroadcast && (
              <div>
                <label className="text-sm font-medium text-gray-700">主播 *</label>
                <p className="text-xs text-orange-500 mt-0.5 mb-1">跟播对象のライバーを選択してください</p>
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

            {/* Date */}
            <div>
              <label className="text-sm font-medium text-gray-700">日付</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
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
            <Button onClick={handleCreateSchedule} disabled={createMutation.isPending}>
              {createMutation.isPending ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
