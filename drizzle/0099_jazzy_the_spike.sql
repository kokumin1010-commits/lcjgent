CREATE TABLE `auto_post_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`articleId` int,
	`status` enum('pending','generating','image_generating','publishing','completed','failed') NOT NULL DEFAULT 'pending',
	`keyword` varchar(255),
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auto_post_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auto_post_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`intervalDays` int NOT NULL DEFAULT 1,
	`preferredHour` int NOT NULL DEFAULT 10,
	`keywordStrategy` enum('preset','custom','ai_suggest') NOT NULL DEFAULT 'preset',
	`customKeywords` json,
	`categoryId` int,
	`articleType` enum('guide','review','comparison','news','howto','listicle') NOT NULL DEFAULT 'guide',
	`tone` enum('professional','casual','friendly','authoritative') NOT NULL DEFAULT 'professional',
	`articleLength` enum('short','standard','long') NOT NULL DEFAULT 'standard',
	`language` enum('ja','en','zh','ko','th') NOT NULL DEFAULT 'ja',
	`generateImages` boolean NOT NULL DEFAULT true,
	`autoPublish` enum('draft','publish','scheduled') NOT NULL DEFAULT 'draft',
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`totalGenerated` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auto_post_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blog_article_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `blog_article_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blog_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`excerpt` text,
	`content` json,
	`contentHtml` text,
	`coverImageUrl` text,
	`coverImageKey` varchar(512),
	`categoryId` int,
	`authorId` int NOT NULL,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`seoTitle` varchar(255),
	`seoDescription` text,
	`ogImageUrl` text,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `blog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `blog_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blog_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerLineUserId` int NOT NULL,
	`inviteeLineUserId` int NOT NULL,
	`campaignId` int NOT NULL,
	`referrerPointsAwarded` int NOT NULL DEFAULT 0,
	`inviteePointsAwarded` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `preset_keywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`category` varchar(100),
	`priority` int NOT NULL DEFAULT 0,
	`usedCount` int NOT NULL DEFAULT 0,
	`lastUsedAt` timestamp,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `preset_keywords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipt_kakuhen_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptType` enum('point_request','line_receipt') NOT NULL,
	`receiptId` int NOT NULL,
	`userId` int,
	`lineUserId` varchar(64),
	`tiktokUrl` text,
	`baseRate` decimal(5,2) NOT NULL DEFAULT '1.00',
	`boostedRate` decimal(5,2) NOT NULL DEFAULT '1.00',
	`isKakuhen` boolean NOT NULL DEFAULT false,
	`lotteryNumber` varchar(10),
	`winningNumber` varchar(10),
	`isJackpot` boolean NOT NULL DEFAULT false,
	`orderAmount` int NOT NULL,
	`basePoints` int NOT NULL,
	`actualPoints` int NOT NULL,
	`bonusPoints` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipt_kakuhen_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipt_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptType` enum('point_request','line_receipt') NOT NULL,
	`receiptId` int NOT NULL,
	`kakuhenResultId` int,
	`userId` int,
	`lineUserId` varchar(64),
	`productName` text NOT NULL,
	`brandName` varchar(255),
	`shopName` varchar(255),
	`purchaseAmount` int,
	`category` varchar(100),
	`rating` int NOT NULL,
	`reviewText` text NOT NULL,
	`tags` json,
	`receiptImageUrl` text,
	`tiktokUrl` text,
	`isVisible` boolean NOT NULL DEFAULT true,
	`reportCount` int NOT NULL DEFAULT 0,
	`helpfulCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receipt_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spin_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` int NOT NULL,
	`campaignId` int NOT NULL,
	`rewardItemId` int NOT NULL,
	`pointsWon` int NOT NULL,
	`isSpecialSpin` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spin_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `friend_referrals`;--> statement-breakpoint
DROP TABLE `user_spin_history`;--> statement-breakpoint
ALTER TABLE `spin_reward_items` MODIFY COLUMN `label` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `spin_reward_items` MODIFY COLUMN `probability` int NOT NULL;--> statement-breakpoint
ALTER TABLE `spin_reward_tables` MODIFY COLUMN `name` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `line_point_transactions` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `line_point_transactions` ADD `expired` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `line_point_transactions` ADD `remainingAmount` bigint;--> statement-breakpoint
ALTER TABLE `line_users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `expired` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `remainingAmount` bigint;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` ADD `lineUserId` int;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` ADD `activityType` varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` ADD `pointsAmount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` ADD `stageNumber` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `spin_reward_items` ADD `tableId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `spin_reward_items` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `spin_reward_tables` ADD `isSpecial` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `spin_reward_tables` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `lineUserId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `campaignId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `referralCode` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `totalReferrals` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `currentStage` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `totalPointsEarned` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `pendingSpins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `pendingSpecialSpins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `titleLevel` varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `monthlyPointsEarned` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `monthlyPointsResetAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_referral_progress` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` DROP COLUMN `line_user_id`;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` DROP COLUMN `activity_type`;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` DROP COLUMN `points_amount`;--> statement-breakpoint
ALTER TABLE `referral_activity_feed` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `spin_reward_items` DROP COLUMN `table_id`;--> statement-breakpoint
ALTER TABLE `spin_reward_items` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `spin_reward_tables` DROP COLUMN `is_special`;--> statement-breakpoint
ALTER TABLE `spin_reward_tables` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `line_user_id`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `campaign_id`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `referral_code`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `total_referrals`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `current_stage`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `total_points_earned`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `pending_spins`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `pending_special_spins`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `title_level`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `monthly_points_earned`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `monthly_points_reset_at`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `user_referral_progress` DROP COLUMN `updated_at`;