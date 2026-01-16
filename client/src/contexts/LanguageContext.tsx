import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "ja" | "zh";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Japanese translations
const jaTranslations: Record<string, string> = {
  // Navigation
  "nav.dashboard": "ダッシュボード",
  "nav.tasks": "タスク一覧",
  "nav.reports": "レポート",
  "nav.reportStaff": "レポートスタッフ",
  "nav.staff": "担当者名簿",
  "nav.masterControl": "マスターコントロール",
  "nav.reportAnalysis": "AI分析",
  "nav.logout": "ログアウト",
  
  // Dashboard
  "dashboard.title": "ダッシュボード",
  "dashboard.inProgress": "進行中",
  "dashboard.completed": "完了",
  "dashboard.overdue": "期限切れ",
  "dashboard.pending": "未着手",
  "dashboard.staffList": "担当者一覧",
  "dashboard.recentTasks": "最近のタスク",
  "dashboard.noTasks": "タスクがありません",
  "dashboard.viewAll": "すべて表示",
  "dashboard.createTask": "新規タスク作成",
  
  // Tasks
  "tasks.title": "タスク一覧",
  "tasks.create": "新規タスク作成",
  "tasks.search": "検索",
  "tasks.filter": "フィルター",
  "tasks.status": "ステータス",
  "tasks.staff": "担当者",
  "tasks.deadline": "期限",
  "tasks.detail": "詳細",
  "tasks.noDeadline": "期限なし",
  "tasks.all": "すべて",
  "tasks.statusPending": "未着手",
  "tasks.statusInProgress": "進行中",
  "tasks.statusCompleted": "完了",
  "tasks.statusCancelled": "キャンセル",
  "tasks.clearFilters": "フィルターをクリア",
  "tasks.results": "件が該当しました",
  "tasks.noResults": "該当するタスクがありません",
  
  // Task Create
  "taskCreate.title": "新規タスク作成",
  "taskCreate.screenshots": "スクリーンショット",
  "taskCreate.uploadHint": "最大4枚までアップロード可能",
  "taskCreate.selectStaff": "担当者を選択",
  "taskCreate.deadline": "期限（任意）",
  "taskCreate.notes": "メモ（任意）",
  "taskCreate.submit": "タスクを作成",
  "taskCreate.submitting": "作成中...",
  
  // Task Detail
  "taskDetail.title": "タスク詳細",
  "taskDetail.taskId": "タスクID",
  "taskDetail.status": "ステータス",
  "taskDetail.staff": "担当者",
  "taskDetail.deadline": "期限",
  "taskDetail.createdAt": "作成日時",
  "taskDetail.updatedAt": "更新日時",
  "taskDetail.screenshots": "スクリーンショット",
  "taskDetail.notes": "メモ",
  "taskDetail.sendReminder": "リマインドメール送信",
  "taskDetail.markComplete": "完了にする",
  "taskDetail.reminderHistory": "リマインド履歴",
  "taskDetail.emailOpened": "開封済み",
  "taskDetail.emailNotOpened": "未開封",
  
  // Reports
  "reports.title": "レポート",
  "reports.create": "新規レポートを作成",
  "reports.list": "レポート一覧",
  "reports.staff": "スタッフ",
  "reports.date": "日付",
  "reports.content": "業務内容",
  "reports.issues": "気付き・問題・理由",
  "reports.remarks": "備考",
  "reports.updatedAt": "更新日時",
  "reports.actions": "操作",
  "reports.noReports": "レポートがありません",
  "reports.clearFilters": "フィルターをクリア",
  "reports.results": "件が該当しました",
  "reports.prevMonth": "前月",
  "reports.thisMonth": "今月",
  "reports.days": "日中",
  "reports.country": "国",
  "reports.all": "全て",
  "reports.japan": "日本",
  "reports.china": "中国",
  "reports.notLinked": "未紐付け",
  "reports.noTasks": "タスクなし",
  "reports.deleteConfirm": "レポートを削除しますか？",
  "reports.deleteWarning": "この操作は取り消せません。本当に削除しますか？",
  "reports.cancel": "キャンセル",
  "reports.delete": "削除",
  "reports.deleting": "削除中...",
  
  // Report Form
  "reportForm.createTitle": "新規レポート作成",
  "reportForm.editTitle": "レポート編集",
  "reportForm.staff": "スタッフ",
  "reportForm.selectStaff": "スタッフを選択",
  "reportForm.addNewStaff": "新規スタッフを追加",
  "reportForm.newStaffName": "新規スタッフ名",
  "reportForm.country": "国",
  "reportForm.date": "日付",
  "reportForm.content": "業務内容",
  "reportForm.contentPlaceholder": "今日の業務内容を入力してください",
  "reportForm.issues": "気付き・問題・理由",
  "reportForm.issuesPlaceholder": "気付いたことや問題点を入力してください",
  "reportForm.remarks": "備考",
  "reportForm.remarksPlaceholder": "その他の備考を入力してください",
  "reportForm.submit": "保存",
  "reportForm.submitting": "保存中...",
  "reportForm.back": "戻る",
  
  // Report Staff Management
  "reportStaff.title": "レポートスタッフ管理",
  "reportStaff.description": "日報用のスタッフを管理し、担当者名簿との紐付けを設定します",
  "reportStaff.add": "新規追加",
  "reportStaff.list": "レポートスタッフ一覧",
  "reportStaff.name": "名前",
  "reportStaff.country": "国",
  "reportStaff.linkedStaff": "紐付け担当者",
  "reportStaff.taskProgress": "タスク進捗",
  "reportStaff.status": "ステータス",
  "reportStaff.actions": "操作",
  "reportStaff.notLinked": "未紐付け",
  "reportStaff.active": "有効",
  "reportStaff.inactive": "無効",
  "reportStaff.noStaff": "レポートスタッフがいません",
  "reportStaff.addTitle": "レポートスタッフを追加",
  "reportStaff.editTitle": "レポートスタッフを編集",
  "reportStaff.linkTitle": "担当者との紐付け",
  "reportStaff.linkDescription": "を担当者名簿のスタッフと紐付けます。紐付けると、日報からタスクの進捗を確認できるようになります。",
  "reportStaff.selectLinkedStaff": "紐付ける担当者",
  "reportStaff.noLink": "紐付けなし",
  "reportStaff.save": "保存",
  "reportStaff.saving": "保存中...",
  "reportStaff.saveLink": "紐付けを保存",
  "reportStaff.cancel": "キャンセル",
  "reportStaff.deleteConfirm": "このレポートスタッフを削除しますか？関連する日報も削除される可能性があります。",
  "reportStaff.loading": "読込中...",
  "reportStaff.noTasks": "タスクなし",
  
  // Staff Management
  "staffMgmt.title": "担当者名簿",
  "staffMgmt.add": "新規追加",
  "staffMgmt.name": "名前",
  "staffMgmt.email": "メールアドレス",
  "staffMgmt.department": "部署",
  "staffMgmt.country": "国",
  "staffMgmt.status": "ステータス",
  "staffMgmt.actions": "操作",
  "staffMgmt.active": "有効",
  "staffMgmt.inactive": "無効",
  "staffMgmt.noStaff": "担当者がいません",
  "staffMgmt.addTitle": "担当者を追加",
  "staffMgmt.editTitle": "担当者を編集",
  "staffMgmt.save": "保存",
  "staffMgmt.saving": "保存中...",
  "staffMgmt.cancel": "キャンセル",
  "staffMgmt.deleteConfirm": "この担当者を削除しますか？",
  
  // Login
  "login.title": "ログイン",
  "login.subtitle": "業務自動化システムにログイン",
  "login.email": "メールアドレス",
  "login.password": "パスワード",
  "login.submit": "ログイン",
  "login.submitting": "ログイン中...",
  "login.register": "新規登録はこちら",
  "login.error": "ログインに失敗しました",
  
  // Register
  "register.title": "新規登録",
  "register.subtitle": "アカウントを作成",
  "register.name": "名前",
  "register.email": "メールアドレス",
  "register.password": "パスワード",
  "register.confirmPassword": "パスワード確認",
  "register.submit": "登録",
  "register.submitting": "登録中...",
  "register.login": "ログインはこちら",
  "register.error": "登録に失敗しました",
  
  // Common
  "common.loading": "読み込み中...",
  "common.error": "エラーが発生しました",
  "common.save": "保存",
  "common.cancel": "キャンセル",
  "common.delete": "削除",
  "common.edit": "編集",
  "common.add": "追加",
  "common.search": "検索",
  "common.filter": "フィルター",
  "common.all": "すべて",
  "common.yes": "はい",
  "common.no": "いいえ",
  "common.confirm": "確認",
  "common.back": "戻る",
  "common.next": "次へ",
  "common.previous": "前へ",
  "common.language": "言語",
};

// Chinese translations
const zhTranslations: Record<string, string> = {
  // Navigation
  "nav.dashboard": "仪表盘",
  "nav.tasks": "任务列表",
  "nav.reports": "报告",
  "nav.reportStaff": "报告员工",
  "nav.staff": "员工名册",
  "nav.masterControl": "主控制台",
  "nav.reportAnalysis": "AI分析",
  "nav.logout": "退出登录",
  
  // Dashboard
  "dashboard.title": "仪表盘",
  "dashboard.inProgress": "进行中",
  "dashboard.completed": "已完成",
  "dashboard.overdue": "已逾期",
  "dashboard.pending": "待处理",
  "dashboard.staffList": "员工列表",
  "dashboard.recentTasks": "最近任务",
  "dashboard.noTasks": "没有任务",
  "dashboard.viewAll": "查看全部",
  "dashboard.createTask": "创建新任务",
  
  // Tasks
  "tasks.title": "任务列表",
  "tasks.create": "创建新任务",
  "tasks.search": "搜索",
  "tasks.filter": "筛选",
  "tasks.status": "状态",
  "tasks.staff": "负责人",
  "tasks.deadline": "截止日期",
  "tasks.detail": "详情",
  "tasks.noDeadline": "无截止日期",
  "tasks.all": "全部",
  "tasks.statusPending": "待处理",
  "tasks.statusInProgress": "进行中",
  "tasks.statusCompleted": "已完成",
  "tasks.statusCancelled": "已取消",
  "tasks.clearFilters": "清除筛选",
  "tasks.results": "条结果",
  "tasks.noResults": "没有找到匹配的任务",
  
  // Task Create
  "taskCreate.title": "创建新任务",
  "taskCreate.screenshots": "截图",
  "taskCreate.uploadHint": "最多可上传4张",
  "taskCreate.selectStaff": "选择负责人",
  "taskCreate.deadline": "截止日期（可选）",
  "taskCreate.notes": "备注（可选）",
  "taskCreate.submit": "创建任务",
  "taskCreate.submitting": "创建中...",
  
  // Task Detail
  "taskDetail.title": "任务详情",
  "taskDetail.taskId": "任务ID",
  "taskDetail.status": "状态",
  "taskDetail.staff": "负责人",
  "taskDetail.deadline": "截止日期",
  "taskDetail.createdAt": "创建时间",
  "taskDetail.updatedAt": "更新时间",
  "taskDetail.screenshots": "截图",
  "taskDetail.notes": "备注",
  "taskDetail.sendReminder": "发送提醒邮件",
  "taskDetail.markComplete": "标记完成",
  "taskDetail.reminderHistory": "提醒历史",
  "taskDetail.emailOpened": "已打开",
  "taskDetail.emailNotOpened": "未打开",
  
  // Reports
  "reports.title": "报告",
  "reports.create": "创建新报告",
  "reports.list": "报告列表",
  "reports.staff": "员工",
  "reports.date": "日期",
  "reports.content": "工作内容",
  "reports.issues": "注意事项・问题・原因",
  "reports.remarks": "备注",
  "reports.updatedAt": "更新时间",
  "reports.actions": "操作",
  "reports.noReports": "没有报告",
  "reports.clearFilters": "清除筛选",
  "reports.results": "条结果",
  "reports.prevMonth": "上月",
  "reports.thisMonth": "本月",
  "reports.days": "天中",
  "reports.country": "国家",
  "reports.all": "全部",
  "reports.japan": "日本",
  "reports.china": "中国",
  "reports.notLinked": "未关联",
  "reports.noTasks": "无任务",
  "reports.deleteConfirm": "确定要删除这个报告吗？",
  "reports.deleteWarning": "此操作无法撤销。确定要删除吗？",
  "reports.cancel": "取消",
  "reports.delete": "删除",
  "reports.deleting": "删除中...",
  
  // Report Form
  "reportForm.createTitle": "创建新报告",
  "reportForm.editTitle": "编辑报告",
  "reportForm.staff": "员工",
  "reportForm.selectStaff": "选择员工",
  "reportForm.addNewStaff": "添加新员工",
  "reportForm.newStaffName": "新员工姓名",
  "reportForm.country": "国家",
  "reportForm.date": "日期",
  "reportForm.content": "工作内容",
  "reportForm.contentPlaceholder": "请输入今天的工作内容",
  "reportForm.issues": "注意事项・问题・原因",
  "reportForm.issuesPlaceholder": "请输入注意到的问题",
  "reportForm.remarks": "备注",
  "reportForm.remarksPlaceholder": "请输入其他备注",
  "reportForm.submit": "保存",
  "reportForm.submitting": "保存中...",
  "reportForm.back": "返回",
  
  // Report Staff Management
  "reportStaff.title": "报告员工管理",
  "reportStaff.description": "管理日报员工，设置与员工名册的关联",
  "reportStaff.add": "新增",
  "reportStaff.list": "报告员工列表",
  "reportStaff.name": "姓名",
  "reportStaff.country": "国家",
  "reportStaff.linkedStaff": "关联员工",
  "reportStaff.taskProgress": "任务进度",
  "reportStaff.status": "状态",
  "reportStaff.actions": "操作",
  "reportStaff.notLinked": "未关联",
  "reportStaff.active": "有效",
  "reportStaff.inactive": "无效",
  "reportStaff.noStaff": "没有报告员工",
  "reportStaff.addTitle": "添加报告员工",
  "reportStaff.editTitle": "编辑报告员工",
  "reportStaff.linkTitle": "关联员工",
  "reportStaff.linkDescription": "将与员工名册中的员工关联。关联后可以从日报查看任务进度。",
  "reportStaff.selectLinkedStaff": "选择关联员工",
  "reportStaff.noLink": "不关联",
  "reportStaff.save": "保存",
  "reportStaff.saving": "保存中...",
  "reportStaff.saveLink": "保存关联",
  "reportStaff.cancel": "取消",
  "reportStaff.deleteConfirm": "确定要删除这个报告员工吗？相关的日报也可能被删除。",
  "reportStaff.loading": "加载中...",
  "reportStaff.noTasks": "无任务",
  
  // Staff Management
  "staffMgmt.title": "员工名册",
  "staffMgmt.add": "新增",
  "staffMgmt.name": "姓名",
  "staffMgmt.email": "邮箱",
  "staffMgmt.department": "部门",
  "staffMgmt.country": "国家",
  "staffMgmt.status": "状态",
  "staffMgmt.actions": "操作",
  "staffMgmt.active": "有效",
  "staffMgmt.inactive": "无效",
  "staffMgmt.noStaff": "没有员工",
  "staffMgmt.addTitle": "添加员工",
  "staffMgmt.editTitle": "编辑员工",
  "staffMgmt.save": "保存",
  "staffMgmt.saving": "保存中...",
  "staffMgmt.cancel": "取消",
  "staffMgmt.deleteConfirm": "确定要删除这个员工吗？",
  
  // Login
  "login.title": "登录",
  "login.subtitle": "登录业务自动化系统",
  "login.email": "邮箱",
  "login.password": "密码",
  "login.submit": "登录",
  "login.submitting": "登录中...",
  "login.register": "注册新账号",
  "login.error": "登录失败",
  
  // Register
  "register.title": "注册",
  "register.subtitle": "创建账号",
  "register.name": "姓名",
  "register.email": "邮箱",
  "register.password": "密码",
  "register.confirmPassword": "确认密码",
  "register.submit": "注册",
  "register.submitting": "注册中...",
  "register.login": "已有账号？登录",
  "register.error": "注册失败",
  
  // Common
  "common.loading": "加载中...",
  "common.error": "发生错误",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.edit": "编辑",
  "common.add": "添加",
  "common.search": "搜索",
  "common.filter": "筛选",
  "common.all": "全部",
  "common.yes": "是",
  "common.no": "否",
  "common.confirm": "确认",
  "common.back": "返回",
  "common.next": "下一步",
  "common.previous": "上一步",
  "common.language": "语言",
};

const translations: Record<Language, Record<string, string>> = {
  ja: jaTranslations,
  zh: zhTranslations,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    return (saved as Language) || "ja";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
