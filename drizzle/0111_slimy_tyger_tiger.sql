CREATE TABLE `popup_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantId` int NOT NULL,
	`lineUserId` int,
	`sessionId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `popup_clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `popup_impressions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantId` int NOT NULL,
	`lineUserId` int,
	`sessionId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `popup_impressions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `popup_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantKey` varchar(128) NOT NULL,
	`theme` varchar(32) NOT NULL,
	`menuItems` json NOT NULL,
	`headline` varchar(255) NOT NULL,
	`subtext` varchar(255) NOT NULL,
	`ctaText` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `popup_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `popup_variants_variantKey_unique` UNIQUE(`variantKey`)
);
