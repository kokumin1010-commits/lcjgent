import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Get date range for the current month
  const dateRange = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }, [currentDate]);

  // Fetch schedules
  const { data: schedules, isLoading } = trpc.schedule.getPublicByDateRange.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">スケジュール</h1>
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

      {/* Content */}
      <div className="container pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                  <Card key={dateKey} className={cn(isToday && "ring-2 ring-blue-500")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                          isToday ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                        )}>
                          {date.getDate()}
                        </span>
                        <span className="text-gray-600">
                          {formatDateDisplay(new Date(dateKey + "T00:00:00+09:00"))}
                        </span>
                        {isToday && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            今日
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {daySchedules.map((schedule) => {
                        const category = categoryConfig[schedule.category || "other"];
                        return (
                          <div
                            key={schedule.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className={cn("w-1 self-stretch rounded-full", category.color)} />
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
                                  <span className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" />
                                    {schedule.liverName}
                                  </span>
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
                  
                  return (
                    <div
                      key={index}
                      className={cn(
                        "min-h-[60px] sm:min-h-[80px] p-1 rounded-lg border",
                        isCurrentMonth ? "bg-white" : "bg-gray-50",
                        isToday && "ring-2 ring-blue-500"
                      )}
                    >
                      <div className={cn(
                        "text-xs sm:text-sm font-medium mb-1",
                        !isCurrentMonth && "text-gray-300",
                        isCurrentMonth && dayOfWeek === 0 && "text-red-500",
                        isCurrentMonth && dayOfWeek === 6 && "text-blue-500",
                        isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-gray-700",
                        isToday && "text-blue-600 font-bold"
                      )}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {daySchedules.slice(0, 2).map((schedule) => {
                          const category = categoryConfig[schedule.category || "other"];
                          return (
                            <div
                              key={schedule.id}
                              className={cn(
                                "text-[10px] sm:text-xs px-1 py-0.5 rounded truncate text-white",
                                category.color
                              )}
                              title={`${formatTimeJST(new Date(schedule.startTime))} ${schedule.title}`}
                            >
                              {formatTimeJST(new Date(schedule.startTime))} {schedule.title}
                            </div>
                          );
                        })}
                        {daySchedules.length > 2 && (
                          <div className="text-[10px] text-gray-500 px-1">
                            +{daySchedules.length - 2}件
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

      {/* Footer */}
      <footer className="border-t bg-white py-4">
        <div className="container text-center text-sm text-gray-500">
          LCJ スケジュール管理
        </div>
      </footer>
    </div>
  );
}
