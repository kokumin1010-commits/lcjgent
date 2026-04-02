import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Building2, Plus, Users, Edit, UserPlus, UserMinus, Eye, EyeOff, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function AgencyManagement() {

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [editingAgency, setEditingAgency] = useState<any>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formLoginId, setFormLoginId] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const agenciesQuery = trpc.agency.list.useQuery();
  const unassignedLiversQuery = trpc.agency.getUnassignedLivers.useQuery();
  const agencyLiversQuery = trpc.agency.getLiversByAgency.useQuery(
    { agencyId: selectedAgencyId! },
    { enabled: !!selectedAgencyId }
  );

  const createMutation = trpc.agency.create.useMutation({
    onSuccess: () => {
      toast.success("事務所を作成しました");
      setShowCreateDialog(false);
      resetForm();
      agenciesQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const updateMutation = trpc.agency.update.useMutation({
    onSuccess: () => {
      toast.success("事務所を更新しました");
      setEditingAgency(null);
      resetForm();
      agenciesQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const assignMutation = trpc.agency.assignLiver.useMutation({
    onSuccess: () => {
      toast.success("ライバーを割り当てました");
      agenciesQuery.refetch();
      unassignedLiversQuery.refetch();
      if (selectedAgencyId) agencyLiversQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const resetForm = () => {
    setFormName("");
    setFormLoginId("");
    setFormPassword("");
    setFormEmail("");
    setFormPhone("");
    setFormDescription("");
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formName,
      loginId: formLoginId,
      password: formPassword,
      contactEmail: formEmail || undefined,
      contactPhone: formPhone || undefined,
      description: formDescription || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingAgency) return;
    const data: any = { id: editingAgency.id };
    if (formName) data.name = formName;
    if (formLoginId) data.loginId = formLoginId;
    if (formPassword) data.password = formPassword;
    if (formEmail) data.contactEmail = formEmail;
    if (formPhone) data.contactPhone = formPhone;
    if (formDescription) data.description = formDescription;
    updateMutation.mutate(data);
  };

  const startEdit = (agency: any) => {
    setEditingAgency(agency);
    setFormName(agency.name);
    setFormLoginId(agency.loginId);
    setFormPassword("");
    setFormEmail(agency.contactEmail || "");
    setFormPhone(agency.contactPhone || "");
    setFormDescription(agency.description || "");
  };

  const agencies = agenciesQuery.data ?? [];
  const unassignedLivers = unassignedLiversQuery.data ?? [];
  const agencyLivers = agencyLiversQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            事務所管理
          </h1>
          <p className="text-slate-400 mt-1">外部事務所のアカウント・ライバー割り当てを管理</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              事務所を追加
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>新規事務所作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">事務所名 *</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="例: Mobmart" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">ログインID *</Label>
                  <Input value={formLoginId} onChange={(e) => setFormLoginId(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="例: mobmart" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">パスワード *</Label>
                <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="パスワード" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">メール</Label>
                  <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">電話番号</Label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="03-xxxx-xxxx" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">説明</Label>
                <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="事務所の説明" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)} className="text-slate-400">キャンセル</Button>
              <Button onClick={handleCreate} disabled={!formName || !formLoginId || !formPassword || createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {createMutation.isPending ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agency List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agencies.map((agency) => (
          <Card key={agency.id} className="bg-slate-800/80 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{agency.name}</h3>
                    <p className="text-sm text-slate-400">ID: {agency.loginId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${agency.isActive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {agency.isActive ? "有効" : "無効"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(agency)} className="text-slate-400 hover:text-white">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  ライバー: {agency.liverCount}名
                </span>
                {agency.contactEmail && <span>{agency.contactEmail}</span>}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAgencyId(agency.id);
                    setShowAssignDialog(true);
                  }}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  ライバー割り当て
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/agency/login`, "_blank")}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  事務所ページ
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agencies.length === 0 && (
        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">事務所がまだ登録されていません</p>
            <p className="text-sm text-slate-500 mt-2">「事務所を追加」ボタンから新しい事務所を作成してください</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingAgency} onOpenChange={(open) => { if (!open) setEditingAgency(null); }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>事務所を編集: {editingAgency?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">事務所名</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">ログインID</Label>
                <Input value={formLoginId} onChange={(e) => setFormLoginId(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">パスワード（変更する場合のみ）</Label>
              <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="変更しない場合は空欄" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">メール</Label>
                <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">電話番号</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingAgency(null)} className="text-slate-400">キャンセル</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {updateMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Liver Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>ライバー割り当て</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Currently assigned */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">現在の所属ライバー</h4>
              {agencyLivers.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {agencyLivers.map((l) => (
                    <div key={l.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: l.color || "#3b82f6" }}>
                          {l.avatarUrl ? <img src={l.avatarUrl} className="w-8 h-8 rounded-full object-cover" /> : l.name?.charAt(0)}
                        </div>
                        <span className="text-white">{l.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => assignMutation.mutate({ liverId: l.id, agencyId: null })}
                        className="text-red-400 hover:text-red-300"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">所属ライバーなし</p>
              )}
            </div>

            {/* Unassigned livers */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">未所属ライバー</h4>
              {unassignedLivers.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {unassignedLivers.map((l) => (
                    <div key={l.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: "#6b7280" }}>
                          {l.avatarUrl ? <img src={l.avatarUrl} className="w-8 h-8 rounded-full object-cover" /> : l.name?.charAt(0)}
                        </div>
                        <span className="text-white">{l.name}</span>
                        <span className="text-xs text-slate-400">{l.email}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedAgencyId) {
                            assignMutation.mutate({ liverId: l.id, agencyId: selectedAgencyId });
                          }
                        }}
                        className="text-green-400 hover:text-green-300"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">全ライバーが割り当て済みです</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
