import { trpc } from "@/lib/trpc";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Users, Mail, Calendar, Coins, UserCheck, UserX, RefreshCw, Receipt, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle, XCircle, AlertCircle, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MallMembersProps {
  initialMemberId?: number | null;
  onMemberViewed?: () => void;
}

export default function MallMembers({ initialMemberId, onMemberViewed }: MallMembersProps = {}) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [pointAmount, setPointAmount] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [pointAction, setPointAction] = useState<"add" | "remove">("add");
  const [processedMemberId, setProcessedMemberId] = useState<number | null>(null);
  const { data: members, isLoading, refetch } = trpc.line.listUsers.useQuery();
  const utils = trpc.useUtils();

  // initialMemberIdが指定されたら該当会員の詳細を自動表示
  React.useEffect(() => {
    if (initialMemberId && members && initialMemberId !== processedMemberId) {
      const member = members.find((m: any) => m.id === initialMemberId);
      if (member) {
        setSelectedMember(member);
        setActiveTab("info");
        setIsDetailOpen(true);
        setProcessedMemberId(initialMemberId);
        onMemberViewed?.();
      }
    }
  }, [initialMemberId, members, processedMemberId, onMemberViewed]);

  const adjustPointsMutation = trpc.line.adminAdjustPoints.useMutation({
    onSuccess: (data) => {
      toast.success(pointAction === "add" ? "ポイント付与完了" : "ポイント削除完了", {
        description: `残高: ${data.balanceAfter.toLocaleString()} pt`,
      });
      setPointAmount("");
      setPointDescription("");
      // ポイント履歴を再取得
      if (selectedMember?.lineUserId) {
        utils.line.getMemberPointHistory.invalidate({ lineUserId: selectedMember.lineUserId });
      }
    },
    onError: (error) => {
      toast.error("エラー", { description: error.message });
    },
  });

  // Get point history when member is selected
  const { data: pointHistory, isLoading: isLoadingPoints } = trpc.line.getMemberPointHistory.useQuery(
    { lineUserId: selectedMember?.lineUserId || "" },
    { enabled: !!selectedMember?.lineUserId && isDetailOpen }
  );

  // Get receipt history when member is selected
  const { data: receiptHistory, isLoading: isLoadingReceipts } = trpc.line.getMemberReceiptHistory.useQuery(
    { lineUserId: selectedMember?.lineUserId || "" },
    { enabled: !!selectedMember?.lineUserId && isDetailOpen }
  );

  // Filter members based on search query
  const filteredMembers = members?.filter((member: any) => {
    const query = searchQuery.toLowerCase();
    return (
      member.displayName?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.lineUserId?.toLowerCase().includes(query)
    );
  }) || [];

  // Count statistics
  const totalMembers = members?.length || 0;
  const emailMembers = members?.filter((m: any) => m.email)?.length || 0;
  const lineMembers = members?.filter((m: any) => m.lineUserId && !m.lineUserId.startsWith('email_'))?.length || 0;

  const handleViewDetail = (member: any) => {
    // フルページの会員詳細に遷移
    setLocation(`/master/mall/member/${member.id}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />承認済み</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />却下</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 mr-1" />審査中</Badge>;
      case "on_hold":
        return <Badge className="bg-orange-100 text-orange-700"><AlertCircle className="h-3 w-3 mr-1" />保留</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LCJ MALL会員様</h1>
          <p className="text-muted-foreground">
            LCJ MALLに登録されている会員様の一覧です
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          更新
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総会員数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">登録済み会員</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LINE会員</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineMembers}</div>
            <p className="text-xs text-muted-foreground">LINEログイン会員</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">メール会員</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailMembers}</div>
            <p className="text-xs text-muted-foreground">メール登録会員</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>会員検索</CardTitle>
          <CardDescription>名前、メールアドレス、LINE IDで検索できます</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>会員一覧</CardTitle>
          <CardDescription>
            {filteredMembers.length}件の会員が見つかりました
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>登録方法</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    会員が見つかりませんでした
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-mono text-sm">{member.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {member.pictureUrl ? (
                          <img
                            src={member.pictureUrl}
                            alt={member.displayName}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{member.displayName || "未設定"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.email ? (
                        <span className="text-sm">{member.email}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.lineUserId && !member.lineUserId.startsWith('email_') ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <UserCheck className="h-3 w-3 mr-1" />
                          LINE
                        </Badge>
                      ) : member.email ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <Mail className="h-3 w-3 mr-1" />
                          メール
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          <UserX className="h-3 w-3 mr-1" />
                          不明
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.createdAt ? (
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(member.createdAt), "yyyy/MM/dd", { locale: ja })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetail(member)}
                      >
                        詳細
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Member Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>会員詳細</DialogTitle>
            <DialogDescription>
              会員ID: {selectedMember?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">
                  <Users className="h-4 w-4 mr-2" />
                  基本情報
                </TabsTrigger>
                <TabsTrigger value="points">
                  <Coins className="h-4 w-4 mr-2" />
                  ポイント履歴
                </TabsTrigger>
                <TabsTrigger value="receipts">
                  <Receipt className="h-4 w-4 mr-2" />
                  レシート履歴
                </TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="info" className="mt-4">
                <div className="space-y-4">
                  {/* Profile */}
                  <div className="flex items-center gap-4">
                    {selectedMember.pictureUrl ? (
                      <img
                        src={selectedMember.pictureUrl}
                        alt={selectedMember.displayName}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">{selectedMember.displayName || "未設定"}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedMember.lineUserId && !selectedMember.lineUserId.startsWith('email_') 
                          ? "LINEログイン会員" 
                          : "メール登録会員"}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Label className="text-muted-foreground">メールアドレス</Label>
                      <div className="col-span-2">{selectedMember.email || "-"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Label className="text-muted-foreground">LINE ID</Label>
                      <div className="col-span-2 font-mono text-sm">
                        {selectedMember.lineUserId && !selectedMember.lineUserId.startsWith('email_') 
                          ? selectedMember.lineUserId 
                          : "-"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Label className="text-muted-foreground">ステータスメッセージ</Label>
                      <div className="col-span-2">{selectedMember.statusMessage || "-"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Label className="text-muted-foreground">登録日時</Label>
                      <div className="col-span-2">
                        {selectedMember.createdAt 
                          ? format(new Date(selectedMember.createdAt), "yyyy年MM月dd日 HH:mm", { locale: ja })
                          : "-"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Label className="text-muted-foreground">最終更新</Label>
                      <div className="col-span-2">
                        {selectedMember.updatedAt 
                          ? format(new Date(selectedMember.updatedAt), "yyyy年MM月dd日 HH:mm", { locale: ja })
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Points Tab */}
              <TabsContent value="points" className="mt-4">
                {isLoadingPoints ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Point Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">現在のポイント</p>
                            <p className="text-2xl font-bold text-primary">{pointHistory?.balance?.toLocaleString() || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">累計獲得</p>
                            <p className="text-xl font-semibold text-green-600">+{pointHistory?.lifetimeEarned?.toLocaleString() || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">累計使用</p>
                            <p className="text-xl font-semibold text-red-600">-{pointHistory?.lifetimeUsed?.toLocaleString() || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* ポイント操作 */}
                    <Card className="border-dashed">
                      <CardContent className="pt-4">
                        <h4 className="font-medium mb-3">ポイント操作</h4>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Select value={pointAction} onValueChange={(v: "add" | "remove") => setPointAction(v)}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="add">付与</SelectItem>
                                <SelectItem value="remove">削除</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="ポイント数"
                              value={pointAmount}
                              onChange={(e) => setPointAmount(e.target.value)}
                              className="w-[120px]"
                              min={1}
                            />
                          </div>
                          <Textarea
                            placeholder="理由を入力（例: キャンペーン特典、不具合補償等）"
                            value={pointDescription}
                            onChange={(e) => setPointDescription(e.target.value)}
                            rows={2}
                          />
                          <Button
                            onClick={() => {
                              const amount = parseInt(pointAmount);
                              if (!amount || amount <= 0) {
                                toast.error("ポイント数を正しく入力してください");
                                return;
                              }
                              if (!pointDescription.trim()) {
                                toast.error("理由を入力してください");
                                return;
                              }
                              const lineUserId = selectedMember?.lineUserId || `email_${selectedMember?.id}`;
                              adjustPointsMutation.mutate({
                                lineUserId,
                                amount: pointAction === "add" ? amount : -amount,
                                description: pointDescription,
                              });
                            }}
                            disabled={adjustPointsMutation.isPending}
                            className={pointAction === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                          >
                            {adjustPointsMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : pointAction === "add" ? (
                              <Plus className="h-4 w-4 mr-2" />
                            ) : (
                              <Minus className="h-4 w-4 mr-2" />
                            )}
                            {pointAction === "add" ? "ポイントを付与" : "ポイントを削除"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Transaction History */}
                    <div>
                      <h4 className="font-medium mb-2">ポイント履歴</h4>
                      <ScrollArea className="h-[250px] border rounded-md">
                        {pointHistory?.transactions && pointHistory.transactions.length > 0 ? (
                          <div className="divide-y">
                            {pointHistory.transactions.map((tx: any, index: number) => (
                              <div key={index} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {tx.type === "earn" ? (
                                    <ArrowUpCircle className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <ArrowDownCircle className="h-5 w-5 text-red-500" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{tx.description || (tx.type === "earn" ? "ポイント獲得" : "ポイント使用")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {tx.createdAt ? format(new Date(tx.createdAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}
                                    </p>
                                  </div>
                                </div>
                                <div className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                  {tx.amount > 0 ? "+" : ""}{tx.amount?.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            ポイント履歴がありません
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Receipts Tab */}
              <TabsContent value="receipts" className="mt-4">
                {isLoadingReceipts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Receipt Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">申請件数</p>
                            <p className="text-2xl font-bold">{receiptHistory?.length || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">承認済み</p>
                            <p className="text-2xl font-bold text-green-600">
                              {receiptHistory?.filter((r: any) => r.status === "approved").length || 0}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Receipt History */}
                    <div>
                      <h4 className="font-medium mb-2">レシート申請履歴</h4>
                      <ScrollArea className="h-[250px] border rounded-md">
                        {receiptHistory && receiptHistory.length > 0 ? (
                          <div className="divide-y">
                            {receiptHistory.map((receipt: any, index: number) => (
                              <div key={index} className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{receipt.storeName || "店舗名不明"}</span>
                                  </div>
                                  {getStatusBadge(receipt.status)}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div>
                                    <span>金額: </span>
                                    <span className="font-medium text-foreground">¥{receipt.totalAmount?.toLocaleString() || 0}</span>
                                  </div>
                                  <div>
                                    <span>ポイント: </span>
                                    <span className="font-medium text-primary">{receipt.pointsAwarded?.toLocaleString() || 0}pt</span>
                                  </div>
                                  <div>
                                    <span>購入日: </span>
                                    <span>{receipt.purchaseDate ? format(new Date(receipt.purchaseDate), "yyyy/MM/dd", { locale: ja }) : "-"}</span>
                                  </div>
                                  <div>
                                    <span>申請日: </span>
                                    <span>{receipt.submittedAt ? format(new Date(receipt.submittedAt), "yyyy/MM/dd", { locale: ja }) : "-"}</span>
                                  </div>
                                </div>
                                {receipt.imageUrl && (
                                  <div className="mt-2">
                                    <a 
                                      href={receipt.imageUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline"
                                    >
                                      レシート画像を表示
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            レシート申請履歴がありません
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
