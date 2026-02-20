# SEO/GEO最適化 AI記事生成 設計方針

## GEO（Generative Engine Optimization）ベストプラクティス

### コンテンツ構造の最適化
1. **明確な見出し階層（H2/H3/H4）** — AIが記事構造を理解しやすくする
2. **FAQ形式の組み込み** — Q&A形式はAI検索で引用されやすい
3. **統計データ・数値の引用** — 具体的な数字は信頼性を高める
4. **権威ある情報源の引用** — 信頼できるソースへの参照
5. **簡潔で明確な回答** — 質問に対する直接的な回答を冒頭に配置
6. **独自の洞察・分析** — オリジナルのデータや視点を提供

### 技術的SEO/GEO対策
1. **構造化データ（Schema.org）**
   - Article schema
   - FAQPage schema
   - Product schema（商品紹介記事）
   - BreadcrumbList schema
   - Organization schema
2. **OGPメタタグ** — SNS共有時の表示最適化
3. **メタタイトル・ディスクリプション** — キーワード最適化
4. **canonical URL** — 重複コンテンツ防止
5. **sitemap.xml** — クロール効率化

### AI検索エンジン対策（ChatGPT, Perplexity, Google AI Overview）
1. **引用されやすい文章構造** — 定義文、比較表、リスト形式
2. **E-E-A-T（経験・専門性・権威性・信頼性）** — 著者情報、実体験ベース
3. **最新情報の定期更新** — 日付を明示、定期的に更新
4. **包括的なトピックカバレッジ** — 関連キーワードを網羅

## TikTok Shop関連キーワードカテゴリ

### 基本キーワード
- TikTok Shop 使い方
- TikTok Shop 買い方
- TikTok Shop 日本
- TikTok Shop 安全
- TikTok Shop 評判
- TikTok Shop 送料
- TikTok Shop 届かない
- TikTok Shop 返品

### 商品カテゴリキーワード
- TikTok Shop おすすめ商品
- TikTok Shop コスメ
- TikTok Shop ファッション
- TikTok Shop 美容
- TikTok Shop スキンケア
- TikTok Shop ガジェット
- TikTok Shop ペット用品

### 比較・レビューキーワード
- TikTok Shop vs Amazon
- TikTok Shop vs 楽天
- TikTok Shop レビュー
- TikTok Shop 口コミ
- TikTok Shop 本物
- TikTok Shop 偽物 見分け方

### セラー向けキーワード
- TikTok Shop 出店方法
- TikTok Shop セラー登録
- TikTok Shop 手数料
- TikTok Shop アフィリエイト
- TikTok Shop ライブコマース

### トレンドキーワード
- TikTok Shop セール
- TikTok Shop クーポン
- TikTok Shop 人気商品 2026
- TikTok Shop バズ商品
- TikTok Shop トレンド

## AI記事生成プロンプト設計方針

### 生成する記事の構造
1. **タイトル** — SEOキーワード含む、60文字以内
2. **導入文（リード）** — 記事の要約、検索意図への直接回答
3. **目次** — H2見出し一覧
4. **本文** — H2/H3階層、各セクション300-500文字
5. **FAQ** — 関連する質問3-5個（FAQPage schema対応）
6. **まとめ** — 要点の再確認、CTA
7. **商品紹介** — 関連商品カードの埋め込み

### メタ情報の自動生成
- メタタイトル: 60文字以内、主要キーワード含む
- メタディスクリプション: 120文字以内、検索意図に対する回答を含む
- OGPタイトル・説明
- FAQ構造化データ用のQ&Aペア
