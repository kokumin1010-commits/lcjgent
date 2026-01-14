import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const statusColors = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-500",
};

const statusLabels = {
  pending: "保留中",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "キャンセル",
};

export default function StaffTasks() {
  const [, params1] = useRoute("/staff/:staffId/tasks");
  const [, params2] = useRoute("/tasks/staff/:staffId");
  const [, setLocation] = useLocation();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const params = params1 || params2;
  const staffId = params?.staffId ? parseInt(params.staffId) : 0;

  const { data: tasksData, isLoading: tasksLoading } = trpc.task.listByStaffId.useQuery(
    { staffId },
    { enabled: staffId > 0 }
  );

  const { data: staffData, isLoading: staffLoading } = trpc.staff.getById.useQuery(
    { id: staffId },
    { enabled: staffId > 0 }
  );

  if (tasksLoading || staffLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staffData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">担当者が見つかりません</p>
        <Button onClick={() => setLocation("/tasks")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          タスク一覧に戻る
        </Button>
      </div>
    );
  }

  // Filter tasks by status
  const filteredTasks = tasksData?.filter((item) => {
    if (selectedStatus === "all") return true;
    return item.task.status === selectedStatus;
  });

  // Calculate statistics
  const totalTasks = tasksData?.length || 0;
  const completedTasks =
    tasksData?.filter((item) => item.task.status === "completed").length || 0;
  const inProgressTasks =
    tasksData?.filter((item) => item.task.status === "in_progress").length || 0;
  const pendingTasks =
    tasksData?.filter((item) => item.task.status === "pending").length || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/tasks")}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            タスク一覧に戻る
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {staffData.name} のタスク履歴
          </h1>
          <div className="text-muted-foreground mt-2 space-y-1">
            {staffData.department && (
              <p>{staffData.department}</p>
            )}
            <p>{staffData.email}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              総タスク数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              進行中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              保留中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              完了
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              完了率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>ステータス</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="全ステータス" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ステータス</SelectItem>
                  <SelectItem value="pending">保留中</SelectItem>
                  <SelectItem value="in_progress">進行中</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedStatus !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStatus("all")}
                className="mt-8"
              >
                フィルターをクリア
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>
            タスク一覧 ({filteredTasks?.length || 0}件)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks && filteredTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredTasks.map((item) => (
                <div
                  key={item.task.id}
                  className="p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/tasks/${item.task.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${statusColors[item.task.status]} text-white`}
                        >
                          {statusLabels[item.task.status]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.task.taskId}
                        </span>
                      </div>
                      <p className="font-medium">{item.task.taskDetail}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          登録:{" "}
                          {item.task.startDate
                            ? new Date(item.task.startDate).toLocaleString("ja-JP", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "不明"}
                        </span>
                        {item.task.deadline && (
                          <span>
                            期限:{" "}
                            {new Date(item.task.deadline).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </span>
                        )}
                        {item.task.completedAt && (
                          <span className="text-green-600">
                            完了:{" "}
                            {new Date(item.task.completedAt).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[200px]">
              <p className="text-muted-foreground">タスクが見つかりません</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
