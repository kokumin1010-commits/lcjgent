import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { liverI18n } from "@/lib/liverI18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Video,
  Plus,
  Home,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

// Helper function to format time in JST using Intl API
function formatTimeJST(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

// Helper function to get JST date parts using Intl API
function getJSTDateParts(date: Date | string): { year: number; month: number; day: number; dayOfWeek: number } {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
  return {
    year: parseInt(d.toLocaleDateString('ja-JP', { ...options, year: 'numeric' })),
    month: parseInt(d.toLocaleDateString('ja-JP', { ...options, month: 'numeric' })) - 1, // 0-indexed
    day: parseInt(d.toLocaleDateString('ja-JP', { ...options, day: 'numeric' })),
    dayOfWeek: new Date(d.toLocaleDateString('en-CA', { ...options })).getDay(),
  };
}

type Schedule = {
  id: number;
  title: string;
  description?: string | null;
  startTime: Date | string;
  endTime?: Date | string | null;
  category: string;
  status: string;
  liverName?: string | null;
  brandId?: number | null;
};

type Livestream = {
  id: number;
  livestreamDate: Date | string;
  livestreamEndTime?: Date | string | null;
  salesAmount?: number | null;
  gmv?: number | null;
  duration?: number | null;
  result?: string | null;
  scheduleId?: number | null;
};

export default function LiverSchedule() {
  const { language } = useLanguage();
  const t = (key: string) => liverI18n[key]?.[language] || liverI18n[key]?.ja || key;
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Get current liver info with caching to prevent unnecessary refetches
  const { data: liverInfo, isLoading: isLoadingLiver, isError: isLiverError } = trpc.liver.me.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Get schedules for the current month
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

  const { data: schedules, isLoading: isLoadingSchedules } = trpc.liver.getMySchedules.useQuery(
    {
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString(),
    },
    { enabled: !!liverInfo?.id }
  );

  // Get livestreams for the current month
  const { data: livestreams } = trpc.liverManagement.getLivestreams.useQuery(
    { liverId: liverInfo?.id || 0 },
    { enabled: !!liverInfo?.id }
  );

  // Filter livestreams for current month
  const monthlyLivestreams = useMemo(() => {
    if (!livestreams) return [];
    return livestreams.filter((ls: Livestream) => {
      const date = new Date(ls.livestreamDate);
      return date >= startOfMonth && date <= endOfMonth;
    });
  }, [livestreams, startOfMonth, endOfMonth]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: { date: Date; isCurrentMonth: boolean; schedules: Schedule[]; livestreams: Livestream[] }[] = [];
    
    // Add days from previous month
    const startDayOfWeek = firstDay.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false, schedules: [], livestreams: [] });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const daySchedules = (schedules || []).filter((s: Schedule) => {
        // JSTで日付を比較
        const jstParts = getJSTDateParts(s.startTime);
        return jstParts.day === i && 
               jstParts.month === month && 
               jstParts.year === year;
      });
      const dayLivestreams = monthlyLivestreams.filter((ls: Livestream) => {
        // JSTで日付を比較
        const jstParts = getJSTDateParts(ls.livestreamDate);
        return jstParts.day === i && 
               jstParts.month === month && 
               jstParts.year === year;
      });
      days.push({ date, isCurrentMonth: true, schedules: daySchedules, livestreams: dayLivestreams });
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, schedules: [], livestreams: [] });
    }
    
    return days;
  }, [currentDate, schedules, monthlyLivestreams]);

  // Get schedules and livestreams for selected date
  const selectedDateData = useMemo(() => {
    if (!selectedDate) return { schedules: [], livestreams: [] };
    
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    const daySchedules = (schedules || []).filter((s: Schedule) => {
      // JSTで日付を比較
      const jstParts = getJSTDateParts(s.startTime);
      return jstParts.day === selectedDay && 
             jstParts.month === selectedMonth && 
             jstParts.year === selectedYear;
    });
    
    const dayLivestreams = monthlyLivestreams.filter((ls: Livestream) => {
      // JSTで日付を比較
      const jstParts = getJSTDateParts(ls.livestreamDate);
      return jstParts.day === selectedDay && 
             jstParts.month === selectedMonth && 
             jstParts.year === selectedYear;
    });
    
    return { schedules: daySchedules, livestreams: dayLivestreams };
  }, [selectedDate, schedules, monthlyLivestreams]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    setSelectedDate(date);
  };

  const handleRecordFromSchedule = (schedule: Schedule) => {
    // Navigate to record page with schedule info pre-filled
    const dateStr = new Date(schedule.startTime).toISOString().split('T')[0];
    navigate(`/liver/record?scheduleId=${schedule.id}&date=${dateStr}`);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const weekDays = language === 'ja' ? ["日", "月", "火", "水", "木", "金", "土"] : language === 'zh-TW' ? ["日", "一", "二", "三", "四", "五", "六"] : language === 'en' ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["日", "一", "二", "三", "四", "五", "六"];

  if (isLoadingLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show login prompt if there's an error after loading is complete
  if (!liverInfo) {
    // If there was an error, show login prompt
    if (isLiverError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
          <p className="text-white text-center">{t("login.required")}</p>
          <Button
            onClick={() => navigate("/liver/login")}
            className="bg-red-600 hover:bg-red-700"
          >
            {t("login.goToLogin")}
          </Button>
        </div>
      );
    }
    // No error but no liverInfo - show loading
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black border-b-2 border-red-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/liver/mypage")}
              className="text-gray-200 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-yellow-500">{t("schedule.title")}</h1>
          </div>
          <Link href="/liver/mypage">
            <Button variant="ghost" size="icon" className="text-gray-200 hover:text-white">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Red line separator */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            className="text-gray-200 hover:text-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">
              {language === 'en' ? `${currentDate.toLocaleString('en', { month: 'long' })} ${currentDate.getFullYear()}` : `${currentDate.getFullYear()}${language === 'ja' ? '年' : '年'}${currentDate.getMonth() + 1}${language === 'ja' ? '月' : '月'}`}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="border-gray-700 text-gray-200 hover:text-white"
            >
              {language === 'ja' ? '今日' : language === 'zh-TW' ? '今天' : language === 'en' ? 'Today' : '今天'}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="text-gray-200 hover:text-white"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={`text-center text-sm font-medium py-2 ${
                    index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-gray-200"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const hasSchedule = day.schedules.length > 0;
                const hasLivestream = day.livestreams.length > 0;
                const hasCompletedLivestream = day.livestreams.some((ls: Livestream) => ls.result === "成功");
                const hasFailedLivestream = day.livestreams.some((ls: Livestream) => ls.result === "失敗");
                const hasPendingSchedule = hasSchedule && !hasLivestream;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(day.date, day.isCurrentMonth)}
                    className={`
                      relative aspect-square p-1 rounded-lg transition-colors
                      ${day.isCurrentMonth ? "hover:bg-gray-800" : "opacity-40 hover:bg-gray-800/50"}
                      ${isToday(day.date) ? "ring-2 ring-yellow-500" : ""}
                      ${selectedDate?.toDateString() === day.date.toDateString() ? "bg-gray-800" : ""}
                    `}
                  >
                    <span className={`
                      text-sm font-medium
                      ${isToday(day.date) ? "text-yellow-500" : ""}
                      ${day.date.getDay() === 0 ? "text-red-400" : ""}
                      ${day.date.getDay() === 6 ? "text-blue-400" : ""}
                    `}>
                      {day.date.getDate()}
                    </span>
                    
                    {/* Indicators */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {hasPendingSchedule && (
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      )}
                      {hasCompletedLivestream && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      )}
                      {hasFailedLivestream && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                      {hasLivestream && !hasCompletedLivestream && !hasFailedLivestream && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-200">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>{t("schedule.hasSchedule")}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>{t("schedule.streamSuccess")}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>{t("schedule.streamFailed")}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{t("schedule.streamRecord")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        {selectedDate && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-yellow-500" />
                {selectedDate.toLocaleDateString("ja-JP", { 
                  year: "numeric",
                  month: "long", 
                  day: "numeric",
                  weekday: "long"
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Schedules */}
              {selectedDateData.schedules.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-200 mb-2">{t("schedule.upcoming")}</h4>
                  <div className="space-y-2">
                    {selectedDateData.schedules.map((schedule: Schedule) => {
                      const hasLinkedLivestream = selectedDateData.livestreams.some(
                        (ls: Livestream) => ls.scheduleId === schedule.id
                      );
                      
                      return (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                              <Video className="h-5 w-5 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{schedule.title}</p>
                              <p className="text-sm text-gray-200">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {formatTimeJST(schedule.startTime)}
                                {schedule.endTime && ` - ${formatTimeJST(schedule.endTime)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasLinkedLivestream ? (
                              <Badge className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {t("schedule.recorded")}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleRecordFromSchedule(schedule)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                {t("schedule.record")}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Livestreams */}
              {selectedDateData.livestreams.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-200 mb-2">{t("schedule.streamRecord")}</h4>
                  <div className="space-y-2">
                    {selectedDateData.livestreams.map((ls: Livestream) => (
                      <div
                        key={ls.id}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
                        onClick={() => navigate(`/livestreams/${ls.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            ls.result === "成功" ? "bg-green-500/20" : 
                            ls.result === "失敗" ? "bg-red-500/20" : 
                            "bg-blue-500/20"
                          }`}>
                            {ls.result === "成功" ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : ls.result === "失敗" ? (
                              <XCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <Video className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {formatTimeJST(ls.livestreamDate)}
                              {ls.livestreamEndTime && ` - ${formatTimeJST(ls.livestreamEndTime)}`}
                            </p>
                            <p className="text-sm text-gray-200">
                              売上: ¥{Number(ls.salesAmount || ls.gmv || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {ls.result && (
                          <Badge className={ls.result === "成功" ? "bg-green-600" : "bg-red-600"}>
                            {ls.result}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No data message */}
              {selectedDateData.schedules.length === 0 && selectedDateData.livestreams.length === 0 && (
                <div className="text-center py-8 text-gray-200">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("schedule.noSchedule")}</p>
                  <Button
                    onClick={() => navigate(`/liver/record?date=${selectedDate.toISOString().split('T')[0]}`)}
                    className="mt-4 bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("schedule.recordStream")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Record Button */}
        <Button
          onClick={() => navigate("/liver/record")}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold"
        >
          <Plus className="h-5 w-5 mr-2" />
          {t("record.title")}
        </Button>
      </div>
    </div>
  );
}
