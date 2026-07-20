import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User,
  Trash2,
  Edit,
  Settings,
} from "lucide-react";
import { useLocation } from "wouter";

type Schedule = {
  id: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  isAllDay: boolean;
  category: "delivery" | "meeting" | "live" | "other";
  liverName: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

const categoryColors: Record<string, string> = {
  delivery: "bg-blue-500",
  meeting: "bg-green-500",
  live: "bg-purple-500",
  other: "bg-gray-500",
};

// Helper function to format time in JST (UTC+9)
const formatTimeInJST = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
};

// Helper function to get date string in JST for grouping
const getDateStringInJST = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const categoryLabels: Record<string, string> = {
  delivery: "配信",
  meeting: "ミーティング",
  live: "ライブ",
  other: "その他",
};

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    category: "other" as "delivery" | "meeting" | "live" | "other",
    liverName: "",
    liveAccount: "",
    notes: "",
  });

  // Get the first and last day of the current month view (including overflow days)
  const { startDate, endDate } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Adjust to include the full week
    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - end.getDay()));

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [currentDate]);

  const { data: schedules, refetch } = trpc.schedule.getByDateRange.useQuery({
    startDate,
    endDate,
  });

  const createMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      toast.success("予定を追加しました");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateMutation = trpc.schedule.update.useMutation({
    onSuccess: () => {
      toast.success("予定を更新しました");
      setEditingSchedule(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.schedule.delete.useMutation({
    onSuccess: () => {
      toast.success("予定を削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      category: "other",
      liverName: "",
      liveAccount: "",
      notes: "",
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // Pre-fill the date in the form
    const dateStr = date.toISOString().split("T")[0];
    setFormData((prev) => ({
      ...prev,
      startTime: `${dateStr}T09:00`,
      endTime: `${dateStr}T10:00`,
    }));
    setIsAddDialogOpen(true);
  };

  const handleEditClick = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    const startDate = new Date(schedule.startTime);
    const endDate = schedule.endTime ? new Date(schedule.endTime) : null;

    setFormData({
      title: schedule.title,
      description: schedule.description || "",
      startTime: startDate.toISOString().slice(0, 16),
      endTime: endDate ? endDate.toISOString().slice(0, 16) : "",
      category: schedule.category,
      liverName: schedule.liverName || "",
      liveAccount: (schedule as any).liveAccount || "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.startTime) {
      toast.error("タイトルと開始時間は必須です");
      return;
    }
    if (!formData.liveAccount) {
      toast.error("直播アカウントは必須です");
      return;
    }

    if (editingSchedule) {
      updateMutation.mutate({
        id: editingSchedule.id,
        title: formData.title,
        description: formData.description || undefined,
        startTime: formData.startTime,
        endTime: formData.endTime || undefined,
        category: formData.category,
        liverName: formData.liverName || undefined,
        liveAccount: formData.liveAccount,
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        description: formData.description || undefined,
        startTime: formData.startTime,
        endTime: formData.endTime || undefined,
        category: formData.category,
        liverName: formData.liverName || undefined,
        liveAccount: formData.liveAccount,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("この予定を削除しますか？")) {
      deleteMutation.mutate({ id });
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return days;
  }, [startDate, endDate]);

  // Group schedules by date (using JST timezone)
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    if (!schedules) return map;

    schedules.forEach((schedule) => {
      // Convert UTC time to JST for correct date grouping
      const jstDate = new Date(schedule.startTime);
      // Get the date in JST timezone
      const dateKey = jstDate.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD format
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(schedule as Schedule);
    });

    return map;
  }, [schedules]);

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">カレンダー</h1>
            <p className="text-muted-foreground">スケジュール管理</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/master/schedule-groups")}>
              <Settings className="mr-2 h-4 w-4" />
              グループ管理
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setSelectedDate(null); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  予定を追加
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSchedule ? "予定を編集" : "新しい予定"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">タイトル *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="配信予定"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">開始日時 *</Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          startTime: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">終了日時</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          endTime: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">カテゴリ</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        category: value as typeof formData.category,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery">配信</SelectItem>
                      <SelectItem value="meeting">ミーティング</SelectItem>
                      <SelectItem value="live">ライブ</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="liveAccount">直播アカウント *</Label>
                  <Input
                    id="liveAccount"
                    value={formData.liveAccount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        liveAccount: e.target.value,
                      }))
                    }
                    placeholder="直播アカウントを入力（必須）"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="liverName">ライバー名</Label>
                  <Input
                    id="liverName"
                    value={formData.liverName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        liverName: e.target.value,
                      }))
                    }
                    placeholder="ライバー名（任意）"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">説明</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="詳細説明（任意）"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingSchedule(null);
                      resetForm();
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingSchedule ? "更新" : "追加"}
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Calendar Navigation */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
                </h2>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={handleToday}>
                今日
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={`text-center text-sm font-medium py-2 ${
                    index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : ""
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const isToday = date.toDateString() === new Date().toDateString();
                // Use YYYY-MM-DD format in JST for matching with schedulesByDate
                const dateKey = date.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD format
                const daySchedules = schedulesByDate.get(dateKey) || [];
                const dayOfWeek = date.getDay();

                return (
                  <div
                    key={index}
                    className={`min-h-[100px] border rounded-lg p-1 cursor-pointer hover:bg-accent/50 transition-colors ${
                      !isCurrentMonth ? "opacity-40" : ""
                    } ${isToday ? "border-primary border-2" : ""}`}
                    onClick={() => handleDateClick(date)}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        dayOfWeek === 0
                          ? "text-red-500"
                          : dayOfWeek === 6
                          ? "text-blue-500"
                          : ""
                      } ${isToday ? "text-primary" : ""}`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`text-xs p-1 rounded truncate text-white ${
                            categoryColors[schedule.category]
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(schedule);
                            setIsAddDialogOpen(true);
                          }}
                        >
                          {formatTimeInJST(schedule.startTime)}{" "}
                          {schedule.title}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{daySchedules.length - 3}件
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              今日の予定
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Use YYYY-MM-DD format for today's date key
              const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
              const todaySchedules = schedulesByDate.get(todayKey) || [];
              if (todaySchedules.length === 0) {
                return (
                  <p className="text-muted-foreground text-center py-4">
                    今日の予定はありません
                  </p>
                );
              }
              return (
                <div className="space-y-3">
                  {todaySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            categoryColors[schedule.category]
                          }`}
                        />
                        <div>
                          <div className="font-medium">{schedule.title}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {formatTimeInJST(schedule.startTime)}
                            {schedule.endTime && (
                              <>
                                {" - "}
                                {formatTimeInJST(schedule.endTime)}
                              </>
                            )}
                            {schedule.liverName && (
                              <>
                                <User className="h-3 w-3 ml-2" />
                                {schedule.liverName}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {categoryLabels[schedule.category]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleEditClick(schedule);
                            setIsAddDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
