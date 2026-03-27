import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Plus, Edit2, Trash2, Play, Sparkles, Clock, Eye, MousePointerClick, Send } from "lucide-react";

export default function StepEmailTemplates() {

  const utils = trpc.useUtils();
  const [editDialog, setEditDialog] = useState<{ open: boolean; template?: any }>({ open: false });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; html?: string }>({ open: false });

  const { data: templates, isLoading } = trpc.stepEmail.listTemplates.useQuery();
  const seedMutation = trpc.stepEmail.seedDefaults.useMutation({
    onSuccess: (data) => {
      if (data.seeded) {
        toast.success(`デフォルトテンプレートを作成しました（${data.count}件）`);
      } else {
        toast.info(`テンプレートは既に存在します（${data.count}件）`);
      }
      utils.stepEmail.listTemplates.invalidate();
    },
  });

  const createMutation = trpc.stepEmail.createTemplate.useMutation({
    onSuccess: () => {
      toast.success("テンプレートを作成しました");
      utils.stepEmail.listTemplates.invalidate();
      setEditDialog({ open: false });
    },
  });

  const updateMutation = trpc.stepEmail.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("テンプレートを更新しました");
      utils.stepEmail.listTemplates.invalidate();
      setEditDialog({ open: false });
    },
  });

  const deleteMutation = trpc.stepEmail.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("テンプレートを削除しました");
      utils.stepEmail.listTemplates.invalidate();
    },
  });

  const toggleMutation = trpc.stepEmail.updateTemplate.useMutation({
    onSuccess: () => {
      utils.stepEmail.listTemplates.invalidate();
    },
  });

  const triggerMutation = trpc.stepEmail.triggerSend.useMutation({
    onSuccess: (data) => {
      toast.success(`送信チェック完了: ${data.message}`);
    },
  });

  const [form, setForm] = useState({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    delayDays: 0,
    sortOrder: 1,
    isEnabled: true,
  });

  const openCreate = () => {
    setForm({ name: "", subject: "", bodyHtml: "", bodyText: "", delayDays: 0, sortOrder: (templates?.length ?? 0) + 1, isEnabled: true });
    setEditDialog({ open: true });
  };

  const openEdit = (tpl: any) => {
    setForm({
      name: tpl.name,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      bodyText: tpl.bodyText,
      delayDays: tpl.delayDays,
      sortOrder: tpl.sortOrder,
      isEnabled: tpl.isEnabled,
    });
    setEditDialog({ open: true, template: tpl });
  };

  const handleSave = () => {
    if (editDialog.template) {
      updateMutation.mutate({ id: editDialog.template.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              ステップメール管理
            </h1>
            <p className="text-muted-foreground mt-1">
              登録ユーザーへの自動フォローアップメールを管理します
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending}>
              <Play className="h-4 w-4 mr-1" />
              手動実行
            </Button>
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Sparkles className="h-4 w-4 mr-1" />
              デフォルト作成
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              新規作成
            </Button>
          </div>
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2 mt-2" /></CardHeader>
                <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : !templates || templates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">テンプレートがありません</h3>
              <p className="text-muted-foreground mb-4">デフォルトテンプレートを作成するか、新規作成してください</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => seedMutation.mutate()}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  デフォルト5通を作成
                </Button>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  新規作成
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <Card key={tpl.id} className={`transition-all ${!tpl.isEnabled ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{tpl.name}</CardTitle>
                      <CardDescription className="truncate mt-1">{tpl.subject}</CardDescription>
                    </div>
                    <Switch
                      checked={tpl.isEnabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: tpl.id, isEnabled: checked })}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tpl.delayDays === 0 ? "即日" : `${tpl.delayDays}日後`}
                    </Badge>
                    <Badge variant={tpl.isEnabled ? "default" : "outline"}>
                      {tpl.isEnabled ? "有効" : "無効"}
                    </Badge>
                  </div>
                  <div className="flex gap-1 mt-3">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewDialog({ open: true, html: tpl.bodyHtml })}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      if (confirm("このテンプレートを削除しますか？")) {
                        deleteMutation.mutate({ id: tpl.id });
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open })}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editDialog.template ? "テンプレート編集" : "新規テンプレート作成"}</DialogTitle>
              <DialogDescription>ステップメールのテンプレートを設定します</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>テンプレート名</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Day 0: ウェルカムメール" />
                </div>
                <div>
                  <Label>送信遅延（日数）</Label>
                  <Input type="number" min={0} value={form.delayDays} onChange={(e) => setForm({ ...form, delayDays: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>件名</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="🎉 ご登録ありがとうございます！" />
              </div>
              <div>
                <Label>HTML本文</Label>
                <Textarea rows={10} value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} placeholder="<div>...</div>" className="font-mono text-xs" />
              </div>
              <div>
                <Label>テキスト本文（フォールバック）</Label>
                <Textarea rows={4} value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} placeholder="プレーンテキスト版..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>表示順</Label>
                  <Input type="number" min={1} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.isEnabled} onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })} />
                  <Label>有効にする</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog({ open: false })}>キャンセル</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {editDialog.template ? "更新" : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open })}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>メールプレビュー</DialogTitle>
            </DialogHeader>
            <div className="border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: previewDialog.html || "" }} />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
