import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  CheckCircle2,
  Download,
  FileImage,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ExhibitionBoothMap,
  type BoothMapItem,
} from "@/components/ExhibitionBoothMap";
import { toast } from "sonner";

type PortalTab = "home" | "profile" | "booths" | "assets";

type ProfileForm = {
  brandName: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  websiteUrl: string;
  category: string;
  brandIntro: string;
  mainProducts: string;
  socialUrl: string;
  tiktokUrl: string;
  notes: string;
};

const emptyProfile: ProfileForm = {
  brandName: "",
  companyName: "",
  contactName: "",
  contactPhone: "",
  websiteUrl: "",
  category: "",
  brandIntro: "",
  mainProducts: "",
  socialUrl: "",
  tiktokUrl: "",
  notes: "",
};

const reviewLabels: Record<string, string> = {
  draft: "下書き",
  submitted: "審査中",
  revision_required: "修正依頼",
  approved: "承認済み",
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(
        String(reader.result || "")
          .split(",")
          .pop() || ""
      );
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "confirmed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "revision_required"
        ? "bg-rose-100 text-rose-800"
        : status === "submitted" || status === "pending"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-700";
  return (
    <Badge className={`${tone} border-0`}>
      {reviewLabels[status] ||
        (status === "confirmed"
          ? "確定"
          : status === "selected"
            ? "仮選択"
            : status)}
    </Badge>
  );
}

export default function ExhibitionPortal() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<PortalTab>("home");
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [activeBooth, setActiveBooth] = useState<BoothMapItem | null>(null);
  const me = trpc.exhibitionAuth.me.useQuery(undefined, { retry: false });
  const overview = trpc.exhibitionPortal.overview.useQuery(undefined, {
    enabled: Boolean(me.data),
    retry: false,
  });
  const map = trpc.exhibitionPortal.map.useQuery(undefined, {
    enabled: Boolean(me.data),
    retry: false,
  });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!me.isLoading && !me.data) setLocation("/booth-portal/login");
  }, [me.data, me.isLoading, setLocation]);

  useEffect(() => {
    const profile = overview.data?.profile as any;
    if (!profile) return;
    setProfileForm({
      brandName: profile.brandName || "",
      companyName: profile.companyName || "",
      contactName: profile.contactName || "",
      contactPhone: profile.contactPhone || "",
      websiteUrl: profile.websiteUrl || "",
      category: profile.category || "",
      brandIntro: profile.brandIntro || "",
      mainProducts: profile.mainProducts || "",
      socialUrl: profile.socialUrl || "",
      tiktokUrl: profile.tiktokUrl || "",
      notes: profile.notes || "",
    });
  }, [overview.data?.profile]);

  const refresh = async () => {
    await Promise.all([
      utils.exhibitionPortal.overview.invalidate(),
      utils.exhibitionPortal.map.invalidate(),
      utils.exhibitionAuth.me.invalidate(),
    ]);
  };
  const logout = trpc.exhibitionAuth.logout.useMutation({
    onSuccess: () => setLocation("/booth-portal/login"),
  });
  const saveProfile = trpc.exhibitionPortal.saveProfile.useMutation({
    onSuccess: async () => {
      toast.success("ブランド情報を保存しました");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const submitProfile = trpc.exhibitionPortal.submitProfile.useMutation({
    onSuccess: async () => {
      toast.success("審査へ提出しました");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const selectBooth = trpc.exhibitionPortal.selectBooth.useMutation({
    onSuccess: async data => {
      toast.success(`${data.boothCode} を選択しました`);
      setActiveBooth(null);
      await refresh();
    },
    onError: async error => {
      toast.error(error.message);
      await utils.exhibitionPortal.map.invalidate();
    },
  });
  const releaseBooth = trpc.exhibitionPortal.releaseBooth.useMutation({
    onSuccess: async () => {
      toast.success("展位の仮選択を解除しました");
      setActiveBooth(null);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const uploadAsset = trpc.exhibitionPortal.uploadAsset.useMutation({
    onSuccess: async data => {
      toast.success(`v${data.versionNumber} をアップロードしました`);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const assetDownload = trpc.exhibitionPortal.getAssetDownload.useMutation({
    onSuccess: data => window.open(data.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error(error.message),
  });

  const currentAssets = useMemo(() => {
    const assets = (overview.data?.assets || []) as any[];
    return {
      logo: assets.find(
        asset => asset.assetType === "logo" && Boolean(asset.isCurrent)
      ),
      backdrop: assets.find(
        asset => asset.assetType === "backdrop" && Boolean(asset.isCurrent)
      ),
    };
  }, [overview.data?.assets]);

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    assetType: "logo" | "backdrop"
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024)
      return toast.error("20MB以内のファイルを選択してください");
    try {
      const base64Data = await fileToBase64(file);
      uploadAsset.mutate({
        assetType,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "ファイルを読み込めませんでした"
      );
    }
  };

  if (me.isLoading || (me.data && overview.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f1eb] text-sm text-slate-500">
        ポータルを読み込み中…
      </div>
    );
  }
  if (!me.data || !overview.data) return null;

  const profile = overview.data.profile as any;
  const assignment = overview.data.assignment as any;
  const event = overview.data.event as any;
  const navItems: Array<{
    id: PortalTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: "home", label: "ホーム", icon: LayoutDashboard },
    { id: "profile", label: "ブランド資料", icon: UserRound },
    { id: "booths", label: "展位を選ぶ", icon: MapPinned },
    { id: "assets", label: "Logo・背景板", icon: FileImage },
  ];

  return (
    <div className="min-h-screen bg-[#f3f1eb] text-slate-900">
      <header className="border-b border-white/10 bg-[#102a2d] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-7">
          <button
            type="button"
            onClick={() => setTab("home")}
            className="text-left"
          >
            <div className="text-[10px] font-bold tracking-[.2em] text-[#e8c875]">
              LIVE COMMERCE JAPAN
            </div>
            <div className="mt-1 text-lg font-semibold">
              ブランド展位ポータル
            </div>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{me.data.displayName}</div>
              <div className="text-xs text-white/55">{me.data.companyName}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout.mutate()}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl bg-white p-2 shadow-sm lg:sticky lg:top-6">
          <div className="mb-2 px-3 py-3">
            <div className="text-xs font-semibold text-slate-400">
              {event.name}
            </div>
            <div className="mt-1 text-base font-semibold text-[#102a2d]">
              {profile.brandName}
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${tab === item.id ? "bg-[#102a2d] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {tab === "home" && (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[28px] bg-[#102a2d] p-7 text-white shadow-xl sm:p-10">
                <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <div className="text-xs font-bold tracking-[.18em] text-[#e8c875]">
                      WELCOME
                    </div>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                      {profile.brandName}
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">
                      ブランド情報の登録、展位の選択、Logo・背景板の提出をこのページで完了できます。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={profile.reviewStatus} />
                    {assignment && <StatusBadge status={assignment.status} />}
                  </div>
                </div>
              </section>
              <section className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "ブランド資料",
                    value:
                      profile.reviewStatus === "approved"
                        ? "承認済み"
                        : profile.reviewStatus === "submitted"
                          ? "審査中"
                          : "入力・提出",
                    icon: UserRound,
                    action: () => setTab("profile"),
                  },
                  {
                    title: "選択展位",
                    value: assignment?.boothCode || "未選択",
                    icon: MapPinned,
                    action: () => setTab("booths"),
                  },
                  {
                    title: "提出素材",
                    value: `${Number(Boolean(currentAssets.logo)) + Number(Boolean(currentAssets.backdrop))} / 2`,
                    icon: FileImage,
                    action: () => setTab("assets"),
                  },
                ].map(card => (
                  <button
                    key={card.title}
                    onClick={card.action}
                    className="rounded-2xl border border-white bg-white p-5 text-left shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    <card.icon className="h-6 w-6 text-[#9a7429]" />
                    <div className="mt-5 text-xs font-semibold text-slate-400">
                      {card.title}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-[#102a2d]">
                      {card.value}
                    </div>
                  </button>
                ))}
              </section>
              {profile.reviewNote && (
                <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <div className="font-semibold text-rose-800">
                    管理者からの連絡
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-rose-700">
                    {profile.reviewNote}
                  </p>
                </section>
              )}
            </div>
          )}

          {tab === "profile" && (
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-[#102a2d]">
                    ブランド資料
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    公開・展示に必要な基本情報を登録してください。
                  </p>
                </div>
                <StatusBadge status={profile.reviewStatus} />
              </div>
              <form
                className="mt-8 grid gap-5 md:grid-cols-2"
                onSubmit={event => {
                  event.preventDefault();
                  saveProfile.mutate(profileForm);
                }}
              >
                {[
                  ["brandName", "ブランド名", true],
                  ["companyName", "会社名", true],
                  ["contactName", "担当者名", true],
                  ["contactPhone", "電話番号", false],
                  ["category", "カテゴリ", false],
                  ["websiteUrl", "Webサイト", false],
                  ["socialUrl", "SNS URL", false],
                  ["tiktokUrl", "TikTok URL", false],
                ].map(([key, label, required]) => (
                  <div key={String(key)} className="space-y-2">
                    <Label htmlFor={String(key)}>
                      {label}
                      {required && (
                        <span className="ml-1 text-rose-500">*</span>
                      )}
                    </Label>
                    <Input
                      id={String(key)}
                      required={Boolean(required)}
                      value={profileForm[key as keyof ProfileForm]}
                      onChange={event =>
                        setProfileForm(value => ({
                          ...value,
                          [String(key)]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                {[
                  ["brandIntro", "ブランド紹介 *"],
                  ["mainProducts", "主な商品・サービス"],
                  ["notes", "連絡事項"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2 md:col-span-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Textarea
                      id={key}
                      required={key === "brandIntro"}
                      rows={key === "brandIntro" ? 5 : 3}
                      value={profileForm[key as keyof ProfileForm]}
                      onChange={event =>
                        setProfileForm(value => ({
                          ...value,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <Button
                    type="submit"
                    disabled={saveProfile.isPending}
                    className="bg-[#102a2d]"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    保存
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitProfile.isPending}
                    onClick={() => submitProfile.mutate()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    審査へ提出
                  </Button>
                </div>
              </form>
            </section>
          )}

          {tab === "booths" && (
            <section className="rounded-[28px] bg-white p-4 shadow-sm sm:p-7">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-[#102a2d]">
                    展位を選ぶ
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">
                    空いている展位を押して詳細を確認し、選択してください。
                  </p>
                </div>
                {assignment && (
                  <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                    現在：{assignment.boothCode} ·{" "}
                    {assignment.status === "confirmed" ? "確定" : "仮選択"}
                  </div>
                )}
              </div>
              {map.data ? (
                <ExhibitionBoothMap
                  imageUrl={map.data.event.floorMapUrl}
                  mapWidth={Number(map.data.event.floorMapWidth)}
                  mapHeight={Number(map.data.event.floorMapHeight)}
                  booths={map.data.booths as BoothMapItem[]}
                  activeBoothId={activeBooth?.id}
                  onBoothClick={setActiveBooth}
                />
              ) : (
                <div className="py-20 text-center text-sm text-slate-500">
                  マップを読み込み中…
                </div>
              )}
              {activeBooth && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold tracking-widest text-slate-400">
                        BOOTH
                      </div>
                      <div className="mt-1 text-2xl font-bold text-[#102a2d]">
                        {activeBooth.boothCode}
                      </div>
                      {activeBooth.occupant?.brandName && (
                        <div className="mt-3 flex items-center gap-3">
                          {activeBooth.occupant.logoUrl && (
                            <img
                              src={activeBooth.occupant.logoUrl}
                              alt=""
                              className="h-10 w-10 rounded-lg border bg-white object-contain"
                            />
                          )}
                          <div>
                            <div className="font-semibold">
                              {activeBooth.occupant.brandName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {activeBooth.occupant.category}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveBooth(null)}
                    >
                      閉じる
                    </Button>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {activeBooth.occupancy === "available" &&
                      Boolean(activeBooth.userSelectable) &&
                      activeBooth.status === "available" && (
                        <Button
                          disabled={selectBooth.isPending}
                          onClick={() =>
                            selectBooth.mutate({ boothId: activeBooth.id })
                          }
                          className="bg-[#102a2d]"
                        >
                          この展位を選択
                        </Button>
                      )}
                    {activeBooth.occupancy === "mine" &&
                      assignment?.status !== "confirmed" && (
                        <Button
                          variant="destructive"
                          disabled={releaseBooth.isPending}
                          onClick={() =>
                            releaseBooth.mutate({
                              reason: "ブランド担当者による仮選択解除",
                            })
                          }
                        >
                          仮選択を解除
                        </Button>
                      )}
                    {activeBooth.occupancy === "occupied" && (
                      <span className="text-sm font-medium text-rose-700">
                        選択済みです
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "assets" && (
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-8">
              <div>
                <h1 className="text-2xl font-semibold text-[#102a2d]">
                  Logo・ブランド背景板
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  同じ種類を再アップロードすると新しいバージョンになります。過去版も履歴として保存されます。
                </p>
              </div>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                {(["logo", "backdrop"] as const).map(type => {
                  const asset = currentAssets[type];
                  const title =
                    type === "logo" ? "ブランド Logo" : "ブランド背景板";
                  const accept =
                    type === "logo"
                      ? "image/jpeg,image/png,image/webp"
                      : "image/jpeg,image/png,image/webp,application/pdf";
                  return (
                    <div
                      key={type}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {type === "logo" ? (
                            <FileImage className="h-7 w-7 text-[#9a7429]" />
                          ) : (
                            <FileText className="h-7 w-7 text-[#9a7429]" />
                          )}
                          <h2 className="mt-4 text-lg font-semibold">
                            {title}
                          </h2>
                        </div>
                        {asset && <StatusBadge status={asset.reviewStatus} />}
                      </div>
                      {asset ? (
                        <div className="mt-5 rounded-xl bg-slate-50 p-4">
                          <div className="truncate text-sm font-medium">
                            {asset.originalFileName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            v{asset.versionNumber} ·{" "}
                            {(Number(asset.fileSize) / 1024 / 1024).toFixed(2)}{" "}
                            MB
                          </div>
                          {asset.reviewNote && (
                            <p className="mt-3 text-xs leading-5 text-rose-600">
                              {asset.reviewNote}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() =>
                              assetDownload.mutate({
                                assetId: Number(asset.id),
                              })
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            表示・ダウンロード
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">
                          未提出
                        </div>
                      )}
                      <Label className="mt-5 flex cursor-pointer items-center justify-center rounded-xl bg-[#102a2d] px-4 py-3 text-sm font-semibold text-white hover:bg-[#173b3f]">
                        <Upload className="mr-2 h-4 w-4" />
                        {asset
                          ? "新バージョンをアップロード"
                          : "ファイルをアップロード"}
                        <input
                          type="file"
                          accept={accept}
                          className="sr-only"
                          disabled={uploadAsset.isPending}
                          onChange={event => handleUpload(event, type)}
                        />
                      </Label>
                      <p className="mt-2 text-xs text-slate-400">
                        {type === "logo"
                          ? "JPEG / PNG / WEBP、5MB以内"
                          : "JPEG / PNG / WEBP / PDF、20MB以内"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 rounded-2xl bg-[#f4efe3] p-5">
                <div className="flex items-center gap-2 font-semibold text-[#6d541f]">
                  <ShieldCheck className="h-5 w-5" />
                  安全な保管と閲覧
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  素材は非公開オブジェクトとして保存され、ログイン済みのブランド担当者本人と権限を持つ
                  LCJ 管理者のみが期限付きリンクで閲覧できます。
                </p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
