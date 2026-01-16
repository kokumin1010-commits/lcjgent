import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Link,
  Unlink,
  ListTodo,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function ReportStaffManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Form states
  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState("日本");
  const [editName, setEditName] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [linkedStaffId, setLinkedStaffId] = useState<string>("");

  const utils = trpc.useUtils();

  // Queries
  const { data: reportStaffList, isLoading } = trpc.reportStaff.list.useQuery();
  const { data: taskStaffList } = trpc.staff.list.useQuery();

  // Mutations
  const createMutation = trpc.reportStaff.create.useMutation({
    onSuccess: () => {
      toast.success("レポートスタッフを追加しました");
      utils.reportStaff.list.invalidate();
      setIsAddDialogOpen(false);
      setNewName("");
      setNewCountry("日本");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateMutation = trpc.reportStaff.update.useMutation({
    onSuccess: () => {
      toast.success("レポートスタッフを更新しました");
      utils.reportStaff.list.invalidate();
      setIsEditDialogOpen(false);
      setSelectedStaff(null);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.reportStaff.delete.useMutation({
    onSuccess: () => {
      toast.success("レポートスタッフを削除しました");
      utils.reportStaff.list.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) {
      toast.error("名前を入力してください");
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      country: newCountry,
    });
  };

  const handleEdit = () => {
    if (!selectedStaff || !editName.trim()) {
      toast.error("名前を入力してください");
      return;
    }
    updateMutation.mutate({
      id: selectedStaff.id,
      name: editName.trim(),
      country: editCountry,
    });
  };

  const handleLink = () => {
    if (!selectedStaff) return;
    
    const staffId = linkedStaffId === "none" ? null : parseInt(linkedStaffId);
    updateMutation.mutate({
      id: selectedStaff.id,
      linkedStaffId: staffId,
    });
    setIsLinkDialogOpen(false);
    setSelectedStaff(null);
    setLinkedStaffId("");
  };

  const handleDelete = (id: number) => {
    if (confirm("このレポートスタッフを削除しますか？関連する日報も削除される可能性があります。")) {
      deleteMutation.mutate({ id });
    }
  };

  const openEditDialog = (staff: any) => {
    setSelectedStaff(staff);
    setEditName(staff.name);
    setEditCountry(staff.country);
    setIsEditDialogOpen(true);
  };

  const openLinkDialog = (staff: any) => {
    setSelectedStaff(staff);
    setLinkedStaffId(staff.linkedStaffId?.toString() || "none");
    setIsLinkDialogOpen(true);
  };

  // Filter by country
  const filteredStaff = reportStaffList?.filter((s) => {
    if (countryFilter === "all") return true;
    return s.country === countryFilter;
  });

  // Get linked staff info
  const getLinkedStaffInfo = (linkedStaffId: number | null) => {
    if (!linkedStaffId || !taskStaffList) return null;
    return taskStaffList.find((s) => s.id === linkedStaffId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">レポートスタッフ管理</h1>
          <p className="text-muted-foreground">
            日報用のスタッフを管理し、担当者名簿との紐付けを設定します
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>レポートスタッフを追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>名前</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="スタッフ名を入力"
                />
              </div>
              <div className="space-y-2">
                <Label>国</Label>
                <Select value={newCountry} onValueChange={setNewCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="日本">🇯🇵 日本</SelectItem>
                    <SelectItem value="中国">🇨🇳 中国</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAdd} disabled={createMutation.isPending}>
                {createMutation.isPending ? "追加中..." : "追加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Country Filter */}
      <div className="flex gap-2">
        <Button
          variant={countryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCountryFilter("all")}
        >
          全て ({reportStaffList?.length || 0})
        </Button>
        <Button
          variant={countryFilter === "日本" ? "default" : "outline"}
          size="sm"
          onClick={() => setCountryFilter("日本")}
        >
          🇯🇵 日本 ({reportStaffList?.filter((s) => s.country === "日本").length || 0})
        </Button>
        <Button
          variant={countryFilter === "中国" ? "default" : "outline"}
          size="sm"
          onClick={() => setCountryFilter("中国")}
        >
          🇨🇳 中国 ({reportStaffList?.filter((s) => s.country === "中国").length || 0})
        </Button>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            レポートスタッフ一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>国</TableHead>
                <TableHead>紐付け担当者</TableHead>
                <TableHead>タスク進捗</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff?.map((staff) => {
                const linkedStaff = getLinkedStaffInfo(staff.linkedStaffId);
                return (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {staff.country === "日本" ? "🇯🇵" : "🇨🇳"} {staff.country}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {linkedStaff ? (
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-green-500" />
                          <span>{linkedStaff.name}</span>
                          {linkedStaff.department && (
                            <span className="text-muted-foreground text-sm">
                              ({linkedStaff.department})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Unlink className="h-4 w-4" />
                          未紐付け
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {linkedStaff ? (
                        <TaskProgressBadges staffId={linkedStaff.id} />
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={staff.isActive === "active" ? "default" : "secondary"}
                      >
                        {staff.isActive === "active" ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openLinkDialog(staff)}
                        >
                          <Link className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(staff)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(staff.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!filteredStaff || filteredStaff.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    レポートスタッフがいません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>レポートスタッフを編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名前</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="スタッフ名を入力"
              />
            </div>
            <div className="space-y-2">
              <Label>国</Label>
              <Select value={editCountry} onValueChange={setEditCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="日本">🇯🇵 日本</SelectItem>
                  <SelectItem value="中国">🇨🇳 中国</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>担当者との紐付け</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {selectedStaff?.name} を担当者名簿のスタッフと紐付けます。
              紐付けると、日報からタスクの進捗を確認できるようになります。
            </p>
            <div className="space-y-2">
              <Label>紐付ける担当者</Label>
              <Select value={linkedStaffId} onValueChange={setLinkedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">紐付けなし</SelectItem>
                  {taskStaffList?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.name}
                      {staff.department && ` (${staff.department})`}
                      {staff.country && ` - ${staff.country === "日本" ? "🇯🇵" : "🇨🇳"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleLink} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "紐付けを保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Task progress badges component
function TaskProgressBadges({ staffId }: { staffId: number }) {
  const { data: taskCounts } = trpc.staff.getTaskCounts.useQuery({ staffId });

  if (!taskCounts) {
    return <span className="text-muted-foreground text-sm">読込中...</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {taskCounts.inProgressCount > 0 && (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          {taskCounts.inProgressCount}
        </Badge>
      )}
      {taskCounts.overdueCount > 0 && (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {taskCounts.overdueCount}
        </Badge>
      )}
      {taskCounts.completedCount > 0 && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          {taskCounts.completedCount}
        </Badge>
      )}
      {taskCounts.inProgressCount === 0 && taskCounts.overdueCount === 0 && taskCounts.completedCount === 0 && (
        <span className="text-muted-foreground text-sm">タスクなし</span>
      )}
    </div>
  );
}
