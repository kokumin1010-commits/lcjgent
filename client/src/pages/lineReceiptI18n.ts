/**
 * LINE Receipt Management page-specific i18n translations
 * These are used inline in LineReceiptManagement.tsx via the t() function
 * from LanguageContext. We add them to the global translation dictionaries.
 */

// Additional Japanese translations for LINE Receipt Management
export const lineReceiptJa: Record<string, string> = {
  // Page header
  "lr.title": "LINEレシート管理",
  "lr.subtitle": "LINEから送信されたレシートの審査・ポイント付与管理",
  "lr.shortcuts": "ショートカット",

  // AI Auto Mode
  "lr.aiAutoMode": "AI自動承認モード",
  "lr.aiAutoModeDesc": "高信頼度のレシートを自動承認",
  "lr.aiAutoModeOn": "AI自動承認モードON: 自動処理を開始します...",
  "lr.aiAutoModeActive": "AI自動承認モード有効",
  "lr.aiAutoModePipeline": "3段階パイプライン: 重複注文番号チェック → LLM画像判定 → 信頼度閾値判定",
  "lr.aiAutoRecognizing": "AI自動認識中...",
  "lr.aiAutoRecognizeComplete": "AI自動認識完了",
  "lr.processed": "件処理済み",
  "lr.imagesAnalyzed": "件の画像を解析しました",
  "lr.abort": "中止",
  "lr.execute": "実行",
  "lr.preview": "プレビュー",
  "lr.items": "件",

  // Search
  "lr.searchOrderNumber": "注文管理番号で検索...",

  // Statistics cards
  "lr.aiReviewLog": "AI審査ログ",

  // Review panel
  "lr.reviewPanel": "審査パネル",
  "lr.autoSend": "自動送信",
  "lr.selectReceipt": "右のリストからレシートを選択してください",
  "lr.selectHint": "選択",
  "lr.approveHint": "承認",
  "lr.loading": "読み込み中...",

  // Duplicate warnings
  "lr.duplicate": "重複",
  "lr.duplicateCount": "重複{count}件",

  // AI rejection -> force submit
  "lr.aiRejectedForceSubmit": "AI弾き → 強制申請",
  "lr.aiRejectionReason": "AI判定理由:",
  "lr.notTiktok": "TikTok以外",
  "lr.notDelivered": "未配達",
  "lr.incompleteAmount": "金額不明",
  "lr.otherReason": "その他",
  "lr.customerForceSubmit": "→ お客様が強制申請",

  // Order number
  "lr.orderNumber": "注文番号",
  "lr.enterOrderNumber": "注文番号を入力",
  "lr.aiReRecognize": "AI再認識",
  "lr.save": "保存",

  // Store & Date
  "lr.storeUnknown": "店舗不明",
  "lr.noAmount": "金額なし",

  // OCR details
  "lr.products": "商品",
  "lr.unknown": "不明",
  "lr.moreItems": "他{count}件",
  "lr.deliveryAddress": "配送先",

  // Amount & Points
  "lr.purchaseAmount": "購入金額",
  "lr.amount": "金額",
  "lr.pointPercent": "1%ポイント",
  "lr.memo": "メモ（任意）",

  // Action buttons
  "lr.approve": "承認",
  "lr.approveWithPoints": "承認（{points}pt付与）",
  "lr.approving": "承認処理中...",
  "lr.selectRejectionReason": "却下理由を選択（AI学習用）",
  "lr.rejectLine": "却下（LINE）",
  "lr.sending": "送信中",
  "lr.hold": "保留",
  "lr.reviveApprove": "復活→承認（{points}pt付与）",
  "lr.reviving": "復活処理中...",

  // Status
  "lr.approved": "承認済",
  "lr.rejected": "却下済",
  "lr.approvedStatus": "承認",
  "lr.rejectedStatus": "却下",
  "lr.holdStatus": "保留",
  "lr.waitingStatus": "待機",

  // Receipt images
  "lr.receiptImages": "レシート画像",
  "lr.enlarge": "拡大",
  "lr.noImage": "画像がありません",
  "lr.selectToViewImage": "レシートを選択すると\n画像がここに表示されます",

  // Receipt detail dialog
  "lr.receiptDetail": "レシート詳細",
  "lr.edit": "編集",
  "lr.storeName": "店舗名",
  "lr.purchaseDate": "購入日",
  "lr.currency": "通貨",
  "lr.saveChanges": "変更を保存",
  "lr.saving": "保存中...",
  "lr.cancel": "キャンセル",
  "lr.userInfo": "ユーザー情報",
  "lr.lineUser": "LINEユーザー",
  "lr.submittedAt": "申請日時",
  "lr.reviewedAt": "審査日時",
  "lr.reviewNote": "審査メモ",
  "lr.pointsAwarded": "付与ポイント",
  "lr.ocrConfidence": "OCR信頼度",
  "lr.aiAnalysis": "AI分析結果",
  "lr.confidenceScore": "信頼度スコア",
  "lr.ocrText": "OCRテキスト",
  "lr.fraudLog": "不正検知ログ",
  "lr.approveWithCalc": "計算機で承認",
  "lr.rejectLineSend": "却下（LINE送信）",



  // Hold dialog (old keys)
  "lr.holdReceipt": "レシートを保留",
  "lr.holdConfirm": "このレシートを保留にしますか？理由を入力してください。",
  "lr.detailReason": "詳細理由",
  "lr.enterDetailReason": "詳細な理由を入力してください",
  "lr.makeHold": "保留にする",
  "lr.processing": "処理中...",
  "lr.batchSize": "バッチ件数",

  // Order number dialog (old keys)
  "lr.manualOrderNumber": "注文番号を手動入力",
  "lr.checkImageEnterOrder": "レシート画像を確認して、注文番号を入力してください。",
  "lr.receiptImageClickEnlarge": "レシート画像（クリックで拡大）",
  "lr.example": "例:",
  "lr.saveOrderNumber": "注文番号を保存",

  // Keyboard shortcuts (old keys)
  "lr.keyboardShortcuts": "キーボードショートカット",
  "lr.keyboardDesc": "キーボードだけでレシートを高速処理できます",
  "lr.navigation": "ナビゲーション",
  "lr.selectNext": "次のレシートを選択",
  "lr.selectPrev": "前のレシートを選択",
  "lr.deselect": "選択解除",
  "lr.actions": "アクション",
  "lr.doApprove": "承認する",
  "lr.doReject": "却下する",
  "lr.doHold": "保留にする",
  "lr.viewDetail": "詳細を表示",
  "lr.other": "その他",
  "lr.shortcutNote": "※ 入力フィールドやダイアログが開いているときは無効になります",

  // AI Review Log Panel
  "lr.aiLog.title": "AI審査ログ",
  "lr.aiLog.desc": "AIが自動判定した全レシートの履歴・人間による修正",
  "lr.aiLog.refresh": "更新",
  "lr.aiLog.total": "合計",
  "lr.aiLog.aiApproved": "AI承認",
  "lr.aiLog.duplicateRejected": "重複却下",
  "lr.aiLog.aiRejected": "AI却下",
  "lr.aiLog.aiHeld": "AI保留",
  "lr.aiLog.skipped": "手動審査へ",
  "lr.aiLog.batchHistory": "バッチ実行履歴",
  "lr.aiLog.all": "全て",
  "lr.aiLog.filter": "フィルター:",
  "lr.aiLog.noLogs": "AI審査ログはまだありません",
  "lr.aiLog.noLogsDesc": "AI自動承認モードをONにすると、ここに審査結果が記録されます",
  "lr.aiLog.humanApproved": "人間承認",
  "lr.aiLog.humanRejected": "人間却下",
  "lr.aiLog.approveComment": "承認コメント（任意）:",
  "lr.aiLog.rejectReason": "却下理由:",
  "lr.aiLog.corrected": "AI判定を修正しました:",
  "lr.aiLog.correctedApproved": "承認",
  "lr.aiLog.correctedRejected": "却下",
  "lr.aiLog.correctionError": "修正エラー:",
  "lr.aiLog.aiRejectedLowConf": "AI却下（低信頼度）",

  // Fraud check types
  "lr.fraud.duplicateImage": "重複画像",
  "lr.fraud.duplicateReceipt": "重複レシート",
  "lr.fraud.expired": "期限切れ",
  "lr.fraud.highFrequency": "高頻度申請",
  "lr.fraud.highAmount": "高額購入",
  "lr.fraud.suspicious": "不審パターン",
  "lr.fraud.similarOrder": "類似注文番号",
  "lr.fraud.similar": "類似",
  "lr.fraud.duplicateLabel": "重複",
  "lr.fraud.fraudLabel": "不正",

  // Rejection categories
  "lr.reject.not_order_detail": "注文詳細画面ではない",
  "lr.reject.not_order_detail.desc": "メール通知・配送通知の画面等",
  "lr.reject.not_tiktok_shop": "TikTok Shop以外",
  "lr.reject.not_tiktok_shop.desc": "他のECサイトのレシート",
  "lr.reject.not_delivered": "配達未完了",
  "lr.reject.not_delivered.desc": "配送中・キャンセル等",
  "lr.reject.blurry_image": "画像が不鮮明",
  "lr.reject.blurry_image.desc": "情報が読み取れない",
  "lr.reject.missing_order_number": "注文番号が見えない",
  "lr.reject.missing_order_number.desc": "16-19桁の番号が未確認",
  "lr.reject.missing_amount": "金額が見えない",
  "lr.reject.missing_amount.desc": "合計金額が未確認",
  "lr.reject.partial_screenshot": "スクショが不完全",
  "lr.reject.partial_screenshot.desc": "一部しか写っていない",
  "lr.reject.duplicate": "重複申請",
  "lr.reject.duplicate.desc": "同じ注文番号で既に申請済",
  "lr.reject.wrong_store": "対象外店舗",
  "lr.reject.wrong_store.desc": "対象外のショップ",
  "lr.reject.suspicious": "不正の疑い",
  "lr.reject.suspicious.desc": "加工・改ざんの可能性",
  "lr.reject.incomplete_info": "情報不足",
  "lr.reject.incomplete_info.desc": "必要な情報が足りない",
  "lr.reject.other": "その他",
  "lr.reject.other.desc": "上記以外の理由",

  // Toast messages
  "lr.toast.aiRecognizeComplete": "AI認識完了",
  "lr.toast.aiRecognizeFailed": "情報を抽出できませんでした。手動で入力してください。",
  "lr.toast.aiRecognizeError": "AI認識失敗:",
  "lr.toast.selectRejectionReason": "却下理由を選択してください（AI学習に必要です）",
  "lr.toast.switchedTo": "に切替",
  "lr.toast.otherTab": "は別タブ",

  // Confidence labels
  "lr.highConfidence": "高信頼",
  "lr.medConfidence": "中信頼",
  "lr.lowConfidence": "低信頼",
  "lr.confidence": "信頼度",

  // Toast
  "lr.toast.approveComplete": "承認完了",
  "lr.toast.rejectComplete": "却下完了（LINE送信済み）理由:",

  // AI auto confirm
  "lr.aiAutoConfirm": "AI自動承認を{count}件に対して実行しますか？\n\n・85%以上: 自動承認\n・50-84%: 保留（人間レビュー待ち）\n・50%未満: 自動却下（LINE通知あり）\n・重複注文番号: 自動却下",

  // Hold dialog
  "lr.holdDescription": "このレシートを保留にしますか？理由を入力してください。",
  "lr.setHold": "保留にする",

  // Order number dialog
  "lr.manualOrderNumberDesc": "レシート画像を確認して、注文番号を入力してください。",
  "lr.receiptImageClickToEnlarge": "レシート画像（クリックで拡大）",
  "lr.orderNumberExample": "例: 581900058582287971",
  "lr.currentOrderNumber": "現在の注文番号",
  "lr.errorOccurred": "エラーが発生しました",

  // Shortcut
  "lr.shortcutDesc": "キーボードだけでレシートを高速処理できます",
  "lr.shortcut.nextReceipt": "次のレシートを選択",
  "lr.shortcut.prevReceipt": "前のレシートを選択",
  "lr.shortcut.deselect": "選択解除",
  "lr.openDetail": "詳細を開く",
  "lr.showHelp": "このヘルプを表示",
  "lr.shortcutDisabledNote": "※ 入力フィールドやダイアログが開いているときは無効になります",

  // Images count
  "lr.imagesCount": "この申請には{count}枚の画像が含まれています",

  // Calculated points
  "lr.calculatedPoints": "計算ポイント",
  "lr.awardedPoints": "付与ポイント",

  // AI Review Log
  "lr.aiLog.description": "AIが自動判定した全レシートの履歴・人間による修正",
  "lr.aiLog.noLogsHint": "AI自動承認モードをONにすると、ここに審査結果が記録されます",
  "lr.aiLog.overrideSuccess": "AI判定を修正しました",
  "lr.aiLog.overrideError": "修正エラー",

  // Category
  "lr.category": "カテゴリ",
  "lr.reason": "理由",
  "lr.forceSubmitDate": "強制申請日時",
  "lr.forceSubmitNote": "※ このレシートはAIが一度弾いたものですが、お客様が「それでもアップロード」を選択しました。審査結果はAI学習データとして蓄積されます。",
  "lr.reject": "却下",

  // AI Pass 2
  "lr.pass2.button": "AI再審査",
  "lr.pass2.buttonDesc": "on_holdレシートをAIで再判定",
  "lr.pass2.running": "AI再審査実行中...",
  "lr.pass2.complete": "AI再審査完了",
  "lr.pass2.autoApproved": "自動承認",
  "lr.pass2.autoRejected": "自動却下",
  "lr.pass2.keptManual": "手動残り",
  "lr.pass2.skipped": "スキップ",
  "lr.pass2.processing": "処理中",
  "lr.pass2.confirm": "on_hold {count}件に対してAI再審査を実行しますか？",
  "lr.pass2.confirmTitle": "AI再審査確認",
  "lr.pass2.confirmDesc": "重複チェック→自動却下、高信頼度→自動承認、それ以外→手動残り",
  "lr.pass2.alreadyRunning": "AI再審査は既に実行中です",
  "lr.pass2.started": "AI再審査を開始しました",
  "lr.pass2.error": "AI再審査エラー",
  "lr.pass2.noOnHold": "on_holdレシートがありません",

  // Misc
  "lr.or": "or",
  "lr.LINE": "LINE",
  "lr.Web": "Web",
  "lr.aiBounce": "AI弾き",
  "lr.rejectDuplicate": "重複却下",
  "lr.rejectDuplicateConfirm": "重複レシートとして却下しますか？",
};

// Additional Chinese translations for LINE Receipt Management
export const lineReceiptZh: Record<string, string> = {
  // Page header
  "lr.title": "LINE小票管理",
  "lr.subtitle": "审核LINE提交的小票并发放积分",
  "lr.shortcuts": "快捷键",

  // AI Auto Mode
  "lr.aiAutoMode": "AI自动审批模式",
  "lr.aiAutoModeDesc": "自动审批高可信度的小票",
  "lr.aiAutoModeOn": "AI自动审批已开启：开始自动处理...",
  "lr.aiAutoModeActive": "AI自动审批模式已启用",
  "lr.aiAutoModePipeline": "三阶段流程：重复订单号检查 → LLM图片判定 → 可信度阈值判定",
  "lr.aiAutoRecognizing": "AI自动识别中...",
  "lr.aiAutoRecognizeComplete": "AI自动识别完成",
  "lr.processed": "条已处理",
  "lr.imagesAnalyzed": "张图片已分析",
  "lr.abort": "中止",
  "lr.execute": "执行",
  "lr.preview": "预览",
  "lr.items": "条",

  // Search
  "lr.searchOrderNumber": "按订单管理号搜索...",

  // Statistics cards
  "lr.aiReviewLog": "AI审核日志",

  // Review panel
  "lr.reviewPanel": "审核面板",
  "lr.autoSend": "自动发送",
  "lr.selectReceipt": "请从右侧列表选择一张小票",
  "lr.selectHint": "选择",
  "lr.approveHint": "通过",
  "lr.loading": "加载中...",

  // Duplicate warnings
  "lr.duplicate": "重复",
  "lr.duplicateCount": "重复{count}条",

  // AI rejection -> force submit
  "lr.aiRejectedForceSubmit": "AI拒绝 → 强制提交",
  "lr.aiRejectionReason": "AI判定原因：",
  "lr.notTiktok": "非TikTok",
  "lr.notDelivered": "未送达",
  "lr.incompleteAmount": "金额不明",
  "lr.otherReason": "其他",
  "lr.customerForceSubmit": "→ 客户强制提交",

  // Order number
  "lr.orderNumber": "订单号",
  "lr.enterOrderNumber": "输入订单号",
  "lr.aiReRecognize": "AI重新识别",
  "lr.save": "保存",

  // Store & Date
  "lr.storeUnknown": "店铺不明",
  "lr.noAmount": "无金额",

  // OCR details
  "lr.products": "商品",
  "lr.unknown": "不明",
  "lr.moreItems": "另外{count}件",
  "lr.deliveryAddress": "收货地址",

  // Amount & Points
  "lr.purchaseAmount": "购买金额",
  "lr.amount": "金额",
  "lr.pointPercent": "1%积分",
  "lr.memo": "备注（可选）",

  // Action buttons
  "lr.approve": "通过",
  "lr.approveWithPoints": "通过（发放{points}pt）",
  "lr.approving": "审批处理中...",
  "lr.selectRejectionReason": "选择拒绝原因（用于AI学习）",
  "lr.rejectLine": "拒绝（LINE）",
  "lr.sending": "发送中",
  "lr.hold": "暂挂",
  "lr.reviveApprove": "恢复→通过（发放{points}pt）",
  "lr.reviving": "恢复处理中...",

  // Status
  "lr.approved": "已通过",
  "lr.rejected": "已拒绝",
  "lr.approvedStatus": "通过",
  "lr.rejectedStatus": "拒绝",
  "lr.holdStatus": "暂挂",
  "lr.waitingStatus": "待处理",

  // Receipt images
  "lr.receiptImages": "小票图片",
  "lr.enlarge": "放大",
  "lr.noImage": "没有图片",
  "lr.selectToViewImage": "选择小票后\n图片将显示在这里",

  // Receipt detail dialog
  "lr.receiptDetail": "小票详情",
  "lr.edit": "编辑",
  "lr.storeName": "店铺名称",
  "lr.purchaseDate": "购买日期",
  "lr.currency": "货币",
  "lr.saveChanges": "保存更改",
  "lr.saving": "保存中...",
  "lr.cancel": "取消",
  "lr.userInfo": "用户信息",
  "lr.lineUser": "LINE用户",
  "lr.submittedAt": "提交时间",
  "lr.reviewedAt": "审核时间",
  "lr.reviewNote": "审核备注",
  "lr.pointsAwarded": "发放积分",
  "lr.ocrConfidence": "OCR可信度",
  "lr.aiAnalysis": "AI分析结果",
  "lr.confidenceScore": "可信度评分",
  "lr.ocrText": "OCR文本",
  "lr.fraudLog": "异常检测日志",
  "lr.approveWithCalc": "用计算器通过",
  "lr.rejectLineSend": "拒绝（LINE发送）",

  // Hold dialog (old keys)
  "lr.holdReceipt": "暂挂小票",
  "lr.holdConfirm": "确定要暂挂这张小票吗？请输入原因。",
  "lr.detailReason": "详细原因",
  "lr.enterDetailReason": "请输入详细原因",
  "lr.makeHold": "暂挂",
  "lr.processing": "处理中...",
  "lr.batchSize": "批量数量",

  // Order number dialog (old keys)
  "lr.manualOrderNumber": "手动输入订单号",
  "lr.checkImageEnterOrder": "请查看小票图片，输入订单号。",
  "lr.receiptImageClickEnlarge": "小票图片（点击放大）",
  "lr.example": "例：",
  "lr.saveOrderNumber": "保存订单号",

  // Keyboard shortcuts (old keys)
  "lr.keyboardShortcuts": "键盘快捷键",
  "lr.keyboardDesc": "仅用键盘即可快速处理小票",
  "lr.navigation": "导航",
  "lr.selectNext": "选择下一张小票",
  "lr.selectPrev": "选择上一张小票",
  "lr.deselect": "取消选择",
  "lr.actions": "操作",
  "lr.doApprove": "通过",
  "lr.doReject": "拒绝",
  "lr.doHold": "暂挂",
  "lr.viewDetail": "查看详情",
  "lr.other": "其他",
  "lr.shortcutNote": "※ 在输入框或对话框打开时快捷键无效",

  // AI Review Log Panel
  "lr.aiLog.title": "AI审核日志",
  "lr.aiLog.desc": "AI自动判定的所有小票历史记录及人工修正",
  "lr.aiLog.refresh": "刷新",
  "lr.aiLog.total": "合计",
  "lr.aiLog.aiApproved": "AI通过",
  "lr.aiLog.duplicateRejected": "重复拒绝",
  "lr.aiLog.aiRejected": "AI拒绝",
  "lr.aiLog.aiHeld": "AI暂挂",
  "lr.aiLog.skipped": "转人工审核",
  "lr.aiLog.batchHistory": "批次执行历史",
  "lr.aiLog.all": "全部",
  "lr.aiLog.filter": "筛选：",
  "lr.aiLog.noLogs": "暂无AI审核日志",
  "lr.aiLog.noLogsDesc": "开启AI自动审批模式后，审核结果将记录在这里",
  "lr.aiLog.humanApproved": "人工通过",
  "lr.aiLog.humanRejected": "人工拒绝",
  "lr.aiLog.approveComment": "通过备注（可选）：",
  "lr.aiLog.rejectReason": "拒绝原因：",
  "lr.aiLog.corrected": "已修正AI判定：",
  "lr.aiLog.correctedApproved": "通过",
  "lr.aiLog.correctedRejected": "拒绝",
  "lr.aiLog.correctionError": "修正错误：",
  "lr.aiLog.aiRejectedLowConf": "AI拒绝（低可信度）",

  // Fraud check types
  "lr.fraud.duplicateImage": "重复图片",
  "lr.fraud.duplicateReceipt": "重复小票",
  "lr.fraud.expired": "已过期",
  "lr.fraud.highFrequency": "高频提交",
  "lr.fraud.highAmount": "高额购买",
  "lr.fraud.suspicious": "可疑模式",
  "lr.fraud.similarOrder": "相似订单号",
  "lr.fraud.similar": "相似",
  "lr.fraud.duplicateLabel": "重复",
  "lr.fraud.fraudLabel": "异常",

  // Rejection categories
  "lr.reject.not_order_detail": "非订单详情页面",
  "lr.reject.not_order_detail.desc": "邮件通知、快递通知等",
  "lr.reject.not_tiktok_shop": "非TikTok Shop",
  "lr.reject.not_tiktok_shop.desc": "其他电商平台的小票",
  "lr.reject.not_delivered": "未送达",
  "lr.reject.not_delivered.desc": "配送中、已取消等",
  "lr.reject.blurry_image": "图片模糊",
  "lr.reject.blurry_image.desc": "无法读取信息",
  "lr.reject.missing_order_number": "看不到订单号",
  "lr.reject.missing_order_number.desc": "未确认16-19位数字",
  "lr.reject.missing_amount": "看不到金额",
  "lr.reject.missing_amount.desc": "未确认总金额",
  "lr.reject.partial_screenshot": "截图不完整",
  "lr.reject.partial_screenshot.desc": "只拍到了一部分",
  "lr.reject.duplicate": "重复申请",
  "lr.reject.duplicate.desc": "同一订单号已申请过",
  "lr.reject.wrong_store": "非目标店铺",
  "lr.reject.wrong_store.desc": "不在活动范围内的店铺",
  "lr.reject.suspicious": "疑似造假",
  "lr.reject.suspicious.desc": "可能存在PS或篡改",
  "lr.reject.incomplete_info": "信息不足",
  "lr.reject.incomplete_info.desc": "缺少必要信息",
  "lr.reject.other": "其他",
  "lr.reject.other.desc": "以上原因之外",

  // Toast messages
  "lr.toast.aiRecognizeComplete": "AI识别完成",
  "lr.toast.aiRecognizeFailed": "无法提取信息，请手动输入。",
  "lr.toast.aiRecognizeError": "AI识别失败：",
  "lr.toast.selectRejectionReason": "请选择拒绝原因（用于AI学习）",
  "lr.toast.switchedTo": "已切换到",
  "lr.toast.otherTab": "在其他标签页",

  // Confidence labels
  "lr.highConfidence": "高可信",
  "lr.medConfidence": "中可信",
  "lr.lowConfidence": "低可信",
  "lr.confidence": "可信度",

  // Toast
  "lr.toast.approveComplete": "审批完成",
  "lr.toast.rejectComplete": "拒绝完成（LINE已发送）原因:",

  // AI auto confirm
  "lr.aiAutoConfirm": "确定对{count}条执行AI自动审批吗？\n\n·85%以上：自动通过\n·50-84%：暂挂（等待人工审核）\n·50%以下：自动拒绝（LINE通知）\n·重复订单号：自动拒绝",

  // Hold dialog
  "lr.holdDescription": "确定要暂挂这张小票吗？请输入原因。",
  "lr.setHold": "暂挂",

  // Order number dialog
  "lr.manualOrderNumberDesc": "请查看小票图片，输入订单号。",
  "lr.receiptImageClickToEnlarge": "小票图片（点击放大）",
  "lr.orderNumberExample": "例：581900058582287971",
  "lr.currentOrderNumber": "当前订单号",
  "lr.errorOccurred": "发生错误",

  // Shortcut
  "lr.shortcutDesc": "仅用键盘即可快速处理小票",
  "lr.shortcut.nextReceipt": "选择下一张小票",
  "lr.shortcut.prevReceipt": "选择上一张小票",
  "lr.shortcut.deselect": "取消选择",
  "lr.openDetail": "打开详情",
  "lr.showHelp": "显示此帮助",
  "lr.shortcutDisabledNote": "※ 在输入框或对话框打开时快捷键无效",

  // Images count
  "lr.imagesCount": "此申请包含{count}张图片",

  // Calculated points
  "lr.calculatedPoints": "计算积分",
  "lr.awardedPoints": "发放积分",

  // AI Review Log
  "lr.aiLog.description": "AI自动判定的所有小票历史记录及人工修正",
  "lr.aiLog.noLogsHint": "开启AI自动审批模式后，审核结果将记录在这里",
  "lr.aiLog.overrideSuccess": "已修正AI判定",
  "lr.aiLog.overrideError": "修正错误",

  // Category
  "lr.category": "类别",
  "lr.reason": "原因",
  "lr.forceSubmitDate": "强制提交时间",
  "lr.forceSubmitNote": "※ 这张小票曾被AI拒绝，但客户选择了“仍然上传”。审核结果将作为AI学习数据累积。",
  "lr.reject": "拒绝",

  // AI Pass 2
  "lr.pass2.button": "AI重新审查",
  "lr.pass2.buttonDesc": "对on_hold小票进行AI重新判定",
  "lr.pass2.running": "AI重新审查执行中...",
  "lr.pass2.complete": "AI重新审查完成",
  "lr.pass2.autoApproved": "自动通过",
  "lr.pass2.autoRejected": "自动拒绝",
  "lr.pass2.keptManual": "手动剩余",
  "lr.pass2.skipped": "跳过",
  "lr.pass2.processing": "处理中",
  "lr.pass2.confirm": "对on_hold {count}件执行AI重新审查吗？",
  "lr.pass2.confirmTitle": "AI重新审查确认",
  "lr.pass2.confirmDesc": "重复检查→自动拒绝，高可信度→自动通过，其他→手动处理",
  "lr.pass2.alreadyRunning": "AI重新审查已在执行中",
  "lr.pass2.started": "AI重新审查已开始",
  "lr.pass2.error": "AI重新审查错误",
  "lr.pass2.noOnHold": "没有on_hold小票",

  // Misc
  "lr.or": "或",
  "lr.LINE": "LINE",
  "lr.Web": "Web",
  "lr.aiBounce": "AI拒绝",
  "lr.rejectDuplicate": "重复拒绝",
  "lr.rejectDuplicateConfirm": "确认作为重复小票拒绝？",
};
