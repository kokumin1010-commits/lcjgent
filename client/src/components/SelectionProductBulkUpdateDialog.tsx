import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type SelectionProductBulkPatch = {
  price?: number;
  marketPrice?: number;
  historicalLowestPrice?: number;
  stock?: number;
  commission?: { type: "percentage" | "fixed"; value: number };
  status?: "draft" | "online" | "offline";
};

type FieldKey = "price" | "marketPrice" | "historicalLowestPrice" | "stock" | "commission" | "status";

type Props = {
  open: boolean;
  selectedCount: number;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { requestId: string; patch: SelectionProductBulkPatch }) => void;
};

const initialEnabled: Record<FieldKey, boolean> = {
  price: false,
  marketPrice: false,
  historicalLowestPrice: false,
  stock: false,
  commission: false,
  status: false,
};

export default function SelectionProductBulkUpdateDialog({ open, selectedCount, loading, onOpenChange, onSubmit }: Props) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [enabled, setEnabled] = useState(initialEnabled);
  const [price, setPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [historicalLowestPrice, setHistoricalLowestPrice] = useState("");
  const [stock, setStock] = useState("");
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [commissionValue, setCommissionValue] = useState("");
  const [status, setStatus] = useState<"draft" | "online" | "offline">("online");

  useEffect(() => {
    if (!open) return;
    setRequestId(crypto.randomUUID());
    setEnabled(initialEnabled);
    setPrice("");
    setMarketPrice("");
    setHistoricalLowestPrice("");
    setStock("");
    setCommissionType("percentage");
    setCommissionValue("");
    setStatus("online");
  }, [open]);

  const toggle = (key: FieldKey, checked: boolean | "indeterminate") => {
    setEnabled(current => ({ ...current, [key]: checked === true }));
  };

  const positiveMoney = (value: string, label: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label}必须大于0`);
    if (Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-8) throw new Error(`${label}最多保留两位小数`);
    return parsed;
  };

  const submit = () => {
    try {
      const patch: SelectionProductBulkPatch = {};
      if (enabled.price) patch.price = positiveMoney(price, "价格");
      if (enabled.marketPrice) patch.marketPrice = positiveMoney(marketPrice, "市场价");
      if (enabled.historicalLowestPrice) patch.historicalLowestPrice = positiveMoney(historicalLowestPrice, "历史最低价");
      if (enabled.stock) {
        const parsedStock = Number(stock);
        if (!Number.isInteger(parsedStock) || parsedStock < 0) throw new Error("库存必须是0以上的整数");
        patch.stock = parsedStock;
      }
      if (enabled.commission) {
        const parsedCommission = Number(commissionValue);
        const max = commissionType === "percentage" ? 100 : 99_999_999.99;
        if (!Number.isFinite(parsedCommission) || parsedCommission < 0 || parsedCommission > max) {
          throw new Error(commissionType === "percentage" ? "佣金比例必须在0到100之间" : "固定佣金超出允许范围");
        }
        if (Math.abs(parsedCommission * 100 - Math.round(parsedCommission * 100)) > 1e-8) throw new Error("佣金最多保留两位小数");
        patch.commission = { type: commissionType, value: parsedCommission };
      }
      if (enabled.status) patch.status = status;
      if (Object.keys(patch).length === 0) throw new Error("请至少勾选一个要更新的字段");
      if (patch.price !== undefined && patch.historicalLowestPrice !== undefined && patch.historicalLowestPrice > patch.price) {
        throw new Error("历史最低价不能高于当前价格");
      }
      onSubmit({ requestId, patch });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "请检查批量更新内容");
    }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!loading) onOpenChange(nextOpen); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量更新商品 / 商品一括更新</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          已选择 <strong>{selectedCount}</strong> 件主商品。只有勾选的字段会被统一更新，其他信息保持不变。
          <div className="mt-1 text-xs">价格更新会自动追加价格历史；如新价格更低，历史最低价会在同一事务中同步下调。</div>
        </div>

        <div className="space-y-3">
          <BulkField checked={enabled.price} onCheckedChange={checked => toggle("price", checked)} label="价格 / 価格">
            <Input type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="¥" disabled={!enabled.price || loading} />
          </BulkField>
          <BulkField checked={enabled.marketPrice} onCheckedChange={checked => toggle("marketPrice", checked)} label="市场价 / 市場価格">
            <Input type="number" min="0.01" step="0.01" value={marketPrice} onChange={event => setMarketPrice(event.target.value)} placeholder="¥" disabled={!enabled.marketPrice || loading} />
          </BulkField>
          <BulkField checked={enabled.historicalLowestPrice} onCheckedChange={checked => toggle("historicalLowestPrice", checked)} label="新增历史最低价记录 / 最安値履歴を追加">
            <Input type="number" min="0.01" step="0.01" value={historicalLowestPrice} onChange={event => setHistoricalLowestPrice(event.target.value)} placeholder="¥" disabled={!enabled.historicalLowestPrice || loading} />
          </BulkField>
          <BulkField checked={enabled.stock} onCheckedChange={checked => toggle("stock", checked)} label="库存 / 在庫">
            <Input type="number" min="0" step="1" value={stock} onChange={event => setStock(event.target.value)} placeholder="0" disabled={!enabled.stock || loading} />
          </BulkField>
          <BulkField checked={enabled.commission} onCheckedChange={checked => toggle("commission", checked)} label="佣金 / コミッション">
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <Select value={commissionType} onValueChange={value => setCommissionType(value as "percentage" | "fixed")} disabled={!enabled.commission || loading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percentage">比例 (%)</SelectItem><SelectItem value="fixed">固定金额 (¥)</SelectItem></SelectContent>
              </Select>
              <Input type="number" min="0" step="0.01" value={commissionValue} onChange={event => setCommissionValue(event.target.value)} placeholder={commissionType === "percentage" ? "%" : "¥"} disabled={!enabled.commission || loading} />
            </div>
          </BulkField>
          <BulkField checked={enabled.status} onCheckedChange={checked => toggle("status", checked)} label="状态 / ステータス">
            <Select value={status} onValueChange={value => setStatus(value as typeof status)} disabled={!enabled.status || loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="online">已上架 / 公開中</SelectItem><SelectItem value="offline">已下架 / 非公開</SelectItem><SelectItem value="draft">草稿 / 下書き</SelectItem></SelectContent>
            </Select>
          </BulkField>
        </div>

        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>本次更新为全成或全败，并保存更新前后审计记录。历史最低价会追加历史，已有更低记录不会被覆盖或删除。</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={submit} disabled={loading || selectedCount === 0}>{loading ? "更新中..." : `确认更新 ${selectedCount} 件`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkField({ checked, onCheckedChange, label, children }: {
  checked: boolean;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[210px_1fr] sm:items-center">
      <Label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
        <span>{label}</span>
      </Label>
      {children}
    </div>
  );
}
