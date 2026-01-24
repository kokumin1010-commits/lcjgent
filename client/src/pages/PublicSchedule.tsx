import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
  return `${year}年${month}月${day}日（${weekdays[date.getDay()]}）`;
}

// Liver colors for calendar display
const liverColors = [
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", color: "#EC4899" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", color: "#8B5CF6" },
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", color: "#3B82F6" },
  { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", color: "#10B981" },
  { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", color: "#F59E0B" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", color: "#F97316" },
  { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", color: "#EF4444" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", color: "#14B8A6" },
];

// Category colors
const categoryColors: Record<string, typeof liverColors[0]> = {
  delivery: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", color: "#EC4899" },
  meeting: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", color: "#3B82F6" },
  live: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", color: "#8B5CF6" },
  other: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", color: "#6B7280" },
};

type Schedule = {
  id: number;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  isAllDay?: boolean;
  category?: string | null;
  liverName?: string | null;
  liverId?: number | null;
};

export default function PublicSchedule() {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  // Use auth from users table (same as management dashboard)
  const { user, logout, loading: authLoading } = useAuth();
  
  // Add schedule modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string>("");
  const [addModalEndDate, setAddModalEndDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [endDatePickerMonth, setEndDatePickerMonth] = useState(new Date());
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

  // Create schedule mutation (uses user's name from auth)
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
    setShowEndDatePicker(false);
    setAddModalEndDate("");
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
      map.get(dateKey)!.push({
        ...schedule,
        startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
        endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
      } as Schedule);
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
    
    // Remove trailing weeks that are entirely in the next month
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

  // Generate end date picker calendar weeks
  const endDatePickerWeeks = useMemo(() => {
    const year = endDatePickerMonth.getFullYear();
    const month = endDatePickerMonth.getMonth();
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
  }, [endDatePickerMonth]);

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
      setAddModalEndDate(selectedDate);
      setDatePickerMonth(new Date(selectedDate));
      setEndDatePickerMonth(new Date(selectedDate));
      setBottomSheetOpen(false);
      setAddModalOpen(true);
    }
  };

  // Handle date selection in date picker (start date)
  const handleDatePickerSelect = (dateKey: string) => {
    setAddModalDate(dateKey);
    // If end date is before start date, update end date
    if (addModalEndDate && dateKey > addModalEndDate) {
      setAddModalEndDate(dateKey);
    }
    setShowDatePicker(false);
  };

  // Handle end date selection in date picker
  const handleEndDatePickerSelect = (dateKey: string) => {
    // End date cannot be before start date
    if (dateKey < addModalDate) {
      toast.error("終了日は開始日以降を選択してください");
      return;
    }
    setAddModalEndDate(dateKey);
    setShowEndDatePicker(false);
  };

  // Handle add schedule submit
  const handleAddSchedule = () => {
    if (!addModalDate) return;
    
    if (!newSchedule.title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    
    const [startYear, startMonth, startDay] = addModalDate.split("-").map(Number);
    const endDate = addModalEndDate || addModalDate;
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const [startHour, startMinute] = newSchedule.startTime.split(":").map(Number);
    const [endHour, endMinute] = newSchedule.endTime.split(":").map(Number);
    
    // Create dates in JST, then convert to UTC for storage
    const startTimeJST = newSchedule.isAllDay 
      ? new Date(startYear, startMonth - 1, startDay, 0, 0)
      : new Date(startYear, startMonth - 1, startDay, startHour, startMinute);
    const endTimeJST = newSchedule.isAllDay
      ? new Date(endYear, endMonth - 1, endDay, 23, 59)
      : new Date(endYear, endMonth - 1, endDay, endHour, endMinute);
    
    // Convert JST to UTC (subtract 9 hours)
    const startTimeUTC = new Date(startTimeJST.getTime() - 9 * 60 * 60 * 1000);
    const endTimeUTC = new Date(endTimeJST.getTime() - 9 * 60 * 60 * 1000);
    
    // Use user's name from auth
    createScheduleMutation.mutate({
      title: newSchedule.title,
      description: newSchedule.description || undefined,
      startTime: startTimeUTC.toISOString(),
      endTime: endTimeUTC.toISOString(),
      category: newSchedule.category,
      liverName: user?.name || "未指定",
    });
  };

  // Open add modal with today's date
  const openAddModal = () => {
    setAddModalDate(todayKey);
    setAddModalEndDate(todayKey);
    setDatePickerMonth(new Date());
    setEndDatePickerMonth(new Date());
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
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-pink-400 to-pink-500"
                >
                  {user.name?.charAt(0) || "U"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
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
                <DropdownMenuItem onClick={() => navigate("/login")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  ログイン
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/login")}>
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
                    "border-r last:border-r-0 p-1 cursor-pointer hover:bg-gray-50 transition-colors",
                    !isCurrentMonth && "bg-gray-50",
                    isSelected && "bg-blue-50"
                  )}
                  onClick={() => handleDateClick(dateKey, isCurrentMonth)}
                >
                  {/* Date number */}
                  <div className="flex justify-center mb-1">
                    <span
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-sm rounded-full",
                        isToday && "bg-blue-500 text-white font-bold",
                        !isToday && !isCurrentMonth && "text-gray-300",
                        !isToday && isCurrentMonth && dayOfWeek === 0 && "text-red-500",
                        !isToday && isCurrentMonth && dayOfWeek === 6 && "text-blue-500",
                        !isToday && isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-gray-700"
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  
                  {/* Schedule bars */}
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
                            liverColor?.bg || "bg-gray-100",
                            liverColor?.text || "text-gray-700"
                          )}
                        >
                          {schedule.isAllDay ? schedule.title : `${formatTimeJST(new Date(schedule.startTime)).slice(0, 5)} ${schedule.title}`}
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-[10px] text-gray-400 px-1">
                        +{daySchedules.length - 3}件
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
          if (user) {
            openAddModal();
          } else {
            toast.info("予定を追加するにはログインが必要です");
            navigate("/login");
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
                    if (user) {
                      handleAddFromSheet();
                    } else {
                      toast.info("予定を追加するにはログインが必要です");
                      navigate("/login");
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
                  
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2"
                      onClick={() => handleScheduleClick(schedule)}
                    >
                      {/* Time */}
                      <div className="w-14 text-right text-sm text-gray-500 pt-0.5">
                        {schedule.isAllDay ? "終日" : formatTimeJST(new Date(schedule.startTime))}
                      </div>
                      
                      {/* Vertical line */}
                      <div 
                        className="w-1 self-stretch rounded-full min-h-[40px]"
                        style={{ backgroundColor: liverColor?.color || "#6B7280" }}
                      />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{schedule.title}</h3>
                        {schedule.description && (
                          <p className="text-sm text-gray-500 truncate">{schedule.description}</p>
                        )}
                      </div>
                      
                      {/* Avatar */}
                      {schedule.liverName && (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: liverColor?.color || "#6B7280" }}
                        >
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

      {/* Schedule Detail Dialog */}
      <Dialog open={!!selectedSchedule} onOpenChange={(open) => !open && setSelectedSchedule(null)}>
        <DialogContent className="max-w-md p-0 rounded-2xl">
          {selectedSchedule && (
            <>
              {/* Header with color */}
              <div 
                className="p-4 rounded-t-2xl"
                style={{ 
                  backgroundColor: (selectedSchedule.liverName 
                    ? liverColorMap.get(selectedSchedule.liverName)?.color 
                    : categoryColors[selectedSchedule.category || "other"]?.color) || "#6B7280"
                }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">{selectedSchedule.title}</h2>
                  <button 
                    onClick={() => setSelectedSchedule(null)}
                    className="text-white/80 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Time */}
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">
                      {selectedSchedule.isAllDay 
                        ? "終日" 
                        : `${formatTimeJST(new Date(selectedSchedule.startTime))} - ${selectedSchedule.endTime ? formatTimeJST(new Date(selectedSchedule.endTime)) : ""}`
                      }
                    </p>
                  </div>
                </div>
                
                {/* Liver */}
                {selectedSchedule.liverName && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ 
                          backgroundColor: liverColorMap.get(selectedSchedule.liverName)?.color || "#6B7280"
                        }}
                      >
                        {selectedSchedule.liverName.charAt(0)}
                      </div>
                      <span>{selectedSchedule.liverName}</span>
                    </div>
                  </div>
                )}
                
                {/* Description */}
                {selectedSchedule.description && (
                  <div className="pt-2 border-t">
                    <p className="text-gray-600 whitespace-pre-wrap">{selectedSchedule.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Schedule Modal - TimeTree Style */}
      <Dialog open={addModalOpen} onOpenChange={(open) => {
        if (!open) {
          setAddModalOpen(false);
          resetNewSchedule();
        }
      }}>
        <DialogContent className="max-w-md p-0 rounded-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b">
            <button 
              onClick={() => {
                setAddModalOpen(false);
                resetNewSchedule();
              }}
              className="text-gray-500"
            >
              キャンセル
            </button>
            <h2 className="font-bold">予定を追加</h2>
            <button 
              onClick={handleAddSchedule}
              disabled={createScheduleMutation.isPending}
              className="text-pink-500 font-medium disabled:opacity-50"
            >
              {createScheduleMutation.isPending ? "保存中..." : "保存"}
            </button>
          </div>
          
          {/* Title Input */}
          <div className="px-4 py-3 border-b">
            <Input
              placeholder="タイトル"
              value={newSchedule.title}
              onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
              className="border-0 p-0 text-xl font-medium focus-visible:ring-0 placeholder:text-gray-300"
            />
          </div>
          
          {/* All Day Toggle */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-gray-700">終日</span>
            <Switch
              checked={newSchedule.isAllDay}
              onCheckedChange={(checked) => setNewSchedule(prev => ({ ...prev, isAllDay: checked }))}
            />
          </div>
          
          {/* Start Date Selection */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-pink-500" />
              <span className="text-sm text-gray-500 w-8">開始</span>
              <button
                onClick={() => {
                  setShowDatePicker(!showDatePicker);
                  setShowEndDatePicker(false);
                }}
                className="flex-1 text-left"
              >
                {addModalDate ? formatFullDate(addModalDate) : "開始日を選択"}
              </button>
            </div>
            
            {/* Inline Date Picker */}
            {showDatePicker && (
              <div className="mt-3 border rounded-lg p-3">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1, 1))}
                    className="p-1"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="font-medium">
                    {datePickerMonth.getFullYear()}年{datePickerMonth.getMonth() + 1}月
                  </span>
                  <button
                    onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1, 1))}
                    className="p-1"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2">
                  {["月", "火", "水", "木", "金", "土", "日"].map((day, i) => (
                    <div
                      key={day}
                      className={cn(
                        "text-center text-xs font-medium py-1",
                        i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-gray-500"
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Grid */}
                {datePickerWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7">
                    {week.map(({ date, isCurrentMonth }, dayIndex) => {
                      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      const isSelected = dateKey === addModalDate;
                      const isToday = dateKey === todayKey;
                      const dayOfWeek = date.getDay();
                      
                      return (
                        <button
                          key={dayIndex}
                          onClick={() => handleDatePickerSelect(dateKey)}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center text-sm rounded-full mx-auto",
                            !isCurrentMonth && "text-gray-300",
                            isCurrentMonth && !isSelected && dayOfWeek === 0 && "text-red-500",
                            isCurrentMonth && !isSelected && dayOfWeek === 6 && "text-blue-500",
                            isSelected && "bg-pink-500 text-white",
                            isToday && !isSelected && "border border-pink-500"
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

          {/* End Date Selection */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-pink-500" />
              <span className="text-sm text-gray-500 w-8">終了</span>
              <button
                onClick={() => {
                  setShowEndDatePicker(!showEndDatePicker);
                  setShowDatePicker(false);
                }}
                className="flex-1 text-left"
              >
                {addModalEndDate ? formatFullDate(addModalEndDate) : "終了日を選択"}
              </button>
            </div>
            
            {/* Inline End Date Picker */}
            {showEndDatePicker && (
              <div className="mt-3 border rounded-lg p-3">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setEndDatePickerMonth(new Date(endDatePickerMonth.getFullYear(), endDatePickerMonth.getMonth() - 1, 1))}
                    className="p-1"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="font-medium">
                    {endDatePickerMonth.getFullYear()}年{endDatePickerMonth.getMonth() + 1}月
                  </span>
                  <button
                    onClick={() => setEndDatePickerMonth(new Date(endDatePickerMonth.getFullYear(), endDatePickerMonth.getMonth() + 1, 1))}
                    className="p-1"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2">
                  {["月", "火", "水", "木", "金", "土", "日"].map((day, i) => (
                    <div
                      key={day}
                      className={cn(
                        "text-center text-xs font-medium py-1",
                        i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-gray-500"
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Grid */}
                {endDatePickerWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7">
                    {week.map(({ date, isCurrentMonth }, dayIndex) => {
                      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      const isSelected = dateKey === addModalEndDate;
                      const isToday = dateKey === todayKey;
                      const dayOfWeek = date.getDay();
                      const isBeforeStartDate = dateKey < addModalDate;
                      
                      return (
                        <button
                          key={dayIndex}
                          onClick={() => !isBeforeStartDate && handleEndDatePickerSelect(dateKey)}
                          disabled={isBeforeStartDate}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center text-sm rounded-full mx-auto",
                            !isCurrentMonth && "text-gray-300",
                            isBeforeStartDate && "text-gray-300 cursor-not-allowed",
                            isCurrentMonth && !isSelected && !isBeforeStartDate && dayOfWeek === 0 && "text-red-500",
                            isCurrentMonth && !isSelected && !isBeforeStartDate && dayOfWeek === 6 && "text-blue-500",
                            isSelected && "bg-pink-500 text-white",
                            isToday && !isSelected && "border border-pink-500"
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
          
          {/* Time Selection */}
          {!newSchedule.isAllDay && (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-pink-500" />
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={newSchedule.startTime}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                    className="border-0 p-0 w-24 focus-visible:ring-0"
                  />
                  <span className="text-gray-400">〜</span>
                  <Input
                    type="time"
                    value={newSchedule.endTime}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                    className="border-0 p-0 w-24 focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* User Info - Show logged in user */}
          {user && (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-pink-400 to-pink-500"
                >
                  {user.name?.charAt(0) || "U"}
                </div>
                <span className="text-gray-700 font-medium">{user.name}</span>
                <span className="text-xs text-gray-400 ml-auto">ログイン中</span>
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
