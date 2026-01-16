import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Edit, Globe } from "lucide-react";
import { toast } from "sonner";

// Available countries
const COUNTRIES = [
  { value: "日本", label: "日本" },
  { value: "中国", label: "中国" },
];

export default function StaffManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffDepartment, setNewStaffDepartment] = useState("");
  const [newStaffCountry, setNewStaffCountry] = useState<string>("日本");

  const utils = trpc.useUtils();
  const { data: staffList, isLoading } = trpc.staff.list.useQuery();

  // Filter staff by country
  const filteredStaffList = staffList?.filter(staff => {
    if (countryFilter === "all") return true;
    return staff.country === countryFilter;
  });

  const createStaffMutation = trpc.staff.create.useMutation({
    onSuccess: () => {
      toast.success("担当者を追加しました");
      utils.staff.list.invalidate();
      setIsCreateDialogOpen(false);
      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffDepartment("");
      setNewStaffCountry("日本");
    },
    onError: (error) => {
      toast.error("担当者の追加に失敗しました", {
        description: error.message,
      });
    },
  });

  const updateStaffMutation = trpc.staff.update.useMutation({
    onSuccess: () => {
      toast.success("担当者情報を更新しました");
      utils.staff.list.invalidate();
      setIsEditDialogOpen(false);
      setEditingStaff(null);
    },
    onError: (error) => {
      toast.error("担当者情報の更新に失敗しました", {
        description: error.message,
      });
    },
  });

  const deleteStaffMutation = trpc.staff.delete.useMutation({
    onSuccess: () => {
      toast.success("担当者を削除しました");
      utils.staff.list.invalidate();
    },
    onError: (error) => {
      toast.error("担当者の削除に失敗しました", {
        description: error.message,
      });
    },
  });

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmail) {
      toast.error("名前とメールアドレスは必須です");
      return;
    }
    await createStaffMutation.mutateAsync({
      name: newStaffName,
      email: newStaffEmail,
      department: newStaffDepartment || undefined,
      country: newStaffCountry,
    });
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    await updateStaffMutation.mutateAsync({
      id: editingStaff.id,
      name: editingStaff.name,
      email: editingStaff.email,
      department: editingStaff.department || undefined,
      country: editingStaff.country,
      isActive: editingStaff.isActive,
    });
  };

  const openEditDialog = (staff: any) => {
    setEditingStaff({ ...staff });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">担当者名簿管理</h1>
          <p className="text-muted-foreground mt-2">
            タスクを割り当てる担当者の情報を管理します（メール送信用）
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              担当者を追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規担当者追加</DialogTitle>
              <DialogDescription>担当者の情報を入力してください</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateStaff}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名前 *</Label>
                  <Input
                    id="name"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="山田太郎"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="yamada@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">部署</Label>
                  <Input
                    id="department"
                    value={newStaffDepartment}
                    onChange={(e) => setNewStaffDepartment(e.target.value)}
                    placeholder="営業部"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    国 *
                  </Label>
                  <Select value={newStaffCountry} onValueChange={setNewStaffCountry}>
                    <SelectTrigger id="country">
                      <SelectValue placeholder="国を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={createStaffMutation.isPending}>
                  {createStaffMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      追加中...
                    </>
                  ) : (
                    "追加"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Country Filter */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground mr-2">国:</span>
        <Button
          variant={countryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCountryFilter("all")}
        >
          全て
        </Button>
        {COUNTRIES.map((country) => (
          <Button
            key={country.value}
            variant={countryFilter === country.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCountryFilter(country.value)}
          >
            {country.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredStaffList && filteredStaffList.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStaffList.map((staff) => (
            <Card key={staff.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{staff.name}</CardTitle>
                    <CardDescription className="mt-1">{staff.email}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={staff.isActive === "active" ? "default" : "secondary"}>
                      {staff.isActive === "active" ? "有効" : "無効"}
                    </Badge>
                    {staff.country && (
                      <Badge variant="outline" className="text-xs">
                        {staff.country}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {staff.department && (
                  <p className="text-sm text-muted-foreground mb-4">部署: {staff.department}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEditDialog(staff)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    編集
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>担当者を削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          この操作は取り消せません。{staff.name}
                          さんの情報が完全に削除されます。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteStaffMutation.mutate({ id: staff.id })}
                        >
                          削除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground mb-4">
              {countryFilter === "all" 
                ? "担当者が登録されていません" 
                : `${countryFilter}の担当者が登録されていません`}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              最初の担当者を追加
            </Button>
          </CardContent>
        </Card>
      )}

      {editingStaff && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>担当者情報編集</DialogTitle>
              <DialogDescription>担当者の情報を更新してください</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateStaff}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">名前 *</Label>
                  <Input
                    id="edit-name"
                    value={editingStaff.name}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">メールアドレス *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingStaff.email}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">部署</Label>
                  <Input
                    id="edit-department"
                    value={editingStaff.department || ""}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, department: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-country" className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    国 *
                  </Label>
                  <Select 
                    value={editingStaff.country || "日本"} 
                    onValueChange={(value) => setEditingStaff({ ...editingStaff, country: value })}
                  >
                    <SelectTrigger id="edit-country">
                      <SelectValue placeholder="国を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={updateStaffMutation.isPending}>
                  {updateStaffMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    "更新"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
