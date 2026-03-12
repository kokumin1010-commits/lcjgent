ALTER TABLE `brand_activities` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brand_contracts` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brand_files` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brand_memos` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brand_products` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `brands` ADD `deletedAt` timestamp;