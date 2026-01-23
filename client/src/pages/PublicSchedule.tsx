import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, User, Plus, ChevronDown, ChevronLeft, ChevronRight, X, LogIn, LogOut, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

// Helper function to format date for bottom sheet header
function formatDateForSheet(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  return `${month}月${day}日 ${weekdays[date.getDay()]}`;
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
  { bg: "bg-pink-400", border: "border-pink-400", text: "text-white" },
  { bg: "bg-blue-400", border: "border-blue-400", text: "text-white" },
  { bg: "bg-green-400", border: "border-green-400", text: "text-white" },
  { bg: "bg-orange-400", border: "border-orange-400", text: "text-white" },
  { bg: "bg-purple-400", border: "border-purple-400", text: "text-white" },
  { bg: "bg-cyan-400", border: "border-cyan-400", text: "text-white" },
  { bg: "bg-rose-400", border: "border-rose-400", text: "text-white" },
  { bg: "bg-indigo-400", border: "border-indigo-400", text: "text-white" },
  { bg: "bg-amber-400", border: "border-amber-400", text: "text-white" },
  { bg: "bg-teal-400", border: "border-teal-400", text: "text-white" },
];

// Category colors
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  delivery: { bg: "bg-blue-400", border: "border-blue-400", text: "text-white" },
  meeting: { bg: "bg-green-400", border: "border-green-400", text: "text-white" },
  live: { bg: "bg-pink-400", border: "border-pink-400", text: "text-white" },
  other: { bg: "bg-gray-400", border: "border-gray-400", text: "text-white" },
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
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  // Liver authentication
  const { data: currentLiver, refetch: refetchLiver } = trpc.liver.me.useQuery();
  const logoutMutation = trpc.liver.logout.useMutation({
    onSuccess: () => {
      refetchLiver();
      toast.success("ログアウトしました");
    },
  });
  
  // Add schedule modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [newSchedule, setNewSchedule] = useState({
    title: "",
    description: "",
    startTime: "10:00",
    endTime: "11:00",
    isAllDay: false,
    category: "other" as "delivery" | "meeting" | "live" | "other",
    liverName: "",
    isNewLiver: false,
    newLiverName: "",
  });

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

  // Create schedule mutation (for logged-in livers)
  const createLiverScheduleMutation = trpc.liver.createSchedule.useMutation({
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

  // Create schedule mutation (for public/anonymous)
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
      isAllDay: false,
      category: "other",
      liverName: "",
      isNewLiver: false,
      newLiverName: "",
    });
    setShowDatePicker(false);
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

  // Generate date picker calendar weeks
  const datePickerWeeks = useMemo(() => {
    const year = datePickerMonth.getFullYear();
    const month = datePickerMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    
    let startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    const weeks: { date: Date; isCurrentMonth: boolean }[][] = [];
    let currentWeek: { date: Date; isCurrentMonth: boolean }[] = [];
    
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
    
    while (weeks.length > 0 && weeks[weeks.length - 1].every(d => !d.isCurrentMonth)) {
      weeks.pop();
    }
    
    return weeks;
  }, [datePickerMonth]);

  // Handle date click - open bottom sheet
  const handleDateClick = useCallback((dateKey: string, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
      setSelectedDate(dateKey);
      setBottomSheetOpen(true);
    }
  }, []);

  // Handle schedule click in bottom sheet
  const handleScheduleClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
  };

  // Handle add schedule from bottom sheet
  const handleAddFromSheet = () => {
    if (selectedDate) {
      setAddModalDate(selectedDate);
      setDatePickerMonth(new Date(selectedDate));
      setBottomSheetOpen(false);
      setAddModalOpen(true);
    }
  };

  // Handle date selection in date picker
  const handleDatePickerSelect = (dateKey: string) => {
    setAddModalDate(dateKey);
    setShowDatePicker(false);
  };

  // Handle add schedule submit
  const handleAddSchedule = () => {
    if (!addModalDate) return;
    
    if (!newSchedule.title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    
    const [year, month, day] = addModalDate.split("-").map(Number);
    const [startHour, startMinute] = newSchedule.startTime.split(":").map(Number);
    const [endHour, endMinute] = newSchedule.endTime.split(":").map(Number);
    
    // Create dates in JST, then convert to UTC for storage
    const startTimeJST = newSchedule.isAllDay 
      ? new Date(year, month - 1, day, 0, 0)
      : new Date(year, month - 1, day, startHour, startMinute);
    const endTimeJST = newSchedule.isAllDay
      ? new Date(year, month - 1, day, 23, 59)
      : new Date(year, month - 1, day, endHour, endMinute);
    
    // Convert JST to UTC (subtract 9 hours)
    const startTimeUTC = new Date(startTimeJST.getTime() - 9 * 60 * 60 * 1000);
    const endTimeUTC = new Date(endTimeJST.getTime() - 9 * 60 * 60 * 1000);
    
    // If logged in as liver, use liver API (no need to specify liver name)
    if (currentLiver) {
      createLiverScheduleMutation.mutate({
        title: newSchedule.title,
        description: newSchedule.description || undefined,
        startTime: startTimeUTC.toISOString(),
        endTime: endTimeUTC.toISOString(),
        isAllDay: newSchedule.isAllDay,
        category: newSchedule.category,
        notes: undefined,
      });
    } else {
      // Public/anonymous - need to specify liver name
      const liverName = newSchedule.isNewLiver ? newSchedule.newLiverName : newSchedule.liverName;
      createScheduleMutation.mutate({
        title: newSchedule.title,
        description: newSchedule.description || undefined,
        startTime: startTimeUTC.toISOString(),
        endTime: endTimeUTC.toISOString(),
        category: newSchedule.category,
        liverName: liverName || "未指定",
      });
    }
  };

  // Open add modal with today's date
  const openAddModal = () => {
    setAddModalDate(todayKey);
    setDatePickerMonth(new Date());
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
          {/* User Menu */}
          {currentLiver ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: currentLiver.color || "#FF69B4" }}
                >
                  {currentLiver.name.charAt(0)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="font-medium text-sm">{currentLiver.name}</p>
                  <p className="text-xs text-gray-500">{currentLiver.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-pink-500">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/liver/login")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  ログイン
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/liver/register")}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  新規登録
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
              const isSelected = dateKey === selectedDate && bottomSheetOpen;
              const dayOfWeek = date.getDay();
              
              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "border-r last:border-r-0 p-1 cursor-pointer transition-colors relative",
                    isSelected && "bg-gray-100",
                    !isCurrentMonth && "bg-gray-50"
                  )}
                  onClick={() => handleDateClick(dateKey, isCurrentMonth)}
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
                            "text-[10px] px-1 py-0.5 rounded truncate",
                            liverColor?.bg || "bg-gray-400",
                            liverColor?.text || "text-white"
                          )}
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
        onClick={() => {
          if (currentLiver) {
            openAddModal();
          } else {
            toast.info("予定を追加するにはログインが必要です");
            navigate("/liver/login");
          }
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-shadow z-20"
      >
        <Plus className="h-6 w-6 text-gray-700" />
      </button>

      {/* Bottom Sheet for Date Details - TimeTree Style */}
      <Sheet open={bottomSheetOpen} onOpenChange={setBottomSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          
          {/* Header */}
          <div className="px-4 pb-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {selectedDate && formatDateForSheet(selectedDate)}
              </h2>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center">
                  <span className="text-lg">☺</span>
                </button>
                <button
                  onClick={() => {
                    if (currentLiver) {
                      handleAddFromSheet();
                    } else {
                      toast.info("予定を追加するにはログインが必要です");
                      navigate("/liver/login");
                    }
                  }}
                  className="w-8 h-8 bg-black rounded-full flex items-center justify-center"
                >
                  <Plus className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Content - TimeTree Style List */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {selectedDateSchedules.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                予定がありません
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateSchedules.map((schedule) => {
                  const liverColor = schedule.liverName 
                    ? liverColorMap.get(schedule.liverName) 
                    : categoryColors[schedule.category || "other"];
                  
                  const startTime = formatTimeJST(new Date(schedule.startTime));
                  const endTime = schedule.endTime ? formatTimeJST(new Date(schedule.endTime)) : null;
                  const isAllDay = startTime === "00:00" && endTime === "23:59";
                  
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => handleScheduleClick(schedule)}
                    >
                      {/* Time column */}
                      <div className="w-12 text-right text-sm text-gray-500 pt-0.5 flex-shrink-0">
                        {isAllDay ? (
                          <span>終日</span>
                        ) : (
                          <div>
                            <div>{startTime}</div>
                            {endTime && <div className="text-gray-400">{endTime}</div>}
                          </div>
                        )}
                      </div>
                      
                      {/* Color bar */}
                      <div className={cn(
                        "w-1 min-h-[40px] rounded-full flex-shrink-0",
                        liverColor?.bg || "bg-gray-400"
                      )} />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {schedule.title}
                        </div>
                        {schedule.description && (
                          <div className="text-sm text-gray-500 truncate">
                            {schedule.description}
                          </div>
                        )}
                      </div>
                      
                      {/* Avatar placeholder */}
                      {schedule.liverName && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 flex-shrink-0">
                          {schedule.liverName.charAt(0)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Schedule Detail Modal */}
      <Dialog open={!!selectedSchedule} onOpenChange={(open) => !open && setSelectedSchedule(null)}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedSchedule?.title}
              </h2>
            </div>
            
            {selectedSchedule && (
              <>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {formatTimeJST(new Date(selectedSchedule.startTime))}
                      {selectedSchedule.endTime && ` - ${formatTimeJST(new Date(selectedSchedule.endTime))}`}
                    </span>
                  </div>
                  
                  {selectedSchedule.liverName && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span>{selectedSchedule.liverName}</span>
                    </div>
                  )}
                </div>
                
                {selectedSchedule.description && (
                  <div className="pt-3 border-t">
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Schedule Modal - TimeTree Style */}
      <Dialog open={addModalOpen} onOpenChange={(open) => {
        if (!open) {
          setAddModalOpen(false);
          resetNewSchedule();
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button 
              onClick={() => {
                setAddModalOpen(false);
                resetNewSchedule();
              }}
              className="text-pink-500 text-lg"
            >
              <X className="h-6 w-6" />
            </button>
            <Button
              onClick={handleAddSchedule}
              disabled={createScheduleMutation.isPending}
              variant="outline"
              className="rounded-full px-6"
            >
              {createScheduleMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
          
          {/* Title Input */}
          <div className="px-4 py-4 border-b">
            <Input
              placeholder="タイトル"
              value={newSchedule.title}
              onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
              className="text-2xl font-light border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-gray-300"
            />
          </div>
          
          {/* All Day Toggle */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-pink-400 flex items-center justify-center text-xs text-pink-400">
                24
              </div>
              <span className="text-gray-700">終日</span>
            </div>
            <Switch
              checked={newSchedule.isAllDay}
              onCheckedChange={(checked) => setNewSchedule(prev => ({ ...prev, isAllDay: checked }))}
              className="data-[state=checked]:bg-pink-500"
            />
          </div>
          
          {/* Start Date/Time */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">開始</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDatePicker(!showDatePicker);
                    setDatePickerMonth(new Date(addModalDate));
                  }}
                  className="px-3 py-1.5 bg-pink-500 text-white rounded-full text-sm"
                >
                  {addModalDate && formatFullDate(addModalDate)}
                </button>
                {!newSchedule.isAllDay && (
                  <input
                    type="time"
                    value={newSchedule.startTime}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                    className="px-3 py-1.5 bg-gray-100 rounded-full text-sm border-0"
                  />
                )}
              </div>
            </div>
            
            {/* Inline Date Picker */}
            {showDatePicker && (
              <div className="mt-4 border rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1))}
                    className="p-1 text-pink-500"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="font-medium text-pink-500">
                    {datePickerMonth.getFullYear()}年{datePickerMonth.getMonth() + 1}月
                  </span>
                  <button
                    onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1))}
                    className="p-1 text-pink-500"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
                  {["月", "火", "水", "木", "金", "土", "日"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                
                {datePickerWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map(({ date, isCurrentMonth }, di) => {
                      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      const isSelected = dateKey === addModalDate;
                      const isToday = dateKey === todayKey;
                      
                      return (
                        <button
                          key={di}
                          onClick={() => handleDatePickerSelect(dateKey)}
                          className={cn(
                            "w-8 h-8 rounded-full text-sm flex items-center justify-center",
                            !isCurrentMonth && "text-gray-300",
                            isCurrentMonth && "text-gray-700",
                            isSelected && "bg-pink-100 text-pink-500",
                            isToday && !isSelected && "text-blue-500 font-bold"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* End Date/Time */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">終了</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                  {addModalDate && formatFullDate(addModalDate)}
                </span>
                {!newSchedule.isAllDay && (
                  <input
                    type="time"
                    value={newSchedule.endTime}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                    className="px-3 py-1.5 bg-gray-100 rounded-full text-sm border-0"
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* Liver Selection - only show if not logged in */}
          {currentLiver ? (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: currentLiver.color || "#FF69B4" }}
                >
                  {currentLiver.name.charAt(0)}
                </div>
                <span className="text-gray-700 font-medium">{currentLiver.name}</span>
                <span className="text-xs text-gray-400 ml-auto">ログイン中</span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-pink-500" />
                {!newSchedule.isNewLiver ? (
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
                    <SelectTrigger className="flex-1 border-0 p-0 h-auto focus:ring-0">
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
                ) : (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    placeholder="新しいライバー名"
                    value={newSchedule.newLiverName}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, newLiverName: e.target.value }))}
                    className="border-0 p-0 h-auto focus-visible:ring-0"
                  />
                  <button
                    onClick={() => setNewSchedule(prev => ({ ...prev, isNewLiver: false, newLiverName: "" }))}
                    className="text-gray-400 text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              )}
              </div>
            </div>
          )}
          
          {/* Description */}
          <div className="px-4 py-3">
            <Textarea
              placeholder="メモを追加..."
              value={newSchedule.description}
              onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
              className="border-0 p-0 focus-visible:ring-0 resize-none min-h-[100px]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
