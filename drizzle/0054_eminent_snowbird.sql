ALTER TABLE `livestream_products` MODIFY COLUMN `productName` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `productCsvImported` enum('yes','no') DEFAULT 'no';--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `grossRevenue` bigint;--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `directGmv` bigint;--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `itemsSold` int;--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `customers` int;--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `orders` int;--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `ctr` varchar(20);--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `ctor` varchar(20);--> statement-breakpoint
ALTER TABLE `livestream_products` ADD `productImpressions` int;