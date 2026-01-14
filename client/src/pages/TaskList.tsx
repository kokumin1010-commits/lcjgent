import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function TaskList() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  
  // URLパラメータからステータスを取得
  const urlParams = new URLSearchParams(window.location.search);
  const statusParam = urlParams.get('status');
  const [activeTab, setActiveTab] = useState(statusParam || "all");

  const { data: allTasks, isLoading: isLoadingAll } = trpc.task.list.useQuery();
  const { data: searchResults, isLoading: isSearching } = trpc.task.search.useQuery(
    { searchTerm },
    { enabled: searchTerm.length > 0 }
  );

  const displayTasks = searchTerm.length > 0 ? searchResults : allTasks;
  const isLoading = searchTerm.length > 0 ? isSearching : isLoadingAll;

  const filteredTasks =
    activeTab === "all"
      ? displayTasks
      : displayTasks?.filter((item) => item.task.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">タスク一覧</h1>
          <p className="text-muted-foreground mt-2">登録されたタスクを管理します</p>
        </div>
        <Button onClick={() => setLocation("/tasks/create")}>
          <Plus className="mr-2 h-4 w-4" />
          新規タスク登録
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="タスク内容や担当者名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="pending">保留中</TabsTrigger>
          <TabsTrigger value="in_progress">進行中</TabsTrigger>
          <TabsTrigger value="completed">完了</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTasks && filteredTasks.length > 0 ? (
            <div className="grid gap-4">
              {filteredTasks.map((item) => (
                <Card
                  key={item.task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/tasks/${item.task.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{item.task.taskDetail}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="secondary"
                            className={`${statusColors[item.task.status]} text-white`}
                          >
                            {statusLabels[item.task.status]}
                          </Badge>
                          {item.staff ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.staff) {
                                  setLocation(`/staff/${item.staff.id}/tasks`);
                                }
                              }}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              担当: {item.staff.name}{item.staff.department && ` - ${item.staff.department}`}
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              担当: 不明
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        登録日時:{" "}
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
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">タスクが見つかりません</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
