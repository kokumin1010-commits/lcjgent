import { useEffect, useRef, useState } from "react";
import { CalendarDays, Download, Eye, FileText, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TeamCode = "china" | "japan";
type Language = "ja-JP" | "zh-CN";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function friendlyDocumentError(error: unknown, language: Language): string {
  const value = error instanceof Error ? error.message : String(error || "");
  const zh = language === "zh-CN";
  if (value.includes("MORNING-DOCUMENT-SIZE") || value.includes("MORNING_DOCUMENT_TOO_LARGE")) {
    return zh ? "早会资料最大支持20MB。" : "早会資料は最大20MBです。";
  }
  if (value.includes("MORNING-DOCUMENT-DUPLICATE")) {
    return zh ? "该团队当天已经导入过同一份资料。" : "このチームの同じ日付に同一資料が登録済みです。";
  }
  if (value.includes("MORNING-DOCUMENT-FORBIDDEN")) {
    return zh ? "你没有权限管理该团队的早会资料。" : "このチームの早会資料を管理する権限がありません。";
  }
  if (value.includes("MORNING-DOCUMENT") || value.trim().startsWith("[{")) {
    return zh
      ? "资料无法解析。请确认文件为DOCX、PDF、TXT或Markdown，并重新上传。"
      : "資料を解析できません。DOCX、PDF、TXT、Markdownを確認して再アップロードしてください。";
  }
  return value || (zh ? "早会资料上传失败，请重试。" : "早会資料のアップロードに失敗しました。再試行してください。");
}

export function MorningMeetingDocuments({
  date,
  teamCode,
  language,
  enabled,
  allowUpload = true,
  search,
}: {
  date?: string;
  teamCode: TeamCode;
  language: Language;
  enabled: boolean;
  allowUpload?: boolean;
  search?: string;
}) {
  const zh = language === "zh-CN";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedUploadDate, setSelectedUploadDate] = useState(date || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const activeDate = allowUpload ? selectedUploadDate : date;
  useEffect(() => {
    if (date) setSelectedUploadDate(date);
  }, [date]);
  const documentsQuery = trpc.morningMeeting.getDocuments.useQuery({
    teamCode,
    ...(activeDate ? { dateFrom: activeDate, dateTo: activeDate } : {}),
    ...(search?.trim() ? { search: search.trim() } : {}),
    limit: activeDate ? 20 : 50,
    offset: 0,
  }, { enabled: enabled && (!allowUpload || Boolean(activeDate)) });
  const previewQuery = trpc.morningMeeting.getDocumentPreview.useQuery({
    id: selectedDocumentId || 0,
  }, { enabled: Boolean(selectedDocumentId) });
  const deleteMutation = trpc.morningMeeting.deleteDocument.useMutation({
    onSuccess: async () => {
      setSelectedDocumentId(null);
      await documentsQuery.refetch();
    },
  });

  if (!enabled) return null;

  const handleUpload = async (file: File | null) => {
    if (!file || !activeDate || !allowUpload) return;
    setError(null);
    if (file.size > 20 * 1024 * 1024) {
      setError(zh ? "早会资料最大支持20MB。" : "早会資料は最大20MBです。");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["docx", "pdf", "txt", "md"].includes(extension)) {
      setError(zh ? "仅支持DOCX、PDF、TXT和Markdown。" : "DOCX、PDF、TXT、Markdownのみ対応しています。");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file, file.name);
      const response = await fetch(`/api/morning-meeting/document-upload?date=${encodeURIComponent(activeDate)}&teamCode=${encodeURIComponent(teamCode)}`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.document?.id) {
        throw new Error(`${String(payload?.errorCode || `MORNING-DOCUMENT-HTTP-${response.status}`)}:${String(payload?.error || "")}`);
      }
      await documentsQuery.refetch();
      setSelectedDocumentId(Number(payload.document.id));
    } catch (uploadError) {
      setError(friendlyDocumentError(uploadError, language));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (id: number) => {
    setError(null);
    try {
      const result = await utils.morningMeeting.getDocumentDownloadUrl.fetch({ id });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(friendlyDocumentError(downloadError, language));
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(zh
      ? "确定删除这份早会资料吗？录音和正式日报不会被删除。"
      : "この早会資料を削除しますか？録音と正式な日報は削除されません。");
    if (!confirmed) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (deleteError) {
      setError(friendlyDocumentError(deleteError, language));
    }
  };

  const documents = documentsQuery.data?.records || [];
  const preview = previewQuery.data;

  return (
    <section className="w-full rounded-2xl border border-blue-200 bg-blue-50/70 p-4" aria-label={zh ? "早会资料" : "早会資料"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 text-blue-700" />
            <h3 className="font-black text-blue-950">{allowUpload ? (zh ? "导入早会资料" : "早会資料を導入") : activeDate ? (zh ? "当天早会资料" : "当日の早会資料") : (zh ? "早会资料记录" : "早会資料記録")}</h3>
            <Badge variant="outline" className="border-blue-200 bg-white text-blue-700">{documents.length}/10</Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-blue-800">
            {allowUpload
              ? (zh
                ? "选择日期后导入DOCX、PDF、TXT或Markdown（最大20MB）。同日有团队录音时自动关联，没有录音时作为独立早会资料保存。"
                : "日付を選んでDOCX、PDF、TXT、Markdown（最大20MB）を導入します。同日の録音があれば自動関連付けし、なければ独立資料として保存します。")
              : activeDate
                ? (zh ? "与该团队所选日期关联的会议资料。" : "このチームの選択日に関連する会議資料です。")
                : (zh
                ? "按日期保存的会议资料。资料与录音、转写和正式日报分开管理。"
                : "日付別に保存された会議資料です。録音・文字起こし・正式日報とは分離して管理します。")}
          </p>
        </div>
        {allowUpload && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <label className="flex w-full items-center gap-2 text-xs font-bold text-blue-900 sm:w-auto">
              <CalendarDays className="h-4 w-4" />
              <span>{zh ? "资料日期" : "資料日付"}</span>
              <input
                type="date"
                value={selectedUploadDate}
                disabled={uploading}
                onChange={(event) => {
                  setSelectedUploadDate(event.target.value);
                  setSelectedDocumentId(null);
                  setError(null);
                }}
                className="min-h-9 min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-sm text-gray-900 sm:w-36"
                aria-label={zh ? "选择早会资料日期" : "早会資料の日付を選択"}
              />
            </label>
            <div>
              <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
              disabled={uploading || !activeDate || documents.length >= 10}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? (zh ? "解析并保存中..." : "解析・保存中...") : (zh ? "选择文档" : "文書を選択")}
            </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {documentsQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin" />{zh ? "正在读取资料..." : "資料を読み込み中..."}</div>
      ) : documents.length > 0 ? (
        <div className="mt-4 space-y-2">
          {documents.map((document) => (
            <div key={document.id} className="rounded-xl border border-blue-100 bg-white p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-gray-900">{document.fileName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <span>{!activeDate ? `${document.date} · ` : ""}{formatBytes(document.fileSize)} · {document.extractedChars.toLocaleString()}{zh ? "字" : "文字"} · {document.createdByName}
                    {document.textTruncated ? ` · ${zh ? "预览已截取" : "プレビュー省略あり"}` : ""}</span>
                    <Badge variant="outline" className={document.associationType === "recording" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                      {document.associationType === "recording" ? <Link2 className="mr-1 h-3 w-3" /> : <FileText className="mr-1 h-3 w-3" />}
                      {document.associationType === "recording"
                        ? (zh ? "已关联当天录音" : "当日の録音に関連済み")
                        : (zh ? "独立早会资料" : "独立した早会資料")}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedDocumentId(selectedDocumentId === document.id ? null : document.id)}>
                    <Eye className="mr-1.5 h-4 w-4" />{zh ? "预览" : "プレビュー"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleDownload(document.id)}>
                    <Download className="mr-1.5 h-4 w-4" />{zh ? "下载" : "ダウンロード"}
                  </Button>
                  {document.canDelete && (
                    <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={deleteMutation.isPending} onClick={() => void handleDelete(document.id)}>
                      <Trash2 className="mr-1.5 h-4 w-4" />{zh ? "删除" : "削除"}
                    </Button>
                  )}
                </div>
              </div>
              {selectedDocumentId === document.id && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {previewQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />{zh ? "正在生成预览..." : "プレビューを読み込み中..."}</div>
                  ) : preview ? (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <Badge variant="outline" className="bg-white">{preview.date}</Badge>
                        <Badge variant="outline" className={preview.associationType === "recording" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                          {preview.associationType === "recording"
                            ? (zh ? "跟随当天录音" : "当日の録音に関連")
                            : (zh ? "独立早会资料" : "独立した早会資料")}
                        </Badge>
                        <span>·</span>
                        <strong className="text-blue-700">{zh ? "不会覆盖录音或正式日报" : "録音・正式日報を上書きしません"}</strong>
                      </div>
                      <div className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{preview.extractedText}</div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">{zh ? "无法读取预览。" : "プレビューを取得できません。"}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-blue-200 bg-white/70 px-3 py-4 text-center text-sm text-blue-700">
          {activeDate
            ? (zh ? "该团队在所选日期还没有导入会议资料。" : "このチームの選択日には会議資料がまだありません。")
            : (zh ? "该团队还没有会议资料记录。" : "このチームの会議資料記録はまだありません。")}
        </p>
      )}
    </section>
  );
}
