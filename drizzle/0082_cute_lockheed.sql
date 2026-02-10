ALTER TABLE `mall_orders` MODIFY COLUMN `status` enum('pending','paid','confirmed','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `mall_orders` ADD `paymentMethod` enum('stripe','points','cod') DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `mall_orders` ADD `stripeSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `mall_orders` ADD `stripePaymentIntentId` varchar(255);