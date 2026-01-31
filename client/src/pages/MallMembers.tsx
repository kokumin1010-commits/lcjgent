import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Users, Mail, Phone, Calendar, Coins, UserCheck, UserX, RefreshCw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function MallMembers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: members, isLoading, refetch } = trpc.line.listUsers.useQuery();

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
    setSelectedMember(member);
    setIsDetailOpen(true);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>会員詳細</DialogTitle>
            <DialogDescription>
              会員ID: {selectedMember?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
