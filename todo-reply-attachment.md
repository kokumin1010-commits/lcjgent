# メール返信機能 & 添付ファイル対応 実装計画

## 1. メール返信機能の改善
### 現状
- handleReply()は存在するが、基本的なテキスト引用のみ
- inReplyTo/referencesヘッダーが送信時に渡されていない（スレッド追跡不可）

### 改善点
- [x] getMessage APIでmessageId/inReplyTo/referencesを返す
- [x] handleReply()でinReplyTo/referencesをセットする
- [x] sendEmail/sendRecruitmentEmailでinReplyTo/referencesを送信に含める
- [x] 返信時に元メールのHTMLを引用表示（blockquoteスタイル）
- [x] 「全員に返信」ボタン追加（CC含む）

## 2. 添付ファイル対応
### バックエンド
- [x] sendEmailにattachmentsパラメータ追加（Base64エンコード）
- [x] sendRecruitmentEmailにもattachments対応
- [x] getMessageで添付ファイルのBase64データを返す（ダウンロード用）
- [x] 添付ファイルダウンロードAPI追加

### フロントエンド
- [x] メール作成ダイアログにファイル添付UI追加（ドラッグ&ドロップ + ファイル選択）
- [x] 添付ファイルプレビュー（ファイル名・サイズ・削除ボタン）
- [x] メール詳細ビューで添付ファイルダウンロードボタン
- [x] 添付ファイルサイズ制限（合計10MB）
