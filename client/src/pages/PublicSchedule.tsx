import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Users, Plus } from "lucide-react";
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

// Helper function to format date for display
function formatDateDisplay(date: Date): string {
  const jst = toJST(date);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const weekday = weekdays[jst.getUTCDay()];
  return `${month}/${day}(${weekday})`;
}

// Helper function to format full date for modal
function formatFullDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${year}年${month}月${day}日(${weekdays[date.getDay()]})`;
}

// Liver colors for visual distinction
const liverColors = [
  { bg: "bg-purple-100", border: "border-l-purple-500", text: "text-purple-700", badge: "bg-purple-500" },
  { bg: "bg-blue-100", border: "border-l-blue-500", text: "text-blue-700", badge: "bg-blue-500" },
  { bg: "bg-pink-100", border: "border-l-pink-500", text: "text-pink-700", badge: "bg-pink-500" },
  { bg: "bg-green-100", border: "border-l-green-500", text: "text-green-700", badge: "bg-green-500" },
  { bg: "bg-orange-100", border: "border-l-orange-500", text: "text-orange-700", badge: "bg-orange-500" },
  { bg: "bg-cyan-100", border: "border-l-cyan-500", text: "text-cyan-700", badge: "bg-cyan-500" },
  { bg: "bg-rose-100", border: "border-l-rose-500", text: "text-rose-700", badge: "bg-rose-500" },
  { bg: "bg-indigo-100", border: "border-l-indigo-500", text: "text-indigo-700", badge: "bg-indigo-500" },
  { bg: "bg-amber-100", border: "border-l-amber-500", text: "text-amber-700", badge: "bg-amber-500" },
  { bg: "bg-teal-100", border: "border-l-teal-500", text: "text-teal-700", badge: "bg-teal-500" },
];

// Category colors and labels
const categoryConfig: Record<string, { color: string; label: string }> = {
  delivery: { color: "bg-blue-500", label: "配信" },
  meeting: { color: "bg-green-500", label: "会議" },
  live: { color: "bg-purple-500", label: "ライブ" },
  other: { color: "bg-gray-500", label: "その他" },
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
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
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
      toast.success("スケジュールを追加しました", {
        description: "新しいスケジュールが登録されました。",
      });
      setAddModalOpen(false);
      resetNewSchedule();
      refetch();
    },
    onError: (error) => {
      toast.error("エラー", {
        description: error.message || "スケジュールの追加に失敗しました。",
      });
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

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, isCurrentMonth: false });
      }
    }

    return days;
  }, [currentDate]);

  // Get sorted dates with schedules for list view
  const sortedDates = useMemo(() => {
    return Array.from(schedulesByDate.keys()).sort();
  }, [schedulesByDate]);

  // Get unique livers for the legend
  const uniqueLivers = useMemo(() => {
    return Array.from(liverColorMap.keys()).sort();
  }, [liverColorMap]);

  // Get schedules for selected date
  const selectedDateSchedules = selectedDate ? schedulesByDate.get(selectedDate) || [] : [];

  // Handle date click in calendar (with double tap detection)
  const handleDateClick = useCallback((dateKey: string, daySchedules: Schedule[], isCurrentMonth: boolean) => {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    
    // Check for double tap (within 300ms on the same date)
    if (lastTap && lastTap.dateKey === dateKey && now - lastTap.time < 300) {
      // Double tap detected - open add modal
      if (isCurrentMonth) {
        setAddModalDate(dateKey);
        setAddModalOpen(true);
        lastTapRef.current = null;
        return;
      }
    }
    
    // Single tap - update last tap info
    lastTapRef.current = { time: now, dateKey };
    
    // If there are schedules, show them after a short delay (to allow for double tap)
    if (daySchedules.length > 0) {
      setTimeout(() => {
        // Only show if no double tap occurred
        if (lastTapRef.current?.dateKey === dateKey) {
          setSelectedDate(dateKey);
        }
      }, 300);
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
    const liverName = newSchedule.isNewLiver ? newSchedule.newLiverName : newSchedule.liverName;
    
    if (!newSchedule.title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    
    if (!liverName.trim()) {
      toast.error("ライバー名を選択または入力してください");
      return;
    }

    // Convert JST time to UTC
    const [startHour, startMin] = newSchedule.startTime.split(":").map(Number);
    const [endHour, endMin] = newSchedule.endTime.split(":").map(Number);
    const [year, month, day] = addModalDate.split("-").map(Number);
    
    // Create date in JST and convert to UTC
    const startTimeJST = new Date(year, month - 1, day, startHour, startMin);
    const endTimeJST = new Date(year, month - 1, day, endHour, endMin);
    
    // Subtract 9 hours to convert JST to UTC
    const startTimeUTC = new Date(startTimeJST.getTime() - 9 * 60 * 60 * 1000);
    const endTimeUTC = new Date(endTimeJST.getTime() - 9 * 60 * 60 * 1000);

    createScheduleMutation.mutate({
      title: newSchedule.title,
      description: newSchedule.description || undefined,
      startTime: startTimeUTC.toISOString(),
      endTime: endTimeUTC.toISOString(),
      category: newSchedule.category,
      liverName: liverName,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-900">全員のスケジュール</h1>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                リスト
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
              >
                カレンダー
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
            </span>
            <Button variant="outline" size="sm" onClick={goToToday}>
              今日
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Liver Legend */}
      {uniqueLivers.length > 0 && (
        <div className="container pb-4">
          <div className="flex flex-wrap gap-2">
            {uniqueLivers.map((liver) => {
              const colors = liverColorMap.get(liver);
              return (
                <Link key={liver} href={`/s/${encodeURIComponent(liver)}`}>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105",
                      colors?.bg,
                      colors?.text
                    )}
                  >
                    <User className="h-3.5 w-3.5" />
                    {liver}
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : viewMode === "list" ? (
          /* List View */
          <div className="space-y-4">
            {sortedDates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  この月の予定はありません
                </CardContent>
              </Card>
            ) : (
              sortedDates.map((dateKey) => {
                const daySchedules = schedulesByDate.get(dateKey) || [];
                const isToday = dateKey === todayKey;
                const date = new Date(dateKey + "T00:00:00");
                
                return (
                  <Card key={dateKey} className={cn(isToday && "ring-2 ring-purple-500")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                          isToday ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"
                        )}>
                          {date.getDate()}
                        </span>
                        <span className="text-gray-600">
                          {formatDateDisplay(new Date(dateKey + "T00:00:00+09:00"))}
                        </span>
                        {isToday && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            今日
                          </span>
                        )}
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">
                          {daySchedules.length}件
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {daySchedules.map((schedule) => {
                        const category = categoryConfig[schedule.category || "other"];
                        const liverColor = schedule.liverName 
                          ? liverColorMap.get(schedule.liverName) 
                          : null;
                        
                        return (
                          <div
                            key={schedule.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity",
                              liverColor?.bg || "bg-gray-50",
                              liverColor?.border || "border-l-gray-300"
                            )}
                            onClick={() => handleScheduleClick(schedule)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900 truncate">
                                  {schedule.title}
                                </span>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full text-white",
                                  category.color
                                )}>
                                  {category.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatTimeJST(new Date(schedule.startTime))}
                                  {schedule.endTime && ` - ${formatTimeJST(new Date(schedule.endTime))}`}
                                </span>
                                {schedule.liverName && (
                                  <Link href={`/s/${encodeURIComponent(schedule.liverName)}`}>
                                    <span className={cn(
                                      "flex items-center gap-1 hover:underline cursor-pointer",
                                      liverColor?.text || "text-gray-600"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                    >
                                      <User className="h-3.5 w-3.5" />
                                      {schedule.liverName}
                                    </span>
                                  </Link>
                                )}
                              </div>
                              {schedule.description && (
                                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                  {schedule.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          /* Calendar View */
          <Card>
            <CardContent className="p-2 sm:p-4">
              {/* Hint for adding schedule */}
              <div className="mb-3 text-center text-xs text-gray-500">
                <Plus className="inline h-3 w-3 mr-1" />
                日付をダブルタップでスケジュールを追加
              </div>
              
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-2">
                {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      "text-center text-xs font-medium py-2",
                      i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(({ date, isCurrentMonth }, index) => {
                  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const daySchedules = schedulesByDate.get(dateKey) || [];
                  const isToday = dateKey === todayKey;
                  const dayOfWeek = date.getDay();
                  const hasSchedules = daySchedules.length > 0;
                  
                  return (
                    <div
                      key={index}
                      className={cn(
                        "min-h-[70px] sm:min-h-[90px] p-1 rounded-lg border transition-all",
                        isCurrentMonth ? "bg-white cursor-pointer hover:bg-purple-50 hover:border-purple-300" : "bg-gray-50",
                        isToday && "ring-2 ring-purple-500"
                      )}
                      onClick={() => handleDateClick(dateKey, daySchedules, isCurrentMonth)}
                    >
                      <div className={cn(
                        "text-xs sm:text-sm font-medium mb-1",
                        !isCurrentMonth && "text-gray-300",
                        isCurrentMonth && dayOfWeek === 0 && "text-red-500",
                        isCurrentMonth && dayOfWeek === 6 && "text-blue-500",
                        isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-gray-700",
                        isToday && "text-purple-600 font-bold"
                      )}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {daySchedules.slice(0, 4).map((schedule) => {
                          const startTime = formatTimeJST(new Date(schedule.startTime));
                          const liverColor = schedule.liverName 
                            ? liverColorMap.get(schedule.liverName) 
                            : null;
                          const liverShort = schedule.liverName 
                            ? schedule.liverName.split(" ")[0].slice(0, 3) 
                            : "";
                          
                          return (
                            <div
                              key={schedule.id}
                              className={cn(
                                "text-[9px] sm:text-[10px] leading-tight truncate px-1 py-0.5 rounded cursor-pointer hover:opacity-70 transition-opacity",
                                liverColor?.bg || "bg-gray-100"
                              )}
                              title={`${startTime} ${schedule.title} (${schedule.liverName || "未指定"})`}
                              onClick={(e) => handleScheduleClick(schedule, e)}
                            >
                              <span className="font-medium">{startTime}</span>
                              {liverShort && (
                                <span className={cn("ml-0.5", liverColor?.text || "text-gray-600")}>
                                  {liverShort}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {daySchedules.length > 4 && (
                          <div className="text-[9px] text-gray-400 px-1">
                            +{daySchedules.length - 4}件
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Date Detail Modal */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              {selectedDate && formatFullDate(selectedDate)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedDateSchedules.length === 0 ? (
              <p className="text-center text-gray-500 py-4">予定はありません</p>
            ) : (
              selectedDateSchedules.map((schedule) => {
                const category = categoryConfig[schedule.category || "other"];
                const liverColor = schedule.liverName 
                  ? liverColorMap.get(schedule.liverName) 
                  : null;
                
                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "p-3 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity",
                      liverColor?.bg || "bg-gray-50",
                      liverColor?.border || "border-l-gray-300"
                    )}
                    onClick={() => handleScheduleClick(schedule)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {schedule.title}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full text-white",
                        category.color
                      )}>
                        {category.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTimeJST(new Date(schedule.startTime))}
                        {schedule.endTime && ` - ${formatTimeJST(new Date(schedule.endTime))}`}
                      </span>
                      {schedule.liverName && (
                        <span className={cn(
                          "flex items-center gap-1",
                          liverColor?.text || "text-gray-600"
                        )}>
                          <User className="h-3.5 w-3.5" />
                          {schedule.liverName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Add schedule button in date modal */}
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
              <Calendar className="h-5 w-5 text-purple-600" />
              スケジュール詳細
            </DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-4 mt-4">
              {/* Title and Category */}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedSchedule.title}
                  </h3>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full text-white",
                    categoryConfig[selectedSchedule.category || "other"].color
                  )}>
                    {categoryConfig[selectedSchedule.category || "other"].label}
                  </span>
                </div>
              </div>

              {/* Date and Time */}
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  {formatFullDate(getJSTDateKey(new Date(selectedSchedule.startTime)))}
                </span>
                <span className="font-medium">
                  {formatTimeJST(new Date(selectedSchedule.startTime))}
                  {selectedSchedule.endTime && ` - ${formatTimeJST(new Date(selectedSchedule.endTime))}`}
                </span>
              </div>

              {/* Liver Name */}
              {selectedSchedule.liverName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <Link href={`/s/${encodeURIComponent(selectedSchedule.liverName)}`}>
                    <span className={cn(
                      "font-medium hover:underline cursor-pointer",
                      liverColorMap.get(selectedSchedule.liverName)?.text || "text-gray-700"
                    )}>
                      {selectedSchedule.liverName}
                    </span>
                  </Link>
                </div>
              )}

              {/* Description */}
              {selectedSchedule.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selectedSchedule.description}
                  </p>
                </div>
              )}

              {/* Action Button */}
              {selectedSchedule.liverName && (
                <div className="pt-4">
                  <Link href={`/s/${encodeURIComponent(selectedSchedule.liverName)}`}>
                    <Button variant="outline" className="w-full" onClick={() => setSelectedSchedule(null)}>
                      <User className="h-4 w-4 mr-2" />
                      {selectedSchedule.liverName}のスケジュールを見る
                    </Button>
                  </Link>
                </div>
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
              <Plus className="h-5 w-5 text-purple-600" />
              スケジュールを追加
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Date display */}
            <div className="text-center text-lg font-semibold text-purple-600">
              {addModalDate && formatFullDate(addModalDate)}
            </div>

            {/* Liver selection */}
            <div className="space-y-2">
              <Label>ライバー名 *</Label>
              {!newSchedule.isNewLiver ? (
                <div className="space-y-2">
                  <Select
                    value={newSchedule.liverName}
                    onValueChange={(value) => {
                      if (value === "__new__") {
                        setNewSchedule({ ...newSchedule, isNewLiver: true, liverName: "" });
                      } else {
                        setNewSchedule({ ...newSchedule, liverName: value });
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
                <div className="space-y-2">
                  <Input
                    placeholder="新しいライバー名を入力"
                    value={newSchedule.newLiverName}
                    onChange={(e) => setNewSchedule({ ...newSchedule, newLiverName: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewSchedule({ ...newSchedule, isNewLiver: false, newLiverName: "" })}
                  >
                    既存のライバーから選択
                  </Button>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>タイトル *</Label>
              <Input
                placeholder="例: ライブ配信"
                value={newSchedule.title}
                onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })}
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>開始時間</Label>
                <Input
                  type="time"
                  value={newSchedule.startTime}
                  onChange={(e) => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>終了時間</Label>
                <Input
                  type="time"
                  value={newSchedule.endTime}
                  onChange={(e) => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Select
                value={newSchedule.category}
                onValueChange={(value: "delivery" | "meeting" | "live" | "other") => 
                  setNewSchedule({ ...newSchedule, category: value })
                }
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>説明（任意）</Label>
              <Textarea
                placeholder="詳細を入力..."
                value={newSchedule.description}
                onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Submit button */}
            <Button
              className="w-full"
              onClick={handleAddSchedule}
              disabled={createScheduleMutation.isPending}
            >
              {createScheduleMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  追加中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  スケジュールを追加
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-white py-4">
        <div className="container text-center text-sm text-gray-500">
          LCJ スケジュール管理
        </div>
      </footer>
    </div>
  );
}
