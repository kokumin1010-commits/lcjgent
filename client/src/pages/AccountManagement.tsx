/**
 * Account/Information Management Page - 账号/信息管理系统
 * 
 * Two tabs:
 * 1. Platform Accounts (各平台账号)
 * 2. Contact Information (联系人信息)
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Plus, Trash2, Edit, Search, Eye, EyeOff,
  KeyRound, Users, Copy, ExternalLink, Globe
} from "lucide-react";
import { toast } from "sonner";

// i18n translations
const translations = {
  ja: {
    title: "アカウント管理",
    tabAccounts: "プラットフォームアカウント",
    tabContacts: "連絡先情報",
    search: "検索...",
    addAccount: "アカウント追加",
    addContact: "連絡先追加",
    platform: "プラットフォーム",
    accountName: "アカウント名",
    accountId: "アカウントID",
    password: "パスワード",
    loginUrl: "ログインURL",
    email: "メール",
    phone: "電話番号",
    responsible: "担当者",
    status: "ステータス",
    expiresAt: "有効期限",
    tags: "タグ",
    notes: "備考",
    actions: "操作",
    active: "有効",
    inactive: "無効",
    expired: "期限切れ",
    suspended: "停止中",
    all: "すべて",
    save: "保存",
    cancel: "キャンセル",
    edit: "編集",
    delete: "削除",
    deleteConfirm: "本当に削除しますか？",
    copied: "コピーしました",
    showPassword: "パスワード表示",
    hidePassword: "パスワード非表示",
    noAccounts: "アカウントがありません",
    noContacts: "連絡先がありません",
    // Contact fields
    category: "カテゴリ",
    companyName: "会社名",
    contactName: "氏名",
    position: "役職",
    wechat: "WeChat",
    lineId: "LINE ID",
    address: "住所",
    brand: "ブランド",
    client: "クライアント",
    partner: "パートナー",
    supplier: "サプライヤー",
    other: "その他",
    totalAccounts: "全アカウント",
    activeAccounts: "有効",
    expiredAccounts: "期限切れ",
    totalContacts: "全連絡先",
  },
  zh: {
    title: "账号管理",
    tabAccounts: "平台账号",
    tabContacts: "联系人信息",
    search: "搜索...",
    addAccount: "添加账号",
    addContact: "添加联系人",
    platform: "平台",
    accountName: "账号名",
    accountId: "账号ID",
    password: "密码",
    loginUrl: "登录链接",
    email: "邮箱",
    phone: "电话",
    responsible: "负责人",
    status: "状态",
    expiresAt: "到期时间",
    tags: "标签",
    notes: "备注",
    actions: "操作",
    active: "正常",
    inactive: "停用",
    expired: "已过期",
    suspended: "已暂停",
    all: "全部",
    save: "保存",
    cancel: "取消",
    edit: "编辑",
    delete: "删除",
    deleteConfirm: "确定要删除吗？",
    copied: "已复制",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    noAccounts: "暂无账号",
    noContacts: "暂无联系人",
    // Contact fields
    category: "分类",
    companyName: "公司名",
    contactName: "姓名",
    position: "职位",
    wechat: "微信",
    lineId: "LINE ID",
    address: "地址",
    brand: "品牌方",
    client: "客户",
    partner: "合作伙伴",
    supplier: "供应商",
    other: "其他",
    totalAccounts: "全部账号",
    activeAccounts: "正常",
    expiredAccounts: "已过期",
    totalContacts: "全部联系人",
  },
};

// Common platforms
const PLATFORMS = [
  "TikTok Shop", "TikTok", "Instagram", "YouTube", "LINE",
  "Twitter/X", "Facebook", "WeChat", "Shopee", "Amazon",
  "楽天", "Yahoo", "その他/Other"
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  expired: "bg-red-100 text-red-800",
  suspended: "bg-yellow-100 text-yellow-800",
};

export default function AccountManagement() {
  const { language } = useLanguage();
  const t = translations[language as "ja" | "zh"] || translations.ja;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6" />
          {t.title}
        </h1>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts" className="flex items-center gap-1.5">
            <KeyRound className="h-4 w-4" />
            {t.tabAccounts}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {t.tabContacts}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountsTab t={t} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Accounts Tab =====
function AccountsTab({ t }: { t: any }) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const accountsQuery = trpc.account.listAccounts.useQuery({
    search: search || undefined,
    platform: platformFilter !== "all" ? platformFilter : undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  });

  const createMutation = trpc.account.createAccount.useMutation({
    onSuccess: () => { accountsQuery.refetch(); setShowDialog(false); toast.success("OK"); },
  });
  const updateMutation = trpc.account.updateAccount.useMutation({
    onSuccess: () => { accountsQuery.refetch(); setEditingAccount(null); toast.success("OK"); },
  });
  const deleteMutation = trpc.account.deleteAccount.useMutation({
    onSuccess: () => { accountsQuery.refetch(); toast.success("OK"); },
  });

  const accounts = accountsQuery.data || [];
  const activeCount = accounts.filter(a => a.status === "active").length;
  const expiredCount = accounts.filter(a => a.status === "expired").length;

  return (
    <div className="space-y-4 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.totalAccounts}</div>
            <div className="text-2xl font-bold">{accounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.activeAccounts}</div>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.expiredAccounts}</div>
            <div className="text-2xl font-bold text-red-600">{expiredCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t.platform} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="active">{t.active}</SelectItem>
            <SelectItem value="inactive">{t.inactive}</SelectItem>
            <SelectItem value="expired">{t.expired}</SelectItem>
            <SelectItem value="suspended">{t.suspended}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> {t.addAccount}
        </Button>
      </div>

      {/* Table */}
      {accountsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t.noAccounts}</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.platform}</TableHead>
                <TableHead>{t.accountName}</TableHead>
                <TableHead>{t.password}</TableHead>
                <TableHead>{t.email}</TableHead>
                <TableHead>{t.responsible}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead>{t.expiresAt}</TableHead>
                <TableHead>{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(account => (
                <AccountRow
                  key={account.id}
                  account={account}
                  t={t}
                  onEdit={() => setEditingAccount(account)}
                  onDelete={() => {
                    if (confirm(t.deleteConfirm)) {
                      deleteMutation.mutate({ id: account.id });
                    }
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <AccountFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        t={t}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editingAccount && (
        <AccountFormDialog
          open={!!editingAccount}
          onOpenChange={(open) => { if (!open) setEditingAccount(null); }}
          t={t}
          initialData={editingAccount}
          onSubmit={(data) => updateMutation.mutate({ id: editingAccount.id, ...data })}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

// Account table row with password show/hide
function AccountRow({ account, t, onEdit, onDelete }: { account: any; t: any; onEdit: () => void; onDelete: () => void }) {
  const [showPw, setShowPw] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t.copied);
  };

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className="font-medium">{account.platform}</Badge>
      </TableCell>
      <TableCell>
        <div className="font-medium">{account.accountName}</div>
        {account.accountId && <div className="text-xs text-muted-foreground">ID: {account.accountId}</div>}
        {account.tags && account.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {account.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell>
        {account.password ? (
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm">
              {showPw ? account.password : "••••••••"}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(account.password)}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="text-sm">{account.email || "-"}</div>
        {account.phone && <div className="text-xs text-muted-foreground">{account.phone}</div>}
      </TableCell>
      <TableCell>{account.responsible || "-"}</TableCell>
      <TableCell>
        <Badge className={STATUS_COLORS[account.status] || ""}>
          {t[account.status] || account.status}
        </Badge>
      </TableCell>
      <TableCell>
        {account.expiresAt ? new Date(account.expiresAt).toLocaleDateString() : "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {account.loginUrl && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(account.loginUrl, "_blank")}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Account form dialog (create/edit)
function AccountFormDialog({ open, onOpenChange, t, initialData, onSubmit, isLoading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
  initialData?: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const getEmptyForm = () => ({
    platform: "",
    accountName: "",
    accountId: "",
    password: "",
    loginUrl: "",
    email: "",
    phone: "",
    responsible: "",
    status: "active",
    expiresAt: "",
    tags: "",
    notes: "",
  });

  const [form, setForm] = useState(() => initialData ? {
    platform: initialData.platform || "",
    accountName: initialData.accountName || "",
    accountId: initialData.accountId || "",
    password: initialData.password || "",
    loginUrl: initialData.loginUrl || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    responsible: initialData.responsible || "",
    status: initialData.status || "active",
    expiresAt: initialData.expiresAt ? new Date(initialData.expiresAt).toISOString().split("T")[0] : "",
    tags: (initialData.tags || []).join(", "),
    notes: initialData.notes || "",
  } : getEmptyForm());

  // Reset form when dialog opens in create mode
  useEffect(() => {
    if (open && !initialData) {
      setForm(getEmptyForm());
    }
  }, [open]);

  const handleSubmit = () => {
    if (!form.platform || !form.accountName) {
      toast.error("Platform and Account Name are required");
      return;
    }
    onSubmit({
      ...form,
      tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
      expiresAt: form.expiresAt || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? t.edit : t.addAccount}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.platform} *</Label>
              <Input value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} placeholder={t.platform} />
            </div>
            <div>
              <Label>{t.status}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t.active}</SelectItem>
                  <SelectItem value="inactive">{t.inactive}</SelectItem>
                  <SelectItem value="expired">{t.expired}</SelectItem>
                  <SelectItem value="suspended">{t.suspended}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t.accountName} *</Label>
            <Input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.accountId}</Label>
              <Input value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} />
            </div>
            <div>
              <Label>{t.password}</Label>
              <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t.loginUrl}</Label>
            <Input value={form.loginUrl} onChange={e => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.email}</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t.phone}</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.responsible}</Label>
              <Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
            </div>
            <div>
              <Label>{t.expiresAt}</Label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t.tags}</Label>
            <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2, ..." />
          </div>
          <div>
            <Label>{t.notes}</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Contacts Tab =====
function ContactsTab({ t }: { t: any }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  const contactsQuery = trpc.account.listContacts.useQuery({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter as any : undefined,
  });

  const createMutation = trpc.account.createContact.useMutation({
    onSuccess: () => { contactsQuery.refetch(); setShowDialog(false); toast.success("OK"); },
  });
  const updateMutation = trpc.account.updateContact.useMutation({
    onSuccess: () => { contactsQuery.refetch(); setEditingContact(null); toast.success("OK"); },
  });
  const deleteMutation = trpc.account.deleteContact.useMutation({
    onSuccess: () => { contactsQuery.refetch(); toast.success("OK"); },
  });

  const contacts = contactsQuery.data || [];

  const CATEGORIES = [
    { value: "brand", label: t.brand },
    { value: "client", label: t.client },
    { value: "partner", label: t.partner },
    { value: "supplier", label: t.supplier },
    { value: "other", label: t.other },
  ];

  return (
    <div className="space-y-4 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.totalContacts}</div>
            <div className="text-2xl font-bold">{contacts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.brand}</div>
            <div className="text-2xl font-bold text-blue-600">{contacts.filter(c => c.category === "brand").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.client}</div>
            <div className="text-2xl font-bold text-purple-600">{contacts.filter(c => c.category === "client").length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t.category} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> {t.addContact}
        </Button>
      </div>

      {/* Table */}
      {contactsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t.noContacts}</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.category}</TableHead>
                <TableHead>{t.contactName}</TableHead>
                <TableHead>{t.companyName}</TableHead>
                <TableHead>{t.email} / {t.phone}</TableHead>
                <TableHead>{t.wechat} / {t.lineId}</TableHead>
                <TableHead>{t.responsible}</TableHead>
                <TableHead>{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map(contact => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Badge variant="outline">{t[contact.category] || contact.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{contact.contactName}</div>
                    {contact.position && <div className="text-xs text-muted-foreground">{contact.position}</div>}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {contact.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{contact.companyName || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm">{contact.email || "-"}</div>
                    {contact.phone && <div className="text-xs text-muted-foreground">{contact.phone}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{contact.wechat || "-"}</div>
                    {contact.lineId && <div className="text-xs text-muted-foreground">LINE: {contact.lineId}</div>}
                  </TableCell>
                  <TableCell>{contact.responsible || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingContact(contact)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                        if (confirm(t.deleteConfirm)) deleteMutation.mutate({ id: contact.id });
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <ContactFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        t={t}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editingContact && (
        <ContactFormDialog
          open={!!editingContact}
          onOpenChange={(open) => { if (!open) setEditingContact(null); }}
          t={t}
          initialData={editingContact}
          onSubmit={(data) => updateMutation.mutate({ id: editingContact.id, ...data })}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

// Contact form dialog
function ContactFormDialog({ open, onOpenChange, t, initialData, onSubmit, isLoading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
  initialData?: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
    const getEmptyForm = () => ({
    category: "client",
    companyName: "",
    contactName: "",
    position: "",
    email: "",
    phone: "",
    wechat: "",
    lineId: "",
    address: "",
    responsible: "",
    status: "active",
    tags: "",
    notes: "",
  });

  const [form, setForm] = useState(() => initialData ? {
    category: initialData.category || "client",
    companyName: initialData.companyName || "",
    contactName: initialData.contactName || "",
    position: initialData.position || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    wechat: initialData.wechat || "",
    lineId: initialData.lineId || "",
    address: initialData.address || "",
    responsible: initialData.responsible || "",
    status: initialData.status || "active",
    tags: (initialData.tags || []).join(", "),
    notes: initialData.notes || "",
  } : getEmptyForm());

  // Reset form when dialog opens in create mode
  useEffect(() => {
    if (open && !initialData) {
      setForm(getEmptyForm());
    }
  }, [open]);

  const handleSubmit = () => {
    if (!form.contactName) {
      toast.error("Contact name is required");
      return;
    }
    onSubmit({
      ...form,
      tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
    });
  };

  const CATEGORIES = [
    { value: "brand", label: t.brand },
    { value: "client", label: t.client },
    { value: "partner", label: t.partner },
    { value: "supplier", label: t.supplier },
    { value: "other", label: t.other },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? t.edit : t.addContact}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.category}</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.status}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t.active}</SelectItem>
                  <SelectItem value="inactive">{t.inactive}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.contactName} *</Label>
              <Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div>
              <Label>{t.companyName}</Label>
              <Input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t.position}</Label>
            <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.email}</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t.phone}</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t.wechat}</Label>
              <Input value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })} />
            </div>
            <div>
              <Label>{t.lineId}</Label>
              <Input value={form.lineId} onChange={e => setForm({ ...form, lineId: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t.address}</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>{t.responsible}</Label>
            <Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
          </div>
          <div>
            <Label>{t.tags}</Label>
            <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2, ..." />
          </div>
          <div>
            <Label>{t.notes}</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
