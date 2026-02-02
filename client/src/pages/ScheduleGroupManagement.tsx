import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Users, ArrowLeft, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

type ScheduleGroup = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  members?: { liverId: number; liverName: string | null }[];
};

type Liver = {
  id: number;
  name: string;
  email: string;
};

export default function ScheduleGroupManagement() {
  const [, navigate] = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ScheduleGroup | null>(null);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    icon: "",
  });
  const [selectedLiverIds, setSelectedLiverIds] = useState<number[]>([]);

  // Fetch schedule groups
  const { data: groups, refetch: refetchGroups } = trpc.scheduleGroup.listWithMembers.useQuery();

  // Fetch all livers
  const { data: livers } = trpc.liverManagement.listWithStats.useQuery({ month: new Date().toISOString().slice(0, 7) });

  // Mutations
  const createMutation = trpc.scheduleGroup.create.useMutation({
    onSuccess: () => {
      toast.success("スケジュールグループを作成しました");
      setIsCreateModalOpen(false);
      setNewGroup({ name: "", description: "", color: "#3B82F6", icon: "" });
      refetchGroups();
    },
    onError: (error) => {
      toast.error(error.message || "作成に失敗しました");
    },
  });

  const updateMutation = trpc.scheduleGroup.update.useMutation({
    onSuccess: () => {
      toast.success("スケジュールグループを更新しました");
      setIsEditModalOpen(false);
      setSelectedGroup(null);
      refetchGroups();
    },
    onError: (error) => {
      toast.error(error.message || "更新に失敗しました");
    },
  });

  const deleteMutation = trpc.scheduleGroup.delete.useMutation({
    onSuccess: () => {
      toast.success("スケジュールグループを削除しました");
      refetchGroups();
    },
    onError: (error) => {
      toast.error(error.message || "削除に失敗しました");
    },
  });

  const setMembersMutation = trpc.scheduleGroup.setMembers.useMutation({
    onSuccess: () => {
      toast.success("メンバーを更新しました");
      setIsMemberModalOpen(false);
      setSelectedGroup(null);
      refetchGroups();
    },
    onError: (error) => {
      toast.error(error.message || "メンバー更新に失敗しました");
    },
  });

  // Handle create
  const handleCreate = () => {
    if (!newGroup.name.trim()) {
      toast.error("グループ名を入力してください");
      return;
    }
    createMutation.mutate({
      name: newGroup.name,
      description: newGroup.description || undefined,
      color: newGroup.color,
      icon: newGroup.icon || undefined,
    });
  };

  // Handle update
  const handleUpdate = () => {
    if (!selectedGroup) return;
    updateMutation.mutate({
      id: selectedGroup.id,
      name: selectedGroup.name,
      description: selectedGroup.description || undefined,
      color: selectedGroup.color || undefined,
      icon: selectedGroup.icon || undefined,
    });
  };

  // Handle delete
  const handleDelete = (id: number) => {
    if (confirm("このスケジュールグループを削除しますか？")) {
      deleteMutation.mutate({ id });
    }
  };

  // Open member modal
  const openMemberModal = (group: ScheduleGroup) => {
    setSelectedGroup(group);
    setSelectedLiverIds(group.members?.map((m) => m.liverId) || []);
    setIsMemberModalOpen(true);
  };

  // Handle member update
  const handleMemberUpdate = () => {
    if (!selectedGroup) return;
    setMembersMutation.mutate({
      groupId: selectedGroup.id,
      liverIds: selectedLiverIds,
    });
  };

  // Toggle liver selection
  const toggleLiver = (liverId: number) => {
    setSelectedLiverIds((prev) =>
      prev.includes(liverId) ? prev.filter((id) => id !== liverId) : [...prev, liverId]
    );
  };

  // Preset colors
  const presetColors = [
    "#EC4899", // pink
    "#8B5CF6", // purple
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // yellow
    "#F97316", // orange
    "#EF4444", // red
    "#14B8A6", // teal
  ];

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/s")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">スケジュールグループ管理</h1>
              <p className="text-gray-500">A/B/Cスケジュールなどのグループを管理します</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Button>
        </div>

        {/* Groups List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups?.map((group) => (
            <Card key={group.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: group.color || '#3B82F6' }}
                    />
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedGroup(group);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(group.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {group.description && (
                  <p className="text-sm text-gray-500 mb-3">{group.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {group.members && group.members.length > 0 ? (
                      group.members.slice(0, 3).map((member) => (
                        <Badge key={member.liverId} variant="secondary" className="text-xs">
                          {member.liverName}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">メンバーなし</span>
                    )}
                    {group.members && group.members.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{group.members.length - 3}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMemberModal(group)}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    メンバー
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty state */}
          {(!groups || groups.length === 0) && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">スケジュールグループがありません</h3>
                <p className="text-gray-500 mb-4">
                  「新規作成」ボタンからグループを作成してください
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  最初のグループを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規スケジュールグループ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">グループ名 *</label>
                <Input
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="例: Aスケジュール"
                />
              </div>
              <div>
                <label className="text-sm font-medium">説明</label>
                <Textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="例: Kyogoku Professional用"
                />
              </div>
              <div>
                <label className="text-sm font-medium">カラー</label>
                <div className="flex gap-2 mt-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newGroup.color === color ? "border-gray-800" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewGroup({ ...newGroup, color })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">アイコン（絵文字）</label>
                <Input
                  value={newGroup.icon}
                  onChange={(e) => setNewGroup({ ...newGroup, icon: e.target.value })}
                  placeholder="例: 📅"
                  maxLength={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>スケジュールグループを編集</DialogTitle>
            </DialogHeader>
            {selectedGroup && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">グループ名 *</label>
                  <Input
                    value={selectedGroup.name}
                    onChange={(e) =>
                      setSelectedGroup({ ...selectedGroup, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">説明</label>
                  <Textarea
                    value={selectedGroup.description || ""}
                    onChange={(e) =>
                      setSelectedGroup({ ...selectedGroup, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">カラー</label>
                  <div className="flex gap-2 mt-2">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 ${
                          selectedGroup.color === color ? "border-gray-800" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedGroup({ ...selectedGroup, color })}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">アイコン（絵文字）</label>
                  <Input
                    value={selectedGroup.icon || ""}
                    onChange={(e) =>
                      setSelectedGroup({ ...selectedGroup, icon: e.target.value })
                    }
                    maxLength={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Member Modal */}
        <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedGroup?.name} のメンバー
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {livers?.map((liver: Liver) => (
                <div
                  key={liver.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleLiver(liver.id)}
                >
                  <Checkbox
                    checked={selectedLiverIds.includes(liver.id)}
                    onCheckedChange={() => toggleLiver(liver.id)}
                  />
                  <div>
                    <p className="font-medium">{liver.name}</p>
                    <p className="text-sm text-gray-500">{liver.email}</p>
                  </div>
                </div>
              ))}
              {(!livers || livers.length === 0) && (
                <p className="text-center text-gray-500 py-4">
                  ライバーが登録されていません
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMemberModalOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleMemberUpdate} disabled={setMembersMutation.isPending}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
