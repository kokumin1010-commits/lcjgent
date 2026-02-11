import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Megaphone, Users, Gift, TrendingUp, Crown, Copy } from "lucide-react";
import { toast } from "sonner";

export default function ReferralManagement() {
  const { data: referralCodes, isLoading } = trpc.referral.getAll.useQuery();

  const totalReferrals = referralCodes?.reduce((sum, r) => sum + (r.totalReferrals ?? 0), 0) ?? 0;
  const totalPoints = referralCodes?.reduce((sum, r) => sum + (r.totalPointsEarned ?? 0), 0) ?? 0;
  const activeCodesCount = referralCodes?.filter(r => r.isActive).length ?? 0;
  const codesWithReferrals = referralCodes?.filter(r => (r.totalReferrals ?? 0) > 0).length ?? 0;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`コード ${code} をコピーしました`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-purple-500" />
            紹介コード管理
          </h1>
          <p className="text-muted-foreground mt-1">
            全ライバーの紹介コードと実績を一覧表示
          </p>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">発行コード数</span>
              </div>
              <p className="text-2xl font-bold">{isLoading ? "..." : activeCodesCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">総紹介人数</span>
              </div>
              <p className="text-2xl font-bold">{isLoading ? "..." : totalReferrals}人</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-4 w-4 text-pink-500" />
                <span className="text-sm text-muted-foreground">総付与ポイント</span>
              </div>
              <p className="text-2xl font-bold">{isLoading ? "..." : totalPoints.toLocaleString()}pt</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">紹介実績あり</span>
              </div>
              <p className="text-2xl font-bold">{isLoading ? "..." : codesWithReferrals}人</p>
            </CardContent>
          </Card>
        </div>

        {/* 紹介コード一覧テーブル */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">紹介コード一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : referralCodes && referralCodes.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>ライバー</TableHead>
                      <TableHead className="text-center">紹介コード</TableHead>
                      <TableHead className="text-center">紹介人数</TableHead>
                      <TableHead className="text-center">獲得ポイント</TableHead>
                      <TableHead className="text-center">ステータス</TableHead>
                      <TableHead className="text-center">作成日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralCodes.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {index < 3 ? (
                            <Crown className={`h-5 w-5 ${
                              index === 0 ? "text-yellow-500" :
                              index === 1 ? "text-gray-400" :
                              "text-amber-700"
                            }`} />
                          ) : (
                            <span className="text-sm text-muted-foreground font-medium">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={item.liverAvatarUrl || undefined} />
                              <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                                {item.liverName?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{item.liverName || "不明"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => copyCode(item.code)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 hover:bg-purple-100 transition-colors font-mono text-lg font-bold tracking-widest text-purple-700 cursor-pointer"
                          >
                            {item.code}
                            <Copy className="h-3.5 w-3.5 text-purple-400" />
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-blue-600">
                            {item.totalReferrals ?? 0}
                          </span>
                          <span className="text-muted-foreground text-sm ml-0.5">人</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-pink-600">
                            {(item.totalPointsEarned ?? 0).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground text-sm ml-0.5">pt</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={item.isActive ? "default" : "secondary"} className={item.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                            {item.isActive ? "有効" : "無効"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ja-JP") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>紹介コードはまだ発行されていません</p>
                <p className="text-sm mt-1">ライバーがマイページにアクセスすると自動的に発行されます</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
