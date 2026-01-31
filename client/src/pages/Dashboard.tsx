import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ClipboardList, Clock, CheckCircle2, Users, Plus, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.statistics.useQuery();
  const { data: staffWithCounts } = trpc.dashboard.staffWithTaskCounts.useQuery();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const taskStats = stats?.stats || { total: 0, pending: 0, inProgress: 0, completed: 0 };

  return (
    <div className="space-y-6 relative">
      {/* Floating Action Button for Mobile */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setLocation("/master/tasks/create")}
      >
        <Plus className="h-6 w-6" />
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("dashboard.title")}
        </p>
      </div>

      {/* Daily Report Button */}
      <Button
        size="lg"
        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md"
        onClick={() => setLocation("/master/reports/chat")}
      >
        <FileText className="h-5 w-5 mr-2" />
        {t("dashboard.dailyReport")}
      </Button>

      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("tasks.all")}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total}</div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => setLocation("/master/tasks?status=in_progress")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.inProgress")}</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{taskStats.inProgress}</div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => setLocation("/master/tasks?status=completed")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.completed")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{taskStats.completed}</div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors border-red-200"
          onClick={() => setLocation("/master/tasks?overdue=true")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.overdue")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.overdueTasks?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-medium">{t("dashboard.staffList")}</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {staffWithCounts && staffWithCounts.length > 0 ? (
              <div className="space-y-2">
                {staffWithCounts.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setLocation(`/tasks/staff/${staff.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{staff.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{staff.department || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {staff.overdueCount > 0 && (
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold">
                          {staff.overdueCount}
                        </div>
                      )}
                      {staff.inProgressCount > 0 && (
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                          {staff.inProgressCount}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("staffMgmt.noStaff")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        {stats?.overdueTasks && stats.overdueTasks.length > 0 && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-red-700 dark:text-red-400">{t("dashboard.overdue")}</CardTitle>
              </div>
              <CardDescription className="text-red-600 dark:text-red-300">
                {stats.overdueTasks.length} {t("tasks.results")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.overdueTasks.slice(0, 5).map((item) => {
                  const deadline = typeof item.task.deadline === 'string' ? new Date(item.task.deadline).getTime() : Number(item.task.deadline || 0);
                  const daysOverdue = Math.floor(
                    (Date.now() - deadline) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={item.task.id}
                      className="flex items-start justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      onClick={() => setLocation(`/tasks/${item.task.id}`)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-2">{item.task.taskDetail}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{t("tasks.staff")}: {item.staff?.name || "-"}</span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {daysOverdue} days
                          </span>
                        </div>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-500 ml-2 flex-shrink-0" />
                    </div>
                  );
                })}
                {stats.overdueTasks.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => setLocation("/master/tasks")}
                  >
                    {t("dashboard.viewAll")} ({stats.overdueTasks.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentTasks")}</CardTitle>
            <CardDescription>{t("dashboard.completed")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentCompleted && stats.recentCompleted.length > 0 ? (
              <div className="space-y-3">
                {stats.recentCompleted.map((item) => (
                  <div
                    key={item.task.id}
                    className="flex items-start justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">{item.task.taskDetail}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("tasks.staff")}: {item.staff?.name || "-"}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-2 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
