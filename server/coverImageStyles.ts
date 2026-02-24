/**
 * Cover Image Styles
 * 
 * Generates article-type-specific cover image prompts for blog posts.
 * Each article type (ranking, comparison, guide, review, news, howto, listicle)
 * gets a distinct visual style to make the blog visually diverse and recognizable.
 * 
 * Also provides keyword-based article type detection for cases where
 * the article type is not explicitly set.
 */

export type ArticleType = 'guide' | 'review' | 'comparison' | 'news' | 'howto' | 'listicle' | 'ranking' | 'ingredient_analysis';

/**
 * Detect article type from keyword and title
 * Used when articleType is not explicitly set or is generic
 */
export function detectArticleType(keyword: string, title: string): ArticleType {
  const text = `${keyword} ${title}`.toLowerCase();

  // Ranking detection
  if (/ランキング|おすすめ\d+選|人気\d+選|ベスト\d+|top\s?\d+|売れ筋|best|ranking/i.test(text)) {
    return 'ranking';
  }

  // Comparison detection
  if (/比較|vs|対決|違い|どっち|どちら|comparison|versus/i.test(text)) {
    return 'comparison';
  }

  // Ingredient analysis detection
  if (/成分|解析|配合|ingredient|analysis|処方|全成分/i.test(text)) {
    return 'ingredient_analysis';
  }

  // Review detection
  if (/レビュー|口コミ|使ってみた|体験|感想|review|実際に|本音/i.test(text)) {
    return 'review';
  }

  // HowTo detection
  if (/方法|やり方|使い方|手順|ステップ|how\s?to|コツ|テクニック|正しい/i.test(text)) {
    return 'howto';
  }

  // News detection
  if (/新発売|新商品|ニュース|トレンド|最新|2025|2026|news|new|限定|コラボ/i.test(text)) {
    return 'news';
  }

  // Listicle detection
  if (/選|まとめ|一覧|リスト|コレクション|list|collection/i.test(text)) {
    return 'listicle';
  }

  // Default to guide
  return 'guide';
}

/**
 * Style configurations for each article type
 */
interface CoverImageStyle {
  /** Visual style description */
  visualStyle: string;
  /** Color palette description */
  colorPalette: string;
  /** Layout/composition description */
  composition: string;
  /** Mood/atmosphere */
  mood: string;
  /** Additional elements to include */
  elements: string;
}

const COVER_IMAGE_STYLES: Record<ArticleType, CoverImageStyle> = {
  ranking: {
    visualStyle: 'Bold, dynamic editorial layout with numbered ranking elements and gold/trophy accents',
    colorPalette: 'Rich gold, deep navy blue, and white. Metallic gold gradients for premium feel',
    composition: 'Top-down flat lay arrangement of beauty products with numbered badges (1st, 2nd, 3rd). Trophy or crown icon at the top',
    mood: 'Prestigious, authoritative, exciting discovery',
    elements: 'Gold medal badges, star ratings, podium-style arrangement, sparkle effects',
  },

  comparison: {
    visualStyle: 'Clean split-screen layout with VS divider, analytical and structured',
    colorPalette: 'Coral pink vs mint green split, with white divider. Clean contrasting colors',
    composition: 'Side-by-side split layout with products on each side. Clear VS or comparison arrows in the center',
    mood: 'Objective, analytical, helpful decision-making',
    elements: 'VS badge, comparison arrows, checkmark/cross icons, split background',
  },

  guide: {
    visualStyle: 'Warm, inviting editorial style with soft gradients and professional beauty photography feel',
    colorPalette: 'Soft lavender, cream, and rose gold. Gentle pastel gradients',
    composition: 'Central product or concept with radiating guide elements. Open book or compass motif',
    mood: 'Trustworthy, educational, approachable',
    elements: 'Lightbulb icon, guide arrows, step indicators, soft bokeh background',
  },

  review: {
    visualStyle: 'Authentic, lifestyle-oriented with real-feel texture and personal touch',
    colorPalette: 'Warm beige, soft pink, and natural earth tones. Instagram-aesthetic warmth',
    composition: 'Close-up product shot with hand or lifestyle context. Star rating overlay. Authentic, unboxing feel',
    mood: 'Honest, personal, relatable',
    elements: 'Star rating display, speech bubble quotes, heart icons, natural lighting feel',
  },

  howto: {
    visualStyle: 'Step-by-step instructional layout with numbered circles and clean process flow',
    colorPalette: 'Fresh teal, white, and light gray. Clean, clinical precision with warmth',
    composition: 'Sequential step layout (1→2→3) with product at center. Hands demonstrating technique',
    mood: 'Clear, instructional, empowering',
    elements: 'Numbered step circles, arrow flow, hands/tools, progress bar',
  },

  news: {
    visualStyle: 'Bold, attention-grabbing editorial with breaking-news energy and modern typography feel',
    colorPalette: 'Vibrant red, black, and white. High contrast, urgent feel',
    composition: 'Dynamic diagonal layout with product hero shot. Flash/burst effect. Magazine cover style',
    mood: 'Exciting, urgent, trendsetting',
    elements: 'NEW badge, flash burst, trend arrows, calendar/date element',
  },

  listicle: {
    visualStyle: 'Colorful grid mosaic layout with multiple product thumbnails arranged attractively',
    colorPalette: 'Multi-color pastel palette — each item gets a different accent color. Rainbow gradient undertone',
    composition: 'Grid or collage arrangement of multiple products. Numbered items in a visually pleasing pattern',
    mood: 'Fun, diverse, comprehensive',
    elements: 'Numbered grid cells, colorful product thumbnails, collection/gallery feel',
  },

  ingredient_analysis: {
    visualStyle: 'Scientific, laboratory-inspired with molecular structures and clean data visualization',
    colorPalette: 'Clinical white, emerald green, and deep blue. Scientific precision colors',
    composition: 'Microscope or lab flask with product. Molecular structure diagrams. Data chart overlay',
    mood: 'Scientific, authoritative, detailed',
    elements: 'Molecular diagrams, magnifying glass, lab equipment, ingredient list overlay, chemical formulas',
  },
};

/**
 * Generate a cover image prompt for the given article type and title
 */
export function generateCoverImagePrompt(
  title: string,
  articleType: ArticleType | string,
  keyword?: string,
): string {
  // Resolve article type — detect from title/keyword if generic
  let resolvedType: ArticleType;
  const validTypes: ArticleType[] = ['guide', 'review', 'comparison', 'news', 'howto', 'listicle', 'ranking', 'ingredient_analysis'];

  if (validTypes.includes(articleType as ArticleType)) {
    resolvedType = articleType as ArticleType;
  } else {
    resolvedType = detectArticleType(keyword || '', title);
  }

  const style = COVER_IMAGE_STYLES[resolvedType];

  const prompt = [
    `Professional blog cover image for: "${title}".`,
    `Visual Style: ${style.visualStyle}.`,
    `Color Palette: ${style.colorPalette}.`,
    `Composition: ${style.composition}.`,
    `Mood: ${style.mood}.`,
    `Include elements: ${style.elements}.`,
    `Context: Japanese beauty and hair care e-commerce (LCJ MALL / TikTok Shop).`,
    `High quality, 16:9 aspect ratio, modern digital illustration.`,
    `IMPORTANT: No text overlay, no Japanese characters, no English text on the image.`,
  ].join(' ');

  return prompt;
}

/**
 * Get the article type label in Japanese (for logging/display)
 */
export function getArticleTypeLabel(articleType: ArticleType): string {
  const labels: Record<ArticleType, string> = {
    ranking: 'ランキング',
    comparison: '比較',
    guide: 'ガイド',
    review: 'レビュー',
    howto: 'ハウツー',
    news: 'ニュース',
    listicle: 'まとめ',
    ingredient_analysis: '成分解析',
  };
  return labels[articleType] || articleType;
}
