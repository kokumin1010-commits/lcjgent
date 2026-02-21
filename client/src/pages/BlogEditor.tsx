import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, mergeAttributes } from "@tiptap/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Undo,
  Redo,
  ShoppingBag,
  Search,
  X,
  Settings2,
  Globe,
  FileText,
  Sparkles,
  Wand2,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u3000-\u9fff-]/g, "")
    .replace(/[\s\u3000_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

// --- Product Card Custom Node for Tiptap ---
const ProductCard = Node.create({
  name: "productCard",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      productId: { default: null },
      productName: { default: "" },
      productPrice: { default: 0 },
      productImage: { default: "" },
      brandName: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-product-card]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-product-card": "", class: "product-card-embed" })];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.classList.add("product-card-embed");
      dom.setAttribute("data-product-card", "");
      dom.contentEditable = "false";
      dom.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;margin:8px 0;">
          ${node.attrs.productImage 
            ? `<img src="${node.attrs.productImage}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:8px;" />`
            : `<div style="width:80px;height:80px;background:#e5e7eb;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:24px;">📦</div>`
          }
          <div style="flex:1;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">${node.attrs.brandName || ""}</div>
            <div style="font-weight:600;font-size:14px;color:#111827;">${node.attrs.productName}</div>
            <div style="font-size:16px;font-weight:700;color:#ec4899;margin-top:4px;">¥${Number(node.attrs.productPrice).toLocaleString()}</div>
          </div>
          <div style="padding:6px 12px;background:#ec4899;color:white;border-radius:8px;font-size:12px;font-weight:600;cursor:default;">商品を見る</div>
        </div>
      `;
      return { dom };
    };
  },
});

// --- Product Search Dialog ---
function ProductSearchDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (product: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products, isLoading } = trpc.blog.searchProducts.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 0 }
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            商品を挿入
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="商品名で検索..."
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearchQuery(query);
                }}
              />
            </div>
            <Button onClick={() => setSearchQuery(query)} disabled={!query.trim()}>
              検索
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {products && products.length === 0 && searchQuery && (
            <p className="text-center text-muted-foreground py-4">
              商品が見つかりませんでした
            </p>
          )}

          {products && products.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => {
                    onSelect(product);
                    onClose();
                  }}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                      📦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {product.name}
                    </p>
                    {product.brandName && (
                      <p className="text-xs text-muted-foreground">
                        {product.brandName}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-pink-500">
                    ¥{product.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- AI Article Generation Dialog ---
function AIGenerateDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string, seoData?: any) => void;
}) {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [language, setLanguage] = useState<"ja" | "en" | "zh">("ja");
  const [tone, setTone] = useState<"professional" | "casual" | "friendly" | "authoritative">("professional");
  const [articleType, setArticleType] = useState<"guide" | "review" | "comparison" | "news" | "howto" | "listicle">("guide");
  const [targetLength, setTargetLength] = useState<"short" | "medium" | "long">("medium");
  const [includeProducts, setIncludeProducts] = useState(false);
  const [step, setStep] = useState<"config" | "keywords" | "generating" | "preview">("config");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [progress, setProgress] = useState(0);
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);

  const generateMutation = trpc.blog.generateArticle.useMutation();
  const keywordMutation = trpc.blog.suggestKeywords.useMutation();
  const seoMetaMutation = trpc.blog.generateSeoMeta.useMutation();

  const handleAddKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const handleSuggestKeywords = async () => {
    if (!topic.trim()) {
      toast.error("トピックを入力してください");
      return;
    }
    setShowKeywordSuggestions(true);
    try {
      await keywordMutation.mutateAsync({ topic, language });
    } catch (err: any) {
      toast.error("キーワード提案に失敗しました");
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("トピックを入力してください");
      return;
    }
    if (keywords.length === 0) {
      toast.error("キーワードを1つ以上追加してください");
      return;
    }
    setStep("generating");
    setProgress(0);
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 1000);
    try {
      const result = await generateMutation.mutateAsync({
        topic,
        keywords,
        language,
        tone,
        articleType,
        includeProductRecommendations: includeProducts,
        targetLength,
      });
      clearInterval(progressInterval);
      setProgress(100);
      setGeneratedHtml(result.html);
      setStep("preview");
    } catch (err: any) {
      clearInterval(progressInterval);
      setProgress(0);
      setStep("config");
      toast.error(err.message || "記事生成に失敗しました");
    }
  };

  const handleInsertWithSeo = async () => {
    // Generate SEO meta data as well
    try {
      const seoData = await seoMetaMutation.mutateAsync({
        title: topic,
        content: generatedHtml,
        keywords,
        language,
      });
      onInsert(generatedHtml, seoData);
    } catch {
      // Even if SEO generation fails, insert the article
      onInsert(generatedHtml);
    }
    // Reset state
    setStep("config");
    setGeneratedHtml("");
    setProgress(0);
    onClose();
  };

  const handleInsertOnly = () => {
    onInsert(generatedHtml);
    setStep("config");
    setGeneratedHtml("");
    setProgress(0);
    onClose();
  };

  const articleTypeLabels: Record<string, string> = {
    guide: "ガイド記事",
    review: "レビュー記事",
    comparison: "比較記事",
    news: "ニュース・トレンド",
    howto: "ハウツー記事",
    listicle: "リスト記事",
  };

  const toneLabels: Record<string, string> = {
    professional: "プロフェッショナル",
    casual: "カジュアル",
    friendly: "フレンドリー",
    authoritative: "権威的",
  };

  const lengthLabels: Record<string, string> = {
    short: "短め（1500-2000字）",
    medium: "標準（3000-4000字）",
    long: "長め（5000-7000字）",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && step !== "generating" && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500" />
            AI記事生成（SEO/GEO最適化）
          </DialogTitle>
        </DialogHeader>

        {step === "config" && (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-4">
              {/* Topic */}
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  トピック・テーマ
                </Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例: TikTok Shopで売れる商品の見つけ方"
                  className="text-sm"
                />
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    ターゲットキーワード
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestKeywords}
                    disabled={keywordMutation.isPending || !topic.trim()}
                    className="text-xs text-pink-500 hover:text-pink-600"
                  >
                    {keywordMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3 mr-1" />
                    )}
                    AIでキーワード提案
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="キーワードを入力してEnter"
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleAddKeyword} disabled={!keywordInput.trim()}>
                    追加
                  </Button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        {kw}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}

                {/* AI Keyword Suggestions */}
                {showKeywordSuggestions && keywordMutation.data && (
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">AI提案キーワード（クリックで追加）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywordMutation.data.keywords?.map((kw: any, i: number) => (
                        <Badge
                          key={i}
                          variant={keywords.includes(kw.keyword) ? "default" : "outline"}
                          className="text-xs cursor-pointer hover:bg-accent"
                          onClick={() => {
                            if (!keywords.includes(kw.keyword)) {
                              setKeywords([...keywords, kw.keyword]);
                            }
                          }}
                        >
                          {kw.keyword}
                          <span className="ml-1 text-[10px] opacity-60">
                            {kw.difficulty === "low" ? "易" : kw.difficulty === "medium" ? "中" : "難"}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Article Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">記事タイプ</Label>
                  <Select value={articleType} onValueChange={(v: any) => setArticleType(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(articleTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">トーン</Label>
                  <Select value={tone} onValueChange={(v: any) => setTone(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(toneLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">記事の長さ</Label>
                  <Select value={targetLength} onValueChange={(v: any) => setTargetLength(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(lengthLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">言語</Label>
                  <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                size="lg"
                onClick={handleGenerate}
                disabled={!topic.trim() || keywords.length === 0}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                SEO/GEO最適化記事を生成
              </Button>
            </div>
          </ScrollArea>
        )}

        {step === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-pink-500" />
              <Sparkles className="h-5 w-5 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold">AI記事を生成中...</p>
              <p className="text-sm text-muted-foreground">
                SEO/GEO最適化された記事を作成しています
              </p>
            </div>
            <div className="w-64 space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                <Zap className="h-4 w-4" />
                記事が生成されました
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("config");
                  setGeneratedHtml("");
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                再生成
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg p-4 bg-white dark:bg-zinc-900">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: generatedHtml }}
              />
            </ScrollArea>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleInsertOnly}
              >
                <FileText className="h-4 w-4 mr-1" />
                記事のみ挿入
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                onClick={handleInsertWithSeo}
                disabled={seoMetaMutation.isPending}
              >
                {seoMetaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                記事＋SEO情報を挿入
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Toolbar ---
function EditorToolbar({
  editor,
  onProductInsert,
  onImageUpload,
}: {
  editor: any;
  onProductInsert: () => void;
  onImageUpload: () => void;
}) {
  if (!editor) return null;

  const ToolButton = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 flex-wrap p-2 border-b bg-muted/30">
      <ToolButton
        onClick={() => editor.chain().focus().undo().run()}
        title="元に戻す"
      >
        <Undo className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().redo().run()}
        title="やり直す"
      >
        <Redo className="h-4 w-4" />
      </ToolButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="太字"
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="斜体"
      >
        <Italic className="h-4 w-4" />
      </ToolButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
        title="見出し2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
        title="見出し3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="箇条書き"
      >
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="番号付きリスト"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="引用"
      >
        <Quote className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="コードブロック"
      >
        <Code className="h-4 w-4" />
      </ToolButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolButton
        onClick={() => {
          const url = prompt("リンクURLを入力:");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive("link")}
        title="リンク"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={onImageUpload} title="画像を挿入">
        <ImageIcon className="h-4 w-4" />
      </ToolButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolButton onClick={onProductInsert} title="商品カードを挿入">
        <ShoppingBag className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

// --- SEO Settings Panel ---
function SEOPanel({
  seoTitle,
  setSeoTitle,
  seoDescription,
  setSeoDescription,
  ogImageUrl,
  setOgImageUrl,
  slug,
  setSlug,
}: {
  seoTitle: string;
  setSeoTitle: (v: string) => void;
  seoDescription: string;
  setSeoDescription: (v: string) => void;
  ogImageUrl: string;
  setOgImageUrl: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" />
          SEO設定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">スラッグ（URL）</Label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">/blog/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-8 text-xs"
              placeholder="article-slug"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">SEOタイトル</Label>
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="h-8 text-xs"
            placeholder="検索結果に表示されるタイトル"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {seoTitle.length}/60文字
          </p>
        </div>
        <div>
          <Label className="text-xs">メタディスクリプション</Label>
          <Textarea
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            className="text-xs"
            rows={3}
            placeholder="検索結果に表示される説明文"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {seoDescription.length}/160文字
          </p>
        </div>
        <div>
          <Label className="text-xs">OGP画像URL</Label>
          <Input
            value={ogImageUrl}
            onChange={(e) => setOgImageUrl(e.target.value)}
            className="h-8 text-xs"
            placeholder="SNSシェア時の画像URL"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Editor Page ---
export default function BlogEditor() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/master/blog/edit/:id");
  const articleId = params?.id ? Number(params.id) : null;
  const isNew = !articleId;

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageKey, setCoverImageKey] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showSeoPanel, setShowSeoPanel] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [generatingCoverImage, setGeneratingCoverImage] = useState(false);
  const [coverImageStyle, setCoverImageStyle] = useState<"modern" | "minimal" | "vibrant" | "professional" | "creative">("modern");

  // Data
  const { data: categories } = trpc.blog.listCategories.useQuery();
  const { data: tags } = trpc.blog.listTags.useQuery();
  const { data: existingArticle, isLoading: loadingArticle } = trpc.blog.getById.useQuery(
    { id: articleId! },
    { enabled: !!articleId }
  );

  const utils = trpc.useUtils();
  const createMutation = trpc.blog.create.useMutation();
  const updateMutation = trpc.blog.update.useMutation();
  const uploadMutation = trpc.blog.uploadCoverImage.useMutation();

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "記事を書き始めましょう... （商品カードを挿入するにはツールバーの🛍ボタンを使用）",
      }),
      ProductCard,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4",
      },
    },
  });

  // Load existing article data
  useEffect(() => {
    if (existingArticle && editor) {
      setTitle(existingArticle.title);
      setSlug(existingArticle.slug);
      setExcerpt(existingArticle.excerpt || "");
      setCoverImageUrl(existingArticle.coverImageUrl || "");
      setCoverImageKey(existingArticle.coverImageKey || "");
      setCategoryId(existingArticle.categoryId);
      setSelectedTagIds(existingArticle.tagIds || []);
      setStatus(existingArticle.status);
      setSeoTitle(existingArticle.seoTitle || "");
      setSeoDescription(existingArticle.seoDescription || "");
      setOgImageUrl(existingArticle.ogImageUrl || "");
      setSlugManuallyEdited(true);
      if (existingArticle.content) {
        editor.commands.setContent(existingArticle.content as any);
      }
    }
  }, [existingArticle, editor]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManuallyEdited]);

  // AI cover image mutation (declared before handleAIInsert to avoid TDZ)
  const coverImageMutation = trpc.blog.generateCoverImage.useMutation();

  // Handle AI generated content insertion
  const handleAIInsert = useCallback(
    (html: string, seoData?: any) => {
      if (!editor) return;
      editor.commands.setContent(html);
      if (seoData) {
        if (seoData.seoTitle) setSeoTitle(seoData.seoTitle);
        if (seoData.seoDescription) setSeoDescription(seoData.seoDescription);
        if (seoData.slug) {
          setSlug(seoData.slug);
          setSlugManuallyEdited(true);
        }
        if (seoData.excerpt) setExcerpt(seoData.excerpt);
      }
      toast.success("AI生成記事をエディタに挿入しました");

      // Auto-generate cover image if title is available and no cover image exists
      const currentTitle = seoData?.seoTitle || title;
      if (currentTitle && !coverImageUrl) {
        toast.info("カバー画像もAIで自動生成します...");
        setGeneratingCoverImage(true);
        coverImageMutation.mutateAsync({
          title: currentTitle,
          keywords: seoData?.suggestedTags || [],
          style: coverImageStyle,
          articleId: articleId || undefined,
        }).then((result) => {
          if (result.url) {
            setCoverImageUrl(result.url);
            setCoverImageKey(result.key);
            toast.success("AIカバー画像を生成しました");
          }
        }).catch((err: any) => {
          console.error("Auto cover image generation failed:", err);
          toast.error("カバー画像の自動生成に失敗しました");
        }).finally(() => {
          setGeneratingCoverImage(false);
        });
      }
    },
    [editor, title, coverImageUrl, coverImageStyle, articleId, coverImageMutation]
  );

  // Insert product card
  const handleProductSelect = useCallback(
    (product: any) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "productCard",
          attrs: {
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            productImage: product.imageUrl || "",
            brandName: product.brandName || "",
          },
        })
        .run();
    },
    [editor]
  );

  // Handle image upload for editor
  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const result = await uploadMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64,
          });
          editor.chain().focus().setImage({ src: result.url }).run();
        } catch (err: any) {
          toast.error("画像のアップロードに失敗しました");
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor, uploadMutation]);

  // Handle cover image upload
  const handleCoverImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const result = await uploadMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64,
          });
          setCoverImageUrl(result.url);
          setCoverImageKey(result.key);
          toast.success("カバー画像をアップロードしました");
        } catch (err: any) {
          toast.error("画像のアップロードに失敗しました");
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [uploadMutation]);

  // Handle AI cover image generation
  const handleAICoverImageGenerate = useCallback(async () => {
    if (!title.trim()) {
      toast.error("タイトルを入力してください");
      return;
    }
    setGeneratingCoverImage(true);
    try {
      const result = await coverImageMutation.mutateAsync({
        title: title.trim(),
        keywords: [],
        style: coverImageStyle,
        articleId: articleId || undefined,
      });
      if (result.url) {
        setCoverImageUrl(result.url);
        setCoverImageKey(result.key);
        toast.success("AIカバー画像を生成しました");
      }
    } catch (err: any) {
      toast.error(err.message || "AI画像生成に失敗しました");
    } finally {
      setGeneratingCoverImage(false);
    }
  }, [title, coverImageStyle, articleId, coverImageMutation]);

  // Save article
  const handleSave = useCallback(
    async (publishStatus?: "draft" | "published") => {
      if (!title.trim()) {
        toast.error("タイトルを入力してください");
        return;
      }
      if (!slug.trim()) {
        toast.error("スラッグを入力してください");
        return;
      }
      if (!editor) return;

      setSaving(true);
      try {
        const content = editor.getJSON();
        const contentHtml = editor.getHTML();
        const saveStatus = publishStatus || status;

        const data = {
          title,
          slug,
          excerpt: excerpt || undefined,
          content,
          contentHtml,
          coverImageUrl: coverImageUrl || undefined,
          coverImageKey: coverImageKey || undefined,
          categoryId: categoryId || undefined,
          status: saveStatus,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          ogImageUrl: ogImageUrl || undefined,
          tagIds: selectedTagIds,
        };

        if (isNew) {
          const result = await createMutation.mutateAsync(data);
          toast.success("記事を作成しました");
          navigate(`/master/blog/edit/${result.id}`);
        } else {
          await updateMutation.mutateAsync({ id: articleId!, ...data });
          toast.success("記事を保存しました");
          utils.blog.getById.invalidate({ id: articleId! });
          utils.blog.list.invalidate();
        }

        if (publishStatus) {
          setStatus(publishStatus);
        }
      } catch (err: any) {
        toast.error(err.message || "保存に失敗しました");
      } finally {
        setSaving(false);
      }
    },
    [
      title, slug, excerpt, editor, coverImageUrl, coverImageKey,
      categoryId, status, seoTitle, seoDescription, ogImageUrl,
      selectedTagIds, isNew, articleId, createMutation, updateMutation,
      navigate, utils,
    ]
  );

  if (articleId && loadingArticle) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/master/blog")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {isNew ? "新規記事" : "記事を編集"}
              </h1>
              <div className="flex items-center gap-2">
                <Badge
                  variant={status === "published" ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {status === "published" ? "公開中" : status === "scheduled" ? "予約" : "下書き"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAIGenerate(true)}
              className="border-pink-300 text-pink-600 hover:bg-pink-50 dark:border-pink-700 dark:text-pink-400 dark:hover:bg-pink-950"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI生成
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSeoPanel(!showSeoPanel)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              SEO
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("draft")}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-1" />
              下書き保存
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave("published")}
              disabled={saving}
            >
              {status === "published" ? (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  更新
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  公開
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Main Editor */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="記事タイトルを入力..."
            className="text-2xl font-bold border-0 border-b rounded-none px-0 h-auto py-3 focus-visible:ring-0 focus-visible:border-primary"
          />

          {/* Cover Image */}
          <div>
            {coverImageUrl ? (
              <div className="relative group">
                <img
                  src={coverImageUrl}
                  alt="カバー画像"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCoverImageUpload}
                  >
                    変更
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAICoverImageGenerate}
                    disabled={generatingCoverImage}
                  >
                    {generatingCoverImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    AI再生成
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setCoverImageUrl("");
                      setCoverImageKey("");
                    }}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleCoverImageUpload}
                    className="flex-1 h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-sm">画像をアップロード</span>
                  </button>
                  <button
                    onClick={handleAICoverImageGenerate}
                    disabled={generatingCoverImage || !title.trim()}
                    className="flex-1 h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-purple-500 hover:text-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingCoverImage ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                        <span className="text-sm text-purple-500">AI生成中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        <span className="text-sm">AIでカバー画像を生成</span>
                      </>
                    )}
                  </button>
                </div>
                {!title.trim() && (
                  <p className="text-xs text-muted-foreground">※ AI画像生成にはタイトルの入力が必要です</p>
                )}
                {/* Cover Image Style Selector */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">画像スタイル:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {(["modern", "minimal", "vibrant", "professional", "creative"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => setCoverImageStyle(style)}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          coverImageStyle === style
                            ? "bg-purple-500/10 border-purple-500 text-purple-600"
                            : "border-border text-muted-foreground hover:border-purple-300"
                        }`}
                      >
                        {style === "modern" ? "モダン" : style === "minimal" ? "ミニマル" : style === "vibrant" ? "ビビッド" : style === "professional" ? "プロ" : "クリエイティブ"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Excerpt */}
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="記事の抜粋（一覧表示用）..."
            rows={2}
            className="text-sm"
          />

          {/* Editor */}
          <Card className="overflow-hidden">
            <EditorToolbar
              editor={editor}
              onProductInsert={() => setShowProductSearch(true)}
              onImageUpload={handleImageUpload}
            />
            <div className="blog-editor-content">
              <EditorContent editor={editor} />
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4 hidden lg:block">
          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">カテゴリ</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={categoryId || ""}
                onChange={(e) =>
                  setCategoryId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">カテゴリなし</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">タグ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {tags?.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={
                      selectedTagIds.includes(tag.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setSelectedTagIds((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {(!tags || tags.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    タグがまだありません
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SEO Panel */}
          {showSeoPanel && (
            <SEOPanel
              seoTitle={seoTitle}
              setSeoTitle={setSeoTitle}
              seoDescription={seoDescription}
              setSeoDescription={setSeoDescription}
              ogImageUrl={ogImageUrl}
              setOgImageUrl={setOgImageUrl}
              slug={slug}
              setSlug={(v) => {
                setSlug(v);
                setSlugManuallyEdited(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Product Search Dialog */}
      <ProductSearchDialog
        open={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onSelect={handleProductSelect}
      />

      {/* AI Generate Dialog */}
      <AIGenerateDialog
        open={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        onInsert={handleAIInsert}
      />

      {/* Editor Styles */}
      <style>{`
        .blog-editor-content .ProseMirror {
          min-height: 400px;
          padding: 1.5rem;
        }
        .blog-editor-content .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .blog-editor-content .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          border-bottom: 2px solid #ec4899;
          padding-bottom: 0.25rem;
        }
        .blog-editor-content .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .blog-editor-content .ProseMirror blockquote {
          border-left: 3px solid #ec4899;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #6b7280;
          font-style: italic;
        }
        .blog-editor-content .ProseMirror ul,
        .blog-editor-content .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .blog-editor-content .ProseMirror li {
          margin: 0.25rem 0;
        }
        .blog-editor-content .ProseMirror pre {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .blog-editor-content .ProseMirror img {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        .blog-editor-content .ProseMirror a {
          color: #ec4899;
          text-decoration: underline;
        }
        .blog-editor-content .ProseMirror .product-card-embed {
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
