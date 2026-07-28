import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, User } from "lucide-react";
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTabs, setActiveTabs] = useState<Set<string>>(new Set(["中国", "日本"]));
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<number | null>(null);

  // Form state
  const [formStaffId, setFormStaffId] = useState<number | null>(null);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formNotes, setFormNotes] = useState("");

  // Get date range for current month
  const startOfMonth = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d.toISOString().split('T')[0];
  }, [currentDate]);

  const endOfMonth = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return d.toISOString().split('T')[0] + " 23:59:59";
  }, [currentDate]);

  // Fetch staff list
  const { data: staffList } = trpc.staff.listActive.useQuery();

  // Toggle tab selection
  const toggleTab = (tab: string) => {
    setActiveTabs(prev => {
      const next = new Set(prev);
      if (next.has(tab)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(tab);
      } else {
        next.add(tab);
      }
      return next;
    });
  };

  // Filter staff by selected countries
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    return staffList.filter((s: any) => activeTabs.has(s.country));
  }, [staffList, activeTabs]);

  // Fetch schedules - when both selected, don't pass country filter
  const countryFilter = activeTabs.size === 1 ? Array.from(activeTabs)[0] : undefined;
  const { data: schedules, refetch: refetchSchedules } = trpc.staffSchedule.getByDateRange.useQuery({
    startDate: startOfMonth,
    endDate: endOfMonth,
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
    setFormStartTime("09:00");
    setFormEndTime("18:00");
    setFormNotes("");
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { dateKey: string; day: number; isCurrentMonth: boolean }[] = [];

    // Days from previous month (start on Monday)
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ dateKey: getJSTDateKey(d), day: d.getDate(), isCurrentMonth: false });
    }

    // Days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ dateKey: getJSTDateKey(d), day: i, isCurrentMonth: true });
    }

    // Fill remaining
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ dateKey: getJSTDateKey(d), day: d.getDate(), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const map: Record<string, StaffScheduleEntry[]> = {};
    if (!schedules) return map;
    for (const s of schedules as StaffScheduleEntry[]) {
      const dateKey = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(s);
    }
    return map;
  }, [schedules]);

  // Staff color map
  const staffColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    filteredStaff.forEach((s: any, i: number) => {
      map[s.id] = getStaffColor(s.id, i);
    });
    return map;
  }, [filteredStaff]);

  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleCreateSchedule = () => {
    if (!formStaffId || !selectedDate) {
      toast.error("スタッフと日付を選択してください");
      return;
    }
    createMutation.mutate({
      staffId: formStaffId,
      date: selectedDate,
      startTime: formStartTime,
      endTime: formEndTime,
      notes: formNotes || undefined,
      color: staffColorMap[formStaffId] || undefined,
    });
  };

  const today = getJSTDateKey(new Date());

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold">
                {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
              </h1>
              <p className="text-sm text-gray-500">スタッフスケジュール</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/s">
              <Button variant="outline" size="sm">ライバースケジュール</Button>
            </Link>
            <Button onClick={goToToday} variant="outline" size="sm">今日</Button>
            <Button onClick={goToPreviousMonth} variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
            <Button onClick={goToNextMonth} variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Tabs: 中国 / 日本 (multi-select) */}
        <div className="flex gap-2 mt-3">
          <Button
            variant={activeTabs.has("中国") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleTab("中国")}
            className={activeTabs.has("中国") ? "bg-red-500 hover:bg-red-600" : ""}
          >
            🇨🇳 中国スタッフ
          </Button>
          <Button
            variant={activeTabs.has("日本") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleTab("日本")}
            className={activeTabs.has("日本") ? "bg-blue-500 hover:bg-blue-600" : ""}
          >
            🇯🇵 日本スタッフ
          </Button>
        </div>

        {/* Staff filter chips */}
        <div className="flex gap-1 mt-2 flex-wrap">
          <button
            onClick={() => setSelectedStaffFilter(null)}
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium transition-all",
              selectedStaffFilter === null
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            すべて
          </button>
          {filteredStaff.map((s: any, i: number) => (
            <button
              key={s.id}
              onClick={() => setSelectedStaffFilter(selectedStaffFilter === s.id ? null : s.id)}
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium transition-all",
                selectedStaffFilter === s.id
                  ? "text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              style={selectedStaffFilter === s.id ? { backgroundColor: staffColorMap[s.id] } : {}}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1">
          <div>月</div><div>火</div><div>水</div><div>木</div><div>金</div>
          <div className="text-blue-500">土</div><div className="text-red-500">日</div>
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {calendarDays.map((day, idx) => {
            const daySchedules = (schedulesByDate[day.dateKey] || [])
              .filter(s => selectedStaffFilter === null || s.staffId === selectedStaffFilter);
            const isToday = day.dateKey === today;
            const dayOfWeek = idx % 7;

            return (
              <div
                key={idx}
                className={cn(
                  "bg-white min-h-[100px] p-1 cursor-pointer hover:bg-blue-50 transition-colors relative",
                  !day.isCurrentMonth && "bg-gray-50 opacity-50"
                )}
                onClick={() => {
                  setSelectedDate(day.dateKey);
                  setShowCreateDialog(true);
                }}
              >
                <div className={cn(
                  "text-xs font-medium mb-0.5",
                  isToday && "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center",
                  !isToday && dayOfWeek === 5 && "text-blue-500",
                  !isToday && dayOfWeek === 6 && "text-red-500",
                )}>
                  {day.day}
                </div>
                {/* Schedule entries */}
                <div className="space-y-0.5">
                  {daySchedules.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                      style={{
                        backgroundColor: (s.color || staffColorMap[s.staffId] || '#ddd') + '30',
                        color: s.color || staffColorMap[s.staffId] || '#333',
                        borderLeft: `2px solid ${s.color || staffColorMap[s.staffId] || '#999'}`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-medium">{s.startTime}</span> {s.staffName}
                    </div>
                  ))}
                  {daySchedules.length > 4 && (
                    <div className="text-[10px] text-gray-400 pl-1">+{daySchedules.length - 4}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Schedule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              スタッフスケジュール追加
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="text-sm font-medium text-gray-700">日付</label>
              <Input
                type="date"
                value={selectedDate || ""}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Staff selection */}
            <div>
              <label className="text-sm font-medium text-gray-700">スタッフ *</label>
              <Select
                value={formStaffId?.toString() || ""}
                onValueChange={(v) => setFormStaffId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="スタッフを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredStaff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} {s.department ? `(${s.department})` : ''}
                    </SelectItem>
                  ))}
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

      {/* Day detail - show when clicking a day with existing schedules */}
      {selectedDate && schedulesByDate[selectedDate] && schedulesByDate[selectedDate].length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 max-h-[40vh] overflow-y-auto z-20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">
              {selectedDate} のスケジュール ({schedulesByDate[selectedDate]?.filter(s => selectedStaffFilter === null || s.staffId === selectedStaffFilter).length}件)
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {(schedulesByDate[selectedDate] || [])
              .filter(s => selectedStaffFilter === null || s.staffId === selectedStaffFilter)
              .map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: s.color || staffColorMap[s.staffId] || '#999' }}
                  />
                  <div>
                    <div className="text-sm font-medium">{s.staffName}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {s.startTime} - {s.endTime}
                      {s.notes && <span className="ml-2 text-gray-400">({s.notes})</span>}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600"
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
    </div>
  );
}
