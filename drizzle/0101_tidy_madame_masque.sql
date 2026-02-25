ALTER TABLE `product_master` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `product_master` ADD `imageKey` varchar(512);--> statement-breakpoint
ALTER TABLE `product_master` ADD `imageStatus` enum('none','auto_fetched','confirmed','rejected') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_master` ADD `imageSource` varchar(255);--> statement-breakpoint
ALTER TABLE `product_master` ADD `regularPrice` int;--> statement-breakpoint
ALTER TABLE `product_master` ADD `specialPrice` int;--> statement-breakpoint
ALTER TABLE `product_master` ADD `isActive` boolean DEFAULT true NOT NULL;