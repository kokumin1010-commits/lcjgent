import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

// Helper function to format time in JST using Intl API
function formatTimeJST(date: Date): string {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

// Helper function to get JST date key
function getJSTDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }); // YYYY-MM-DD format
}

// Helper function to format date for display
function formatDateDisplay(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Tokyo' };
  const month = parseInt(date.toLocaleDateString('ja-JP', { ...options, month: 'numeric' }));
  const day = parseInt(date.toLocaleDateString('ja-JP', { ...options, day: 'numeric' }));
  const weekday = date.toLocaleDateString('ja-JP', { ...options, weekday: 'short' });
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

export default function PublicLiverSchedule() {
  const params = useParams();
  const liverName = decodeURIComponent(params.name || "");
  const [viewMode, setViewMode] = useState<"upcoming" | "all">("upcoming");

  // Fetch schedules for this liver
  const { data: schedules, isLoading } = trpc.schedule.getPublicByLiver.useQuery({
    liverName: liverName,
  });

  // Filter and sort schedules
  const filteredSchedules = useMemo(() => {
    if (!schedules) return [];
    
    const now = new Date();
    let filtered = [...schedules] as Schedule[];
    
    if (viewMode === "upcoming") {
      // Show only future schedules
      filtered = filtered.filter(s => new Date(s.startTime) >= now);
    }
    
    // Sort by start time
    filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    return filtered;
  }, [schedules, viewMode]);

  // Group schedules by date (JST)
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    filteredSchedules.forEach((schedule) => {
      const dateKey = getJSTDateKey(new Date(schedule.startTime));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(schedule);
    });
    return map;
  }, [filteredSchedules]);

  // Get today's date key in JST
  const todayKey = getJSTDateKey(new Date());

  // Get sorted dates
  const sortedDates = useMemo(() => {
    return Array.from(schedulesByDate.keys()).sort();
  }, [schedulesByDate]);

  if (!liverName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-gray-700">ライバー名が指定されていません</p>
            <Link href="/s">
              <Button variant="link" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                スケジュール一覧へ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/s">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <User className="h-6 w-6 text-purple-600" />
                <h1 className="text-xl font-bold text-gray-900">{liverName}</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "upcoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("upcoming")}
              >
                今後
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("all")}
              >
                すべて
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="container py-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {filteredSchedules.length}
              </div>
              <div className="text-sm text-gray-700">
                {viewMode === "upcoming" ? "今後の予定" : "全予定"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {schedules?.length || 0}
              </div>
              <div className="text-sm text-gray-700">登録済み予定</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="container pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : sortedDates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-700">
              {viewMode === "upcoming" 
                ? `${liverName}さんの今後の予定はありません`
                : `${liverName}さんの予定は登録されていません`
              }
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((dateKey) => {
              const daySchedules = schedulesByDate.get(dateKey) || [];
              const isToday = dateKey === todayKey;
              const date = new Date(dateKey + "T00:00:00");
              const isPast = new Date(dateKey) < new Date(todayKey);
              
              return (
                <Card key={dateKey} className={cn(
                  isToday && "ring-2 ring-purple-500",
                  isPast && viewMode === "all" && "opacity-60"
                )}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                        isToday ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"
                      )}>
                        {date.getDate()}
                      </span>
                      <span className="text-gray-800">
                        {formatDateDisplay(new Date(dateKey + "T00:00:00+09:00"))}
                      </span>
                      {isToday && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          今日
                        </span>
                      )}
                      {isPast && viewMode === "all" && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          過去
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
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-700">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTimeJST(new Date(schedule.startTime))}
                                {schedule.endTime && ` - ${formatTimeJST(new Date(schedule.endTime))}`}
                              </span>
                            </div>
                            {schedule.description && (
                              <p className="mt-1 text-sm text-gray-800 line-clamp-2">
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
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-white py-4">
        <div className="container text-center text-sm text-gray-700">
          {liverName} - スケジュール
        </div>
      </footer>
    </div>
  );
}
