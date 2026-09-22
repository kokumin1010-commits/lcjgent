import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ImportRow = {
  sourceKey: string;
  sourceSheet: string | null;
  sourceRow: number;
  displayName: string;
  platform: string;
  handle: string | null;
  profileUrl: string | null;
  followerCount: number | null;
  category: string | null;
  country: string | null;
  language: string | null;
  contactInfo: string | null;
  ownerStaffId?: number | null;
  ownerStaffName: string | null;
  status: string;
  notes: string | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  existingCreatorId?: number | null;
  existingCreatorName?: string | null;
  eligible: boolean;
};

export type CreatorImportPreview = {
  version: "influencer-creator-import-v1";
  sourceType: "image" | "spreadsheet";
  fileName: string;
  sheetName: string | null;
  model: string | null;
  deterministic: boolean;
  rows: ImportRow[];
  warnings: string[];
  totalSourceRows: number;
  truncated: boolean;
  previewToken: string | null;
  previewExpiresAt: string | null;
};

export function CreatorImportPreviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CreatorImportPreview | null;
  selectedKeys: Set<string>;
  onSelectedKeysChange: (keys: Set<string>) => void;
  isAdmin: boolean;
  staff: Array<{ id: number; name: string }>;
  defaultOwnerStaffId: string;
  onDefaultOwnerStaffIdChange: (value: string) => void;
  importing: boolean;
  onImport: () => void;
  L: (zh: string, ja: string) => string;
}) {
  const { preview, selectedKeys, L } = props;
  const statusLabel: Record<string, string> = {
    potential: L("潜在", "候補"),
    contacting: L("联络中", "連絡中"),
    replied: L("已回复", "返信あり"),
    interested: L("感兴趣", "興味あり"),
    sample: L("样品中", "サンプル進行"),
    negotiating: L("商谈中", "商談中"),
    cooperating: L("合作", "提携中"),
    paused: L("暂缓", "保留"),
    rejected: L("拒绝", "お断り"),
  };
  const confidenceLabel = { high: L("高", "高"), medium: L("中", "中"), low: L("低", "低") };
  const eligibleRows = preview?.rows.filter(row => row.eligible) || [];
  const selectedCount = eligibleRows.filter(row => selectedKeys.has(row.sourceKey)).length;

  const toggleRow = (sourceKey: string, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(sourceKey);
    else next.delete(sourceKey);
    props.onSelectedKeysChange(next);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-slate-200 px-5 py-4 md:px-6">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            {preview?.sourceType === "image"
              ? L("达人截图识别预览", "クリエイター画像の認識プレビュー")
              : L("达人表格识别预览", "クリエイター表の認識プレビュー")}
          </DialogTitle>
          <DialogDescription>
            {L("先确认、勾选，再批量导入。没有勾选的行和系统重复账号不会写入。", "確認・選択してから一括登録します。未選択行と重複アカウントは保存されません。")}
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4 md:px-6">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><span className="text-slate-500">{L("文件", "ファイル")}</span><div className="mt-1 truncate font-medium" title={preview.fileName}>{preview.fileName}</div></div>
              <div><span className="text-slate-500">{L("工作表", "シート")}</span><div className="mt-1 font-medium">{preview.sheetName || "—"}</div></div>
              <div><span className="text-slate-500">{L("识别方式", "認識方法")}</span><div className="mt-1 flex items-center gap-2 font-medium">{preview.deterministic ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Sparkles className="h-4 w-4 text-indigo-600" />}{preview.deterministic ? L("标准表头精确识别", "標準列の確定解析") : `AI · ${preview.model}`}</div></div>
              <div><span className="text-slate-500">{L("识别结果", "認識結果")}</span><div className="mt-1 font-medium">{L(`${preview.rows.length}行／已选${selectedCount}行`, `${preview.rows.length}件／${selectedCount}件選択`)}</div></div>
            </div>

            {(preview.warnings.length > 0 || preview.truncated) && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{L("请注意", "確認事項")}</AlertTitle>
                <AlertDescription>{preview.warnings.join("；")}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-700">{L("请逐行确认并勾选要导入的达人", "内容を確認し、登録する行を個別に選択してください")}</div>
              {props.isAdmin && (
                <div className="flex min-w-[260px] items-center gap-2">
                  <span className="whitespace-nowrap text-sm text-slate-500">{L("未匹配负责人统一设为", "未照合担当者")}</span>
                  <Select value={props.defaultOwnerStaffId || "none"} onValueChange={value => props.onDefaultOwnerStaffIdChange(value === "none" ? "" : value)}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{L("保持未分配", "未割当のまま")}</SelectItem>
                      {props.staff.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto md:hidden">
              {preview.rows.map(row => (
                <label key={row.sourceKey} className={`block rounded-xl border p-3 ${row.eligible ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox className="mt-1 shrink-0" disabled={!row.eligible} checked={row.eligible && selectedKeys.has(row.sourceKey)} onCheckedChange={value => toggleRow(row.sourceKey, Boolean(value))} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div><div className="font-semibold text-slate-900">{row.displayName || "—"}</div><div className="break-all text-xs text-slate-500">{row.handle ? `@${row.handle}` : L("账号缺失", "IDなし")}</div></div>
                        <Badge variant="outline">{row.platform}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-slate-500">{L("来源", "行")}</span><div>{row.sourceSheet || "—"} #{row.sourceRow}</div></div>
                        <div><span className="text-slate-500">{L("粉丝", "フォロワー")}</span><div>{row.followerCount == null ? "—" : row.followerCount.toLocaleString()}</div></div>
                        <div><span className="text-slate-500">{L("类目", "カテゴリ")}</span><div>{row.category || "—"}</div></div>
                        <div><span className="text-slate-500">{L("联系方式", "連絡先")}</span><div className="break-words">{row.contactInfo || "—"}</div></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1"><Badge variant="outline">{statusLabel[row.status] || row.status}</Badge><Badge variant="secondary">{L("置信度", "信頼度")} {confidenceLabel[row.confidence]}</Badge></div>
                      {row.existingCreatorId && <div className="mt-2 text-xs font-medium text-rose-600">{L("系统已存在", "登録済み")}: {row.existingCreatorName} #{row.existingCreatorId}</div>}
                      {row.warnings.length > 0 && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">{row.warnings.join("；")}</div>}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="hidden min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 md:block">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs text-slate-500">
                  <tr>
                    <th className="w-12 px-3 py-3"></th>
                    <th className="px-3 py-3">{L("来源", "行")}</th>
                    <th className="px-3 py-3">{L("达人/账号", "クリエイター")}</th>
                    <th className="px-3 py-3">{L("平台", "プラットフォーム")}</th>
                    <th className="px-3 py-3">{L("粉丝", "フォロワー")}</th>
                    <th className="px-3 py-3">{L("类目", "カテゴリ")}</th>
                    <th className="px-3 py-3">{L("联系方式", "連絡先")}</th>
                    <th className="px-3 py-3">{L("负责人", "担当")}</th>
                    <th className="px-3 py-3">{L("状态/确认", "状態・確認")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(row => (
                    <tr key={row.sourceKey} className={`border-t border-slate-100 align-top ${row.eligible ? "bg-white" : "bg-slate-50 text-slate-400"}`}>
                      <td className="px-3 py-3"><Checkbox disabled={!row.eligible} checked={row.eligible && selectedKeys.has(row.sourceKey)} onCheckedChange={value => toggleRow(row.sourceKey, Boolean(value))} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs">{row.sourceSheet || "—"} #{row.sourceRow}</td>
                      <td className="px-3 py-3"><div className="font-semibold text-slate-900">{row.displayName || "—"}</div><div className="text-xs text-slate-500">{row.handle ? `@${row.handle}` : L("账号缺失", "IDなし")}</div></td>
                      <td className="px-3 py-3">{row.platform}</td>
                      <td className="px-3 py-3">{row.followerCount == null ? "—" : row.followerCount.toLocaleString()}</td>
                      <td className="max-w-[180px] px-3 py-3"><div className="line-clamp-2">{row.category || "—"}</div></td>
                      <td className="max-w-[180px] px-3 py-3"><div className="line-clamp-2">{row.contactInfo || "—"}</div></td>
                      <td className="px-3 py-3">{row.ownerStaffName || L("未分配", "未割当")}</td>
                      <td className="max-w-[260px] px-3 py-3">
                        <div className="flex flex-wrap gap-1"><Badge variant="outline">{statusLabel[row.status] || row.status}</Badge><Badge variant="secondary">{L("置信度", "信頼度")} {confidenceLabel[row.confidence]}</Badge></div>
                        {row.existingCreatorId && <div className="mt-2 text-xs font-medium text-rose-600">{L("系统已存在", "登録済み")}: {row.existingCreatorName} #{row.existingCreatorId}</div>}
                        {row.warnings.length > 0 && <div className="mt-2 text-xs leading-5 text-amber-700">{row.warnings.join("；")}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">{L("识别只生成草稿，不会自动写入。错误行请取消勾选；导入后仍可逐条编辑。", "認識結果は下書きのみです。誤りのある行は選択解除し、登録後も個別編集できます。")}</p>
          </div>
        )}

        <DialogFooter className="border-t border-slate-200 px-5 py-4 md:px-6">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>{L("取消", "キャンセル")}</Button>
          <Button onClick={props.onImport} disabled={!selectedCount || props.importing}>
            {props.importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {L(`导入选中${selectedCount}位达人`, `選択した${selectedCount}名を登録`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
