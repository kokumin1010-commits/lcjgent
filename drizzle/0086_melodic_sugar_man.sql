ALTER TABLE `referral_history` ADD `status` enum('pending','confirmed','cancelled') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `referral_history` ADD `confirmedAt` timestamp;