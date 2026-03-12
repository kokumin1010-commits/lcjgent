/**
 * Cover Image Styles v2
 * 
 * Generates article-type-specific cover image prompts for blog posts.
 * Each article type gets multiple visual variants to ensure diversity.
 * 
 * Key improvements:
 * - Multiple style variants per article type (randomly selected)
 * - Photo-realistic styles including model/lifestyle photography
 * - Product flat-lay and editorial magazine styles
 * - No more uniform "digital illustration" — each generation is unique
 */

export type ArticleType = 'guide' | 'review' | 'comparison' | 'news' | 'howto' | 'listicle' | 'ranking' | 'ingredient_analysis';

/**
 * Detect article type from keyword and title
 */
export function detectArticleType(keyword: string, title: string): ArticleType {
  const text = `${keyword} ${title}`.toLowerCase();
  if (/ランキング|おすすめ\d+選|人気\d+選|ベスト\d+|top\s?\d+|売れ筋|best|ranking/i.test(text)) return 'ranking';
  if (/比較|vs|対決|違い|どっち|どちら|comparison|versus/i.test(text)) return 'comparison';
  if (/成分|解析|配合|ingredient|analysis|処方|全成分/i.test(text)) return 'ingredient_analysis';
  if (/レビュー|口コミ|使ってみた|体験|感想|review|実際に|本音/i.test(text)) return 'review';
  if (/方法|やり方|使い方|手順|ステップ|how\s?to|コツ|テクニック|正しい/i.test(text)) return 'howto';
  if (/新発売|新商品|ニュース|トレンド|最新|2025|2026|news|new|限定|コラボ/i.test(text)) return 'news';
  if (/選|まとめ|一覧|リスト|コレクション|list|collection/i.test(text)) return 'listicle';
  return 'guide';
}

/** Style variant for cover image generation */
interface StyleVariant {
  description: string;
  prompt: string;
}

/**
 * Multiple style variants per article type.
 * A random variant is selected each time to ensure visual diversity.
 */
const STYLE_VARIANTS: Record<ArticleType, StyleVariant[]> = {
  ranking: [
    {
      description: 'Product flat-lay photography',
      prompt: `Overhead flat-lay product photography on a clean marble surface. Multiple premium beauty and hair care products arranged in a numbered layout (1st, 2nd, 3rd). Soft natural window lighting from the left. Gold accents and small decorative elements (dried flowers, silk ribbon). Shot with a 50mm lens, shallow depth of field on edges. Luxurious, editorial product photography style. Warm neutral tones with gold highlights.`,
    },
    {
      description: 'Model with top-pick products',
      prompt: `A beautiful Asian woman with glossy, healthy hair holding a premium hair care product, smiling confidently. She is in a bright, modern bathroom with clean white tiles. Other beauty products are neatly arranged on the counter behind her. Professional beauty magazine photography, soft ring light, warm skin tones. The image conveys trust and recommendation.`,
    },
    {
      description: 'Podium-style product showcase',
      prompt: `Three elegant cylindrical podiums (gold, silver, bronze) displaying premium beauty products in a minimalist studio setting. Dramatic spotlight lighting from above. Soft gradient background transitioning from deep navy to warm rose gold. Floating sparkle particles. High-end cosmetics advertising photography style.`,
    },
  ],
  comparison: [
    {
      description: 'Side-by-side product comparison',
      prompt: `Professional product comparison photography. Two premium beauty products placed side by side on a clean white surface with a subtle dividing line between them. One side has cool blue-tinted lighting, the other warm golden lighting. Minimalist, analytical feel. Shot from a 45-degree angle with a macro lens. Clean, modern, editorial style.`,
    },
    {
      description: 'Woman choosing between products',
      prompt: `A stylish Asian woman in a bright beauty store, thoughtfully comparing two hair care products, one in each hand. She has beautiful, well-maintained hair. The store has modern shelving with warm lighting. Lifestyle photography style, natural expressions, candid feel. Soft bokeh background.`,
    },
    {
      description: 'Split-screen editorial',
      prompt: `Split-screen editorial beauty photography. Left side shows a sleek, modern hair care product with cool mint and white tones. Right side shows a competing product with warm coral and cream tones. Both sides have elegant, minimalist styling with small decorative botanicals. Professional advertising photography with perfect lighting.`,
    },
  ],
  guide: [
    {
      description: 'Model demonstrating hair care routine',
      prompt: `A beautiful Asian woman with long, flowing healthy hair in a luxurious bathroom, gently applying hair treatment. Soft morning light streaming through a frosted window. The scene is warm and inviting with premium beauty products on a marble countertop. Lifestyle editorial photography, shallow depth of field, warm golden hour tones. Aspirational, magazine-quality.`,
    },
    {
      description: 'Step-by-step beauty routine flat-lay',
      prompt: `Elegant flat-lay photography showing a complete beauty care routine. Products arranged in a circular flow pattern on a soft linen background. Numbered steps indicated by small gold circular tags. Fresh flowers, a soft towel, and natural elements as accents. Overhead shot, soft diffused lighting, warm pastel color palette. Clean, organized, and inviting.`,
    },
    {
      description: 'Cozy self-care scene',
      prompt: `A serene self-care scene: a woman's hands applying luxurious cream, surrounded by premium beauty products, a cup of herbal tea, soft candles, and fresh eucalyptus. Shot on a wooden tray on a bed with white linen. Warm, cozy atmosphere with soft natural light. Lifestyle photography, hygge aesthetic, inviting and aspirational.`,
    },
  ],
  review: [
    {
      description: 'Unboxing lifestyle shot',
      prompt: `Authentic unboxing scene of premium beauty products on a cozy desk. A woman's manicured hands opening an elegant package. Products partially revealed with tissue paper and branded packaging. Natural window light, warm tones. A cup of coffee and a small plant in the background. Lifestyle blog photography style, personal and relatable.`,
    },
    {
      description: 'Before/after hair transformation',
      prompt: `Professional beauty photography showing a stunning hair transformation. A beautiful Asian woman with gorgeous, shiny, healthy-looking hair, photographed in a salon setting with professional lighting. The image radiates confidence and satisfaction. Soft bokeh lights in the background. High-end beauty magazine style, warm skin tones.`,
    },
    {
      description: 'Product close-up with texture',
      prompt: `Extreme close-up macro photography of a premium beauty product with its luxurious texture visible — creamy, pearlescent, or gel-like. The product is swirled artistically on a clean surface. Soft, diffused studio lighting highlights the texture. Minimalist background with a subtle color gradient. High-end cosmetics advertising style.`,
    },
  ],
  howto: [
    {
      description: 'Tutorial-style with model',
      prompt: `A professional hair stylist working on a beautiful Asian client's hair in a modern, well-lit salon. The stylist is demonstrating a technique with professional tools. Clean, bright environment with mirrors and salon equipment. The client looks relaxed and happy. Professional beauty photography, warm lighting, editorial quality.`,
    },
    {
      description: 'Step-by-step hands demonstration',
      prompt: `Close-up photography of elegant hands demonstrating a beauty technique step by step. Premium products and tools arranged neatly nearby. Clean white marble surface. Soft, directional lighting creating gentle shadows. Each element is clearly visible and well-organized. Instructional yet beautiful, like a high-end beauty tutorial.`,
    },
    {
      description: 'DIY home beauty setup',
      prompt: `A beautifully arranged home beauty station with all the tools and products needed for a DIY treatment. Items laid out on a clean wooden surface with a soft towel, mirror, and natural elements. Warm, inviting atmosphere with soft natural light. The scene looks approachable and inspiring, like a Pinterest-worthy beauty setup.`,
    },
  ],
  news: [
    {
      description: 'Editorial magazine cover style',
      prompt: `Bold, eye-catching editorial beauty photography. A confident Asian model with striking makeup and perfect hair, posed dynamically against a vibrant gradient background (deep purple to hot pink). Professional studio lighting with dramatic rim light. Fashion magazine cover energy. Modern, trendy, attention-grabbing.`,
    },
    {
      description: 'New product launch scene',
      prompt: `Dramatic product launch photography. A sleek new beauty product spotlighted on a reflective black surface. Colorful light beams (neon pink, electric blue) creating dynamic streaks around the product. Futuristic, high-tech atmosphere. Premium cosmetics advertising style with cinematic lighting.`,
    },
    {
      description: 'Trend collage editorial',
      prompt: `Modern beauty trend editorial photography. A stylish Asian woman in a contemporary setting, surrounded by trending beauty products and lifestyle elements. Bold, vibrant colors — electric coral, deep teal, bright yellow accents. Dynamic composition with interesting angles. Fashion-forward, Instagram-worthy aesthetic.`,
    },
  ],
  listicle: [
    {
      description: 'Curated collection flat-lay',
      prompt: `A beautifully curated collection of diverse beauty products arranged in an aesthetic grid pattern on a soft pink background. Each product has a small numbered tag. Variety of textures, sizes, and colors creating visual interest. Overhead photography with even, soft lighting. Clean, organized, and visually satisfying. Magazine editorial style.`,
    },
    {
      description: 'Shopping bag spill',
      prompt: `Premium beauty products artfully spilling out of an elegant shopping bag onto a clean white surface. A mix of hair care, skincare, and beauty tools creating a colorful, exciting display. Soft natural lighting, warm tones. The scene conveys the excitement of a beauty haul. Lifestyle photography, aspirational and fun.`,
    },
    {
      description: 'Model with multiple products',
      prompt: `A cheerful Asian woman surrounded by floating beauty products in a bright, airy studio. She is reaching for one of the products with a delighted expression. Soft pastel background with gentle gradient. Professional beauty advertising photography with perfect lighting. Fun, energetic, and engaging.`,
    },
  ],
  ingredient_analysis: [
    {
      description: 'Scientific beauty lab',
      prompt: `A modern cosmetics laboratory scene. A scientist in a clean white coat examining a beauty product formulation under professional lighting. Glass beakers, test tubes with colorful serums, and molecular models on the desk. Clean, clinical environment with warm accent lighting. Scientific yet beautiful, conveying expertise and trust.`,
    },
    {
      description: 'Natural ingredients close-up',
      prompt: `Stunning close-up photography of natural beauty ingredients — fresh botanicals, essential oils in glass droppers, honey, aloe vera, and flower extracts — arranged artistically around a premium beauty product. Clean white background with soft shadows. The ingredients look fresh and vibrant. High-end cosmetics ingredient photography.`,
    },
    {
      description: 'Molecular beauty art',
      prompt: `Abstract beauty science visualization. Translucent molecular structures and DNA helixes floating around premium skincare products. Soft blue and green bioluminescent glow. Clean, futuristic aesthetic with depth of field effects. The image bridges science and beauty elegantly. High-end pharmaceutical cosmetics advertising style.`,
    },
  ],
};

/**
 * Generate a cover image prompt with random variant selection for diversity
 */
export function generateCoverImagePrompt(
  title: string,
  articleType: ArticleType | string,
  keyword?: string,
): string {
  // Resolve article type
  let resolvedType: ArticleType;
  const validTypes: ArticleType[] = ['guide', 'review', 'comparison', 'news', 'howto', 'listicle', 'ranking', 'ingredient_analysis'];
  if (validTypes.includes(articleType as ArticleType)) {
    resolvedType = articleType as ArticleType;
  } else {
    resolvedType = detectArticleType(keyword || '', title);
  }

  const variants = STYLE_VARIANTS[resolvedType];
  // Random variant selection for diversity
  const variantIndex = Math.floor(Math.random() * variants.length);
  const variant = variants[variantIndex];

  const prompt = [
    `Create a professional blog cover image for an article titled: "${title}".`,
    variant.prompt,
    `Context: Japanese beauty, hair care, and skincare e-commerce.`,
    `The image should look like a real photograph, NOT a cartoon or digital illustration.`,
    `Photo-realistic, high resolution, 16:9 aspect ratio.`,
    `IMPORTANT: Absolutely no text, no words, no letters, no numbers, no watermarks on the image.`,
  ].join(' ');

  return prompt;
}

/**
 * Get the article type label in Japanese
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
