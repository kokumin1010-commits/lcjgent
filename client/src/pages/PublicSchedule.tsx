import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLiverToken, clearLiverToken } from "@/lib/liverAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, User, Plus, ChevronDown, ChevronLeft, ChevronRight, X, LogIn, LogOut, UserPlus, Settings, Check, List, LayoutGrid, CalendarDays } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// toJST removed - use Intl API with timeZone: 'Asia/Tokyo' instead

// Helper function to format time in JST
function formatTimeJST(date: Date): string {
  // Use toLocaleTimeString with Asia/Tokyo timezone for correct JST display
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

// Helper function to format time range in JST (start - end)
function formatTimeRangeJST(startDate: Date, endDate: Date | null): string {
  const startTime = formatTimeJST(startDate);
  if (!endDate) return startTime;
  const endTime = formatTimeJST(endDate);
  return `${startTime}-${endTime}`;
}

// Helper function to get JST date key using Intl API
function getJSTDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }); // YYYY-MM-DD format
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

// Liver colors for calendar display (expanded palette)
const liverColors = [
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", color: "#EC4899" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", color: "#8B5CF6" },
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", color: "#3B82F6" },
  { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", color: "#10B981" },
  { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", color: "#F59E0B" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", color: "#F97316" },
  { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", color: "#EF4444" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", color: "#14B8A6" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300", color: "#6366F1" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300", color: "#06B6D4" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300", color: "#F43F5E" },
  { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-300", color: "#84CC16" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", color: "#D97706" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", color: "#059669" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300", color: "#7C3AED" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-300", color: "#C026D3" },
  { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-300", color: "#0284C7" },
  { bg: "bg-stone-100", text: "text-stone-700", border: "border-stone-300", color: "#78716C" },
];

// Helper: Convert hex color to a light background style with matching text color
function hexToLiverColor(hex: string): typeof liverColors[0] {
  // Map known DB colors to appropriate Tailwind classes
  const colorMap: Record<string, typeof liverColors[0]> = {
    "#FF69B4": { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", color: "#EC4899" },
    "#EC4899": { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", color: "#EC4899" },
    "#9B59B6": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", color: "#9B59B6" },
    "#8B5CF6": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", color: "#8B5CF6" },
    "#9370DB": { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300", color: "#9370DB" },
    "#7C3AED": { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300", color: "#7C3AED" },
    "#3B82F6": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", color: "#3B82F6" },
    "#3498DB": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", color: "#3498DB" },
    "#10B981": { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", color: "#10B981" },
    "#32CD32": { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", color: "#32CD32" },
    "#1ABC9C": { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", color: "#1ABC9C" },
    "#14B8A6": { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300", color: "#14B8A6" },
    "#F59E0B": { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", color: "#F59E0B" },
    "#FFD700": { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", color: "#FFD700" },
    "#F1C40F": { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300", color: "#F1C40F" },
    "#F97316": { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", color: "#F97316" },
    "#E67E22": { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", color: "#E67E22" },
    "#EF4444": { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", color: "#EF4444" },
    "#059669": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", color: "#059669" },
  };
  const upper = hex.toUpperCase();
  return colorMap[upper] || { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", color: hex };
}

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
  brandId?: number | null;
  parentScheduleId?: number | null; // 繰り返し予定の親 ID
};

export default function PublicSchedule() {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  // Schedule group state
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Brand filter state
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);

  // Fetch schedule groups with members
  const { data: scheduleGroups } = trpc.scheduleGroup.listWithMembers.useQuery();

  // Fetch brands for filter tabs
  const { data: brandsData } = trpc.brand.list.useQuery();

  // Use auth from users table (same as management dashboard)
  const { user: adminUser, logout: adminLogout, loading: authLoading } = useAuth();
  
  // Liver authentication
  const liverToken = getLiverToken();
  const { data: liverData, isLoading: liverLoading } = trpc.liver.me.useQuery(
    undefined,
    { enabled: !!liverToken }
  );
  
  // Combined user (admin or liver)
  const user = adminUser || (liverData ? { name: liverData.name, email: liverData.email, id: liverData.id, role: 'liver' as const } : null);
  const isLiver = !adminUser && !!liverData;
  
  // Logout function that handles both admin and liver
  const logout = () => {
    if (isLiver) {
      clearLiverToken();
      window.location.reload();
    } else {
      adminLogout();
    }
  };
  
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
    // ブランド選択
    brandId: undefined as number | undefined,
    // 繰り返し設定
    repeatType: "none" as "none" | "weekly" | "monthly",
    repeatWeekdays: [] as number[], // 0=日, 1=月, ..., 6=土
    repeatUntil: "", // 繰り返し終了日
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

  // Fetch all liver names with DB colors (combines schedules + livers table)
  const { data: liverNamesWithColors } = trpc.schedule.getPublicLiverNamesWithColors.useQuery();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSchedule, setEditSchedule] = useState<{
    id: number;
    title: string;
    description: string;
    startDate: string; // YYYY-MM-DD形式
    endDate: string; // YYYY-MM-DD形式
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    category: "delivery" | "meeting" | "live" | "other";
    updateAll: boolean; // すべての繰り返しを更新するか
    isRecurring: boolean; // 繰り返し予定かどうか
  } | null>(null);

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

  // Update schedule mutation
  const updateScheduleMutation = trpc.schedule.publicUpdate.useMutation({
    onSuccess: () => {
      toast.success("スケジュールを更新しました");
      setSelectedSchedule(null);
      setIsEditMode(false);
      setEditSchedule(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "スケジュールの更新に失敗しました");
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = trpc.schedule.publicDelete.useMutation({
    onSuccess: () => {
      toast.success("スケジュールを削除しました");
      setSelectedSchedule(null);
      setBottomSheetOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "スケジュールの削除に失敗しました");
    },
  });

  // Check if user can edit/delete this schedule
  const canEditSchedule = (schedule: Schedule) => {
    return user && schedule.liverName === user.name;
  };

  // Start editing a schedule
  const startEditSchedule = (schedule: Schedule) => {
    const startDate = new Date(schedule.startTime);
    const endDate = schedule.endTime ? new Date(schedule.endTime) : startDate;
    
    // JSTで日付を取得（YYYY-MM-DD形式）
    const startDateStr = startDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // sv-SEはYYYY-MM-DD形式
    const endDateStr = endDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    
    setEditSchedule({
      id: schedule.id,
      title: schedule.title,
      description: schedule.description || "",
      startDate: startDateStr,
      endDate: endDateStr,
      startTime: formatTimeJST(startDate),
      endTime: schedule.endTime ? formatTimeJST(endDate) : formatTimeJST(startDate),
      isAllDay: schedule.isAllDay || false,
      category: (schedule.category as "delivery" | "meeting" | "live" | "other") || "other",
      updateAll: false, // デフォルトはこの予定のみ
      isRecurring: !!schedule.parentScheduleId, // 繰り返し予定かどうか
    });
    setIsEditMode(true);
  };

  // Save edited schedule
  const saveEditSchedule = () => {
    if (!editSchedule || !selectedSchedule) return;
    
    // editScheduleの日付フィールドから日付を取得（ユーザーが編集可能）
    const [startYear, startMonth, startDay] = editSchedule.startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = editSchedule.endDate.split("-").map(Number);
    
    const [startHour, startMin] = editSchedule.startTime.split(":").map(Number);
    const [endHour, endMin] = editSchedule.endTime.split(":").map(Number);
    
    // Create UTC dates directly from JST input
    // JST is UTC+9, so we subtract 9 hours from the JST time to get UTC
    const startTimeUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHour - 9, startMin));
    const endTimeUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay, endHour - 9, endMin));
    
    updateScheduleMutation.mutate({
      id: editSchedule.id,
      title: editSchedule.title,
      description: editSchedule.description || undefined,
      startTime: startTimeUTC.toISOString(),
      endTime: endTimeUTC.toISOString(),
      isAllDay: editSchedule.isAllDay,
      category: editSchedule.category,
      updateAll: editSchedule.updateAll, // すべての繰り返しを更新するか
    });
  };

  // Delete schedule
  const handleDeleteSchedule = (schedule: Schedule) => {
    if (confirm("この予定を削除しますか？")) {
      deleteScheduleMutation.mutate({ id: schedule.id });
    }
  };

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
      brandId: undefined,
      repeatType: "none",
      repeatWeekdays: [],
      repeatUntil: "",
    });
    setShowDatePicker(false);
    setShowEndDatePicker(false);
    setAddModalEndDate("");
  };

  // Get unique liver names and assign colors from DB
  const liverColorMap = useMemo(() => {
    const map = new Map<string, typeof liverColors[0]>();
    
    // Collect all liver names and their DB colors
    const allNames = new Set<string>();
    const dbColorLookup = new Map<string, string>();
    
    // Primary source: getPublicLiverNamesWithColors (all livers from DB + schedules)
    if (liverNamesWithColors) {
      for (const liver of liverNamesWithColors) {
        allNames.add(liver.name);
        if (liver.color) {
          dbColorLookup.set(liver.name, liver.color);
        }
      }
    }
    
    // Fallback: existingLivers (schedule-based names only, no colors)
    if (existingLivers) {
      existingLivers.forEach(name => {
        if (name && name !== '未指定') allNames.add(name);
      });
    }
    
    // Also include any livers from current month schedules
    if (schedules) {
      schedules.forEach(s => {
        if (s.liverName) allNames.add(s.liverName);
      });
    }
    
    // Assign colors: use DB color if available, otherwise fallback to palette
    let fallbackIndex = 0;
    const sortedNames = Array.from(allNames).sort((a, b) => a.localeCompare(b, 'ja'));
    for (const name of sortedNames) {
      const dbColor = dbColorLookup.get(name);
      if (dbColor) {
        map.set(name, hexToLiverColor(dbColor));
      } else {
        map.set(name, liverColors[fallbackIndex % liverColors.length]);
        fallbackIndex++;
      }
    }
    
    return map;
  }, [schedules, liverNamesWithColors, existingLivers]);

  // Get selected group's member liver names
  const selectedGroupLiverNames = useMemo(() => {
    if (!selectedGroupId || !scheduleGroups) return null;
    const group = scheduleGroups.find(g => g.id === selectedGroupId);
    if (!group || !group.members) return null;
    return group.members.map(m => m.liverName);
  }, [selectedGroupId, scheduleGroups]);

  // Group schedules by date (JST) - 複数日予定は各日に展開
  const schedulesByDate = useMemo(() => {
    if (!schedules) return new Map<string, (Schedule & { isMultiDay?: boolean; isStart?: boolean; isEnd?: boolean; spanDays?: number })[]>();
    
    // Filter schedules by selected group (scheduleGroupId or liverName)
    let filteredSchedules = selectedGroupId
      ? schedules.filter(s => 
          // スケジュールにscheduleGroupIdが設定されている場合はそれでフィルタリング
          // または従来の方法（liverNameがグループメンバーに含まれる）でフィルタリング
          (s as any).scheduleGroupId === selectedGroupId ||
          (selectedGroupLiverNames && s.liverName && selectedGroupLiverNames.includes(s.liverName))
        )
      : schedules;

    // Filter by selected brand
    if (selectedBrandId) {
      filteredSchedules = filteredSchedules.filter(s => s.brandId === selectedBrandId);
    }
    
    const map = new Map<string, (Schedule & { isMultiDay?: boolean; isStart?: boolean; isEnd?: boolean; spanDays?: number })[]>();
    
    filteredSchedules.forEach((schedule) => {
      const startDate = new Date(schedule.startTime);
      const endDate = schedule.endTime ? new Date(schedule.endTime) : startDate;
      const startKey = getJSTDateKey(startDate);
      const endKey = getJSTDateKey(endDate);
      
      // 複数日にまたがる予定かどうか判定
      const isMultiDay = startKey !== endKey;
      
      if (!isMultiDay) {
        // 単日予定
        if (!map.has(startKey)) {
          map.set(startKey, []);
        }
        map.get(startKey)!.push({
          ...schedule,
          startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
          endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
          isMultiDay: false,
        } as Schedule & { isMultiDay: boolean });
      } else {
        // 複数日予定 - 各日に展開 (JSTで日付を取得)
        const startKeyStr = startDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        const endKeyStr = endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        const current = new Date(startKeyStr + 'T00:00:00');
        const end = new Date(endKeyStr + 'T00:00:00');
        
        const spanDays = Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        let dayIndex = 0;
        
        while (current <= end) {
          const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
          
          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          
          map.get(dateKey)!.push({
            ...schedule,
            startTime: schedule.startTime instanceof Date ? schedule.startTime.toISOString() : schedule.startTime,
            endTime: schedule.endTime instanceof Date ? schedule.endTime.toISOString() : schedule.endTime,
            isMultiDay: true,
            isStart: dayIndex === 0,
            isEnd: dayIndex === spanDays - 1,
            spanDays,
          } as Schedule & { isMultiDay: boolean; isStart: boolean; isEnd: boolean; spanDays: number });
          
          current.setDate(current.getDate() + 1);
          dayIndex++;
        }
      }
    });
    
    // Sort schedules within each day by start time
    map.forEach((daySchedules) => {
      daySchedules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
    
    return map;
  }, [schedules, selectedGroupLiverNames, selectedBrandId]);

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

  // Generate dates for repeat schedules
  const generateRepeatDates = (startDate: string, repeatType: string, repeatWeekdays: number[], repeatUntil: string): string[] => {
    const dates: string[] = [startDate];
    if (repeatType === "none" || !repeatUntil) return dates;
    
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = repeatUntil.split("-").map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    if (repeatType === "weekly" && repeatWeekdays.length > 0) {
      // Generate weekly repeats for selected weekdays
      const current = new Date(start);
      current.setDate(current.getDate() + 1); // Start from next day
      
      while (current <= end) {
        if (repeatWeekdays.includes(current.getDay())) {
          const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
          if (!dates.includes(dateKey)) {
            dates.push(dateKey);
          }
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (repeatType === "monthly") {
      // Generate monthly repeats on the same day
      const current = new Date(start);
      current.setMonth(current.getMonth() + 1);
      
      while (current <= end) {
        const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
        dates.push(dateKey);
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    return dates;
  };

  // Handle add schedule submit
  const handleAddSchedule = async () => {
    if (!addModalDate) return;
    
    if (!newSchedule.title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    
    // 繰り返し設定の場合、繰り返し終了日が必須
    if (newSchedule.repeatType !== "none" && !newSchedule.repeatUntil) {
      toast.error("繰り返し終了日を設定してください");
      return;
    }
    
    // 毎週の場合、曜日選択が必須
    if (newSchedule.repeatType === "weekly" && newSchedule.repeatWeekdays.length === 0) {
      toast.error("繰り返す曜日を選択してください");
      return;
    }
    
    const [startHour, startMinute] = newSchedule.startTime.split(":").map(Number);
    const [endHour, endMinute] = newSchedule.endTime.split(":").map(Number);
    
    // Generate all dates for repeat schedules
    const allDates = generateRepeatDates(
      addModalDate,
      newSchedule.repeatType,
      newSchedule.repeatWeekdays,
      newSchedule.repeatUntil
    );
    
    // Create schedules for all dates
    for (const dateStr of allDates) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const endDateStr = addModalEndDate || dateStr;
      const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
      
      // For repeat schedules, end date is same as start date
      const actualEndDate = newSchedule.repeatType !== "none" ? dateStr : endDateStr;
      const [actualEndYear, actualEndMonth, actualEndDay] = actualEndDate.split("-").map(Number);
      
      // Create UTC dates directly from JST input
      // JST is UTC+9, so we subtract 9 hours from the JST time to get UTC
      const startTimeUTC = newSchedule.isAllDay 
        ? new Date(Date.UTC(year, month - 1, day, 0 - 9, 0))
        : new Date(Date.UTC(year, month - 1, day, startHour - 9, startMinute));
      const endTimeUTC = newSchedule.isAllDay
        ? new Date(Date.UTC(actualEndYear, actualEndMonth - 1, actualEndDay, 23 - 9, 59))
        : new Date(Date.UTC(actualEndYear, actualEndMonth - 1, actualEndDay, endHour - 9, endMinute));
      
      // 選択中のグループの最初のメンバー名を使用、またはユーザー名、または未指定
      const defaultLiverName = selectedGroupLiverNames?.[0] || user?.name || "未指定";
      
      await createScheduleMutation.mutateAsync({
        title: newSchedule.title,
        description: newSchedule.description || undefined,
        startTime: startTimeUTC.toISOString(),
        endTime: endTimeUTC.toISOString(),
        category: newSchedule.category,
        liverName: defaultLiverName,
        scheduleGroupId: selectedGroupId || undefined, // 選択中のグループIDを送信
        brandId: newSchedule.brandId, // ブランドIDを送信
      });
    }
    
    if (allDates.length > 1) {
      toast.success(`${allDates.length}件のスケジュールを追加しました`);
    }
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
                  {isLiver && <p className="text-xs text-pink-500">ライバー</p>}
                </div>
                <DropdownMenuSeparator />
                {isLiver && (
                  <DropdownMenuItem onClick={() => navigate("/liver/mypage")}>
                    <User className="h-4 w-4 mr-2" />
                    マイページ
                  </DropdownMenuItem>
                )}
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
                  管理者ログイン
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/liver/login")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  ライバーログイン
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/liver/register")}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  ライバー新規登録
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Navigation + View Mode Toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (viewMode === 'month') goToPrevMonth();
              else if (viewMode === 'week') {
                const prev = new Date(currentWeekStart);
                prev.setDate(prev.getDate() - 7);
                setCurrentWeekStart(prev);
              } else {
                goToPrevMonth();
              }
            }}
            className="p-1.5 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <button 
            onClick={() => {
              const now = new Date();
              setCurrentDate(now);
              const day = now.getDay();
              const diff = day === 0 ? 6 : day - 1;
              const monday = new Date(now);
              monday.setDate(now.getDate() - diff);
              monday.setHours(0, 0, 0, 0);
              setCurrentWeekStart(monday);
            }}
            className="px-3 py-1 text-sm text-blue-500 font-medium rounded-full hover:bg-blue-50"
          >
            今日
          </button>
          <button 
            onClick={() => {
              if (viewMode === 'month') goToNextMonth();
              else if (viewMode === 'week') {
                const next = new Date(currentWeekStart);
                next.setDate(next.getDate() + 7);
                setCurrentWeekStart(next);
              } else {
                goToNextMonth();
              }
            }}
            className="p-1.5 rounded-full hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === 'month' ? "bg-white shadow-sm" : "hover:bg-gray-200"
            )}
            title="月表示"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === 'week' ? "bg-white shadow-sm" : "hover:bg-gray-200"
            )}
            title="週表示"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === 'list' ? "bg-white shadow-sm" : "hover:bg-gray-200"
            )}
            title="リスト表示"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Schedule Group Tabs */}
      {scheduleGroups && scheduleGroups.length > 0 && (
        <div className="border-b">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-1 p-2">
              {/* All schedules tab */}
              <button
                onClick={() => setSelectedGroupId(null)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  selectedGroupId === null
                    ? "bg-pink-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Check className={cn("h-4 w-4", selectedGroupId === null ? "opacity-100" : "opacity-0")} />
                すべて
              </button>
              {/* Group tabs */}
              {scheduleGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    selectedGroupId === group.id
                      ? "text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                  style={selectedGroupId === group.id ? { backgroundColor: group.color || '#3B82F6' } : undefined}
                >
                  {group.icon && <span>{group.icon}</span>}
                  {group.name}
                </button>
              ))}
              {/* Settings button for admin */}
              {adminUser && (
                <button
                  onClick={() => navigate("/master/schedule-groups")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Brand Filter Tabs - only show if any schedule has a brand */}
      {brandsData && brandsData.length > 0 && (schedules ?? []).some(s => s.brandId) && (
        <div className="border-b bg-gray-50/50">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-1 p-2">
              {/* All brands tab */}
              <button
                onClick={() => setSelectedBrandId(null)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  selectedBrandId === null
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                )}
              >
                <Check className={cn("h-3.5 w-3.5", selectedBrandId === null ? "opacity-100" : "opacity-0")} />
                全ブランド
              </button>
              {/* Brand tabs - only show brands that have schedules */}
              {brandsData
                .filter((brand: any) => (schedules ?? []).some(s => s.brandId === brand.id))
                .map((brand: any) => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    selectedBrandId === brand.id
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  {brand.logoUrl && (
                    <img src={brand.logoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                  )}
                  {brand.name || brand.brandName}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* === MONTH VIEW === */}
      {viewMode === 'month' && (
        <>
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

          {/* Calendar Grid - Improved */}
          <div className="flex-1">
            {calendarWeeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 border-b" style={{ minHeight: '100px' }}>
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
                        "border-r last:border-r-0 p-0.5 cursor-pointer hover:bg-gray-50 transition-colors",
                        !isCurrentMonth && "bg-gray-50/50",
                        isSelected && "bg-blue-50"
                      )}
                      onClick={() => handleDateClick(dateKey, isCurrentMonth)}
                    >
                      {/* Date number */}
                      <div className="flex justify-center mb-0.5">
                        <span
                          className={cn(
                            "w-6 h-6 flex items-center justify-center text-xs rounded-full",
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
                      
                      {/* Schedule bars - improved with liver name */}
                      <div className="space-y-px">
                        {daySchedules.slice(0, 4).map((schedule: Schedule & { isMultiDay?: boolean; isStart?: boolean; isEnd?: boolean }) => {
                          const liverColor = schedule.liverName 
                            ? liverColorMap.get(schedule.liverName) 
                            : categoryColors[schedule.category || "other"];
                          
                          const isMultiDay = schedule.isMultiDay;
                          const isStart = schedule.isStart;
                          const isEnd = schedule.isEnd;
                          const timeStr = formatTimeJST(new Date(schedule.startTime));
                          const liverInitial = schedule.liverName ? schedule.liverName.charAt(0) : '';
                          
                          return (
                            <div
                              key={`${schedule.id}-${dateKey}`}
                              className={cn(
                                "text-[10px] leading-tight py-0.5 truncate flex items-center gap-0.5",
                                liverColor?.bg || "bg-gray-100",
                                liverColor?.text || "text-gray-700",
                                isMultiDay ? [
                                  "relative",
                                  isStart ? "rounded-l pl-0.5 -mr-0.5" : "-mx-0.5",
                                  isEnd ? "rounded-r pr-0.5 -ml-0.5" : "-mx-0.5",
                                  !isStart && !isEnd && "-mx-0.5",
                                ] : "rounded px-0.5"
                              )}
                            >
                              {isMultiDay && !isStart ? (
                                <span className="opacity-0">&nbsp;</span>
                              ) : (
                                <>
                                  {!schedule.isAllDay && !isMultiDay && (
                                    <span className="opacity-70 shrink-0">{timeStr}</span>
                                  )}
                                  {schedule.liverName && (
                                    <span className="font-bold shrink-0">{liverInitial}</span>
                                  )}
                                  <span className="truncate">{schedule.title}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                        {daySchedules.length > 4 && (
                          <div className="text-[10px] text-gray-400 px-0.5 text-center">
                            +{daySchedules.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Liver Legend */}
          {liverColorMap.size > 0 && (
            <div className="px-3 py-2 border-t bg-gray-50/50">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Array.from(liverColorMap.entries()).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.color }} />
                    <span className="text-[10px] text-gray-600">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* === WEEK VIEW === */}
      {viewMode === 'week' && (
        <>
          {/* Weekday Headers with dates */}
          <div className="grid grid-cols-7 border-b">
            {["月", "火", "水", "木", "金", "土", "日"].map((day, i) => {
              const d = new Date(currentWeekStart);
              d.setDate(d.getDate() + i);
              const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const isToday = dateKey === todayKey;
              return (
                <div key={day} className="text-center py-1.5 border-r last:border-r-0">
                  <div className={cn("text-[10px] font-medium", i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-gray-500")}>{day}</div>
                  <div className={cn(
                    "w-7 h-7 mx-auto flex items-center justify-center text-sm rounded-full",
                    isToday && "bg-blue-500 text-white font-bold"
                  )}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Week Grid - taller cells */}
          <div className="grid grid-cols-7 flex-1" style={{ minHeight: '400px' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const d = new Date(currentWeekStart);
              d.setDate(d.getDate() + i);
              const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const daySchedules = schedulesByDate.get(dateKey) || [];
              const isToday = dateKey === todayKey;
              
              return (
                <div
                  key={i}
                  className={cn(
                    "border-r last:border-r-0 border-b p-1 cursor-pointer hover:bg-gray-50",
                    isToday && "bg-blue-50/30"
                  )}
                  onClick={() => { setSelectedDate(dateKey); setBottomSheetOpen(true); }}
                >
                  <div className="space-y-0.5">
                    {daySchedules.map((schedule) => {
                      const liverColor = schedule.liverName 
                        ? liverColorMap.get(schedule.liverName) 
                        : categoryColors[schedule.category || "other"];
                      return (
                        <div
                          key={`${schedule.id}-${dateKey}`}
                          className={cn(
                            "text-[10px] leading-snug py-0.5 px-1 rounded truncate",
                            liverColor?.bg || "bg-gray-100",
                            liverColor?.text || "text-gray-700"
                          )}
                        >
                          <div className="truncate">
                            {!schedule.isAllDay && (
                              <span className="opacity-70">{formatTimeJST(new Date(schedule.startTime))} </span>
                            )}
                            <span className="font-medium">{schedule.title}</span>
                          </div>
                          {schedule.liverName && (
                            <div className="text-[9px] opacity-70 truncate">{schedule.liverName}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Liver Legend */}
          {liverColorMap.size > 0 && (
            <div className="px-3 py-2 border-t bg-gray-50/50">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Array.from(liverColorMap.entries()).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.color }} />
                    <span className="text-[10px] text-gray-600">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* === LIST VIEW === */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {(() => {
            // Generate all dates for current month
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const dates: string[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
              dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
            }
            
            // Only show dates that have schedules
            const datesWithSchedules = dates.filter(dk => (schedulesByDate.get(dk) || []).length > 0);
            
            if (datesWithSchedules.length === 0) {
              return (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  この月の予定はありません
                </div>
              );
            }
            
            return datesWithSchedules.map((dateKey) => {
              const daySchedules = schedulesByDate.get(dateKey) || [];
              const [, , dayStr] = dateKey.split("-");
              const dateObj = new Date(dateKey + 'T00:00:00');
              const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
              const dayOfWeek = dateObj.getDay();
              const isToday = dateKey === todayKey;
              
              return (
                <div key={dateKey} className="border-b">
                  {/* Date header */}
                  <div className={cn(
                    "sticky top-0 px-4 py-2 flex items-center gap-2",
                    isToday ? "bg-blue-50" : "bg-gray-50"
                  )}>
                    <span className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold",
                      isToday && "bg-blue-500 text-white",
                      !isToday && dayOfWeek === 0 && "text-red-500",
                      !isToday && dayOfWeek === 6 && "text-blue-500"
                    )}>
                      {parseInt(dayStr)}
                    </span>
                    <span className={cn(
                      "text-sm font-medium",
                      dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-gray-700"
                    )}>
                      {weekdays[dayOfWeek]}
                    </span>
                    <span className="text-xs text-gray-400">{daySchedules.length}件</span>
                  </div>
                  
                  {/* Schedules */}
                  <div className="px-4 py-1">
                    {daySchedules.map((schedule) => {
                      const liverColor = schedule.liverName 
                        ? liverColorMap.get(schedule.liverName) 
                        : categoryColors[schedule.category || "other"];
                      return (
                        <div
                          key={`${schedule.id}-${dateKey}`}
                          className="flex items-center gap-3 py-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2"
                          onClick={() => { setSelectedDate(dateKey); setSelectedSchedule(schedule); }}
                        >
                          {/* Time */}
                          <div className="w-14 text-right text-xs text-gray-500 shrink-0">
                            {schedule.isAllDay ? "終日" : formatTimeJST(new Date(schedule.startTime))}
                          </div>
                          
                          {/* Color bar */}
                          <div 
                            className="w-1 self-stretch rounded-full min-h-[36px] shrink-0"
                            style={{ backgroundColor: liverColor?.color || "#6B7280" }}
                          />
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">{schedule.title}</div>
                            {schedule.liverName && (
                              <div className="text-xs text-gray-500 truncate">{schedule.liverName}</div>
                            )}
                          </div>
                          
                          {/* Liver avatar */}
                          {schedule.liverName && (
                            <div 
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: liverColor?.color || "#6B7280" }}
                            >
                              {schedule.liverName.charAt(0)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

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
                      <div className="w-20 text-right text-sm text-gray-500 pt-0.5">
                        {schedule.isAllDay 
                          ? "終日" 
                          : formatTimeRangeJST(
                              new Date(schedule.startTime), 
                              schedule.endTime ? new Date(schedule.endTime) : null
                            )
                        }
                      </div>
                      
                      {/* Vertical line */}
                      <div 
                        className="w-1 self-stretch rounded-full min-h-[40px]"
                        style={{ backgroundColor: liverColor?.color || "#6B7280" }}
                      />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{schedule.title}</h3>
                        {schedule.liverName && (
                          <p className="text-sm text-gray-500 truncate">{schedule.liverName}</p>
                        )}
                        {schedule.description && (
                          <p className="text-xs text-gray-400 truncate">{schedule.description}</p>
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

                {/* Edit/Delete Buttons - Only show for own schedules */}
                {canEditSchedule(selectedSchedule) && !isEditMode && (
                  <div className="pt-4 border-t flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => startEditSchedule(selectedSchedule)}
                    >
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => handleDeleteSchedule(selectedSchedule)}
                      disabled={deleteScheduleMutation.isPending}
                    >
                      {deleteScheduleMutation.isPending ? "削除中..." : "削除"}
                    </Button>
                  </div>
                )}

                {/* Edit Form */}
                {isEditMode && editSchedule && (
                  <div className="pt-4 border-t space-y-4">
                    <div>
                      <label className="text-sm text-gray-500">タイトル</label>
                      <Input
                        value={editSchedule.title}
                        onChange={(e) => setEditSchedule(prev => prev ? { ...prev, title: e.target.value } : null)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">終日</span>
                      <Switch
                        checked={editSchedule.isAllDay}
                        onCheckedChange={(checked) => setEditSchedule(prev => prev ? { ...prev, isAllDay: checked } : null)}
                      />
                    </div>
                    
                    {/* 日付選択 */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-sm text-gray-500">開始日</label>
                        <Input
                          type="date"
                          value={editSchedule.startDate}
                          onChange={(e) => setEditSchedule(prev => prev ? { ...prev, startDate: e.target.value } : null)}
                          className="mt-1"
                        />
                      </div>
                      <span className="text-gray-400 pt-5">～</span>
                      <div className="flex-1">
                        <label className="text-sm text-gray-500">終了日</label>
                        <Input
                          type="date"
                          value={editSchedule.endDate}
                          onChange={(e) => setEditSchedule(prev => prev ? { ...prev, endDate: e.target.value } : null)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    {!editSchedule.isAllDay && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-sm text-gray-500">開始時刻</label>
                          <Input
                            type="time"
                            value={editSchedule.startTime}
                            onChange={(e) => setEditSchedule(prev => prev ? { ...prev, startTime: e.target.value } : null)}
                            className="mt-1"
                          />
                        </div>
                        <span className="text-gray-400 pt-5">～</span>
                        <div className="flex-1">
                          <label className="text-sm text-gray-500">終了時刻</label>
                          <Input
                            type="time"
                            value={editSchedule.endTime}
                            onChange={(e) => setEditSchedule(prev => prev ? { ...prev, endTime: e.target.value } : null)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm text-gray-500">メモ</label>
                      <Textarea
                        value={editSchedule.description}
                        onChange={(e) => setEditSchedule(prev => prev ? { ...prev, description: e.target.value } : null)}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    
                    {/* 繰り返し予定の場合のみ表示 */}
                    {editSchedule.isRecurring && (
                      <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                        <p className="text-sm text-pink-700 mb-2 font-medium">繰り返し予定の更新範囲</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditSchedule(prev => prev ? { ...prev, updateAll: false } : null)}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                              !editSchedule.updateAll
                                ? "bg-pink-500 text-white"
                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            この予定のみ
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSchedule(prev => prev ? { ...prev, updateAll: true } : null)}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                              editSchedule.updateAll
                                ? "bg-pink-500 text-white"
                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            すべての繰り返し
                          </button>
                        </div>
                        {editSchedule.updateAll && (
                          <p className="text-xs text-pink-600 mt-2">
                            ※ タイトル、メモ、カテゴリ、終日設定が全ての繰り返しに適用されます
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setIsEditMode(false);
                          setEditSchedule(null);
                        }}
                      >
                        キャンセル
                      </Button>
                      <Button
                        className="flex-1 bg-pink-500 hover:bg-pink-600"
                        onClick={saveEditSchedule}
                        disabled={updateScheduleMutation.isPending}
                      >
                        {updateScheduleMutation.isPending ? "保存中..." : "保存"}
                      </Button>
                    </div>
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
          
          {/* Repeat Settings */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700">繰り返し</span>
              <Select
                value={newSchedule.repeatType}
                onValueChange={(value: "none" | "weekly" | "monthly") => 
                  setNewSchedule(prev => ({ ...prev, repeatType: value, repeatWeekdays: [] }))
                }
              >
                <SelectTrigger className="w-32 border-0 p-0 h-auto focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし</SelectItem>
                  <SelectItem value="weekly">毎週</SelectItem>
                  <SelectItem value="monthly">毎月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Weekday Selection for Weekly Repeat */}
            {newSchedule.repeatType === "weekly" && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-2">繰り返す曜日</p>
                <div className="flex gap-2">
                  {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
                    <button
                      key={day}
                      onClick={() => {
                        const weekdays = newSchedule.repeatWeekdays.includes(index)
                          ? newSchedule.repeatWeekdays.filter(d => d !== index)
                          : [...newSchedule.repeatWeekdays, index];
                        setNewSchedule(prev => ({ ...prev, repeatWeekdays: weekdays }));
                      }}
                      className={cn(
                        "w-8 h-8 rounded-full text-sm font-medium transition-colors",
                        newSchedule.repeatWeekdays.includes(index)
                          ? "bg-pink-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        index === 0 && "text-red-500",
                        index === 6 && "text-blue-500"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Repeat Until Date */}
            {newSchedule.repeatType !== "none" && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-2">繰り返し終了日</p>
                <Input
                  type="date"
                  value={newSchedule.repeatUntil}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, repeatUntil: e.target.value }))}
                  min={addModalDate}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          {/* Brand Selection */}
          {brandsData && brandsData.length > 0 && (
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <Select
                  value={newSchedule.brandId?.toString() || "none"}
                  onValueChange={(value) => setNewSchedule(prev => ({ ...prev, brandId: value === "none" ? undefined : Number(value) }))}
                >
                  <SelectTrigger className="border-0 p-0 h-auto focus:ring-0 flex-1">
                    <SelectValue placeholder="ブランドを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ブランドなし</SelectItem>
                    {brandsData.map((brand: any) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name || brand.brandName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
