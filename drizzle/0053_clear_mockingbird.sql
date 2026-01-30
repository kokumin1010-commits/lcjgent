ALTER TABLE `brand_livestreams` ADD `ctor` varchar(20);--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `peakViewers` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `newFollowers` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `avgViewDuration` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `likes` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `comments` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `shares` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `avgPrice` bigint;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `gmvPer1kShows` varchar(50);--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `gmvPer1kViews` varchar(50);--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `customerCount` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `itemsSold` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `csvImported` enum('yes','no') DEFAULT 'no';