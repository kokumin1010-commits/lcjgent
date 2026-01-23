import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { toast } from "sonner";

// Helper function to convert UTC to JST
function toJST(date: Date): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

// Helper function to format time in JST
function formatTimeJST(date: Date): string {
  const jst = toJST(date);
  return jst.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

// Helper function to get JST date key
function getJSTDateKey(date: Date): string {
  const jst = toJST(date);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

// Helper function to format full date for modal
function formatFullDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${year}年${month}月${day}日(${weekdays[date.getDay()]})`;
}

// Liver colors for visual distinction - TimeTree style
const liverColors = [
  { bg: "bg-pink-400", text: "text-white" },
  { bg: "bg-blue-400", text: "text-white" },
  { bg: "bg-green-400", text: "text-white" },
  { bg: "bg-orange-400", text: "text-white" },
  { bg: "bg-purple-400", text: "text-white" },
  { bg: "bg-cyan-400", text: "text-white" },
  { bg: "bg-rose-400", text: "text-white" },
  { bg: "bg-indigo-400", text: "text-white" },
  { bg: "bg-amber-400", text: "text-white" },
  { bg: "bg-teal-400", text: "text-white" },
];

// Category colors
const categoryColors: Record<string, { bg: string; text: string }> = {
  delivery: { bg: "bg-blue-400", text: "text-white" },
  meeting: { bg: "bg-green-400", text: "text-white" },
  live: { bg: "bg-pink-400", text: "text-white" },
  other: { bg: "bg-gray-400", text: "text-white" },
};

interface Schedule {
  id: number;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime?: Date | null;
  category?: string | null;
  liverName?: string | null;
  status?: string | null;
}

export default function PublicSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  
  // Add schedule modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string>("");
  const [newSchedule, setNewSchedule] = useState({
    title: "",
    description: "",
    startTime: "10:00",
    endTime: "11:00",
    category: "other" as "delivery" | "meeting" | "live" | "other",
    liverName: "",
    isNewLiver: false,
    newLiverName: "",
  });

  // Double tap detection
  const lastTapRef = useRef<{ time: number; dateKey: string } | null>(null);

  // Get date range for the current month
  const dateRange = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }, [currentDate]);

  // Fetch schedules
  const { data: schedules, isLoading, refetch } = trpc.schedule.getPublicByDateRange.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

  // Fetch existing liver names
  const { data: existingLivers } = trpc.schedule.getPublicLiverNames.useQuery();

  // Create schedule mutation
  const createScheduleMutation = trpc.schedule.publicCreate.useMutation({
    onSuccess: () => {
      toast.success("スケジュールを追加しました");
      setAddModalOpen(false);
      resetNewSchedule();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "スケジュールの追加に失敗しました");
    },
  });

  const resetNewSchedule = () => {
    setNewSchedule({
      title: "",
      description: "",
      startTime: "10:00",
      endTime: "11:00",
      category: "other",
      liverName: "",
      isNewLiver: false,
      newLiverName: "",
    });
  };

  // Get unique liver names and assign colors
  const liverColorMap = useMemo(() => {
    if (!schedules) return new Map<string, typeof liverColors[0]>();
    
    const uniqueLivers = Array.from(new Set(schedules.map(s => s.liverName).filter((name): name is string => Boolean(name))));
    const map = new Map<string, typeof liverColors[0]>();
    uniqueLivers.forEach((liver, index) => {
      map.set(liver, liverColors[index % liverColors.length]);
    });
    return map;
  }, [schedules]);

  // Group schedules by date (JST)
  const schedulesByDate = useMemo(() => {
    if (!schedules) return new Map<string, Schedule[]>();
    
    const map = new Map<string, Schedule[]>();
    schedules.forEach((schedule) => {
      const dateKey = getJSTDateKey(new Date(schedule.startTime));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(schedule as Schedule);
    });
    
    // Sort schedules within each day by start time
    map.forEach((daySchedules) => {
      daySchedules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
    
    return map;
  }, [schedules]);

  // Get today's date key in JST
  const todayKey = getJSTDateKey(new Date());

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Generate calendar weeks
  const calendarWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Monday (adjust if first day is Sunday)
    let startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    // Adjust to start from Monday (0 = Sunday, 1 = Monday, etc.)
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    const weeks: { date: Date; isCurrentMonth: boolean }[][] = [];
    let currentWeek: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Generate 6 weeks to cover all possible month layouts
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      currentWeek.push({ date, isCurrentMonth });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Remove empty weeks at the end
    while (weeks.length > 0 && weeks[weeks.length - 1].every(d => !d.isCurrentMonth)) {
      weeks.pop();
    }
    
    return weeks;
  }, [currentDate]);

  // Handle date click (with double tap detection)
  const handleDateClick = useCallback((dateKey: string, daySchedules: Schedule[], isCurrentMonth: boolean) => {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    
    if (lastTap && lastTap.dateKey === dateKey && now - lastTap.time < 300) {
      // Double tap - open add modal
      if (isCurrentMonth) {
        setAddModalDate(dateKey);
        setAddModalOpen(true);
        lastTapRef.current = null;
        return;
      }
    }
    
    lastTapRef.current = { time: now, dateKey };
    
    // Single tap - select date or show schedules
    if (isCurrentMonth) {
      setSelectedDate(dateKey);
    }
  }, []);

  // Handle schedule click
  const handleScheduleClick = (schedule: Schedule, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedSchedule(schedule);
  };

  // Handle add schedule submit
  const handleAddSchedule = () => {
    if (!addModalDate) return;
    
    const liverName = newSchedule.isNewLiver ? newSchedule.newLiverName : newSchedule.liverName;
    
    if (!newSchedule.title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    
    const [year, month, day] = addModalDate.split("-").map(Number);
    const [startHour, startMinute] = newSchedule.startTime.split(":").map(Number);
    const [endHour, endMinute] = newSchedule.endTime.split(":").map(Number);
    
    // Create dates in JST, then convert to UTC for storage
    const startTimeJST = new Date(year, month - 1, day, startHour, startMinute);
    const endTimeJST = new Date(year, month - 1, day, endHour, endMinute);
    
    // Convert JST to UTC (subtract 9 hours)
    const startTimeUTC = new Date(startTimeJST.getTime() - 9 * 60 * 60 * 1000);
    const endTimeUTC = new Date(endTimeJST.getTime() - 9 * 60 * 60 * 1000);
    
    createScheduleMutation.mutate({
      title: newSchedule.title,
      description: newSchedule.description || undefined,
      startTime: startTimeUTC.toISOString(),
      endTime: endTimeUTC.toISOString(),
      category: newSchedule.category,
      liverName: liverName || "未指定",
    });
  };

  // Open add modal with today's date
  const openAddModal = () => {
    setAddModalDate(todayKey);
    setAddModalOpen(true);
  };

  // Get schedules for selected date
  const selectedDateSchedules = selectedDate ? schedulesByDate.get(selectedDate) || [] : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-500 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <button 
                className="flex items-center gap-1 text-xl font-bold"
                onClick={() => {/* Could open month picker */}}
              >
                {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
                <ChevronDown className="h-4 w-4" />
              </button>
              <p className="text-xs text-gray-500">LCJ スケジュール</p>
            </div>
          </div>
          <button className="text-pink-500">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex justify-center gap-4 py-2 border-b">
        <button 
          onClick={goToPrevMonth}
          className="px-4 py-1 text-gray-500 hover:text-gray-700"
        >
          ←
        </button>
        <button 
          onClick={() => setCurrentDate(new Date())}
          className="px-4 py-1 text-blue-500 font-medium"
        >
          今日
        </button>
        <button 
          onClick={goToNextMonth}
          className="px-4 py-1 text-gray-500 hover:text-gray-700"
        >
          →
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b">
        {["月", "火", "水", "木", "金", "土", "日"].map((day, i) => (
          <div
            key={day}
            className={cn(
              "text-center text-xs font-medium py-2",
              i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-gray-500"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid - TimeTree Style */}
      <div className="flex-1">
        {calendarWeeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b min-h-[100px]">
            {week.map(({ date, isCurrentMonth }, dayIndex) => {
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const daySchedules = schedulesByDate.get(dateKey) || [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const dayOfWeek = date.getDay();
              
              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "border-r last:border-r-0 p-1 cursor-pointer transition-colors relative",
                    isSelected && "bg-gray-100",
                    !isCurrentMonth && "bg-gray-50"
                  )}
                  onClick={() => handleDateClick(dateKey, daySchedules, isCurrentMonth)}
                >
                  {/* Date Number */}
                  <div className="flex justify-center mb-1">
                    <span
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full",
                        !isCurrentMonth && "text-gray-300",
                        isCurrentMonth && dayOfWeek === 0 && "text-red-500",
                        isCurrentMonth && dayOfWeek === 6 && "text-blue-500",
                        isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-gray-700",
                        isToday && "bg-blue-500 text-white"
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  
                  {/* Schedules */}
                  <div className="space-y-0.5">
                    {daySchedules.slice(0, 3).map((schedule) => {
                      const liverColor = schedule.liverName 
                        ? liverColorMap.get(schedule.liverName) 
                        : categoryColors[schedule.category || "other"];
                      
                      return (
                        <div
                          key={schedule.id}
                          className={cn(
                            "text-[10px] px-1 py-0.5 rounded truncate cursor-pointer",
                            liverColor?.bg || "bg-gray-400",
                            liverColor?.text || "text-white"
                          )}
                          onClick={(e) => handleScheduleClick(schedule, e)}
                        >
                          {schedule.title}
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-[10px] text-gray-400 text-center">
                        +{daySchedules.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={openAddModal}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-shadow z-20"
      >
        <Plus className="h-6 w-6 text-gray-700" />
      </button>

      {/* Date Detail Modal */}
      <Dialog open={!!selectedDate && selectedDateSchedules.length > 0} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-pink-500" />
              {selectedDate && formatFullDate(selectedDate)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedDateSchedules.map((schedule) => {
              const liverColor = schedule.liverName 
                ? liverColorMap.get(schedule.liverName) 
                : categoryColors[schedule.category || "other"];
              
              return (
                <div
                  key={schedule.id}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity",
                    liverColor?.bg || "bg-gray-400"
                  )}
                  onClick={() => handleScheduleClick(schedule)}
                >
                  <div className="text-white font-medium">
                    {schedule.title}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-white/80 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimeJST(new Date(schedule.startTime))}
                      {schedule.endTime && ` - ${formatTimeJST(new Date(schedule.endTime))}`}
                    </span>
                    {schedule.liverName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {schedule.liverName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                setAddModalDate(selectedDate!);
                setSelectedDate(null);
                setAddModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              この日にスケジュールを追加
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Detail Modal */}
      <Dialog open={!!selectedSchedule} onOpenChange={(open) => !open && setSelectedSchedule(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-pink-500" />
              スケジュール詳細
            </DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedSchedule.title}
                </h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>
                    {formatTimeJST(new Date(selectedSchedule.startTime))}
                    {selectedSchedule.endTime && ` - ${formatTimeJST(new Date(selectedSchedule.endTime))}`}
                  </span>
                </div>
                
                {selectedSchedule.liverName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{selectedSchedule.liverName}</span>
                  </div>
                )}
              </div>
              
              {selectedSchedule.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selectedSchedule.description}
                  </p>
                </div>
              )}
              
              {selectedSchedule.liverName && (
                <Link href={`/s/${encodeURIComponent(selectedSchedule.liverName)}`}>
                  <Button variant="outline" className="w-full">
                    {selectedSchedule.liverName}のスケジュールを見る
                  </Button>
                </Link>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Schedule Modal */}
      <Dialog open={addModalOpen} onOpenChange={(open) => {
        if (!open) {
          setAddModalOpen(false);
          resetNewSchedule();
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-pink-500" />
              スケジュールを追加
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Date */}
            <div>
              <Label className="text-sm font-medium">日付</Label>
              <p className="text-gray-700 mt-1">
                {addModalDate && formatFullDate(addModalDate)}
              </p>
            </div>
            
            {/* Liver Selection */}
            <div>
              <Label className="text-sm font-medium">ライバー</Label>
              {!newSchedule.isNewLiver ? (
                <div className="space-y-2 mt-1">
                  <Select
                    value={newSchedule.liverName}
                    onValueChange={(value) => {
                      if (value === "__new__") {
                        setNewSchedule(prev => ({ ...prev, isNewLiver: true, liverName: "" }));
                      } else {
                        setNewSchedule(prev => ({ ...prev, liverName: value }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ライバーを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLivers?.map((liver) => (
                        <SelectItem key={liver} value={liver}>
                          {liver}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          新しいライバーを追加
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2 mt-1">
                  <Input
                    placeholder="新しいライバー名を入力"
                    value={newSchedule.newLiverName}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, newLiverName: e.target.value }))}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewSchedule(prev => ({ ...prev, isNewLiver: false, newLiverName: "" }))}
                  >
                    既存のライバーから選択
                  </Button>
                </div>
              )}
            </div>
            
            {/* Title */}
            <div>
              <Label className="text-sm font-medium">タイトル *</Label>
              <Input
                placeholder="例: ライブ配信"
                value={newSchedule.title}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">開始時間</Label>
                <Input
                  type="time"
                  value={newSchedule.startTime}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">終了時間</Label>
                <Input
                  type="time"
                  value={newSchedule.endTime}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* Category */}
            <div>
              <Label className="text-sm font-medium">カテゴリ</Label>
              <Select
                value={newSchedule.category}
                onValueChange={(value: "delivery" | "meeting" | "live" | "other") => 
                  setNewSchedule(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">ライブ</SelectItem>
                  <SelectItem value="delivery">配信</SelectItem>
                  <SelectItem value="meeting">会議</SelectItem>
                  <SelectItem value="other">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Description */}
            <div>
              <Label className="text-sm font-medium">説明（任意）</Label>
              <Textarea
                placeholder="詳細を入力..."
                value={newSchedule.description}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>
            
            {/* Submit Button */}
            <Button
              onClick={handleAddSchedule}
              disabled={createScheduleMutation.isPending}
              className="w-full bg-pink-500 hover:bg-pink-600"
            >
              {createScheduleMutation.isPending ? "追加中..." : "スケジュールを追加"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
