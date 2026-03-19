# 招商管理 問題分析 2026-03-19

## 問題1: AI識別失敗
- recruitmentRouter.ts line 561: `ENV.BUILT_IN_FORGE_API_URL + "/chat/completions"` 
- しかし正しいURLは `ENV.forgeApiUrl.replace(/\/$/, "") + "/v1/chat/completions"` (llm.tsを参照)
- ENVのプロパティ名は `forgeApiUrl` / `forgeApiKey` であって `BUILT_IN_FORGE_API_URL` ではない
- さらにモデル名 "gpt-4o-mini" → 正しいモデル名を確認する必要あり

## 問題2: Excel導入が壊れている
- フロントエンドでExcelファイルをCSVとして読んでいるため、バイナリデータがそのまま表示される
- SheetJS (xlsx) ライブラリを使ってExcel/CSVを正しくパースする必要がある

## 問題3: 画像導入ができない
- 画像アップロード入口がない
- OCR機能がない
- 画像をアップロード → S3に保存 → AI Vision APIで認識 の流れが必要

## 解決方針
### バックエンド
1. AI識別: llm.tsのresolveApiUrl()パターンを使ってURL修正
2. ファイルアップロードAPI追加（画像 → S3 → URL返却）
3. OCR/AI Vision APIを正しく呼び出す

### フロントエンド
1. SheetJS (xlsx) をインストールしてExcel/CSVパース
2. 導入ダイアログにステップ追加（ファイル選択 → プレビュー → 確認 → 導入）
3. 画像アップロード入口追加（ドラッグ&ドロップ対応）
4. 画像OCR結果のプレビュー表示
