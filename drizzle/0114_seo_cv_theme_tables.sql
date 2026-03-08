-- SEO指標テーブル
CREATE TABLE IF NOT EXISTS `blog_article_seo_metrics` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `articleId` int NOT NULL,
  `slug` varchar(255) NOT NULL,
  `impressions` int NOT NULL DEFAULT 0,
  `clicks` int NOT NULL DEFAULT 0,
  `ctr` decimal(6,4) DEFAULT '0.0000',
  `avgPosition` decimal(6,2) DEFAULT '0.00',
  `isIndexed` boolean NOT NULL DEFAULT false,
  `indexedAt` timestamp,
  `lastCheckedAt` timestamp,
  `periodStart` timestamp,
  `periodEnd` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);--> statement-breakpoint

-- CV計測テーブル
CREATE TABLE IF NOT EXISTS `blog_article_stats` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `articleId` int NOT NULL,
  `titlePattern` varchar(32),
  `articleType` varchar(32),
  `categorySlug` varchar(128),
  `mallClicks` int DEFAULT 0,
  `productClicks` int DEFAULT 0,
  `bannerClicks` int DEFAULT 0,
  `internalLinkCount` int DEFAULT 0,
  `qualityScore` int DEFAULT 0,
  `rewriteCount` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);--> statement-breakpoint

-- テーマ重複防止ログテーブル
CREATE TABLE IF NOT EXISTS `blog_article_theme_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `articleId` int,
  `categorySlug` varchar(128) NOT NULL,
  `problemType` varchar(128),
  `articleType` varchar(32) NOT NULL,
  `keyword` varchar(255) NOT NULL,
  `titlePattern` varchar(32),
  `createdAt` timestamp NOT NULL DEFAULT (now())
);--> statement-breakpoint

-- blogArticlesテーブルにtitlePatternとarticleThemeカラムを追加
ALTER TABLE `blog_articles` ADD COLUMN IF NOT EXISTS `titlePattern` varchar(32);--> statement-breakpoint
ALTER TABLE `blog_articles` ADD COLUMN IF NOT EXISTS `articleTheme` text;
