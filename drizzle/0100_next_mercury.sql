CREATE TABLE `review_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`productName` text NOT NULL,
	`userId` int,
	`lineUserId` varchar(64),
	`questionText` text NOT NULL,
	`answerUserId` int,
	`answerLineUserId` varchar(64),
	`answerText` text,
	`answeredAt` timestamp,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`userId` int,
	`lineUserId` varchar(64),
	`reactionType` enum('bought','want') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `receipt_reviews` ADD `productImageUrl` text;--> statement-breakpoint
ALTER TABLE `receipt_reviews` ADD `purchasePlatform` varchar(50);--> statement-breakpoint
ALTER TABLE `receipt_reviews` ADD `videoUrl` text;--> statement-breakpoint
ALTER TABLE `receipt_reviews` ADD `liveCommerceUrl` text;