CREATE TABLE `mall_product_desc_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(500),
	`sortOrder` int NOT NULL DEFAULT 0,
	`caption` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_product_desc_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_product_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`lineUserId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(100),
	`content` text,
	`imageUrls` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_product_reviews_id` PRIMARY KEY(`id`)
);
