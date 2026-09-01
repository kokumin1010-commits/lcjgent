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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

type FlowType = "income" | "expense" | "both";

type Draft = {
  name: string;
  flowType: FlowType;
};

const FLOW_LABELS: Record<FlowType, string> = {
  income: "入金",
  expense: "出金",
  both: "入金・出金",
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
    {
      enabled: open,
    }
  );
  const [newName, setNewName] = useState("");
  const [newFlowType, setNewFlowType] = useState<FlowType>("expense");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  useEffect(() => {
    if (!definitionsQuery.data) return;
    setDrafts(
      Object.fromEntries(
        definitionsQuery.data.map(item => [
          item.id,
          { name: item.name, flowType: item.flowType as FlowType },
        ])
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
      toast.success("分类已添加");
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.cashflow.updateCategoryDefinition.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("分类已更新");
    },
    onError: error => toast.error(error.message),
  });

  const categories = definitionsQuery.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>现金流分类管理</DialogTitle>
          <DialogDescription>
            用户提供的32个日文分类作为系统字段保留；可以新增、修改或停用自定义分类。停用不会删除历史流水。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <section className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold">手动添加分类字段</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
              <Input
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="输入新的日文或中文分类名称"
                maxLength={100}
              />
              <Select
                value={newFlowType}
                onValueChange={value => setNewFlowType(value as FlowType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">入金</SelectItem>
                  <SelectItem value="expense">出金</SelectItem>
                  <SelectItem value="both">入金・出金</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name: newName.trim(),
                    flowType: newFlowType,
                  })
                }
                disabled={!newName.trim() || createMutation.isPending}
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
            ) : (
              <div className="space-y-2">
                {categories.map((item, index) => {
                  const draft = drafts[item.id] || {
                    name: item.name,
                    flowType: item.flowType as FlowType,
                  };
                  const isCustom = !item.isSystem && !item.isLegacy;
                  return (
                    <div
                      key={`${item.id}-${item.name}`}
                      className={`grid items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[36px_1fr_130px_90px_150px] ${item.isActive ? "bg-white" : "bg-slate-100 opacity-70"}`}
                    >
                      <span className="text-center text-xs tabular-nums text-slate-400">
                        {index + 1}
                      </span>
                      {isCustom ? (
                        <Input
                          value={draft.name}
                          onChange={event =>
                            setDrafts(current => ({
                              ...current,
                              [item.id]: { ...draft, name: event.target.value },
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
                          {item.isLegacy && (
                            <p className="text-[11px] text-amber-600">
                              历史分类，仅用于保留旧流水
                            </p>
                          )}
                        </div>
                      )}
                      {isCustom ? (
                        <Select
                          value={draft.flowType}
                          onValueChange={value =>
                            setDrafts(current => ({
                              ...current,
                              [item.id]: {
                                ...draft,
                                flowType: value as FlowType,
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">入金</SelectItem>
                            <SelectItem value="expense">出金</SelectItem>
                            <SelectItem value="both">入金・出金</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-slate-600">
                          {FLOW_LABELS[item.flowType as FlowType]}
                        </span>
                      )}
                      <Badge variant="outline" className="w-fit text-[11px]">
                        {item.usageCount}笔
                      </Badge>
                      <div className="flex justify-end gap-2">
                        {item.isSystem ? (
                          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                            系统字段
                          </Badge>
                        ) : item.isLegacy ? (
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
                                  flowType: draft.flowType,
                                })
                              }
                              disabled={
                                !draft.name.trim() || updateMutation.isPending
                              }
                            >
                              <Save className="mr-1 h-3.5 w-3.5" />
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateMutation.mutate({
                                  id: item.id,
                                  isActive: !item.isActive,
                                })
                              }
                              disabled={updateMutation.isPending}
                            >
                              {item.isActive ? "停用" : "启用"}
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
