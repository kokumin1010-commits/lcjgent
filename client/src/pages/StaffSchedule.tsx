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
  const [activeTabs, setActiveTabs] = useState<Set<string>>(new Set(["中国", "日本"]));
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"today" | "calendar">("today");

  // Form state
  const [formStaffId, setFormStaffId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState<string>(getJSTDateKey(new Date()));
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formNotes, setFormNotes] = useState("");
  const [formScheduleType, setFormScheduleType] = useState<string>("normal"); // normal | followBroadcast

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

  // Toggle tab selection
  const toggleTab = (tab: string) => {
    setActiveTabs(prev => {
      const next = new Set(prev);
      if (next.has(tab)) {
        if (next.size > 1) next.delete(tab);
      } else {
        next.add(tab);
      }
      return next;
    });
  };

  // 跟播部門リスト（跟播人員として優先表示する部門）
  const FOLLOW_BROADCAST_DEPTS = ["運営部", "ライバー部"];

  // Filter staff by selected countries
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    return staffList.filter((s: any) => activeTabs.has(s.country));
  }, [staffList, activeTabs]);

  // Sorted staff for dropdown: 跟播 staff first when scheduleType is followBroadcast
  const sortedStaffForDropdown = useMemo(() => {
    if (!filteredStaff) return [];
    if (formScheduleType === "followBroadcast") {
      const followStaff = filteredStaff.filter((s: any) => FOLLOW_BROADCAST_DEPTS.includes(s.department));
      const otherStaff = filteredStaff.filter((s: any) => !FOLLOW_BROADCAST_DEPTS.includes(s.department));
      return [...followStaff, ...otherStaff];
    }
    return filteredStaff;
  }, [filteredStaff, formScheduleType]);

  // Fetch schedules
  const countryFilter = activeTabs.size === 1 ? Array.from(activeTabs)[0] : undefined;
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
    setFormStartTime("09:00");
    setFormEndTime("18:00");
    setFormNotes("");
    setFormScheduleType("normal");
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

  // Group by country
  const cnSchedules = todaySchedules.filter(s => s.country === "中国");
  const jpSchedules = todaySchedules.filter(s => s.country === "日本");

  const handleCreateSchedule = () => {
    if (!formStaffId || !formDate) {
      toast.error("スタッフと日付を選択してください");
      return;
    }
    createMutation.mutate({
      staffId: formStaffId,
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      notes: formScheduleType === "followBroadcast" 
        ? (formNotes ? `[跟播] ${formNotes}` : "[跟播]")
        : (formNotes || undefined),
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

          {/* Country tabs */}
          <div className="flex gap-2 mt-2">
            <Button
              variant={activeTabs.has("中国") ? "default" : "outline"}
              size="sm"
              onClick={() => toggleTab("中国")}
              className={cn("h-7 text-xs", activeTabs.has("中国") ? "bg-red-500 hover:bg-red-600" : "")}
            >
              🇨🇳 中国
            </Button>
            <Button
              variant={activeTabs.has("日本") ? "default" : "outline"}
              size="sm"
              onClick={() => toggleTab("日本")}
              className={cn("h-7 text-xs", activeTabs.has("日本") ? "bg-blue-500 hover:bg-blue-600" : "")}
            >
              🇯🇵 日本
            </Button>
          </div>
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
                {activeTabs.has("中国") && cnSchedules.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-xs text-red-600 font-medium mb-1">🇨🇳 中国 ({cnSchedules.length}名)</div>
                  </div>
                )}
                {activeTabs.has("日本") && jpSchedules.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-xs text-blue-600 font-medium mb-1">🇯🇵 日本 ({jpSchedules.length}名)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Staff list - China */}
            {activeTabs.has("中国") && cnSchedules.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-2 bg-red-50 border-b flex items-center gap-2">
                  <span className="text-sm">🇨🇳</span>
                  <span className="text-sm font-bold text-red-700">中国チーム</span>
                  <span className="text-xs text-red-500 ml-auto">{cnSchedules.length}名出勤</span>
                </div>
                <div className="divide-y">
                  {cnSchedules.map((s) => (
                    <div key={s.id} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: s.color || staffColorMap[s.staffId] || '#999' }}
                      >
                        {s.staffName.charAt(0)}
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{s.staffName}</div>
                        {s.department && <div className="text-xs text-gray-500">{s.department}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {s.startTime} - {s.endTime}
                        </div>
                        {s.notes && (
                          <div className="text-[10px] mt-0.5 flex items-center gap-1">
                            {s.notes.includes("[跟播]") && <span className="bg-orange-100 text-orange-600 px-1 rounded font-medium">📹跟播</span>}
                            <span className="text-gray-400">{s.notes.replace("[跟播]", "").trim()}</span>
                          </div>
                        )}
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
                  ))}
                </div>
              </div>
            )}

            {/* Staff list - Japan */}
            {activeTabs.has("日本") && jpSchedules.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-2 bg-blue-50 border-b flex items-center gap-2">
                  <span className="text-sm">🇯🇵</span>
                  <span className="text-sm font-bold text-blue-700">日本チーム</span>
                  <span className="text-xs text-blue-500 ml-auto">{jpSchedules.length}名出勤</span>
                </div>
                <div className="divide-y">
                  {jpSchedules.map((s) => (
                    <div key={s.id} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: s.color || staffColorMap[s.staffId] || '#999' }}
                      >
                        {s.staffName.charAt(0)}
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{s.staffName}</div>
                        {s.department && <div className="text-xs text-gray-500">{s.department}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {s.startTime} - {s.endTime}
                        </div>
                        {s.notes && (
                          <div className="text-[10px] mt-0.5 flex items-center gap-1">
                            {s.notes.includes("[跟播]") && <span className="bg-orange-100 text-orange-600 px-1 rounded font-medium">📹跟播</span>}
                            <span className="text-gray-400">{s.notes.replace("[跟播]", "").trim()}</span>
                          </div>
                        )}
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
                  ))}
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
            {/* Schedule Type */}
            <div>
              <label className="text-sm font-medium text-gray-700">タイプ</label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={formScheduleType === "normal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormScheduleType("normal")}
                  className={cn("flex-1", formScheduleType === "normal" ? "bg-blue-600 hover:bg-blue-700" : "")}
                >
                  通常勤務
                </Button>
                <Button
                  type="button"
                  variant={formScheduleType === "followBroadcast" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormScheduleType("followBroadcast")}
                  className={cn("flex-1", formScheduleType === "followBroadcast" ? "bg-orange-500 hover:bg-orange-600" : "")}
                >
                  📹 跟播
                </Button>
              </div>
            </div>

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
              {formScheduleType === "followBroadcast" && (
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
                    const showDivider = formScheduleType === "followBroadcast" && idx > 0 && 
                      isFollowDept !== FOLLOW_BROADCAST_DEPTS.includes(sortedStaffForDropdown[idx - 1]?.department);
                    return (
                      <React.Fragment key={s.id}>
                        {showDivider && <div className="border-t my-1 mx-2" />}
                        <SelectItem value={s.id.toString()}>
                          {formScheduleType === "followBroadcast" && isFollowDept && "⭐ "}
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
