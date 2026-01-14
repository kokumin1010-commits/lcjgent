import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ClipboardList, Clock, CheckCircle2, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.statistics.useQuery();
  const { data: staffList } = trpc.staff.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const taskStats = stats?.stats || { total: 0, pending: 0, inProgress: 0, completed: 0 };
  const avgTime = stats?.avgCompletionTime || 0;
  const avgHours = (avgTime / (1000 * 60 * 60)).toFixed(1);

  return (
    <div className="space-y-6 relative">
      {/* Floating Action Button for Mobile */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setLocation("/tasks/create")}
      >
        <Plus className="h-6 w-6" />
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          業務自動化システムの概要を確認できます
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総タスク数</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">登録されたタスクの総数</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => setLocation("/tasks?status=in_progress")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">現在進行中のタスク</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => setLocation("/tasks?status=completed")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">完了したタスク</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">担当者一覧</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {staffList && staffList.length > 0 ? (
              <div className="space-y-2 max-h-[120px] overflow-y-auto">
                {staffList.slice(0, 3).map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setLocation(`/tasks/staff/${staff.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{staff.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{staff.department || "部署未設定"}</p>
                    </div>
                  </div>
                ))}
                {staffList.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setLocation("/staff")}
                  >
                    すべて表示 ({staffList.length}人)
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">担当者が登録されていません</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>最近完了したタスク</CardTitle>
            <CardDescription>直近で完了したタスクの一覧</CardDescription>
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
                        担当: {item.staff?.name || "不明"}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-2 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">完了したタスクはまだありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
