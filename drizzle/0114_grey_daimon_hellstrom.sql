CREATE TABLE `blog_article_seo_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_article_seo_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blog_article_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`mallClicks` int NOT NULL DEFAULT 0,
	`productClicks` int NOT NULL DEFAULT 0,
	`bannerClicks` int NOT NULL DEFAULT 0,
	`bannerImpressions` int NOT NULL DEFAULT 0,
	`titlePattern` varchar(50),
	`articleType` varchar(30),
	`categorySlug` varchar(100),
	`internalLinkCount` int DEFAULT 0,
	`qualityScore` int DEFAULT 0,
	`rewriteCount` int NOT NULL DEFAULT 0,
	`lastRewriteAt` timestamp,
	`rewriteReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_article_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_article_stats_articleId_unique` UNIQUE(`articleId`)
);
--> statement-breakpoint
CREATE TABLE `blog_article_theme_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`categorySlug` varchar(100) NOT NULL,
	`problemType` varchar(100),
	`articleType` varchar(30) NOT NULL,
	`keyword` varchar(255),
	`titlePattern` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blog_article_theme_log_id` PRIMARY KEY(`id`)
);
