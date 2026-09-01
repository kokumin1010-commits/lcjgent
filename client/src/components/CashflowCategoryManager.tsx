import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Draft = {
  name: string;
};

export default function CashflowCategoryManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const definitionsQuery = trpc.cashflow.getCategoryDefinitions.useQuery(
    undefined,
    { enabled: open }
  );
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  useEffect(() => {
    if (!definitionsQuery.data) return;
    setDrafts(
      Object.fromEntries(
        definitionsQuery.data.map(item => [item.id, { name: item.name }])
      )
    );
  }, [definitionsQuery.data]);

  const refresh = async () => {
    await Promise.all([
      definitionsQuery.refetch(),
      utils.cashflow.getCategories.invalidate(),
      utils.cashflow.getAll.invalidate(),
      utils.cashflow.getCategoryBreakdown.invalidate(),
      utils.cashflow.getTotalSummary.invalidate(),
    ]);
  };

  const createMutation = trpc.cashflow.createCategory.useMutation({
    onSuccess: async () => {
      setNewName("");
      await refresh();
      toast.success("分类已添加，可用于入金和出金");
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.cashflow.updateCategoryDefinition.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("分类已更新，可用于入金和出金");
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.cashflow.deleteCategoryDefinition.useMutation({
    onSuccess: async result => {
      await refresh();
      toast.success(
        result.deleted ? "分类已删除，历史流水仍完整保留" : "分类已经删除"
      );
    },
    onError: error => toast.error(error.message),
  });

  const categories = definitionsQuery.data || [];
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>现金流分类管理</DialogTitle>
          <DialogDescription>
            所有分类都可同时用于入金和出金，并支持新增、改名和删除。删除只会移出可选列表，不会删除历史流水。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold">手动添加分类字段</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
              <Input
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="输入新的日文或中文分类名称"
                maxLength={100}
                onKeyDown={event => {
                  if (event.key === "Enter" && newName.trim() && !isMutating) {
                    createMutation.mutate({
                      name: newName.trim(),
                      flowType: "both",
                    });
                  }
                }}
              />
              <div className="flex h-10 items-center justify-center rounded-md border bg-white px-3 text-sm font-medium text-emerald-700">
                入金・出金
              </div>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name: newName.trim(),
                    flowType: "both",
                  })
                }
                disabled={!newName.trim() || isMutating}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                添加
              </Button>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">分类字段</h3>
              <span className="text-xs text-slate-500">
                共 {categories.length} 项
              </span>
            </div>
            {definitionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载分类中
              </div>
            ) : definitionsQuery.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                分类加载失败：{definitionsQuery.error.message}
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((item, index) => {
                  const draft = drafts[item.id] || { name: item.name };
                  const isEditable = !item.isLegacy;
                  return (
                    <div
                      key={`${item.id}-${item.name}`}
                      className={`grid items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[36px_1fr_110px_75px_220px] ${item.isActive ? "bg-white" : "bg-slate-100 opacity-70"}`}
                    >
                      <span className="text-center text-xs tabular-nums text-slate-400">
                        {index + 1}
                      </span>
                      {isEditable ? (
                        <Input
                          value={draft.name}
                          onChange={event =>
                            setDrafts(current => ({
                              ...current,
                              [item.id]: { name: event.target.value },
                            }))
                          }
                          className="h-8"
                          maxLength={100}
                        />
                      ) : (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-amber-600">
                            历史分类，仅保留已有流水；可按相同名称重新添加
                          </p>
                        </div>
                      )}
                      <span className="text-xs font-medium text-emerald-700">
                        入金・出金
                      </span>
                      <Badge variant="outline" className="w-fit text-[11px]">
                        {item.usageCount}笔
                      </Badge>
                      <div className="flex justify-end gap-2">
                        {item.isLegacy ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 text-amber-700"
                          >
                            历史保留
                          </Badge>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateMutation.mutate({
                                  id: item.id,
                                  name: draft.name.trim(),
                                  flowType: "both",
                                })
                              }
                              disabled={!draft.name.trim() || isMutating}
                            >
                              <Save className="mr-1 h-3.5 w-3.5" />
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                const warning = item.usageCount
                                  ? `“${item.name}”已用于${item.usageCount}笔流水。删除后历史流水和金额仍会保留，但它将从新选择列表中移除。确认删除吗？`
                                  : `确认删除分类“${item.name}”吗？`;
                                if (window.confirm(warning)) {
                                  deleteMutation.mutate({ id: item.id });
                                }
                              }}
                              disabled={isMutating}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
