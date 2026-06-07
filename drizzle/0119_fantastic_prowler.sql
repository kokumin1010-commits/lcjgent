CREATE TABLE `ab_test_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`variant_id` varchar(32) NOT NULL,
	`event_type` enum('view','cta_click','scroll_past_hero') NOT NULL,
	`dwell_time_ms` bigint,
	`page_url` text,
	`user_agent` text,
	`referrer` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_test_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_daily_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monthlyPlanId` int NOT NULL,
	`recordDate` timestamp NOT NULL,
	`spend` bigint DEFAULT 0,
	`gmv` bigint DEFAULT 0,
	`impressions` bigint DEFAULT 0,
	`clicks` bigint DEFAULT 0,
	`conversions` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ad_daily_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_form_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`contact_person` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`monthly_budget` varchar(100),
	`plan` enum('light','algorithm','market_jack') NOT NULL DEFAULT 'light',
	`message` text,
	`source` varchar(100) DEFAULT 'tiktok_ads_lp',
	`status` enum('pending','contacted','in_progress','contracted','rejected') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`reviewed_at` timestamp,
	`reviewed_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_monthly_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(7) NOT NULL,
	`liverId` int,
	`liverName` varchar(255) NOT NULL,
	`brandId` int,
	`brandName` varchar(255) NOT NULL,
	`adType` enum('short_video','live','mixed') NOT NULL DEFAULT 'mixed',
	`planType` enum('shop','talent') NOT NULL DEFAULT 'shop',
	`budget` bigint DEFAULT 0,
	`actualSpend` bigint DEFAULT 0,
	`spendRate` decimal(10,4) DEFAULT '0',
	`targetGmv` bigint DEFAULT 0,
	`targetRoi` decimal(10,4) DEFAULT '0',
	`actualGmv` bigint DEFAULT 0,
	`actualRoi` decimal(10,4) DEFAULT '0',
	`impressions` bigint DEFAULT 0,
	`clicks` bigint DEFAULT 0,
	`conversions` int DEFAULT 0,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_monthly_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100),
	`loginId` varchar(100) NOT NULL,
	`password` varchar(255) NOT NULL,
	`logoUrl` text,
	`contactEmail` varchar(320),
	`contactPhone` varchar(50),
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `agencies_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `agencies_loginId_unique` UNIQUE(`loginId`)
);
--> statement-breakpoint
CREATE TABLE `ai_coach_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`roomId` int,
	`role` enum('ai','user') NOT NULL,
	`content` text NOT NULL,
	`messageType` varchar(100),
	`contextType` varchar(100),
	`contextId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_coach_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_coach_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT '新しい会話',
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `ai_coach_rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_ad_email_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_ad_email_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_ad_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`title` varchar(500),
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`screenshotUrl` text NOT NULL,
	`screenshotKey` varchar(512),
	`extractedData` json,
	`ocrStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`memo` text,
	`lastEmailSentAt` timestamp,
	`emailSentCount` int DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_ad_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_analysis_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`cacheKey` varchar(100) NOT NULL,
	`data` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_analysis_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_monthly_gmv_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`gmvTarget` bigint NOT NULL DEFAULT 0,
	`memo` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_monthly_gmv_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_portal_performance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portalProductId` int NOT NULL,
	`brandId` int NOT NULL,
	`livestreamId` int,
	`livestreamDate` timestamp NOT NULL,
	`streamerName` varchar(255),
	`platform` varchar(100),
	`duration` int,
	`salesAmount` bigint,
	`gmv` bigint,
	`salesCount` int,
	`orderCount` int,
	`viewerCount` int,
	`peakViewers` int,
	`likes` int,
	`comments` int,
	`shares` int,
	`isVisible` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_portal_performance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_portal_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portalId` int NOT NULL,
	`brandId` int NOT NULL,
	`brandProductId` int,
	`productName` varchar(500) NOT NULL,
	`productCode` varchar(100),
	`bppCategory` varchar(255),
	`listPrice` bigint,
	`livePrice` bigint,
	`costPrice` bigint,
	`commissionRate` varchar(50),
	`productDescription` text,
	`specifications` text,
	`targetAudience` varchar(500),
	`sellingPoint1` text,
	`sellingPoint2` text,
	`sellingPoint3` text,
	`sellingPoint4` text,
	`sellingPoint5` text,
	`sellingPoint6` text,
	`usageMethod` text,
	`ingredients` text,
	`shippingInfo` text,
	`stockQuantity` int,
	`imageUrls` json,
	`imageKeys` json,
	`salesMechanism` text,
	`giftItems` text,
	`adjustedLivePrice` bigint,
	`adjustedDiscountRate` varchar(50),
	`adjustedGiftItems` text,
	`tuningNotes` text,
	`tunedBy` int,
	`tunedAt` timestamp,
	`bppStatus` enum('draft','submitted','reviewing','tuning','simulating','proposed','approved','live_ready','live_done','rejected') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`approvedAt` timestamp,
	`approvedBy` varchar(255),
	`rejectedAt` timestamp,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `brand_portal_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_portal_simulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portalProductId` int NOT NULL,
	`brandId` int NOT NULL,
	`simulationName` varchar(255),
	`priceScenarios` json,
	`recommendedScenarioIndex` int,
	`recommendationReason` text,
	`simShareToken` varchar(64),
	`sharedAt` timestamp,
	`selectedScenarioIndex` int,
	`brandFeedback` text,
	`respondedAt` timestamp,
	`simStatus2` enum('draft','shared','responded','finalized') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_portal_simulations_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_portal_simulations_simShareToken_unique` UNIQUE(`simShareToken`)
);
--> statement-breakpoint
CREATE TABLE `brand_portals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`accessToken` varchar(64) NOT NULL,
	`portalName` varchar(255),
	`welcomeMessage` text,
	`portalStatus` enum('active','suspended','expired') NOT NULL DEFAULT 'active',
	`portalExpiresAt` timestamp,
	`lastAccessedAt` timestamp,
	`accessCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_portals_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_portals_accessToken_unique` UNIQUE(`accessToken`)
);
--> statement-breakpoint
CREATE TABLE `brand_sample_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`contact_person` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`brand_name` varchar(255) NOT NULL,
	`product_url` text NOT NULL,
	`product_strength` text NOT NULL,
	`past_sales_record` text,
	`plan` enum('light','algorithm','market_jack') NOT NULL,
	`sample_count` int NOT NULL,
	`status` enum('pending','reviewing','approved','rejected') NOT NULL DEFAULT 'pending',
	`review_note` text,
	`reviewed_at` timestamp,
	`reviewed_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_sample_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brand_short_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`liverId` int,
	`liverName` varchar(255) NOT NULL,
	`contractId` int,
	`postDate` timestamp NOT NULL,
	`platform` varchar(100) DEFAULT 'TikTok',
	`videoUrl` text,
	`thumbnailUrl` text,
	`title` varchar(500),
	`productName` varchar(255),
	`productId` int,
	`views` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`saves` int DEFAULT 0,
	`status` enum('draft','scheduled','posted','failed') NOT NULL DEFAULT 'posted',
	`isViolation` int NOT NULL DEFAULT 0,
	`violationNote` text,
	`deadline` timestamp,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `brand_short_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessCardId` int NOT NULL,
	`calledBy` int NOT NULL,
	`calledAt` timestamp NOT NULL DEFAULT (now()),
	`duration` int,
	`result` enum('answered','no_answer','busy','callback','meeting_set','rejected') NOT NULL,
	`memo` text,
	`contactName` varchar(255),
	`contactCompany` varchar(255),
	`nextFollowUpAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_signatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_signatures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featured_product_acknowledgements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`featuredProductId` int NOT NULL,
	`liverId` int NOT NULL,
	`acknowledgedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_product_acknowledgements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featured_product_penalties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`featuredProductId` int NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255),
	`quotaDurationMinutes` int NOT NULL,
	`achievedDurationMinutes` int NOT NULL DEFAULT 0,
	`achievementRate` decimal(5,2) NOT NULL DEFAULT '0',
	`penaltyDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_product_penalties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featured_product_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`featuredProductId` int NOT NULL,
	`liverId` int NOT NULL,
	`achievedDurationMinutes` int NOT NULL DEFAULT 0,
	`livestreamCount` int NOT NULL DEFAULT 0,
	`salesAmount` int NOT NULL DEFAULT 0,
	`status` enum('in_progress','completed','failed') NOT NULL DEFAULT 'in_progress',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_product_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featured_product_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`featuredProductId` int NOT NULL,
	`liverId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_product_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featured_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tiktokShopUrl` varchar(500),
	`productName` varchar(255) NOT NULL,
	`productImageUrl` varchar(500),
	`brandName` varchar(255),
	`quotaDurationMinutes` int NOT NULL DEFAULT 60,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`notes` text,
	`setProposal` text,
	`talkScript` text,
	`successCase` text,
	`targetType` enum('all','specific') NOT NULL DEFAULT 'all',
	`isActive` boolean NOT NULL DEFAULT true,
	`priority` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featured_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feishu_sync_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`syncType` varchar(50) NOT NULL DEFAULT 'brands',
	`status` varchar(20) NOT NULL DEFAULT 'success',
	`totalRecords` int NOT NULL DEFAULT 0,
	`newRecords` int NOT NULL DEFAULT 0,
	`updatedRecords` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`triggeredBy` varchar(50) NOT NULL DEFAULT 'auto',
	`durationMs` int DEFAULT 0,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feishu_sync_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `index_now_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`urls` text NOT NULL,
	`urlCount` int NOT NULL DEFAULT 1,
	`trigger` varchar(50) NOT NULL DEFAULT 'manual',
	`indexNowStatus` int,
	`bingStatus` int,
	`yandexStatus` int,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `index_now_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_brain_chat_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(100),
	`sessionId` varchar(100),
	`conversationId` int,
	`role` varchar(20) NOT NULL,
	`content` text NOT NULL,
	`context` varchar(50),
	`suggestedQuestions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_brain_chat_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_brain_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(100),
	`title` varchar(255) NOT NULL,
	`context` varchar(50) DEFAULT 'chat',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_brain_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_brain_knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'meeting',
	`content` text NOT NULL,
	`summary` text,
	`participants` json,
	`tags` json,
	`meetingDate` timestamp,
	`sourceFileName` varchar(500),
	`uploadedBy` int,
	`uploadedByName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_brain_knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_badge_awards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`badgeId` int NOT NULL,
	`holderType` enum('staff','liver') NOT NULL,
	`holderId` int NOT NULL,
	`awardedAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	CONSTRAINT `lcj_coin_badge_awards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameEn` varchar(100),
	`description` text,
	`iconUrl` text,
	`iconEmoji` varchar(10),
	`category` enum('performance','loyalty','special','season','social') NOT NULL DEFAULT 'performance',
	`rarity` enum('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
	`requirement` json,
	`xpReward` int NOT NULL DEFAULT 0,
	`coinReward` bigint NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_buyback_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`maxPercentage` decimal(5,2) NOT NULL DEFAULT '20.00',
	`coinPriceAtOpen` decimal(12,4) NOT NULL,
	`totalBudget` decimal(18,2),
	`totalRequested` decimal(18,2) DEFAULT '0',
	`totalApproved` decimal(18,2) DEFAULT '0',
	`status` enum('upcoming','open','closed','settled') NOT NULL DEFAULT 'upcoming',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_coin_buyback_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_buyback_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodId` int NOT NULL,
	`holdingId` int NOT NULL,
	`holderType` enum('staff','liver') NOT NULL,
	`holderId` int NOT NULL,
	`requestedCoins` bigint NOT NULL,
	`coinPriceAtRequest` decimal(12,4) NOT NULL,
	`requestedAmount` decimal(18,2) NOT NULL,
	`approvedCoins` bigint DEFAULT 0,
	`approvedAmount` decimal(18,2) DEFAULT '0',
	`status` enum('pending','approved','rejected','settled','cancelled') NOT NULL DEFAULT 'pending',
	`reason` text,
	`approvedBy` int,
	`approvedAt` timestamp,
	`settledAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_coin_buyback_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500),
	`fileSize` int,
	`mimeType` varchar(100),
	`periodStart` varchar(20),
	`periodEnd` varchar(20),
	`extractedData` text,
	`extractedRevenue` bigint,
	`extractedNetIncome` bigint,
	`extractedTotalAssets` bigint,
	`extractedNetAssets` bigint,
	`uploadedBy` int,
	`uploadedByName` varchar(255),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`holderType` enum('staff','liver') NOT NULL,
	`holderId` int NOT NULL,
	`totalCoins` bigint NOT NULL DEFAULT 0,
	`vestedCoins` bigint NOT NULL DEFAULT 0,
	`exercisedCoins` bigint NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 1,
	`xp` bigint NOT NULL DEFAULT 0,
	`streak` int NOT NULL DEFAULT 0,
	`lastActiveDate` timestamp,
	`tierCode` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_coin_holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_peer_bonuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderHolderType` enum('staff','liver') NOT NULL,
	`senderHolderId` int NOT NULL,
	`receiverHolderType` enum('staff','liver') NOT NULL,
	`receiverHolderId` int NOT NULL,
	`coinAmount` int NOT NULL,
	`message` text NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_peer_bonuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_ranking_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(20) NOT NULL,
	`periodType` enum('monthly','season','yearly') NOT NULL,
	`holderType` enum('staff','liver') NOT NULL,
	`holderId` int NOT NULL,
	`rank` int NOT NULL,
	`totalValue` decimal(18,2) NOT NULL,
	`xpEarned` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_ranking_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`theme` varchar(100),
	`bonusMultiplier` decimal(5,2) NOT NULL DEFAULT '1.00',
	`rewards` json,
	`status` enum('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_seasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`description` text,
	`category` enum('valuation','vesting','gamification','general') NOT NULL DEFAULT 'general',
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_coin_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `lcj_coin_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_shareholders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int,
	`shareholderNo` int,
	`name` varchar(255) NOT NULL,
	`shares` int NOT NULL,
	`ratio` varchar(20),
	`shareType` varchar(50) DEFAULT '普通株式',
	`acquisitionDate` varchar(20),
	`address` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_shareholders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_tier_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tierCode` varchar(10) NOT NULL,
	`tierType` varchar(20) NOT NULL DEFAULT 'staff',
	`tierName` varchar(100) NOT NULL,
	`description` text,
	`salaryCoefficient` decimal(5,2) NOT NULL DEFAULT '0.00',
	`exampleRoles` text,
	`vestingPeriodMonths` int NOT NULL DEFAULT 36,
	`cliffMonths` int NOT NULL DEFAULT 12,
	`vestingType` varchar(30) NOT NULL DEFAULT 'monthly_flat',
	`sortOrder` int NOT NULL DEFAULT 0,
	`salaryMinJPY` int,
	`salaryMaxJPY` int,
	`salaryMinRMB` int,
	`salaryMaxRMB` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_coin_tier_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `lcj_coin_tier_templates_tierCode_unique` UNIQUE(`tierCode`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`holdingId` int NOT NULL,
	`holderType` enum('staff','liver') NOT NULL,
	`holderId` int NOT NULL,
	`transactionType` enum('grant','refresh_grant','vest','exercise','bonus','season_reward','achievement','penalty','adjustment') NOT NULL,
	`coinAmount` bigint NOT NULL,
	`coinPriceAtTime` decimal(12,4),
	`vestingScheduleId` int,
	`reason` text,
	`approvedBy` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_valuation_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`monthlyRevenue` decimal(15,2) NOT NULL,
	`psrMultiplier` decimal(5,2) NOT NULL,
	`valuationAmount` decimal(18,2) NOT NULL,
	`totalCoinsIssued` bigint NOT NULL,
	`coinPrice` decimal(12,4) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lcj_coin_valuation_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lcj_coin_vesting_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`holdingId` int NOT NULL,
	`holderType` enum('staff','liver') NOT NULL,
	`holderId` int NOT NULL,
	`grantDate` timestamp NOT NULL,
	`totalGrantCoins` bigint NOT NULL,
	`vestingType` enum('backloaded','frontloaded','flat','custom') NOT NULL DEFAULT 'backloaded',
	`vestingRates` json NOT NULL,
	`vestingPeriodMonths` int NOT NULL DEFAULT 48,
	`cliffMonths` int NOT NULL DEFAULT 12,
	`vestedSoFar` bigint NOT NULL DEFAULT 0,
	`nextVestDate` timestamp,
	`status` enum('active','completed','cancelled','paused') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lcj_coin_vesting_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_collection_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`prefecture` varchar(50),
	`pipeline` varchar(50) NOT NULL,
	`leadsFound` int DEFAULT 0,
	`executedBy` varchar(255),
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	`batchId` varchar(100),
	`status` varchar(50) DEFAULT 'completed',
	CONSTRAINT `lead_collection_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(500) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`website` varchar(500),
	`address` varchar(500),
	`category` varchar(255),
	`source` varchar(100) NOT NULL DEFAULT 'google_maps',
	`status` varchar(50) NOT NULL DEFAULT 'new',
	`contactPerson` varchar(255),
	`notes` text,
	`emailSentCount` int DEFAULT 0,
	`lastEmailSentAt` timestamp,
	`prefecture` varchar(50),
	`keyword` varchar(255),
	`googlePlaceId` varchar(255),
	`rating` decimal(2,1),
	`reviewCount` int,
	`batchId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetDate` timestamp NOT NULL,
	`liverName` varchar(255) NOT NULL,
	`liverId` int,
	`scheduleId` int,
	`scheduledStartTime` timestamp,
	`scheduledEndTime` timestamp,
	`suggestionText` text NOT NULL,
	`promptUsed` text,
	`sentToLineGroupId` varchar(64),
	`sentToLineGroupName` varchar(255),
	`lineSendSuccess` boolean NOT NULL DEFAULT false,
	`lineSendError` text,
	`generatedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `livestream_promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`livestreamId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`originalPrice` bigint NOT NULL,
	`discountPrice` bigint NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`discountRate` int DEFAULT 0,
	`totalRevenue` bigint DEFAULT 0,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `livestream_promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`variantType` varchar(100),
	`sku` varchar(100),
	`price` int,
	`stock` int NOT NULL DEFAULT 0,
	`imageUrl` text,
	`imageKey` varchar(512),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `master_set_adoptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`suggestionId` int NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255),
	`customPrice` bigint,
	`livestreamId` int,
	`actualSales` int,
	`actualRevenue` bigint,
	`adoptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_set_adoptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `master_set_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`suggestionId` int NOT NULL,
	`action` varchar(50) NOT NULL,
	`reason` text,
	`category` varchar(100),
	`sentiment` varchar(20),
	`keywords` json,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_set_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `master_set_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`suggestionId` int NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255),
	`rating` int NOT NULL,
	`comment` text,
	`category` varchar(100),
	`sentiment` varchar(20),
	`keywords` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_set_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `master_set_suggestion_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`suggestionId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`originalPrice` bigint NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`isFree` tinyint DEFAULT 0,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_set_suggestion_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `master_set_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`suggestedPrice` bigint NOT NULL,
	`totalOriginalPrice` bigint DEFAULT 0,
	`suggestedDiscountRate` int DEFAULT 0,
	`expectedSales` int DEFAULT 0,
	`expectedRevenue` bigint DEFAULT 0,
	`aiReasoning` text,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`priority` int DEFAULT 0,
	`validFrom` timestamp,
	`validUntil` timestamp,
	`adoptionCount` int DEFAULT 0,
	`createdBy` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `master_set_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mega_channel_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255) NOT NULL,
	`action` enum('qualified','approved','rejected','suspended','restored') NOT NULL,
	`previousStatus` varchar(50),
	`newStatus` varchar(50) NOT NULL,
	`avgHourlyRate` int,
	`note` text,
	`actionBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mega_channel_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mega_channel_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255) NOT NULL,
	`status` enum('not_qualified','qualified','approved','rejected','suspended') NOT NULL DEFAULT 'not_qualified',
	`avgHourlyRate` int DEFAULT 0,
	`recentLivestreamCount` int DEFAULT 0,
	`totalLivestreamCount` int DEFAULT 0,
	`approvedAt` timestamp,
	`approvedBy` int,
	`rejectedAt` timestamp,
	`rejectedReason` text,
	`qualifiedAt` timestamp,
	`suspendedAt` timestamp,
	`consecutiveMonthsBelowThreshold` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mega_channel_qualifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mega_channel_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tierName` varchar(50) NOT NULL DEFAULT 'Gold',
	`hourlyRateThreshold` int NOT NULL DEFAULT 100000,
	`recentLivestreamCount` int NOT NULL DEFAULT 3,
	`channelName` varchar(255) DEFAULT 'Ryu kyogoku',
	`channelDescription` text,
	`channelFollowerCount` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`requireApproval` boolean NOT NULL DEFAULT true,
	`maintenanceMonths` int DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mega_channel_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`templateId` int,
	`toAddress` varchar(255) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text,
	`sentBy` varchar(100),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`isBulk` boolean NOT NULL DEFAULT false,
	`status` varchar(20) NOT NULL DEFAULT 'sent',
	CONSTRAINT `recruitment_email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'general',
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`variables` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recruitment_email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_follow_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recruitment_brand_id` int NOT NULL,
	`staff_id` int,
	`communication_type` enum('email','phone','wechat','meeting','other') NOT NULL DEFAULT 'other',
	`duration_minutes` int,
	`summary` text,
	`key_points` text,
	`next_action` varchar(255),
	`next_follow_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recruitment_follow_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessCardId` int NOT NULL,
	`activityType` enum('call','email','status_change','note','meeting','brand_linked') NOT NULL,
	`description` text,
	`performedBy` int NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`toName` varchar(255),
	`toCompany` varchar(255),
	`subject` varchar(500) NOT NULL,
	`contentPreview` text,
	`sendType` varchar(50) NOT NULL DEFAULT 'bulk',
	`attachPdf` boolean DEFAULT false,
	`status` varchar(20) NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`businessCardId` int,
	`sentBy` int,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`trackingId` varchar(64),
	`openedAt` timestamp,
	`openCount` int DEFAULT 0,
	`lastOpenedAt` timestamp,
	`pdfDownloadedAt` timestamp,
	`pdfDownloadCount` int DEFAULT 0,
	`replyReceived` boolean DEFAULT false,
	`replyReceivedAt` timestamp,
	`repliedByUs` boolean DEFAULT false,
	`repliedByUsAt` timestamp,
	`replyHandled` boolean DEFAULT false,
	`replyHandledAt` timestamp,
	CONSTRAINT `sales_email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_email_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logId` int NOT NULL,
	`fromAddress` varchar(320) NOT NULL,
	`fromName` varchar(255),
	`subject` varchar(500),
	`body` text,
	`receivedAt` timestamp,
	`imapUid` int,
	`imapFolder` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_email_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `streaming_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` varchar(500),
	`color` varchar(20) DEFAULT '#3B82F6',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `streaming_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `svm_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountName` varchar(255) NOT NULL,
	`displayName` varchar(255),
	`platform` varchar(50) NOT NULL DEFAULT 'tiktok',
	`category` varchar(100),
	`assignedTo` varchar(100),
	`followerCount` int DEFAULT 0,
	`profileUrl` varchar(500),
	`avatarUrl` varchar(500),
	`description` text,
	`tags` text,
	`status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`targetPostsPerDay` int DEFAULT 1,
	`lastPostDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `svm_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `svm_content_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`category` varchar(100),
	`targetAccounts` text,
	`scriptContent` text,
	`referenceUrls` text,
	`hashtags` text,
	`status` enum('idea','planning','scripted','filming','editing','ready','used','archived') NOT NULL DEFAULT 'idea',
	`assignedTo` varchar(100),
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`dueDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `svm_content_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `svm_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`scheduledDate` timestamp NOT NULL,
	`title` varchar(500),
	`description` text,
	`contentPlan` text,
	`hashtags` text,
	`assignedTo` varchar(100),
	`status` enum('planned','in_progress','ready','posted','cancelled') NOT NULL DEFAULT 'planned',
	`videoPostId` int,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `svm_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `svm_video_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`title` varchar(500),
	`description` text,
	`videoUrl` varchar(500),
	`thumbnailUrl` varchar(500),
	`postDate` timestamp NOT NULL,
	`duration` int,
	`hashtags` text,
	`views` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`saves` int DEFAULT 0,
	`contentType` varchar(50),
	`productName` varchar(255),
	`status` enum('draft','scheduled','posted','failed') NOT NULL DEFAULT 'posted',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `svm_video_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiktok_cap_creator_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`importHistoryId` int,
	`dateRange` varchar(50) NOT NULL,
	`reportMonth` varchar(7) NOT NULL,
	`creatorUsername` varchar(255) NOT NULL,
	`affiliateGmv` bigint DEFAULT 0,
	`affiliateLiveGmv` bigint DEFAULT 0,
	`affiliateVideoGmv` bigint DEFAULT 0,
	`directGmv` bigint DEFAULT 0,
	`liveDirectGmv` bigint DEFAULT 0,
	`videoDirectGmv` bigint DEFAULT 0,
	`affiliateOrders` int DEFAULT 0,
	`affiliateLiveOrders` int DEFAULT 0,
	`affiliateVideoOrders` int DEFAULT 0,
	`directOrders` int DEFAULT 0,
	`liveDirectOrders` int DEFAULT 0,
	`videoDirectOrders` int DEFAULT 0,
	`salesCount` int DEFAULT 0,
	`estimatedCommission` bigint DEFAULT 0,
	`commissionBase` bigint DEFAULT 0,
	`liveViews` bigint DEFAULT 0,
	`videoViews` bigint DEFAULT 0,
	`liveCount` int DEFAULT 0,
	`videoCount` int DEFAULT 0,
	`liveCtr` varchar(20),
	`videoCtr` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiktok_cap_creator_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiktok_cap_product_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`importHistoryId` int,
	`dateRange` varchar(50) NOT NULL,
	`reportMonth` varchar(7) NOT NULL,
	`creatorUsername` varchar(255) NOT NULL,
	`productId` varchar(64) NOT NULL,
	`productName` text NOT NULL,
	`shopId` varchar(64),
	`shopName` varchar(255),
	`affiliateGmv` bigint DEFAULT 0,
	`affiliateLiveGmv` bigint DEFAULT 0,
	`affiliateVideoGmv` bigint DEFAULT 0,
	`directGmv` bigint DEFAULT 0,
	`liveDirectGmv` bigint DEFAULT 0,
	`videoDirectGmv` bigint DEFAULT 0,
	`productCardDirectGmv` bigint DEFAULT 0,
	`affiliateOrders` int DEFAULT 0,
	`affiliateLiveOrders` int DEFAULT 0,
	`affiliateVideoOrders` int DEFAULT 0,
	`directOrders` int DEFAULT 0,
	`liveDirectOrders` int DEFAULT 0,
	`videoDirectOrders` int DEFAULT 0,
	`productCardOrders` int DEFAULT 0,
	`salesCount` int DEFAULT 0,
	`liveSalesCount` int DEFAULT 0,
	`videoSalesCount` int DEFAULT 0,
	`productCardSalesCount` int DEFAULT 0,
	`directRefundGmv` bigint DEFAULT 0,
	`refundedItems` int DEFAULT 0,
	`ctr` varchar(20),
	`ctor` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiktok_cap_product_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiktok_tap_live_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL DEFAULT 0,
	`reportMonth` varchar(7) NOT NULL,
	`dateRange` varchar(50) NOT NULL,
	`creatorUsername` varchar(255) NOT NULL,
	`liveRoomId` varchar(64),
	`liveName` text,
	`liveTimeInfo` text,
	`productId` varchar(64) NOT NULL,
	`productName` text NOT NULL,
	`shopId` varchar(64),
	`shopName` varchar(255),
	`category1` varchar(255),
	`category2` varchar(255),
	`liveGmv` bigint DEFAULT 0,
	`liveOrders` int DEFAULT 0,
	`broadcastTime` bigint DEFAULT 0,
	`liveViews` bigint DEFAULT 0,
	`liveLikes` bigint DEFAULT 0,
	`liveRpm` decimal(20,2) DEFAULT '0',
	`estimatedPartnerCommission` bigint DEFAULT 0,
	`actualPartnerCommission` bigint DEFAULT 0,
	`salesCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiktok_tap_live_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiktok_tap_video_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL DEFAULT 0,
	`reportMonth` varchar(7) NOT NULL,
	`dateRange` varchar(50) NOT NULL,
	`creatorUsername` varchar(255) NOT NULL,
	`videoId` varchar(64),
	`videoName` text,
	`postTime` text,
	`productId` varchar(64) NOT NULL,
	`productName` text NOT NULL,
	`shopId` varchar(64),
	`shopName` varchar(255),
	`category1` varchar(255),
	`category2` varchar(255),
	`videoGmv` bigint DEFAULT 0,
	`videoOrders` int DEFAULT 0,
	`estimatedPartnerCommission` bigint DEFAULT 0,
	`actualPartnerCommission` bigint DEFAULT 0,
	`broadcastTime` bigint DEFAULT 0,
	`videoViews` bigint DEFAULT 0,
	`videoLikes` bigint DEFAULT 0,
	`videoRpm` decimal(20,2) DEFAULT '0',
	`salesCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiktok_tap_video_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tsp_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int,
	`lcjStaffId` int,
	`shopName` varchar(255) NOT NULL,
	`companyName` varchar(255),
	`contactName` varchar(255),
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(50),
	`postalCode` varchar(20),
	`address` text,
	`monthlyAmount` int NOT NULL,
	`taxRate` int NOT NULL DEFAULT 10,
	`contractStartDate` timestamp NOT NULL,
	`contractEndDate` timestamp,
	`billingDay` int NOT NULL DEFAULT 1,
	`paymentDueDays` int NOT NULL DEFAULT 30,
	`paymentMethod` varchar(50) NOT NULL DEFAULT 'bank_transfer',
	`description` text,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`stripePriceId` varchar(255),
	`stripeProductId` varchar(255),
	`tapShopName` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tsp_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tsp_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`invoiceNumber` varchar(100),
	`billingMonth` varchar(7) NOT NULL,
	`amount` int NOT NULL,
	`taxAmount` int NOT NULL,
	`totalAmount` int NOT NULL,
	`description` text,
	`dueDate` timestamp,
	`stripeInvoiceId` varchar(255),
	`stripeInvoiceUrl` text,
	`stripeInvoicePdf` text,
	`status` varchar(50) NOT NULL DEFAULT 'draft',
	`paidAt` timestamp,
	`sentAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tsp_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `step_email_logs` DROP INDEX `step_email_logs_trackingId_unique`;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `tspContractId` int;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `currency` varchar(10) DEFAULT 'JPY';--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `kgLiveCondition` text;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `liverLiveCondition` text;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `shortVideoCondition` text;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `kgLiveHoursQuota` int;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `liverLiveHoursQuota` int;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `shortVideoCountQuota` int;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `kgLiveFrequency` int;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `kgLiveMinutesPerSession` int;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `liverLiveAssignments` json;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `shortVideoAssignments` json;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `contractPeriodLabel` varchar(100);--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `verifiedBy` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `verifiedByStaffId` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `verifiedByStaffName` varchar(255);--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `streamAccountLiverId` int;--> statement-breakpoint
ALTER TABLE `brands` ADD `shopId` varchar(100);--> statement-breakpoint
ALTER TABLE `brands` ADD `shopCode` varchar(100);--> statement-breakpoint
ALTER TABLE `brands` ADD `businessManagerId` int;--> statement-breakpoint
ALTER TABLE `brands` ADD `operationsManagerId` int;--> statement-breakpoint
ALTER TABLE `brands` ADD `larkRecordId` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkStage` varchar(100);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkTier` varchar(50);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkCategory` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkContactPlatform` varchar(100);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkBrandManager` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkBusinessContact` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkBusinessLead` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkOperationsContact` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkShopId` varchar(255);--> statement-breakpoint
ALTER TABLE `brands` ADD `larkIntro` text;--> statement-breakpoint
ALTER TABLE `brands` ADD `larkSyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `business_cards` ADD `salesStatus` enum('new','contacted','negotiating','meeting','contracted','rejected') DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `business_cards` ADD `assignedTo` int;--> statement-breakpoint
ALTER TABLE `business_cards` ADD `nextFollowUpAt` timestamp;--> statement-breakpoint
ALTER TABLE `business_cards` ADD `linkedBrandId` int;--> statement-breakpoint
ALTER TABLE `line_receipts` ADD `orderNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `livers` ADD `agencyId` int;--> statement-breakpoint
ALTER TABLE `livers` ADD `capEnabled` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `livers` ADD `capLcjRate` decimal(5,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `livers` ADD `capCreatorRate` decimal(5,2) DEFAULT '100';--> statement-breakpoint
ALTER TABLE `livers` ADD `uid` varchar(100);--> statement-breakpoint
ALTER TABLE `livestream_brands` ADD `durationMinutes` int;--> statement-breakpoint
ALTER TABLE `livestream_brands` ADD `gmv` bigint;--> statement-breakpoint
ALTER TABLE `mall_carts` ADD `variantId` int;--> statement-breakpoint
ALTER TABLE `mall_order_items` ADD `variantId` int;--> statement-breakpoint
ALTER TABLE `mall_order_items` ADD `variantName` varchar(255);--> statement-breakpoint
ALTER TABLE `mall_products` ADD `subcategoryId` int;--> statement-breakpoint
ALTER TABLE `mall_products` ADD `videoUrl` text;--> statement-breakpoint
ALTER TABLE `mall_products` ADD `videoKey` varchar(512);--> statement-breakpoint
ALTER TABLE `mall_products` ADD `commission_rate` decimal(5,2);--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `brand_stage` enum('startup','growth','mature','famous');--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `annual_revenue` varchar(50);--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `cooperation_history` varchar(50);--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `source_channel` varchar(100);--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `wechat` varchar(100);--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `website_url` varchar(500);--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `intent_level` enum('high','normal','dormant');--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `client_value` enum('high','medium','low');--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `follow_difficulty` enum('easy','medium','hard');--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `custom_tags` text;--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `next_follow_date` timestamp;--> statement-breakpoint
ALTER TABLE `recruitment_brands` ADD `next_follow_action` varchar(255);--> statement-breakpoint
ALTER TABLE `sample_requests` ADD `recipient_name` varchar(255);--> statement-breakpoint
ALTER TABLE `schedules` ADD `brandIds` json;--> statement-breakpoint
ALTER TABLE `schedules` ADD `locationId` int;--> statement-breakpoint
ALTER TABLE `staff` ADD `tier` varchar(10);--> statement-breakpoint
ALTER TABLE `staff` ADD `evaluationScore` int;--> statement-breakpoint
ALTER TABLE `staff` ADD `salary` decimal(10,2);--> statement-breakpoint
ALTER TABLE `staff` ADD `salaryCurrency` varchar(5) DEFAULT 'JPY';