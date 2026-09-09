import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardPaste } from "lucide-react";
import { useMemo, useState } from "react";
import {
  parseLivestreamSetBulkPaste,
  type LivestreamSetBulkPasteItem,
} from "../../../shared/livestreamSetBulkPaste";

type Language = "ja" | "zh" | "zh-TW" | "en";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (items: LivestreamSetBulkPasteItem[]) => void;
  language?: Language;
};

const copy = {
  ja: {
    title: "商品一括貼り付け",
    description: "商品名、数量、単価をTab・2つ以上の空白・カンマで区切り、1商品ずつ改行して貼り付けてください。",
    example: "例: シグネチャーアイマスク　　1　　1,682",
    placeholder: "商品名　数量　単価（1商品につき1行）",
    recognized: "識別結果",
    ignored: "行を確認できませんでした",
    empty: "識別できる商品がありません",
    cancel: "キャンセル",
    apply: "追加",
    unit: "件",
  },
  zh: {
    title: "批量粘贴套餐商品",
    description: "每行一个商品；商品名、数量、单价可用Tab、两个以上空格或逗号分隔。",
    example: "例：商品名称　　1　　1,682",
    placeholder: "商品名称　数量　单价（每行一个商品）",
    recognized: "识别结果",
    ignored: "行无法识别",
    empty: "没有可识别的商品",
    cancel: "取消",
    apply: "添加",
    unit: "件",
  },
  "zh-TW": {
    title: "批量貼上套組商品",
    description: "每行一個商品；商品名稱、數量、單價可用Tab、兩個以上空格或逗號分隔。",
    example: "例：商品名稱　　1　　1,682",
    placeholder: "商品名稱　數量　單價（每行一個商品）",
    recognized: "識別結果",
    ignored: "行無法識別",
    empty: "沒有可識別的商品",
    cancel: "取消",
    apply: "新增",
    unit: "件",
  },
  en: {
    title: "Bulk paste set products",
    description: "Paste one product per line. Separate name, quantity and unit price with a tab, two spaces or commas.",
    example: "Example: Product name    1    1,682",
    placeholder: "Product name  Quantity  Unit price (one per line)",
    recognized: "Recognized",
    ignored: "line(s) could not be read",
    empty: "No recognizable products",
    cancel: "Cancel",
    apply: "Add",
    unit: "item(s)",
  },
} as const;

export function LivestreamSetBulkPasteDialog({
  open,
  onOpenChange,
  onApply,
  language = "ja",
}: Props) {
  const [text, setText] = useState("");
  const labels = copy[language] || copy.ja;
  const parsed = useMemo(() => parseLivestreamSetBulkPaste(text), [text]);

  const close = () => {
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-gray-700 bg-gray-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ClipboardPaste className="h-4 w-4 text-purple-400" />
            {labels.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-gray-300">{labels.description}</p>
          <div className="rounded bg-gray-800 p-2 font-mono text-xs text-gray-300">{labels.example}</div>
          <Textarea
            aria-label={labels.title}
            placeholder={labels.placeholder}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-[150px] border-gray-700 bg-gray-800 font-mono text-sm text-white"
          />
          {text.trim() ? (
            parsed.items.length > 0 ? (
              <div className="text-xs text-gray-300">
                {labels.recognized}: <span className="font-bold text-purple-300">{parsed.items.length}{labels.unit}</span>
                {parsed.ignoredLineCount > 0 ? <span className="ml-2 text-amber-300">{parsed.ignoredLineCount}{labels.ignored}</span> : null}
              </div>
            ) : (
              <div className="text-xs text-red-300">{labels.empty}</div>
            )
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={close} className="border-gray-600 text-gray-200">
            {labels.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (parsed.items.length === 0) return;
              onApply(parsed.items);
              close();
            }}
            disabled={parsed.items.length === 0}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            {labels.apply} ({parsed.items.length}{labels.unit})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
