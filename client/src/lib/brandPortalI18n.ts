/**
 * Brand Portal 多言語定義（日本語 / 中国語）
 * 
 * ブランドポータルフォームの全ラベル・プレースホルダー・ガイドテキストを
 * 日本語と中国語の両方で定義する。
 */

export type Lang = "ja" | "zh";

export const translations = {
  // ============================================================
  // 共通
  // ============================================================
  common: {
    brandPortal: { ja: "ブランドポータル", zh: "品牌门户" },
    partnerPortal: { ja: "Live Commerce Japan パートナーポータル", zh: "Live Commerce Japan 合作伙伴门户" },
    loading: { ja: "読み込み中...", zh: "加载中..." },
    accessDenied: { ja: "アクセスできません", zh: "无法访问" },
    invalidLink: { ja: "このリンクは無効か、有効期限が切れています。", zh: "此链接无效或已过期。" },
    contact: { ja: "お問い合わせ: info@livecommercejapan.com", zh: "联系我们: info@livecommercejapan.com" },
    poweredBy: { ja: "Powered by Live Commerce Japan", zh: "Powered by Live Commerce Japan" },
    save: { ja: "保存", zh: "保存" },
    cancel: { ja: "キャンセル", zh: "取消" },
    submit: { ja: "送信", zh: "提交" },
    submitting: { ja: "送信中...", zh: "提交中..." },
    next: { ja: "次へ", zh: "下一步" },
    prev: { ja: "戻る", zh: "上一步" },
    required: { ja: "必須", zh: "必填" },
    optional: { ja: "任意", zh: "选填" },
    draft: { ja: "下書き", zh: "草稿" },
    draftSaved: { ja: "下書きを保存しました", zh: "草稿已保存" },
    draftAutoSaved: { ja: "自動保存しました", zh: "已自动保存" },
    submitted: { ja: "提出済み", zh: "已提交" },
    reviewing: { ja: "審査中", zh: "审核中" },
    tuning: { ja: "調整中", zh: "调整中" },
    simulating: { ja: "シミュレーション中", zh: "模拟中" },
    proposed: { ja: "提案済み", zh: "已提案" },
    approved: { ja: "承認済み", zh: "已批准" },
    liveReady: { ja: "配信準備完了", zh: "直播准备完成" },
    liveDone: { ja: "配信完了", zh: "直播完成" },
    rejected: { ja: "却下", zh: "已拒绝" },
    language: { ja: "言語", zh: "语言" },
  },

  // ============================================================
  // タブ
  // ============================================================
  tabs: {
    products: { ja: "商品管理", zh: "商品管理" },
    performance: { ja: "配信実績", zh: "直播实绩" },
    cards: { ja: "手卡一覧", zh: "手卡列表" },
  },

  // ============================================================
  // 統計
  // ============================================================
  stats: {
    registeredProducts: { ja: "登録商品", zh: "已注册商品" },
    approvedProducts: { ja: "承認済み", zh: "已批准" },
    liveResults: { ja: "配信実績", zh: "直播实绩" },
    totalSales: { ja: "累計売上", zh: "累计销售额" },
  },

  // ============================================================
  // ステップ名
  // ============================================================
  steps: {
    step1: { ja: "基本情報", zh: "基本信息" },
    step2: { ja: "価格・条件", zh: "价格・条件" },
    step3: { ja: "セールスポイント", zh: "卖点" },
    step4: { ja: "画像・資料", zh: "图片・资料" },
    step5: { ja: "確認・送信", zh: "确认・提交" },
  },

  // ============================================================
  // Step 1: 基本情報
  // ============================================================
  step1: {
    title: { ja: "基本情報", zh: "基本信息" },
    subtitle: { ja: "商品の基本的な情報を入力してください", zh: "请输入商品的基本信息" },
    productName: { ja: "製品名", zh: "产品名称" },
    productNamePlaceholder: { ja: "例: KYOGOKU シグネチャーシャンプー", zh: "例: KYOGOKU 签名洗发水" },
    category: { ja: "カテゴリ", zh: "类别" },
    categoryPlaceholder: { ja: "例: ヘアケア", zh: "例: 护发" },
    targetAudience: { ja: "ターゲット層", zh: "目标人群" },
    targetAudiencePlaceholder: { ja: "例: 20〜40歳の女性、美容に関心が高い層", zh: "例: 20-40岁女性、注重美容的人群" },
    brandOverview: { ja: "ブランド概要", zh: "品牌概述" },
    brandOverviewPlaceholder: { ja: "ブランドの特徴、歴史、理念などを記入してください", zh: "请填写品牌的特点、历史、理念等" },
    specifications: { ja: "仕様・スペック", zh: "规格" },
    specificationsPlaceholder: { ja: "内容量、サイズ、重量等", zh: "容量、尺寸、重量等" },
  },

  // ============================================================
  // Step 2: 価格・条件
  // ============================================================
  step2: {
    title: { ja: "価格・条件", zh: "价格・条件" },
    subtitle: { ja: "価格情報と販売条件を入力してください", zh: "请输入价格信息和销售条件" },
    costPrice: { ja: "原価（仕入れ値）", zh: "成本价（进货价）" },
    costPricePlaceholder: { ja: "¥", zh: "¥" },
    listPrice: { ja: "通常価格（税込）", zh: "通常价格（含税）" },
    listPricePlaceholder: { ja: "¥", zh: "¥" },
    livePrice: { ja: "ライブ配信希望価格", zh: "直播希望价格" },
    livePricePlaceholder: { ja: "¥", zh: "¥" },
    shippingInfo: { ja: "発送情報", zh: "发货信息" },
    shippingInfoPlaceholder: { ja: "発送方法、リードタイム等", zh: "发货方式、交货时间等" },
    shippingInfoGuide: {
      ja: "配送業者、発送までの日数、送料の有無、配送可能地域などを記入してください。\n例: ヤマト運輸・注文後3営業日以内に発送・送料無料（5,000円以上）",
      zh: "请填写快递公司、发货天数、是否包邮、配送范围等。\n例: 顺丰快递・下单后3个工作日内发货・满5000日元包邮",
    },
    commissionRate: { ja: "ライセンス料配分率", zh: "许可费分配比例" },
    commissionRatePlaceholder: { ja: "例: 15%", zh: "例: 15%" },
    giftItems: { ja: "贈品・おまけ", zh: "赠品" },
    giftItemsPlaceholder: { ja: "おまけ・ノベルティ等", zh: "赠品・小礼品等" },
    salesMechanism: { ja: "販売メカニズム", zh: "销售机制" },
    salesMechanismPlaceholder: { ja: "セット販売、限定数量等", zh: "套装销售、限量等" },
    stockQuantity: { ja: "在庫数", zh: "库存数量" },
    stockQuantityPlaceholder: { ja: "在庫数", zh: "库存数量" },
  },

  // ============================================================
  // Step 3: セールスポイント
  // ============================================================
  step3: {
    title: { ja: "セールスポイント", zh: "卖点" },
    subtitle: { ja: "商品のセールスポイントを入力してください。複数商品を追加できます。", zh: "请输入商品的卖点。可以添加多个商品。" },
    sellingPoints: { ja: "コアセールスポイント", zh: "核心卖点" },
    sellingPointsPlaceholder: {
      ja: "商品の主要なセールスポイントを記入してください。\n\n例:\n・独自開発のケラチン配合で髪の内部から補修\n・サロン品質を自宅で実現\n・無添加・低刺激で敏感肌にも安心\n・累計販売100万本突破の実績\n・美容師が選ぶNo.1シャンプー",
      zh: "请填写商品的主要卖点。\n\n例:\n・独家研发角蛋白配方，从内部修复头发\n・在家即可享受沙龙品质\n・无添加、低刺激，敏感肌也安心\n・累计销售突破100万瓶\n・美发师首选No.1洗发水",
    },
    usageMethod: { ja: "使用方法", zh: "使用方法" },
    usageMethodPlaceholder: { ja: "使い方の説明", zh: "使用说明" },
    ingredients: { ja: "成分・原材料", zh: "成分・原材料" },
    ingredientsPlaceholder: { ja: "主要成分等", zh: "主要成分等" },
    addProduct: { ja: "＋ 商品を追加", zh: "＋ 添加商品" },
    productNumber: { ja: "商品", zh: "商品" },
    removeProduct: { ja: "この商品を削除", zh: "删除此商品" },
  },

  // ============================================================
  // Step 4: 画像・資料
  // ============================================================
  step4: {
    title: { ja: "画像・資料", zh: "图片・资料" },
    subtitle: { ja: "商品画像やブランド関連資料をアップロードしてください", zh: "请上传商品图片和品牌相关资料" },
    productImages: { ja: "商品画像（最大5枚）", zh: "商品图片（最多5张）" },
    productImagesGuide: { ja: "商品画像、パッケージ写真などをアップロードできます", zh: "可以上传商品图片、包装照片等" },
    brandBackupImages: { ja: "ブランド証明資料（最大10枚）", zh: "品牌证明资料（最多10张）" },
    brandBackupImagesGuide: {
      ja: "ブランド認証書、受賞歴、メディア掲載、成分分析表など、ブランドの信頼性を証明する資料をアップロードしてください",
      zh: "请上传品牌认证书、获奖记录、媒体报道、成分分析表等证明品牌可信度的资料",
    },
    productLinks: { ja: "商品リンク", zh: "商品链接" },
    productLinksGuide: { ja: "商品の販売ページや公式サイトのURLを入力してください", zh: "请输入商品销售页面或官网的URL" },
    addLink: { ja: "＋ リンクを追加", zh: "＋ 添加链接" },
    linkTitle: { ja: "リンクタイトル", zh: "链接标题" },
    linkTitlePlaceholder: { ja: "例: 公式サイト", zh: "例: 官方网站" },
    linkUrl: { ja: "URL", zh: "URL" },
    linkUrlPlaceholder: { ja: "https://...", zh: "https://..." },
    add: { ja: "追加", zh: "添加" },
    upload: { ja: "アップロード", zh: "上传" },
  },

  // ============================================================
  // Step 5: 確認・送信
  // ============================================================
  step5: {
    title: { ja: "確認・送信", zh: "确认・提交" },
    subtitle: { ja: "入力内容を確認して送信してください", zh: "请确认输入内容后提交" },
    preview: { ja: "手卡プレビュー", zh: "手卡预览" },
    previewGuide: { ja: "送信後、LCJが手卡を生成・調整します", zh: "提交后，LCJ将生成・调整手卡" },
    confirmAndSubmit: { ja: "内容を確認して送信", zh: "确认内容并提交" },
    editStep: { ja: "編集", zh: "编辑" },
    submitSuccess: { ja: "商品情報を送信しました", zh: "商品信息已提交" },
    submitError: { ja: "送信に失敗しました", zh: "提交失败" },
    productNameRequired: { ja: "製品名は必須です", zh: "产品名称为必填项" },
  },

  // ============================================================
  // テンプレート
  // ============================================================
  templates: {
    selectTemplate: { ja: "テンプレートを選択", zh: "选择模板" },
    noTemplate: { ja: "テンプレートなし（白紙から入力）", zh: "无模板（从空白开始）" },
    beauty: { ja: "美容品", zh: "美容产品" },
    food: { ja: "食品", zh: "食品" },
    general: { ja: "雑貨", zh: "杂货" },
    health: { ja: "健康食品・サプリ", zh: "保健食品・补充剂" },
    fashion: { ja: "ファッション", zh: "时尚" },
    electronics: { ja: "家電・ガジェット", zh: "家电・数码" },
  },

  // ============================================================
  // フォーム
  // ============================================================
  form: {
    newProduct: { ja: "新しい商品を登録する", zh: "注册新商品" },
    newProductDesc: { ja: "商品情報を入力してLCJに送信します", zh: "输入商品信息并提交给LCJ" },
    formTitle: { ja: "商品情報入力フォーム（手卡）", zh: "商品信息输入表单（手卡）" },
    submitProduct: { ja: "商品情報を送信", zh: "提交商品信息" },
    saveDraft: { ja: "下書き保存", zh: "保存草稿" },
    imageUploaded: { ja: "枚の画像をアップロードしました", zh: "张图片已上传" },
    imageUploadError: { ja: "画像のアップロードに失敗しました", zh: "图片上传失败" },
  },

  // ============================================================
  // 商品一覧
  // ============================================================
  productList: {
    registeredProducts: { ja: "登録済み商品", zh: "已注册商品" },
    noProducts: { ja: "まだ商品が登録されていません", zh: "尚未注册商品" },
    noProductsGuide: { ja: "上のボタンから商品情報を入力してください", zh: "请点击上方按钮输入商品信息" },
    details: { ja: "詳細を見る", zh: "查看详情" },
    collapse: { ja: "閉じる", zh: "收起" },
    lcjNote: { ja: "LCJからのメモ", zh: "LCJ备注" },
    rejectionReason: { ja: "却下理由", zh: "拒绝原因" },
    submittedAt: { ja: "提出", zh: "提交" },
    approvedAt: { ja: "承認", zh: "批准" },
  },

  // ============================================================
  // 配信実績
  // ============================================================
  performance: {
    title: { ja: "配信実績", zh: "直播实绩" },
    noPerformance: { ja: "まだ配信実績がありません", zh: "暂无直播实绩" },
    noPerformanceGuide: { ja: "配信完了後に自動的に表示されます", zh: "直播完成后将自动显示" },
    sales: { ja: "売上", zh: "销售额" },
    gmv: { ja: "GMV", zh: "GMV" },
    salesCount: { ja: "販売数", zh: "销售数" },
    viewerCount: { ja: "視聴者数", zh: "观众数" },
    duration: { ja: "配信時間", zh: "直播时长" },
  },

  // ============================================================
  // 手卡一覧
  // ============================================================
  cards: {
    title: { ja: "商品紹介カード（手卡）", zh: "商品介绍卡（手卡）" },
    guide: { ja: "商品をクリックすると手卡のプレビュー・ダウンロードができます", zh: "点击商品可预览・下载手卡" },
    noCards: { ja: "まだ手卡がありません", zh: "暂无手卡" },
    noCardsGuide: { ja: "商品を登録すると自動的に手卡が生成されます", zh: "注册商品后将自动生成手卡" },
    backToList: { ja: "手卡一覧に戻る", zh: "返回手卡列表" },
  },
} as const;

/**
 * 翻訳テキストを取得するヘルパー
 */
export function t(section: keyof typeof translations, key: string, lang: Lang): string {
  const sec = translations[section] as any;
  if (!sec || !sec[key]) return key;
  return sec[key][lang] || sec[key]["ja"] || key;
}

/**
 * テンプレート定義
 */
export interface ProductTemplate {
  id: string;
  name: { ja: string; zh: string };
  defaults: {
    category?: string;
    targetAudience?: string;
    sellingPoints?: string;
    shippingInfo?: string;
  };
}

export const productTemplates: ProductTemplate[] = [
  {
    id: "beauty",
    name: { ja: "美容品", zh: "美容产品" },
    defaults: {
      category: "美容・コスメ",
      targetAudience: "20〜40歳の女性、美容に関心が高い層",
      sellingPoints: "・独自成分配合\n・サロン品質\n・無添加・低刺激\n・SNSで話題",
      shippingInfo: "ヤマト運輸・注文後3営業日以内に発送・送料無料（5,000円以上）",
    },
  },
  {
    id: "food",
    name: { ja: "食品", zh: "食品" },
    defaults: {
      category: "食品・飲料",
      targetAudience: "健康志向の20〜50代男女",
      sellingPoints: "・国産原材料使用\n・無添加・無着色\n・栄養価が高い\n・手軽に摂取可能",
      shippingInfo: "クール便・注文後5営業日以内に発送・送料別（全国一律800円）",
    },
  },
  {
    id: "general",
    name: { ja: "雑貨", zh: "杂货" },
    defaults: {
      category: "雑貨・日用品",
      targetAudience: "20〜40代の生活にこだわりのある層",
      sellingPoints: "・デザイン性が高い\n・機能的で使いやすい\n・ギフトにも最適\n・環境に優しい素材",
      shippingInfo: "宅急便・注文後3営業日以内に発送・5,000円以上送料無料",
    },
  },
  {
    id: "health",
    name: { ja: "健康食品・サプリ", zh: "保健食品・补充剂" },
    defaults: {
      category: "健康食品・サプリメント",
      targetAudience: "30〜60代の健康意識の高い男女",
      sellingPoints: "・医師監修\n・臨床試験済み\n・GMP認定工場で製造\n・定期購入でお得",
      shippingInfo: "ゆうパック・注文後3営業日以内に発送・定期便は送料無料",
    },
  },
  {
    id: "fashion",
    name: { ja: "ファッション", zh: "时尚" },
    defaults: {
      category: "ファッション・アパレル",
      targetAudience: "20〜30代のトレンドに敏感な女性",
      sellingPoints: "・トレンドデザイン\n・高品質素材\n・サイズ展開豊富\n・着回し力抜群",
      shippingInfo: "ヤマト運輸・注文後2営業日以内に発送・送料無料",
    },
  },
  {
    id: "electronics",
    name: { ja: "家電・ガジェット", zh: "家电・数码" },
    defaults: {
      category: "家電・ガジェット",
      targetAudience: "20〜40代のテクノロジーに関心のある層",
      sellingPoints: "・最新技術搭載\n・コスパ抜群\n・使いやすいUI\n・1年保証付き",
      shippingInfo: "佐川急便・注文後5営業日以内に発送・送料無料",
    },
  },
];
