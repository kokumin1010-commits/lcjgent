/**
 * 跟進提醒パネル - 今日・未来7日・期限切れの跟進タスクを表示
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CalendarDays,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

const INTENT_LEVEL_LABELS: Record<string, string> = { high: "高意向", normal: "普通", dormant: "休眠" };
const CLIENT_VALUE_LABELS: Record<string, string> = { high: "高价值", medium: "中价值", low: "低价值" };

export function FollowRemindersPanel() {
  const { data: overdueData, isLoading: loadingOverdue } = trpc.recruitment.getFollowReminders.useQuery({ range: "overdue" });
  const { data: todayData, isLoading: loadingToday } = trpc.recruitment.getFollowReminders.useQuery({ range: "today" });
  const { data: weekData, isLoading: loadingWeek } = trpc.recruitment.getFollowReminders.useQuery({ range: "week" });
  const [expandedSection, setExpandedSection] = useState<string>("overdue");

  const isLoading = loadingOverdue || loadingToday || loadingWeek;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-400">加载跟进提醒...</span>
      </div>
    );
  }

  const overdue = overdueData || [];
  const today = todayData || [];
  const upcoming = weekData || [];

  const sections = [
    {
      key: "overdue",
      title: "已逾期",
      icon: <AlertCircle className="w-4 h-4 text-red-400" />,
      items: overdue,
      color: "border-red-500/30 bg-red-900/10",
      badgeColor: "bg-red-600",
      emptyText: "没有逾期的跟进任务",
    },
    {
      key: "today",
      title: "今日待跟进",
      icon: <Clock className="w-4 h-4 text-yellow-400" />,
      items: today,
      color: "border-yellow-500/30 bg-yellow-900/10",
      badgeColor: "bg-yellow-600",
      emptyText: "今日没有待跟进任务",
    },
    {
      key: "upcoming",
      title: "未来7天",
      icon: <CalendarDays className="w-4 h-4 text-blue-400" />,
      items: upcoming,
      color: "border-blue-500/30 bg-blue-900/10",
      badgeColor: "bg-blue-600",
      emptyText: "未来7天没有跟进任务",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-300">已逾期</span>
          </div>
          <div className="text-3xl font-bold text-red-400">{overdue.length}</div>
        </div>
        <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-gray-300">今日待跟进</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{today.length}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-300">未来7天</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{upcoming.length}</div>
        </div>
      </div>

      {/* Sections */}
      {sections.map(({ key, title, icon, items, color, badgeColor, emptyText }) => (
        <div key={key} className={`border rounded-xl ${color}`}>
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setExpandedSection(expandedSection === key ? "" : key)}
          >
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-bold text-white">{title}</span>
              <Badge className={`${badgeColor} text-white text-xs`}>{items.length}</Badge>
            </div>
            {expandedSection === key ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === key && (
            <div className="px-4 pb-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">{emptyText}</div>
              ) : (
                items.map((item: any) => (
                  <div key={item.id} className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm">{item.brandName}</span>
                        {item.intentLevel && (
                          <Badge className={`text-[10px] ${item.intentLevel === 'high' ? 'bg-green-600' : item.intentLevel === 'dormant' ? 'bg-gray-600' : 'bg-blue-600'} text-white`}>
                            {INTENT_LEVEL_LABELS[item.intentLevel]}
                          </Badge>
                        )}
                        {item.clientValue && (
                          <Badge className={`text-[10px] ${item.clientValue === 'high' ? 'bg-yellow-600' : 'bg-gray-600'} text-white`}>
                            {CLIENT_VALUE_LABELS[item.clientValue]}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>负责人: {item.personInChargeName || "未指定"}</span>
                        <span>跟进日期: {item.nextFollowDate ? new Date(item.nextFollowDate).toLocaleDateString("zh-CN") : "-"}</span>
                        {item.nextFollowAction && <span>内容: {item.nextFollowAction}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
