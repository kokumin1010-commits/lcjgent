CREATE TABLE `referral_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`code` varchar(4) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`totalReferrals` int NOT NULL DEFAULT 0,
	`totalPointsEarned` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referral_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralCodeId` int NOT NULL,
	`referrerLiverId` int NOT NULL,
	`referredLineUserId` int NOT NULL,
	`newUserPoints` int NOT NULL DEFAULT 500,
	`referrerPoints` int NOT NULL DEFAULT 200,
	`newUserPointAwarded` boolean NOT NULL DEFAULT false,
	`referrerPointAwarded` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_history_id` PRIMARY KEY(`id`)
);
