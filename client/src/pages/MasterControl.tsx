import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { useLocation } from "wouter";
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

export default function MasterControl() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { data: allTasksData, isLoading } = trpc.task.listAllWithUsers.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Extract unique users and staff
  const uniqueUsers = Array.from(
    new Set(allTasksData?.map((item) => item.user?.email).filter(Boolean))
  );
  const uniqueStaff = Array.from(
    new Set(allTasksData?.map((item) => item.staff?.name).filter(Boolean))
  );

  // Filter tasks
  const filteredTasks = allTasksData?.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.task.taskDetail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.staff?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user?.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUser =
      selectedUser === "all" || item.user?.email === selectedUser;

    const matchesStaff =
      selectedStaff === "all" || item.staff?.name === selectedStaff;

    const matchesStatus =
      selectedStatus === "all" || item.task.status === selectedStatus;

    return matchesSearch && matchesUser && matchesStaff && matchesStatus;
  });

  // Calculate statistics
  const totalTasks = allTasksData?.length || 0;
  const completedTasks =
    allTasksData?.filter((item) => item.task.status === "completed").length || 0;
  const inProgressTasks =
    allTasksData?.filter((item) => item.task.status === "in_progress").length || 0;
  const pendingTasks =
    allTasksData?.filter((item) => item.task.status === "pending").length || 0;

  // User statistics
  const userStats = uniqueUsers.map((userEmail) => {
    const userTasks = allTasksData?.filter(
      (item) => item.user?.email === userEmail
    );
    return {
      email: userEmail,
      total: userTasks?.length || 0,
      completed:
        userTasks?.filter((item) => item.task.status === "completed").length || 0,
    };
  });

  // Staff statistics
  const staffStats = uniqueStaff.map((staffName) => {
    const staffTasks = allTasksData?.filter(
      (item) => item.staff?.name === staffName
    );
    return {
      name: staffName,
      total: staffTasks?.length || 0,
      completed:
        staffTasks?.filter((item) => item.task.status === "completed").length || 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">マスターコントロール</h1>
        <p className="text-muted-foreground mt-2">
          全ユーザーのタスクを一元管理
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
      </div>

      {/* User Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー別統計</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {userStats.map((stat) => (
              <div
                key={stat.email}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <span className="font-medium">{stat.email}</span>
                <div className="flex gap-4 text-sm">
                  <span>総数: {stat.total}</span>
                  <span className="text-green-600">完了: {stat.completed}</span>
                  <span className="text-muted-foreground">
                    完了率: {stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>スタッフ別統計</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {staffStats.map((stat) => (
              <div
                key={stat.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <span className="font-medium">{stat.name}</span>
                <div className="flex gap-4 text-sm">
                  <span>総数: {stat.total}</span>
                  <span className="text-green-600">完了: {stat.completed}</span>
                  <span className="text-muted-foreground">
                    完了率: {stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>検索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="タスク内容で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ユーザー</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="全ユーザー" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ユーザー</SelectItem>
                  {uniqueUsers.map((email) => (
                    <SelectItem key={email} value={email!}>
                      {email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>スタッフ</Label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="全スタッフ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全スタッフ</SelectItem>
                  {uniqueStaff.map((name) => (
                    <SelectItem key={name} value={name!}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
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
          </div>
          {(selectedUser !== "all" ||
            selectedStaff !== "all" ||
            selectedStatus !== "all" ||
            searchTerm !== "") && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUser("all");
                  setSelectedStaff("all");
                  setSelectedStatus("all");
                  setSearchTerm("");
                }}
              >
                フィルターをクリア
              </Button>
            </div>
          )}
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
                        <span>指示者: {item.user?.email || "不明"}</span>
                        <span>担当: {item.staff?.name || "不明"}{item.staff?.department && ` - ${item.staff.department}`}</span>
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
