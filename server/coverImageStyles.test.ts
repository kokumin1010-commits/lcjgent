import { describe, it, expect } from 'vitest';
import { detectArticleType, generateCoverImagePrompt, getArticleTypeLabel, type ArticleType } from './coverImageStyles';

describe('detectArticleType', () => {
  it('should detect ranking articles', () => {
    expect(detectArticleType('シャンプー ランキング', '')).toBe('ranking');
    expect(detectArticleType('', 'おすすめ10選！人気シャンプー')).toBe('ranking');
    expect(detectArticleType('', 'ベスト5 ヘアオイル')).toBe('ranking');
    expect(detectArticleType('売れ筋', 'ヘアケア商品')).toBe('ranking');
    expect(detectArticleType('top 10', 'hair products')).toBe('ranking');
  });

  it('should detect comparison articles', () => {
    expect(detectArticleType('シャンプーA vs シャンプーB', '')).toBe('comparison');
    expect(detectArticleType('', '人気シャンプー比較')).toBe('comparison');
    expect(detectArticleType('', 'どっちがいい？AとBの違い')).toBe('comparison');
  });

  it('should detect ingredient analysis articles', () => {
    expect(detectArticleType('成分解析', '')).toBe('ingredient_analysis');
    expect(detectArticleType('', '全成分を徹底分析')).toBe('ingredient_analysis');
    expect(detectArticleType('', 'シャンプーの配合成分')).toBe('ingredient_analysis');
  });

  it('should detect review articles', () => {
    expect(detectArticleType('レビュー', '')).toBe('review');
    expect(detectArticleType('', '使ってみた感想')).toBe('review');
    expect(detectArticleType('', '口コミまとめ')).toBe('review');
  });

  it('should detect howto articles', () => {
    expect(detectArticleType('正しい使い方', '')).toBe('howto');
    expect(detectArticleType('', 'シャンプーの方法とコツ')).toBe('howto');
    expect(detectArticleType('', 'ヘアカラーのやり方ステップ')).toBe('howto');
  });

  it('should detect news articles', () => {
    expect(detectArticleType('新発売', '')).toBe('news');
    expect(detectArticleType('', '2026年最新トレンド')).toBe('news');
    expect(detectArticleType('', '限定コラボ商品')).toBe('news');
  });

  it('should detect listicle articles', () => {
    expect(detectArticleType('', 'ヘアケアアイテムまとめ一覧')).toBe('listicle');
  });

  it('should default to guide for generic keywords', () => {
    expect(detectArticleType('シャンプー', '髪のお手入れ')).toBe('guide');
    expect(detectArticleType('ヘアケア', '')).toBe('guide');
  });

  it('should prioritize ranking over listicle when both match', () => {
    // "おすすめ10選" matches ranking first
    expect(detectArticleType('', 'おすすめ10選まとめ')).toBe('ranking');
  });
});

describe('generateCoverImagePrompt', () => {
  it('should generate a prompt for ranking articles', () => {
    const prompt = generateCoverImagePrompt('人気シャンプーランキング', 'ranking', 'シャンプー');
    expect(prompt).toContain('人気シャンプーランキング');
    expect(prompt).toContain('gold');
    expect(prompt).toContain('ranking');
    expect(prompt).toContain('No text overlay');
  });

  it('should generate a prompt for comparison articles', () => {
    const prompt = generateCoverImagePrompt('AとBの比較', 'comparison');
    expect(prompt).toContain('AとBの比較');
    expect(prompt).toContain('VS');
    expect(prompt).toContain('split');
  });

  it('should generate a prompt for guide articles', () => {
    const prompt = generateCoverImagePrompt('ヘアケアガイド', 'guide');
    expect(prompt).toContain('ヘアケアガイド');
    expect(prompt).toContain('lavender');
  });

  it('should generate a prompt for ingredient_analysis articles', () => {
    const prompt = generateCoverImagePrompt('成分解析', 'ingredient_analysis');
    expect(prompt).toContain('成分解析');
    expect(prompt).toContain('Scientific');
    expect(prompt).toContain('Molecular');
  });

  it('should generate a prompt for review articles', () => {
    const prompt = generateCoverImagePrompt('シャンプーレビュー', 'review');
    expect(prompt).toContain('シャンプーレビュー');
    expect(prompt).toContain('Authentic');
    expect(prompt).toContain('Star rating');
  });

  it('should generate a prompt for howto articles', () => {
    const prompt = generateCoverImagePrompt('正しいシャンプーの方法', 'howto');
    expect(prompt).toContain('正しいシャンプーの方法');
    expect(prompt).toContain('step');
  });

  it('should generate a prompt for news articles', () => {
    const prompt = generateCoverImagePrompt('新発売シャンプー', 'news');
    expect(prompt).toContain('新発売シャンプー');
    expect(prompt).toContain('NEW badge');
  });

  it('should generate a prompt for listicle articles', () => {
    const prompt = generateCoverImagePrompt('ヘアケアまとめ', 'listicle');
    expect(prompt).toContain('ヘアケアまとめ');
    expect(prompt).toContain('grid');
  });

  it('should auto-detect article type from title when type is unknown', () => {
    // Unknown type should trigger detection from title
    const prompt = generateCoverImagePrompt('おすすめ10選シャンプー', 'unknown_type' as any, 'シャンプー');
    // Should detect as ranking from title and use ranking style
    expect(prompt).toContain('gold');
  });

  it('should include LCJ MALL context in all prompts', () => {
    const types: ArticleType[] = ['guide', 'review', 'comparison', 'news', 'howto', 'listicle', 'ranking', 'ingredient_analysis'];
    for (const type of types) {
      const prompt = generateCoverImagePrompt('テスト記事', type);
      expect(prompt).toContain('LCJ MALL');
      expect(prompt).toContain('16:9');
      expect(prompt).toContain('No text overlay');
    }
  });
});

describe('getArticleTypeLabel', () => {
  it('should return Japanese labels for all types', () => {
    expect(getArticleTypeLabel('ranking')).toBe('ランキング');
    expect(getArticleTypeLabel('comparison')).toBe('比較');
    expect(getArticleTypeLabel('guide')).toBe('ガイド');
    expect(getArticleTypeLabel('review')).toBe('レビュー');
    expect(getArticleTypeLabel('howto')).toBe('ハウツー');
    expect(getArticleTypeLabel('news')).toBe('ニュース');
    expect(getArticleTypeLabel('listicle')).toBe('まとめ');
    expect(getArticleTypeLabel('ingredient_analysis')).toBe('成分解析');
  });
});
