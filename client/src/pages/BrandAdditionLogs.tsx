import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tag, User, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

export default function BrandAdditionLogs() {
  const [, navigate] = useLocation();
  const { data: logs, isLoading } = trpc.liverManagement.getBrandAdditionLogs.useQuery({
    limit: 200,
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/master/brands")}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ブランド追加ログ</h1>
            <p className="text-sm text-gray-500 mt-1">
              ライバーによるブランド追加の履歴を表示します
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5 text-blue-500" />
              追加履歴
              {logs && (
                <Badge variant="secondary" className="ml-2">
                  {logs.length}件
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                まだブランド追加ログがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          ライバー名
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Tag className="h-4 w-4" />
                          追加ブランド名
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          追加日時
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any, index: number) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-gray-500 font-mono text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{log.liverName}</div>
                              <div className="text-xs text-gray-500">ID: {log.liverId}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {log.brandName}
                          </Badge>
                          <span className="text-xs text-gray-400 ml-2">
                            (ID: {log.brandId})
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">
                          {formatDate(log.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
